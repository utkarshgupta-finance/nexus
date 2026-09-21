import { NextResponse } from "next/server"

import { handleApiV1Request, requireApiPermission, jsonError } from "@/platform/api/server"
import { ApplicationError } from "@/platform/errors"
import { getOnboardingCase } from "@/features/customer-onboarding/server"
import { toOnboardingCaseDto } from "@/features/customer-onboarding/domain/api-dto"

export const dynamic = "force-dynamic"

/** GET /api/v1/onboarding/{id} (Platform Scale Program, Phase B): {id} is the stable request_id, never the display Human-Friendly ID (CO-000123), matching every other governed request type's own identity rule. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApiV1Request("GET /api/v1/onboarding/[id]", async (correlationId) => {
    const actor = await requireApiPermission("customer", "read", correlationId)

    const { id } = await params
    // PD-001 (A-036): a draft is only readable by its own creator, matching every other read path for this domain.
    const onboardingCase = await getOnboardingCase(id, actor.appUserId)
    if (!onboardingCase) {
      return jsonError(new ApplicationError("RESOURCE_NOT_FOUND", "No onboarding request found for this id.", correlationId))
    }

    return NextResponse.json({ data: toOnboardingCaseDto(onboardingCase) })
  })
}
