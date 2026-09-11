import type { SurveyFormDefinition } from "@/platform/forms/types"
import type { ReferenceListKey, ReferenceOption } from "@/features/reference-data"
import { GEOGRAPHY_COMBOBOX_QUESTION_TYPE } from "./geography-question-model"

/**
 * Stable field keys for both implemented stages, in the required
 * business order. Kept as named constants (not inline strings scattered
 * through the builder below) so a future consumer of `survey.data` (a
 * later stage, a read model, Finance's review UI) references the same
 * keys rather than re-deriving them.
 */
const CUSTOMER_ONBOARDING_FIELD_KEYS = {
  legalEntityName: "customer_legal_entity_name",
  brandName: "brand_business_name",
  country: "country",
  address: "address",
  state: "state",
  city: "city",
  pincode: "pincode",
  industry: "industry_category",
  website: "website",
  segment: "segment",
  businessUnit: "business_unit",
  contactName: "primary_contact_name",
  contactEmail: "primary_contact_email",
  contactPhoneCountryCode: "primary_contact_phone_country_code",
  contactPhoneNumber: "primary_contact_phone_number",
  contactDesignation: "primary_contact_designation",
  gstNumber: "gst_number",
  pan: "pan",
  tan: "tan",
  taxIdentifierType: "tax_identifier_type",
  taxIdentifierName: "tax_identifier_name",
  taxRegistrationNumber: "tax_registration_number",
  companyDocumentType: "company_document_type",
  companyDocumentTypeOther: "company_document_type_other",
  billingCurrency: "billing_currency",
} as const

/** Stable identity for the default Country selection: an ISO code, never the display text "India" (task spec §9). */
const DEFAULT_COUNTRY_CODE = "IN"

/**
 * A small, deliberately incomplete taxonomy for non-India tax
 * identifiers: different countries call their tax/registration number
 * different things, and this stage does not attempt to model every
 * country's scheme. "Other" plus a free-text name lets a submitter record
 * whatever their local identifier is actually called. This is a
 * temporary, local option contract, not Reference Master: it can move
 * there later without changing the shape of the data it produces.
 */
const TAX_IDENTIFIER_TYPE_OTHER = "other"
const TAX_IDENTIFIER_TYPE_OPTIONS = [
  { value: "vat_number", text: "VAT Number" },
  { value: "tax_identification_number", text: "Tax Identification Number" },
  { value: "business_registration_number", text: "Business Registration Number" },
  { value: TAX_IDENTIFIER_TYPE_OTHER, text: "Other" },
] as const

/**
 * Same deliberately-incomplete-taxonomy approach for the label on the
 * Company Registration / Incorporation Document: different countries and
 * entity types use different certificate names, so "Other" plus a
 * free-text name is available rather than forcing one document name
 * globally.
 */
const COMPANY_DOCUMENT_TYPE_OTHER = "other"
const COMPANY_DOCUMENT_TYPE_OPTIONS = [
  { value: "certificate_of_incorporation", text: "Certificate of Incorporation" },
  { value: "business_registration_certificate", text: "Business Registration Certificate" },
  { value: "trade_business_licence", text: "Trade / Business Licence" },
  { value: COMPANY_DOCUMENT_TYPE_OTHER, text: "Other" },
] as const

/**
 * A permissive website pattern: requires a domain with at least one dot,
 * an optional scheme, and an optional path. Deliberately not stricter,
 * per the field spec ("do not over-restrict valid business domains").
 */
const WEBSITE_PATTERN = "^(https?:\\/\\/)?([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}([\\/?#].*)?$"

function toChoices(options: ReferenceOption[]) {
  return options.map((option) => ({ value: option.value, text: option.label }))
}

/**
 * Builds the SurveyJS-backed Customer Onboarding pages: Customer Details
 * and Tax & Registration only. Commercial Documents, Commercial Rate, and
 * Agreement & Approval are all plain React sections instead of survey
 * pages (see ../ui/customer-onboarding-page.tsx): Commercial Documents
 * collects nothing but the three attachment uploads (a local-file
 * contract, same pattern as Tax & Registration's documents) now that
 * Billing Currency has moved to Commercial Rate; Commercial Rate is an
 * explicit shell pending business definition, plus Billing Currency;
 * Agreement & Approval is an attachment plus a read-only approval status.
 * None of the three invents survey questions for fields that are not yet
 * real. Reference Master option choices
 * (Country, Industry, Segment, Business Unit, Phone Country Code,
 * Currency) are a parameter, never hardcoded here, so Reference Master
 * stays the single source of truth for what a user may select. State
 * and City are intentionally NOT passed in here: they come from a
 * canonical geography catalogue, not Reference Master (task spec §17),
 * and are populated after mount from /api/geography/* (see
 * ../ui/customer-onboarding-page.tsx), so their `choices` start empty.
 *
 * Each question pair sets an explicit `width` and `startWithNewLine`
 * rather than a panel-level `colCount` (not a real Panel property in
 * the installed SurveyJS version, confirmed by inspecting the rendered
 * DOM). Elements that need the full row (Address, the phone pair) break
 * the pairing without breaking declaration order, so a two-column
 * layout still reads top-to-bottom, left-to-right in the exact required
 * field order.
 *
 * Tax & Registration is country-aware: GST/PAN/TAN are India-specific
 * identifiers, visible (and GST/PAN required) only when Country is India.
 * Every other country instead sees a generic Tax Identifier Type / Tax
 * Registration Number pair (plus the two required attachments handled in
 * ../ui/customer-onboarding-page.tsx), never an Indian tax scheme forced
 * worldwide. Country/State/City use the `geographycombobox` question
 * type (../ui/geography-combobox-question.tsx) instead of `dropdown`, so
 * the visible field is always selection-only: typing to search only ever
 * happens inside the opened popup, never in the field that displays the
 * current selection.
 */
function buildCustomerOnboardingFormDefinition(
  optionsByList: Record<ReferenceListKey, ReferenceOption[]>
): SurveyFormDefinition {
  return {
    formDefinitionVersion: "customer-onboarding-v2",
    json: {
      // No survey-level title/description: the page's own PageHeader
      // already shows the page title, and SurveyJS renders its own
      // title/description as a separate framed block, which duplicated it.
      showProgressBar: "off",
      showQuestionNumbers: "off",
      widthMode: "responsive",
      showCompletedPage: false,
      // The page's own Save Draft / Submit actions are the one primary
      // action for this screen (docs/UI_SYSTEM.md §11); SurveyJS's own
      // default Complete/Next/Prev buttons would be redundant, and stage
      // navigation is driven by ../ui/customer-onboarding-page.tsx's own
      // stage tabs instead.
      showNavigationButtons: false,
      pages: [
        {
          name: "customer_details",
          elements: [
            {
              type: "panel",
              name: "section_customer",
              title: "Customer",
              elements: [
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName,
                  title: "Customer / Legal Entity Name",
                  isRequired: true,
                  placeholder: "e.g. Northwind Fictional Retail Group Pvt Ltd",
                  startWithNewLine: true,
                  width: "50%",
                },
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.brandName,
                  title: "Brand / Business Name",
                  isRequired: true,
                  placeholder: "e.g. Northwind Retail",
                  startWithNewLine: false,
                  width: "50%",
                },
                {
                  type: GEOGRAPHY_COMBOBOX_QUESTION_TYPE,
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.country,
                  title: "Country",
                  isRequired: true,
                  defaultValue: DEFAULT_COUNTRY_CODE,
                  choices: toChoices(optionsByList.country),
                  startWithNewLine: true,
                  width: "50%",
                },
                {
                  type: "comment",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.address,
                  title: "Address",
                  isRequired: true,
                  rows: 3,
                  placeholder: "Street, building, area",
                  startWithNewLine: true,
                  width: "100%",
                },
                {
                  type: GEOGRAPHY_COMBOBOX_QUESTION_TYPE,
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.state,
                  title: "State",
                  isRequired: false,
                  choices: [],
                  placeholder: "Select...",
                  startWithNewLine: true,
                  width: "50%",
                },
                {
                  type: GEOGRAPHY_COMBOBOX_QUESTION_TYPE,
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.city,
                  title: "City",
                  isRequired: false,
                  // Its `choices` stay empty: City's real options come from
                  // ../ui/geography-combobox-question.tsx's own server
                  // search, keyed off this question's `name`, not from
                  // SurveyJS's own choicesLazyLoad pipeline.
                  enableIf: `{${CUSTOMER_ONBOARDING_FIELD_KEYS.country}} notempty`,
                  placeholder: "Select country first",
                  startWithNewLine: false,
                  width: "50%",
                },
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.pincode,
                  title: "Pincode / Postal Code",
                  isRequired: true,
                  placeholder: "e.g. 560001",
                  startWithNewLine: true,
                  width: "50%",
                },
                {
                  type: "dropdown",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.industry,
                  title: "Industry / Category",
                  isRequired: true,
                  choices: toChoices(optionsByList.industry),
                  startWithNewLine: false,
                  width: "50%",
                },
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.website,
                  title: "Website",
                  inputType: "url",
                  placeholder: "e.g. https://www.example.com",
                  validators: [
                    { type: "regex", regex: WEBSITE_PATTERN, text: "Enter a valid website address." },
                  ],
                  startWithNewLine: true,
                  width: "50%",
                },
                {
                  type: "dropdown",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.segment,
                  title: "Segment",
                  isRequired: true,
                  choices: toChoices(optionsByList.segment),
                  startWithNewLine: false,
                  width: "50%",
                },
                {
                  type: "dropdown",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.businessUnit,
                  title: "Business Unit",
                  isRequired: true,
                  choices: toChoices(optionsByList.business_unit),
                  startWithNewLine: true,
                  width: "50%",
                },
              ],
            },
            {
              type: "panel",
              name: "section_primary_contact",
              title: "Primary Contact",
              elements: [
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.contactName,
                  title: "Primary Contact Name",
                  isRequired: true,
                  startWithNewLine: true,
                  width: "50%",
                },
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.contactEmail,
                  title: "Primary Contact Email ID",
                  inputType: "email",
                  isRequired: true,
                  validators: [{ type: "email" }],
                  startWithNewLine: false,
                  width: "50%",
                },
                {
                  type: "panel",
                  name: "primary_contact_phone_panel",
                  startWithNewLine: true,
                  width: "100%",
                  elements: [
                    {
                      type: "dropdown",
                      name: CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneCountryCode,
                      title: "Country code",
                      isRequired: true,
                      searchEnabled: true,
                      searchMode: "contains",
                      startWithNewLine: true,
                      minWidth: "160px",
                      width: "30%",
                      choices: toChoices(optionsByList.phone_country_code),
                    },
                    {
                      type: "text",
                      name: CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneNumber,
                      title: "Phone number",
                      inputType: "tel",
                      isRequired: true,
                      startWithNewLine: false,
                      width: "70%",
                      placeholder: "e.g. 98765 43210",
                    },
                  ],
                },
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.contactDesignation,
                  title: "Primary Contact Designation",
                  isRequired: true,
                  placeholder: "e.g. VP Sales",
                  startWithNewLine: true,
                  width: "50%",
                },
              ],
            },
          ],
        },
        {
          name: "tax_registration",
          elements: [
            {
              type: "panel",
              name: "section_india_tax",
              title: "India Tax & Registration",
              visibleIf: `{${CUSTOMER_ONBOARDING_FIELD_KEYS.country}} = '${DEFAULT_COUNTRY_CODE}'`,
              elements: [
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber,
                  title: "GST Number",
                  requiredIf: `{${CUSTOMER_ONBOARDING_FIELD_KEYS.country}} = '${DEFAULT_COUNTRY_CODE}'`,
                  placeholder: "e.g. 29AAAAA0000A1Z1",
                  startWithNewLine: true,
                  width: "50%",
                },
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.pan,
                  title: "PAN",
                  requiredIf: `{${CUSTOMER_ONBOARDING_FIELD_KEYS.country}} = '${DEFAULT_COUNTRY_CODE}'`,
                  placeholder: "e.g. AAAAA0000A",
                  startWithNewLine: false,
                  width: "50%",
                },
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.tan,
                  title: "TAN",
                  placeholder: "e.g. AAAA00000A",
                  startWithNewLine: true,
                  width: "50%",
                },
              ],
            },
            {
              type: "panel",
              name: "section_non_india_tax",
              title: "Tax & Registration",
              visibleIf: `{${CUSTOMER_ONBOARDING_FIELD_KEYS.country}} <> '${DEFAULT_COUNTRY_CODE}'`,
              elements: [
                {
                  type: "html",
                  name: "non_india_tax_notice",
                  html: "<p>India GST, PAN and TAN do not apply for the selected country. Provide the local tax/registration identifier and supporting documents instead.</p>",
                  startWithNewLine: true,
                },
                {
                  type: "dropdown",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType,
                  title: "Tax Identifier Type",
                  requiredIf: `{${CUSTOMER_ONBOARDING_FIELD_KEYS.country}} <> '${DEFAULT_COUNTRY_CODE}'`,
                  choices: TAX_IDENTIFIER_TYPE_OPTIONS,
                  placeholder: "Select...",
                  startWithNewLine: true,
                  width: "50%",
                },
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierName,
                  title: "Tax Identifier Name",
                  description: "The local name of this identifier, since it is not one of the listed types.",
                  visibleIf: `{${CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType}} = '${TAX_IDENTIFIER_TYPE_OTHER}'`,
                  requiredIf: `{${CUSTOMER_ONBOARDING_FIELD_KEYS.country}} <> '${DEFAULT_COUNTRY_CODE}' and {${CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType}} = '${TAX_IDENTIFIER_TYPE_OTHER}'`,
                  placeholder: "e.g. Employer Identification Number",
                  startWithNewLine: false,
                  width: "50%",
                },
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber,
                  title: "Tax / Registration Number",
                  requiredIf: `{${CUSTOMER_ONBOARDING_FIELD_KEYS.country}} <> '${DEFAULT_COUNTRY_CODE}'`,
                  placeholder: "e.g. GB123456789",
                  startWithNewLine: true,
                  width: "50%",
                },
                {
                  type: "dropdown",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.companyDocumentType,
                  title: "Company Document Type",
                  description: "Optional: the kind of document you are attaching below as the Company Registration / Incorporation Document.",
                  choices: COMPANY_DOCUMENT_TYPE_OPTIONS,
                  placeholder: "Select...",
                  startWithNewLine: false,
                  width: "50%",
                },
                {
                  type: "text",
                  name: CUSTOMER_ONBOARDING_FIELD_KEYS.companyDocumentTypeOther,
                  title: "Company Document Type Name",
                  visibleIf: `{${CUSTOMER_ONBOARDING_FIELD_KEYS.companyDocumentType}} = '${COMPANY_DOCUMENT_TYPE_OTHER}'`,
                  placeholder: "e.g. Trade Licence",
                  startWithNewLine: true,
                  width: "50%",
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

const INDIA_TAX_FIELD_KEYS: string[] = [
  CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber,
  CUSTOMER_ONBOARDING_FIELD_KEYS.pan,
  CUSTOMER_ONBOARDING_FIELD_KEYS.tan,
]

const NON_INDIA_TAX_FIELD_KEYS: string[] = [
  CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType,
  CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierName,
  CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber,
  CUSTOMER_ONBOARDING_FIELD_KEYS.companyDocumentType,
  CUSTOMER_ONBOARDING_FIELD_KEYS.companyDocumentTypeOther,
]

/**
 * Which Tax & Registration field keys no longer apply after a confirmed
 * Country change, so a submission for the new country never carries the
 * other branch's data forward (a hidden GST number must not silently ride
 * along into a non-India submission, and vice versa). Only the branch
 * that stopped applying is returned: moving between two non-India
 * countries returns the (already empty) India keys, leaving whatever
 * non-India data was already entered untouched.
 *
 * A pure function so this decision is unit-testable without mounting
 * ../ui/customer-onboarding-page.tsx, which is the one caller that turns
 * this key list into actual `survey.setValue(key, undefined)` calls.
 */
function fieldKeysToClearOnCountryChange(newCountry: string | null): string[] {
  return newCountry === DEFAULT_COUNTRY_CODE ? NON_INDIA_TAX_FIELD_KEYS : INDIA_TAX_FIELD_KEYS
}

export {
  CUSTOMER_ONBOARDING_FIELD_KEYS,
  DEFAULT_COUNTRY_CODE,
  TAX_IDENTIFIER_TYPE_OTHER,
  buildCustomerOnboardingFormDefinition,
  fieldKeysToClearOnCountryChange,
}
