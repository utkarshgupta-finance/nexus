"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Survey } from "survey-react-ui"
import { CheckCircle2Icon, ClockIcon } from "lucide-react"

import "@/platform/forms/survey-theme"
import "./geography-combobox-question"
import { useSurveyModel } from "@/platform/forms/use-survey-model"
import type { SurveyFormMode } from "@/platform/forms/types"
import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { ProcessJourney } from "@/components/product/process-journey"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getActiveOptions } from "@/features/reference-data"
import type { ReferenceListKey, ReferenceOption } from "@/features/reference-data"
import { useReferenceMasterSnapshot } from "@/features/reference-data/ui/snapshot-context"
import {
  CUSTOMER_ONBOARDING_STAGES,
  toProcessJourneyStages,
  isFirstOnboardingStage,
  isLastOnboardingStage,
  adjacentOnboardingStage,
} from "../domain/process"
import { COMMERCIAL_DOCUMENT_DEFINITIONS } from "../domain/commercial-documents"
import { ONBOARDING_DOCUMENT_LABELS } from "../domain/document-labels"
import { createEmptyCommercialRateDraft } from "../domain/commercial-rate"
import type { CommercialRateDraft } from "../domain/commercial-rate"
import { setCurrentStage } from "../domain/case"
import type { CustomerOnboardingCase } from "../domain/types"
import type { OnboardingFieldCommentEntry } from "../services/case.service"
import { formatOnboardingCaseId } from "../domain/types"
import { isEligibleForCompletion } from "../domain/completion"
import { saveOnboardingDraftAction, submitOnboardingCaseAction, checkForDuplicateCustomersAction, cancelOnboardingCaseAction } from "../actions"
import { hasHardDuplicateMatch, FIELD_LABELS } from "../domain/duplicate-detection"
import type { DuplicateMatch } from "../domain/duplicate-detection"
import { fetchStatesForCountry } from "../domain/geography-client"
import {
  evaluateAgreementApprovalStatus,
  evaluateCommercialDocumentsStatus,
  evaluateCommercialRateStatus,
  evaluateCustomerDetailsStatus,
  evaluateTaxRegistrationStatus,
} from "../domain/stage-status"
import type { CustomerOnboardingStageKey } from "../domain/types"
import {
  buildCustomerOnboardingFormDefinition,
  CUSTOMER_ONBOARDING_FIELD_KEYS,
  DEFAULT_COUNTRY_CODE,
  fieldKeysToClearOnCountryChange,
} from "../forms/customer-onboarding-form-definition"
import { AttachmentUpload } from "./attachment-upload"
import type { AttachmentValue } from "./attachment-upload"
import { findPersistedDocument } from "../domain/documents"
import type { PersistedOnboardingDocumentView, OnboardingDocumentType } from "../domain/types"
import { CommercialRateSection } from "./commercial-rate-section"
import { OnboardingStageFooter } from "./onboarding-stage-footer"
import type { OnboardingStageFooterAction } from "./onboarding-stage-footer"
import { OnboardingSubmittedScreen } from "./onboarding-submitted-screen"

const REFERENCE_LISTS: ReferenceListKey[] = [
  "country",
  "industry",
  "segment",
  "business_unit",
  "tax_identifier_type",
  "phone_country_code",
  "currency",
]

/**
 * The two SurveyJS-backed stages, in order: everything after these is a
 * plain React section (Commercial Documents, Commercial Rate, Agreement &
 * Approval), not a survey page. See
 * ../forms/customer-onboarding-form-definition.ts's header for why.
 */
const SURVEY_STAGE_ORDER_LIMIT = 2

/** Maps each Commercial Documents attachment to its local-state field. */
const COMMERCIAL_DOCUMENT_STATE_KEYS = {
  proposal_document: "proposal",
  customer_po: "customerPo",
  pi_copy: "piCopy",
} as const

/** Seeds one attachment slot's initial state from whatever is already persisted for this request (Platform Operating Expansion, Phase A). Returns null (an empty slot) when nothing has been uploaded for this document type yet. */
function toPersistedAttachmentValue(
  documents: PersistedOnboardingDocumentView[],
  documentType: OnboardingDocumentType
): AttachmentValue | null {
  const document = findPersistedDocument(documents, documentType)
  if (!document) return null
  return {
    kind: "persisted",
    documentId: document.documentId,
    fileName: document.originalFileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    uploadedByLabel: document.uploadedByLabel,
    uploadedAt: document.uploadedAt,
  }
}

/**
 * Customer Onboarding: Customer Details, Tax & Registration, Commercial
 * Documents, Commercial Rate, Agreement & Approval. Creation access is
 * intentionally unrestricted here (task spec §27): any appropriately
 * authenticated Nexus user should eventually be able to fill this in, so
 * nothing on this page fakes a role or identity. Save Draft and Submit
 * both operate on ../domain/case.ts's local-only case model (see that
 * module's header for why); actor ids are `null` throughout, ready for a
 * real server boundary to supply them later. Legal Approval always
 * displays as Pending: there is no authenticated approval identity yet,
 * so this page never fabricates an "Approve" action (task spec §26).
 */
function CustomerOnboardingPage({
  requestId,
  initialCase,
  snapshotUnavailable = false,
  canReview = false,
  fieldComments = [],
  initialDocuments = [],
}: {
  /** The real, persisted onboarding case identity (customer_onboarding_cases.request_id). */
  requestId: string
  /** Loaded server-side from the real database (see ../server.ts's getOnboardingCase); this page never starts from a fake in-memory case. */
  initialCase: CustomerOnboardingCase
  snapshotUnavailable?: boolean
  /** Server-derived: whether the current session holds customer.approve (see ../actions.ts). Gates the Submitted screen's "Review Now" action; independently re-checked server-side on the Review route itself. */
  canReview?: boolean
  /** Every field comment ever left on this request, across every revision (task spec: Requester Form Feedback). Only the ones left against the revision that was just sent back are shown inline; older ones stay visible in the Timeline instead of cluttering the open form. */
  fieldComments?: OnboardingFieldCommentEntry[]
  /**
   * Every currently-current attachment already persisted for this
   * request (Platform Operating Expansion, Phase A). Reopening a Sent
   * Back case previously showed every attachment slot as empty even
   * though the document was still there; this seeds each slot's initial
   * state so a requester never has to remember to re-upload evidence
   * they already provided.
   */
  initialDocuments?: PersistedOnboardingDocumentView[]
}) {
  const snapshot = useReferenceMasterSnapshot()
  const [onboardingCase, setOnboardingCase] = useState(initialCase)
  const [pendingAction, setPendingAction] = useState<OnboardingStageFooterAction>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [submittedViewMode, setSubmittedViewMode] = useState<"confirmation" | "detail">("confirmation")
  const [activeStageKey, setActiveStageKey] = useState<CustomerOnboardingStageKey>(initialCase.currentStageKey)
  const [country, setCountry] = useState<string | null>(
    (initialCase.currentRevision.data[CUSTOMER_ONBOARDING_FIELD_KEYS.country] as string | undefined) ?? DEFAULT_COUNTRY_CODE
  )
  const [taxDocuments, setTaxDocuments] = useState<{
    gst: AttachmentValue | null
    pan: AttachmentValue | null
    tan: AttachmentValue | null
    taxRegistration: AttachmentValue | null
    companyRegistration: AttachmentValue | null
  }>(() => ({
    gst: toPersistedAttachmentValue(initialDocuments, "gst_certificate"),
    pan: toPersistedAttachmentValue(initialDocuments, "pan_card"),
    tan: toPersistedAttachmentValue(initialDocuments, "tan_card"),
    taxRegistration: toPersistedAttachmentValue(initialDocuments, "tax_registration"),
    companyRegistration: toPersistedAttachmentValue(initialDocuments, "company_registration"),
  }))
  const [commercialDocuments, setCommercialDocuments] = useState<{
    proposal: AttachmentValue | null
    customerPo: AttachmentValue | null
    piCopy: AttachmentValue | null
  }>(() => ({
    proposal: toPersistedAttachmentValue(initialDocuments, "proposal_document"),
    customerPo: toPersistedAttachmentValue(initialDocuments, "customer_po"),
    piCopy: toPersistedAttachmentValue(initialDocuments, "pi_copy"),
  }))
  const [signedAgreement, setSignedAgreement] = useState<AttachmentValue | null>(() =>
    toPersistedAttachmentValue(initialDocuments, "signed_agreement")
  )
  const [commercialRate, setCommercialRate] = useState<CommercialRateDraft>(
    () => (initialCase.currentRevision.data[CUSTOMER_ONBOARDING_FIELD_KEYS.commercialRate] as CommercialRateDraft | undefined) ?? createEmptyCommercialRateDraft()
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([])
  const [duplicateWarningAcknowledged, setDuplicateWarningAcknowledged] = useState(false)
  /**
   * Bumped on every SurveyJS `onValueChanged` event (see the effect below),
   * for no reason other than to make this component re-render: `survey`
   * is an imperative Model instance, so a field edit inside it does not by
   * itself trigger a React re-render here, but the stage-status indicator
   * below reads `survey.data` fresh on every render and needs one to stay
   * live while the user types.
   */
  const [, forceRerenderOnFieldChange] = useState(0)

  const isLocked = onboardingCase.status === "submitted" || onboardingCase.status === "resubmitted" || onboardingCase.status === "approved"
  const mode: SurveyFormMode = isLocked ? "readonly" : "edit"

  const formDefinition = useMemo(() => {
    const optionsByList = Object.fromEntries(
      REFERENCE_LISTS.map((list) => [list, getActiveOptions(snapshot, list)])
    ) as Record<ReferenceListKey, ReferenceOption[]>
    return buildCustomerOnboardingFormDefinition(optionsByList)
  }, [snapshot])

  const survey = useSurveyModel(formDefinition.json, mode)

  // Country -> State -> City wiring, plus stage-tab sync. One effect, torn
  // down together, since all three subscribe to the same Model instance.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- SurveyJS Model is an imperative instance; priming it with the real persisted revision data is its documented `data` setter, the same class of mutation use-survey-model.ts already disables this rule for.
    survey.data = initialCase.currentRevision.data

    let currentCountry: string | null = (survey.getValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country) as string) ?? null

    function loadStatesForCountry(countryCode: string | null) {
      const stateQuestion = survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.state)
      const cityQuestion = survey.getQuestionByName(CUSTOMER_ONBOARDING_FIELD_KEYS.city)
      if (!countryCode) {
        stateQuestion.choices = []
        stateQuestion.isRequired = false
        stateQuestion.placeholder = "Select country first"
        cityQuestion.placeholder = "Select country first"
        return
      }
      cityQuestion.placeholder = "Type to search"
      fetchStatesForCountry(countryCode).then((states) => {
        stateQuestion.choices = states.map((state) => ({ value: state.value, text: state.label }))
        stateQuestion.isRequired = states.length > 0
        stateQuestion.placeholder = states.length > 0 ? "Select..." : "Not applicable for this country"
      })
    }

    loadStatesForCountry(currentCountry)

    function handleValueChanged(_sender: unknown, options: { name: string; value: unknown }) {
      if (options.name === CUSTOMER_ONBOARDING_FIELD_KEYS.country) {
        currentCountry = (options.value as string) ?? null
        setCountry(currentCountry)
        survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.state, undefined)
        survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.city, undefined)
        loadStatesForCountry(currentCountry)

        // A confirmed Country change never lets the other tax branch's
        // values ride along into a submission for the new country (task
        // spec: "the submitted business payload must never mix
        // incompatible country-tax branches"). Only the branch that no
        // longer applies is cleared, so switching between two non-India
        // countries keeps whatever was already entered.
        for (const fieldKey of fieldKeysToClearOnCountryChange(currentCountry)) {
          survey.setValue(fieldKey, undefined)
        }
        if (currentCountry === DEFAULT_COUNTRY_CODE) {
          setTaxDocuments((current) => ({ ...current, taxRegistration: null, companyRegistration: null }))
        } else {
          setTaxDocuments((current) => ({ ...current, gst: null, pan: null, tan: null }))
        }
      } else if (options.name === CUSTOMER_ONBOARDING_FIELD_KEYS.state) {
        survey.setValue(CUSTOMER_ONBOARDING_FIELD_KEYS.city, undefined)
      }
      const duplicateCheckFields: string[] = [
        CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber,
        CUSTOMER_ONBOARDING_FIELD_KEYS.pan,
        CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName,
        CUSTOMER_ONBOARDING_FIELD_KEYS.brandName,
      ]
      if (duplicateCheckFields.includes(options.name)) {
        // A previously-acknowledged soft match must never silently ride along after the
        // identifying value itself changes: re-check fresh on the next Submit click.
        setDuplicateWarningAcknowledged(false)
        setDuplicateMatches([])
      }
      forceRerenderOnFieldChange((count) => count + 1)
    }

    function handleCurrentPageChanged() {
      const stage = CUSTOMER_ONBOARDING_STAGES.find((entry) => entry.order - 1 === survey.currentPageNo)
      if (stage) {
        setActiveStageKey(stage.key)
        setOnboardingCase((current) => setCurrentStage(current, stage.key))
      }
    }

    survey.onValueChanged.add(handleValueChanged)
    survey.onCurrentPageChanged.add(handleCurrentPageChanged)
    return () => {
      survey.onValueChanged.remove(handleValueChanged)
      survey.onCurrentPageChanged.remove(handleCurrentPageChanged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialCase is the one-time server-loaded snapshot this survey primes from; it must never re-run and re-overwrite in-progress edits just because the case's own local state (a value this same effect helped produce) has since changed.
  }, [survey])

  // Requester Form Feedback (task spec): reopening a Sent Back request
  // must surface reviewer field comments right next to the field itself,
  // never bury them in a generic thread the requester has to go hunting
  // through. Only the revision that was just reviewed applies: an older
  // send-back's comments belong in the Timeline, not inline on the
  // current draft, once the requester has already moved past them.
  const activeFieldComments =
    onboardingCase.status === "sent_back"
      ? fieldComments.filter((comment) => comment.revisionNumber === onboardingCase.currentRevision.revisionNumber - 1)
      : []

  useEffect(() => {
    for (const fieldKey of Object.values(CUSTOMER_ONBOARDING_FIELD_KEYS)) {
      const question = survey.getQuestionByName(fieldKey)
      if (!question) continue
      const comment = activeFieldComments.find((entry) => entry.fieldKey === fieldKey)
      question.description = comment ? `Needs review: ${comment.comment}` : ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeFieldComments is recomputed fresh every render from stable inputs (fieldComments/status/revisionNumber); an array-identity dependency would re-run every render for no reason.
  }, [survey, onboardingCase.status, onboardingCase.currentRevision.revisionNumber])

  /** The one direct path that moves the active stage, reused by the stage capsules, and by the bottom footer's Previous/Next (Commercial Documents, Commercial Rate, and Agreement & Approval are not survey pages, see ../forms/customer-onboarding-form-definition.ts's header, so only the else branch applies to them). */
  function goToStage(stageKey: CustomerOnboardingStageKey) {
    const stage = CUSTOMER_ONBOARDING_STAGES.find((entry) => entry.key === stageKey)
    if (!stage) return
    if (stage.order <= SURVEY_STAGE_ORDER_LIMIT) {
      // eslint-disable-next-line react-hooks/immutability -- SurveyJS Model is an imperative instance; this is its documented API for changing the current page (see platform/forms/use-survey-model.ts for the same pattern with `survey.mode`).
      survey.currentPageNo = stage.order - 1
    } else {
      setActiveStageKey(stage.key)
      setOnboardingCase((current) => setCurrentStage(current, stage.key))
    }
  }

  function handleStageTabChange(value: string[]) {
    if (!value[0]) return
    goToStage(value[0] as CustomerOnboardingStageKey)
  }

  async function handleSaveDraft() {
    setPendingAction("save")
    setDraftSaved(false)
    const rawData = { ...survey.data, [CUSTOMER_ONBOARDING_FIELD_KEYS.commercialRate]: commercialRate }
    const result = await saveOnboardingDraftAction(requestId, rawData, activeStageKey)
    setPendingAction(null)
    if (result.ok) {
      setOnboardingCase(result.onboardingCase)
      setDraftSaved(true)
    } else {
      setSubmitError(result.error)
    }
  }

  /**
   * Next always persists the current draft first (draft navigation is
   * permissive: it never requires the current stage to be complete), then
   * advances. Task Phase D: Next still surfaces the CURRENT stage's own
   * invalid values (SurveyJS's own inline field errors) on the way out, so
   * a requester who skips past a malformed value sees it flagged rather
   * than silently loses track of it; the validation result never blocks
   * navigation, only Submit does that.
   */
  async function handleNext(targetStageKey: CustomerOnboardingStageKey) {
    if (isSurveyStage) survey.validateCurrentPage()
    setPendingAction("next")
    setDraftSaved(false)
    const rawData = { ...survey.data, [CUSTOMER_ONBOARDING_FIELD_KEYS.commercialRate]: commercialRate }
    const result = await saveOnboardingDraftAction(requestId, rawData, activeStageKey)
    setPendingAction(null)
    if (result.ok) {
      setOnboardingCase(result.onboardingCase)
      goToStage(targetStageKey)
    } else {
      setSubmitError(result.error)
    }
  }

  /**
   * Task Phase D: Submit is strict across every stage that has a real
   * mandatory requirement (Customer Details, Tax & Registration including
   * its documents, Commercial Rate), unlike Save Draft/Next above.
   * Agreement & Approval is deliberately excluded from this gate: it can
   * never reach "complete" in this build (no authenticated Legal Approval
   * identity exists yet, see the header above `legalApprovalComplete`),
   * so gating Submit on it would make submission permanently impossible.
   * `survey.validate(true, true)` both marks every invalid field across
   * BOTH survey pages at once (never just the current one) and focuses/
   * scrolls to the first invalid field, switching the current page to it
   * if needed; `onCurrentPageChanged` (wired above) keeps `activeStageKey`
   * in sync with that switch automatically.
   */
  async function handleSubmit() {
    const surveyValid = survey.validate(true, true)
    const isIndia = country === DEFAULT_COUNTRY_CODE
    const documentErrors = isIndia
      ? [
          !taxDocuments.gst ? "GST Registration Document is required." : null,
          !taxDocuments.pan ? "PAN Document is required." : null,
          !taxDocuments.tan ? "TAN Document is required." : null,
        ]
      : [
          !taxDocuments.taxRegistration ? "Tax Registration Document is required." : null,
          !taxDocuments.companyRegistration ? "Company Registration / Incorporation Document is required." : null,
        ]
    const documentErrorMessages = documentErrors.filter((message): message is string => message !== null)
    const customerDetailsPage = survey.pages[0]
    const taxRegistrationPage = survey.pages[1]
    const customerDetailsHasErrors = customerDetailsPage ? survey.hasPageErrors(customerDetailsPage) : !surveyValid
    const taxRegistrationHasErrors = (taxRegistrationPage ? survey.hasPageErrors(taxRegistrationPage) : !surveyValid) || documentErrorMessages.length > 0
    const commercialRateIncomplete = stageStatuses.commercial_rate !== "complete"

    const incompleteStageLabels: string[] = []
    if (customerDetailsHasErrors) incompleteStageLabels.push("Customer Details")
    if (taxRegistrationHasErrors) incompleteStageLabels.push("Tax & Registration")
    if (commercialRateIncomplete) incompleteStageLabels.push("Commercial Rate")

    if (incompleteStageLabels.length > 0) {
      setSubmitError(
        `${incompleteStageLabels.length} stage${incompleteStageLabels.length === 1 ? "" : "s"} ` +
          `need${incompleteStageLabels.length === 1 ? "s" : ""} attention before you can submit: ${incompleteStageLabels.join(", ")}.`
      )
      // A survey-page error already moved `currentPageNo` there (see this
      // function's own header); only the non-survey Commercial Rate stage
      // needs a manual jump so it, too, "opens with field-specific errors"
      // rather than leaving the requester on whichever stage they submitted
      // from.
      if (!customerDetailsHasErrors && !taxRegistrationHasErrors && commercialRateIncomplete) {
        goToStage("commercial_rate")
      }
      return
    }

    setSubmitError(null)

    if (!duplicateWarningAcknowledged) {
      setPendingAction("submit")
      const duplicateResult = await checkForDuplicateCustomersAction({
        gstNumber: (survey.getValue(CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber) as string | undefined) ?? null,
        pan: (survey.getValue(CUSTOMER_ONBOARDING_FIELD_KEYS.pan) as string | undefined) ?? null,
        legalEntityName: (survey.getValue(CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName) as string | undefined) ?? null,
        brandName: (survey.getValue(CUSTOMER_ONBOARDING_FIELD_KEYS.brandName) as string | undefined) ?? null,
      })
      setPendingAction(null)
      if (duplicateResult.ok && duplicateResult.matches.length > 0) {
        setDuplicateMatches(duplicateResult.matches)
        if (hasHardDuplicateMatch(duplicateResult.matches)) return
        setDuplicateWarningAcknowledged(true)
        return
      }
      setDuplicateMatches([])
    }

    setPendingAction("submit")
    setDraftSaved(false)
    const rawData = { ...survey.data, [CUSTOMER_ONBOARDING_FIELD_KEYS.commercialRate]: commercialRate }
    const saveResult = await saveOnboardingDraftAction(requestId, rawData, activeStageKey)
    if (!saveResult.ok) {
      setPendingAction(null)
      setSubmitError(saveResult.error)
      return
    }
    const submitResult = await submitOnboardingCaseAction(requestId)
    setPendingAction(null)
    if (submitResult.ok) {
      setOnboardingCase(submitResult.onboardingCase)
      setSubmittedViewMode("confirmation")
    } else {
      setSubmitError(submitResult.error)
    }
  }

  /** Task Phase C: only reachable while status is exactly "draft" (see the footer's canCancel gate); the RPC re-checks this server-side regardless. */
  async function handleCancelDraft() {
    setPendingAction("cancel")
    setCancelError(null)
    const result = await cancelOnboardingCaseAction(requestId, cancelReason.trim() || null)
    setPendingAction(null)
    if (result.ok) {
      setOnboardingCase(result.onboardingCase)
      setIsCancelling(false)
    } else {
      setCancelError(result.error)
    }
  }

  const isIndia = country === DEFAULT_COUNTRY_CODE
  const isSurveyStage =
    (CUSTOMER_ONBOARDING_STAGES.find((stage) => stage.key === activeStageKey)?.order ?? 0) <= SURVEY_STAGE_ORDER_LIMIT

  // Always false: no authenticated Legal Approval action exists yet
  // (task spec §26). This is a display-only constant, never a fake
  // approval a user can trigger from this UI.
  const legalApprovalComplete = false
  const completionReady = isEligibleForCompletion({
    hasSignedAgreement: signedAgreement !== null,
    legalApprovalComplete,
  })

  // Read fresh on every render (see `forceRerenderOnFieldChange` above):
  // completeness always comes from the data actually entered, never from
  // which stage is current or which stages have been visited.
  const stageStatuses = {
    customer_details: evaluateCustomerDetailsStatus(survey.data),
    tax_registration: evaluateTaxRegistrationStatus(survey.data, isIndia, {
      gst: taxDocuments.gst !== null,
      pan: taxDocuments.pan !== null,
      tan: taxDocuments.tan !== null,
      taxRegistration: taxDocuments.taxRegistration !== null,
      companyRegistration: taxDocuments.companyRegistration !== null,
    }),
    commercial_documents: evaluateCommercialDocumentsStatus(),
    commercial_rate: evaluateCommercialRateStatus(snapshot, commercialRate),
    agreement_approval: evaluateAgreementApprovalStatus(signedAgreement !== null, legalApprovalComplete, completionReady),
  }

  const currentStageMeta = CUSTOMER_ONBOARDING_STAGES.find((stage) => stage.key === activeStageKey)
  const isFirstStage = isFirstOnboardingStage(currentStageMeta?.order ?? 1)
  const isLastStage = isLastOnboardingStage(currentStageMeta?.order ?? 1)

  // Submitted/resubmitted defaults to the Submitted confirmation screen
  // (task defect §3: a green "Submitted" badge alone left the user with
  // no idea what to do next). The underlying business rule is unchanged:
  // a submitted case is never a Customer Master, so this never claims
  // otherwise. "View Request" swaps to the read-only survey below.
  if (onboardingCase.status === "cancelled") {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Customer Onboarding" description={formatOnboardingCaseId(onboardingCase.caseNumber)} />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-10 sm:px-6">
          <Badge variant="ghost" className="w-fit bg-muted text-muted-foreground">
            Cancelled
          </Badge>
          <p className="text-sm text-foreground">This onboarding request was cancelled and is no longer actionable.</p>
          {onboardingCase.cancelledReason ? <p className="text-xs text-muted-foreground">Reason: {onboardingCase.cancelledReason}</p> : null}
          <Button variant="outline" size="sm" className="w-fit" render={<Link href="/forms/customer-onboarding" />}>
            Back to Customer Onboarding
          </Button>
        </div>
      </div>
    )
  }

  if ((onboardingCase.status === "submitted" || onboardingCase.status === "resubmitted") && submittedViewMode === "confirmation") {
    const legalName = (onboardingCase.currentRevision.data[CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName] as string) || "This customer"
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Customer Onboarding" description={formatOnboardingCaseId(onboardingCase.caseNumber)} />
        <OnboardingSubmittedScreen
          legalName={legalName}
          requestId={requestId}
          caseNumber={onboardingCase.caseNumber}
          submittedAt={onboardingCase.currentRevision.submittedAt}
          revisionNumber={onboardingCase.currentRevision.revisionNumber}
          canReview={canReview}
          onViewRequest={() => setSubmittedViewMode("detail")}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Customer Onboarding"
        description={formatOnboardingCaseId(onboardingCase.caseNumber)}
        actions={
          isLocked ? (
            <div className="flex items-center gap-2">
              <Badge variant="ghost" className="gap-1 bg-success/10 text-success">
                <CheckCircle2Icon data-icon="inline-start" className="size-3" />
                {onboardingCase.status === "approved" ? "Approved" : "Submitted"}
              </Badge>
              {onboardingCase.status !== "approved" ? (
                <Button variant="outline" size="sm" onClick={() => setSubmittedViewMode("confirmation")}>
                  Back to Summary
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      {onboardingCase.status === "sent_back" && onboardingCase.sentBack ? (
        <div className="mx-4 mt-4 rounded-md border border-warning/30 bg-warning/5 px-3 py-3 text-xs text-foreground sm:mx-6">
          <span className="font-medium">Sent back for revision.</span> {onboardingCase.sentBack.reason}
          {activeFieldComments.length > 0 ? (
            <span className="block pt-1 text-muted-foreground">
              {activeFieldComments.length} field{activeFieldComments.length === 1 ? "" : "s"} below need review.
            </span>
          ) : null}
        </div>
      ) : null}

      {snapshotUnavailable ? (
        <div className="mx-4 mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 text-xs text-destructive sm:mx-6">
          Reference Master could not be reached. Industry, Segment, Business Unit, Tax Identifier Type, Currency, Pricing Unit, and Invoice
          Frequency choices below may be incomplete until the backend is reachable again.
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Process</span>
            <div className="hidden sm:block">
              <ProcessJourney stages={toProcessJourneyStages(activeStageKey, stageStatuses)} />
            </div>
            <div className="flex items-center gap-2 text-sm sm:hidden">
              <span className="inline-block size-1.5 shrink-0 rounded-full bg-foreground" />
              <span className="font-medium text-foreground">
                {CUSTOMER_ONBOARDING_STAGES.find((stage) => stage.key === activeStageKey)?.label}
              </span>
              <span className="text-xs text-muted-foreground">
                Step {CUSTOMER_ONBOARDING_STAGES.find((stage) => stage.key === activeStageKey)?.order} of{" "}
                {CUSTOMER_ONBOARDING_STAGES.length}
              </span>
            </div>
          </div>

          <div className="-mx-1 overflow-x-auto px-1">
            <ToggleGroup value={[activeStageKey]} onValueChange={handleStageTabChange} variant="outline" size="sm" className="w-max">
              {CUSTOMER_ONBOARDING_STAGES.map((stage) => (
                <ToggleGroupItem key={stage.key} value={stage.key}>
                  {stage.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="flex flex-col gap-6 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          {isSurveyStage ? <Survey model={survey} /> : null}

          {activeStageKey === "tax_registration" ? (
            <div className="flex flex-col gap-3">
              <Separator />
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Documents</span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {isIndia ? (
                  <>
                    <AttachmentUpload
                      requestId={requestId}
                      category="tax"
                      documentType="gst_certificate"
                      label={ONBOARDING_DOCUMENT_LABELS.gst_certificate}
                      value={taxDocuments.gst}
                      onChange={(next) => setTaxDocuments((current) => ({ ...current, gst: next }))}
                    />
                    <AttachmentUpload
                      requestId={requestId}
                      category="tax"
                      documentType="pan_card"
                      label={ONBOARDING_DOCUMENT_LABELS.pan_card}
                      value={taxDocuments.pan}
                      onChange={(next) => setTaxDocuments((current) => ({ ...current, pan: next }))}
                    />
                    <AttachmentUpload
                      requestId={requestId}
                      category="tax"
                      documentType="tan_card"
                      label={ONBOARDING_DOCUMENT_LABELS.tan_card}
                      value={taxDocuments.tan}
                      onChange={(next) => setTaxDocuments((current) => ({ ...current, tan: next }))}
                    />
                  </>
                ) : (
                  <>
                    <AttachmentUpload
                      requestId={requestId}
                      category="tax"
                      documentType="tax_registration"
                      label={ONBOARDING_DOCUMENT_LABELS.tax_registration}
                      value={taxDocuments.taxRegistration}
                      onChange={(next) => setTaxDocuments((current) => ({ ...current, taxRegistration: next }))}
                    />
                    <AttachmentUpload
                      requestId={requestId}
                      category="tax"
                      documentType="company_registration"
                      label={ONBOARDING_DOCUMENT_LABELS.company_registration}
                      helpText="Upload a document that confirms the registered legal entity/company name."
                      value={taxDocuments.companyRegistration}
                      onChange={(next) => setTaxDocuments((current) => ({ ...current, companyRegistration: next }))}
                    />
                  </>
                )}
              </div>
            </div>
          ) : null}

          {activeStageKey === "commercial_documents" ? (
            <div className="flex flex-col gap-3">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial Documents</span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {COMMERCIAL_DOCUMENT_DEFINITIONS.map((definition) => (
                  <AttachmentUpload
                    key={definition.documentType}
                    requestId={requestId}
                    category="commercial"
                    documentType={definition.documentType}
                    label={definition.label}
                    helpText={definition.helpText}
                    value={commercialDocuments[COMMERCIAL_DOCUMENT_STATE_KEYS[definition.documentType]]}
                    onChange={(next) =>
                      setCommercialDocuments((current) => ({
                        ...current,
                        [COMMERCIAL_DOCUMENT_STATE_KEYS[definition.documentType]]: next,
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}

          {activeStageKey === "commercial_rate" ? (
            <div className="flex flex-col gap-4">
              <CommercialRateSection value={commercialRate} onChange={setCommercialRate} />
            </div>
          ) : null}

          {activeStageKey === "agreement_approval" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Agreement</span>
                <div className="max-w-md">
                  <AttachmentUpload
                    requestId={requestId}
                    category="agreement"
                    documentType="signed_agreement"
                    label={ONBOARDING_DOCUMENT_LABELS.signed_agreement}
                    value={signedAgreement}
                    onChange={setSignedAgreement}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Legal Approval</span>
                <div className="flex items-center gap-2">
                  <Badge variant="ghost" className="gap-1 bg-warning/10 text-warning">
                    <ClockIcon data-icon="inline-start" className="size-3" />
                    Pending
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Requires an authorized Legal reviewer. Not yet available in this build.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-1.5 rounded-md border px-3 py-2.5">
                <span className="text-xs font-medium text-foreground">
                  {completionReady ? "Ready for final completion" : "Not yet eligible for final completion"}
                </span>
                <p className="text-[0.7rem] text-muted-foreground">
                  Final completion requires a Signed Agreement ({signedAgreement ? "attached" : "missing"}) and Legal
                  Approval ({legalApprovalComplete ? "complete" : "pending"}).
                </p>
              </div>
            </div>
          ) : null}

          {submitError ? (
            <p role="alert" className="text-xs text-destructive">
              {submitError}
            </p>
          ) : null}

          {duplicateMatches.length > 0 ? (
            <div
              className={`flex flex-col gap-2 rounded-md border px-3 py-2.5 ${
                hasHardDuplicateMatch(duplicateMatches) ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
              }`}
            >
              <p className="text-xs font-medium text-foreground">Potential existing customer</p>
              {duplicateMatches.map((match) => (
                <p key={`${match.fieldKey}-${match.customerId}`} className="text-xs text-muted-foreground">
                  {FIELD_LABELS[match.fieldKey]} &quot;{match.matchedValue}&quot; already belongs to{" "}
                  <Link href={`/customers/${match.customerKey}`} className="font-medium text-foreground underline underline-offset-2">
                    {match.customerName}
                  </Link>
                  .
                </p>
              ))}
              {hasHardDuplicateMatch(duplicateMatches) ? (
                <p className="text-xs text-muted-foreground">
                  This GST or PAN already belongs to an existing customer. Correct the value above, or contact your administrator if this is
                  genuinely a different legal entity.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This looks similar to an existing customer. If this is genuinely a different business, click Submit again to continue.
                </p>
              )}
            </div>
          ) : null}

          {!isLocked ? (
            <>
              <Separator />
              {draftSaved ? <p className="text-[0.7rem] text-muted-foreground">Draft saved.</p> : null}

              {isCancelling ? (
                <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <label className="text-xs font-medium text-foreground" htmlFor="cancel-draft-reason">
                    Cancel this draft? This cannot be undone. Reason (optional)
                  </label>
                  <textarea
                    id="cancel-draft-reason"
                    className="min-h-16 rounded-md border bg-transparent px-3 py-2 text-sm"
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                  />
                  {cancelError ? <p className="text-xs text-destructive">{cancelError}</p> : null}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsCancelling(false)} disabled={pendingAction !== null}>
                      Never mind
                    </Button>
                    <PendingButton
                      variant="destructive"
                      size="sm"
                      onClick={handleCancelDraft}
                      pending={pendingAction === "cancel"}
                      pendingLabel="Cancelling..."
                    >
                      Confirm Cancel
                    </PendingButton>
                  </div>
                </div>
              ) : (
                <OnboardingStageFooter
                  isFirstStage={isFirstStage}
                  isLastStage={isLastStage}
                  pendingAction={pendingAction}
                  canCancel={onboardingCase.status === "draft"}
                  // eslint-disable-next-line react-hooks/immutability -- goToStage's own SurveyJS Model mutation is already justified at its definition; this closure just forwards to it.
                  onPrevious={() => {
                    const previous = adjacentOnboardingStage(currentStageMeta?.order ?? 1, "previous")
                    if (previous) goToStage(previous.key)
                  }}
                  onSaveDraft={handleSaveDraft}
                  // eslint-disable-next-line react-hooks/immutability -- handleNext's eventual goToStage call is already justified at its definition; this closure just forwards to it.
                  onNext={() => {
                    const next = adjacentOnboardingStage(currentStageMeta?.order ?? 1, "next")
                    if (next) handleNext(next.key)
                  }}
                  onSubmit={handleSubmit}
                  onCancelClick={() => setIsCancelling(true)}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export { CustomerOnboardingPage }
