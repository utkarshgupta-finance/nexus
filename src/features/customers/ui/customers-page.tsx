import Link from "next/link"
import { CircleDashedIcon, InfoIcon, RotateCcwIcon, SendIcon } from "lucide-react"

import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CUSTOMER_ONBOARDING_FIELD_KEYS, CUSTOMER_ONBOARDING_STAGES } from "@/features/customer-onboarding"
import type { CustomerOnboardingCase, CustomerOnboardingCaseStatus } from "@/features/customer-onboarding"
import { resolveOption } from "@/features/reference-data"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"
import { FIXTURE_ONBOARDING_CASES } from "../fixtures/onboarding-cases.fixture"
import type { CustomerMasterListEntry } from "../read-models/customer-master"

/**
 * Customers: two conceptually separate groups (task spec §5). Onboarding
 * Cases are Customer Onboarding requests that have not yet become an
 * approved Customer Master record; they keep their own stable
 * `requestId` identity throughout, and stay fixture-backed (unchanged).
 * Customer Master reads the real backend (see ../server.ts,
 * src/app/customers/page.tsx): `customerMasterEntries` is whatever the
 * real `customers` table currently holds, `customerMasterUnavailable`
 * is only true when that backend read itself failed (for example, no
 * Supabase credential configured in this environment), never used to
 * fake a populated table.
 */

const STATUS_BADGE: Record<CustomerOnboardingCaseStatus, { label: string; className: string; icon: typeof CircleDashedIcon }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground", icon: CircleDashedIcon },
  submitted: { label: "Submitted", className: "bg-info/10 text-info", icon: SendIcon },
  sent_back: { label: "Sent Back", className: "bg-warning/10 text-warning", icon: RotateCcwIcon },
  resubmitted: { label: "Resubmitted", className: "bg-info/10 text-info", icon: SendIcon },
  approved: { label: "Approved", className: "bg-success/10 text-success", icon: SendIcon },
}

function stageLabel(onboardingCase: CustomerOnboardingCase): string {
  return CUSTOMER_ONBOARDING_STAGES.find((stage) => stage.key === onboardingCase.currentStageKey)?.label ?? "-"
}

function legalEntityName(onboardingCase: CustomerOnboardingCase): string {
  const value = onboardingCase.currentRevision.data[CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName]
  return typeof value === "string" && value.length > 0 ? value : "Not yet entered"
}

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
      <PageHeader title="Customers" description="Onboarding cases and approved Customer Master records" />

      <div className="flex flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-foreground">Onboarding Cases</h2>
            <p className="text-xs text-muted-foreground">
              Customer creation requests in progress. None of these are Customer Master records yet.
            </p>
          </div>

          <Table className="table-fixed sm:table-auto">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="hidden sm:table-cell">Case</TableHead>
                <TableHead>
                  <span className="sm:hidden">Customer</span>
                  <span className="hidden sm:inline">Customer / Legal Entity Name</span>
                </TableHead>
                <TableHead className="hidden sm:table-cell">Stage</TableHead>
                <TableHead className="w-24 sm:w-auto">Status</TableHead>
                <TableHead className="hidden sm:table-cell">Last updated</TableHead>
                <TableHead className="w-20 text-right sm:w-auto">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FIXTURE_ONBOARDING_CASES.map((onboardingCase) => {
                const status = STATUS_BADGE[onboardingCase.status]
                const StatusIcon = status.icon
                return (
                  <TableRow key={onboardingCase.requestId} className="hover:bg-transparent">
                    <TableCell className="hidden font-mono text-[0.7rem] text-muted-foreground sm:table-cell">
                      {onboardingCase.requestId}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">{legalEntityName(onboardingCase)}</span>
                        <span className="font-mono text-[0.65rem] text-muted-foreground sm:hidden">
                          {onboardingCase.requestId}
                        </span>
                        <span className="text-[0.7rem] text-muted-foreground sm:hidden">{stageLabel(onboardingCase)}</span>
                        {onboardingCase.status === "sent_back" && onboardingCase.sentBack ? (
                          <p className="text-[0.7rem] text-muted-foreground sm:hidden">{onboardingCase.sentBack.reason}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-foreground sm:table-cell">{stageLabel(onboardingCase)}</TableCell>
                    <TableCell>
                      <Badge variant="ghost" className={`gap-1 ${status.className}`}>
                        <StatusIcon data-icon="inline-start" className="size-3" />
                        {status.label}
                      </Badge>
                      {onboardingCase.status === "sent_back" && onboardingCase.sentBack ? (
                        <p className="mt-1 hidden text-[0.7rem] text-muted-foreground sm:block">
                          {onboardingCase.sentBack.reason}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {onboardingCase.currentRevision.updatedAt.slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-right">
                      {onboardingCase.status === "draft" ? (
                        <Button variant="outline" size="sm" render={<Link href="/forms/customer-onboarding" />}>
                          Continue
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled>
                          Review
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
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
