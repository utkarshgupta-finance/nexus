import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { CommercialOperationError, parseCommercialError } from "../domain/errors"
import { callSingleRowRpc } from "./rpc"
import type { InvoiceEvidenceItemRow, InvoiceEvidenceRow } from "./row-types"

/**
 * Repository for Invoice Evidence and Invoice Evidence Item (M10). RPC
 * name/signature source:
 * supabase/migrations/20260910110000_commercial_billing_invoice_reconciliation_foundation.sql.
 */

type RecordInvoiceEvidenceInput = {
  evidenceKind: "invoice" | "credit_note"
  amount: number
  currency: string
  actorUserId: string
  externalReference?: string | null
  externalDate?: string | null
  sourceSystem?: string | null
  auditRequestId?: string | null
  actorContext?: Record<string, unknown> | null
}

/**
 * Wraps record_invoice_evidence: a pure external-document header.
 * Deduplicates on (sourceSystem, evidenceKind, externalReference) when
 * both sourceSystem and externalReference are supplied; manual entry
 * (either omitted) is never deduplicated.
 */
async function recordInvoiceEvidence(input: RecordInvoiceEvidenceInput): Promise<InvoiceEvidenceRow> {
  const supabase = getSupabaseServiceRoleClient()
  return callSingleRowRpc<InvoiceEvidenceRow>(supabase, "record_invoice_evidence", {
    p_evidence_kind: input.evidenceKind,
    p_amount: input.amount,
    p_currency: input.currency,
    p_actor_user_id: input.actorUserId,
    p_external_reference: input.externalReference ?? null,
    p_external_date: input.externalDate ?? null,
    p_source_system: input.sourceSystem ?? null,
    p_audit_request_id: input.auditRequestId ?? null,
    p_actor_context: input.actorContext ?? null,
  })
}

type RecordInvoiceEvidenceItemInput = {
  invoiceEvidenceId: string
  allocatedAmount: number
  actorUserId: string
  target:
    | { kind: "billing_calculation"; billingCalculationId: string }
    | { kind: "reconciliation_adjustment"; reconciliationAdjustmentId: string }
  auditRequestId?: string | null
  actorContext?: Record<string, unknown> | null
}

/**
 * Wraps record_invoice_evidence_item: allocates one Invoice Evidence
 * header against exactly one Billing Calculation or Reconciliation
 * Adjustment. The `target` union makes "exactly one, never both" a
 * caller-side type error, mirroring the database's own
 * chk_invoice_evidence_items_exactly_one_target.
 */
async function recordInvoiceEvidenceItem(input: RecordInvoiceEvidenceItemInput): Promise<InvoiceEvidenceItemRow> {
  const supabase = getSupabaseServiceRoleClient()
  return callSingleRowRpc<InvoiceEvidenceItemRow>(supabase, "record_invoice_evidence_item", {
    p_invoice_evidence_id: input.invoiceEvidenceId,
    p_allocated_amount: input.allocatedAmount,
    p_actor_user_id: input.actorUserId,
    p_billing_calculation_id: input.target.kind === "billing_calculation" ? input.target.billingCalculationId : null,
    p_reconciliation_adjustment_id:
      input.target.kind === "reconciliation_adjustment" ? input.target.reconciliationAdjustmentId : null,
    p_audit_request_id: input.auditRequestId ?? null,
    p_actor_context: input.actorContext ?? null,
  })
}

async function listInvoiceEvidenceItemsByBillingCalculationIds(
  billingCalculationIds: string[]
): Promise<InvoiceEvidenceItemRow[]> {
  if (billingCalculationIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("invoice_evidence_items")
    .select("*")
    .in("billing_calculation_id", billingCalculationIds)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listInvoiceEvidenceItemsByReconciliationAdjustmentIds(
  reconciliationAdjustmentIds: string[]
): Promise<InvoiceEvidenceItemRow[]> {
  if (reconciliationAdjustmentIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("invoice_evidence_items")
    .select("*")
    .in("reconciliation_adjustment_id", reconciliationAdjustmentIds)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

async function listInvoiceEvidenceByIds(ids: string[]): Promise<InvoiceEvidenceRow[]> {
  if (ids.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("invoice_evidence").select("*").in("id", ids)
  if (error) throw new CommercialOperationError(parseCommercialError(error))
  return data ?? []
}

export {
  recordInvoiceEvidence,
  recordInvoiceEvidenceItem,
  listInvoiceEvidenceItemsByBillingCalculationIds,
  listInvoiceEvidenceItemsByReconciliationAdjustmentIds,
  listInvoiceEvidenceByIds,
}
export type { RecordInvoiceEvidenceInput, RecordInvoiceEvidenceItemInput }
