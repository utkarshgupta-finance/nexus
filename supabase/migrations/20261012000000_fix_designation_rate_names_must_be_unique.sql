-- PG-045 (G-021, Batch 14): two designation rows within one Commercial
-- Component could share the same name (case/whitespace-insensitive); rows
-- are keyed by row id, not name, so both independently contributed to the
-- total. DECIDED (2026-09-28): block outright, no plausible legitimate
-- reason for two identically-named rows in one pricing table (distinct
-- from PG-044's duplicate-Component-scope decision, which is warn-only).
-- Fixed at the TS layer (validateDesignationRowIssues in
-- commercial-rate.ts, now an `invalid` issue) and, defense-in-depth, here
-- at the DB layer, matching PG-039's own established pattern for this
-- exact table/domain (a direct RPC call bypasses all TS validation).
--
-- Added NOT VALID: one pre-existing violating row (component
-- 457ff27a-2186-44ec-94e8-9a0d53e11e9d / 6138d02f-d7af-422e-b651-f0d499aece8f,
-- G-021's own reproduced defect evidence, two "Manager" rows) is
-- deliberately preserved, not retroactively rejected.

create or replace function fn_designation_rates_have_unique_names(rates jsonb)
returns boolean
language sql
immutable
as $$
  select count(*) = count(distinct lower(trim(elem ->> 'designation')))
  from jsonb_array_elements(rates) as elem
$$;

comment on function fn_designation_rates_have_unique_names(jsonb) is
  'PG-045: true when every element of a designation-based (dimension) '
  'component''s rates array has a distinct name (case/whitespace-insensitive). '
  'Used by chk_commercial_components_pricing_rule_shape.';

alter table commercial_components drop constraint chk_commercial_components_pricing_rule_shape;
alter table commercial_components add constraint chk_commercial_components_pricing_rule_shape check (
  (pricing_rule_kind = 'linear' and pricing_rule_parameters ? 'rate')
  or (pricing_rule_kind = 'volume' and (pricing_rule_parameters ? 'rate' or pricing_rule_parameters ? 'tiers'))
  or (pricing_rule_kind = 'graduated' and pricing_rule_parameters ? 'tiers')
  or (
    pricing_rule_kind = 'dimension'
    and pricing_rule_parameters ? 'rates'
    and jsonb_array_length(pricing_rule_parameters -> 'rates') > 0
    and fn_designation_rates_have_unique_names(pricing_rule_parameters -> 'rates')
  )
  or (pricing_rule_kind = 'flat' and pricing_rule_parameters ? 'amount')
) not valid;

comment on constraint chk_commercial_components_pricing_rule_shape on commercial_components is
  'Minimal structural shape per pricing rule kind, plus at least one rate row '
  '(PG-039) and unique designation names (PG-045) for Designation Based '
  '(dimension) components. volume accepts either a bare rate (the original '
  'all-units-at-one-rate scenario) or a tiers array (Slab - Whole Quantity). '
  'See docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md section 22. Added NOT VALID '
  'twice (PG-039, PG-045): two pre-existing violating rows (both journeys'' '
  'own reproduced defect evidence) are deliberately preserved, not '
  'retroactively rejected.';
