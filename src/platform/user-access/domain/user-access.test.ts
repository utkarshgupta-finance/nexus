import { describe, expect, it } from "vitest"

import { buildUserAccessEntries, attachUpdatedByLabels, labelForUserAccessEntry } from "./user-access"

describe("buildUserAccessEntries", () => {
  it("merges an unprovisioned auth user (no app_users row) safely, not as an error", () => {
    const entries = buildUserAccessEntries([{ id: "auth-1", email: "new@example.com" }], [], [], [])
    expect(entries).toEqual([
      {
        authUserId: "auth-1",
        email: "new@example.com",
        appUserId: null,
        displayName: null,
        isActive: null,
        isProvisioned: false,
        roles: [],
        teams: [],
        updatedAt: null,
        updatedBy: null,
        updatedByLabel: null,
      },
    ])
  })

  it("attaches the app_users profile and every active global role grant for a provisioned user", () => {
    const entries = buildUserAccessEntries(
      [{ id: "auth-1", email: "utkarsh@example.com" }],
      [{ id: "auth-1", is_active: true, display_name: "Utkarsh Gupta", created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-10T00:00:00.000Z", updated_by: "auth-2" }],
      [{ id: "role-1", code: "user_access_admin", name: "User Access Admin" }],
      [{ id: "grant-1", user_id: "auth-1", role_id: "role-1" }]
    )
    expect(entries[0].isProvisioned).toBe(true)
    expect(entries[0].displayName).toBe("Utkarsh Gupta")
    expect(entries[0].updatedBy).toBe("auth-2")
    expect(entries[0].roles).toEqual([{ userRoleId: "grant-1", roleId: "role-1", roleCode: "user_access_admin", roleName: "User Access Admin" }])
  })

  it("never attaches a grant referencing a role that is no longer active", () => {
    const entries = buildUserAccessEntries(
      [{ id: "auth-1", email: "utkarsh@example.com" }],
      [{ id: "auth-1", is_active: true, display_name: null, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", updated_by: null }],
      [],
      [{ id: "grant-1", user_id: "auth-1", role_id: "deactivated-role" }]
    )
    expect(entries[0].roles).toEqual([])
  })

  it("attaches every active team assignment (task Phase K), marking which one is primary", () => {
    const entries = buildUserAccessEntries(
      [{ id: "auth-1", email: "utkarsh@example.com" }],
      [{ id: "auth-1", is_active: true, display_name: null, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", updated_by: null }],
      [],
      [],
      [{ id: "team-1", code: "finance", name: "Finance", description: null, is_active: true, updated_at: "2026-09-01T00:00:00.000Z" }],
      [{ id: "grant-1", user_id: "auth-1", team_id: "team-1", is_primary: true }]
    )
    expect(entries[0].teams).toEqual([{ userTeamId: "grant-1", teamId: "team-1", teamCode: "finance", teamName: "Finance", isPrimary: true }])
  })

  it("never attaches a team grant referencing a team that no longer exists", () => {
    const entries = buildUserAccessEntries(
      [{ id: "auth-1", email: "utkarsh@example.com" }],
      [{ id: "auth-1", is_active: true, display_name: null, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", updated_by: null }],
      [],
      [],
      [],
      [{ id: "grant-1", user_id: "auth-1", team_id: "deleted-team", is_primary: false }]
    )
    expect(entries[0].teams).toEqual([])
  })
})

describe("attachUpdatedByLabels", () => {
  it("resolves each entry's updatedBy id to its label, never leaving a raw id on the final entry", () => {
    const entries = buildUserAccessEntries(
      [{ id: "auth-1", email: "utkarsh@example.com" }],
      [{ id: "auth-1", is_active: true, display_name: null, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", updated_by: "auth-2" }],
      [],
      []
    )
    const labeled = attachUpdatedByLabels(entries, new Map([["auth-2", "Utkarsh Gupta"]]))
    expect(labeled[0].updatedByLabel).toBe("Utkarsh Gupta")
  })

  it("never fabricates a label when the actor could not be resolved", () => {
    const entries = buildUserAccessEntries(
      [{ id: "auth-1", email: "utkarsh@example.com" }],
      [{ id: "auth-1", is_active: true, display_name: null, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", updated_by: null }],
      [],
      []
    )
    const labeled = attachUpdatedByLabels(entries, new Map())
    expect(labeled[0].updatedByLabel).toBeNull()
  })
})

describe("labelForUserAccessEntry", () => {
  it("prefers display_name over email", () => {
    expect(
      labelForUserAccessEntry({
        authUserId: "auth-1",
        email: "utkarsh@example.com",
        appUserId: "auth-1",
        displayName: "Utkarsh Gupta",
        isActive: true,
        isProvisioned: true,
        roles: [],
        teams: [],
        updatedAt: null,
        updatedBy: null,
        updatedByLabel: null,
      })
    ).toBe("Utkarsh Gupta")
  })

  it("falls back to email, then the raw auth user id, never blank", () => {
    expect(
      labelForUserAccessEntry({
        authUserId: "auth-1",
        email: "utkarsh@example.com",
        appUserId: null,
        displayName: null,
        isActive: null,
        isProvisioned: false,
        roles: [],
        teams: [],
        updatedAt: null,
        updatedBy: null,
        updatedByLabel: null,
      })
    ).toBe("utkarsh@example.com")
    expect(
      labelForUserAccessEntry({
        authUserId: "auth-1",
        email: null,
        appUserId: null,
        displayName: null,
        isActive: null,
        isProvisioned: false,
        roles: [],
        teams: [],
        updatedAt: null,
        updatedBy: null,
        updatedByLabel: null,
      })
    ).toBe("auth-1")
  })
})
