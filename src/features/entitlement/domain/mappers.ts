import { toMonthKey } from "@/lib/month"
import type {
  EntitlementSourceRow,
  EntitlementScheduleMonthRow,
  MonthlyUsageRow,
  MonthlyEntitlementLedgerRow as MonthlyEntitlementLedgerRowType,
  UnbilledLedgerEntryRow,
  UnearnedLedgerEntryRow,
  SettlementRecordRow,
  SettlementAdjustmentRow,
} from "../data/entitlement-row-types"
import type {
  EntitlementSource,
  EntitlementSourceStatus,
  EntitlementScheduleMonth,
  MonthlyUsage,
  MonthlyUsageStatus,
  MonthlyEntitlementLedgerRow,
  LedgerEntryStatus,
  UnbilledLedgerEntry,
  UnearnedLedgerEntry,
  SettlementRecord,
  SettlementAdjustment,
} from "./types"

function toEntitlementSource(row: EntitlementSourceRow): EntitlementSource {
  return {
    id: row.id,
    sourceNumber: row.source_number,
    customerId: row.customer_id,
    stableComponentKey: row.stable_component_key,
    commercialVersionId: row.commercial_version_id,
    invoiceReference: row.invoice_reference,
    invoiceDate: row.invoice_date,
    invoiceQuantity: row.invoice_quantity,
    metric: row.metric,
    invoiceDurationMonths: row.invoice_duration_months,
    documentReference: row.document_reference,
    sourceType: row.source_type as EntitlementSource["sourceType"],
    status: row.status as EntitlementSourceStatus,
    cancelledReason: row.cancelled_reason,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}

function toEntitlementScheduleMonth(row: EntitlementScheduleMonthRow): EntitlementScheduleMonth {
  return {
    id: row.id,
    entitlementSourceId: row.entitlement_source_id,
    customerId: row.customer_id,
    stableComponentKey: row.stable_component_key,
    month: toMonthKey(row.month),
    monthlyQuantity: row.monthly_quantity,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

function toMonthlyUsage(row: MonthlyUsageRow): MonthlyUsage {
  return {
    id: row.id,
    customerId: row.customer_id,
    stableComponentKey: row.stable_component_key,
    commercialVersionId: row.commercial_version_id,
    usageMonth: toMonthKey(row.usage_month),
    metric: row.metric,
    quantity: row.quantity,
    source: row.source as MonthlyUsage["source"],
    status: row.status as MonthlyUsageStatus,
    notes: row.notes,
    isCurrent: row.is_current,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
  }
}

function toMonthlyEntitlementLedgerRow(row: MonthlyEntitlementLedgerRowType): MonthlyEntitlementLedgerRow {
  return {
    id: row.id,
    customerId: row.customer_id,
    stableComponentKey: row.stable_component_key,
    commercialVersionId: row.commercial_version_id,
    month: toMonthKey(row.month),
    metric: row.metric,
    monthlyEntitlementQuantity: row.monthly_entitlement_quantity,
    actualUsageQuantity: row.actual_usage_quantity,
    mugQuantity: row.mug_quantity,
    consumptionQuantity: row.consumption_quantity,
    unbilledQuantity: row.unbilled_quantity,
    unearnedQuantity: row.unearned_quantity,
    recognitionStatus: row.recognition_status as MonthlyEntitlementLedgerRow["recognitionStatus"],
    goLiveRequestId: row.go_live_request_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toUnbilledLedgerEntry(row: UnbilledLedgerEntryRow): UnbilledLedgerEntry {
  return {
    id: row.id,
    monthlyLedgerId: row.monthly_ledger_id,
    customerId: row.customer_id,
    stableComponentKey: row.stable_component_key,
    month: toMonthKey(row.month),
    metric: row.metric,
    unbilledQuantity: row.unbilled_quantity,
    status: row.status as LedgerEntryStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toUnearnedLedgerEntry(row: UnearnedLedgerEntryRow): UnearnedLedgerEntry {
  return {
    id: row.id,
    monthlyLedgerId: row.monthly_ledger_id,
    customerId: row.customer_id,
    stableComponentKey: row.stable_component_key,
    month: toMonthKey(row.month),
    metric: row.metric,
    unearnedQuantity: row.unearned_quantity,
    status: row.status as LedgerEntryStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSettlementRecord(row: SettlementRecordRow): SettlementRecord {
  return {
    id: row.id,
    ledgerEntryType: row.ledger_entry_type as SettlementRecord["ledgerEntryType"],
    ledgerEntryId: row.ledger_entry_id,
    settlementReference: row.settlement_reference,
    settledQuantity: row.settled_quantity,
    settlementDate: row.settlement_date,
    settledBy: row.settled_by,
    createdAt: row.created_at,
  }
}

function toSettlementAdjustment(row: SettlementAdjustmentRow): SettlementAdjustment {
  return {
    id: row.id,
    originalSettlementId: row.original_settlement_id,
    ledgerEntryType: row.ledger_entry_type as SettlementAdjustment["ledgerEntryType"],
    ledgerEntryId: row.ledger_entry_id,
    reversalReference: row.reversal_reference,
    reversedQuantity: row.reversed_quantity,
    reason: row.reason,
    reversedBy: row.reversed_by,
    reversedAt: row.reversed_at,
  }
}

export {
  toEntitlementSource,
  toEntitlementScheduleMonth,
  toMonthlyUsage,
  toMonthlyEntitlementLedgerRow,
  toUnbilledLedgerEntry,
  toUnearnedLedgerEntry,
  toSettlementRecord,
  toSettlementAdjustment,
}
