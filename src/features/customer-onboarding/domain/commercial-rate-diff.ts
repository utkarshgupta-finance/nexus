import type {
  CommercialRateDraft,
  CommercialComponentDraft,
  SlabRow,
  DesignationRow,
  Milestone,
  MugOverlay,
  InvoiceTerms,
} from "./commercial-rate"

/**
 * Commercial Current vs Proposed diff (task Phase G): a Finance-friendly,
 * component-level comparison between the currently active Commercial Rate
 * and a draft/submitted Commercial Configuration Version, built for the
 * Commercial Version review screen. Deliberately NOT a generic JSON diff:
 * every comparison here is a real business field (Rate, MUG, Invoice
 * Cycle, Slab bands, Designation rows, Milestones), matched by the same
 * stable keys a Finance reviewer would recognize (component id, slab
 * band position, designation name, milestone name), never a structural
 * key-by-key object walk.
 *
 * Both sides are the same `CommercialRateDraft` shape used throughout
 * Onboarding and Commercial Version drafting
 * (`src/features/customer-onboarding/domain/commercial-rate.ts`): the
 * "current" side is reconstructed from the active Commercial Components
 * via `toDraftComponent` (`./commercial-configuration-view.ts`, the exact
 * inverse of the promotion mapper, already used to seed a new version's
 * draft), so this diff never invents a second component representation.
 */

type DiffRowStatus = "unchanged" | "changed" | "added" | "removed"

type SlabRowDiff = {
  status: DiffRowStatus
  from: number | null
  to: number | null
  currentRate: number | null
  proposedRate: number | null
}

type DesignationRowDiff = {
  status: DiffRowStatus
  designation: string
  currentRate: number | null
  proposedRate: number | null
  currentPer: string | null
  proposedPer: string | null
  currentMug: number | null
  proposedMug: number | null
}

type MilestoneDiff = {
  status: DiffRowStatus
  name: string
  currentPercent: number | null
  proposedPercent: number | null
  currentInvoiceTiming: string | null
  proposedInvoiceTiming: string | null
}

type ComponentDiff = {
  componentId: string
  status: DiffRowStatus
  description: string
  current: CommercialComponentDraft | null
  proposed: CommercialComponentDraft | null
  /** Only set for a single-rate model (Per Unit rate, Flat Fee amount) when both sides have a positive current rate to compute a percentage against. */
  ratePercentChange: number | null
  mugChanged: boolean
  currentMug: number | null
  proposedMug: number | null
  invoiceCycleChanged: boolean
  effectiveDateChanged: boolean
  slabRowDiffs: SlabRowDiff[]
  designationRowDiffs: DesignationRowDiff[]
  milestoneDiffs: MilestoneDiff[]
}

type CommercialRateDiff = {
  billingCurrencyChanged: boolean
  currentBillingCurrency: string | null
  proposedBillingCurrency: string | null
  components: ComponentDiff[]
}

function invoiceTermsEqual(a: InvoiceTerms, b: InvoiceTerms): boolean {
  return a.invoiceFrequency === b.invoiceFrequency && a.invoiceTiming === b.invoiceTiming
}

function mugMinimumUnits(mug: MugOverlay | undefined): number | null {
  return mug && mug.enabled ? mug.minimumUnits : null
}

/** `mug` only exists on the Recurring/On-Demand pricing-model variants that carry one (never Flat Fee, never Non-Recurring): the `"mug" in component` guard, not `nature`, is what TypeScript needs to narrow it. */
function componentMug(component: CommercialComponentDraft): MugOverlay | undefined {
  return "mug" in component ? component.mug : undefined
}

function componentMugMinimumUnits(component: CommercialComponentDraft): number | null {
  return mugMinimumUnits(componentMug(component))
}

function componentSingleRate(component: CommercialComponentDraft): number | null {
  if (component.pricingModel === "per_unit") return component.rate
  if (component.pricingModel === "flat_fee") return component.amount
  return null
}

function diffSlabRows(current: SlabRow[], proposed: SlabRow[]): SlabRowDiff[] {
  const length = Math.max(current.length, proposed.length)
  const diffs: SlabRowDiff[] = []
  for (let index = 0; index < length; index += 1) {
    const currentRow = current[index] ?? null
    const proposedRow = proposed[index] ?? null
    if (currentRow && proposedRow) {
      const changed = currentRow.from !== proposedRow.from || currentRow.to !== proposedRow.to || currentRow.rate !== proposedRow.rate
      diffs.push({
        status: changed ? "changed" : "unchanged",
        from: proposedRow.from,
        to: proposedRow.to,
        currentRate: currentRow.rate,
        proposedRate: proposedRow.rate,
      })
    } else if (currentRow && !proposedRow) {
      diffs.push({ status: "removed", from: currentRow.from, to: currentRow.to, currentRate: currentRow.rate, proposedRate: null })
    } else if (proposedRow) {
      diffs.push({ status: "added", from: proposedRow.from, to: proposedRow.to, currentRate: null, proposedRate: proposedRow.rate })
    }
  }
  return diffs
}

function designationMugFor(mug: MugOverlay | undefined, designationRowId: string): number | null {
  if (!mug || !mug.enabled) return null
  return mug.designationMinimums.find((row) => row.designationRowId === designationRowId)?.minimumUnits ?? null
}

function diffDesignationRows(
  current: DesignationRow[],
  currentMug: MugOverlay | undefined,
  proposed: DesignationRow[],
  proposedMug: MugOverlay | undefined
): DesignationRowDiff[] {
  const names = new Set([...current.map((row) => row.designation), ...proposed.map((row) => row.designation)])
  const diffs: DesignationRowDiff[] = []
  for (const name of names) {
    const currentRow = current.find((row) => row.designation === name) ?? null
    const proposedRow = proposed.find((row) => row.designation === name) ?? null
    const currentMugValue = currentRow ? designationMugFor(currentMug, currentRow.id) : null
    const proposedMugValue = proposedRow ? designationMugFor(proposedMug, proposedRow.id) : null
    if (currentRow && proposedRow) {
      const changed = currentRow.rate !== proposedRow.rate || currentRow.per !== proposedRow.per || currentMugValue !== proposedMugValue
      diffs.push({
        status: changed ? "changed" : "unchanged",
        designation: name,
        currentRate: currentRow.rate,
        proposedRate: proposedRow.rate,
        currentPer: currentRow.per,
        proposedPer: proposedRow.per,
        currentMug: currentMugValue,
        proposedMug: proposedMugValue,
      })
    } else if (currentRow) {
      diffs.push({
        status: "removed",
        designation: name,
        currentRate: currentRow.rate,
        proposedRate: null,
        currentPer: currentRow.per,
        proposedPer: null,
        currentMug: currentMugValue,
        proposedMug: null,
      })
    } else if (proposedRow) {
      diffs.push({
        status: "added",
        designation: name,
        currentRate: null,
        proposedRate: proposedRow.rate,
        currentPer: null,
        proposedPer: proposedRow.per,
        currentMug: null,
        proposedMug: proposedMugValue,
      })
    }
  }
  return diffs
}

function diffMilestones(current: Milestone[], proposed: Milestone[]): MilestoneDiff[] {
  const names = new Set([...current.map((milestone) => milestone.name), ...proposed.map((milestone) => milestone.name)])
  const diffs: MilestoneDiff[] = []
  for (const name of names) {
    const currentMilestone = current.find((milestone) => milestone.name === name) ?? null
    const proposedMilestone = proposed.find((milestone) => milestone.name === name) ?? null
    if (currentMilestone && proposedMilestone) {
      const changed =
        currentMilestone.recognitionPercent !== proposedMilestone.recognitionPercent ||
        currentMilestone.invoiceTiming !== proposedMilestone.invoiceTiming
      diffs.push({
        status: changed ? "changed" : "unchanged",
        name,
        currentPercent: currentMilestone.recognitionPercent,
        proposedPercent: proposedMilestone.recognitionPercent,
        currentInvoiceTiming: currentMilestone.invoiceTiming,
        proposedInvoiceTiming: proposedMilestone.invoiceTiming,
      })
    } else if (currentMilestone) {
      diffs.push({
        status: "removed",
        name,
        currentPercent: currentMilestone.recognitionPercent,
        proposedPercent: null,
        currentInvoiceTiming: currentMilestone.invoiceTiming,
        proposedInvoiceTiming: null,
      })
    } else if (proposedMilestone) {
      diffs.push({
        status: "added",
        name,
        currentPercent: null,
        proposedPercent: proposedMilestone.recognitionPercent,
        currentInvoiceTiming: null,
        proposedInvoiceTiming: proposedMilestone.invoiceTiming,
      })
    }
  }
  return diffs
}

function diffComponentPair(componentId: string, current: CommercialComponentDraft | null, proposed: CommercialComponentDraft | null): ComponentDiff {
  const description = proposed?.description ?? current?.description ?? ""

  if (!current || !proposed) {
    return {
      componentId,
      status: current ? "removed" : "added",
      description,
      current,
      proposed,
      ratePercentChange: null,
      mugChanged: false,
      currentMug: current ? componentMugMinimumUnits(current) : null,
      proposedMug: proposed ? componentMugMinimumUnits(proposed) : null,
      invoiceCycleChanged: false,
      effectiveDateChanged: false,
      slabRowDiffs: [],
      designationRowDiffs: [],
      milestoneDiffs: [],
    }
  }

  const samePricingModel = current.pricingModel === proposed.pricingModel
  const currentRate = componentSingleRate(current)
  const proposedRate = componentSingleRate(proposed)
  const ratePercentChange =
    samePricingModel && currentRate !== null && proposedRate !== null && currentRate !== 0 ? ((proposedRate - currentRate) / Math.abs(currentRate)) * 100 : null

  const currentMug = componentMugMinimumUnits(current)
  const proposedMug = componentMugMinimumUnits(proposed)

  const slabRowDiffs =
    samePricingModel && current.pricingModel === "slab" && proposed.pricingModel === "slab"
      ? diffSlabRows(current.slabRows, proposed.slabRows)
      : []
  const designationRowDiffs =
    samePricingModel && current.pricingModel === "designation_based" && proposed.pricingModel === "designation_based"
      ? diffDesignationRows(
          current.designationRows,
          componentMug(current),
          proposed.designationRows,
          componentMug(proposed)
        )
      : []
  const milestoneDiffs =
    current.nature === "non_recurring" &&
    proposed.nature === "non_recurring" &&
    current.revenueRecognition.method === "milestone_based" &&
    proposed.revenueRecognition.method === "milestone_based"
      ? diffMilestones(current.revenueRecognition.milestones, proposed.revenueRecognition.milestones)
      : []

  const invoiceCycleChanged = !invoiceTermsEqual(current.invoiceTerms, proposed.invoiceTerms)
  const effectiveDateChanged = current.effectiveFrom !== proposed.effectiveFrom || current.effectiveTo !== proposed.effectiveTo

  const nonRecurringRecognitionChanged =
    current.nature === "non_recurring" &&
    proposed.nature === "non_recurring" &&
    (current.revenueRecognition.method !== proposed.revenueRecognition.method || milestoneDiffs.some((diff) => diff.status !== "unchanged"))

  const hasChange =
    !samePricingModel ||
    current.description !== proposed.description ||
    currentRate !== proposedRate ||
    currentMug !== proposedMug ||
    invoiceCycleChanged ||
    effectiveDateChanged ||
    slabRowDiffs.some((diff) => diff.status !== "unchanged") ||
    designationRowDiffs.some((diff) => diff.status !== "unchanged") ||
    nonRecurringRecognitionChanged

  return {
    componentId,
    status: hasChange ? "changed" : "unchanged",
    description,
    current,
    proposed,
    ratePercentChange,
    mugChanged: currentMug !== proposedMug,
    currentMug,
    proposedMug,
    invoiceCycleChanged,
    effectiveDateChanged,
    slabRowDiffs,
    designationRowDiffs,
    milestoneDiffs,
  }
}

const STATUS_ORDER: Record<DiffRowStatus, number> = { changed: 0, added: 1, removed: 2, unchanged: 3 }

/** Pairs components by id (the persisted `commercial_components.id`, preserved by `toDraftComponent`), classifies each, and sorts changed/added/removed before unchanged so the reviewer never has to hunt for what matters. */
function diffCommercialRate(current: CommercialRateDraft, proposed: CommercialRateDraft): CommercialRateDiff {
  const componentIds = new Set([...current.components.map((component) => component.id), ...proposed.components.map((component) => component.id)])
  const components = Array.from(componentIds)
    .map((id) => {
      const currentComponent = current.components.find((component) => component.id === id) ?? null
      const proposedComponent = proposed.components.find((component) => component.id === id) ?? null
      return diffComponentPair(id, currentComponent, proposedComponent)
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

  return {
    billingCurrencyChanged: current.billingCurrency !== proposed.billingCurrency,
    currentBillingCurrency: current.billingCurrency,
    proposedBillingCurrency: proposed.billingCurrency,
    components,
  }
}

export { diffCommercialRate }
export type { DiffRowStatus, SlabRowDiff, DesignationRowDiff, MilestoneDiff, ComponentDiff, CommercialRateDiff }
