import type {
  BillingCadence,
  BillingQuantityBasis,
  BillingQuantityBasisUsed,
  BillingTiming,
  CommercialComponent,
  MeasurementDefinition,
  PricingRuleKind,
} from "./types"

/**
 * Human-readable English labels for Commercial enums and a composed
 * Component label. UI-ready text, not presentation: no currency symbols,
 * no CSS, no locale-specific number/date formatting (that belongs in
 * components/UI code, using src/lib/format.ts and friends).
 */

const BILLING_CADENCE_LABELS: Record<BillingCadence, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  annual: "Annual",
}

const BILLING_TIMING_LABELS: Record<BillingTiming, string> = {
  advance: "Billed in advance",
  arrears: "Billed in arrears",
}

const BILLING_QUANTITY_BASIS_LABELS: Record<BillingQuantityBasis, string> = {
  mug: "Minimum commitment (MUG)",
  previous_period_actual: "Previous period actual",
  fixed: "Fixed amount",
}

/**
 * billing_calculations.billing_quantity_basis_used (M10) adds
 * 'period_actual' to the three Component-policy values above; this is a
 * distinct enum (BillingQuantityBasisUsed, not BillingQuantityBasis) and
 * needs its own label map rather than reusing
 * BILLING_QUANTITY_BASIS_LABELS.
 */
const BILLING_QUANTITY_BASIS_USED_LABELS: Record<BillingQuantityBasisUsed, string> = {
  mug: "Minimum commitment (MUG)",
  previous_period_actual: "Previous period actual",
  period_actual: "This period's actual",
  fixed: "Fixed amount",
}

const PRICING_RULE_KIND_LABELS: Record<PricingRuleKind, string> = {
  linear: "Linear",
  graduated: "Graduated / tiered",
  volume: "Volume-based",
  dimension: "Dimension-based",
  flat: "Flat fee",
}

function billingCadenceLabel(cadence: BillingCadence): string {
  return BILLING_CADENCE_LABELS[cadence]
}

function billingTimingLabel(timing: BillingTiming): string {
  return BILLING_TIMING_LABELS[timing]
}

function billingQuantityBasisLabel(basis: BillingQuantityBasis | null): string {
  return basis ? BILLING_QUANTITY_BASIS_LABELS[basis] : "Not applicable (arrears)"
}

function billingQuantityBasisUsedLabel(basisUsed: BillingQuantityBasisUsed): string {
  return BILLING_QUANTITY_BASIS_USED_LABELS[basisUsed]
}

function pricingRuleKindLabel(kind: PricingRuleKind): string {
  return PRICING_RULE_KIND_LABELS[kind]
}

/**
 * Commercial Components have no `name` column (locked schema): a label
 * is composed from the pricing rule and, when usage-driven, the
 * Measurement Definition it depends on. `measurementDefinition` is
 * optional so callers that have not loaded it yet can still get a label.
 */
function commercialComponentLabel(
  component: Pick<CommercialComponent, "pricingRuleKind" | "measurementDefinitionId">,
  measurementDefinition?: Pick<MeasurementDefinition, "name"> | null
): string {
  const pricing = pricingRuleKindLabel(component.pricingRuleKind)
  if (!component.measurementDefinitionId) {
    return `${pricing} charge`
  }
  return measurementDefinition ? `${measurementDefinition.name} (${pricing})` : pricing
}

export {
  billingCadenceLabel,
  billingTimingLabel,
  billingQuantityBasisLabel,
  billingQuantityBasisUsedLabel,
  pricingRuleKindLabel,
  commercialComponentLabel,
}
