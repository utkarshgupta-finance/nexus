/**
 * Provisions the fresh canonical fictional test-persona set for Nexus
 * Manual UX testing (replaces the retired wf-test.* personas, see
 * scripts/retire-old-test-personas.ts). Exactly four personas: a Maker
 * with no approve permission, a Finance approver and a Legal approver on
 * two distinct existing teams (WF-TEST Finance/WF-TEST Legal, reused,
 * never recreated), and a Restricted user with no roles or teams at all.
 * This is the smallest set that covers Batches 20-23's remaining Manual
 * UX journeys; do not add a fifth persona without a concrete journey that
 * needs it.
 *
 * Every identity is created through the real, supported Supabase Auth
 * Admin API, never a raw insert into auth.users; every role/team grant
 * goes through the real RPCs (provision_app_user, set_app_user_display_name,
 * grant_user_role, assign_user_to_team), never a raw table insert.
 *
 * Idempotent and safe to re-run: existing personas are reused (found by
 * email via listUsers), only the password is always reset to a freshly
 * generated value, printed once. THIS SCRIPT MUST BE RUN BY A HUMAN, IN
 * THEIR OWN TERMINAL, NEVER BY the agent: the printed passwords are the
 * only way to log in as these personas, and the agent must never read
 * them. Running it yourself and reading the output yourself is exactly
 * the sanctioned path; do not paste the printed passwords into chat.
 *
 * Usage (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
 *
 *   npx tsx --env-file=.env.local scripts/provision-canonical-test-personas.ts
 */

import { createClient } from "@supabase/supabase-js"

const EXISTING_TEAMS = [
  { code: "wf_test_finance", name: "WF-TEST Finance" },
  { code: "wf_test_legal", name: "WF-TEST Legal" },
] as const

const PERSONAS = [
  { email: "nexus-test-maker@example.test", displayName: "Nexus Test Maker", roleCode: "maker", teamCode: null },
  { email: "nexus-test-finance@example.test", displayName: "Nexus Test Finance Approver", roleCode: "checker", teamCode: "wf_test_finance" },
  { email: "nexus-test-legal@example.test", displayName: "Nexus Test Legal Approver", roleCode: "checker", teamCode: "wf_test_legal" },
  { email: "nexus-test-restricted@example.test", displayName: "Nexus Test Restricted User", roleCode: null, teamCode: null },
] as const

function randomPassword(): string {
  return `Nx-${crypto.randomUUID()}`
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
  for (const team of EXISTING_TEAMS) {
    const { data: existing, error } = await supabase.from("teams").select("id").eq("code", team.code).maybeSingle()
    if (error || !existing) {
      console.error(`Expected existing team '${team.code}' not found; this script only reuses existing teams, it does not create new ones:`, error?.message)
      process.exitCode = 1
      continue
    }
    teamIdByCode.set(team.code, existing.id)
  }

  const results: { email: string; displayName: string; password: string; roleCode: string | null; teamCode: string | null }[] = []

  for (const persona of PERSONAS) {
    const password = randomPassword()

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: persona.email,
      password,
      email_confirm: true,
      user_metadata: { nexus_test_user: true, nexus_test_canonical: true },
    })

    let authUserId: string
    if (createError) {
      if (!/already been registered|already exists/i.test(createError.message)) {
        console.error(`Failed to create ${persona.email}:`, createError.message)
        process.exitCode = 1
        continue
      }
      const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      if (listError) {
        console.error(`Failed to look up existing ${persona.email}:`, listError.message)
        process.exitCode = 1
        continue
      }
      const existing = listed.users.find((u) => u.email === persona.email)
      if (!existing) {
        console.error(`${persona.email} was reported as already registered but could not be found via listUsers.`)
        process.exitCode = 1
        continue
      }
      authUserId = existing.id
      const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, { password })
      if (updateError) {
        console.error(`Failed to reset password for ${persona.email}:`, updateError.message)
        process.exitCode = 1
        continue
      }
    } else {
      authUserId = created.user.id
    }

    const { data: appUser, error: provisionError } = await supabase.rpc("provision_app_user", {
      p_auth_user_id: authUserId,
      p_actor_user_id: null,
      p_actor_context: { source: "provision-canonical-test-personas" },
    })
    if (provisionError) {
      console.error(`Failed to provision app_users row for ${persona.email}:`, provisionError.message)
      process.exitCode = 1
      continue
    }

    const { error: displayNameError } = await supabase.rpc("set_app_user_display_name", {
      p_app_user_id: appUser.id,
      p_display_name: persona.displayName,
      p_actor_user_id: null,
      p_actor_context: { source: "provision-canonical-test-personas" },
    })
    if (displayNameError) {
      console.error(`Failed to set display name for ${persona.email}:`, displayNameError.message)
      process.exitCode = 1
      continue
    }

    const { data: existingRoles } = await supabase
      .from("user_roles")
      .select("id, roles(code)")
      .eq("user_id", appUser.id)
      .is("revoked_at", null)
    const alreadyHasRole = persona.roleCode
      ? (existingRoles ?? []).some((r: { roles: { code: string } | { code: string }[] | null }) => {
          const roles = Array.isArray(r.roles) ? r.roles : r.roles ? [r.roles] : []
          return roles.some((role) => role.code === persona.roleCode)
        })
      : false

    if (persona.roleCode && !alreadyHasRole) {
      const { data: role, error: roleError } = await supabase.from("roles").select("id").eq("code", persona.roleCode).single()
      if (roleError || !role) {
        console.error(`Role '${persona.roleCode}' not found:`, roleError?.message)
        process.exitCode = 1
        continue
      }
      const { error: grantError } = await supabase.rpc("grant_user_role", {
        p_user_id: appUser.id,
        p_role_id: role.id,
        p_actor_user_id: null,
        p_actor_context: { source: "provision-canonical-test-personas" },
      })
      if (grantError) {
        console.error(`Failed to grant role '${persona.roleCode}' to ${persona.email}:`, grantError.message)
        process.exitCode = 1
        continue
      }
    }

    if (persona.teamCode) {
      const teamId = teamIdByCode.get(persona.teamCode)
      if (!teamId) {
        console.error(`Team '${persona.teamCode}' was not found; cannot assign ${persona.email}.`)
        process.exitCode = 1
        continue
      }
      const { data: existingTeams } = await supabase
        .from("user_teams")
        .select("id, team_id")
        .eq("user_id", appUser.id)
        .is("revoked_at", null)
      const alreadyOnTeam = (existingTeams ?? []).some((t) => t.team_id === teamId)
      if (!alreadyOnTeam) {
        const { error: teamAssignError } = await supabase.rpc("assign_user_to_team", {
          p_user_id: appUser.id,
          p_team_id: teamId,
          p_is_primary: true,
          p_actor_user_id: null,
          p_actor_context: { source: "provision-canonical-test-personas" },
        })
        if (teamAssignError) {
          console.error(`Failed to assign ${persona.email} to team '${persona.teamCode}':`, teamAssignError.message)
          process.exitCode = 1
          continue
        }
      }
    }

    const { error: activateError } = await supabase.rpc("set_app_user_active", {
      p_app_user_id: appUser.id,
      p_is_active: true,
      p_actor_user_id: null,
    })
    if (activateError) console.error(`  ${persona.email}: failed to ensure active:`, activateError.message)

    results.push({ email: persona.email, displayName: persona.displayName, password, roleCode: persona.roleCode, teamCode: persona.teamCode })
  }

  console.log("\nCanonical Nexus test personas provisioned (fictional TEST personas, never for Production use):\n")
  for (const result of results) {
    console.log(`  ${result.displayName}`)
    console.log(`    email:    ${result.email}`)
    console.log(`    password: ${result.password}`)
    console.log(`    role:     ${result.roleCode ?? "(none)"}`)
    console.log(`    team:     ${result.teamCode ?? "(none)"}`)
    console.log("")
  }
  console.log("Log in at http://localhost:3000/login (or the Preview URL) with each email/password above.")
  console.log("Do not share these passwords in chat; this output is for your own terminal only.")
}

main()
