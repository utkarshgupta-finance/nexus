import { describe, expect, it } from "vitest"

import {
  areDesignationRowsValid,
  areSlabRowsValid,
  createComponent,
  createDesignationRow,
  createEmptyCommercialRateDraft,
  createSlabRow,
  isBillingTermsComplete,
  isCommercialRateDraftComplete,
  isCommercialRateDraftStarted,
  isComponentComplete,
  isMugComplete,
  toPricingRuleKind,
} from "./commercial-rate"
import type {
  BillingTerms,
  CommercialComponentDraft,
  CommercialRateDraft,
  RecurringPerUnitComponent,
} from "./commercial-rate"

const COMPLETE_TERMS: BillingTerms = {
  billingCycle: "monthly",
  billingTiming: "advance",
  paymentTerms: { paymentTermsCode: "due_on_receipt", customPaymentDays: null },
}

function withDescription<T extends CommercialComponentDraft>(component: T, description: string): T {
  return { ...component, description }
}

describe("toPricingRuleKind", () => {
  it("maps Per Unit to linear", () => {
    expect(toPricingRuleKind("per_unit")).toBe("linear")
  })
  it("maps Flat Fee and Fixed Fee to flat", () => {
    expect(toPricingRuleKind("flat_fee")).toBe("flat")
    expect(toPricingRuleKind("fixed_fee")).toBe("flat")
  })
  it("maps Slab to volume, never graduated (whole-quantity, not progressive)", () => {
    expect(toPricingRuleKind("slab")).toBe("volume")
  })
  it("maps Designation Based to dimension", () => {
    expect(toPricingRuleKind("designation_based")).toBe("dimension")
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
    expect(component.billingTerms.billingCycle).toBeNull()
  })

  it("creates a Recurring Flat Fee component", () => {
    const component = createComponent("recurring", "flat_fee")
    expect(component.pricingModel).toBe("flat_fee")
    expect(component.recurringAmount).toBeNull()
  })

  it("creates a Recurring Slab component with one starter slab row", () => {
    const component = createComponent("recurring", "slab")
    expect(component.pricingModel).toBe("slab")
    expect(component.slabRows).toHaveLength(1)
  })

  it("creates a Recurring Designation Based component with one starter row, per defaulting to USER", () => {
    const component = createComponent("recurring", "designation_based")
    expect(component.pricingModel).toBe("designation_based")
    expect(component.designationRows).toHaveLength(1)
    expect(component.designationRows[0].per).toBe("USER")
  })

  it("creates a Non-Recurring component with billing cycle fixed to one_time and no MUG field", () => {
    const component = createComponent("non_recurring")
    expect(component.nature).toBe("non_recurring")
    expect(component.billingTerms.billingCycle).toBe("one_time")
    expect("mug" in component).toBe(false)
    expect("pricingModel" in component).toBe(false)
  })

  it("creates an On-Demand Per Unit component with billing cycle fixed to on_demand", () => {
    const component = createComponent("on_demand", "per_unit")
    expect(component.pricingType).toBe("per_unit")
    expect(component.billingTerms.billingCycle).toBe("on_demand")
  })

  it("creates an On-Demand Fixed Fee component", () => {
    const component = createComponent("on_demand", "fixed_fee")
    expect(component.pricingType).toBe("fixed_fee")
    expect(component.amount).toBeNull()
  })

  it("gives every created component its own id", () => {
    const a = createComponent("recurring", "per_unit")
    const b = createComponent("recurring", "per_unit")
    expect(a.id).not.toBe(b.id)
  })
})

describe("isBillingTermsComplete", () => {
  it("is false with nothing set", () => {
    expect(isBillingTermsComplete({ billingCycle: null, billingTiming: null, paymentTerms: { paymentTermsCode: null, customPaymentDays: null } })).toBe(false)
  })
  it("is true once cycle, timing, and a non-custom payment term are set", () => {
    expect(isBillingTermsComplete(COMPLETE_TERMS)).toBe(true)
  })
  it("requires Payment Days only when Payment Terms is Custom", () => {
    const custom: BillingTerms = { ...COMPLETE_TERMS, paymentTerms: { paymentTermsCode: "custom", customPaymentDays: null } }
    expect(isBillingTermsComplete(custom)).toBe(false)
    expect(isBillingTermsComplete({ ...custom, paymentTerms: { paymentTermsCode: "custom", customPaymentDays: 21 } })).toBe(true)
  })
})

describe("isMugComplete", () => {
  it("is true when disabled, regardless of amount/frequency", () => {
    expect(isMugComplete({ enabled: false })).toBe(true)
  })
  it("is false when enabled with no amount or frequency", () => {
    expect(isMugComplete({ enabled: true, amount: null, frequency: null })).toBe(false)
  })
  it("is true only once both amount and frequency are set", () => {
    expect(isMugComplete({ enabled: true, amount: 200000, frequency: "monthly" })).toBe(true)
  })
})

describe("areSlabRowsValid (whole-quantity slab semantics, task spec: not progressive)", () => {
  it("is false with zero rows", () => {
    expect(areSlabRowsValid([])).toBe(false)
  })

  it("is true for a single open-ended row", () => {
    expect(areSlabRowsValid([{ id: "1", from: 1, to: null, rate: 100 }])).toBe(true)
  })

  it("is true for the task's own worked example: 1-100 @100, 101-250 @90, 251+ @80", () => {
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

  it("allows a blank/open-ended To only on the last row's own value, still valid mid-list logic aside", () => {
    const rows = [
      { id: "1", from: 1, to: 100, rate: 100 },
      { id: "2", from: 101, to: null, rate: 80 },
    ]
    expect(areSlabRowsValid(rows)).toBe(true)
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

describe("isComponentComplete", () => {
  it("Recurring + Per Unit: requires component, rate, unit, and full billing terms", () => {
    const base = withDescription(createComponent("recurring", "per_unit"), "SFA")
    expect(isComponentComplete(base)).toBe(false)
    const filled: RecurringPerUnitComponent = { ...base, rate: 50, pricingUnit: "USER", billingTerms: COMPLETE_TERMS }
    expect(isComponentComplete(filled)).toBe(true)
  })

  it("Recurring + Per Unit: MUG optional, but required once enabled", () => {
    const base = { ...withDescription(createComponent("recurring", "per_unit"), "SFA"), rate: 50, pricingUnit: "USER", billingTerms: COMPLETE_TERMS }
    expect(isComponentComplete(base)).toBe(true)
    const withMugOn = { ...base, mug: { enabled: true, amount: null, frequency: null } }
    expect(isComponentComplete(withMugOn)).toBe(false)
    const withMugComplete = { ...base, mug: { enabled: true, amount: 200000, frequency: "monthly" } }
    expect(isComponentComplete(withMugComplete)).toBe(true)
  })

  it("Recurring + Flat Fee: requires only a positive recurring amount plus billing terms, never confused with Non-Recurring", () => {
    const component = { ...withDescription(createComponent("recurring", "flat_fee"), "Platform Fee"), billingTerms: COMPLETE_TERMS }
    expect(isComponentComplete(component)).toBe(false)
    expect(isComponentComplete({ ...component, recurringAmount: 200000 })).toBe(true)
    expect(component.nature).toBe("recurring")
  })

  it("Recurring + Slab: requires unit and at least one valid slab row", () => {
    const component = { ...withDescription(createComponent("recurring", "slab"), "DMS"), billingTerms: COMPLETE_TERMS }
    expect(isComponentComplete(component)).toBe(false)
    const withUnit = { ...component, pricingUnit: "DISTRIBUTOR" }
    expect(isComponentComplete(withUnit)).toBe(false)
    const withRow = { ...withUnit, slabRows: [{ id: "1", from: 1, to: null, rate: 90 }] }
    expect(isComponentComplete(withRow)).toBe(true)
  })

  it("Designation Based: requires at least one complete designation row", () => {
    const component = { ...withDescription(createComponent("recurring", "designation_based"), "Field Team"), billingTerms: COMPLETE_TERMS }
    expect(isComponentComplete(component)).toBe(false)
    const withRow = { ...component, designationRows: [{ id: "1", designation: "Sales Rep", rate: 50, per: "USER" }] }
    expect(isComponentComplete(withRow)).toBe(true)
  })

  it("Non-Recurring: requires description, amount, and billing terms, never a pricing model", () => {
    const component = withDescription(createComponent("non_recurring"), "Implementation")
    expect(isComponentComplete(component)).toBe(false)
    const withAmount = { ...component, amount: 500000 }
    expect(isComponentComplete(withAmount)).toBe(false)
    const complete = { ...withAmount, billingTerms: { ...COMPLETE_TERMS, billingCycle: "one_time" } }
    expect(isComponentComplete(complete)).toBe(true)
  })

  it("On-Demand + Per Unit: requires rate and unit, unit not required for Fixed Fee", () => {
    const perUnit = { ...withDescription(createComponent("on_demand", "per_unit"), "WhatsApp"), billingTerms: { ...COMPLETE_TERMS, billingCycle: "on_demand" } }
    expect(isComponentComplete(perUnit)).toBe(false)
    expect(isComponentComplete({ ...perUnit, rate: 0.15, pricingUnit: "MESSAGE" })).toBe(true)

    const fixedFee = { ...withDescription(createComponent("on_demand", "fixed_fee"), "Custom Report"), billingTerms: { ...COMPLETE_TERMS, billingCycle: "on_demand" } }
    expect(isComponentComplete(fixedFee)).toBe(false)
    expect(isComponentComplete({ ...fixedFee, amount: 50000 })).toBe(true)
  })

  it("Notes are never required for completeness", () => {
    const component = { ...withDescription(createComponent("recurring", "flat_fee"), "Platform Fee"), billingTerms: COMPLETE_TERMS, recurringAmount: 200000 }
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

  it("requires Commercial Scope even with currency and a complete component", () => {
    const component = { ...withDescription(createComponent("recurring", "flat_fee"), "Platform Fee"), billingTerms: COMPLETE_TERMS, recurringAmount: 200000 }
    const draft: CommercialRateDraft = { commercialScope: "", billingCurrency: "INR", components: [component] }
    expect(isCommercialRateDraftComplete(draft)).toBe(false)
  })

  it("is complete with scope, currency, and every component complete", () => {
    const component = { ...withDescription(createComponent("recurring", "flat_fee"), "Platform Fee"), billingTerms: COMPLETE_TERMS, recurringAmount: 200000 }
    const draft: CommercialRateDraft = { commercialScope: "SFA", billingCurrency: "INR", components: [component] }
    expect(isCommercialRateDraftComplete(draft)).toBe(true)
  })

  it("supports multiple components, incomplete if any one of them is incomplete", () => {
    const complete = { ...withDescription(createComponent("recurring", "flat_fee"), "Platform Fee"), billingTerms: COMPLETE_TERMS, recurringAmount: 200000 }
    const incomplete = withDescription(createComponent("non_recurring"), "Implementation")
    const draft: CommercialRateDraft = { commercialScope: "SFA + Implementation", billingCurrency: "INR", components: [complete, incomplete] }
    expect(isCommercialRateDraftComplete(draft)).toBe(false)
  })
})

describe("Add / Delete component (plain array operations, exercised at domain level)", () => {
  it("adding appends a new component with a unique id", () => {
    const draft = createEmptyCommercialRateDraft()
    const withOne: CommercialRateDraft = { ...draft, components: [...draft.components, createComponent("recurring", "per_unit")] }
    const withTwo: CommercialRateDraft = { ...withOne, components: [...withOne.components, createComponent("non_recurring")] }
    expect(withTwo.components).toHaveLength(2)
    expect(withTwo.components[0].id).not.toBe(withTwo.components[1].id)
  })

  it("deleting removes only the targeted component", () => {
    const a = createComponent("recurring", "per_unit")
    const b = createComponent("non_recurring")
    const draft: CommercialRateDraft = { ...createEmptyCommercialRateDraft(), components: [a, b] }
    const afterDelete: CommercialRateDraft = { ...draft, components: draft.components.filter((component) => component.id !== a.id) }
    expect(afterDelete.components).toEqual([b])
  })
})

describe("createSlabRow / createDesignationRow", () => {
  it("each call produces a fresh id", () => {
    expect(createSlabRow().id).not.toBe(createSlabRow().id)
    expect(createDesignationRow().id).not.toBe(createDesignationRow().id)
  })
})
