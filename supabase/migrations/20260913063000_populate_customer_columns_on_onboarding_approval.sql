-- Nexus: approve_customer_onboarding_case's Customer Master insert only
-- ever set key/name; Segment, Business Unit, Country, Industry, and
-- Brand Name were captured in the onboarding form
-- (src/features/customer-onboarding/forms/customer-onboarding-form-definition.ts's
-- CUSTOMER_ONBOARDING_FIELD_KEYS: segment, business_unit, country,
-- industry_category, brand_business_name) but never carried through to
-- the real customers row, leaving them permanently null for every
-- newly-onboarded customer even though the onboarding form always
-- collects them. The submitted revision's effective_data.values already
-- has these at approval time, so no new RPC parameter is needed: this
-- reads them directly off v_latest_revision, the same row the function
-- already fetched.

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
  v_onboarding_values jsonb;
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

  v_onboarding_values := v_latest_revision.effective_data -> 'values';

  -- 1. Customer Master.
  insert into customers (key, name, segment, business_unit, country, industry, brand_name, created_by, updated_by)
  values (
    p_customer_key, p_customer_name,
    v_onboarding_values ->> 'segment',
    v_onboarding_values ->> 'business_unit',
    v_onboarding_values ->> 'country',
    v_onboarding_values ->> 'industry_category',
    v_onboarding_values ->> 'brand_business_name',
    p_actor_user_id, p_actor_user_id
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
