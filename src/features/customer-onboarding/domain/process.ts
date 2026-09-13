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

/** True only for the very first stage (order 1): the bottom footer never renders a Previous button here. */
function isFirstOnboardingStage(order: number): boolean {
  return order === 1
}

/** True only for the last stage: the bottom footer shows Submit instead of Next here. */
function isLastOnboardingStage(order: number): boolean {
  return order === CUSTOMER_ONBOARDING_STAGES.length
}

/**
 * The one lookup both the bottom footer's Previous/Next buttons and the
 * stage capsules use to find the adjacent stage by order (Customer
 * Lifecycle V1 UX pass, defect §2: every stage needs consistent
 * Previous/Save Draft/Next|Submit navigation). Returns null past either
 * end, never wrapping around.
 */
function adjacentOnboardingStage(order: number, direction: "previous" | "next"): CustomerOnboardingStageMeta | null {
  const targetOrder = direction === "previous" ? order - 1 : order + 1
  return CUSTOMER_ONBOARDING_STAGES.find((stage) => stage.order === targetOrder) ?? null
}

export {
  CUSTOMER_ONBOARDING_PROCESS_KEY,
  CUSTOMER_ONBOARDING_STAGES,
  toProcessJourneyStages,
  isFirstOnboardingStage,
  isLastOnboardingStage,
  adjacentOnboardingStage,
}
export type { CustomerOnboardingStageMeta }
