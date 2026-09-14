import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"
import type { GoLiveDocumentRow } from "./go-live-row-types"

const BUCKET = "go-live-documents"

class GoLiveDocumentOperationError extends Error {}

/**
 * Repository for Go Live customer confirmation evidence: Supabase
 * Storage for file bytes, `go_live_documents` for metadata
 * (supabase/migrations/20260918010000_go_live_domain.sql). Mirrors
 * src/features/customer-onboarding/data/documents.data.ts's exact
 * shape: this is the same kind of feature-owned document table
 * onboarding itself has (the Documents platform is not yet generalized
 * across features), not a second competing design.
 */

async function uploadDocumentBytes(storagePath: string, bytes: Blob, mimeType: string): Promise<void> {
  const supabase = getSupabaseServiceRoleClient()
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, { contentType: mimeType, upsert: false })
  if (error) throw new GoLiveDocumentOperationError(`Failed to upload document: ${error.message}`)
}

async function supersedeCurrentDocuments(goLiveRequestId: string, documentType: string): Promise<void> {
  const supabase = getSupabaseServiceRoleClient()
  const { error } = await supabase
    .from("go_live_documents")
    .update({ is_current: false })
    .eq("go_live_request_id", goLiveRequestId)
    .eq("document_type", documentType)
    .eq("is_current", true)
  if (error) throw new GoLiveDocumentOperationError(`Failed to supersede prior document: ${error.message}`)
}

type InsertDocumentMetadataInput = {
  documentId: string
  goLiveRequestId: string
  documentType: string
  originalFileName: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  uploadedBy: string | null
}

async function insertDocumentMetadata(input: InsertDocumentMetadataInput): Promise<GoLiveDocumentRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("go_live_documents")
    .insert({
      document_id: input.documentId,
      go_live_request_id: input.goLiveRequestId,
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
  if (error) throw new GoLiveDocumentOperationError(`Failed to save document metadata: ${error.message}`)
  return data
}

async function getDocumentById(documentId: string): Promise<GoLiveDocumentRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("go_live_documents").select("*").eq("document_id", documentId).maybeSingle()
  if (error) throw new GoLiveDocumentOperationError(`Failed to load document: ${error.message}`)
  return data
}

/** Short-lived signed URL: this bucket is private, so there is no public URL for any document ever. */
async function createSignedDownloadUrl(storagePath: string): Promise<string> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300)
  if (error || !data) throw new GoLiveDocumentOperationError(`Failed to create a download link: ${error?.message ?? "unknown error"}`)
  return data.signedUrl
}

export { uploadDocumentBytes, supersedeCurrentDocuments, insertDocumentMetadata, getDocumentById, createSignedDownloadUrl, GoLiveDocumentOperationError, BUCKET }
export type { InsertDocumentMetadataInput }
