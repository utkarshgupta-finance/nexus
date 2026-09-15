import "server-only"

import * as teamData from "../data/team.data"
import { toTeam } from "../domain/types"
import type { Team } from "../domain/types"

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

export { listTeams, listActiveTeams, createTeam, setTeamActive, assignUserToTeam, removeUserFromTeam }
