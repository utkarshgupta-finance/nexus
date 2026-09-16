/**
 * Extends scripts/seed-workflow-test-fixtures.ts and
 * scripts/seed-workflow-test-fixtures-phase3b.ts for Batch 2 of the Nexus
 * Journey Universe validation program (Workflow Builder remaining structural
 * edge cases + Workflow Versioning). Provisions the two personas Batch 2
 * needs that no prior committed script created:
 *
 * - wf-test.workflow-editor@example.test (workflow_editor_test role: read
 *   + write, no publish). Used in Batch 1 via a temporary script that was
 *   deleted afterward; recreated here as a permanent, reusable fixture so
 *   future batches do not need to reinvent it.
 * - wf-test.workflow-viewer@example.test (workflow_viewer_test role: read
 *   only). New for K-027.
 *
 * Same safety pattern as the two scripts above exactly: every identity
 * through the real Supabase Auth Admin API, every role grant through the
 * real RPCs, never a raw table insert. Idempotent and safe to re-run.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-workflow-test-fixtures-batch2.ts
 */

import { createClient } from "@supabase/supabase-js"

const USERS = [
  { email: "wf-test.workflow-editor@example.test", displayName: "WF-TEST Workflow Editor (write, no publish)", roleCode: "workflow_editor_test" },
  { email: "wf-test.workflow-viewer@example.test", displayName: "WF-TEST Workflow Viewer (read only)", roleCode: "workflow_viewer_test" },
] as const

function randomPassword(): string {
  return `Wf-${crypto.randomUUID()}`
}

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment. Not connecting; nothing was written.")
    process.exitCode = 1
    return
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const results: { email: string; displayName: string; password: string; roleCode: string }[] = []

  for (const testUser of USERS) {
    const password = randomPassword()

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password,
      email_confirm: true,
      user_metadata: { nexus_test_user: true, wf_test: true },
    })

    let authUserId: string
    if (createError) {
      if (!/already been registered|already exists/i.test(createError.message)) {
        console.error(`Failed to create ${testUser.email}:`, createError.message)
        process.exitCode = 1
        continue
      }
      const { data: listed, error: listError } = await supabase.auth.admin.listUsers()
      if (listError) {
        console.error(`Failed to look up existing ${testUser.email}:`, listError.message)
        process.exitCode = 1
        continue
      }
      const existing = listed.users.find((user) => user.email === testUser.email)
      if (!existing) {
        console.error(`${testUser.email} was reported as already registered but could not be found via listUsers.`)
        process.exitCode = 1
        continue
      }
      authUserId = existing.id
      const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, { password })
      if (updateError) {
        console.error(`Failed to reset password for ${testUser.email}:`, updateError.message)
        process.exitCode = 1
        continue
      }
    } else {
      authUserId = created.user.id
    }

    const { data: appUser, error: provisionError } = await supabase.rpc("provision_app_user", {
      p_auth_user_id: authUserId,
      p_actor_user_id: null,
      p_actor_context: { source: "seed-workflow-test-fixtures-batch2" },
    })
    if (provisionError) {
      console.error(`Failed to provision app_users row for ${testUser.email}:`, provisionError.message)
      process.exitCode = 1
      continue
    }

    const { error: displayNameError } = await supabase.rpc("set_app_user_display_name", {
      p_app_user_id: appUser.id,
      p_display_name: testUser.displayName,
      p_actor_user_id: null,
      p_actor_context: { source: "seed-workflow-test-fixtures-batch2" },
    })
    if (displayNameError) {
      console.error(`Failed to set display name for ${testUser.email}:`, displayNameError.message)
      process.exitCode = 1
      continue
    }

    const { data: role, error: roleError } = await supabase.from("roles").select("id").eq("code", testUser.roleCode).single()
    if (roleError || !role) {
      console.error(`Role '${testUser.roleCode}' not found:`, roleError?.message)
      process.exitCode = 1
      continue
    }
    const { error: grantError } = await supabase.rpc("grant_user_role", {
      p_user_id: appUser.id,
      p_role_id: role.id,
      p_actor_user_id: null,
      p_actor_context: { source: "seed-workflow-test-fixtures-batch2" },
    })
    if (grantError) {
      console.error(`Failed to grant role '${testUser.roleCode}' to ${testUser.email}:`, grantError.message)
      process.exitCode = 1
      continue
    }

    results.push({ email: testUser.email, displayName: testUser.displayName, password, roleCode: testUser.roleCode })
  }

  console.log("\nWF-TEST Batch 2 users provisioned (fictional TEST personas, never for Production use):\n")
  for (const result of results) {
    console.log(`  ${result.displayName}`)
    console.log(`    email:    ${result.email}`)
    console.log(`    password: ${result.password}`)
    console.log(`    role:     ${result.roleCode}`)
    console.log("")
  }
}

main()
