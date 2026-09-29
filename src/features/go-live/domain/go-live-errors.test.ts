import { describe, expect, it } from "vitest"

import { parseGoLiveError, GoLiveOperationError } from "./go-live-errors"
import { defaultMessageForCode } from "@/platform/errors"

describe("parseGoLiveError", () => {
  it("maps GO_LIVE_REQUEST_CANCEL_NOT_OWNER to its own kind with the RPC's safe message", () => {
    const parsed = parseGoLiveError({
      message: "GO_LIVE_REQUEST_CANCEL_NOT_OWNER: only the creator of request req-1 may cancel it",
      code: "P0001",
    })

    expect(parsed.kind).toBe("go_live_request_cancel_not_owner")
    expect(parsed.message).toBe("only the creator of request req-1 may cancel it")
  })

  it("maps GO_LIVE_DRAFT_SAVE_NOT_OWNER to its own kind (Batch 16 H-027 authorization gap fix)", () => {
    const parsed = parseGoLiveError({
      message: "GO_LIVE_DRAFT_SAVE_NOT_OWNER: only the creator of request req-1 may edit this draft",
      code: "P0001",
    })

    expect(parsed.kind).toBe("go_live_draft_save_not_owner")
    expect(parsed.message).toBe("only the creator of request req-1 may edit this draft")
  })

  it("maps GO_LIVE_REQUEST_SUBMIT_NOT_OWNER to its own kind (Batch 16 H-027 authorization gap fix)", () => {
    const parsed = parseGoLiveError({
      message: "GO_LIVE_REQUEST_SUBMIT_NOT_OWNER: only the creator of request req-1 may submit it",
      code: "P0001",
    })

    expect(parsed.kind).toBe("go_live_request_submit_not_owner")
    expect(parsed.message).toBe("only the creator of request req-1 may submit it")
  })

  it("maps GO_LIVE_COMMERCIAL_VERSION_SUPERSEDED to its own kind (PG-057)", () => {
    const parsed = parseGoLiveError({
      message:
        "GO_LIVE_COMMERCIAL_VERSION_SUPERSEDED: the commercial version referenced by this Go Live request has been superseded by a newer approved commercial version for this component; the request's creator must refresh it against the current version before it can be approved",
      code: "P0001",
    })

    expect(parsed.kind).toBe("go_live_commercial_version_superseded")
    expect(parsed.message).toContain("must refresh it against the current version")
  })

  it("maps GO_LIVE_COMMERCIAL_VERSION_NOT_STALE to its own kind (PG-057)", () => {
    const parsed = parseGoLiveError({
      message: "GO_LIVE_COMMERCIAL_VERSION_NOT_STALE: this request already references the current active commercial version; there is nothing to refresh",
      code: "P0001",
    })

    expect(parsed.kind).toBe("go_live_commercial_version_not_stale")
  })

  it("wraps into a GoLiveOperationError whose .message is the safe text a UI can show directly", () => {
    const error = new GoLiveOperationError(
      parseGoLiveError({ message: "GO_LIVE_REQUEST_SUBMIT_NOT_OWNER: only the creator of request req-2 may submit it" })
    )

    expect(error.message).toBe("only the creator of request req-2 may submit it")
    expect(error.goLiveError.kind).toBe("go_live_request_submit_not_owner")
  })

  it("maps WORKFLOW_NO_ACTIVE_DEFINITION to its own kind instead of the generic unknown fallback (L-021)", () => {
    const parsed = parseGoLiveError({
      message:
        "WORKFLOW_NO_ACTIVE_DEFINITION: no active workflow definition with a published version exists for go_live; a new request cannot be created until one is activated",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_no_active_definition")
    expect(parsed.message).toBe(
      "no active workflow definition with a published version exists for go_live; a new request cannot be created until one is activated"
    )
  })

  it("maps GO_LIVE_ACTIVE_REQUEST_ALREADY_EXISTS to its own kind instead of the generic unknown fallback (Batch 16-18 revalidation, H-044 fix)", () => {
    const parsed = parseGoLiveError({
      message:
        "GO_LIVE_ACTIVE_REQUEST_ALREADY_EXISTS: an active Go Live request already exists for this commercial line item; cancel it first or continue with the existing one",
      code: "P0001",
    })

    expect(parsed.kind).toBe("go_live_active_request_already_exists")
    expect(parsed.message).toBe(
      "an active Go Live request already exists for this commercial line item; cancel it first or continue with the existing one"
    )
  })

  it("still falls back to unknown for a genuinely unrecognized token", () => {
    const parsed = parseGoLiveError({ message: "SOME_FUTURE_TOKEN_NOT_YET_MAPPED: detail" })
    expect(parsed.kind).toBe("unknown")
  })

  it("maps WORKFLOW_REQUEST_ALREADY_DECIDED to its own kind (PG-036, concurrent-approval loser consistency)", () => {
    const parsed = parseGoLiveError({
      message: "WORKFLOW_REQUEST_ALREADY_DECIDED: this request was already approved by someone else. Refresh to see the current status.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_request_already_decided")
    expect(parsed.message).toBe("this request was already approved by someone else. Refresh to see the current status.")
  })

  it("maps WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION to its own kind (PG-037, cross-node distinct-approver control)", () => {
    const parsed = parseGoLiveError({
      message: "WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION: you already approved an earlier step of this request. A different approver must decide this step.",
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_segregation_of_duties_violation")
    expect(parsed.message).toBe("you already approved an earlier step of this request. A different approver must decide this step.")
  })

  it("maps WORKFLOW_TEAM_INACTIVE to its own kind with the standardized cross-domain message, not the RPC's own per-node detail (PG-056)", () => {
    const parsed = parseGoLiveError({
      message:
        'WORKFLOW_TEAM_INACTIVE: this request cannot be routed to its next step ("node_3"), whose responsible team has been deactivated. Ask a Workflow Admin to reassign that node to an active team before this request can advance.',
      code: "P0001",
    })

    expect(parsed.kind).toBe("workflow_team_inactive")
    expect(parsed.message).toBe(defaultMessageForCode("WORKFLOW_TEAM_INACTIVE"))
    expect(parsed.message).not.toContain("node_3")
  })
})
