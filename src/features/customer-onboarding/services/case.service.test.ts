import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Server-side Submit validation regression test (Product Gap found live
 * during Batch 7's A-004/A-005/A-006). Before this fix,
 * `submit_customer_onboarding_case` only checked case status; every
 * field-completeness and duplicate-GST/PAN check lived exclusively in
 * the browser UI (`customer-onboarding-page.tsx`'s `handleSubmit`),
 * confirmed live by calling the RPC directly for a completely empty
 * draft: it succeeded, advancing status to `submitted` and the workflow
 * to its first Approval node. This test guards `submitOnboardingCase`'s
 * new `validateOnboardingCaseReadyForSubmit` step directly, mocking only
 * the data layer, never the pure `stage-status.ts`/`duplicate-detection.ts`
 * functions it deliberately reuses unchanged from the browser's own
 * validation.
 */
vi.mock("server-only", () => ({}))

const getLatestRevisionForRequest = vi.fn()
const submitCase = vi.fn()
const listRevisionsForRequest = vi.fn()
const listApprovedCases = vi.fn()
const listRevisionsForRequests = vi.fn()

vi.mock("../data/case.data", () => ({
  getLatestRevisionForRequest: (...args: unknown[]) => getLatestRevisionForRequest(...args),
  submitCase: (...args: unknown[]) => submitCase(...args),
  listRevisionsForRequest: (...args: unknown[]) => listRevisionsForRequest(...args),
  listApprovedCases: (...args: unknown[]) => listApprovedCases(...args),
  listRevisionsForRequests: (...args: unknown[]) => listRevisionsForRequests(...args),
}))

const listOnboardingDocuments = vi.fn()
vi.mock("./documents.service", () => ({
  listOnboardingDocuments: (...args: unknown[]) => listOnboardingDocuments(...args),
}))

const listCustomerMaster = vi.fn()
vi.mock("@/features/customers/server", () => ({
  listCustomerMaster: (...args: unknown[]) => listCustomerMaster(...args),
}))

import { submitOnboardingCase } from "./case.service"

const COMPLETE_CUSTOMER_DETAILS = {
  customer_legal_entity_name: "Batch7 Test Co",
  brand_business_name: "Batch7",
  country: "IN",
  address: "1 Test Street",
  pincode: "560001",
  industry_category: "logistics",
  segment: "enterprise",
  business_unit: "core",
  primary_contact_name: "Test Contact",
  primary_contact_email: "contact@example.test",
  primary_contact_phone_country_code: "+91",
  primary_contact_phone_number: "9999999999",
  primary_contact_designation: "Manager",
}

const COMPLETE_INDIA_TAX_FIELDS = {
  gst_number: "27ABCDE1234F1Z5",
  pan: "ABCDE1234F",
}

function draftRow(rawData: Record<string, unknown>) {
  return { status: "draft", raw_data: rawData }
}

const SUBMITTED_REVISION_ROW = {
  revision_number: 1,
  status: "submitted",
  raw_data: {},
  effective_data: { values: {} },
  row_version: 1,
  created_by: "actor-1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_by: "actor-1",
  updated_at: "2026-01-01T00:00:00.000Z",
  submitted_by: "actor-1",
  submitted_at: "2026-01-01T00:00:00.000Z",
}

describe("submitOnboardingCase server-side validation (Product Gap Closure, Batch 7)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listApprovedCases.mockResolvedValue([])
    listRevisionsForRequests.mockResolvedValue([])
    listCustomerMaster.mockResolvedValue([])
    listOnboardingDocuments.mockResolvedValue([])
    listRevisionsForRequest.mockResolvedValue([])
    submitCase.mockResolvedValue({ request_id: "req-1", status: "submitted" })
  })

  it("rejects submit when Customer Details is completely empty, closing the raw-RPC-bypass gap", async () => {
    getLatestRevisionForRequest.mockResolvedValue(draftRow({}))
    await expect(submitOnboardingCase("req-1", "actor-1")).rejects.toThrow(/Customer Details is incomplete/)
    expect(submitCase).not.toHaveBeenCalled()
  })

  it("rejects submit when Customer Details is complete but Tax & Registration is missing", async () => {
    getLatestRevisionForRequest.mockResolvedValue(draftRow({ ...COMPLETE_CUSTOMER_DETAILS }))
    await expect(submitOnboardingCase("req-1", "actor-1")).rejects.toThrow(/Tax & Registration is incomplete/)
    expect(submitCase).not.toHaveBeenCalled()
  })

  it("rejects submit when required Tax & Registration documents are missing even though the fields are filled", async () => {
    getLatestRevisionForRequest.mockResolvedValue(draftRow({ ...COMPLETE_CUSTOMER_DETAILS, ...COMPLETE_INDIA_TAX_FIELDS }))
    listOnboardingDocuments.mockResolvedValue([])
    await expect(submitOnboardingCase("req-1", "actor-1")).rejects.toThrow(/documents are missing/)
    expect(submitCase).not.toHaveBeenCalled()
  })

  it("rejects submit on a hard GST duplicate match against an existing customer", async () => {
    getLatestRevisionForRequest.mockResolvedValue(draftRow({ ...COMPLETE_CUSTOMER_DETAILS, ...COMPLETE_INDIA_TAX_FIELDS }))
    listOnboardingDocuments.mockResolvedValue([
      { documentType: "gst_certificate" },
      { documentType: "pan_card" },
      { documentType: "tan_card" },
    ])
    listApprovedCases.mockResolvedValue([{ request_id: "req-existing", customer_id: "cust-existing" }])
    listRevisionsForRequests.mockResolvedValue([
      { request_id: "req-existing", status: "submitted", raw_data: {}, effective_data: { values: { gst_number: COMPLETE_INDIA_TAX_FIELDS.gst_number } } },
    ])
    listCustomerMaster.mockResolvedValue([{ record: { id: "cust-existing", key: "existing-co", name: "Existing Co", brandName: null } }])

    await expect(submitOnboardingCase("req-1", "actor-1")).rejects.toThrow(/GST or PAN already belongs to an existing customer/)
    expect(submitCase).not.toHaveBeenCalled()
  })

  it("allows submit through to the RPC when Customer Details, Tax & Registration, documents are complete and no duplicate exists", async () => {
    getLatestRevisionForRequest.mockResolvedValue(draftRow({ ...COMPLETE_CUSTOMER_DETAILS, ...COMPLETE_INDIA_TAX_FIELDS }))
    listOnboardingDocuments.mockResolvedValue([
      { documentType: "gst_certificate" },
      { documentType: "pan_card" },
      { documentType: "tan_card" },
    ])
    listRevisionsForRequest.mockResolvedValue([SUBMITTED_REVISION_ROW])

    await submitOnboardingCase("req-1", "actor-1")
    expect(submitCase).toHaveBeenCalledWith("req-1", "actor-1")
  })

  it("does not re-validate when the case is not currently a draft revision (e.g. re-entrant call on an already-submitted case), leaving the RPC's own status guard as the authority", async () => {
    getLatestRevisionForRequest.mockResolvedValue({ status: "submitted", raw_data: {} })
    listRevisionsForRequest.mockResolvedValue([SUBMITTED_REVISION_ROW])
    await submitOnboardingCase("req-1", "actor-1")
    expect(submitCase).toHaveBeenCalledWith("req-1", "actor-1")
  })
})
