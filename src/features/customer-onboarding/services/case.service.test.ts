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
const getCaseByRequestId = vi.fn()
const ensureOnboardingEffectiveDateException = vi.fn()
const approveCase = vi.fn()

vi.mock("../data/case.data", () => ({
  getLatestRevisionForRequest: (...args: unknown[]) => getLatestRevisionForRequest(...args),
  submitCase: (...args: unknown[]) => submitCase(...args),
  listRevisionsForRequest: (...args: unknown[]) => listRevisionsForRequest(...args),
  listApprovedCases: (...args: unknown[]) => listApprovedCases(...args),
  listRevisionsForRequests: (...args: unknown[]) => listRevisionsForRequests(...args),
  getCaseByRequestId: (...args: unknown[]) => getCaseByRequestId(...args),
  ensureOnboardingEffectiveDateException: (...args: unknown[]) => ensureOnboardingEffectiveDateException(...args),
  approveCase: (...args: unknown[]) => approveCase(...args),
}))

const listOnboardingDocuments = vi.fn()
vi.mock("./documents.service", () => ({
  listOnboardingDocuments: (...args: unknown[]) => listOnboardingDocuments(...args),
}))

const listCustomerMaster = vi.fn()
vi.mock("@/features/customers/server", () => ({
  listCustomerMaster: (...args: unknown[]) => listCustomerMaster(...args),
}))

import { submitOnboardingCase, getOnboardingCase, approveOnboardingCase, getOnboardingCaseScope } from "./case.service"

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

/**
 * PD-001 (A-036, Batches 1-13 Ledger Audit product decision closure):
 * getOnboardingCase now only returns a draft to its own creator; every
 * other status is readable by any caller, exactly as before this
 * change. A denied read returns null, identical to a genuinely
 * nonexistent request id.
 */
describe("getOnboardingCase creator-only draft visibility (PD-001, A-036)", () => {
  function caseRow(overrides: Partial<Record<string, unknown>>) {
    return {
      request_id: "req-1",
      case_number: 1,
      status: "draft",
      current_stage_key: "customer_details",
      sent_back_reason: null,
      sent_back_at: null,
      sent_back_by: null,
      sent_back_target_stage_key: null,
      approved_by: null,
      approved_at: null,
      cancelled_by: null,
      cancelled_at: null,
      cancelled_reason: null,
      customer_id: null,
      commercial_configuration_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      created_by: "maker-a",
      updated_at: "2026-01-01T00:00:00.000Z",
      workflow_version_id: null,
      current_workflow_node_key: null,
      ...overrides,
    }
  }

  const ONE_REVISION = [{ revision_number: 1, status: "draft", raw_data: {}, effective_data: null, row_version: 1, created_by: "maker-a", created_at: "2026-01-01T00:00:00.000Z", updated_by: "maker-a", updated_at: "2026-01-01T00:00:00.000Z", submitted_by: null, submitted_at: null }]

  it("returns the case to its own creator while still a draft", async () => {
    getCaseByRequestId.mockResolvedValue(caseRow({}))
    listRevisionsForRequest.mockResolvedValue(ONE_REVISION)
    const result = await getOnboardingCase("req-1", "maker-a")
    expect(result?.requestId).toBe("req-1")
  })

  it("returns null (identical to not-found) for a non-creator while the case is still a draft", async () => {
    getCaseByRequestId.mockResolvedValue(caseRow({}))
    listRevisionsForRequest.mockResolvedValue(ONE_REVISION)
    const result = await getOnboardingCase("req-1", "maker-b")
    expect(result).toBeNull()
  })

  it("returns the case to a non-creator once it has left draft (submitted), matching normal customer.read visibility", async () => {
    getCaseByRequestId.mockResolvedValue(caseRow({ status: "submitted" }))
    listRevisionsForRequest.mockResolvedValue(ONE_REVISION)
    const result = await getOnboardingCase("req-1", "maker-b")
    expect(result?.requestId).toBe("req-1")
  })

  it("returns null for a genuinely nonexistent request id, indistinguishable from a denied draft read", async () => {
    getCaseByRequestId.mockResolvedValue(null)
    listRevisionsForRequest.mockResolvedValue([])
    const result = await getOnboardingCase("no-such-request", "maker-a")
    expect(result).toBeNull()
  })
})

/**
 * Batch 22 (Q-018 incidental defect found and fixed): getOnboardingCaseScope
 * is what document upload/download actions now call to apply the same
 * PD-005 scoping the review page already applies, instead of the plain,
 * global-only permission check they had used before. This guards the
 * exact customerId/businessUnit resolution those actions depend on.
 */
describe("getOnboardingCaseScope (Batch 22, Q-018 incidental defect fix)", () => {
  function scopeCaseRow(overrides: Partial<Record<string, unknown>>) {
    return {
      request_id: "req-1",
      case_number: 1,
      status: "submitted",
      current_stage_key: "approval",
      sent_back_reason: null,
      sent_back_at: null,
      sent_back_by: null,
      sent_back_target_stage_key: null,
      approved_by: null,
      approved_at: null,
      cancelled_by: null,
      cancelled_at: null,
      cancelled_reason: null,
      customer_id: null,
      commercial_configuration_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      created_by: "maker-a",
      updated_at: "2026-01-01T00:00:00.000Z",
      workflow_version_id: null,
      current_workflow_node_key: null,
      ...overrides,
    }
  }

  it("returns null for a genuinely nonexistent request id", async () => {
    getCaseByRequestId.mockResolvedValue(null)
    const scope = await getOnboardingCaseScope("no-such-request")
    expect(scope).toBeNull()
  })

  it("resolves businessUnit from the raw draft form data and a null customerId before approval", async () => {
    getCaseByRequestId.mockResolvedValue(scopeCaseRow({ status: "draft", customer_id: null }))
    getLatestRevisionForRequest.mockResolvedValue({ status: "draft", raw_data: { business_unit: "core" }, effective_data: null })
    const scope = await getOnboardingCaseScope("req-1")
    expect(scope).toEqual({ customerId: null, businessUnit: "core" })
  })

  it("resolves the real customerId once approval has created one, exactly like ReviewDetailRoute's own branch", async () => {
    getCaseByRequestId.mockResolvedValue(scopeCaseRow({ status: "approved", customer_id: "cust-1" }))
    getLatestRevisionForRequest.mockResolvedValue({ status: "submitted", raw_data: {}, effective_data: { values: { business_unit: "core" } } })
    const scope = await getOnboardingCaseScope("req-1")
    expect(scope?.customerId).toBe("cust-1")
  })
})

/**
 * PD-002 (Product Decision Closure, end-to-end verification fix,
 * supabase/migrations/20260930140000_fix_onboarding_effective_date_exception_atomicity.sql):
 * live-testing found that `approve_customer_onboarding_case` could never
 * durably create the `onboarding_effective_date_exceptions` row itself,
 * since a Postgres RPC call is one implicit transaction and the row's
 * insert was in the same statement as the raise that then rolled it
 * back. The fix moves that durable creation to its own RPC
 * (`ensureOnboardingEffectiveDateException`), which the service must
 * call as a genuinely separate, prior statement before `approveCase`.
 * This guards that ordering at the TypeScript call-site level, so a
 * future refactor cannot silently drop or reorder it.
 */
describe("approveOnboardingCase calls ensureOnboardingEffectiveDateException before approveCase (PD-002)", () => {
  const APPROVABLE_REVISION = {
    ...SUBMITTED_REVISION_ROW,
    effective_data: {
      values: {
        customer_legal_entity_name: "PD-002 Regression Co",
        commercial_rate: { billingCurrency: "INR", components: [{ id: "c-1", nature: "non_recurring", pricingModel: "flat_fee", amount: 1000, invoiceTerms: { invoiceFrequency: "one_time", invoiceTiming: null }, revenueRecognition: { method: "full_recognition" } }] },
      },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getLatestRevisionForRequest.mockResolvedValue(APPROVABLE_REVISION)
    listRevisionsForRequest.mockResolvedValue([APPROVABLE_REVISION])
    ensureOnboardingEffectiveDateException.mockResolvedValue(null)
    approveCase.mockResolvedValue({ request_id: "req-1", status: "approved" })
  })

  it("calls ensureOnboardingEffectiveDateException, and only then approveCase, on every finalizing approval", async () => {
    await approveOnboardingCase("req-1", "checker-1", {} as never, "2026-01-01")

    expect(ensureOnboardingEffectiveDateException).toHaveBeenCalledWith("req-1", "2026-01-01", "checker-1")
    expect(approveCase).toHaveBeenCalledTimes(1)
    expect(ensureOnboardingEffectiveDateException.mock.invocationCallOrder[0]).toBeLessThan(approveCase.mock.invocationCallOrder[0])
  })

  it("still calls approveCase even for an ordinary, non-backdated effective_date (ensure is a safe no-op there)", async () => {
    await approveOnboardingCase("req-1", "checker-1", {} as never, "2099-01-01")

    expect(ensureOnboardingEffectiveDateException).toHaveBeenCalledWith("req-1", "2099-01-01", "checker-1")
    expect(approveCase).toHaveBeenCalledTimes(1)
  })
})
