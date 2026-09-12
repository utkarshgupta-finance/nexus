import type { CommercialComponent } from "@/features/commercial"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

import { newId } from "./commercial-rate"
import type {
  CommercialComponentDraft,
  CommercialNature,
  DesignationRow,
  InvoiceTerms,
  Milestone,
  MugOverlay,
  RevenueRecognition,
  SlabMethod,
  SlabRow,
} from "./commercial-rate"
import { componentTableCells } from "./commercial-rate-summary"
import type { ComponentTableCells } from "./commercial-rate-summary"

/**
 * Reconstructs the exact same read-only cells Customer Onboarding's own
 * Commercial Rate table already shows (task correction: "the same
 * Commercial Component should read the same way in Customer Onboarding
 * and Customer Commercials. Reuse the summary/domain helpers already
 * built, do not create a separate formatter vocabulary"), from a
 * PERSISTED `commercial_components` row instead of a live onboarding
 * draft. `toDraftComponent` is the exact inverse of
 * `mapOnboardingComponentToCommercialComponentInsert`
 * (../domain/commercial-configuration-promotion.ts): every field that
 * promotion wrote into `pricing_rule_parameters` is read back here, so
 * `componentTableCells` (../domain/commercial-rate-summary.ts) never
 * needs to know its input came from a database row rather than a
 * Client Component's own React state.
 *
 * Living here, in customer-onboarding, not in features/commercial,
 * for the same reason ../domain/commercial-configuration-promotion.ts
 * does: a feature must not import another feature's internals
 * (docs/ARCHITECTURE.md §2-3), and customer-onboarding already depends
 * on Commercial's public contract, never the reverse.
 */

type MugParameters = { minimumUnits: number } | { designationMinimums: { designationRowId: string; minimumUnits: number | null }[] }

/** designationMinimums in pricing_rule_parameters was written index-aligned with rates[] at promotion time (both iterate the same original onboarding designationRows/mug.designationMinimums pair); re-associating by index here, not by the now-irrelevant original row id, is exactly as reliable. */
function mugFromParameters(mug: MugParameters | undefined, designationRows: DesignationRow[]): MugOverlay {
  if (!mug) return { enabled: false }
  if ("designationMinimums" in mug) {
    return {
      enabled: true,
      minimumUnits: null,
      designationMinimums: designationRows.map((row, index) => ({
        designationRowId: row.id,
        minimumUnits: mug.designationMinimums[index]?.minimumUnits ?? null,
      })),
    }
  }
  return { enabled: true, minimumUnits: mug.minimumUnits, designationMinimums: [] }
}

function revenueRecognitionFromParameters(params: Record<string, unknown>): RevenueRecognition {
  const stored = params.revenueRecognition as
    | { method: "full_recognition" }
    | { method: "milestone_based"; milestones: { name: string; recognitionPercent: number | null; invoiceTimingCode: string | null }[] }
    | undefined
  if (!stored || stored.method === "full_recognition") return { method: "full_recognition" }
  const milestones: Milestone[] = stored.milestones.map((milestone) => ({
    id: newId(),
    name: milestone.name,
    recognitionPercent: milestone.recognitionPercent,
    invoiceTiming: milestone.invoiceTimingCode,
  }))
  return { method: "milestone_based", milestones }
}

/**
 * The exact inverse of `mapOnboardingComponentToCommercialComponentInsert`.
 * Never throws on a shape it does not recognize: an unexpected
 * `pricing_rule_parameters` shape (a future, differently-promoted
 * component this reconstruction was not written for) falls back to
 * "-"-shaped empty fields rather than crashing the whole page, matching
 * this codebase's own "do not fake, show the honest state" principle.
 */
function toDraftComponent(component: CommercialComponent): CommercialComponentDraft {
  const params = component.pricingRuleParameters as Record<string, unknown>
  const nature: CommercialNature =
    params.commercialNature === "recurring" || params.commercialNature === "non_recurring" || params.commercialNature === "on_demand"
      ? params.commercialNature
      : component.isRecurring
        ? "recurring"
        : "non_recurring"

  const invoiceTerms: InvoiceTerms = {
    invoiceFrequency: typeof params.invoiceFrequencyCode === "string" ? params.invoiceFrequencyCode : null,
    invoiceTiming: typeof params.invoiceTimingCode === "string" ? params.invoiceTimingCode : null,
  }

  const base = {
    id: component.id,
    description: typeof params.name === "string" ? params.name : "",
    invoiceTerms,
    effectiveFrom: component.effectiveFrom,
    effectiveTo: component.effectiveTo,
    notes: "",
  }

  if (component.pricingRuleKind === "linear") {
    const pricing = {
      pricingModel: "per_unit" as const,
      rate: typeof params.rate === "number" ? params.rate : null,
      pricingUnit: typeof params.pricingUnit === "string" ? params.pricingUnit : null,
    }
    if (nature === "non_recurring") {
      return { ...base, ...pricing, nature, revenueRecognition: revenueRecognitionFromParameters(params) }
    }
    return { ...base, ...pricing, nature, mug: mugFromParameters(params.mug as MugParameters | undefined, []) }
  }

  if (component.pricingRuleKind === "flat") {
    const pricing = { pricingModel: "flat_fee" as const, amount: typeof params.amount === "number" ? params.amount : null }
    if (nature === "non_recurring") {
      return { ...base, ...pricing, nature, revenueRecognition: revenueRecognitionFromParameters(params) }
    }
    return { ...base, ...pricing, nature }
  }

  if (component.pricingRuleKind === "volume" || component.pricingRuleKind === "graduated") {
    const tiers = Array.isArray(params.tiers) ? (params.tiers as { from: number | null; to: number | null; rate: number | null }[]) : []
    const slabMethod: SlabMethod =
      params.slabMethod === "progressive" || params.slabMethod === "whole_quantity"
        ? params.slabMethod
        : component.pricingRuleKind === "graduated"
          ? "progressive"
          : "whole_quantity"
    const slabRows: SlabRow[] = tiers.map((tier) => ({ id: newId(), from: tier.from, to: tier.to, rate: tier.rate }))
    const pricing = {
      pricingModel: "slab" as const,
      pricingUnit: typeof params.pricingUnit === "string" ? params.pricingUnit : null,
      slabMethod,
      slabRows,
    }
    if (nature === "non_recurring") {
      return { ...base, ...pricing, nature, revenueRecognition: revenueRecognitionFromParameters(params) }
    }
    return { ...base, ...pricing, nature, mug: mugFromParameters(params.mug as MugParameters | undefined, []) }
  }

  // dimension (Designation Based)
  const rates = Array.isArray(params.rates) ? (params.rates as { designation: string; rate: number | null; per: string | null }[]) : []
  const designationRows: DesignationRow[] = rates.map((rate) => ({ id: newId(), designation: rate.designation, rate: rate.rate, per: rate.per }))
  const pricing = { pricingModel: "designation_based" as const, designationRows }
  if (nature === "non_recurring") {
    return { ...base, ...pricing, nature, revenueRecognition: revenueRecognitionFromParameters(params) }
  }
  return { ...base, ...pricing, nature, mug: mugFromParameters(params.mug as MugParameters | undefined, designationRows) }
}

/**
 * A component's own frozen FX snapshot must render historically, never
 * the current Reference Master rate (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md,
 * FX snapshot principle; task correction §25: "do not regress this
 * architecture"). This overrides only the one matching `currency` list
 * entry's `inrConversionRate` with the component's own frozen
 * `fxSnapshotRate`, leaving every other governed value (unit labels,
 * invoice frequency/timing labels) reading from the real, current
 * snapshot as normal. If the live snapshot has no entry at all for this
 * currency (deactivated or never configured since), one is added rather
 * than silently falling back to a missing rate, since the frozen value
 * is a fact about this specific historical component, independent of
 * Settings' current catalogue.
 */
function snapshotWithFrozenFxRate(snapshot: ReferenceMasterSnapshot, currencyCode: string, frozenRate: number | null): ReferenceMasterSnapshot {
  if (currencyCode === "INR" || frozenRate === null) return snapshot
  const exists = snapshot.currency.some((option) => option.value === currencyCode)
  const currency = exists
    ? snapshot.currency.map((option) => (option.value === currencyCode ? { ...option, inrConversionRate: frozenRate } : option))
    : [...snapshot.currency, { value: currencyCode, label: currencyCode, active: true, inrConversionRate: frozenRate }]
  return { ...snapshot, currency }
}

/** The one entry point the Customer Commercials view needs: a persisted Component's table cells, its frozen FX rate honored, its Nature exposed for section grouping. */
function persistedComponentTableCells(
  component: CommercialComponent,
  snapshot: ReferenceMasterSnapshot
): { nature: CommercialNature; cells: ComponentTableCells } {
  const draft = toDraftComponent(component)
  const frozenSnapshot = snapshotWithFrozenFxRate(snapshot, component.transactionCurrency, component.fxSnapshotRate)
  return { nature: draft.nature, cells: componentTableCells(frozenSnapshot, draft, component.transactionCurrency) }
}

export { toDraftComponent, snapshotWithFrozenFxRate, persistedComponentTableCells }
