"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

import { saveChangeDraftAction, submitChangeRequestAction } from "../actions"
import { evaluateCustomerChangeRequirements } from "../domain/workflow-rules"
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
  const isLocked = initialChangeRequest.status !== "draft" && initialChangeRequest.status !== "sent_back"

  const initialFormValues = useMemo(() => {
    const merged: Record<string, string | null> = { ...currentValues }
    for (const [key, value] of Object.entries(initialChangeRequest.proposedValues)) {
      merged[key] = value === null || value === undefined ? null : String(value)
    }
    return merged
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize once from the loaded Change Request; the form owns its own state after that, same pattern as customer-onboarding-page.tsx.
  }, [])

  const [formValues, setFormValues] = useState<Record<string, string | null>>(initialFormValues)
  const [reason, setReason] = useState(initialChangeRequest.reason ?? "")
  const [effectiveDate, setEffectiveDate] = useState(initialChangeRequest.effectiveDate ?? new Date().toISOString().slice(0, 10))
  const [pendingAction, setPendingAction] = useState<"save" | "submit" | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const requirements = useMemo(() => evaluateCustomerChangeRequirements(currentValues, formValues), [currentValues, formValues])

  function handleFieldChange(key: GovernedFieldKey, value: string) {
    setFormValues((previous) => ({ ...previous, [key]: value }))
  }

  async function handleSaveDraft() {
    setActionError(null)
    setPendingAction("save")
    const result = await saveChangeDraftAction(requestId, formValues)
    setPendingAction(null)
    if (!result.ok) setActionError(result.error)
  }

  async function handleSubmit() {
    setActionError(null)
    setPendingAction("submit")
    await saveChangeDraftAction(requestId, formValues)
    const result = await submitChangeRequestAction(requestId, reason, effectiveDate)
    setPendingAction(null)
    if (result.ok) {
      router.push(`/customers`)
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={`Change Request: ${customerName}`}
        description={`Request ${requestId}`}
        actions={
          <Badge variant="ghost" className="bg-muted text-muted-foreground">
            {initialChangeRequest.status}
          </Badge>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        {initialChangeRequest.status === "sent_back" && initialChangeRequest.sentBack ? (
          <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Sent back for revision: </span>
            {initialChangeRequest.sentBack.reason}
          </div>
        ) : null}

        <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Proposed Values</h2>
          {isLocked ? (
            <p className="text-xs text-muted-foreground">This Change Request has already been {initialChangeRequest.status} and can no longer be edited.</p>
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
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export { ChangeRequestPage }
