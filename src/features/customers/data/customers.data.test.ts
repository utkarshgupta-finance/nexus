import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Real data-layer test (Platform Scale Closure, Phase C). This file
 * itself has no `server-only` guard (only `server.ts` barrels and
 * `*.service.ts` files do), so it can be imported directly once its one
 * dependency, `getSupabaseServiceRoleClient`, is mocked away with the
 * real Supabase client never constructed. This proves
 * `setCustomerActive` (a) calls the RPC with the exact parameter names the
 * migration declares, catching a silent rename that a `Record<string,
 * unknown>` RPC call gives no compile-time protection against, and (b)
 * passes an idempotent-replay response straight through without adding
 * any client-side re-mutation of its own.
 */

const rpcMock = vi.fn()

vi.mock("@/lib/supabase/server-client", () => ({
  getSupabaseServiceRoleClient: () => ({ rpc: rpcMock }),
}))

beforeEach(() => {
  rpcMock.mockReset()
})

describe("setCustomerActive", () => {
  it("calls set_customer_active with the exact parameter names the RPC declares", async () => {
    const { setCustomerActive } = await import("./customers.data")
    rpcMock.mockResolvedValue({ data: { id: "c1", is_active: false, row_version: 2 }, error: null })

    await setCustomerActive("c1", false, "Duplicate test record", "actor-1")

    expect(rpcMock).toHaveBeenCalledWith("set_customer_active", {
      p_customer_id: "c1",
      p_is_active: false,
      p_reason: "Duplicate test record",
      p_actor_user_id: "actor-1",
    })
  })

  it("passes an idempotent-replay response straight through unchanged on a second identical call", async () => {
    const { setCustomerActive } = await import("./customers.data")
    const alreadyInactive = { id: "c1", is_active: false, row_version: 2 }
    rpcMock.mockResolvedValue({ data: alreadyInactive, error: null })

    const first = await setCustomerActive("c1", false, "Duplicate test record", "actor-1")
    const second = await setCustomerActive("c1", false, "Duplicate test record", "actor-1")

    // The RPC itself is what guarantees row_version does not bump on replay
    // (supabase/migrations/20260914170000_fix_set_customer_active_idempotency.sql);
    // this proves the data layer does not undo that by re-deriving or
    // re-fetching a mutated row of its own.
    expect(first.row_version).toBe(2)
    expect(second.row_version).toBe(2)
    expect(rpcMock).toHaveBeenCalledTimes(2)
  })

  it("surfaces the RPC's own error rather than swallowing or retrying it", async () => {
    const { setCustomerActive } = await import("./customers.data")
    rpcMock.mockResolvedValue({ data: null, error: { message: "CUSTOMER_STATUS_REASON_REQUIRED: a reason is required" } })

    await expect(setCustomerActive("c1", false, "", "actor-1")).rejects.toThrow()
  })
})
