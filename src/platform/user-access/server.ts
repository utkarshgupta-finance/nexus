import "server-only"

/**
 * TRUSTED, SERVER-ONLY User Access entry point (task Phase J). Every
 * function reachable from here authenticates as service_role; the
 * calling route/action is responsible for its own `user_access.read`/
 * `user_access.write` check before rendering or mutating what these
 * return, matching every other platform capability in this codebase.
 */

export {
  listUserAccessEntries,
  listAssignableRoles,
  provisionAppUser,
  setAppUserActive,
  setAppUserDisplayName,
  grantUserRole,
  revokeUserRole,
} from "./services/user-access.service"
export type { AssignableRole } from "./services/user-access.service"
export type { UserAccessEntry, UserAccessRoleGrant } from "./domain/user-access"
export { labelForUserAccessEntry } from "./domain/user-access"
