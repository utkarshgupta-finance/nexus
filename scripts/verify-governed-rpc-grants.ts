import { createClient } from "@supabase/supabase-js"

/**
 * Governed RPC Trust-Boundary guard (NEXUS GOVERNED RPC TRUST-BOUNDARY
 * CLOSURE). Calls the database's own list_governed_rpc_grant_violations()
 * function (supabase/migrations/20260930070000_governed_rpc_revoke_public_execute_sweep.sql),
 * which pattern-matches every function in the public schema that looks
 * like a governed mutation and still grants execute to anon or
 * authenticated. An empty result is healthy; any row means a migration
 * introduced (or re-introduced) the PUBLIC-execute-grant defect that
 * let 18 backend-only RPCs accidentally accept direct calls from any
 * authenticated user, bypassing every requirePermission check in the
 * TypeScript layer.
 *
 * Run before applying any migration that creates, replaces, or changes
 * the signature of a governed mutation RPC:
 *   npx tsx --env-file=.env.local scripts/verify-governed-rpc-grants.ts
 */
async function main() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
  }
  const supabase = createClient(url, serviceRoleKey)

  const { data, error } = await supabase.rpc("list_governed_rpc_grant_violations")
  if (error) {
    console.error("Could not run the guard check:", error.message)
    console.error("Has migration 20260930070000_governed_rpc_revoke_public_execute_sweep.sql been applied to this database?")
    process.exit(1)
  }

  const violations = (data ?? []) as { function_name: string; function_args: string; anon_can_execute: boolean; authenticated_can_execute: boolean }[]

  if (violations.length > 0) {
    console.error(`FAILED: ${violations.length} governed mutation function(s) grant execute to anon/authenticated:`)
    for (const v of violations) {
      console.error(`  - ${v.function_name}(${v.function_args})  anon=${v.anon_can_execute} authenticated=${v.authenticated_can_execute}`)
    }
    console.error("\nFix: revoke all on function <name>(<args>) from public, anon, authenticated; grant execute ... to service_role;")
    process.exit(1)
  }

  console.log("PASS: no governed mutation function grants execute to anon/authenticated.")
}
main()
