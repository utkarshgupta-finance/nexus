-- Nexus: NEXUS ACCEPTANCE CLOSURE. Fixes a real, severe defect found via
-- live retest: approving ANY Commercial Configuration Version (fresh
-- onboarding or an amendment, unrelated to Slab-wise MUG) has been
-- deterministically failing with "null value in column
-- stable_component_key of relation commercial_components violates
-- not-null constraint" since 20260918010000_go_live_domain.sql landed.
--
-- Root cause: that migration made stable_component_key NOT NULL and
-- taught approve_commercial_configuration_version /
-- approve_customer_onboarding_case to run a follow-up UPDATE setting it
-- after calling add_commercial_component, but never taught
-- add_commercial_component's own INSERT to populate the column at all.
-- The INSERT fails the NOT NULL constraint before the follow-up UPDATE
-- ever runs, so the fix-up code was dead from the moment it was written.
--
-- A second, related problem: even if the INSERT did not fail, the
-- follow-up UPDATE pattern is unsound. fn_protect_commercial_component_
-- lifecycle's own UPDATE guard (same migration) allows
-- stable_component_key to change only "once, from null" — but by the
-- time the follow-up UPDATE runs, the row's stable_component_key would
-- already be non-null (whatever the INSERT wrote), so carrying an
-- amendment's REAL previous key forward via a second UPDATE would have
-- been rejected by that very guard. The correct fix is to supply the
-- final, correct stable_component_key value directly on INSERT, never
-- as a follow-up UPDATE.
--
-- Fix: add_commercial_component gains p_stable_component_key (defaults
-- to the new component's own id, i.e. "mint once" for a genuinely new
-- line item), and both approving functions now resolve the value BEFORE
-- calling it and pass it straight through, instead of updating
-- afterward.
--
-- This file has not been applied to any database as of authoring.

create or replace function add_commercial_component(
  p_new_commercial_component_id uuid,
  p_commercial_configuration_id uuid,
  p_commercial_change_id uuid,
  p_is_recurring boolean,
  p_pricing_rule_kind text,
  p_pricing_rule_parameters jsonb,
  p_billing_cadence text,
  p_billing_timing text,
  p_reconciliation_cadence text,
  p_transaction_currency text,
  p_fx_snapshot_rate numeric,
  p_effective_from date,
  p_actor_user_id uuid,
  p_billing_quantity_basis text default null,
  p_measurement_definition_id uuid default null,
  p_supersedes_component_id uuid default null,
  p_actor_context jsonb default null,
  p_stable_component_key uuid default null
)
returns public.commercial_components
language plpgsql
security invoker
as $$
declare
  v_component public.commercial_components;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  insert into public.commercial_components (
    id, commercial_configuration_id, commercial_change_id, supersedes_component_id,
    measurement_definition_id, is_recurring, pricing_rule_kind, pricing_rule_parameters,
    billing_cadence, billing_timing, billing_quantity_basis, reconciliation_cadence,
    transaction_currency, fx_snapshot_rate, effective_from, stable_component_key, created_by, updated_by
  )
  values (
    p_new_commercial_component_id, p_commercial_configuration_id, p_commercial_change_id, p_supersedes_component_id,
    p_measurement_definition_id, p_is_recurring, p_pricing_rule_kind, p_pricing_rule_parameters,
    p_billing_cadence, p_billing_timing, p_billing_quantity_basis, p_reconciliation_cadence,
    p_transaction_currency, p_fx_snapshot_rate, p_effective_from,
    coalesce(p_stable_component_key, p_new_commercial_component_id), p_actor_user_id, p_actor_user_id
  )
  returning * into v_component;

  return v_component;
end;
$$;

comment on function add_commercial_component(uuid, uuid, uuid, boolean, text, jsonb, text, text, text, text, numeric, date, uuid, text, uuid, uuid, jsonb, uuid) is
  'The first and only INSERT path into commercial_components. pricing_rule_kind/parameters '
  'arrive pre-shaped by src/features/commercial/domain/promotion.ts; this RPC only performs '
  'the actor-audited write. stable_component_key is resolved and supplied by the caller '
  '(mint once, from the new row''s own id, for a genuinely new line item; carried forward '
  'from the superseded component for an amendment): it is set once, correctly, at INSERT '
  'time, never as a follow-up UPDATE (fn_protect_commercial_component_lifecycle''s own '
  '"once, from null" guard would reject a second change). See this migration''s header comment.';

-- =============================================================================
-- approve_customer_onboarding_case: every line item is new, mints its own key
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
    -- Every line item created at onboarding is, by definition, new: its
    -- stable identity is its own freshly-minted component id, supplied
    -- directly to the INSERT (p_stable_component_key left null so
    -- add_commercial_component's own coalesce resolves it), never as a
    -- follow-up UPDATE.
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

-- =============================================================================
-- approve_commercial_configuration_version: an amendment carries the
-- superseded component's own stable key forward, resolved BEFORE insert
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
  v_stable_key uuid;
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

    -- Go Live + Entitlement Ledger: propagate the stable line-item
    -- identity forward. A component the draft reconstructed from an
    -- active row (toDraftComponent seeds draft.id with that row's real
    -- id) carries stable_component_key explicitly in the payload; a
    -- genuinely new line item the user added in this version has none,
    -- and mints a fresh key equal to its own new id. Resolved BEFORE
    -- calling add_commercial_component and supplied directly to the
    -- INSERT, never as a follow-up UPDATE (which
    -- fn_protect_commercial_component_lifecycle's own "once, from null"
    -- guard would reject once the row already has a non-null key).
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
