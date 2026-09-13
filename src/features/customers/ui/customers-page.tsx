import Link from "next/link"
import { InfoIcon, ListChecksIcon } from "lucide-react"

import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getActiveOptions, resolveOption } from "@/features/reference-data"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"
import {
  resolveBrandName,
  resolveCountryCode,
  resolveSegmentCode,
  resolveBusinessUnitCode,
  resolveBillingCurrencyCode,
} from "../domain/display-fields"
import { CustomerFilterBar } from "./customer-filter-bar"
import type { CustomerMasterListEntry } from "../read-models/customer-master"
import type { FormerNameSearchResult } from "../server/former-name-search"

/**
 * Customers: two conceptually separate groups (task spec §5). Onboarding
 * Cases are Customer Onboarding requests that have not yet become an
 * approved Customer Master record: submitted onboarding never gets
 * mixed into the table below, but the requester and reviewer both need
 * somewhere obvious to find them, so this page links to the real
 * Reviews queue (/reviews) rather than rendering a second, separate list
 * here. Customer Master reads the real backend (see ../server.ts,
 * src/app/customers/page.tsx): `customerMasterEntries` is whatever the
 * real `customers` table currently holds after filtering (Customer
 * Search, task Phase B) is applied server-side.
 */

function CustomersPage({
  customerMasterEntries,
  customerMasterUnavailable,
  snapshot,
  formerNameMatches,
  hasActiveFilters,
}: {
  customerMasterEntries: CustomerMasterListEntry[]
  customerMasterUnavailable: boolean
  snapshot: ReferenceMasterSnapshot
  formerNameMatches: FormerNameSearchResult[]
  hasActiveFilters: boolean
}) {
  const segmentOptions = getActiveOptions(snapshot, "segment")
  const businessUnitOptions = getActiveOptions(snapshot, "business_unit")
  const countryOptions = getActiveOptions(snapshot, "country")

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

        <CustomerFilterBar segmentOptions={segmentOptions} businessUnitOptions={businessUnitOptions} countryOptions={countryOptions} />

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
          ) : customerMasterEntries.length === 0 && formerNameMatches.length === 0 ? (
            <div className="flex flex-col items-start gap-1 rounded-md border border-dashed px-4 py-6">
              <p className="text-xs font-medium text-foreground">{hasActiveFilters ? "No customers match this search" : "No approved customers yet"}</p>
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters
                  ? "Try a different name, brand, key, or clear filters."
                  : "Approved Onboarding Cases will appear here as Customer Master records."}
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
                      {resolveBrandName(record, enrichment) ?? "-"}
                    </TableCell>
                    <TableCell className="hidden text-foreground sm:table-cell">
                      {(() => {
                        const code = resolveCountryCode(record, enrichment)
                        return code ? (resolveOption(snapshot, "country", code)?.label ?? code) : "-"
                      })()}
                    </TableCell>
                    <TableCell className="hidden text-foreground md:table-cell">
                      {(() => {
                        const code = resolveSegmentCode(record, enrichment)
                        return code ? (resolveOption(snapshot, "segment", code)?.label ?? code) : "-"
                      })()}
                    </TableCell>
                    <TableCell className="hidden text-foreground md:table-cell">
                      {(() => {
                        const code = resolveBusinessUnitCode(record, enrichment)
                        return code ? (resolveOption(snapshot, "business_unit", code)?.label ?? code) : "-"
                      })()}
                    </TableCell>
                    <TableCell className="hidden text-foreground sm:table-cell">
                      {(() => {
                        const code = resolveBillingCurrencyCode(enrichment)
                        return code ? (resolveOption(snapshot, "currency", code)?.label ?? code) : "-"
                      })()}
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
                {formerNameMatches.map(({ entry, fieldKey, oldValue }) => (
                  <TableRow key={`former-${entry.record.id}`} className="hover:bg-transparent">
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">{entry.record.name}</span>
                        <span className="font-mono text-[0.65rem] text-muted-foreground">{entry.record.key}</span>
                        <Badge variant="ghost" className="w-fit gap-1 bg-muted text-muted-foreground">
                          {fieldKey === "brand_name" ? `Former brand: ${oldValue}` : `Former legal name: ${oldValue}`}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-foreground sm:table-cell">{resolveBrandName(entry.record, entry.enrichment) ?? "-"}</TableCell>
                    <TableCell className="hidden text-foreground sm:table-cell">
                      {(() => {
                        const code = resolveCountryCode(entry.record, entry.enrichment)
                        return code ? (resolveOption(snapshot, "country", code)?.label ?? code) : "-"
                      })()}
                    </TableCell>
                    <TableCell className="hidden text-foreground md:table-cell">-</TableCell>
                    <TableCell className="hidden text-foreground md:table-cell">-</TableCell>
                    <TableCell className="hidden text-foreground sm:table-cell">-</TableCell>
                    <TableCell>
                      <Badge variant="ghost" className={entry.record.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        {entry.record.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" render={<Link href={`/customers/${entry.record.key}`} />}>
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
