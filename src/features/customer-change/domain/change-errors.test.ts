import { describe, expect, it } from "vitest"

import { parseChangeError, ChangeRequestOperationError } from "./change-errors"

describe("parseChangeError", () => {
  it("maps the SELF_APPROVAL_NOT_ALLOWED token to its own kind with the RPC's safe message, never the raw token", () => {
    const parsed = parseChangeError({
      message: "SELF_APPROVAL_NOT_ALLOWED: you cannot reject your own request. Another authorized checker must review it.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("change_request_self_approval_not_allowed")
    expect(parsed.message).toBe("you cannot reject your own request. Another authorized checker must review it.")
  })

  it("wraps into a ChangeRequestOperationError whose .message is the safe text a UI can show directly", () => {
    const error = new ChangeRequestOperationError(
      parseChangeError({ message: "SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it." })
    )

    expect(error.message).toBe("you cannot approve your own request. Another authorized checker must review it.")
    expect(error.changeError.kind).toBe("change_request_self_approval_not_allowed")
  })

  it("Workflow Runtime V1 UX + Audit Closure: maps WORKFLOW_NODE_ALREADY_ADVANCED to its own kind so the action layer can show a friendly stale-approval message instead of this raw token", () => {
    const parsed = parseChangeError({
      message: "WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.",
      code: "P0001",
    })
    expect(parsed.kind).toBe("workflow_node_already_advanced")
  })

  it("maps the CUSTOMER_CHANGE_DRAFT_STALE token (a real concurrent-edit conflict, found via a genuine two-tab retest) to a human-readable message, never raw terms like row_version or database", () => {
    const parsed = parseChangeError({
      message: "CUSTOMER_CHANGE_DRAFT_STALE: This draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("change_request_draft_stale")
    expect(parsed.message).toBe("This draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.")
    expect(parsed.message).not.toMatch(/row_version|database|version mismatch/i)
  })

  it("maps WORKFLOW_NO_ACTIVE_DEFINITION to its own kind instead of the generic unknown fallback (L-021)", () => {
    const parsed = parseChangeError({
      message:
        "WORKFLOW_NO_ACTIVE_DEFINITION: no active workflow definition with a published version exists for customer_change; a new change request cannot be created until one is activated",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_no_active_definition")
    expect(parsed.message).toBe(
      "no active workflow definition with a published version exists for customer_change; a new change request cannot be created until one is activated"
    )
  })
})
