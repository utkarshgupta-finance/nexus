import { CUSTOMER_ONBOARDING_FIELD_KEYS } from "../forms/customer-onboarding-form-definition"

/**
 * Human-readable labels for the onboarding form's own field keys, copied
 * verbatim from each question's `title` in
 * ../forms/customer-onboarding-form-definition.ts. Exists so the reviewer's
 * Send Back UI (../ui/review-detail-page.tsx) can offer a field picker
 * without rendering the whole SurveyJS form a second time. Only covers the
 * two stages currently implemented (Customer Details, Tax & Registration);
 * add an entry here whenever a new question is added to that form.
 */
const ONBOARDING_FIELD_LABELS: Record<string, string> = {
  [CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName]: "Customer / Legal Entity Name",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.brandName]: "Brand / Business Name",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.country]: "Country",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.address]: "Address",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.state]: "State",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.city]: "City",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.pincode]: "Pincode / Postal Code",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.industry]: "Industry / Category",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.website]: "Website",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.segment]: "Segment",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.businessUnit]: "Business Unit",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.contactName]: "Primary Contact Name",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.contactEmail]: "Primary Contact Email ID",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneCountryCode]: "Primary Contact Phone Country Code",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneNumber]: "Primary Contact Phone Number",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.contactDesignation]: "Primary Contact Designation",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber]: "GST Number",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.pan]: "PAN",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.tan]: "TAN",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType]: "Tax Identifier Type",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierName]: "Tax Identifier Name",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber]: "Tax / Registration Number",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.companyDocumentType]: "Company Document Type",
  [CUSTOMER_ONBOARDING_FIELD_KEYS.companyDocumentTypeOther]: "Company Document Type Name",
}

/** Every commentable field key, in form order, for the reviewer's field picker. */
const COMMENTABLE_ONBOARDING_FIELD_KEYS = Object.keys(ONBOARDING_FIELD_LABELS)

function labelForOnboardingField(fieldKey: string): string {
  return ONBOARDING_FIELD_LABELS[fieldKey] ?? fieldKey
}

export { ONBOARDING_FIELD_LABELS, COMMENTABLE_ONBOARDING_FIELD_KEYS, labelForOnboardingField }
