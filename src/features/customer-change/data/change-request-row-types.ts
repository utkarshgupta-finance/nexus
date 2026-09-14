/**
 * Hand-authored row shapes matching
 * supabase/migrations/20260913060000_customer_change_request_foundation.sql
 * exactly. Internal to features/customer-change/data/ only; see
 * ../domain/types.ts for the shape the rest of the app is allowed to see.
 */

type CustomerChangeRequestRow = {
  request_id: string
  /** Human-Friendly ID (task Phase L), rendered "CCR-######". Immutable once assigned. */
  request_number: number
  customer_id: string
  status: "draft" | "submitted" | "sent_back" | "resubmitted" | "approved" | "rejected" | "cancelled"
  reason: string | null
  effective_date: string | null
  base_customer_row_version: number
  sent_back_reason: string | null
  sent_back_by: string | null
  sent_back_at: string | null
  decided_by: string | null
  decided_at: string | null
  decision_reason: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancelled_reason: string | null
  row_version: number
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

type CustomerChangeRequestRequirementRow = {
  id: string
  customer_change_request_id: string
  kind: "approval" | "evidence"
  role_code: string | null
  scope_label: string | null
  evidence_type: string | null
  reason: string
  matched_rule_keys: string[]
  created_at: string
}

/** Same shape src/features/customer-onboarding/data/case-row-types.ts already defines for submission_revisions; duplicated here rather than imported, since the two features must never import each other's internals (docs/ARCHITECTURE.md's one-feature-never-imports-another rule). */
type SubmissionRevisionRow = {
  id: string
  request_id: string
  revision_number: number
  status: "draft" | "submitted"
  raw_data: Record<string, unknown>
  effective_data: { values: Record<string, unknown>; applicability: Record<string, unknown> } | null
  row_version: number
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
  submitted_by: string | null
  submitted_at: string | null
}

type CustomerFieldHistoryRow = {
  id: string
  customer_id: string
  field_key: string
  old_value: string | null
  new_value: string | null
  effective_date: string | null
  customer_change_request_id: string | null
  requested_by: string | null
  approved_by: string | null
  changed_at: string
}

/** Raw shape of a customer_change_send_backs row (append-only history, one per send-back), mirroring customer_onboarding_send_backs. */
type CustomerChangeSendBackRow = {
  id: string
  request_id: string
  revision_number: number
  reason: string
  sent_back_by: string | null
  sent_back_at: string
}

export type { CustomerChangeRequestRow, CustomerChangeRequestRequirementRow, SubmissionRevisionRow, CustomerFieldHistoryRow, CustomerChangeSendBackRow }
