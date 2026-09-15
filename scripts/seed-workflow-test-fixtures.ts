/**
 * One-off seed script: provisions fictional WF-TEST teams and personas
 * for the Workflow Runtime V1 adversarial journey program (Nexus
 * Foundational Hardening, Phase 3). Mirrors
 * scripts/seed-e2e-test-users.ts's own safety pattern exactly: every
 * identity is created through the real, supported Supabase Auth Admin
 * API, never a raw insert into auth.users; every team/role/team-
 * membership grant goes through the real RPCs (create_team,
 * provision_app_user, set_app_user_display_name, grant_user_role,
 * assign_user_to_team), never a raw table insert either.
 *
 * These are TEST users/teams, not real employees/org units. Never use
 * fictional WF-TEST fixtures in Production; this script is intended for
 * Preview/local use against the Supabase project already configured in
 * .env.local. Idempotent and safe to re-run: existing teams/users are
 * reused (teams by code via ON CONFLICT-free lookup, users via
 * listUsers), only passwords are always reset to a freshly generated
 * value, printed once.
 *
 * Usage (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
 *
 *   npx tsx --env-file=.env.local scripts/seed-workflow-test-fixtures.ts
 */

import { createClient } from "@supabase/supabase-js"

const TEAMS = [
  { code: "wf_test_finance", name: "WF-TEST Finance" },
  { code: "wf_test_legal", name: "WF-TEST Legal" },
] as const

const USERS = [
  { email: "wf-test.maker@example.test", displayName: "WF-TEST Maker", roleCode: "maker", teamCode: null },
  { email: "wf-test.finance-checker@example.test", displayName: "WF-TEST Finance Checker", roleCode: "checker", teamCode: "wf_test_finance" },
  { email: "wf-test.legal-checker@example.test", displayName: "WF-TEST Legal Checker", roleCode: "checker", teamCode: "wf_test_legal" },
  { email: "wf-test.restricted@example.test", displayName: "WF-TEST Restricted User", roleCode: null, teamCode: null },
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

  // A dummy actor for the create_team/grant_user_role/assign_user_to_team
  // calls' own audit columns: these RPCs require a real app_users.id as
  // p_actor_user_id. The first provisioned WF-TEST user (created below)
  // fills that role for every fixture created after it; team creation
  // (which happens first) uses null, exactly like seed-e2e-test-users.ts's
  // own provision_app_user calls already do for the very first actor.
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
      p_description: "Fictional test team for Workflow Runtime V1 adversarial journeys (Nexus Foundational Hardening, Phase 3). Never for Production use.",
      p_actor_user_id: null,
      p_actor_context: { source: "seed-workflow-test-fixtures" },
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
      p_actor_context: { source: "seed-workflow-test-fixtures" },
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
      p_actor_context: { source: "seed-workflow-test-fixtures" },
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
        p_actor_context: { source: "seed-workflow-test-fixtures" },
      })
      if (grantError) {
        console.error(`Failed to grant role '${testUser.roleCode}' to ${testUser.email}:`, grantError.message)
        process.exitCode = 1
        continue
      }
    }

    if (testUser.teamCode) {
      const teamId = teamIdByCode.get(testUser.teamCode)
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
        p_actor_context: { source: "seed-workflow-test-fixtures" },
      })
      if (teamAssignError) {
        console.error(`Failed to assign ${testUser.email} to team '${testUser.teamCode}':`, teamAssignError.message)
        process.exitCode = 1
        continue
      }
    }

    results.push({ email: testUser.email, displayName: testUser.displayName, password, roleCode: testUser.roleCode, teamCode: testUser.teamCode })
  }

  console.log("\nWF-TEST teams:\n")
  for (const [code, id] of teamIdByCode) {
    console.log(`  ${code}: ${id}`)
  }

  console.log("\nWF-TEST users provisioned (fictional TEST personas, never for Production use):\n")
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
