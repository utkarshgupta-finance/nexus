import type { BillingQuantityBasis, BillingTiming, ComponentBillingCadence, PricingRuleKind } from "@/features/commercial"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

import { calculateMilestoneAmount, nonRecurringMilestoneBasisAmount, toPricingRuleKind } from "./commercial-rate"
import type { CommercialComponentDraft, CommercialNature, DesignationRow, Milestone, MugOverlay, SlabRow } from "./commercial-rate"
import { currentFxSnapshot } from "./commercial-rate-fx"

/**
 * Maps a Commercial Rate onboarding draft component (./commercial-rate.ts)
 * into the shape `commercialConfigurationService.addCommercialComponent`
 * (src/features/commercial/services/configuration.service.ts) needs to
 * insert one real `commercial_components` row. This lives in
 * customer-onboarding, not commercial, because a feature must not import
 * another feature's internals (docs/ARCHITECTURE.md §2-3): onboarding
 * already depends on Commercial's public contract (`toPricingRuleKind`'s
 * own `PricingRuleKind` import), never the reverse, so the seam that
 * needs both domains' concrete shapes belongs on this side.
 *
 * `pricingRuleParameters` intentionally carries more than the minimal key
 * `chk_commercial_components_pricing_rule_shape` requires (task
 * correction: "avoid over-normalizing... use a validated snapshot
 * contract"): the entire agreed commercial detail for a component
 * (Slab bands, Designation rows, Milestones, MUG) lives in this one
 * JSONB column, a deliberate snapshot, not spread across a dozen
 * component-specific tables the locked M8 schema was never designed to
 * have. `commercialNature` is stored explicitly inside this JSON because
 * the real schema's own `is_recurring` boolean cannot distinguish
 * On-Demand from Non-Recurring (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md
 * §22 vocabulary table: "Commercial Nature: On-Demand | no equivalent |
 * new concept"), a pre-existing, honestly-documented gap this does not
 * silently paper over.
 */

type CommercialComponentInsertInput = {
  isRecurring: boolean
  pricingRuleKind: PricingRuleKind
  pricingRuleParameters: Record<string, unknown>
  billingCadence: ComponentBillingCadence
  billingTiming: BillingTiming
  billingQuantityBasis: BillingQuantityBasis | null
  reconciliationCadence: ComponentBillingCadence
  transactionCurrency: string
  fxSnapshotRate: number | null
  effectiveFrom: string
  /**
   * Present only when this component carries an enabled MUG: the single
   * combined monthly quantity threshold to persist as one
   * commercial_commitments row (kind = 'quantity'), summed across
   * designations for Designation Based (see this file's own header
   * comment on why one aggregate threshold is correct here).
   */
  mugThresholdValue: number | null
}

/** advance/postpaid (Reference Master invoice_timing codes) -> BillingTiming. Defaults to arrears if somehow unset; promotion is only ever attempted on a complete draft, where this is never actually null. */
function toBillingTiming(invoiceTimingCode: string | null): BillingTiming {
  return invoiceTimingCode === "advance" ? "advance" : "arrears"
}

/**
 * Reference Master's invoice_frequency codes (monthly/quarterly/
 * half_yearly/annual/one_time) map 1:1 onto ComponentBillingCadence.
 * `fallback` covers On-Demand's optional Invoice Frequency: a real
 * recurring cadence never applies to an on-demand charge, so 'one_time'
 * is the honest placeholder when none was chosen (docs/
 * COMMERCIAL_DOMAIN_ARCHITECTURE.md §22).
 */
function toBillingCadence(invoiceFrequencyCode: string | null, fallback: ComponentBillingCadence): ComponentBillingCadence {
  if (
    invoiceFrequencyCode === "monthly" ||
    invoiceFrequencyCode === "quarterly" ||
    invoiceFrequencyCode === "half_yearly" ||
    invoiceFrequencyCode === "annual" ||
    invoiceFrequencyCode === "one_time"
  ) {
    return invoiceFrequencyCode
  }
  return fallback
}

function toBillingQuantityBasis(timing: BillingTiming, mug: MugOverlay | null): BillingQuantityBasis | null {
  if (timing === "arrears") return null
  return mug?.enabled ? "mug" : "previous_period_actual"
}

function slabTiers(rows: SlabRow[]): { from: number | null; to: number | null; rate: number | null }[] {
  return rows.map((row) => ({ from: row.from, to: row.to, rate: row.rate }))
}

function designationRates(rows: DesignationRow[]): { designation: string; rate: number | null; per: string | null }[] {
  return rows.map((row) => ({ designation: row.designation, rate: row.rate, per: row.per }))
}

/** The one combined monthly quantity threshold for a MUG commitment: the plain quantity for Per Unit/Slab, or the sum of every designation's own Minimum Units for Designation Based (this file's header explains why one aggregate value is correct here). */
function mugThresholdValue(component: CommercialComponentDraft): number | null {
  if (!("mug" in component) || !component.mug.enabled) return null
  if (component.pricingModel === "designation_based") {
    const total = component.mug.designationMinimums.reduce((sum, entry) => sum + (entry.minimumUnits ?? 0), 0)
    return total > 0 ? total : null
  }
  return component.mug.minimumUnits
}

function milestoneParameters(
  milestones: Milestone[],
  basisAmount: number | null
): { name: string; recognitionPercent: number | null; invoiceTimingCode: string | null; recognitionAmount: number | null }[] {
  return milestones.map((milestone) => ({
    name: milestone.name,
    recognitionPercent: milestone.recognitionPercent,
    invoiceTimingCode: milestone.invoiceTiming,
    recognitionAmount: calculateMilestoneAmount(basisAmount, milestone.recognitionPercent),
  }))
}

/**
 * Maps one onboarding component into the exact input
 * `addCommercialComponent` needs. `billingCurrency`/`snapshot` resolve
 * the FX snapshot once, here, at promotion time, never re-derived later
 * (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md, FX snapshot principle).
 */
function mapOnboardingComponentToCommercialComponentInsert(
  component: CommercialComponentDraft,
  snapshot: ReferenceMasterSnapshot,
  billingCurrency: string,
  effectiveFrom: string
): CommercialComponentInsertInput {
  const nature: CommercialNature = component.nature
  const isRecurring = nature === "recurring"
  const mug: MugOverlay | null = "mug" in component ? component.mug : null

  const invoiceTimingCode =
    component.nature === "non_recurring" && component.revenueRecognition.method === "milestone_based"
      ? (component.revenueRecognition.milestones[0]?.invoiceTiming ?? null)
      : component.invoiceTerms.invoiceTiming
  const billingTiming = toBillingTiming(invoiceTimingCode)

  const cadenceFallback: ComponentBillingCadence = nature === "recurring" ? "monthly" : "one_time"
  const billingCadence = toBillingCadence(component.invoiceTerms.invoiceFrequency, cadenceFallback)

  const fx = billingCurrency === "INR" ? null : currentFxSnapshot(snapshot, billingCurrency)

  const baseParameters: Record<string, unknown> = {
    name: component.description,
    commercialNature: nature,
    invoiceFrequencyCode: component.invoiceTerms.invoiceFrequency,
    invoiceTimingCode: component.invoiceTerms.invoiceTiming,
  }

  let pricingRuleParameters: Record<string, unknown>
  if (component.pricingModel === "per_unit") {
    pricingRuleParameters = { ...baseParameters, rate: component.rate, pricingUnit: component.pricingUnit }
    if (mug?.enabled) pricingRuleParameters.mug = { minimumUnits: mug.minimumUnits }
  } else if (component.pricingModel === "flat_fee") {
    pricingRuleParameters = { ...baseParameters, amount: component.amount }
  } else if (component.pricingModel === "slab") {
    pricingRuleParameters = {
      ...baseParameters,
      tiers: slabTiers(component.slabRows),
      slabMethod: component.slabMethod,
      pricingUnit: component.pricingUnit,
    }
    if (mug?.enabled) pricingRuleParameters.mug = { minimumUnits: mug.minimumUnits }
  } else {
    pricingRuleParameters = { ...baseParameters, rates: designationRates(component.designationRows) }
    if (mug?.enabled) pricingRuleParameters.mug = { designationMinimums: mug.designationMinimums }
  }

  if (component.nature === "non_recurring") {
    const recognition = component.revenueRecognition
    pricingRuleParameters.revenueRecognition =
      recognition.method === "full_recognition"
        ? { method: "full_recognition" as const }
        : {
            method: "milestone_based" as const,
            milestones: milestoneParameters(recognition.milestones, nonRecurringMilestoneBasisAmount(component)),
          }
  }

  return {
    isRecurring,
    pricingRuleKind: toPricingRuleKind(component.pricingModel, component.pricingModel === "slab" ? component.slabMethod : undefined),
    pricingRuleParameters,
    billingCadence,
    billingTiming,
    billingQuantityBasis: toBillingQuantityBasis(billingTiming, mug),
    reconciliationCadence: billingCadence,
    transactionCurrency: billingCurrency,
    fxSnapshotRate: fx?.inrConversionRate ?? null,
    effectiveFrom,
    mugThresholdValue: mugThresholdValue(component),
  }
}

export { mapOnboardingComponentToCommercialComponentInsert, toBillingTiming, toBillingCadence, toBillingQuantityBasis, mugThresholdValue }
export type { CommercialComponentInsertInput }
