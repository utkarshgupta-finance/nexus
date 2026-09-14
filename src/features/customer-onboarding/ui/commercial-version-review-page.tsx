"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useReferenceMasterSnapshot } from "@/features/reference-data/ui/snapshot-context"

import { rejectCommercialVersionAction, approveCommercialVersionAction } from "../actions"
import { componentTableCells } from "../domain/commercial-rate-summary"
import type { CommercialComponentDraft } from "../domain/commercial-rate"
import type { CommercialConfigurationVersion } from "../domain/commercial-version-types"
import { formatCommercialVersionId } from "../domain/commercial-version-types"
import { labelForCaseStatus } from "@/platform/approvals/domain/inbox"
import { RequestTimeline } from "@/components/product/request-timeline"
import { formatTimestampDate } from "@/lib/date"
import type { RequestTimelineEvent } from "@/components/product/request-timeline"
import type { CommercialRateDiff } from "../domain/commercial-rate-diff"
import { ColumnValue, COLUMN_LABELS, NON_RECURRING_COLUMNS, ON_DEMAND_COLUMNS, RECURRING_COLUMNS } from "./commercial-rate-section"
import type { ColumnKey } from "./commercial-rate-section"
import { CommercialRateDiffView } from "./commercial-rate-diff-view"

/**
 * Reviewer surface for one Commercial Configuration Version (Customer
 * Lifecycle V1, Phase 10-13): the proposed Commercial Rate only, never
 * an editable Commercial Configuration. Actions: Approve / Reject.
 * Approval calls the single atomic approve_commercial_configuration_version
 * RPC, which closes the prior active version and materializes this one
 * in the same transaction; nothing here writes to Commercial
 * Configuration directly.
 */

const NATURE_SECTIONS: { nature: CommercialComponentDraft["nature"]; title: string; columns: ColumnKey[] }[] = [
  { nature: "recurring", title: "Recurring Commercials", columns: RECURRING_COLUMNS },
  { nature: "non_recurring", title: "Non-Recurring Commercials", columns: NON_RECURRING_COLUMNS },
  { nature: "on_demand", title: "On-Demand Commercials", columns: ON_DEMAND_COLUMNS },
]

function CommercialVersionReviewPage({
  requestId,
  configId,
  version,
  canDecide,
  diff,
  timeline = [],
}: {
  requestId: string
  configId: string
  version: CommercialConfigurationVersion
  canDecide: boolean
  /** Current vs Proposed (task Phase G); null only when there is nothing yet to compare (no active prior Commercial Components, or no draft saved). */
  diff: CommercialRateDiff | null
  timeline?: RequestTimelineEvent[]
}) {
  const router = useRouter()
  const snapshot = useReferenceMasterSnapshot()
  const [mode, setMode] = useState<"idle" | "reject">("idle")
  const [reason, setReason] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  const currencyCode = version.commercialRate?.billingCurrency ?? null
  const isDecidable = canDecide && version.status === "submitted"

  async function handleApprove() {
    setActionError(null)
    setIsSubmittingAction(true)
    const result = await approveCommercialVersionAction(requestId)
    setIsSubmittingAction(false)
    if (result.ok) {
      router.push(`/commercials/${configId}`)
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      setActionError("A reason is required to reject this version.")
      return
    }
    setActionError(null)
    setIsSubmittingAction(true)
    const result = await rejectCommercialVersionAction(requestId, reason)
    setIsSubmittingAction(false)
    if (result.ok) {
      router.push("/reviews/commercial-versions")
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Commercial Configuration Version Review"
        description={`${formatCommercialVersionId(version.versionNumber)}, ${version.changeCategory}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="ghost" className="bg-muted text-muted-foreground">
              {labelForCaseStatus(version.status)}
            </Badge>
            <Button variant="outline" size="sm" render={<Link href={`/commercials/${configId}`} />}>
              Commercial Configuration
            </Button>
          </div>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <section className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reason</h2>
          <p className="text-sm text-foreground">{version.reason || "No reason recorded."}</p>
          {version.effectiveDate ? <p className="text-xs text-muted-foreground">Effective Date: {version.effectiveDate}</p> : null}
        </section>

        {diff ? (
          <CommercialRateDiffView diff={diff} currencyCode={currencyCode} />
        ) : (
        <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Proposed Commercial Rate</h2>
          <p className="text-xs text-muted-foreground">Billing Currency: {currencyCode ?? "-"}</p>
          {NATURE_SECTIONS.map((section) => {
            const components = (version.commercialRate?.components ?? []).filter((component) => component.nature === section.nature)
            if (components.length === 0) return null
            return (
              <div key={section.nature} className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">{section.title}</span>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Component</TableHead>
                        {section.columns.map((column) => (
                          <TableHead key={column}>{COLUMN_LABELS[column]}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {components.map((component) => {
                        const cells = componentTableCells(snapshot, component, currencyCode)
                        return (
                          <TableRow key={component.id}>
                            <TableCell className="font-medium text-foreground">{cells.name}</TableCell>
                            {section.columns.map((column) => (
                              <TableCell key={column} className="whitespace-normal">
                                <ColumnValue column={column} cells={cells} />
                              </TableCell>
                            ))}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })}
        </section>
        )}

        <RequestTimeline events={timeline} />

        {isDecidable ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Review Decision</h2>
            <p className="text-xs text-muted-foreground">
              Approving closes the prior Commercial Version&apos;s effective period and materializes this one. If Effective Date is today or
              earlier it becomes the customer&apos;s current terms immediately; if it is in the future, it shows as Approved, Scheduled until
              that date arrives. Reject is terminal and never changes the Commercial Configuration.
            </p>

            {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}

            {mode === "idle" ? (
              <div className="flex flex-wrap gap-2">
                <PendingButton size="sm" onClick={handleApprove} pending={isSubmittingAction} pendingLabel="Approving...">
                  Approve &amp; Activate
                </PendingButton>
                <Button size="sm" variant="outline" onClick={() => setMode("reject")} disabled={isSubmittingAction}>
                  Reject
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground" htmlFor="version-decision-reason">
                  Reason for rejecting
                </label>
                <textarea
                  id="version-decision-reason"
                  className="min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setMode("idle")} disabled={isSubmittingAction}>
                    Cancel
                  </Button>
                  <PendingButton size="sm" onClick={handleReject} pending={isSubmittingAction} pendingLabel="Rejecting...">
                    Confirm Reject
                  </PendingButton>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {version.status === "approved" || version.status === "rejected" ? (
          <p className="text-xs text-muted-foreground">
            {version.status === "approved" ? "Approved" : "Rejected"}
            {version.decidedAt ? ` on ${formatTimestampDate(version.decidedAt)}` : ""}. This version is historical evidence and can no longer
            be changed.
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { CommercialVersionReviewPage }
