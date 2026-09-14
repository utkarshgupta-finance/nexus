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

/**
 * The one canonical "who did this" label resolver (permanent Actor
 * Identity rule): prefers `app_users.display_name` (an admin-maintained
 * human name, task Phase J, User Access), falling back to the Supabase
 * Auth email for a user with no display_name set yet, exactly as the
 * rule requires ("existing users without names fall back to email
 * temporarily"). This resolves the CURRENT name/email at read time, not
 * a snapshot of what it was when the action happened; a full write-time
 * snapshot (actor_display_name_snapshot/actor_email_snapshot per
 * governed action) is a larger, separately-tracked follow-up (see
 * docs/CUSTOMER_LIFECYCLE.md's Actor Identity section), not built here.
 * Every consumer that previously called `resolveActorEmails` for a
 * human-facing display should call this instead; `resolveActorEmails`
 * itself is kept only for any caller that genuinely needs the email
 * specifically (none exist as of this rule's introduction).
 */
async function resolveActorLabels(actorIds: (string | null)[]): Promise<Map<string, string | null>> {
  const uniqueIds = Array.from(new Set(actorIds.filter((id): id is string => id !== null)))
  if (uniqueIds.length === 0) return new Map()

  const supabase = getSupabaseServiceRoleClient()
  const { data: appUserRows } = await supabase.from("app_users").select("id, display_name").in("id", uniqueIds)
  const displayNameById = new Map((appUserRows ?? []).map((row) => [row.id, row.display_name as string | null]))

  const idsNeedingEmail = uniqueIds.filter((id) => !displayNameById.get(id))
  const emailById = await resolveActorEmails(idsNeedingEmail)

  return new Map(uniqueIds.map((id) => [id, displayNameById.get(id) ?? emailById.get(id) ?? null]))
}

export { resolveActorEmails, resolveActorLabels }
