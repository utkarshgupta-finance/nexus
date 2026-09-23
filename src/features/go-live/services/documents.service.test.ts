import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Real service test, mirroring customer-onboarding's own
 * documents.service.test.ts: proves `uploadGoLiveDocument` validates and
 * persists the Blob's own size, never a caller-supplied `size` field that
 * can disagree with it (Q-004: server-side re-validation must not trust a
 * client-declared value it cannot itself verify). `server-only` is mocked
 * away for this file only.
 */
vi.mock("server-only", () => ({}))

const uploadDocumentBytes = vi.fn()
const supersedeCurrentDocuments = vi.fn()
const insertDocumentMetadata = vi.fn()

vi.mock("../data/documents.data", () => ({
  uploadDocumentBytes: (...args: unknown[]) => uploadDocumentBytes(...args),
  supersedeCurrentDocuments: (...args: unknown[]) => supersedeCurrentDocuments(...args),
  insertDocumentMetadata: (...args: unknown[]) => insertDocumentMetadata(...args),
}))

beforeEach(() => {
  uploadDocumentBytes.mockReset()
  supersedeCurrentDocuments.mockReset().mockResolvedValue(undefined)
  insertDocumentMetadata.mockReset()
})

const validPdfBlob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])], { type: "application/pdf" })

describe("uploadGoLiveDocument (Q-004 server-side size re-validation)", () => {
  it("validates and persists the Blob's own size, not a caller-supplied `size` field", async () => {
    uploadDocumentBytes.mockResolvedValue(undefined)
    insertDocumentMetadata.mockResolvedValue({
      document_id: "doc-1",
      go_live_request_id: "glr-1",
      document_type: "customer_confirmation",
      original_file_name: "confirmation.pdf",
      mime_type: "application/pdf",
      size_bytes: validPdfBlob.size,
      storage_bucket: "go-live-documents",
      storage_path: "glr-1/customer_confirmation/doc-1.pdf",
      uploaded_by: "actor-1",
      uploaded_at: "2026-01-01T00:00:00.000Z",
      is_current: true,
    })

    const { uploadGoLiveDocument } = await import("./documents.service")
    await uploadGoLiveDocument({
      goLiveRequestId: "glr-1",
      documentType: "customer_confirmation",
      file: { name: "confirmation.pdf", mimeType: "application/pdf", size: validPdfBlob.size, bytes: validPdfBlob },
      actorUserId: "actor-1",
    })

    expect(uploadDocumentBytes).toHaveBeenCalledWith(expect.any(String), validPdfBlob, "application/pdf")
    expect(insertDocumentMetadata).toHaveBeenCalledWith(expect.objectContaining({ sizeBytes: validPdfBlob.size }))
  })

  it("rejects a Blob over the size limit even when the caller-supplied `size` field understates it (Q-004)", async () => {
    // A direct Server Action call (bypassing the browser's own upload UI)
    // could pass a `bytes` Blob and a `size` number that disagree. The
    // actual stored bytes always come from `bytes`, so the size limit
    // must be measured from `bytes`, never trusted from the separate field.
    const oversizedBlob = new Blob([new Uint8Array(2 * 1024 * 1024)], { type: "application/pdf" }) // 2MB, over the 1MB limit
    const { uploadGoLiveDocument, InvalidGoLiveDocumentError } = await import("./documents.service")

    await expect(
      uploadGoLiveDocument({
        goLiveRequestId: "glr-1",
        documentType: "customer_confirmation",
        file: { name: "confirmation.pdf", mimeType: "application/pdf", size: 100, bytes: oversizedBlob },
        actorUserId: "actor-1",
      })
    ).rejects.toBeInstanceOf(InvalidGoLiveDocumentError)

    expect(uploadDocumentBytes).not.toHaveBeenCalled()
  })
})

/**
 * Q-021 (Batch 23, discovered during Batch 22's Q-011): mirrors
 * customer-onboarding's own A-023 real-byte-signature test
 * (documents.service.test.ts, "rejects a file whose real bytes are not
 * a genuine PDF/JPEG"). Before this fix, uploadGoLiveDocument only
 * re-validated the caller-declared name/mimeType/size
 * (validateAttachmentFile), never the file's own first bytes, unlike
 * Onboarding's service, which additionally calls
 * matchesAllowedAttachmentSignature. A file whose real bytes are a
 * disallowed format (e.g. a PNG) but whose name/declared MIME type
 * claim an allowed one would pass Go Live's validation and reach
 * Storage.
 */
describe("uploadGoLiveDocument real-byte-signature verification (Q-021)", () => {
  it("rejects a file whose real bytes are not a genuine PDF/JPEG, even with an allowed name and claimed MIME type", async () => {
    const { uploadGoLiveDocument, InvalidGoLiveDocumentError } = await import("./documents.service")
    const pngBytesDisguisedAsPdf = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "application/pdf" })

    await expect(
      uploadGoLiveDocument({
        goLiveRequestId: "glr-1",
        documentType: "customer_confirmation",
        file: { name: "disguised.pdf", mimeType: "application/pdf", size: 8, bytes: pngBytesDisguisedAsPdf },
        actorUserId: "actor-1",
      })
    ).rejects.toBeInstanceOf(InvalidGoLiveDocumentError)

    expect(uploadDocumentBytes).not.toHaveBeenCalled()
  })

  it("accepts a genuine PDF whose real bytes match the claimed type", async () => {
    uploadDocumentBytes.mockResolvedValue(undefined)
    insertDocumentMetadata.mockResolvedValue({
      document_id: "doc-2",
      go_live_request_id: "glr-1",
      document_type: "customer_confirmation",
      original_file_name: "confirmation.pdf",
      mime_type: "application/pdf",
      size_bytes: validPdfBlob.size,
      storage_bucket: "go-live-documents",
      storage_path: "glr-1/customer_confirmation/doc-2.pdf",
      uploaded_by: "actor-1",
      uploaded_at: "2026-01-01T00:00:00.000Z",
      is_current: true,
    })

    const { uploadGoLiveDocument } = await import("./documents.service")
    await uploadGoLiveDocument({
      goLiveRequestId: "glr-1",
      documentType: "customer_confirmation",
      file: { name: "confirmation.pdf", mimeType: "application/pdf", size: validPdfBlob.size, bytes: validPdfBlob },
      actorUserId: "actor-1",
    })

    expect(uploadDocumentBytes).toHaveBeenCalled()
  })
})
