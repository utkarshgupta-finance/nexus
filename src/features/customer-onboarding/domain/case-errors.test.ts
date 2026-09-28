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

  it("maps ONBOARDING_DRAFT_SAVE_NOT_OWNER to its own kind (Batch 7 A-002 authorization variant fix)", () => {
    const parsed = parseCaseError({
      message: "ONBOARDING_DRAFT_SAVE_NOT_OWNER: only the creator of case req-1 may edit this draft",
      code: "P0001",
    })

    expect(parsed.kind).toBe("onboarding_draft_save_not_owner")
    expect(parsed.message).toBe("only the creator of case req-1 may edit this draft")
  })

  it("maps ONBOARDING_CASE_SUBMIT_NOT_OWNER to its own kind (Batch 7 A-003 authorization variant fix)", () => {
    const parsed = parseCaseError({
      message: "ONBOARDING_CASE_SUBMIT_NOT_OWNER: only the creator of case req-1 may submit it",
      code: "P0001",
    })

    expect(parsed.kind).toBe("onboarding_case_submit_not_owner")
    expect(parsed.message).toBe("only the creator of case req-1 may submit it")
  })

  it("maps ONBOARDING_EFFECTIVE_DATE_EXCEPTION_PENDING to its own kind (PD-002, Batches 1-13 Ledger Audit product decision closure)", () => {
    const parsed = parseCaseError({
      message:
        "ONBOARDING_EFFECTIVE_DATE_EXCEPTION_PENDING: effective_date 2026-01-01 is before this case's onboarding date 2026-06-01; both a BU Head and a Finance Head must approve (bu_head approved: f, finance_head approved: f)",
      code: "P0001",
    })

    expect(parsed.kind).toBe("onboarding_effective_date_exception_pending")
    expect(parsed.message).toContain("both a BU Head and a Finance Head must approve")
  })

  it("maps WORKFLOW_NO_ACTIVE_DEFINITION to its own kind instead of the generic unknown fallback (L-021)", () => {
    const parsed = parseCaseError({
      message:
        "WORKFLOW_NO_ACTIVE_DEFINITION: no active workflow definition with a published version exists for customer_onboarding; a new case cannot be created until one is activated",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_no_active_definition")
    expect(parsed.message).toBe(
      "no active workflow definition with a published version exists for customer_onboarding; a new case cannot be created until one is activated"
    )
  })

  it("maps WORKFLOW_REQUEST_ALREADY_DECIDED to its own kind (PG-036, concurrent-approval loser consistency)", () => {
    const parsed = parseCaseError({
      message: "WORKFLOW_REQUEST_ALREADY_DECIDED: this request was already approved by someone else. Refresh to see the current status.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_request_already_decided")
    expect(parsed.message).toBe("this request was already approved by someone else. Refresh to see the current status.")
  })

  it("maps WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION to its own kind (PG-037, cross-node distinct-approver control)", () => {
    const parsed = parseCaseError({
      message: "WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION: you already approved an earlier step of this request. A different approver must decide this step.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_segregation_of_duties_violation")
    expect(parsed.message).toBe("you already approved an earlier step of this request. A different approver must decide this step.")
  })
})
