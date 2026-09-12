import "server-only"

import { getSupabaseServerAuthClient } from "@/lib/supabase/server-auth-client"
import { getActiveGlobalRolesForUser, getActivePermissionsForRoles, getAppUserById } from "./data/rbac.data"
import type { NexusSession } from "./domain/types"

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
 */
async function getCurrentNexusSession(): Promise<NexusSession> {
  try {
    const supabase = await getSupabaseServerAuthClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return { status: "unauthenticated" }
    }

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
  } catch {
    return { status: "unavailable" }
  }
}

export { getCurrentNexusSession }
