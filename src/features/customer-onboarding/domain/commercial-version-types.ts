import type { CommercialRateDraft } from "./commercial-rate"

/**
 * Commercial Configuration Version domain types (Customer Lifecycle V1,
 * Phase 10-13): a governed draft/submit/approve lifecycle for Version 2+
 * of a Commercial Configuration, extending 1:1 requests/submission_revisions
 * the same way the Customer Onboarding Case and Customer Change Request
 * both already do.
 */

type CommercialVersionStatus = "draft" | "submitted" | "approved" | "rejected"
type CommercialVersionChangeCategory = "renewal" | "amendment" | "correction" | "other"

type CommercialConfigurationVersion = {
  requestId: string
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
  /** The draft's proposed Commercial Rate (billing currency + components); undefined until a draft has ever been saved. */
  commercialRate: CommercialRateDraft | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type { CommercialVersionStatus, CommercialVersionChangeCategory, CommercialConfigurationVersion }
