import type { ProcessStage } from "@/components/product/process-journey"
import type { CustomerOnboardingStageKey } from "./types"

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
 * Maps the static stage metadata onto ProcessJourney's own generic
 * {completed, current, upcoming} vocabulary, reusing the shared component
 * rather than building a second stage indicator
 * (src/components/product/process-journey.tsx).
 */
function toProcessJourneyStages(currentStageKey: CustomerOnboardingStageKey): ProcessStage[] {
  const currentOrder = CUSTOMER_ONBOARDING_STAGES.find((stage) => stage.key === currentStageKey)?.order ?? 0

  return CUSTOMER_ONBOARDING_STAGES.map((stage) => ({
    id: stage.key,
    label: stage.label,
    state: stage.order < currentOrder ? "completed" : stage.order === currentOrder ? "current" : "upcoming",
    helperText: stage.available ? undefined : "Not yet available",
  }))
}

export { CUSTOMER_ONBOARDING_PROCESS_KEY, CUSTOMER_ONBOARDING_STAGES, toProcessJourneyStages }
export type { CustomerOnboardingStageMeta }
