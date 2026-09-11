/**
 * Public surface of the Customer Onboarding feature. Form/case state is
 * local-state driven for this stage (no Supabase, no service_role
 * credential); see domain/types.ts's header for the future live-wiring
 * boundary. Geography lookups do have a server-only module
 * (server/geography.ts, reached only through /api/geography/*), never
 * re-exported here.
 */

export type {
  CustomerOnboardingStageKey,
  AppUserId,
  CustomerOnboardingCase,
  CustomerOnboardingCaseStatus,
  CustomerOnboardingRevision,
  CustomerOnboardingRevisionStatus,
  CustomerOnboardingSentBack,
  OnboardingDocumentType,
  SelectedOnboardingDocument,
} from "./domain/types"
export { CUSTOMER_ONBOARDING_STAGES, toProcessJourneyStages } from "./domain/process"
export {
  createCase,
  setCurrentStage,
  updateRevisionData,
  submitCase,
  sendBackCase,
  startNextRevision,
  approveCase,
} from "./domain/case"
export { CUSTOMER_ONBOARDING_FIELD_KEYS } from "./forms/customer-onboarding-form-definition"
