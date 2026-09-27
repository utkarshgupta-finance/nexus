import { describe, expect, it } from "vitest"

import { buildTeamMembershipEntries, labelForTeamMembershipEntry } from "./membership"

describe("buildTeamMembershipEntries", () => {
  it("excludes an unprovisioned auth user entirely (PD-009 has nothing for team.write to manage against a nonexistent app_users row)", () => {
    const entries = buildTeamMembershipEntries([{ id: "auth-1", email: "new@example.com" }], [], [], [])
    expect(entries).toEqual([])
  })

  it("includes a provisioned user with no team memberships", () => {
    const entries = buildTeamMembershipEntries(
      [{ id: "auth-1", email: "utkarsh@example.com" }],
      [{ id: "auth-1", is_active: true, display_name: "Utkarsh Gupta", created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", updated_by: null }],
      [],
      []
    )
    expect(entries).toEqual([
      { authUserId: "auth-1", email: "utkarsh@example.com", appUserId: "auth-1", displayName: "Utkarsh Gupta", isProvisioned: true, teams: [] },
    ])
  })

  it("attaches every active team assignment, marking which one is primary", () => {
    const entries = buildTeamMembershipEntries(
      [{ id: "auth-1", email: "utkarsh@example.com" }],
      [{ id: "auth-1", is_active: true, display_name: null, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", updated_by: null }],
      [{ id: "team-1", code: "finance", name: "Finance", description: null, is_active: true, updated_at: "2026-09-01T00:00:00.000Z" }],
      [{ id: "grant-1", user_id: "auth-1", team_id: "team-1", is_primary: true }]
    )
    expect(entries[0].teams).toEqual([{ userTeamId: "grant-1", teamId: "team-1", teamCode: "finance", teamName: "Finance", isPrimary: true }])
  })

  it("never attaches a team grant referencing a team that no longer exists", () => {
    const entries = buildTeamMembershipEntries(
      [{ id: "auth-1", email: "utkarsh@example.com" }],
      [{ id: "auth-1", is_active: true, display_name: null, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", updated_by: null }],
      [],
      [{ id: "grant-1", user_id: "auth-1", team_id: "deactivated-team", is_primary: false }]
    )
    expect(entries[0].teams).toEqual([])
  })

  it("carries no role-shaped field at all, by construction (least privilege: this composer never receives role data to leak)", () => {
    const entries = buildTeamMembershipEntries(
      [{ id: "auth-1", email: "utkarsh@example.com" }],
      [{ id: "auth-1", is_active: true, display_name: null, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", updated_by: null }],
      [],
      []
    )
    expect(Object.keys(entries[0])).toEqual(["authUserId", "email", "appUserId", "displayName", "isProvisioned", "teams"])
  })
})

describe("labelForTeamMembershipEntry", () => {
  it("prefers display name, falls back to email, then the raw auth id", () => {
    expect(labelForTeamMembershipEntry({ authUserId: "auth-1", email: "e@example.com", appUserId: "auth-1", displayName: "Name", isProvisioned: true, teams: [] })).toBe("Name")
    expect(labelForTeamMembershipEntry({ authUserId: "auth-1", email: "e@example.com", appUserId: "auth-1", displayName: null, isProvisioned: true, teams: [] })).toBe("e@example.com")
    expect(labelForTeamMembershipEntry({ authUserId: "auth-1", email: null, appUserId: "auth-1", displayName: null, isProvisioned: true, teams: [] })).toBe("auth-1")
  })
})
