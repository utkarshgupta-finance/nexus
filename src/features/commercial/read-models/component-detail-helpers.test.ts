import { describe, expect, it } from "vitest"

import { latestEligibilityByBillingCalculationId, withCurrentFlag } from "./component-detail-helpers"
import type { EarnedResult, InvoiceEligibilityEvent } from "../domain/types"

// Fictional fixture data only.

function earnedResult(overrides: Partial<EarnedResult>): EarnedResult {
  return {
    id: "er-1",
    commercialComponentId: "comp-1",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    measurementDefinitionId: null,
    commercialCommitmentId: null,
    resultVersion: 1,
    supersedesEarnedResultId: null,
    rawQuantity: null,
    calculatedQuantity: null,
    calculatedAmount: 100,
    transactionCurrency: "USD",
    pricingCalculationVersion: "v1",
    roundingPolicyVersion: "v1",
    status: "open",
    finalizedAt: null,
    finalizedBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("withCurrentFlag", () => {
  it("marks the leaf of a supersession chain as current, not the root", () => {
    const v1 = earnedResult({ id: "er-1", resultVersion: 1, supersedesEarnedResultId: null })
    const v2 = earnedResult({ id: "er-2", resultVersion: 2, supersedesEarnedResultId: "er-1" })

    const result = withCurrentFlag([v1, v2])
    const byId = new Map(result.map((entry) => [entry.id, entry]))

    expect(byId.get("er-1")?.isCurrentForPeriod).toBe(false)
    expect(byId.get("er-2")?.isCurrentForPeriod).toBe(true)
  })

  it("marks every grain's own un-superseded leaf, across two independent periods", () => {
    const januaryRoot = earnedResult({ id: "jan-1", periodStart: "2026-01-01", periodEnd: "2026-01-31" })
    const februaryRoot = earnedResult({ id: "feb-1", periodStart: "2026-02-01", periodEnd: "2026-02-28" })

    const result = withCurrentFlag([januaryRoot, februaryRoot])

    expect(result.find((entry) => entry.id === "jan-1")?.isCurrentForPeriod).toBe(true)
    expect(result.find((entry) => entry.id === "feb-1")?.isCurrentForPeriod).toBe(true)
  })
})

function eligibilityEvent(overrides: Partial<InvoiceEligibilityEvent>): InvoiceEligibilityEvent {
  return {
    id: "evt-1",
    billingCalculationId: "bc-1",
    eligible: true,
    reason: "fictional reason",
    decidedBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("latestEligibilityByBillingCalculationId", () => {
  it("takes the first row per billing calculation id, trusting caller ordering", () => {
    // Matches data/billing.data.ts's own query ordering (created_at
    // desc, id desc): newest event first per billing_calculation_id.
    const newest = eligibilityEvent({ id: "evt-2", eligible: false, createdAt: "2026-01-02T00:00:00Z" })
    const oldest = eligibilityEvent({ id: "evt-1", eligible: true, createdAt: "2026-01-01T00:00:00Z" })

    const result = latestEligibilityByBillingCalculationId([newest, oldest])

    expect(result.get("bc-1")?.id).toBe("evt-2")
    expect(result.get("bc-1")?.eligible).toBe(false)
  })

  it("keeps separate billing calculations independent", () => {
    const forFirst = eligibilityEvent({ id: "evt-1", billingCalculationId: "bc-1" })
    const forSecond = eligibilityEvent({ id: "evt-2", billingCalculationId: "bc-2" })

    const result = latestEligibilityByBillingCalculationId([forFirst, forSecond])

    expect(result.size).toBe(2)
    expect(result.get("bc-1")?.id).toBe("evt-1")
    expect(result.get("bc-2")?.id).toBe("evt-2")
  })
})
