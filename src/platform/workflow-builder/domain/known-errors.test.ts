import { describe, expect, it } from "vitest"
import { friendlyMessageForKnownConstraint } from "./known-errors"

describe("friendlyMessageForKnownConstraint", () => {
  it("translates the one-draft-per-definition unique violation into a friendly message (Batch 2, L-002)", () => {
    const rawMessage = 'duplicate key value violates unique constraint "uq_workflow_version_one_draft"'
    expect(friendlyMessageForKnownConstraint(rawMessage)).toBe(
      "A draft already exists for this workflow. Publish or discard it before creating a new one.",
    )
  })

  it("returns null for unrelated messages so callers fall through to their normal handling", () => {
    expect(friendlyMessageForKnownConstraint("WORKFLOW_VERSION_NOT_FOUND: no row")).toBeNull()
    expect(friendlyMessageForKnownConstraint('duplicate key value violates unique constraint "some_other_constraint"')).toBeNull()
  })
})
