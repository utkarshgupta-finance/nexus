import "server-only"

import * as caseData from "../data/case.data"
import { toCustomerOnboardingCase, groupRevisionsByRequestId } from "../domain/case-mappers"
import { countSendBacksByRequestId } from "../domain/my-requests"
import { newId } from "../domain/commercial-rate"
import { mapOnboardingComponentToCommercialComponentInsert } from "../domain/commercial-configuration-promotion"
import type { CommercialRateDraft } from "../domain/commercial-rate"
import type { CustomerOnboardingCase, OnboardingOrigin } from "../domain/types"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

/**
 * Application service for the real, database-backed Customer Onboarding
 * Case lifecycle (Customer Lifecycle V1). Thin orchestration over
 * ../data/case.data.ts, exactly matching
 * src/features/commercial/services/configuration.service.ts's own shape:
 * no business logic lives here beyond composing a small number of already
 * governed RPC calls and mapping their rows back to the Nexus-owned
 * ./domain/types.ts contract.
 */

const CUSTOMER_LEGAL_NAME_FIELD = "customer_legal_entity_name"
const BRAND_NAME_FIELD = "brand_business_name"
const COMMERCIAL_RATE_FIELD = "commercial_rate"
const GST_NUMBER_FIELD = "gst_number"
const PAN_FIELD = "pan"

/** URL/key-safe slug: lowercase, non-alphanumeric runs collapsed to one hyphen, no leading/trailing hyphen. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function getOnboardingCase(requestId: string): Promise<CustomerOnboardingCase | null> {
  const [row, revisions] = await Promise.all([caseData.getCaseByRequestId(requestId), caseData.listRevisionsForRequest(requestId)])
  if (!row || revisions.length === 0) return null
  return toCustomerOnboardingCase(row, revisions)
}

async function createOnboardingCase(actorUserId: string): Promise<CustomerOnboardingCase> {
  const requestId = newId()
  const row = await caseData.createCase({ newRequestId: requestId, initialRawData: {}, actorUserId })
  const revisions = await caseData.listRevisionsForRequest(requestId)
  return toCustomerOnboardingCase(row, revisions)
}

async function saveOnboardingDraft(
  requestId: string,
  rawData: Record<string, unknown>,
  currentStageKey: string,
  actorUserId: string
): Promise<CustomerOnboardingCase> {
  const row = await caseData.saveDraft({ requestId, rawData, currentStageKey, actorUserId })
  const revisions = await caseData.listRevisionsForRequest(requestId)
  return toCustomerOnboardingCase(row, revisions)
}

/** Serves both a first Submit and a post-send-back Resubmit: the RPC itself derives which one applies from the case's current status. */
async function submitOnboardingCase(requestId: string, actorUserId: string): Promise<CustomerOnboardingCase> {
  const row = await caseData.submitCase(requestId, actorUserId)
  const revisions = await caseData.listRevisionsForRequest(requestId)
  return toCustomerOnboardingCase(row, revisions)
}

async function sendBackOnboardingCase(
  requestId: string,
  reason: string,
  targetStageKey: string | null,
  actorUserId: string,
  fieldComments?: { fieldKey: string; comment: string }[]
): Promise<CustomerOnboardingCase> {
  const row = await caseData.sendBackCase({ requestId, reason, targetStageKey, actorUserId, fieldComments })
  const revisions = await caseData.listRevisionsForRequest(requestId)
  return toCustomerOnboardingCase(row, revisions)
}

/** My Requests (task spec): every case this requester created, including drafts, unlike the shared Approvals inbox which deliberately excludes drafts (see platform/approvals/domain/inbox.ts's bucketForStatus). Revisions for every case are resolved in one batched query, not one round trip per case. */
async function listOnboardingCasesCreatedBy(appUserId: string): Promise<CustomerOnboardingCase[]> {
  const rows = await caseData.listCasesCreatedBy(appUserId)
  const revisionsByRequestId = groupRevisionsByRequestId(await caseData.listRevisionsForRequests(rows.map((row) => row.request_id)))
  const cases: CustomerOnboardingCase[] = []
  for (const row of rows) {
    const revisions = revisionsByRequestId.get(row.request_id) ?? []
    if (revisions.length === 0) continue
    cases.push(toCustomerOnboardingCase(row, revisions))
  }
  return cases
}

type MyOnboardingRequestEntry = {
  requestId: string
  caseNumber: number
  status: CustomerOnboardingCase["status"]
  currentStageKey: CustomerOnboardingCase["currentStageKey"]
  legalName: string
  brandName: string
  revisionNumber: number
  customerId: string | null
  createdAt: string
  updatedAt: string
}

/** My Requests' page-ready rows: pulls the two display fields (legal name, brand) out of the current revision's raw form data, the same extraction `toReviewQueueEntries` already does for Approvals, so the page itself never needs to know the onboarding form's own field keys. */
async function listMyOnboardingRequests(appUserId: string): Promise<MyOnboardingRequestEntry[]> {
  const cases = await listOnboardingCasesCreatedBy(appUserId)
  return cases.map((onboardingCase) => {
    const values = onboardingCase.currentRevision.data
    return {
      requestId: onboardingCase.requestId,
      caseNumber: onboardingCase.caseNumber,
      status: onboardingCase.status,
      currentStageKey: onboardingCase.currentStageKey,
      legalName: typeof values[CUSTOMER_LEGAL_NAME_FIELD] === "string" ? (values[CUSTOMER_LEGAL_NAME_FIELD] as string) : "",
      brandName: typeof values[BRAND_NAME_FIELD] === "string" ? (values[BRAND_NAME_FIELD] as string) : "",
      revisionNumber: onboardingCase.currentRevision.revisionNumber,
      customerId: onboardingCase.customerId,
      createdAt: onboardingCase.createdAt,
      updatedAt: onboardingCase.updatedAt,
    }
  })
}

type OnboardingSendBackEntry = { revisionNumber: number; reason: string; sentBackBy: string | null; sentBackAt: string }

/** Oldest first: the Timeline reads chronologically, and `.length` is the requester-facing Send Back count (task spec: never a manually incremented counter). */
async function listOnboardingSendBacks(requestId: string): Promise<OnboardingSendBackEntry[]> {
  const rows = await caseData.listSendBacksForRequest(requestId)
  return rows.map((row) => ({ revisionNumber: row.revision_number, reason: row.reason, sentBackBy: row.sent_back_by, sentBackAt: row.sent_back_at }))
}

type OnboardingFieldCommentEntry = {
  id: string
  revisionNumber: number
  fieldKey: string
  comment: string
  reviewerId: string | null
  createdAt: string
  resolved: boolean
}

/** Every field comment ever left on this request, oldest first, across every revision: a resubmit never removes a prior revision's comments from view (task spec). */
async function listOnboardingFieldComments(requestId: string): Promise<OnboardingFieldCommentEntry[]> {
  const rows = await caseData.listFieldCommentsForRequest(requestId)
  return rows.map((row) => ({
    id: row.id,
    revisionNumber: row.revision_number,
    fieldKey: row.field_key,
    comment: row.comment,
    reviewerId: row.reviewer_id,
    createdAt: row.created_at,
    resolved: row.resolved,
  }))
}

/** Send Back count per request in one batched read: My Requests' data source for that column, never a manually incremented counter. Requests with zero send-backs are simply absent from the returned map (treat a missing key as 0). */
async function getSendBackCountsForRequests(requestIds: string[]): Promise<Map<string, number>> {
  const rows = await caseData.listSendBacksForRequests(requestIds)
  return countSendBacksByRequestId(rows)
}

/** Revision-level submit/resubmit facts the Timeline needs, oldest first (unlike `getOnboardingCase`, which only ever returns the current revision). */
async function listOnboardingRevisionSummaries(requestId: string): Promise<{ revisionNumber: number; submittedAt: string | null; submittedBy: string | null }[]> {
  const rows = await caseData.listRevisionsForRequest(requestId)
  return rows.map((row) => ({ revisionNumber: row.revision_number, submittedAt: row.submitted_at, submittedBy: row.submitted_by }))
}

type ReviewQueueEntry = {
  requestId: string
  /** Human-Friendly ID (task Phase L): render with `formatOnboardingCaseId`. */
  caseNumber: number
  status: CustomerOnboardingCase["status"]
  customerLegalName: string
  currentRevisionNumber: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

async function toReviewQueueEntries(rows: Awaited<ReturnType<typeof caseData.listCasesAwaitingReview>>): Promise<ReviewQueueEntry[]> {
  const revisionsByRequestId = groupRevisionsByRequestId(await caseData.listRevisionsForRequests(rows.map((row) => row.request_id)))
  const entries: ReviewQueueEntry[] = []
  for (const row of rows) {
    const revisions = revisionsByRequestId.get(row.request_id) ?? []
    const latest = revisions[revisions.length - 1]
    const values = latest?.status === "submitted" && latest.effective_data ? latest.effective_data.values : (latest?.raw_data ?? {})
    entries.push({
      requestId: row.request_id,
      caseNumber: row.case_number,
      status: row.status,
      customerLegalName: typeof values[CUSTOMER_LEGAL_NAME_FIELD] === "string" ? (values[CUSTOMER_LEGAL_NAME_FIELD] as string) : "(untitled)",
      currentRevisionNumber: latest?.revision_number ?? 1,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
  }
  return entries
}

async function listOnboardingReviewQueue(): Promise<ReviewQueueEntry[]> {
  return toReviewQueueEntries(await caseData.listCasesAwaitingReview())
}

/** Every onboarding case regardless of status: the unified Approvals inbox's data source (task Phase E). */
async function listAllOnboardingEntries(): Promise<ReviewQueueEntry[]> {
  return toReviewQueueEntries(await caseData.listAllCases())
}

/**
 * The atomic approval transaction (Customer Lifecycle V1 task §11): reads
 * the case's own submitted evidence back out, maps its Commercial Rate
 * draft through the exact same
 * ../domain/commercial-configuration-promotion.ts mapping the interactive
 * Commercial Rate promotion flow already uses (never a second formatter),
 * and calls the single atomic approve_customer_onboarding_case RPC, which
 * creates the Customer Master row, the Commercial Configuration, Version
 * 1, and every Component in one transaction.
 */
async function approveOnboardingCase(requestId: string, actorUserId: string, snapshot: ReferenceMasterSnapshot, effectiveDate: string): Promise<CustomerOnboardingCase> {
  const latest = await caseData.getLatestRevisionForRequest(requestId)
  if (!latest || latest.status !== "submitted" || !latest.effective_data) {
    throw new Error("Cannot approve a case with no submitted revision.")
  }

  const values = latest.effective_data.values
  const legalName = typeof values[CUSTOMER_LEGAL_NAME_FIELD] === "string" ? (values[CUSTOMER_LEGAL_NAME_FIELD] as string) : null
  if (!legalName) {
    throw new Error("Cannot approve a case with no Legal Entity Name recorded.")
  }

  const commercialRate = values[COMMERCIAL_RATE_FIELD] as CommercialRateDraft | undefined
  if (!commercialRate || !commercialRate.billingCurrency || commercialRate.components.length === 0) {
    throw new Error("Cannot approve a case with no complete Commercial Rate recorded.")
  }

  const customerKey = slugify(legalName)
  const configurationKey = `${customerKey}-${new Date(effectiveDate).getFullYear()}`

  const components = commercialRate.components.map((component) => {
    const mapped = mapOnboardingComponentToCommercialComponentInsert(component, snapshot, commercialRate.billingCurrency as string, effectiveDate)
    return {
      is_recurring: mapped.isRecurring,
      pricing_rule_kind: mapped.pricingRuleKind,
      pricing_rule_parameters: mapped.pricingRuleParameters,
      billing_cadence: mapped.billingCadence,
      billing_timing: mapped.billingTiming,
      billing_quantity_basis: mapped.billingQuantityBasis,
      reconciliation_cadence: mapped.reconciliationCadence,
      transaction_currency: mapped.transactionCurrency,
      fx_snapshot_rate: mapped.fxSnapshotRate,
      effective_from: mapped.effectiveFrom,
      mug_threshold_value: mapped.mugThresholdValue,
    }
  })

  const row = await caseData.approveCase({
    requestId,
    customerKey,
    customerName: legalName,
    commercialConfigurationKey: configurationKey,
    commercialConfigurationName: legalName,
    components,
    effectiveDate,
    actorUserId,
  })
  const revisions = await caseData.listRevisionsForRequest(requestId)
  return toCustomerOnboardingCase(row, revisions)
}

/** Customer Activity timeline (task Phase C): the one onboarding case that became this Customer Master, or null for a customer created directly (never through onboarding), e.g. `insertCustomer`'s demo path. */
async function getOnboardingOriginForCustomer(customerId: string): Promise<OnboardingOrigin | null> {
  const row = await caseData.getCaseByCustomerId(customerId)
  if (!row) return null
  return { requestId: row.request_id, createdAt: row.created_at, createdBy: row.created_by, approvedAt: row.approved_at, approvedBy: row.approved_by }
}

type ApprovedCaseTaxIdentity = { customerId: string; gstNumber: string | null; pan: string | null }

/**
 * Customer Duplicate Prevention (task Phase K): GST and PAN are never
 * promoted onto `customers` itself (only name/brand/segment/business_unit/
 * country/industry are, see docs/CUSTOMER_LIFECYCLE.md §3), so a
 * duplicate check against them has to read every approved case's own
 * submitted revision, the same place `listOnboardingReviewQueue` already
 * reads a case's field values from. Legal name/brand are read from the
 * real `customers` row instead (more authoritative post-approval than a
 * stale onboarding snapshot), by the caller, not here.
 */
async function listApprovedCaseTaxIdentity(): Promise<ApprovedCaseTaxIdentity[]> {
  const rows = await caseData.listApprovedCases()
  const revisionsByRequestId = groupRevisionsByRequestId(await caseData.listRevisionsForRequests(rows.map((row) => row.request_id)))
  const identities: ApprovedCaseTaxIdentity[] = []
  for (const row of rows) {
    if (!row.customer_id) continue
    const revisions = revisionsByRequestId.get(row.request_id) ?? []
    const latest = revisions[revisions.length - 1]
    const values = latest?.status === "submitted" && latest.effective_data ? latest.effective_data.values : (latest?.raw_data ?? {})
    identities.push({
      customerId: row.customer_id,
      gstNumber: typeof values[GST_NUMBER_FIELD] === "string" ? (values[GST_NUMBER_FIELD] as string) : null,
      pan: typeof values[PAN_FIELD] === "string" ? (values[PAN_FIELD] as string) : null,
    })
  }
  return identities
}

export {
  getOnboardingCase,
  createOnboardingCase,
  saveOnboardingDraft,
  submitOnboardingCase,
  sendBackOnboardingCase,
  listOnboardingReviewQueue,
  listAllOnboardingEntries,
  listOnboardingCasesCreatedBy,
  listMyOnboardingRequests,
  listOnboardingSendBacks,
  getSendBackCountsForRequests,
  listOnboardingFieldComments,
  listOnboardingRevisionSummaries,
  approveOnboardingCase,
  getOnboardingOriginForCustomer,
  listApprovedCaseTaxIdentity,
}
export type { ReviewQueueEntry, ApprovedCaseTaxIdentity, OnboardingSendBackEntry, OnboardingFieldCommentEntry, MyOnboardingRequestEntry }
