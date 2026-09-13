/**
 * Hand-authored row shape matching
 * supabase/migrations/20260913070000_commercial_configuration_version_lifecycle.sql
 * exactly. Internal to features/customer-onboarding/data/ only; see
 * ../domain/commercial-version-types.ts for the shape the rest of the
 * app is allowed to see. `SubmissionRevisionRow` already exists in this
 * same feature (./case-row-types.ts) and is reused directly, not
 * duplicated, since both extend the same platform-wide submission_revisions
 * contract.
 */

type CommercialConfigurationVersionRow = {
  request_id: string
  commercial_configuration_id: string
  change_category: "renewal" | "amendment" | "correction" | "other"
  status: "draft" | "submitted" | "approved" | "rejected"
  reason: string | null
  effective_date: string | null
  commercial_change_id: string | null
  decided_by: string | null
  decided_at: string | null
  decision_reason: string | null
  row_version: number
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

export type { CommercialConfigurationVersionRow }
