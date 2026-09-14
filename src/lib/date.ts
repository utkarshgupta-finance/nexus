/**
 * Nexus date/time policy (Platform Scale Closure, Phase H).
 *
 * Two distinct representations exist in this codebase and must never be
 * mixed:
 *
 * BUSINESS DATE: a calendar date with no time-of-day or timezone component
 * (Commercial Effective From/To, a Change's effective date). Always a plain
 * "YYYY-MM-DD" string, both in Postgres (`date` columns) and in TypeScript.
 * It represents "the 15th of January", never an instant, so it must never
 * shift because of the browser's or server's local timezone. Never parse
 * one with `new Date("YYYY-MM-DD")`: per the ECMA-262 spec that string is
 * parsed as UTC midnight, and reading it back with a local-time accessor
 * (`.getFullYear()`, `.getDate()`) can silently return the wrong calendar
 * day in a negative-UTC-offset environment. Use the helpers below instead,
 * which parse the string directly rather than round-tripping through a
 * timezone-sensitive `Date`.
 *
 * TIMESTAMP: an instant (created_at, updated_at, submitted_at, approved_at,
 * sent_back_at, decided_at). Always `timestamptz` in Postgres and a full
 * ISO 8601 string in TypeScript, stored/compared in UTC, displayed in the
 * viewer's local timezone.
 */

const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

type BusinessDateParts = { year: number; month: number; day: number }

function parseBusinessDate(value: string): BusinessDateParts {
  const match = BUSINESS_DATE_PATTERN.exec(value)
  if (!match) throw new Error(`Not a business date (expected YYYY-MM-DD): ${value}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function getBusinessDateYear(value: string): number {
  return parseBusinessDate(value).year
}

/** Lexical YYYY-MM-DD comparison is correct for this representation; named so callers never reach for `new Date(...)` instead. */
function compareBusinessDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** "15-Jan-2026". Anchored at UTC noon and read back with a UTC-fixed formatter so the calendar day never shifts by viewer timezone. */
function formatBusinessDate(value: string): string {
  const { year, month, day } = parseBusinessDate(value)
  const anchor = new Date(Date.UTC(year, month - 1, day, 12))
  const dayStr = String(day).padStart(2, "0")
  const monthStr = anchor.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
  return `${dayStr}-${monthStr}-${year}`
}

/** A business date converted to the UTC instant at which its calendar day begins, for the rare case it must be merged into an instant-ordered sequence (e.g. a mixed timeline). Never use this to derive a display value. */
function businessDateStartOfDayUtc(value: string): string {
  const { year, month, day } = parseBusinessDate(value)
  return new Date(Date.UTC(year, month - 1, day)).toISOString()
}

function compareTimestamps(a: string, b: string): number {
  const diff = new Date(a).getTime() - new Date(b).getTime()
  return diff < 0 ? -1 : diff > 0 ? 1 : 0
}

/** "15 Jan 2026, 10:30 am", in the viewer's local timezone. */
function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

/** "15 Jan 2026" (date only, no time), in the viewer's local timezone. For a timestamp column, not a business date. */
function formatTimestampDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })
}

export {
  parseBusinessDate,
  getBusinessDateYear,
  compareBusinessDates,
  formatBusinessDate,
  businessDateStartOfDayUtc,
  compareTimestamps,
  formatTimestamp,
  formatTimestampDate,
}
