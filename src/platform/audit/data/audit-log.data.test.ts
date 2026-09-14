import { describe, expect, it, vi } from "vitest"

/**
 * Real data-layer test (Platform Scale Closure, Phase O): proves the
 * bounded-fetch-then-restore-order behavior, not only that a `.limit`
 * call exists in the source.
 */

const orderMock = vi.fn()
const limitMock = vi.fn()
const eqMock = vi.fn()
const selectMock = vi.fn()
const fromMock = vi.fn()

vi.mock("@/lib/supabase/server-client", () => ({
  getSupabaseServiceRoleClient: () => ({ from: fromMock }),
}))

describe("listAuditLogForRow", () => {
  it("fetches newest-first with a bound, then restores ascending order for callers", async () => {
    const newestFirstRows = [
      { id: "3", occurred_at: "2026-01-03T00:00:00.000Z" },
      { id: "2", occurred_at: "2026-01-02T00:00:00.000Z" },
      { id: "1", occurred_at: "2026-01-01T00:00:00.000Z" },
    ]
    limitMock.mockResolvedValue({ data: newestFirstRows, error: null })
    orderMock.mockReturnValue({ limit: limitMock })
    eqMock.mockReturnValue({ eq: eqMock, order: orderMock })
    selectMock.mockReturnValue({ eq: eqMock })
    fromMock.mockReturnValue({ select: selectMock })

    const { listAuditLogForRow } = await import("./audit-log.data")
    const rows = await listAuditLogForRow("customers", "c1")

    expect(orderMock).toHaveBeenCalledWith("occurred_at", { ascending: false })
    expect(limitMock).toHaveBeenCalledWith(500)
    expect(rows.map((row) => row.id)).toEqual(["1", "2", "3"])
  })
})
