"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { approveChangeRequestAction, rejectChangeRequestAction, sendBackChangeRequestAction } from "../actions"
import type { CustomerChangeRequest } from "../domain/types"
import { formatChangeRequestId } from "../domain/types"
import { FieldDiffTable } from "./field-diff-table"
import { RequirementsPreview } from "./requirements-preview"

/**
 * Reviewer surface for one Customer Change Request (task spec §16-17):
 * Current vs Proposed, Reason, Required Approvals/Evidence, Revision
 * history status. Actions: Approve / Send Back / Reject. Never directly
 * edits Customer Master from here (approve_customer_change_request is
 * the only write path, and it is the single atomic apply).
 */

function ChangeRequestReviewPage({
  requestId,
  customerName,
  customerKey,
  currentValues,
  changeRequest,
  canDecide,
}: {
  requestId: string
  customerName: string
  customerKey: string
  currentValues: Record<string, unknown>
  changeRequest: CustomerChangeRequest
  canDecide: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<"idle" | "send_back" | "reject">("idle")
  const [reason, setReason] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  const isDecidable = canDecide && (changeRequest.status === "submitted" || changeRequest.status === "resubmitted")

  async function handleApprove() {
    setActionError(null)
    setIsSubmittingAction(true)
    const result = await approveChangeRequestAction(requestId)
    setIsSubmittingAction(false)
    if (result.ok) {
      router.push(`/customers/${customerKey}`)
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  async function handleSendBack() {
    if (!reason.trim()) {
      setActionError("A reason is required to send this Change Request back.")
      return
    }
    setActionError(null)
    setIsSubmittingAction(true)
    const result = await sendBackChangeRequestAction(requestId, reason)
    setIsSubmittingAction(false)
    if (result.ok) {
      router.push("/reviews/change-requests")
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      setActionError("A reason is required to reject this Change Request.")
      return
    }
    setActionError(null)
    setIsSubmittingAction(true)
    const result = await rejectChangeRequestAction(requestId, reason)
    setIsSubmittingAction(false)
    if (result.ok) {
      router.push("/reviews/change-requests")
      router.refresh()
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
          <div className="flex items-center gap-2">
            <Badge variant="ghost" className="bg-muted text-muted-foreground">
              {changeRequest.status}
            </Badge>
            <Button variant="outline" size="sm" render={<Link href={`/customers/${customerKey}`} />}>
              Customer
            </Button>
          </div>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reason</h2>
          <p className="text-sm text-foreground">{changeRequest.reason || "No reason recorded."}</p>
          {changeRequest.effectiveDate ? <p className="text-xs text-muted-foreground">Effective Date: {changeRequest.effectiveDate}</p> : null}
        </section>

        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Current vs Proposed</h2>
          <FieldDiffTable currentValues={currentValues} proposedValues={changeRequest.proposedValues} />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Required Approvals / Evidence</h2>
          <RequirementsPreview requirements={changeRequest.requirements} />
        </section>

        {changeRequest.sentBack ? (
          <section className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 p-4 text-xs">
            <span className="font-medium text-foreground">Previously sent back:</span>
            <span className="text-muted-foreground">{changeRequest.sentBack.reason}</span>
          </section>
        ) : null}

        {isDecidable ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Review Decision</h2>

            {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}

            {mode === "idle" ? (
              <div className="flex flex-wrap gap-2">
                <PendingButton size="sm" onClick={handleApprove} pending={isSubmittingAction} pendingLabel="Approving...">
                  Approve
                </PendingButton>
                <Button size="sm" variant="outline" onClick={() => setMode("send_back")} disabled={isSubmittingAction}>
                  Send Back
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode("reject")} disabled={isSubmittingAction}>
                  Reject
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground" htmlFor="decision-reason">
                  Reason for {mode === "send_back" ? "sending back" : "rejecting"}
                </label>
                <textarea
                  id="decision-reason"
                  className="min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setMode("idle")} disabled={isSubmittingAction}>
                    Cancel
                  </Button>
                  <PendingButton
                    size="sm"
                    onClick={mode === "send_back" ? handleSendBack : handleReject}
                    pending={isSubmittingAction}
                    pendingLabel={mode === "send_back" ? "Sending back..." : "Rejecting..."}
                  >
                    Confirm {mode === "send_back" ? "Send Back" : "Reject"}
                  </PendingButton>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {changeRequest.status === "approved" || changeRequest.status === "rejected" ? (
          <p className="text-xs text-muted-foreground">
            {changeRequest.status === "approved" ? "Approved" : "Rejected"}
            {changeRequest.decidedAt ? ` on ${new Date(changeRequest.decidedAt).toLocaleDateString()}` : ""}. This Change Request is historical evidence
            and can no longer be changed.
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { ChangeRequestReviewPage }
