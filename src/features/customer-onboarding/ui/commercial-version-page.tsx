"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

import { labelForCaseStatus } from "@/platform/approvals/domain/inbox"
import { saveCommercialVersionDraftAction, submitCommercialVersionAction, cancelCommercialVersionAction } from "../actions"
import { createEmptyCommercialRateDraft } from "../domain/commercial-rate"
import type { CommercialRateDraft } from "../domain/commercial-rate"
import { formatCommercialVersionId } from "../domain/commercial-version-types"
import type { CommercialConfigurationVersion } from "../domain/commercial-version-types"
import { CommercialRateSection } from "./commercial-rate-section"

/**
 * Requester-facing Commercial Configuration Version screen (task spec
 * §10-13): "Create New Version copies current Active into Version 2
 * Draft, reuse existing Commercial Rate editor." Reuses
 * `CommercialRateSection` exactly as onboarding's own Commercial Rate
 * stage does; its own Previous/Save Draft/Next footer is repurposed here
 * (Previous -> back to Commercials, Next -> reveal Submit).
 */

function CommercialVersionPage({
  requestId,
  configId,
  initialVersion,
}: {
  requestId: string
  configId: string
  initialVersion: CommercialConfigurationVersion
}) {
  const router = useRouter()
  const isLocked = initialVersion.status !== "draft"

  const [commercialRate, setCommercialRate] = useState<CommercialRateDraft>(initialVersion.commercialRate ?? createEmptyCommercialRateDraft())
  const [draftRowVersion, setDraftRowVersion] = useState(initialVersion.draftRowVersion)
  const [showSubmitPanel, setShowSubmitPanel] = useState(false)
  const [reason, setReason] = useState(initialVersion.reason ?? "")
  const [effectiveDate, setEffectiveDate] = useState(initialVersion.effectiveDate ?? new Date().toISOString().slice(0, 10))
  const [pendingAction, setPendingAction] = useState<"save" | "submit" | "cancel" | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

  async function handleSaveDraft() {
    setActionError(null)
    setPendingAction("save")
    const result = await saveCommercialVersionDraftAction(requestId, commercialRate, draftRowVersion)
    setPendingAction(null)
    if (result.ok) setDraftRowVersion(result.version.draftRowVersion)
    else setActionError(result.error)
  }

  async function handleSubmit() {
    setActionError(null)
    setPendingAction("submit")
    const saveResult = await saveCommercialVersionDraftAction(requestId, commercialRate, draftRowVersion)
    if (!saveResult.ok) {
      setPendingAction(null)
      setActionError(saveResult.error)
      return
    }
    const result = await submitCommercialVersionAction(requestId, reason, effectiveDate)
    setPendingAction(null)
    if (result.ok) {
      router.push(`/commercials/${configId}`)
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  /** Task Phase C: only reachable while status is exactly "draft" (see the Cancel Draft control's gate below); the RPC re-checks this server-side regardless. */
  async function handleCancelDraft() {
    setActionError(null)
    setPendingAction("cancel")
    const result = await cancelCommercialVersionAction(requestId, cancelReason.trim() || null)
    setPendingAction(null)
    if (result.ok) {
      router.push(`/commercials/${configId}`)
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Commercial Configuration Version"
        description={`${formatCommercialVersionId(initialVersion.versionNumber)}, ${initialVersion.changeCategory}`}
        actions={
          <Badge variant="ghost" className="bg-muted text-muted-foreground">
            {labelForCaseStatus(initialVersion.status)}
          </Badge>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        {isLocked ? (
          <p className="text-xs text-muted-foreground">This version has already been {initialVersion.status} and can no longer be edited.</p>
        ) : (
          <>
            <CommercialRateSection value={commercialRate} onChange={setCommercialRate} />

            <Separator />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push(`/commercials/${configId}`)} disabled={pendingAction !== null}>
                  Previous
                </Button>
                {initialVersion.status === "draft" && !isCancelling ? (
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
              <div className="flex items-center gap-2">
                <PendingButton
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDraft}
                  pending={pendingAction === "save"}
                  pendingLabel="Saving..."
                  disabled={pendingAction === "submit"}
                >
                  Save Draft
                </PendingButton>
                <Button size="sm" onClick={() => setShowSubmitPanel(true)} disabled={pendingAction !== null}>
                  Next
                </Button>
              </div>
            </div>

            {actionError && !isCancelling && !showSubmitPanel ? <p className="text-xs text-destructive">{actionError}</p> : null}

            {isCancelling ? (
              <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <label className="text-xs font-medium text-foreground" htmlFor="cancel-version-reason">
                  Cancel this draft? This cannot be undone. Reason (optional)
                </label>
                <textarea
                  id="cancel-version-reason"
                  className="min-h-16 rounded-md border bg-transparent px-3 py-2 text-sm"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
                {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}
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

            {showSubmitPanel ? (
              <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
                <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Submit for Approval</h2>
                {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="version-reason">
                    Reason for this version
                  </label>
                  <textarea
                    id="version-reason"
                    className="min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground" htmlFor="version-effective-date">
                      Effective Date
                    </label>
                    <Input id="version-effective-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
                  </div>
                  <PendingButton size="sm" onClick={handleSubmit} pending={pendingAction === "submit"} pendingLabel="Submitting...">
                    Submit
                  </PendingButton>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export { CommercialVersionPage }
