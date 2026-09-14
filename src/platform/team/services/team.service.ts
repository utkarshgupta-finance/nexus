import "server-only"

import * as teamData from "../data/team.data"
import type { TeamRow } from "../data/team.data"

/**
 * Application service for the Team Master module (task Phase K). Thin
 * orchestration over ../data/team.data.ts, matching every other service
 * in this codebase.
 */

async function listTeams(): Promise<TeamRow[]> {
  return teamData.listTeams()
}

async function listActiveTeams(): Promise<TeamRow[]> {
  return teamData.listActiveTeams()
}

async function createTeam(code: string, name: string, description: string | null, actorUserId: string): Promise<TeamRow> {
  return teamData.createTeam(code, name, description, actorUserId)
}

async function setTeamActive(teamId: string, isActive: boolean, actorUserId: string): Promise<TeamRow> {
  return teamData.setTeamActive(teamId, isActive, actorUserId)
}

async function assignUserToTeam(userId: string, teamId: string, isPrimary: boolean, actorUserId: string): Promise<void> {
  await teamData.assignUserToTeam(userId, teamId, isPrimary, actorUserId)
}

async function removeUserFromTeam(userTeamId: string, actorUserId: string): Promise<void> {
  await teamData.removeUserFromTeam(userTeamId, actorUserId)
}

export { listTeams, listActiveTeams, createTeam, setTeamActive, assignUserToTeam, removeUserFromTeam }
