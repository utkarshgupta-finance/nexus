import "server-only"

import * as goLiveData from "../data/go-live.data"
import { toGoLiveRequest, toGoLiveSendBackEntry } from "../domain/mappers"
import { resolveActorLabels } from "@/platform/audit/server"
import { loadWorkflowGraph, resolveApprovalStep } from "@/platform/workflow-builder/server"
import type { ResolvedApprovalStep } from "@/platform/workflow-builder/server"
import type { GoLiveRequest, GoLiveSendBackEntry } from "../domain/types"
import type { CreateGoLiveRequestInput } from "../data/go-live.data"

/**
 * Application service for Go Live requests. Thin orchestration over
 * ../data/go-live.data.ts, matching every other feature's service, plus
 * the one piece of real logic this module owns: resolving the dynamic
 * approval permission/team from the request's own bound (snapshotted at
 * creation) Workflow Version graph, the "minimal Workflow Runtime"
 * (src/platform/workflow-builder/domain/runtime.ts).
 */

async function createGoLiveRequest(input: CreateGoLiveRequestInput): Promise<GoLiveRequest> {
  const row = await goLiveData.createGoLiveRequest(input)
  return toGoLiveRequest(row)
}

async function saveGoLiveRequestDraft(input: goLiveData.SaveDraftInput): Promise<GoLiveRequest> {
  const row = await goLiveData.saveGoLiveRequestDraft(input)
  return toGoLiveRequest(row)
}

async function submitGoLiveRequest(id: string, actorUserId: string): Promise<GoLiveRequest> {
  const row = await goLiveData.submitGoLiveRequest(id, actorUserId)
  return toGoLiveRequest(row)
}

async function sendBackGoLiveRequest(id: string, reason: string, actorUserId: string): Promise<GoLiveRequest> {
  const row = await goLiveData.sendBackGoLiveRequest(id, reason, actorUserId)
  return toGoLiveRequest(row)
}

async function approveGoLiveRequest(id: string, actorUserId: string): Promise<GoLiveRequest> {
  const row = await goLiveData.approveGoLiveRequest(id, actorUserId)
  return toGoLiveRequest(row)
}

async function cancelGoLiveRequest(id: string, reason: string | null, actorUserId: string): Promise<GoLiveRequest> {
  const row = await goLiveData.cancelGoLiveRequest(id, reason, actorUserId)
  return toGoLiveRequest(row)
}

async function setGoLiveCustomerConfirmation(id: string, confirmed: boolean, actorUserId: string): Promise<GoLiveRequest> {
  const row = await goLiveData.setGoLiveCustomerConfirmation(id, confirmed, actorUserId)
  return toGoLiveRequest(row)
}

async function getGoLiveRequestById(id: string): Promise<GoLiveRequest | null> {
  const row = await goLiveData.getGoLiveRequestById(id)
  return row ? toGoLiveRequest(row) : null
}

async function listGoLiveRequestsForCustomer(customerId: string): Promise<GoLiveRequest[]> {
  const rows = await goLiveData.listGoLiveRequestsForCustomer(customerId)
  return rows.map(toGoLiveRequest)
}

async function listGoLiveRequestsForStableComponentKeys(stableComponentKeys: string[]): Promise<GoLiveRequest[]> {
  const rows = await goLiveData.listGoLiveRequestsForStableComponentKeys(stableComponentKeys)
  return rows.map(toGoLiveRequest)
}

async function listGoLiveRequestsAwaitingReview(): Promise<GoLiveRequest[]> {
  const rows = await goLiveData.listGoLiveRequestsAwaitingReview()
  return rows.map(toGoLiveRequest)
}

async function listAllGoLiveRequests(): Promise<GoLiveRequest[]> {
  const rows = await goLiveData.listAllGoLiveRequests()
  return rows.map(toGoLiveRequest)
}

async function listGoLiveRequestsCreatedBy(appUserId: string): Promise<GoLiveRequest[]> {
  const rows = await goLiveData.listGoLiveRequestsCreatedBy(appUserId)
  return rows.map(toGoLiveRequest)
}

async function listSendBacksForGoLiveRequest(goLiveRequestId: string): Promise<GoLiveSendBackEntry[]> {
  const rows = await goLiveData.listSendBacksForGoLiveRequest(goLiveRequestId)
  return rows.map(toGoLiveSendBackEntry)
}

/**
 * Resolves what the bound Workflow Version's Approval node names as
 * responsible, for DISPLAY only (e.g. an Operational Queue "Responsible
 * Team" column) — never as the actual authorization gate. The real
 * `requirePermission("go_live", "approve")` check in actions.ts is
 * always the fixed, hardcoded permission: letting a database-configured
 * graph value determine which permission string gets checked would let
 * anyone able to author a workflow graph redirect authorization itself,
 * which is a materially different (and much riskier) trust boundary
 * than "this graph names a team for display purposes." Falls back to
 * the hardcoded default when the request has no bound
 * workflow_version_id (no graph was published for go_live yet at
 * creation time) or that version's graph has no Approval node.
 */
async function resolveApprovalStepForGoLiveRequest(request: GoLiveRequest): Promise<ResolvedApprovalStep> {
  if (!request.workflowVersionId) return { resource: "go_live", action: "approve", responsibleTeamId: null }
  const graph = await loadWorkflowGraph(request.workflowVersionId)
  if (!graph) return { resource: "go_live", action: "approve", responsibleTeamId: null }
  return resolveApprovalStep(graph.nodes)
}

/** Batched actor-label resolution for a set of Go Live requests: created/sent-back/approved/cancelled actors, ready for a UI to render human names, never raw ids. */
async function resolveGoLiveActorLabels(requests: GoLiveRequest[]): Promise<Map<string, string | null>> {
  const ids = requests.flatMap((request) => [request.createdBy, request.sentBackBy, request.approvedBy, request.cancelledBy])
  return resolveActorLabels(ids)
}

export {
  createGoLiveRequest,
  saveGoLiveRequestDraft,
  submitGoLiveRequest,
  sendBackGoLiveRequest,
  approveGoLiveRequest,
  cancelGoLiveRequest,
  setGoLiveCustomerConfirmation,
  getGoLiveRequestById,
  listGoLiveRequestsForCustomer,
  listGoLiveRequestsForStableComponentKeys,
  listGoLiveRequestsAwaitingReview,
  listAllGoLiveRequests,
  listGoLiveRequestsCreatedBy,
  listSendBacksForGoLiveRequest,
  resolveApprovalStepForGoLiveRequest,
  resolveGoLiveActorLabels,
}
