/**
 * Verifies readiness for a canonical Nexus test persona: real
 * authentication (a genuine supabase.auth.signInWithPassword() call,
 * exactly the app's own login path, using the anon key), and role/team/
 * scope configuration (read via the service-role key, read-only). Prints
 * only a non-sensitive readiness summary; never a password, access
 * token, refresh token, or cookie value.
 *
 * This is the CLI-side readiness check. To actually load an
 * authenticated session into a browser tab, use the credential relay
 * (scripts/nexus-test-credential-relay.ts) together with the browser
 * tooling's own autofill-the-real-login-form procedure; this script
 * cannot drive an external browser tab itself.
 *
 * Usage (requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and the four
 * NEXUS_TEST_*_PASSWORD variables):
 *
 *   npx tsx --env-file=.env.local --env-file=.env.nexus-test.local \
 *     scripts/nexus-test-session.ts --persona maker
 */

import { createClient } from "@supabase/supabase-js"

const PERSONAS: Record<string, { email: string; passwordEnv: string; displayName: string }> = {
  maker: { email: "nexus-test-maker@example.test", passwordEnv: "NEXUS_TEST_MAKER_PASSWORD", displayName: "Maker" },
  finance: { email: "nexus-test-finance@example.test", passwordEnv: "NEXUS_TEST_FINANCE_PASSWORD", displayName: "Finance Approver" },
  legal: { email: "nexus-test-legal@example.test", passwordEnv: "NEXUS_TEST_LEGAL_PASSWORD", displayName: "Legal Approver" },
  restricted: { email: "nexus-test-restricted@example.test", passwordEnv: "NEXUS_TEST_RESTRICTED_PASSWORD", displayName: "Restricted User" },
  "ux-approver": { email: "nexus-test-ux-approver@example.test", passwordEnv: "NEXUS_TEST_UX_APPROVER_PASSWORD", displayName: "UX Approver" },
}

async function main() {
  const personaArgIndex = process.argv.indexOf("--persona")
  const key = personaArgIndex >= 0 ? process.argv[personaArgIndex + 1] : undefined
  const persona = key ? PERSONAS[key] : undefined

  if (!persona) {
    console.error(`Unknown or missing --persona. Valid values: ${Object.keys(PERSONAS).join(", ")}`)
    process.exitCode = 1
    return
  }

  const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const password = process.env[persona.passwordEnv]

  if (!anonUrl || !anonKey || !serviceUrl || !serviceRoleKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY must all be set.")
    process.exitCode = 1
    return
  }
  if (!password) {
    console.error(`${persona.passwordEnv} is not set. Set it in .env.nexus-test.local.`)
    process.exitCode = 1
    return
  }

  console.log(`Persona: ${persona.displayName}`)

  // Real auth check: the same call the app's own login page makes.
  const anonClient = createClient(anonUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({ email: persona.email, password })
  console.log(`Authentication: ${signInError ? "FAIL" : "PASS"}`)
  if (signInError) {
    console.log(`  (reason withheld from ordinary output; check Supabase Auth logs if needed)`)
  }
  // Immediately discard the session; this process never persists or logs it.
  if (signInData?.session) {
    await anonClient.auth.signOut()
  }

  // Role/team/scope: read-only, via service role, no PII beyond what
  // this program already treats as non-sensitive (role/team names).
  const serviceClient = createClient(serviceUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: listed } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
  const authUser = listed?.users.find((u) => u.email === persona.email)

  if (!authUser) {
    console.log("Role: (app user not found)")
    console.log("Team: (app user not found)")
    console.log("Session ready: NO")
    return
  }

  const { data: appUser } = await serviceClient.from("app_users").select("id, is_active").eq("id", authUser.id).maybeSingle()
  const { data: roles } = await serviceClient
    .from("user_roles")
    .select("roles(code, name)")
    .eq("user_id", authUser.id)
    .is("revoked_at", null)
  const { data: teams } = await serviceClient
    .from("user_teams")
    .select("teams(code, name)")
    .eq("user_id", authUser.id)
    .is("revoked_at", null)

  const roleNames = (roles ?? [])
    .flatMap((r: { roles: { name: string } | { name: string }[] | null }) => (Array.isArray(r.roles) ? r.roles : r.roles ? [r.roles] : []))
    .map((r) => r.name)
  const teamNames = (teams ?? [])
    .flatMap((t: { teams: { name: string } | { name: string }[] | null }) => (Array.isArray(t.teams) ? t.teams : t.teams ? [t.teams] : []))
    .map((t) => t.name)

  console.log(`Role: ${roleNames.length ? roleNames.join(", ") : "none"}`)
  console.log(`Team: ${teamNames.length ? teamNames.join(", ") : "none"}`)
  console.log(`Active: ${appUser?.is_active ? "yes" : "no"}`)
  console.log(`Session ready: ${!signInError && appUser?.is_active ? "YES" : "NO"}`)
}

main()
