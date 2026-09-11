import Link from "next/link"
import { ClockIcon, DownloadIcon, InfoIcon } from "lucide-react"

import { PageHeader } from "@/components/product/page-header"
import { KeyValueGrid } from "@/components/product/key-value-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { resolveOption } from "@/features/reference-data"
import type { CustomerMasterDetail as CustomerMasterDetailData } from "../read-models/customer-master"

/**
 * Read-only Customer Master record view (task spec: no unrestricted
 * direct editing). `detail.enrichment`/`detail.documents` are demo/
 * fixture data, never backend truth (../domain/demo-enrichment.ts's
 * header); every section built from them is visibly labeled Demo so a
 * reader never mistakes this screen for a fully persisted record.
 */
function CustomerMasterDetail({ detail }: { detail: CustomerMasterDetailData }) {
  const { record, enrichment, documents } = detail
  const isDemo = enrichment !== null

  const countryLabel = enrichment ? (resolveOption("country", enrichment.countryCode)?.label ?? enrichment.countryCode) : null
  const industryLabel = enrichment
    ? (resolveOption("industry", enrichment.industryValue)?.label ?? enrichment.industryValue)
    : null
  const segmentLabel = enrichment ? (resolveOption("segment", enrichment.segmentValue)?.label ?? enrichment.segmentValue) : null
  const businessUnitLabel = enrichment
    ? (resolveOption("business_unit", enrichment.businessUnitValue)?.label ?? enrichment.businessUnitValue)
    : null
  const billingCurrencyLabel = enrichment
    ? (resolveOption("currency", enrichment.billingCurrencyCode)?.label ?? enrichment.billingCurrencyCode)
    : null

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={record.name}
        description={record.key}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="ghost" className={record.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
              {record.isActive ? "Active" : "Inactive"}
            </Badge>
            {isDemo ? (
              <Badge variant="ghost" className="gap-1 bg-warning/10 text-warning">
                DEMO
              </Badge>
            ) : null}
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" size="sm" disabled />}>
                Create Change Request
              </TooltipTrigger>
              <TooltipContent side="left">
                Coming later: direct editing is never permitted here. Customer Master changes will go through a
                Customer Master Change Request (docs/DATA_ARCHITECTURE.md §15).
              </TooltipContent>
            </Tooltip>
          </div>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        {isDemo ? (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <p className="text-xs text-muted-foreground">
              This is a fictional demo record. <span className="font-medium text-foreground">Legal Entity Name</span>,{" "}
              <span className="font-medium text-foreground">Brand</span>, and{" "}
              <span className="font-medium text-foreground">Status</span> are read from the real Nexus backend
              (`customers`). Business Classification, Tax &amp; Registration, Commercial, and Documents below are demo
              enrichment, not yet persisted anywhere (`docs/DATA_ARCHITECTURE.md` §5.2, §15, §16).
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2.5">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              This Customer Master record currently only stores identity, name, and status. Business Classification,
              Tax &amp; Registration, Commercial, and Documents are not yet available for this customer.
            </p>
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Identity</h2>
          <KeyValueGrid
            columns={3}
            items={[
              { label: "Customer ID", value: <span className="font-mono text-[0.7rem]">{record.id}</span> },
              { label: "Legal Entity Name", value: record.name },
              { label: "Brand", value: enrichment?.brandName ?? "Not available" },
            ]}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Business Classification</h2>
          <KeyValueGrid
            columns={3}
            items={[
              { label: "Country", value: countryLabel ?? "Not available" },
              { label: "State", value: enrichment?.stateName ?? "Not available" },
              { label: "City", value: enrichment?.cityName ?? "Not available" },
              { label: "Industry", value: industryLabel ?? "Not available" },
              { label: "Segment", value: segmentLabel ?? "Not available" },
              { label: "Business Unit", value: businessUnitLabel ?? "Not available" },
            ]}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Tax & Registration</h2>
          <KeyValueGrid
            columns={3}
            items={[
              { label: "GSTIN", value: enrichment?.gstin ?? "Not available" },
              { label: "PAN", value: enrichment?.pan ?? "Not available" },
              { label: "TAN", value: enrichment?.tan ?? "Not available" },
            ]}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial</h2>
          <KeyValueGrid
            columns={3}
            items={[
              { label: "Billing Currency", value: billingCurrencyLabel ?? "Not available" },
              { label: "Agreement", value: documents.length > 0 ? "Present" : "Not available" },
              {
                label: "Legal Approval",
                value: isDemo ? (
                  <Badge variant="ghost" className="gap-1 bg-success/10 text-success">
                    Demo Complete
                  </Badge>
                ) : (
                  "Not available"
                ),
              },
            ]}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Documents</h2>
            {isDemo ? <span className="text-[0.7rem] text-muted-foreground">Generated on demand. Not stored.</span> : null}
          </div>
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No documents available for this customer yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-[0.7rem] text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Document Type</th>
                    <th className="py-2 pr-3 font-medium">File Name</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Version</th>
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.documentId} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-foreground">{document.title}</td>
                      <td className="py-2 pr-3 font-mono text-[0.7rem] text-muted-foreground">{document.fileName}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="ghost" className="gap-1 bg-warning/10 text-warning">
                          Demo / Fixture
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">v1</td>
                      <td className="py-2 pr-3 text-muted-foreground">DEMO</td>
                      <td className="py-2 pr-3 text-right">
                        <Button variant="outline" size="sm" render={<Link href={`/api/demo/customer-documents/${document.documentType}`} target="_blank" />}>
                          <DownloadIcon data-icon="inline-start" className="size-3.5" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">History / Activity</h2>
          <Separator />
          <div className="flex items-start gap-2 py-2">
            <ClockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              No activity history is wired into this screen yet. This section never shows fabricated events; real
              audit history will appear here once a Customer Master read model reads `audit_log`.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

export { CustomerMasterDetail }
