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
const userHasBusinessUnitScopedPermission = vi.fn()
const getScopedCustomerIds = vi.fn()
const getScopedBusinessUnits = vi.fn()
const userHasAnyScopedPermission = vi.fn()
vi.mock("./data/scoped-permission.data", () => ({
  userHasCustomerScopedPermission: (...args: unknown[]) => userHasCustomerScopedPermission(...args),
  userHasBusinessUnitScopedPermission: (...args: unknown[]) => userHasBusinessUnitScopedPermission(...args),
  getScopedCustomerIds: (...args: unknown[]) => getScopedCustomerIds(...args),
  getScopedBusinessUnits: (...args: unknown[]) => getScopedBusinessUnits(...args),
  userHasAnyScopedPermission: (...args: unknown[]) => userHasAnyScopedPermission(...args),
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

/**
 * PD-005 follow-up (Product Decision Closure): the business-unit-scoped
 * sibling, for Onboarding cases with no resolved customer yet, plus the
 * bulk list-filtering and page-level existence checks. Same resolution
 * order as above throughout: global grant short-circuits before any
 * scoped RPC.
 */
describe("hasPermissionForBusinessUnit", () => {
  it("returns true immediately for a global grant, without calling the scoped RPC", async () => {
    getCurrentNexusSession.mockResolvedValue(GLOBAL_SESSION)
    const { hasPermissionForBusinessUnit } = await import("./server")

    expect(await hasPermissionForBusinessUnit("commercial_configuration", "read", "india_enterprise")).toBe(true)
    expect(userHasBusinessUnitScopedPermission).not.toHaveBeenCalled()
  })

  it("falls back to the scoped RPC when the session has no global grant", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    userHasBusinessUnitScopedPermission.mockResolvedValue(true)
    const { hasPermissionForBusinessUnit } = await import("./server")

    expect(await hasPermissionForBusinessUnit("commercial_configuration", "read", "india_enterprise")).toBe(true)
    expect(userHasBusinessUnitScopedPermission).toHaveBeenCalledWith("app-2", "commercial_configuration", "read", "india_enterprise")
  })

  it("denies a user with neither a global nor a matching scoped grant", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    userHasBusinessUnitScopedPermission.mockResolvedValue(false)
    const { hasPermissionForBusinessUnit } = await import("./server")

    expect(await hasPermissionForBusinessUnit("commercial_configuration", "read", "india_enterprise")).toBe(false)
  })

  it("denies (never throws) for a non-active session", async () => {
    getCurrentNexusSession.mockResolvedValue({ status: "unauthenticated" })
    const { hasPermissionForBusinessUnit } = await import("./server")

    expect(await hasPermissionForBusinessUnit("commercial_configuration", "read", "india_enterprise")).toBe(false)
    expect(userHasBusinessUnitScopedPermission).not.toHaveBeenCalled()
  })

  it("passes a null business_unit straight through to the scoped RPC (a case with no business_unit form value yet)", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    userHasBusinessUnitScopedPermission.mockResolvedValue(false)
    const { hasPermissionForBusinessUnit } = await import("./server")

    expect(await hasPermissionForBusinessUnit("commercial_configuration", "read", null)).toBe(false)
    expect(userHasBusinessUnitScopedPermission).toHaveBeenCalledWith("app-2", "commercial_configuration", "read", null)
  })
})

describe("requirePermissionForBusinessUnit", () => {
  it("returns the session for a global grant without calling the scoped RPC", async () => {
    getCurrentNexusSession.mockResolvedValue(GLOBAL_SESSION)
    const { requirePermissionForBusinessUnit } = await import("./server")

    const session = await requirePermissionForBusinessUnit("commercial_configuration", "read", "india_enterprise")

    expect(session.appUserId).toBe("app-1")
    expect(userHasBusinessUnitScopedPermission).not.toHaveBeenCalled()
  })

  it("returns the session when only a scoped grant covers this business unit", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    userHasBusinessUnitScopedPermission.mockResolvedValue(true)
    const { requirePermissionForBusinessUnit } = await import("./server")

    const session = await requirePermissionForBusinessUnit("commercial_configuration", "read", "india_enterprise")

    expect(session.appUserId).toBe("app-2")
  })

  it("throws missing_permission when neither a global nor a matching scoped grant exists", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    userHasBusinessUnitScopedPermission.mockResolvedValue(false)
    const { requirePermissionForBusinessUnit } = await import("./server")

    await expect(requirePermissionForBusinessUnit("commercial_configuration", "read", "india_enterprise")).rejects.toMatchObject({
      reason: "missing_permission",
    })
  })

  it("throws unauthenticated before ever consulting scope, for a signed-out caller", async () => {
    getCurrentNexusSession.mockResolvedValue({ status: "unauthenticated" })
    const { requirePermissionForBusinessUnit } = await import("./server")

    await expect(requirePermissionForBusinessUnit("commercial_configuration", "read", "india_enterprise")).rejects.toMatchObject({
      reason: "unauthenticated",
    })
    expect(userHasBusinessUnitScopedPermission).not.toHaveBeenCalled()
  })
})

describe("getVisibleCustomerIds", () => {
  it("returns null (unfiltered) for a global grant, without calling the scoped RPC", async () => {
    getCurrentNexusSession.mockResolvedValue(GLOBAL_SESSION)
    const { getVisibleCustomerIds } = await import("./server")

    expect(await getVisibleCustomerIds("commercial_configuration", "read")).toBeNull()
    expect(getScopedCustomerIds).not.toHaveBeenCalled()
  })

  it("returns the scoped RPC's set for a scoped-only user", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    getScopedCustomerIds.mockResolvedValue(new Set(["cust-1"]))
    const { getVisibleCustomerIds } = await import("./server")

    const result = await getVisibleCustomerIds("commercial_configuration", "read")

    expect(result).toEqual(new Set(["cust-1"]))
    expect(getScopedCustomerIds).toHaveBeenCalledWith("app-2", "commercial_configuration", "read")
  })

  it("returns an empty set (never null) for a non-active session", async () => {
    getCurrentNexusSession.mockResolvedValue({ status: "unauthenticated" })
    const { getVisibleCustomerIds } = await import("./server")

    expect(await getVisibleCustomerIds("commercial_configuration", "read")).toEqual(new Set())
    expect(getScopedCustomerIds).not.toHaveBeenCalled()
  })
})

describe("getVisibleBusinessUnits", () => {
  it("returns null (unfiltered) for a global grant, without calling the scoped RPC", async () => {
    getCurrentNexusSession.mockResolvedValue(GLOBAL_SESSION)
    const { getVisibleBusinessUnits } = await import("./server")

    expect(await getVisibleBusinessUnits("commercial_configuration", "read")).toBeNull()
    expect(getScopedBusinessUnits).not.toHaveBeenCalled()
  })

  it("returns the scoped RPC's set for a scoped-only user", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    getScopedBusinessUnits.mockResolvedValue(new Set(["india_enterprise"]))
    const { getVisibleBusinessUnits } = await import("./server")

    const result = await getVisibleBusinessUnits("commercial_configuration", "read")

    expect(result).toEqual(new Set(["india_enterprise"]))
    expect(getScopedBusinessUnits).toHaveBeenCalledWith("app-2", "commercial_configuration", "read")
  })

  it("returns an empty set (never null) for a non-active session", async () => {
    getCurrentNexusSession.mockResolvedValue({ status: "unauthenticated" })
    const { getVisibleBusinessUnits } = await import("./server")

    expect(await getVisibleBusinessUnits("commercial_configuration", "read")).toEqual(new Set())
    expect(getScopedBusinessUnits).not.toHaveBeenCalled()
  })
})

describe("hasAnyPermission", () => {
  it("returns true immediately for a global grant, without calling the scoped RPC", async () => {
    getCurrentNexusSession.mockResolvedValue(GLOBAL_SESSION)
    const { hasAnyPermission } = await import("./server")

    expect(await hasAnyPermission("commercial_configuration", "read")).toBe(true)
    expect(userHasAnyScopedPermission).not.toHaveBeenCalled()
  })

  it("returns true when the user holds any scoped grant at all, even one matching zero current rows", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    userHasAnyScopedPermission.mockResolvedValue(true)
    const { hasAnyPermission } = await import("./server")

    expect(await hasAnyPermission("commercial_configuration", "read")).toBe(true)
    expect(userHasAnyScopedPermission).toHaveBeenCalledWith("app-2", "commercial_configuration", "read")
  })

  it("denies a user with neither a global nor any scoped grant", async () => {
    getCurrentNexusSession.mockResolvedValue(SCOPED_ONLY_SESSION)
    userHasAnyScopedPermission.mockResolvedValue(false)
    const { hasAnyPermission } = await import("./server")

    expect(await hasAnyPermission("commercial_configuration", "read")).toBe(false)
  })

  it("denies (never throws) for a non-active session", async () => {
    getCurrentNexusSession.mockResolvedValue({ status: "unauthenticated" })
    const { hasAnyPermission } = await import("./server")

    expect(await hasAnyPermission("commercial_configuration", "read")).toBe(false)
    expect(userHasAnyScopedPermission).not.toHaveBeenCalled()
  })
})
