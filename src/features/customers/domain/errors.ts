import { defaultMessageForCode } from "@/platform/errors"

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

function parseCustomerError(error: PostgrestLikeError): { kind: CustomerOperationErrorKind; message: string; rawCause?: string } {
  const code = error.code ?? null
  if (code === "23505") return { kind: "conflict", message: error.message }
  if (code === "23514" || code === "23502") return { kind: "invalid_input", message: error.message }
  // Platform Scale Closure, Phase T: never surface raw Postgres detail to
  // a user; `rawCause` keeps it for logs/support.
  return { kind: "unknown", message: defaultMessageForCode("UNEXPECTED"), rawCause: error.message }
}

class CustomerOperationError extends Error {
  readonly kind: CustomerOperationErrorKind
  readonly rawCause?: string

  constructor(parsed: { kind: CustomerOperationErrorKind; message: string; rawCause?: string }) {
    super(parsed.message)
    this.name = "CustomerOperationError"
    this.kind = parsed.kind
    this.rawCause = parsed.rawCause
  }
}

export { parseCustomerError, CustomerOperationError }
export type { CustomerOperationErrorKind, PostgrestLikeError }
