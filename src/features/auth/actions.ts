"use server"

import { getSupabaseServerAuthClient } from "@/lib/supabase/server-auth-client"

/**
 * Sign-in Server Action, entirely server-side through
 * `getSupabaseServerAuthClient()` (the session-cookie-aware client, never
 * the service role client): Supabase Auth itself verifies the password,
 * this code never sees or stores it beyond the single call below, and a
 * successful call sets the session cookie through the Next.js `cookies()`
 * API this client already wraps.
 *
 * Sign-out lives in `@/platform/auth/actions` instead: it is a shared
 * session-termination concern the app shell needs, not something specific
 * to this login feature (docs/ARCHITECTURE.md §3).
 */

type SignInResult = { ok: true } | { ok: false; error: string }

async function signInAction(email: string, password: string): Promise<SignInResult> {
  const trimmedEmail = email.trim()
  if (!trimmedEmail || !password) {
    return { ok: false, error: "Enter your email and password." }
  }

  const supabase = await getSupabaseServerAuthClient()
  const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
  if (error) {
    return { ok: false, error: "Incorrect email or password." }
  }

  return { ok: true }
}

export { signInAction }
