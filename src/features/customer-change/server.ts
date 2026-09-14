import "server-only"

/**
 * TRUSTED, SERVER-ONLY entry point for reading Customer Change Request
 * state, mirroring src/features/customer-onboarding/server.ts's own
 * shape: read-only functions only, no mutation (mutations live in
 * ./actions.ts, behind requirePermission). Every function reachable from
 * here authenticates as service_role; the calling route is responsible
 * for its own AuthGate/`customer.read` check before rendering what these
 * return.
 */

export {
  loadChangeRequest,
  previewRequirements,
  listChangeRequestReviewQueue,
  listAllChangeRequestEntries,
  listChangeRequestsForCustomer,
  listCustomerFieldHistory,
  searchFormerCustomerNames,
  getCurrentGovernedValues,
  getChangeRequestSendBackCount,
} from "./services/change-request.service"
export type { ReviewQueueEntry } from "./services/change-request.service"
export { loadChangeRequestTimeline } from "./server/timeline"
