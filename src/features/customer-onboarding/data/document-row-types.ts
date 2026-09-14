/** Raw shape of a customer_onboarding_documents row, matching the migration column-for-column. */
type CustomerOnboardingDocumentRow = {
  document_id: string
  request_id: string
  category: "tax" | "commercial" | "agreement"
  document_type: string
  original_file_name: string
  mime_type: string
  size_bytes: number
  storage_bucket: string
  storage_path: string
  uploaded_by: string | null
  uploaded_at: string
  is_current: boolean
}

export type { CustomerOnboardingDocumentRow }
