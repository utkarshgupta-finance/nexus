import { describe, expect, it } from "vitest"

import { persistedComponentTableCells, snapshotWithFrozenFxRate, toDraftComponent } from "./commercial-configuration-view"
import { REFERENCE_MASTER_FIXTURES } from "@/features/reference-data/domain/fixtures"
import type { CommercialComponent } from "@/features/commercial"

/**
 * Reconstruction must render a persisted Commercial Component through
 * the SAME Nexus vocabulary Customer Onboarding's own Commercial Rate
 * table uses (Per Unit / Flat Fee / Slab - Whole Quantity / Slab -
 * Progressive / Designation Based), never the old generic SaaS labels
 * (Linear / Volume-based / Graduated / Shared spend). These tests build
 * one component per pricing model matching the five components this
 * task's demo Commercial Configuration actually persists.
 */

function baseComponent(overrides: Partial<CommercialComponent>): CommercialComponent {
  return {
    id: "comp-1",
    commercialConfigurationId: "cfg-1",
    commercialChangeId: "chg-1",
    supersedesComponentId: null,
    measurementDefinitionId: null,
    isRecurring: true,
    pricingRuleKind: "linear",
    pricingRuleParameters: {},
    billingCadence: "monthly",
    billingTiming: "advance",
    billingQuantityBasis: "mug",
    reconciliationCadence: "monthly",
    transactionCurrency: "INR",
    fxSnapshotRate: null,
    effectiveFrom: "2026-09-01",
    effectiveTo: null,
    stableComponentKey: "comp-1",
    ...overrides,
  }
}

describe("toDraftComponent / persistedComponentTableCells: Nexus vocabulary, not the old generic SaaS labels", () => {
  it("Per Unit recurring (SFA + DMS) shows the actual rate and MUG value, never 'Linear'", () => {
    const component = baseComponent({
      pricingRuleKind: "linear",
      pricingRuleParameters: {
        name: "SFA + DMS",
        commercialNature: "recurring",
        invoiceFrequencyCode: "monthly",
        invoiceTimingCode: "advance",
        rate: 200,
        pricingUnit: "USER",
        mug: { minimumUnits: 500 },
      },
    })
    const { nature, cells } = persistedComponentTableCells(component, REFERENCE_MASTER_FIXTURES)
    expect(nature).toBe("recurring")
    expect(cells.pricing).toBe("Per Unit")
    expect(cells.pricing).not.toBe("Linear")
    expect(cells.rateLines.join(" ")).toContain("200")
    expect(cells.mugQuantityLines.join(" ")).toContain("500")
    expect(cells.mugCalculatedLines.join(" ")).toContain("1L")
  })

  it("Slab Progressive (Distributor Platform) shows every band's own rate, never 'Volume-based' or 'Graduated / tiered'", () => {
    const component = baseComponent({
      pricingRuleKind: "graduated",
      pricingRuleParameters: {
        name: "Distributor Platform",
        commercialNature: "recurring",
        invoiceFrequencyCode: "quarterly",
        invoiceTimingCode: "advance",
        tiers: [
          { from: 1, to: 100, rate: 500 },
          { from: 101, to: 200, rate: 450 },
          { from: 201, to: null, rate: 400 },
        ],
        slabMethod: "progressive",
        pricingUnit: "DISTRIBUTOR",
        mug: { minimumUnits: 150 },
      },
    })
    const { cells } = persistedComponentTableCells(component, REFERENCE_MASTER_FIXTURES)
    expect(cells.pricing).toBe("Slab - Progressive")
    expect(cells.pricing).not.toBe("Volume-based")
    expect(cells.pricing).not.toBe("Graduated / tiered")
    const rateText = cells.rateLines.join(" ")
    expect(rateText).toContain("500")
    expect(rateText).toContain("450")
    expect(rateText).toContain("400")
    expect(cells.mugQuantityLines.join(" ")).toContain("150")
  })

  it("Designation Based (Field Team) shows every designation's own rate, never a '3 Designation Rates' placeholder", () => {
    const component = baseComponent({
      pricingRuleKind: "dimension",
      pricingRuleParameters: {
        name: "Field Team",
        commercialNature: "recurring",
        invoiceFrequencyCode: "monthly",
        invoiceTimingCode: "advance",
        rates: [
          { designation: "Sales Rep", rate: 100, per: "USER" },
          { designation: "Manager", rate: 200, per: "USER" },
          { designation: "Admin", rate: 300, per: "USER" },
        ],
        mug: {
          designationMinimums: [
            { designationRowId: "sales-rep", minimumUnits: 500 },
            { designationRowId: "manager", minimumUnits: 50 },
            { designationRowId: "admin", minimumUnits: 10 },
          ],
        },
      },
    })
    const { cells } = persistedComponentTableCells(component, REFERENCE_MASTER_FIXTURES)
    expect(cells.pricing).toBe("Designation Based")
    const rateText = cells.rateLines.join(" ")
    expect(rateText).toContain("Sales Rep")
    expect(rateText).toContain("100")
    expect(rateText).toContain("Manager")
    expect(rateText).toContain("200")
    expect(rateText).toContain("Admin")
    expect(rateText).toContain("300")
    expect(rateText).not.toContain("3 Designation Rates")
    const mugText = cells.mugQuantityLines.join(" ")
    expect(mugText).toContain("500")
    expect(mugText).toContain("50")
    expect(mugText).toContain("10")
  })

  it("Flat Fee Non-Recurring Milestone Based (Implementation) shows each milestone's name/percent/amount and Advance/Postpaid, never a redundant One-Time line", () => {
    const component = baseComponent({
      isRecurring: false,
      pricingRuleKind: "flat",
      billingCadence: "one_time",
      reconciliationCadence: "one_time",
      pricingRuleParameters: {
        name: "Implementation",
        commercialNature: "non_recurring",
        invoiceFrequencyCode: "one_time",
        invoiceTimingCode: null,
        amount: 1000000,
        revenueRecognition: {
          method: "milestone_based",
          milestones: [
            { name: "Contract Signing", recognitionPercent: 50, invoiceTimingCode: "advance", recognitionAmount: 500000 },
            { name: "Go Live", recognitionPercent: 25, invoiceTimingCode: "postpaid", recognitionAmount: 250000 },
            { name: "Acceptance", recognitionPercent: 25, invoiceTimingCode: "postpaid", recognitionAmount: 250000 },
          ],
        },
      },
    })
    const { nature, cells } = persistedComponentTableCells(component, REFERENCE_MASTER_FIXTURES)
    expect(nature).toBe("non_recurring")
    expect(cells.pricing).toBe("Flat Fee")
    expect(cells.rateLines.join(" ")).toContain("10,00,000")
    const recognitionText = cells.revenueRecognitionLines.join(" ")
    expect(recognitionText).toContain("Contract Signing")
    expect(recognitionText).toContain("50")
    expect(recognitionText).toContain("5,00,000")
    expect(recognitionText).toContain("Go Live")
    expect(recognitionText).toContain("Acceptance")
    const cycleText = cells.invoiceCycleLines.join(" ")
    expect(cycleText).toContain("Contract Signing")
    expect(cycleText).toContain("Advance")
    expect(cycleText).toContain("Go Live")
    expect(cycleText).toContain("Postpaid")
    expect(cycleText).toContain("Acceptance")
    expect(cycleText).not.toContain("One-Time")
  })

  it("On-Demand Per Unit (WhatsApp) shows the actual per-message rate and Postpaid timing", () => {
    const component = baseComponent({
      isRecurring: false,
      pricingRuleKind: "linear",
      billingTiming: "arrears",
      billingQuantityBasis: null,
      pricingRuleParameters: {
        name: "WhatsApp",
        commercialNature: "on_demand",
        invoiceFrequencyCode: "monthly",
        invoiceTimingCode: "postpaid",
        rate: 0.15,
        pricingUnit: "MESSAGE",
      },
    })
    const { nature, cells } = persistedComponentTableCells(component, REFERENCE_MASTER_FIXTURES)
    expect(nature).toBe("on_demand")
    expect(cells.pricing).toBe("Per Unit")
    expect(cells.rateLines.join(" ")).toContain("0.15")
    expect(cells.invoiceCycleLines.join(" ")).toContain("Postpaid")
    expect(cells.mugQuantityLines.join(" ")).not.toMatch(/\d/)
  })
})

describe("toDraftComponent", () => {
  it("falls back to recurring/non_recurring from isRecurring when commercialNature is absent from an unrecognized parameter shape, never throwing", () => {
    const component = baseComponent({ pricingRuleKind: "flat", pricingRuleParameters: { amount: 5000 } })
    expect(() => toDraftComponent(component)).not.toThrow()
    expect(toDraftComponent(component).nature).toBe("recurring")
  })
})

describe("Slab-wise MUG reconstruction (stable identity: keyed by tier position, the same precedent already used for Slab band diffing)", () => {
  function slabWiseComponent(overrides: Partial<CommercialComponent> = {}): CommercialComponent {
    return baseComponent({
      pricingRuleKind: "volume",
      pricingRuleParameters: {
        name: "Distributor Platform",
        commercialNature: "recurring",
        invoiceFrequencyCode: "monthly",
        invoiceTimingCode: "advance",
        tiers: [
          { from: 1, to: 500, rate: 100, mug: 400 },
          { from: 501, to: 1000, rate: 80, mug: 200 },
          { from: 1001, to: null, rate: 60, mug: null },
        ],
        slabMethod: "whole_quantity",
        pricingUnit: "DISTRIBUTOR",
        slabMugMode: "slab_wise",
        mug: { minimumUnits: null },
      },
      ...overrides,
    })
  }

  it("6. Commercial Version change modifies slab MUG: reconstructing the new version's parameters reflects the new slab MUG values", () => {
    const oldVersion = slabWiseComponent({ id: "comp-old" })
    const oldDraft = toDraftComponent(oldVersion)
    expect(oldDraft.pricingModel).toBe("slab")
    if (oldDraft.pricingModel !== "slab" || !("slabMugMode" in oldDraft)) throw new Error("expected slab with MUG")
    expect(oldDraft.slabMugMode).toBe("slab_wise")
    expect(oldDraft.slabRows.map((row) => row.mug)).toEqual([400, 200, null])

    const newVersion = slabWiseComponent({
      id: "comp-new",
      supersedesComponentId: "comp-old",
      pricingRuleParameters: {
        ...oldVersion.pricingRuleParameters,
        tiers: [
          { from: 1, to: 500, rate: 100, mug: 450 },
          { from: 501, to: 1000, rate: 80, mug: 250 },
          { from: 1001, to: null, rate: 60, mug: 100 },
        ],
      },
    })
    const newDraft = toDraftComponent(newVersion)
    if (newDraft.pricingModel !== "slab" || !("slabMugMode" in newDraft)) throw new Error("expected slab with MUG")
    expect(newDraft.slabRows.map((row) => row.mug)).toEqual([450, 250, 100])
  })

  it("7. Old version retains its previous slab MUG: reconstructing an old and a new version independently never leaks state between them", () => {
    const oldVersion = slabWiseComponent({ id: "comp-old" })
    const newVersion = slabWiseComponent({
      id: "comp-new",
      supersedesComponentId: "comp-old",
      pricingRuleParameters: {
        ...oldVersion.pricingRuleParameters,
        tiers: [
          { from: 1, to: 500, rate: 100, mug: 999 },
          { from: 501, to: 1000, rate: 80, mug: 999 },
          { from: 1001, to: null, rate: 60, mug: 999 },
        ],
        slabMugMode: "overall",
        mug: { minimumUnits: 999 },
      },
    })

    const oldDraft = toDraftComponent(oldVersion)
    const newDraft = toDraftComponent(newVersion)
    if (oldDraft.pricingModel !== "slab" || !("slabMugMode" in oldDraft)) throw new Error("expected slab with MUG")
    if (newDraft.pricingModel !== "slab" || !("slabMugMode" in newDraft)) throw new Error("expected slab with MUG")
    expect(oldDraft.slabMugMode).toBe("slab_wise")
    expect(oldDraft.slabRows.map((row) => row.mug)).toEqual([400, 200, null])
    expect(newDraft.slabMugMode).toBe("overall")
    expect(newDraft.slabRows.map((row) => row.mug)).toEqual([999, 999, 999])
  })

  it("9. Approved version exposes correct slab MUG downstream: the persisted table cells show every band's own MUG and the calculated total", () => {
    const component = slabWiseComponent()
    const { cells } = persistedComponentTableCells(component, REFERENCE_MASTER_FIXTURES)
    expect(cells.pricing).toBe("Slab - Whole Quantity")
    const mugText = cells.mugQuantityLines.join(" ")
    expect(mugText).toContain("400")
    expect(mugText).toContain("200")
    expect(mugText).toContain("600")
  })
})

describe("snapshotWithFrozenFxRate", () => {
  it("overrides only the matching currency's inrConversionRate, leaving INR and other currencies untouched", () => {
    const withUsd = { ...REFERENCE_MASTER_FIXTURES, currency: [{ value: "USD", label: "USD", active: true, inrConversionRate: 83 }] }
    const frozen = snapshotWithFrozenFxRate(withUsd, "USD", 91.5)
    expect(frozen.currency.find((option) => option.value === "USD")?.inrConversionRate).toBe(91.5)
  })

  it("is a no-op for INR (never a real conversion rate) and when the frozen rate is null", () => {
    expect(snapshotWithFrozenFxRate(REFERENCE_MASTER_FIXTURES, "INR", 91.5)).toBe(REFERENCE_MASTER_FIXTURES)
    expect(snapshotWithFrozenFxRate(REFERENCE_MASTER_FIXTURES, "USD", null)).toBe(REFERENCE_MASTER_FIXTURES)
  })

  it("adds a currency entry when the live snapshot no longer has one, rather than silently dropping the frozen rate", () => {
    const withoutGbp = { ...REFERENCE_MASTER_FIXTURES, currency: REFERENCE_MASTER_FIXTURES.currency.filter((option) => option.value !== "GBP") }
    const frozen = snapshotWithFrozenFxRate(withoutGbp, "GBP", 105)
    expect(frozen.currency.find((option) => option.value === "GBP")?.inrConversionRate).toBe(105)
  })
})
