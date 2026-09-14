"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2Icon } from "lucide-react"

import { PageHeader } from "@/components/product/page-header"
import { KeyValueGrid } from "@/components/product/key-value-grid"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useReferenceMasterSnapshot } from "@/features/reference-data/ui/snapshot-context"
import { componentTableCells } from "../domain/commercial-rate-summary"
import type { CommercialComponentDraft, CommercialRateDraft } from "../domain/commercial-rate"
import type { CustomerOnboardingCase } from "../domain/types"
import { formatOnboardingCaseId } from "../domain/types"
import { CUSTOMER_ONBOARDING_FIELD_KEYS } from "../forms/customer-onboarding-form-definition"
import { approveOnboardingCaseAction, sendBackOnboardingCaseAction } from "../actions"
import { ColumnValue, COLUMN_LABELS, NON_RECURRING_COLUMNS, ON_DEMAND_COLUMNS, RECURRING_COLUMNS } from "./commercial-rate-section"
import type { ColumnKey } from "./commercial-rate-section"

/**
 * Reviewer surface for one Customer Onboarding Case (Customer Lifecycle
 * V1 task §7-9): submitted evidence only, never an editable Customer
 * Master. Reuses the exact same Commercial Rate column rendering
 * (ColumnValue/RECURRING_COLUMNS/etc, exported from
 * ./commercial-rate-section.tsx) the onboarding form itself and the live
 * Customer Commercials page already use, so a component reads
 * identically everywhere (the same rule already applied to the
 * persisted-Commercial-Configuration view).
 */

const NATURE_SECTIONS: { nature: CommercialComponentDraft["nature"]; title: string; columns: ColumnKey[] }[] = [
  { nature: "recurring", title: "Recurring Commercials", columns: RECURRING_COLUMNS },
  { nature: "non_recurring", title: "Non-Recurring Commercials", columns: NON_RECURRING_COLUMNS },
  { nature: "on_demand", title: "On-Demand Commercials", columns: ON_DEMAND_COLUMNS },
]

function ReviewDetailPage({
  requestId,
  onboardingCase,
  canApprove,
}: {
  requestId: string
  onboardingCase: CustomerOnboardingCase
  canApprove: boolean
}) {
  const router = useRouter()
  const snapshot = useReferenceMasterSnapshot()
  const [isSendingBack, setIsSendingBack] = useState(false)
  const [sendBackReason, setSendBackReason] = useState("")
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<"approve" | "send_back" | null>(null)
  const [approvalResult, setApprovalResult] = useState<{ customerKey: string | null; commercialConfigurationId: string | null } | null>(null)

  const values = onboardingCase.currentRevision.data
  const commercialRate = values[CUSTOMER_ONBOARDING_FIELD_KEYS.commercialRate] as CommercialRateDraft | undefined
  const currencyCode = commercialRate?.billingCurrency ?? null

  async function handleApprove() {
    setActionError(null)
    setPendingAction("approve")
    const result = await approveOnboardingCaseAction(requestId, effectiveDate)
    setPendingAction(null)
    if (result.ok) {
      setApprovalResult({ customerKey: result.customerKey, commercialConfigurationId: result.commercialConfigurationId })
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  async function handleSendBack() {
    if (!sendBackReason.trim()) {
      setActionError("A reason is required to send this case back.")
      return
    }
    setActionError(null)
    setPendingAction("send_back")
    const result = await sendBackOnboardingCaseAction(requestId, sendBackReason, null)
    setPendingAction(null)
    if (result.ok) {
      router.push("/reviews")
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={(values[CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName] as string) || "Customer Onboarding Review"}
        description={`${formatOnboardingCaseId(onboardingCase.caseNumber)}, Revision ${onboardingCase.currentRevision.revisionNumber}`}
        actions={
          <Badge variant="ghost" className="bg-muted text-muted-foreground">
            {onboardingCase.status}
          </Badge>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Customer Details</h2>
          <KeyValueGrid
            columns={3}
            items={[
              { label: "Legal Entity Name", value: (values[CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName] as string) || "-" },
              { label: "Brand", value: (values[CUSTOMER_ONBOARDING_FIELD_KEYS.brandName] as string) || "-" },
              { label: "Country", value: (values[CUSTOMER_ONBOARDING_FIELD_KEYS.country] as string) || "-" },
              { label: "Segment", value: (values[CUSTOMER_ONBOARDING_FIELD_KEYS.segment] as string) || "-" },
              { label: "Business Unit", value: (values[CUSTOMER_ONBOARDING_FIELD_KEYS.businessUnit] as string) || "-" },
              { label: "Industry", value: (values[CUSTOMER_ONBOARDING_FIELD_KEYS.industry] as string) || "-" },
            ]}
          />
        </section>

        <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial Rate</h2>
          <p className="text-xs text-muted-foreground">Billing Currency: {currencyCode ?? "-"}</p>
          {NATURE_SECTIONS.map((section) => {
            const components = (commercialRate?.components ?? []).filter((component) => component.nature === section.nature)
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

        {approvalResult ? (
          <section className="flex flex-col items-center gap-3 rounded-lg border bg-card p-4 text-center shadow-sm sm:p-6">
            <span className="flex size-9 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2Icon className="size-4" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">Customer approved</h2>
            <p className="max-w-sm text-xs text-muted-foreground">
              The Customer Master, Commercial Configuration, and Commercial Version 1 have all been created.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {approvalResult.customerKey ? (
                <Button size="sm" render={<Link href={`/customers/${approvalResult.customerKey}`} />}>
                  Open Customer
                </Button>
              ) : null}
              {approvalResult.commercialConfigurationId ? (
                <Button variant="outline" size="sm" render={<Link href={`/commercials/${approvalResult.commercialConfigurationId}`} />}>
                  Open Commercials
                </Button>
              ) : null}
            </div>
          </section>
        ) : canApprove && (onboardingCase.status === "submitted" || onboardingCase.status === "resubmitted") ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Review Decision</h2>
            <p className="text-xs text-muted-foreground">
              Approving creates the Customer Master, Commercial Configuration, and Commercial Version 1 in one step. Send Back returns this case
              to the requester with your reason; there is no separate Reject for Onboarding.
            </p>

            {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}

            {isSendingBack ? (
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
                  <Button size="sm" variant="outline" onClick={() => setIsSendingBack(false)} disabled={pendingAction !== null}>
                    Cancel
                  </Button>
                  <PendingButton size="sm" onClick={handleSendBack} pending={pendingAction === "send_back"} pendingLabel="Sending back...">
                    Confirm Send Back
                  </PendingButton>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="effective-date">
                    Commercial Effective From
                  </label>
                  <Input id="effective-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
                </div>
                <PendingButton size="sm" onClick={handleApprove} pending={pendingAction === "approve"} pendingLabel="Approving...">
                  Approve
                </PendingButton>
                <Button size="sm" variant="outline" onClick={() => setIsSendingBack(true)} disabled={pendingAction !== null}>
                  Send Back
                </Button>
              </div>
            )}
          </section>
        ) : null}

        {onboardingCase.status === "approved" ? (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Approved{onboardingCase.approvedAt ? ` on ${new Date(onboardingCase.approvedAt).toLocaleDateString()}` : ""}. This case is historical
              evidence and can no longer be changed.
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}

export { ReviewDetailPage }
