import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { GoLiveOperationError, parseGoLiveError } from "../domain/go-live-errors"
import type { GoLiveRequestRow, GoLiveSendBackRow, GoLiveDocumentRow } from "./go-live-row-types"

/**
 * Repository for go_live_requests/go_live_send_backs/go_live_documents
 * (supabase/migrations/20260918010000_go_live_domain.sql). Thin RPC
 * wrappers plus plain reads, matching every other feature's data.ts.
 */

async function callSingleRowRpc<TRow>(fn: string, args: Record<string, unknown>): Promise<TRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new GoLiveOperationError(parseGoLiveError(error))
  if (!data) throw new GoLiveOperationError(parseGoLiveError({ message: `${fn} returned no row` }))
  return data as TRow
}

type CreateGoLiveRequestInput = {
  id: string
  customerId: string
  commercialConfigurationId: string
  commercialVersionId: string
  stableComponentKey: string
  goLiveDate: string
  prorateFirstMonth: boolean
  actorUserId: string
}

async function createGoLiveRequest(input: CreateGoLiveRequestInput): Promise<GoLiveRequestRow> {
  return callSingleRowRpc<GoLiveRequestRow>("create_go_live_request", {
    p_id: input.id,
    p_customer_id: input.customerId,
    p_commercial_configuration_id: input.commercialConfigurationId,
    p_commercial_version_id: input.commercialVersionId,
    p_stable_component_key: input.stableComponentKey,
    p_go_live_date: input.goLiveDate,
    p_prorate_first_month: input.prorateFirstMonth,
    p_actor_user_id: input.actorUserId,
  })
}

type SaveDraftInput = { id: string; goLiveDate: string; prorateFirstMonth: boolean; comment: string | null; actorUserId: string }

async function saveGoLiveRequestDraft(input: SaveDraftInput): Promise<GoLiveRequestRow> {
  return callSingleRowRpc<GoLiveRequestRow>("save_go_live_request_draft", {
    p_id: input.id,
    p_go_live_date: input.goLiveDate,
    p_prorate_first_month: input.prorateFirstMonth,
    p_comment: input.comment,
    p_actor_user_id: input.actorUserId,
  })
}

async function submitGoLiveRequest(id: string, actorUserId: string): Promise<GoLiveRequestRow> {
  return callSingleRowRpc<GoLiveRequestRow>("submit_go_live_request", { p_id: id, p_actor_user_id: actorUserId })
}

async function sendBackGoLiveRequest(id: string, reason: string, actorUserId: string): Promise<GoLiveRequestRow> {
  return callSingleRowRpc<GoLiveRequestRow>("send_back_go_live_request", { p_id: id, p_reason: reason, p_actor_user_id: actorUserId })
}

async function approveGoLiveRequest(id: string, actorUserId: string): Promise<GoLiveRequestRow> {
  return callSingleRowRpc<GoLiveRequestRow>("approve_go_live_request", { p_id: id, p_actor_user_id: actorUserId })
}

async function cancelGoLiveRequest(id: string, reason: string | null, actorUserId: string): Promise<GoLiveRequestRow> {
  return callSingleRowRpc<GoLiveRequestRow>("cancel_go_live_request", { p_id: id, p_reason: reason, p_actor_user_id: actorUserId })
}

async function setGoLiveCustomerConfirmation(id: string, confirmed: boolean, actorUserId: string): Promise<GoLiveRequestRow> {
  return callSingleRowRpc<GoLiveRequestRow>("set_go_live_customer_confirmation", { p_id: id, p_confirmed: confirmed, p_actor_user_id: actorUserId })
}

async function getGoLiveRequestById(id: string): Promise<GoLiveRequestRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("go_live_requests").select("*").eq("id", id).maybeSingle()
  if (error) throw error
  return data
}

async function listGoLiveRequestsForCustomer(customerId: string): Promise<GoLiveRequestRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("go_live_requests").select("*").eq("customer_id", customerId).order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

async function listGoLiveRequestsForStableComponentKeys(stableComponentKeys: string[]): Promise<GoLiveRequestRow[]> {
  if (stableComponentKeys.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("go_live_requests").select("*").in("stable_component_key", stableComponentKeys)
  if (error) throw error
  return data ?? []
}

async function listGoLiveRequestsAwaitingReview(): Promise<GoLiveRequestRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("go_live_requests").select("*").in("status", ["submitted", "resubmitted", "sent_back"])
  if (error) throw error
  return data ?? []
}

async function listAllGoLiveRequests(): Promise<GoLiveRequestRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("go_live_requests").select("*").order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

async function listGoLiveRequestsCreatedBy(appUserId: string): Promise<GoLiveRequestRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("go_live_requests").select("*").eq("created_by", appUserId).order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

async function listSendBacksForGoLiveRequest(goLiveRequestId: string): Promise<GoLiveSendBackRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("go_live_send_backs")
    .select("*")
    .eq("go_live_request_id", goLiveRequestId)
    .order("sent_back_at", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function listDocumentsForGoLiveRequest(goLiveRequestId: string): Promise<GoLiveDocumentRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("go_live_documents")
    .select("*")
    .eq("go_live_request_id", goLiveRequestId)
    .eq("is_current", true)
    .order("uploaded_at", { ascending: false })
  if (error) throw error
  return data ?? []
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
  listDocumentsForGoLiveRequest,
}
export type { CreateGoLiveRequestInput, SaveDraftInput }
