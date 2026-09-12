/**
 * Reference Master error model, same shape as
 * `src/features/customers/domain/errors.ts`: `reference_options` has no
 * RPCs and no named exception tokens, only a `(list_key, code)`
 * uniqueness conflict, a rejected lifecycle-trigger mutation (an attempt
 * to change a stable `code` or physically delete a row), or an ordinary
 * Postgres error.
 */
type ReferenceMasterOperationErrorKind = "conflict" | "invalid_input" | "not_found" | "unknown"

type PostgrestLikeError = {
  message: string
  code?: string | null
}

function parseReferenceMasterError(error: PostgrestLikeError): {
  kind: ReferenceMasterOperationErrorKind
  message: string
} {
  const code = error.code ?? null
  if (code === "23505") return { kind: "conflict", message: error.message }
  if (code === "23514" || code === "23502") return { kind: "invalid_input", message: error.message }
  return { kind: "unknown", message: error.message || "An unexpected error occurred." }
}

class ReferenceMasterOperationError extends Error {
  readonly kind: ReferenceMasterOperationErrorKind

  constructor(parsed: { kind: ReferenceMasterOperationErrorKind; message: string }) {
    super(parsed.message)
    this.name = "ReferenceMasterOperationError"
    this.kind = parsed.kind
  }
}

export { parseReferenceMasterError, ReferenceMasterOperationError }
export type { ReferenceMasterOperationErrorKind, PostgrestLikeError }
