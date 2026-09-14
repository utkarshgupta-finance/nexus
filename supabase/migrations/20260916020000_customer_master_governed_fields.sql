-- Nexus: Platform Operating Expansion, Phase H. Full Customer Master
-- governed field registry: real columns for every field the Customer
-- Onboarding form already collects but `customers` never persisted
-- (address, state, city, postal code, website, primary contact, tax
-- identifiers, registration details, billing currency). Onboarding
-- Approval populates them at Customer Master creation time;
-- Customer Change Request can now propose a change to any of them,
-- extending the same governed-field-loop
-- approve_customer_change_request already established for the original
-- six (name/brand_name/segment/business_unit/country/industry).
--
-- Excluded, deliberately, matching every other governed-field decision
-- in this schema: `id`/`key` (stable identity, never a proposed value),
-- `is_active` (a lifecycle action, not a field edit), `row_version` and
-- every `created_*`/`updated_*` column (audit/concurrency metadata).
--
-- This file has not been applied to any database as of authoring.

-- =============================================================================
-- customers: new governed columns
-- =============================================================================

alter table customers add column address text;
alter table customers add column state text;
alter table customers add column city text;
alter table customers add column postal_code text;
alter table customers add column website text;
alter table customers add column primary_contact_name text;
alter table customers add column primary_contact_email text;
alter table customers add column primary_contact_phone_country_code text;
alter table customers add column primary_contact_phone_number text;
alter table customers add column primary_contact_designation text;
alter table customers add column gst_number text;
alter table customers add column pan text;
alter table customers add column tan text;
alter table customers add column tax_identifier_type text;
alter table customers add column tax_identifier_name text;
alter table customers add column tax_registration_number text;
alter table customers add column company_document_type text;
alter table customers add column company_document_type_other text;
alter table customers add column billing_currency text;

comment on column customers.address is 'Governed: changed only via an approved Customer Change Request, never directly. Populated at Customer Master creation from the approved Onboarding Case.';
comment on column customers.gst_number is 'Governed, India-specific tax identifier. Null for a non-India customer (see tax_identifier_type/tax_identifier_name instead).';
comment on column customers.tax_identifier_type is 'Reference Master tax_identifier_type code, non-India customers only. Governed: changed only via an approved Customer Change Request.';
comment on column customers.billing_currency is 'Reference Master currency code captured at onboarding. Governed like every other field here, though in practice it rarely changes independently of a new Commercial Version.';

-- =============================================================================
-- approve_customer_onboarding_case: populate the new columns at creation.
--
-- Adds one new parameter (p_customer_fields), which changes this
-- function's signature; Postgres treats a changed signature as a new
-- overload rather than replacing the old one, so the old 9-parameter
-- version is dropped explicitly first (see CLAUDE.md's own migration
-- guidance: "always keep the EXACT same parameter list... unless truly
-- unavoidable, and then explicitly DROP the old signature").
-- =============================================================================

drop function if exists approve_customer_onboarding_case(uuid, text, text, text, text, jsonb, date, uuid, jsonb);

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

  -- 1. Customer Master, including every governed field this onboarding
  -- case recorded (task Phase H): p_customer_fields is a flat jsonb
  -- object keyed by real customers column names, built by the caller
  -- from the onboarding form's own field keys (see
  -- ../src/features/customer-onboarding/domain/onboarding-customer-field-mapping.ts),
  -- never by this RPC guessing at onboarding-specific field names.
  insert into customers (
    key, name, created_by, updated_by,
    address, state, city, postal_code, website,
    primary_contact_name, primary_contact_email, primary_contact_phone_country_code,
    primary_contact_phone_number, primary_contact_designation,
    gst_number, pan, tan, tax_identifier_type, tax_identifier_name, tax_registration_number,
    company_document_type, company_document_type_other, billing_currency
  )
  values (
    p_customer_key, p_customer_name, p_actor_user_id, p_actor_user_id,
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

grant execute on function approve_customer_onboarding_case(uuid, text, text, text, text, jsonb, date, uuid, jsonb, jsonb) to service_role;
revoke execute on function approve_customer_onboarding_case(uuid, text, text, text, text, jsonb, date, uuid, jsonb, jsonb) from anon, authenticated;

-- =============================================================================
-- approve_customer_change_request: extend the governed-field loop to
-- cover every new column, same exact signature (no parameter change, so
-- no overload risk here: only the field array/CASE/IF-ELSIF body grows).
-- =============================================================================

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
