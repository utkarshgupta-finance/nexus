import type { EarnedResult, InvoiceEligibilityEvent } from "../domain/types"
import type { EarnedResultSummary } from "./component-detail"

/**
 * Pure composition helpers for the Component Detail read model, kept in
 * their own file with zero dependency on data/services (so, transitively,
 * no dependency on the server-only Supabase client either). Split out so
 * this logic can be unit tested directly, without a server-only import
 * chain in the way; component-detail.ts imports these rather than
 * duplicating them.
 */

function withCurrentFlag(earnedResults: EarnedResult[]): EarnedResultSummary[] {
  const supersededIds = new Set(
    earnedResults.map((result) => result.supersedesEarnedResultId).filter((id): id is string => id !== null)
  )
  return earnedResults.map((result) => ({
    id: result.id,
    periodStart: result.periodStart,
    periodEnd: result.periodEnd,
    resultVersion: result.resultVersion,
    supersedesEarnedResultId: result.supersedesEarnedResultId,
    isCurrentForPeriod: !supersededIds.has(result.id),
    calculatedAmount: result.calculatedAmount,
    transactionCurrency: result.transactionCurrency,
    status: result.status,
    finalizedAt: result.finalizedAt,
  }))
}

function latestEligibilityByBillingCalculationId(
  events: InvoiceEligibilityEvent[]
): Map<string, InvoiceEligibilityEvent> {
  // events arrive newest-first per data/billing.data.ts's own ordering
  // (created_at desc, id desc); the first event seen per billing
  // calculation id is therefore already the latest one.
  const latest = new Map<string, InvoiceEligibilityEvent>()
  for (const event of events) {
    if (!latest.has(event.billingCalculationId)) {
      latest.set(event.billingCalculationId, event)
    }
  }
  return latest
}

export { withCurrentFlag, latestEligibilityByBillingCalculationId }
