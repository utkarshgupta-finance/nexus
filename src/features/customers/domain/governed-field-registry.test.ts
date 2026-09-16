import { describe, expect, it } from "vitest"

import { GOVERNED_FIELDS, GOVERNED_FIELD_KEYS, labelForGovernedField, governedFieldByKey } from "./governed-field-registry"

describe("GOVERNED_FIELDS", () => {
  it("has no duplicate keys: the registry is the one source of truth, a duplicate would silently shadow a real field everywhere it is looked up", () => {
    const keys = GOVERNED_FIELDS.map((field) => field.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("every field has a non-empty label", () => {
    for (const field of GOVERNED_FIELDS) {
      expect(field.label.trim().length).toBeGreaterThan(0)
    }
  })

  it("every reference_select field names a listKey", () => {
    for (const field of GOVERNED_FIELDS) {
      if (field.editor.kind === "reference_select") {
        expect(field.editor.listKey.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe("GOVERNED_FIELD_KEYS", () => {
  it("is exactly the key of every entry in GOVERNED_FIELDS, in the same order", () => {
    expect(GOVERNED_FIELD_KEYS).toEqual(GOVERNED_FIELDS.map((field) => field.key))
  })

  /**
   * Nexus Foundational Hardening, Phase 3B: a Customer Change Request
   * approval on any field in GOVERNED_FIELDS actually writes it to
   * `customers`, but fn_protect_customer_lifecycle's UPDATE guard
   * trigger enforces its own separate, hand-maintained allowlist
   * (supabase/migrations/20260924000000_fix_customer_lifecycle_guard_stale_allowlist.sql).
   * These two lists silently drifted once already (18 of 25 fields
   * added here in 20260916020000_customer_master_governed_fields.sql
   * were never added to the trigger, so approving a change to any of
   * them always failed). This test can't reach the live trigger, but it
   * pins the allowlist this registry is known to match today, so adding
   * a new governed field without updating the migration fails a test
   * instead of only failing silently in production on the next approval.
   */
  it("is a subset of fn_protect_customer_lifecycle's known-current allowlist (keep this in sync with the migration above)", () => {
    const triggerAllowlist = new Set([
      "name", "brand_name", "segment", "business_unit", "country", "industry",
      "address", "state", "city", "postal_code", "website",
      "primary_contact_name", "primary_contact_email", "primary_contact_phone_country_code",
      "primary_contact_phone_number", "primary_contact_designation",
      "gst_number", "pan", "tan", "tax_identifier_type", "tax_identifier_name", "tax_registration_number",
      "company_document_type", "company_document_type_other", "billing_currency",
    ])
    for (const key of GOVERNED_FIELD_KEYS) {
      expect(triggerAllowlist.has(key)).toBe(true)
    }
  })
})

describe("labelForGovernedField", () => {
  it("returns the registered label for a known field", () => {
    expect(labelForGovernedField("brand_name")).toBe("Brand Name")
    expect(labelForGovernedField("gst_number")).toBe("GST Number")
  })

  it("falls back to the raw key for an unknown field, never throwing", () => {
    expect(labelForGovernedField("not_a_real_field")).toBe("not_a_real_field")
  })
})

describe("governedFieldByKey", () => {
  it("returns the full field definition for a known key", () => {
    const field = governedFieldByKey("segment")
    expect(field).toEqual({ key: "segment", label: "Segment", editor: { kind: "reference_select", listKey: "segment" } })
  })

  it("returns undefined for an unknown key", () => {
    expect(governedFieldByKey("not_a_real_field")).toBeUndefined()
  })
})
