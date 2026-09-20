import "server-only"

import { getSupabaseServerAuthClient } from "@/lib/supabase/server-auth-client"
import { getActiveGlobalRolesForUser, getActivePermissionsForRoles, getAppUserById } from "./data/rbac.data"
import type { NexusSession } from "./domain/types"

/**
 * DEFECT-B6-001: `getUser()` was observed capable of never settling
 * (neither resolving nor rejecting), which leaves every Suspense boundary
 * built on `getCurrentNexusSession()` stuck on its `loading.tsx` fallback
 * indefinitely, since React has no way to know the render will never
 * finish. Every other failure mode below is a rejection, already caught;
 * a hang is not. Dev logs showed clustered `AuthApiError: Invalid Refresh
 * Token` warnings from concurrent requests immediately before one such
 * hang, but the exact causal mechanism inside `@supabase/auth-js` was not
 * isolated: this project's client passes no `lock` option, so it runs the
 * SDK's "lockless coordination" default path (no `navigator.locks`/
 * `processLock`), which rules out the classic lock-deadlock explanation.
 * This timeout is a defensive bound on the symptom (a hang, from any
 * cause), not a fix for a diagnosed race.
 *
 * This bounds only Nexus's own wait; it does not cancel the underlying
 * Supabase request. `supabase-js` v2's `getUser()` takes no
 * `AbortSignal`/cancellation parameter, and the SDK's own `dispose()` API
 * documents in-flight fetches as running to completion, not aborted, so
 * there is nothing to invoke here. If the original call later settles,
 * its `.then`/`.catch` below fire against an already-settled outer
 * promise, which is a silent no-op under native Promise semantics: no
 * crash, no unhandled rejection. The only residual cost is one
 * already-in-flight request per timed-out call continuing in the
 * background until it naturally resolves; nothing accumulates per
 * request beyond that.
 */
const AUTH_PROVIDER_TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * TRUSTED, SERVER-ONLY authentication + authorization entry point.
 *
 * `getCurrentNexusSession()` is the one place the rest of the app derives
 * "who is calling right now": it reads the authenticated Supabase user
 * from the request's own session cookie (never a client-supplied user id,
 * query parameter, hidden form field, or UI-selected actor, task
 * correction §3), maps it to an `app_users` row, and resolves that user's
 * active global roles and permissions. Every Server Action or Server
 * Component that needs identity or authorization calls this function, or
 * `src/platform/permissions/server.ts`'s guards built on top of it, never
 * a parallel identity check.
 *
 * This module never exposes a raw Supabase `User`/`Session` object or a
 * raw `app_users`/`roles`/`permissions` row to callers; see
 * `./domain/types.ts` for the Nexus-owned contract this returns instead.
 */
/**
 * Never throws: a missing Supabase Auth environment variable or a
 * database/network failure resolves to `{ status: "unavailable" }`
 * (task correction §26's "session/backend failure" state) rather than
 * crashing every page that reads the session, since the root layout
 * resolves this on every request (`src/app/layout.tsx`). This is an
 * honest degraded state, not a silent fallback to "unauthenticated":
 * callers must not treat the two as equivalent (§13, deny-by-default
 * still applies to both, but the UI message differs).
 *
 * Each stage that can fail logs its own safe reason code
 * (AUTH_CONFIG_MISSING / AUTH_PROVIDER_ERROR / AUTH_RBAC_LOOKUP_FAILED)
 * before returning `unavailable`, so a real incident is diagnosable from
 * server logs alone. Only `Error.message` is logged, never the raw
 * error object, a token, a cookie, or a key: Supabase SDK error messages
 * describe what failed ("fetch failed", "Invalid API key"), not secret
 * values themselves.
 */
async function getCurrentNexusSession(): Promise<NexusSession> {
  let supabase: Awaited<ReturnType<typeof getSupabaseServerAuthClient>>
  try {
    supabase = await getSupabaseServerAuthClient()
  } catch (error) {
    console.error("[auth] AUTH_CONFIG_MISSING", error instanceof Error ? error.message : "unknown error")
    return { status: "unavailable" }
  }

  let authUser: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]
  try {
    const result = await withTimeout(supabase.auth.getUser(), AUTH_PROVIDER_TIMEOUT_MS, "Supabase Auth getUser timed out")
    authUser = result.data.user
  } catch (error) {
    console.error("[auth] AUTH_PROVIDER_ERROR", error instanceof Error ? error.message : "unknown error")
    return { status: "unavailable" }
  }

  if (!authUser) {
    return { status: "unauthenticated" }
  }

  try {
    const appUser = await getAppUserById(authUser.id)
    if (!appUser) {
      return { status: "unprovisioned", authUserId: authUser.id, email: authUser.email ?? null }
    }

    if (!appUser.is_active) {
      return { status: "inactive", authUserId: authUser.id, email: authUser.email ?? null, appUserId: appUser.id }
    }

    const roles = await getActiveGlobalRolesForUser(appUser.id)
    const permissions = await getActivePermissionsForRoles(roles.map((role) => role.id))

    return {
      status: "active",
      authUserId: authUser.id,
      email: authUser.email ?? null,
      appUserId: appUser.id,
      roles: roles.map((role) => ({ code: role.code, name: role.name })),
      permissions: permissions.map((permission) => ({ resource: permission.resource, action: permission.action })),
    }
  } catch (error) {
    console.error("[auth] AUTH_RBAC_LOOKUP_FAILED", error instanceof Error ? error.message : "unknown error")
    return { status: "unavailable" }
  }
}

export { getCurrentNexusSession }
