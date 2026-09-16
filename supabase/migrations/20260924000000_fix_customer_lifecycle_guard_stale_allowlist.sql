-- Nexus Foundational Hardening, Phase 3B (Workflow Runtime Live +
-- Adversarial Journey Validation): fixes a real, severe defect found
-- while proving Customer Change Request runtime routing end to end.
--
-- 20260916020000_customer_master_governed_fields.sql added 18 new
-- governed columns to `customers` (address, state, city, postal_code,
-- website, primary_contact_*, gst_number, pan, tan, tax_*,
-- company_document_type*, billing_currency) and extended
-- approve_customer_change_request's field-update loop to write them, but
-- never updated fn_protect_customer_lifecycle, the UPDATE guard trigger
-- on `customers`. That trigger still only permits
-- name/is_active/segment/business_unit/country/industry/brand_name/
-- row_version/updated_at/updated_by to change (its original, pre-Phase-H
-- allowlist from 20260913080000_permanent_customer_deletion.sql).
--
-- Net effect, confirmed live: a Customer Change Request proposing a
-- change to any of those 18 fields (18 of the 25 fields the Change
-- Request UI itself advertises as governed and lets a maker propose)
-- always fails on approval. approve_customer_change_request's UPDATE
-- touches the new column, the trigger's stale allowlist rejects it with
-- `customers is a permanent master identity: only name, is_active, ...`,
-- and because that exact token isn't registered in
-- src/features/customer-change/domain/change-errors.ts, the user sees
-- only a generic "An unexpected error occurred. Reference: NX-...".
-- Reproduced live: proposed a change to CCR-000011 that touched a
-- non-allowlisted field, an authorized Finance approver in the correct
-- team clicked Approve, and the approval failed with exactly this error;
-- confirmed the root cause via postgres logs
-- ("customers is a permanent master identity: only name, is_active,
-- segment, business_unit, country, industry, brand_name, row_version,
-- updated_at, and updated_by may change").
--
-- Fix: bring fn_protect_customer_lifecycle's allowlist in sync with the
-- full governed-field registry (src/features/customers/domain/
-- governed-field-registry.ts), so every field the product tells a maker
-- they can propose a change for is actually a field approval can apply.
--
-- STAGED, NOT APPLIED. Same working agreement as every other migration
-- this session: no `supabase db push` without a specific go-ahead from
-- the user, given this redefines a data-integrity guard on the
-- `customers` master table. Apply with `npx supabase db push --linked`
-- once reviewed.

create or replace function fn_protect_customer_lifecycle()
returns trigger
language plpgsql
as $function$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.permit_customer_delete', true), '') = 'true' then
      return old;
    end if;
    raise exception 'customers is a permanent master identity: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  -- tg_op = 'UPDATE'. Every field in the Customer Master governed-field
  -- registry (src/features/customers/domain/governed-field-registry.ts),
  -- plus the always-mutable system columns (is_active, row_version,
  -- updated_at, updated_by), are the only columns ever permitted to
  -- change; is_active is permitted to move in either direction, so it is
  -- excluded from this comparison rather than checked for a specific
  -- transition.
  v_old_core := to_jsonb(old)
    - 'name' - 'brand_name' - 'segment' - 'business_unit' - 'country' - 'industry'
    - 'address' - 'state' - 'city' - 'postal_code' - 'website'
    - 'primary_contact_name' - 'primary_contact_email' - 'primary_contact_phone_country_code'
    - 'primary_contact_phone_number' - 'primary_contact_designation'
    - 'gst_number' - 'pan' - 'tan' - 'tax_identifier_type' - 'tax_identifier_name' - 'tax_registration_number'
    - 'company_document_type' - 'company_document_type_other' - 'billing_currency'
    - 'is_active' - 'row_version' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new)
    - 'name' - 'brand_name' - 'segment' - 'business_unit' - 'country' - 'industry'
    - 'address' - 'state' - 'city' - 'postal_code' - 'website'
    - 'primary_contact_name' - 'primary_contact_email' - 'primary_contact_phone_country_code'
    - 'primary_contact_phone_number' - 'primary_contact_designation'
    - 'gst_number' - 'pan' - 'tan' - 'tax_identifier_type' - 'tax_identifier_name' - 'tax_registration_number'
    - 'company_document_type' - 'company_document_type_other' - 'billing_currency'
    - 'is_active' - 'row_version' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'customers is a permanent master identity: only the governed Customer Master fields, is_active, row_version, '
      'updated_at, and updated_by may change (id=%)', old.id;
  end if;

  return new;
end;
$function$;
