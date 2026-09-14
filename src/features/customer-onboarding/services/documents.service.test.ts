import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Real service test (Platform Scale Closure, Phase U, closing a gap
 * from Phase R): proves the browser-independent DocumentUploadInput
 * fields (`name`/`mimeType`/`size`/`bytes`) are wired through correctly
 * end to end, the exact class of regression a field rename can silently
 * introduce (this file's own validation call was rewritten from
 * `input.file.type` to `input.file.mimeType` in the same change this
 * test guards). `server-only` is mocked away for this file only.
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

const validPdfBlob = new Blob(["fake pdf bytes"], { type: "application/pdf" })

describe("uploadOnboardingDocument (Platform Scale Closure, Phase R/U)", () => {
  it("rejects a disallowed file type before ever touching storage", async () => {
    const { uploadOnboardingDocument, InvalidDocumentError } = await import("./documents.service")

    await expect(
      uploadOnboardingDocument({
        requestId: "r1",
        category: "tax",
        documentType: "gst_certificate",
        file: { name: "malware.exe", mimeType: "application/x-msdownload", size: 1000, bytes: new Blob(["x"]) },
        actorUserId: "actor-1",
      })
    ).rejects.toBeInstanceOf(InvalidDocumentError)

    expect(uploadDocumentBytes).not.toHaveBeenCalled()
  })

  it("passes the exact mimeType/name/size through to storage and metadata, not File-specific fields", async () => {
    uploadDocumentBytes.mockResolvedValue(undefined)
    insertDocumentMetadata.mockResolvedValue({
      document_id: "doc-1",
      request_id: "r1",
      category: "tax",
      document_type: "gst_certificate",
      original_file_name: "gst.pdf",
      mime_type: "application/pdf",
      size_bytes: 12345,
      storage_bucket: "customer-onboarding-documents",
      storage_path: "r1/tax/gst_certificate/doc-1.pdf",
      uploaded_by: "actor-1",
      uploaded_at: "2026-01-01T00:00:00.000Z",
      is_current: true,
    })

    const { uploadOnboardingDocument } = await import("./documents.service")
    await uploadOnboardingDocument({
      requestId: "r1",
      category: "tax",
      documentType: "gst_certificate",
      file: { name: "gst.pdf", mimeType: "application/pdf", size: 12345, bytes: validPdfBlob },
      actorUserId: "actor-1",
    })

    expect(uploadDocumentBytes).toHaveBeenCalledWith(expect.any(String), validPdfBlob, "application/pdf")
    expect(insertDocumentMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ originalFileName: "gst.pdf", mimeType: "application/pdf", sizeBytes: 12345 })
    )
  })

  it("supersedes prior documents before inserting new metadata, never the reverse order", async () => {
    uploadDocumentBytes.mockResolvedValue(undefined)
    const callOrder: string[] = []
    supersedeCurrentDocuments.mockImplementation(async () => {
      callOrder.push("supersede")
    })
    insertDocumentMetadata.mockImplementation(async () => {
      callOrder.push("insert")
      return {
        document_id: "doc-1",
        request_id: "r1",
        category: "tax",
        document_type: "gst_certificate",
        original_file_name: "gst.pdf",
        mime_type: "application/pdf",
        size_bytes: 100,
        storage_bucket: "customer-onboarding-documents",
        storage_path: "r1/tax/gst_certificate/doc-1.pdf",
        uploaded_by: "actor-1",
        uploaded_at: "2026-01-01T00:00:00.000Z",
        is_current: true,
      }
    })

    const { uploadOnboardingDocument } = await import("./documents.service")
    await uploadOnboardingDocument({
      requestId: "r1",
      category: "tax",
      documentType: "gst_certificate",
      file: { name: "gst.pdf", mimeType: "application/pdf", size: 100, bytes: validPdfBlob },
      actorUserId: "actor-1",
    })

    expect(callOrder).toEqual(["supersede", "insert"])
  })
})
