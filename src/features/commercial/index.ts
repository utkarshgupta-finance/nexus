/**
 * Public, universally-safe surface of the Commercial feature: types and
 * pure label helpers only. Safe to import from a Client Component, a
 * Server Component, or anywhere else, since nothing here touches
 * Supabase, the service_role credential, or any I/O.
 *
 * Server-only reads and writes (services, read models) live in
 * ./server.ts instead, deliberately not re-exported here, so importing
 * "@/features/commercial" can never accidentally pull the service_role
 * Supabase client into a client bundle. See ./server.ts's own header
 * comment for the trust boundary those functions still lack.
 */

export type * from "./domain/types"
export * from "./domain/labels"
export { CommercialOperationError } from "./domain/errors"
export type { CommercialError, CommercialErrorKind } from "./domain/errors"

export type {
  CommercialConfigurationOverview,
  ComponentSummary,
  CommitmentSummary,
  ChangeSummary,
  VersionSummary,
} from "./read-models/configuration-overview"

export type {
  CommercialComponentDetail,
  EarnedResultSummary,
  BillingCalculationSummary,
  ReconciliationAdjustmentSummary,
} from "./read-models/component-detail"

export type { FinanceActivityEntry } from "./read-models/finance-activity"
