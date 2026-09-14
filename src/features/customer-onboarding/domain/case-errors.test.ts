import { describe, expect, it } from "vitest"

import { parseCaseError, CaseOperationError } from "./case-errors"

describe("parseCaseError", () => {
  it("maps the SELF_APPROVAL_NOT_ALLOWED token to its own kind with the RPC's safe message, never the raw token", () => {
    const parsed = parseCaseError({
      message: "SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("onboarding_case_self_approval_not_allowed")
    expect(parsed.message).toBe("you cannot approve your own request. Another authorized checker must review it.")
  })

  it("wraps into a CaseOperationError whose .message is the safe text a UI can show directly", () => {
    const error = new CaseOperationError(
      parseCaseError({ message: "SELF_APPROVAL_NOT_ALLOWED: you cannot send back your own request. Another authorized checker must review it." })
    )

    expect(error.message).toBe("you cannot send back your own request. Another authorized checker must review it.")
    expect(error.caseError.kind).toBe("onboarding_case_self_approval_not_allowed")
  })

  it("still falls back to a generic safe message for a genuinely unrecognized token", () => {
    const parsed = parseCaseError({ message: "SOME_FUTURE_TOKEN_NOT_YET_MAPPED: detail" })
    expect(parsed.kind).toBe("unknown")
  })
})
