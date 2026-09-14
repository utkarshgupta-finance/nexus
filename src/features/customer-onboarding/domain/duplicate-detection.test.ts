import { describe, expect, it } from "vitest"

import { findPotentialDuplicates, hasHardDuplicateMatch } from "./duplicate-detection"
import type { ExistingCustomerIdentity } from "./duplicate-detection"

const EXISTING: ExistingCustomerIdentity[] = [
  {
    customerId: "cust-1",
    customerKey: "abc-consumer-products",
    customerName: "ABC Consumer Products Pvt Ltd",
    gstNumber: "27ABCDE1234F1Z5",
    pan: "ABCDE1234F",
    legalEntityName: "ABC Consumer Products Pvt Ltd",
    brandName: "ABC Foods",
  },
]

describe("findPotentialDuplicates", () => {
  it("matches an exact GST number, case-insensitively", () => {
    const matches = findPotentialDuplicates(
      { gstNumber: "27abcde1234f1z5", pan: null, legalEntityName: null, brandName: null },
      EXISTING
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].fieldKey).toBe("gst_number")
    expect(matches[0].severity).toBe("hard")
    expect(matches[0].customerId).toBe("cust-1")
  })

  it("matches an exact PAN", () => {
    const matches = findPotentialDuplicates({ gstNumber: null, pan: "ABCDE1234F", legalEntityName: null, brandName: null }, EXISTING)
    expect(matches).toHaveLength(1)
    expect(matches[0].fieldKey).toBe("pan")
    expect(matches[0].severity).toBe("hard")
  })

  it("matches a legal entity name as a soft signal, trimmed and case-insensitive", () => {
    const matches = findPotentialDuplicates(
      { gstNumber: null, pan: null, legalEntityName: "  abc consumer products pvt ltd  ", brandName: null },
      EXISTING
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].fieldKey).toBe("legal_entity_name")
    expect(matches[0].severity).toBe("soft")
  })

  it("matches a brand name as a soft signal", () => {
    const matches = findPotentialDuplicates({ gstNumber: null, pan: null, legalEntityName: null, brandName: "ABC Foods" }, EXISTING)
    expect(matches[0].fieldKey).toBe("brand_name")
    expect(matches[0].severity).toBe("soft")
  })

  it("never matches two unset values against each other", () => {
    const matches = findPotentialDuplicates({ gstNumber: null, pan: null, legalEntityName: null, brandName: null }, [
      { ...EXISTING[0], gstNumber: null, pan: null, legalEntityName: null, brandName: null },
    ])
    expect(matches).toEqual([])
  })

  it("returns no matches for a genuinely different customer", () => {
    const matches = findPotentialDuplicates(
      { gstNumber: "29XYZAB5678C1Z9", pan: "XYZAB5678C", legalEntityName: "Totally Different Co", brandName: "Something Else" },
      EXISTING
    )
    expect(matches).toEqual([])
  })

  it("can return multiple matches at once (GST and legal name both hit)", () => {
    const matches = findPotentialDuplicates(
      { gstNumber: "27ABCDE1234F1Z5", pan: null, legalEntityName: "ABC Consumer Products Pvt Ltd", brandName: null },
      EXISTING
    )
    expect(matches).toHaveLength(2)
  })
})

describe("hasHardDuplicateMatch", () => {
  it("is true when any match is a hard (GST/PAN) match", () => {
    expect(hasHardDuplicateMatch(findPotentialDuplicates({ gstNumber: "27ABCDE1234F1Z5", pan: null, legalEntityName: null, brandName: null }, EXISTING))).toBe(
      true
    )
  })

  it("is false when matches are soft-only", () => {
    expect(
      hasHardDuplicateMatch(findPotentialDuplicates({ gstNumber: null, pan: null, legalEntityName: "ABC Consumer Products Pvt Ltd", brandName: null }, EXISTING))
    ).toBe(false)
  })

  it("is false with no matches", () => {
    expect(hasHardDuplicateMatch([])).toBe(false)
  })
})
