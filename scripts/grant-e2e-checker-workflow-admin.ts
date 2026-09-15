/**
 * One-off grant: adds the workflow_admin role to the fictional
 * nexus.e2e.checker@example.test TEST user (see
 * scripts/seed-e2e-test-users.ts), so this same persona can also access
 * Settings > Workflows for live Workflow Builder acceptance testing
 * (NEXUS ACCEPTANCE CLOSURE, Parts B4/C1) without creating a third test
 * identity. Uses the real grant_user_role RPC, never a raw table
 * insert, exactly as every other role grant in this codebase must.
 *
 * Usage: npx tsx --env-file=.env.local scripts/grant-e2e-checker-workflow-admin.ts
 */

import { createClient } from "@supabase/supabase-js"

const TEST_CHECKER_EMAIL = "nexus.e2e.checker@example.test"

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.")
    process.exitCode = 1
    return
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: listed, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) throw listError
  const authUser = listed.users.find((user) => user.email === TEST_CHECKER_EMAIL)
  if (!authUser) throw new Error(`${TEST_CHECKER_EMAIL} not found. Run scripts/seed-e2e-test-users.ts first.`)

  const { data: role, error: roleError } = await supabase.from("roles").select("id").eq("code", "workflow_admin").single()
  if (roleError || !role) throw new Error(`workflow_admin role not found: ${roleError?.message}`)

  const { error: grantError } = await supabase.rpc("grant_user_role", {
    p_user_id: authUser.id,
    p_role_id: role.id,
    p_actor_user_id: null,
    p_actor_context: { source: "grant-e2e-checker-workflow-admin" },
  })
  if (grantError) throw grantError

  console.log(`Granted workflow_admin to ${TEST_CHECKER_EMAIL} (${authUser.id}).`)
}

main()
