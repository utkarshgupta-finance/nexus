-- Nexus: Program 4 Hardening. Maker/Checker self-approval control.
--
-- Permanent Nexus principle: MAKER != CHECKER FOR THE SAME GOVERNED
-- DECISION. A user may create/submit their own governed request; a user
-- may approve, reject, or send back a request created by someone else;
-- a user must never approve, reject, or send back their own request,
-- even if they personally hold the reviewing permission (for example
-- the `checker` role, Platform Operating Expansion Phase L, which
-- bundles create and approve permissions together on one role for
-- convenience, not as license to self-review).
--
-- This is enforced here, in every governed decision RPC itself, not
-- only in the calling Server Action or the UI, so the rule holds even
-- if a future caller reaches these RPCs directly. All seven RPCs below
-- keep their exact existing signature (`create or replace function`,
-- no new overload, verified via pg_proc before and after this
-- migration): only a new guard is inserted, immediately after the row
-- is fetched and confirmed to exist, before any other business logic,
-- so a self-decision attempt is rejected deterministically regardless
-- of the record's current status.
--
-- Send Back is included, not only Approve/Reject: a send-back is a
-- reviewer decision returning a request to its maker for correction: if
-- the "reviewer" making that decision were the maker themselves, that is
-- the exact self-review scenario this principle exists to prevent.
--
-- This file has not been applied to any database as of authoring.

-- =============================================================================
-- Customer Onboarding Case
-- =============================================================================

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

create or replace function send_back_customer_onboarding_case(
  p_request_id uuid,
  p_reason text,
  p_target_stage_key text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_field_comments jsonb default '[]'::jsonb
)
returns customer_onboarding_cases
language plpgsql
security invoker
as $function$
declare
  v_case customer_onboarding_cases;
  v_next_revision submission_revisions;
  v_latest_submitted submission_revisions;
  v_field_comment jsonb;
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

  if v_case.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot send back your own request. Another authorized checker must review it.';
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

  insert into customer_onboarding_send_backs (request_id, revision_number, reason, target_stage_key, sent_back_by)
  values (p_request_id, v_latest_submitted.revision_number, p_reason, p_target_stage_key, p_actor_user_id);

  for v_field_comment in select * from jsonb_array_elements(coalesce(p_field_comments, '[]'::jsonb))
  loop
    if btrim(coalesce(v_field_comment ->> 'comment', '')) = '' then
      continue;
    end if;
    insert into customer_onboarding_field_comments (request_id, revision_number, field_key, comment, reviewer_id)
    values (p_request_id, v_latest_submitted.revision_number, v_field_comment ->> 'field_key', v_field_comment ->> 'comment', p_actor_user_id);
  end loop;

  return v_case;
end;
$function$;

-- =============================================================================
-- Customer Change Request
-- =============================================================================

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

create or replace function reject_customer_change_request(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
security invoker
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

  if v_change_request.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot reject your own request. Another authorized checker must review it.';
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

create or replace function send_back_customer_change_request(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
security invoker
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

  if v_change_request.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot send back your own request. Another authorized checker must review it.';
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

  insert into customer_change_send_backs (request_id, revision_number, reason, sent_back_by)
  values (p_request_id, v_latest_submitted.revision_number, p_reason, p_actor_user_id);

  return v_change_request;
end;
$function$;

-- =============================================================================
-- Commercial Configuration Version
-- =============================================================================

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

  -- Task Phase H: reject an approval that would create an incoherent
  -- effective-date ordering, never silently reinterpret it.
  if exists (
    select 1 from commercial_components
    where commercial_configuration_id = v_version.commercial_configuration_id
      and effective_to is null
      and effective_from >= v_version.effective_date
  ) then
    raise exception 'COMMERCIAL_VERSION_EFFECTIVE_DATE_OUT_OF_ORDER: version % has effective_date % which must be strictly after the currently active period''s own start date', p_request_id, v_version.effective_date;
  end if;

  -- A real Request identity for the resulting Commercial Change, exactly
  -- how approve_customer_onboarding_case already mints one (this
  -- version's own p_request_id is already claimed as
  -- commercial_configuration_versions' own identity).
  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  -- Close the prior active version's Components (same closure logic
  -- create_commercial_change_for_configuration already uses), now gated
  -- on approval rather than firing unconditionally at draft creation.
  update commercial_components
  set effective_to = v_version.effective_date - 1, updated_by = p_actor_user_id, updated_at = now()
  where commercial_configuration_id = v_version.commercial_configuration_id and effective_to is null;

  insert into commercial_changes (request_id, commercial_configuration_id, change_category, effective_date, reason, created_by)
  values (v_system_request_id, v_version.commercial_configuration_id, v_version.change_category, v_version.effective_date, v_version.reason, p_actor_user_id)
  returning * into v_commercial_change;

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    v_new_component_id := gen_random_uuid();
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
      p_actor_context
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

create or replace function reject_commercial_configuration_version(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
security invoker
as $function$
declare
  v_version commercial_configuration_versions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'COMMERCIAL_VERSION_REJECT_REASON_REQUIRED: a reason is required to reject this Commercial Configuration Version';
  end if;

  select * into v_version from commercial_configuration_versions where request_id = p_request_id for update;
  if not found then
    raise exception 'COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for request %', p_request_id;
  end if;

  if v_version.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot reject your own request. Another authorized checker must review it.';
  end if;

  if v_version.status = 'rejected' then
    return v_version;
  end if;

  if v_version.status <> 'submitted' then
    raise exception 'COMMERCIAL_VERSION_NOT_REJECTABLE: version % has status %, only submitted may be rejected', p_request_id, v_version.status;
  end if;

  update commercial_configuration_versions
  set status = 'rejected', decided_by = p_actor_user_id, decided_at = now(), decision_reason = p_reason,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;
