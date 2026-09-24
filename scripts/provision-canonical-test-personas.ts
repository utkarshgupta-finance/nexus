/**
 * Provisions the canonical fictional test-persona set for Nexus Manual UX
 * testing (replaces the retired wf-test.* personas, see
 * scripts/retire-old-test-personas.ts): a Maker with no approve permission,
 * a Finance approver, a Legal approver, a UX approver (three distinct
 * existing teams, reused, never recreated), a Restricted user with no
 * roles or teams at all, a Workflow Admin holding only the workflow_admin
 * role (no team, no other role) for role-isolation testing of the
 * Workflow Builder's own admin lifecycle (K-017), and an Unprovisioned
 * user: a genuine Auth identity this script deliberately never gives an
 * app_users row (N-019), the one intentional exception in this file to
 * "every persona is a normal, fully provisioned identity."
 *
 * Every identity is created through the real, supported Supabase Auth
 * Admin API, never a raw insert into auth.users; every role/team grant
 * goes through the real RPCs (provision_app_user, set_app_user_display_name,
 * grant_user_role, assign_user_to_team), never a raw table insert.
 *
 * Passwords are read from named environment variables (see PASSWORD_ENV
 * below), never generated here and never printed. Set them once in
 * .env.nexus-test.local (gitignored via the existing .env* rule, never
 * committed). This script is safe for anyone, including an AI agent, to
 * run: it never logs a password value, only status per persona.
 *
 * IMPORTANT: an ordinary rerun is idempotent and session-preserving. If a
 * persona's Auth user already exists, this script never touches its
 * password (an Admin API password update revokes existing sessions, which
 * would silently log out anyone already using an isolated-origin browser
 * session for that persona). It only reconciles app_users active state,
 * role grants, and team membership. To intentionally rotate a persona's
 * password (which will log out any existing session for that persona),
 * pass --reset-passwords explicitly.
 *
 * Usage (requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and the
 * NEXUS_TEST_*_PASSWORD variables, e.g. via two --env-file flags):
 *
 *   npx tsx --env-file=.env.local --env-file=.env.nexus-test.local \
 *     scripts/provision-canonical-test-personas.ts
 *
 *   npx tsx --env-file=.env.local --env-file=.env.nexus-test.local \
 *     scripts/provision-canonical-test-personas.ts --reset-passwords
 */

import { createClient } from "@supabase/supabase-js"

const EXISTING_TEAMS = [
  { code: "wf_test_finance", name: "WF-TEST Finance" },
  { code: "wf_test_legal", name: "WF-TEST Legal" },
  { code: "ux_verification_team", name: "UX Verification Team" },
] as const

const PERSONAS = [
  {
    email: "nexus-test-unprovisioned@example.test",
    displayName: "Nexus Test Unprovisioned User",
    roleCode: null,
    teamCode: null,
    passwordEnv: "NEXUS_TEST_UNPROVISIONED_PASSWORD",
    // A genuine Supabase Auth identity that intentionally has no app_users
    // row at all (N-019: "a valid Auth identity with no app_users row sees
    // an honest 'Access not provisioned' denial"). Every other persona in
    // this list gets an app_users row via provision_app_user below; this
    // one deliberately never does, so it must stay last in any reasoning
    // about "does an existing persona already cover this" and first in any
    // review of this file, since it is the one intentional exception to
    // "every identity here is a normal, fully provisioned persona."
    skipAppUserProvisioning: true,
  },
  {
    email: "nexus-test-maker@example.test",
    displayName: "Nexus Test Maker",
    roleCode: "maker",
    teamCode: null,
    passwordEnv: "NEXUS_TEST_MAKER_PASSWORD",
    skipAppUserProvisioning: false,
  },
  {
    email: "nexus-test-finance@example.test",
    displayName: "Nexus Test Finance Approver",
    roleCode: "checker",
    teamCode: "wf_test_finance",
    passwordEnv: "NEXUS_TEST_FINANCE_PASSWORD",
    skipAppUserProvisioning: false,
  },
  {
    email: "nexus-test-legal@example.test",
    displayName: "Nexus Test Legal Approver",
    roleCode: "checker",
    teamCode: "wf_test_legal",
    passwordEnv: "NEXUS_TEST_LEGAL_PASSWORD",
    skipAppUserProvisioning: false,
  },
  {
    email: "nexus-test-restricted@example.test",
    displayName: "Nexus Test Restricted User",
    roleCode: null,
    teamCode: null,
    passwordEnv: "NEXUS_TEST_RESTRICTED_PASSWORD",
    skipAppUserProvisioning: false,
  },
  {
    email: "nexus-test-ux-approver@example.test",
    displayName: "Nexus Test UX Approver",
    roleCode: "checker",
    teamCode: "ux_verification_team",
    passwordEnv: "NEXUS_TEST_UX_APPROVER_PASSWORD",
    skipAppUserProvisioning: false,
  },
  {
    email: "nexus-test-workflow-admin@example.test",
    displayName: "Nexus Test Workflow Admin",
    roleCode: "workflow_admin",
    teamCode: null,
    passwordEnv: "NEXUS_TEST_WORKFLOW_ADMIN_PASSWORD",
    skipAppUserProvisioning: false,
  },
] as const

async function main() {
  const resetPasswords = process.argv.includes("--reset-passwords")

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment. Not connecting; nothing was written.")
    process.exitCode = 1
    return
  }

  const missingPasswordEnvs = PERSONAS.filter((p) => !process.env[p.passwordEnv]).map((p) => p.passwordEnv)
  if (missingPasswordEnvs.length > 0) {
    console.error(`Missing password environment variable(s): ${missingPasswordEnvs.join(", ")}.`)
    console.error("Set them in .env.nexus-test.local (gitignored) and pass --env-file=.env.nexus-test.local. Nothing was written.")
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

  const results: { email: string; displayName: string; roleCode: string | null; teamCode: string | null; status: "created" | "password reset" | "existing (password preserved)" | "configuration reconciled" }[] = []

  for (const persona of PERSONAS) {
    const password = process.env[persona.passwordEnv] as string

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: persona.email,
      password,
      email_confirm: true,
      user_metadata: { nexus_test_user: true, nexus_test_canonical: true },
    })

    let authUserId: string
    let status: "created" | "password reset" | "existing (password preserved)" | "configuration reconciled" = "created"
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
      if (resetPasswords) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, { password })
        if (updateError) {
          console.error(`Failed to set password for ${persona.email}:`, updateError.message)
          process.exitCode = 1
          continue
        }
        status = "password reset"
      } else {
        // Do not touch the password: an Admin API password update revokes
        // existing sessions, which would silently log out anyone already
        // using this persona's isolated-origin browser session. Ordinary
        // reruns only reconcile role/team/active state below.
        status = "existing (password preserved)"
      }
    } else {
      authUserId = created.user.id
    }

    if (persona.skipAppUserProvisioning) {
      // Intentionally stop here: this persona must remain a valid Auth
      // identity with no app_users row (see the comment on this persona's
      // entry above). Calling provision_app_user would defeat the point.
      results.push({ email: persona.email, displayName: persona.displayName, roleCode: null, teamCode: null, status: status === "created" ? "created" : status })
      continue
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

    let configChanged = false

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
      configChanged = true
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
        configChanged = true
      }
    }

    const { data: activeCheck } = await supabase.from("app_users").select("is_active").eq("id", appUser.id).maybeSingle()
    if (!activeCheck?.is_active) {
      const { error: activateError } = await supabase.rpc("set_app_user_active", {
        p_app_user_id: appUser.id,
        p_is_active: true,
        p_actor_user_id: null,
      })
      if (activateError) {
        console.error(`  ${persona.email}: failed to ensure active:`, activateError.message)
      } else {
        configChanged = true
      }
    }

    if (status === "existing (password preserved)" && configChanged) {
      status = "configuration reconciled"
    }

    results.push({ email: persona.email, displayName: persona.displayName, roleCode: persona.roleCode, teamCode: persona.teamCode, status })
  }

  console.log("\nCanonical Nexus test personas provisioned (fictional TEST personas, never for Production use):\n")
  for (const result of results) {
    console.log(`  ${result.displayName}  <${result.email}>  role: ${result.roleCode ?? "(none)"}  team: ${result.teamCode ?? "(none)"}  [${result.status}]`)
  }
  console.log(`\n${results.length}/${PERSONAS.length} personas ready. No password value was printed by this script.`)
}

main()
