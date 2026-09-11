"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Survey } from "survey-react-ui"
import { CheckCircle2Icon, ClockIcon } from "lucide-react"

import "@/platform/forms/survey-theme"
import "./geography-combobox-question"
import { useSurveyModel } from "@/platform/forms/use-survey-model"
import type { SurveyFormMode } from "@/platform/forms/types"
import { PageHeader } from "@/components/product/page-header"
import { ProcessJourney } from "@/components/product/process-journey"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getActiveOptions } from "@/features/reference-data"
import type { ReferenceListKey, ReferenceOption } from "@/features/reference-data"
import { CUSTOMER_ONBOARDING_STAGES, toProcessJourneyStages } from "../domain/process"
import { COMMERCIAL_DOCUMENT_DEFINITIONS } from "../domain/commercial-documents"
import { createEmptyCommercialRateDraft } from "../domain/commercial-rate"
import type { CommercialRateDraft } from "../domain/commercial-rate"
import { createCase, setCurrentStage, submitCase, updateRevisionData } from "../domain/case"
import { isEligibleForCompletion } from "../domain/completion"
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
import type { SelectedAttachmentFile } from "./attachment-upload"
import { CommercialRateSection } from "./commercial-rate-section"

const REFERENCE_LISTS: ReferenceListKey[] = [
  "country",
  "industry",
  "segment",
  "business_unit",
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

/**
 * A deterministic six-digit id derived from React's own `useId()` value,
 * not `Math.random()`: `useId()` is guaranteed identical between the
 * server render and the client hydration render, so deriving from it
 * avoids the hydration mismatch a random value would cause on the
 * visible "Request REQ-XXXXXX" text, without deferring the id to a
 * post-mount effect.
 */
function makeRequestId(reactId: string) {
  let hash = 0
  for (let index = 0; index < reactId.length; index += 1) {
    hash = (hash * 31 + reactId.charCodeAt(index)) >>> 0
  }
  return `REQ-${100000 + (hash % 900000)}`
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
function CustomerOnboardingPage() {
  const reactId = useId()
  const [requestId] = useState(() => makeRequestId(reactId))
  const [onboardingCase, setOnboardingCase] = useState(() => createCase(requestId, new Date().toISOString(), null))
  const [draftSaved, setDraftSaved] = useState(false)
  const [activeStageKey, setActiveStageKey] = useState<CustomerOnboardingStageKey>("customer_details")
  const [country, setCountry] = useState<string | null>(DEFAULT_COUNTRY_CODE)
  const [taxDocuments, setTaxDocuments] = useState<{
    gst: SelectedAttachmentFile | null
    pan: SelectedAttachmentFile | null
    tan: SelectedAttachmentFile | null
    taxRegistration: SelectedAttachmentFile | null
    companyRegistration: SelectedAttachmentFile | null
  }>({ gst: null, pan: null, tan: null, taxRegistration: null, companyRegistration: null })
  const [commercialDocuments, setCommercialDocuments] = useState<{
    proposal: SelectedAttachmentFile | null
    customerPo: SelectedAttachmentFile | null
    piCopy: SelectedAttachmentFile | null
  }>({ proposal: null, customerPo: null, piCopy: null })
  const [signedAgreement, setSignedAgreement] = useState<SelectedAttachmentFile | null>(null)
  const [commercialRate, setCommercialRate] = useState<CommercialRateDraft>(() => createEmptyCommercialRateDraft())
  const [submitError, setSubmitError] = useState<string | null>(null)
  /**
   * Bumped on every SurveyJS `onValueChanged` event (see the effect below),
   * for no reason other than to make this component re-render: `survey`
   * is an imperative Model instance, so a field edit inside it does not by
   * itself trigger a React re-render here, but the stage-status indicator
   * below reads `survey.data` fresh on every render and needs one to stay
   * live while the user types.
   */
  const [, forceRerenderOnFieldChange] = useState(0)

  const isLocked = onboardingCase.currentRevision.status === "submitted"
  const mode: SurveyFormMode = isLocked ? "readonly" : "edit"

  const formDefinition = useMemo(() => {
    const optionsByList = Object.fromEntries(
      REFERENCE_LISTS.map((list) => [list, getActiveOptions(list)])
    ) as Record<ReferenceListKey, ReferenceOption[]>
    return buildCustomerOnboardingFormDefinition(optionsByList)
  }, [])

  const survey = useSurveyModel(formDefinition.json, mode)

  // Country -> State -> City wiring, plus stage-tab sync. One effect, torn
  // down together, since all three subscribe to the same Model instance.
  useEffect(() => {
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
  }, [survey])

  function handleSaveDraft() {
    setOnboardingCase((current) =>
      updateRevisionData(
        current,
        { ...survey.data, [CUSTOMER_ONBOARDING_FIELD_KEYS.commercialRate]: commercialRate },
        new Date().toISOString(),
        null
      )
    )
    setDraftSaved(true)
  }

  function handleSubmit() {
    const fieldsValid = survey.validate()
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
    setSubmitError(documentErrorMessages.length > 0 ? documentErrorMessages.join(" ") : null)

    if (!fieldsValid || documentErrorMessages.length > 0) return

    setOnboardingCase((current) => {
      const withLatestData = updateRevisionData(
        current,
        { ...survey.data, [CUSTOMER_ONBOARDING_FIELD_KEYS.commercialRate]: commercialRate },
        new Date().toISOString(),
        null
      )
      return submitCase(withLatestData, new Date().toISOString(), null)
    })
  }

  function handleStageTabChange(value: string[]) {
    if (!value[0]) return
    const stage = CUSTOMER_ONBOARDING_STAGES.find((entry) => entry.key === value[0])
    if (!stage) return
    if (stage.order <= SURVEY_STAGE_ORDER_LIMIT) {
      // eslint-disable-next-line react-hooks/immutability -- SurveyJS Model is an imperative instance; this is its documented API for changing the current page (see platform/forms/use-survey-model.ts for the same pattern with `survey.mode`).
      survey.currentPageNo = stage.order - 1
    } else {
      // Commercial Documents, Commercial Rate, and Agreement & Approval
      // are not survey pages (see
      // ../forms/customer-onboarding-form-definition.ts's header), so
      // there is no survey page change to react to: this is the one
      // direct path that moves the active stage for them.
      setActiveStageKey(stage.key)
      setOnboardingCase((current) => setCurrentStage(current, stage.key))
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
    commercial_rate: evaluateCommercialRateStatus(commercialRate),
    agreement_approval: evaluateAgreementApprovalStatus(signedAgreement !== null, legalApprovalComplete, completionReady),
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Customer Onboarding"
        description={`Request ${requestId}`}
        actions={
          isLocked ? (
            <Badge variant="ghost" className="gap-1 bg-success/10 text-success">
              <CheckCircle2Icon data-icon="inline-start" className="size-3" />
              Submitted
            </Badge>
          ) : (
            <div className="flex items-center gap-3">
              {draftSaved ? <span className="text-[0.7rem] text-muted-foreground">Draft saved</span> : null}
              <Button variant="outline" size="sm" onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <Button size="sm" onClick={handleSubmit}>
                Submit
              </Button>
            </div>
          )
        }
      />

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
                      documentType="gst_certificate"
                      label="GST Registration Document"
                      value={taxDocuments.gst}
                      onChange={(next) => setTaxDocuments((current) => ({ ...current, gst: next }))}
                    />
                    <AttachmentUpload
                      documentType="pan_card"
                      label="PAN Document"
                      value={taxDocuments.pan}
                      onChange={(next) => setTaxDocuments((current) => ({ ...current, pan: next }))}
                    />
                    <AttachmentUpload
                      documentType="tan_card"
                      label="TAN Document"
                      value={taxDocuments.tan}
                      onChange={(next) => setTaxDocuments((current) => ({ ...current, tan: next }))}
                    />
                  </>
                ) : (
                  <>
                    <AttachmentUpload
                      documentType="tax_registration"
                      label="Tax Registration Document"
                      value={taxDocuments.taxRegistration}
                      onChange={(next) => setTaxDocuments((current) => ({ ...current, taxRegistration: next }))}
                    />
                    <AttachmentUpload
                      documentType="company_registration"
                      label="Company Registration / Incorporation Document"
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
            <CommercialRateSection value={commercialRate} onChange={setCommercialRate} />
          ) : null}

          {activeStageKey === "agreement_approval" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Agreement</span>
                <div className="max-w-md">
                  <AttachmentUpload
                    documentType="signed_agreement"
                    label="Signed Agreement"
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
        </div>
      </div>
    </div>
  )
}

export { CustomerOnboardingPage }
