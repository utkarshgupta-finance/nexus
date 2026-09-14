import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

/**
 * Repository for the User Access module (task Phase J), reusing
 * app_users/roles/user_roles exactly as they already are
 * (supabase/migrations/20260916050000_user_access_foundation.sql): no
 * competing RBAC table, no new identity concept. `listAuthUsers` is the
 * one place this app ever calls the Supabase Auth admin listUsers API;
 * everything else here is a plain PostgREST read/RPC call through the
 * service-role client, matching every other data.ts in this codebase.
 */

type AuthUserRow = { id: string; email: string | null }

/** Capped at 200: this only ever backs an internal admin list, never a report (same reasoning every other capped operational list in this app already documents). */
async function listAuthUsers(): Promise<AuthUserRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw error
  return (data.users ?? []).map((user) => ({ id: user.id, email: user.email ?? null }))
}

type AppUserRow = {
  id: string
  is_active: boolean
  display_name: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

async function listAppUsers(): Promise<AppUserRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("app_users").select("id, is_active, display_name, created_at, updated_at, updated_by")
  if (error) throw error
  return data ?? []
}

type RoleRow = { id: string; code: string; name: string }

async function listActiveRoles(): Promise<RoleRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("roles").select("id, code, name").eq("is_active", true).order("name", { ascending: true })
  if (error) throw error
  return data ?? []
}

type UserRoleGrantRow = { id: string; user_id: string; role_id: string }

/** Every currently active, global (not resource-scoped) role grant: the only kind this module manages (task spec). */
async function listActiveGlobalUserRoleGrants(): Promise<UserRoleGrantRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("user_roles").select("id, user_id, role_id").is("scope_resource_id", null).is("revoked_at", null)
  if (error) throw error
  return data ?? []
}

async function provisionAppUser(authUserId: string, actorUserId: string): Promise<AppUserRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("provision_app_user", { p_auth_user_id: authUserId, p_actor_user_id: actorUserId })
  if (error) throw error
  return data
}

async function setAppUserActive(appUserId: string, isActive: boolean, actorUserId: string): Promise<AppUserRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("set_app_user_active", { p_app_user_id: appUserId, p_is_active: isActive, p_actor_user_id: actorUserId })
  if (error) throw error
  return data
}

async function setAppUserDisplayName(appUserId: string, displayName: string, actorUserId: string): Promise<AppUserRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("set_app_user_display_name", {
    p_app_user_id: appUserId,
    p_display_name: displayName,
    p_actor_user_id: actorUserId,
  })
  if (error) throw error
  return data
}

async function grantUserRole(userId: string, roleId: string, actorUserId: string): Promise<UserRoleGrantRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("grant_user_role", { p_user_id: userId, p_role_id: roleId, p_actor_user_id: actorUserId })
  if (error) throw error
  return data
}

async function revokeUserRole(userRoleId: string, actorUserId: string): Promise<UserRoleGrantRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("revoke_user_role", { p_user_role_id: userRoleId, p_actor_user_id: actorUserId })
  if (error) throw error
  return data
}

export {
  listAuthUsers,
  listAppUsers,
  listActiveRoles,
  listActiveGlobalUserRoleGrants,
  provisionAppUser,
  setAppUserActive,
  setAppUserDisplayName,
  grantUserRole,
  revokeUserRole,
}
export type { AuthUserRow, AppUserRow, RoleRow, UserRoleGrantRow }
