import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Direct test of getCurrentNexusSession's state-transition logic (Vercel
 * session-resolution incident, 2026-09-13): every prior test of this
 * module only proved the `server-only` boundary itself
 * (./boundary.test.ts), never the actual unauthenticated/unprovisioned/
 * inactive/active/unavailable branching, which is why a real regression
 * here (the entire session pipeline collapsing to "unavailable") went
 * uncaught. `server-only` is mocked to a no-op so this file can import
 * ./server directly in a plain Vitest environment, exactly like a Next.js
 * Server Component would at runtime; the mocked dependencies below are
 * the only two things ./server.ts actually touches.
 */

vi.mock("server-only", () => ({}))

const getSupabaseServerAuthClient = vi.fn()
vi.mock("@/lib/supabase/server-auth-client", () => ({ getSupabaseServerAuthClient }))

const getAppUserById = vi.fn()
const getActiveGlobalRolesForUser = vi.fn()
const getActivePermissionsForRoles = vi.fn()
vi.mock("./data/rbac.data", () => ({ getAppUserById, getActiveGlobalRolesForUser, getActivePermissionsForRoles }))

const { getCurrentNexusSession } = await import("./server")

function fakeSupabaseClient(getUserImpl: () => Promise<{ data: { user: unknown } }>) {
  return { auth: { getUser: getUserImpl } }
}

describe("getCurrentNexusSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("missing Supabase Auth env (AUTH_CONFIG_MISSING) resolves to unavailable, never throws", async () => {
    getSupabaseServerAuthClient.mockRejectedValue(new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const session = await getCurrentNexusSession()

    expect(session).toEqual({ status: "unavailable" })
    expect(errorSpy).toHaveBeenCalledWith("[auth] AUTH_CONFIG_MISSING", expect.stringContaining("NEXT_PUBLIC_SUPABASE_URL"))
    errorSpy.mockRestore()
  })

  it("configured env but no session (no auth cookie) resolves to unauthenticated, never unavailable", async () => {
    getSupabaseServerAuthClient.mockResolvedValue(fakeSupabaseClient(async () => ({ data: { user: null } })))

    const session = await getCurrentNexusSession()

    expect(session).toEqual({ status: "unauthenticated" })
  })

  it("a Supabase Auth provider failure (AUTH_PROVIDER_ERROR) resolves to unavailable, not unauthenticated", async () => {
    getSupabaseServerAuthClient.mockResolvedValue(
      fakeSupabaseClient(async () => {
        throw new Error("fetch failed")
      })
    )
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const session = await getCurrentNexusSession()

    expect(session).toEqual({ status: "unavailable" })
    expect(errorSpy).toHaveBeenCalledWith("[auth] AUTH_PROVIDER_ERROR", "fetch failed")
    errorSpy.mockRestore()
  })

  it("valid session with no app_users row resolves to unprovisioned", async () => {
    getSupabaseServerAuthClient.mockResolvedValue(
      fakeSupabaseClient(async () => ({ data: { user: { id: "auth-1", email: "someone@example.com" } } }))
    )
    getAppUserById.mockResolvedValue(null)

    const session = await getCurrentNexusSession()

    expect(session).toEqual({ status: "unprovisioned", authUserId: "auth-1", email: "someone@example.com" })
  })

  it("an app_users row with is_active = false resolves to inactive", async () => {
    getSupabaseServerAuthClient.mockResolvedValue(fakeSupabaseClient(async () => ({ data: { user: { id: "auth-1", email: "x@example.com" } } })))
    getAppUserById.mockResolvedValue({ id: "app-1", is_active: false })

    const session = await getCurrentNexusSession()

    expect(session).toEqual({ status: "inactive", authUserId: "auth-1", email: "x@example.com", appUserId: "app-1" })
  })

  it("an active, mapped app_users row resolves to active with its real roles and permissions", async () => {
    getSupabaseServerAuthClient.mockResolvedValue(fakeSupabaseClient(async () => ({ data: { user: { id: "auth-1", email: "x@example.com" } } })))
    getAppUserById.mockResolvedValue({ id: "app-1", is_active: true })
    getActiveGlobalRolesForUser.mockResolvedValue([{ id: "role-1", code: "commercial_configuration_viewer", name: "Commercial Configuration Viewer" }])
    getActivePermissionsForRoles.mockResolvedValue([{ resource: "commercial_configuration", action: "read" }])

    const session = await getCurrentNexusSession()

    expect(session).toEqual({
      status: "active",
      authUserId: "auth-1",
      email: "x@example.com",
      appUserId: "app-1",
      roles: [{ code: "commercial_configuration_viewer", name: "Commercial Configuration Viewer" }],
      permissions: [{ resource: "commercial_configuration", action: "read" }],
    })
  })

  it("an active user with zero permissions is still a valid active session, not unavailable", async () => {
    getSupabaseServerAuthClient.mockResolvedValue(fakeSupabaseClient(async () => ({ data: { user: { id: "auth-1", email: "x@example.com" } } })))
    getAppUserById.mockResolvedValue({ id: "app-1", is_active: true })
    getActiveGlobalRolesForUser.mockResolvedValue([])
    getActivePermissionsForRoles.mockResolvedValue([])

    const session = await getCurrentNexusSession()

    expect(session.status).toBe("active")
  })

  it("an RBAC data-layer failure (AUTH_RBAC_LOOKUP_FAILED) resolves to unavailable, never propagates the exception", async () => {
    getSupabaseServerAuthClient.mockResolvedValue(fakeSupabaseClient(async () => ({ data: { user: { id: "auth-1", email: "x@example.com" } } })))
    getAppUserById.mockRejectedValue(new Error("connection terminated"))
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const session = await getCurrentNexusSession()

    expect(session).toEqual({ status: "unavailable" })
    expect(errorSpy).toHaveBeenCalledWith("[auth] AUTH_RBAC_LOOKUP_FAILED", "connection terminated")
    errorSpy.mockRestore()
  })
})
