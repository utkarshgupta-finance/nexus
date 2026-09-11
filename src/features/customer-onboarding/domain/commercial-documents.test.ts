import { describe, expect, it } from "vitest"

import { COMMERCIAL_DOCUMENT_DEFINITIONS } from "./commercial-documents"

describe("Commercial Documents stage content", () => {
  it("contains exactly Proposal Sent to Customer, Customer PO, and PI Copy", () => {
    expect(COMMERCIAL_DOCUMENT_DEFINITIONS.map((definition) => definition.documentType)).toEqual([
      "proposal_document",
      "customer_po",
      "pi_copy",
    ])
    expect(COMMERCIAL_DOCUMENT_DEFINITIONS.map((definition) => definition.label)).toEqual([
      "Proposal Sent to Customer",
      "Customer PO",
      "PI Copy",
    ])
  })

  it("never includes Billing Currency: it moved to Commercial Rate", () => {
    const labels = COMMERCIAL_DOCUMENT_DEFINITIONS.map((definition) => definition.label.toLowerCase())
    expect(labels.some((label) => label.includes("currency"))).toBe(false)
  })
})
