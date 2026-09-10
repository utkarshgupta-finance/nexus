import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { CommercialOperationError, parseCommercialError } from "../domain/errors"
import { callSingleRowRpc } from "./rpc"
import type { EarnedResultRow, UsageFactRow } from "./row-types"

/**
 * Repository for Usage Fact and Earned Result (M9). RPC name/signature
 * source:
 * supabase/migrations/20260910100000_commercial_usage_earned_foundation.sql.
 */

type RecordUsageFactInput = {
  commercialConfigurationId: string
  measurementDefinitionId: string
  periodStart: string
  periodEnd: string
  quantity: number
  sourceType: "manual_entry" | "file_import" | "internal_tool" | "external_feed"
  actorUserId: string
  dimensions?: Record<string, unknown> | null
  sourceSystem?: string | null
  sourceReference?: string | null
  sourceEventKey?: string | null
  evidenceReference?: string | null
  auditRequestId?: string | null
  actorContext?: Record<string, unknown> | null
}

/** Wraps record_usage_fact: origin = 'source' only. Never used for corrections; see correctUsageFact. */
async function recordUsageFact(input: RecordUsageFactInput): Promise<UsageFactRow> {
  const supabase = getSupabaseServiceRoleClient()
  return callSingleRowRpc<UsageFactRow>(supabase, "record_usage_fact", {
    p_commercial_configuration_id: input.commercialConfigurationId,
    p_measurement_definition_id: input.measurementDefinitionId,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_quantity: input.quantity,
    p_source_type: input.sourceType,
    p_actor_user_id: input.actorUserId,
    p_dimensions: input.dimensions ?? null,
    p_source_system: input.sourceSystem ?? null,
    p_source_reference: input.sourceReference ?? null,
    p_source_event_key: input.sourceEventKey ?? null,
    p_evidence_reference: input.evidenceReference ?? null,
    p_audit_request_id: input.auditRequestId ?? null,
    p_actor_context: input.actorContext ?? null,
  })
}

type CorrectUsageFactInput = {
  predecessorUsageFactId: string
  quantity: number
  origin: "correction" | "finance_override"
  actorUserId: string
  evidenceReference?: string | null
  overrideReason?: string | null
  overrideApprovedBy?: string | null
  auditRequestId?: string | null
  actorContext?: Record<string, unknown> | null
}

/** Wraps correct_usage_fact: always inherits the predecessor's scope; quantity = 0 is the void mechanism. */
async function correctUsageFact(input: CorrectUsageFactInput): Promise<UsageFactRow> {
  const supabase = getSupabaseServiceRoleClient()
  return callSingleRowRpc<UsageFactRow>(supabase, "correct_usage_fact", {
    p_predecessor_usage_fact_id: input.predecessorUsageFactId,
    p_quantity: input.quantity,
    p_origin: input.origin,
    p_actor_user_id: input.actorUserId,
    p_evidence_reference: input.evidenceReference ?? null,
    p_override_reason: input.overrideReason ?? null,
    p_override_approved_by: input.overrideApprovedBy ?? null,
    p_audit_request_id: input.auditRequestId ?? null,
    p_actor_context: input.actorContext ?? null,
  })
}

type RecordEarnedResultInput = {
  id: string
  commercialComponentId: string
  periodStart: string
  periodEnd: string
  calculatedAmount: number
  transactionCurrency: string
  pricingCalculationVersion: string
  roundingPolicyVersion: string
  actorUserId: string
  measurementDefinitionId?: string | null
  commercialCommitmentId?: string | null
  rawQuantity?: number | null
  calculatedQuantity?: number | null
  usageFactIds?: string[]
  auditRequestId?: string | null
  actorContext?: Record<string, unknown> | null
}

/** Wraps record_earned_result: idempotent on `id`, versions/supersedes automatically. */
async function recordEarnedResult(input: RecordEarnedResultInput): Promise<EarnedResultRow> {
  const supabase = getSupabaseServiceRoleClient()
  return callSingleRowRpc<EarnedResultRow>(supabase, "record_earned_result", {
    p_id: input.id,
    p_commercial_component_id: input.commercialComponentId,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_calculated_amount: input.calculatedAmount,
    p_transaction_currency: input.transactionCurrency,
    p_pricing_calculation_version: input.pricingCalculationVersion,
    p_rounding_policy_version: input.roundingPolicyVersion,
    p_actor_user_id: input.actorUserId,
    p_measurement_definition_id: input.measurementDefinitionId ?? null,
    p_commercial_commitment_id: input.commercialCommitmentId ?? null,
    p_raw_quantity: input.rawQuantity ?? null,
    p_calculated_quantity: input.calculatedQuantity ?? null,
    p_usage_fact_ids: input.usageFactIds ?? [],
    p_audit_request_id: input.auditRequestId ?? null,
    p_actor_context: input.actorContext ?? null,
  })
}

/** Wraps finalize_earned_result: open -> final, idempotent on an already-final row. */
async function finalizeEarnedResult(
  earnedResultId: string,
  actorUserId: string,
  options?: { auditRequestId?: string | null; actorContext?: Record<string, unknown> | null }
): Promise<EarnedResultRow> {
  const supabase = getSupabaseServiceRoleClient()
  return callSingleRowRpc<EarnedResultRow>(supabase, "finalize_earned_result", {
    p_earned_result_id: earnedResultId,
    p_actor_user_id: actorUserId,
    p_audit_request_id: options?.auditRequestId ?? null,
    p_actor_context: options?.actorContext ?? null,
  })
}

async function listUsageFactsByConfigurationId(commercialConfigurationId: string): Promise<UsageFactRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("usage_facts")
    .select("*")
    .eq("commercial_configuration_id", commercialConfigurationId)
    .order("created_at", { ascending: false })
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listEarnedResultsByComponentId(commercialComponentId: string): Promise<EarnedResultRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("earned_results")
    .select("*")
    .eq("commercial_component_id", commercialComponentId)
    .order("period_start", { ascending: true })
    .order("result_version", { ascending: true })
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listEarnedResultsByComponentIds(commercialComponentIds: string[]): Promise<EarnedResultRow[]> {
  if (commercialComponentIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("earned_results")
    .select("*")
    .in("commercial_component_id", commercialComponentIds)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listEarnedResultUsageFactIds(earnedResultId: string): Promise<string[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("earned_result_usage_facts")
    .select("usage_fact_id")
    .eq("earned_result_id", earnedResultId)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return (data ?? []).map((row) => row.usage_fact_id as string)
}

export {
  recordUsageFact,
  correctUsageFact,
  recordEarnedResult,
  finalizeEarnedResult,
  listUsageFactsByConfigurationId,
  listEarnedResultsByComponentId,
  listEarnedResultsByComponentIds,
  listEarnedResultUsageFactIds,
}
export type { RecordUsageFactInput, CorrectUsageFactInput, RecordEarnedResultInput }
