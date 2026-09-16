import type { CommercialConfigurationVersionRow } from "../data/commercial-version-row-types"
import type { SubmissionRevisionRow } from "../data/case-row-types"
import type { CommercialConfigurationVersion } from "./commercial-version-types"
import type { CommercialRateDraft } from "./commercial-rate"
import { createEmptyCommercialRateDraft } from "./commercial-rate"

const COMMERCIAL_RATE_FIELD = "commercial_rate"

/** Pure row -> domain mapper, the inverse of the RPCs in supabase/migrations/20260913070000_commercial_configuration_version_lifecycle.sql. Unwraps effective_data.values for a submitted revision, raw_data for a draft, exactly like ./case-mappers.ts's toRevision. */
function toCommercialRateDraft(revision: SubmissionRevisionRow | null): CommercialRateDraft | null {
  if (!revision) return null
  const values = revision.status === "submitted" && revision.effective_data ? revision.effective_data.values : revision.raw_data
  const commercialRate = values[COMMERCIAL_RATE_FIELD]
  return (commercialRate as CommercialRateDraft | undefined) ?? createEmptyCommercialRateDraft()
}

function toCommercialConfigurationVersion(row: CommercialConfigurationVersionRow, latestRevision: SubmissionRevisionRow | null): CommercialConfigurationVersion {
  return {
    requestId: row.request_id,
    versionNumber: row.version_number,
    commercialConfigurationId: row.commercial_configuration_id,
    changeCategory: row.change_category,
    status: row.status,
    reason: row.reason,
    effectiveDate: row.effective_date,
    commercialChangeId: row.commercial_change_id,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionReason: row.decision_reason,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    cancelledReason: row.cancelled_reason,
    commercialRate: toCommercialRateDraft(latestRevision),
    draftRowVersion: latestRevision?.row_version ?? 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workflowVersionId: row.workflow_version_id,
    currentWorkflowNodeKey: row.current_workflow_node_key,
  }
}

export { toCommercialConfigurationVersion, toCommercialRateDraft, COMMERCIAL_RATE_FIELD }
