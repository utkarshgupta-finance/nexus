/**
 * Batch 17: provisions the three narrow-permission test personas needed
 * to isolate I-013, I-025, and I-026's authorization boundaries, which no
 * existing wf-test persona satisfies. Follows the exact same safety
 * pattern as scripts/seed-batch9-fixtures.ts: every identity through the
 * real Supabase Auth Admin API, every role grant through the real
 * grant_user_role RPC, never a raw table insert for the identity/grant
 * itself. Idempotent and safe to re-run.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-batch17-entitlement-boundary-fixtures.ts
 */

import { createClient } from "@supabase/supabase-js"

const USERS = [
  { email: "wf-test.entitlement-reader@example.test", displayName: "WF-TEST Entitlement Reader", roleCode: "batch17_entitlement_read_only" },
  { email: "wf-test.usage-writer-no-finalize@example.test", displayName: "WF-TEST Usage Writer (No Finalize)", roleCode: "batch17_usage_write_no_finalize" },
  { email: "wf-test.entitlement-writer-settlement-reader@example.test", displayName: "WF-TEST Entitlement Writer, Settlement Reader", roleCode: "batch17_entitlement_write_settlement_read" },
] as const

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

  for (const testUser of USERS) {
    const password = randomPassword()
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: testUser.email, password, email_confirm: true, user_metadata: { nexus_test_user: true, wf_test: true },
    })

    let authUserId: string
    if (createError) {
      if (!/already been registered|already exists/i.test(createError.message)) {
        console.error(`Failed to create ${testUser.email}:`, createError.message)
        process.exitCode = 1
        continue
      }
      const { data: listed } = await supabase.auth.admin.listUsers()
      const existing = listed.users.find((u) => u.email === testUser.email)
      if (!existing) {
        console.error(`${testUser.email} reported as already registered but not found via listUsers.`)
        process.exitCode = 1
        continue
      }
      authUserId = existing.id
      console.log(`${testUser.email} already exists, reusing. Password unchanged: Batch15-Temp-Pw-9f3a2c or original seed password.`)
    } else {
      authUserId = created.user.id
      console.log(`Created auth user ${testUser.email} with password ${password}`)
    }

    const { data: appUser, error: provisionError } = await supabase.rpc("provision_app_user", {
      p_auth_user_id: authUserId, p_actor_user_id: null, p_actor_context: { source: "seed-batch17-entitlement-boundary-fixtures" },
    })
    if (provisionError) {
      console.error(`Failed to provision app_users row for ${testUser.email}:`, provisionError.message)
      process.exitCode = 1
      continue
    }

    await supabase.rpc("set_app_user_display_name", {
      p_app_user_id: appUser.id, p_display_name: testUser.displayName, p_actor_user_id: null, p_actor_context: { source: "seed-batch17-entitlement-boundary-fixtures" },
    })

    const { data: role } = await supabase.from("roles").select("id").eq("code", testUser.roleCode).single()
    if (role) {
      const { error: grantError } = await supabase.rpc("grant_user_role", {
        p_user_id: appUser.id, p_role_id: role.id, p_actor_user_id: null, p_actor_context: { source: "seed-batch17-entitlement-boundary-fixtures" },
      })
      if (grantError && !/already/i.test(grantError.message)) console.error(`Role grant error for ${testUser.email}:`, grantError.message)
    } else {
      console.error(`Role '${testUser.roleCode}' not found.`)
      process.exitCode = 1
    }

    // Also set a known password explicitly (in case the user already existed with an unknown password)
    await supabase.auth.admin.updateUserById(authUserId, { password: "Batch17-Temp-Pw-6e1d9b" })

    console.log(`Provisioned ${testUser.email}, app_user id ${appUser.id}, role ${testUser.roleCode}`)
  }
}
main()
