/**
 * One-off seed script: creates the single fictional demo Customer
 * Master row this task builds (Northstar Consumer Products Pvt Ltd) in
 * the real `customers` table.
 *
 * Deliberately a standalone script, not a live app route or Server
 * Action: Customer creation is not yet a real, authorized user-facing
 * flow (docs/AUTHORIZATION_MODEL.md is locked design, not implemented),
 * so nothing in the running app exposes a way to insert a `customers`
 * row from the browser. This script is the safest available path: run
 * once, by a developer who already holds the service_role credential,
 * never reachable over HTTP.
 *
 * This does NOT import src/lib/supabase/server-client.ts or
 * src/features/customers/server.ts: both transitively import the
 * `server-only` marker package, which unconditionally throws outside
 * Next.js's bundler (it only resolves to a no-op under Next's
 * "react-server" module condition). A plain Node/tsx script is exactly
 * the case that guard exists to prevent, for Client Components, so this
 * script intentionally constructs its own service-role client inline
 * instead of fighting that guard.
 *
 * Usage (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to already
 * be set in the environment, for example via
 * `node --env-file=.env.local`):
 *
 *   npx tsx --env-file=.env.local scripts/seed-demo-customer.ts
 *
 * Idempotent: if a `customers` row with this key already exists, the
 * script reports that and exits without inserting a duplicate or
 * mutating the existing row.
 */

import { createClient } from "@supabase/supabase-js"

const DEMO_CUSTOMER_KEY = "demo-northstar-consumer-products"
const DEMO_CUSTOMER_NAME = "Northstar Consumer Products Pvt Ltd"

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

  const { data: existing, error: lookupError } = await supabase
    .from("customers")
    .select("id, key, name, is_active, created_at")
    .eq("key", DEMO_CUSTOMER_KEY)
    .maybeSingle()

  if (lookupError) {
    console.error("Lookup failed:", lookupError.message)
    process.exitCode = 1
    return
  }

  if (existing) {
    console.log("Demo customer already exists. Nothing inserted.")
    console.log(JSON.stringify(existing, null, 2))
    return
  }

  const { data: inserted, error: insertError } = await supabase
    .from("customers")
    .insert({ key: DEMO_CUSTOMER_KEY, name: DEMO_CUSTOMER_NAME, created_by: null })
    .select("id, key, name, is_active, created_at")
    .single()

  if (insertError) {
    console.error("Insert failed:", insertError.message)
    process.exitCode = 1
    return
  }

  console.log("Demo customer created.")
  console.log(JSON.stringify(inserted, null, 2))
}

main()
