import { describe, expect, it } from "vitest"

import { summarizeComponent } from "./commercial-rate-summary"
import { createComponent } from "./commercial-rate"

/**
 * Display-only summaries (task spec §31): these never imply a real
 * invoice was calculated, so the assertions below check the text is
 * present and readable, not that it matches a billing engine's output.
 */
describe("summarizeComponent", () => {
  it("formats a Per Unit component as rate / unit / cycle", () => {
    const component = {
      ...createComponent("recurring", "per_unit"),
      rate: 50,
      pricingUnit: "USER",
      billingTerms: { billingCycle: "monthly", billingTiming: "advance", paymentTerms: { paymentTermsCode: "due_on_receipt", customPaymentDays: null } },
    }
    const lines = summarizeComponent(component, "INR")
    expect(lines[0]).toContain("50")
    expect(lines[0]).toContain("User")
    expect(lines[0]).toContain("Monthly")
  })

  it("formats Non-Recurring as a one-time amount, no cycle/unit noise", () => {
    const component = { ...createComponent("non_recurring"), amount: 500000 }
    const lines = summarizeComponent(component, "INR")
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain("5,00,000")
    expect(lines[0]).toContain("one-time")
  })

  it("formats each Slab row as its own range line", () => {
    const component = {
      ...createComponent("recurring", "slab"),
      pricingUnit: "USER",
      slabRows: [
        { id: "1", from: 1, to: 100, rate: 100 },
        { id: "2", from: 101, to: null, rate: 90 },
      ],
    }
    const lines = summarizeComponent(component, "INR")
    expect(lines[0]).toContain("1-100")
    expect(lines[1]).toContain("101+")
  })

  it("appends a MUG line only when MUG is enabled", () => {
    const withoutMug = { ...createComponent("recurring", "flat_fee"), recurringAmount: 200000 }
    expect(summarizeComponent(withoutMug, "INR").some((line) => line.startsWith("MUG"))).toBe(false)

    const withMug = { ...withoutMug, mug: { enabled: true, amount: 200000, frequency: "monthly" } as const }
    const lines = summarizeComponent(withMug, "INR")
    expect(lines.some((line) => line.startsWith("MUG"))).toBe(true)
  })
})
