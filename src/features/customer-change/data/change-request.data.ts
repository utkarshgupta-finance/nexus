import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { ChangeRequestOperationError, parseChangeError } from "../domain/change-errors"
import type { CustomerChangeRequestRow, CustomerChangeRequestRequirementRow, SubmissionRevisionRow, CustomerFieldHistoryRow } from "./change-request-row-types"

/**
 * Repository for customer_change_requests and the submission_revisions/
 * customer_change_request_requirements rows it extends
 * (supabase/migrations/20260913060000_customer_change_request_foundation.sql).
 * Mirrors src/features/customer-onboarding/data/case.data.ts's own shape:
 * thin RPC wrappers plus a small number of plain reads, nothing else.
 */

async function callSingleRowRpc<TRow>(fn: string, args: Record<string, unknown>): Promise<TRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new ChangeRequestOperationError(parseChangeError(error))
  if (!data) throw new ChangeRequestOperationError(parseChangeError({ message: `${fn} returned no row` }))
  return data as TRow
}

type CreateChangeRequestInput = { newRequestId: string; customerId: string; initialRawData: Record<string, unknown>; actorUserId: string }

async function createChangeRequest(input: CreateChangeRequestInput): Promise<CustomerChangeRequestRow> {
  return callSingleRowRpc<CustomerChangeRequestRow>("create_customer_change_request", {
    p_new_request_id: input.newRequestId,
    p_customer_id: input.customerId,
    p_initial_raw_data: input.initialRawData,
    p_actor_user_id: input.actorUserId,
  })
}

type SaveDraftInput = { requestId: string; rawData: Record<string, unknown>; actorUserId: string }

async function saveDraft(input: SaveDraftInput): Promise<CustomerChangeRequestRow> {
  return callSingleRowRpc<CustomerChangeRequestRow>("save_customer_change_draft", {
    p_request_id: input.requestId,
    p_raw_data: input.rawData,
    p_actor_user_id: input.actorUserId,
  })
}

type SubmitInput = {
  requestId: string
  reason: string
  effectiveDate: string
  requirements: Record<string, unknown>[]
  actorUserId: string
}

async function submitChangeRequest(input: SubmitInput): Promise<CustomerChangeRequestRow> {
  return callSingleRowRpc<CustomerChangeRequestRow>("submit_customer_change_request", {
    p_request_id: input.requestId,
    p_reason: input.reason,
    p_effective_date: input.effectiveDate,
    p_requirements: input.requirements,
    p_actor_user_id: input.actorUserId,
  })
}

async function sendBackChangeRequest(requestId: string, reason: string, actorUserId: string): Promise<CustomerChangeRequestRow> {
  return callSingleRowRpc<CustomerChangeRequestRow>("send_back_customer_change_request", {
    p_request_id: requestId,
    p_reason: reason,
    p_actor_user_id: actorUserId,
  })
}

async function rejectChangeRequest(requestId: string, reason: string, actorUserId: string): Promise<CustomerChangeRequestRow> {
  return callSingleRowRpc<CustomerChangeRequestRow>("reject_customer_change_request", {
    p_request_id: requestId,
    p_reason: reason,
    p_actor_user_id: actorUserId,
  })
}

async function approveChangeRequest(requestId: string, actorUserId: string): Promise<CustomerChangeRequestRow> {
  return callSingleRowRpc<CustomerChangeRequestRow>("approve_customer_change_request", {
    p_request_id: requestId,
    p_actor_user_id: actorUserId,
  })
}

async function getChangeRequestByRequestId(requestId: string): Promise<CustomerChangeRequestRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("customer_change_requests").select("*").eq("request_id", requestId).maybeSingle()
  if (error) throw new ChangeRequestOperationError(parseChangeError(error))
  return data
}

/** Every Change Request not yet decided, oldest first: the review queue's data source. */
async function listChangeRequestsAwaitingReview(): Promise<CustomerChangeRequestRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_change_requests")
    .select("*")
    .in("status", ["submitted", "resubmitted"])
    .order("updated_at", { ascending: true })
  if (error) throw new ChangeRequestOperationError(parseChangeError(error))
  return data ?? []
}

/** Every Change Request against one customer, newest first: the Customer -> Change Requests tab's data source. */
async function listChangeRequestsForCustomer(customerId: string): Promise<CustomerChangeRequestRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_change_requests")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
  if (error) throw new ChangeRequestOperationError(parseChangeError(error))
  return data ?? []
}

async function getLatestRevisionForRequest(requestId: string): Promise<SubmissionRevisionRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("submission_revisions")
    .select("*")
    .eq("request_id", requestId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new ChangeRequestOperationError(parseChangeError(error))
  return data
}

async function listRequirementsForRequest(requestId: string): Promise<CustomerChangeRequestRequirementRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_change_request_requirements")
    .select("*")
    .eq("customer_change_request_id", requestId)
    .order("created_at", { ascending: true })
  if (error) throw new ChangeRequestOperationError(parseChangeError(error))
  return data ?? []
}

/** Permanent, field-level Customer Master change history for one customer, newest first: the Customer -> History tab's data source. */
async function listFieldHistoryForCustomer(customerId: string): Promise<CustomerFieldHistoryRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_field_history")
    .select("*")
    .eq("customer_id", customerId)
    .order("changed_at", { ascending: false })
  if (error) throw new ChangeRequestOperationError(parseChangeError(error))
  return data ?? []
}

/**
 * Customer Search (task Phase B): finds a former legal/brand name across
 * every customer's field history, newest first, capped at a small
 * number of matches since this only ever backs an interactive search
 * box, never a report. Scoped to `name`/`brand_name` because those are
 * the only two fields a real customer identity search cares about; a
 * Segment/BU/Country change is not a "did this customer used to be
 * called something else" question.
 */
async function searchFieldHistoryByOldValue(term: string): Promise<CustomerFieldHistoryRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_field_history")
    .select("*")
    .in("field_key", ["name", "brand_name"])
    .ilike("old_value", `%${term}%`)
    .order("changed_at", { ascending: false })
    .limit(20)
  if (error) throw new ChangeRequestOperationError(parseChangeError(error))
  return data ?? []
}

export {
  createChangeRequest,
  saveDraft,
  submitChangeRequest,
  sendBackChangeRequest,
  rejectChangeRequest,
  approveChangeRequest,
  getChangeRequestByRequestId,
  listChangeRequestsAwaitingReview,
  listChangeRequestsForCustomer,
  getLatestRevisionForRequest,
  listRequirementsForRequest,
  listFieldHistoryForCustomer,
  searchFieldHistoryByOldValue,
}
export type { CreateChangeRequestInput, SaveDraftInput, SubmitInput }
