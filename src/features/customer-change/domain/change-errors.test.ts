import { describe, expect, it } from "vitest"

import { parseChangeError, ChangeRequestOperationError } from "./change-errors"
import { defaultMessageForCode } from "@/platform/errors"

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

  it("maps WORKFLOW_REQUEST_ALREADY_DECIDED to its own kind (PG-036, concurrent-approval loser consistency)", () => {
    const parsed = parseChangeError({
      message: "WORKFLOW_REQUEST_ALREADY_DECIDED: this request was already approved by someone else. Refresh to see the current status.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_request_already_decided")
    expect(parsed.message).toBe("this request was already approved by someone else. Refresh to see the current status.")
  })

  it("maps WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION to its own kind (PG-037, cross-node distinct-approver control)", () => {
    const parsed = parseChangeError({
      message: "WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION: you already approved an earlier step of this request. A different approver must decide this step.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_segregation_of_duties_violation")
    expect(parsed.message).toBe("you already approved an earlier step of this request. A different approver must decide this step.")
  })

  it("maps WORKFLOW_TEAM_INACTIVE to its own kind with the standardized cross-domain message, not the RPC's own per-node detail (PG-056)", () => {
    const parsed = parseChangeError({
      message:
        'WORKFLOW_TEAM_INACTIVE: this request cannot be routed to its next step ("node_4"), whose responsible team has been deactivated. Ask a Workflow Admin to reassign that node to an active team before this request can advance.',
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_team_inactive")
    expect(parsed.message).toBe(defaultMessageForCode("WORKFLOW_TEAM_INACTIVE"))
    expect(parsed.message).not.toContain("node_4")
  })
})
