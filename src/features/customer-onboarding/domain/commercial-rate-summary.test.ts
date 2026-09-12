import { describe, expect, it } from "vitest"

import { componentTableCells, dualCurrencyLines, formatAmount, formatCompactAmount, summarizeComponent } from "./commercial-rate-summary"
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

    const withMug = { ...withoutMug, mug: { enabled: true as const, minimumUnits: 5000, designationMinimums: [] } }
    const lines = summarizeComponent(withMug, "INR")
    const mugLine = lines.find((line) => line.startsWith("MUG"))
    expect(mugLine).toBeDefined()
    expect(mugLine).toContain("5,000")
    expect(mugLine).toContain("Users")
    expect(mugLine).not.toContain("INR")
  })

  it("appends a separate Calculated MUG Value line (money) alongside the unit-only MUG line, never merging the two", () => {
    const component = {
      ...createComponent("recurring", "per_unit"),
      rate: 50,
      pricingUnit: "USER",
      mug: { enabled: true as const, minimumUnits: 5000, designationMinimums: [] },
    }
    const lines = summarizeComponent(component, "INR")
    const calculatedLine = lines.find((line) => line.startsWith("Calculated MUG Value"))
    expect(calculatedLine).toBeDefined()
    expect(calculatedLine).toContain("2,50,000")
    expect(calculatedLine).toContain("Month")
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

describe("dualCurrencyLines (task correction §17-20: transaction currency + INR equivalent)", () => {
  it("is a single line for INR: nothing to convert", () => {
    expect(dualCurrencyLines(200000, "INR", "", formatAmount)).toEqual(["INR 2,00,000"])
  })

  it("is two lines for a foreign currency with a configured rate: transaction amount, then INR equivalent", () => {
    expect(dualCurrencyLines(100, "USD", " / User", formatAmount)).toEqual(["USD 100 / User", "INR 9,100 / User"])
  })

  it("is a single line when the foreign currency has no configured rate, never a fabricated conversion", () => {
    expect(dualCurrencyLines(100, "IDR", "", formatAmount)).toEqual(["IDR 100"])
  })

  it("is an empty array for a null amount", () => {
    expect(dualCurrencyLines(null, "USD", "", formatAmount)).toEqual([])
  })
})

describe("componentTableCells (Commercial Components table, task corrections §4-11 and the table-structure/FX corrections)", () => {
  it("Per Unit: Pricing is the model name, Rate is the value-only summary, never raw enum codes", () => {
    const component = { ...createComponent("recurring", "per_unit"), description: "SFA", rate: 50, pricingUnit: "USER" }
    const cells = componentTableCells(component, "INR")
    expect(cells.name).toBe("SFA")
    expect(cells.nature).toBe("Recurring")
    expect(cells.pricing).toBe("Per Unit")
    expect(cells.rateLines).toEqual(["INR 50 / User"])
  })

  it("Per Unit: shows both the transaction currency rate and its INR equivalent for a foreign Billing Currency", () => {
    const component = { ...createComponent("recurring", "per_unit"), description: "SFA", rate: 100, pricingUnit: "USER" }
    expect(componentTableCells(component, "USD").rateLines).toEqual(["USD 100 / User", "INR 9,100 / User"])
  })

  it("Flat Fee: Rate is the plain amount, plus INR equivalent for a foreign currency", () => {
    const component = { ...createComponent("non_recurring", "flat_fee"), description: "Implementation", amount: 500000 }
    expect(componentTableCells(component, "INR").rateLines).toEqual(["INR 5,00,000"])

    const foreign = { ...createComponent("non_recurring", "flat_fee"), description: "Implementation", amount: 10000 }
    expect(componentTableCells(foreign, "USD").rateLines).toEqual(["USD 10,000", "INR 9,10,000"])
  })

  it("Slab: Pricing names the Method, Rate shows the actual per-band rates, never a row-count-only summary", () => {
    const component = {
      ...createComponent("recurring", "slab"),
      description: "DMS",
      pricingUnit: "DISTRIBUTOR",
      slabMethod: "whole_quantity" as const,
      slabRows: [
        { id: "1", from: 1, to: 100, rate: 500 },
        { id: "2", from: 101, to: null, rate: 400 },
      ],
    }
    const cells = componentTableCells(component, "INR")
    expect(cells.pricing).toBe("Slab - Whole Quantity")
    expect(cells.rateLines).toEqual(["1-100: INR 500 / Distributor", "101+: INR 400 / Distributor"])
    // Task correction §7: never only the method/unit with no actual rate.
    expect(cells.rateLines.join(" ")).not.toMatch(/^Whole Quantity \/ Distributor$/)
  })

  it("Slab: Pricing names Progressive when that Method is chosen, Rate still shows actual per-band rates", () => {
    const component = {
      ...createComponent("recurring", "slab"),
      description: "DMS",
      pricingUnit: "USER",
      slabMethod: "progressive" as const,
      slabRows: [
        { id: "1", from: 1, to: 100, rate: 500 },
        { id: "2", from: 101, to: 200, rate: 450 },
        { id: "3", from: 201, to: null, rate: 400 },
      ],
    }
    const cells = componentTableCells(component, "INR")
    expect(cells.pricing).toBe("Slab - Progressive")
    expect(cells.rateLines).toEqual(["1-100: INR 500 / User", "101-200: INR 450 / User", "201+: INR 400 / User"])
  })

  it("Slab: shows both transaction currency and INR equivalent per band for a foreign Billing Currency", () => {
    const component = {
      ...createComponent("recurring", "slab"),
      description: "DMS",
      pricingUnit: "USER",
      slabMethod: "whole_quantity" as const,
      slabRows: [
        { id: "1", from: 1, to: 100, rate: 10 },
        { id: "2", from: 101, to: 200, rate: 9 },
        { id: "3", from: 201, to: null, rate: 8 },
      ],
    }
    const cells = componentTableCells(component, "USD")
    expect(cells.rateLines).toEqual(["1-100: USD 10 / User (INR 910 / User)", "101-200: USD 9 / User (INR 819 / User)", "201+: USD 8 / User (INR 728 / User)"])
  })

  it("Designation Based: Rate shows the actual per-designation rates, never a row-count-only summary", () => {
    const component = {
      ...createComponent("recurring", "designation_based"),
      description: "Field Team",
      designationRows: [
        { id: "1", designation: "Sales Rep", rate: 100, per: "USER" },
        { id: "2", designation: "Manager", rate: 200, per: "USER" },
      ],
    }
    const cells = componentTableCells(component, "INR")
    expect(cells.rateLines).toEqual(["Sales Rep: INR 100 / User", "Manager: INR 200 / User"])
    expect(cells.rateLines.join(" ")).not.toBe("2 Designation Rates")
  })

  it("Designation Based: shows both transaction currency and INR equivalent per designation for a foreign Billing Currency", () => {
    const component = {
      ...createComponent("recurring", "designation_based"),
      description: "Field Team",
      designationRows: [
        { id: "1", designation: "Sales Rep", rate: 10, per: "USER" },
        { id: "2", designation: "Manager", rate: 15, per: "USER" },
      ],
    }
    const cells = componentTableCells(component, "GBP")
    expect(cells.rateLines).toEqual(["Sales Rep: GBP 10 / User (INR 1,210 / User)", "Manager: GBP 15 / User (INR 1,815 / User)"])
  })

  it("Designation Based: collapses beyond 4 rows into a restrained '+N more' line", () => {
    const component = {
      ...createComponent("recurring", "designation_based"),
      description: "Field Team",
      designationRows: [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), designation: `Role ${n}`, rate: n * 10, per: "USER" })),
    }
    const cells = componentTableCells(component, "INR")
    expect(cells.rateLines).toHaveLength(5)
    expect(cells.rateLines[4]).toBe("+2 more")
  })

  it("MUG column shows the unit quantity plus a calculated value when calculable, dual currency for a foreign Billing Currency", () => {
    const component = {
      ...createComponent("recurring", "per_unit"),
      rate: 50,
      pricingUnit: "USER",
      mug: { enabled: true as const, minimumUnits: 5000, designationMinimums: [] },
    }
    const cellsInr = componentTableCells(component, "INR")
    expect(cellsInr.mugQuantityLines).toEqual(["5,000 Users"])
    expect(cellsInr.mugCalculatedLines).toEqual(["INR 2.5L / Month"])

    const cellsUsd = componentTableCells(component, "USD")
    expect(cellsUsd.mugCalculatedLines).toEqual(["USD 2.5L / Month", "INR 227.5L / Month"])
  })

  it("Designation Based MUG column shows a per-designation breakdown plus a Total line, and a calculated value (task correction §2-3, §11)", () => {
    const component = {
      ...createComponent("recurring", "designation_based"),
      designationRows: [
        { id: "sales", designation: "Sales Rep", rate: 100, per: "USER" },
        { id: "manager", designation: "Manager", rate: 200, per: "USER" },
      ],
      mug: {
        enabled: true as const,
        minimumUnits: null,
        designationMinimums: [
          { designationRowId: "sales", minimumUnits: 500 },
          { designationRowId: "manager", minimumUnits: 50 },
        ],
      },
    }
    const cells = componentTableCells(component, "INR")
    expect(cells.mugQuantityLines).toEqual(["Sales Rep: 500", "Manager: 50", "Total: 550 Users"])
    expect(cells.mugCalculatedLines).toEqual(["INR 60K / Month"])
  })

  it("MUG column is - when MUG is not enabled or not applicable", () => {
    const noMug = { ...createComponent("recurring", "per_unit"), rate: 50, pricingUnit: "USER" }
    expect(componentTableCells(noMug, "INR").mugQuantityLines).toEqual(["-"])
    expect(componentTableCells(noMug, "INR").mugCalculatedLines).toEqual([])

    const flatFee = { ...createComponent("recurring", "flat_fee"), amount: 200000 }
    expect(componentTableCells(flatFee, "INR").mugQuantityLines).toEqual(["-"])
  })

  it("Invoice Cycle combines frequency and timing into one readable value", () => {
    const component = {
      ...createComponent("recurring", "flat_fee"),
      amount: 200000,
      invoiceTerms: { invoiceFrequency: "quarterly", invoiceTiming: "postpaid" },
    }
    expect(componentTableCells(component, "INR").invoiceCycle).toBe("Quarterly Postpaid")
  })

  it("Invoice Cycle shows Frequency alone for a Milestone Based Non-Recurring component, since Timing lives per milestone instead (task correction §6)", () => {
    const component = {
      ...createComponent("non_recurring", "flat_fee"),
      amount: 500000,
      invoiceTerms: { invoiceFrequency: "one_time", invoiceTiming: null },
      revenueRecognition: {
        method: "milestone_based" as const,
        milestones: [{ ...createMilestone(), name: "Go-Live", recognitionPercent: 100, invoiceTiming: "advance" }],
      },
    }
    expect(componentTableCells(component, "INR").invoiceCycle).toBe("One-Time")
  })

  it("Revenue Recognition is Monthly for Recurring, the chosen method for Non-Recurring, and - for On-Demand", () => {
    const recurring = { ...createComponent("recurring", "flat_fee"), amount: 200000 }
    expect(componentTableCells(recurring, "INR").revenueRecognition).toBe("Monthly")

    const nonRecurring = { ...createComponent("non_recurring", "flat_fee"), amount: 500000 }
    expect(componentTableCells(nonRecurring, "INR").revenueRecognition).toBe("Full Recognition")

    const onDemand = { ...createComponent("on_demand", "flat_fee"), amount: 50000 }
    expect(componentTableCells(onDemand, "INR").revenueRecognition).toBe("-")
  })

  it("Effective From is formatted for the table, or - when not set", () => {
    const withDate = { ...createComponent("recurring", "flat_fee"), amount: 200000, effectiveFrom: "2026-10-01" }
    expect(componentTableCells(withDate, "INR").effectiveFrom).toBe("01-Oct-2026")
    const withoutDate = { ...createComponent("recurring", "flat_fee"), amount: 200000 }
    expect(componentTableCells(withoutDate, "INR").effectiveFrom).toBe("-")
  })

  it("falls back to a placeholder name for a still-blank component", () => {
    const component = createComponent("recurring", "flat_fee")
    expect(componentTableCells(component, "INR").name).toBe("Untitled component")
  })
})
