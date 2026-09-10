import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { CommercialOperationError, parseCommercialError } from "../domain/errors"
import { callSingleRowRpc } from "./rpc"
import type { BillingCalculationRow, InvoiceEligibilityEventRow } from "./row-types"

/**
 * Repository for Billing Calculation and Invoice Eligibility Event (M10).
 * RPC name/signature source:
 * supabase/migrations/20260910110000_commercial_billing_invoice_reconciliation_foundation.sql.
 */

type RecordBillingCalculationInput = {
  id: string
  commercialComponentId: string
  billingPeriodStart: string
  billingPeriodEnd: string
  billingQuantityBasisUsed: "mug" | "previous_period_actual" | "period_actual" | "fixed"
  calculatedAmount: number
  transactionCurrency: string
  pricingCalculationVersion: string
  roundingPolicyVersion: string
  actorUserId: string
  basisQuantity?: number | null
  sourceEarnedResultId?: string | null
  sourceCommercialCommitmentId?: string | null
  auditRequestId?: string | null
  actorContext?: Record<string, unknown> | null
}

/**
 * Wraps record_billing_calculation. Immutable, insert-only, no
 * versioning: idempotent on `id`, database-enforced one row per
 * (commercialComponentId, billingPeriodStart, billingPeriodEnd). A wrong
 * calculation is never corrected here; see
 * reconciliation.data.ts#createReconciliationAdjustment.
 */
async function recordBillingCalculation(input: RecordBillingCalculationInput): Promise<BillingCalculationRow> {
  const supabase = getSupabaseServiceRoleClient()
  return callSingleRowRpc<BillingCalculationRow>(supabase, "record_billing_calculation", {
    p_id: input.id,
    p_commercial_component_id: input.commercialComponentId,
    p_billing_period_start: input.billingPeriodStart,
    p_billing_period_end: input.billingPeriodEnd,
    p_billing_quantity_basis_used: input.billingQuantityBasisUsed,
    p_calculated_amount: input.calculatedAmount,
    p_transaction_currency: input.transactionCurrency,
    p_pricing_calculation_version: input.pricingCalculationVersion,
    p_rounding_policy_version: input.roundingPolicyVersion,
    p_actor_user_id: input.actorUserId,
    p_basis_quantity: input.basisQuantity ?? null,
    p_source_earned_result_id: input.sourceEarnedResultId ?? null,
    p_source_commercial_commitment_id: input.sourceCommercialCommitmentId ?? null,
    p_audit_request_id: input.auditRequestId ?? null,
    p_actor_context: input.actorContext ?? null,
  })
}

type RecordInvoiceEligibilityEventInput = {
  billingCalculationId: string
  eligible: boolean
  reason: string
  actorUserId: string
  decidedBy?: string | null
  auditRequestId?: string | null
  actorContext?: Record<string, unknown> | null
}

/** Wraps record_invoice_eligibility_event: append-only, no dedup key by design; every call inserts a new event. */
async function recordInvoiceEligibilityEvent(
  input: RecordInvoiceEligibilityEventInput
): Promise<InvoiceEligibilityEventRow> {
  const supabase = getSupabaseServiceRoleClient()
  return callSingleRowRpc<InvoiceEligibilityEventRow>(supabase, "record_invoice_eligibility_event", {
    p_billing_calculation_id: input.billingCalculationId,
    p_eligible: input.eligible,
    p_reason: input.reason,
    p_actor_user_id: input.actorUserId,
    p_decided_by: input.decidedBy ?? null,
    p_audit_request_id: input.auditRequestId ?? null,
    p_actor_context: input.actorContext ?? null,
  })
}

async function listBillingCalculationsByComponentId(commercialComponentId: string): Promise<BillingCalculationRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("billing_calculations")
    .select("*")
    .eq("commercial_component_id", commercialComponentId)
    .order("billing_period_start", { ascending: true })
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listBillingCalculationsByComponentIds(commercialComponentIds: string[]): Promise<BillingCalculationRow[]> {
  if (commercialComponentIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("billing_calculations")
    .select("*")
    .in("commercial_component_id", commercialComponentIds)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listBillingCalculationsByIds(ids: string[]): Promise<BillingCalculationRow[]> {
  if (ids.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("billing_calculations").select("*").in("id", ids)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

/**
 * All eligibility events for a set of Billing Calculations, newest first
 * within each. Current eligibility for one Billing Calculation is the
 * first row in this result for that billingCalculationId; see
 * domain read-model composition, not this repository, for that
 * derivation.
 */
async function listInvoiceEligibilityEventsByBillingCalculationIds(
  billingCalculationIds: string[]
): Promise<InvoiceEligibilityEventRow[]> {
  if (billingCalculationIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("invoice_eligibility_events")
    .select("*")
    .in("billing_calculation_id", billingCalculationIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

export {
  recordBillingCalculation,
  recordInvoiceEligibilityEvent,
  listBillingCalculationsByComponentId,
  listBillingCalculationsByComponentIds,
  listBillingCalculationsByIds,
  listInvoiceEligibilityEventsByBillingCalculationIds,
}
export type { RecordBillingCalculationInput, RecordInvoiceEligibilityEventInput }
