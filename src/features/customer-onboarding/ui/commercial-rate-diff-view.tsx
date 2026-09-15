"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useReferenceMasterSnapshot } from "@/features/reference-data/ui/snapshot-context"

import { formatAmount, formatQuantity, unitLabel, invoiceSummaryLine } from "../domain/commercial-rate-summary"
import type { CommercialComponentDraft, CommercialNature } from "../domain/commercial-rate"
import type { CommercialRateDiff, ComponentDiff, DiffRowStatus } from "../domain/commercial-rate-diff"

/**
 * Commercial Current vs Proposed diff view (task Phase G): a Finance-
 * friendly component-level comparison, never a generic JSON diff. Reuses
 * the same formatters (`formatAmount`, `unitLabel`, `invoiceSummaryLine`)
 * every other Commercial screen already uses (task Phase O: one
 * authoritative formatting vocabulary, not a parallel one for this view).
 */

const STATUS_LABELS: Record<DiffRowStatus, string> = { unchanged: "Unchanged", changed: "Changed", added: "Added", removed: "Removed" }
const STATUS_STYLES: Record<DiffRowStatus, string> = {
  unchanged: "bg-muted text-muted-foreground",
  changed: "bg-warning/10 text-warning",
  added: "bg-success/10 text-success",
  removed: "bg-destructive/10 text-destructive",
}

function StatusBadge({ status }: { status: DiffRowStatus }) {
  return (
    <Badge variant="ghost" className={STATUS_STYLES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const NATURE_TITLES: Record<CommercialNature, string> = {
  recurring: "Recurring Commercials",
  non_recurring: "Non-Recurring Commercials",
  on_demand: "On-Demand Commercials",
}

function formatPercentChange(value: number | null): string | null {
  if (value === null) return null
  const rounded = Math.round(value * 10) / 10
  const sign = rounded > 0 ? "+" : ""
  return `${sign}${rounded}%`
}

const SLAB_MUG_MODE_LABELS: Record<string, string> = { overall: "Overall MUG", slab_wise: "Slab-wise MUG" }

/** "No MUG" / "Overall MUG" / "Slab-wise MUG" for a Slab component's own side of a `slabMugModeChanged` line. */
function slabMugModeLabel(component: CommercialComponentDraft | null): string {
  if (!component || !("slabMugMode" in component) || !component.mug.enabled) return "No MUG"
  return SLAB_MUG_MODE_LABELS[component.slabMugMode] ?? component.slabMugMode
}

/** Only meaningful for Recurring/On-Demand (Non-Recurring never carries a `mug` field, so `diff.mugChanged` is always false there). */
function componentMugUnitCode(component: CommercialComponentDraft | null): string | null {
  if (!component) return null
  if (component.pricingModel === "per_unit" || component.pricingModel === "slab") return component.pricingUnit
  if (component.pricingModel === "designation_based") return component.designationRows[0]?.per ?? "USER"
  return null
}

function componentRateLine(component: CommercialComponentDraft | null, currencyCode: string | null, snapshot: ReturnType<typeof useReferenceMasterSnapshot>): string {
  if (!component) return "-"
  if (component.pricingModel === "per_unit") return `${formatAmount(component.rate, currencyCode)} / ${unitLabel(snapshot, component.pricingUnit)}`
  if (component.pricingModel === "flat_fee") return formatAmount(component.amount, currencyCode)
  if (component.pricingModel === "slab") return `Slab (${component.slabRows.length} band${component.slabRows.length === 1 ? "" : "s"})`
  return `Designation Based (${component.designationRows.length} row${component.designationRows.length === 1 ? "" : "s"})`
}

function ComponentDiffCard({ diff, currencyCode }: { diff: ComponentDiff; currencyCode: string | null }) {
  const snapshot = useReferenceMasterSnapshot()
  const showComparison = diff.status === "changed"
  const component = diff.proposed ?? diff.current

  const currentInvoiceLine = diff.current ? invoiceSummaryLine(snapshot, diff.current.invoiceTerms) : null
  const proposedInvoiceLine = diff.proposed ? invoiceSummaryLine(snapshot, diff.proposed.invoiceTerms) : null

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{diff.description || "(untitled component)"}</span>
        <StatusBadge status={diff.status} />
      </div>

      {diff.status === "removed" || diff.status === "added" ? (
        <p className="text-xs text-muted-foreground">{componentRateLine(component, currencyCode, snapshot)}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Current</span>
            <span className="text-foreground">{componentRateLine(diff.current, currencyCode, snapshot)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Proposed</span>
            <span className="text-foreground">{componentRateLine(diff.proposed, currencyCode, snapshot)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Change</span>
            <span className="text-foreground">{formatPercentChange(diff.ratePercentChange) ?? (showComparison ? "-" : "No change")}</span>
          </div>
        </div>
      )}

      {diff.mugChanged ? (
        <p className="text-xs text-foreground">
          MUG: {formatQuantity(diff.currentMug)} {unitLabel(snapshot, componentMugUnitCode(diff.current))} &rarr; {formatQuantity(diff.proposedMug)}{" "}
          {unitLabel(snapshot, componentMugUnitCode(diff.proposed))}
        </p>
      ) : null}

      {diff.slabMugModeChanged ? (
        <p className="text-xs text-foreground">
          MUG Mode: {slabMugModeLabel(diff.current)} &rarr; {slabMugModeLabel(diff.proposed)}
        </p>
      ) : null}

      {diff.invoiceCycleChanged ? (
        <p className="text-xs text-foreground">
          Invoice Cycle: {currentInvoiceLine ?? "Not set"} &rarr; {proposedInvoiceLine ?? "Not set"}
        </p>
      ) : null}

      {diff.effectiveDateChanged ? (
        <p className="text-xs text-foreground">
          Effective From: {diff.current?.effectiveFrom ?? "Not set"} &rarr; {diff.proposed?.effectiveFrom ?? "Not set"}
        </p>
      ) : null}

      {diff.slabRowDiffs.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Band</TableHead>
                <TableHead>Current Rate</TableHead>
                <TableHead>Proposed Rate</TableHead>
                {diff.slabRowDiffs.some((row) => row.currentMug !== null || row.proposedMug !== null) ? (
                  <>
                    <TableHead>Current MUG</TableHead>
                    <TableHead>Proposed MUG</TableHead>
                  </>
                ) : null}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diff.slabRowDiffs.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {formatQuantity(row.from)}
                    {row.to !== null ? `-${formatQuantity(row.to)}` : "+"}
                  </TableCell>
                  <TableCell>{formatAmount(row.currentRate, currencyCode)}</TableCell>
                  <TableCell>{formatAmount(row.proposedRate, currencyCode)}</TableCell>
                  {diff.slabRowDiffs.some((entry) => entry.currentMug !== null || entry.proposedMug !== null) ? (
                    <>
                      <TableCell>{row.currentMug !== null ? formatQuantity(row.currentMug) : "-"}</TableCell>
                      <TableCell>{row.proposedMug !== null ? formatQuantity(row.proposedMug) : "-"}</TableCell>
                    </>
                  ) : null}
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {diff.designationRowDiffs.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Designation</TableHead>
                <TableHead>Current Rate</TableHead>
                <TableHead>Proposed Rate</TableHead>
                <TableHead>Current MUG</TableHead>
                <TableHead>Proposed MUG</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diff.designationRowDiffs.map((row) => (
                <TableRow key={row.designation}>
                  <TableCell className="font-medium text-foreground">{row.designation}</TableCell>
                  <TableCell>{formatAmount(row.currentRate, currencyCode)}</TableCell>
                  <TableCell>{formatAmount(row.proposedRate, currencyCode)}</TableCell>
                  <TableCell>{formatQuantity(row.currentMug)}</TableCell>
                  <TableCell>{formatQuantity(row.proposedMug)}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {diff.milestoneDiffs.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Milestone</TableHead>
                <TableHead>Current %</TableHead>
                <TableHead>Proposed %</TableHead>
                <TableHead>Current Timing</TableHead>
                <TableHead>Proposed Timing</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diff.milestoneDiffs.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                  <TableCell>{row.currentPercent ?? "-"}%</TableCell>
                  <TableCell>{row.proposedPercent ?? "-"}%</TableCell>
                  <TableCell>{row.currentInvoiceTiming ?? "-"}</TableCell>
                  <TableCell>{row.proposedInvoiceTiming ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}

function CommercialRateDiffView({ diff, currencyCode }: { diff: CommercialRateDiff; currencyCode: string | null }) {
  const [showUnchanged, setShowUnchanged] = useState(false)

  const visibleComponents = diff.components.filter((component) => showUnchanged || component.status !== "unchanged")
  const unchangedCount = diff.components.filter((component) => component.status === "unchanged").length

  const natures: CommercialNature[] = ["recurring", "non_recurring", "on_demand"]

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Current vs Proposed</h2>
        {unchangedCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setShowUnchanged((value) => !value)}>
            {showUnchanged ? "Hide unchanged" : `Show unchanged (${unchangedCount})`}
          </Button>
        ) : null}
      </div>

      {diff.billingCurrencyChanged ? (
        <p className="text-xs text-foreground">
          Billing Currency: {diff.currentBillingCurrency ?? "Not set"} &rarr; {diff.proposedBillingCurrency ?? "Not set"}
        </p>
      ) : null}

      {visibleComponents.length === 0 ? (
        <p className="text-xs text-muted-foreground">No changes to show.</p>
      ) : (
        natures.map((nature) => {
          const components = visibleComponents.filter((component) => (component.proposed ?? component.current)?.nature === nature)
          if (components.length === 0) return null
          return (
            <div key={nature} className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-foreground">{NATURE_TITLES[nature]}</span>
              <div className="flex flex-col gap-2">
                {components.map((component) => (
                  <ComponentDiffCard key={component.componentId} diff={component} currencyCode={currencyCode} />
                ))}
              </div>
            </div>
          )
        })
      )}
    </section>
  )
}

export { CommercialRateDiffView }
