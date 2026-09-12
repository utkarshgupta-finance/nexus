import type { NexusSession } from "@/platform/auth"

/**
 * Pure permission check over an already-resolved `NexusSession`: no
 * database call, so it is safe to use anywhere a session has already
 * been fetched once (a Server Component deciding what to render, a test
 * given a fixture session), without a second round trip. The async,
 * session-fetching version (`hasPermission` in `../server.ts`) is a thin
 * wrapper around this same check.
 *
 * Only the `active` session state can ever hold a permission: every other
 * state (unauthenticated, unprovisioned, inactive) has none, by
 * construction, matching the deny-by-default principle (task correction
 * §13).
 */
function sessionHasPermission(session: NexusSession, resource: string, action: string): boolean {
  return session.status === "active" && session.permissions.some((permission) => permission.resource === resource && permission.action === action)
}

export { sessionHasPermission }
