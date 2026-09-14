import { describe, expect, it } from "vitest"

import {
  resolveBrandName,
  resolveCountryCode,
  resolveIndustryCode,
  resolveSegmentCode,
  resolveBusinessUnitCode,
  resolveBillingCurrencyCode,
  resolveState,
  resolveCity,
  resolvePrimaryContactName,
  resolvePrimaryContactEmail,
  resolvePrimaryContactDesignation,
  resolveGstNumber,
  resolvePan,
  resolveTan,
} from "./display-fields"
import { DEMO_CUSTOMER_ENRICHMENT } from "./demo-enrichment"
import type { CustomerMasterRecord } from "./types"

const REAL_RECORD: CustomerMasterRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "aurora-consumer-labs",
  name: "Aurora Consumer Labs Pvt Ltd",
  segment: "smb",
  businessUnit: "india_smb",
  country: "IN",
  industry: "fmcg",
  brandName: "Aurora",
  address: "1 Aurora Street",
  state: "Maharashtra",
  city: "Mumbai",
  postalCode: "400001",
  website: "https://aurora.example.com",
  primaryContactName: "Real Contact",
  primaryContactEmail: "real@aurora.example.com",
  primaryContactPhoneCountryCode: "IN",
  primaryContactPhoneNumber: "9000000000",
  primaryContactDesignation: "Finance Head",
  gstNumber: "27AAAAA0000A1Z5",
  pan: "AAAAA1111A",
  tan: "MUMA00000A",
  taxIdentifierType: null,
  taxIdentifierName: null,
  taxRegistrationNumber: null,
  companyDocumentType: null,
  companyDocumentTypeOther: null,
  billingCurrency: "INR",
  isActive: true,
  rowVersion: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  createdBy: null,
  updatedAt: "2026-09-01T00:00:00.000Z",
  updatedBy: null,
}

const UNSET_RECORD: CustomerMasterRecord = {
  ...REAL_RECORD,
  segment: null,
  businessUnit: null,
  country: null,
  industry: null,
  brandName: null,
  state: null,
  city: null,
  primaryContactName: null,
  primaryContactEmail: null,
  primaryContactDesignation: null,
  gstNumber: null,
  pan: null,
  tan: null,
  billingCurrency: null,
}

describe("display-fields resolvers", () => {
  it("a real governed value always wins over demo enrichment", () => {
    expect(resolveBrandName(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("Aurora")
    expect(resolveCountryCode(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("IN")
    expect(resolveSegmentCode(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("smb")
    expect(resolveBusinessUnitCode(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("india_smb")
    expect(resolveIndustryCode(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("fmcg")
    expect(resolveState(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("Maharashtra")
    expect(resolveCity(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("Mumbai")
    expect(resolvePrimaryContactName(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("Real Contact")
    expect(resolvePrimaryContactEmail(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("real@aurora.example.com")
    expect(resolvePrimaryContactDesignation(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("Finance Head")
    expect(resolveGstNumber(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("27AAAAA0000A1Z5")
    expect(resolvePan(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("AAAAA1111A")
    expect(resolveTan(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("MUMA00000A")
    expect(resolveBillingCurrencyCode(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("INR")
  })

  it("falls back to demo enrichment only when the real field has never been set", () => {
    expect(resolveBrandName(UNSET_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe(DEMO_CUSTOMER_ENRICHMENT.brandName)
    expect(resolveCountryCode(UNSET_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe(DEMO_CUSTOMER_ENRICHMENT.countryCode)
    expect(resolveState(UNSET_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe(DEMO_CUSTOMER_ENRICHMENT.stateName)
    expect(resolveGstNumber(UNSET_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe(DEMO_CUSTOMER_ENRICHMENT.gstin)
    expect(resolveBillingCurrencyCode(UNSET_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe(DEMO_CUSTOMER_ENRICHMENT.billingCurrencyCode)
  })

  it("never fabricates a value when there is no enrichment either", () => {
    expect(resolveBrandName(UNSET_RECORD, null)).toBeNull()
    expect(resolveCountryCode(UNSET_RECORD, null)).toBeNull()
    expect(resolveSegmentCode(UNSET_RECORD, null)).toBeNull()
    expect(resolveState(UNSET_RECORD, null)).toBeNull()
    expect(resolveGstNumber(UNSET_RECORD, null)).toBeNull()
    expect(resolveBillingCurrencyCode(UNSET_RECORD, null)).toBeNull()
  })
})
