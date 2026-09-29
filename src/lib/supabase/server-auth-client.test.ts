import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const cookies = vi.fn()
vi.mock("next/headers", () => ({ cookies }))

const { hasSupabaseAuthCookie } = await import("./server-auth-client")

/**
 * PG-059: `hasSupabaseAuthCookie` is the sole signal `getCurrentNexusSession`
 * uses to distinguish "never authenticated" from "was authenticated,
 * session now expired/revoked". Covered directly here since a wrong cookie
 * name match would silently misclassify every unauthenticated visitor.
 */
describe("hasSupabaseAuthCookie", () => {
  it("returns true when a Supabase auth-token cookie (@supabase/ssr's own naming convention) is present", async () => {
    cookies.mockResolvedValue({
      getAll: () => [
        { name: "sidebar_state", value: "true" },
        { name: "sb-yoieopwlsxtsfmfukeme-auth-token", value: "..." },
      ],
    })

    expect(await hasSupabaseAuthCookie()).toBe(true)
  })

  it("returns true for a chunked auth-token cookie (large tokens split into .0/.1 suffixes)", async () => {
    cookies.mockResolvedValue({
      getAll: () => [{ name: "sb-yoieopwlsxtsfmfukeme-auth-token.0", value: "..." }],
    })

    expect(await hasSupabaseAuthCookie()).toBe(true)
  })

  it("returns false when no auth-token cookie is present at all", async () => {
    cookies.mockResolvedValue({
      getAll: () => [{ name: "sidebar_state", value: "true" }],
    })

    expect(await hasSupabaseAuthCookie()).toBe(false)
  })

  it("returns false for an unrelated cookie that merely starts with sb- but is not an auth-token", async () => {
    cookies.mockResolvedValue({
      getAll: () => [{ name: "sb-some-other-cookie", value: "..." }],
    })

    expect(await hasSupabaseAuthCookie()).toBe(false)
  })
})
