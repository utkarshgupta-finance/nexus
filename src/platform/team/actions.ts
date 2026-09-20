"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { createTeam, setTeamActive } from "./services/team.service"
import { assignUserToTeam as assignUserToTeamService, removeUserFromTeam as removeUserFromTeamService, setPrimaryTeamMembership } from "./services/team.service"
import { TeamOperationError } from "./domain/errors"
import { checkTeamRemovalImpact } from "@/platform/approvals/server"
import type { TeamRemovalImpact } from "@/platform/approvals/server"

/**
 * Real, database-backed Team Master mutations (task Phase K). Every
 * action derives the authenticated actor server-side via
 * `requirePermission`, gated on `team.write`, matching every other
 * governed mutation in this codebase.
 */

type TeamActionResult = { ok: true } | { ok: false; error: string }

function toActionError(error: unknown, conflictMessage: string): TeamActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof TeamOperationError) {
    if (error.kind === "conflict") return { ok: false, error: conflictMessage }
    return { ok: false, error: error.message }
  }
  return { ok: false, error: "An unexpected error occurred while updating the Team Master." }
}

async function createTeamAction(code: string, name: string, description: string | null): Promise<TeamActionResult> {
  try {
    const actor = await requirePermission("team", "write")
    await createTeam(code, name, description, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error, "A team with this code already exists.")
  }
}

async function setTeamActiveAction(teamId: string, isActive: boolean): Promise<TeamActionResult> {
  try {
    const actor = await requirePermission("team", "write")
    await setTeamActive(teamId, isActive, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error, "An unexpected error occurred while updating the Team Master.")
  }
}

async function assignUserToTeamAction(userId: string, teamId: string, isPrimary: boolean): Promise<TeamActionResult> {
  try {
    const actor = await requirePermission("team", "write")
    await assignUserToTeamService(userId, teamId, isPrimary, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error, "This user is already assigned to this team.")
  }
}

async function removeUserFromTeamAction(userTeamId: string): Promise<TeamActionResult> {
  try {
    const actor = await requirePermission("team", "write")
    await removeUserFromTeamService(userTeamId, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error, "An unexpected error occurred while updating the Team Master.")
  }
}

type TeamRemovalImpactActionResult = { ok: true; impact: TeamRemovalImpact } | { ok: false; error: string }

/**
 * Read-only pre-removal check (Product Gap Closure, O-018), called
 * before `removeUserFromTeamAction` actually runs: warn but allow, never
 * silently allow and never absolutely block. Gated on the same
 * `team.write` the real removal itself requires, since this only exists
 * to inform that specific mutation, not as a general-purpose read.
 */
async function checkTeamRemovalImpactAction(userTeamId: string): Promise<TeamRemovalImpactActionResult> {
  try {
    await requirePermission("team", "write")
    const impact = await checkTeamRemovalImpact(userTeamId)
    return { ok: true, impact }
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message }
    return { ok: false, error: "An unexpected error occurred while checking this removal's impact." }
  }
}

async function setPrimaryTeamMembershipAction(userId: string, teamId: string): Promise<TeamActionResult> {
  try {
    const actor = await requirePermission("team", "write")
    await setPrimaryTeamMembership(userId, teamId, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error, "An unexpected error occurred while updating the primary team.")
  }
}

export {
  createTeamAction,
  setTeamActiveAction,
  assignUserToTeamAction,
  removeUserFromTeamAction,
  setPrimaryTeamMembershipAction,
  checkTeamRemovalImpactAction,
}
export type { TeamRemovalImpactActionResult }
export type { TeamActionResult }
