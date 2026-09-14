import { COMMERCIAL_DOCUMENT_DEFINITIONS } from "./commercial-documents"
import type { OnboardingDocumentType } from "./types"

/**
 * The one canonical document-type label registry (Platform Operating
 * Expansion, Phase E): every attachment surface (the upload stage, the
 * Attachments list) shows the same specific business purpose for a
 * given document type, never a generic category standing in for it
 * ("Tax & Registration" instead of "GST Certificate"). Reuses
 * `COMMERCIAL_DOCUMENT_DEFINITIONS`'s three labels rather than
 * duplicating them, so this is not a second source of truth for those.
 */
const ONBOARDING_DOCUMENT_LABELS: Record<OnboardingDocumentType, string> = {
  gst_certificate: "GST Registration Document",
  pan_card: "PAN Document",
  tan_card: "TAN Document",
  tax_registration: "Tax Registration Document",
  company_registration: "Company Registration / Incorporation Document",
  signed_agreement: "Signed Agreement",
  ...Object.fromEntries(COMMERCIAL_DOCUMENT_DEFINITIONS.map((definition) => [definition.documentType, definition.label])),
} as Record<OnboardingDocumentType, string>

function labelForOnboardingDocumentType(documentType: OnboardingDocumentType): string {
  return ONBOARDING_DOCUMENT_LABELS[documentType] ?? documentType
}

export { ONBOARDING_DOCUMENT_LABELS, labelForOnboardingDocumentType }
