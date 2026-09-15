import type { TeamRow } from "../data/team.data"

/**
 * Team Master domain type (NEXUS FULL PRODUCT READINESS, Chief Architect
 * review): every other feature in this codebase maps its raw DB row to a
 * camelCase domain type before it ever reaches a UI component; Team
 * Master was the one exception, passing `TeamRow` (snake_case,
 * `is_active`/`updated_at`) straight through `server.ts`. This closes
 * that gap without changing any behavior.
 */
type Team = {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  updatedAt: string
}

function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  }
}

export { toTeam }
export type { Team }
