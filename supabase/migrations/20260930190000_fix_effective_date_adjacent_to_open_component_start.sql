-- Real defect, found incidentally during Nexus Batch 14 journey execution
-- (out of that batch's own scope) and confirmed via a rolled-back live
-- reproduction against this project: approving a Commercial Version whose
-- effective_date is exactly one day after a currently open
-- commercial_components row's own effective_from raised a raw, unfriendly
-- Postgres error instead of a clean, named one.
--
-- Root cause: the bulk-close step (unchanged since 20260930150000, carried
-- forward untouched through 20260930170000 and 20260930180000) sets
-- effective_to = v_version.effective_date - 1 for every currently open
-- component whose own effective_from is not later than the new version's
-- effective_date. When an existing open component's own effective_from is
-- exactly one day before the version's effective_date, that computed
-- effective_to equals the row's own effective_from, which fails
-- chk_commercial_components_effective_dating (effective_to is null or
-- effective_to > effective_from): a component can only be closed once it
-- has been open for at least two calendar days, since the day before
-- closure is the last day it is considered active.
--
-- Fix: detect this specific condition before any mutation happens (same
-- place, same style, as the existing COMMERCIAL_VERSION_EFFECTIVE_DATE_OUT_OF_ORDER
-- guard above it) and raise a clear, named error instead of letting the
-- constraint violation surface raw. This applies regardless of
-- change_category: the bulk-close statement it protects runs for every
-- category, correction included, whenever the version's effective_date
-- supersedes (rather than retroactively precedes) the open component's own
-- start. Whether a same-day/next-day supersession should ever be allowed by
-- relaxing the underlying date-span constraint is a separate product
-- decision, not made by this migration; this only makes the existing,
-- already-enforced rule fail cleanly instead of raw.
--
-- Otherwise byte-for-byte identical to 20260930180000 (the temp-table
-- history-resolution fix and its own unqualified-DELETE follow-up), which
-- this migration builds on top of, not the earlier 20260930160000 body.

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
  v_conflicting_effective_from date;
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

  -- Real defect found via live retest: a currently open component whose own
  -- effective_from is exactly one day before this version's effective_date
  -- would be closed by the bulk-close step below to effective_to equal to
  -- its own effective_from, which chk_commercial_components_effective_dating
  -- rejects. Caught here, before any mutation, with a clear named error.
  select effective_from into v_conflicting_effective_from
  from commercial_components
  where commercial_configuration_id = v_version.commercial_configuration_id
    and effective_to is null
    and effective_from = v_version.effective_date - 1
  limit 1;

  if v_conflicting_effective_from is not null then
    raise exception 'COMMERCIAL_VERSION_EFFECTIVE_DATE_ADJACENT_TO_OPEN_COMPONENT_START: version % has effective_date % which is exactly one day after an existing open component''s own start date (%); that component would need to be closed on the same day it started, which is not a valid historical period. Choose an effective date on or after %, or on or before % if you intend to correct that period''s own start',
      p_request_id, v_version.effective_date, v_conflicting_effective_from, v_conflicting_effective_from + 2, v_conflicting_effective_from;
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
  -- 20260930170000's own header). Only meaningful for
  -- change_category = 'correction'; every other category is already
  -- fully governed by the ordering guard above and never consults this
  -- table.
  create temporary table if not exists tmp_component_history (
    stable_component_key uuid primary key,
    earliest_effective_from date,
    current_open_effective_from date
  ) on commit drop;
  delete from tmp_component_history where true;

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
