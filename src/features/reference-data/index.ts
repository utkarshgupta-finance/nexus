/**
 * Public surface of the Reference Master feature. Everything here is pure
 * and fixture-backed today (see domain/fixtures.ts), so unlike features
 * with a Supabase-backed layer, there is no server.ts split yet: nothing
 * in this feature touches the network or a credential. If this later
 * becomes a real database-backed capability under `platform/policy/`
 * (`docs/PLATFORM_ARCHITECTURE.md` §5), the split reappears then.
 */

export type { ReferenceListKey, ReferenceOption } from "./domain/types"
export { getActiveOptions, getAllOptions, resolveOption } from "./domain/service"
