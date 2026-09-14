import { describe, expect, it } from "vitest"

import { toCustomerOnboardingCase, toRevision, groupRevisionsByRequestId } from "./case-mappers"
import type { CustomerOnboardingCaseRow, SubmissionRevisionRow } from "../data/case-row-types"

/**
 * These prove the exact row->domain reconstruction Customer Lifecycle V1's
 * real persistence depends on: a submitted revision's actual field data
 * lives inside effective_data.values (see submit_customer_onboarding_case's
 * own migration comment), and this is the one place that unwraps it back
 * to the flat shape ../domain/case.ts's pure functions and the onboarding
 * UI already expect.
 */

function baseCaseRow(overrides: Partial<CustomerOnboardingCaseRow> = {}): CustomerOnboardingCaseRow {
  return {
    request_id: "req-1",
    case_number: 1,
    status: "draft",
    current_stage_key: "customer_details",
    sent_back_reason: null,
    sent_back_by: null,
    sent_back_at: null,
    sent_back_target_stage_key: null,
    approved_by: null,
    approved_at: null,
    customer_id: null,
    commercial_configuration_id: null,
    row_version: 1,
    created_at: "2026-09-13T00:00:00Z",
    created_by: "actor-1",
    updated_at: "2026-09-13T00:00:00Z",
    updated_by: "actor-1",
    ...overrides,
  }
}

function draftRevisionRow(overrides: Partial<SubmissionRevisionRow> = {}): SubmissionRevisionRow {
  return {
    id: "rev-1",
    request_id: "req-1",
    revision_number: 1,
    status: "draft",
    row_version: 1,
    submission_contract_version: 1,
    raw_data: { customer_legal_entity_name: "Aurora Consumer Labs Pvt Ltd" },
    effective_data: null,
    created_at: "2026-09-13T00:00:00Z",
    created_by: "actor-1",
    updated_at: "2026-09-13T00:00:00Z",
    updated_by: "actor-1",
    submitted_at: null,
    submitted_by: null,
    ...overrides,
  }
}

describe("toRevision", () => {
  it("reads a draft revision's data straight from raw_data", () => {
    const revision = toRevision(draftRevisionRow())
    expect(revision.status).toBe("draft")
    expect(revision.data).toEqual({ customer_legal_entity_name: "Aurora Consumer Labs Pvt Ltd" })
  })

  it("unwraps a submitted revision's data from effective_data.values, never returning the wrapper itself", () => {
    const revision = toRevision(
      draftRevisionRow({
        status: "submitted",
        submitted_at: "2026-09-13T01:00:00Z",
        submitted_by: "actor-1",
        effective_data: { values: { customer_legal_entity_name: "Aurora Consumer Labs Pvt Ltd", segment: "enterprise" }, applicability: {} },
      })
    )
    expect(revision.data).toEqual({ customer_legal_entity_name: "Aurora Consumer Labs Pvt Ltd", segment: "enterprise" })
    expect(revision.data).not.toHaveProperty("values")
    expect(revision.data).not.toHaveProperty("applicability")
  })
})

describe("toCustomerOnboardingCase", () => {
  it("uses the last revision in the (oldest-first) array as the current revision", () => {
    const row = baseCaseRow({ status: "resubmitted" })
    const revisions = [
      draftRevisionRow({ revision_number: 1, status: "submitted", submitted_at: "t1", submitted_by: "a", effective_data: { values: { a: 1 }, applicability: {} } }),
      draftRevisionRow({ id: "rev-2", revision_number: 2, status: "submitted", submitted_at: "t2", submitted_by: "a", effective_data: { values: { a: 2 }, applicability: {} } }),
    ]

    const domainCase = toCustomerOnboardingCase(row, revisions)

    expect(domainCase.currentRevision.revisionNumber).toBe(2)
    expect(domainCase.currentRevision.data).toEqual({ a: 2 })
  })

  it("maps sent-back fields into the sentBack object only when present, otherwise null", () => {
    const withSentBack = toCustomerOnboardingCase(
      baseCaseRow({
        status: "sent_back",
        sent_back_reason: "Add tax registration",
        sent_back_by: "reviewer-1",
        sent_back_at: "2026-09-13T02:00:00Z",
        sent_back_target_stage_key: "tax_registration",
      }),
      [draftRevisionRow()]
    )
    expect(withSentBack.sentBack).toEqual({
      reason: "Add tax registration",
      sentBackBy: "reviewer-1",
      sentBackAt: "2026-09-13T02:00:00Z",
      targetStageKey: "tax_registration",
    })

    const withoutSentBack = toCustomerOnboardingCase(baseCaseRow(), [draftRevisionRow()])
    expect(withoutSentBack.sentBack).toBeNull()
  })

  it("carries the case-level status through unchanged (draft/submitted/sent_back/resubmitted/approved)", () => {
    for (const status of ["draft", "submitted", "sent_back", "resubmitted", "approved"] as const) {
      const domainCase = toCustomerOnboardingCase(baseCaseRow({ status }), [draftRevisionRow()])
      expect(domainCase.status).toBe(status)
    }
  })

  it("a submitted or resubmitted case has no Customer Master identity yet (Customer Lifecycle V1 UX pass, defect §3: submitted is never a Customer Master)", () => {
    for (const status of ["submitted", "resubmitted"] as const) {
      const domainCase = toCustomerOnboardingCase(baseCaseRow({ status }), [draftRevisionRow({ status: "submitted", submitted_at: "t1", submitted_by: "a" })])
      expect(domainCase.customerId).toBeNull()
      expect(domainCase.commercialConfigurationId).toBeNull()
    }
  })

  it("maps customer_id/commercial_configuration_id straight through, null until approval sets them", () => {
    const beforeApproval = toCustomerOnboardingCase(baseCaseRow(), [draftRevisionRow()])
    expect(beforeApproval.customerId).toBeNull()
    expect(beforeApproval.commercialConfigurationId).toBeNull()

    const afterApproval = toCustomerOnboardingCase(
      baseCaseRow({ status: "approved", customer_id: "customer-1", commercial_configuration_id: "config-1" }),
      [draftRevisionRow()]
    )
    expect(afterApproval.customerId).toBe("customer-1")
    expect(afterApproval.commercialConfigurationId).toBe("config-1")
  })
})

describe("groupRevisionsByRequestId", () => {
  it("groups a flat, multi-request read back into oldest-first per-request arrays (the batched replacement for one getLatestRevisionForRequest call per row)", () => {
    const grouped = groupRevisionsByRequestId([
      draftRevisionRow({ id: "rev-1a", request_id: "req-1", revision_number: 1 }),
      draftRevisionRow({ id: "rev-2a", request_id: "req-2", revision_number: 1 }),
      draftRevisionRow({ id: "rev-1b", request_id: "req-1", revision_number: 2 }),
    ])
    expect(grouped.get("req-1")?.map((r) => r.id)).toEqual(["rev-1a", "rev-1b"])
    expect(grouped.get("req-2")?.map((r) => r.id)).toEqual(["rev-2a"])
  })

  it("has no entry at all for a request with zero revisions", () => {
    const grouped = groupRevisionsByRequestId([draftRevisionRow({ request_id: "req-1" })])
    expect(grouped.has("req-2")).toBe(false)
  })
})
