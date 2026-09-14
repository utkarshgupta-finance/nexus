"use server"

import { redirect } from "next/navigation"

import { getSupabaseServerAuthClient } from "@/lib/supabase/server-auth-client"

/**
 * Sign-out is a session-termination concern, not a feature-specific one:
 * `src/components/product/app-shell.tsx` (the shared shell used across
 * every feature) needs it, so it lives beside `getCurrentNexusSession`
 * here rather than being reached from `features/auth`
 * (docs/ARCHITECTURE.md §3: `components/product` may depend on
 * `platform/`, never on a single feature). Sign-in stays in
 * `features/auth/actions.ts`: it is only ever used by the login page
 * itself, with feature-specific validation (email/password presence),
 * not a shared-shell concern.
 */
async function signOutAction(): Promise<void> {
  const supabase = await getSupabaseServerAuthClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export { signOutAction }
