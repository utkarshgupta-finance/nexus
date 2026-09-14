import "server-only"

import * as documentsData from "../data/documents.data"
import { toPersistedDocumentMetadata } from "../domain/document-mappers"
import { buildStoragePath } from "../domain/document-paths"
import type { PersistedOnboardingDocumentMetadata, OnboardingDocumentType } from "../domain/types"

/**
 * Application service for Customer Onboarding document evidence (task
 * Phase D): the real persistence path
 * src/features/customer-onboarding/domain/documents.ts's own header
 * documented as missing. Thin orchestration over ../data/documents.data.ts,
 * matching every other service in this feature.
 */

type UploadOnboardingDocumentInput = {
  requestId: string
  category: "tax" | "commercial" | "agreement"
  documentType: OnboardingDocumentType
  file: File
  actorUserId: string | null
}

/** Uploads file bytes, then supersedes any prior current document of this exact type on this request, then inserts the new metadata row: in that order, so a failed upload never orphans metadata, and a failed supersede/insert never leaves two "current" documents of the same type. */
async function uploadOnboardingDocument(input: UploadOnboardingDocumentInput): Promise<PersistedOnboardingDocumentMetadata> {
  const documentId = crypto.randomUUID()
  const storagePath = buildStoragePath(input.requestId, input.category, input.documentType, documentId, input.file.name)

  await documentsData.uploadDocumentBytes(storagePath, input.file)
  await documentsData.supersedeCurrentDocuments(input.requestId, input.documentType)
  const row = await documentsData.insertDocumentMetadata({
    documentId,
    requestId: input.requestId,
    category: input.category,
    documentType: input.documentType,
    originalFileName: input.file.name,
    mimeType: input.file.type,
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

/** Null if the document does not exist; a signed URL is never generated for a document nobody can prove exists. */
async function getOnboardingDocumentDownloadUrl(documentId: string): Promise<string | null> {
  const row = await documentsData.getDocumentById(documentId)
  if (!row) return null
  return documentsData.createSignedDownloadUrl(row.storage_path)
}

export { uploadOnboardingDocument, listOnboardingDocuments, getOnboardingDocumentDownloadUrl }
