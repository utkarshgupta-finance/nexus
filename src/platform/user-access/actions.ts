"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import {
  provisionAppUser,
  setAppUserActive,
  setAppUserDisplayName,
  grantUserRole,
  revokeUserRole,
} from "./services/user-access.service"

/**
 * Real, database-backed User Access mutations (task Phase J). Every
 * action derives the authenticated actor server-side via
 * `requirePermission`, never accepts a client-supplied actor id, and is
 * gated on `user_access.write`: the same single permission for every
 * mutation here, since provisioning, activating, naming, and role
 * assignment are all facets of one "manage user access" capability, not
 * separately-scoped actions (task spec lists them together as one
 * admin's job).
 */

type UserAccessActionResult = { ok: true } | { ok: false; error: string }

function toActionError(error: unknown): UserAccessActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: "An unexpected error occurred while updating User Access." }
}

async function provisionAppUserAction(authUserId: string): Promise<UserAccessActionResult> {
  try {
    const actor = await requirePermission("user_access", "write")
    await provisionAppUser(authUserId, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

async function setAppUserActiveAction(appUserId: string, isActive: boolean): Promise<UserAccessActionResult> {
  try {
    const actor = await requirePermission("user_access", "write")
    await setAppUserActive(appUserId, isActive, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

async function setAppUserDisplayNameAction(appUserId: string, displayName: string): Promise<UserAccessActionResult> {
  try {
    const actor = await requirePermission("user_access", "write")
    await setAppUserDisplayName(appUserId, displayName, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

async function grantUserRoleAction(userId: string, roleId: string): Promise<UserAccessActionResult> {
  try {
    const actor = await requirePermission("user_access", "write")
    await grantUserRole(userId, roleId, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

async function revokeUserRoleAction(userRoleId: string): Promise<UserAccessActionResult> {
  try {
    const actor = await requirePermission("user_access", "write")
    await revokeUserRole(userRoleId, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toActionError(error)
  }
}

export {
  provisionAppUserAction,
  setAppUserActiveAction,
  setAppUserDisplayNameAction,
  grantUserRoleAction,
  revokeUserRoleAction,
}
export type { UserAccessActionResult }
