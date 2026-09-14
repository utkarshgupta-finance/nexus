import Link from "next/link"

import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatBusinessDate } from "@/lib/date"
import type { GoLiveLineItem } from "../domain/line-items"

const GO_LIVE_STATUS_BADGE: Record<string, string> = {
  LIVE: "bg-success/10 text-success",
  GO_LIVE_PENDING: "bg-warning/10 text-warning",
  CANCELLED: "bg-muted text-muted-foreground",
  NO_GO_LIVE: "bg-muted text-muted-foreground",
}

const GO_LIVE_STATUS_LABEL: Record<string, string> = {
  LIVE: "Live",
  GO_LIVE_PENDING: "Pending",
  CANCELLED: "Cancelled",
  NO_GO_LIVE: "No Go Live",
}

/**
 * Customer -> Go Live tab (Go Live + Entitlement Ledger, Phase E). Shows
 * every CURRENT recurring Commercial line item with its Go Live
 * standing, and On-Demand line items in a clearly separate, clearly
 * labelled section ("Go Live: Not Required" per the product brief,
 * never a misleading "No Go Live" for a model that structurally never
 * needs one).
 */
function GoLiveListPage({ customerKey, canCreate, lineItems }: { customerKey: string; canCreate: boolean; lineItems: GoLiveLineItem[] }) {
  const recurring = lineItems.filter((item) => item.isRecurring)
  const onDemand = lineItems.filter((item) => !item.isRecurring)

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Go Live" description={`Customer / ${customerKey}`} />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Recurring Commercial Line Items</h2>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Commercial Component</TableHead>
                  <TableHead>Pricing Model</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Commercial Effective From</TableHead>
                  <TableHead>Go Live Status</TableHead>
                  <TableHead>Go Live Date</TableHead>
                  <TableHead>Customer Confirmation</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurring.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-xs text-muted-foreground">
                      No recurring Commercial line items exist for this customer yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recurring.map((item) => (
                    <TableRow key={item.stableComponentKey}>
                      <TableCell className="font-medium text-foreground">{item.componentLabel}</TableCell>
                      <TableCell className="text-muted-foreground">{item.pricingModelLabel}</TableCell>
                      <TableCell className="text-muted-foreground">Version {item.versionNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{formatBusinessDate(item.effectiveFrom)}</TableCell>
                      <TableCell>
                        <Badge variant="ghost" className={GO_LIVE_STATUS_BADGE[item.goLiveStatus]}>
                          {GO_LIVE_STATUS_LABEL[item.goLiveStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.currentRequest?.status === "approved" ? formatBusinessDate(item.currentRequest.goLiveDate) : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.currentRequest ? (item.currentRequest.customerConfirmationStatus === "confirmed" ? "Confirmed" : "Pending") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.currentRequest ? (
                          <Button variant="outline" size="sm" render={<Link href={`/customers/${customerKey}/go-live/${item.currentRequest.id}`} />}>
                            View
                          </Button>
                        ) : canCreate ? (
                          <Button
                            variant="outline"
                            size="sm"
                            render={
                              <Link
                                href={`/customers/${customerKey}/go-live/new?stableComponentKey=${item.stableComponentKey}&commercialConfigurationId=${item.commercialConfigurationId}${item.commercialVersionId ? `&commercialVersionId=${item.commercialVersionId}` : ""}`}
                              />
                            }
                          >
                            Create Go Live
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {onDemand.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">On-Demand Commercial Line Items</h2>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Commercial Component</TableHead>
                    <TableHead>Pricing Model</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Commercial Effective From</TableHead>
                    <TableHead>Go Live</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onDemand.map((item) => (
                    <TableRow key={item.stableComponentKey}>
                      <TableCell className="font-medium text-foreground">{item.componentLabel}</TableCell>
                      <TableCell className="text-muted-foreground">{item.pricingModelLabel}</TableCell>
                      <TableCell className="text-muted-foreground">Version {item.versionNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{formatBusinessDate(item.effectiveFrom)}</TableCell>
                      <TableCell className="text-muted-foreground">Not Required</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export { GoLiveListPage }
