import { describe, expect, it } from "vitest"

import { CUSTOMER_ONBOARDING_FIELD_KEYS, TAX_IDENTIFIER_TYPE_OTHER } from "../forms/customer-onboarding-form-definition"
import { createComponent, createEmptyCommercialRateDraft } from "./commercial-rate"
import type { CommercialRateDraft } from "./commercial-rate"
import {
  combineStatuses,
  documentGroupStatus,
  evaluateAgreementApprovalStatus,
  evaluateCommercialDocumentsStatus,
  evaluateCommercialRateStatus,
  evaluateCustomerDetailsStatus,
  evaluateTaxRegistrationStatus,
  fieldGroupStatus,
  isFieldValueEmpty,
  requiredTaxRegistrationFieldKeys,
} from "./stage-status"

const FULL_CUSTOMER_DETAILS_DATA: Record<string, unknown> = {
  [CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName]: "Northwind Fictional Retail Group Pvt Ltd",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.brandName]: "Northwind Retail",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.country]: "IN",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.address]: "1 Example Street",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.pincode]: "560001",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.industry]: "fmcg",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.segment]: "enterprise",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.businessUnit]: "india_enterprise",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.contactName]: "Jane Doe",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.contactEmail]: "jane@example.com",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneCountryCode]: "+91",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneNumber]: "9876543210",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.contactDesignation]: "VP Sales",
}

const NO_DOCUMENTS = { gst: false, pan: false, tan: false, taxRegistration: false, companyRegistration: false }

describe("isFieldValueEmpty", () => {
  it("treats undefined, null, and blank strings as empty", () => {
    expect(isFieldValueEmpty(undefined)).toBe(true)
    expect(isFieldValueEmpty(null)).toBe(true)
    expect(isFieldValueEmpty("   ")).toBe(true)
  })

  it("treats a non-blank string and other values as filled", () => {
    expect(isFieldValueEmpty("IN")).toBe(false)
    expect(isFieldValueEmpty(0)).toBe(false)
    expect(isFieldValueEmpty(false)).toBe(false)
  })
})

describe("fieldGroupStatus", () => {
  it("is complete when there are no required keys (vacuous truth)", () => {
    expect(fieldGroupStatus({}, [])).toBe("complete")
  })

  it("is not_started when none of the required keys have a value", () => {
    expect(fieldGroupStatus({}, ["a", "b"])).toBe("not_started")
  })

  it("is attention when some but not all required keys have a value", () => {
    expect(fieldGroupStatus({ a: "x" }, ["a", "b"])).toBe("attention")
  })

  it("is complete when every required key has a value", () => {
    expect(fieldGroupStatus({ a: "x", b: "y" }, ["a", "b"])).toBe("complete")
  })
})

describe("documentGroupStatus", () => {
  it("is complete when there are no required documents", () => {
    expect(documentGroupStatus([])).toBe("complete")
  })

  it("is not_started, attention, or complete based on how many are present", () => {
    expect(documentGroupStatus([null, null])).toBe("not_started")
    expect(documentGroupStatus([true, null])).toBe("attention")
    expect(documentGroupStatus([true, true])).toBe("complete")
  })
})

describe("combineStatuses", () => {
  it("is complete only when every input is complete", () => {
    expect(combineStatuses(["complete", "complete"])).toBe("complete")
    expect(combineStatuses(["complete", "attention"])).toBe("attention")
  })

  it("is not_started only when every input is not_started", () => {
    expect(combineStatuses(["not_started", "not_started"])).toBe("not_started")
    expect(combineStatuses(["not_started", "complete"])).toBe("attention")
  })
})

describe("evaluateCustomerDetailsStatus (visited != complete)", () => {
  it("is not_started with no data entered", () => {
    expect(evaluateCustomerDetailsStatus({})).toBe("not_started")
  })

  it("is attention once some, but not all, mandatory fields are filled - merely opening the stage never marks it complete", () => {
    expect(evaluateCustomerDetailsStatus({ [CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName]: "Acme" })).toBe("attention")
  })

  it("is complete once every mandatory field is filled", () => {
    expect(evaluateCustomerDetailsStatus(FULL_CUSTOMER_DETAILS_DATA)).toBe("complete")
  })
})

describe("requiredTaxRegistrationFieldKeys (India vs non-India conditional)", () => {
  it("requires GST and PAN for India", () => {
    expect(requiredTaxRegistrationFieldKeys(true, {})).toEqual([
      CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber,
      CUSTOMER_ONBOARDING_FIELD_KEYS.pan,
    ])
  })

  it("requires Tax Identifier Type and Tax Registration Number for non-India", () => {
    expect(requiredTaxRegistrationFieldKeys(false, {})).toEqual([
      CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType,
      CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber,
    ])
  })

  it("additionally requires Tax Identifier Name once 'Other' is chosen for non-India", () => {
    const keys = requiredTaxRegistrationFieldKeys(false, {
      [CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType]: TAX_IDENTIFIER_TYPE_OTHER,
    })
    expect(keys).toContain(CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierName)
  })
})

describe("evaluateTaxRegistrationStatus", () => {
  it("is not_started for India with no fields or documents", () => {
    expect(evaluateTaxRegistrationStatus({}, true, NO_DOCUMENTS)).toBe("not_started")
  })

  it("is attention for India once GST is entered but PAN and documents are missing", () => {
    const status = evaluateTaxRegistrationStatus({ [CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber]: "29AAAAA0000A1Z1" }, true, NO_DOCUMENTS)
    expect(status).toBe("attention")
  })

  it("is complete for India once GST, PAN, and all three documents are present", () => {
    const data = {
      [CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber]: "29AAAAA0000A1Z1",
      [CUSTOMER_ONBOARDING_FIELD_KEYS.pan]: "AAAAA0000A",
    }
    const status = evaluateTaxRegistrationStatus(data, true, { ...NO_DOCUMENTS, gst: true, pan: true, tan: true })
    expect(status).toBe("complete")
  })

  it("is not_started for a non-India country with nothing entered", () => {
    expect(evaluateTaxRegistrationStatus({}, false, NO_DOCUMENTS)).toBe("not_started")
  })

  it("is complete for a non-India country once its own fields and documents are present", () => {
    const data = {
      [CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType]: "vat_number",
      [CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber]: "GB123456789",
    }
    const status = evaluateTaxRegistrationStatus(data, false, { ...NO_DOCUMENTS, taxRegistration: true, companyRegistration: true })
    expect(status).toBe("complete")
  })

  it("does not require India's GST/PAN for a non-India country", () => {
    const data = {
      [CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType]: "vat_number",
      [CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber]: "GB123456789",
      [CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber]: undefined,
    }
    const status = evaluateTaxRegistrationStatus(data, false, { ...NO_DOCUMENTS, taxRegistration: true, companyRegistration: true })
    expect(status).toBe("complete")
  })
})

describe("evaluateCommercialDocumentsStatus", () => {
  it("is complete since no attachment is currently mandated (task spec: do not invent requiredness)", () => {
    expect(evaluateCommercialDocumentsStatus()).toBe("complete")
  })
})

describe("evaluateCommercialRateStatus (visited != complete)", () => {
  it("is not_started with nothing entered", () => {
    expect(evaluateCommercialRateStatus(createEmptyCommercialRateDraft())).toBe("not_started")
  })

  it("is attention once Billing Currency is chosen but no component exists yet", () => {
    const draft: CommercialRateDraft = { ...createEmptyCommercialRateDraft(), billingCurrency: "INR" }
    expect(evaluateCommercialRateStatus(draft)).toBe("attention")
  })

  it("is complete once currency and a fully specified component both exist", () => {
    const component = createComponent("recurring", "per_unit")
    const draft: CommercialRateDraft = {
      billingCurrency: "INR",
      components: [
        {
          ...component,
          description: "SFA",
          rate: 50,
          pricingUnit: "USER",
          invoiceTerms: { invoiceFrequency: "monthly", invoiceTiming: "advance" },
        },
      ],
    }
    expect(evaluateCommercialRateStatus(draft)).toBe("complete")
  })
})

describe("evaluateAgreementApprovalStatus (never fakes approval)", () => {
  it("is not_started with nothing attached and no approval", () => {
    expect(evaluateAgreementApprovalStatus(false, false, false)).toBe("not_started")
  })

  it("is attention once a Signed Agreement is attached but the completion predicate is not yet true", () => {
    expect(evaluateAgreementApprovalStatus(true, false, false)).toBe("attention")
  })

  it("is complete only when the eligibility predicate itself says so", () => {
    expect(evaluateAgreementApprovalStatus(true, true, true)).toBe("complete")
  })
})
