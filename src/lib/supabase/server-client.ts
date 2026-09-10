import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase client, authenticated as service_role.
 *
 * Every Commercial RPC (Migrations 8-10) has EXECUTE revoked from
 * anon/authenticated and granted only to service_role: there is no
 * anon-key client that can call any of them. This file must never be
 * imported from a Client Component or any code that ends up in a browser
 * bundle; the `server-only` import above makes that a build error, not a
 * runtime surprise.
 *
 * A fresh client is created per call rather than cached as a module
 * singleton, since this app has no long-lived server process yet
 * (Next.js route handlers/server actions run per-request); revisit this
 * once a real request-scoped or connection-pooled pattern is needed.
 */
function getSupabaseServiceRoleClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use the Supabase service role client. See .env.example."
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export { getSupabaseServiceRoleClient }
