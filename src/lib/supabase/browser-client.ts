"use client"

import { createBrowserClient } from "@supabase/ssr"

/**
 * Browser Supabase client, authenticated as the signed-in user's own
 * session (anon key, never the service role key). Used only for
 * authentication operations (sign in, sign out, session refresh) from
 * Client Components; it is never used to read or write Nexus business
 * data directly, since Row Level Security denies anon/authenticated all
 * direct access to Platform Core tables (docs/DATA_ARCHITECTURE.md
 * §12). Business reads/writes still go through Server Actions/Server
 * Components, which use the service-role client
 * (src/lib/supabase/server-client.ts) after this session has been
 * verified server-side.
 */
function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to use the Supabase browser client. See .env.example."
    )
  }

  return createBrowserClient(url, anonKey)
}

export { getSupabaseBrowserClient }
