/**
 * MUG consumption rules (Go Live + Entitlement Ledger, Phase J), for
 * SIMPLE per-unit metrics only (AUTO_FINALIZABLE pricing models, see
 * ./pricing-classification.ts). Pure, no I/O, directly unit-testable
 * against the product brief's own three worked cases.
 *
 * General rule: committed consumption = max(actual usage, applicable
 * MUG), then compare committed consumption against monthly entitlement.
 * Actual usage is never overwritten by MUG or by consumption: usage,
 * consumption, unbilled, and unearned are four separate facts, always
 * computed together, never confused with each other.
 */
type MonthlyConsumptionResult = {
  actualUsageQuantity: number
  consumptionQuantity: number
  unbilledQuantity: number
  unearnedQuantity: number
}

/**
 * Case 1 (usage > entitlement): consumption caps at entitlement itself;
 * MUG is irrelevant once usage already exceeds entitlement. Excess
 * becomes Unbilled.
 *
 * Case 2 (usage < entitlement, MUG present): committed consumption is
 * max(usage, MUG). When MUG equals entitlement, consumption equals
 * entitlement (Unbilled 0, Unearned 0) while actual usage is reported
 * unchanged, lower than consumption. When MUG is below entitlement,
 * consumption is only topped up to the MUG floor, and the entitlement
 * still unused above that floor becomes Unearned.
 *
 * Case 3 (usage < entitlement, no MUG): consumption is exactly actual
 * usage; the unused entitlement above it becomes Unearned.
 */
function computeMonthlyConsumption(input: { entitlementQuantity: number; actualUsageQuantity: number; mugQuantity: number | null }): MonthlyConsumptionResult {
  const { entitlementQuantity, actualUsageQuantity, mugQuantity } = input

  if (actualUsageQuantity > entitlementQuantity) {
    return {
      actualUsageQuantity,
      consumptionQuantity: entitlementQuantity,
      unbilledQuantity: actualUsageQuantity - entitlementQuantity,
      unearnedQuantity: 0,
    }
  }

  const committedConsumption = mugQuantity !== null ? Math.max(actualUsageQuantity, mugQuantity) : actualUsageQuantity
  const consumptionQuantity = Math.min(committedConsumption, entitlementQuantity)

  return {
    actualUsageQuantity,
    consumptionQuantity,
    unbilledQuantity: 0,
    unearnedQuantity: Math.max(entitlementQuantity - consumptionQuantity, 0),
  }
}

/**
 * Composes pricing classification with the consumption rules (Phase
 * K). For AUTO_FINALIZABLE pricing (Per Unit, Flat Fee), the simple
 * MUG rules above run and the ledger row auto-finalizes. For a complex
 * multi-rate model (Slab, Progressive Slab, Designation-based), raw
 * usage is still captured and reported, but consumption/unbilled/
 * unearned are deliberately left at zero rather than applying a
 * simple-quantity formula that was never designed for a multi-rate
 * model: the row is always PENDING_MRR_RECOGNITION, never a fabricated
 * recognized result.
 */
type MonthlyLedgerComputation = MonthlyConsumptionResult & { recognitionStatus: "auto_finalized" | "pending_mrr_recognition" }

function computeMonthlyLedger(input: {
  recognitionClass: "AUTO_FINALIZABLE" | "REQUIRES_MRR_RECOGNITION"
  entitlementQuantity: number
  actualUsageQuantity: number
  mugQuantity: number | null
}): MonthlyLedgerComputation {
  if (input.recognitionClass === "REQUIRES_MRR_RECOGNITION") {
    return { actualUsageQuantity: input.actualUsageQuantity, consumptionQuantity: 0, unbilledQuantity: 0, unearnedQuantity: 0, recognitionStatus: "pending_mrr_recognition" }
  }

  const result = computeMonthlyConsumption(input)
  return { ...result, recognitionStatus: "auto_finalized" }
}

export { computeMonthlyConsumption, computeMonthlyLedger }
export type { MonthlyConsumptionResult, MonthlyLedgerComputation }
