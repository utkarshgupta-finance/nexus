import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { CaseOperationError, parseCaseError } from "../domain/case-errors"
import type { CustomerOnboardingCaseRow, SubmissionRevisionRow, OnboardingSendBackRow, OnboardingFieldCommentRow } from "./case-row-types"

/**
 * Repository for customer_onboarding_cases and the submission_revisions
 * rows it extends (supabase/migrations/20260913040000_customer_lifecycle_onboarding_foundation.sql,
 * 20260907044335_submission_data_foundation.sql). Mirrors
 * src/features/commercial/data/configuration.data.ts's own shape: thin
 * RPC wrappers plus a small number of plain reads, nothing else.
 */

async function callSingleRowRpc<TRow>(fn: string, args: Record<string, unknown>): Promise<TRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new CaseOperationError(parseCaseError(error))
  if (!data) throw new CaseOperationError(parseCaseError({ message: `${fn} returned no row` }))
  return data as TRow
}

type CreateCaseInput = { newRequestId: string; initialRawData: Record<string, unknown>; actorUserId: string }

async function createCase(input: CreateCaseInput): Promise<CustomerOnboardingCaseRow> {
  return callSingleRowRpc<CustomerOnboardingCaseRow>("create_customer_onboarding_case", {
    p_new_request_id: input.newRequestId,
    p_initial_raw_data: input.initialRawData,
    p_actor_user_id: input.actorUserId,
  })
}

type SaveDraftInput = { requestId: string; rawData: Record<string, unknown>; currentStageKey: string; actorUserId: string }

async function saveDraft(input: SaveDraftInput): Promise<CustomerOnboardingCaseRow> {
  return callSingleRowRpc<CustomerOnboardingCaseRow>("save_customer_onboarding_draft", {
    p_request_id: input.requestId,
    p_raw_data: input.rawData,
    p_current_stage_key: input.currentStageKey,
    p_actor_user_id: input.actorUserId,
  })
}

async function submitCase(requestId: string, actorUserId: string): Promise<CustomerOnboardingCaseRow> {
  return callSingleRowRpc<CustomerOnboardingCaseRow>("submit_customer_onboarding_case", {
    p_request_id: requestId,
    p_actor_user_id: actorUserId,
  })
}

type SendBackFieldComment = { fieldKey: string; comment: string }

type SendBackInput = {
  requestId: string
  reason: string
  targetStageKey: string | null
  actorUserId: string
  fieldComments?: SendBackFieldComment[]
}

async function sendBackCase(input: SendBackInput): Promise<CustomerOnboardingCaseRow> {
  return callSingleRowRpc<CustomerOnboardingCaseRow>("send_back_customer_onboarding_case", {
    p_request_id: input.requestId,
    p_reason: input.reason,
    p_target_stage_key: input.targetStageKey,
    p_actor_user_id: input.actorUserId,
    p_field_comments: (input.fieldComments ?? []).map((c) => ({ field_key: c.fieldKey, comment: c.comment })),
  })
}

type ApproveCaseInput = {
  requestId: string
  customerKey: string
  customerName: string
  commercialConfigurationKey: string
  commercialConfigurationName: string
  components: Record<string, unknown>[]
  effectiveDate: string
  actorUserId: string
}

async function approveCase(input: ApproveCaseInput): Promise<CustomerOnboardingCaseRow> {
  return callSingleRowRpc<CustomerOnboardingCaseRow>("approve_customer_onboarding_case", {
    p_request_id: input.requestId,
    p_customer_key: input.customerKey,
    p_customer_name: input.customerName,
    p_commercial_configuration_key: input.commercialConfigurationKey,
    p_commercial_configuration_name: input.commercialConfigurationName,
    p_components: input.components,
    p_effective_date: input.effectiveDate,
    p_actor_user_id: input.actorUserId,
  })
}

/** Only a draft may be cancelled, and only by its creator (cancel_customer_onboarding_case enforces both server-side). */
async function cancelCase(requestId: string, reason: string | null, actorUserId: string): Promise<CustomerOnboardingCaseRow> {
  return callSingleRowRpc<CustomerOnboardingCaseRow>("cancel_customer_onboarding_case", {
    p_request_id: requestId,
    p_reason: reason,
    p_actor_user_id: actorUserId,
  })
}

async function getCaseByRequestId(requestId: string): Promise<CustomerOnboardingCaseRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("customer_onboarding_cases").select("*").eq("request_id", requestId).maybeSingle()
  if (error) throw new CaseOperationError(parseCaseError(error))
  return data
}

/** The one onboarding case that became this Customer Master (`customer_id` is set only once, atomically, by `approve_customer_onboarding_case`): the Customer Activity timeline's "how did this customer come to exist" event. */
async function getCaseByCustomerId(customerId: string): Promise<CustomerOnboardingCaseRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("customer_onboarding_cases").select("*").eq("customer_id", customerId).maybeSingle()
  if (error) throw new CaseOperationError(parseCaseError(error))
  return data
}

/** Every approved case that became a real Customer Master, for Customer Duplicate Prevention (task Phase K): checked against a new onboarding's own GST/PAN/legal name/brand before Submit. Capped since this only ever backs an interactive check, never a report. */
async function listApprovedCases(): Promise<CustomerOnboardingCaseRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_onboarding_cases")
    .select("*")
    .eq("status", "approved")
    .limit(500)
  if (error) throw new CaseOperationError(parseCaseError(error))
  return (data ?? []).filter((row: CustomerOnboardingCaseRow) => row.customer_id !== null)
}

/** Every case not yet approved, oldest first: the review queue's data source. */
async function listCasesAwaitingReview(): Promise<CustomerOnboardingCaseRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_onboarding_cases")
    .select("*")
    .in("status", ["submitted", "resubmitted"])
    .order("updated_at", { ascending: true })
  if (error) throw new CaseOperationError(parseCaseError(error))
  return data ?? []
}

/** Every case regardless of status, newest first: the unified Approvals inbox's data source (task Phase E), capped since this only ever backs an operational inbox, never a report. */
async function listAllCases(): Promise<CustomerOnboardingCaseRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_onboarding_cases")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200)
  if (error) throw new CaseOperationError(parseCaseError(error))
  return data ?? []
}

/** Every case this specific requester created, newest first: My Requests' data source. Never accepts a client-supplied id elsewhere; the caller must have already derived `appUserId` server-side. */
async function listCasesCreatedBy(appUserId: string): Promise<CustomerOnboardingCaseRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_onboarding_cases")
    .select("*")
    .eq("created_by", appUserId)
    .order("updated_at", { ascending: false })
    .limit(200)
  if (error) throw new CaseOperationError(parseCaseError(error))
  return data ?? []
}

async function listRevisionsForRequest(requestId: string): Promise<SubmissionRevisionRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("submission_revisions")
    .select("*")
    .eq("request_id", requestId)
    .order("revision_number", { ascending: true })
  if (error) throw new CaseOperationError(parseCaseError(error))
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
  if (error) throw new CaseOperationError(parseCaseError(error))
  return data
}

/** Every revision across a batch of requests, in one query, instead of one round trip per request (the review queue, My Requests, and Customer Duplicate Prevention all otherwise looped `getLatestRevisionForRequest` per row). Callers reduce to "latest per request_id" themselves, since a single query already returns every revision cheaply at today's data volume. */
async function listRevisionsForRequests(requestIds: string[]): Promise<SubmissionRevisionRow[]> {
  if (requestIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("submission_revisions")
    .select("*")
    .in("request_id", requestIds)
    .order("revision_number", { ascending: true })
  if (error) throw new CaseOperationError(parseCaseError(error))
  return data ?? []
}

/** create_next_revision (20260907044335_submission_data_foundation.sql): the resubmit-after-send-back path already opens this via send_back_customer_onboarding_case, but a requester restarting after a stale read may need it directly. */
async function createNextRevision(requestId: string, sourceRevisionId: string, actorUserId: string): Promise<SubmissionRevisionRow> {
  return callSingleRowRpc<SubmissionRevisionRow>("create_next_revision", {
    p_request_id: requestId,
    p_source_revision_id: sourceRevisionId,
    p_actor_user_id: actorUserId,
  })
}

/** Every send-back for this request, oldest first: the Timeline's data source, and `.length` is the authoritative Send Back count (task spec: never a manually incremented counter). */
async function listSendBacksForRequest(requestId: string): Promise<OnboardingSendBackRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_onboarding_send_backs")
    .select("*")
    .eq("request_id", requestId)
    .order("sent_back_at", { ascending: true })
  if (error) throw new CaseOperationError(parseCaseError(error))
  return data ?? []
}

/** Every send-back row across a batch of requests in one query: My Requests' Send Back count column, without one round trip per row. */
async function listSendBacksForRequests(requestIds: string[]): Promise<OnboardingSendBackRow[]> {
  if (requestIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("customer_onboarding_send_backs").select("*").in("request_id", requestIds)
  if (error) throw new CaseOperationError(parseCaseError(error))
  return data ?? []
}

/** Every field comment ever left on this request across every revision, oldest first: a resubmit never removes a prior revision's comments from view (task spec). */
async function listFieldCommentsForRequest(requestId: string): Promise<OnboardingFieldCommentRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_onboarding_field_comments")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true })
  if (error) throw new CaseOperationError(parseCaseError(error))
  return data ?? []
}

export {
  createCase,
  saveDraft,
  submitCase,
  sendBackCase,
  approveCase,
  cancelCase,
  getCaseByRequestId,
  getCaseByCustomerId,
  listCasesAwaitingReview,
  listAllCases,
  listCasesCreatedBy,
  listApprovedCases,
  listRevisionsForRequest,
  listRevisionsForRequests,
  getLatestRevisionForRequest,
  createNextRevision,
  listSendBacksForRequest,
  listSendBacksForRequests,
  listFieldCommentsForRequest,
}
export type { CreateCaseInput, SaveDraftInput, SendBackInput, SendBackFieldComment, ApproveCaseInput }
