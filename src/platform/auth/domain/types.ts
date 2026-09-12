/**
 * Nexus-owned session/identity contract. Every consumer (Server Actions,
 * Server Components, `src/platform/permissions/server.ts`) reads this
 * shape, never Supabase's own `User`/`Session` types directly and never
 * raw `app_users`/`roles`/`permissions` rows: this is the boundary that
 * lets the underlying auth provider or RBAC storage change later without
 * every call site changing (docs/AUTHORIZATION_MODEL.md §2).
 *
 * The four states below are deliberately distinct, not collapsed into a
 * single `user | null`, because the UI must tell them apart
 * (`docs/AUTHORIZATION_MODEL.md`'s "Unauthenticated" is never the same
 * thing as "authenticated but unauthorized", task correction §26):
 *
 * - `unauthenticated`: no valid Supabase Auth session at all.
 * - `unprovisioned`: a real, valid Supabase Auth session, but no
 *   `app_users` row exists for this `auth.users.id` yet. Nexus access
 *   was never granted; this is never auto-provisioned (task correction
 *   §6, "do not silently create an admin user").
 * - `inactive`: an `app_users` row exists but `is_active = false`
 *   (offboarded). Historical audit references naming this user must
 *   still resolve; this state only blocks new governed actions.
 * - `active`: a real, active Nexus application user, with whatever roles
 *   and permissions their current `user_roles`/`role_permissions` grants
 *   resolve to (possibly zero permissions, which is still a valid active
 *   state, just one that can perform nothing governed yet).
 * - `unavailable`: the session/backend itself could not be resolved (a
 *   missing Supabase Auth environment variable, a network/database
 *   error). Deliberately distinct from `unauthenticated`, task correction
 *   §26's "session/backend failure" state: a visitor who is genuinely
 *   not signed in is not the same as a visitor whose sign-in status
 *   could not be determined at all. Deny-by-default applies to this case
 *   exactly the same as every other non-`active` state.
 */
type NexusPermission = {
  resource: string
  action: string
}

type NexusRole = {
  code: string
  name: string
}

type NexusSession =
  | { status: "unauthenticated" }
  | { status: "unprovisioned"; authUserId: string; email: string | null }
  | { status: "inactive"; authUserId: string; email: string | null; appUserId: string }
  | {
      status: "active"
      authUserId: string
      email: string | null
      appUserId: string
      roles: NexusRole[]
      permissions: NexusPermission[]
    }
  | { status: "unavailable" }

/** The subset of `NexusSession` that a permission check can act on: only the `active` case carries roles/permissions at all. */
type ActiveNexusUser = Extract<NexusSession, { status: "active" }>

export type { NexusSession, NexusPermission, NexusRole, ActiveNexusUser }
