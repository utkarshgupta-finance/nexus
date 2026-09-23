/**
 * Retires the original wf-test.* and nexus.e2e.* fictional personas from
 * the Workflow Runtime V1 / Manual UX journey program. Their passwords were
 * lost (no durable credential store exists, by design), which made them
 * unusable for further manual browser testing. Rather than deriving or
 * resetting a password to reuse them (a credential path this program
 * deliberately never takes), they are retired: interactive login removed,
 * active role/team grants revoked, the application identity marked
 * inactive. Historical identity is preserved unconditionally: the
 * app_users row, its display_name, and every row that references it
 * (created_by/updated_by, workflow_node_transitions.actor_user_id,
 * audit_log.actor_user_id, and similar) are never touched. app_users.id
 * has no foreign key to auth.users.id, so deleting the auth login does
 * not cascade into any of this history.
 *
 * This script never creates, prints, or otherwise handles a password. It
 * only revokes and deletes; every action it takes is safe for the agent
 * itself to run and read the output of, unlike a persona-creation script.
 *
 * Safety: operates ONLY on the explicit RETIRE_EMAILS allowlist below (the
 * exact 37 personas reviewed in the OLD TEST PERSONA INVENTORY). Refuses
 * to run at all if EXCLUDE_EMAILS overlaps the allowlist, or if the
 * allowlist's length is not exactly 37. Defaults to a dry run (no writes);
 * pass --execute to actually mutate.
 *
 * Usage (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
 *
 *   npx tsx --env-file=.env.local scripts/retire-old-test-personas.ts             # dry run
 *   npx tsx --env-file=.env.local scripts/retire-old-test-personas.ts --execute   # applies it
 */

import { createClient } from "@supabase/supabase-js"

const RETIRE_EMAILS = [
  "wf-test.entitlement-writer-settlement-reader@example.test",
  "wf-test.usage-writer-no-finalize@example.test",
  "wf-test.entitlement-reader@example.test",
  "wf-test.pd005-scoped-viewer@example.test",
  "wf-test.finance-head@example.test",
  "wf-test.bu-head@example.test",
  "wf-test.lifecycle-admin@example.test",
  "wf-test.leadership-approver-b@example.test",
  "gap-closure-usage-reader@example.test",
  "gap-closure-subject-54ce0958@example.test",
  "gap-closure-admin-54ce0958@example.test",
  "gap-closure-subject@example.test",
  "gap-closure-admin@example.test",
  "wf-test.o019-multiteam@example.test",
  "wf-test.batch6-o025-subject-1789611528651@example.test",
  "wf-test.refmaster-admin@example.test",
  "wf-test.batch5-n025-subject-1789608391407@example.test",
  "wf-test.batch5-o011-subject-1789607229864@example.test",
  "wf-test.batch5-o-subject-1789607181525@example.test",
  "wf-test.team-admin@example.test",
  "wf-test.batch4-n007-throwaway-admin-1789604624074@example.test",
  "wf-test.batch4-n-subject-1789604582374@example.test",
  "wf-test.batch4-provision-target@example.test",
  "wf-test.user-access-admin@example.test",
  "wf-test.inactive@example.test",
  "wf-test.workflow-viewer@example.test",
  "wf-test.workflow-editor@example.test",
  "wf-test.workflow-admin@example.test",
  "wf-test.cs-checker@example.test",
  "wf-test.leadership-approver@example.test",
  "wf-test.finance-checker-b@example.test",
  "wf-test.restricted@example.test",
  "wf-test.legal-checker@example.test",
  "wf-test.finance-checker@example.test",
  "wf-test.maker@example.test",
  "nexus.e2e.checker@example.test",
  "nexus.e2e.maker@example.test",
] as const

const EXPECTED_COUNT = 37

// The real admin account's email is never hardcoded in this public repo.
// Set NEXUS_ADMIN_EMAIL in your own .env.local (gitignored) before running.
const ADMIN_EMAIL = process.env.NEXUS_ADMIN_EMAIL
const EXCLUDE_EMAILS = [ADMIN_EMAIL, "system-seed@nexus.internal"].filter((e): e is string => Boolean(e))

async function main() {
  const isExecute = process.argv.includes("--execute")

  if (!ADMIN_EMAIL) {
    console.error("NEXUS_ADMIN_EMAIL must be set in the environment (your own real admin email, used only to exclude it and to attribute the retirement actions). Not connecting; nothing was retired.")
    process.exitCode = 1
    return
  }

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment. Not connecting; nothing was retired.")
    process.exitCode = 1
    return
  }

  // Hard safety gates before any Supabase call is even made.
  if (RETIRE_EMAILS.length !== EXPECTED_COUNT) {
    console.error(`SAFETY ABORT: allowlist has ${RETIRE_EMAILS.length} entries, expected exactly ${EXPECTED_COUNT}. Refusing to run.`)
    process.exitCode = 1
    return
  }
  const overlap = RETIRE_EMAILS.filter((e) => (EXCLUDE_EMAILS as readonly string[]).includes(e))
  if (overlap.length > 0) {
    console.error(`SAFETY ABORT: allowlist contains excluded account(s): ${overlap.join(", ")}. Refusing to run.`)
    process.exitCode = 1
    return
  }
  const uniqueCheck = new Set(RETIRE_EMAILS)
  if (uniqueCheck.size !== RETIRE_EMAILS.length) {
    console.error("SAFETY ABORT: allowlist contains duplicate entries. Refusing to run.")
    process.exitCode = 1
    return
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) {
    console.error("Failed to list auth users:", listError.message)
    process.exitCode = 1
    return
  }

  const targets = RETIRE_EMAILS.map((email) => ({ email, authUser: listed.users.find((u) => u.email === email) }))
  const found = targets.filter((t) => t.authUser)
  const notFound = targets.filter((t) => !t.authUser)

  console.log(`\n${isExecute ? "EXECUTE" : "DRY RUN"}: ${RETIRE_EMAILS.length} personas on the reviewed allowlist.`)
  console.log(`  Excluded (never touched): ${EXCLUDE_EMAILS.join(", ")}`)
  console.log(`  Found in auth.users: ${found.length}`)
  console.log(`  Already absent (skip): ${notFound.length}${notFound.length ? " -> " + notFound.map((t) => t.email).join(", ") : ""}\n`)

  for (const excluded of EXCLUDE_EMAILS) {
    const stillThere = listed.users.find((u) => u.email === excluded)
    console.log(`  CHECK excluded account untouched by this script: ${excluded} -> ${stillThere ? "present in auth.users (expected, not in allowlist so never targeted)" : "not found via listUsers (unexpected, verify separately)"}`)
  }

  let totalRoles = 0
  let totalTeams = 0
  const plan: { email: string; authId: string; roleIds: string[]; teamIds: string[] }[] = []

  for (const { email, authUser } of found) {
    const { data: activeRoles } = await supabase.from("user_roles").select("id").eq("user_id", authUser!.id).is("revoked_at", null)
    const { data: activeTeams } = await supabase.from("user_teams").select("id").eq("user_id", authUser!.id).is("revoked_at", null)
    const roleIds = (activeRoles ?? []).map((r) => r.id as string)
    const teamIds = (activeTeams ?? []).map((t) => t.id as string)
    totalRoles += roleIds.length
    totalTeams += teamIds.length
    plan.push({ email, authId: authUser!.id, roleIds, teamIds })
    console.log(`  TARGET  ${email}  active roles: ${roleIds.length}, active teams: ${teamIds.length}, auth login: will be deleted, app_users row: will be deactivated (preserved)`)
  }

  console.log(`\nTotals: ${found.length} auth identities to delete, ${totalRoles} role grants to revoke, ${totalTeams} team memberships to revoke, ${found.length} app_users rows to deactivate (never deleted).`)

  if (!isExecute) {
    console.log("\nDry run only. Nothing was changed. Re-run with --execute to apply.")
    return
  }

  const actorAuth = listed.users.find((u) => u.email === ADMIN_EMAIL)
  if (!actorAuth) {
    console.error(`Actor account (NEXUS_ADMIN_EMAIL) not found via listUsers; cannot attribute the retirement actions.`)
    process.exitCode = 1
    return
  }
  const { data: actorAppUser, error: actorError } = await supabase.from("app_users").select("id").eq("id", actorAuth.id).single()
  if (actorError || !actorAppUser) {
    console.error("Failed to resolve actor app_users row:", actorError?.message)
    process.exitCode = 1
    return
  }
  const actorUserId = actorAppUser.id as string

  console.log("\nExecuting...\n")

  for (const item of plan) {
    for (const roleId of item.roleIds) {
      const { error } = await supabase.rpc("revoke_user_role", { p_user_role_id: roleId, p_actor_user_id: actorUserId })
      if (error) console.error(`  ${item.email}: failed to revoke role grant ${roleId}:`, error.message)
    }
    for (const teamId of item.teamIds) {
      const { error } = await supabase.rpc("remove_user_from_team", { p_user_team_id: teamId, p_actor_user_id: actorUserId })
      if (error) console.error(`  ${item.email}: failed to revoke team membership ${teamId}:`, error.message)
    }
    const { error: deactivateError } = await supabase.rpc("set_app_user_active", {
      p_app_user_id: item.authId,
      p_is_active: false,
      p_actor_user_id: actorUserId,
    })
    if (deactivateError) console.error(`  ${item.email}: failed to deactivate app_users row:`, deactivateError.message)

    const { error: deleteError } = await supabase.auth.admin.deleteUser(item.authId)
    if (deleteError) {
      console.error(`  ${item.email}: failed to delete auth login:`, deleteError.message)
      continue
    }
    console.log(`RETIRED  ${item.email}  (roles revoked: ${item.roleIds.length}, teams revoked: ${item.teamIds.length}, auth login deleted, app_users row and history preserved)`)
  }
}

main()
