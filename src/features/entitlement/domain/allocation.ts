import { addMonths, monthRange } from "@/lib/month"
import type { MonthKey } from "@/lib/month"

/**
 * Deterministic monthly allocation math (Go Live + Entitlement Ledger,
 * Phase G). Pure, no I/O: the RPC (generate_allocation_schedule) only
 * ever persists what this function already computed.
 *
 * "6,000 annual users, 12 months, Go Live July -> 500/month Jul-Jun":
 * allocation is always anchored at (and counted from) the START month
 * given here, never the invoice date. The caller decides that start
 * month: the Go Live month for a brand new period, or the next
 * unallocated month of an existing period when topping one up.
 */
type MonthlyAllocationEntry = { month: MonthKey; quantity: number }

/**
 * Splits `totalQuantity` evenly across `monthCount` consecutive months
 * starting at `startMonth`. An uneven division never silently drops a
 * unit: the remainder is added to the FINAL month (task's own stated
 * preference, absent a more specific Finance convention). Quantity
 * precision matches the input's own precision (no artificial rounding
 * beyond what the division itself introduces at 2 decimal places, the
 * common metric-quantity precision every worked example in the product
 * brief uses).
 */
function allocateEvenly(totalQuantity: number, startMonth: MonthKey, monthCount: number): MonthlyAllocationEntry[] {
  if (monthCount <= 0) return []

  const months = monthRange(startMonth, addMonths(startMonth, monthCount - 1))
  const baseQuantity = Math.floor((totalQuantity / monthCount) * 100) / 100
  const allocatedBeforeFinal = baseQuantity * (monthCount - 1)
  const finalMonthQuantity = Math.round((totalQuantity - allocatedBeforeFinal) * 100) / 100

  return months.map((month, index) => ({
    month,
    quantity: index === months.length - 1 ? finalMonthQuantity : baseQuantity,
  }))
}

export { allocateEvenly }
export type { MonthlyAllocationEntry }
