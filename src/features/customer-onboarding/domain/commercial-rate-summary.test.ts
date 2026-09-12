import { describe, expect, it } from "vitest"

import { summarizeComponent } from "./commercial-rate-summary"
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
