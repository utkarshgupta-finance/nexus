import { describe, expect, it } from "vitest"

import { toPersistedDocumentMetadata } from "./document-mappers"
import type { CustomerOnboardingDocumentRow } from "../data/document-row-types"

const ROW: CustomerOnboardingDocumentRow = {
  document_id: "doc-1",
  request_id: "req-1",
  category: "tax",
  document_type: "gst_certificate",
  original_file_name: "gst.pdf",
  mime_type: "application/pdf",
  size_bytes: 1024,
  storage_bucket: "customer-onboarding-documents",
  storage_path: "req-1/tax/gst_certificate/doc-1.pdf",
  uploaded_by: "user-a",
  uploaded_at: "2026-09-14T00:00:00.000Z",
  is_current: true,
}

describe("toPersistedDocumentMetadata", () => {
  it("maps every backend column to the domain shape, never fabricating a value", () => {
    expect(toPersistedDocumentMetadata(ROW)).toEqual({
      documentId: "doc-1",
      requestId: "req-1",
      category: "tax",
      documentType: "gst_certificate",
      originalFileName: "gst.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      storageBucket: "customer-onboarding-documents",
      storagePath: "req-1/tax/gst_certificate/doc-1.pdf",
      uploadedBy: "user-a",
      uploadedAt: "2026-09-14T00:00:00.000Z",
      isCurrent: true,
    })
  })
})
