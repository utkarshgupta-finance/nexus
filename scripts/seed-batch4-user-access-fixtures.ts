/**
 * Batch 4 (Users/Roles/Permissions) test fixtures: a real
 * user_access_admin persona (holds user_access.write, for every N-series
 * admin-action journey) and a dedicated "provision target" Supabase Auth
 * identity deliberately left unprovisioned (no app_users row), reserved
 * for N-002/N-003's live provisioning test so Batch 3's own
 * wf-test.unprovisioned persona is never disturbed. Same identity
 * pattern as every other seed-*-fixtures script: every identity through
 * the real Supabase Auth Admin API, never a raw table insert. Idempotent
 * and safe to re-run.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-batch4-user-access-fixtures.ts
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
      email, password, email_confirm: true, user_metadata: { nexus_test_user: true, batch4_test: true },
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

  // user_access_admin: provisioned, active, granted the user_access_admin role via the real governed RPCs.
  const admin = await ensureAuthUser("wf-test.user-access-admin@example.test")
  const { data: appUser, error: provisionError } = await supabase.rpc("provision_app_user", {
    p_auth_user_id: admin.authUserId, p_actor_user_id: null, p_actor_context: { source: "seed-batch4-user-access-fixtures" },
  })
  if (provisionError) { console.error("Failed to provision user_access_admin persona:", provisionError.message); process.exitCode = 1; return }
  await supabase.rpc("set_app_user_display_name", { p_app_user_id: appUser.id, p_display_name: "WF-TEST User Access Admin", p_actor_user_id: null, p_actor_context: { source: "seed-batch4-user-access-fixtures" } })

  const { data: role, error: roleError } = await supabase.from("roles").select("id").eq("code", "user_access_admin").single()
  if (roleError || !role) { console.error("Failed to look up user_access_admin role:", roleError?.message); process.exitCode = 1; return }

  const { error: grantError } = await supabase.rpc("grant_user_role", {
    p_user_id: appUser.id, p_role_id: role.id, p_actor_user_id: null, p_actor_context: { source: "seed-batch4-user-access-fixtures" },
  })
  if (grantError) { console.error("Failed to grant user_access_admin role:", grantError.message); process.exitCode = 1; return }

  console.log("\nUser Access Admin persona:")
  console.log("  email:   ", "wf-test.user-access-admin@example.test")
  console.log("  password:", admin.password)
  console.log("  app_user_id:", appUser.id)

  // Provision target: a real Supabase Auth identity, deliberately NEVER provisioned, reserved for N-002/N-003's live "Provision Access" test.
  const provisionTarget = await ensureAuthUser("wf-test.batch4-provision-target@example.test")
  console.log("\nProvision target (N-002/N-003) persona:")
  console.log("  email:   ", "wf-test.batch4-provision-target@example.test")
  console.log("  auth_user_id:", provisionTarget.authUserId)
  console.log("  (no app_users row exists for this identity, by design, until N-002/N-003 provisions it live)")
}

main()
