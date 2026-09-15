"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { labelForCaseStatus } from "@/platform/approvals/domain/inbox"
import { saveChangeDraftAction, submitChangeRequestAction, cancelChangeRequestAction } from "../actions"
import { evaluateCustomerChangeRequirements } from "../domain/workflow-rules"
import { formatChangeRequestId } from "../domain/types"
import type { CustomerChangeRequest } from "../domain/types"
import type { GovernedFieldKey } from "../domain/governed-fields"
import { GovernedFieldsForm } from "./governed-fields-form"
import { FieldDiffTable } from "./field-diff-table"
import { RequirementsPreview } from "./requirements-preview"

/**
 * Requester-facing Customer Change Request screen (task spec §4-6,
 * §13-17): "Create Change Request", edit only the proposed values,
 * see Current vs Proposed live, see Required Approvals/Evidence before
 * Submit, Save Draft or Submit. Mirrors
 * src/features/customer-onboarding/ui/customer-onboarding-page.tsx's
 * shape for the equivalent draft/submit split.
 */

function ChangeRequestPage({
  requestId,
  customerName,
  currentValues,
  initialChangeRequest,
}: {
  requestId: string
  customerName: string
  currentValues: Record<string, string | null>
  initialChangeRequest: CustomerChangeRequest
}) {
  const router = useRouter()
  const [changeRequest, setChangeRequest] = useState(initialChangeRequest)
  const isLocked = changeRequest.status !== "draft" && changeRequest.status !== "sent_back"

  const initialFormValues = useMemo(() => {
    const merged: Record<string, string | null> = { ...currentValues }
    for (const [key, value] of Object.entries(changeRequest.proposedValues)) {
      merged[key] = value === null || value === undefined ? null : String(value)
    }
    return merged
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize once from the loaded Change Request; the form owns its own state after that, same pattern as customer-onboarding-page.tsx.
  }, [])

  const [formValues, setFormValues] = useState<Record<string, string | null>>(initialFormValues)
  const [reason, setReason] = useState(changeRequest.reason ?? "")
  const [effectiveDate, setEffectiveDate] = useState(changeRequest.effectiveDate ?? new Date().toISOString().slice(0, 10))
  const [pendingAction, setPendingAction] = useState<"save" | "submit" | "cancel" | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

  const requirements = useMemo(() => evaluateCustomerChangeRequirements(currentValues, formValues), [currentValues, formValues])

  function handleFieldChange(key: GovernedFieldKey, value: string) {
    setFormValues((previous) => ({ ...previous, [key]: value }))
  }

  async function handleSaveDraft() {
    setActionError(null)
    setPendingAction("save")
    const result = await saveChangeDraftAction(requestId, formValues, changeRequest.revisionRowVersion)
    setPendingAction(null)
    if (result.ok) {
      setChangeRequest(result.changeRequest)
    } else {
      setActionError(result.error)
    }
  }

  async function handleSubmit() {
    setActionError(null)
    setPendingAction("submit")
    const saveResult = await saveChangeDraftAction(requestId, formValues, changeRequest.revisionRowVersion)
    if (!saveResult.ok) {
      setPendingAction(null)
      setActionError(saveResult.error)
      return
    }
    setChangeRequest(saveResult.changeRequest)
    const result = await submitChangeRequestAction(requestId, reason, effectiveDate)
    setPendingAction(null)
    if (result.ok) {
      router.push(`/customers`)
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  /** Task Phase G: only reachable while status is exactly "draft" (see the Cancel Draft control's gate below); the RPC re-checks this server-side regardless. */
  async function handleCancelDraft() {
    setActionError(null)
    setPendingAction("cancel")
    const result = await cancelChangeRequestAction(requestId, cancelReason.trim() || null)
    setPendingAction(null)
    if (result.ok) {
      setChangeRequest(result.changeRequest)
      setIsCancelling(false)
    } else {
      setActionError(result.error)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={`Change Request: ${customerName}`}
        description={formatChangeRequestId(changeRequest.requestNumber)}
        actions={
          <Badge variant="ghost" className="bg-muted text-muted-foreground">
            {labelForCaseStatus(changeRequest.status)}
          </Badge>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        {changeRequest.status === "sent_back" && changeRequest.sentBack ? (
          <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Sent back for revision: </span>
            {changeRequest.sentBack.reason}
          </div>
        ) : null}

        <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Proposed Values</h2>
          {isLocked ? (
            <p className="text-xs text-muted-foreground">This Change Request has already been {changeRequest.status} and can no longer be edited.</p>
          ) : (
            <GovernedFieldsForm values={formValues} onChange={handleFieldChange} />
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Current vs Proposed</h2>
          <FieldDiffTable currentValues={currentValues} proposedValues={formValues} />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Required Approvals / Evidence</h2>
          <RequirementsPreview requirements={requirements} />
        </section>

        {!isLocked ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Submit</h2>
            {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground" htmlFor="change-reason">
                Reason for this change
              </label>
              <textarea
                id="change-reason"
                className="min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground" htmlFor="effective-date">
                  Effective Date
                </label>
                <Input id="effective-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
              </div>
              <PendingButton
                size="sm"
                variant="outline"
                onClick={handleSaveDraft}
                pending={pendingAction === "save"}
                pendingLabel="Saving..."
                disabled={pendingAction === "submit"}
              >
                Save Draft
              </PendingButton>
              <PendingButton size="sm" onClick={handleSubmit} pending={pendingAction === "submit"} pendingLabel="Submitting..." disabled={pendingAction === "save"}>
                Submit
              </PendingButton>
              {changeRequest.status === "draft" && !isCancelling ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setIsCancelling(true)}
                  disabled={pendingAction !== null}
                >
                  Cancel Draft
                </Button>
              ) : null}
            </div>

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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsCancelling(false)} disabled={pendingAction !== null}>
                    Never mind
                  </Button>
                  <PendingButton variant="destructive" size="sm" onClick={handleCancelDraft} pending={pendingAction === "cancel"} pendingLabel="Cancelling...">
                    Confirm Cancel
                  </PendingButton>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}

export { ChangeRequestPage }
