/**
 * Extends scripts/seed-workflow-test-fixtures.ts for Nexus Foundational
 * Hardening Phase 3B (adversarial workflow journey program): adds the
 * remaining fictional WF-TEST teams and personas the Phase 3B test matrix
 * needs (a second Finance checker for concurrent-approval races, a
 * Leadership team/approver for multi-level chains, a Customer Success
 * team, and a pure Workflow Admin persona with no business approval
 * rights, to test "workflow admin without approval permission").
 *
 * Same safety pattern as seed-workflow-test-fixtures.ts exactly: every
 * identity through the real Supabase Auth Admin API, every team/role/
 * membership grant through the real RPCs, never a raw table insert.
 * Idempotent and safe to re-run.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-workflow-test-fixtures-phase3b.ts
 */

import { createClient } from "@supabase/supabase-js"

const TEAMS = [
  { code: "wf_test_leadership", name: "WF-TEST Leadership" },
  { code: "wf_test_customer_success", name: "WF-TEST Customer Success" },
  { code: "wf_test_restricted", name: "WF-TEST Restricted" },
] as const

const USERS = [
  { email: "wf-test.finance-checker-b@example.test", displayName: "WF-TEST Finance Checker B", roleCode: "checker", teamCode: "wf_test_finance" },
  { email: "wf-test.leadership-approver@example.test", displayName: "WF-TEST Leadership Approver", roleCode: "checker", teamCode: "wf_test_leadership" },
  { email: "wf-test.cs-checker@example.test", displayName: "WF-TEST Customer Success Checker", roleCode: "checker", teamCode: "wf_test_customer_success" },
  { email: "wf-test.workflow-admin@example.test", displayName: "WF-TEST Workflow Admin (no approval rights)", roleCode: "workflow_admin", teamCode: null },
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

  const teamIdByCode = new Map<string, string>()
  for (const team of TEAMS) {
    const { data: existing } = await supabase.from("teams").select("id").eq("code", team.code).maybeSingle()
    if (existing) {
      teamIdByCode.set(team.code, existing.id)
      continue
    }
    const { data: created, error } = await supabase.rpc("create_team", {
      p_code: team.code,
      p_name: team.name,
      p_description: "Fictional test team for Workflow Runtime V1 adversarial journeys (Nexus Foundational Hardening, Phase 3B). Never for Production use.",
      p_actor_user_id: null,
      p_actor_context: { source: "seed-workflow-test-fixtures-phase3b" },
    })
    if (error || !created) {
      console.error(`Failed to create team '${team.code}':`, error?.message)
      process.exitCode = 1
      continue
    }
    teamIdByCode.set(team.code, created.id)
  }

  const results: { email: string; displayName: string; password: string; roleCode: string | null; teamCode: string | null }[] = []

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
      p_actor_context: { source: "seed-workflow-test-fixtures-phase3b" },
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
      p_actor_context: { source: "seed-workflow-test-fixtures-phase3b" },
    })
    if (displayNameError) {
      console.error(`Failed to set display name for ${testUser.email}:`, displayNameError.message)
      process.exitCode = 1
      continue
    }

    if (testUser.roleCode) {
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
        p_actor_context: { source: "seed-workflow-test-fixtures-phase3b" },
      })
      if (grantError) {
        console.error(`Failed to grant role '${testUser.roleCode}' to ${testUser.email}:`, grantError.message)
        process.exitCode = 1
        continue
      }
    }

    if (testUser.teamCode) {
      let teamId = teamIdByCode.get(testUser.teamCode)
      if (!teamId) {
        const { data: existingTeam } = await supabase.from("teams").select("id").eq("code", testUser.teamCode).maybeSingle()
        teamId = existingTeam?.id
      }
      if (!teamId) {
        console.error(`Team '${testUser.teamCode}' was not created/found; cannot assign ${testUser.email}.`)
        process.exitCode = 1
        continue
      }
      const { error: teamAssignError } = await supabase.rpc("assign_user_to_team", {
        p_user_id: appUser.id,
        p_team_id: teamId,
        p_is_primary: true,
        p_actor_user_id: null,
        p_actor_context: { source: "seed-workflow-test-fixtures-phase3b" },
      })
      if (teamAssignError) {
        console.error(`Failed to assign ${testUser.email} to team '${testUser.teamCode}':`, teamAssignError.message)
        process.exitCode = 1
        continue
      }
    }

    results.push({ email: testUser.email, displayName: testUser.displayName, password, roleCode: testUser.roleCode, teamCode: testUser.teamCode })
  }

  console.log("\nWF-TEST Phase 3B teams:\n")
  for (const [code, id] of teamIdByCode) {
    console.log(`  ${code}: ${id}`)
  }

  console.log("\nWF-TEST Phase 3B users provisioned (fictional TEST personas, never for Production use):\n")
  for (const result of results) {
    console.log(`  ${result.displayName}`)
    console.log(`    email:    ${result.email}`)
    console.log(`    password: ${result.password}`)
    console.log(`    role:     ${result.roleCode ?? "(none)"}`)
    console.log(`    team:     ${result.teamCode ?? "(none)"}`)
    console.log("")
  }
}

main()
