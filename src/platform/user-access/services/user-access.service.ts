import "server-only"

import * as userAccessData from "../data/user-access.data"
import * as teamData from "@/platform/team/data/team.data"
import { buildUserAccessEntries } from "../domain/user-access"
import type { UserAccessEntry } from "../domain/user-access"

/**
 * Application service for the User Access module (task Phase J). Thin
 * orchestration over ../data/user-access.data.ts, matching every other
 * service in this codebase: no business logic beyond composing already-
 * governed reads/RPC calls. Also reads Team Master data (task Phase K,
 * @/platform/team/data/team.data.ts) so the list can show each user's
 * team memberships; this is a platform-to-platform read (both are
 * platform capabilities, an already-established pattern, e.g.
 * platform/approvals reading platform/audit), never a feature import.
 */

async function listUserAccessEntries(): Promise<UserAccessEntry[]> {
  const [authUsers, appUsers, roles, grants, teams, teamGrants] = await Promise.all([
    userAccessData.listAuthUsers(),
    userAccessData.listAppUsers(),
    userAccessData.listActiveRoles(),
    userAccessData.listActiveGlobalUserRoleGrants(),
    teamData.listActiveTeams(),
    teamData.listActiveUserTeamGrants(),
  ])
  return buildUserAccessEntries(authUsers, appUsers, roles, grants, teams, teamGrants)
}

type AssignableRole = { id: string; code: string; name: string }

async function listAssignableRoles(): Promise<AssignableRole[]> {
  return userAccessData.listActiveRoles()
}

async function provisionAppUser(authUserId: string, actorUserId: string): Promise<void> {
  await userAccessData.provisionAppUser(authUserId, actorUserId)
}

async function setAppUserActive(appUserId: string, isActive: boolean, actorUserId: string): Promise<void> {
  await userAccessData.setAppUserActive(appUserId, isActive, actorUserId)
}

async function setAppUserDisplayName(appUserId: string, displayName: string, actorUserId: string): Promise<void> {
  await userAccessData.setAppUserDisplayName(appUserId, displayName, actorUserId)
}

async function grantUserRole(userId: string, roleId: string, actorUserId: string): Promise<void> {
  await userAccessData.grantUserRole(userId, roleId, actorUserId)
}

async function revokeUserRole(userRoleId: string, actorUserId: string): Promise<void> {
  await userAccessData.revokeUserRole(userRoleId, actorUserId)
}

export {
  listUserAccessEntries,
  listAssignableRoles,
  provisionAppUser,
  setAppUserActive,
  setAppUserDisplayName,
  grantUserRole,
  revokeUserRole,
}
export type { AssignableRole }
