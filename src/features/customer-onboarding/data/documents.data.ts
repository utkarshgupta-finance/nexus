import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"
import type { CustomerOnboardingDocumentRow } from "./document-row-types"

const BUCKET = "customer-onboarding-documents"

class DocumentOperationError extends Error {}

/**
 * Repository for Customer Onboarding document evidence: Supabase Storage
 * for file bytes, `customer_onboarding_documents` for metadata
 * (supabase/migrations/20260914110000_customer_onboarding_documents.sql).
 * Mirrors this feature's other data/*.ts modules: thin I/O only, no
 * business logic (that lives in services/documents.service.ts).
 */

/**
 * `bytes` is typed as `Blob`, not `File` (Platform Scale Closure, Phase
 * R): `File` is a browser/DOM-specific extension of `Blob` with extra
 * fields (name, lastModified) this function never reads. A future
 * non-browser caller (an API upload, an import job) can hand this a
 * plain `Blob` without needing to fabricate a `File`.
 */
async function uploadDocumentBytes(storagePath: string, bytes: Blob, mimeType: string): Promise<void> {
  const supabase = getSupabaseServiceRoleClient()
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, { contentType: mimeType, upsert: false })
  if (error) throw new DocumentOperationError(`Failed to upload document: ${error.message}`)
}

/** The one column ever allowed to change after insert (fn_protect_customer_onboarding_document_lifecycle): supersede every prior current document of this exact type on this request, before the new one is inserted. */
async function supersedeCurrentDocuments(requestId: string, documentType: string): Promise<void> {
  const supabase = getSupabaseServiceRoleClient()
  const { error } = await supabase
    .from("customer_onboarding_documents")
    .update({ is_current: false })
    .eq("request_id", requestId)
    .eq("document_type", documentType)
    .eq("is_current", true)
  if (error) throw new DocumentOperationError(`Failed to supersede prior document: ${error.message}`)
}

type InsertDocumentMetadataInput = {
  documentId: string
  requestId: string
  category: "tax" | "commercial" | "agreement"
  documentType: string
  originalFileName: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  uploadedBy: string | null
}

async function insertDocumentMetadata(input: InsertDocumentMetadataInput): Promise<CustomerOnboardingDocumentRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_onboarding_documents")
    .insert({
      document_id: input.documentId,
      request_id: input.requestId,
      category: input.category,
      document_type: input.documentType,
      original_file_name: input.originalFileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      storage_bucket: BUCKET,
      storage_path: input.storagePath,
      uploaded_by: input.uploadedBy,
    })
    .select("*")
    .single()
  if (error) throw new DocumentOperationError(`Failed to save document metadata: ${error.message}`)
  return data
}

/** Every currently-current document for a request: the review/evidence surface's data source. Superseded documents are deliberately excluded here (still permanently retained in the table itself, just not shown as "the current evidence"). */
async function listCurrentDocumentsForRequest(requestId: string): Promise<CustomerOnboardingDocumentRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_onboarding_documents")
    .select("*")
    .eq("request_id", requestId)
    .eq("is_current", true)
    .order("uploaded_at", { ascending: true })
  if (error) throw new DocumentOperationError(`Failed to list documents: ${error.message}`)
  return data ?? []
}

async function getDocumentById(documentId: string): Promise<CustomerOnboardingDocumentRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("customer_onboarding_documents").select("*").eq("document_id", documentId).maybeSingle()
  if (error) throw new DocumentOperationError(`Failed to load document: ${error.message}`)
  return data
}

/** Short-lived signed URL: this bucket is private, so there is no public URL for any document ever (task Phase D). */
async function createSignedDownloadUrl(storagePath: string): Promise<string> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300)
  if (error || !data) throw new DocumentOperationError(`Failed to create a download link: ${error?.message ?? "unknown error"}`)
  return data.signedUrl
}

export {
  uploadDocumentBytes,
  supersedeCurrentDocuments,
  insertDocumentMetadata,
  listCurrentDocumentsForRequest,
  getDocumentById,
  createSignedDownloadUrl,
  DocumentOperationError,
  BUCKET,
}
export type { InsertDocumentMetadataInput }
