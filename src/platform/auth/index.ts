/**
 * Public surface of the Nexus authentication capability. `./server.ts`
 * (server-only, throws its guard outside a server context) is never
 * re-exported here; import it directly where an authenticated session
 * must actually be resolved. This barrel only exposes the Nexus-owned
 * identity contract every consumer reads.
 */
export type { NexusSession, NexusPermission, NexusRole, ActiveNexusUser } from "./domain/types"
