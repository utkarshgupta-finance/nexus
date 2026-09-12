import { describe, expect, it } from "vitest"

import { ALL_LIST_KEYS, buildPersistedSnapshot, emptySnapshot, toReferenceOption } from "./snapshot"
import type { ReferenceOptionRow } from "../data/row-types"

/**
 * Persistence contract tests (task correction §25, "PERSISTENCE
 * CONTRACT"): the pure shaping logic between a raw `reference_options`
 * row (supabase/migrations/20260912080000_reference_master_foundation.sql)
 * and the `ReferenceOption`/`ReferenceMasterSnapshot` shape every domain
 * function in ./service.ts already depends on. ../server.ts itself
 * cannot be unit tested this way: it throws the server-only guard on
 * import outside a server context (see ../boundary.test.ts), so this
 * file is where the real, generic list/option contract gets proven.
 */

function row(overrides: Partial<ReferenceOptionRow> = {}): ReferenceOptionRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    list_key: "industry",
    code: "fmcg",
    label: "FMCG",
    is_active: true,
    sort_order: 1,
    inr_conversion_rate: null,
    cadence_months: null,
    created_at: "2026-09-12T00:00:00.000Z",
    created_by: null,
    updated_at: "2026-09-12T00:00:00.000Z",
    updated_by: null,
    ...overrides,
  }
}

describe("emptySnapshot", () => {
  it("carries every ReferenceListKey, never a missing key", () => {
    const snapshot = emptySnapshot()
    for (const key of ALL_LIST_KEYS) {
      expect(snapshot[key]).toEqual([])
    }
  })

  it("has exactly the fourteen keys ALL_LIST_KEYS defines, none extra", () => {
    const snapshot = emptySnapshot()
    expect(Object.keys(snapshot).sort()).toEqual([...ALL_LIST_KEYS].sort())
  })
})

describe("toReferenceOption: stable code vs mutable label", () => {
  it("maps code to value and label to label, keeping them distinct", () => {
    const option = toReferenceOption(row({ code: "fmcg", label: "FMCG" }))
    expect(option.value).toBe("fmcg")
    expect(option.label).toBe("FMCG")
  })

  it("maps is_active to active, both directions", () => {
    expect(toReferenceOption(row({ is_active: true })).active).toBe(true)
    expect(toReferenceOption(row({ is_active: false })).active).toBe(false)
  })

  it("carries inr_conversion_rate through as inrConversionRate, including null for not-yet-configured", () => {
    expect(toReferenceOption(row({ list_key: "currency", code: "USD", inr_conversion_rate: 91 })).inrConversionRate).toBe(91)
    expect(toReferenceOption(row({ list_key: "currency", code: "IDR", inr_conversion_rate: null })).inrConversionRate).toBeNull()
  })

  it("carries cadence_months through as cadenceMonths, including null for the reserved one_time row", () => {
    expect(toReferenceOption(row({ list_key: "invoice_frequency", code: "monthly", cadence_months: 1 })).cadenceMonths).toBe(1)
    expect(toReferenceOption(row({ list_key: "invoice_frequency", code: "one_time", cadence_months: null })).cadenceMonths).toBeNull()
  })
})

describe("buildPersistedSnapshot: grouping rows by list_key", () => {
  it("groups multiple rows of the same list together", () => {
    const rows = [row({ code: "fmcg", label: "FMCG" }), row({ code: "retail", label: "Retail", sort_order: 2 })]
    const snapshot = buildPersistedSnapshot(rows)
    expect(snapshot.industry.map((option) => option.value)).toEqual(["fmcg", "retail"])
  })

  it("keeps every other list empty when only one list has rows", () => {
    const snapshot = buildPersistedSnapshot([row()])
    expect(snapshot.segment).toEqual([])
    expect(snapshot.currency).toEqual([])
  })

  it("preserves an inactive row's active:false, never silently dropping or reactivating it", () => {
    const snapshot = buildPersistedSnapshot([row({ code: "global_key_accounts", list_key: "segment", is_active: false })])
    expect(snapshot.segment[0]?.active).toBe(false)
  })

  it("is idempotent to call twice with the same rows: identical output both times", () => {
    const rows = [row({ code: "fmcg" }), row({ code: "retail" })]
    expect(buildPersistedSnapshot(rows)).toEqual(buildPersistedSnapshot(rows))
  })
})
