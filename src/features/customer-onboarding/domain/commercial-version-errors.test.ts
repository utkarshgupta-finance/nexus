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

  it("maps the uq_commercial_configuration_versions_one_open_per_config unique violation to a human-readable message, never the raw Postgres constraint text (a real crash found via a fresh live retest: 'Change Customer > Commercials' always links to /versions/new even when one is already open)", () => {
    const parsed = parseCommercialVersionError({
      message: 'duplicate key value violates unique constraint "uq_commercial_configuration_versions_one_open_per_config"',
      code: "23505",
    })

    expect(parsed.kind).toBe("commercial_version_already_open")
    expect(parsed.message).toBe("There is already an open Commercial Version for this configuration. Continue that one instead of starting a new change.")
    expect(parsed.message).not.toMatch(/duplicate key|constraint|database/i)
  })

  it("still falls back to the generic conflict kind for an unrelated 23505 violation", () => {
    const parsed = parseCommercialVersionError({ message: 'duplicate key value violates unique constraint "some_other_constraint"', code: "23505" })
    expect(parsed.kind).toBe("conflict")
  })
})
