"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { withCorrelationReference } from "@/platform/errors"
import { getCustomerById } from "@/features/customers/server"
import { ChangeRequestOperationError } from "./domain/change-errors"

import {
  createChangeRequest,
  saveChangeDraft,
  submitChangeRequest,
  sendBackChangeRequest,
  rejectChangeRequest,
  approveChangeRequest,
  cancelChangeRequest,
} from "./services/change-request.service"
import type { CustomerChangeRequest } from "./domain/types"

/**
 * Real, database-backed Customer Change Request lifecycle actions
 * (Customer Lifecycle V1, Phase 3-9), mirroring
 * src/features/customer-onboarding/actions.ts's own shape exactly: each
 * derives the authenticated actor server-side via `requirePermission`,
 * never accepts a client-supplied actor id. `customer.change_request`
 * gates the requester-side actions (create/save/submit); `customer.approve`
 * gates the reviewer-side decision (send back/reject/approve), the same
 * single-decision simplification the onboarding case review already
 * uses (docs/CUSTOMER_LIFECYCLE.md: no per-role approval routing yet).
 */

type ChangeRequestActionResult = { ok: true; changeRequest: CustomerChangeRequest } | { ok: false; error: string; stale?: boolean }

function toActionError(error: unknown): ChangeRequestActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof ChangeRequestOperationError && error.changeError.kind === "workflow_node_already_advanced") {
    // Workflow Runtime V1 UX + Audit Closure: never surface the raw
    // WORKFLOW_NODE_ALREADY_ADVANCED token or a confusing team-mismatch
    // error when another checker has simply already acted; `stale: true`
    // lets the review page show an explicit Refresh affordance instead
    // of a dead end.
    return { ok: false, error: "This approval has already moved to the next step. Refresh to see its current status.", stale: true }
  }
  if (error instanceof ChangeRequestOperationError && error.changeError.kind === "unknown") {
    return { ok: false, error: withCorrelationReference(error.message, error) }
  }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: "An unexpected error occurred while updating this Customer Change Request." }
}

/** Task Phase I: a new Change Request may not be opened against an inactive customer (churn/inactive is not the same as "no longer real"; a Change Request implies ongoing operational activity). Reactivate first, if this is genuinely still an active relationship. */
async function createChangeRequestAction(customerId: string): Promise<ChangeRequestActionResult> {
  try {
    const actor = await requirePermission("customer", "change_request")
    const customer = await getCustomerById(customerId)
    if (customer && !customer.is_active) {
      return { ok: false, error: "This customer is inactive. Reactivate the customer before creating a Change Request." }
    }
    const changeRequest = await createChangeRequest(customerId, actor.appUserId)
    return { ok: true, changeRequest }
  } catch (error) {
    return toActionError(error)
  }
}

async function saveChangeDraftAction(requestId: string, rawData: Record<string, unknown>, expectedRowVersion: number): Promise<ChangeRequestActionResult> {
  try {
    const actor = await requirePermission("customer", "change_request")
    const changeRequest = await saveChangeDraft(requestId, rawData, expectedRowVersion, actor.appUserId)
    return { ok: true, changeRequest }
  } catch (error) {
    return toActionError(error)
  }
}

/** Serves both a first Submit and a post-send-back Resubmit; see services/change-request.service.ts's own comment. */
async function submitChangeRequestAction(requestId: string, reason: string, effectiveDate: string): Promise<ChangeRequestActionResult> {
  try {
    const actor = await requirePermission("customer", "change_request")
    const changeRequest = await submitChangeRequest(requestId, reason, effectiveDate, actor.appUserId)
    return { ok: true, changeRequest }
  } catch (error) {
    return toActionError(error)
  }
}

async function sendBackChangeRequestAction(requestId: string, reason: string): Promise<ChangeRequestActionResult> {
  try {
    const actor = await requirePermission("customer", "approve")
    const changeRequest = await sendBackChangeRequest(requestId, reason, actor.appUserId)
    return { ok: true, changeRequest }
  } catch (error) {
    return toActionError(error)
  }
}

async function rejectChangeRequestAction(requestId: string, reason: string): Promise<ChangeRequestActionResult> {
  try {
    const actor = await requirePermission("customer", "approve")
    const changeRequest = await rejectChangeRequest(requestId, reason, actor.appUserId)
    return { ok: true, changeRequest }
  } catch (error) {
    return toActionError(error)
  }
}

/** `expectedCurrentNodeKey` (Workflow Runtime V1 UX + Audit Closure): the Approval node the review page had open when the checker clicked Approve, echoed back so a stale-page approval gets a clear "already moved on" message instead of a raw team-mismatch error. Purely a UX input, never authorization: the RPC's own current-node/team check is the only thing that ever actually decides whether this approval is allowed. */
async function approveChangeRequestAction(requestId: string, expectedCurrentNodeKey: string | null = null): Promise<ChangeRequestActionResult> {
  try {
    const actor = await requirePermission("customer", "approve")
    const changeRequest = await approveChangeRequest(requestId, actor.appUserId, expectedCurrentNodeKey)
    return { ok: true, changeRequest }
  } catch (error) {
    return toActionError(error)
  }
}

/** Task Phase G: only a draft Change Request may be discarded, gated the same as create/save/submit since discarding one's own draft is a creation-time decision, not a reviewer one. */
async function cancelChangeRequestAction(requestId: string, reason: string | null): Promise<ChangeRequestActionResult> {
  try {
    const actor = await requirePermission("customer", "change_request")
    const changeRequest = await cancelChangeRequest(requestId, reason, actor.appUserId)
    return { ok: true, changeRequest }
  } catch (error) {
    return toActionError(error)
  }
}

export {
  createChangeRequestAction,
  saveChangeDraftAction,
  submitChangeRequestAction,
  sendBackChangeRequestAction,
  rejectChangeRequestAction,
  approveChangeRequestAction,
  cancelChangeRequestAction,
}
export type { ChangeRequestActionResult }
