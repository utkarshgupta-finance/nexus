import { describe, expect, it } from "vitest"

import { diffCommercialRate } from "./commercial-rate-diff"
import { createComponent, createSlabRow, createDesignationRow, createMilestone } from "./commercial-rate"
import type { CommercialRateDraft, OngoingComponent, NonRecurringComponent } from "./commercial-rate"

function draft(components: CommercialRateDraft["components"], billingCurrency = "INR"): CommercialRateDraft {
  return { billingCurrency, components }
}

describe("diffCommercialRate", () => {
  it("classifies an unchanged Per Unit component as unchanged", () => {
    const component = { ...createComponent("recurring", "per_unit"), rate: 200, pricingUnit: "user" } as OngoingComponent
    const diff = diffCommercialRate(draft([component]), draft([component]))
    expect(diff.components).toHaveLength(1)
    expect(diff.components[0].status).toBe("unchanged")
  })

  it("computes a rate percentage change for a changed Per Unit component", () => {
    const current = { ...createComponent("recurring", "per_unit"), id: "c1", rate: 200, pricingUnit: "user" } as OngoingComponent
    const proposed = { ...current, rate: 225 }
    const diff = diffCommercialRate(draft([current]), draft([proposed]))
    expect(diff.components[0].status).toBe("changed")
    expect(diff.components[0].ratePercentChange).toBeCloseTo(12.5)
  })

  it("classifies a component present only in current as removed", () => {
    const current = { ...createComponent("recurring", "flat_fee"), id: "c1" } as OngoingComponent
    const diff = diffCommercialRate(draft([current]), draft([]))
    expect(diff.components[0].status).toBe("removed")
    expect(diff.components[0].proposed).toBeNull()
  })

  it("classifies a component present only in proposed as added", () => {
    const proposed = { ...createComponent("recurring", "flat_fee"), id: "c1" } as OngoingComponent
    const diff = diffCommercialRate(draft([]), draft([proposed]))
    expect(diff.components[0].status).toBe("added")
    expect(diff.components[0].current).toBeNull()
  })

  it("detects a MUG change", () => {
    const current = {
      ...createComponent("recurring", "per_unit"),
      id: "c1",
      rate: 200,
      mug: { enabled: true, minimumUnits: 500, designationMinimums: [] },
    } as OngoingComponent
    const proposed = { ...current, mug: { enabled: true, minimumUnits: 600, designationMinimums: [] } }
    const diff = diffCommercialRate(draft([current]), draft([proposed]))
    expect(diff.components[0].mugChanged).toBe(true)
    expect(diff.components[0].currentMug).toBe(500)
    expect(diff.components[0].proposedMug).toBe(600)
  })

  it("detects an Invoice Cycle change", () => {
    const current = {
      ...createComponent("recurring", "flat_fee"),
      id: "c1",
      invoiceTerms: { invoiceFrequency: "monthly", invoiceTiming: "advance" },
    } as OngoingComponent
    const proposed = { ...current, invoiceTerms: { invoiceFrequency: "quarterly", invoiceTiming: "advance" } }
    const diff = diffCommercialRate(draft([current]), draft([proposed]))
    expect(diff.components[0].invoiceCycleChanged).toBe(true)
    expect(diff.components[0].status).toBe("changed")
  })

  it("diffs Slab bands by position: changed rate, added band, removed band", () => {
    const row1 = { ...createSlabRow(null), from: 1, to: 100, rate: 500 }
    const row2 = { ...createSlabRow(row1), from: 101, to: 200, rate: 450 }
    const current = { ...createComponent("recurring", "slab"), id: "c1", pricingUnit: "user", slabRows: [row1, row2] } as OngoingComponent

    const proposedRow1 = { ...row1, rate: 525 }
    const proposedRow2 = { ...row2, to: 250 }
    const proposedRow3 = { ...createSlabRow(proposedRow2), from: 251, to: null, rate: 390 }
    const proposed = { ...current, slabRows: [proposedRow1, proposedRow2, proposedRow3] }

    const diff = diffCommercialRate(draft([current]), draft([proposed]))
    const slabDiffs = diff.components[0].slabRowDiffs
    expect(slabDiffs).toHaveLength(3)
    expect(slabDiffs[0].status).toBe("changed")
    expect(slabDiffs[0].currentRate).toBe(500)
    expect(slabDiffs[0].proposedRate).toBe(525)
    expect(slabDiffs[1].status).toBe("changed")
    expect(slabDiffs[2].status).toBe("added")
  })

  it("8. Current vs Proposed shows a Slab-wise MUG change: mode switch and per-band quantity changes are both surfaced", () => {
    const row1 = { ...createSlabRow(null), from: 1, to: 500, rate: 100, mug: 400 }
    const row2 = { ...createSlabRow(row1), from: 501, to: null, rate: 80, mug: 200 }
    const current = {
      ...createComponent("recurring", "slab"),
      id: "c1",
      pricingUnit: "user",
      slabRows: [row1, row2],
      slabMugMode: "overall" as const,
      mug: { enabled: true, minimumUnits: 600, designationMinimums: [] },
    } as OngoingComponent

    const proposedRow1 = { ...row1, mug: 450 }
    const proposedRow2 = { ...row2, mug: 250 }
    const proposed = { ...current, slabRows: [proposedRow1, proposedRow2], slabMugMode: "slab_wise" as const }

    const diff = diffCommercialRate(draft([current]), draft([proposed]))
    expect(diff.components[0].slabMugModeChanged).toBe(true)
    const slabDiffs = diff.components[0].slabRowDiffs
    expect(slabDiffs[0].currentMug).toBe(400)
    expect(slabDiffs[0].proposedMug).toBe(450)
    expect(slabDiffs[1].currentMug).toBe(200)
    expect(slabDiffs[1].proposedMug).toBe(250)
  })

  it("does not flag slabMugModeChanged when only the pricing model differs (added/removed components never falsely compare modes)", () => {
    const current = { ...createComponent("recurring", "slab"), id: "c1", pricingUnit: "user" } as OngoingComponent
    const diff = diffCommercialRate(draft([current]), draft([]))
    expect(diff.components[0].slabMugModeChanged).toBe(false)
  })

  it("diffs Designation rows by designation name", () => {
    const salesRep = createDesignationRow()
    const manager = createDesignationRow()
    const current = {
      ...createComponent("recurring", "designation_based"),
      id: "c1",
      designationRows: [
        { ...salesRep, designation: "Sales Rep", rate: 100, per: "user" },
        { ...manager, designation: "Manager", rate: 200, per: "user" },
      ],
    } as OngoingComponent

    const proposed = {
      ...current,
      designationRows: [
        { ...salesRep, designation: "Sales Rep", rate: 110, per: "user" },
        { ...manager, designation: "Manager", rate: 200, per: "user" },
        { ...createDesignationRow(), designation: "Admin", rate: 325, per: "user" },
      ],
    }

    const diff = diffCommercialRate(draft([current]), draft([proposed]))
    const rows = diff.components[0].designationRowDiffs
    const salesRepDiff = rows.find((row) => row.designation === "Sales Rep")
    const managerDiff = rows.find((row) => row.designation === "Manager")
    const adminDiff = rows.find((row) => row.designation === "Admin")
    expect(salesRepDiff?.status).toBe("changed")
    expect(salesRepDiff?.currentRate).toBe(100)
    expect(salesRepDiff?.proposedRate).toBe(110)
    expect(managerDiff?.status).toBe("unchanged")
    expect(adminDiff?.status).toBe("added")
  })

  it("diffs Non-Recurring milestones by name", () => {
    const goLive = createMilestone()
    const current = {
      ...createComponent("non_recurring", "flat_fee"),
      id: "c1",
      revenueRecognition: { method: "milestone_based" as const, milestones: [{ ...goLive, name: "Go Live", recognitionPercent: 25, invoiceTiming: "postpaid" }] },
    } as NonRecurringComponent

    const proposed = {
      ...current,
      revenueRecognition: {
        method: "milestone_based" as const,
        milestones: [{ ...goLive, name: "Go Live", recognitionPercent: 30, invoiceTiming: "advance" }],
      },
    }

    const diff = diffCommercialRate(draft([current]), draft([proposed]))
    const milestoneDiff = diff.components[0].milestoneDiffs[0]
    expect(milestoneDiff.status).toBe("changed")
    expect(milestoneDiff.currentPercent).toBe(25)
    expect(milestoneDiff.proposedPercent).toBe(30)
    expect(milestoneDiff.currentInvoiceTiming).toBe("postpaid")
    expect(milestoneDiff.proposedInvoiceTiming).toBe("advance")
  })

  it("sorts changed/added/removed before unchanged", () => {
    const unchanged = { ...createComponent("recurring", "flat_fee"), id: "unchanged" } as OngoingComponent
    const changed = { ...createComponent("recurring", "flat_fee"), id: "changed", amount: 100 } as OngoingComponent
    const changedProposed = { ...changed, amount: 200 }
    const diff = diffCommercialRate(draft([unchanged, changed]), draft([unchanged, changedProposed]))
    expect(diff.components[0].status).toBe("changed")
    expect(diff.components[1].status).toBe("unchanged")
  })

  it("detects a billing currency change", () => {
    const diff = diffCommercialRate(draft([], "INR"), draft([], "USD"))
    expect(diff.billingCurrencyChanged).toBe(true)
  })
})
