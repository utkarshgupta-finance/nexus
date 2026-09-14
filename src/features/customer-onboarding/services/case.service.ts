import "server-only"

import * as caseData from "../data/case.data"
import { toCustomerOnboardingCase } from "../domain/case-mappers"
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
  actorUserId: string
): Promise<CustomerOnboardingCase> {
  const row = await caseData.sendBackCase({ requestId, reason, targetStageKey, actorUserId })
  const revisions = await caseData.listRevisionsForRequest(requestId)
  return toCustomerOnboardingCase(row, revisions)
}

type ReviewQueueEntry = {
  requestId: string
  status: CustomerOnboardingCase["status"]
  customerLegalName: string
  currentRevisionNumber: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

async function toReviewQueueEntries(rows: Awaited<ReturnType<typeof caseData.listCasesAwaitingReview>>): Promise<ReviewQueueEntry[]> {
  const entries: ReviewQueueEntry[] = []
  for (const row of rows) {
    const latest = await caseData.getLatestRevisionForRequest(row.request_id)
    const values = latest?.status === "submitted" && latest.effective_data ? latest.effective_data.values : (latest?.raw_data ?? {})
    entries.push({
      requestId: row.request_id,
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
  const identities: ApprovedCaseTaxIdentity[] = []
  for (const row of rows) {
    if (!row.customer_id) continue
    const latest = await caseData.getLatestRevisionForRequest(row.request_id)
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
  approveOnboardingCase,
  getOnboardingOriginForCustomer,
  listApprovedCaseTaxIdentity,
}
export type { ReviewQueueEntry, ApprovedCaseTaxIdentity }
