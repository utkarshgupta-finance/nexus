import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { CommercialOperationError, parseCommercialError } from "../domain/errors"
import { callTableRpc } from "./rpc"
import type {
  CommercialChangeRow,
  CommercialCommitmentComponentRow,
  CommercialCommitmentRow,
  CommercialComponentRow,
  CommercialConfigurationRow,
  MeasurementDefinitionRow,
} from "./row-types"

/**
 * Repository for Commercial Configuration, Commercial Change, Commercial
 * Component, Commercial Commitment, and Measurement Definition (M8). RPC
 * name/signature source:
 * supabase/migrations/20260908210000_commercial_configuration_foundation.sql.
 */

type CreateCommercialConfigurationInput = {
  newCommercialConfigurationId: string
  requestId: string
  customerId: string
  key: string
  name: string
  effectiveDate: string
  actorUserId: string
  relationshipNote?: string | null
  reason?: string | null
  auditRequestId?: string | null
  actorContext?: Record<string, unknown> | null
}

type CreateCommercialConfigurationResult = {
  commercialChange: CommercialChangeRow
  commercialConfiguration: CommercialConfigurationRow
}

/** Wraps create_commercial_configuration_with_change: the sole sanctioned creation path for M8's initial_setup pair. */
async function createCommercialConfigurationWithChange(
  input: CreateCommercialConfigurationInput
): Promise<CreateCommercialConfigurationResult> {
  const supabase = getSupabaseServiceRoleClient()
  const row = await callTableRpc<{
    commercial_change: CommercialChangeRow
    commercial_configuration: CommercialConfigurationRow
  }>(supabase, "create_commercial_configuration_with_change", {
    p_new_commercial_configuration_id: input.newCommercialConfigurationId,
    p_request_id: input.requestId,
    p_customer_id: input.customerId,
    p_key: input.key,
    p_name: input.name,
    p_effective_date: input.effectiveDate,
    p_actor_user_id: input.actorUserId,
    p_relationship_note: input.relationshipNote ?? null,
    p_reason: input.reason ?? null,
    p_audit_request_id: input.auditRequestId ?? null,
    p_actor_context: input.actorContext ?? null,
  })
  return { commercialChange: row.commercial_change, commercialConfiguration: row.commercial_configuration }
}

async function getCommercialConfigurationById(id: string): Promise<CommercialConfigurationRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("commercial_configurations")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data
}

async function listCommercialChangesByConfigurationId(
  commercialConfigurationId: string
): Promise<CommercialChangeRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("commercial_changes")
    .select("*")
    .eq("commercial_configuration_id", commercialConfigurationId)
    .order("effective_date", { ascending: true })
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listCommercialComponentsByConfigurationId(
  commercialConfigurationId: string
): Promise<CommercialComponentRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("commercial_components")
    .select("*")
    .eq("commercial_configuration_id", commercialConfigurationId)
    .order("effective_from", { ascending: true })
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function getCommercialComponentById(id: string): Promise<CommercialComponentRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("commercial_components").select("*").eq("id", id).maybeSingle()
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data
}

async function listCommercialCommitmentsByChangeIds(
  commercialChangeIds: string[]
): Promise<CommercialCommitmentRow[]> {
  if (commercialChangeIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("commercial_commitments")
    .select("*")
    .in("commercial_change_id", commercialChangeIds)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listCommercialCommitmentsByComponentId(
  commercialComponentId: string
): Promise<CommercialCommitmentRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("commercial_commitments")
    .select("*")
    .eq("commercial_component_id", commercialComponentId)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

/**
 * Batched sibling of listCommercialCommitmentsByComponentId, for reading
 * several Components at once without one query per Component. Only ever
 * returns kind = 'quantity' commitments: a kind = 'spend' commitment has
 * no direct commercial_component_id (it attaches through
 * commercial_commitment_components instead). Resolving spend commitments
 * for a set of Components is a separate composition of
 * listCommitmentComponentMembershipsByComponentIds +
 * listCommercialCommitmentsByIds +
 * listCommitmentComponentMembershipsByCommitmentIds below; see
 * services/configuration.service.ts#listCommitmentsForComponents, which
 * is the one place that composes both kinds into the full picture.
 */
async function listCommercialCommitmentsByComponentIds(
  commercialComponentIds: string[]
): Promise<CommercialCommitmentRow[]> {
  if (commercialComponentIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("commercial_commitments")
    .select("*")
    .in("commercial_component_id", commercialComponentIds)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listCommercialCommitmentsByIds(ids: string[]): Promise<CommercialCommitmentRow[]> {
  if (ids.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("commercial_commitments").select("*").in("id", ids)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

/**
 * Finds candidate kind = 'spend' commitment ids that cover any Component
 * in `commercialComponentIds`, by querying commercial_commitment_components
 * directly. This alone is NOT the complete membership for those
 * commitments (a spend commitment may also cover Components outside this
 * set): follow up with
 * listCommitmentComponentMembershipsByCommitmentIds using the distinct
 * commitment_ids this returns, to get each commitment's true full
 * membership.
 */
async function listCommitmentComponentMembershipsByComponentIds(
  commercialComponentIds: string[]
): Promise<CommercialCommitmentComponentRow[]> {
  if (commercialComponentIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("commercial_commitment_components")
    .select("*")
    .in("component_id", commercialComponentIds)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

/** The complete, true membership for a known set of spend commitment ids. */
async function listCommitmentComponentMembershipsByCommitmentIds(
  commitmentIds: string[]
): Promise<CommercialCommitmentComponentRow[]> {
  if (commitmentIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("commercial_commitment_components")
    .select("*")
    .in("commitment_id", commitmentIds)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listMeasurementDefinitionsByIds(ids: string[]): Promise<MeasurementDefinitionRow[]> {
  if (ids.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("measurement_definitions").select("*").in("id", ids)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

export {
  createCommercialConfigurationWithChange,
  getCommercialConfigurationById,
  listCommercialChangesByConfigurationId,
  listCommercialComponentsByConfigurationId,
  getCommercialComponentById,
  listCommercialCommitmentsByChangeIds,
  listCommercialCommitmentsByComponentId,
  listCommercialCommitmentsByComponentIds,
  listCommercialCommitmentsByIds,
  listCommitmentComponentMembershipsByComponentIds,
  listCommitmentComponentMembershipsByCommitmentIds,
  listMeasurementDefinitionsByIds,
}
export type { CreateCommercialConfigurationInput, CreateCommercialConfigurationResult }
