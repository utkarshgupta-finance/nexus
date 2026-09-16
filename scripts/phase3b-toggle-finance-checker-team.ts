/**
 * Nexus Foundational Hardening, Phase 3B: one-off helper to remove and
 * re-add WF-TEST Finance Checker's wf_test_finance team membership, to
 * test "team membership removed after page opened" (Settings mutation
 * while a request is in flight). Uses the real remove_user_from_team /
 * assign_user_to_team RPCs, never a raw table mutation.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/phase3b-toggle-finance-checker-team.ts remove
 *   npx tsx --env-file=.env.local scripts/phase3b-toggle-finance-checker-team.ts add
 */

import { createClient } from "@supabase/supabase-js"

const USER_TEAM_ID = "425ca790-0e65-4ee8-9cf9-08189b04070f"
const USER_ID = "cbfb7860-bcfe-41d4-9fc3-beca6dd4e916"
const TEAM_ID = "9a53c69d-5f05-4d23-8490-18fd91e66a6c"

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    process.exitCode = 1
    return
  }
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const action = process.argv[2]

  if (action === "remove") {
    const { error } = await supabase.rpc("remove_user_from_team", {
      p_user_team_id: USER_TEAM_ID,
      p_actor_user_id: USER_ID,
      p_actor_context: { source: "phase3b-toggle-finance-checker-team" },
    })
    if (error) {
      console.error("Failed to remove:", error.message)
      process.exitCode = 1
      return
    }
    console.log("Removed WF-TEST Finance Checker from wf_test_finance.")
  } else if (action === "add") {
    const { error } = await supabase.rpc("assign_user_to_team", {
      p_user_id: USER_ID,
      p_team_id: TEAM_ID,
      p_is_primary: true,
      p_actor_user_id: USER_ID,
      p_actor_context: { source: "phase3b-toggle-finance-checker-team" },
    })
    if (error) {
      console.error("Failed to add:", error.message)
      process.exitCode = 1
      return
    }
    console.log("Re-added WF-TEST Finance Checker to wf_test_finance.")
  } else {
    console.error("Usage: pass 'remove' or 'add' as the first argument.")
    process.exitCode = 1
  }
}

main()
