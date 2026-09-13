import "server-only"

/**
 * TRUSTED, SERVER-ONLY platform audit entry point. Every function
 * reachable from here authenticates as service_role; the calling
 * feature is responsible for its own permission check before rendering
 * what these return.
 */

export { resolveActorEmails } from "./data/actor-directory.data"
export { listAuditLogForRow } from "./data/audit-log.data"
export type { AuditLogRow } from "./data/audit-log.data"
