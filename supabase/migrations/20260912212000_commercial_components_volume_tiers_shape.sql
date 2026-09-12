-- Nexus: allow pricing_rule_kind = 'volume' to store a tiers array.
--
-- Closes the exact gap docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22 already
-- named: "Pricing Model: Slab, Whole Quantity method | pricingRuleKind:
-- 'volume' | commercial_components' shape-check CHECK constraint only
-- allows a bare rate key under pricing_rule_kind = 'volume' today
-- (identical to linear), not the tiers array Slab needs; a follow-up
-- migration must extend that shape before a Slab draft can be promoted."
--
-- Onboarding's Slab - Whole Quantity method needs the full multi-band
-- schedule (the same 'tiers' shape 'graduated' already stores), not a
-- single rate: the entire quantity is priced at whichever one band it
-- falls into, which requires knowing every band's boundaries, not only
-- one number. This widens 'volume' to accept either shape: a bare 'rate'
-- (the original all-units-at-one-negotiated-rate scenario the locked
-- domain's own §19 scenario 2 describes) or a 'tiers' array (Slab -
-- Whole Quantity). 'linear' is unaffected and still requires 'rate' only.
--
-- This file has not been applied to any database as of authoring.

alter table commercial_components drop constraint chk_commercial_components_pricing_rule_shape;
alter table commercial_components add constraint chk_commercial_components_pricing_rule_shape check (
  (pricing_rule_kind = 'linear' and pricing_rule_parameters ? 'rate')
  or (pricing_rule_kind = 'volume' and (pricing_rule_parameters ? 'rate' or pricing_rule_parameters ? 'tiers'))
  or (pricing_rule_kind = 'graduated' and pricing_rule_parameters ? 'tiers')
  or (pricing_rule_kind = 'dimension' and pricing_rule_parameters ? 'rates')
  or (pricing_rule_kind = 'flat' and pricing_rule_parameters ? 'amount')
);

comment on constraint chk_commercial_components_pricing_rule_shape on commercial_components is
  'Minimal structural shape per pricing rule kind. volume accepts either a bare rate (the '
  'original all-units-at-one-rate scenario) or a tiers array (Slab - Whole Quantity, which '
  'needs every band boundary to know which one the quantity falls into). See '
  'docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22.';
