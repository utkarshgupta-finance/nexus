import type { ProcessStage } from "@/components/product/process-journey"
import type { CustomerOnboardingStageKey } from "./types"
import type { CustomerOnboardingStageStatus } from "./stage-status"

/**
 * Customer Onboarding process identity and stage metadata. Stages are
 * named for the information they collect, never for a department or
 * role: creation access is broad for any appropriately authenticated
 * Nexus user, and approval authority (Finance, Legal, eventually) is a
 * separate, later concern that does not belong in a stage label. All
 * five V1 stages are listed here in their required business order.
 */
const CUSTOMER_ONBOARDING_PROCESS_KEY = "customer_onboarding" as const

type CustomerOnboardingStageMeta = {
  key: CustomerOnboardingStageKey
  order: number
  label: string
  available: boolean
}

const CUSTOMER_ONBOARDING_STAGES: CustomerOnboardingStageMeta[] = [
  { key: "customer_details", order: 1, label: "Customer Details", available: true },
  { key: "tax_registration", order: 2, label: "Tax & Registration", available: true },
  { key: "commercial_documents", order: 3, label: "Commercial Documents", available: true },
  { key: "commercial_rate", order: 4, label: "Commercial Rate", available: true },
  { key: "agreement_approval", order: 5, label: "Agreement & Approval", available: true },
]

/**
 * Maps the static stage metadata plus a precomputed per-stage completeness
 * map onto ProcessJourney's shared complete/attention/not_started
 * vocabulary, reusing the shared component rather than building a second
 * stage indicator (src/components/product/process-journey.tsx).
 *
 * Deliberately takes `statuses` as an argument rather than deriving it
 * from `currentStageKey`/stage order: a stage's completeness comes only
 * from ./stage-status.ts's evaluation of actual field/document data (task
 * spec: "visiting a stage alone does not mark it complete"). Which stage
 * is current is purely a display concern here (bold emphasis via
 * `isCurrent`), never a gate on navigation and never a source of
 * completeness.
 */
function toProcessJourneyStages(
  currentStageKey: CustomerOnboardingStageKey,
  statuses: Record<CustomerOnboardingStageKey, CustomerOnboardingStageStatus>
): ProcessStage[] {
  return CUSTOMER_ONBOARDING_STAGES.map((stage) => ({
    id: stage.key,
    label: stage.label,
    state: statuses[stage.key],
    isCurrent: stage.key === currentStageKey,
    helperText: stage.available ? undefined : "Not yet available",
  }))
}

export { CUSTOMER_ONBOARDING_PROCESS_KEY, CUSTOMER_ONBOARDING_STAGES, toProcessJourneyStages }
export type { CustomerOnboardingStageMeta }
