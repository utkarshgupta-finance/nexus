/** Raw shape of a customer_onboarding_cases row, matching the migration column-for-column. */
type CustomerOnboardingCaseRow = {
  request_id: string
  /** Human-Friendly ID (task Phase L), rendered "CO-######" (see domain/human-ids.ts). Immutable once assigned. */
  case_number: number
  status: "draft" | "submitted" | "sent_back" | "resubmitted" | "approved"
  current_stage_key: "customer_details" | "tax_registration" | "commercial_documents" | "commercial_rate" | "agreement_approval"
  sent_back_reason: string | null
  sent_back_by: string | null
  sent_back_at: string | null
  sent_back_target_stage_key: CustomerOnboardingCaseRow["current_stage_key"] | null
  approved_by: string | null
  approved_at: string | null
  customer_id: string | null
  commercial_configuration_id: string | null
  row_version: number
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

/** Raw shape of a submission_revisions row (supabase/migrations/20260907044335_submission_data_foundation.sql). */
type SubmissionRevisionRow = {
  id: string
  request_id: string
  revision_number: number
  status: "draft" | "submitted"
  row_version: number
  submission_contract_version: number
  raw_data: Record<string, unknown>
  effective_data: { values: Record<string, unknown>; applicability: Record<string, unknown> } | null
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
  submitted_at: string | null
  submitted_by: string | null
}

export type { CustomerOnboardingCaseRow, SubmissionRevisionRow }
