type EntitlementSourceRow = {
  id: string
  source_number: number
  customer_id: string
  stable_component_key: string
  commercial_version_id: string | null
  invoice_reference: string
  invoice_date: string
  invoice_quantity: number
  metric: string
  invoice_duration_months: number
  document_reference: string | null
  source_type: string
  status: string
  cancelled_reason: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

type EntitlementScheduleMonthRow = {
  id: string
  entitlement_source_id: string
  customer_id: string
  stable_component_key: string
  month: string
  monthly_quantity: number
  created_at: string
  created_by: string | null
}

type MonthlyUsageRow = {
  id: string
  customer_id: string
  stable_component_key: string
  commercial_version_id: string | null
  usage_month: string
  metric: string
  quantity: number
  source: string
  status: string
  notes: string | null
  is_current: boolean
  submitted_by: string | null
  submitted_at: string
  created_at: string
}

type MonthlyEntitlementLedgerRow = {
  id: string
  customer_id: string
  stable_component_key: string
  commercial_version_id: string | null
  month: string
  metric: string
  monthly_entitlement_quantity: number
  actual_usage_quantity: number
  mug_quantity: number | null
  consumption_quantity: number
  unbilled_quantity: number
  unearned_quantity: number
  recognition_status: string
  go_live_request_id: string | null
  created_at: string
  updated_at: string
}

type UnbilledLedgerEntryRow = {
  id: string
  monthly_ledger_id: string
  customer_id: string
  stable_component_key: string
  month: string
  metric: string
  unbilled_quantity: number
  status: string
  created_at: string
  updated_at: string
}

type UnearnedLedgerEntryRow = {
  id: string
  monthly_ledger_id: string
  customer_id: string
  stable_component_key: string
  month: string
  metric: string
  unearned_quantity: number
  status: string
  created_at: string
  updated_at: string
}

type SettlementRecordRow = {
  id: string
  ledger_entry_type: string
  ledger_entry_id: string
  settlement_reference: string
  settled_quantity: number
  settlement_date: string
  settled_by: string | null
  created_at: string
}

export type {
  EntitlementSourceRow,
  EntitlementScheduleMonthRow,
  MonthlyUsageRow,
  MonthlyEntitlementLedgerRow,
  UnbilledLedgerEntryRow,
  UnearnedLedgerEntryRow,
  SettlementRecordRow,
}
