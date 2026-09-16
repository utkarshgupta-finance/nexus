import type { CommercialRateDraft } from "./commercial-rate"

/**
 * Commercial Configuration Version domain types (Customer Lifecycle V1,
 * Phase 10-13): a governed draft/submit/approve lifecycle for Version 2+
 * of a Commercial Configuration, extending 1:1 requests/submission_revisions
 * the same way the Customer Onboarding Case and Customer Change Request
 * both already do.
 */

type CommercialVersionStatus = "draft" | "submitted" | "approved" | "rejected" | "cancelled"
type CommercialVersionChangeCategory = "renewal" | "amendment" | "correction" | "other"

type CommercialConfigurationVersion = {
  requestId: string
  /** Human-Friendly ID (task Phase L): render with `formatCommercialVersionId`, never this raw number alone. Distinct from the business-facing "Version N" ordinal (per-configuration, computed in commercial/read-models). */
  versionNumber: number
  commercialConfigurationId: string
  changeCategory: CommercialVersionChangeCategory
  status: CommercialVersionStatus
  reason: string | null
  effectiveDate: string | null
  /** Populated only once approved: the real commercial_changes row this version materialized into. */
  commercialChangeId: string | null
  decidedBy: string | null
  decidedAt: string | null
  decisionReason: string | null
  /** Set only once, when a draft is cancelled (task Phase C); a cancelled version is terminal and never re-enters review. */
  cancelledBy: string | null
  cancelledAt: string | null
  cancelledReason: string | null
  /** The draft's proposed Commercial Rate (billing currency + components); undefined until a draft has ever been saved. */
  commercialRate: CommercialRateDraft | null
  /** submission_revisions.row_version of the current draft/submitted revision: the optimistic-lock token every Save Draft/Next/Submit call must echo back as expectedRowVersion (Nexus Foundational Hardening, Phase 4). */
  draftRowVersion: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
  /** Workflow Runtime V1 Sequential Execution: the workflow version this version is bound to, and which Approval node it is currently sitting at. Null current node means no workflow is bound, the graph has no Approval node, or the version is between Send Back and resubmit (this domain has no Send Back today, but the field stays consistent with the other three). */
  workflowVersionId: string | null
  currentWorkflowNodeKey: string | null
}

/** Human-Friendly ID (task Phase L): "CC-000078". Never renumbered; the underlying `requestId` UUID remains the real identity everywhere. */
function formatCommercialVersionId(versionNumber: number): string {
  return `CC-${String(versionNumber).padStart(6, "0")}`
}

export type { CommercialVersionStatus, CommercialVersionChangeCategory, CommercialConfigurationVersion }
export { formatCommercialVersionId }
