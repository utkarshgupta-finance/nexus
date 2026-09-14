import { describe, expect, it } from "vitest"

import { toCustomerMasterRecord } from "./mappers"
import type { CustomerRow } from "../data/row-types"

const FAKE_ROW: CustomerRow = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "demo-northstar-consumer-products",
  name: "Northstar Consumer Products Pvt Ltd",
  segment: "enterprise",
  business_unit: "india_enterprise",
  country: "IN",
  industry: "fmcg",
  brand_name: "Northstar",
  address: "1 Example Street",
  state: "Karnataka",
  city: "Bengaluru",
  postal_code: "560001",
  website: "https://northstar.example.com",
  primary_contact_name: "Demo Contact",
  primary_contact_email: "demo@example.com",
  primary_contact_phone_country_code: "IN",
  primary_contact_phone_number: "9000000000",
  primary_contact_designation: "Commercial Manager",
  gst_number: "29AAAAA0000A1Z5",
  pan: "AAAAA0000A",
  tan: "BLRA00000A",
  tax_identifier_type: null,
  tax_identifier_name: null,
  tax_registration_number: null,
  company_document_type: null,
  company_document_type_other: null,
  billing_currency: "INR",
  is_active: true,
  row_version: 1,
  created_at: "2026-09-01T00:00:00.000Z",
  created_by: null,
  updated_at: "2026-09-01T00:00:00.000Z",
  updated_by: null,
}

describe("toCustomerMasterRecord", () => {
  it("maps every backend column to the domain shape", () => {
    expect(toCustomerMasterRecord(FAKE_ROW)).toEqual({
      id: FAKE_ROW.id,
      key: FAKE_ROW.key,
      name: FAKE_ROW.name,
      segment: "enterprise",
      businessUnit: "india_enterprise",
      country: "IN",
      industry: "fmcg",
      brandName: "Northstar",
      address: "1 Example Street",
      state: "Karnataka",
      city: "Bengaluru",
      postalCode: "560001",
      website: "https://northstar.example.com",
      primaryContactName: "Demo Contact",
      primaryContactEmail: "demo@example.com",
      primaryContactPhoneCountryCode: "IN",
      primaryContactPhoneNumber: "9000000000",
      primaryContactDesignation: "Commercial Manager",
      gstNumber: "29AAAAA0000A1Z5",
      pan: "AAAAA0000A",
      tan: "BLRA00000A",
      taxIdentifierType: null,
      taxIdentifierName: null,
      taxRegistrationNumber: null,
      companyDocumentType: null,
      companyDocumentTypeOther: null,
      billingCurrency: "INR",
      isActive: true,
      rowVersion: 1,
      createdAt: FAKE_ROW.created_at,
      createdBy: null,
      updatedAt: FAKE_ROW.updated_at,
      updatedBy: null,
    })
  })

  it("never invents a field the real backend table does not have", () => {
    const record = toCustomerMasterRecord(FAKE_ROW)
    expect(Object.keys(record).sort()).toEqual(
      [
        "id", "key", "name", "segment", "businessUnit", "country", "industry", "brandName",
        "address", "state", "city", "postalCode", "website",
        "primaryContactName", "primaryContactEmail", "primaryContactPhoneCountryCode", "primaryContactPhoneNumber", "primaryContactDesignation",
        "gstNumber", "pan", "tan", "taxIdentifierType", "taxIdentifierName", "taxRegistrationNumber",
        "companyDocumentType", "companyDocumentTypeOther", "billingCurrency",
        "isActive", "rowVersion", "createdAt", "createdBy", "updatedAt", "updatedBy",
      ].sort()
    )
  })
})
