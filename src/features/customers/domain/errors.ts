/**
 * Minimal Customer Master error model. `customers` has no RPCs and no
 * named exception tokens (unlike Commercial): the only failures are a
 * `key` uniqueness conflict, a rejected lifecycle-trigger mutation
 * (`src/features/commercial/domain/errors.ts`'s named-token taxonomy
 * would be over-built here for one table with one plain trigger), or an
 * ordinary Postgres error. This wraps whatever Supabase/PostgREST
 * returns into one typed error the rest of this feature can catch.
 */
type CustomerOperationErrorKind = "conflict" | "invalid_input" | "not_found" | "unknown"

type PostgrestLikeError = {
  message: string
  code?: string | null
}

function parseCustomerError(error: PostgrestLikeError): { kind: CustomerOperationErrorKind; message: string } {
  const code = error.code ?? null
  if (code === "23505") return { kind: "conflict", message: error.message }
  if (code === "23514" || code === "23502") return { kind: "invalid_input", message: error.message }
  return { kind: "unknown", message: error.message || "An unexpected error occurred." }
}

class CustomerOperationError extends Error {
  readonly kind: CustomerOperationErrorKind

  constructor(parsed: { kind: CustomerOperationErrorKind; message: string }) {
    super(parsed.message)
    this.name = "CustomerOperationError"
    this.kind = parsed.kind
  }
}

export { parseCustomerError, CustomerOperationError }
export type { CustomerOperationErrorKind, PostgrestLikeError }
