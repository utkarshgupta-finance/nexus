"use server"

import { requirePermission, requirePermissionForCustomer, requirePermissionForBusinessUnit } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { withCorrelationReference } from "@/platform/errors"
import { CaseOperationError } from "./domain/case-errors"
import { CommercialVersionOperationError } from "./domain/commercial-version-errors"
import { loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { getCustomerById, listCustomerMaster } from "@/features/customers/server"
import { commercialConfigurationService } from "@/features/commercial/server"

import {
  createOnboardingCase,
  saveOnboardingDraft,
  submitOnboardingCase,
  sendBackOnboardingCase,
  approveOnboardingCase,
  cancelOnboardingCase,
  listApprovedCaseTaxIdentity,
  approveOnboardingEffectiveDateException,
  getOnboardingCaseBusinessUnit,
  getOnboardingCaseScope,
} from "./services/case.service"
import {
  createVersionFromActive,
  saveVersionDraft,
  submitVersion,
  rejectVersion,
  approveVersion,
  cancelVersion,
  loadVersion,
} from "./services/commercial-version.service"
import { uploadOnboardingDocument, getOnboardingDocumentDownloadUrl, getOnboardingDocumentRequestId } from "./services/documents.service"
import { findPotentialDuplicates } from "./domain/duplicate-detection"
import type { CommercialRateDraft } from "./domain/commercial-rate"
import type { CustomerOnboardingCase, PersistedOnboardingDocumentMetadata, OnboardingDocumentType } from "./domain/types"
import type { CommercialConfigurationVersion, CommercialVersionChangeCategory } from "./domain/commercial-version-types"
import type { DuplicateCandidate, DuplicateMatch, ExistingCustomerIdentity } from "./domain/duplicate-detection"

/**
 * Real, database-backed Customer Onboarding Case lifecycle actions
 * (Customer Lifecycle V1). Each derives the authenticated actor
 * server-side via `requirePermission`, exactly like the promotion actions
 * above; none accepts a client-supplied actor id. `customer.create`
 * gates the requester-side actions (create/save/submit, since editing
 * one's own onboarding case is a creation activity), `customer.approve`
 * gates the reviewer-side actions (send back/approve), matching
 * docs/AUTHORIZATION_MODEL.md's resource+action convention.
 */

type CaseActionResult = { ok: true; onboardingCase: CustomerOnboardingCase } | { ok: false; error: string; stale?: boolean }

function toCaseActionError(error: unknown): { ok: false; error: string; stale?: boolean } {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof CaseOperationError && error.caseError.kind === "workflow_node_already_advanced") {
    // Workflow Runtime V1 UX + Audit Closure: never surface the raw
    // WORKFLOW_NODE_ALREADY_ADVANCED token or a confusing team-mismatch
    // error when another checker has simply already acted; `stale: true`
    // lets the review page show an explicit Refresh affordance instead
    // of a dead end.
    return { ok: false, error: "This approval has already moved to the next step. Refresh to see its current status.", stale: true }
  }
  // An "unknown"-kind CaseOperationError already carries a safe generic
  // message (case-errors.ts, Phase T); attaching the correlation id here
  // is what makes it actionable for support instead of just reassuring.
  if (error instanceof CaseOperationError && error.caseError.kind === "unknown") {
    return { ok: false, error: withCorrelationReference(error.message, error) }
  }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: "An unexpected error occurred while updating this Customer Onboarding case." }
}

async function createOnboardingCaseAction(): Promise<CaseActionResult> {
  try {
    const actor = await requirePermission("customer", "create")
    const onboardingCase = await createOnboardingCase(actor.appUserId)
    return { ok: true, onboardingCase }
  } catch (error) {
    return toCaseActionError(error)
  }
}

async function saveOnboardingDraftAction(
  requestId: string,
  rawData: Record<string, unknown>,
  currentStageKey: string,
  expectedRowVersion: number
): Promise<CaseActionResult> {
  try {
    const actor = await requirePermission("customer", "create")
    const onboardingCase = await saveOnboardingDraft(requestId, rawData, currentStageKey, expectedRowVersion, actor.appUserId)
    return { ok: true, onboardingCase }
  } catch (error) {
    return toCaseActionError(error)
  }
}

/** Serves both a first Submit and a post-send-back Resubmit; see services/case.service.ts's own comment. */
async function submitOnboardingCaseAction(requestId: string): Promise<CaseActionResult> {
  try {
    const actor = await requirePermission("customer", "create")
    const onboardingCase = await submitOnboardingCase(requestId, actor.appUserId)
    return { ok: true, onboardingCase }
  } catch (error) {
    return toCaseActionError(error)
  }
}

async function sendBackOnboardingCaseAction(
  requestId: string,
  reason: string,
  targetStageKey: string | null,
  fieldComments?: { fieldKey: string; comment: string }[]
): Promise<CaseActionResult> {
  try {
    // PD-005 follow-up (Product Decision Closure): a case has no
    // resolved customer yet pre-approval, so scoping here uses the
    // case's own business_unit form field, not a customer id.
    const businessUnit = await getOnboardingCaseBusinessUnit(requestId)
    const actor = await requirePermissionForBusinessUnit("customer", "approve", businessUnit)
    const onboardingCase = await sendBackOnboardingCase(requestId, reason, targetStageKey, actor.appUserId, fieldComments)
    return { ok: true, onboardingCase }
  } catch (error) {
    return toCaseActionError(error)
  }
}

/** Same shape as CaseActionResult, plus the identities the Approve success screen links to (Customer Lifecycle V1 UX pass: "do not require the user to manually find the newly created Customer"). Both are null only if something prevented resolving the just-created customer's key, never fabricated. */
type ApproveCaseActionResult =
  | { ok: true; onboardingCase: CustomerOnboardingCase; customerKey: string | null; commercialConfigurationId: string | null }
  | { ok: false; error: string; stale?: boolean }

/** `expectedCurrentNodeKey` (Workflow Runtime V1 UX + Audit Closure): the Approval node the review page had open when the checker clicked Approve; see toCaseActionError's own comment for the stale-approval UX this enables. */
async function approveOnboardingCaseAction(requestId: string, effectiveDate: string, expectedCurrentNodeKey: string | null = null): Promise<ApproveCaseActionResult> {
  try {
    // PD-005 follow-up (Product Decision Closure): same business_unit
    // scoping as sendBackOnboardingCaseAction, for the same reason (no
    // resolved customer exists until this call itself creates one).
    const businessUnit = await getOnboardingCaseBusinessUnit(requestId)
    const actor = await requirePermissionForBusinessUnit("customer", "approve", businessUnit)
    const snapshot = await loadReferenceMasterSnapshot()
    const onboardingCase = await approveOnboardingCase(requestId, actor.appUserId, snapshot, effectiveDate, expectedCurrentNodeKey)
    const customer = onboardingCase.customerId ? await getCustomerById(onboardingCase.customerId) : null
    return { ok: true, onboardingCase, customerKey: customer?.key ?? null, commercialConfigurationId: onboardingCase.commercialConfigurationId }
  } catch (error) {
    return toCaseActionError(error)
  }
}

type ExceptionActionResult = { ok: true } | { ok: false; error: string }

/**
 * PD-002 (A-034, Batches 1-13 Ledger Audit product decision closure):
 * records one role's (BU Head or Finance Head) sign-off on a pending
 * backdated-effective-date exception. Gated on `customer.approve` (the
 * same permission the onboarding Checker role holds) plus the RPC's own
 * real team-membership check (`fn_require_workflow_team_membership`
 * against the `bu_head`/`finance_head` team, never a fabricated
 * approval): a `customer.approve` holder who is not actually a member of
 * the relevant team is still rejected server-side.
 */
async function approveOnboardingEffectiveDateExceptionAction(caseRequestId: string, role: "bu_head" | "finance_head"): Promise<ExceptionActionResult> {
  try {
    const actor = await requirePermission("customer", "approve")
    await approveOnboardingEffectiveDateException(caseRequestId, role, actor.appUserId)
    return { ok: true }
  } catch (error) {
    if (error instanceof CaseOperationError) return { ok: false, error: error.caseError.message }
    if (error instanceof AuthorizationError) return { ok: false, error: error.message }
    return { ok: false, error: "An unexpected error occurred while recording this approval." }
  }
}

/** Task Phase C: only a draft may be discarded, gated the same as create/save/submit since discarding one's own draft is a creation-time decision, not a reviewer one. */
async function cancelOnboardingCaseAction(requestId: string, reason: string | null): Promise<CaseActionResult> {
  try {
    const actor = await requirePermission("customer", "create")
    const onboardingCase = await cancelOnboardingCase(requestId, reason, actor.appUserId)
    return { ok: true, onboardingCase }
  } catch (error) {
    return toCaseActionError(error)
  }
}

/**
 * Real, database-backed Commercial Configuration Version lifecycle
 * actions (Customer Lifecycle V1, Phase 10-13), mirroring the Customer
 * Onboarding Case actions above exactly: each derives the authenticated
 * actor server-side via `requirePermission`, never accepts a
 * client-supplied actor id. `commercial_configuration.write` gates the
 * draft-authoring actions (create/save/submit), matching every other
 * Commercial Configuration write in this codebase;
 * `commercial_configuration.approve` gates the reviewer-side decision
 * (reject/approve).
 */

type CommercialVersionActionResult = { ok: true; version: CommercialConfigurationVersion } | { ok: false; error: string; stale?: boolean }

function toCommercialVersionActionError(error: unknown): CommercialVersionActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof CommercialVersionOperationError && error.commercialVersionError.kind === "workflow_node_already_advanced") {
    // Workflow Runtime V1 UX + Audit Closure: never surface the raw
    // WORKFLOW_NODE_ALREADY_ADVANCED token or a confusing team-mismatch
    // error when another checker has simply already acted; `stale: true`
    // lets the review page show an explicit Refresh affordance instead
    // of a dead end.
    return { ok: false, error: "This approval has already moved to the next step. Refresh to see its current status.", stale: true }
  }
  if (error instanceof CommercialVersionOperationError && error.commercialVersionError.kind === "unknown") {
    return { ok: false, error: withCorrelationReference(error.message, error) }
  }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: "An unexpected error occurred while updating this Commercial Configuration Version." }
}

/**
 * PD-003 (B-011, Batches 1-13 Ledger Audit product decision closure):
 * a new Commercial Configuration Version may not be opened against an
 * inactive customer, mirroring createChangeRequestAction's identical
 * check for Customer Change. Server-side here (this Server Action never
 * runs in the browser); the RPC itself also now rejects this
 * independently (see the same task's migration), so a direct/RPC bypass
 * of this action is blocked too, not just the UI path.
 */
async function createCommercialVersionAction(commercialConfigurationId: string, changeCategory: CommercialVersionChangeCategory): Promise<CommercialVersionActionResult> {
  try {
    const configuration = await commercialConfigurationService.getCommercialConfiguration(commercialConfigurationId)
    const actor = configuration
      ? await requirePermissionForCustomer("commercial_configuration", "write", configuration.customerId)
      : await requirePermission("commercial_configuration", "write")
    const customer = configuration ? await getCustomerById(configuration.customerId) : null
    if (customer && !customer.is_active) {
      return { ok: false, error: "This customer is inactive. Reactivate the customer before creating a new Commercial Configuration Version." }
    }
    const version = await createVersionFromActive(commercialConfigurationId, changeCategory, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toCommercialVersionActionError(error)
  }
}

/**
 * PD-005 follow-up (Product Decision Closure): every write below except
 * create (which already resolves the configuration directly) needs one
 * extra lookup, via `loadVersion` then `getCommercialConfiguration`, to
 * resolve which customer this version belongs to before the scoped
 * check can run.
 */
async function resolveVersionCustomerId(requestId: string): Promise<string | null> {
  const version = await loadVersion(requestId)
  if (!version) return null
  const configuration = await commercialConfigurationService.getCommercialConfiguration(version.commercialConfigurationId)
  return configuration?.customerId ?? null
}

async function saveCommercialVersionDraftAction(
  requestId: string,
  commercialRate: CommercialRateDraft,
  expectedRowVersion: number
): Promise<CommercialVersionActionResult> {
  try {
    const customerId = await resolveVersionCustomerId(requestId)
    const actor = customerId
      ? await requirePermissionForCustomer("commercial_configuration", "write", customerId)
      : await requirePermission("commercial_configuration", "write")
    const version = await saveVersionDraft(requestId, commercialRate, expectedRowVersion, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toCommercialVersionActionError(error)
  }
}

async function submitCommercialVersionAction(requestId: string, reason: string, effectiveDate: string): Promise<CommercialVersionActionResult> {
  try {
    const customerId = await resolveVersionCustomerId(requestId)
    const actor = customerId
      ? await requirePermissionForCustomer("commercial_configuration", "write", customerId)
      : await requirePermission("commercial_configuration", "write")
    const version = await submitVersion(requestId, reason, effectiveDate, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toCommercialVersionActionError(error)
  }
}

async function rejectCommercialVersionAction(requestId: string, reason: string): Promise<CommercialVersionActionResult> {
  try {
    const customerId = await resolveVersionCustomerId(requestId)
    const actor = customerId
      ? await requirePermissionForCustomer("commercial_configuration", "approve", customerId)
      : await requirePermission("commercial_configuration", "approve")
    const version = await rejectVersion(requestId, reason, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toCommercialVersionActionError(error)
  }
}

/** `expectedCurrentNodeKey` (Workflow Runtime V1 UX + Audit Closure): the Approval node the review page had open when the checker clicked Approve; see toCommercialVersionActionError's own comment for the stale-approval UX this enables. */
async function approveCommercialVersionAction(requestId: string, expectedCurrentNodeKey: string | null = null): Promise<CommercialVersionActionResult> {
  try {
    const customerId = await resolveVersionCustomerId(requestId)
    const actor = customerId
      ? await requirePermissionForCustomer("commercial_configuration", "approve", customerId)
      : await requirePermission("commercial_configuration", "approve")
    const snapshot = await loadReferenceMasterSnapshot()
    const version = await approveVersion(requestId, actor.appUserId, snapshot, expectedCurrentNodeKey)
    return { ok: true, version }
  } catch (error) {
    return toCommercialVersionActionError(error)
  }
}

/** Task Phase C: only a draft version may be discarded, gated the same as create/save/submit. */
async function cancelCommercialVersionAction(requestId: string, reason: string | null): Promise<CommercialVersionActionResult> {
  try {
    const customerId = await resolveVersionCustomerId(requestId)
    const actor = customerId
      ? await requirePermissionForCustomer("commercial_configuration", "write", customerId)
      : await requirePermission("commercial_configuration", "write")
    const version = await cancelVersion(requestId, reason, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toCommercialVersionActionError(error)
  }
}

type DuplicateCheckActionResult = { ok: true; matches: DuplicateMatch[] } | { ok: false; error: string }

/**
 * Customer Duplicate Prevention (task Phase K): checked at Submit, never
 * at Save Draft (a draft is not a claim to a real identity yet). Gated
 * on `customer.create`, the same permission Submit itself requires: this
 * is informational for whoever is about to onboard a customer, not a
 * separate reviewer capability.
 */
async function checkForDuplicateCustomersAction(candidate: DuplicateCandidate): Promise<DuplicateCheckActionResult> {
  try {
    await requirePermission("customer", "create")
    const [taxIdentities, customers] = await Promise.all([listApprovedCaseTaxIdentity(), listCustomerMaster()])
    const taxByCustomerId = new Map(taxIdentities.map((identity) => [identity.customerId, identity]))
    const existingCustomers: ExistingCustomerIdentity[] = customers.map(({ record }) => ({
      customerId: record.id,
      customerKey: record.key,
      customerName: record.name,
      gstNumber: taxByCustomerId.get(record.id)?.gstNumber ?? null,
      pan: taxByCustomerId.get(record.id)?.pan ?? null,
      legalEntityName: record.name,
      brandName: record.brandName,
    }))
    return { ok: true, matches: findPotentialDuplicates(candidate, existingCustomers) }
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message }
    if (error instanceof Error) return { ok: false, error: error.message }
    return { ok: false, error: "An unexpected error occurred while checking for duplicate customers." }
  }
}

type UploadDocumentActionResult = { ok: true; document: PersistedOnboardingDocumentMetadata } | { ok: false; error: string }

/**
 * Customer Documents (task Phase D): the real persistence path this
 * onboarding evidence never had before. Gated on `customer.create`, the
 * same permission Save Draft/Submit already require: uploading evidence
 * is part of filling in the case, not a separate reviewer capability.
 *
 * Batch 22 (Q-018 incidental defect, found and fixed): this had been the
 * one `customer.create`-gated onboarding action still using the plain,
 * global-only `requirePermission`, unlike every sibling case action in
 * this file (createOnboardingCaseAction is the sole other exception, and
 * legitimately so: there is no request yet to scope by at creation
 * time). A user holding only a PD-005 customer/business-unit-scoped
 * grant (no global `customer.create`) could reach this request's own
 * review page but was then wrongly denied when uploading evidence to
 * it. Fixed to scope exactly like sendBackOnboardingCaseAction/
 * approveOnboardingCaseAction: business-unit before a customer exists,
 * customer once approval has resolved one.
 */
async function uploadOnboardingDocumentAction(
  requestId: string,
  category: "tax" | "commercial" | "agreement",
  documentType: OnboardingDocumentType,
  formData: FormData
): Promise<UploadDocumentActionResult> {
  try {
    const scope = await getOnboardingCaseScope(requestId)
    const actor = scope?.customerId
      ? await requirePermissionForCustomer("customer", "create", scope.customerId)
      : await requirePermissionForBusinessUnit("customer", "create", scope?.businessUnit ?? null)
    const file = formData.get("file")
    if (!(file instanceof File)) return { ok: false, error: "No file was received." }
    // Browser adapter boundary (Platform Scale Closure, Phase R): the
    // service layer takes a plain DocumentUploadInput, never a browser
    // `File`, so this is the one place that conversion happens.
    const document = await uploadOnboardingDocument({
      requestId,
      category,
      documentType,
      file: { name: file.name, mimeType: file.type, size: file.size, bytes: file },
      actorUserId: actor.appUserId,
    })
    return { ok: true, document }
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message }
    if (error instanceof Error) return { ok: false, error: error.message }
    return { ok: false, error: "An unexpected error occurred while uploading this document." }
  }
}

type DownloadUrlActionResult = { ok: true; url: string } | { ok: false; error: string }

/**
 * Q-008/Q-018 (Batch 22, incidental defect found and fixed): this had
 * used the plain, global-only `requirePermission("customer", "read")`,
 * unlike the request's own review page (`ReviewDetailRoute`), which
 * already grants a PD-005 customer/business-unit-scoped viewer access
 * via `additionalAccessGranted`. A purely scoped viewer could reach the
 * review page and see the documents list, then be wrongly denied a
 * signed download URL for evidence on a request they are genuinely
 * authorized to read. The document is resolved to its owning request
 * first (never generating a signed URL before authorization succeeds),
 * scoped exactly like the review page's own resolution.
 */
async function getOnboardingDocumentDownloadUrlAction(documentId: string): Promise<DownloadUrlActionResult> {
  try {
    const requestId = await getOnboardingDocumentRequestId(documentId)
    if (!requestId) return { ok: false, error: "Document not found." }
    const scope = await getOnboardingCaseScope(requestId)
    if (scope?.customerId) {
      await requirePermissionForCustomer("customer", "read", scope.customerId)
    } else {
      await requirePermissionForBusinessUnit("customer", "read", scope?.businessUnit ?? null)
    }
    const url = await getOnboardingDocumentDownloadUrl(documentId)
    if (!url) return { ok: false, error: "Document not found." }
    return { ok: true, url }
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message }
    if (error instanceof Error) return { ok: false, error: error.message }
    return { ok: false, error: "An unexpected error occurred while creating a download link." }
  }
}

export {
  createOnboardingCaseAction,
  saveOnboardingDraftAction,
  submitOnboardingCaseAction,
  sendBackOnboardingCaseAction,
  approveOnboardingCaseAction,
  cancelOnboardingCaseAction,
  createCommercialVersionAction,
  saveCommercialVersionDraftAction,
  submitCommercialVersionAction,
  rejectCommercialVersionAction,
  approveCommercialVersionAction,
  cancelCommercialVersionAction,
  checkForDuplicateCustomersAction,
  uploadOnboardingDocumentAction,
  getOnboardingDocumentDownloadUrlAction,
  approveOnboardingEffectiveDateExceptionAction,
}
export type {
  CaseActionResult,
  ApproveCaseActionResult,
  CommercialVersionActionResult,
  DuplicateCheckActionResult,
  UploadDocumentActionResult,
  DownloadUrlActionResult,
  ExceptionActionResult,
}
