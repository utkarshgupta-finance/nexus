/**
 * One-off seed script: provisions two fictional E2E test personas,
 * a Maker and a Checker, so the "different checker" maker/checker
 * acceptance flow (Customer Onboarding, Customer Change, Commercial
 * Change, Go Live) can be exercised by two real, independently
 * logged-in users instead of the same person self-approving.
 *
 * IMPORTANT LESSON this script exists to honor: never insert directly
 * into auth.users. A prior system-seed row that bypassed Supabase's
 * GoTrue Auth server by inserting into auth.users directly corrupted
 * Auth Admin's listUsers (a row GoTrue itself never created). Every
 * identity here is created through the real, supported Supabase Auth
 * Admin API (`supabase.auth.admin.createUser`/`updateUserById`), the
 * same surface `src/platform/user-access/data/user-access.data.ts`
 * already uses for `listAuthUsers`. This script never touches
 * auth.users as a table.
 *
 * Mirrors scripts/seed-demo-customer.ts: standalone tsx script, inline
 * service-role client, idempotent, never imports server-only app code.
 * Provisioning into app_users/user_roles goes through the real RPCs
 * added for User Access (provision_app_user, grant_user_role,
 * set_app_user_display_name), never a raw table insert, so these users
 * are provisioned exactly the way a real admin would provision anyone
 * else.
 *
 * These are TEST users, not real employees. Never use fictional TEST
 * users in Production; this script is intended for Preview/local use
 * against the Supabase project already configured in .env.local.
 *
 * Usage (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
 *
 *   npx tsx --env-file=.env.local scripts/seed-e2e-test-users.ts
 *
 * Always resets both users' passwords to a freshly generated random
 * value and prints it once, so the script is safe to re-run to recover
 * a forgotten test password without ever hardcoding one in source.
 */

import { createClient } from "@supabase/supabase-js"

const TEST_USERS = [
  { email: "nexus.e2e.maker@example.test", displayName: "Nexus E2E Maker (TEST)", roleCode: "maker" },
  { email: "nexus.e2e.checker@example.test", displayName: "Nexus E2E Checker (TEST)", roleCode: "checker" },
] as const

function randomPassword(): string {
  return `E2e-${crypto.randomUUID()}`
}

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment. " +
        "See .env.example. Not connecting; nothing was written."
    )
    process.exitCode = 1
    return
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const results: { email: string; displayName: string; roleCode: string; password: string; authUserId: string }[] = []

  for (const testUser of TEST_USERS) {
    const password = randomPassword()

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password,
      email_confirm: true,
      user_metadata: { nexus_test_user: true },
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
      p_actor_context: { source: "seed-e2e-test-users" },
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
      p_actor_context: { source: "seed-e2e-test-users" },
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
      p_actor_context: { source: "seed-e2e-test-users" },
    })
    if (grantError) {
      console.error(`Failed to grant role '${testUser.roleCode}' to ${testUser.email}:`, grantError.message)
      process.exitCode = 1
      continue
    }

    results.push({ email: testUser.email, displayName: testUser.displayName, roleCode: testUser.roleCode, password, authUserId })
  }

  console.log("\nE2E test users provisioned (fictional TEST personas, never for Production use):\n")
  for (const result of results) {
    console.log(`  ${result.displayName}`)
    console.log(`    email:    ${result.email}`)
    console.log(`    password: ${result.password}`)
    console.log(`    role:     ${result.roleCode}`)
    console.log(`    auth id:  ${result.authUserId}`)
    console.log("")
  }
}

main()
