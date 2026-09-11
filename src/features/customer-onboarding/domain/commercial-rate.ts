import type { PricingRuleKind } from "@/features/commercial"

/**
 * Onboarding Commercial Rate draft domain (task spec: Customer Onboarding
 * Commercial Rate V1).
 *
 * This captures "what have we commercially agreed to charge this customer,
 * on what basis, and under what billing/payment terms," nothing more: no
 * usage calculation, invoicing, collections, revenue recognition, or actual
 * billing happens anywhere in this module. It is a DRAFT capture layer, not
 * a live write path into Commercial Configuration: exactly like Customer
 * Details, Tax & Registration, and Commercial Documents before it, this
 * stage's data lives only in the onboarding case's own revision data until
 * a real approved-case -> Commercial Configuration promotion path exists
 * (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22 documents the mapping and the
 * exact gaps that promotion will need to close).
 *
 * Vocabulary is deliberately reused from the locked Commercial domain
 * (src/features/commercial/domain/types.ts) wherever the concept already
 * exists there: `pricingRuleKind` (via `toPricingRuleKind` below),
 * `transactionCurrency`, `effectiveFrom`/`effectiveTo`. Where this stage
 * needs a value the real domain does not yet support, the gap is called
 * out explicitly in a comment at the exact point of divergence, never
 * silently forced into the existing field. See docs for the full gap list.
 */

// =============================================================================
// Commercial Nature, Pricing Model / Pricing Type
// =============================================================================

/**
 * A "controlled business option" (docs §22): each value drives real UI and
 * validation branching below, so it is not ordinary inert reference data
 * even though it is Reference Master governed (`commercial_nature`).
 */
type CommercialNature = "recurring" | "non_recurring" | "on_demand"

/** Recurring's four supported calculation models (task spec §5). */
type RecurringPricingModel = "per_unit" | "flat_fee" | "slab" | "designation_based"

/** On-Demand's two supported calculation models (task spec §14). */
type OnDemandPricingType = "per_unit" | "fixed_fee"

/**
 * Maps this stage's plain-English pricing vocabulary onto the real, locked
 * `PricingRuleKind` (task spec §25: "map onboarding concepts to existing
 * domain language where appropriate"). No gap here: every value below is
 * already one of the five locked kinds.
 *
 * Slab maps to `"volume"`, deliberately not `"graduated"`: graduated is
 * progressive/cumulative tiered pricing (each unit within a bracket priced
 * at that bracket's own rate, summed); this stage's Slab is whole-quantity
 * pricing (the single tier reached by the total quantity prices every
 * unit), which is what the locked domain doc names "volume (all-units)"
 * (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §6). Labeling Slab as `graduated`
 * would be a wrong signal to a future reader who assumes progressive
 * calculation. See docs §22 for the one real gap this mapping has: the
 * `commercial_components` table's shape-check CHECK constraint currently
 * only allows a bare `rate` key under `pricing_rule_kind = 'volume'`
 * (identical to `linear`), not the `tiers` array Slab needs; promoting a
 * Slab draft into a real Commercial Component needs a follow-up migration
 * first.
 */
function toPricingRuleKind(model: RecurringPricingModel | OnDemandPricingType): PricingRuleKind {
  switch (model) {
    case "per_unit":
      return "linear"
    case "flat_fee":
    case "fixed_fee":
      return "flat"
    case "slab":
      return "volume"
    case "designation_based":
      return "dimension"
  }
}

// =============================================================================
// Billing terms (per component/row, task spec §16-18)
// =============================================================================

/**
 * `billingCycle`/`billingTiming` are Reference Master `billing_cycle`/
 * `billing_timing` values (freely configurable, docs §22), not TypeScript
 * enums: unlike the real, locked `BillingCadence`/`BillingTiming` (4 and 2
 * values respectively), this stage needs "One-Time" and "On-Demand" cycle
 * values and "On Completion"/"On Demand" timing values that the real
 * Commercial domain does not accept yet. Storing them as plain Reference
 * Master codes, resolved through ../../reference-data rather than a
 * TypeScript union, keeps that wider range honest without redeclaring the
 * real `BillingCadence`/`BillingTiming` types with extra members they do
 * not actually support.
 */
type PaymentTermsSelection = {
  /** Reference Master `payment_terms` value, e.g. "due_on_receipt", "days_30", "custom". */
  paymentTermsCode: string | null
  /** Required, positive integer, only when `paymentTermsCode === "custom"` (task spec §18). */
  customPaymentDays: number | null
}

type BillingTerms = {
  billingCycle: string | null
  billingTiming: string | null
  paymentTerms: PaymentTermsSelection
}

function emptyBillingTerms(): BillingTerms {
  return { billingCycle: null, billingTiming: null, paymentTerms: { paymentTermsCode: null, customPaymentDays: null } }
}

// =============================================================================
// MUG (Minimum Usage Guarantee), task spec §12
// =============================================================================

/**
 * MUG here is a monetary floor ("Final billable amount = MAX(calculated
 * pricing amount, MUG amount)"), never a quantity floor. This is a
 * deliberate naming note for docs, not a design choice made lightly: the
 * locked Commercial domain (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §8)
 * separates a minimum QUANTITY commitment (a floor on chargeable quantity,
 * applied before pricing, always monthly) from a minimum SPEND commitment
 * (a floor on the resulting money amount, applied after pricing, any
 * cadence). This task's "MUG" is unambiguously the second one, a spend
 * commitment scoped to exactly this one component (`memberComponentIds`
 * with a single entry, which the locked spend-commitment shape already
 * allows), even though the business name "Minimum Usage Guarantee" sounds
 * quantity-shaped. `frequency` reuses the `billing_cycle` Reference Master
 * list rather than a parallel list, matching spend commitment's own
 * `period: BillingCadence` field.
 */
type MugOverlay =
  | { enabled: false }
  | { enabled: true; amount: number | null; frequency: string | null }

function emptyMug(): MugOverlay {
  return { enabled: false }
}

// =============================================================================
// Slab rows (task spec §9-10) and Designation rows (task spec §11)
// =============================================================================

/**
 * Whole-quantity slab pricing: the row whose [from, to] range contains the
 * total quantity prices every unit at that row's rate. This is NOT
 * progressive/tiered pricing (see `toPricingRuleKind`'s header). `to: null`
 * means open-ended (task spec: "Last row may have blank/open-ended To
 * value").
 */
type SlabRow = { id: string; from: number | null; to: number | null; rate: number | null }

/** `per` defaults to the Pricing Unit "USER" (task spec §11: "For V1: Per should default to User"). */
type DesignationRow = { id: string; designation: string; rate: number | null; per: string | null }

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

function createSlabRow(): SlabRow {
  return { id: newId(), from: null, to: null, rate: null }
}

function createDesignationRow(): DesignationRow {
  return { id: newId(), designation: "", rate: null, per: "USER" }
}

// =============================================================================
// Commercial Component draft (task spec §6, 8, 9, 11, 13, 14)
// =============================================================================

type CommercialComponentBase = {
  id: string
  /** "Component / Description". Free text, matching Commercial Scope's own precedent. */
  description: string
  billingTerms: BillingTerms
  notes: string
}

/**
 * Effective dating applies to every ongoing (recurring/on-demand) component,
 * matching the real Commercial Component's own effectiveFrom/effectiveTo
 * (docs §17). Non-Recurring deliberately does NOT get this pair: task spec
 * §13 lists exactly one date field for it, "Effective / Charge Date"
 * (`chargeDate` below), not a separate from/to range on top of it.
 */
type EffectiveDated = {
  effectiveFrom: string | null
  effectiveTo: string | null
}

type RecurringPerUnitComponent = CommercialComponentBase &
  EffectiveDated & {
    nature: "recurring"
    pricingModel: "per_unit"
    rate: number | null
    /** Reference Master `pricing_unit` value. */
    pricingUnit: string | null
    mug: MugOverlay
  }

type RecurringFlatFeeComponent = CommercialComponentBase &
  EffectiveDated & {
    nature: "recurring"
    pricingModel: "flat_fee"
    recurringAmount: number | null
    mug: MugOverlay
  }

type RecurringSlabComponent = CommercialComponentBase &
  EffectiveDated & {
    nature: "recurring"
    pricingModel: "slab"
    pricingUnit: string | null
    slabRows: SlabRow[]
    mug: MugOverlay
  }

type RecurringDesignationComponent = CommercialComponentBase &
  EffectiveDated & {
    nature: "recurring"
    pricingModel: "designation_based"
    designationRows: DesignationRow[]
    mug: MugOverlay
  }

/**
 * Distinct from a recurring Flat Fee: Non-Recurring is a one-time charge
 * (task spec §8/§13's explicit business rule: "Flat Fee means RECURRING
 * fixed commercial... Do NOT use Flat Fee for one-time/NON-RECURRING
 * charges"). No pricing model, no MUG (a one-time charge has nothing to
 * guarantee a minimum of); `billingTerms.billingCycle` is always the fixed
 * "one_time" Reference Master value, never user-chosen.
 */
type NonRecurringComponent = CommercialComponentBase & {
  nature: "non_recurring"
  amount: number | null
  /** "Effective / Charge Date": the one date field this shape has (see `EffectiveDated`'s header for why it has no separate from/to pair). */
  chargeDate: string | null
}

type OnDemandPerUnitComponent = CommercialComponentBase &
  EffectiveDated & {
    nature: "on_demand"
    pricingType: "per_unit"
    rate: number | null
    pricingUnit: string | null
    mug: MugOverlay
  }

type OnDemandFixedFeeComponent = CommercialComponentBase &
  EffectiveDated & {
    nature: "on_demand"
    pricingType: "fixed_fee"
    amount: number | null
    mug: MugOverlay
  }

type CommercialComponentDraft =
  | RecurringPerUnitComponent
  | RecurringFlatFeeComponent
  | RecurringSlabComponent
  | RecurringDesignationComponent
  | NonRecurringComponent
  | OnDemandPerUnitComponent
  | OnDemandFixedFeeComponent

function createComponent(nature: "recurring", model: "per_unit"): RecurringPerUnitComponent
function createComponent(nature: "recurring", model: "flat_fee"): RecurringFlatFeeComponent
function createComponent(nature: "recurring", model: "slab"): RecurringSlabComponent
function createComponent(nature: "recurring", model: "designation_based"): RecurringDesignationComponent
/** Fallback for a dynamically-chosen model (e.g. a Select's current value), where the literal is not known statically. */
function createComponent(
  nature: "recurring",
  model: RecurringPricingModel
): RecurringPerUnitComponent | RecurringFlatFeeComponent | RecurringSlabComponent | RecurringDesignationComponent
function createComponent(nature: "non_recurring"): NonRecurringComponent
function createComponent(nature: "on_demand", model: "per_unit"): OnDemandPerUnitComponent
function createComponent(nature: "on_demand", model: "fixed_fee"): OnDemandFixedFeeComponent
function createComponent(nature: "on_demand", model: OnDemandPricingType): OnDemandPerUnitComponent | OnDemandFixedFeeComponent
function createComponent(
  nature: CommercialNature,
  model?: RecurringPricingModel | OnDemandPricingType
): CommercialComponentDraft {
  const base: CommercialComponentBase = {
    id: newId(),
    description: "",
    billingTerms:
      nature === "non_recurring"
        ? { ...emptyBillingTerms(), billingCycle: "one_time" }
        : nature === "on_demand"
          ? { ...emptyBillingTerms(), billingCycle: "on_demand" }
          : emptyBillingTerms(),
    notes: "",
  }

  if (nature === "non_recurring") {
    return { ...base, nature, amount: null, chargeDate: null }
  }

  const effectiveDated: EffectiveDated = { effectiveFrom: null, effectiveTo: null }

  if (nature === "on_demand") {
    const pricingType = (model as OnDemandPricingType) ?? "per_unit"
    if (pricingType === "fixed_fee") {
      return { ...base, ...effectiveDated, nature, pricingType, amount: null, mug: emptyMug() }
    }
    return { ...base, ...effectiveDated, nature, pricingType: "per_unit", rate: null, pricingUnit: null, mug: emptyMug() }
  }

  const pricingModel = (model as RecurringPricingModel) ?? "per_unit"
  if (pricingModel === "flat_fee") {
    return { ...base, ...effectiveDated, nature: "recurring", pricingModel, recurringAmount: null, mug: emptyMug() }
  }
  if (pricingModel === "slab") {
    return { ...base, ...effectiveDated, nature: "recurring", pricingModel, pricingUnit: null, slabRows: [createSlabRow()], mug: emptyMug() }
  }
  if (pricingModel === "designation_based") {
    return { ...base, ...effectiveDated, nature: "recurring", pricingModel, designationRows: [createDesignationRow()], mug: emptyMug() }
  }
  return { ...base, ...effectiveDated, nature: "recurring", pricingModel: "per_unit", rate: null, pricingUnit: null, mug: emptyMug() }
}

// =============================================================================
// Commercial Rate draft (header + components), task spec §3, §28, §30
// =============================================================================

type CommercialRateDraft = {
  /** "Commercial Scope / Package Name", free text, never restricted to a fixed module list (task spec §3). */
  commercialScope: string
  /** Reference Master `currency` value; applies to every component (task spec §28: not repeated per row in V1). */
  billingCurrency: string | null
  components: CommercialComponentDraft[]
}

function createEmptyCommercialRateDraft(): CommercialRateDraft {
  return { commercialScope: "", billingCurrency: null, components: [] }
}

// =============================================================================
// Validation (task spec §29-30): Draft stays permissive, Stage Complete does not
// =============================================================================

function isPositive(value: number | null): boolean {
  return value !== null && Number.isFinite(value) && value > 0
}

function isBillingTermsComplete(terms: BillingTerms): boolean {
  if (!terms.billingCycle || !terms.billingTiming || !terms.paymentTerms.paymentTermsCode) return false
  if (terms.paymentTerms.paymentTermsCode === "custom") {
    return terms.paymentTerms.customPaymentDays !== null && terms.paymentTerms.customPaymentDays > 0
  }
  return true
}

function isMugComplete(mug: MugOverlay): boolean {
  if (!mug.enabled) return true
  return isPositive(mug.amount) && mug.frequency !== null
}

/**
 * A row is "obviously overlapping" the previous one when its own `from` is
 * not strictly after the previous row's `to` (task spec §10: "no obviously
 * overlapping slab ranges... do not over-engineer advanced pricing
 * validation yet"). Rows are compared in the order given, not re-sorted:
 * V1 does not second-guess the order the user entered them in.
 */
function areSlabRowsValid(rows: SlabRow[]): boolean {
  if (rows.length === 0) return false
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!isPositive(row.rate)) return false
    if (row.from === null) return false
    if (row.to !== null && row.from > row.to) return false
    const previous = rows[index - 1]
    if (previous && previous.to !== null && row.from <= previous.to) return false
  }
  return true
}

function areDesignationRowsValid(rows: DesignationRow[]): boolean {
  if (rows.length === 0) return false
  return rows.every((row) => row.designation.trim().length > 0 && isPositive(row.rate) && row.per !== null)
}

/**
 * Per-component required fields, matching task spec §29's worked examples
 * exactly: Recurring+Per Unit needs Component/Rate/Per/Billing Cycle/
 * Billing Timing/Payment Terms; Recurring+Slab needs Component/Per/at least
 * one valid slab/billing terms; Designation Based needs Component/at least
 * one designation row/billing terms; Non-Recurring needs Description/
 * Amount/Billing Timing/Payment Terms; On-Demand+Per Unit needs Component/
 * Rate/Per/billing terms. Notes are never required; MUG fields are required
 * only once MUG is enabled (`isMugComplete`); Custom Payment Days is
 * required only when Payment Terms is Custom (`isBillingTermsComplete`).
 */
function isComponentComplete(component: CommercialComponentDraft): boolean {
  if (component.description.trim().length === 0) return false

  if (component.nature === "non_recurring") {
    return isPositive(component.amount) && isBillingTermsComplete(component.billingTerms)
  }

  if (!isBillingTermsComplete(component.billingTerms)) return false

  if (component.nature === "on_demand" && component.pricingType === "fixed_fee") {
    return isPositive(component.amount) && isMugComplete(component.mug)
  }
  if (component.nature === "on_demand") {
    return isPositive(component.rate) && component.pricingUnit !== null && isMugComplete(component.mug)
  }

  // Recurring.
  if (component.pricingModel === "flat_fee") {
    return isPositive(component.recurringAmount) && isMugComplete(component.mug)
  }
  if (component.pricingModel === "slab") {
    return component.pricingUnit !== null && areSlabRowsValid(component.slabRows) && isMugComplete(component.mug)
  }
  if (component.pricingModel === "designation_based") {
    return areDesignationRowsValid(component.designationRows) && isMugComplete(component.mug)
  }
  return isPositive(component.rate) && component.pricingUnit !== null && isMugComplete(component.mug)
}

/**
 * Stage Complete requires Billing Currency, Commercial Scope, at least one
 * component, and every component individually complete (task spec §30).
 * Commercial Scope is treated as required: it is the one human-readable
 * summary of what was commercially agreed, and a priced customer with a
 * blank scope would be an incomplete record for whoever reviews this later.
 * This is a judgment call flagged for review, not an existing-architecture
 * answer (task spec §30 invited exactly this kind of reported choice).
 */
function isCommercialRateDraftComplete(draft: CommercialRateDraft): boolean {
  if (!draft.billingCurrency) return false
  if (draft.commercialScope.trim().length === 0) return false
  if (draft.components.length === 0) return false
  return draft.components.every(isComponentComplete)
}

/** Whether any field in the draft has been touched, for the Not Started / Attention distinction (see ./stage-status.ts). */
function isCommercialRateDraftStarted(draft: CommercialRateDraft): boolean {
  return draft.billingCurrency !== null || draft.commercialScope.trim().length > 0 || draft.components.length > 0
}

export {
  toPricingRuleKind,
  emptyBillingTerms,
  emptyMug,
  newId,
  createSlabRow,
  createDesignationRow,
  createComponent,
  createEmptyCommercialRateDraft,
  isPositive,
  isBillingTermsComplete,
  isMugComplete,
  areSlabRowsValid,
  areDesignationRowsValid,
  isComponentComplete,
  isCommercialRateDraftComplete,
  isCommercialRateDraftStarted,
}
export type {
  CommercialNature,
  RecurringPricingModel,
  OnDemandPricingType,
  PaymentTermsSelection,
  BillingTerms,
  MugOverlay,
  SlabRow,
  DesignationRow,
  CommercialComponentBase,
  RecurringPerUnitComponent,
  RecurringFlatFeeComponent,
  RecurringSlabComponent,
  RecurringDesignationComponent,
  NonRecurringComponent,
  OnDemandPerUnitComponent,
  OnDemandFixedFeeComponent,
  CommercialComponentDraft,
  CommercialRateDraft,
}
