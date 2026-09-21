-- PD-006 (E-015, Product Decision Closure, final business decision,
-- 2026-09-21): a governed `correction` may move the affected commercial
-- component's own historical start date backward (example given: a
-- component recorded as starting 1 July is corrected to show it should
-- have started 1 June).
--
-- `commercial_components` is immutable except a single effective_to
-- closure transition (`fn_protect_commercial_component_lifecycle`,
-- 20260908210000): `effective_from` can never be changed on an existing
-- row, by design. This migration therefore never updates an existing
-- row's `effective_from`. Instead, when a correction's own effective_date
-- is earlier than a currently-open component's own recorded
-- effective_from (the retroactive-start case), the existing row is left
-- completely untouched (preserving exactly what was originally recorded,
-- never silently rewritten), and a NEW row is inserted for the same
-- `stable_component_key`, covering the previously-missing historical gap:
-- effective_from = the correction's effective_date, effective_to = the
-- existing row's own effective_from minus one day. The existing row's
-- own effective_to closure transition (still null -> a date, exactly
-- once, whenever its own successor eventually arrives) is entirely
-- unaffected by this. A reader walking the full stable_component_key
-- chain chronologically sees the true, corrected start date; a reader
-- looking at either individual row sees exactly what was recorded and
-- when, in full.
--
-- Every other category (renewal, amendment, other) is completely
-- unaffected: the ordering guard PD-006 already exempted `correction`
-- from (20260930100000) is untouched, and the bulk-close/insert
-- behavior for every non-retroactive case (including a `correction`
-- whose effective_date is not earlier than the currently open
-- component's own start) is byte-for-byte the same as before.
--
-- Deliberately not built here, per the standing future-Invoicing/MRR
-- design note (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §23a, preserved):
-- no invoice, credit/debit note, MRR restatement, accounting-period
-- control, or ERP behavior. If a retroactive correction later affects an
-- already-invoiced/recognized period, the original invoice/recognition
-- record remains untouched by this mechanism; any financial difference
-- must be handled through a controlled adjustment once Invoicing and MRR
-- Recognition exist.

create or replace function approve_commercial_configuration_version(
  p_request_id uuid,
  p_components jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_expected_current_node_key text default null
)
returns commercial_configuration_versions
language plpgsql
security invoker
as $function$
declare
  v_version commercial_configuration_versions;
  v_system_request_id uuid;
  v_commercial_change commercial_changes;
  v_component jsonb;
  v_new_component_id uuid;
  v_mug_threshold numeric;
  v_stable_key uuid;
  v_current_team_id uuid;
  v_segment text;
  v_next record;
  v_should_finalize boolean;
  v_new_current_node_key text;
  v_backfill_until date;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from commercial_configuration_versions where request_id = p_request_id for update;
  if not found then
    raise exception 'COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for request %', p_request_id;
  end if;

  if v_version.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_version.status = 'approved' then
    return v_version;
  end if;

  if v_version.status <> 'submitted' then
    raise exception 'COMMERCIAL_VERSION_NOT_APPROVABLE: version % has status %, only submitted may be approved', p_request_id, v_version.status;
  end if;

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_version.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  if v_version.change_category <> 'correction' and exists (
    select 1 from commercial_components
    where commercial_configuration_id = v_version.commercial_configuration_id
      and effective_to is null
      and effective_from >= v_version.effective_date
  ) then
    raise exception 'COMMERCIAL_VERSION_EFFECTIVE_DATE_OUT_OF_ORDER: version % has effective_date % which must be strictly after the currently active period''s own start date', p_request_id, v_version.effective_date;
  end if;

  select c.segment into v_segment
  from commercial_configurations cc
  join customers c on c.id = cc.customer_id
  where cc.id = v_version.commercial_configuration_id;

  v_current_team_id := fn_workflow_node_team(v_version.workflow_version_id, v_version.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select * into v_next
  from fn_resolve_workflow_next_approval(v_version.workflow_version_id, v_version.current_workflow_node_key, jsonb_build_object('segment', v_segment));

  if v_next.node_type is null then
    if v_version.current_workflow_node_key is null then
      v_should_finalize := true;
      v_new_current_node_key := null;
    else
      raise exception 'WORKFLOW_GRAPH_DEAD_END: this version''s workflow has no reachable Approval or End node after node "%"; ask a Workflow Admin to fix the graph', v_version.current_workflow_node_key;
    end if;
  elsif v_next.node_type = 'approval' then
    v_should_finalize := false;
    v_new_current_node_key := v_next.node_key;
  else
    v_should_finalize := true;
    v_new_current_node_key := v_next.node_key;
  end if;

  if v_version.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('commercial_configuration', p_request_id, v_version.workflow_version_id, v_version.workflow_cycle_number, v_version.current_workflow_node_key, v_new_current_node_key, 'approve', p_actor_user_id, null);
  end if;

  if not v_should_finalize then
    update commercial_configuration_versions
    set current_workflow_node_key = v_new_current_node_key,
        updated_by = p_actor_user_id, updated_at = now()
    where request_id = p_request_id
    returning * into v_version;

    return v_version;
  end if;

  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  -- Retroactive-start correction (PD-006 final decision): only close a
  -- currently-open component whose own effective_from is not later than
  -- this version's effective_date. A component whose effective_from is
  -- LATER (only possible for change_category = 'correction', since the
  -- ordering guard above already blocks this for every other category)
  -- is left untouched here on purpose; the loop below inserts its
  -- retroactive predecessor row instead of closing it.
  update commercial_components
  set effective_to = v_version.effective_date - 1, updated_by = p_actor_user_id, updated_at = now()
  where commercial_configuration_id = v_version.commercial_configuration_id
    and effective_to is null
    and effective_from <= v_version.effective_date;

  insert into commercial_changes (request_id, commercial_configuration_id, change_category, effective_date, reason, created_by)
  values (v_system_request_id, v_version.commercial_configuration_id, v_version.change_category, v_version.effective_date, v_version.reason, p_actor_user_id)
  returning * into v_commercial_change;

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    v_new_component_id := gen_random_uuid();
    v_stable_key := nullif(v_component ->> 'stable_component_key', '')::uuid;

    -- Does this component's own currently-open row still exist,
    -- untouched, because this correction's effective_date is before its
    -- own effective_from? If so, the new row being inserted is that
    -- component's retroactively-established earlier period, not its
    -- new current one: close it exactly where the existing, immutable
    -- row already begins, never touching that existing row itself.
    v_backfill_until := null;
    if v_version.change_category = 'correction' and v_stable_key is not null then
      select effective_from into v_backfill_until
      from commercial_components
      where commercial_configuration_id = v_version.commercial_configuration_id
        and stable_component_key = v_stable_key
        and effective_to is null
        and effective_from > v_version.effective_date;
    end if;

    perform add_commercial_component(
      v_new_component_id,
      v_version.commercial_configuration_id,
      v_commercial_change.request_id,
      (v_component ->> 'is_recurring')::boolean,
      v_component ->> 'pricing_rule_kind',
      v_component -> 'pricing_rule_parameters',
      v_component ->> 'billing_cadence',
      v_component ->> 'billing_timing',
      v_component ->> 'reconciliation_cadence',
      v_component ->> 'transaction_currency',
      nullif(v_component ->> 'fx_snapshot_rate', '')::numeric,
      (v_component ->> 'effective_from')::date,
      p_actor_user_id,
      v_component ->> 'billing_quantity_basis',
      null,
      null,
      p_actor_context,
      v_stable_key
    );

    if v_backfill_until is not null then
      update commercial_components
      set effective_to = v_backfill_until - 1, updated_by = p_actor_user_id, updated_at = now()
      where id = v_new_component_id;
    end if;

    v_mug_threshold := nullif(v_component ->> 'mug_threshold_value', '')::numeric;
    if v_mug_threshold is not null then
      perform add_commercial_commitment(
        gen_random_uuid(), v_commercial_change.request_id, v_new_component_id,
        v_mug_threshold, (v_component ->> 'effective_from')::date, p_actor_user_id, p_actor_context
      );
    end if;
  end loop;

  update commercial_configuration_versions
  set status = 'approved', commercial_change_id = v_commercial_change.request_id,
      decided_by = p_actor_user_id, decided_at = now(),
      current_workflow_node_key = v_new_current_node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;

revoke execute on function approve_commercial_configuration_version(uuid, jsonb, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function approve_commercial_configuration_version(uuid, jsonb, uuid, jsonb, text) to service_role;
