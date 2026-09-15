import { describe, expect, it } from "vitest"

import { computeMonthlyConsumption, computeMonthlyLedger } from "./consumption"

describe("computeMonthlyConsumption", () => {
  it("Case 1: usage > entitlement, MUG present -> consumption caps at entitlement, excess is Unbilled", () => {
    const result = computeMonthlyConsumption({ entitlementQuantity: 500, actualUsageQuantity: 600, mugQuantity: 500 })
    expect(result).toEqual({ actualUsageQuantity: 600, consumptionQuantity: 500, unbilledQuantity: 100, unearnedQuantity: 0 })
  })

  it("Case 2: usage < entitlement, MUG == entitlement -> consumption equals entitlement, actual usage stays unchanged and lower", () => {
    const result = computeMonthlyConsumption({ entitlementQuantity: 500, actualUsageQuantity: 400, mugQuantity: 500 })
    expect(result).toEqual({ actualUsageQuantity: 400, consumptionQuantity: 500, unbilledQuantity: 0, unearnedQuantity: 0 })
  })

  it("Case 3: usage < entitlement, no MUG -> consumption equals actual usage, remainder is Unearned", () => {
    const result = computeMonthlyConsumption({ entitlementQuantity: 500, actualUsageQuantity: 400, mugQuantity: null })
    expect(result).toEqual({ actualUsageQuantity: 400, consumptionQuantity: 400, unbilledQuantity: 0, unearnedQuantity: 100 })
  })

  it("usage exactly equal to entitlement, no MUG, produces zero Unbilled and zero Unearned", () => {
    const result = computeMonthlyConsumption({ entitlementQuantity: 500, actualUsageQuantity: 500, mugQuantity: null })
    expect(result).toEqual({ actualUsageQuantity: 500, consumptionQuantity: 500, unbilledQuantity: 0, unearnedQuantity: 0 })
  })

  it("MUG below entitlement and above usage: consumption is topped up only to the MUG floor, the rest above it is Unearned", () => {
    const result = computeMonthlyConsumption({ entitlementQuantity: 500, actualUsageQuantity: 200, mugQuantity: 300 })
    expect(result).toEqual({ actualUsageQuantity: 200, consumptionQuantity: 300, unbilledQuantity: 0, unearnedQuantity: 200 })
  })

  it("zero usage and zero entitlement produces zero everywhere, never a negative Unearned", () => {
    const result = computeMonthlyConsumption({ entitlementQuantity: 0, actualUsageQuantity: 0, mugQuantity: null })
    expect(result).toEqual({ actualUsageQuantity: 0, consumptionQuantity: 0, unbilledQuantity: 0, unearnedQuantity: 0 })
  })
})

describe("computeMonthlyLedger", () => {
  it("AUTO_FINALIZABLE runs the real MUG rules and marks the row auto_finalized", () => {
    const result = computeMonthlyLedger({ recognitionClass: "AUTO_FINALIZABLE", entitlementQuantity: 500, actualUsageQuantity: 600, mugQuantity: 500 })
    expect(result).toEqual({ actualUsageQuantity: 600, consumptionQuantity: 500, unbilledQuantity: 100, unearnedQuantity: 0, recognitionStatus: "auto_finalized" })
  })

  it("REQUIRES_MRR_RECOGNITION still reports raw usage but never fabricates consumption/unbilled/unearned", () => {
    const result = computeMonthlyLedger({ recognitionClass: "REQUIRES_MRR_RECOGNITION", entitlementQuantity: 500, actualUsageQuantity: 700, mugQuantity: null })
    expect(result).toEqual({ actualUsageQuantity: 700, consumptionQuantity: 0, unbilledQuantity: 0, unearnedQuantity: 0, recognitionStatus: "pending_mrr_recognition" })
  })

  it("10. Complex monthly usage (Slab, with a Slab-wise MUG configured) remains Pending MRR Recognition: a non-null mugQuantity is still never read", () => {
    const withoutMug = computeMonthlyLedger({ recognitionClass: "REQUIRES_MRR_RECOGNITION", entitlementQuantity: 500, actualUsageQuantity: 700, mugQuantity: null })
    const withSlabWiseMug = computeMonthlyLedger({ recognitionClass: "REQUIRES_MRR_RECOGNITION", entitlementQuantity: 500, actualUsageQuantity: 700, mugQuantity: 600 })
    expect(withSlabWiseMug).toEqual(withoutMug)
    expect(withSlabWiseMug).toEqual({ actualUsageQuantity: 700, consumptionQuantity: 0, unbilledQuantity: 0, unearnedQuantity: 0, recognitionStatus: "pending_mrr_recognition" })
  })
})
