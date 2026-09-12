import { REFERENCE_MASTER_FIXTURES } from "./fixtures"
import type { ReferenceListKey, ReferenceOption } from "./types"

/**
 * Reference Master option-resolution contract. Two distinct modes, both
 * required (`CLAUDE.md`-driven task spec, "Historical reference value
 * behaviour"):
 *
 * - Selection mode (`getActiveOptions`): what a user may choose on a new
 *   form. Only active values.
 * - Historical resolution mode (`resolveOption`): what a previously stored
 *   value means, even if it has since been deactivated. A submission or
 *   Customer Master record that stored a now-inactive value must still
 *   display its original label, never a blank or a silently substituted
 *   current value.
 *
 * Backed by an in-repo fixture for now (see ./fixtures.ts's header for
 * why); callers only ever see this contract, never the fixture shape
 * directly, so swapping the fixture for a real generic reference table
 * later is invisible to every caller.
 */

function getActiveOptions(listKey: ReferenceListKey): ReferenceOption[] {
  return REFERENCE_MASTER_FIXTURES[listKey].filter((option) => option.active)
}

/**
 * Every option for a list, active and inactive alike. Intended for the
 * Reference Master Settings screen, which must show and manage inactive
 * values too, not for form field choices (use `getActiveOptions` there).
 */
function getAllOptions(listKey: ReferenceListKey): ReferenceOption[] {
  return REFERENCE_MASTER_FIXTURES[listKey]
}

/**
 * Resolves a stored value back to its option, regardless of current
 * active state. Returns null only if the value was never a real option
 * for this list, never merely because it is now inactive.
 */
function resolveOption(listKey: ReferenceListKey, value: string): ReferenceOption | null {
  return REFERENCE_MASTER_FIXTURES[listKey].find((option) => option.value === value) ?? null
}

/**
 * The centrally governed "1 unit of `currencyCode` = X INR" rate (task
 * correction §12-15). Returns `null`, never a guess, when the currency is
 * not an active `currency` option or has no rate configured yet: a caller
 * needing this rate (Commercial Rate's own FX display and completeness
 * check) must treat `null` as "not configured", never fall back to 1 or
 * any other invented value.
 */
function getInrConversionRate(currencyCode: string): number | null {
  const option = REFERENCE_MASTER_FIXTURES.currency.find((entry) => entry.value === currencyCode && entry.active)
  return option?.inrConversionRate ?? null
}

/**
 * The governed cadence, in months, for an active Invoice Frequency (Settings
 * task correction §12: "do not rely only on the display label to determine
 * invoice cadence"). `null` for the reserved "One-Time" row, and for any
 * inactive or unrecognized code, never a guessed number.
 */
function getInvoiceFrequencyCadence(code: string): number | null {
  const option = REFERENCE_MASTER_FIXTURES.invoice_frequency.find((entry) => entry.value === code && entry.active)
  return option?.cadenceMonths ?? null
}

export { getActiveOptions, getAllOptions, resolveOption, getInrConversionRate, getInvoiceFrequencyCadence }
