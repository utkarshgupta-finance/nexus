import { describe, expect, it } from "vitest"

import { ONBOARDING_DOCUMENT_LABELS, labelForOnboardingDocumentType } from "./document-labels"

const ALL_DOCUMENT_TYPES = [
  "gst_certificate",
  "pan_card",
  "tan_card",
  "tax_registration",
  "company_registration",
  "proposal_document",
  "customer_po",
  "pi_copy",
  "signed_agreement",
] as const

describe("labelForOnboardingDocumentType (Platform Operating Expansion, Phase E)", () => {
  it("has a real, specific business-purpose label for every document type, never a generic category", () => {
    for (const documentType of ALL_DOCUMENT_TYPES) {
      const label = labelForOnboardingDocumentType(documentType)
      expect(label).toBeTruthy()
      expect(label).not.toBe("Tax & Registration")
      expect(label).not.toBe("Commercial Documents")
    }
  })

  it("reuses the same label Commercial Documents' own definitions already declare, never a second source of truth", () => {
    expect(ONBOARDING_DOCUMENT_LABELS.proposal_document).toBe("Proposal Sent to Customer")
    expect(ONBOARDING_DOCUMENT_LABELS.customer_po).toBe("Customer PO")
    expect(ONBOARDING_DOCUMENT_LABELS.pi_copy).toBe("PI Copy")
  })
})
