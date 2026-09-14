import { formatOnboardingCaseId } from "./types"
import type { CustomerOnboardingCase } from "./types"

const CUSTOMER_LEGAL_NAME_FIELD = "customer_legal_entity_name"
const BRAND_NAME_FIELD = "brand_business_name"

/**
 * The Customer Onboarding Case API DTO (Platform Scale Program, Phase B,
 * `docs/API_INTEGRATION_ARCHITECTURE.md` §3): `caseNumber` is the real
 * Human-Friendly ID (formatted, "CO-000123"), never the raw internal
 * sequence integer; `id` is the stable internal identity a future
 * mutation would reference, never re-derived from the display id.
 */
type OnboardingCaseDto = {
  id: string
  caseNumber: string
  status: CustomerOnboardingCase["status"]
  currentStage: CustomerOnboardingCase["currentStageKey"]
  legalName: string
  brand: string | null
  revisionNumber: number
  customerId: string | null
  createdAt: string
  updatedAt: string
}

function toOnboardingCaseDto(onboardingCase: CustomerOnboardingCase): OnboardingCaseDto {
  const values = onboardingCase.currentRevision.data
  return {
    id: onboardingCase.requestId,
    caseNumber: formatOnboardingCaseId(onboardingCase.caseNumber),
    status: onboardingCase.status,
    currentStage: onboardingCase.currentStageKey,
    legalName: typeof values[CUSTOMER_LEGAL_NAME_FIELD] === "string" ? (values[CUSTOMER_LEGAL_NAME_FIELD] as string) : "",
    brand: typeof values[BRAND_NAME_FIELD] === "string" ? (values[BRAND_NAME_FIELD] as string) : null,
    revisionNumber: onboardingCase.currentRevision.revisionNumber,
    customerId: onboardingCase.customerId,
    createdAt: onboardingCase.createdAt,
    updatedAt: onboardingCase.updatedAt,
  }
}

export { toOnboardingCaseDto }
export type { OnboardingCaseDto }
