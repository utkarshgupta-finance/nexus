import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Data-layer self-approval control tests (Program 4 Hardening, Phase 1),
 * mirroring src/features/customer-onboarding/data/case.data.test.ts's own
 * mock pattern. `change-request.data.ts` has no `server-only` guard of
 * its own, so it can be imported directly once its one dependency,
 * `getSupabaseServiceRoleClient`, is mocked away.
 */

const rpcMock = vi.fn()

vi.mock("@/lib/supabase/server-client", () => ({
  getSupabaseServiceRoleClient: () => ({ rpc: rpcMock }),
}))

beforeEach(() => {
  rpcMock.mockReset()
})

describe("approveChangeRequest self-approval control", () => {
  it("blocks approval when the actor is the same user who created the request", async () => {
    const { approveChangeRequest } = await import("./change-request.data")
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it." },
    })

    await expect(approveChangeRequest("r1", "maker-1")).rejects.toMatchObject({
      changeError: { kind: "change_request_self_approval_not_allowed", message: "you cannot approve your own request. Another authorized checker must review it." },
    })
  })

  it("allows approval when the actor is a different user than the creator", async () => {
    const { approveChangeRequest } = await import("./change-request.data")
    rpcMock.mockResolvedValueOnce({ data: { request_id: "r1", status: "approved" }, error: null })

    const result = await approveChangeRequest("r1", "checker-1")
    expect(result.status).toBe("approved")
  })
})

describe("rejectChangeRequest self-approval control", () => {
  it("blocks rejection when the actor is the same user who created the request", async () => {
    const { rejectChangeRequest } = await import("./change-request.data")
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "SELF_APPROVAL_NOT_ALLOWED: you cannot reject your own request. Another authorized checker must review it." },
    })

    await expect(rejectChangeRequest("r1", "not good enough", "maker-1")).rejects.toMatchObject({
      changeError: { kind: "change_request_self_approval_not_allowed" },
    })
  })
})

describe("sendBackChangeRequest self-approval control", () => {
  it("blocks send-back when the actor is the same user who created the request", async () => {
    const { sendBackChangeRequest } = await import("./change-request.data")
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "SELF_APPROVAL_NOT_ALLOWED: you cannot send back your own request. Another authorized checker must review it." },
    })

    await expect(sendBackChangeRequest("r1", "missing info", "maker-1")).rejects.toMatchObject({
      changeError: { kind: "change_request_self_approval_not_allowed" },
    })
  })

  it("allows send-back when the actor is a different user than the creator", async () => {
    const { sendBackChangeRequest } = await import("./change-request.data")
    rpcMock.mockResolvedValueOnce({ data: { request_id: "r1", status: "sent_back" }, error: null })

    const result = await sendBackChangeRequest("r1", "missing info", "checker-1")
    expect(result.status).toBe("sent_back")
  })
})
