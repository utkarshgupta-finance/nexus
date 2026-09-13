import { describe, expect, it } from "vitest"

import { toCustomerChangeRequest, toProposedValues } from "./change-request-mappers"
import type { CustomerChangeRequestRow, CustomerChangeRequestRequirementRow, SubmissionRevisionRow } from "../data/change-request-row-types"

const BASE_ROW: CustomerChangeRequestRow = {
  request_id: "req-1",
  customer_id: "cust-1",
  status: "submitted",
  reason: "Segment realignment",
  effective_date: "2026-10-01",
  base_customer_row_version: 4,
  sent_back_reason: null,
  sent_back_by: null,
  sent_back_at: null,
  decided_by: null,
  decided_at: null,
  decision_reason: null,
  row_version: 1,
  created_at: "2026-09-01T00:00:00.000Z",
  created_by: "user-a",
  updated_at: "2026-09-01T00:00:00.000Z",
  updated_by: "user-a",
}

describe("toProposedValues", () => {
  it("unwraps a submitted revision's effective_data.values", () => {
    const revision: SubmissionRevisionRow = {
      id: "rev-1",
      request_id: "req-1",
      revision_number: 1,
      status: "submitted",
      raw_data: { segment: "sme" },
      effective_data: { values: { segment: "enterprise" }, applicability: {} },
      row_version: 1,
      created_at: "",
      created_by: null,
      updated_at: "",
      updated_by: null,
      submitted_by: null,
      submitted_at: null,
    }
    expect(toProposedValues(revision)).toEqual({ segment: "enterprise" })
  })

  it("falls back to raw_data for a draft revision, and {} for no revision", () => {
    const draft: SubmissionRevisionRow = {
      id: "rev-2",
      request_id: "req-1",
      revision_number: 1,
      status: "draft",
      raw_data: { segment: "sme" },
      effective_data: null,
      row_version: 1,
      created_at: "",
      created_by: null,
      updated_at: "",
      updated_by: null,
      submitted_by: null,
      submitted_at: null,
    }
    expect(toProposedValues(draft)).toEqual({ segment: "sme" })
    expect(toProposedValues(null)).toEqual({})
  })
})

describe("toCustomerChangeRequest", () => {
  it("maps a row with no send-back history to sentBack: null", () => {
    const result = toCustomerChangeRequest(BASE_ROW, null, [])
    expect(result.sentBack).toBeNull()
    expect(result.requestId).toBe("req-1")
    expect(result.customerId).toBe("cust-1")
    expect(result.baseCustomerRowVersion).toBe(4)
  })

  it("maps sent-back fields into a sentBack object when present", () => {
    const row: CustomerChangeRequestRow = { ...BASE_ROW, status: "sent_back", sent_back_reason: "Confirm with Finance", sent_back_by: "user-b", sent_back_at: "2026-09-02T00:00:00.000Z" }
    const result = toCustomerChangeRequest(row, null, [])
    expect(result.sentBack).toEqual({ reason: "Confirm with Finance", sentBackBy: "user-b", sentBackAt: "2026-09-02T00:00:00.000Z" })
  })

  it("maps requirement rows into domain requirements", () => {
    const requirementRow: CustomerChangeRequestRequirementRow = {
      id: "req-row-1",
      customer_change_request_id: "req-1",
      kind: "approval",
      role_code: "FINANCE_HEAD",
      scope_label: null,
      evidence_type: null,
      reason: "Segment change requires Finance Head approval.",
      matched_rule_keys: ["segment_change_requires_finance_approval"],
      created_at: "",
    }
    const result = toCustomerChangeRequest(BASE_ROW, null, [requirementRow])
    expect(result.requirements).toEqual([
      {
        kind: "approval",
        roleCode: "FINANCE_HEAD",
        scopeLabel: null,
        evidenceType: null,
        reason: "Segment change requires Finance Head approval.",
        matchedRuleKeys: ["segment_change_requires_finance_approval"],
      },
    ])
  })
})
