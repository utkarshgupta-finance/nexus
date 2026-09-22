import "server-only"

import * as documentsData from "../data/documents.data"
import { listDocumentsForGoLiveRequest } from "../data/go-live.data"
import { validateAttachmentFile } from "@/features/customer-onboarding/domain/documents"
import type { PersistedGoLiveDocumentMetadata, GoLiveDocumentType } from "../domain/types"
import type { GoLiveDocumentRow } from "../data/go-live-row-types"

class InvalidGoLiveDocumentError extends Error {}

/**
 * Application service for Go Live customer confirmation evidence.
 * Reuses the existing validation policy (`validateAttachmentFile`) and
 * the browser-independent input contract exactly as documented in
 * customer-onboarding/services/documents.service.ts: a genuine second
 * consumer of that policy, not a reinvented one. Persistence itself is
 * feature-owned (../data/documents.data.ts), matching onboarding's own
 * pattern rather than a not-yet-generalized shared platform table.
 */

type DocumentUploadInput = { name: string; mimeType: string; size: number; bytes: Blob }

type UploadGoLiveDocumentInput = {
  goLiveRequestId: string
  documentType: GoLiveDocumentType
  file: DocumentUploadInput
  actorUserId: string | null
}

function toPersistedGoLiveDocumentMetadata(row: GoLiveDocumentRow): PersistedGoLiveDocumentMetadata {
  return {
    documentId: row.document_id,
    goLiveRequestId: row.go_live_request_id,
    documentType: row.document_type as GoLiveDocumentType,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    isCurrent: row.is_current,
  }
}

/** Opaque path only, matching onboarding's own document-paths.ts convention: never a customer name or tax identifier in the Storage key. */
function buildGoLiveDocumentStoragePath(goLiveRequestId: string, documentType: string, documentId: string, fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".")
  const rawExtension = dotIndex === -1 ? "" : fileName.slice(dotIndex)
  const extension = /^\.[a-zA-Z0-9]{1,5}$/.test(rawExtension) ? rawExtension : ""
  return `${goLiveRequestId}/${documentType}/${documentId}${extension}`
}

async function uploadGoLiveDocument(input: UploadGoLiveDocumentInput): Promise<PersistedGoLiveDocumentMetadata> {
  // Validate against the Blob's own size, never the caller-supplied `size`
  // field: a direct Server Action call can pass a `bytes` Blob and a
  // `size` number that disagree, and the actual stored bytes always come
  // from `bytes`, so that is the only size a size limit can honestly gate.
  const actualSizeBytes = input.file.bytes.size
  const validation = validateAttachmentFile({ name: input.file.name, type: input.file.mimeType, size: actualSizeBytes }, "This document")
  if (!validation.valid) {
    throw new InvalidGoLiveDocumentError(validation.reason)
  }

  const documentId = crypto.randomUUID()
  const storagePath = buildGoLiveDocumentStoragePath(input.goLiveRequestId, input.documentType, documentId, input.file.name)

  await documentsData.uploadDocumentBytes(storagePath, input.file.bytes, input.file.mimeType)
  await documentsData.supersedeCurrentDocuments(input.goLiveRequestId, input.documentType)
  const row = await documentsData.insertDocumentMetadata({
    documentId,
    goLiveRequestId: input.goLiveRequestId,
    documentType: input.documentType,
    originalFileName: input.file.name,
    mimeType: input.file.mimeType,
    sizeBytes: actualSizeBytes,
    storagePath,
    uploadedBy: input.actorUserId,
  })
  return toPersistedGoLiveDocumentMetadata(row)
}

/** Null if the document does not exist; a signed URL is never generated for a document nobody can prove exists. */
async function getGoLiveDocumentDownloadUrl(documentId: string): Promise<string | null> {
  const row = await documentsData.getDocumentById(documentId)
  if (!row) return null
  return documentsData.createSignedDownloadUrl(row.storage_path)
}

async function listGoLiveDocuments(goLiveRequestId: string): Promise<PersistedGoLiveDocumentMetadata[]> {
  const rows = await listDocumentsForGoLiveRequest(goLiveRequestId)
  return rows.map(toPersistedGoLiveDocumentMetadata)
}

export { uploadGoLiveDocument, getGoLiveDocumentDownloadUrl, listGoLiveDocuments, toPersistedGoLiveDocumentMetadata, InvalidGoLiveDocumentError }
export type { DocumentUploadInput }
