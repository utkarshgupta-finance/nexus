/**
 * Month-key utilities (Go Live + Entitlement Ledger, Phase U). No such
 * utility existed anywhere in this codebase before (confirmed by
 * inspection of src/lib/date.ts): every usage/allocation/settlement
 * month in this domain is a first-of-month `date` value at the
 * database layer, and a canonical `YYYY-MM` string wherever the UI or
 * a cross-boundary contract needs one. Never `new Date("YYYY-MM-DD")`
 * for business semantics (docs/UI_SYSTEM.md's own business-date rule);
 * every function here is pure string/date-part arithmetic, UTC-anchored
 * exactly like ../date.ts's own BusinessDateParts.
 */

type MonthKey = string

/** "2026-07-01" (or any day in July 2026) -> "2026-07". */
function toMonthKey(businessDate: string): MonthKey {
  return businessDate.slice(0, 7)
}

/** "2026-07" -> "2026-07-01": the canonical first-of-month business date this domain stores. */
function monthKeyToBusinessDate(monthKey: MonthKey): string {
  return `${monthKey}-01`
}

function parseMonthKey(monthKey: MonthKey): { year: number; month: number } {
  const [year, month] = monthKey.split("-").map(Number)
  return { year, month }
}

/** "2026-07" + 1 -> "2026-08"; + (-1) -> "2026-06". Pure integer month arithmetic, never a Date object. */
function addMonths(monthKey: MonthKey, delta: number): MonthKey {
  const { year, month } = parseMonthKey(monthKey)
  const zeroBasedTotal = (year * 12 + (month - 1)) + delta
  const nextYear = Math.floor(zeroBasedTotal / 12)
  const nextMonth = (zeroBasedTotal % 12) + 1
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}`
}

/** Inclusive month count from start to end; 1 for the same month, 12 for "2026-07" through "2027-06". */
function monthsBetweenInclusive(startMonthKey: MonthKey, endMonthKey: MonthKey): number {
  const start = parseMonthKey(startMonthKey)
  const end = parseMonthKey(endMonthKey)
  return (end.year * 12 + (end.month - 1)) - (start.year * 12 + (start.month - 1)) + 1
}

/** Every month key from start to end, inclusive, in order. */
function monthRange(startMonthKey: MonthKey, endMonthKey: MonthKey): MonthKey[] {
  const count = monthsBetweenInclusive(startMonthKey, endMonthKey)
  return Array.from({ length: Math.max(count, 0) }, (_, index) => addMonths(startMonthKey, index))
}

/** -1 if a < b, 0 if equal, 1 if a > b: lexical YYYY-MM comparison is always correct here, matching compareBusinessDates' own reasoning. */
function compareMonthKeys(a: MonthKey, b: MonthKey): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** "2026-07" -> "Jul 2026", for display. */
function formatMonthKey(monthKey: MonthKey): string {
  const { year, month } = parseMonthKey(monthKey)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${monthNames[month - 1]} ${year}`
}

export { toMonthKey, monthKeyToBusinessDate, addMonths, monthsBetweenInclusive, monthRange, compareMonthKeys, formatMonthKey }
export type { MonthKey }
