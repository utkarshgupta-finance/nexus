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

export { getOnboardingCase, listOnboardingReviewQueue } from "./services/case.service"
export type { ReviewQueueEntry } from "./services/case.service"
