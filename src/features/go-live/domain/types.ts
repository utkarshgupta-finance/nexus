/**
 * Go Live domain types (Nexus Go Live + Entitlement Ledger, Phase B).
 *
 * Go Live means the recurring commercial line item is commercially
 * active from the Go Live month and entitlement allocation/usage
 * consumption may begin. It does NOT mean an invoice exists, technical
 * deployment finished, billing was raised, or revenue was recognized.
 *
 * `GoLiveRequestStatus` is this record's own governed-decision workflow
 * status. `LineItemGoLiveStatus` is a distinct, DERIVED concept: what a
 * Commercial line item's Go Live standing looks like for display,
 * computed from the set of Go Live requests that exist for its
 * `stableComponentKey`, never stored redundantly (matching Commercial
 * Version's own scheduled/active/superseded derivation).
 */

type GoLiveRequestStatus = "draft" | "submitted" | "sent_back" | "resubmitted" | "approved" | "cancelled"

type CustomerConfirmationStatus = "pending" | "confirmed"

type LineItemGoLiveStatus = "NO_GO_LIVE" | "GO_LIVE_PENDING" | "LIVE" | "CANCELLED"

type GoLiveRequest = {
  id: string
  /** Human-Friendly ID: render with `formatGoLiveRequestId`, never this raw number alone. */
  requestNumber: number
  customerId: string
  commercialConfigurationId: string
  /** Null when the line item's commercial terms have never been through a Version 2+ approval cycle (still the original onboarding-created setup, which has no commercial_configuration_versions row at all). */
  commercialVersionId: string | null
  stableComponentKey: string
  goLiveDate: string
  prorateFirstMonth: boolean
  customerConfirmationStatus: CustomerConfirmationStatus
  status: GoLiveRequestStatus
  /** Snapshotted once at creation from the currently published go_live workflow version, if any. Never re-resolved: an in-flight request retains the workflow version it started with. */
  workflowVersionId: string | null
  /** Workflow Runtime V1 Sequential Execution: which Approval node this request is currently sitting at. Null if no workflow is bound, no Approval node exists in the bound graph, or the request is between Send Back and resubmit. */
  currentWorkflowNodeKey: string | null
  /** Optimistic-lock token every Save Draft call must echo back as expectedRowVersion (Nexus Foundational Hardening, Phase 4), so a stale save is rejected instead of silently overwriting a change someone else already saved. */
  rowVersion: number
  comment: string | null
  sentBackReason: string | null
  sentBackBy: string | null
  sentBackAt: string | null
  submittedBy: string | null
  submittedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  cancelledBy: string | null
  cancelledAt: string | null
  cancelledReason: string | null
  createdBy: string | null
  createdAt: string
  updatedBy: string | null
  updatedAt: string
}

type GoLiveSendBackEntry = {
  id: string
  goLiveRequestId: string
  reason: string
  sentBackBy: string | null
  sentBackAt: string
}

type GoLiveDocumentType = "customer_confirmation" | "signed_uat_document"

type PersistedGoLiveDocumentMetadata = {
  documentId: string
  goLiveRequestId: string
  documentType: GoLiveDocumentType
  originalFileName: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string | null
  uploadedAt: string
  isCurrent: boolean
}

/** "Which recurring commercials are not Live... which are Live... which have customer confirmation pending" (product brief): derived, never stored. Cancelled-only history collapses to CANCELLED so a fresh Go Live can still be created for the same line item afterward. */
function deriveLineItemGoLiveStatus(requestsForLineItem: GoLiveRequest[]): LineItemGoLiveStatus {
  if (requestsForLineItem.length === 0) return "NO_GO_LIVE"
  if (requestsForLineItem.some((request) => request.status === "approved")) return "LIVE"
  if (requestsForLineItem.some((request) => request.status !== "cancelled")) return "GO_LIVE_PENDING"
  return "CANCELLED"
}

/** The one in-flight (non-cancelled, non-approved) request for a line item, if any: the record a "Create Go Live"/"View" action should open. Approved wins over anything else, since LIVE is terminal for that line item's Go Live concern. */
function currentGoLiveRequestForLineItem(requestsForLineItem: GoLiveRequest[]): GoLiveRequest | null {
  const approved = requestsForLineItem.find((request) => request.status === "approved")
  if (approved) return approved
  const inFlight = requestsForLineItem
    .filter((request) => request.status !== "cancelled")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return inFlight[0] ?? null
}

/** Human-Friendly ID: "GLR-000123". Never renumbered; the underlying `id` UUID remains the real identity everywhere. */
function formatGoLiveRequestId(requestNumber: number): string {
  return `GLR-${String(requestNumber).padStart(6, "0")}`
}

export { deriveLineItemGoLiveStatus, currentGoLiveRequestForLineItem, formatGoLiveRequestId }
export type {
  GoLiveRequestStatus,
  CustomerConfirmationStatus,
  LineItemGoLiveStatus,
  GoLiveRequest,
  GoLiveSendBackEntry,
  GoLiveDocumentType,
  PersistedGoLiveDocumentMetadata,
}
