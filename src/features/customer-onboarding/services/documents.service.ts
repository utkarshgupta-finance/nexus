import "server-only"

import * as documentsData from "../data/documents.data"
import { toPersistedDocumentMetadata } from "../domain/document-mappers"
import { buildStoragePath } from "../domain/document-paths"
import { validateAttachmentFile, matchesAllowedAttachmentSignature } from "../domain/documents"
import { resolveActorLabels } from "@/platform/audit/server"
import type { PersistedOnboardingDocumentMetadata, PersistedOnboardingDocumentView, OnboardingDocumentType } from "../domain/types"

class InvalidDocumentError extends Error {}

/**
 * Application service for Customer Onboarding document evidence (task
 * Phase D): the real persistence path
 * src/features/customer-onboarding/domain/documents.ts's own header
 * documented as missing. Thin orchestration over ../data/documents.data.ts,
 * matching every other service in this feature.
 */

/**
 * The browser-independent document input contract (Platform Scale
 * Closure, Phase R): a browser `File` happens to satisfy this shape
 * (`File extends Blob`, plus `name`/`type`/`size`), so the existing
 * Server Action adapter (`actions.ts`) passes one straight through with
 * no conversion; a future API/import caller can construct one from a
 * plain buffer without ever needing a browser `File` object, which does
 * not exist outside a browser/DOM-ish runtime.
 */
type DocumentUploadInput = {
  name: string
  mimeType: string
  size: number
  bytes: Blob
}

type UploadOnboardingDocumentInput = {
  requestId: string
  category: "tax" | "commercial" | "agreement"
  documentType: OnboardingDocumentType
  file: DocumentUploadInput
  actorUserId: string | null
}

/**
 * Uploads file bytes, then supersedes any prior current document of this
 * exact type on this request, then inserts the new metadata row: in that
 * order, so a failed upload never orphans metadata, and a failed
 * supersede/insert never leaves two "current" documents of the same type.
 *
 * Re-validates type/size server-side using the exact same policy the
 * upload UI already checks (../domain/documents.ts's `validateAttachmentFile`):
 * the UI check is a convenience for the honest user, never the enforcement
 * boundary, since a client can always call this Server Action directly
 * with a crafted request bypassing whatever the browser validated. That
 * metadata check alone only re-confirms the filename/reported MIME type,
 * both just labels the caller attached; a disguised file (real bytes of
 * a different, disallowed format, renamed with an allowed extension)
 * would still pass it. This additionally reads the file's own first
 * bytes and confirms they match a real PDF or JPEG signature, the one
 * check only the server can perform, since it needs the actual bytes.
 */
async function uploadOnboardingDocument(input: UploadOnboardingDocumentInput): Promise<PersistedOnboardingDocumentMetadata> {
  // Validate against the Blob's own size, never the caller-supplied `size`
  // field: a direct Server Action call can pass a `bytes` Blob and a
  // `size` number that disagree, and the actual stored bytes always come
  // from `bytes`, so that is the only size a size limit can honestly gate.
  const actualSizeBytes = input.file.bytes.size
  const validation = validateAttachmentFile({ name: input.file.name, type: input.file.mimeType, size: actualSizeBytes }, "This document")
  if (!validation.valid) {
    throw new InvalidDocumentError(validation.reason)
  }

  const firstBytes = new Uint8Array(await input.file.bytes.slice(0, 4).arrayBuffer())
  if (!matchesAllowedAttachmentSignature(firstBytes)) {
    throw new InvalidDocumentError(`'${input.file.name}' does not appear to be a genuine PDF or JPEG file. Allowed file types are PDF, JPG and JPEG.`)
  }

  const documentId = crypto.randomUUID()
  const storagePath = buildStoragePath(input.requestId, input.category, input.documentType, documentId, input.file.name)

  await documentsData.uploadDocumentBytes(storagePath, input.file.bytes, input.file.mimeType)
  await documentsData.supersedeCurrentDocuments(input.requestId, input.documentType)
  const row = await documentsData.insertDocumentMetadata({
    documentId,
    requestId: input.requestId,
    category: input.category,
    documentType: input.documentType,
    originalFileName: input.file.name,
    mimeType: input.file.mimeType,
    sizeBytes: actualSizeBytes,
    storagePath,
    uploadedBy: input.actorUserId,
  })
  return toPersistedDocumentMetadata(row)
}

async function listOnboardingDocuments(requestId: string): Promise<PersistedOnboardingDocumentMetadata[]> {
  const rows = await documentsData.listCurrentDocumentsForRequest(requestId)
  return rows.map(toPersistedDocumentMetadata)
}

/**
 * The requester-facing editor's view of already-persisted attachments
 * (Platform Operating Expansion, Phase A): closes the real defect where
 * reopening a Sent Back request showed every attachment slot as empty,
 * even though the documents were still there. Adds a display-ready
 * uploader label so the editor never has to resolve `uploadedBy` itself,
 * matching the same `resolveActorLabels` pattern every other actor
 * display in the app already uses.
 */
async function listOnboardingDocumentsWithUploader(requestId: string): Promise<PersistedOnboardingDocumentView[]> {
  const documents = await listOnboardingDocuments(requestId)
  const actorLabels = await resolveActorLabels(documents.map((document) => document.uploadedBy))
  return documents.map((document) => ({
    ...document,
    uploadedByLabel: document.uploadedBy ? (actorLabels.get(document.uploadedBy) ?? null) : null,
  }))
}

/**
 * Reconstructs the exact evidence set that backed one specific revision
 * (Platform Operating Expansion, Phase A), for a reviewer needing to
 * understand what a historical, already-decided submission actually
 * had, independent of what has since replaced it.
 */
async function listOnboardingDocumentsForRevision(requestId: string, revisionNumber: number): Promise<PersistedOnboardingDocumentMetadata[]> {
  const rows = await documentsData.listDocumentsForRevision(requestId, revisionNumber)
  return rows.map(toPersistedDocumentMetadata)
}

/** Null if the document does not exist; a signed URL is never generated for a document nobody can prove exists. */
async function getOnboardingDocumentDownloadUrl(documentId: string): Promise<string | null> {
  const row = await documentsData.getDocumentById(documentId)
  if (!row) return null
  return documentsData.createSignedDownloadUrl(row.storage_path)
}

/**
 * Batch 22 (Q-018 incidental defect): resolves which request a document
 * belongs to, so the download action can apply the same PD-005
 * customer/business-unit scoping the request's own review page already
 * enforces, before ever generating a signed URL. Null if the document
 * does not exist.
 */
async function getOnboardingDocumentRequestId(documentId: string): Promise<string | null> {
  const row = await documentsData.getDocumentById(documentId)
  return row?.request_id ?? null
}

export {
  uploadOnboardingDocument,
  listOnboardingDocuments,
  listOnboardingDocumentsWithUploader,
  listOnboardingDocumentsForRevision,
  getOnboardingDocumentDownloadUrl,
  getOnboardingDocumentRequestId,
  InvalidDocumentError,
}
export type { DocumentUploadInput }
