import type { AuthUserRow, AppUserRow } from "@/platform/user-access/data/user-access.data"
import type { TeamRow, UserTeamGrantRow } from "../data/team.data"

/**
 * Team Admin membership view (PD-009: `team.write` must be able to
 * manage team membership without `user_access.write`, see
 * docs/AUTHORIZATION_MODEL.md section 25). Deliberately excludes role
 * data entirely: this composer only ever sees auth identity, app_users,
 * and team grants, the same least-privilege boundary the UI surface
 * built on it enforces. Mirrors
 * `platform/user-access/domain/user-access.ts`'s team-grant shape, kept
 * as a separate type here so this module never has a reason to import
 * anything role-shaped.
 */
type TeamMembershipGrant = { userTeamId: string; teamId: string; teamCode: string; teamName: string; isPrimary: boolean }

type TeamMembershipEntry = {
  authUserId: string
  email: string | null
  appUserId: string | null
  displayName: string | null
  isProvisioned: boolean
  teams: TeamMembershipGrant[]
}

function buildTeamMembershipEntries(
  authUsers: AuthUserRow[],
  appUsers: AppUserRow[],
  teams: TeamRow[],
  teamGrants: UserTeamGrantRow[]
): TeamMembershipEntry[] {
  const appUserById = new Map(appUsers.map((row) => [row.id, row]))
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const teamGrantsByUserId = new Map<string, UserTeamGrantRow[]>()
  for (const grant of teamGrants) {
    const existing = teamGrantsByUserId.get(grant.user_id)
    if (existing) existing.push(grant)
    else teamGrantsByUserId.set(grant.user_id, [grant])
  }

  return authUsers
    .filter((authUser) => appUserById.has(authUser.id))
    .map((authUser) => {
      const appUser = appUserById.get(authUser.id) ?? null
      const userTeamGrants = teamGrantsByUserId.get(authUser.id) ?? []
      const teamGrantEntries: TeamMembershipGrant[] = userTeamGrants
        .map((grant) => {
          const team = teamById.get(grant.team_id)
          return team ? { userTeamId: grant.id, teamId: team.id, teamCode: team.code, teamName: team.name, isPrimary: grant.is_primary } : null
        })
        .filter((entry): entry is TeamMembershipGrant => entry !== null)

      return {
        authUserId: authUser.id,
        email: authUser.email,
        appUserId: appUser?.id ?? null,
        displayName: appUser?.display_name ?? null,
        isProvisioned: appUser !== null,
        teams: teamGrantEntries,
      }
    })
}

function labelForTeamMembershipEntry(entry: TeamMembershipEntry): string {
  return entry.displayName ?? entry.email ?? entry.authUserId
}

export { buildTeamMembershipEntries, labelForTeamMembershipEntry }
export type { TeamMembershipEntry, TeamMembershipGrant }
