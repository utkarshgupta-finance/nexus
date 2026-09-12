import type { ReferenceListKey, ReferenceMasterSnapshot, ReferenceOption } from "./types"
import type { ReferenceOptionRow } from "../data/row-types"

/**
 * Pure snapshot-shaping logic, deliberately kept out of ../server.ts:
 * ../server.ts is `server-only` (it throws immediately on import outside
 * a server context, proved by ../boundary.test.ts, the same guard
 * `src/features/commercial/server.ts` and `src/features/customers/
 * server.ts` already use), so anything that needs a plain unit test
 * belongs in a domain module like this one instead, matching the exact
 * pattern `src/features/customers/domain/mappers.ts` already
 * established for that feature.
 */

const ALL_LIST_KEYS: readonly ReferenceListKey[] = [
  "country",
  "industry",
  "segment",
  "business_unit",
  "tax_identifier_type",
  "phone_country_code",
  "currency",
  "pricing_unit",
  "invoice_frequency",
  "invoice_timing",
  "commercial_nature",
  "pricing_model",
  "slab_method",
  "revenue_recognition_method",
]

/** An empty, fully-shaped snapshot: every `ReferenceListKey` present with an empty array, never a missing key. Used both as the honest "backend unavailable" fallback and as the base a real snapshot is built onto. */
function emptySnapshot(): ReferenceMasterSnapshot {
  const snapshot = {} as ReferenceMasterSnapshot
  for (const key of ALL_LIST_KEYS) snapshot[key] = []
  return snapshot
}

function toReferenceOption(row: {
  code: string
  label: string
  is_active: boolean
  inr_conversion_rate: number | null
  cadence_months: number | null
}): ReferenceOption {
  return {
    value: row.code,
    label: row.label,
    active: row.is_active,
    inrConversionRate: row.inr_conversion_rate,
    cadenceMonths: row.cadence_months,
  }
}

/**
 * Groups `reference_options` rows (already ordered by list_key, sort_order
 * by the repository query) into a snapshot's twelve persisted lists.
 * `country`/`phone_country_code` are deliberately left as empty arrays
 * here: they are never sourced from these rows (see ../server.ts, which
 * fills them from ./countries.ts instead), so a caller who forgets that
 * step gets an honest empty list rather than a silently wrong one.
 */
function buildPersistedSnapshot(rows: ReferenceOptionRow[]): ReferenceMasterSnapshot {
  const snapshot = emptySnapshot()
  for (const row of rows) {
    const listKey = row.list_key as ReferenceListKey
    if (!(listKey in snapshot)) continue
    snapshot[listKey].push(toReferenceOption(row))
  }
  return snapshot
}

export { emptySnapshot, toReferenceOption, buildPersistedSnapshot, ALL_LIST_KEYS }
