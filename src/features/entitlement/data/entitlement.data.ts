import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { EntitlementOperationError, parseEntitlementError } from "../domain/entitlement-errors"
import { monthKeyToBusinessDate } from "@/lib/month"
import type {
  EntitlementSourceRow,
  EntitlementScheduleMonthRow,
  MonthlyUsageRow,
  MonthlyEntitlementLedgerRow,
  UnbilledLedgerEntryRow,
  UnearnedLedgerEntryRow,
  SettlementRecordRow,
  SettlementAdjustmentRow,
} from "./entitlement-row-types"
import type { MonthlyAllocationEntry } from "../domain/allocation"

/**
 * Repository for the Entitlement Ledger domain
 * (supabase/migrations/20260919010000_entitlement_ledger_foundation.sql).
 * Thin RPC wrappers plus plain reads, matching every other feature's
 * data.ts. Business computation (MUG rules, allocation split) always
 * happens before this layer is called; nothing here re-derives it.
 */

async function callSingleRowRpc<TRow>(fn: string, args: Record<string, unknown>): Promise<TRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new EntitlementOperationError(parseEntitlementError(error))
  if (!data) throw new EntitlementOperationError(parseEntitlementError({ message: `${fn} returned no row` }))
  return data as TRow
}

type CreateEntitlementSourceInput = {
  id: string
  customerId: string
  stableComponentKey: string
  commercialVersionId: string | null
  invoiceReference: string
  invoiceDate: string
  invoiceQuantity: number
  metric: string
  invoiceDurationMonths: number
  documentReference: string | null
  actorUserId: string
}

async function createEntitlementSource(input: CreateEntitlementSourceInput): Promise<EntitlementSourceRow> {
  return callSingleRowRpc<EntitlementSourceRow>("create_entitlement_source", {
    p_id: input.id,
    p_customer_id: input.customerId,
    p_stable_component_key: input.stableComponentKey,
    p_commercial_version_id: input.commercialVersionId,
    p_invoice_reference: input.invoiceReference,
    p_invoice_date: input.invoiceDate,
    p_invoice_quantity: input.invoiceQuantity,
    p_metric: input.metric,
    p_invoice_duration_months: input.invoiceDurationMonths,
    p_document_reference: input.documentReference,
    p_actor_user_id: input.actorUserId,
  })
}

async function cancelEntitlementSource(id: string, reason: string, actorUserId: string): Promise<EntitlementSourceRow> {
  return callSingleRowRpc<EntitlementSourceRow>("cancel_entitlement_source", { p_id: id, p_reason: reason, p_actor_user_id: actorUserId })
}

async function generateAllocationSchedule(entitlementSourceId: string, entries: MonthlyAllocationEntry[], actorUserId: string): Promise<EntitlementScheduleMonthRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("generate_allocation_schedule", {
    p_entitlement_source_id: entitlementSourceId,
    p_monthly_quantities: entries.map((entry) => ({ month: monthKeyToBusinessDate(entry.month), quantity: entry.quantity })),
    p_actor_user_id: actorUserId,
  })
  if (error) throw new EntitlementOperationError(parseEntitlementError(error))
  return data ?? []
}

type SubmitMonthlyUsageInput = {
  id: string
  customerId: string
  stableComponentKey: string
  commercialVersionId: string | null
  usageMonth: string
  metric: string
  quantity: number
  source: string
  notes: string | null
  isRecurring: boolean
  actorUserId: string
}

async function submitMonthlyUsage(input: SubmitMonthlyUsageInput): Promise<MonthlyUsageRow> {
  return callSingleRowRpc<MonthlyUsageRow>("submit_monthly_usage", {
    p_id: input.id,
    p_customer_id: input.customerId,
    p_stable_component_key: input.stableComponentKey,
    p_commercial_version_id: input.commercialVersionId,
    p_usage_month: input.usageMonth,
    p_metric: input.metric,
    p_quantity: input.quantity,
    p_source: input.source,
    p_notes: input.notes,
    p_is_recurring: input.isRecurring,
    p_actor_user_id: input.actorUserId,
  })
}

async function finalizeMonthlyUsage(id: string, actorUserId: string): Promise<MonthlyUsageRow> {
  return callSingleRowRpc<MonthlyUsageRow>("finalize_monthly_usage", { p_id: id, p_actor_user_id: actorUserId })
}

type UpsertMonthlyEntitlementLedgerInput = {
  customerId: string
  stableComponentKey: string
  commercialVersionId: string | null
  month: string
  metric: string
  monthlyEntitlementQuantity: number
  actualUsageQuantity: number
  mugQuantity: number | null
  consumptionQuantity: number
  unbilledQuantity: number
  unearnedQuantity: number
  recognitionStatus: string
  goLiveRequestId: string | null
  actorUserId: string
}

async function upsertMonthlyEntitlementLedger(input: UpsertMonthlyEntitlementLedgerInput): Promise<MonthlyEntitlementLedgerRow> {
  return callSingleRowRpc<MonthlyEntitlementLedgerRow>("upsert_monthly_entitlement_ledger", {
    p_customer_id: input.customerId,
    p_stable_component_key: input.stableComponentKey,
    p_commercial_version_id: input.commercialVersionId,
    p_month: input.month,
    p_metric: input.metric,
    p_monthly_entitlement_quantity: input.monthlyEntitlementQuantity,
    p_actual_usage_quantity: input.actualUsageQuantity,
    p_mug_quantity: input.mugQuantity,
    p_consumption_quantity: input.consumptionQuantity,
    p_unbilled_quantity: input.unbilledQuantity,
    p_unearned_quantity: input.unearnedQuantity,
    p_recognition_status: input.recognitionStatus,
    p_go_live_request_id: input.goLiveRequestId,
    p_actor_user_id: input.actorUserId,
  })
}

async function recordSettlement(
  ledgerEntryType: "unbilled" | "unearned",
  ledgerEntryId: string,
  settlementReference: string,
  settledQuantity: number,
  settlementDate: string,
  actorUserId: string
): Promise<SettlementRecordRow> {
  return callSingleRowRpc<SettlementRecordRow>("record_settlement", {
    p_ledger_entry_type: ledgerEntryType,
    p_ledger_entry_id: ledgerEntryId,
    p_settlement_reference: settlementReference,
    p_settled_quantity: settledQuantity,
    p_settlement_date: settlementDate,
    p_actor_user_id: actorUserId,
  })
}

async function listEntitlementSourcesForComponent(stableComponentKey: string): Promise<EntitlementSourceRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("entitlement_sources")
    .select("*")
    .eq("stable_component_key", stableComponentKey)
    .order("invoice_date", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function listScheduleMonthsForComponent(stableComponentKey: string): Promise<EntitlementScheduleMonthRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("entitlement_schedule_months")
    .select("*")
    .eq("stable_component_key", stableComponentKey)
    .order("month", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function getCurrentMonthlyUsage(customerId: string, stableComponentKey: string, usageMonth: string): Promise<MonthlyUsageRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("monthly_usage")
    .select("*")
    .eq("customer_id", customerId)
    .eq("stable_component_key", stableComponentKey)
    .eq("usage_month", usageMonth)
    .eq("is_current", true)
    .maybeSingle()
  if (error) throw error
  return data
}

async function listMonthlyUsageForComponent(stableComponentKey: string): Promise<MonthlyUsageRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("monthly_usage")
    .select("*")
    .eq("stable_component_key", stableComponentKey)
    .eq("is_current", true)
    .order("usage_month", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function listLedgerRowsForComponent(stableComponentKey: string): Promise<MonthlyEntitlementLedgerRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("monthly_entitlement_ledger")
    .select("*")
    .eq("stable_component_key", stableComponentKey)
    .order("month", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function listUnbilledEntriesForComponent(stableComponentKey: string): Promise<UnbilledLedgerEntryRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("unbilled_ledger_entries")
    .select("*")
    .eq("stable_component_key", stableComponentKey)
    .order("month", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function listUnearnedEntriesForComponent(stableComponentKey: string): Promise<UnearnedLedgerEntryRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("unearned_ledger_entries")
    .select("*")
    .eq("stable_component_key", stableComponentKey)
    .order("month", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function listOpenUnbilledEntriesForCustomer(customerId: string): Promise<UnbilledLedgerEntryRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("unbilled_ledger_entries").select("*").eq("customer_id", customerId).neq("status", "SETTLED")
  if (error) throw error
  return data ?? []
}

async function listOpenUnearnedEntriesForCustomer(customerId: string): Promise<UnearnedLedgerEntryRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("unearned_ledger_entries").select("*").eq("customer_id", customerId).neq("status", "SETTLED")
  if (error) throw error
  return data ?? []
}

async function listSettlementRecords(ledgerEntryType: "unbilled" | "unearned", ledgerEntryId: string): Promise<SettlementRecordRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("settlement_records")
    .select("*")
    .eq("ledger_entry_type", ledgerEntryType)
    .eq("ledger_entry_id", ledgerEntryId)
    .order("created_at", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function reverseSettlement(
  settlementId: string,
  reversalReference: string,
  reversalQuantity: number,
  reason: string,
  actorUserId: string
): Promise<SettlementAdjustmentRow> {
  return callSingleRowRpc<SettlementAdjustmentRow>("reverse_settlement", {
    p_settlement_id: settlementId,
    p_reversal_reference: reversalReference,
    p_reversal_quantity: reversalQuantity,
    p_reason: reason,
    p_actor_user_id: actorUserId,
  })
}

async function listSettlementAdjustments(originalSettlementId: string): Promise<SettlementAdjustmentRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("settlement_adjustments")
    .select("*")
    .eq("original_settlement_id", originalSettlementId)
    .order("reversed_at", { ascending: true })
  if (error) throw error
  return data ?? []
}

export {
  createEntitlementSource,
  cancelEntitlementSource,
  generateAllocationSchedule,
  submitMonthlyUsage,
  finalizeMonthlyUsage,
  upsertMonthlyEntitlementLedger,
  recordSettlement,
  listEntitlementSourcesForComponent,
  listScheduleMonthsForComponent,
  getCurrentMonthlyUsage,
  listMonthlyUsageForComponent,
  listLedgerRowsForComponent,
  listUnbilledEntriesForComponent,
  listUnearnedEntriesForComponent,
  listOpenUnbilledEntriesForCustomer,
  listOpenUnearnedEntriesForCustomer,
  listSettlementRecords,
  reverseSettlement,
  listSettlementAdjustments,
}
export type { CreateEntitlementSourceInput, SubmitMonthlyUsageInput, UpsertMonthlyEntitlementLedgerInput }
