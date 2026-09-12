import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

/**
 * Repository for the RBAC tables (Migration 1,
 * 20260906084244_platform_core_foundation.sql, hardened into historical
 * grant records by Migration 2). Plain PostgREST reads through the
 * service-role client: `roles`/`permissions`/`role_permissions`/
 * `user_roles` are Platform Core tables with RLS denying anon/
 * authenticated all direct access (docs/DATA_ARCHITECTURE.md §12), so
 * resolving a user's permissions can only happen server-side, never from
 * a browser-authenticated client.
 *
 * Global assignments only (`scope_resource_id is null`), matching
 * docs/AUTHORIZATION_MODEL.md §5: "immediate implementation supports
 * global assignment only." A scoped assignment would need this query to
 * also consider the resource being acted on; that is documented future
 * work, not built here.
 */

type AppUserRow = {
  id: string
  is_active: boolean
}

async function getAppUserById(authUserId: string): Promise<AppUserRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("app_users").select("id, is_active").eq("id", authUserId).maybeSingle()
  if (error) throw error
  return data
}

type ActiveRoleRow = {
  id: string
  code: string
  name: string
}

/** Every currently active, globally-assigned role this user holds. */
async function getActiveGlobalRolesForUser(appUserId: string): Promise<ActiveRoleRow[]> {
  const supabase = getSupabaseServiceRoleClient()

  const { data: grants, error: grantsError } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", appUserId)
    .is("scope_resource_id", null)
    .is("revoked_at", null)
  if (grantsError) throw grantsError
  const roleIds = [...new Set((grants ?? []).map((grant) => grant.role_id as string))]
  if (roleIds.length === 0) return []

  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("id, code, name")
    .in("id", roleIds)
    .eq("is_active", true)
  if (rolesError) throw rolesError
  return roles ?? []
}

type PermissionRow = {
  resource: string
  action: string
}

/** Every currently active permission granted to any of the given active roles. */
async function getActivePermissionsForRoles(roleIds: string[]): Promise<PermissionRow[]> {
  if (roleIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()

  const { data: grants, error: grantsError } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .in("role_id", roleIds)
    .is("revoked_at", null)
  if (grantsError) throw grantsError
  const permissionIds = [...new Set((grants ?? []).map((grant) => grant.permission_id as string))]
  if (permissionIds.length === 0) return []

  const { data: permissions, error: permissionsError } = await supabase
    .from("permissions")
    .select("resource, action")
    .in("id", permissionIds)
    .eq("is_active", true)
  if (permissionsError) throw permissionsError
  return permissions ?? []
}

export { getAppUserById, getActiveGlobalRolesForUser, getActivePermissionsForRoles }
export type { AppUserRow, ActiveRoleRow, PermissionRow }
