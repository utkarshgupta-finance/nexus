import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { CommercialVersionOperationError, parseCommercialVersionError } from "../domain/commercial-version-errors"
import type { CommercialConfigurationVersionRow } from "./commercial-version-row-types"
import type { SubmissionRevisionRow } from "./case-row-types"

/**
 * Repository for commercial_configuration_versions and the
 * submission_revisions row it extends
 * (supabase/migrations/20260913070000_commercial_configuration_version_lifecycle.sql).
 * Mirrors ./case.data.ts's own shape: thin RPC wrappers plus a small
 * number of plain reads, nothing else.
 */

async function callSingleRowRpc<TRow>(fn: string, args: Record<string, unknown>): Promise<TRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new CommercialVersionOperationError(parseCommercialVersionError(error))
  if (!data) throw new CommercialVersionOperationError(parseCommercialVersionError({ message: `${fn} returned no row` }))
  return data as TRow
}

type CreateVersionInput = {
  newRequestId: string
  commercialConfigurationId: string
  changeCategory: "renewal" | "amendment" | "correction" | "other"
  initialRawData: Record<string, unknown>
  actorUserId: string
}

async function createVersion(input: CreateVersionInput): Promise<CommercialConfigurationVersionRow> {
  return callSingleRowRpc<CommercialConfigurationVersionRow>("create_commercial_configuration_version", {
    p_new_request_id: input.newRequestId,
    p_commercial_configuration_id: input.commercialConfigurationId,
    p_change_category: input.changeCategory,
    p_initial_raw_data: input.initialRawData,
    p_actor_user_id: input.actorUserId,
  })
}

async function saveDraft(requestId: string, rawData: Record<string, unknown>, actorUserId: string): Promise<CommercialConfigurationVersionRow> {
  return callSingleRowRpc<CommercialConfigurationVersionRow>("save_commercial_configuration_version_draft", {
    p_request_id: requestId,
    p_raw_data: rawData,
    p_actor_user_id: actorUserId,
  })
}

type SubmitInput = { requestId: string; reason: string; effectiveDate: string; actorUserId: string }

async function submitVersion(input: SubmitInput): Promise<CommercialConfigurationVersionRow> {
  return callSingleRowRpc<CommercialConfigurationVersionRow>("submit_commercial_configuration_version", {
    p_request_id: input.requestId,
    p_reason: input.reason,
    p_effective_date: input.effectiveDate,
    p_actor_user_id: input.actorUserId,
  })
}

async function rejectVersion(requestId: string, reason: string, actorUserId: string): Promise<CommercialConfigurationVersionRow> {
  return callSingleRowRpc<CommercialConfigurationVersionRow>("reject_commercial_configuration_version", {
    p_request_id: requestId,
    p_reason: reason,
    p_actor_user_id: actorUserId,
  })
}

async function approveVersion(requestId: string, components: Record<string, unknown>[], actorUserId: string): Promise<CommercialConfigurationVersionRow> {
  return callSingleRowRpc<CommercialConfigurationVersionRow>("approve_commercial_configuration_version", {
    p_request_id: requestId,
    p_components: components,
    p_actor_user_id: actorUserId,
  })
}

async function getVersionByRequestId(requestId: string): Promise<CommercialConfigurationVersionRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("commercial_configuration_versions").select("*").eq("request_id", requestId).maybeSingle()
  if (error) throw new CommercialVersionOperationError(parseCommercialVersionError(error))
  return data
}

/** Every version not yet decided, oldest first: the review queue's data source. */
async function listVersionsAwaitingReview(): Promise<CommercialConfigurationVersionRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("commercial_configuration_versions")
    .select("*")
    .eq("status", "submitted")
    .order("updated_at", { ascending: true })
  if (error) throw new CommercialVersionOperationError(parseCommercialVersionError(error))
  return data ?? []
}

/** Every version regardless of status, newest first: the unified Approvals inbox's data source (task Phase E), capped since this only ever backs an operational inbox, never a report. */
async function listAllVersions(): Promise<CommercialConfigurationVersionRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("commercial_configuration_versions")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200)
  if (error) throw new CommercialVersionOperationError(parseCommercialVersionError(error))
  return data ?? []
}

/** Every version against one Commercial Configuration, newest first. */
async function listVersionsForConfiguration(commercialConfigurationId: string): Promise<CommercialConfigurationVersionRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("commercial_configuration_versions")
    .select("*")
    .eq("commercial_configuration_id", commercialConfigurationId)
    .order("created_at", { ascending: false })
  if (error) throw new CommercialVersionOperationError(parseCommercialVersionError(error))
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
  if (error) throw new CommercialVersionOperationError(parseCommercialVersionError(error))
  return data
}

export {
  createVersion,
  saveDraft,
  submitVersion,
  rejectVersion,
  approveVersion,
  getVersionByRequestId,
  listVersionsAwaitingReview,
  listAllVersions,
  listVersionsForConfiguration,
  getLatestRevisionForRequest,
}
export type { CreateVersionInput, SubmitInput }
