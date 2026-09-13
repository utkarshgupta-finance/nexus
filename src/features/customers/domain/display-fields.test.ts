import { describe, expect, it } from "vitest"

import {
  resolveBrandName,
  resolveCountryCode,
  resolveIndustryCode,
  resolveSegmentCode,
  resolveBusinessUnitCode,
  resolveBillingCurrencyCode,
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
  isActive: true,
  rowVersion: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  createdBy: null,
  updatedAt: "2026-09-01T00:00:00.000Z",
  updatedBy: null,
}

const UNSET_RECORD: CustomerMasterRecord = { ...REAL_RECORD, segment: null, businessUnit: null, country: null, industry: null, brandName: null }

describe("display-fields resolvers", () => {
  it("a real governed value always wins over demo enrichment", () => {
    expect(resolveBrandName(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("Aurora")
    expect(resolveCountryCode(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("IN")
    expect(resolveSegmentCode(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("smb")
    expect(resolveBusinessUnitCode(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("india_smb")
    expect(resolveIndustryCode(REAL_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe("fmcg")
  })

  it("falls back to demo enrichment only when the real field has never been set", () => {
    expect(resolveBrandName(UNSET_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe(DEMO_CUSTOMER_ENRICHMENT.brandName)
    expect(resolveCountryCode(UNSET_RECORD, DEMO_CUSTOMER_ENRICHMENT)).toBe(DEMO_CUSTOMER_ENRICHMENT.countryCode)
  })

  it("never fabricates a value when there is no enrichment either", () => {
    expect(resolveBrandName(UNSET_RECORD, null)).toBeNull()
    expect(resolveCountryCode(UNSET_RECORD, null)).toBeNull()
    expect(resolveSegmentCode(UNSET_RECORD, null)).toBeNull()
  })

  it("billing currency has no real column yet, so it always comes from enrichment", () => {
    expect(resolveBillingCurrencyCode(DEMO_CUSTOMER_ENRICHMENT)).toBe(DEMO_CUSTOMER_ENRICHMENT.billingCurrencyCode)
    expect(resolveBillingCurrencyCode(null)).toBeNull()
  })
})
