import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Real data-layer test for the permanent Actor Identity rule's resolver:
 * proves `resolveActorLabels` actually prefers `app_users.display_name`
 * over the Supabase Auth email, and only falls back to the email lookup
 * for a user with no display_name set, rather than only reading the SQL
 * comment describing that behavior.
 */

const fromMock = vi.fn()
const getUserByIdMock = vi.fn()

vi.mock("@/lib/supabase/server-client", () => ({
  getSupabaseServiceRoleClient: () => ({
    from: fromMock,
    auth: { admin: { getUserById: getUserByIdMock } },
  }),
}))

beforeEach(() => {
  fromMock.mockReset()
  getUserByIdMock.mockReset()
})

describe("resolveActorLabels", () => {
  it("prefers a set display_name over the Supabase Auth email", async () => {
    const { resolveActorLabels } = await import("./actor-directory.data")
    fromMock.mockReturnValue({
      select: () => ({
        in: () => Promise.resolve({ data: [{ id: "user-1", display_name: "Utkarsh Gupta" }] }),
      }),
    })

    const labels = await resolveActorLabels(["user-1"])

    expect(labels.get("user-1")).toBe("Utkarsh Gupta")
    expect(getUserByIdMock).not.toHaveBeenCalled()
  })

  it("falls back to the Supabase Auth email when display_name has never been set", async () => {
    const { resolveActorLabels } = await import("./actor-directory.data")
    fromMock.mockReturnValue({
      select: () => ({
        in: () => Promise.resolve({ data: [{ id: "user-2", display_name: null }] }),
      }),
    })
    getUserByIdMock.mockResolvedValue({ data: { user: { email: "user2@example.com" } } })

    const labels = await resolveActorLabels(["user-2"])

    expect(labels.get("user-2")).toBe("user2@example.com")
    expect(getUserByIdMock).toHaveBeenCalledWith("user-2")
  })

  it("never fabricates a label when neither a display_name nor an email can be resolved", async () => {
    const { resolveActorLabels } = await import("./actor-directory.data")
    fromMock.mockReturnValue({
      select: () => ({
        in: () => Promise.resolve({ data: [] }),
      }),
    })
    getUserByIdMock.mockRejectedValue(new Error("not found"))

    const labels = await resolveActorLabels(["user-3"])

    expect(labels.get("user-3")).toBeNull()
  })

  it("returns an empty map for an all-null actor id list without any lookup", async () => {
    const { resolveActorLabels } = await import("./actor-directory.data")
    const labels = await resolveActorLabels([null, null])
    expect(labels.size).toBe(0)
    expect(fromMock).not.toHaveBeenCalled()
  })
})
