/**
 * One-off grant: adds the workflow_admin role to the WF-TEST Maker
 * persona (scripts/seed-workflow-test-fixtures.ts) so it can author
 * workflows in Settings > Workflows for the Phase 3 adversarial journey
 * program, without needing the real admin account's password. Uses the
 * same real RPCs (provision_app_user is idempotent and returns the
 * existing row; grant_user_role) as every other seed script here, never
 * a raw table insert.
 *
 * Usage: npx tsx --env-file=.env.local scripts/grant-workflow-admin-to-wf-test-maker.ts
 */

import { createClient } from "@supabase/supabase-js"

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    process.exitCode = 1
    return
  }
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: listed, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) throw listError
  const authUser = listed.users.find((u) => u.email === "wf-test.maker@example.test")
  if (!authUser) throw new Error("wf-test.maker@example.test not found; run seed-workflow-test-fixtures.ts first.")

  const { data: appUser, error: provisionError } = await supabase.rpc("provision_app_user", {
    p_auth_user_id: authUser.id,
    p_actor_user_id: null,
    p_actor_context: { source: "grant-workflow-admin-to-wf-test-maker" },
  })
  if (provisionError) throw provisionError

  const { data: role, error: roleError } = await supabase.from("roles").select("id").eq("code", "workflow_admin").single()
  if (roleError || !role) throw new Error(`workflow_admin role not found: ${roleError?.message}`)

  const { error: grantError } = await supabase.rpc("grant_user_role", {
    p_user_id: appUser.id,
    p_role_id: role.id,
    p_actor_user_id: null,
    p_actor_context: { source: "grant-workflow-admin-to-wf-test-maker" },
  })
  if (grantError) throw grantError

  console.log("Granted workflow_admin to wf-test.maker@example.test")
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
