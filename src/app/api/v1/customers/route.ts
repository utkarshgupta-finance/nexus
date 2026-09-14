import { NextResponse } from "next/server"

import { handleApiV1Request, requireApiPermission } from "@/platform/api/server"
import { listCustomerMaster } from "@/features/customers/server"
import { toCustomerDto } from "@/features/customers/domain/api-dto"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"

/**
 * GET /api/v1/customers (Platform Scale Program, Phase B): the first real
 * proof that Nexus's application services are interface-independent.
 * Returns the same customer list the UI's Customers page reads, through
 * the same `listCustomerMaster()` service, reshaped into `CustomerDto`
 * (never a raw `customers` row). See `src/platform/api/server.ts`'s own
 * header for the authorization/error/logging contract every v1 route
 * shares.
 */
export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function parseLimit(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("limit"))
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT
  return Math.min(raw, MAX_LIMIT)
}

function parseOffset(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("offset"))
  return Number.isFinite(raw) && raw >= 0 ? raw : 0
}

export async function GET(request: Request) {
  return handleApiV1Request("GET /api/v1/customers", async (correlationId) => {
    await requireApiPermission("customer", "read", correlationId)

    const { searchParams } = new URL(request.url)
    const limit = parseLimit(searchParams)
    const offset = parseOffset(searchParams)

    const entries = await listCustomerMaster()

    let snapshot
    try {
      snapshot = await loadReferenceMasterSnapshot()
    } catch {
      snapshot = emptySnapshot()
    }

    const page = entries.slice(offset, offset + limit)
    return NextResponse.json({
      data: page.map((entry) => toCustomerDto(entry.record, snapshot)),
      pagination: { limit, offset, total: entries.length },
    })
  })
}
