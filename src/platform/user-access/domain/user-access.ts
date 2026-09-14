import type { AuthUserRow, AppUserRow, RoleRow, UserRoleGrantRow } from "../data/user-access.data"
import type { TeamRow, UserTeamGrantRow } from "@/platform/team/data/team.data"

/**
 * Pure composition of the User Access list (task Phase J): merges
 * Supabase Auth identity, the app_users profile (which may not exist
 * yet, see provision_app_user), and every active global role grant, so
 * the UI never has to reconcile three separate reads itself. No I/O
 * here, safe to unit test directly.
 */
type UserAccessRoleGrant = { userRoleId: string; roleId: string; roleCode: string; roleName: string }

/** Task Phase K: a user's active team memberships, same shape/idea as UserAccessRoleGrant. */
type UserAccessTeamGrant = { userTeamId: string; teamId: string; teamCode: string; teamName: string; isPrimary: boolean }

type UserAccessEntry = {
  authUserId: string
  email: string | null
  appUserId: string | null
  displayName: string | null
  isActive: boolean | null
  isProvisioned: boolean
  roles: UserAccessRoleGrant[]
  teams: UserAccessTeamGrant[]
  updatedAt: string | null
  /** Raw actor id (task Phase M); the service layer resolves this to `updatedByLabel` since that needs I/O this pure composer cannot do. */
  updatedBy: string | null
  updatedByLabel: string | null
}

function buildUserAccessEntries(
  authUsers: AuthUserRow[],
  appUsers: AppUserRow[],
  roles: RoleRow[],
  grants: UserRoleGrantRow[],
  teams: TeamRow[] = [],
  teamGrants: UserTeamGrantRow[] = []
): UserAccessEntry[] {
  const appUserById = new Map(appUsers.map((row) => [row.id, row]))
  const roleById = new Map(roles.map((role) => [role.id, role]))
  const grantsByUserId = new Map<string, UserRoleGrantRow[]>()
  for (const grant of grants) {
    const existing = grantsByUserId.get(grant.user_id)
    if (existing) existing.push(grant)
    else grantsByUserId.set(grant.user_id, [grant])
  }

  const teamById = new Map(teams.map((team) => [team.id, team]))
  const teamGrantsByUserId = new Map<string, UserTeamGrantRow[]>()
  for (const grant of teamGrants) {
    const existing = teamGrantsByUserId.get(grant.user_id)
    if (existing) existing.push(grant)
    else teamGrantsByUserId.set(grant.user_id, [grant])
  }

  return authUsers.map((authUser) => {
    const appUser = appUserById.get(authUser.id) ?? null
    const userGrants = grantsByUserId.get(authUser.id) ?? []
    const roleGrants: UserAccessRoleGrant[] = userGrants
      .map((grant) => {
        const role = roleById.get(grant.role_id)
        return role ? { userRoleId: grant.id, roleId: role.id, roleCode: role.code, roleName: role.name } : null
      })
      .filter((entry): entry is UserAccessRoleGrant => entry !== null)

    const userTeamGrants = teamGrantsByUserId.get(authUser.id) ?? []
    const teamGrantEntries: UserAccessTeamGrant[] = userTeamGrants
      .map((grant) => {
        const team = teamById.get(grant.team_id)
        return team ? { userTeamId: grant.id, teamId: team.id, teamCode: team.code, teamName: team.name, isPrimary: grant.is_primary } : null
      })
      .filter((entry): entry is UserAccessTeamGrant => entry !== null)

    return {
      authUserId: authUser.id,
      email: authUser.email,
      appUserId: appUser?.id ?? null,
      displayName: appUser?.display_name ?? null,
      isActive: appUser?.is_active ?? null,
      isProvisioned: appUser !== null,
      roles: roleGrants,
      teams: teamGrantEntries,
      updatedAt: appUser?.updated_at ?? null,
      updatedBy: appUser?.updated_by ?? null,
      updatedByLabel: null,
    }
  })
}

/** Task Phase M: attaches each entry's resolved `updatedByLabel`, given a pre-resolved id -> label map (the service layer builds this via `resolveActorLabels`, since that needs I/O this module cannot do). Pure and separately testable from the I/O that produces `actorLabels`. */
function attachUpdatedByLabels(entries: UserAccessEntry[], actorLabels: Map<string, string | null>): UserAccessEntry[] {
  return entries.map((entry) => ({
    ...entry,
    updatedByLabel: entry.updatedBy ? (actorLabels.get(entry.updatedBy) ?? null) : null,
  }))
}

/** The one display label rule this module needs for itself (never a raw email-only fallback that skips a set name): mirrors the same "prefer display_name, fall back to email" rule `resolveActorLabels` enforces everywhere else, applied here to the list's own row rather than a resolved actor id. */
function labelForUserAccessEntry(entry: UserAccessEntry): string {
  return entry.displayName ?? entry.email ?? entry.authUserId
}

export { buildUserAccessEntries, attachUpdatedByLabels, labelForUserAccessEntry }
export type { UserAccessEntry, UserAccessRoleGrant, UserAccessTeamGrant }
