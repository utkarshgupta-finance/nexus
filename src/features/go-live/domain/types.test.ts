import { describe, expect, it } from "vitest"

import { deriveLineItemGoLiveStatus, currentGoLiveRequestForLineItem, formatGoLiveRequestId } from "./types"
import type { GoLiveRequest, GoLiveRequestStatus } from "./types"

function request(overrides: Partial<GoLiveRequest> & { status: GoLiveRequestStatus }): GoLiveRequest {
  return {
    id: "req-1",
    requestNumber: 1,
    customerId: "cust-1",
    commercialConfigurationId: "cc-1",
    commercialVersionId: "cv-1",
    stableComponentKey: "key-1",
    goLiveDate: "2026-07-01",
    prorateFirstMonth: false,
    customerConfirmationStatus: "pending",
    workflowVersionId: null,
    rowVersion: 1,
    comment: null,
    sentBackReason: null,
    sentBackBy: null,
    sentBackAt: null,
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelledReason: null,
    createdBy: "actor-1",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedBy: null,
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("deriveLineItemGoLiveStatus", () => {
  it("is NO_GO_LIVE when no request exists for the line item at all", () => {
    expect(deriveLineItemGoLiveStatus([])).toBe("NO_GO_LIVE")
  })

  it("is LIVE once any request for the line item is approved, even alongside older cancelled attempts", () => {
    const requests = [request({ id: "r1", status: "cancelled" }), request({ id: "r2", status: "approved" })]
    expect(deriveLineItemGoLiveStatus(requests)).toBe("LIVE")
  })

  it("is GO_LIVE_PENDING while a request is in draft/submitted/sent_back/resubmitted", () => {
    for (const status of ["draft", "submitted", "sent_back", "resubmitted"] as GoLiveRequestStatus[]) {
      expect(deriveLineItemGoLiveStatus([request({ status })])).toBe("GO_LIVE_PENDING")
    }
  })

  it("is CANCELLED when every request for the line item was cancelled and none ever approved", () => {
    expect(deriveLineItemGoLiveStatus([request({ status: "cancelled" })])).toBe("CANCELLED")
  })
})

describe("currentGoLiveRequestForLineItem", () => {
  it("returns null when there are no requests", () => {
    expect(currentGoLiveRequestForLineItem([])).toBeNull()
  })

  it("prefers the approved request over any other status", () => {
    const approved = request({ id: "approved-one", status: "approved" })
    const draft = request({ id: "draft-one", status: "draft", createdAt: "2027-01-01T00:00:00.000Z" })
    expect(currentGoLiveRequestForLineItem([draft, approved])?.id).toBe("approved-one")
  })

  it("returns the most recently created non-cancelled request when none is approved", () => {
    const older = request({ id: "older", status: "sent_back", createdAt: "2026-01-01T00:00:00.000Z" })
    const newer = request({ id: "newer", status: "submitted", createdAt: "2026-02-01T00:00:00.000Z" })
    expect(currentGoLiveRequestForLineItem([older, newer])?.id).toBe("newer")
  })

  it("ignores cancelled requests when a non-cancelled one also exists", () => {
    const cancelled = request({ id: "cancelled-one", status: "cancelled", createdAt: "2026-03-01T00:00:00.000Z" })
    const draft = request({ id: "draft-one", status: "draft", createdAt: "2026-01-01T00:00:00.000Z" })
    expect(currentGoLiveRequestForLineItem([cancelled, draft])?.id).toBe("draft-one")
  })

  it("returns null when every request is cancelled", () => {
    expect(currentGoLiveRequestForLineItem([request({ status: "cancelled" })])).toBeNull()
  })
})

describe("formatGoLiveRequestId", () => {
  it("pads to 6 digits with a GLR- prefix", () => {
    expect(formatGoLiveRequestId(7)).toBe("GLR-000007")
    expect(formatGoLiveRequestId(123456)).toBe("GLR-123456")
  })
})
