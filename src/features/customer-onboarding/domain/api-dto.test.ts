import { describe, expect, it } from "vitest"

import { toOnboardingCaseDto } from "./api-dto"
import { toCustomerOnboardingCase } from "./case-mappers"
import type { CustomerOnboardingCaseRow, SubmissionRevisionRow } from "../data/case-row-types"

function baseCaseRow(overrides: Partial<CustomerOnboardingCaseRow> = {}): CustomerOnboardingCaseRow {
  return {
    request_id: "req-1",
    case_number: 42,
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
    created_at: "2026-09-14T00:00:00Z",
    created_by: "actor-1",
    updated_at: "2026-09-14T00:00:00Z",
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
    raw_data: { customer_legal_entity_name: "Fictional Nexus Test Co Pvt Ltd", brand_business_name: "Fictional Nexus Test" },
    effective_data: null,
    created_at: "2026-09-14T00:00:00Z",
    created_by: "actor-1",
    updated_at: "2026-09-14T00:00:00Z",
    updated_by: "actor-1",
    submitted_at: null,
    submitted_by: null,
    ...overrides,
  }
}

describe("toOnboardingCaseDto", () => {
  it("uses the formatted Human-Friendly ID, never the raw sequence integer", () => {
    const onboardingCase = toCustomerOnboardingCase(baseCaseRow(), [draftRevisionRow()])
    const dto = toOnboardingCaseDto(onboardingCase)
    expect(dto.caseNumber).toBe("CO-000042")
    expect(dto.id).toBe("req-1")
  })

  it("never exposes the raw SurveyJS form field keys, only the DTO's own legalName/brand", () => {
    const onboardingCase = toCustomerOnboardingCase(baseCaseRow(), [draftRevisionRow()])
    const dto = toOnboardingCaseDto(onboardingCase)
    expect(dto.legalName).toBe("Fictional Nexus Test Co Pvt Ltd")
    expect(dto.brand).toBe("Fictional Nexus Test")
    expect(dto).not.toHaveProperty("customer_legal_entity_name")
  })

  it("never fabricates a legal name when the field was never entered", () => {
    const onboardingCase = toCustomerOnboardingCase(baseCaseRow(), [draftRevisionRow({ raw_data: {} })])
    const dto = toOnboardingCaseDto(onboardingCase)
    expect(dto.legalName).toBe("")
    expect(dto.brand).toBeNull()
  })
})
