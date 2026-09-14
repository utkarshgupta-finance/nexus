import "server-only"

/**
 * TRUSTED, SERVER-ONLY entry point for reading Customer Onboarding Case
 * state, mirroring src/features/commercial/server.ts's own shape:
 * read-only functions only, no mutation (mutations live in ./actions.ts,
 * behind requirePermission). Every function reachable from here
 * authenticates as service_role; the calling route is responsible for its
 * own AuthGate/`customer.read` check before rendering what these return,
 * the same trust boundary commercial/server.ts already documents.
 */

export { getOnboardingCase, listOnboardingReviewQueue, listAllOnboardingEntries, getOnboardingOriginForCustomer } from "./services/case.service"
export type { ReviewQueueEntry } from "./services/case.service"
export type { OnboardingOrigin } from "./domain/types"
export { formatOnboardingCaseId } from "./domain/types"
export {
  loadVersion,
  listVersionReviewQueue,
  listAllVersionEntries,
  listVersionsForConfiguration,
  getCommercialVersionDiff,
} from "./services/commercial-version.service"
export type { ReviewQueueEntry as CommercialVersionReviewQueueEntry } from "./services/commercial-version.service"
export type { CommercialConfigurationVersion } from "./domain/commercial-version-types"
export { formatCommercialVersionId } from "./domain/commercial-version-types"
export type { CommercialRateDiff, ComponentDiff, SlabRowDiff, DesignationRowDiff, MilestoneDiff, DiffRowStatus } from "./domain/commercial-rate-diff"
export { listOnboardingDocuments } from "./services/documents.service"
export type { PersistedOnboardingDocumentMetadata, OnboardingDocumentType } from "./domain/types"
