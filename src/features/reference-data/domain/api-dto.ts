import { resolveOption } from "./service"
import type { ReferenceListKey, ReferenceMasterSnapshot } from "./types"

/**
 * The one shared shape a governed (Reference-Master-backed) field takes
 * in an API DTO (Platform Scale Program, Phase B,
 * `docs/API_INTEGRATION_ARCHITECTURE.md` §3): a stable code plus its
 * current display label, never the code alone. A database column value
 * is an implementation detail; this is what keeps a raw code from
 * silently becoming a permanent external contract by accident. Lives
 * here (not `platform/`) because it depends on `resolveOption`, and
 * `platform/` never imports a feature (docs/ARCHITECTURE.md §3);
 * `reference-data` is already the shared, foundational feature every
 * other feature depends on for exactly this resolution.
 */
type GovernedFieldDto = { code: string; label: string } | null

/** `resolveOption` already guarantees a historical/inactive code still resolves to its real label, never `null` merely because the value stopped being offered for new selections; only a genuinely absent value (no code at all) becomes `null` here. */
function toGovernedFieldDto(snapshot: ReferenceMasterSnapshot, listKey: ReferenceListKey, code: string | null): GovernedFieldDto {
  if (!code) return null
  const option = resolveOption(snapshot, listKey, code)
  return { code, label: option?.label ?? code }
}

export { toGovernedFieldDto }
export type { GovernedFieldDto }
