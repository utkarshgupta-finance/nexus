import { CUSTOMER_ONBOARDING_FIELD_KEYS } from "../forms/customer-onboarding-form-definition"
import type { CommercialRateDraft } from "./commercial-rate"

/**
 * Maps a submitted onboarding revision's raw field values onto the real
 * `customers` governed columns (task Phase H), the inverse direction of
 * `mapOnboardingComponentToCommercialComponentInsert`
 * (./commercial-configuration-promotion.ts) for Commercial Components:
 * this is the one place that knows the onboarding form's own field key
 * spelling differs from the Customer Master column it feeds (most keys
 * are identical, but `pincode` -> `postal_code`, and the real Billing
 * Currency lives inside the Commercial Rate draft, never the vestigial
 * top-level `billing_currency` field key the form defines but never
 * actually renders a question for). Both `approve_customer_onboarding_case`
 * (creation) and the shared governed-field registry
 * (src/features/customers/domain/governed-field-registry.ts, consumed by
 * Customer Change) agree on the resulting column keys, so a value
 * captured at onboarding and a value later proposed by a Change Request
 * always land in the exact same place.
 */
function asGovernedText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function extractGovernedCustomerFieldsFromOnboarding(
  values: Record<string, unknown>,
  commercialRate: CommercialRateDraft | null
): Record<string, string | null> {
  return {
    brand_name: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.brandName]),
    address: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.address]),
    state: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.state]),
    city: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.city]),
    postal_code: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.pincode]),
    website: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.website]),
    primary_contact_name: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.contactName]),
    primary_contact_email: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.contactEmail]),
    primary_contact_phone_country_code: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneCountryCode]),
    primary_contact_phone_number: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneNumber]),
    primary_contact_designation: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.contactDesignation]),
    gst_number: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber]),
    pan: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.pan]),
    tan: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.tan]),
    tax_identifier_type: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType]),
    tax_identifier_name: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierName]),
    tax_registration_number: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber]),
    company_document_type: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.companyDocumentType]),
    company_document_type_other: asGovernedText(values[CUSTOMER_ONBOARDING_FIELD_KEYS.companyDocumentTypeOther]),
    billing_currency: commercialRate?.billingCurrency ?? null,
  }
}

export { extractGovernedCustomerFieldsFromOnboarding }
