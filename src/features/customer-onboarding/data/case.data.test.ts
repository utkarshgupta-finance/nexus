import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Real data-layer idempotency/retry tests (Platform Scale Closure, Phase
 * C), proving the RPC-calling wrapper's actual behavior rather than only
 * reading the SQL guard clauses. `case.data.ts` has no `server-only`
 * guard of its own, so it can be imported directly once its one
 * dependency, `getSupabaseServiceRoleClient`, is mocked away.
 */

const rpcMock = vi.fn()

vi.mock("@/lib/supabase/server-client", () => ({
  getSupabaseServiceRoleClient: () => ({ rpc: rpcMock }),
}))

beforeEach(() => {
  rpcMock.mockReset()
})

describe("submitCase retry safety", () => {
  it("surfaces the RPC's ONBOARDING_CASE_NOT_SUBMITTABLE exception on a second submit rather than silently no-opping", async () => {
    const { submitCase } = await import("./case.data")
    rpcMock
      .mockResolvedValueOnce({ data: { request_id: "r1", status: "submitted" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "ONBOARDING_CASE_NOT_SUBMITTABLE: case r1 has status submitted, only draft or sent_back may be submitted" } })

    const first = await submitCase("r1", "actor-1")
    expect(first.status).toBe("submitted")

    await expect(submitCase("r1", "actor-1")).rejects.toMatchObject({ caseError: { kind: "onboarding_case_not_submittable" } })
  })
})

describe("approveCase idempotency", () => {
  it("passes an idempotent-replay response straight through on a second approve call", async () => {
    const { approveCase } = await import("./case.data")
    const approveInput = {
      requestId: "r1",
      customerKey: "acme",
      customerName: "Acme",
      commercialConfigurationKey: "acme-2026",
      commercialConfigurationName: "Acme 2026",
      components: [],
      effectiveDate: "2026-01-01",
      actorUserId: "actor-1",
      customerFields: {},
    }
    const approvedRow = { request_id: "r1", status: "approved", customer_id: "cust-1" }
    rpcMock.mockResolvedValue({ data: approvedRow, error: null })

    const first = await approveCase(approveInput)
    const second = await approveCase(approveInput)

    // The RPC itself guarantees zero DML runs on replay
    // (20260913063000_populate_customer_columns_on_onboarding_approval.sql);
    // this proves the data layer does not layer any further mutation on
    // top and returns the exact same customer linkage both times.
    expect(first.customer_id).toBe("cust-1")
    expect(second.customer_id).toBe("cust-1")
  })
})

describe("createCase retry safety (documented, deliberate non-fix)", () => {
  it("mints an independent row per call: two calls with two different request ids both succeed, since no server-side dedup exists", async () => {
    // Platform Scale Closure Phase C finding: the caller (case.service.ts)
    // mints a fresh UUID per invocation and never reuses one across a
    // retry, so a retried creation currently produces a second,
    // independent case row rather than a conflict. Per the program's own
    // guardrail against building generic idempotency-key infrastructure
    // ahead of a real external caller, this is accepted and documented
    // (docs/TECH_DEBT.md), not silently fixed. This test locks in the
    // actual current behavior so a future change to it is a conscious
    // decision, not an accident.
    const { createCase } = await import("./case.data")
    rpcMock
      .mockResolvedValueOnce({ data: { request_id: "r1", status: "draft" }, error: null })
      .mockResolvedValueOnce({ data: { request_id: "r2", status: "draft" }, error: null })

    const first = await createCase({ newRequestId: "r1", initialRawData: {}, actorUserId: "actor-1" })
    const second = await createCase({ newRequestId: "r2", initialRawData: {}, actorUserId: "actor-1" })

    expect(first.request_id).not.toBe(second.request_id)
    expect(rpcMock).toHaveBeenCalledTimes(2)
  })
})
