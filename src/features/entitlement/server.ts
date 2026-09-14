import "server-only"

/**
 * TRUSTED, SERVER-ONLY entry point for the Entitlement Ledger. Every
 * function reachable from here authenticates as service_role; the
 * calling route/action is responsible for its own
 * `entitlement.read`/`usage.read`/`entitlement_settlement.read` check
 * before rendering or mutating what these return.
 */

export {
  listEntitlementSourcesForComponent,
  listScheduleMonthsForComponent,
  previewAllocationSchedule,
  listMonthlyUsageForComponent,
  listLedgerRowsForComponent,
  listUnbilledEntriesForComponent,
  listUnearnedEntriesForComponent,
  listOpenUnbilledEntriesForCustomer,
  listOpenUnearnedEntriesForCustomer,
  listSettlementRecords,
} from "./services/entitlement.service"
export type { AllocationPreview } from "./services/entitlement.service"
export { formatEntitlementSourceId } from "./domain/types"
export type {
  EntitlementSource,
  EntitlementScheduleMonth,
  MonthlyUsage,
  MonthlyEntitlementLedgerRow,
  UnbilledLedgerEntry,
  UnearnedLedgerEntry,
  SettlementRecord,
  AllocationTreatment,
} from "./domain/types"
export type { MonthlyAllocationEntry } from "./domain/allocation"
