"use client"

import { useState } from "react"
import Link from "next/link"
import { ClockIcon, DownloadIcon, EyeIcon, InfoIcon } from "lucide-react"

import { PageHeader } from "@/components/product/page-header"
import { KeyValueGrid } from "@/components/product/key-value-grid"
import { DocumentViewer } from "@/components/product/document-viewer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { resolveOption } from "@/features/reference-data"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"
import type { CustomerChangeRequest, CustomerFieldHistoryEntry } from "@/features/customer-change"
import { labelForGovernedField, formatChangeRequestId } from "@/features/customer-change"
import { labelForCaseStatus } from "@/platform/approvals/domain/inbox"
import type { CustomerMasterDetail as CustomerMasterDetailData } from "../read-models/customer-master"
import {
  resolveBrandName,
  resolveCountryCode,
  resolveIndustryCode,
  resolveSegmentCode,
  resolveBusinessUnitCode,
  resolveBillingCurrencyCode,
  resolveState,
  resolveCity,
  resolvePrimaryContactName,
  resolvePrimaryContactEmail,
  resolvePrimaryContactDesignation,
  resolveGstNumber,
  resolvePan,
  resolveTan,
} from "../domain/display-fields"
import { DeleteCustomerPanel } from "./delete-customer-panel"
import { CustomerStatusPanel } from "./customer-status-panel"
import { CustomerActivityTimeline } from "./customer-activity-timeline"
import { formatBusinessDate, formatTimestampDate } from "@/lib/date"
import type { CustomerActivityEvent } from "../domain/activity"
import type { OnboardingOrigin } from "@/features/customer-onboarding/server"

/**
 * Customer workspace (Customer Lifecycle V1, task §3): Overview, Customer
 * Details, Tax & Registration, Commercials, Documents, Change Requests,
 * History tabs. Approved Customer Master stays strictly read-only: there
 * is no direct Edit action anywhere on this screen, only "Create Change
 * Request" (governed, see /customers/[customerKey]/change-requests/new).
 *
 * `detail.enrichment`/`detail.documents` remain demo/fixture data
 * (../domain/demo-enrichment.ts's header), used only as a fallback when
 * a customer has no real governed value yet (record.segment etc. are
 * null until a Change Request or onboarding populates them, see
 * supabase/migrations/20260913060000_customer_change_request_foundation.sql).
 * A real value on `record` always wins over demo enrichment.
 *
 * "use client": needed for the Document Viewer's open/close state and
 * the Tabs' own client-side interactivity. Every value rendered here
 * still arrives as a plain prop from the server-side read (see
 * ../../../app/customers/[customerKey]/page.tsx).
 */
function CustomerMasterDetail({
  detail,
  snapshot,
  commercialConfigurationId,
  changeRequests,
  fieldHistory,
  canDeletePermanently = false,
  canManageStatus = false,
  activityEvents,
  onboardingOrigin,
}: {
  detail: CustomerMasterDetailData
  snapshot: ReferenceMasterSnapshot
  /** The customer's real, persisted Commercial Configuration id, resolved server-side by stable Customer Master id (never legal name/brand/GST/PAN). Null when this customer has none yet. */
  commercialConfigurationId: string | null
  changeRequests: CustomerChangeRequest[]
  fieldHistory: CustomerFieldHistoryEntry[]
  /** Gates the "More Actions -> Permanently Delete Customer" entry point (Customer Lifecycle V1, Phase 14-16); resolved server-side from `customer.delete_permanent`. */
  canDeletePermanently?: boolean
  /** Gates the "More Actions -> Deactivate/Reactivate Customer" entry point (task Phase I); resolved server-side from `customer.approve`. */
  canManageStatus?: boolean
  /** Customer Activity timeline (task Phase C), resolved server-side. */
  activityEvents: CustomerActivityEvent[]
  /** The onboarding case that created this Customer Master (task Phase N); null for a customer created directly, never through onboarding. */
  onboardingOrigin: OnboardingOrigin | null
}) {
  const { record, enrichment, documents } = detail
  const isDemo = enrichment !== null
  const [viewingDocument, setViewingDocument] = useState<{ title: string; url: string; downloadUrl: string } | null>(null)

  const brandName = resolveBrandName(record, enrichment)
  const resolveLabel = (listKey: "country" | "industry" | "segment" | "business_unit" | "currency", code: string | null) =>
    code ? (resolveOption(snapshot, listKey, code)?.label ?? code) : null
  const countryLabel = resolveLabel("country", resolveCountryCode(record, enrichment))
  const industryLabel = resolveLabel("industry", resolveIndustryCode(record, enrichment))
  const segmentLabel = resolveLabel("segment", resolveSegmentCode(record, enrichment))
  const businessUnitLabel = resolveLabel("business_unit", resolveBusinessUnitCode(record, enrichment))
  const billingCurrencyLabel = resolveLabel("currency", resolveBillingCurrencyCode(record, enrichment))
  const stateName = resolveState(record, enrichment)
  const cityName = resolveCity(record, enrichment)
  const primaryContactName = resolvePrimaryContactName(record, enrichment)
  const primaryContactEmail = resolvePrimaryContactEmail(record, enrichment)
  const primaryContactDesignation = resolvePrimaryContactDesignation(record, enrichment)
  const gstNumber = resolveGstNumber(record, enrichment)
  const pan = resolvePan(record, enrichment)
  const tan = resolveTan(record, enrichment)
  const statusLabel = labelForCaseStatus
  const latestChangeRequest = [...changeRequests].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ?? null

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
            {commercialConfigurationId ? (
              <Button variant="outline" size="sm" render={<Link href={`/commercials/${commercialConfigurationId}`} />}>
                Commercials
              </Button>
            ) : null}
            <Button variant="outline" size="sm" render={<Link href={`/customers/${record.key}/change-requests/new`} />}>
              Create Change Request
            </Button>
          </div>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTab value="overview">Overview</TabsTab>
            <TabsTab value="activity">Activity</TabsTab>
            <TabsTab value="details">Customer Details</TabsTab>
            <TabsTab value="tax">Tax &amp; Registration</TabsTab>
            <TabsTab value="commercials">Commercials</TabsTab>
            <TabsTab value="documents">Documents</TabsTab>
            <TabsTab value="change-requests">Change Requests</TabsTab>
            <TabsTab value="history">History</TabsTab>
          </TabsList>

          <TabsPanel value="overview" className="flex flex-col gap-4 pt-4">
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Identity</h2>
              <KeyValueGrid
                columns={3}
                items={[
                  { label: "Customer ID", value: <span className="font-mono text-[0.7rem]">{record.id}</span> },
                  { label: "Legal Entity Name", value: record.name },
                  { label: "Brand", value: brandName ?? "Not available" },
                ]}
              />
            </section>
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Summary</h2>
              <KeyValueGrid
                columns={3}
                items={[
                  { label: "Segment", value: segmentLabel ?? "Not available" },
                  { label: "Business Unit", value: businessUnitLabel ?? "Not available" },
                  { label: "Country", value: countryLabel ?? "Not available" },
                  { label: "Status", value: record.isActive ? "Active" : "Inactive" },
                  {
                    label: "Originating Onboarding Request",
                    value: onboardingOrigin ? (
                      <Link href={`/reviews/${onboardingOrigin.requestId}`} className="font-medium text-foreground underline underline-offset-2">
                        View request
                      </Link>
                    ) : (
                      "Created directly (not through Onboarding)"
                    ),
                  },
                  {
                    label: "Latest Change Request",
                    value: latestChangeRequest ? (
                      <Link
                        href={
                          latestChangeRequest.status === "draft" || latestChangeRequest.status === "sent_back"
                            ? `/customers/${record.key}/change-requests/${latestChangeRequest.requestId}`
                            : `/reviews/change-requests/${latestChangeRequest.requestId}`
                        }
                        className="font-medium text-foreground underline underline-offset-2"
                      >
                        {statusLabel(latestChangeRequest.status)}
                      </Link>
                    ) : (
                      "None yet"
                    ),
                  },
                  { label: "Created At", value: formatTimestampDate(record.createdAt) },
                  { label: "Last Changed At", value: formatTimestampDate(record.updatedAt) },
                ]}
              />
            </section>
            {isDemo ? (
              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <p className="text-xs text-muted-foreground">
                  Some fields on this record still fall back to a fictional demo enrichment where no real value has
                  been set yet (`docs/DATA_ARCHITECTURE.md` §5.2, §15). Any field a Change Request has actually
                  changed shows the real governed value instead.
                </p>
              </div>
            ) : null}
            {canDeletePermanently || canManageStatus ? (
              <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
                <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">More Actions</h2>
                {canManageStatus ? <CustomerStatusPanel customerId={record.id} isActive={record.isActive} /> : null}
                {canDeletePermanently ? <DeleteCustomerPanel customerId={record.id} customerKey={record.key} /> : null}
              </section>
            ) : null}
          </TabsPanel>

          <TabsPanel value="activity" className="flex flex-col gap-4 pt-4">
            <CustomerActivityTimeline events={activityEvents} />
          </TabsPanel>

          <TabsPanel value="details" className="flex flex-col gap-4 pt-4">
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Business Classification</h2>
              <KeyValueGrid
                columns={3}
                items={[
                  { label: "Country", value: countryLabel ?? "Not available" },
                  { label: "State", value: stateName ?? "Not available" },
                  { label: "City", value: cityName ?? "Not available" },
                  { label: "Address", value: record.address ?? "Not available" },
                  { label: "Postal Code", value: record.postalCode ?? "Not available" },
                  { label: "Website", value: record.website ?? "Not available" },
                  { label: "Industry", value: industryLabel ?? "Not available" },
                  { label: "Segment", value: segmentLabel ?? "Not available" },
                  { label: "Business Unit", value: businessUnitLabel ?? "Not available" },
                ]}
              />
            </section>
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Primary Contact</h2>
              <KeyValueGrid
                columns={3}
                items={[
                  { label: "Name", value: primaryContactName ?? "Not available" },
                  { label: "Email", value: primaryContactEmail ?? "Not available" },
                  { label: "Phone", value: record.primaryContactPhoneNumber ?? "Not available" },
                  { label: "Designation", value: primaryContactDesignation ?? "Not available" },
                ]}
              />
            </section>
          </TabsPanel>

          <TabsPanel value="tax" className="flex flex-col gap-4 pt-4">
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Tax &amp; Registration</h2>
              <KeyValueGrid
                columns={3}
                items={[
                  { label: "GSTIN", value: gstNumber ?? "Not available" },
                  { label: "PAN", value: pan ?? "Not available" },
                  { label: "TAN", value: tan ?? "Not available" },
                  { label: "Tax Identifier Type", value: record.taxIdentifierType ?? "Not available" },
                  { label: "Tax Identifier Name", value: record.taxIdentifierName ?? "Not available" },
                  { label: "Tax Registration Number", value: record.taxRegistrationNumber ?? "Not available" },
                ]}
              />
            </section>
          </TabsPanel>

          <TabsPanel value="commercials" className="flex flex-col gap-4 pt-4">
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
              {commercialConfigurationId ? (
                <Button variant="outline" size="sm" className="w-fit" render={<Link href={`/commercials/${commercialConfigurationId}`} />}>
                  Open Commercial Configuration
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">No Commercial Configuration exists for this customer yet.</p>
              )}
            </section>
          </TabsPanel>

          <TabsPanel value="documents" className="flex flex-col gap-4 pt-4">
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
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setViewingDocument({
                                    title: document.title,
                                    url: `/api/demo/customer-documents/${document.documentType}`,
                                    downloadUrl: `/api/demo/customer-documents/${document.documentType}?disposition=attachment`,
                                  })
                                }
                              >
                                <EyeIcon data-icon="inline-start" className="size-3.5" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                render={<Link href={`/api/demo/customer-documents/${document.documentType}?disposition=attachment`} download />}
                              >
                                <DownloadIcon data-icon="inline-start" className="size-3.5" />
                                Download
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsPanel>

          <TabsPanel value="change-requests" className="flex flex-col gap-4 pt-4">
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Change Requests</h2>
              {changeRequests.length === 0 ? (
                <p className="text-xs text-muted-foreground">No Change Requests have been created for this customer yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-[0.7rem] text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Request</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 pr-3 font-medium">Reason</th>
                        <th className="py-2 pr-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changeRequests.map((changeRequest) => (
                        <tr key={changeRequest.requestId} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-mono text-[0.7rem] text-muted-foreground">{formatChangeRequestId(changeRequest.requestNumber)}</td>
                          <td className="py-2 pr-3">
                            <Badge variant="ghost" className="bg-muted text-muted-foreground">
                              {changeRequest.status}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 text-foreground">{changeRequest.reason || "-"}</td>
                          <td className="py-2 pr-3 text-right">
                            <Link
                              href={
                                changeRequest.status === "draft" || changeRequest.status === "sent_back"
                                  ? `/customers/${record.key}/change-requests/${changeRequest.requestId}`
                                  : `/reviews/change-requests/${changeRequest.requestId}`
                              }
                              className="text-xs font-medium text-foreground underline underline-offset-2"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsPanel>

          <TabsPanel value="history" className="flex flex-col gap-4 pt-4">
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Field History</h2>
              <Separator />
              {fieldHistory.length === 0 ? (
                <div className="flex items-start gap-2 py-2">
                  <ClockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    No governed field has changed on this customer yet. Real history appears here once a Customer
                    Change Request is approved.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-[0.7rem] text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Field</th>
                        <th className="py-2 pr-3 font-medium">Old Value</th>
                        <th className="py-2 pr-3 font-medium">New Value</th>
                        <th className="py-2 pr-3 font-medium">Effective Date</th>
                        <th className="py-2 pr-3 font-medium">Changed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fieldHistory.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium text-foreground">{labelForGovernedField(entry.fieldKey)}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{entry.oldValue ?? "-"}</td>
                          <td className="py-2 pr-3 text-foreground">{entry.newValue ?? "-"}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{entry.effectiveDate ? formatBusinessDate(entry.effectiveDate) : "-"}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{formatTimestampDate(entry.changedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsPanel>
        </Tabs>
      </div>

      <DocumentViewer
        open={viewingDocument !== null}
        onOpenChange={(open) => {
          if (!open) setViewingDocument(null)
        }}
        documentName={viewingDocument?.title ?? ""}
        mimeType="application/pdf"
        url={viewingDocument?.url ?? null}
        downloadUrl={viewingDocument?.downloadUrl}
      />
    </div>
  )
}

export { CustomerMasterDetail }
