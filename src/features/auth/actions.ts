"use server"

import { redirect } from "next/navigation"

import { getSupabaseServerAuthClient } from "@/lib/supabase/server-auth-client"

/**
 * Sign-in/sign-out Server Actions. Both run entirely server-side through
 * `getSupabaseServerAuthClient()` (the session-cookie-aware client, never
 * the service role client): Supabase Auth itself verifies the password,
 * this code never sees or stores it beyond the single call below, and a
 * successful call sets the session cookie through the Next.js `cookies()`
 * API this client already wraps.
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

async function signOutAction(): Promise<void> {
  const supabase = await getSupabaseServerAuthClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export { signInAction, signOutAction }
