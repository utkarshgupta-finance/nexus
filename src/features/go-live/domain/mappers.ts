import type { GoLiveRequestRow, GoLiveSendBackRow } from "../data/go-live-row-types"
import type { GoLiveRequest, GoLiveRequestStatus, CustomerConfirmationStatus, GoLiveSendBackEntry } from "./types"

function toGoLiveRequest(row: GoLiveRequestRow): GoLiveRequest {
  return {
    id: row.id,
    requestNumber: row.request_number,
    customerId: row.customer_id,
    commercialConfigurationId: row.commercial_configuration_id,
    commercialVersionId: row.commercial_version_id,
    stableComponentKey: row.stable_component_key,
    goLiveDate: row.go_live_date,
    prorateFirstMonth: row.prorate_first_month,
    customerConfirmationStatus: row.customer_confirmation_status as CustomerConfirmationStatus,
    status: row.status as GoLiveRequestStatus,
    workflowVersionId: row.workflow_version_id,
    comment: row.comment,
    sentBackReason: row.sent_back_reason,
    sentBackBy: row.sent_back_by,
    sentBackAt: row.sent_back_at,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    cancelledReason: row.cancelled_reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}

function toGoLiveSendBackEntry(row: GoLiveSendBackRow): GoLiveSendBackEntry {
  return {
    id: row.id,
    goLiveRequestId: row.go_live_request_id,
    reason: row.reason,
    sentBackBy: row.sent_back_by,
    sentBackAt: row.sent_back_at,
  }
}

export { toGoLiveRequest, toGoLiveSendBackEntry }
