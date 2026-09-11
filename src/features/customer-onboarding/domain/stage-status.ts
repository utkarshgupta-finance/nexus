import { CUSTOMER_ONBOARDING_FIELD_KEYS, TAX_IDENTIFIER_TYPE_OTHER } from "../forms/customer-onboarding-form-definition"
import { isCommercialRateDraftComplete, isCommercialRateDraftStarted } from "./commercial-rate"
import type { CommercialRateDraft } from "./commercial-rate"

/**
 * Stage completeness, derived purely from what has actually been entered,
 * never from navigation history. This is the fix for the stage-status bug
 * (task spec: "the previous stage receives a completion tick even if
 * mandatory fields are missing merely because the user moved to the next
 * tab"): nothing in this module reads which stage is current or which
 * stages have been visited. A stage is:
 *
 *   "not_started" - none of its applicable mandatory requirements have
 *                    any value yet
 *   "attention"    - some, but not all, applicable mandatory requirements
 *                    are filled
 *   "complete"     - every applicable mandatory requirement is filled (or
 *                    the stage currently has none, which is vacuously
 *                    complete rather than falsely "pending")
 *
 * The required-field lists below intentionally mirror the `isRequired`/
 * `requiredIf` conditions already declared in
 * ../forms/customer-onboarding-form-definition.ts (the actual source of
 * truth for what SurveyJS enforces at Submit). They are kept here, as a
 * second, small, pure list, rather than reading live `Question.isRequired`
 * off a mounted SurveyJS `Model`, so this logic stays unit-testable with
 * plain data and has no dependency on a live survey instance. The one
 * deliberate simplification: State's dynamic required-ness (only required
 * for a country that actually has states, resolved asynchronously from the
 * geography API) is not evaluated here, since it depends on data this pure
 * module never has; Submit-time validation (`survey.validate()`) still
 * enforces it independently.
 */
type CustomerOnboardingStageStatus = "not_started" | "attention" | "complete"

function isFieldValueEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === "string") return value.trim().length === 0
  return false
}

function fieldGroupStatus(data: Record<string, unknown>, requiredKeys: string[]): CustomerOnboardingStageStatus {
  if (requiredKeys.length === 0) return "complete"
  const filledCount = requiredKeys.filter((key) => !isFieldValueEmpty(data[key])).length
  if (filledCount === 0) return "not_started"
  if (filledCount === requiredKeys.length) return "complete"
  return "attention"
}

function documentGroupStatus(requiredDocuments: Array<unknown | null>): CustomerOnboardingStageStatus {
  if (requiredDocuments.length === 0) return "complete"
  const filledCount = requiredDocuments.filter((document) => document !== null).length
  if (filledCount === 0) return "not_started"
  if (filledCount === requiredDocuments.length) return "complete"
  return "attention"
}

function combineStatuses(statuses: CustomerOnboardingStageStatus[]): CustomerOnboardingStageStatus {
  if (statuses.every((status) => status === "complete")) return "complete"
  if (statuses.every((status) => status === "not_started")) return "not_started"
  return "attention"
}

const CUSTOMER_DETAILS_REQUIRED_FIELD_KEYS: string[] = [
  CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName,
  CUSTOMER_ONBOARDING_FIELD_KEYS.brandName,
  CUSTOMER_ONBOARDING_FIELD_KEYS.country,
  CUSTOMER_ONBOARDING_FIELD_KEYS.address,
  CUSTOMER_ONBOARDING_FIELD_KEYS.pincode,
  CUSTOMER_ONBOARDING_FIELD_KEYS.industry,
  CUSTOMER_ONBOARDING_FIELD_KEYS.segment,
  CUSTOMER_ONBOARDING_FIELD_KEYS.businessUnit,
  CUSTOMER_ONBOARDING_FIELD_KEYS.contactName,
  CUSTOMER_ONBOARDING_FIELD_KEYS.contactEmail,
  CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneCountryCode,
  CUSTOMER_ONBOARDING_FIELD_KEYS.contactPhoneNumber,
  CUSTOMER_ONBOARDING_FIELD_KEYS.contactDesignation,
]

function evaluateCustomerDetailsStatus(data: Record<string, unknown>): CustomerOnboardingStageStatus {
  return fieldGroupStatus(data, CUSTOMER_DETAILS_REQUIRED_FIELD_KEYS)
}

/**
 * Country-conditional, matching the form definition's own India vs
 * non-India branches (task spec §9: "do not hardcode one India-only list
 * globally"). Non-India additionally requires Tax Identifier Name, but
 * only once "Other" has actually been chosen as the identifier type.
 */
function requiredTaxRegistrationFieldKeys(isIndia: boolean, data: Record<string, unknown>): string[] {
  if (isIndia) {
    return [CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber, CUSTOMER_ONBOARDING_FIELD_KEYS.pan]
  }
  const keys: string[] = [CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType, CUSTOMER_ONBOARDING_FIELD_KEYS.taxRegistrationNumber]
  if (data[CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierType] === TAX_IDENTIFIER_TYPE_OTHER) {
    keys.push(CUSTOMER_ONBOARDING_FIELD_KEYS.taxIdentifierName)
  }
  return keys
}

type TaxDocumentsPresence = {
  gst: boolean
  pan: boolean
  tan: boolean
  taxRegistration: boolean
  companyRegistration: boolean
}

function evaluateTaxRegistrationStatus(
  data: Record<string, unknown>,
  isIndia: boolean,
  documents: TaxDocumentsPresence
): CustomerOnboardingStageStatus {
  const fieldStatus = fieldGroupStatus(data, requiredTaxRegistrationFieldKeys(isIndia, data))
  const requiredDocuments = isIndia
    ? [documents.gst, documents.pan, documents.tan]
    : [documents.taxRegistration, documents.companyRegistration]
  const documentStatus = documentGroupStatus(requiredDocuments.map((present) => (present ? true : null)))
  return combineStatuses([fieldStatus, documentStatus])
}

/**
 * Commercial Documents currently enforces no mandatory attachment (task
 * spec §11: "their Submit-time requiredness remains a separate business
 * decision unless already explicitly defined elsewhere" - none is defined
 * yet). Zero required items is vacuously satisfied: this honestly reflects
 * that nothing is currently outstanding, not that anything was uploaded.
 */
function evaluateCommercialDocumentsStatus(): CustomerOnboardingStageStatus {
  return "complete"
}

/**
 * Commercial Rate V1 (task spec §30): complete only once Billing Currency,
 * Commercial Scope, and at least one fully-specified commercial component
 * all exist. "Visited != complete" applies here exactly as everywhere else:
 * opening the stage and picking a currency alone is "attention," not
 * "complete," until an actual commercial component has been captured.
 */
function evaluateCommercialRateStatus(draft: CommercialRateDraft): CustomerOnboardingStageStatus {
  if (isCommercialRateDraftComplete(draft)) return "complete"
  if (isCommercialRateDraftStarted(draft)) return "attention"
  return "not_started"
}

/**
 * Mirrors ./completion.ts's `isEligibleForCompletion` rather than
 * duplicating its logic: Agreement & Approval reaches "complete" only when
 * that predicate is true, which today is never, since no authenticated
 * Legal Approval identity exists yet (see ../ui/customer-onboarding-page.tsx's
 * header). This stage will therefore always show "attention" once a Signed
 * Agreement is attached, honestly reflecting that final completion is
 * still pending Legal Approval, never a fabricated green tick.
 */
function evaluateAgreementApprovalStatus(
  hasSignedAgreement: boolean,
  legalApprovalComplete: boolean,
  isEligibleForCompletion: boolean
): CustomerOnboardingStageStatus {
  if (isEligibleForCompletion) return "complete"
  if (hasSignedAgreement || legalApprovalComplete) return "attention"
  return "not_started"
}

export {
  isFieldValueEmpty,
  fieldGroupStatus,
  documentGroupStatus,
  combineStatuses,
  CUSTOMER_DETAILS_REQUIRED_FIELD_KEYS,
  requiredTaxRegistrationFieldKeys,
  evaluateCustomerDetailsStatus,
  evaluateTaxRegistrationStatus,
  evaluateCommercialDocumentsStatus,
  evaluateCommercialRateStatus,
  evaluateAgreementApprovalStatus,
}
export type { CustomerOnboardingStageStatus, TaxDocumentsPresence }
