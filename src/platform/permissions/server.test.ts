import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * PD-005 (D-022, Batches 1-13 Ledger Audit product decision closure):
 * hasPermissionForCustomer/requirePermissionForCustomer resolution order.
 * A global grant always short-circuits before any scoped RPC call; a
 * scoped-only user is checked against fn_user_has_customer_scoped_permission;
 * a user with neither is denied. Mirrors case.service.test.ts's
 * server-only mocking pattern.
 */
vi.mock("server-only", () => ({}))

const getCurrentNexusSession = vi.fn()
vi.mock("@/platform/auth/server", () => ({
  getCurrentNexusSession: (...args: unknown[]) => getCurrentNexusSession(...args),
}))

const userHasCustomerScopedPermission = vi.fn()
vi.mock("./data/scoped-permission.data", () => ({
  userHasCustomerScopedPermission: (...args: unknown[]) => userHasCustomerScopedPermission(...args),
}))

const GLOBAL_SESSION = {
  status: "active" as const,
  authUserId: "auth-1",
  email: "checker@example.test",
  appUserId: "app-1",
  roles: [],
  permissions: [{ resource: "commercial_configuration", action: "read" }],
}

const SCOPED_ONLY_SESSION = {
  status: "active" as const,
  authUserId: "auth-2",
  email: "regional@example.test",
  appUserId: "app-2",
  roles: [],
  permissions: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("hasPermissionForCustomer", () => {
  it("returns true immediately for a global grant, without calling the scoped RPC", async () => {
    getCurrentNexusSession.mockResolvedValue(GLOBAL_SESSION)
    const { hasPermissionForCustomer } = await import("./server")

    const result = await hasPermissionForCustomer("commercial_configuration", "read", "cust-1")

    expect(result).toBe(true)
    expect(userHasCustomerScopedPermission).not.toHaveBeenCalled()
  })

  it("falls back to the scoped RPC when the session has no global grant, and returns its answer", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    userHasCustomerScopedPermission.mockResolvedValue(true)
    const { hasPermissionForCustomer } = await import("./server")

    const result = await hasPermissionForCustomer("commercial_configuration", "read", "cust-1")

    expect(result).toBe(true)
    expect(userHasCustomerScopedPermission).toHaveBeenCalledWith("app-2", "commercial_configuration", "read", "cust-1")
  })

  it("denies a user with neither a global nor a matching scoped grant", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    userHasCustomerScopedPermission.mockResolvedValue(false)
    const { hasPermissionForCustomer } = await import("./server")

    expect(await hasPermissionForCustomer("commercial_configuration", "read", "cust-1")).toBe(false)
  })

  it("denies (never throws) for a non-active session, without calling the scoped RPC", async () => {
    getCurrentNexusSession.mockResolvedValue({ status: "unauthenticated" })
    const { hasPermissionForCustomer } = await import("./server")

    expect(await hasPermissionForCustomer("commercial_configuration", "read", "cust-1")).toBe(false)
    expect(userHasCustomerScopedPermission).not.toHaveBeenCalled()
  })
})

describe("requirePermissionForCustomer", () => {
  it("returns the session for a global grant without calling the scoped RPC", async () => {
    getCurrentNexusSession.mockResolvedValue(GLOBAL_SESSION)
    const { requirePermissionForCustomer } = await import("./server")

    const session = await requirePermissionForCustomer("commercial_configuration", "read", "cust-1")

    expect(session.appUserId).toBe("app-1")
    expect(userHasCustomerScopedPermission).not.toHaveBeenCalled()
  })

  it("returns the session when only a scoped grant covers this customer", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    userHasCustomerScopedPermission.mockResolvedValue(true)
    const { requirePermissionForCustomer } = await import("./server")

    const session = await requirePermissionForCustomer("commercial_configuration", "read", "cust-1")

    expect(session.appUserId).toBe("app-2")
  })

  it("throws missing_permission when neither a global nor a matching scoped grant exists", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    userHasCustomerScopedPermission.mockResolvedValue(false)
    const { requirePermissionForCustomer } = await import("./server")

    await expect(requirePermissionForCustomer("commercial_configuration", "read", "cust-1")).rejects.toMatchObject({ reason: "missing_permission" })
  })

  it("throws unauthenticated before ever consulting scope, for a signed-out caller", async () => {
    getCurrentNexusSession.mockResolvedValue({ status: "unauthenticated" })
    const { requirePermissionForCustomer } = await import("./server")

    await expect(requirePermissionForCustomer("commercial_configuration", "read", "cust-1")).rejects.toMatchObject({ reason: "unauthenticated" })
    expect(userHasCustomerScopedPermission).not.toHaveBeenCalled()
  })
})
