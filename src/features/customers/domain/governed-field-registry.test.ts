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
