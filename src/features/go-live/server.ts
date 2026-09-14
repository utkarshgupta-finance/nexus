import "server-only"

/**
 * TRUSTED, SERVER-ONLY entry point for reading Go Live state, mirroring
 * src/features/customer-change/server.ts's own shape: read-only
 * functions only, no mutation (mutations live in ./actions.ts, behind
 * requirePermission). Every function reachable from here authenticates
 * as service_role; the calling route is responsible for its own
 * AuthGate/`go_live.read` check before rendering what these return.
 */

export {
  getGoLiveRequestById,
  listGoLiveRequestsForCustomer,
  listGoLiveRequestsForStableComponentKeys,
  listGoLiveRequestsAwaitingReview,
  listAllGoLiveRequests,
  listGoLiveRequestsCreatedBy,
  listSendBacksForGoLiveRequest,
  resolveApprovalStepForGoLiveRequest,
  resolveGoLiveActorLabels,
} from "./services/go-live.service"
export type {
  GoLiveRequest,
  GoLiveRequestStatus,
  CustomerConfirmationStatus,
  LineItemGoLiveStatus,
  GoLiveSendBackEntry,
  GoLiveDocumentType,
  PersistedGoLiveDocumentMetadata,
} from "./domain/types"
export { deriveLineItemGoLiveStatus, currentGoLiveRequestForLineItem, formatGoLiveRequestId } from "./domain/types"
