import type { MonthKey } from "@/lib/month"

type RecognitionStatus = "auto_finalized" | "pending_mrr_recognition"

/**
 * Entitlement Ledger domain types (Go Live + Entitlement Ledger, Phases
 * F-N). Every quantity here is a metric quantity (Users, Outlets,
 * whatever this line item's own unit is), never money.
 */

type EntitlementSourceStatus = "active" | "cancelled"

type EntitlementSource = {
  id: string
  /** Human-Friendly ID: render with `formatEntitlementSourceId`. */
  sourceNumber: number
  customerId: string
  stableComponentKey: string
  commercialVersionId: string | null
  invoiceReference: string
  invoiceDate: string
  invoiceQuantity: number
  metric: string
  invoiceDurationMonths: number
  documentReference: string | null
  sourceType: "MANUAL" | "API" | "IMPORT"
  status: EntitlementSourceStatus
  cancelledReason: string | null
  cancelledBy: string | null
  cancelledAt: string | null
  createdBy: string | null
  createdAt: string
  updatedBy: string | null
  updatedAt: string
}

type EntitlementScheduleMonth = {
  id: string
  entitlementSourceId: string
  customerId: string
  stableComponentKey: string
  month: MonthKey
  monthlyQuantity: number
  createdBy: string | null
  createdAt: string
}

type AllocationTreatment = "ADD_TO_EXISTING_ENTITLEMENT_PERIOD" | "CREATE_NEW_ENTITLEMENT_PERIOD"

type MonthlyUsageStatus = "draft" | "final"

type MonthlyUsage = {
  id: string
  customerId: string
  stableComponentKey: string
  commercialVersionId: string | null
  usageMonth: MonthKey
  metric: string
  quantity: number
  source: "MANUAL" | "API" | "IMPORT"
  status: MonthlyUsageStatus
  notes: string | null
  isCurrent: boolean
  submittedBy: string | null
  submittedAt: string
  createdAt: string
}

type MonthlyEntitlementLedgerRow = {
  id: string
  customerId: string
  stableComponentKey: string
  commercialVersionId: string | null
  month: MonthKey
  metric: string
  monthlyEntitlementQuantity: number
  actualUsageQuantity: number
  mugQuantity: number | null
  consumptionQuantity: number
  unbilledQuantity: number
  unearnedQuantity: number
  recognitionStatus: RecognitionStatus
  goLiveRequestId: string | null
  createdAt: string
  updatedAt: string
}

type LedgerEntryStatus = "OPEN" | "PARTIALLY_SETTLED" | "SETTLED"

type UnbilledLedgerEntry = {
  id: string
  monthlyLedgerId: string
  customerId: string
  stableComponentKey: string
  month: MonthKey
  metric: string
  unbilledQuantity: number
  status: LedgerEntryStatus
  createdAt: string
  updatedAt: string
}

type UnearnedLedgerEntry = {
  id: string
  monthlyLedgerId: string
  customerId: string
  stableComponentKey: string
  month: MonthKey
  metric: string
  unearnedQuantity: number
  status: LedgerEntryStatus
  createdAt: string
  updatedAt: string
}

type SettlementRecord = {
  id: string
  ledgerEntryType: "unbilled" | "unearned"
  ledgerEntryId: string
  settlementReference: string
  settledQuantity: number
  settlementDate: string
  settledBy: string | null
  createdAt: string
}

/** Human-Friendly ID: "ES-000123". */
function formatEntitlementSourceId(sourceNumber: number): string {
  return `ES-${String(sourceNumber).padStart(6, "0")}`
}

export { formatEntitlementSourceId }
export type {
  EntitlementSourceStatus,
  EntitlementSource,
  EntitlementScheduleMonth,
  AllocationTreatment,
  MonthlyUsageStatus,
  MonthlyUsage,
  MonthlyEntitlementLedgerRow,
  LedgerEntryStatus,
  UnbilledLedgerEntry,
  UnearnedLedgerEntry,
  SettlementRecord,
}
