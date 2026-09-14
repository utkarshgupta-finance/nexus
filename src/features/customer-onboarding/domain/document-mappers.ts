import type { CustomerOnboardingDocumentRow } from "../data/document-row-types"
import type { OnboardingDocumentType, PersistedOnboardingDocumentMetadata } from "./types"

function toPersistedDocumentMetadata(row: CustomerOnboardingDocumentRow): PersistedOnboardingDocumentMetadata {
  return {
    documentId: row.document_id,
    requestId: row.request_id,
    category: row.category,
    documentType: row.document_type as OnboardingDocumentType,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    isCurrent: row.is_current,
  }
}

export { toPersistedDocumentMetadata }
