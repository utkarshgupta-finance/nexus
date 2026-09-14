import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

/**
 * Repository for teams/user_teams (task Phase K,
 * supabase/migrations/20260916060000_team_master_foundation.sql). Plain
 * PostgREST reads plus the governed RPCs for every write, matching every
 * other platform capability's data.ts in this codebase.
 */

type TeamRow = { id: string; code: string; name: string; description: string | null; is_active: boolean; updated_at: string }

async function listTeams(): Promise<TeamRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("teams").select("id, code, name, description, is_active, updated_at").order("name", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function listActiveTeams(): Promise<TeamRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("teams")
    .select("id, code, name, description, is_active, updated_at")
    .eq("is_active", true)
    .order("name", { ascending: true })
  if (error) throw error
  return data ?? []
}

type UserTeamGrantRow = { id: string; user_id: string; team_id: string; is_primary: boolean }

/** Every currently active team assignment: the only kind the User Access list displays (task spec: historical ones stay in the database, never shown by default). */
async function listActiveUserTeamGrants(): Promise<UserTeamGrantRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("user_teams").select("id, user_id, team_id, is_primary").is("revoked_at", null)
  if (error) throw error
  return data ?? []
}

async function createTeam(code: string, name: string, description: string | null, actorUserId: string): Promise<TeamRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("create_team", { p_code: code, p_name: name, p_description: description, p_actor_user_id: actorUserId })
  if (error) throw error
  return data
}

async function setTeamActive(teamId: string, isActive: boolean, actorUserId: string): Promise<TeamRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("set_team_active", { p_team_id: teamId, p_is_active: isActive, p_actor_user_id: actorUserId })
  if (error) throw error
  return data
}

async function assignUserToTeam(userId: string, teamId: string, isPrimary: boolean, actorUserId: string): Promise<UserTeamGrantRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("assign_user_to_team", {
    p_user_id: userId,
    p_team_id: teamId,
    p_is_primary: isPrimary,
    p_actor_user_id: actorUserId,
  })
  if (error) throw error
  return data
}

async function removeUserFromTeam(userTeamId: string, actorUserId: string): Promise<UserTeamGrantRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("remove_user_from_team", { p_user_team_id: userTeamId, p_actor_user_id: actorUserId })
  if (error) throw error
  return data
}

export { listTeams, listActiveTeams, listActiveUserTeamGrants, createTeam, setTeamActive, assignUserToTeam, removeUserFromTeam }
export type { TeamRow, UserTeamGrantRow }
