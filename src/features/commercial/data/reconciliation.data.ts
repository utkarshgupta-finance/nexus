import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { CommercialOperationError, parseCommercialError } from "../domain/errors"
import { callSingleRowRpc } from "./rpc"
import type { ReconciliationAdjustmentRow } from "./row-types"

/**
 * Repository for Reconciliation Adjustment (M10). RPC name/signature
 * source:
 * supabase/migrations/20260910110000_commercial_billing_invoice_reconciliation_foundation.sql.
 */

type CreateReconciliationAdjustmentInput = {
  resourceId: string
  commercialComponentId: string
  windowStart: string
  windowEnd: string
  direction: "additional_billing" | "credit_note"
  monetaryDifference: number
  transactionCurrency: string
  reason: string
  actorUserId: string
  /** Not-null column: the effective-rate/commercial-period evidence behind monetaryDifference. Always required. */
  rateProvenance: Record<string, unknown>
  earnedAmount?: number | null
  billedAmount?: number | null
  /** Populated only when a quantity/billing-basis comparison is meaningful; never fabricated. */
  quantityExplanation?: Record<string, unknown> | null
  supersedesAdjustmentId?: string | null
  auditRequestId?: string | null
  actorContext?: Record<string, unknown> | null
}

/**
 * Wraps create_reconciliation_adjustment: atomic Resource + row creation.
 * `resourceId` is caller-supplied (must be minted by the caller before
 * this call, the same convention as every other Resource-backed create
 * path in this schema).
 */
async function createReconciliationAdjustment(
  input: CreateReconciliationAdjustmentInput
): Promise<ReconciliationAdjustmentRow> {
  const supabase = getSupabaseServiceRoleClient()
  return callSingleRowRpc<ReconciliationAdjustmentRow>(supabase, "create_reconciliation_adjustment", {
    p_resource_id: input.resourceId,
    p_commercial_component_id: input.commercialComponentId,
    p_window_start: input.windowStart,
    p_window_end: input.windowEnd,
    p_direction: input.direction,
    p_monetary_difference: input.monetaryDifference,
    p_transaction_currency: input.transactionCurrency,
    p_reason: input.reason,
    p_actor_user_id: input.actorUserId,
    p_rate_provenance: input.rateProvenance,
    p_earned_amount: input.earnedAmount ?? null,
    p_billed_amount: input.billedAmount ?? null,
    p_quantity_explanation: input.quantityExplanation ?? null,
    p_supersedes_adjustment_id: input.supersedesAdjustmentId ?? null,
    p_audit_request_id: input.auditRequestId ?? null,
    p_actor_context: input.actorContext ?? null,
  })
}

/** Wraps finalize_reconciliation_adjustment: open -> final, idempotent on an already-final row. */
async function finalizeReconciliationAdjustment(
  resourceId: string,
  actorUserId: string,
  options?: { auditRequestId?: string | null; actorContext?: Record<string, unknown> | null }
): Promise<ReconciliationAdjustmentRow> {
  const supabase = getSupabaseServiceRoleClient()
  return callSingleRowRpc<ReconciliationAdjustmentRow>(supabase, "finalize_reconciliation_adjustment", {
    p_resource_id: resourceId,
    p_actor_user_id: actorUserId,
    p_audit_request_id: options?.auditRequestId ?? null,
    p_actor_context: options?.actorContext ?? null,
  })
}

async function listReconciliationAdjustmentsByComponentId(
  commercialComponentId: string
): Promise<ReconciliationAdjustmentRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reconciliation_adjustments")
    .select("*")
    .eq("commercial_component_id", commercialComponentId)
    .order("window_start", { ascending: true })
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listReconciliationAdjustmentsByComponentIds(
  commercialComponentIds: string[]
): Promise<ReconciliationAdjustmentRow[]> {
  if (commercialComponentIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reconciliation_adjustments")
    .select("*")
    .in("commercial_component_id", commercialComponentIds)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listReconciliationAdjustmentsByIds(ids: string[]): Promise<ReconciliationAdjustmentRow[]> {
  if (ids.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("reconciliation_adjustments").select("*").in("resource_id", ids)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

export {
  createReconciliationAdjustment,
  finalizeReconciliationAdjustment,
  listReconciliationAdjustmentsByComponentId,
  listReconciliationAdjustmentsByComponentIds,
  listReconciliationAdjustmentsByIds,
}
export type { CreateReconciliationAdjustmentInput }
