/**
 * Batch 5 (Teams) test fixtures: a real team_admin persona (holds
 * team.write, for every O-series admin-action journey). Same identity
 * pattern as every other seed-*-fixtures script: every identity through
 * the real Supabase Auth Admin API, never a raw table insert. Idempotent
 * and safe to re-run.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-batch5-team-fixtures.ts
 */
import { createClient } from "@supabase/supabase-js"

function randomPassword(): string {
  return `Wf-${crypto.randomUUID()}`
}

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Not connecting; nothing was written.")
    process.exitCode = 1
    return
  }
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  async function ensureAuthUser(email: string) {
    const password = randomPassword()
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nexus_test_user: true, batch5_test: true },
    })
    if (!createError) return { authUserId: created.user.id, password }

    if (!/already been registered|already exists/i.test(createError.message)) {
      throw new Error(`Failed to create ${email}: ${createError.message}`)
    }
    const { data: listed, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) throw new Error(`Failed to look up existing ${email}: ${listError.message}`)
    const existing = listed.users.find((u) => u.email === email)
    if (!existing) throw new Error(`${email} was reported as already registered but could not be found via listUsers.`)
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, { password })
    if (updateError) throw new Error(`Failed to reset password for ${email}: ${updateError.message}`)
    return { authUserId: existing.id, password }
  }

  const admin = await ensureAuthUser("wf-test.team-admin@example.test")
  const { data: appUser, error: provisionError } = await supabase.rpc("provision_app_user", {
    p_auth_user_id: admin.authUserId, p_actor_user_id: null, p_actor_context: { source: "seed-batch5-team-fixtures" },
  })
  if (provisionError) { console.error("Failed to provision team_admin persona:", provisionError.message); process.exitCode = 1; return }
  await supabase.rpc("set_app_user_display_name", { p_app_user_id: appUser.id, p_display_name: "WF-TEST Team Admin", p_actor_user_id: null, p_actor_context: { source: "seed-batch5-team-fixtures" } })

  const { data: role, error: roleError } = await supabase.from("roles").select("id").eq("code", "team_admin").single()
  if (roleError || !role) { console.error("Failed to look up team_admin role:", roleError?.message); process.exitCode = 1; return }

  const { error: grantError } = await supabase.rpc("grant_user_role", {
    p_user_id: appUser.id, p_role_id: role.id, p_actor_user_id: null, p_actor_context: { source: "seed-batch5-team-fixtures" },
  })
  if (grantError) { console.error("Failed to grant team_admin role:", grantError.message); process.exitCode = 1; return }

  console.log("\nTeam Admin persona:")
  console.log("  email:   ", "wf-test.team-admin@example.test")
  console.log("  password:", admin.password)
  console.log("  app_user_id:", appUser.id)
}

main()
