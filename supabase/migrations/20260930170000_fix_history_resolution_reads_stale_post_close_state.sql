-- Batch 14 (Pricing Models / MUG / Slab / Designation journeys): a real,
-- severe regression found live while approving an ordinary amendment
-- that edits an existing, previously-approved component.
--
-- 20260930160000's per-component history resolution (added for PD-006's
-- retroactive-start correction mechanic) queries `commercial_components`
-- for the component's own currently-open row (`effective_to is null`)
-- AFTER this same function's earlier bulk-close UPDATE has already run.
-- That UPDATE closes every currently-open component whose
-- `effective_from <= v_version.effective_date`, which is true for any
-- ordinary supersession of an existing component. By the time the
-- per-component loop's lookup runs, that row's `effective_to` is no
-- longer null, so `v_current_open_effective_from` always resolves to
-- NULL. For `change_category = 'correction'` this only broke the
-- ordinary forward-supersession branch (never actually verified live,
-- since this session's own PD-006 retest only exercised the backward-
-- extension and mid-history-conflict branches); for every OTHER category
-- (amendment, renewal, other) it broke approval entirely whenever the
-- submitted component carried a `stable_component_key` (i.e. any edit to
-- an existing, previously-approved component, the single most common
-- case in this domain), always falling through to the `else` branch and
-- raising `COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY` even
-- though nothing actually conflicted.
--
-- Fix: resolve each submitted component's stable-key history (earliest
-- effective_from, and the effective_from of whichever row is CURRENTLY
-- open) into a temporary table BEFORE the bulk-close UPDATE runs, so the
-- per-component loop reads pre-close state instead of state this same
-- transaction just mutated. Also restores the original, pre-PD-006
-- behavior for non-correction categories: the history-conflict check now
-- only ever applies when `change_category = 'correction'`, matching
-- PD-006's own intent (this mechanic was only ever meant to govern
-- corrections; every other category is already fully governed by the
-- unchanged, pre-existing ordering guard earlier in this same function).

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
  v_earliest_effective_from date;
  v_current_open_effective_from date;
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

  -- Resolve every submitted component's stable-key history BEFORE the
  -- bulk-close UPDATE below mutates it: reading this after the close
  -- would see the just-closed row as no longer "currently open" (see
  -- this migration's own header). Only meaningful for
  -- change_category = 'correction'; every other category is already
  -- fully governed by the ordering guard above and never consults this
  -- table.
  create temporary table if not exists tmp_component_history (
    stable_component_key uuid primary key,
    earliest_effective_from date,
    current_open_effective_from date
  ) on commit drop;
  delete from tmp_component_history;

  if v_version.change_category = 'correction' then
    insert into tmp_component_history (stable_component_key, earliest_effective_from, current_open_effective_from)
    select keys.sk, min(cc.effective_from), max(cc.effective_from) filter (where cc.effective_to is null)
    from (
      select distinct nullif(elem ->> 'stable_component_key', '')::uuid as sk
      from jsonb_array_elements(p_components) elem
    ) keys
    join commercial_components cc
      on cc.commercial_configuration_id = v_version.commercial_configuration_id
      and cc.stable_component_key = keys.sk
    where keys.sk is not null
    group by keys.sk;
  end if;

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
    v_backfill_until := null;

    if v_stable_key is not null and v_version.change_category = 'correction' then
      select h.earliest_effective_from, h.current_open_effective_from
      into v_earliest_effective_from, v_current_open_effective_from
      from tmp_component_history h
      where h.stable_component_key = v_stable_key;

      if v_earliest_effective_from is not null then
        if v_version.effective_date < v_earliest_effective_from then
          -- Genuine backward extension of the whole known history for
          -- this component: safe by construction, since it starts
          -- before every row that currently exists. Close the new row
          -- exactly where the earliest existing row already begins.
          v_backfill_until := v_earliest_effective_from;
        elsif v_current_open_effective_from is not null and v_version.effective_date >= v_current_open_effective_from then
          -- Ordinary forward supersession of the currently active
          -- period; already handled by the bulk close above. No
          -- backfill closure needed on the new row.
          v_backfill_until := null;
        else
          -- The target date falls inside territory an existing,
          -- already-closed row for this component already covers.
          -- Accepting this would create a second overlapping row for
          -- the same stable_component_key (the exact defect
          -- 20260930160000 fixed); reject explicitly instead.
          raise exception 'COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY: version % has effective_date % which falls within this component''s already-recorded history; a correction may only move the start date earlier than % (extending the known history further back) or on/after % (the currently active period''s own start)',
            p_request_id, v_version.effective_date, v_earliest_effective_from, v_current_open_effective_from;
        end if;
      end if;
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
