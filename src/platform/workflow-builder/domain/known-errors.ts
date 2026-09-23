/**
 * Translates a small, known set of raw Postgres constraint-violation
 * messages into friendly text. Batch 2, L-002: the partial unique index
 * `uq_workflow_version_one_draft` correctly blocks a second concurrent
 * draft version, but its raw duplicate-key message was leaking to the end
 * user verbatim instead of explaining that a draft already exists.
 * Returns null for anything not recognized, so callers fall through to
 * their normal handling.
 */
export function friendlyMessageForKnownConstraint(message: string): string | null {
  if (message.includes("uq_workflow_version_one_draft")) {
    return "A draft already exists for this workflow. Publish or discard it before creating a new one."
  }
  return null
}
