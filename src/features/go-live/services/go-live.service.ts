import "server-only"

import * as goLiveData from "../data/go-live.data"
import { toGoLiveRequest, toGoLiveSendBackEntry } from "../domain/mappers"
import { resolveActorLabels } from "@/platform/audit/server"
import { loadWorkflowGraph, resolveWorkflowApprovalStep, DEFAULT_APPROVAL_STEP } from "@/platform/workflow-builder/server"
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
 * Resolves what the bound Workflow Version names as responsible, for
 * DISPLAY (e.g. an Operational Queue "Responsible Team" column) ahead of
 * an actual approval attempt. As of Workflow Runtime V1
 * (supabase/migrations/20260921000000_workflow_runtime_v1.sql), the
 * TEAM this resolves to is genuinely enforced: `approve_go_live_request`
 * runs the identical graph walk (`fn_resolve_workflow_responsible_team`)
 * inside the approval transaction itself, so this display and the real
 * gate agree by construction. The REQUIRED PERMISSION stays the fixed,
 * hardcoded `requirePermission("go_live", "approve")` in actions.ts
 * regardless of what an Approval node's `resource`/`action` says
 * (surfaced here for display only): a workflow graph can route WHICH
 * TEAM must approve, never WHICH PERMISSION is required, so authoring a
 * graph can never itself grant broader approval rights. Falls back to
 * the hardcoded default when the request has no bound
 * workflow_version_id, that version's graph has no Start node, or no
 * Approval node is reached along the path taken.
 */
async function resolveApprovalStepForGoLiveRequest(request: GoLiveRequest): Promise<ResolvedApprovalStep> {
  if (!request.workflowVersionId) return DEFAULT_APPROVAL_STEP
  const graph = await loadWorkflowGraph(request.workflowVersionId)
  if (!graph) return DEFAULT_APPROVAL_STEP
  return resolveWorkflowApprovalStep(graph.nodes, graph.edges, {}) ?? DEFAULT_APPROVAL_STEP
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
