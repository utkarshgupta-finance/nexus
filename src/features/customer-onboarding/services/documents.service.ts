import "server-only"

import * as documentsData from "../data/documents.data"
import { toPersistedDocumentMetadata } from "../domain/document-mappers"
import { buildStoragePath } from "../domain/document-paths"
import { validateAttachmentFile } from "../domain/documents"
import { resolveActorEmails } from "@/platform/audit/server"
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
 * with a crafted request bypassing whatever the browser validated.
 */
async function uploadOnboardingDocument(input: UploadOnboardingDocumentInput): Promise<PersistedOnboardingDocumentMetadata> {
  const validation = validateAttachmentFile({ name: input.file.name, type: input.file.mimeType, size: input.file.size }, "This document")
  if (!validation.valid) {
    throw new InvalidDocumentError(validation.reason)
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
    sizeBytes: input.file.size,
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
 * matching the same `resolveActorEmails` pattern every other actor
 * display in the app already uses.
 */
async function listOnboardingDocumentsForEditor(requestId: string): Promise<PersistedOnboardingDocumentView[]> {
  const documents = await listOnboardingDocuments(requestId)
  const actorEmails = await resolveActorEmails(documents.map((document) => document.uploadedBy))
  return documents.map((document) => ({
    ...document,
    uploadedByLabel: document.uploadedBy ? (actorEmails.get(document.uploadedBy) ?? null) : null,
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

export {
  uploadOnboardingDocument,
  listOnboardingDocuments,
  listOnboardingDocumentsForEditor,
  listOnboardingDocumentsForRevision,
  getOnboardingDocumentDownloadUrl,
  InvalidDocumentError,
}
export type { DocumentUploadInput }
