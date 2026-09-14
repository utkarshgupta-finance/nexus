import { NextResponse } from "next/server"

import { handleApiV1Request, requireApiPermission, jsonError } from "@/platform/api/server"
import { ApplicationError } from "@/platform/errors"
import { getCustomerById } from "@/features/customers/server"
import { toCustomerMasterRecord } from "@/features/customers/domain/mappers"
import { toCustomerDto } from "@/features/customers/domain/api-dto"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"

export const dynamic = "force-dynamic"

/** GET /api/v1/customers/{id} (Platform Scale Program, Phase B): fetches by Nexus's own stable id, never by a display/former value. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApiV1Request("GET /api/v1/customers/[id]", async (correlationId) => {
    await requireApiPermission("customer", "read", correlationId)

    const { id } = await params
    const row = await getCustomerById(id)
    if (!row) {
      return jsonError(new ApplicationError("RESOURCE_NOT_FOUND", "No customer found for this id.", correlationId))
    }

    let snapshot
    try {
      snapshot = await loadReferenceMasterSnapshot()
    } catch {
      snapshot = emptySnapshot()
    }

    return NextResponse.json({ data: toCustomerDto(toCustomerMasterRecord(row), snapshot) })
  })
}
