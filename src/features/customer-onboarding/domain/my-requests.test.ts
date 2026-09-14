import { describe, expect, it } from "vitest"

import { reviewState, primaryAction, sortMyRequestRows, countSendBacksByRequestId } from "./my-requests"
import type { MyRequestRow } from "./my-requests"

function row(overrides: Partial<MyRequestRow>): MyRequestRow {
  return {
    requestId: "req-1",
    caseNumber: 1,
    legalName: "Acme",
    brandName: "Acme Retail",
    status: "draft",
    currentStageKey: "customer_details",
    revisionNumber: 1,
    sentBackCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    customerKey: null,
    ...overrides,
  }
}

describe("reviewState", () => {
  it("shows which stage a draft is currently on", () => {
    expect(reviewState("draft", "tax_registration")).toBe("Working on Tax & Registration")
  })

  it("shows Pending Approval for both submitted and resubmitted", () => {
    expect(reviewState("submitted", "customer_details")).toBe("Pending Approval")
    expect(reviewState("resubmitted", "customer_details")).toBe("Pending Approval")
  })

  it("shows Needs Your Attention for sent_back", () => {
    expect(reviewState("sent_back", "customer_details")).toBe("Needs Your Attention")
  })

  it("shows Completed for approved", () => {
    expect(reviewState("approved", "agreement_approval")).toBe("Completed")
  })

  it("shows Cancelled for a discarded draft (task Phase C)", () => {
    expect(reviewState("cancelled", "customer_details")).toBe("Cancelled")
  })
})

describe("primaryAction", () => {
  it("is Continue for a draft", () => {
    expect(primaryAction(row({ status: "draft" }))).toEqual({ label: "Continue", href: "/forms/customer-onboarding/req-1" })
  })

  it("is Review & Resubmit for a sent-back request (task spec: Sent Back discoverability)", () => {
    expect(primaryAction(row({ status: "sent_back" }))).toEqual({ label: "Review & Resubmit", href: "/forms/customer-onboarding/req-1" })
  })

  it("is View for submitted and resubmitted, read-only", () => {
    expect(primaryAction(row({ status: "submitted" }))).toEqual({ label: "View", href: "/forms/customer-onboarding/req-1" })
    expect(primaryAction(row({ status: "resubmitted" }))).toEqual({ label: "View", href: "/forms/customer-onboarding/req-1" })
  })

  it("is Open Customer for an approved request once the customer key resolved", () => {
    expect(primaryAction(row({ status: "approved", customerKey: "acme-retail" }))).toEqual({ label: "Open Customer", href: "/customers/acme-retail" })
  })

  it("falls back to View for an approved request whose customer key could not be resolved", () => {
    expect(primaryAction(row({ status: "approved", customerKey: null }))).toEqual({ label: "View", href: "/forms/customer-onboarding/req-1" })
  })

  it("is View, read-only, for a cancelled draft (task Phase C: historically visible, never re-editable)", () => {
    expect(primaryAction(row({ status: "cancelled" }))).toEqual({ label: "View", href: "/forms/customer-onboarding/req-1" })
  })
})

describe("sortMyRequestRows", () => {
  it("prioritizes Sent Back, then Draft, then Submitted/Resubmitted, then Approved", () => {
    const rows = [
      row({ requestId: "approved", status: "approved", updatedAt: "2026-01-05T00:00:00.000Z" }),
      row({ requestId: "submitted", status: "submitted", updatedAt: "2026-01-05T00:00:00.000Z" }),
      row({ requestId: "draft", status: "draft", updatedAt: "2026-01-05T00:00:00.000Z" }),
      row({ requestId: "sent_back", status: "sent_back", updatedAt: "2026-01-05T00:00:00.000Z" }),
    ]
    expect(sortMyRequestRows(rows).map((r) => r.requestId)).toEqual(["sent_back", "draft", "submitted", "approved"])
  })

  it("breaks ties within the same priority by most recently updated first", () => {
    const rows = [
      row({ requestId: "older", status: "draft", updatedAt: "2026-01-01T00:00:00.000Z" }),
      row({ requestId: "newer", status: "draft", updatedAt: "2026-01-05T00:00:00.000Z" }),
    ]
    expect(sortMyRequestRows(rows).map((r) => r.requestId)).toEqual(["newer", "older"])
  })

  it("never mutates the input array", () => {
    const rows = [row({ requestId: "a" }), row({ requestId: "b" })]
    const copy = [...rows]
    sortMyRequestRows(rows)
    expect(rows).toEqual(copy)
  })
})

describe("countSendBacksByRequestId", () => {
  it("counts each request's send-backs from a flat batch read (task spec: never a manually incremented counter)", () => {
    const counts = countSendBacksByRequestId([
      { request_id: "req-1" },
      { request_id: "req-2" },
      { request_id: "req-1" },
    ])
    expect(counts.get("req-1")).toBe(2)
    expect(counts.get("req-2")).toBe(1)
  })

  it("has no entry at all for a request that was never sent back (treat a missing key as 0)", () => {
    const counts = countSendBacksByRequestId([{ request_id: "req-1" }])
    expect(counts.has("req-2")).toBe(false)
  })
})
