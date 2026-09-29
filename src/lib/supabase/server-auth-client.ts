import "server-only"

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

/**
 * PG-059: true only when the browser sent a cookie matching Supabase's own
 * `sb-<project-ref>-auth-token` naming convention (`@supabase/ssr`'s cookie
 * storage), even if the session it names has since expired or been
 * revoked. Lets `getCurrentNexusSession` distinguish "was authenticated,
 * session now invalid" from "never authenticated at all" using only a
 * cookie the server already reads on every request, without adding any
 * new client-side session-watching mechanism.
 */
async function hasSupabaseAuthCookie(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))
}

/**
 * Server-side, session-aware Supabase client: reads the authenticated
 * user from the request's own cookies (set by middleware.ts's session
 * refresh), using the anon key, never the service role key. This is the
 * authoritative source for "who is making this request"
 * (src/platform/auth/server.ts's `getCurrentNexusUser`), distinct from
 * src/lib/supabase/server-client.ts's service-role client, which is a
 * privileged execution path, not an identity source (docs/
 * AUTHORIZATION_MODEL.md §2: Supabase Auth answers who, RLS/service_role
 * answers how privileged code runs, never who).
 *
 * `setAll` is wrapped in try/catch because a Server Component render
 * cannot write cookies (Next.js throws if attempted); middleware.ts is
 * what actually refreshes the session cookie on each request, so a
 * failed write here is expected and harmless in that context, not
 * silently swallowing a real error.
 */
async function getSupabaseServerAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to use the Supabase server auth client. See .env.example."
    )
  }

  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component; middleware.ts's session
          // refresh already handles cookie writes for this request.
        }
      },
    },
  })
}

export { getSupabaseServerAuthClient, hasSupabaseAuthCookie }
