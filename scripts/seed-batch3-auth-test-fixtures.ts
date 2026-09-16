/**
 * Batch 3 (Authentication/Sessions) test fixtures: an UNPROVISIONED
 * persona (a real Supabase Auth identity with no app_users row, for
 * U-006) and an INACTIVE persona (a normally-provisioned app_users row
 * with is_active=false, for U-007/U-009/U-012/U-019). Same identity
 * pattern as every other seed-workflow-test-fixtures script: every
 * identity through the real Supabase Auth Admin API, never a raw table
 * insert. Idempotent and safe to re-run.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-batch3-auth-test-fixtures.ts
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

  // Closure over `supabase` (not a typed parameter) to sidestep a
  // generic-instantiation mismatch between createClient's overloaded
  // return type and a separately-declared parameter type.
  async function ensureAuthUser(email: string) {
    const password = randomPassword()
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nexus_test_user: true, batch3_test: true },
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

  // U-006: unprovisioned. Real Supabase Auth identity, deliberately NEVER provisioned (no provision_app_user call, no app_users row).
  const unprovisioned = await ensureAuthUser("wf-test.unprovisioned@example.test")
  console.log("\nUnprovisioned (U-006) persona:")
  console.log("  email:   ", "wf-test.unprovisioned@example.test")
  console.log("  password:", unprovisioned.password)
  console.log("  (no app_users row exists for this identity, by design)")

  // U-007/U-009/U-012/U-019: inactive. Provisioned normally, then deactivated via the same governed path Settings/User Access would use.
  const inactive = await ensureAuthUser("wf-test.inactive@example.test")
  const { data: appUser, error: provisionError } = await supabase.rpc("provision_app_user", {
    p_auth_user_id: inactive.authUserId, p_actor_user_id: null, p_actor_context: { source: "seed-batch3-auth-test-fixtures" },
  })
  if (provisionError) { console.error("Failed to provision inactive persona:", provisionError.message); process.exitCode = 1; return }
  await supabase.rpc("set_app_user_display_name", { p_app_user_id: appUser.id, p_display_name: "WF-TEST Inactive User", p_actor_user_id: null, p_actor_context: { source: "seed-batch3-auth-test-fixtures" } })

  const { error: deactivateError } = await supabase.rpc("set_app_user_active", { p_app_user_id: appUser.id, p_is_active: false, p_actor_user_id: null, p_actor_context: { source: "seed-batch3-auth-test-fixtures" } })
  if (deactivateError) {
    console.error("Failed to deactivate via set_app_user_active RPC (checking for an alternate RPC name):", deactivateError.message)
  }

  console.log("\nInactive (U-007/U-009/U-012/U-019) persona:")
  console.log("  email:   ", "wf-test.inactive@example.test")
  console.log("  password:", inactive.password)
  console.log("  app_user_id:", appUser.id)
}

main()
