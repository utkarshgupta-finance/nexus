-- PG-039 (E-022, Batch 12): a designation-based ("dimension") Commercial
-- Component could be inserted with a zero-length rates array, producing a
-- component that prices nothing. The TS-layer completeness check already
-- caught this for the Commercial Configuration Version flow
-- (isCommercialRateDraftComplete), but not for Customer Onboarding approval,
-- and neither layer was enforced at the database boundary, so a direct RPC
-- call could always bypass both. Added NOT VALID: the one pre-existing
-- violating row (E-022's own live-reproduced evidence fixture) is
-- deliberately left in place, per this project's established practice of
-- never scrubbing defect evidence; the constraint is fully enforced for
-- every new insert/update from this point on.

alter table commercial_components drop constraint chk_commercial_components_pricing_rule_shape;
alter table commercial_components add constraint chk_commercial_components_pricing_rule_shape check (
  (pricing_rule_kind = 'linear' and pricing_rule_parameters ? 'rate')
  or (pricing_rule_kind = 'volume' and (pricing_rule_parameters ? 'rate' or pricing_rule_parameters ? 'tiers'))
  or (pricing_rule_kind = 'graduated' and pricing_rule_parameters ? 'tiers')
  or (pricing_rule_kind = 'dimension' and pricing_rule_parameters ? 'rates' and jsonb_array_length(pricing_rule_parameters -> 'rates') > 0)
  or (pricing_rule_kind = 'flat' and pricing_rule_parameters ? 'amount')
) not valid;

comment on constraint chk_commercial_components_pricing_rule_shape on commercial_components is
  'Minimal structural shape per pricing rule kind, plus at least one rate row for Designation '
  'Based (dimension) components (PG-039/E-022 fix, 2026-10-11): a component with zero designation '
  'rate rows prices nothing and must never be persisted. volume accepts either a bare rate (the '
  'original all-units-at-one-rate scenario) or a tiers array (Slab - Whole Quantity, which needs '
  'every band boundary to know which one the quantity falls into). See '
  'docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md section 22. Added NOT VALID: one pre-existing violating '
  'row (E-022''s own reproduced defect evidence) is deliberately preserved, not retroactively '
  'rejected.';
