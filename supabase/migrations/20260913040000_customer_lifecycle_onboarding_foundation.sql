-- Nexus: Customer Lifecycle V1, onboarding case foundation.
--
-- Customer Onboarding today (src/features/customer-onboarding/domain/case.ts)
-- is a pure, in-memory draft/submitted/sent_back/resubmitted/approved state
-- machine with no database backing at all: Save Draft and Submit are local
-- React state, lost on refresh. This migration gives that exact lifecycle a
-- real home, reusing the existing generic request/submission infrastructure
-- (requests, submission_revisions, form_definitions/form_versions,
-- 20260907044335_submission_data_foundation.sql) rather than duplicating it,
-- following the same "extend requests with a thin domain table" precedent
-- commercial_changes already established for Commercial Configuration
-- (20260908210000_commercial_configuration_foundation.sql).
--
-- customer_onboarding_cases is a 1:1 extension of requests, carrying exactly
-- the CASE-level fields case.ts's pure functions already model
-- (status, current_stage_key, sent-back reason/actor/time, approved-by/at),
-- since submission_revisions itself only ever has status draft/submitted
-- (see domain/types.ts's own header: "sent back", "resubmitted", and
-- "approved" are case-level workflow states layered on top of a sequence of
-- revisions, not revision statuses themselves).
--
-- approve_customer_onboarding_case is the single atomic transaction the
-- task requires: it creates the stable Customer Master row, the Commercial
-- Configuration, its initial Commercial Change, every Commercial Component
-- (and MUG commitment), and marks the case approved, all in one Postgres
-- function invocation, so a mid-way failure rolls back everything rather
-- than leaving a customer with no commercials or a half-created
-- configuration. It composes the EXISTING, already-tested RPCs
-- (create_system_commercial_request, create_commercial_configuration_with_change,
-- add_commercial_component, add_commercial_commitment) by calling them from
-- SQL rather than reintroducing their logic, matching this migration's own
-- "reuse, do not duplicate" requirement.
--
-- This file has not been applied to any database as of authoring.

-- =============================================================================
-- customer_onboarding_cases: 1:1 extension of requests
-- =============================================================================

create table customer_onboarding_cases (
  request_id uuid primary key references requests (id),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'sent_back', 'resubmitted', 'approved')),
  current_stage_key text not null default 'customer_details'
    check (current_stage_key in ('customer_details', 'tax_registration', 'commercial_documents', 'commercial_rate', 'agreement_approval')),
  sent_back_reason text,
  sent_back_by uuid references app_users (id),
  sent_back_at timestamptz,
  sent_back_target_stage_key text
    check (sent_back_target_stage_key in ('customer_details', 'tax_registration', 'commercial_documents', 'commercial_rate', 'agreement_approval')),
  approved_by uuid references app_users (id),
  approved_at timestamptz,
  /** Set only once, atomically, by approve_customer_onboarding_case. Never written by any other path. */
  customer_id uuid references customers (id),
  commercial_configuration_id uuid references commercial_configurations (id),
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app_users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users (id)
);

comment on table customer_onboarding_cases is
  'Case-level lifecycle state for a Customer Onboarding request (status, current stage, send-back and approval evidence). Revision-level data (the actual submitted form values) lives in submission_revisions, which this table extends 1:1 via request_id, never duplicates.';

create trigger trg_customer_onboarding_cases_set_updated_at
  before update on customer_onboarding_cases
  for each row execute function fn_set_updated_at();

create trigger trg_audit_customer_onboarding_cases
  after insert or update on customer_onboarding_cases
  for each row execute function fn_audit_row('request_id');

revoke all on customer_onboarding_cases from anon, authenticated;

-- =============================================================================
-- Permissions and role for the customer lifecycle
-- =============================================================================

insert into permissions (resource, action) values
  ('customer', 'create'),
  ('customer', 'read'),
  ('customer', 'approve'),
  ('customer', 'change_request'),
  ('customer', 'delete_permanent')
on conflict (resource, action) do nothing;

insert into roles (code, name)
values ('customer_lifecycle_admin', 'Customer Lifecycle Admin')
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
join permissions p on p.resource = 'customer' and p.action in ('create', 'read', 'approve', 'change_request', 'delete_permanent')
where r.code = 'customer_lifecycle_admin'
on conflict do nothing;

-- =============================================================================
-- create_customer_onboarding_case: mints the request + draft revision + case
-- =============================================================================

/**
 * Self-bootstraps a system "customer_onboarding" Form Definition/Version the
 * same way create_system_commercial_request bootstraps
 * "system_commercial_change" (20260912210000_commercial_configuration_persistence.sql):
 * a real, dedicated Customer Onboarding business form does not exist yet, so
 * every onboarding request pins to a published Form Version of this
 * definition instead of inventing a second, parallel request mechanism.
 */
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

  perform create_request_with_draft(p_new_request_id, v_form_version_id, p_initial_raw_data, p_actor_user_id, null, p_actor_context);

  insert into customer_onboarding_cases (request_id, created_by, updated_by)
  values (p_new_request_id, p_actor_user_id, p_actor_user_id)
  returning * into v_case;

  return v_case;
end;
$function$;

-- =============================================================================
-- save_customer_onboarding_draft: update the current draft revision's data
-- =============================================================================

create or replace function save_customer_onboarding_draft(
  p_request_id uuid,
  p_raw_data jsonb,
  p_current_stage_key text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_onboarding_cases
language plpgsql
as $function$
declare
  v_revision_id uuid;
  v_case customer_onboarding_cases;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select id into v_revision_id
  from submission_revisions
  where request_id = p_request_id and status = 'draft'
  order by revision_number desc
  limit 1;

  if v_revision_id is null then
    raise exception 'ONBOARDING_NO_DRAFT_REVISION: request % has no draft revision to save', p_request_id;
  end if;

  update submission_revisions
  set raw_data = p_raw_data, updated_by = p_actor_user_id, updated_at = now()
  where id = v_revision_id;

  update customer_onboarding_cases
  set current_stage_key = p_current_stage_key, updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;

-- =============================================================================
-- submit_customer_onboarding_case: freezes the draft revision, transitions case
-- =============================================================================

create or replace function submit_customer_onboarding_case(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_onboarding_cases
language plpgsql
as $function$
declare
  v_revision submission_revisions;
  v_case customer_onboarding_cases;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_case.status not in ('draft', 'sent_back') then
    raise exception 'ONBOARDING_CASE_NOT_SUBMITTABLE: case % has status %, only draft or sent_back may be submitted', p_request_id, v_case.status;
  end if;

  select * into v_revision
  from submission_revisions
  where request_id = p_request_id and status = 'draft'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'ONBOARDING_NO_DRAFT_REVISION: request % has no draft revision to submit', p_request_id;
  end if;

  perform submit_revision(v_revision.id, v_revision.row_version, v_revision.raw_data, p_actor_user_id, null, p_actor_context);

  update customer_onboarding_cases
  set status = case when v_case.status = 'sent_back' then 'resubmitted' else 'submitted' end,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;

-- =============================================================================
-- send_back_customer_onboarding_case
-- =============================================================================

create or replace function send_back_customer_onboarding_case(
  p_request_id uuid,
  p_reason text,
  p_target_stage_key text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_onboarding_cases
language plpgsql
as $function$
declare
  v_case customer_onboarding_cases;
  v_next_revision submission_revisions;
  v_latest_submitted submission_revisions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'ONBOARDING_SEND_BACK_REASON_REQUIRED: a reason is required to send a case back';
  end if;

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_case.status not in ('submitted', 'resubmitted') then
    raise exception 'ONBOARDING_CASE_NOT_SENDBACKABLE: case % has status %, only submitted or resubmitted may be sent back', p_request_id, v_case.status;
  end if;

  select * into v_latest_submitted
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  -- Opens the next draft revision immediately (case.ts's own startNextRevision
  -- semantics: editing resumes on revision N+1, the submitted revision that
  -- was actually reviewed is never touched), so the requester can start
  -- editing the moment they see the send-back, with no separate "start next
  -- revision" click required.
  select * into v_next_revision from create_next_revision(p_request_id, v_latest_submitted.id, p_actor_user_id, null, p_actor_context);

  update customer_onboarding_cases
  set status = 'sent_back',
      sent_back_reason = p_reason,
      sent_back_by = p_actor_user_id,
      sent_back_at = now(),
      sent_back_target_stage_key = p_target_stage_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;

-- =============================================================================
-- approve_customer_onboarding_case: the atomic approval transaction
-- =============================================================================

/**
 * p_components is a jsonb array shaped exactly like
 * AddCommercialComponentServiceInput (snake_case): is_recurring,
 * pricing_rule_kind, pricing_rule_parameters, billing_cadence,
 * billing_timing, billing_quantity_basis, reconciliation_cadence,
 * transaction_currency, fx_snapshot_rate, effective_from, and an optional
 * mug_threshold_value used only to additionally insert a matching
 * commercial_commitments row (mirroring
 * src/features/customer-onboarding/server/commercial-configuration-promotion.ts's
 * existing addComponentsForChange logic, just composed here in SQL so the
 * whole approval, customer creation included, is one transaction).
 *
 * Idempotent: if this case has already been approved (customer_id already
 * set), returns the existing linked case unchanged rather than creating a
 * second customer or configuration, satisfying "clicking Approve twice must
 * not create two customers."
 */
create or replace function approve_customer_onboarding_case(
  p_request_id uuid,
  p_customer_key text,
  p_customer_name text,
  p_commercial_configuration_key text,
  p_commercial_configuration_name text,
  p_components jsonb,
  p_effective_date date,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_onboarding_cases
language plpgsql
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
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  -- Idempotent replay: a case already approved returns its existing linkage,
  -- no new DML runs.
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

  -- 1. Customer Master.
  insert into customers (key, name, created_by, updated_by)
  values (p_customer_key, p_customer_name, p_actor_user_id, p_actor_user_id)
  returning id into v_customer_id;

  -- 2. Real requests row backing the Commercial Change, then the Commercial
  -- Configuration and its initial_setup Change, reusing the existing
  -- sanctioned Commercial Configuration RPCs exactly as they already are.
  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  -- commercial_changes.request_id is always exactly the request id passed
  -- in as p_request_id below, so the new Change's id is already known
  -- without reading the function's return value back.
  v_commercial_configuration_id := gen_random_uuid();
  v_commercial_change_id := v_system_request_id;
  perform create_commercial_configuration_with_change(
    v_commercial_configuration_id, v_system_request_id, v_customer_id,
    p_commercial_configuration_key, p_commercial_configuration_name, p_effective_date,
    p_actor_user_id, null, null, null, p_actor_context
  );

  -- 3. Every Commercial Component (and MUG commitment), same real RPCs the
  -- interactive promotion flow already uses.
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
      p_actor_context
    );

    v_mug_threshold := nullif(v_component ->> 'mug_threshold_value', '')::numeric;
    if v_mug_threshold is not null then
      perform add_commercial_commitment(
        gen_random_uuid(), v_commercial_change_id, v_new_component_id,
        v_mug_threshold, (v_component ->> 'effective_from')::date, p_actor_user_id, p_actor_context
      );
    end if;
  end loop;

  -- 4. Mark the case approved and linked.
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

grant execute on function create_customer_onboarding_case(uuid, jsonb, uuid, jsonb) to service_role;
grant execute on function save_customer_onboarding_draft(uuid, jsonb, text, uuid, jsonb) to service_role;
grant execute on function submit_customer_onboarding_case(uuid, uuid, jsonb) to service_role;
grant execute on function send_back_customer_onboarding_case(uuid, text, text, uuid, jsonb) to service_role;
grant execute on function approve_customer_onboarding_case(uuid, text, text, text, text, jsonb, date, uuid, jsonb) to service_role;

revoke execute on function create_customer_onboarding_case(uuid, jsonb, uuid, jsonb) from anon, authenticated;
revoke execute on function save_customer_onboarding_draft(uuid, jsonb, text, uuid, jsonb) from anon, authenticated;
revoke execute on function submit_customer_onboarding_case(uuid, uuid, jsonb) from anon, authenticated;
revoke execute on function send_back_customer_onboarding_case(uuid, text, text, uuid, jsonb) from anon, authenticated;
revoke execute on function approve_customer_onboarding_case(uuid, text, text, text, text, jsonb, date, uuid, jsonb) from anon, authenticated;
