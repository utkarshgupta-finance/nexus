import { describe, expect, it } from "vitest"

import { toCustomerDto } from "./api-dto"
import type { CustomerMasterRecord } from "./types"
import { emptySnapshot } from "@/features/reference-data/domain/snapshot"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

function baseRecord(overrides: Partial<CustomerMasterRecord> = {}): CustomerMasterRecord {
  return {
    id: "customer-1",
    key: "acme-retail",
    name: "Acme Retail Pvt Ltd",
    segment: "enterprise",
    businessUnit: "india_enterprise",
    country: "IN",
    industry: "fmcg",
    brandName: "Acme",
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
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "actor-1",
    updatedAt: "2026-01-02T00:00:00.000Z",
    updatedBy: "actor-1",
    ...overrides,
  }
}

describe("toCustomerDto", () => {
  it("never exposes a raw database row shape: field names are DTO-owned, not column-owned", () => {
    const dto = toCustomerDto(baseRecord(), emptySnapshot())
    expect(Object.keys(dto).sort()).toEqual(["brand", "businessUnit", "country", "createdAt", "id", "key", "legalName", "segment", "status", "updatedAt"])
  })

  it("resolves every governed code to {code, label}, never a bare code", () => {
    const snapshot: ReferenceMasterSnapshot = {
      ...emptySnapshot(),
      country: [{ value: "IN", label: "India", active: true }],
      segment: [{ value: "enterprise", label: "Enterprise", active: true }],
      business_unit: [{ value: "india_enterprise", label: "India Enterprise", active: true }],
    }
    const dto = toCustomerDto(baseRecord(), snapshot)
    expect(dto.country).toEqual({ code: "IN", label: "India" })
    expect(dto.segment).toEqual({ code: "enterprise", label: "Enterprise" })
    expect(dto.businessUnit).toEqual({ code: "india_enterprise", label: "India Enterprise" })
  })

  it("maps is_active to a status string, never the raw boolean", () => {
    expect(toCustomerDto(baseRecord({ isActive: true }), emptySnapshot()).status).toBe("active")
    expect(toCustomerDto(baseRecord({ isActive: false }), emptySnapshot()).status).toBe("inactive")
  })

  it("never fabricates a customerNumber field: Customer Master has no Human-Friendly ID yet", () => {
    const dto = toCustomerDto(baseRecord(), emptySnapshot())
    expect(dto).not.toHaveProperty("customerNumber")
  })
})
