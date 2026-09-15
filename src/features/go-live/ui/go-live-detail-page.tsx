"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RequestTimeline } from "@/components/product/request-timeline"
import type { RequestTimelineEvent } from "@/components/product/request-timeline"
import { formatBusinessDate, formatTimestamp } from "@/lib/date"
import {
  saveGoLiveRequestDraftAction,
  submitGoLiveRequestAction,
  sendBackGoLiveRequestAction,
  approveGoLiveRequestAction,
  cancelGoLiveRequestAction,
  setGoLiveCustomerConfirmationAction,
  uploadGoLiveDocumentAction,
  getGoLiveDocumentDownloadUrlAction,
} from "../actions"
import { formatGoLiveRequestId } from "../domain/types"
import type { GoLiveRequest, GoLiveDocumentType, PersistedGoLiveDocumentMetadata } from "../domain/types"
import type { GoLiveLineItem } from "../domain/line-items"

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  sent_back: "Sent Back",
  resubmitted: "Resubmitted",
  approved: "Live",
  cancelled: "Cancelled",
}

const DOCUMENT_TYPE_LABEL: Record<GoLiveDocumentType, string> = {
  customer_confirmation: "Customer Confirmation Email",
  signed_uat_document: "Signed Go Live / UAT Document",
}

function GoLiveDetailPage({
  customerKey,
  request,
  lineItem,
  documents,
  timelineEvents,
  canSubmit,
  canApprove,
}: {
  customerKey: string
  request: GoLiveRequest
  lineItem: GoLiveLineItem | null
  documents: PersistedGoLiveDocumentMetadata[]
  timelineEvents: RequestTimelineEvent[]
  canSubmit: boolean
  canApprove: boolean
}) {
  const router = useRouter()
  const [goLiveDate, setGoLiveDate] = useState(request.goLiveDate)
  const [prorateFirstMonth, setProrateFirstMonth] = useState(request.prorateFirstMonth)
  const [sendBackReason, setSendBackReason] = useState("")
  const [showSendBackForm, setShowSendBackForm] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const confirmationFileRef = useRef<HTMLInputElement>(null)
  const uatFileRef = useRef<HTMLInputElement>(null)
  const [uploadingType, setUploadingType] = useState<GoLiveDocumentType | null>(null)

  const isEditable = request.status === "draft" || request.status === "sent_back"
  const isDecidable = request.status === "submitted" || request.status === "resubmitted"

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    setMessage(null)
    setIsPending(true)
    action().then((result) => {
      setIsPending(false)
      if (!result.ok) {
        setError(result.error ?? "An unexpected error occurred.")
        return
      }
      router.refresh()
    })
  }

  function handleSaveDraft() {
    run(() => saveGoLiveRequestDraftAction(request.id, goLiveDate, prorateFirstMonth, null, request.rowVersion))
  }

  function handleSubmit() {
    run(() => submitGoLiveRequestAction(request.id))
  }

  function handleApprove() {
    run(() => approveGoLiveRequestAction(request.id))
  }

  function handleSendBack() {
    if (!sendBackReason.trim()) {
      setError("A reason is required to send this request back.")
      return
    }
    run(async () => {
      const result = await sendBackGoLiveRequestAction(request.id, sendBackReason)
      if (result.ok) setShowSendBackForm(false)
      return result
    })
  }

  function handleCancel() {
    run(() => cancelGoLiveRequestAction(request.id, null))
  }

  function handleToggleConfirmation(confirmed: boolean) {
    run(() => setGoLiveCustomerConfirmationAction(request.id, confirmed))
  }

  async function handleUpload(documentType: GoLiveDocumentType, file: File) {
    setUploadingType(documentType)
    setError(null)
    const result = await uploadGoLiveDocumentAction(request.id, documentType, { name: file.name, mimeType: file.type, size: file.size, bytes: file })
    setUploadingType(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setMessage("Document uploaded.")
    router.refresh()
  }

  async function handleDownload(documentId: string) {
    const result = await getGoLiveDocumentDownloadUrlAction(documentId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    window.open(result.url, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={formatGoLiveRequestId(request.requestNumber)}
        description={`Customer / ${customerKey} / Go Live`}
        actions={<Badge variant="ghost">{STATUS_LABEL[request.status]}</Badge>}
      />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {message ? <p className="text-xs text-success">{message}</p> : null}

        {lineItem ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial Context (locked)</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <dt className="text-muted-foreground">Commercial Component</dt>
              <dd className="text-foreground">{lineItem.componentLabel}</dd>
              <dt className="text-muted-foreground">Pricing Model</dt>
              <dd className="text-foreground">{lineItem.pricingModelLabel}</dd>
              <dt className="text-muted-foreground">Billing Frequency</dt>
              <dd className="text-foreground">{lineItem.billingCadenceLabel}</dd>
              <dt className="text-muted-foreground">Minimum Usage Guarantee</dt>
              <dd className="text-foreground">{lineItem.mugSummary ?? "None"}</dd>
              <dt className="text-muted-foreground">Version</dt>
              <dd className="text-foreground">Version {lineItem.versionNumber}</dd>
            </dl>
          </section>
        ) : null}

        <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Go Live Details</h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="go-live-date">
              Go Live Date
            </label>
            <Input
              id="go-live-date"
              type="date"
              className="w-48"
              value={goLiveDate}
              disabled={!isEditable}
              onChange={(event) => setGoLiveDate(event.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="size-3.5 accent-foreground"
              checked={prorateFirstMonth}
              disabled={!isEditable}
              onChange={(event) => setProrateFirstMonth(event.target.checked)}
            />
            Prorate first month?
          </label>

          {isEditable ? (
            <div className="flex gap-2">
              <PendingButton size="sm" variant="outline" pending={isPending} pendingLabel="Saving..." onClick={handleSaveDraft}>
                Save Draft
              </PendingButton>
              {canSubmit ? (
                <PendingButton size="sm" pending={isPending} pendingLabel="Submitting..." onClick={handleSubmit}>
                  Submit
                </PendingButton>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Customer Confirmation</h2>
          <p className="text-xs text-muted-foreground">
            Status:{" "}
            <span className="font-medium text-foreground">{request.customerConfirmationStatus === "confirmed" ? "Confirmed" : "Pending"}</span>. Valid
            evidence is an uploaded customer email/written confirmation, or a signed Go Live/UAT document. An internal declaration alone is not valid.
          </p>

          {documents.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {documents.map((document) => (
                <li key={document.documentId} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">
                    {DOCUMENT_TYPE_LABEL[document.documentType]}: {document.originalFileName}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => handleDownload(document.documentId)}>
                    Download
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No evidence uploaded yet.</p>
          )}

          {isEditable || request.status === "submitted" || request.status === "resubmitted" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={confirmationFileRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleUpload("customer_confirmation", file)
                    event.target.value = ""
                  }}
                />
                <Button variant="outline" size="sm" disabled={uploadingType !== null} onClick={() => confirmationFileRef.current?.click()}>
                  {uploadingType === "customer_confirmation" ? "Uploading..." : "Upload Customer Confirmation Email"}
                </Button>
                <input
                  ref={uatFileRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleUpload("signed_uat_document", file)
                    event.target.value = ""
                  }}
                />
                <Button variant="outline" size="sm" disabled={uploadingType !== null} onClick={() => uatFileRef.current?.click()}>
                  {uploadingType === "signed_uat_document" ? "Uploading..." : "Upload Signed UAT Document"}
                </Button>
              </div>
              {documents.length > 0 ? (
                <PendingButton
                  size="sm"
                  variant="outline"
                  pending={isPending}
                  pendingLabel="Saving..."
                  onClick={() => handleToggleConfirmation(request.customerConfirmationStatus !== "confirmed")}
                >
                  Mark {request.customerConfirmationStatus === "confirmed" ? "Not Confirmed" : "Confirmed"}
                </PendingButton>
              ) : null}
            </div>
          ) : null}
        </section>

        {isDecidable && canApprove ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Review Decision</h2>
            {showSendBackForm ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground" htmlFor="send-back-reason">
                  Reason for sending back
                </label>
                <textarea
                  id="send-back-reason"
                  className="min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm"
                  value={sendBackReason}
                  onChange={(event) => setSendBackReason(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowSendBackForm(false)}>
                    Cancel
                  </Button>
                  <PendingButton size="sm" pending={isPending} pendingLabel="Sending back..." onClick={handleSendBack}>
                    Confirm Send Back
                  </PendingButton>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowSendBackForm(true)}>
                  Send Back
                </Button>
                <PendingButton size="sm" pending={isPending} pendingLabel="Approving..." onClick={handleApprove}>
                  Approve: Go Live
                </PendingButton>
              </div>
            )}
            {request.customerConfirmationStatus !== "confirmed" ? (
              <p className="text-[11px] text-muted-foreground">Approval will be blocked until customer confirmation is marked Confirmed.</p>
            ) : null}
          </section>
        ) : null}

        {isEditable ? (
          <section className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
            <PendingButton size="sm" variant="outline" className="w-fit text-destructive" pending={isPending} pendingLabel="Cancelling..." onClick={handleCancel}>
              Cancel Draft
            </PendingButton>
          </section>
        ) : null}

        {request.status === "approved" ? (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-foreground">
              Live from <span className="font-medium">{formatBusinessDate(request.goLiveDate)}</span>, approved{" "}
              {request.approvedAt ? formatTimestamp(request.approvedAt) : ""}.
            </p>
          </section>
        ) : null}

        <RequestTimeline events={timelineEvents} />
      </div>
    </div>
  )
}

export { GoLiveDetailPage }
