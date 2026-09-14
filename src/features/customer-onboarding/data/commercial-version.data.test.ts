import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Data-layer self-approval control tests (Program 4 Hardening, Phase 1),
 * mirroring ./case.data.test.ts's own mock pattern.
 * `commercial-version.data.ts` has no `server-only` guard of its own, so
 * it can be imported directly once its one dependency,
 * `getSupabaseServiceRoleClient`, is mocked away.
 */

const rpcMock = vi.fn()

vi.mock("@/lib/supabase/server-client", () => ({
  getSupabaseServiceRoleClient: () => ({ rpc: rpcMock }),
}))

beforeEach(() => {
  rpcMock.mockReset()
})

describe("approveVersion self-approval control", () => {
  it("blocks approval when the actor is the same user who created the version", async () => {
    const { approveVersion } = await import("./commercial-version.data")
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it." },
    })

    await expect(approveVersion("r1", [], "maker-1")).rejects.toMatchObject({
      commercialVersionError: { kind: "commercial_version_self_approval_not_allowed", message: "you cannot approve your own request. Another authorized checker must review it." },
    })
  })

  it("allows approval when the actor is a different user than the creator", async () => {
    const { approveVersion } = await import("./commercial-version.data")
    rpcMock.mockResolvedValueOnce({ data: { request_id: "r1", status: "approved" }, error: null })

    const result = await approveVersion("r1", [], "checker-1")
    expect(result.status).toBe("approved")
  })
})

describe("rejectVersion self-approval control", () => {
  it("blocks rejection when the actor is the same user who created the version", async () => {
    const { rejectVersion } = await import("./commercial-version.data")
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "SELF_APPROVAL_NOT_ALLOWED: you cannot reject your own request. Another authorized checker must review it." },
    })

    await expect(rejectVersion("r1", "not good enough", "maker-1")).rejects.toMatchObject({
      commercialVersionError: { kind: "commercial_version_self_approval_not_allowed" },
    })
  })
})
