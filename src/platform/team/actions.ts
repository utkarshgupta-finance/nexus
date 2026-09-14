"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { createTeam, setTeamActive } from "./services/team.service"
import { assignUserToTeam as assignUserToTeamService, removeUserFromTeam as removeUserFromTeamService } from "./services/team.service"

/**
 * Real, database-backed Team Master mutations (task Phase K). Every
 * action derives the authenticated actor server-side via
 * `requirePermission`, gated on `team.write`, matching every other
 * governed mutation in this codebase.
 */

type TeamActionResult = { ok: true } | { ok: false; error: string }

function toActionError(error: unknown): TeamActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: "An unexpected error occurred while updating the Team Master." }
}

async function createTeamAction(code: string, name: string, description: string | null): Promise<TeamActionResult> {
  try {
    const actor = await requirePermission("team", "write")
    await createTeam(code, name, description, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

async function setTeamActiveAction(teamId: string, isActive: boolean): Promise<TeamActionResult> {
  try {
    const actor = await requirePermission("team", "write")
    await setTeamActive(teamId, isActive, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

async function assignUserToTeamAction(userId: string, teamId: string, isPrimary: boolean): Promise<TeamActionResult> {
  try {
    const actor = await requirePermission("team", "write")
    await assignUserToTeamService(userId, teamId, isPrimary, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

async function removeUserFromTeamAction(userTeamId: string): Promise<TeamActionResult> {
  try {
    const actor = await requirePermission("team", "write")
    await removeUserFromTeamService(userTeamId, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

export { createTeamAction, setTeamActiveAction, assignUserToTeamAction, removeUserFromTeamAction }
export type { TeamActionResult }
