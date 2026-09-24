import { describe, expect, it } from "vitest"

import { parseGoLiveError, GoLiveOperationError } from "./go-live-errors"

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

  it("still falls back to unknown for a genuinely unrecognized token", () => {
    const parsed = parseGoLiveError({ message: "SOME_FUTURE_TOKEN_NOT_YET_MAPPED: detail" })
    expect(parsed.kind).toBe("unknown")
  })
})
