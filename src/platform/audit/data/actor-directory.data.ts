import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

/**
 * Resolves an `app_users.id` (same UUID as `auth.users.id`,
 * docs/AUTHORIZATION_MODEL.md) to the one real identity fact Nexus has
 * for it: the Supabase Auth email. `app_users` itself deliberately holds
 * no profile fields (20260906084244_platform_core_foundation.sql: "Holds
 * no roles, permissions, or other profile fields"), so this is the only
 * honest source for "who did this" anywhere an actor id needs to render
 * as something a human can read, never a raw UUID.
 */
async function resolveActorEmails(actorIds: (string | null)[]): Promise<Map<string, string | null>> {
  const uniqueIds = Array.from(new Set(actorIds.filter((id): id is string => id !== null)))
  const supabase = getSupabaseServiceRoleClient()
  const entries = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const { data } = await supabase.auth.admin.getUserById(id)
        return [id, data.user?.email ?? null] as const
      } catch {
        return [id, null] as const
      }
    })
  )
  return new Map(entries)
}

export { resolveActorEmails }
