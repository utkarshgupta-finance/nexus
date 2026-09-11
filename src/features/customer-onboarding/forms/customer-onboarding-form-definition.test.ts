import { Model } from "survey-core"
import { describe, expect, it } from "vitest"

import {
  buildCustomerOnboardingFormDefinition,
  CUSTOMER_ONBOARDING_FIELD_KEYS,
  DEFAULT_COUNTRY_CODE,
  fieldKeysToClearOnCountryChange,
} from "./customer-onboarding-form-definition"
import { GEOGRAPHY_COMBOBOX_QUESTION_TYPE } from "./geography-question-model"
import type { ReferenceListKey, ReferenceOption } from "@/features/reference-data"

type SurveyElement = {
  name?: string
  choices?: unknown
  elements?: SurveyElement[]
}

function findElementByName(elements: SurveyElement[], name: string): SurveyElement | undefined {
  for (const element of elements) {
    if (element.name === name) return element
    if (element.elements) {
      const found = findElementByName(element.elements, name)
      if (found) return found
    }
  }
  return undefined
}

function findQuestion(json: Record<string, unknown>, name: string): SurveyElement | undefined {
  const pages = json.pages as { elements: SurveyElement[] }[]
  for (const page of pages) {
    const found = findElementByName(page.elements, name)
    if (found) return found
  }
  return undefined
}

const FAKE_OPTIONS: Record<ReferenceListKey, ReferenceOption[]> = {
  country: [
    { value: "IN", label: "India", active: true },
    { value: "SG", label: "Singapore", active: true },
  ],
  industry: [{ value: "widgets", label: "Widgets", active: true }],
  segment: [{ value: "alpha_segment", label: "Alpha Segment", active: true }],
  business_unit: [{ value: "alpha_bu", label: "Alpha Business Unit", active: true }],
  phone_country_code: [{ value: "IN", label: "India (+91)", dialCode: "+91", active: true }],
  currency: [
    { value: "INR", label: "INR - Indian Rupee", active: true },
    { value: "USD", label: "USD - US Dollar", active: true },
  ],
  // Commercial Rate lists: unused by this form definition (Commercial Rate
  // is not a survey page, see ../ui/commercial-rate-section.tsx), present
  // only to satisfy ReferenceListKey's full Record shape.
  pricing_unit: [],
  billing_cycle: [],
  billing_timing: [],
  payment_terms: [],
  commercial_nature: [],
  pricing_model: [],
}

describe("customer onboarding form definition structure", () => {
  it("keeps every survey-backed field from both stages present", () => {
    const form = buildCustomerOnboardingFormDefinition(FAKE_OPTIONS)
    // Billing Currency and the whole Commercial Rate draft are deliberately
    // excluded: Commercial Rate is a plain React section
    // (../ui/commercial-rate-section.tsx), not a survey page.
    const NON_SURVEY_FIELD_KEYS: string[] = [
      CUSTOMER_ONBOARDING_FIELD_KEYS.billingCurrency,
      CUSTOMER_ONBOARDING_FIELD_KEYS.commercialRate,
    ]
    for (const fieldKey of Object.values(CUSTOMER_ONBOARDING_FIELD_KEYS)) {
      if (NON_SURVEY_FIELD_KEYS.includes(fieldKey)) continue
      expect(findQuestion(form.json, fieldKey), `missing field ${fieldKey}`).toBeDefined()
    }
  })

  it("no longer declares a commercial_documents survey page: it collects only attachments now, handled as a plain React section", () => {
    const form = buildCustomerOnboardingFormDefinition(FAKE_OPTIONS)
    const pages = form.json.pages as { name: string }[]
    expect(pages.map((page) => page.name)).toEqual(["customer_details", "tax_registration"])
  })

  it("does not declare Billing Currency as a survey question", () => {
    const form = buildCustomerOnboardingFormDefinition(FAKE_OPTIONS)
    expect(findQuestion(form.json, CUSTOMER_ONBOARDING_FIELD_KEYS.billingCurrency)).toBeUndefined()
  })

  it("uses whatever segment/business unit/industry options it is given, not a hardcoded list", () => {
    const form = buildCustomerOnboardingFormDefinition(FAKE_OPTIONS)
    expect(findQuestion(form.json, CUSTOMER_ONBOARDING_FIELD_KEYS.segment)?.choices).toEqual([
      { value: "alpha_segment", text: "Alpha Segment" },
    ])
    expect(findQuestion(form.json, CUSTOMER_ONBOARDING_FIELD_KEYS.businessUnit)?.choices).toEqual([
      { value: "alpha_bu", text: "Alpha Business Unit" },
    ])
  })

  it("leaves State and City choices empty: they come from the geography catalogue, not Reference Master", () => {
    const form = buildCustomerOnboardingFormDefinition(FAKE_OPTIONS)
    expect(findQuestion(form.json, CUSTOMER_ONBOARDING_FIELD_KEYS.state)?.choices).toEqual([])
  })

  it("defaults country to the stable India option identity, not the display text", () => {
    const form = buildCustomerOnboardingFormDefinition(FAKE_OPTIONS)
    const countryQuestion = findQuestion(form.json, CUSTOMER_ONBOARDING_FIELD_KEYS.country) as { defaultValue?: string }
    expect(countryQuestion?.defaultValue).toBe("IN")
    expect(countryQuestion?.defaultValue).toBe(DEFAULT_COUNTRY_CODE)
  })

})

describe("customer onboarding form runtime behaviour", () => {
  function buildModel() {
    return new Model(buildCustomerOnboardingFormDefinition(FAKE_OPTIONS).json)
  }

  it("defaults to India on a fresh model", () => {
    const survey = buildModel()
    expect(survey.getValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country)).toBe("IN")
  })

  it("disables City when Country is cleared", () => {
    const survey = buildModel()
    const city = survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.city)
    expect(city.isReadOnly).toBe(false)
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country, null)
    expect(city.isReadOnly).toBe(true)
  })

  it("re-enables City once Country is set again", () => {
    const survey = buildModel()
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country, null)
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country, "SG")
    const city = survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.city)
    expect(city.isReadOnly).toBe(false)
  })

  it("shows the India tax panel and requires GST/PAN only when Country is India", () => {
    const survey = buildModel()
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber).isVisible).toBe(true)
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber).isRequired).toBe(true)
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.pan).isRequired).toBe(true)
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.tan).isRequired).toBe(false)
  })

  it("hides the India tax panel and does not require GST/PAN for a non-India country", () => {
    const survey = buildModel()
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country, "SG")
    // The question's own visibleIf is unset (only its parent panel's is);
    // isVisibleInSurvey rolls up the parent chain to the effective,
    // rendered visibility, which is what actually matters here.
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber).isVisibleInSurvey).toBe(false)
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber).isRequired).toBe(false)
    expect(survey.getQuestionByName("non_india_tax_notice").isVisible).toBe(true)
  })

  it("fails validation when required fields are missing (Submit gate)", () => {
    const survey = buildModel()
    expect(survey.validate()).toBe(false)
  })

  it("passes validation once every required field for the India scenario is filled", () => {
    const survey = buildModel()
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName, "Northwind Fictional Retail Group")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.brandName, "Northwind Retail")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.address, "1 Example Street")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.pincode, "560001")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.industry, "widgets")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.segment, "alpha_segment")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.businessUnit, "alpha_bu")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.contactName, "Priya Sharma")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.contactEmail, "priya.sharma@example.com")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneCountryCode, "IN")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneNumber, "9876543210")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.contactDesignation, "VP Sales")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber, "29AAAAA0000A1Z1")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.pan, "AAAAA0000A")
    expect(survey.validate()).toBe(true)
  })

  it("accepts a non-numeric global postal code format", () => {
    const survey = buildModel()
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.pincode, "SW1A 1AA")
    survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.pincode).validate()
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.pincode).errors.length).toBe(0)
  })

  it("does not require GST/PAN/TAN attachments as survey questions (they are a separate local-file contract)", () => {
    const survey = buildModel()
    expect(survey.getQuestionByName("gst_registration_document")).toBeFalsy()
    expect(survey.getQuestionByName("pan_document")).toBeFalsy()
  })
})

describe("draft vs submit validation gate", () => {
  it("Save Draft accepts partial data: the domain layer never runs field validation", () => {
    // Proven at the domain layer in ../domain/case.test.ts
    // ("saves a draft with incomplete data"); this test proves the
    // complementary half, that SurveyJS's own required-field validation
    // is a distinct, Submit-only gate.
    const survey = new Model(buildCustomerOnboardingFormDefinition(FAKE_OPTIONS).json)
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName, "Northwind Fictional Retail Group")
    // No validate() call here: partial data alone must never throw or
    // block reading survey.data for a draft save.
    expect(survey.data).toEqual({
      country: "IN",
      [CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName]: "Northwind Fictional Retail Group",
    })
  })

  it("Submit fails when required fields are missing", () => {
    const survey = new Model(buildCustomerOnboardingFormDefinition(FAKE_OPTIONS).json)
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName, "Northwind Fictional Retail Group")
    expect(survey.validate()).toBe(false)
  })
})

describe("geography controls are selection-only", () => {
  // The visible field itself never accepts typed text as a committed
  // value: Country/State/City render through geographycombobox
  // (../ui/geography-combobox-question.tsx), a Combobox whose trigger is
  // a button, not an editable input, and whose only input lives inside
  // the opened popup. That rendering guarantee is exercised in the
  // browser (see the visual review notes); at this Model level, the
  // testable proxy is that these three questions are wired to the
  // selection-only type at all, not the freely re-typable `dropdown`.
  it("uses the geographycombobox type, not a plain dropdown, for Country/State/City", () => {
    const form = buildCustomerOnboardingFormDefinition(FAKE_OPTIONS)
    expect(findQuestion(form.json, CUSTOMER_ONBOARDING_FIELD_KEYS.country)).toMatchObject({
      type: GEOGRAPHY_COMBOBOX_QUESTION_TYPE,
    })
    expect(findQuestion(form.json, CUSTOMER_ONBOARDING_FIELD_KEYS.state)).toMatchObject({
      type: GEOGRAPHY_COMBOBOX_QUESTION_TYPE,
    })
    expect(findQuestion(form.json, CUSTOMER_ONBOARDING_FIELD_KEYS.city)).toMatchObject({
      type: GEOGRAPHY_COMBOBOX_QUESTION_TYPE,
    })
  })

  it("keeps every other dropdown (Industry, Segment, Business Unit, Phone Country Code) on the plain dropdown type", () => {
    const form = buildCustomerOnboardingFormDefinition(FAKE_OPTIONS)
    expect(findQuestion(form.json, CUSTOMER_ONBOARDING_FIELD_KEYS.industry)).toMatchObject({ type: "dropdown" })
    expect(findQuestion(form.json, CUSTOMER_ONBOARDING_FIELD_KEYS.segment)).toMatchObject({ type: "dropdown" })
    expect(findQuestion(form.json, CUSTOMER_ONBOARDING_FIELD_KEYS.businessUnit)).toMatchObject({ type: "dropdown" })
  })

  it("registers geographycombobox as a real question type that behaves like a dropdown (choices, validation)", () => {
    const survey = new Model(buildCustomerOnboardingFormDefinition(FAKE_OPTIONS).json)
    const countryQuestion = survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.country)
    expect(countryQuestion.getType()).toBe(GEOGRAPHY_COMBOBOX_QUESTION_TYPE)
    expect(countryQuestion.value).toBe("IN")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country, undefined)
    expect(survey.validate()).toBe(false)
    expect(countryQuestion.errors.length).toBeGreaterThan(0)
  })
})

describe("country-aware Tax & Registration branch", () => {
  function buildModel() {
    return new Model(buildCustomerOnboardingFormDefinition(FAKE_OPTIONS).json)
  }

  it("does not require the non-India tax fields for India", () => {
    const survey = buildModel()
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType).isVisibleInSurvey).toBe(false)
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType).isRequired).toBe(false)
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber).isRequired).toBe(false)
  })

  it("hides GST/PAN/TAN and shows Tax Identifier Type / Tax Registration Number for a non-India country", () => {
    const survey = buildModel()
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country, "SG")
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber).isVisibleInSurvey).toBe(false)
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType).isVisibleInSurvey).toBe(true)
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType).isRequired).toBe(true)
    expect(survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber).isRequired).toBe(true)
  })

  it("requires Tax Identifier Name only when Tax Identifier Type is Other, for a non-India country", () => {
    const survey = buildModel()
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country, "SG")
    const nameQuestion = survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierName)
    expect(nameQuestion.isVisibleInSurvey).toBe(false)
    expect(nameQuestion.isRequired).toBe(false)

    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType, "vat_number")
    expect(nameQuestion.isVisibleInSurvey).toBe(false)

    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType, "other")
    expect(nameQuestion.isVisibleInSurvey).toBe(true)
    expect(nameQuestion.isRequired).toBe(true)
  })

  it("passes validation for a fully filled non-India scenario without any India tax fields", () => {
    const survey = buildModel()
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName, "Northwind Fictional Retail Group")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.brandName, "Northwind Retail")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country, "SG")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.address, "1 Example Street")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.pincode, "049315")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.industry, "widgets")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.segment, "alpha_segment")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.businessUnit, "alpha_bu")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.contactName, "Priya Sharma")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.contactEmail, "priya.sharma@example.com")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneCountryCode, "IN")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneNumber, "9876543210")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.contactDesignation, "VP Sales")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType, "vat_number")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber, "SG123456789")
    expect(survey.validate()).toBe(true)
  })
})

describe("clearing incompatible tax branch data on Country change", () => {
  it("returns the non-India keys when moving to India", () => {
    expect(fieldKeysToClearOnCountryChange("IN")).toEqual(
      expect.arrayContaining([
        CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType,
        CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierName,
        CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber,
      ])
    )
    expect(fieldKeysToClearOnCountryChange("IN")).not.toEqual(
      expect.arrayContaining([CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber])
    )
  })

  it("returns the India keys when moving to (or between) non-India countries", () => {
    expect(fieldKeysToClearOnCountryChange("SG")).toEqual(
      expect.arrayContaining([
        CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber,
        CUSTOMER_ONBOARDING_FIELD_KEYS.pan,
        CUSTOMER_ONBOARDING_FIELD_KEYS.tan,
      ])
    )
    expect(fieldKeysToClearOnCountryChange("GB")).not.toEqual(
      expect.arrayContaining([CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber])
    )
  })

  it("a submission built after clearing never carries the other branch's values", () => {
    const survey = new Model(buildCustomerOnboardingFormDefinition(FAKE_OPTIONS).json)
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber, "29AAAAA0000A1Z1")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.pan, "AAAAA0000A")
    survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country, "SG")
    for (const fieldKey of fieldKeysToClearOnCountryChange("SG")) {
      survey.setValue(fieldKey, undefined)
    }
    expect(survey.data[CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber]).toBeUndefined()
    expect(survey.data[CUSTOMER_ONBOARDING_FIELD_KEYS.pan]).toBeUndefined()
  })
})
