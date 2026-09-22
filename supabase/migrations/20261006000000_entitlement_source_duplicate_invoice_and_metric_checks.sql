-- Product Gap Closure (Batch 19 I-034, I-035), decided after Batch 19 closed.
--
-- I-034: one Invoice must only ever create entitlement once. Scope: the
-- customer boundary (entitlement_sources.customer_id); Nexus has no
-- separate legal-entity concept (docs/MASTER_DATA_FOUNDATION_DESIGN.md
-- explicitly rejects one), so customer_id is the correct and only
-- available uniqueness boundary. The same invoice reference remains
-- valid for two different customers. Enforced by a real unique index
-- (so concurrent duplicate creation cannot both succeed, not just a
-- check-then-insert race), on a case/whitespace-normalized expression
-- (matching the existing GST/PAN normalization convention in
-- src/features/customer-onboarding/domain/duplicate-detection.ts:
-- trim + lowercase, no removal of internal characters). Not scoped to
-- status = 'active': per the already-closed decision that Entitlement
-- Source cancellation has zero effect on already-derived entitlement, a
-- cancelled source still represents entitlement that was actually
-- created, so its invoice reference must not become reusable.
--
-- I-035: an Entitlement Source's metric must match the metric the
-- commercial component is actually billed on. The billed-metric source
-- of truth is commercial_components.pricing_rule_parameters ->>
-- 'pricingUnit' (a Reference Master code, list_key = 'pricing_unit'),
-- resolved to its human label via reference_options. This is the real,
-- populated source of truth in this database today:
-- measurement_definitions is entirely empty and
-- commercial_components.measurement_definition_id is null on all 72
-- live rows (confirmed by live inspection before writing this
-- migration), so a check built against that column would silently never
-- fire. pricingUnit is only ever populated for pricing_rule_kind in
-- ('linear', 'volume', 'graduated') (src/features/customer-onboarding/
-- domain/commercial-rate.ts); 'flat' and 'dimension' components
-- legitimately carry no unit, so the check is skipped for those, not
-- widened into a rule those component types were never meant to have.
-- Comparison is case/whitespace-normalized plus a simple trailing-"s"
-- strip, since the Reference Master labels are singular ("User") while
-- Finance's existing free-text metric entries are plural ("Users"); this
-- is ordinary text-matching, not a new business rule.

-- =============================================================================
-- I-034: historical test-fixture reconciliation (idempotent, no effect on a
-- database where this has already been applied or never had the duplicate)
-- =============================================================================

update entitlement_sources
set invoice_reference = 'INV-B17-I023-BATCH19-I034-DUPLICATE-TEST-FIXTURE'
where id = '7e99fb24-8852-48b3-94b5-99467c4b95b9'
  and invoice_reference = 'INV-B17-I023';

-- =============================================================================
-- I-034: uniqueness at the database level
-- =============================================================================

create unique index uq_entitlement_sources_customer_invoice_reference
  on entitlement_sources (customer_id, lower(btrim(invoice_reference)));

comment on index uq_entitlement_sources_customer_invoice_reference is
  'Product decision (Batch 19 I-034 closure): one Invoice reference creates entitlement at most once per customer. Normalized (trim + lowercase) to match the existing GST/PAN duplicate-detection convention. Covers every status, including cancelled, because cancellation has zero effect on already-derived entitlement.';

-- =============================================================================
-- I-034 + I-035: create_entitlement_source, now enforcing both
-- =============================================================================

create or replace function create_entitlement_source(
  p_id uuid,
  p_customer_id uuid,
  p_stable_component_key uuid,
  p_commercial_version_id uuid,
  p_invoice_reference text,
  p_invoice_date date,
  p_invoice_quantity numeric,
  p_metric text,
  p_invoice_duration_months integer,
  p_document_reference text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns entitlement_sources
language plpgsql
security invoker
as $function$
declare
  v_row entitlement_sources;
  v_existing_source_number integer;
  v_pricing_rule_kind text;
  v_pricing_unit_code text;
  v_expected_metric_label text;
  v_normalized_given text;
  v_normalized_expected text;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  -- I-034: duplicate invoice reference, this customer, any status.
  select source_number into v_existing_source_number
  from entitlement_sources
  where customer_id = p_customer_id and lower(btrim(invoice_reference)) = lower(btrim(p_invoice_reference))
  limit 1;

  if v_existing_source_number is not null then
    raise exception 'ENTITLEMENT_SOURCE_DUPLICATE_INVOICE_REFERENCE: this customer already has an Entitlement Source (ES-%) using invoice reference "%". One invoice can only create entitlement once.', lpad(v_existing_source_number::text, 6, '0'), p_invoice_reference;
  end if;

  -- I-035: metric must match the component's own billed metric, where
  -- the component actually has one (linear/volume/graduated only).
  select cc.pricing_rule_kind, cc.pricing_rule_parameters ->> 'pricingUnit'
  into v_pricing_rule_kind, v_pricing_unit_code
  from commercial_components cc
  where cc.stable_component_key = p_stable_component_key and cc.effective_to is null
  limit 1;

  if v_pricing_rule_kind in ('linear', 'volume', 'graduated') and v_pricing_unit_code is not null then
    select ro.label into v_expected_metric_label
    from reference_options ro
    where ro.list_key = 'pricing_unit' and ro.code = v_pricing_unit_code and ro.is_active = true;

    if v_expected_metric_label is not null then
      v_normalized_given := regexp_replace(lower(btrim(p_metric)), 's$', '');
      v_normalized_expected := regexp_replace(lower(btrim(v_expected_metric_label)), 's$', '');

      if v_normalized_given <> v_normalized_expected then
        raise exception 'ENTITLEMENT_SOURCE_METRIC_MISMATCH: metric "%" does not match this component''s billed metric "%". Use the component''s own billed metric.', p_metric, v_expected_metric_label;
      end if;
    end if;
  end if;

  -- The select-based check above closes the common case with a friendly,
  -- specific message; the unique index is the actual race-proof
  -- enforcement (two concurrent requests past the select above can still
  -- both reach this insert, but only one can ever commit). Catch that
  -- race here and raise the exact same named error, rather than letting
  -- a raw unique_violation reach the caller.
  begin
    insert into entitlement_sources (
      id, customer_id, stable_component_key, commercial_version_id, invoice_reference, invoice_date,
      invoice_quantity, metric, invoice_duration_months, document_reference, created_by, updated_by
    )
    values (
      p_id, p_customer_id, p_stable_component_key, p_commercial_version_id, p_invoice_reference, p_invoice_date,
      p_invoice_quantity, p_metric, p_invoice_duration_months, p_document_reference, p_actor_user_id, p_actor_user_id
    )
    returning * into v_row;
  exception
    when unique_violation then
      select source_number into v_existing_source_number
      from entitlement_sources
      where customer_id = p_customer_id and lower(btrim(invoice_reference)) = lower(btrim(p_invoice_reference))
      limit 1;
      raise exception 'ENTITLEMENT_SOURCE_DUPLICATE_INVOICE_REFERENCE: this customer already has an Entitlement Source (ES-%) using invoice reference "%". One invoice can only create entitlement once.', lpad(coalesce(v_existing_source_number, 0)::text, 6, '0'), p_invoice_reference;
  end;

  return v_row;
end;
$function$;

revoke execute on function create_entitlement_source(uuid, uuid, uuid, uuid, text, date, numeric, text, integer, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function create_entitlement_source(uuid, uuid, uuid, uuid, text, date, numeric, text, integer, text, uuid, jsonb) to service_role;
