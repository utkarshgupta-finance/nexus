import { describe, expect, it } from "vitest"

import { mapOnboardingComponentToCommercialComponentInsert, mugThresholdValue, toBillingCadence, toBillingQuantityBasis, toBillingTiming } from "./commercial-configuration-promotion"
import { createComponent, createMilestone } from "./commercial-rate"
import { REFERENCE_MASTER_FIXTURES } from "@/features/reference-data/domain/fixtures"

const EFFECTIVE_FROM = "2026-10-01"

describe("toBillingTiming", () => {
  it("maps advance to advance", () => {
    expect(toBillingTiming("advance")).toBe("advance")
  })
  it("maps postpaid to arrears", () => {
    expect(toBillingTiming("postpaid")).toBe("arrears")
  })
  it("defaults to arrears when null (never actually reached for a promotable draft)", () => {
    expect(toBillingTiming(null)).toBe("arrears")
  })
})

describe("toBillingCadence", () => {
  it("passes through every real Reference Master invoice_frequency code", () => {
    expect(toBillingCadence("monthly", "one_time")).toBe("monthly")
    expect(toBillingCadence("quarterly", "one_time")).toBe("quarterly")
    expect(toBillingCadence("half_yearly", "one_time")).toBe("half_yearly")
    expect(toBillingCadence("annual", "one_time")).toBe("annual")
    expect(toBillingCadence("one_time", "monthly")).toBe("one_time")
  })
  it("falls back for an unrecognized or null code (On-Demand's optional frequency)", () => {
    expect(toBillingCadence(null, "one_time")).toBe("one_time")
    expect(toBillingCadence(null, "monthly")).toBe("monthly")
  })
})

describe("toBillingQuantityBasis", () => {
  it("is null for arrears, regardless of MUG", () => {
    expect(toBillingQuantityBasis("arrears", { enabled: true, minimumUnits: 100, designationMinimums: [] })).toBeNull()
    expect(toBillingQuantityBasis("arrears", { enabled: false })).toBeNull()
  })
  it("is 'mug' for advance with MUG enabled", () => {
    expect(toBillingQuantityBasis("advance", { enabled: true, minimumUnits: 100, designationMinimums: [] })).toBe("mug")
  })
  it("is 'previous_period_actual' for advance with no MUG", () => {
    expect(toBillingQuantityBasis("advance", { enabled: false })).toBe("previous_period_actual")
    expect(toBillingQuantityBasis("advance", null)).toBe("previous_period_actual")
  })
})

describe("mugThresholdValue", () => {
  it("is null when MUG is disabled", () => {
    const component = { ...createComponent("recurring", "per_unit"), rate: 50, pricingUnit: "USER" }
    expect(mugThresholdValue(component)).toBeNull()
  })

  it("is the plain minimumUnits for Per Unit/Slab", () => {
    const component = {
      ...createComponent("recurring", "per_unit"),
      rate: 50,
      pricingUnit: "USER",
      mug: { enabled: true as const, minimumUnits: 5000, designationMinimums: [] },
    }
    expect(mugThresholdValue(component)).toBe(5000)
  })

  it("is the sum of every designation's own Minimum Units for Designation Based", () => {
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
    expect(mugThresholdValue(component)).toBe(550)
  })

  it("is null when no designation has a Minimum Units entered yet, never a fabricated zero", () => {
    const component = {
      ...createComponent("recurring", "designation_based"),
      mug: { enabled: true as const, minimumUnits: null, designationMinimums: [] },
    }
    expect(mugThresholdValue(component)).toBeNull()
  })
})

describe("mapOnboardingComponentToCommercialComponentInsert", () => {
  it("Per Unit Recurring: linear pricing_rule_kind, monthly cadence, arrears with no MUG", () => {
    const component = {
      ...createComponent("recurring", "per_unit"),
      description: "SFA",
      rate: 50,
      pricingUnit: "USER",
      invoiceTerms: { invoiceFrequency: "monthly", invoiceTiming: "postpaid" },
    }
    const result = mapOnboardingComponentToCommercialComponentInsert(component, REFERENCE_MASTER_FIXTURES, "INR", EFFECTIVE_FROM)
    expect(result.isRecurring).toBe(true)
    expect(result.pricingRuleKind).toBe("linear")
    expect(result.pricingRuleParameters).toMatchObject({ rate: 50, pricingUnit: "USER", commercialNature: "recurring" })
    expect(result.billingCadence).toBe("monthly")
    expect(result.billingTiming).toBe("arrears")
    expect(result.billingQuantityBasis).toBeNull()
    expect(result.reconciliationCadence).toBe("monthly")
    expect(result.transactionCurrency).toBe("INR")
    expect(result.fxSnapshotRate).toBeNull()
    expect(result.effectiveFrom).toBe(EFFECTIVE_FROM)
    expect(result.mugThresholdValue).toBeNull()
  })

  it("Per Unit Recurring with MUG, advance timing: billing_quantity_basis = mug, mug carried in pricing_rule_parameters", () => {
    const component = {
      ...createComponent("recurring", "per_unit"),
      description: "SFA",
      rate: 50,
      pricingUnit: "USER",
      invoiceTerms: { invoiceFrequency: "monthly", invoiceTiming: "advance" },
      mug: { enabled: true as const, minimumUnits: 5000, designationMinimums: [] },
    }
    const result = mapOnboardingComponentToCommercialComponentInsert(component, REFERENCE_MASTER_FIXTURES, "INR", EFFECTIVE_FROM)
    expect(result.billingTiming).toBe("advance")
    expect(result.billingQuantityBasis).toBe("mug")
    expect(result.mugThresholdValue).toBe(5000)
    expect(result.pricingRuleParameters.mug).toEqual({ minimumUnits: 5000 })
  })

  it("Flat Fee: flat pricing_rule_kind, amount key present", () => {
    const component = {
      ...createComponent("recurring", "flat_fee"),
      description: "Platform Fee",
      amount: 200000,
      invoiceTerms: { invoiceFrequency: "monthly", invoiceTiming: "advance" },
    }
    const result = mapOnboardingComponentToCommercialComponentInsert(component, REFERENCE_MASTER_FIXTURES, "INR", EFFECTIVE_FROM)
    expect(result.pricingRuleKind).toBe("flat")
    expect(result.pricingRuleParameters.amount).toBe(200000)
  })

  it("Slab Whole Quantity: pricing_rule_kind 'volume', tiers array carries every band", () => {
    const component = {
      ...createComponent("recurring", "slab"),
      description: "DMS",
      pricingUnit: "DISTRIBUTOR",
      slabMethod: "whole_quantity" as const,
      slabRows: [
        { id: "1", from: 1, to: 100, rate: 500 },
        { id: "2", from: 101, to: null, rate: 400 },
      ],
      invoiceTerms: { invoiceFrequency: "monthly", invoiceTiming: "advance" },
    }
    const result = mapOnboardingComponentToCommercialComponentInsert(component, REFERENCE_MASTER_FIXTURES, "INR", EFFECTIVE_FROM)
    expect(result.pricingRuleKind).toBe("volume")
    expect(result.pricingRuleParameters.tiers).toEqual([
      { from: 1, to: 100, rate: 500 },
      { from: 101, to: null, rate: 400 },
    ])
    expect(result.pricingRuleParameters.slabMethod).toBe("whole_quantity")
  })

  it("Slab Progressive: pricing_rule_kind 'graduated'", () => {
    const component = {
      ...createComponent("recurring", "slab"),
      pricingUnit: "USER",
      slabMethod: "progressive" as const,
      slabRows: [{ id: "1", from: 1, to: null, rate: 90 }],
      invoiceTerms: { invoiceFrequency: "monthly", invoiceTiming: "advance" },
    }
    const result = mapOnboardingComponentToCommercialComponentInsert(component, REFERENCE_MASTER_FIXTURES, "INR", EFFECTIVE_FROM)
    expect(result.pricingRuleKind).toBe("graduated")
  })

  it("Designation Based: pricing_rule_kind 'dimension', rates array plus per-designation MUG minimums", () => {
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
      invoiceTerms: { invoiceFrequency: "monthly", invoiceTiming: "postpaid" },
    }
    const result = mapOnboardingComponentToCommercialComponentInsert(component, REFERENCE_MASTER_FIXTURES, "INR", EFFECTIVE_FROM)
    expect(result.pricingRuleKind).toBe("dimension")
    expect(result.pricingRuleParameters.rates).toEqual([
      { designation: "Sales Rep", rate: 100, per: "USER" },
      { designation: "Manager", rate: 200, per: "USER" },
    ])
    expect(result.pricingRuleParameters.mug).toEqual({
      designationMinimums: [
        { designationRowId: "sales", minimumUnits: 500 },
        { designationRowId: "manager", minimumUnits: 50 },
      ],
    })
    expect(result.mugThresholdValue).toBe(550)
  })

  it("Non-Recurring Full Recognition: billing_cadence one_time, commercialNature preserved, no equivalent BillingCadence value invented", () => {
    const component = {
      ...createComponent("non_recurring", "flat_fee"),
      description: "Implementation",
      amount: 500000,
      invoiceTerms: { invoiceFrequency: "one_time", invoiceTiming: "advance" },
    }
    const result = mapOnboardingComponentToCommercialComponentInsert(component, REFERENCE_MASTER_FIXTURES, "INR", EFFECTIVE_FROM)
    expect(result.isRecurring).toBe(false)
    expect(result.billingCadence).toBe("one_time")
    expect(result.reconciliationCadence).toBe("one_time")
    expect(result.billingTiming).toBe("advance")
    expect(result.pricingRuleParameters.commercialNature).toBe("non_recurring")
    expect(result.pricingRuleParameters.revenueRecognition).toEqual({ method: "full_recognition" })
  })

  it("Non-Recurring Milestone Based: every milestone's own recognitionAmount calculated and carried, billing_timing from the first milestone", () => {
    const component = {
      ...createComponent("non_recurring", "flat_fee"),
      amount: 1000000,
      invoiceTerms: { invoiceFrequency: "one_time", invoiceTiming: null },
      revenueRecognition: {
        method: "milestone_based" as const,
        milestones: [
          { ...createMilestone(), name: "Contract Signing", recognitionPercent: 50, invoiceTiming: "advance" },
          { ...createMilestone(), name: "Go Live", recognitionPercent: 50, invoiceTiming: "postpaid" },
        ],
      },
    }
    const result = mapOnboardingComponentToCommercialComponentInsert(component, REFERENCE_MASTER_FIXTURES, "INR", EFFECTIVE_FROM)
    expect(result.billingTiming).toBe("advance")
    const revenueRecognition = result.pricingRuleParameters.revenueRecognition as {
      method: string
      milestones: { name: string; recognitionPercent: number | null; invoiceTimingCode: string | null; recognitionAmount: number | null }[]
    }
    expect(revenueRecognition.method).toBe("milestone_based")
    expect(revenueRecognition.milestones).toEqual([
      { name: "Contract Signing", recognitionPercent: 50, invoiceTimingCode: "advance", recognitionAmount: 500000 },
      { name: "Go Live", recognitionPercent: 50, invoiceTimingCode: "postpaid", recognitionAmount: 500000 },
    ])
  })

  it("On-Demand with no chosen Invoice Frequency: billing_cadence falls back to one_time, never a fabricated recurring cadence", () => {
    const component = {
      ...createComponent("on_demand", "flat_fee"),
      amount: 50000,
      invoiceTerms: { invoiceFrequency: null, invoiceTiming: "advance" },
    }
    const result = mapOnboardingComponentToCommercialComponentInsert(component, REFERENCE_MASTER_FIXTURES, "INR", EFFECTIVE_FROM)
    expect(result.isRecurring).toBe(false)
    expect(result.billingCadence).toBe("one_time")
    expect(result.pricingRuleParameters.commercialNature).toBe("on_demand")
  })

  it("foreign Billing Currency: freezes the current Reference Master rate into fxSnapshotRate", () => {
    const component = {
      ...createComponent("recurring", "flat_fee"),
      amount: 1000,
      invoiceTerms: { invoiceFrequency: "monthly", invoiceTiming: "advance" },
    }
    const result = mapOnboardingComponentToCommercialComponentInsert(component, REFERENCE_MASTER_FIXTURES, "USD", EFFECTIVE_FROM)
    expect(result.transactionCurrency).toBe("USD")
    expect(result.fxSnapshotRate).toBe(91)
  })

  it("INR Billing Currency: fxSnapshotRate is always null, matching chk_commercial_components_fx_snapshot_shape", () => {
    const component = { ...createComponent("recurring", "flat_fee"), amount: 1000, invoiceTerms: { invoiceFrequency: "monthly", invoiceTiming: "advance" } }
    const result = mapOnboardingComponentToCommercialComponentInsert(component, REFERENCE_MASTER_FIXTURES, "INR", EFFECTIVE_FROM)
    expect(result.fxSnapshotRate).toBeNull()
  })
})
