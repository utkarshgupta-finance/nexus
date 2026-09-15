import { defaultMessageForCode } from "@/platform/errors"

/**
 * Team Master error model, same shape as
 * `src/features/reference-data/domain/errors.ts`: the only realistic
 * conflicts are the `teams.code` uniqueness constraint and the
 * `user_teams` active/primary-per-user unique indexes
 * (supabase/migrations/20260916060000_team_master_foundation.sql).
 */
type TeamOperationErrorKind = "conflict" | "invalid_input" | "unknown"

type PostgrestLikeError = {
  message: string
  code?: string | null
}

function parseTeamError(error: PostgrestLikeError): {
  kind: TeamOperationErrorKind
  message: string
  rawCause?: string
} {
  const code = error.code ?? null
  if (code === "23505") return { kind: "conflict", message: error.message }
  if (code === "23514" || code === "23502") return { kind: "invalid_input", message: error.message }
  return { kind: "unknown", message: defaultMessageForCode("UNEXPECTED"), rawCause: error.message }
}

class TeamOperationError extends Error {
  readonly kind: TeamOperationErrorKind
  readonly rawCause?: string

  constructor(parsed: { kind: TeamOperationErrorKind; message: string; rawCause?: string }) {
    super(parsed.message)
    this.name = "TeamOperationError"
    this.kind = parsed.kind
    this.rawCause = parsed.rawCause
  }
}

export { parseTeamError, TeamOperationError }
export type { TeamOperationErrorKind, PostgrestLikeError }
