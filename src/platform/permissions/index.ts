/**
 * Public surface of the Nexus permissions capability. `./server.ts`
 * (server-only) is imported directly where enforcement is actually
 * needed; this barrel only exposes the pure, session-safe pieces:
 * `sessionHasPermission` for branching on an already-resolved session,
 * and the authorization error shape every denial uses.
 */
export { sessionHasPermission } from "./domain/has-permission"
export { AuthorizationError } from "./domain/errors"
export type { AuthorizationDenialReason } from "./domain/errors"
