-- Nexus: Customer Lifecycle V1, Customer Change Request foundation.
--
-- Customer Master (customers) has stored only id/key/name/is_active since
-- 20260908013210_master_data_foundation.sql, deliberately minimal. Making
-- "change Segment" or "change Business Unit" a real, governed Change
-- Request means Segment/Business Unit/Country/Industry/Brand Name must
-- first exist as real Customer Master columns to change, not remain
-- trapped inside an onboarding case's own JSON. This migration adds them
-- as plain governed text columns (the same pattern
-- commercial_components.transaction_currency already uses: a Reference
-- Master code stored as text, not a foreign key to reference_options,
-- since reference_options rows may be deactivated without invalidating a
-- historical record that used them).
--
-- customer_change_requests extends requests 1:1, the same precedent
-- customer_onboarding_cases and commercial_changes both already
-- established. customer_change_request_requirements persists the
-- Workflow rule evaluator's own output (src/platform/workflow/domain/
-- evaluator.ts's evaluateWorkflowRules), computed in TypeScript and
-- written here for the reviewer to see before deciding, not re-derived
-- from scratch. customer_field_history is genuine business history (not
-- generic audit_log JSON): one row per changed field, per approved
-- Change Request, permanently.
--
-- This file has not been applied to any database as of authoring.

-- =============================================================================
-- Customer Master: promote Segment/Business Unit/Country/Industry/Brand
-- from onboarding-only capture to real, changeable governed columns.
-- =============================================================================

alter table customers add column segment text;
alter table customers add column business_unit text;
alter table customers add column country text;
alter table customers add column industry text;
alter table customers add column brand_name text;

comment on column customers.segment is 'Reference Master segment code. Governed: changed only via an approved Customer Change Request, never directly.';
comment on column customers.business_unit is 'Reference Master business_unit code. Governed: changed only via an approved Customer Change Request, never directly.';
comment on column customers.country is 'Reference Master country code. Governed: changed only via an approved Customer Change Request, never directly.';
comment on column customers.industry is 'Reference Master industry code. Governed: changed only via an approved Customer Change Request, never directly.';
comment on column customers.brand_name is 'Governed: changed only via an approved Customer Change Request, never directly.';

-- =============================================================================
-- customer_change_requests: 1:1 extension of requests
-- =============================================================================

create table customer_change_requests (
  request_id uuid primary key references requests (id),
  customer_id uuid not null references customers (id),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'sent_back', 'resubmitted', 'approved', 'rejected')),
  reason text,
  effective_date date,
  /** customers.row_version captured when this Change Request was created, so approval can detect a stale base (task: "do not blindly overwrite" a Customer Master that changed meanwhile). */
  base_customer_row_version integer not null,
  sent_back_reason text,
  sent_back_by uuid references app_users (id),
  sent_back_at timestamptz,
  decided_by uuid references app_users (id),
  decided_at timestamptz,
  decision_reason text,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app_users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users (id)
);

comment on table customer_change_requests is
  'Case-level lifecycle state for a Customer Master Change Request (docs/DATA_ARCHITECTURE.md §15). Proposed field values live in submission_revisions, which this table extends 1:1 via request_id, never duplicates.';

create trigger trg_customer_change_requests_set_updated_at
  before update on customer_change_requests
  for each row execute function fn_set_updated_at();

create trigger trg_audit_customer_change_requests
  after insert or update on customer_change_requests
  for each row execute function fn_audit_row('request_id');

revoke all on customer_change_requests from anon, authenticated;

-- =============================================================================
-- customer_change_request_requirements: persisted Workflow evaluation output
-- =============================================================================

create table customer_change_request_requirements (
  id uuid primary key default gen_random_uuid(),
  customer_change_request_id uuid not null references customer_change_requests (request_id),
  kind text not null check (kind in ('approval', 'evidence')),
  role_code text,
  scope_label text,
  evidence_type text,
  reason text not null,
  matched_rule_keys text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint chk_customer_change_request_requirements_shape check (
    (kind = 'approval' and role_code is not null and evidence_type is null)
    or (kind = 'evidence' and evidence_type is not null and role_code is null)
  )
);

comment on table customer_change_request_requirements is
  'Read-only record of what src/platform/workflow/domain/evaluator.ts calculated was required for this Change Request at Submit time (task: "show Required Approvals / Required Evidence before submission"). V1 does not yet route each requirement to a specific named approver (no per-role user directory exists); the overall Change Request is approved or rejected as one governed decision by any customer.approve holder, with this table kept as the honest, auditable record of what a fuller system would have routed.';

revoke all on customer_change_request_requirements from anon, authenticated;

-- =============================================================================
-- customer_field_history: permanent, field-level business history
-- =============================================================================

create table customer_field_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id),
  field_key text not null,
  old_value text,
  new_value text,
  effective_date date,
  customer_change_request_id uuid references customer_change_requests (request_id),
  requested_by uuid references app_users (id),
  approved_by uuid references app_users (id),
  changed_at timestamptz not null default now()
);

comment on table customer_field_history is
  'Permanent, field-level Customer Master change history (docs/CUSTOMER_LIFECYCLE.md). Distinct from audit_log (mutation-level, DB-enforced, JSON before/after): this is business-facing history meant to render directly on Customer -> History, one row per changed field per approved Change Request.';

create index idx_customer_field_history_customer_id on customer_field_history (customer_id, changed_at desc);

revoke all on customer_field_history from anon, authenticated;
grant select, insert on customer_field_history to service_role;

-- =============================================================================
-- create_customer_change_request
-- =============================================================================

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

  insert into customer_change_requests (request_id, customer_id, base_customer_row_version, created_by, updated_by)
  values (p_new_request_id, p_customer_id, v_customer.row_version, p_actor_user_id, p_actor_user_id)
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

-- =============================================================================
-- save_customer_change_draft
-- =============================================================================

create or replace function save_customer_change_draft(
  p_request_id uuid,
  p_raw_data jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_revision_id uuid;
  v_change_request customer_change_requests;
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
    raise exception 'CUSTOMER_CHANGE_NO_DRAFT_REVISION: request % has no draft revision to save', p_request_id;
  end if;

  update submission_revisions
  set raw_data = p_raw_data, updated_by = p_actor_user_id, updated_at = now()
  where id = v_revision_id;

  update customer_change_requests
  set updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

-- =============================================================================
-- submit_customer_change_request
-- =============================================================================

/** p_requirements is a jsonb array of {kind, role_code, scope_label, evidence_type, reason, matched_rule_keys}, the Workflow evaluator's own output computed in TypeScript (services/customer-change.service.ts), persisted here verbatim. */
create or replace function submit_customer_change_request(
  p_request_id uuid,
  p_reason text,
  p_effective_date date,
  p_requirements jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_change_request customer_change_requests;
  v_revision submission_revisions;
  v_requirement jsonb;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_change_request.status not in ('draft', 'sent_back') then
    raise exception 'CUSTOMER_CHANGE_NOT_SUBMITTABLE: request % has status %, only draft or sent_back may be submitted', p_request_id, v_change_request.status;
  end if;

  select * into v_revision
  from submission_revisions
  where request_id = p_request_id and status = 'draft'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'CUSTOMER_CHANGE_NO_DRAFT_REVISION: request % has no draft revision to submit', p_request_id;
  end if;

  perform submit_revision(
    v_revision.id, v_revision.row_version,
    jsonb_build_object('values', v_revision.raw_data, 'applicability', '{}'::jsonb),
    p_actor_user_id, null, p_actor_context
  );

  delete from customer_change_request_requirements where customer_change_request_id = p_request_id;

  for v_requirement in select * from jsonb_array_elements(p_requirements)
  loop
    insert into customer_change_request_requirements (customer_change_request_id, kind, role_code, scope_label, evidence_type, reason, matched_rule_keys)
    values (
      p_request_id,
      v_requirement ->> 'kind',
      v_requirement ->> 'role_code',
      v_requirement ->> 'scope_label',
      v_requirement ->> 'evidence_type',
      v_requirement ->> 'reason',
      coalesce((select array_agg(value #>> '{}') from jsonb_array_elements(v_requirement -> 'matched_rule_keys')), '{}')
    );
  end loop;

  update customer_change_requests
  set status = case when v_change_request.status = 'sent_back' then 'resubmitted' else 'submitted' end,
      reason = p_reason,
      effective_date = p_effective_date,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

-- =============================================================================
-- send_back_customer_change_request
-- =============================================================================

create or replace function send_back_customer_change_request(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_change_request customer_change_requests;
  v_latest_submitted submission_revisions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'CUSTOMER_CHANGE_SEND_BACK_REASON_REQUIRED: a reason is required to send this Change Request back';
  end if;

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_change_request.status not in ('submitted', 'resubmitted') then
    raise exception 'CUSTOMER_CHANGE_NOT_SENDBACKABLE: request % has status %, only submitted or resubmitted may be sent back', p_request_id, v_change_request.status;
  end if;

  select * into v_latest_submitted
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  perform create_next_revision(p_request_id, v_latest_submitted.id, p_actor_user_id, null, p_actor_context);

  update customer_change_requests
  set status = 'sent_back', sent_back_reason = p_reason, sent_back_by = p_actor_user_id, sent_back_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

-- =============================================================================
-- reject_customer_change_request
-- =============================================================================

create or replace function reject_customer_change_request(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_change_request customer_change_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'CUSTOMER_CHANGE_REJECT_REASON_REQUIRED: a reason is required to reject this Change Request';
  end if;

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_change_request.status = 'rejected' then
    return v_change_request;
  end if;

  if v_change_request.status not in ('submitted', 'resubmitted') then
    raise exception 'CUSTOMER_CHANGE_NOT_REJECTABLE: request % has status %, only submitted or resubmitted may be rejected', p_request_id, v_change_request.status;
  end if;

  update customer_change_requests
  set status = 'rejected', decided_by = p_actor_user_id, decided_at = now(), decision_reason = p_reason,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

-- =============================================================================
-- approve_customer_change_request: the atomic apply
-- =============================================================================

/**
 * Only a small, fixed set of governed Customer Master columns is ever
 * touched here (never dynamic SQL against arbitrary field names, an
 * OWASP-relevant injection concern this function deliberately avoids):
 * name, brand_name, segment, business_unit, country, industry. Any other
 * key present in the proposed values object is ignored, not written.
 */
create or replace function approve_customer_change_request(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_change_request customer_change_requests;
  v_customer customers;
  v_latest_revision submission_revisions;
  v_proposed jsonb;
  v_field text;
  v_old_value text;
  v_new_value text;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
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

  v_proposed := v_latest_revision.effective_data -> 'values';

  for v_field in select unnest(array['name', 'brand_name', 'segment', 'business_unit', 'country', 'industry'])
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
    end if;
  end loop;

  update customers set row_version = row_version + 1, updated_by = p_actor_user_id, updated_at = now() where id = v_customer.id;

  update customer_change_requests
  set status = 'approved', decided_by = p_actor_user_id, decided_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

grant execute on function create_customer_change_request(uuid, uuid, jsonb, uuid, jsonb) to service_role;
grant execute on function save_customer_change_draft(uuid, jsonb, uuid, jsonb) to service_role;
grant execute on function submit_customer_change_request(uuid, text, date, jsonb, uuid, jsonb) to service_role;
grant execute on function send_back_customer_change_request(uuid, text, uuid, jsonb) to service_role;
grant execute on function reject_customer_change_request(uuid, text, uuid, jsonb) to service_role;
grant execute on function approve_customer_change_request(uuid, uuid, jsonb) to service_role;

revoke execute on function create_customer_change_request(uuid, uuid, jsonb, uuid, jsonb) from anon, authenticated;
revoke execute on function save_customer_change_draft(uuid, jsonb, uuid, jsonb) from anon, authenticated;
revoke execute on function submit_customer_change_request(uuid, text, date, jsonb, uuid, jsonb) from anon, authenticated;
revoke execute on function send_back_customer_change_request(uuid, text, uuid, jsonb) from anon, authenticated;
revoke execute on function reject_customer_change_request(uuid, text, uuid, jsonb) from anon, authenticated;
revoke execute on function approve_customer_change_request(uuid, uuid, jsonb) from anon, authenticated;
