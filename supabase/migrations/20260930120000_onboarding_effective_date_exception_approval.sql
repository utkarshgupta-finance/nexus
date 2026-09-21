-- PD-002 (A-034, Batches 1-13 Ledger Audit product decision closure):
-- when a Commercial Configuration's effective_date is chosen earlier
-- than the customer's own onboarding date, the case is neither rejected
-- outright nor silently approved: it requires a real, independent
-- approval from both a BU Head and a Finance Head before the atomic
-- Customer Master + Commercial Configuration creation transaction runs.
--
-- "Onboarding date" structural note: Nexus has no dedicated column for
-- this (confirmed by direct search; only case created_at, revision
-- submitted_at, and case approved_at exist as candidates, per
-- docs/DATA_ARCHITECTURE.md §7a). This uses
-- customer_onboarding_cases.created_at (when the case/draft was first
-- opened) as the current best-available proxy, documented here rather
-- than silently assumed.
--
-- Design note on WHY this is a dedicated table/RPC pair rather than an
-- extra node inserted into the live, shared customer_onboarding
-- Workflow Runtime V1 graph: that graph is definition-driven (one fixed
-- graph governs every onboarding case; there is no per-instance branch
-- insertion mechanism), so adding this exception path there would mean
-- publishing a new version of the single active graph used by every
-- future onboarding approval, a real, ongoing operational change to
-- shared state, not a bounded fix. The dedicated table below reuses the
-- same real ingredients (a named team, real team membership checked
-- server-side, a real actor identity, no fake "logged in as" approver,
-- per CLAUDE.md's "role reference is never resolved to a hardcoded
-- person" rule) without touching the shared graph. If a future need
-- makes per-instance workflow branching a recurring requirement, the
-- Workflow Runtime V1 Decision-node mechanism remains the right place
-- to build that generically; this is the bounded fix for this one
-- decision.
--
-- BU Head / Finance Head are NOT seeded here as teams (matching this
-- repo's own "no real Nexus team names are seeded by this migration"
-- convention for `teams`, see 20260916060000_team_master_foundation.sql).
-- An admin creates a `teams` row with code = 'bu_head' and code =
-- 'finance_head' (via the existing create_team RPC/UI) and assigns real
-- members before this exception path can be used; until then, the
-- functions below raise a clear, honest error rather than silently
-- succeeding or inventing a fake approver.

create table onboarding_effective_date_exceptions (
  id uuid primary key default gen_random_uuid(),
  case_request_id uuid not null unique references customer_onboarding_cases (request_id) on delete restrict,
  effective_date date not null,
  onboarding_date date not null,
  bu_head_approved_by uuid references app_users (id) on delete restrict,
  bu_head_approved_at timestamptz,
  finance_head_approved_by uuid references app_users (id) on delete restrict,
  finance_head_approved_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references app_users (id) on delete restrict
);

comment on table onboarding_effective_date_exceptions is
  'PD-002: one row per onboarding case whose chosen Commercial Configuration effective_date is before the case''s own onboarding date (created_at). The case cannot finalize (Customer Master + Commercial Configuration creation) until both bu_head_approved_by and finance_head_approved_by are set. Never deleted; a case can only ever need this once, since effective_date is fixed at approval time.';

create trigger trg_onboarding_effective_date_exceptions_audit
  after insert or update or delete on onboarding_effective_date_exceptions
  for each row execute function fn_audit_row('id');

-- Records one role's (bu_head or finance_head) sign-off on a pending
-- exception. The exception row itself is created lazily by
-- approve_customer_onboarding_case the first time it detects a
-- backdated effective_date; calling this before that row exists is a
-- genuine ordering error, not silently accepted.
create function approve_onboarding_effective_date_exception(
  p_case_request_id uuid,
  p_role text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns onboarding_effective_date_exceptions
language plpgsql
security invoker
as $function$
declare
  v_exception onboarding_effective_date_exceptions;
  v_team_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_role not in ('bu_head', 'finance_head') then
    raise exception 'ONBOARDING_EXCEPTION_INVALID_ROLE: role must be bu_head or finance_head, got %', p_role;
  end if;

  select * into v_exception from onboarding_effective_date_exceptions where case_request_id = p_case_request_id for update;
  if not found then
    raise exception 'ONBOARDING_EXCEPTION_NOT_FOUND: no pending effective-date exception for case %; approve_customer_onboarding_case must be attempted first to create it', p_case_request_id;
  end if;

  select id into v_team_id from teams where code = p_role and is_active;
  if v_team_id is null then
    raise exception 'ONBOARDING_EXCEPTION_TEAM_NOT_CONFIGURED: no active team with code "%" exists yet; an admin must create it (Settings > Teams) and assign real members before this exception can be approved', p_role;
  end if;
  perform fn_require_workflow_team_membership(v_team_id, p_actor_user_id);

  if p_role = 'bu_head' then
    if v_exception.bu_head_approved_by is not null then
      return v_exception;
    end if;
    update onboarding_effective_date_exceptions
    set bu_head_approved_by = p_actor_user_id, bu_head_approved_at = now()
    where case_request_id = p_case_request_id
    returning * into v_exception;
  else
    if v_exception.finance_head_approved_by is not null then
      return v_exception;
    end if;
    update onboarding_effective_date_exceptions
    set finance_head_approved_by = p_actor_user_id, finance_head_approved_at = now()
    where case_request_id = p_case_request_id
    returning * into v_exception;
  end if;

  return v_exception;
end;
$function$;

-- approve_customer_onboarding_case, extended: immediately before the
-- point where it would finalize (create the Customer Master and
-- Commercial Configuration), check whether p_effective_date is before
-- the case's own onboarding date (created_at). If so, and both
-- approvals are not yet on record, create/leave the exception pending
-- and block finalization with a clear, actionable error instead of
-- silently approving or rejecting outright. Every other line of this
-- function is unchanged from the previously live body
-- (20260925000000_workflow_runtime_v1_sequential_execution.sql).
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
  p_customer_fields jsonb default '{}'::jsonb,
  p_expected_current_node_key text default null
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
  v_current_team_id uuid;
  v_next record;
  v_should_finalize boolean;
  v_new_current_node_key text;
  v_exception onboarding_effective_date_exceptions;
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

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_case.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  select * into v_latest_revision
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'ONBOARDING_NO_SUBMITTED_REVISION: case % has no submitted revision to approve', p_request_id;
  end if;

  v_current_team_id := fn_workflow_node_team(v_case.workflow_version_id, v_case.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select * into v_next
  from fn_resolve_workflow_next_approval(v_case.workflow_version_id, v_case.current_workflow_node_key, jsonb_build_object('segment', p_customer_fields ->> 'segment'));

  if v_next.node_type is null then
    if v_case.current_workflow_node_key is null then
      v_should_finalize := true;
      v_new_current_node_key := null;
    else
      raise exception 'WORKFLOW_GRAPH_DEAD_END: this case''s workflow has no reachable Approval or End node after node "%"; ask a Workflow Admin to fix the graph', v_case.current_workflow_node_key;
    end if;
  elsif v_next.node_type = 'approval' then
    v_should_finalize := false;
    v_new_current_node_key := v_next.node_key;
  else
    v_should_finalize := true;
    v_new_current_node_key := v_next.node_key;
  end if;

  if v_case.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('customer_onboarding', p_request_id, v_case.workflow_version_id, v_case.workflow_cycle_number, v_case.current_workflow_node_key, v_new_current_node_key, 'approve', p_actor_user_id, null);
  end if;

  if not v_should_finalize then
    update customer_onboarding_cases
    set current_workflow_node_key = v_new_current_node_key,
        updated_by = p_actor_user_id, updated_at = now()
    where request_id = p_request_id
    returning * into v_case;

    return v_case;
  end if;

  -- PD-002: only checked at the point of actual finalization (the atomic
  -- creation transaction), not at every intermediate approval-node step.
  if p_effective_date < v_case.created_at::date then
    select * into v_exception from onboarding_effective_date_exceptions where case_request_id = p_request_id for update;
    if not found then
      insert into onboarding_effective_date_exceptions (case_request_id, effective_date, onboarding_date, created_by)
      values (p_request_id, p_effective_date, v_case.created_at::date, p_actor_user_id)
      returning * into v_exception;
    end if;

    if v_exception.bu_head_approved_by is null or v_exception.finance_head_approved_by is null then
      raise exception 'ONBOARDING_EFFECTIVE_DATE_EXCEPTION_PENDING: effective_date % is before this case''s onboarding date %; both a BU Head and a Finance Head must approve via approve_onboarding_effective_date_exception before this case can finalize (bu_head approved: %, finance_head approved: %)',
        p_effective_date, v_case.created_at::date, (v_exception.bu_head_approved_by is not null), (v_exception.finance_head_approved_by is not null);
    end if;
  end if;

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
      current_workflow_node_key = v_new_current_node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;

revoke execute on function approve_onboarding_effective_date_exception(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function approve_onboarding_effective_date_exception(uuid, text, uuid, jsonb) to service_role;
