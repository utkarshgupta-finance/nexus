import { describe, expect, it } from "vitest"

import {
  areDesignationRowsValid,
  areSlabRowsValid,
  calculateMugValue,
  calculateSlabAmountForQuantity,
  createComponent,
  createDesignationRow,
  createEmptyCommercialRateDraft,
  createMilestone,
  createSlabRow,
  defaultPricingModelFor,
  isCommercialRateDraftComplete,
  isCommercialRateDraftStarted,
  isComponentComplete,
  isInvoiceTermsComplete,
  isMugComplete,
  isRevenueRecognitionComplete,
  recalculateSlabFroms,
  toPricingRuleKind,
} from "./commercial-rate"
import type { CommercialComponentDraft, CommercialRateDraft, InvoiceTerms, OngoingComponent } from "./commercial-rate"

const COMPLETE_TERMS: InvoiceTerms = { invoiceFrequency: "monthly", invoiceTiming: "advance" }

function withDescription<T extends CommercialComponentDraft>(component: T, description: string): T {
  return { ...component, description }
}

describe("defaultPricingModelFor", () => {
  it("Recurring defaults to Per Unit", () => {
    expect(defaultPricingModelFor("recurring")).toBe("per_unit")
  })
  it("Non-Recurring defaults to Flat Fee", () => {
    expect(defaultPricingModelFor("non_recurring")).toBe("flat_fee")
  })
  it("On-Demand mirrors Non-Recurring and defaults to Flat Fee", () => {
    expect(defaultPricingModelFor("on_demand")).toBe("flat_fee")
  })
})

describe("toPricingRuleKind", () => {
  it("maps Per Unit to linear", () => {
    expect(toPricingRuleKind("per_unit")).toBe("linear")
  })
  it("maps Flat Fee to flat", () => {
    expect(toPricingRuleKind("flat_fee")).toBe("flat")
  })
  it("maps Designation Based to dimension", () => {
    expect(toPricingRuleKind("designation_based")).toBe("dimension")
  })
  it("maps Whole Quantity Slab to volume", () => {
    expect(toPricingRuleKind("slab", "whole_quantity")).toBe("volume")
  })
  it("maps Progressive Slab to graduated, never volume", () => {
    expect(toPricingRuleKind("slab", "progressive")).toBe("graduated")
  })
})

describe("createComponent", () => {
  it("creates a Recurring Per Unit component with empty pricing fields and MUG disabled", () => {
    const component = createComponent("recurring", "per_unit")
    expect(component.nature).toBe("recurring")
    expect(component.pricingModel).toBe("per_unit")
    expect(component.rate).toBeNull()
    expect(component.pricingUnit).toBeNull()
    expect(component.mug).toEqual({ enabled: false })
    expect(component.invoiceTerms.invoiceFrequency).toBeNull()
  })

  it("creates a Recurring Flat Fee component with no MUG field at all (no unit basis)", () => {
    const component = createComponent("recurring", "flat_fee")
    expect(component.pricingModel).toBe("flat_fee")
    expect(component.amount).toBeNull()
    expect("mug" in component).toBe(false)
  })

  it("creates a Recurring Slab component with one starter row, default method Whole Quantity", () => {
    const component = createComponent("recurring", "slab")
    expect(component.pricingModel).toBe("slab")
    expect(component.slabMethod).toBe("whole_quantity")
    expect(component.slabRows).toHaveLength(1)
  })

  it("creates a Recurring Designation Based component with one starter row, per defaulting to USER", () => {
    const component = createComponent("recurring", "designation_based")
    expect(component.pricingModel).toBe("designation_based")
    expect(component.designationRows).toHaveLength(1)
    expect(component.designationRows[0].per).toBe("USER")
  })

  it("creates a Non-Recurring component with invoice frequency fixed to one_time, no MUG on any pricing model, and a Revenue Recognition field", () => {
    const flatFee = createComponent("non_recurring", "flat_fee")
    expect(flatFee.nature).toBe("non_recurring")
    expect(flatFee.invoiceTerms.invoiceFrequency).toBe("one_time")
    expect(flatFee.revenueRecognition).toEqual({ method: "full_recognition" })

    const perUnit = createComponent("non_recurring", "per_unit")
    expect("mug" in perUnit).toBe(false)
    const slab = createComponent("non_recurring", "slab")
    expect("mug" in slab).toBe(false)
  })

  it("creates an On-Demand Per Unit component with invoice frequency left optional (null)", () => {
    const component = createComponent("on_demand", "per_unit")
    expect(component.nature).toBe("on_demand")
    expect(component.invoiceTerms.invoiceFrequency).toBeNull()
    expect(component.mug).toEqual({ enabled: false })
  })

  it("gives every created component its own id", () => {
    const a = createComponent("recurring", "per_unit")
    const b = createComponent("recurring", "per_unit")
    expect(a.id).not.toBe(b.id)
  })
})

describe("isInvoiceTermsComplete", () => {
  it("Recurring requires both frequency and timing", () => {
    expect(isInvoiceTermsComplete("recurring", { invoiceFrequency: null, invoiceTiming: null })).toBe(false)
    expect(isInvoiceTermsComplete("recurring", { invoiceFrequency: "monthly", invoiceTiming: null })).toBe(false)
    expect(isInvoiceTermsComplete("recurring", COMPLETE_TERMS)).toBe(true)
  })

  it("Non-Recurring requires both, frequency is normally already fixed by createComponent", () => {
    expect(isInvoiceTermsComplete("non_recurring", { invoiceFrequency: "one_time", invoiceTiming: null })).toBe(false)
    expect(isInvoiceTermsComplete("non_recurring", { invoiceFrequency: "one_time", invoiceTiming: "advance" })).toBe(true)
  })

  it("On-Demand only requires timing, frequency is optional", () => {
    expect(isInvoiceTermsComplete("on_demand", { invoiceFrequency: null, invoiceTiming: null })).toBe(false)
    expect(isInvoiceTermsComplete("on_demand", { invoiceFrequency: null, invoiceTiming: "advance" })).toBe(true)
  })
})

describe("isMugComplete (unit quantity, never money)", () => {
  it("is true when disabled, regardless of minimumUnits", () => {
    expect(isMugComplete({ enabled: false })).toBe(true)
  })
  it("is false when enabled with no minimum units", () => {
    expect(isMugComplete({ enabled: true, minimumUnits: null })).toBe(false)
  })
  it("is true once a positive minimum unit quantity is set", () => {
    expect(isMugComplete({ enabled: true, minimumUnits: 5000 })).toBe(true)
  })
})

describe("areSlabRowsValid (row shape shared by both Slab Methods)", () => {
  it("is false with zero rows", () => {
    expect(areSlabRowsValid([])).toBe(false)
  })

  it("is true for a single open-ended row", () => {
    expect(areSlabRowsValid([{ id: "1", from: 1, to: null, rate: 100 }])).toBe(true)
  })

  it("is true for the spec's own worked example: 1-100 @100, 101-250 @90, 251+ @80", () => {
    const rows = [
      { id: "1", from: 1, to: 100, rate: 100 },
      { id: "2", from: 101, to: 250, rate: 90 },
      { id: "3", from: 251, to: null, rate: 80 },
    ]
    expect(areSlabRowsValid(rows)).toBe(true)
  })

  it("is false when a row's rate is missing or not positive", () => {
    expect(areSlabRowsValid([{ id: "1", from: 1, to: null, rate: null }])).toBe(false)
    expect(areSlabRowsValid([{ id: "1", from: 1, to: null, rate: 0 }])).toBe(false)
  })

  it("is false when from is missing", () => {
    expect(areSlabRowsValid([{ id: "1", from: null, to: 100, rate: 50 }])).toBe(false)
  })

  it("is false when from is after to", () => {
    expect(areSlabRowsValid([{ id: "1", from: 200, to: 100, rate: 50 }])).toBe(false)
  })

  it("is false when consecutive rows obviously overlap", () => {
    const rows = [
      { id: "1", from: 1, to: 100, rate: 100 },
      { id: "2", from: 100, to: 200, rate: 90 },
    ]
    expect(areSlabRowsValid(rows)).toBe(false)
  })
})

describe("areDesignationRowsValid", () => {
  it("is false with zero rows", () => {
    expect(areDesignationRowsValid([])).toBe(false)
  })

  it("is true once every row has a designation name, a positive rate, and a unit", () => {
    const rows = [createDesignationRow(), createDesignationRow()].map((row, index) => ({
      ...row,
      designation: index === 0 ? "Sales Rep" : "Manager",
      rate: index === 0 ? 50 : 80,
    }))
    expect(areDesignationRowsValid(rows)).toBe(true)
  })

  it("is false if any row is missing its designation name or rate", () => {
    const rows = [{ ...createDesignationRow(), designation: "Sales Rep", rate: 50 }, createDesignationRow()]
    expect(areDesignationRowsValid(rows)).toBe(false)
  })
})

describe("isRevenueRecognitionComplete", () => {
  it("Full Recognition is always complete", () => {
    expect(isRevenueRecognitionComplete({ method: "full_recognition" })).toBe(true)
  })

  it("Milestone Based is incomplete with zero milestones", () => {
    expect(isRevenueRecognitionComplete({ method: "milestone_based", milestones: [] })).toBe(false)
  })

  it("Milestone Based is incomplete when percentages do not total 100", () => {
    const milestones = [
      { ...createMilestone(), name: "Kickoff", recognitionPercent: 40 },
      { ...createMilestone(), name: "Go-Live", recognitionPercent: 40 },
    ]
    expect(isRevenueRecognitionComplete({ method: "milestone_based", milestones })).toBe(false)
  })

  it("Milestone Based is complete once every milestone is named, positive, and percentages total exactly 100", () => {
    const milestones = [
      { ...createMilestone(), name: "Kickoff", recognitionPercent: 40 },
      { ...createMilestone(), name: "Go-Live", recognitionPercent: 60 },
    ]
    expect(isRevenueRecognitionComplete({ method: "milestone_based", milestones })).toBe(true)
  })

  it("is incomplete if any milestone is missing a name", () => {
    const milestones = [{ ...createMilestone(), name: "", recognitionPercent: 100 }]
    expect(isRevenueRecognitionComplete({ method: "milestone_based", milestones })).toBe(false)
  })
})

describe("isComponentComplete", () => {
  it("Recurring + Per Unit: requires name, rate, unit, and full invoice terms", () => {
    const base = withDescription(createComponent("recurring", "per_unit"), "SFA")
    expect(isComponentComplete(base)).toBe(false)
    const filled: OngoingComponent = { ...base, rate: 50, pricingUnit: "USER", invoiceTerms: COMPLETE_TERMS }
    expect(isComponentComplete(filled)).toBe(true)
  })

  it("Recurring + Per Unit: MUG optional, but required once enabled", () => {
    const base = { ...withDescription(createComponent("recurring", "per_unit"), "SFA"), rate: 50, pricingUnit: "USER", invoiceTerms: COMPLETE_TERMS }
    expect(isComponentComplete(base)).toBe(true)
    const withMugOn = { ...base, mug: { enabled: true, minimumUnits: null } }
    expect(isComponentComplete(withMugOn)).toBe(false)
    const withMugComplete = { ...base, mug: { enabled: true, minimumUnits: 5000 } }
    expect(isComponentComplete(withMugComplete)).toBe(true)
  })

  it("Flat Fee never offers MUG, for any nature", () => {
    const recurring = { ...withDescription(createComponent("recurring", "flat_fee"), "Platform Fee"), invoiceTerms: COMPLETE_TERMS, amount: 200000 }
    expect(isComponentComplete(recurring)).toBe(true)
    expect("mug" in recurring).toBe(false)
  })

  it("Recurring + Slab: requires unit and at least one valid slab row, either Slab Method", () => {
    const component = { ...withDescription(createComponent("recurring", "slab"), "DMS"), invoiceTerms: COMPLETE_TERMS }
    expect(isComponentComplete(component)).toBe(false)
    const withUnit = { ...component, pricingUnit: "DISTRIBUTOR" }
    expect(isComponentComplete(withUnit)).toBe(false)
    const withRow = { ...withUnit, slabRows: [{ id: "1", from: 1, to: null, rate: 90 }] }
    expect(isComponentComplete(withRow)).toBe(true)
    const progressive = { ...withRow, slabMethod: "progressive" as const }
    expect(isComponentComplete(progressive)).toBe(true)
  })

  it("Designation Based: requires at least one complete designation row", () => {
    const component = { ...withDescription(createComponent("recurring", "designation_based"), "Field Team"), invoiceTerms: COMPLETE_TERMS }
    expect(isComponentComplete(component)).toBe(false)
    const withRow = { ...component, designationRows: [{ id: "1", designation: "Sales Rep", rate: 50, per: "USER" }] }
    expect(isComponentComplete(withRow)).toBe(true)
  })

  it("Non-Recurring: requires name, pricing fields, invoice terms, and a complete Revenue Recognition", () => {
    const component = withDescription(createComponent("non_recurring", "flat_fee"), "Implementation")
    expect(isComponentComplete(component)).toBe(false)
    const withAmount = { ...component, amount: 500000 }
    expect(isComponentComplete(withAmount)).toBe(false)
    const withTerms = { ...withAmount, invoiceTerms: { invoiceFrequency: "one_time", invoiceTiming: "advance" } }
    expect(isComponentComplete(withTerms)).toBe(true)

    const milestoneBased = {
      ...withTerms,
      revenueRecognition: { method: "milestone_based" as const, milestones: [{ ...createMilestone(), name: "Go-Live", recognitionPercent: 50 }] },
    }
    expect(isComponentComplete(milestoneBased)).toBe(false)
    const milestoneComplete = {
      ...withTerms,
      revenueRecognition: { method: "milestone_based" as const, milestones: [{ ...createMilestone(), name: "Go-Live", recognitionPercent: 100 }] },
    }
    expect(isComponentComplete(milestoneComplete)).toBe(true)
  })

  it("On-Demand + Per Unit: requires rate and unit; invoice frequency stays optional", () => {
    const perUnit = { ...withDescription(createComponent("on_demand", "per_unit"), "WhatsApp"), invoiceTerms: { invoiceFrequency: null, invoiceTiming: "advance" } }
    expect(isComponentComplete(perUnit)).toBe(false)
    expect(isComponentComplete({ ...perUnit, rate: 0.15, pricingUnit: "MESSAGE" })).toBe(true)
  })

  it("On-Demand + Flat Fee: requires amount and invoice timing only, frequency stays optional", () => {
    const fixedFee = { ...withDescription(createComponent("on_demand", "flat_fee"), "Custom Report"), invoiceTerms: { invoiceFrequency: null, invoiceTiming: "advance" } }
    expect(isComponentComplete(fixedFee)).toBe(false)
    expect(isComponentComplete({ ...fixedFee, amount: 50000 })).toBe(true)
  })

  it("Notes are never required for completeness", () => {
    const component = { ...withDescription(createComponent("recurring", "flat_fee"), "Platform Fee"), invoiceTerms: COMPLETE_TERMS, amount: 200000 }
    expect(component.notes).toBe("")
    expect(isComponentComplete(component)).toBe(true)
  })
})

describe("isCommercialRateDraftComplete / isCommercialRateDraftStarted (visited != complete)", () => {
  it("empty draft is neither started nor complete", () => {
    const draft = createEmptyCommercialRateDraft()
    expect(isCommercialRateDraftStarted(draft)).toBe(false)
    expect(isCommercialRateDraftComplete(draft)).toBe(false)
  })

  it("is started once currency is chosen, still not complete with zero components", () => {
    const draft: CommercialRateDraft = { ...createEmptyCommercialRateDraft(), billingCurrency: "INR" }
    expect(isCommercialRateDraftStarted(draft)).toBe(true)
    expect(isCommercialRateDraftComplete(draft)).toBe(false)
  })

  it("has no Commercial Scope concept: currency plus one complete component is enough", () => {
    const component = { ...withDescription(createComponent("recurring", "flat_fee"), "Platform Fee"), invoiceTerms: COMPLETE_TERMS, amount: 200000 }
    const draft: CommercialRateDraft = { billingCurrency: "INR", components: [component] }
    expect(isCommercialRateDraftComplete(draft)).toBe(true)
  })

  it("supports multiple components, incomplete if any one of them is incomplete", () => {
    const complete = { ...withDescription(createComponent("recurring", "flat_fee"), "Platform Fee"), invoiceTerms: COMPLETE_TERMS, amount: 200000 }
    const incomplete = withDescription(createComponent("non_recurring", "flat_fee"), "Implementation")
    const draft: CommercialRateDraft = { billingCurrency: "INR", components: [complete, incomplete] }
    expect(isCommercialRateDraftComplete(draft)).toBe(false)
  })
})

describe("Add / Delete component (plain array operations, exercised at domain level)", () => {
  it("adding appends a new component with a unique id", () => {
    const draft = createEmptyCommercialRateDraft()
    const withOne: CommercialRateDraft = { ...draft, components: [...draft.components, createComponent("recurring", "per_unit")] }
    const withTwo: CommercialRateDraft = { ...withOne, components: [...withOne.components, createComponent("non_recurring", "flat_fee")] }
    expect(withTwo.components).toHaveLength(2)
    expect(withTwo.components[0].id).not.toBe(withTwo.components[1].id)
  })

  it("deleting removes only the targeted component", () => {
    const a = createComponent("recurring", "per_unit")
    const b = createComponent("non_recurring", "flat_fee")
    const draft: CommercialRateDraft = { ...createEmptyCommercialRateDraft(), components: [a, b] }
    const afterDelete: CommercialRateDraft = { ...draft, components: draft.components.filter((component) => component.id !== a.id) }
    expect(afterDelete.components).toEqual([b])
  })
})

describe("createSlabRow / createDesignationRow / createMilestone", () => {
  it("each call produces a fresh id", () => {
    expect(createSlabRow().id).not.toBe(createSlabRow().id)
    expect(createDesignationRow().id).not.toBe(createDesignationRow().id)
    expect(createMilestone().id).not.toBe(createMilestone().id)
  })
})

describe("createSlabRow: From defaults (task correction §2)", () => {
  it("the first row (no previous) defaults From to 1", () => {
    expect(createSlabRow().from).toBe(1)
    expect(createSlabRow(null).from).toBe(1)
  })

  it("a row created after a closed previous row defaults From to previous To + 1", () => {
    const previous = { id: "1", from: 1, to: 100, rate: 100 }
    expect(createSlabRow(previous).from).toBe(101)
  })

  it("a row created after a still-open-ended previous row keeps the previous row's own From (defensive fallback, the UI never allows this)", () => {
    const previous = { id: "1", from: 1, to: null, rate: 100 }
    expect(createSlabRow(previous).from).toBe(1)
  })
})

describe("recalculateSlabFroms (task correction §2-3: From is system-derived, never typed)", () => {
  it("forces the first row's From to 1 even if it was set to something else", () => {
    const rows = [{ id: "1", from: 5, to: 100, rate: 100 }]
    expect(recalculateSlabFroms(rows)[0].from).toBe(1)
  })

  it("cascades From = previous To + 1 down a chain of rows", () => {
    const rows = [
      { id: "1", from: 1, to: 100, rate: 100 },
      { id: "2", from: 999, to: 250, rate: 90 },
      { id: "3", from: 999, to: null, rate: 80 },
    ]
    const recalculated = recalculateSlabFroms(rows)
    expect(recalculated.map((row) => row.from)).toEqual([1, 101, 251])
  })

  it("recalculates every later From when an earlier row's To changes", () => {
    const rows = [
      { id: "1", from: 1, to: 100, rate: 100 },
      { id: "2", from: 101, to: 250, rate: 90 },
    ]
    const edited = rows.map((row) => (row.id === "1" ? { ...row, to: 150 } : row))
    expect(recalculateSlabFroms(edited).map((row) => row.from)).toEqual([1, 151])
  })

  it("never produces overlapping or gapped rows: consecutive rows are always contiguous", () => {
    const rows = recalculateSlabFroms([
      { id: "1", from: 1, to: 50, rate: 10 },
      { id: "2", from: 1, to: 120, rate: 9 },
      { id: "3", from: 1, to: null, rate: 8 },
    ])
    expect(areSlabRowsValid(rows)).toBe(true)
    expect(rows[1].from).toBe(51)
    expect(rows[2].from).toBe(121)
  })
})

describe("calculateSlabAmountForQuantity (task correction §1's worked example)", () => {
  const rows = [
    { id: "1", from: 1, to: 100, rate: 100 },
    { id: "2", from: 101, to: 250, rate: 90 },
  ]

  it("Whole Quantity: prices the entire quantity at the single band it falls into (150 x 90 = 13,500)", () => {
    expect(calculateSlabAmountForQuantity(rows, "whole_quantity", 150)).toBe(13500)
  })

  it("Progressive: prices each band separately and sums ((100 x 100) + (50 x 90) = 14,500)", () => {
    expect(calculateSlabAmountForQuantity(rows, "progressive", 150)).toBe(14500)
  })

  it("Whole Quantity: a quantity inside the first band uses that band's own rate", () => {
    expect(calculateSlabAmountForQuantity(rows, "whole_quantity", 50)).toBe(5000)
  })

  it("returns null when there are no rows, never fabricating an amount", () => {
    expect(calculateSlabAmountForQuantity([], "whole_quantity", 150)).toBeNull()
  })

  it("returns null when the quantity does not fall inside any Whole Quantity band", () => {
    const incompleteRows = [{ id: "1", from: 1, to: 100, rate: 100 }]
    expect(calculateSlabAmountForQuantity(incompleteRows, "whole_quantity", 150)).toBeNull()
  })
})

describe("calculateMugValue (task correction §1: a calculated reference, never a fabricated one)", () => {
  it("Per Unit: MUG units x rate", () => {
    const component = { ...createComponent("recurring", "per_unit"), rate: 50, pricingUnit: "USER", mug: { enabled: true, minimumUnits: 5000 } }
    expect(calculateMugValue(component)).toBe(250000)
  })

  it("Per Unit: null when rate is not yet set", () => {
    const component = { ...createComponent("recurring", "per_unit"), rate: null, pricingUnit: "USER", mug: { enabled: true, minimumUnits: 5000 } }
    expect(calculateMugValue(component)).toBeNull()
  })

  it("Whole Quantity Slab: uses the band the MUG quantity falls into", () => {
    const component = {
      ...createComponent("recurring", "slab"),
      pricingUnit: "USER",
      slabMethod: "whole_quantity" as const,
      slabRows: [
        { id: "1", from: 1, to: 100, rate: 100 },
        { id: "2", from: 101, to: 250, rate: 90 },
      ],
      mug: { enabled: true, minimumUnits: 150 },
    }
    expect(calculateMugValue(component)).toBe(13500)
  })

  it("Progressive Slab: sums each band up to the MUG quantity", () => {
    const component = {
      ...createComponent("recurring", "slab"),
      pricingUnit: "USER",
      slabMethod: "progressive" as const,
      slabRows: [
        { id: "1", from: 1, to: 100, rate: 100 },
        { id: "2", from: 101, to: 250, rate: 90 },
      ],
      mug: { enabled: true, minimumUnits: 150 },
    }
    expect(calculateMugValue(component)).toBe(14500)
  })

  it("Designation Based: never calculated, would require inventing which designation's rate applies", () => {
    const component = {
      ...createComponent("recurring", "designation_based"),
      designationRows: [{ id: "1", designation: "Sales Rep", rate: 50, per: "USER" }],
      mug: { enabled: true, minimumUnits: 5000 },
    }
    expect(calculateMugValue(component)).toBeNull()
  })

  it("is null when MUG is disabled or the quantity is not set", () => {
    const disabled = { ...createComponent("recurring", "per_unit"), rate: 50, pricingUnit: "USER" }
    expect(calculateMugValue(disabled)).toBeNull()
    const noQuantity = { ...disabled, mug: { enabled: true, minimumUnits: null } }
    expect(calculateMugValue(noQuantity)).toBeNull()
  })

  it("Flat Fee never has a mug field to calculate from", () => {
    const component = { ...createComponent("recurring", "flat_fee"), amount: 200000 }
    expect(calculateMugValue(component)).toBeNull()
  })
})
