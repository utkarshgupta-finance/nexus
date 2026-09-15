-- Nexus: Workflow Runtime V1 (Nexus Foundational Hardening, Phase 2).
--
-- Workflow Builder (Settings > Workflows) has been authoring/publishing
-- only: a published graph's Approval node names a Responsible Team and
-- a Required Permission, but until this migration nothing at approval
-- time ever read that graph. Every governed approve_* RPC enforced a
-- single fixed, hardcoded permission with no team scoping at all
-- (docs/WORKFLOW_ENGINE_ARCHITECTURE.md §3a documented this gap
-- explicitly as "publishing or editing a workflow graph today never
-- changes who can actually approve anything, in any domain").
--
-- This migration closes that gap for TEAM ROUTING specifically, for all
-- four governed domains, while deliberately keeping the REQUIRED
-- PERMISSION fixed and domain-owned (never redirectable by whoever can
-- author a workflow graph): a Workflow Admin can route an Approval node
-- to a specific team, but cannot use the graph to weaken which
-- permission an approver must hold. This is the bounded, defensible
-- scope of "the Builder controls runtime" for V1: team routing is real;
-- the permission boundary stays a Nexus-owned security invariant.
--
-- Also adds real Decision-node branching: a bounded, deterministic graph
-- walk (Start -> optional Decision branches -> Approval), not a general
-- BPM engine. Decision conditions reuse the existing field/operator/
-- value vocabulary from src/platform/workflow/domain/types.ts
-- (WorkflowCondition), restricted here to "equals"/"not_equals" (no
-- current/proposed distinction exists for a static approval-routing
-- context, so "changed" is not meaningful here and is rejected at
-- publish time).
--
-- workflow_version_id is added to the three remaining governed tables
-- (commercial_configuration_versions, customer_onboarding_cases,
-- customer_change_requests), resolved once at creation exactly like
-- go_live_requests.workflow_version_id already is: an in-flight request
-- keeps the Workflow Version it started with even if a newer version is
-- published later.
--
-- This file has not been applied to any database as of authoring.

-- =============================================================================
-- 1. workflow_version_id on the three remaining governed tables
-- =============================================================================

alter table commercial_configuration_versions
  add column workflow_version_id uuid references workflow_definition_versions (id);

alter table customer_onboarding_cases
  add column workflow_version_id uuid references workflow_definition_versions (id);

alter table customer_change_requests
  add column workflow_version_id uuid references workflow_definition_versions (id);

comment on column commercial_configuration_versions.workflow_version_id is
  'The published Workflow Version (applies_to = commercial_configuration) current when this version was created. Resolved once, never re-resolved: an in-flight version keeps the graph it started with even if a newer one is published later.';
comment on column customer_onboarding_cases.workflow_version_id is
  'The published Workflow Version (applies_to = customer_onboarding) current when this case was created. Resolved once, never re-resolved.';
comment on column customer_change_requests.workflow_version_id is
  'The published Workflow Version (applies_to = customer_change) current when this request was created. Resolved once, never re-resolved.';

-- =============================================================================
-- 2. fn_resolve_workflow_responsible_team: the one shared runtime walk
-- =============================================================================

/**
 * Given a bound workflow_version_id and a small context fact bag
 * (currently only {"segment": "..."} for Commercial Configuration;
 * every other domain passes '{}'::jsonb, which safely resolves an
 * all-branches-equal-false Decision as the "no matching branch" error
 * below, so a Decision node in a non-commercial workflow behaves the
 * same deterministic way rather than silently doing nothing), walks the
 * graph Start -> [Decision branches] -> the first Approval node
 * actually reached, and returns that Approval node's responsible_team_id
 * (or null if the node names no team, meaning no team restriction).
 * Returns null (no restriction) if p_workflow_version_id is null (no
 * workflow bound) or the graph has no Start node, or no Approval node is
 * ever reached along the path taken (the graceful-degradation default
 * documented in platform/workflow-builder/domain/runtime.ts's own
 * DEFAULT_APPROVAL_STEP). Bounded to 10 hops so a validation gap can
 * never hang an approval in an infinite loop; publish-time validation
 * (see below) is the real cycle guard.
 *
 * This mirrors src/platform/workflow-builder/domain/runtime.ts's TS
 * traversal exactly (same algorithm, two implementations: this one is
 * the actual enforcement gate, run inside the same transaction as the
 * approval; the TS one is display-only, used to show a "Responsible
 * Team" column before an approval is even attempted).
 */
create function fn_resolve_workflow_responsible_team(
  p_workflow_version_id uuid,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
as $function$
declare
  v_current_key text;
  v_node_type text;
  v_team_id uuid;
  v_hops integer := 0;
  v_edge record;
  v_chosen_key text;
  v_fallback_key text;
  v_field text;
  v_operator text;
  v_value text;
  v_actual text;
begin
  if p_workflow_version_id is null then
    return null;
  end if;

  select node_key into v_current_key
  from workflow_nodes
  where workflow_version_id = p_workflow_version_id and node_type = 'start'
  limit 1;

  if v_current_key is null then
    return null;
  end if;

  loop
    v_hops := v_hops + 1;
    if v_hops > 10 then
      return null;
    end if;

    select node_type, responsible_team_id into v_node_type, v_team_id
    from workflow_nodes
    where workflow_version_id = p_workflow_version_id and node_key = v_current_key;

    if v_node_type = 'approval' then
      return v_team_id;
    end if;

    if v_node_type = 'end' or v_node_type is null then
      return null;
    end if;

    if v_node_type = 'decision' then
      v_chosen_key := null;
      v_fallback_key := null;

      for v_edge in
        select to_node_key, condition
        from workflow_edges
        where workflow_version_id = p_workflow_version_id and from_node_key = v_current_key
        order by to_node_key
      loop
        if v_edge.condition is null then
          if v_fallback_key is null then
            v_fallback_key := v_edge.to_node_key;
          end if;
          continue;
        end if;

        v_field := v_edge.condition ->> 'field';
        v_operator := v_edge.condition ->> 'operator';
        v_value := v_edge.condition ->> 'value';
        v_actual := p_context ->> v_field;

        if v_operator = 'equals' and v_actual = v_value then
          v_chosen_key := v_edge.to_node_key;
          exit;
        elsif v_operator = 'not_equals' and v_actual is distinct from v_value then
          v_chosen_key := v_edge.to_node_key;
          exit;
        end if;
      end loop;

      if v_chosen_key is null then
        v_chosen_key := v_fallback_key;
      end if;

      if v_chosen_key is null then
        raise exception 'WORKFLOW_DECISION_NO_MATCH: this request did not match any branch of its workflow''s Decision step, and the Decision step has no default (unconditioned) branch. Ask a Workflow Admin to add a default branch.';
      end if;

      v_current_key := v_chosen_key;
    else
      -- start / form_step: take the single outgoing edge (publish
      -- validation requires every non-end node to have one), first by
      -- to_node_key for determinism if more than one somehow exists.
      select to_node_key into v_chosen_key
      from workflow_edges
      where workflow_version_id = p_workflow_version_id and from_node_key = v_current_key
      order by to_node_key
      limit 1;

      if v_chosen_key is null then
        return null;
      end if;

      v_current_key := v_chosen_key;
    end if;
  end loop;
end;
$function$;

comment on function fn_resolve_workflow_responsible_team(uuid, jsonb) is
  'Bounded Workflow Runtime V1 graph walk: Start -> optional Decision branches -> first Approval node reached. Returns that node''s responsible_team_id, or null for "no team restriction" / "no workflow bound" / "no Approval node reached". Raises WORKFLOW_DECISION_NO_MATCH if a Decision node''s branches are exhausted with no default. See this migration''s header for the security boundary this does NOT cross (required permission stays fixed, never graph-controlled).';

revoke all on function fn_resolve_workflow_responsible_team(uuid, jsonb) from public, anon, authenticated;
grant execute on function fn_resolve_workflow_responsible_team(uuid, jsonb) to service_role;

/** Shared team-membership check, raising the same human-readable error every approve_* RPC needs. Never used to grant a permission, only to narrow which already-permitted actor may act. */
create function fn_require_workflow_team_membership(p_team_id uuid, p_actor_user_id uuid)
returns void
language plpgsql
security invoker
as $function$
declare
  v_team_name text;
begin
  if p_team_id is null then
    return;
  end if;

  if exists (select 1 from user_teams where user_id = p_actor_user_id and team_id = p_team_id and revoked_at is null) then
    return;
  end if;

  select name into v_team_name from teams where id = p_team_id;
  raise exception 'WORKFLOW_TEAM_REQUIRED: this request''s workflow requires an approver from the "%" team. You are not an active member of that team.', coalesce(v_team_name, 'assigned');
end;
$function$;

comment on function fn_require_workflow_team_membership(uuid, uuid) is
  'Raises WORKFLOW_TEAM_REQUIRED unless p_actor_user_id is an active (non-revoked) member of p_team_id. No-op when p_team_id is null (Approval node names no team, so no restriction).';

revoke all on function fn_require_workflow_team_membership(uuid, uuid) from public, anon, authenticated;
grant execute on function fn_require_workflow_team_membership(uuid, uuid) to service_role;

-- =============================================================================
-- 3. Stamp workflow_version_id at creation: mirrors create_go_live_request
-- =============================================================================

create or replace function create_commercial_configuration_version(
  p_new_request_id uuid,
  p_commercial_configuration_id uuid,
  p_change_category text,
  p_initial_raw_data jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
as $function$
declare
  v_form_definition_id uuid;
  v_form_version_id uuid;
  v_workflow_version_id uuid;
  v_version commercial_configuration_versions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_change_category = 'initial_setup' then
    raise exception 'COMMERCIAL_VERSION_INVALID_CATEGORY: initial_setup is only valid for the first Commercial Change, created atomically with the Configuration itself';
  end if;

  if not exists (select 1 from commercial_configurations where id = p_commercial_configuration_id) then
    raise exception 'COMMERCIAL_VERSION_CONFIGURATION_NOT_FOUND: no commercial_configurations row for id %', p_commercial_configuration_id;
  end if;

  insert into public.form_definitions (key, name, description, created_by, updated_by)
  values (
    'commercial_configuration_version',
    'System: Commercial Configuration Version (internal)',
    'System-internal Form Definition standing in for a dedicated Commercial Configuration Version business form, which does not exist yet.',
    p_actor_user_id, p_actor_user_id
  )
  on conflict (key) do nothing;

  select id into v_form_definition_id from public.form_definitions where key = 'commercial_configuration_version';

  select fv.resource_id into v_form_version_id
  from public.form_versions fv
  where fv.form_definition_id = v_form_definition_id and fv.status = 'published'
  order by fv.version_number desc
  limit 1;

  if v_form_version_id is null then
    v_form_version_id := gen_random_uuid();
    insert into public.resources (resource_id, resource_type, created_by)
    values (v_form_version_id, 'form_version', p_actor_user_id);

    insert into public.form_versions (
      resource_id, form_definition_id, version_number, status, display_name,
      definition_json, survey_js_version, created_by, updated_by
    )
    values (
      v_form_version_id, v_form_definition_id, 1, 'draft', 'Commercial Configuration Version v1',
      '{}'::jsonb, 'n/a', p_actor_user_id, p_actor_user_id
    );

    update public.form_versions
    set status = 'published', published_at = now(), published_by = p_actor_user_id
    where resource_id = v_form_version_id;
  end if;

  perform create_request_with_draft(p_new_request_id, v_form_definition_id, p_initial_raw_data, p_actor_user_id, null, p_actor_context);

  select wdv.id into v_workflow_version_id
  from workflow_definition_versions wdv
  join workflow_definitions wd on wd.id = wdv.workflow_definition_id
  where wd.applies_to = 'commercial_configuration' and wd.is_active and wdv.status = 'published'
  order by wdv.version_number desc
  limit 1;

  insert into commercial_configuration_versions (request_id, commercial_configuration_id, change_category, workflow_version_id, created_by, updated_by)
  values (p_new_request_id, p_commercial_configuration_id, p_change_category, v_workflow_version_id, p_actor_user_id, p_actor_user_id)
  returning * into v_version;

  return v_version;
end;
$function$;

create or replace function create_customer_onboarding_case(
  p_new_request_id uuid,
  p_initial_raw_data jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_onboarding_cases
language plpgsql
as $function$
declare
  v_form_definition_id uuid;
  v_form_version_id uuid;
  v_workflow_version_id uuid;
  v_case customer_onboarding_cases;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  insert into public.form_definitions (key, name, description, created_by, updated_by)
  values (
    'customer_onboarding',
    'System: Customer Onboarding (internal)',
    'System-internal Form Definition standing in for a dedicated Customer Onboarding business form, which does not exist yet. Every requests row created through create_customer_onboarding_case() pins to a published Form Version of this definition.',
    p_actor_user_id, p_actor_user_id
  )
  on conflict (key) do nothing;

  select id into v_form_definition_id from public.form_definitions where key = 'customer_onboarding';

  select fv.resource_id into v_form_version_id
  from public.form_versions fv
  where fv.form_definition_id = v_form_definition_id and fv.status = 'published'
  order by fv.version_number desc
  limit 1;

  if v_form_version_id is null then
    v_form_version_id := gen_random_uuid();
    insert into public.resources (resource_id, resource_type, created_by)
    values (v_form_version_id, 'form_version', p_actor_user_id);

    insert into public.form_versions (
      resource_id, form_definition_id, version_number, status, display_name,
      definition_json, survey_js_version, created_by, updated_by
    )
    values (
      v_form_version_id, v_form_definition_id, 1, 'draft', 'Customer Onboarding v1',
      '{}'::jsonb, 'n/a', p_actor_user_id, p_actor_user_id
    );

    update public.form_versions
    set status = 'published', published_at = now(), published_by = p_actor_user_id
    where resource_id = v_form_version_id;
  end if;

  perform create_request_with_draft(p_new_request_id, v_form_definition_id, p_initial_raw_data, p_actor_user_id, null, p_actor_context);

  select wdv.id into v_workflow_version_id
  from workflow_definition_versions wdv
  join workflow_definitions wd on wd.id = wdv.workflow_definition_id
  where wd.applies_to = 'customer_onboarding' and wd.is_active and wdv.status = 'published'
  order by wdv.version_number desc
  limit 1;

  insert into customer_onboarding_cases (request_id, workflow_version_id, created_by, updated_by)
  values (p_new_request_id, v_workflow_version_id, p_actor_user_id, p_actor_user_id)
  returning * into v_case;

  return v_case;
end;
$function$;

create or replace function create_customer_change_request(
  p_new_request_id uuid,
  p_customer_id uuid,
  p_initial_raw_data jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_form_definition_id uuid;
  v_form_version_id uuid;
  v_workflow_version_id uuid;
  v_customer customers;
  v_change_request customer_change_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_customer from customers where id = p_customer_id;
  if not found then
    raise exception 'CUSTOMER_CHANGE_CUSTOMER_NOT_FOUND: no customers row for id %', p_customer_id;
  end if;

  insert into public.form_definitions (key, name, description, created_by, updated_by)
  values (
    'customer_change_request',
    'System: Customer Change Request (internal)',
    'System-internal Form Definition standing in for a dedicated Customer Change Request business form, which does not exist yet.',
    p_actor_user_id, p_actor_user_id
  )
  on conflict (key) do nothing;

  select id into v_form_definition_id from public.form_definitions where key = 'customer_change_request';

  select fv.resource_id into v_form_version_id
  from public.form_versions fv
  where fv.form_definition_id = v_form_definition_id and fv.status = 'published'
  order by fv.version_number desc
  limit 1;

  if v_form_version_id is null then
    v_form_version_id := gen_random_uuid();
    insert into public.resources (resource_id, resource_type, created_by)
    values (v_form_version_id, 'form_version', p_actor_user_id);

    insert into public.form_versions (
      resource_id, form_definition_id, version_number, status, display_name,
      definition_json, survey_js_version, created_by, updated_by
    )
    values (
      v_form_version_id, v_form_definition_id, 1, 'draft', 'Customer Change Request v1',
      '{}'::jsonb, 'n/a', p_actor_user_id, p_actor_user_id
    );

    update public.form_versions
    set status = 'published', published_at = now(), published_by = p_actor_user_id
    where resource_id = v_form_version_id;
  end if;

  perform create_request_with_draft(p_new_request_id, v_form_definition_id, p_initial_raw_data, p_actor_user_id, null, p_actor_context);

  select wdv.id into v_workflow_version_id
  from workflow_definition_versions wdv
  join workflow_definitions wd on wd.id = wdv.workflow_definition_id
  where wd.applies_to = 'customer_change' and wd.is_active and wdv.status = 'published'
  order by wdv.version_number desc
  limit 1;

  insert into customer_change_requests (request_id, customer_id, base_customer_row_version, workflow_version_id, created_by, updated_by)
  values (p_new_request_id, p_customer_id, v_customer.row_version, v_workflow_version_id, p_actor_user_id, p_actor_user_id)
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

-- =============================================================================
-- 4. Real team-routed authorization in each approve_* RPC
-- =============================================================================

create or replace function approve_go_live_request(
  p_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
  v_team_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_row.status = 'approved' then
    return v_row;
  end if;

  if v_row.status not in ('submitted', 'resubmitted') then
    raise exception 'GO_LIVE_REQUEST_NOT_APPROVABLE: request % has status %, only submitted or resubmitted may be approved', p_id, v_row.status;
  end if;

  if v_row.customer_confirmation_status <> 'confirmed' then
    raise exception 'GO_LIVE_CONFIRMATION_REQUIRED: customer confirmation is required before a Go Live request can be approved';
  end if;

  v_team_id := fn_resolve_workflow_responsible_team(v_row.workflow_version_id, '{}'::jsonb);
  perform fn_require_workflow_team_membership(v_team_id, p_actor_user_id);

  update go_live_requests
  set status = 'approved', approved_by = p_actor_user_id, approved_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function approve_commercial_configuration_version(
  p_request_id uuid,
  p_components jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
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
  v_team_id uuid;
  v_segment text;
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

  if exists (
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

  v_team_id := fn_resolve_workflow_responsible_team(v_version.workflow_version_id, jsonb_build_object('segment', v_segment));
  perform fn_require_workflow_team_membership(v_team_id, p_actor_user_id);

  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  update commercial_components
  set effective_to = v_version.effective_date - 1, updated_by = p_actor_user_id, updated_at = now()
  where commercial_configuration_id = v_version.commercial_configuration_id and effective_to is null;

  insert into commercial_changes (request_id, commercial_configuration_id, change_category, effective_date, reason, created_by)
  values (v_system_request_id, v_version.commercial_configuration_id, v_version.change_category, v_version.effective_date, v_version.reason, p_actor_user_id)
  returning * into v_commercial_change;

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    v_new_component_id := gen_random_uuid();
    v_stable_key := nullif(v_component ->> 'stable_component_key', '')::uuid;

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
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;

create or replace function approve_customer_onboarding_case(
  p_request_id uuid,
  p_customer_key text,
  p_customer_name text,
  p_commercial_configuration_key text,
  p_commercial_configuration_name text,
  p_components jsonb,
  p_effective_date date,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_customer_fields jsonb default '{}'::jsonb
)
returns customer_onboarding_cases
language plpgsql
security invoker
as $function$
declare
  v_case customer_onboarding_cases;
  v_latest_revision submission_revisions;
  v_customer_id uuid;
  v_system_request_id uuid;
  v_commercial_configuration_id uuid;
  v_commercial_change_id uuid;
  v_component jsonb;
  v_new_component_id uuid;
  v_mug_threshold numeric;
  v_team_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_case.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_case.status = 'approved' then
    return v_case;
  end if;

  if v_case.status not in ('submitted', 'resubmitted') then
    raise exception 'ONBOARDING_CASE_NOT_APPROVABLE: case % has status %, only submitted or resubmitted may be approved', p_request_id, v_case.status;
  end if;

  select * into v_latest_revision
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'ONBOARDING_NO_SUBMITTED_REVISION: case % has no submitted revision to approve', p_request_id;
  end if;

  v_team_id := fn_resolve_workflow_responsible_team(v_case.workflow_version_id, jsonb_build_object('segment', p_customer_fields ->> 'segment'));
  perform fn_require_workflow_team_membership(v_team_id, p_actor_user_id);

  insert into customers (
    key, name, brand_name, created_by, updated_by,
    address, state, city, postal_code, website,
    primary_contact_name, primary_contact_email, primary_contact_phone_country_code,
    primary_contact_phone_number, primary_contact_designation,
    gst_number, pan, tan, tax_identifier_type, tax_identifier_name, tax_registration_number,
    company_document_type, company_document_type_other, billing_currency
  )
  values (
    p_customer_key, p_customer_name, p_customer_fields ->> 'brand_name', p_actor_user_id, p_actor_user_id,
    p_customer_fields ->> 'address', p_customer_fields ->> 'state', p_customer_fields ->> 'city',
    p_customer_fields ->> 'postal_code', p_customer_fields ->> 'website',
    p_customer_fields ->> 'primary_contact_name', p_customer_fields ->> 'primary_contact_email',
    p_customer_fields ->> 'primary_contact_phone_country_code', p_customer_fields ->> 'primary_contact_phone_number',
    p_customer_fields ->> 'primary_contact_designation',
    p_customer_fields ->> 'gst_number', p_customer_fields ->> 'pan', p_customer_fields ->> 'tan',
    p_customer_fields ->> 'tax_identifier_type', p_customer_fields ->> 'tax_identifier_name', p_customer_fields ->> 'tax_registration_number',
    p_customer_fields ->> 'company_document_type', p_customer_fields ->> 'company_document_type_other',
    p_customer_fields ->> 'billing_currency'
  )
  returning id into v_customer_id;

  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  v_commercial_configuration_id := gen_random_uuid();
  v_commercial_change_id := v_system_request_id;
  perform create_commercial_configuration_with_change(
    v_commercial_configuration_id, v_system_request_id, v_customer_id,
    p_commercial_configuration_key, p_commercial_configuration_name, p_effective_date,
    p_actor_user_id, null, null, null, p_actor_context
  );

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    v_new_component_id := gen_random_uuid();
    perform add_commercial_component(
      v_new_component_id,
      v_commercial_configuration_id,
      v_commercial_change_id,
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
      null
    );

    v_mug_threshold := nullif(v_component ->> 'mug_threshold_value', '')::numeric;
    if v_mug_threshold is not null then
      perform add_commercial_commitment(
        gen_random_uuid(), v_commercial_change_id, v_new_component_id,
        v_mug_threshold, (v_component ->> 'effective_from')::date, p_actor_user_id, p_actor_context
      );
    end if;
  end loop;

  update customer_onboarding_cases
  set status = 'approved',
      approved_by = p_actor_user_id,
      approved_at = now(),
      customer_id = v_customer_id,
      commercial_configuration_id = v_commercial_configuration_id,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;

create or replace function approve_customer_change_request(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
security invoker
as $function$
declare
  v_change_request customer_change_requests;
  v_customer customers;
  v_latest_revision submission_revisions;
  v_proposed jsonb;
  v_field text;
  v_old_value text;
  v_new_value text;
  v_team_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_change_request.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_change_request.status = 'approved' then
    return v_change_request;
  end if;

  if v_change_request.status not in ('submitted', 'resubmitted') then
    raise exception 'CUSTOMER_CHANGE_NOT_APPROVABLE: request % has status %, only submitted or resubmitted may be approved', p_request_id, v_change_request.status;
  end if;

  select * into v_customer from customers where id = v_change_request.customer_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_CUSTOMER_NOT_FOUND: no customers row for id %', v_change_request.customer_id;
  end if;

  if v_customer.row_version <> v_change_request.base_customer_row_version then
    raise exception 'CUSTOMER_CHANGE_STALE_BASE: customers row % changed (row_version % vs expected %) since this Change Request was created; rebase before approving',
      v_customer.id, v_customer.row_version, v_change_request.base_customer_row_version;
  end if;

  select * into v_latest_revision
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'CUSTOMER_CHANGE_NO_SUBMITTED_REVISION: request % has no submitted revision to approve', p_request_id;
  end if;

  -- Workflow Runtime V1: resolve the responsible team using whichever
  -- segment this change actually settles on (the proposed value if this
  -- change touches segment, else the customer's own current segment),
  -- so team routing reflects the same fact the rest of this function
  -- treats as the segment going forward.
  v_team_id := fn_resolve_workflow_responsible_team(
    v_change_request.workflow_version_id,
    jsonb_build_object('segment', coalesce(v_latest_revision.effective_data -> 'values' ->> 'segment', v_customer.segment))
  );
  perform fn_require_workflow_team_membership(v_team_id, p_actor_user_id);

  v_proposed := v_latest_revision.effective_data -> 'values';

  for v_field in select unnest(array[
    'name', 'brand_name', 'segment', 'business_unit', 'country', 'industry',
    'address', 'state', 'city', 'postal_code', 'website',
    'primary_contact_name', 'primary_contact_email', 'primary_contact_phone_country_code',
    'primary_contact_phone_number', 'primary_contact_designation',
    'gst_number', 'pan', 'tan', 'tax_identifier_type', 'tax_identifier_name', 'tax_registration_number',
    'company_document_type', 'company_document_type_other', 'billing_currency'
  ])
  loop
    continue when not (v_proposed ? v_field);

    v_new_value := v_proposed ->> v_field;
    v_old_value := case v_field
      when 'name' then v_customer.name
      when 'brand_name' then v_customer.brand_name
      when 'segment' then v_customer.segment
      when 'business_unit' then v_customer.business_unit
      when 'country' then v_customer.country
      when 'industry' then v_customer.industry
      when 'address' then v_customer.address
      when 'state' then v_customer.state
      when 'city' then v_customer.city
      when 'postal_code' then v_customer.postal_code
      when 'website' then v_customer.website
      when 'primary_contact_name' then v_customer.primary_contact_name
      when 'primary_contact_email' then v_customer.primary_contact_email
      when 'primary_contact_phone_country_code' then v_customer.primary_contact_phone_country_code
      when 'primary_contact_phone_number' then v_customer.primary_contact_phone_number
      when 'primary_contact_designation' then v_customer.primary_contact_designation
      when 'gst_number' then v_customer.gst_number
      when 'pan' then v_customer.pan
      when 'tan' then v_customer.tan
      when 'tax_identifier_type' then v_customer.tax_identifier_type
      when 'tax_identifier_name' then v_customer.tax_identifier_name
      when 'tax_registration_number' then v_customer.tax_registration_number
      when 'company_document_type' then v_customer.company_document_type
      when 'company_document_type_other' then v_customer.company_document_type_other
      when 'billing_currency' then v_customer.billing_currency
    end;

    continue when v_old_value is not distinct from v_new_value;

    insert into customer_field_history (customer_id, field_key, old_value, new_value, effective_date, customer_change_request_id, requested_by, approved_by)
    values (v_customer.id, v_field, v_old_value, v_new_value, v_change_request.effective_date, p_request_id, v_change_request.created_by, p_actor_user_id);

    if v_field = 'name' then
      update customers set name = v_new_value where id = v_customer.id;
    elsif v_field = 'brand_name' then
      update customers set brand_name = v_new_value where id = v_customer.id;
    elsif v_field = 'segment' then
      update customers set segment = v_new_value where id = v_customer.id;
    elsif v_field = 'business_unit' then
      update customers set business_unit = v_new_value where id = v_customer.id;
    elsif v_field = 'country' then
      update customers set country = v_new_value where id = v_customer.id;
    elsif v_field = 'industry' then
      update customers set industry = v_new_value where id = v_customer.id;
    elsif v_field = 'address' then
      update customers set address = v_new_value where id = v_customer.id;
    elsif v_field = 'state' then
      update customers set state = v_new_value where id = v_customer.id;
    elsif v_field = 'city' then
      update customers set city = v_new_value where id = v_customer.id;
    elsif v_field = 'postal_code' then
      update customers set postal_code = v_new_value where id = v_customer.id;
    elsif v_field = 'website' then
      update customers set website = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_name' then
      update customers set primary_contact_name = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_email' then
      update customers set primary_contact_email = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_phone_country_code' then
      update customers set primary_contact_phone_country_code = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_phone_number' then
      update customers set primary_contact_phone_number = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_designation' then
      update customers set primary_contact_designation = v_new_value where id = v_customer.id;
    elsif v_field = 'gst_number' then
      update customers set gst_number = v_new_value where id = v_customer.id;
    elsif v_field = 'pan' then
      update customers set pan = v_new_value where id = v_customer.id;
    elsif v_field = 'tan' then
      update customers set tan = v_new_value where id = v_customer.id;
    elsif v_field = 'tax_identifier_type' then
      update customers set tax_identifier_type = v_new_value where id = v_customer.id;
    elsif v_field = 'tax_identifier_name' then
      update customers set tax_identifier_name = v_new_value where id = v_customer.id;
    elsif v_field = 'tax_registration_number' then
      update customers set tax_registration_number = v_new_value where id = v_customer.id;
    elsif v_field = 'company_document_type' then
      update customers set company_document_type = v_new_value where id = v_customer.id;
    elsif v_field = 'company_document_type_other' then
      update customers set company_document_type_other = v_new_value where id = v_customer.id;
    elsif v_field = 'billing_currency' then
      update customers set billing_currency = v_new_value where id = v_customer.id;
    end if;
  end loop;

  update customers set row_version = row_version + 1, updated_by = p_actor_user_id, updated_at = now() where id = v_customer.id;

  update customer_change_requests
  set status = 'approved',
      decided_by = p_actor_user_id,
      decided_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

-- =============================================================================
-- 5. Publish-time validation: Decision-node branches must be resolvable
-- =============================================================================

create or replace function publish_workflow_definition_version(
  p_version_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns workflow_definition_versions
language plpgsql
security invoker
as $function$
declare
  v_version workflow_definition_versions;
  v_start_count integer;
  v_end_count integer;
  v_decision_node record;
  v_branch_count integer;
  v_fallback_count integer;
  v_bad_condition_count integer;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from workflow_definition_versions where id = p_version_id for update;
  if not found then
    raise exception 'WORKFLOW_VERSION_NOT_FOUND: no workflow_definition_versions row for id %', p_version_id;
  end if;

  if v_version.status <> 'draft' then
    raise exception 'WORKFLOW_VERSION_NOT_DRAFT: version % has status %, only a draft may be published', p_version_id, v_version.status;
  end if;

  select count(*) into v_start_count from workflow_nodes where workflow_version_id = p_version_id and node_type = 'start';
  select count(*) into v_end_count from workflow_nodes where workflow_version_id = p_version_id and node_type = 'end';

  if v_start_count <> 1 then
    raise exception 'WORKFLOW_INVALID_GRAPH: version % must have exactly one start node, found %', p_version_id, v_start_count;
  end if;
  if v_end_count < 1 then
    raise exception 'WORKFLOW_INVALID_GRAPH: version % must have at least one end node', p_version_id;
  end if;

  for v_decision_node in select node_key from workflow_nodes where workflow_version_id = p_version_id and node_type = 'decision'
  loop
    select count(*) into v_branch_count from workflow_edges where workflow_version_id = p_version_id and from_node_key = v_decision_node.node_key;
    if v_branch_count < 2 then
      raise exception 'WORKFLOW_INVALID_GRAPH: Decision node "%" must have at least two outgoing branches to be a real decision', v_decision_node.node_key;
    end if;

    select count(*) into v_fallback_count from workflow_edges where workflow_version_id = p_version_id and from_node_key = v_decision_node.node_key and condition is null;
    if v_fallback_count > 1 then
      raise exception 'WORKFLOW_INVALID_GRAPH: Decision node "%" has more than one default (unconditioned) branch; routing would be ambiguous', v_decision_node.node_key;
    end if;

    select count(*) into v_bad_condition_count
    from workflow_edges
    where workflow_version_id = p_version_id
      and from_node_key = v_decision_node.node_key
      and condition is not null
      and (
        (condition ->> 'operator') not in ('equals', 'not_equals')
        or coalesce(condition ->> 'field', '') = ''
      );
    if v_bad_condition_count > 0 then
      raise exception 'WORKFLOW_INVALID_GRAPH: Decision node "%" has a branch condition with an unsupported operator or empty field; only equals/not_equals with a non-empty field are supported in Workflow Runtime V1', v_decision_node.node_key;
    end if;
  end loop;

  update workflow_definition_versions
  set status = 'published', published_at = now(), published_by = p_actor_user_id, updated_by = p_actor_user_id, updated_at = now()
  where id = p_version_id
  returning * into v_version;

  return v_version;
end;
$function$;
