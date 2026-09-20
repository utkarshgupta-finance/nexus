"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatBusinessDate } from "@/lib/date"
import { toMonthKey, formatMonthKey } from "@/lib/month"
import {
  createEntitlementSourceAction,
  cancelEntitlementSourceAction,
  previewAllocationScheduleAction,
  generateScheduleForSourceAction,
  submitMonthlyUsageAction,
  finalizeMonthlyUsageAction,
  recordSettlementAction,
} from "../actions"
import { formatEntitlementSourceId } from "../domain/types"
import type {
  EntitlementSource,
  EntitlementScheduleMonth,
  MonthlyUsage,
  MonthlyEntitlementLedgerRow,
  UnbilledLedgerEntry,
  UnearnedLedgerEntry,
  AllocationTreatment,
} from "../domain/types"
import type { AllocationPreview } from "../services/entitlement.service"
import type { GoLiveLineItem } from "@/features/go-live/domain/line-items"

const LEDGER_ENTRY_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  PARTIALLY_SETTLED: "Partially Settled",
  SETTLED: "Settled",
}

const RECOGNITION_STATUS_LABEL: Record<string, string> = {
  auto_finalized: "Finalized",
  pending_mrr_recognition: "Pending MRR Recognition",
}

const TREATMENT_LABELS: Record<AllocationTreatment, string> = {
  CREATE_NEW_ENTITLEMENT_PERIOD: "Create New Entitlement Period",
  ADD_TO_EXISTING_ENTITLEMENT_PERIOD: "Add To Existing Entitlement Period",
}

function runAction(
  action: () => Promise<{ ok: boolean; error?: string }>,
  setPending: (value: boolean) => void,
  setError: (value: string | null) => void,
  onSuccess: () => void
) {
  setError(null)
  setPending(true)
  action().then((result) => {
    setPending(false)
    if (!result.ok) {
      setError(result.error ?? "An unexpected error occurred.")
      return
    }
    onSuccess()
  })
}

/**
 * Add Invoice Entitlement form (Phase G). Every quantity here is a
 * metric quantity from an actual invoice, never a monetary amount:
 * `metric` is Finance-entered free text (Users, Outlets, whatever this
 * line item's own unit is), matching that no resolvable Commercial unit
 * label exists yet (see docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md).
 */
function AddEntitlementSourceForm({ lineItem, onCreated }: { lineItem: GoLiveLineItem; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [invoiceReference, setInvoiceReference] = useState("")
  const [invoiceDate, setInvoiceDate] = useState("")
  const [invoiceQuantity, setInvoiceQuantity] = useState("")
  const [metric, setMetric] = useState("")
  const [invoiceDurationMonths, setInvoiceDurationMonths] = useState("12")
  const [documentReference, setDocumentReference] = useState("")
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleCreate() {
    const quantity = Number(invoiceQuantity)
    const duration = Number(invoiceDurationMonths)
    if (!invoiceReference.trim() || !invoiceDate || !metric.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(duration) || duration <= 0) {
      setError("Invoice Reference, Invoice Date, a positive Quantity, Metric, and a positive whole Duration (months) are all required.")
      return
    }
    runAction(
      () =>
        createEntitlementSourceAction({
          customerId: lineItem.customerId,
          stableComponentKey: lineItem.stableComponentKey,
          commercialVersionId: lineItem.commercialVersionId,
          invoiceReference: invoiceReference.trim(),
          invoiceDate,
          invoiceQuantity: quantity,
          metric: metric.trim(),
          invoiceDurationMonths: duration,
          documentReference: documentReference.trim() || null,
        }),
      setIsPending,
      setError,
      () => {
        setOpen(false)
        setInvoiceReference("")
        setInvoiceDate("")
        setInvoiceQuantity("")
        setMetric("")
        setInvoiceDurationMonths("12")
        setDocumentReference("")
        onCreated()
      }
    )
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        Add Invoice Entitlement
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Invoice Reference</label>
          <Input value={invoiceReference} onChange={(event) => setInvoiceReference(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Invoice Date</label>
          <Input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Invoice Quantity</label>
          <Input type="number" min="0" value={invoiceQuantity} onChange={(event) => setInvoiceQuantity(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Metric</label>
          <Input placeholder="Users, Outlets, ..." value={metric} onChange={(event) => setMetric(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Invoice Duration (months)</label>
          <Input type="number" min="1" value={invoiceDurationMonths} onChange={(event) => setInvoiceDurationMonths(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Document Reference (optional)</label>
          <Input value={documentReference} onChange={(event) => setDocumentReference(event.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <PendingButton size="sm" pending={isPending} pendingLabel="Saving..." onClick={handleCreate}>
          Save Entitlement Source
        </PendingButton>
      </div>
    </div>
  )
}

/**
 * Allocation schedule generation (Phase G, LOCKED rule: allocation is
 * always anchored at the Go Live month for a brand new period, never
 * the invoice date). Preview-then-confirm, never a silent write:
 * Finance sees the exact monthly split and any overlap warning before
 * committing.
 */
function GenerateScheduleForm({ source, goLiveMonth, onGenerated }: { source: EntitlementSource; goLiveMonth: string | null; onGenerated: () => void }) {
  const [open, setOpen] = useState(false)
  const [treatment, setTreatment] = useState<AllocationTreatment>("CREATE_NEW_ENTITLEMENT_PERIOD")
  const [preview, setPreview] = useState<AllocationPreview | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handlePreview() {
    if (!goLiveMonth) {
      setError("An approved Go Live request is required before a schedule can be generated for this line item.")
      return
    }
    setError(null)
    setIsPending(true)
    previewAllocationScheduleAction({
      stableComponentKey: source.stableComponentKey,
      invoiceQuantity: source.invoiceQuantity,
      durationMonths: source.invoiceDurationMonths,
      treatment,
      goLiveMonth,
    }).then((result) => {
      setIsPending(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setPreview(result.preview)
    })
  }

  function handleConfirm() {
    if (!preview) return
    runAction(
      () => generateScheduleForSourceAction(source.id, preview.entries),
      setIsPending,
      setError,
      () => {
        setOpen(false)
        setPreview(null)
        onGenerated()
      }
    )
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Generate Schedule
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Allocation Treatment</label>
        <Select
          value={treatment}
          onValueChange={(next) => {
            setTreatment(next as AllocationTreatment)
            setPreview(null)
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select...">{() => TREATMENT_LABELS[treatment]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="CREATE_NEW_ENTITLEMENT_PERIOD">Create New Entitlement Period</SelectItem>
              <SelectItem value="ADD_TO_EXISTING_ENTITLEMENT_PERIOD">Add To Existing Entitlement Period</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {preview ? (
        <div className="flex flex-col gap-2">
          {preview.overlapsExistingSchedule ? (
            <p className="text-xs text-warning">
              This schedule overlaps months that already have an entitlement allocation. Confirming will add to the existing monthly totals for those
              months rather than replacing them.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {formatMonthKey(preview.startMonth)} through {formatMonthKey(preview.endMonth)}
          </p>
          <div className="max-h-48 overflow-y-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.entries.map((entry) => (
                  <TableRow key={entry.month}>
                    <TableCell>{formatMonthKey(entry.month)}</TableCell>
                    <TableCell className="text-right">{entry.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(false)
            setPreview(null)
          }}
        >
          Cancel
        </Button>
        {preview ? (
          <PendingButton size="sm" pending={isPending} pendingLabel="Generating..." onClick={handleConfirm}>
            Confirm and Generate
          </PendingButton>
        ) : (
          <PendingButton size="sm" pending={isPending} pendingLabel="Calculating..." onClick={handlePreview}>
            Preview Allocation
          </PendingButton>
        )}
      </div>
    </div>
  )
}

function SubmitUsageForm({ lineItem, onSubmitted }: { lineItem: GoLiveLineItem; onSubmitted: () => void }) {
  const [open, setOpen] = useState(false)
  const [usageMonth, setUsageMonth] = useState("")
  const [metric, setMetric] = useState("")
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    const parsedQuantity = Number(quantity)
    if (!usageMonth || !metric.trim() || !Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      setError("Usage Month, Metric, and a non-negative Quantity are all required.")
      return
    }
    runAction(
      () =>
        submitMonthlyUsageAction({
          customerId: lineItem.customerId,
          stableComponentKey: lineItem.stableComponentKey,
          usageMonth,
          metric: metric.trim(),
          quantity: parsedQuantity,
          notes: notes.trim() || null,
        }),
      setIsPending,
      setError,
      () => {
        setOpen(false)
        setUsageMonth("")
        setMetric("")
        setQuantity("")
        setNotes("")
        onSubmitted()
      }
    )
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        Submit Monthly Usage
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Usage Month</label>
          <Input type="month" value={usageMonth} onChange={(event) => setUsageMonth(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Metric</label>
          <Input placeholder="Users, Outlets, ..." value={metric} onChange={(event) => setMetric(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Quantity</label>
          <Input type="number" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Notes (optional)</label>
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <PendingButton size="sm" pending={isPending} pendingLabel="Submitting..." onClick={handleSubmit}>
          Submit Usage
        </PendingButton>
      </div>
    </div>
  )
}

function SettleEntryForm({
  ledgerEntryType,
  entryId,
  onSettled,
}: {
  ledgerEntryType: "unbilled" | "unearned"
  entryId: string
  onSettled: () => void
}) {
  const [open, setOpen] = useState(false)
  const [settlementReference, setSettlementReference] = useState("")
  const [settledQuantity, setSettledQuantity] = useState("")
  const [settlementDate, setSettlementDate] = useState("")
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSettle() {
    const quantity = Number(settledQuantity)
    if (!settlementReference.trim() || !settlementDate || !Number.isFinite(quantity) || quantity <= 0) {
      setError("A Settlement Reference, Settlement Date, and a positive Settled Quantity are all required.")
      return
    }
    runAction(
      () => recordSettlementAction(ledgerEntryType, entryId, settlementReference.trim(), quantity, settlementDate),
      setIsPending,
      setError,
      () => {
        setOpen(false)
        setSettlementReference("")
        setSettledQuantity("")
        setSettlementDate("")
        onSettled()
      }
    )
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Settle
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Input
        placeholder={ledgerEntryType === "unbilled" ? "Invoice reference" : "Credit note reference"}
        value={settlementReference}
        onChange={(event) => setSettlementReference(event.target.value)}
      />
      <Input type="number" min="0" placeholder="Settled quantity" value={settledQuantity} onChange={(event) => setSettledQuantity(event.target.value)} />
      <Input type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <PendingButton size="sm" pending={isPending} pendingLabel="Recording..." onClick={handleSettle}>
          Record Settlement
        </PendingButton>
      </div>
    </div>
  )
}

function EntitlementDetailPage({
  customerKey,
  lineItem,
  sources,
  scheduleMonths,
  usageRows,
  ledgerRows,
  unbilledEntries,
  unearnedEntries,
  canViewEntitlement,
  canViewUsage,
  canViewSettlement,
  canWriteEntitlement,
  canWriteUsage,
  canFinalizeUsage,
  canSettle,
}: {
  customerKey: string
  lineItem: GoLiveLineItem
  sources: EntitlementSource[]
  scheduleMonths: EntitlementScheduleMonth[]
  usageRows: MonthlyUsage[]
  ledgerRows: MonthlyEntitlementLedgerRow[]
  unbilledEntries: UnbilledLedgerEntry[]
  unearnedEntries: UnearnedLedgerEntry[]
  /** Entitlement Sources / Monthly Schedule / Ledger sections (entitlement.read; the umbrella permission, unchanged from before this permission split). */
  canViewEntitlement: boolean
  /** Monthly Usage section (entitlement.read OR usage.read; usage.read alone now genuinely grants this, not just entitlement.read as before). */
  canViewUsage: boolean
  /** Unbilled/Unearned Ledger sections (entitlement.read OR entitlement_settlement.read). */
  canViewSettlement: boolean
  canWriteEntitlement: boolean
  canWriteUsage: boolean
  canFinalizeUsage: boolean
  canSettle: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [finalizingId, setFinalizingId] = useState<string | null>(null)

  const goLiveMonth = lineItem.currentRequest?.status === "approved" ? toMonthKey(lineItem.currentRequest.goLiveDate) : null

  function refresh() {
    router.refresh()
  }

  function handleCancelSource(id: string) {
    const reason = window.prompt("Reason for cancelling this Entitlement Source?")
    if (!reason || !reason.trim()) return
    cancelEntitlementSourceAction(id, reason.trim()).then((result) => {
      if (!result.ok) {
        setError(result.error)
        return
      }
      refresh()
    })
  }

  function handleFinalizeUsage(id: string) {
    setFinalizingId(id)
    finalizeMonthlyUsageAction(id).then((result) => {
      setFinalizingId(null)
      if (!result.ok) {
        setError(result.error)
        return
      }
      refresh()
    })
  }

  const sortedScheduleMonths = [...scheduleMonths].sort((a, b) => a.month.localeCompare(b.month))
  const sortedUsageRows = [...usageRows].sort((a, b) => b.usageMonth.localeCompare(a.usageMonth))
  const sortedLedgerRows = [...ledgerRows].sort((a, b) => b.month.localeCompare(a.month))

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Entitlement and Usage"
        description={`Customer / ${customerKey} / ${lineItem.componentLabel}`}
        actions={<Badge variant="ghost">{lineItem.isRecurring ? "Recurring" : "On-Demand"}</Badge>}
      />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial Context</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <dt className="text-muted-foreground">Commercial Component</dt>
            <dd className="text-foreground">{lineItem.componentLabel}</dd>
            <dt className="text-muted-foreground">Pricing Model</dt>
            <dd className="text-foreground">{lineItem.pricingModelLabel}</dd>
            <dt className="text-muted-foreground">Minimum Usage Guarantee</dt>
            <dd className="text-foreground">{lineItem.mugSummary ?? "None"}</dd>
            <dt className="text-muted-foreground">Billing Currency</dt>
            <dd className="text-foreground">{lineItem.billingCurrency}</dd>
            {lineItem.isRecurring ? (
              <>
                <dt className="text-muted-foreground">Go Live Status</dt>
                <dd className="text-foreground">{lineItem.goLiveStatus === "LIVE" ? `Live from ${formatBusinessDate(lineItem.currentRequest!.goLiveDate)}` : lineItem.goLiveStatus}</dd>
              </>
            ) : null}
          </dl>
        </section>

        {lineItem.isRecurring && canViewEntitlement ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Entitlement Sources</h2>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Source</TableHead>
                    <TableHead>Invoice Reference</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-xs text-muted-foreground">
                        No Invoice Entitlement recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sources.map((source) => (
                      <TableRow key={source.id}>
                        <TableCell className="font-medium text-foreground">{formatEntitlementSourceId(source.sourceNumber)}</TableCell>
                        <TableCell className="text-muted-foreground">{source.invoiceReference}</TableCell>
                        <TableCell className="text-muted-foreground">{formatBusinessDate(source.invoiceDate)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{source.invoiceQuantity}</TableCell>
                        <TableCell className="text-muted-foreground">{source.metric}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{source.invoiceDurationMonths} mo</TableCell>
                        <TableCell>
                          <Badge variant="ghost" className={source.status === "active" ? "" : "bg-muted text-muted-foreground"}>
                            {source.status === "active" ? "Active" : "Cancelled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {source.status === "active" && canWriteEntitlement ? (
                            <div className="flex justify-end gap-2">
                              <GenerateScheduleForm source={source} goLiveMonth={goLiveMonth} onGenerated={refresh} />
                              <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleCancelSource(source.id)}>
                                Cancel
                              </Button>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {canWriteEntitlement ? <AddEntitlementSourceForm lineItem={lineItem} onCreated={refresh} /> : null}
            {canWriteEntitlement && !goLiveMonth ? (
              <p className="text-[11px] text-muted-foreground">
                An Invoice Entitlement can be recorded before Go Live, but the monthly allocation schedule cannot be generated until this line item has
                an approved Go Live request.
              </p>
            ) : null}
          </section>
        ) : null}

        {lineItem.isRecurring && canViewEntitlement && sortedScheduleMonths.length > 0 ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Monthly Entitlement Schedule</h2>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Monthly Entitlement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedScheduleMonths.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatMonthKey(entry.month)}</TableCell>
                      <TableCell className="text-right">{entry.monthlyQuantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}

        {canViewUsage ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Monthly Usage</h2>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Month</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-xs text-muted-foreground">
                        No usage submitted yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedUsageRows.map((usage) => (
                      <TableRow key={usage.id}>
                        <TableCell>{formatMonthKey(usage.usageMonth)}</TableCell>
                        <TableCell className="text-muted-foreground">{usage.metric}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{usage.quantity}</TableCell>
                        <TableCell>
                          <Badge variant="ghost">{usage.status === "final" ? "Final" : "Draft"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {usage.status === "draft" && usage.isCurrent && canFinalizeUsage ? (
                            <PendingButton
                              size="sm"
                              variant="outline"
                              pending={finalizingId === usage.id}
                              pendingLabel="Finalizing..."
                              onClick={() => handleFinalizeUsage(usage.id)}
                            >
                              Finalize
                            </PendingButton>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {canWriteUsage ? <SubmitUsageForm lineItem={lineItem} onSubmitted={refresh} /> : null}
          </section>
        ) : null}

        {canViewEntitlement ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Monthly Entitlement Ledger</h2>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Entitlement</TableHead>
                    <TableHead className="text-right">Usage</TableHead>
                    <TableHead className="text-right">MUG</TableHead>
                    <TableHead className="text-right">Consumption</TableHead>
                    <TableHead className="text-right">Unbilled</TableHead>
                    <TableHead className="text-right">Unearned</TableHead>
                    <TableHead>Recognition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLedgerRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-xs text-muted-foreground">
                        No ledger entries yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedLedgerRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatMonthKey(row.month)}</TableCell>
                        <TableCell className="text-right">{row.monthlyEntitlementQuantity}</TableCell>
                        <TableCell className="text-right">{row.actualUsageQuantity}</TableCell>
                        <TableCell className="text-right">{row.mugQuantity ?? "-"}</TableCell>
                        <TableCell className="text-right">{row.consumptionQuantity}</TableCell>
                        <TableCell className="text-right">{row.unbilledQuantity}</TableCell>
                        <TableCell className="text-right">{row.unearnedQuantity}</TableCell>
                        <TableCell className="text-muted-foreground">{RECOGNITION_STATUS_LABEL[row.recognitionStatus]}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}

        {canViewSettlement ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Unbilled Ledger</h2>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unbilledEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs text-muted-foreground">
                        No open Unbilled quantity.
                      </TableCell>
                    </TableRow>
                  ) : (
                    unbilledEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatMonthKey(entry.month)}</TableCell>
                        <TableCell className="text-right">{entry.unbilledQuantity}</TableCell>
                        <TableCell>
                          <Badge variant="ghost">{LEDGER_ENTRY_STATUS_LABEL[entry.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.status !== "SETTLED" && canSettle ? (
                            <SettleEntryForm ledgerEntryType="unbilled" entryId={entry.id} onSettled={refresh} />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}

        {canViewSettlement ? (
          <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Unearned Ledger</h2>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unearnedEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs text-muted-foreground">
                        No open Unearned quantity.
                      </TableCell>
                    </TableRow>
                  ) : (
                    unearnedEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatMonthKey(entry.month)}</TableCell>
                        <TableCell className="text-right">{entry.unearnedQuantity}</TableCell>
                        <TableCell>
                          <Badge variant="ghost">{LEDGER_ENTRY_STATUS_LABEL[entry.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.status !== "SETTLED" && canSettle ? (
                            <SettleEntryForm ledgerEntryType="unearned" entryId={entry.id} onSettled={refresh} />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export { EntitlementDetailPage }
