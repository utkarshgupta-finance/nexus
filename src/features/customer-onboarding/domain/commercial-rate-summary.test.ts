import { describe, expect, it } from "vitest"

import { componentTableCells, formatCompactAmount, summarizeComponent } from "./commercial-rate-summary"
import { createComponent, createMilestone } from "./commercial-rate"

/**
 * Display-only summaries: these never imply a real invoice was calculated,
 * so the assertions below check the text is present and readable, not that
 * it matches a billing engine's output.
 */
describe("summarizeComponent", () => {
  it("formats a Recurring Per Unit component as rate / unit / Month", () => {
    const component = {
      ...createComponent("recurring", "per_unit"),
      rate: 50,
      pricingUnit: "USER",
      invoiceTerms: { invoiceFrequency: "monthly", invoiceTiming: "advance" },
    }
    const lines = summarizeComponent(component, "INR")
    expect(lines[0]).toContain("50")
    expect(lines[0]).toContain("User")
    expect(lines[0]).toContain("Month")
  })

  it("formats Non-Recurring Flat Fee as a one-time amount and appends a Revenue Recognition line", () => {
    const component = { ...createComponent("non_recurring", "flat_fee"), amount: 500000 }
    const lines = summarizeComponent(component, "INR")
    expect(lines[0]).toContain("5,00,000")
    expect(lines[0]).toContain("one-time")
    expect(lines.some((line) => line.startsWith("Revenue Recognition"))).toBe(true)
  })

  it("formats each Slab row as its own range line, tagged with its Slab Method", () => {
    const component = {
      ...createComponent("recurring", "slab"),
      pricingUnit: "USER",
      slabMethod: "progressive" as const,
      slabRows: [
        { id: "1", from: 1, to: 100, rate: 100 },
        { id: "2", from: 101, to: null, rate: 90 },
      ],
    }
    const lines = summarizeComponent(component, "INR")
    expect(lines[0]).toContain("Progressive")
    expect(lines[1]).toContain("1-100")
    expect(lines[2]).toContain("101+")
  })

  it("appends a MUG line in units, never money, only when MUG is enabled", () => {
    const withoutMug = { ...createComponent("recurring", "per_unit"), rate: 50, pricingUnit: "USER" }
    expect(summarizeComponent(withoutMug, "INR").some((line) => line.startsWith("MUG"))).toBe(false)

    const withMug = { ...withoutMug, mug: { enabled: true, minimumUnits: 5000 } }
    const lines = summarizeComponent(withMug, "INR")
    const mugLine = lines.find((line) => line.startsWith("MUG"))
    expect(mugLine).toBeDefined()
    expect(mugLine).toContain("5,000")
    expect(mugLine).toContain("Users")
    expect(mugLine).not.toContain("INR")
  })

  it("appends a separate Calculated MUG Value line (money) alongside the unit-only MUG line, never merging the two", () => {
    const component = { ...createComponent("recurring", "per_unit"), rate: 50, pricingUnit: "USER", mug: { enabled: true, minimumUnits: 5000 } }
    const lines = summarizeComponent(component, "INR")
    const calculatedLine = lines.find((line) => line.startsWith("Calculated MUG Value"))
    expect(calculatedLine).toBeDefined()
    expect(calculatedLine).toContain("2,50,000")
    expect(calculatedLine).toContain("Month")
  })

  it("omits the Calculated MUG Value line for Designation Based, which cannot be reliably calculated", () => {
    const component = {
      ...createComponent("recurring", "designation_based"),
      designationRows: [{ id: "1", designation: "Sales Rep", rate: 50, per: "USER" }],
      mug: { enabled: true, minimumUnits: 5000 },
    }
    const lines = summarizeComponent(component, "INR")
    expect(lines.some((line) => line.startsWith("MUG"))).toBe(true)
    expect(lines.some((line) => line.startsWith("Calculated MUG Value"))).toBe(false)
  })

  it("never shows a MUG line for Flat Fee, which has no unit basis", () => {
    const flatFee = { ...createComponent("recurring", "flat_fee"), amount: 200000 }
    expect(summarizeComponent(flatFee, "INR").some((line) => line.startsWith("MUG"))).toBe(false)
  })

  it("includes an Invoice line combining frequency and timing when both are set", () => {
    const component = {
      ...createComponent("recurring", "flat_fee"),
      amount: 200000,
      invoiceTerms: { invoiceFrequency: "half_yearly", invoiceTiming: "advance" },
    }
    const lines = summarizeComponent(component, "INR")
    const invoiceLine = lines.find((line) => line.startsWith("Invoice"))
    expect(invoiceLine).toContain("Half-Yearly")
    expect(invoiceLine).toContain("Advance")
  })

  it("summarizes a Milestone Based Non-Recurring component with a milestone count", () => {
    const component = {
      ...createComponent("non_recurring", "flat_fee"),
      amount: 500000,
      revenueRecognition: {
        method: "milestone_based" as const,
        milestones: [
          { ...createMilestone(), name: "Kickoff", recognitionPercent: 40 },
          { ...createMilestone(), name: "Go-Live", recognitionPercent: 60 },
        ],
      },
    }
    const lines = summarizeComponent(component, "INR")
    expect(lines.some((line) => line.includes("Milestone Based") && line.includes("2 milestones"))).toBe(true)
  })
})

describe("formatCompactAmount (table-cell space saving, never used for the full precise amount)", () => {
  it("abbreviates lakhs", () => {
    expect(formatCompactAmount(250000, "INR")).toBe("INR 2.5L")
    expect(formatCompactAmount(500000, "INR")).toBe("INR 5L")
  })

  it("abbreviates thousands below a lakh", () => {
    expect(formatCompactAmount(1500, "INR")).toBe("INR 1.5K")
  })

  it("leaves small amounts as plain digits", () => {
    expect(formatCompactAmount(500, "INR")).toBe("INR 500")
  })

  it("is - for null, never a fabricated figure", () => {
    expect(formatCompactAmount(null, "INR")).toBe("-")
  })
})

describe("componentTableCells (Commercial Components table, task correction §4-8)", () => {
  it("Per Unit: Pricing is the model name, Rate is the value-only summary, never raw enum codes", () => {
    const component = { ...createComponent("recurring", "per_unit"), description: "SFA", rate: 50, pricingUnit: "USER" }
    const cells = componentTableCells(component, "INR")
    expect(cells.name).toBe("SFA")
    expect(cells.nature).toBe("Recurring")
    expect(cells.pricing).toBe("Per Unit")
    expect(cells.rate).toBe("INR 50 / User")
  })

  it("Flat Fee: Rate is the plain amount", () => {
    const component = { ...createComponent("non_recurring", "flat_fee"), description: "Implementation", amount: 500000 }
    const cells = componentTableCells(component, "INR")
    expect(cells.rate).toBe("INR 5,00,000")
  })

  it("Slab: Rate summarizes the method and unit", () => {
    const component = { ...createComponent("recurring", "slab"), description: "DMS", pricingUnit: "DISTRIBUTOR", slabMethod: "whole_quantity" as const }
    const cells = componentTableCells(component, "INR")
    expect(cells.rate).toBe("Whole Quantity / Distributor")
  })

  it("Designation Based: Rate counts the rows, never listing raw codes", () => {
    const component = {
      ...createComponent("recurring", "designation_based"),
      description: "Field Team",
      designationRows: [
        { id: "1", designation: "Sales Rep", rate: 50, per: "USER" },
        { id: "2", designation: "Manager", rate: 80, per: "USER" },
      ],
    }
    const cells = componentTableCells(component, "INR")
    expect(cells.rate).toBe("2 Designation Rates")
  })

  it("MUG column shows the unit quantity plus a calculated value when calculable", () => {
    const component = { ...createComponent("recurring", "per_unit"), rate: 50, pricingUnit: "USER", mug: { enabled: true, minimumUnits: 5000 } }
    const cells = componentTableCells(component, "INR")
    expect(cells.mugQuantity).toBe("5,000 Users")
    expect(cells.mugCalculated).toBe("INR 2.5L")
  })

  it("MUG column shows only the quantity, no calculated value, for Designation Based", () => {
    const component = {
      ...createComponent("recurring", "designation_based"),
      designationRows: [{ id: "1", designation: "Sales Rep", rate: 50, per: "USER" }],
      mug: { enabled: true, minimumUnits: 5000 },
    }
    const cells = componentTableCells(component, "INR")
    expect(cells.mugQuantity).toBe("5,000 Users")
    expect(cells.mugCalculated).toBeNull()
  })

  it("MUG column is - when MUG is not enabled or not applicable", () => {
    const noMug = { ...createComponent("recurring", "per_unit"), rate: 50, pricingUnit: "USER" }
    expect(componentTableCells(noMug, "INR").mugQuantity).toBe("-")
    expect(componentTableCells(noMug, "INR").mugCalculated).toBeNull()

    const flatFee = { ...createComponent("recurring", "flat_fee"), amount: 200000 }
    expect(componentTableCells(flatFee, "INR").mugQuantity).toBe("-")
  })

  it("Invoice Cycle combines frequency and timing into one readable value", () => {
    const component = {
      ...createComponent("recurring", "flat_fee"),
      amount: 200000,
      invoiceTerms: { invoiceFrequency: "quarterly", invoiceTiming: "postpaid" },
    }
    expect(componentTableCells(component, "INR").invoiceCycle).toBe("Quarterly Postpaid")
  })

  it("Revenue Recognition is Monthly for Recurring, the chosen method for Non-Recurring, and - for On-Demand", () => {
    const recurring = { ...createComponent("recurring", "flat_fee"), amount: 200000 }
    expect(componentTableCells(recurring, "INR").revenueRecognition).toBe("Monthly")

    const nonRecurring = { ...createComponent("non_recurring", "flat_fee"), amount: 500000 }
    expect(componentTableCells(nonRecurring, "INR").revenueRecognition).toBe("Full Recognition")

    const onDemand = { ...createComponent("on_demand", "flat_fee"), amount: 50000 }
    expect(componentTableCells(onDemand, "INR").revenueRecognition).toBe("-")
  })

  it("falls back to a placeholder name for a still-blank component", () => {
    const component = createComponent("recurring", "flat_fee")
    expect(componentTableCells(component, "INR").name).toBe("Untitled component")
  })
})
