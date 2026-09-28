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

  it("maps the COMMERCIAL_VERSION_EFFECTIVE_DATE_ADJACENT_TO_OPEN_COMPONENT_START token to its own kind with the RPC's safe message, never the raw chk_commercial_components_effective_dating constraint text (a real defect found via a live, rolled-back reproduction: a version's effective_date exactly one day after an existing open component's own effective_from used to reach the bulk-close step and fail on a raw check constraint violation)", () => {
    const parsed = parseCommercialVersionError({
      message:
        "COMMERCIAL_VERSION_EFFECTIVE_DATE_ADJACENT_TO_OPEN_COMPONENT_START: version 11111111-1111-1111-1111-111111111111 has effective_date 2026-09-21 which is exactly one day after an existing open component's own start date (2026-09-20); that component would need to be closed on the same day it started, which is not a valid historical period. Choose an effective date on or after 2026-09-22, or on or before 2026-09-20 if you intend to correct that period's own start",
      code: "P0001",
    })

    expect(parsed.kind).toBe("commercial_version_effective_date_adjacent_to_open_component_start")
    expect(parsed.message).toContain("exactly one day after an existing open component's own start date")
    expect(parsed.message).not.toMatch(/chk_commercial_components_effective_dating|violates check constraint/i)
  })

  it("maps the COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY token to its own kind with the RPC's specific message, never the generic unexpected-error fallback (found unmapped while debugging the same live approval failure, Batch 14)", () => {
    const parsed = parseCommercialVersionError({
      message:
        "COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY: version 11111111-1111-1111-1111-111111111111 has effective_date 2026-09-15 which falls within this component's already-recorded history; a correction may only move the start date earlier than 2026-09-01 (extending the known history further back) or on/after 2026-10-01 (the currently active period's own start)",
      code: "P0001",
    })

    expect(parsed.kind).toBe("commercial_version_effective_date_conflicts_with_history")
    expect(parsed.message).toContain("falls within this component's already-recorded history")
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

  it("maps WORKFLOW_NO_ACTIVE_DEFINITION to its own kind instead of the generic unknown fallback (L-021)", () => {
    const parsed = parseCommercialVersionError({
      message:
        "WORKFLOW_NO_ACTIVE_DEFINITION: no active workflow definition with a published version exists for commercial_configuration; a new version cannot be created until one is activated",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_no_active_definition")
    expect(parsed.message).toBe(
      "no active workflow definition with a published version exists for commercial_configuration; a new version cannot be created until one is activated"
    )
  })

  it("maps WORKFLOW_REQUEST_ALREADY_DECIDED to its own kind (PG-036, concurrent-approval loser consistency)", () => {
    const parsed = parseCommercialVersionError({
      message: "WORKFLOW_REQUEST_ALREADY_DECIDED: this request was already approved by someone else. Refresh to see the current status.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_request_already_decided")
    expect(parsed.message).toBe("this request was already approved by someone else. Refresh to see the current status.")
  })

  it("maps WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION to its own kind (PG-037, cross-node distinct-approver control)", () => {
    const parsed = parseCommercialVersionError({
      message: "WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION: you already approved an earlier step of this request. A different approver must decide this step.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_segregation_of_duties_violation")
    expect(parsed.message).toBe("you already approved an earlier step of this request. A different approver must decide this step.")
  })
})
