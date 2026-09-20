import "server-only"

import * as teamData from "../data/team.data"
import { toTeam } from "../domain/types"
import type { Team } from "../domain/types"
import type { UserTeamGrantRow } from "../data/team.data"

/**
 * Application service for the Team Master module (task Phase K). Thin
 * orchestration over ../data/team.data.ts, matching every other service
 * in this codebase. Maps every raw `TeamRow` to the `Team` domain type
 * before it leaves this layer, so no snake_case column ever reaches a
 * UI component.
 */

async function listTeams(): Promise<Team[]> {
  const rows = await teamData.listTeams()
  return rows.map(toTeam)
}

async function listActiveTeams(): Promise<Team[]> {
  const rows = await teamData.listActiveTeams()
  return rows.map(toTeam)
}

async function createTeam(code: string, name: string, description: string | null, actorUserId: string): Promise<Team> {
  const row = await teamData.createTeam(code, name, description, actorUserId)
  return toTeam(row)
}

async function setTeamActive(teamId: string, isActive: boolean, actorUserId: string): Promise<Team> {
  const row = await teamData.setTeamActive(teamId, isActive, actorUserId)
  return toTeam(row)
}

async function assignUserToTeam(userId: string, teamId: string, isPrimary: boolean, actorUserId: string): Promise<void> {
  await teamData.assignUserToTeam(userId, teamId, isPrimary, actorUserId)
}

async function removeUserFromTeam(userTeamId: string, actorUserId: string): Promise<void> {
  await teamData.removeUserFromTeam(userTeamId, actorUserId)
}

/** Promotes an existing active membership to primary, demoting the user's previous primary (if any) atomically (Product Gap Closure, O-011). */
async function setPrimaryTeamMembership(userId: string, teamId: string, actorUserId: string): Promise<void> {
  await teamData.setPrimaryTeamMembership(userId, teamId, actorUserId)
}

/** Every team this user currently, actively belongs to (task: Workflow Runtime V1 Sequential Execution's My Work team-aware routing). Filters the same all-users grant list every other team read already uses, rather than adding a second query shape. */
async function getActiveTeamIdsForUser(userId: string): Promise<Set<string>> {
  const grants = await teamData.listActiveUserTeamGrants()
  return new Set(grants.filter((grant) => grant.user_id === userId).map((grant) => grant.team_id))
}

/** Active member count per team, across every team (Product Gap Closure, O-018): the same all-grants read every other team-membership query already uses, reduced client-side. Backs both the Operational Queue's "no eligible approver" signal and the pre-removal impact check, so a team dropping to zero active members is never computed two different ways. */
async function countActiveMembersByTeam(): Promise<Map<string, number>> {
  const grants = await teamData.listActiveUserTeamGrants()
  const counts = new Map<string, number>()
  for (const grant of grants) counts.set(grant.team_id, (counts.get(grant.team_id) ?? 0) + 1)
  return counts
}

/** Every currently active team membership grant, raw (Product Gap Closure, O-018): backs the pre-removal impact check, which needs to resolve a specific user_teams row id to its team_id/user_id before removal actually happens. */
async function listActiveUserTeamGrants(): Promise<UserTeamGrantRow[]> {
  return teamData.listActiveUserTeamGrants()
}

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
}
