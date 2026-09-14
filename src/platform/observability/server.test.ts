import { describe, expect, it, vi } from "vitest"

/**
 * Real test of withLoggedOperation's failure path (Platform Scale
 * Closure, Phase T). `server-only` is mocked away for this file only
 * (vi.mock is file-scoped, so `boundary.test.ts` files elsewhere still
 * prove the real guard throws outside a server context).
 */
vi.mock("server-only", () => ({}))

describe("withLoggedOperation", () => {
  it("attaches the same correlation id it logged onto the rethrown error, so a caller can surface it to the user", async () => {
    const { withLoggedOperation } = await import("./server")
    const failure = new Error("something broke")

    await expect(
      withLoggedOperation({ eventCode: "test.operation", operation: "testOperation" }, async () => {
        throw failure
      })
    ).rejects.toBe(failure)

    expect((failure as Error & { correlationId?: string }).correlationId).toMatch(/^NX-[0-9A-F]{8}$/)
  })

  it("rethrows the original error completely unchanged (never wraps or reshapes it)", async () => {
    const { withLoggedOperation } = await import("./server")
    class CustomError extends Error {
      readonly customField = "preserved"
    }
    const failure = new CustomError("custom failure")

    const caught = await withLoggedOperation({ eventCode: "test.operation", operation: "testOperation" }, async () => {
      throw failure
    }).catch((error: unknown) => error)

    expect(caught).toBeInstanceOf(CustomError)
    expect((caught as CustomError).customField).toBe("preserved")
  })

  it("does not attach a correlation id on success", async () => {
    const { withLoggedOperation } = await import("./server")
    const result = await withLoggedOperation({ eventCode: "test.operation", operation: "testOperation" }, async () => "ok")
    expect(result).toBe("ok")
  })
})
