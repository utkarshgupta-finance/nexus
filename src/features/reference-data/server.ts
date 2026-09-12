import "server-only"

import { toCountryOptions, toPhoneCountryCodeOptions } from "./domain/countries"
import { buildPersistedSnapshot, emptySnapshot, toReferenceOption } from "./domain/snapshot"
import {
  insertReferenceOption,
  listAllReferenceOptions,
  updateReferenceOption,
} from "./data/reference-master.data"
import type { ReferenceListKey, ReferenceMasterSnapshot, ReferenceOption } from "./domain/types"

/**
 * TRUSTED, UNAUTHENTICATED, SERVER-ONLY Reference Master entry point.
 * Same `server-only` double guard, and the exact same trust-boundary
 * caveat, as `src/features/commercial/server.ts` and
 * `src/features/customers/server.ts`: every function here authenticates
 * as service_role via `src/lib/supabase/server-client.ts`, which bypasses
 * Postgres RLS entirely. That means this module enforces WHERE code may
 * run, not WHO may call it. Nexus has no authentication/session/
 * permission primitive anywhere in src/ yet
 * (docs/AUTHORIZATION_MODEL.md, locked design, not implemented), so the
 * write functions below take `actorUserId` as an explicit, caller-supplied
 * parameter rather than deriving it from a session that does not exist.
 * Every current call site in this codebase passes `null`: there is no
 * real Nexus user identity anywhere yet to pass instead. See
 * docs/SETTINGS_ARCHITECTURE.md's "Authorization honesty" section.
 *
 * Fine to call from a Server Component or a Server Action that has
 * already been reviewed as safe to serve this data/mutation to whatever
 * currently reaches this app (today: unauthenticated). NOT fine to treat
 * as a solved authorization boundary once Nexus has real per-user
 * identity; add a permission check at the call site once that platform
 * capability exists, do not invent a parallel one here.
 *
 * This file is deliberately thin: snapshot-shaping is pure logic that
 * lives in ./domain/snapshot.ts instead (testable directly, unlike this
 * file, which throws the server-only guard the moment a test imports it,
 * see ./boundary.test.ts), matching the same split
 * `src/features/customers/domain/mappers.ts` already established.
 */

const PERSISTED_LIST_KEYS: readonly ReferenceListKey[] = [
  "industry",
  "segment",
  "business_unit",
  "tax_identifier_type",
  "currency",
  "pricing_unit",
  "invoice_frequency",
  "invoice_timing",
  "commercial_nature",
  "pricing_model",
  "slab_method",
  "revenue_recognition_method",
]

/**
 * Loads one full, request-fresh Reference Master snapshot: the twelve
 * database-persisted lists (supabase/migrations/
 * 20260912080000_reference_master_foundation.sql) plus `country`/
 * `phone_country_code`, which stay sourced from the real canonical
 * `countries-list` catalogue (./domain/countries.ts), never this
 * database table (docs/SETTINGS_ARCHITECTURE.md §2, "Country and Phone
 * Country Code are deliberately excluded"). Throws (does not swallow)
 * on a backend failure: task correction §23, "Do not pretend empty list
 * means there are no values." Every caller (a Server Component route)
 * is expected to catch this and surface an honest unavailable state,
 * matching the exact pattern already established by
 * `src/app/customers/page.tsx`.
 */
async function loadReferenceMasterSnapshot(): Promise<ReferenceMasterSnapshot> {
  const rows = await listAllReferenceOptions()
  const snapshot = buildPersistedSnapshot(rows)
  snapshot.country = toCountryOptions()
  snapshot.phone_country_code = toPhoneCountryCodeOptions()
  return snapshot
}

type AddReferenceOptionInput = {
  listKey: (typeof PERSISTED_LIST_KEYS)[number]
  code: string
  label: string
  sortOrder?: number
  inrConversionRate?: number | null
  cadenceMonths?: number | null
}

/** Adds one new option to a persisted, Level 1/2 list. Never called for a System Rules (Level 3) list; see docs/SETTINGS_ARCHITECTURE.md §3. */
async function addReferenceOption(input: AddReferenceOptionInput, actorUserId: string | null): Promise<ReferenceOption> {
  const row = await insertReferenceOption({
    listKey: input.listKey,
    code: input.code,
    label: input.label,
    sortOrder: input.sortOrder,
    inrConversionRate: input.inrConversionRate ?? null,
    cadenceMonths: input.cadenceMonths ?? null,
    createdBy: actorUserId,
  })
  return toReferenceOption(row)
}

async function setReferenceOptionActive(
  listKey: ReferenceListKey,
  code: string,
  isActive: boolean,
  actorUserId: string | null
): Promise<ReferenceOption> {
  const row = await updateReferenceOption({ listKey, code, isActive, updatedBy: actorUserId })
  return toReferenceOption(row)
}

/** Updates the one governed parameter a `currency` option carries. `null` clears it back to "not configured", never a guessed value. Rejects (via the DB CHECK constraint) for any other list. */
async function updateCurrencyInrConversionRate(
  code: string,
  inrConversionRate: number | null,
  actorUserId: string | null
): Promise<ReferenceOption> {
  const row = await updateReferenceOption({ listKey: "currency", code, inrConversionRate, updatedBy: actorUserId })
  return toReferenceOption(row)
}

/** Updates the one governed parameter an `invoice_frequency` option carries. Rejects (via the DB CHECK constraint) for any other list. */
async function updateInvoiceFrequencyCadence(
  code: string,
  cadenceMonths: number,
  actorUserId: string | null
): Promise<ReferenceOption> {
  const row = await updateReferenceOption({ listKey: "invoice_frequency", code, cadenceMonths, updatedBy: actorUserId })
  return toReferenceOption(row)
}

export {
  loadReferenceMasterSnapshot,
  addReferenceOption,
  setReferenceOptionActive,
  updateCurrencyInrConversionRate,
  updateInvoiceFrequencyCadence,
  emptySnapshot,
  PERSISTED_LIST_KEYS,
}
export type { AddReferenceOptionInput }
