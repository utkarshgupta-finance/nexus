/**
 * Batch 8 overnight run: adds the one missing fixture identified by the
 * six-batch pre-flight research (a second Leadership team member, needed
 * for A-031's concurrent-approval-race journey against the real
 * onboarding workflow's sole approval team, which currently has only one
 * member). Follows the exact same safety pattern as
 * scripts/seed-workflow-test-fixtures-phase3b.ts: every identity through
 * the real Supabase Auth Admin API, every team/role/membership grant
 * through the real RPCs, never a raw table insert. Idempotent and safe
 * to re-run.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-batch8-fixtures.ts
 */

import { createClient } from "@supabase/supabase-js"

const USERS = [
  { email: "wf-test.leadership-approver-b@example.test", displayName: "WF-TEST Leadership Approver B", roleCode: "checker", teamCode: "wf_test_leadership" },
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
      console.log(`${testUser.email} already exists, reusing.`)
    } else {
      authUserId = created.user.id
      console.log(`Created auth user ${testUser.email}`)
    }

    const { data: appUser, error: provisionError } = await supabase.rpc("provision_app_user", {
      p_auth_user_id: authUserId, p_actor_user_id: null, p_actor_context: { source: "seed-batch8-fixtures" },
    })
    if (provisionError) {
      console.error(`Failed to provision app_users row for ${testUser.email}:`, provisionError.message)
      process.exitCode = 1
      continue
    }

    await supabase.rpc("set_app_user_display_name", {
      p_app_user_id: appUser.id, p_display_name: testUser.displayName, p_actor_user_id: null, p_actor_context: { source: "seed-batch8-fixtures" },
    })

    const { data: role } = await supabase.from("roles").select("id").eq("code", testUser.roleCode).single()
    if (role) {
      const { error: grantError } = await supabase.rpc("grant_user_role", {
        p_user_id: appUser.id, p_role_id: role.id, p_actor_user_id: null, p_actor_context: { source: "seed-batch8-fixtures" },
      })
      if (grantError && !/already/i.test(grantError.message)) console.error(`Role grant error for ${testUser.email}:`, grantError.message)
    }

    const { data: team } = await supabase.from("teams").select("id").eq("code", testUser.teamCode).single()
    if (team) {
      const { error: teamError } = await supabase.rpc("assign_user_to_team", {
        p_user_id: appUser.id, p_team_id: team.id, p_is_primary: true, p_actor_user_id: null, p_actor_context: { source: "seed-batch8-fixtures" },
      })
      if (teamError && !/already/i.test(teamError.message)) console.error(`Team assign error for ${testUser.email}:`, teamError.message)
    }

    console.log(`Provisioned ${testUser.email}, app_user id ${appUser.id}, role ${testUser.roleCode}, team ${testUser.teamCode}`)
  }

  const { data: members } = await supabase.from("user_teams").select("app_user_id, teams!inner(code)").eq("teams.code", "wf_test_leadership")
  console.log("wf_test_leadership members now:", members)
}
main()
