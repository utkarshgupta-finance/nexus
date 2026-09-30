import { describe, expect, it } from "vitest"

import { extractGovernedCustomerFieldsFromOnboarding } from "./onboarding-customer-field-mapping"
import { CUSTOMER_ONBOARDING_FIELD_KEYS } from "../forms/customer-onboarding-form-definition"
import { createEmptyCommercialRateDraft } from "./commercial-rate"

describe("extractGovernedCustomerFieldsFromOnboarding", () => {
  it("maps pincode onto postal_code (the one differently-spelled key)", () => {
    const fields = extractGovernedCustomerFieldsFromOnboarding({ [CUSTOMER_ONBOARDING_FIELD_KEYS.pincode]: "560001" }, null)
    expect(fields.postal_code).toBe("560001")
  })

  it("maps every other field key straight through under its own name", () => {
    const values = {
      [CUSTOMER_ONBOARDING_FIELD_KEYS.brandName]: "Acme Retail",
      [CUSTOMER_ONBOARDING_FIELD_KEYS.address]: "1 Example Street",
      [CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber]: "29AAAAA0000A1Z5",
      [CUSTOMER_ONBOARDING_FIELD_KEYS.contactEmail]: "contact@example.com",
    }
    const fields = extractGovernedCustomerFieldsFromOnboarding(values, null)
    expect(fields.brand_name).toBe("Acme Retail")
    expect(fields.address).toBe("1 Example Street")
    expect(fields.gst_number).toBe("29AAAAA0000A1Z5")
    expect(fields.primary_contact_email).toBe("contact@example.com")
  })

  it("maps segment, business_unit, country, and industry (previously silently dropped)", () => {
    const values = {
      [CUSTOMER_ONBOARDING_FIELD_KEYS.segment]: "SME",
      [CUSTOMER_ONBOARDING_FIELD_KEYS.businessUnit]: "india_enterprise",
      [CUSTOMER_ONBOARDING_FIELD_KEYS.country]: "IN",
      [CUSTOMER_ONBOARDING_FIELD_KEYS.industry]: "fmcg",
    }
    const fields = extractGovernedCustomerFieldsFromOnboarding(values, null)
    expect(fields.segment).toBe("SME")
    expect(fields.business_unit).toBe("india_enterprise")
    expect(fields.country).toBe("IN")
    expect(fields.industry).toBe("fmcg")
  })

  it("reads billing_currency from the Commercial Rate draft, never the vestigial top-level field", () => {
    const draft = { ...createEmptyCommercialRateDraft(), billingCurrency: "INR" }
    const fields = extractGovernedCustomerFieldsFromOnboarding({ billing_currency: "USD" }, draft)
    expect(fields.billing_currency).toBe("INR")
  })

  it("normalizes a blank or missing value to null, never an empty string", () => {
    const fields = extractGovernedCustomerFieldsFromOnboarding({ [CUSTOMER_ONBOARDING_FIELD_KEYS.website]: "   " }, null)
    expect(fields.website).toBeNull()
    expect(fields.city).toBeNull()
  })
})
