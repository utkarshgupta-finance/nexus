import type { OnboardingDocumentType } from "./types"

/**
 * Commercial Documents stage content (task spec §11): Proposal Sent to
 * Customer, Customer PO, PI Copy. Billing Currency is deliberately absent
 * here: it moved to Commercial Rate (task spec §12), a separate plain
 * React field, not one of this stage's attachments. A small, testable,
 * pure list rather than three JSX blocks repeated inline, so this stage's
 * exact content is assertable without a component test harness (this
 * repo has none; see ./commercial-documents.test.ts).
 */
type CommercialDocumentDefinition = {
  documentType: Extract<OnboardingDocumentType, "proposal_document" | "customer_po" | "pi_copy">
  label: string
  helpText?: string
}

const COMMERCIAL_DOCUMENT_DEFINITIONS: CommercialDocumentDefinition[] = [
  { documentType: "proposal_document", label: "Proposal Sent to Customer" },
  {
    documentType: "customer_po",
    label: "Customer PO",
    helpText: "Optional at this stage; the final requirement for this attachment is not yet confirmed.",
  },
  { documentType: "pi_copy", label: "PI Copy" },
]

export { COMMERCIAL_DOCUMENT_DEFINITIONS }
export type { CommercialDocumentDefinition }
