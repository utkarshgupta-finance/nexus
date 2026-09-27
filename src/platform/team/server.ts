import "server-only"

/**
 * TRUSTED, SERVER-ONLY Team Master entry point (task Phase K). Every
 * function reachable from here authenticates as service_role; the
 * calling route/action is responsible for its own `team.read`/
 * `team.write` check before rendering or mutating what these return.
 */

export {
  listTeams,
  listActiveTeams,
  createTeam,
  setTeamActive,
  assignUserToTeam,
  removeUserFromTeam,
  setPrimaryTeamMembership,
  getActiveTeamIdsForUser,
  countActiveMembersByTeam,
  listActiveUserTeamGrants,
  listTeamMembershipEntries,
} from "./services/team.service"
export type { Team } from "./domain/types"
export type { UserTeamGrantRow } from "./data/team.data"
export type { TeamMembershipEntry, TeamMembershipGrant } from "./domain/membership"
export { labelForTeamMembershipEntry } from "./domain/membership"
