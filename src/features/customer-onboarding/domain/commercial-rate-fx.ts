import { getInrConversionRate } from "@/features/reference-data"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

/**
 * Commercial Rate's FX support (task correction §12-20): Billing Currency
 * stays the transaction currency Pricing itself operates in (unchanged);
 * this module only ever adds a read-only, centrally-governed INR
 * equivalent alongside it, resolved from Reference Master's own
 * `currency` list (`getInrConversionRate`), never invented and never
 * editable from Commercial Rate itself (§13-14). This mirrors the locked
 * Commercial domain's own Currency domain principle
 * (`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §18): transaction currency
 * never collapses into a derived conversion, and any converted amount
 * must carry its own rate/provenance.
 *
 * Every function that needs the governed rate takes an explicit
 * `snapshot: ReferenceMasterSnapshot` parameter, the same request-scoped
 * snapshot every other Reference Master read in this app now requires
 * (see `@/features/reference-data`'s own header), so this module never
 * reads a fixture or a database result directly.
 */

/** INR's own rate is always exactly 1, by definition, never a Settings lookup. */
function inrConversionRateFor(snapshot: ReferenceMasterSnapshot, currencyCode: string | null): number | null {
  if (!currencyCode) return null
  if (currencyCode === "INR") return 1
  return getInrConversionRate(snapshot, currencyCode)
}

/** Whether `currencyCode` is a real, non-INR transaction currency (the only case where an INR equivalent is ever shown). A type predicate so callers narrow straight from `string | null` to `string`. */
function isForeignCurrency(currencyCode: string | null): currencyCode is string {
  return currencyCode !== null && currencyCode !== "INR"
}

/**
 * `amount` converted to INR using the currently governed rate, or `null`
 * when either the amount or the rate is unavailable. Never a fallback
 * rate of 1 for a foreign currency: a missing rate must read as missing
 * (see `isFxRateMissing`), not silently as "no conversion needed."
 */
function toInr(snapshot: ReferenceMasterSnapshot, amount: number | null, currencyCode: string | null): number | null {
  if (amount === null) return null
  const rate = inrConversionRateFor(snapshot, currencyCode)
  if (rate === null) return null
  return amount * rate
}

/**
 * True only for a foreign Billing Currency with no active INR Conversion
 * Rate configured in Settings (task correction §15). Commercial Rate must
 * not become Complete while this is true; the UI surfaces this as an
 * actionable validation message, never a silently-skipped conversion.
 */
function isFxRateMissing(snapshot: ReferenceMasterSnapshot, currencyCode: string | null): boolean {
  return isForeignCurrency(currencyCode) && inrConversionRateFor(snapshot, currencyCode) === null
}

/**
 * The FX snapshot a future Commercial Configuration promotion path must
 * capture and freeze at approval time (task correction §16): Settings'
 * governed rate can change later, but an already-approved historical
 * version must remain understandable using the rate that applied to it,
 * not whatever Settings says today. Nothing in this stage persists this
 * yet (no live Commercial Configuration write path exists at all, see
 * commercial-rate.ts's own header); `currentFxSnapshot` only demonstrates
 * what a promotion step would capture right now, so the shape is proven
 * out before the write path exists. A real promotion step would also
 * stamp when the snapshot was captured, as part of that version's own
 * approval record, not as a concern of this draft-capture stage.
 */
type CommercialRateFxSnapshot = {
  currencyCode: string
  inrConversionRate: number
}

function currentFxSnapshot(snapshot: ReferenceMasterSnapshot, currencyCode: string | null): CommercialRateFxSnapshot | null {
  if (!currencyCode) return null
  const rate = inrConversionRateFor(snapshot, currencyCode)
  return rate === null ? null : { currencyCode, inrConversionRate: rate }
}

export { inrConversionRateFor, isForeignCurrency, toInr, isFxRateMissing, currentFxSnapshot }
export type { CommercialRateFxSnapshot }
