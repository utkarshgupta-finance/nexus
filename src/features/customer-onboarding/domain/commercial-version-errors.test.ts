import { describe, expect, it } from "vitest"

import { parseCommercialVersionError, CommercialVersionOperationError } from "./commercial-version-errors"

describe("parseCommercialVersionError", () => {
  it("maps the SELF_APPROVAL_NOT_ALLOWED token to its own kind with the RPC's safe message, never the raw token", () => {
    const parsed = parseCommercialVersionError({
      message: "SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("commercial_version_self_approval_not_allowed")
    expect(parsed.message).toBe("you cannot approve your own request. Another authorized checker must review it.")
  })

  it("wraps into a CommercialVersionOperationError whose .message is the safe text a UI can show directly", () => {
    const error = new CommercialVersionOperationError(
      parseCommercialVersionError({ message: "SELF_APPROVAL_NOT_ALLOWED: you cannot reject your own request. Another authorized checker must review it." })
    )

    expect(error.message).toBe("you cannot reject your own request. Another authorized checker must review it.")
    expect(error.commercialVersionError.kind).toBe("commercial_version_self_approval_not_allowed")
  })
})
