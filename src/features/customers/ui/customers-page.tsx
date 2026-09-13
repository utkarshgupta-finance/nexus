import Link from "next/link"
import { InfoIcon, ListChecksIcon } from "lucide-react"

import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { resolveOption } from "@/features/reference-data"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"
import type { CustomerMasterListEntry } from "../read-models/customer-master"

/**
 * Customers: two conceptually separate groups (task spec §5). Onboarding
 * Cases are Customer Onboarding requests that have not yet become an
 * approved Customer Master record: submitted onboarding never gets
 * mixed into the table below, but the requester and reviewer both need
 * somewhere obvious to find them, so this page links to the real
 * Reviews queue (/reviews) rather than rendering a second, separate list
 * here. Customer Master reads the real backend (see ../server.ts,
 * src/app/customers/page.tsx): `customerMasterEntries` is whatever the
 * real `customers` table currently holds, `customerMasterUnavailable`
 * is only true when that backend read itself failed (for example, no
 * Supabase credential configured in this environment), never used to
 * fake a populated table.
 */

function CustomersPage({
  customerMasterEntries,
  customerMasterUnavailable,
  snapshot,
}: {
  customerMasterEntries: CustomerMasterListEntry[]
  customerMasterUnavailable: boolean
  snapshot: ReferenceMasterSnapshot
}) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Customers"
        description="Approved Customer Master records."
        actions={
          <Button variant="outline" size="sm" render={<Link href="/reviews" />}>
            <ListChecksIcon data-icon="inline-start" className="size-3.5" />
            Onboarding Requests
          </Button>
        }
      />

      <div className="flex flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-start gap-2 rounded-md border border-dashed px-4 py-3">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            A customer creation request is not a Customer Master until it is approved. Submitted and in-progress onboarding requests are tracked in{" "}
            <Link href="/reviews" className="font-medium text-foreground underline underline-offset-2">
              Onboarding Requests
            </Link>
            , not below.
          </p>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-foreground">Customer Master</h2>
            <p className="text-xs text-muted-foreground">Approved, current Customer records.</p>
          </div>

          {customerMasterUnavailable ? (
            <div className="flex items-start gap-2 rounded-md border border-dashed px-4 py-4">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Customer Master backend read is not available in this environment right now.
              </p>
            </div>
          ) : customerMasterEntries.length === 0 ? (
            <div className="flex flex-col items-start gap-1 rounded-md border border-dashed px-4 py-6">
              <p className="text-xs font-medium text-foreground">No approved customers yet</p>
              <p className="text-xs text-muted-foreground">
                Approved Onboarding Cases will appear here as Customer Master records.
              </p>
            </div>
          ) : (
            <Table className="table-fixed sm:table-auto">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Legal Entity Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Brand</TableHead>
                  <TableHead className="hidden sm:table-cell">Country</TableHead>
                  <TableHead className="hidden md:table-cell">Segment</TableHead>
                  <TableHead className="hidden md:table-cell">Business Unit</TableHead>
                  <TableHead className="hidden sm:table-cell">Billing Currency</TableHead>
                  <TableHead className="w-24 sm:w-auto">Status</TableHead>
                  <TableHead className="w-16 text-right sm:w-auto">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerMasterEntries.map(({ record, enrichment }) => (
                  <TableRow key={record.id} className="hover:bg-transparent">
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">{record.name}</span>
                        <span className="font-mono text-[0.65rem] text-muted-foreground">{record.key}</span>
                        {enrichment ? (
                          <Badge variant="ghost" className="w-fit gap-1 bg-warning/10 text-warning sm:hidden">
                            DEMO
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-foreground sm:table-cell">
                      {enrichment?.brandName ?? "-"}
                    </TableCell>
                    <TableCell className="hidden text-foreground sm:table-cell">
                      {enrichment ? (resolveOption(snapshot, "country", enrichment.countryCode)?.label ?? enrichment.countryCode) : "-"}
                    </TableCell>
                    <TableCell className="hidden text-foreground md:table-cell">
                      {enrichment ? (resolveOption(snapshot, "segment", enrichment.segmentValue)?.label ?? enrichment.segmentValue) : "-"}
                    </TableCell>
                    <TableCell className="hidden text-foreground md:table-cell">
                      {enrichment
                        ? (resolveOption(snapshot, "business_unit", enrichment.businessUnitValue)?.label ?? enrichment.businessUnitValue)
                        : "-"}
                    </TableCell>
                    <TableCell className="hidden text-foreground sm:table-cell">
                      {enrichment
                        ? (resolveOption(snapshot, "currency", enrichment.billingCurrencyCode)?.label ?? enrichment.billingCurrencyCode)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="ghost" className={record.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        {record.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" render={<Link href={`/customers/${record.key}`} />}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}

export { CustomersPage }
