import { describe, expect, it } from "vitest"

import { filterCustomerMasterEntries, EMPTY_FILTERS } from "./search"
import type { CustomerMasterListEntry } from "../read-models/customer-master-mapping"
import type { CustomerMasterRecord } from "./types"

function record(overrides: Partial<CustomerMasterRecord>): CustomerMasterRecord {
  return {
    id: "id",
    key: "key",
    name: "name",
    segment: null,
    businessUnit: null,
    country: null,
    industry: null,
    brandName: null,
    address: null,
    state: null,
    city: null,
    postalCode: null,
    website: null,
    primaryContactName: null,
    primaryContactEmail: null,
    primaryContactPhoneCountryCode: null,
    primaryContactPhoneNumber: null,
    primaryContactDesignation: null,
    gstNumber: null,
    pan: null,
    tan: null,
    taxIdentifierType: null,
    taxIdentifierName: null,
    taxRegistrationNumber: null,
    companyDocumentType: null,
    companyDocumentTypeOther: null,
    billingCurrency: null,
    isActive: true,
    rowVersion: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    createdBy: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
    updatedBy: null,
    ...overrides,
  }
}

const AURORA: CustomerMasterListEntry = {
  record: record({
    id: "a", key: "aurora-consumer-labs", name: "Aurora Consumer Labs Pvt Ltd",
    brandName: "Aurora", segment: "smb", businessUnit: "india_smb", country: "IN", isActive: true,
  }),
  enrichment: null,
}

const NORTHSTAR: CustomerMasterListEntry = {
  record: record({
    id: "b", key: "northstar-consumer-products", name: "Northstar Consumer Products Pvt Ltd",
    brandName: "Northstar", segment: "enterprise", businessUnit: "india_enterprise", country: "IN", isActive: false,
  }),
  enrichment: null,
}

const ENTRIES = [AURORA, NORTHSTAR]

describe("filterCustomerMasterEntries", () => {
  it("returns everything when no filter is set", () => {
    expect(filterCustomerMasterEntries(ENTRIES, EMPTY_FILTERS)).toEqual(ENTRIES)
  })

  it("matches by legal entity name, case-insensitively", () => {
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: "aurora" })).toEqual([AURORA])
  })

  it("matches by customer key", () => {
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: "northstar-consumer-products" })).toEqual([NORTHSTAR])
  })

  it("matches by brand name", () => {
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: "Northstar" })).toEqual([NORTHSTAR])
  })

  it("filters by segment code", () => {
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, segment: "smb" })).toEqual([AURORA])
  })

  it("filters by active status", () => {
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, status: "inactive" })).toEqual([NORTHSTAR])
  })

  it("combines a query with a status filter (AND, not OR)", () => {
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: "aurora", status: "inactive" })).toEqual([])
  })

  it("returns nothing when nothing matches", () => {
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: "does-not-exist" })).toEqual([])
  })

  it("treats a whitespace-only query as no filter at all (S-001 stress variant)", () => {
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: "   " })).toEqual(ENTRIES)
  })

  it("filters by businessUnit code (S-002)", () => {
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, businessUnit: "india_enterprise" })).toEqual([NORTHSTAR])
  })

  it("filters by country code (S-002)", () => {
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, country: "IN" })).toEqual(ENTRIES)
  })

  it("combines segment + businessUnit + country + status as a logical AND across all four (S-002)", () => {
    expect(
      filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, segment: "enterprise", businessUnit: "india_enterprise", country: "IN", status: "inactive" })
    ).toEqual([NORTHSTAR])
    expect(
      filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, segment: "enterprise", businessUnit: "india_enterprise", country: "IN", status: "active" })
    ).toEqual([])
  })

  it("still matches a customer by a segment/businessUnit/country code even if that code has since been deactivated in Reference Master: filtering compares the customer's own stored code, never re-validates it against the currently-active option list (S-002 historical variant, P-006)", () => {
    // No lookup against a live/active reference-option list happens anywhere
    // in filterCustomerMasterEntries; it compares filters.segment directly
    // against the customer record's own resolved code, so a deactivated
    // code (still legitimately stored on an existing customer) is unaffected.
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, segment: "smb" })).toEqual([AURORA])
  })

  it("treats SQL-metacharacter-laden and very long adversarial query strings as plain, safe substrings, never crashing or matching everything (S-005)", () => {
    const sqlInjectionAttempt = "'; DROP TABLE customers; --"
    expect(() => filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: sqlInjectionAttempt })).not.toThrow()
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: sqlInjectionAttempt })).toEqual([])

    const percentEncodedPayload = "%27%20OR%20%271%27%3D%271"
    expect(() => filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: percentEncodedPayload })).not.toThrow()
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: percentEncodedPayload })).toEqual([])

    const extremelyLongQuery = "a".repeat(10_000)
    expect(() => filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: extremelyLongQuery })).not.toThrow()
    expect(filterCustomerMasterEntries(ENTRIES, { ...EMPTY_FILTERS, query: extremelyLongQuery })).toEqual([])
  })
})
