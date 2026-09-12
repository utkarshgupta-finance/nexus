import type { PricingRuleKind } from "@/features/commercial"

/**
 * Onboarding Commercial Rate draft domain (Customer Onboarding Commercial
 * Rate V1, corrected business model).
 *
 * This captures "what have we commercially agreed to charge this customer,
 * on what basis, and under what invoice cycle," nothing more: no usage
 * calculation, invoicing, collections, revenue recognition, or actual
 * billing happens anywhere in this module. It is a DRAFT capture layer, not
 * a live write path into Commercial Configuration: exactly like Customer
 * Details, Tax & Registration, and Commercial Documents before it, this
 * stage's data lives only in the onboarding case's own revision data until
 * a real approved-case -> Commercial Configuration promotion path exists
 * (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22 documents the mapping and the
 * exact gaps that promotion will need to close).
 *
 * This file corrects an earlier, wrong reading of the business model. The
 * corrections that matter most for anyone reading this file fresh:
 *
 * - There is no "Commercial Scope / Package Name" concept. A customer's
 *   commercials are the sum of its individual Commercial Components; there
 *   is no separate customer-level package/scope field above them.
 * - Per Unit, Flat Fee, Slab, and Designation Based are ONE shared set of
 *   Pricing Models, available under every Commercial Nature (Recurring,
 *   Non-Recurring, On-Demand) alike. Nature no longer implies a different
 *   pricing engine; it only changes which model defaults in and a few
 *   nature-specific fields (see `defaultPricingModelFor`).
 * - MUG (Minimum Usage Guarantee) is a UNIT quantity floor, never money: it
 *   floors the billable quantity of whatever Pricing Unit the component
 *   already uses, always assessed monthly, and it never asks for a second
 *   unit selection or a frequency choice.
 * - A Recurring component's revenue is monthly, always, regardless of how
 *   often the customer is actually invoiced; Invoice Frequency and Invoice
 *   Timing describe the invoice cycle, not revenue recognition.
 * - Slab pricing has two distinct methods, Whole Quantity and Progressive,
 *   both real and selectable, not one implicit interpretation.
 * - Payment Terms is out of scope entirely; it belongs to a future
 *   Invoice/Collections configuration, not Commercial Rate.
 *
 * Vocabulary is deliberately reused from the locked Commercial domain
 * (src/features/commercial/domain/types.ts) wherever the concept already
 * exists there: `pricingRuleKind` (via `toPricingRuleKind` below). Where
 * this stage needs a value the real domain does not yet support, the gap
 * is called out explicitly at the exact point of divergence. See docs for
 * the full gap list.
 */

// =============================================================================
// Commercial Nature, Pricing Model, Slab Method
// =============================================================================

/**
 * A "controlled business option" (docs §22): drives real UI/validation
 * branching below (default Pricing Model, MUG applicability on Non-Recurring,
 * Revenue Recognition), so it is not ordinary inert reference data even
 * though it is Reference Master governed (`commercial_nature`).
 */
type CommercialNature = "recurring" | "non_recurring" | "on_demand"

/**
 * ONE shared set of Pricing Models across every Commercial Nature. Do not
 * build a separate pricing engine per nature; conditional UI may differ,
 * the calculation vocabulary does not.
 */
type PricingModel = "per_unit" | "flat_fee" | "slab" | "designation_based"

/**
 * Whole Quantity: the entire quantity is priced at the single band it falls
 * into. Progressive: each band is priced separately and summed (the real
 * domain's own "graduated" primitive, see `toPricingRuleKind`). These are
 * two distinct, equally real slab methods, not one method with a footnote.
 */
type SlabMethod = "whole_quantity" | "progressive"

/**
 * Recurring defaults to Per Unit; Non-Recurring and On-Demand both default
 * to Flat Fee (On-Demand deliberately mirrors Non-Recurring's default for
 * V1). The user may change the model after defaulting.
 */
function defaultPricingModelFor(nature: CommercialNature): PricingModel {
  return nature === "recurring" ? "per_unit" : "flat_fee"
}

/**
 * Maps this stage's Pricing Model onto the real, locked `PricingRuleKind`.
 * Slab is the one model whose real-domain mapping depends on a second
 * input, `slabMethod`: Whole Quantity maps to `"volume"` (the locked
 * domain's own "all-units" primitive), Progressive maps to `"graduated"`
 * (the locked domain's own progressive/cumulative-tiered primitive,
 * `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §6 and its scenario 1). Both
 * already exist in the locked domain; this stage does not invent either
 * one, it only chooses which of the two a Slab component means.
 */
function toPricingRuleKind(pricingModel: PricingModel, slabMethod?: SlabMethod | null): PricingRuleKind {
  switch (pricingModel) {
    case "per_unit":
      return "linear"
    case "flat_fee":
      return "flat"
    case "designation_based":
      return "dimension"
    case "slab":
      return slabMethod === "progressive" ? "graduated" : "volume"
  }
}

// =============================================================================
// Invoice terms (per component, corrected: no Payment Terms)
// =============================================================================

/**
 * Invoice Frequency (how often the customer is invoiced) and Invoice Timing
 * (Advance or Postpaid) describe the invoice cycle only. They never drive
 * revenue recognition: a Recurring component's revenue is monthly
 * regardless of these values (docs §22). Both are Reference Master
 * `invoice_frequency`/`invoice_timing` values (freely configurable), not
 * TypeScript enums, so Settings can extend them without a code change.
 * Payment Terms is deliberately absent: out of scope for Commercial Rate.
 */
type InvoiceTerms = {
  invoiceFrequency: string | null
  invoiceTiming: string | null
}

function emptyInvoiceTerms(): InvoiceTerms {
  return { invoiceFrequency: null, invoiceTiming: null }
}

/**
 * Invoice Frequency is required for Recurring and Non-Recurring (Non-
 * Recurring's own value is fixed to "one_time" automatically, never
 * user-chosen), and optional for On-Demand: an on-demand charge is billed
 * only when triggered, so a fixed cadence does not always apply. Invoice
 * Timing is always required.
 */
function isInvoiceTermsComplete(nature: CommercialNature, terms: InvoiceTerms): boolean {
  if (nature === "on_demand") return terms.invoiceTiming !== null
  return terms.invoiceFrequency !== null && terms.invoiceTiming !== null
}

// =============================================================================
// MUG (Minimum Usage Guarantee): a UNIT quantity floor, corrected from money
// =============================================================================

/**
 * MUG floors the billable quantity of whichever Pricing Unit the component
 * already uses (`revenue quantity = MAX(actual quantity, MUG units)`),
 * always monthly, never a second unit choice, never a frequency choice,
 * never money. Available only where a unit quantity logically exists (Per
 * Unit, Slab, Designation Based); Flat Fee has no unit basis at all, so it
 * never gets a `mug` field; Non-Recurring is a one-time charge with no
 * monthly cadence to floor against, so it never gets one either, regardless
 * of pricing model (see `PricingFieldsNoMug` below).
 */
type MugOverlay = { enabled: false } | { enabled: true; minimumUnits: number | null }

function emptyMug(): MugOverlay {
  return { enabled: false }
}

function isMugComplete(mug: MugOverlay): boolean {
  if (!mug.enabled) return true
  return isPositive(mug.minimumUnits)
}

// =============================================================================
// Slab rows and Designation rows
// =============================================================================

/** One band of a Slab component. `to: null` means open-ended (the last row). */
type SlabRow = { id: string; from: number | null; to: number | null; rate: number | null }

/** `per` defaults to the Pricing Unit "USER" ("Unit should normally be User"). */
type DesignationRow = { id: string; designation: string; rate: number | null; per: string | null }

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

/**
 * From defaults to a contiguous continuation of the previous row (task
 * correction: "the FIRST slab should default From = 1... new From = previous
 * slab To + 1"), never a blank field the user has to fill in by hand. If the
 * previous row is still open-ended (`to: null`), there is no well-defined
 * next From yet; the UI itself never allows adding a row in that state (see
 * `recalculateSlabFroms`'s own header), so this is only a defensive fallback.
 */
function createSlabRow(previousRow: SlabRow | null = null): SlabRow {
  return {
    id: newId(),
    from: previousRow ? (previousRow.to !== null ? previousRow.to + 1 : previousRow.from) : 1,
    to: null,
    rate: null,
  }
}

function createDesignationRow(): DesignationRow {
  return { id: newId(), designation: "", rate: null, per: "USER" }
}

/**
 * From is never a value the user edits directly (task correction: "prefer
 * keeping From values system-derived/readonly after the first row" - this
 * stage keeps every row's From system-derived, including the first, which is
 * always 1, since a slab always starts counting from the first unit). This
 * makes rows contiguous and gap/overlap-free by construction rather than by
 * validation after the fact: call this after any edit to a row's own To, or
 * after adding/removing a row, so every later row's From stays in sync with
 * whatever precedes it. A row whose own To is still null (open-ended) is
 * never followed by another row in the UI, so its own successor's From (if
 * any slipped through) is left unchanged rather than guessed.
 */
function recalculateSlabFroms(rows: SlabRow[]): SlabRow[] {
  return rows.map((row, index) => {
    if (index === 0) return row.from === 1 ? row : { ...row, from: 1 }
    const previous = rows[index - 1]
    if (previous.to === null || row.from === previous.to + 1) return row
    return { ...row, from: previous.to + 1 }
  })
}

/**
 * A row is "obviously overlapping" the previous one when its own `from` is
 * not strictly after the previous row's `to`. Applies identically to both
 * Slab Methods: Progressive bands are just as non-overlapping/contiguous as
 * Whole Quantity bands, the methods differ only in how the total is
 * calculated, never in row shape or validation. Rows are compared in the
 * order given, not re-sorted. In practice this can no longer happen once
 * rows have passed through `recalculateSlabFroms`, since From is no longer a
 * value a user can mistype; this check remains as a general-purpose,
 * UI-independent validator (for example, for data arriving from a future
 * promotion path that does not go through this exact editor).
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

// =============================================================================
// Non-Recurring revenue recognition (task correction §26-28)
// =============================================================================

type RevenueRecognitionMethod = "full_recognition" | "milestone_based"

type Milestone = { id: string; name: string; recognitionPercent: number | null }

function createMilestone(): Milestone {
  return { id: newId(), name: "", recognitionPercent: null }
}

type RevenueRecognition =
  | { method: "full_recognition" }
  | { method: "milestone_based"; milestones: Milestone[] }

function emptyRevenueRecognition(): RevenueRecognition {
  return { method: "full_recognition" }
}

/** Milestone percentages must total 100, within floating-point tolerance. */
function isRevenueRecognitionComplete(recognition: RevenueRecognition): boolean {
  if (recognition.method === "full_recognition") return true
  if (recognition.milestones.length === 0) return false
  const allNamed = recognition.milestones.every(
    (milestone) => milestone.name.trim().length > 0 && isPositive(milestone.recognitionPercent)
  )
  if (!allNamed) return false
  const total = recognition.milestones.reduce((sum, milestone) => sum + (milestone.recognitionPercent ?? 0), 0)
  return Math.abs(total - 100) < 0.001
}

// =============================================================================
// Commercial Component draft
// =============================================================================

type CommercialComponentBase = {
  id: string
  /** Free text component name, e.g. "SFA", "Implementation", "WhatsApp". Never restricted to a fixed product list. */
  description: string
  invoiceTerms: InvoiceTerms
  effectiveFrom: string | null
  effectiveTo: string | null
  notes: string
}

type PerUnitPricing = { pricingModel: "per_unit"; rate: number | null; pricingUnit: string | null }
type FlatFeePricing = { pricingModel: "flat_fee"; amount: number | null }
type SlabPricing = { pricingModel: "slab"; pricingUnit: string | null; slabMethod: SlabMethod; slabRows: SlabRow[] }
type DesignationPricing = { pricingModel: "designation_based"; designationRows: DesignationRow[] }

/** Non-Recurring: no unit basis to guarantee a minimum monthly quantity of (see MUG's own header). */
type PricingFieldsNoMug = PerUnitPricing | FlatFeePricing | SlabPricing | DesignationPricing

/** Recurring/On-Demand: MUG is offered wherever a unit quantity exists (never on Flat Fee). */
type PricingFieldsWithMug =
  | (PerUnitPricing & { mug: MugOverlay })
  | FlatFeePricing
  | (SlabPricing & { mug: MugOverlay })
  | (DesignationPricing & { mug: MugOverlay })

/**
 * Recurring and On-Demand share one shape: both are "ongoing" natures where
 * a MUG can meaningfully apply. They remain distinct business concepts
 * (task correction: "preserve Commercial Nature as distinct... because
 * downstream revenue/billing semantics may differ later"), only their V1
 * data shape happens to coincide.
 */
type OngoingComponent = CommercialComponentBase & PricingFieldsWithMug & { nature: "recurring" | "on_demand" }

/** Non-Recurring additionally carries its own Revenue Recognition Method, never a pricing model concern. */
type NonRecurringComponent = CommercialComponentBase &
  PricingFieldsNoMug & { nature: "non_recurring"; revenueRecognition: RevenueRecognition }

type CommercialComponentDraft = OngoingComponent | NonRecurringComponent

function createPricingFields(pricingModel: PricingModel): PricingFieldsNoMug {
  switch (pricingModel) {
    case "per_unit":
      return { pricingModel, rate: null, pricingUnit: null }
    case "flat_fee":
      return { pricingModel, amount: null }
    case "slab":
      return { pricingModel, pricingUnit: null, slabMethod: "whole_quantity", slabRows: [createSlabRow()] }
    case "designation_based":
      return { pricingModel, designationRows: [createDesignationRow()] }
  }
}

function createComponent(nature: "recurring" | "on_demand", pricingModel: "per_unit"): Extract<OngoingComponent, { pricingModel: "per_unit" }>
function createComponent(nature: "recurring" | "on_demand", pricingModel: "flat_fee"): Extract<OngoingComponent, { pricingModel: "flat_fee" }>
function createComponent(nature: "recurring" | "on_demand", pricingModel: "slab"): Extract<OngoingComponent, { pricingModel: "slab" }>
function createComponent(
  nature: "recurring" | "on_demand",
  pricingModel: "designation_based"
): Extract<OngoingComponent, { pricingModel: "designation_based" }>
function createComponent(nature: "non_recurring", pricingModel: "per_unit"): Extract<NonRecurringComponent, { pricingModel: "per_unit" }>
function createComponent(nature: "non_recurring", pricingModel: "flat_fee"): Extract<NonRecurringComponent, { pricingModel: "flat_fee" }>
function createComponent(nature: "non_recurring", pricingModel: "slab"): Extract<NonRecurringComponent, { pricingModel: "slab" }>
function createComponent(
  nature: "non_recurring",
  pricingModel: "designation_based"
): Extract<NonRecurringComponent, { pricingModel: "designation_based" }>
/** Fallback for a dynamically-chosen nature/model (e.g. a Select's current value), where the literal is not known statically. */
function createComponent(nature: CommercialNature, pricingModel?: PricingModel): CommercialComponentDraft
function createComponent(nature: CommercialNature, pricingModel?: PricingModel): CommercialComponentDraft {
  const model = pricingModel ?? defaultPricingModelFor(nature)
  const base: CommercialComponentBase = {
    id: newId(),
    description: "",
    invoiceTerms: nature === "non_recurring" ? { ...emptyInvoiceTerms(), invoiceFrequency: "one_time" } : emptyInvoiceTerms(),
    effectiveFrom: null,
    effectiveTo: null,
    notes: "",
  }
  const pricing = createPricingFields(model)

  if (nature === "non_recurring") {
    return { ...base, ...pricing, nature, revenueRecognition: emptyRevenueRecognition() } as CommercialComponentDraft
  }

  const withMug =
    pricing.pricingModel === "flat_fee" ? pricing : { ...pricing, mug: emptyMug() }
  return { ...base, ...withMug, nature } as CommercialComponentDraft
}

// =============================================================================
// MUG calculated value (task correction: "a calculated reference value...
// not a separately editable contractual field... do not fake the amount")
// =============================================================================

/**
 * The MUG contractual input stays a unit quantity; this derives a display-
 * only monetary reference from it, never a stored or independently editable
 * value. Per Unit: `MUG units x rate`. Slab: the applicable band(s) at the
 * MUG quantity, computed per the component's own Slab Method. Designation
 * Based: not calculable without inventing which designation's rate applies
 * to the MUG quantity, so this returns `null` rather than a guess. Flat Fee
 * and Non-Recurring never reach here at all (no `mug` field to begin with).
 */
function calculateMugValue(component: CommercialComponentDraft): number | null {
  if (!("mug" in component) || !component.mug.enabled) return null
  const quantity = component.mug.minimumUnits
  if (!isPositive(quantity)) return null

  if (component.pricingModel === "per_unit") {
    return component.rate !== null ? quantity * component.rate : null
  }
  if (component.pricingModel === "slab") {
    return calculateSlabAmountForQuantity(component.slabRows, component.slabMethod, quantity)
  }
  return null
}

/**
 * Whole Quantity: the entire quantity is priced at the single band it falls
 * into. Progressive: each band up to the quantity is priced separately and
 * summed. Worked example from the task correction, MUG = 150 against rows
 * 1-100 @100 and 101-250 @90: Whole Quantity = 150 x 90 = 13,500; Progressive
 * = (100 x 100) + (50 x 90) = 14,500.
 */
function calculateSlabAmountForQuantity(rows: SlabRow[], method: SlabMethod, quantity: number): number | null {
  if (rows.length === 0) return null

  if (method === "whole_quantity") {
    const band = rows.find((row) => row.from !== null && quantity >= row.from && (row.to === null || quantity <= row.to))
    if (!band || band.rate === null) return null
    return quantity * band.rate
  }

  let total = 0
  for (const row of rows) {
    if (row.from === null || row.rate === null) return null
    if (quantity < row.from) break
    const bandTop = row.to === null ? quantity : Math.min(row.to, quantity)
    const unitsInBand = bandTop - row.from + 1
    if (unitsInBand > 0) total += unitsInBand * row.rate
  }
  return total
}

// =============================================================================
// Commercial Rate draft (header + components)
// =============================================================================

type CommercialRateDraft = {
  /** Reference Master `currency` value. Customer-level for this Commercial Configuration; not repeated per component. */
  billingCurrency: string | null
  components: CommercialComponentDraft[]
}

function createEmptyCommercialRateDraft(): CommercialRateDraft {
  return { billingCurrency: null, components: [] }
}

// =============================================================================
// Validation: Draft stays permissive, Stage Complete does not
// =============================================================================

function isPositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0
}

/**
 * Per-component required fields. Description, Invoice Timing (and Invoice
 * Frequency unless On-Demand) are required for every component; MUG is
 * required only once enabled, and only ever offered on Recurring/On-Demand
 * (never Non-Recurring, never Flat Fee); milestone percentages must total
 * 100 only once Non-Recurring's Revenue Recognition Method is Milestone
 * Based. Notes are never required.
 */
function isComponentComplete(component: CommercialComponentDraft): boolean {
  if (component.description.trim().length === 0) return false
  if (!isInvoiceTermsComplete(component.nature, component.invoiceTerms)) return false
  if (component.nature === "non_recurring" && !isRevenueRecognitionComplete(component.revenueRecognition)) return false

  if (component.pricingModel === "per_unit") {
    if (!isPositive(component.rate) || component.pricingUnit === null) return false
    return component.nature === "non_recurring" ? true : isMugComplete(component.mug)
  }
  if (component.pricingModel === "flat_fee") {
    return isPositive(component.amount)
  }
  if (component.pricingModel === "slab") {
    if (component.pricingUnit === null || !areSlabRowsValid(component.slabRows)) return false
    return component.nature === "non_recurring" ? true : isMugComplete(component.mug)
  }
  // designation_based
  if (!areDesignationRowsValid(component.designationRows)) return false
  return component.nature === "non_recurring" ? true : isMugComplete(component.mug)
}

/**
 * Stage Complete requires Billing Currency, at least one component, and
 * every component individually complete. There is no Commercial Scope to
 * additionally require: it does not exist in the corrected model.
 */
function isCommercialRateDraftComplete(draft: CommercialRateDraft): boolean {
  if (!draft.billingCurrency) return false
  if (draft.components.length === 0) return false
  return draft.components.every(isComponentComplete)
}

/** Whether any field in the draft has been touched, for the Not Started / Attention distinction (see ./stage-status.ts). */
function isCommercialRateDraftStarted(draft: CommercialRateDraft): boolean {
  return draft.billingCurrency !== null || draft.components.length > 0
}

export {
  defaultPricingModelFor,
  toPricingRuleKind,
  emptyInvoiceTerms,
  isInvoiceTermsComplete,
  emptyMug,
  isMugComplete,
  newId,
  createSlabRow,
  recalculateSlabFroms,
  createDesignationRow,
  areSlabRowsValid,
  areDesignationRowsValid,
  createMilestone,
  emptyRevenueRecognition,
  isRevenueRecognitionComplete,
  createComponent,
  calculateMugValue,
  calculateSlabAmountForQuantity,
  createEmptyCommercialRateDraft,
  isPositive,
  isComponentComplete,
  isCommercialRateDraftComplete,
  isCommercialRateDraftStarted,
}
export type {
  CommercialNature,
  PricingModel,
  SlabMethod,
  InvoiceTerms,
  MugOverlay,
  SlabRow,
  DesignationRow,
  RevenueRecognitionMethod,
  Milestone,
  RevenueRecognition,
  CommercialComponentBase,
  OngoingComponent,
  NonRecurringComponent,
  CommercialComponentDraft,
  CommercialRateDraft,
}
