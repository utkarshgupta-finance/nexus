import { NextResponse } from "next/server"

import { handleApiV1Request, requireApiPermissionForCustomer, requireApiPermissionForBusinessUnit, jsonError } from "@/platform/api/server"
import { ApplicationError } from "@/platform/errors"
import { isValidUuid } from "@/lib/uuid"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { getOnboardingCase } from "@/features/customer-onboarding/server"
import { toOnboardingCaseDto } from "@/features/customer-onboarding/domain/api-dto"

export const dynamic = "force-dynamic"

/** GET /api/v1/onboarding/{id} (Platform Scale Program, Phase B): {id} is the stable request_id, never the display Human-Friendly ID (CO-000123), matching every other governed request type's own identity rule. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApiV1Request("GET /api/v1/onboarding/[id]", async (correlationId) => {
    const session = await getCurrentNexusSession()
    const actorUserId = session.status === "active" ? session.appUserId : ""

    const { id } = await params
    // S-024 (Batch 24, defect found and fixed): the display Human-Friendly ID
    // (CO-000123) is not a valid uuid, so it must resolve as not-found here
    // exactly like a genuinely nonexistent stable id, matching the S-013 fix
    // already applied to every browser detail route (see src/lib/uuid.ts).
    // Without this check, Postgres rejects the non-uuid string before any
    // application code runs, surfacing as a raw 500 instead of the
    // documented error contract.
    if (!isValidUuid(id)) {
      return jsonError(new ApplicationError("RESOURCE_NOT_FOUND", "No onboarding request found for this id.", correlationId))
    }
    // PD-001 (A-036): a draft is only readable by its own creator, matching every other read path for this domain.
    const onboardingCase = await getOnboardingCase(id, actorUserId)
    if (!onboardingCase) {
      return jsonError(new ApplicationError("RESOURCE_NOT_FOUND", "No onboarding request found for this id.", correlationId))
    }

    // PD-005 follow-up (Product Decision Closure): this direct-ID read
    // must be blocked outside scope exactly like the browser route at
    // /reviews/[requestId], scoped by the resolved customer once
    // approval has created one, or by the case's own business_unit form
    // field before that.
    if (onboardingCase.customerId) {
      await requireApiPermissionForCustomer("customer", "read", onboardingCase.customerId, correlationId)
    } else {
      const businessUnit = (onboardingCase.currentRevision.data["business_unit"] as string | undefined) ?? null
      await requireApiPermissionForBusinessUnit("customer", "read", businessUnit, correlationId)
    }

    return NextResponse.json({ data: toOnboardingCaseDto(onboardingCase) })
  })
}
