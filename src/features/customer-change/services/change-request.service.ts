import "server-only"

import { getCustomerById } from "@/features/customers/server"
import { withLoggedOperation } from "@/platform/observability/server"

import * as changeData from "../data/change-request.data"
import { toCustomerChangeRequest, toProposedValues, toFieldHistoryEntry, toFormerNameMatch } from "../domain/change-request-mappers"
import { evaluateCustomerChangeRequirements, toRequirementRpcRows } from "../domain/workflow-rules"
import { GOVERNED_FIELD_KEYS } from "../domain/governed-fields"
import type { CustomerChangeRequest, CustomerFieldHistoryEntry, FormerNameMatch } from "../domain/types"

/**
 * Application service for the real, database-backed Customer Change
 * Request lifecycle (Customer Lifecycle V1, Phase 3-9). Thin
 * orchestration over ../data/change-request.data.ts, matching
 * src/features/customer-onboarding/services/case.service.ts's own shape.
 */

function newId(): string {
  return crypto.randomUUID()
}

/** The six governed fields' CURRENT Customer Master values, keyed the same way proposedValues is (see ../domain/governed-fields.ts): the one place this service reads `customers` directly, so every other function here works only with plain values, never a live customer row. */
async function getCurrentGovernedValues(customerId: string): Promise<Record<string, unknown>> {
  const customer = await getCustomerById(customerId)
  if (!customer) throw new Error(`No customer found for id ${customerId}.`)
  const current: Record<string, unknown> = {}
  for (const key of GOVERNED_FIELD_KEYS) {
    current[key] = (customer as unknown as Record<string, unknown>)[key] ?? null
  }
  return current
}

async function loadChangeRequest(requestId: string): Promise<CustomerChangeRequest | null> {
  const [row, latestRevision, requirementRows] = await Promise.all([
    changeData.getChangeRequestByRequestId(requestId),
    changeData.getLatestRevisionForRequest(requestId),
    changeData.listRequirementsForRequest(requestId),
  ])
  if (!row) return null
  return toCustomerChangeRequest(row, latestRevision, requirementRows)
}

async function createChangeRequest(customerId: string, actorUserId: string): Promise<CustomerChangeRequest> {
  const requestId = newId()
  await changeData.createChangeRequest({ newRequestId: requestId, customerId, initialRawData: {}, actorUserId })
  const changeRequest = await loadChangeRequest(requestId)
  if (!changeRequest) throw new Error("Failed to load the Change Request immediately after creating it.")
  return changeRequest
}

async function saveChangeDraft(requestId: string, rawData: Record<string, unknown>, expectedRowVersion: number, actorUserId: string): Promise<CustomerChangeRequest> {
  await changeData.saveDraft({ requestId, rawData, expectedRowVersion, actorUserId })
  const changeRequest = await loadChangeRequest(requestId)
  if (!changeRequest) throw new Error(`Change Request ${requestId} not found after saving draft.`)
  return changeRequest
}

/**
 * Evaluates the current Workflow rules against this Change Request's
 * draft proposed values vs its customer's real current values, without
 * persisting anything: used to show "Required Approvals / Required
 * Evidence" on the submit screen before the requester commits (task spec
 * §63).
 */
async function previewRequirements(requestId: string) {
  const [row, latestRevision] = await Promise.all([changeData.getChangeRequestByRequestId(requestId), changeData.getLatestRevisionForRequest(requestId)])
  if (!row) throw new Error(`Change Request ${requestId} not found.`)
  const currentValues = await getCurrentGovernedValues(row.customer_id)
  const proposedValues = toProposedValues(latestRevision)
  return evaluateCustomerChangeRequirements(currentValues, proposedValues)
}

/** Serves both a first Submit and a post-send-back Resubmit; the RPC itself derives which one applies from the Change Request's current status. Requirements are (re-)computed fresh at submit time, never trusted from an earlier read. */
async function submitChangeRequest(requestId: string, reason: string, effectiveDate: string, actorUserId: string): Promise<CustomerChangeRequest> {
  const requirements = await previewRequirements(requestId)
  await changeData.submitChangeRequest({ requestId, reason, effectiveDate, requirements: toRequirementRpcRows(requirements), actorUserId })
  const changeRequest = await loadChangeRequest(requestId)
  if (!changeRequest) throw new Error(`Change Request ${requestId} not found after submitting.`)
  return changeRequest
}

async function sendBackChangeRequest(requestId: string, reason: string, actorUserId: string): Promise<CustomerChangeRequest> {
  await changeData.sendBackChangeRequest(requestId, reason, actorUserId)
  const changeRequest = await loadChangeRequest(requestId)
  if (!changeRequest) throw new Error(`Change Request ${requestId} not found after sending back.`)
  return changeRequest
}

async function rejectChangeRequest(requestId: string, reason: string, actorUserId: string): Promise<CustomerChangeRequest> {
  await changeData.rejectChangeRequest(requestId, reason, actorUserId)
  const changeRequest = await loadChangeRequest(requestId)
  if (!changeRequest) throw new Error(`Change Request ${requestId} not found after rejecting.`)
  return changeRequest
}

/** Task Phase G: only a draft may be discarded, and only by its own creator (both enforced server-side by cancel_customer_change_request, not only here). */
async function cancelChangeRequest(requestId: string, reason: string | null, actorUserId: string): Promise<CustomerChangeRequest> {
  await changeData.cancelChangeRequest(requestId, reason, actorUserId)
  const changeRequest = await loadChangeRequest(requestId)
  if (!changeRequest) throw new Error(`Change Request ${requestId} not found after cancelling.`)
  return changeRequest
}

/** The atomic apply: approve_customer_change_request re-verifies the customer's row_version itself (staleness/concurrency) and writes customer_field_history inside the same transaction; this service adds no logic on top beyond reloading the result. Logged (Platform Scale Program, Phase A): an approval failure here is exactly the class of operation a CFO/CTO needs traceable without reproducing it manually. */
async function approveChangeRequest(requestId: string, actorUserId: string, expectedCurrentNodeKey: string | null = null): Promise<CustomerChangeRequest> {
  return withLoggedOperation(
    { eventCode: "customer_change.approve", operation: "approveChangeRequest", resourceType: "customer_change_request", resourceId: requestId, actorUserId },
    async () => {
      await changeData.approveChangeRequest(requestId, actorUserId, expectedCurrentNodeKey)
      const changeRequest = await loadChangeRequest(requestId)
      if (!changeRequest) throw new Error(`Change Request ${requestId} not found after approving.`)
      return changeRequest
    }
  )
}

type ChangeRequestSendBackEntry = { revisionNumber: number; reason: string; sentBackBy: string | null; sentBackAt: string }

/** Oldest first: the Timeline reads chronologically, and `.length` is the requester-facing Send Back count (never a manually incremented counter). */
async function listChangeRequestSendBacks(requestId: string): Promise<ChangeRequestSendBackEntry[]> {
  const rows = await changeData.listSendBacksForRequest(requestId)
  return rows.map((row) => ({ revisionNumber: row.revision_number, reason: row.reason, sentBackBy: row.sent_back_by, sentBackAt: row.sent_back_at }))
}

async function getChangeRequestSendBackCount(requestId: string): Promise<number> {
  return (await listChangeRequestSendBacks(requestId)).length
}

/** Batched across many requests at once (Platform Scale Closure, Phase L), for the operational queue read model; getChangeRequestSendBackCount stays the one-request form for a single review screen. */
async function getSendBackCountsForRequests(requestIds: string[]): Promise<Map<string, number>> {
  return changeData.countSendBacksForRequests(requestIds)
}

/** Revision-level submit/resubmit facts the Timeline needs, oldest first (unlike loadChangeRequest, which only ever reads the current revision). */
async function listChangeRequestRevisionSummaries(requestId: string): Promise<{ revisionNumber: number; submittedAt: string | null; submittedBy: string | null }[]> {
  const rows = await changeData.listRevisionsForRequest(requestId)
  return rows.map((row) => ({ revisionNumber: row.revision_number, submittedAt: row.submitted_at, submittedBy: row.submitted_by }))
}

type ReviewQueueEntry = {
  requestId: string
  /** Human-Friendly ID (task Phase L): render with `formatChangeRequestId`. */
  requestNumber: number
  customerId: string
  status: CustomerChangeRequest["status"]
  createdBy: string | null
  createdAt: string
  updatedAt: string
  /** Workflow Runtime V1 Sequential Execution: which Approval node this request is currently sitting at, and the workflow version it is bound to. Null current node with a non-null workflow version means either no Approval node exists in the bound graph, or the request is between Send Back and resubmit. */
  workflowVersionId: string | null
  currentWorkflowNodeKey: string | null
}

function toReviewQueueEntry(row: {
  request_id: string
  request_number: number
  customer_id: string
  status: CustomerChangeRequest["status"]
  created_by: string | null
  created_at: string
  updated_at: string
  workflow_version_id: string | null
  current_workflow_node_key: string | null
}): ReviewQueueEntry {
  return {
    requestId: row.request_id,
    requestNumber: row.request_number,
    customerId: row.customer_id,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workflowVersionId: row.workflow_version_id,
    currentWorkflowNodeKey: row.current_workflow_node_key,
  }
}

async function listChangeRequestReviewQueue(): Promise<ReviewQueueEntry[]> {
  const rows = await changeData.listChangeRequestsAwaitingReview()
  return rows.map(toReviewQueueEntry)
}

/** Every Change Request regardless of status: the unified Approvals inbox's data source (task Phase E). */
async function listAllChangeRequestEntries(): Promise<ReviewQueueEntry[]> {
  const rows = await changeData.listAllChangeRequests()
  return rows.map(toReviewQueueEntry)
}

async function listChangeRequestsForCustomer(customerId: string): Promise<CustomerChangeRequest[]> {
  const rows = await changeData.listChangeRequestsForCustomer(customerId)
  // Batched instead of one loadChangeRequest (3 queries) per row (Platform
  // Scale Closure, Phase V): `rows` already carries the full change
  // request row, so re-fetching it per row was also a redundant read, not
  // only an unbatched revision/requirements lookup.
  const requestIds = rows.map((row) => row.request_id)
  const [latestRevisionsByRequestId, requirementsByRequestId] = await Promise.all([
    changeData.getLatestRevisionsForRequests(requestIds),
    changeData.listRequirementsForRequests(requestIds),
  ])
  return rows.map((row) =>
    toCustomerChangeRequest(row, latestRevisionsByRequestId.get(row.request_id) ?? null, requirementsByRequestId.get(row.request_id) ?? [])
  )
}

async function listCustomerFieldHistory(customerId: string): Promise<CustomerFieldHistoryEntry[]> {
  const rows = await changeData.listFieldHistoryForCustomer(customerId)
  return rows.map(toFieldHistoryEntry)
}

/** Customer Search's former-name lookup (task Phase B): one most-recent match per customer, so a customer renamed twice does not show up twice in a search result. */
async function searchFormerCustomerNames(term: string): Promise<FormerNameMatch[]> {
  const trimmed = term.trim()
  if (!trimmed) return []
  const rows = await changeData.searchFieldHistoryByOldValue(trimmed)
  const matches = rows.map(toFormerNameMatch).filter((match): match is FormerNameMatch => match !== null)
  const seen = new Set<string>()
  return matches.filter((match) => {
    if (seen.has(match.customerId)) return false
    seen.add(match.customerId)
    return true
  })
}

export {
  loadChangeRequest,
  createChangeRequest,
  saveChangeDraft,
  previewRequirements,
  submitChangeRequest,
  sendBackChangeRequest,
  rejectChangeRequest,
  approveChangeRequest,
  cancelChangeRequest,
  listChangeRequestReviewQueue,
  listAllChangeRequestEntries,
  listChangeRequestsForCustomer,
  listCustomerFieldHistory,
  searchFormerCustomerNames,
  getCurrentGovernedValues,
  listChangeRequestSendBacks,
  getChangeRequestSendBackCount,
  getSendBackCountsForRequests,
  listChangeRequestRevisionSummaries,
}
export type { ReviewQueueEntry, ChangeRequestSendBackEntry }
