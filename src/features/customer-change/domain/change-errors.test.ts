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

  it("maps the CUSTOMER_CHANGE_DRAFT_STALE token (a real concurrent-edit conflict, found via a genuine two-tab retest) to a human-readable message, never raw terms like row_version or database", () => {
    const parsed = parseChangeError({
      message: "CUSTOMER_CHANGE_DRAFT_STALE: This draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("change_request_draft_stale")
    expect(parsed.message).toBe("This draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.")
    expect(parsed.message).not.toMatch(/row_version|database|version mismatch/i)
  })
})
