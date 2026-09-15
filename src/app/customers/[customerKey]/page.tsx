import { PageHeader } from "@/components/product/page-header"
import { CustomerMasterDetail } from "@/features/customers/ui/customer-master-detail"
import { getCustomerMasterDetailByKey, loadCustomerDetailContext, buildActivityTimelineFromContext } from "@/features/customers/server"
import { hasPermission } from "@/platform/permissions/server"
import { resolveActorLabels } from "@/platform/audit/server"
import { listCurrentLineItemsForCustomer } from "@/features/go-live/server"
import type { CustomerActivityEvent } from "@/features/customers/server"
import type { GoLiveLineItem } from "@/features/go-live/domain/line-items"

/**
 * Customer Master detail: one record, read-only (task spec §15, §18).
 * Same server-side read boundary as /customers (see that route's own
 * comment): safe today because this table holds only synthetic demo
 * data, wrapped so a missing Supabase credential in this environment
 * shows an honest message instead of crashing the page.
 *
 * `dynamic = "force-dynamic"` explicitly, matching /customers/page.tsx's
 * own reasoning: this route already rendered dynamically because a
 * dynamic segment with no generateStaticParams cannot be prerendered,
 * but that is an implicit consequence of the current file shape, not a
 * guarantee. Declaring it explicitly means a future refactor (for
 * example, adding generateStaticParams) cannot silently reintroduce the
 * stale-static-read bug fixed on the list route.
 */
export const dynamic = "force-dynamic"

export default async function CustomerMasterDetailRoute({
  params,
}: {
  params: Promise<{ customerKey: string }>
}) {
  const { customerKey } = await params

  let detail: Awaited<ReturnType<typeof getCustomerMasterDetailByKey>> = null
  let unavailable = false
  try {
    detail = await getCustomerMasterDetailByKey(customerKey)
  } catch {
    unavailable = true
  }

  if (unavailable) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Customer" description="Customer Master backend read is not available in this environment right now." />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Customer not found" description={`No Customer Master record exists for "${customerKey}".`} />
      </div>
    )
  }

  // Fetched exactly once here: Change Requests, Field History, the
  // onboarding origin, Commercial Configurations/Versions, and the
  // Reference Master snapshot all previously ran twice, once here and
  // once again inside the Activity timeline builder (Platform Scale
  // Closure, Phase V).
  const [context, canDeletePermanently, canManageStatus] = await Promise.all([
    loadCustomerDetailContext(detail.record.id),
    hasPermission("customer", "delete_permanent"),
    hasPermission("customer", "approve"),
  ])

  // Go Live tab summary (NEXUS FULL PRODUCT READINESS, Phase 2): Go Live
  // was previously reachable only via a header button crowded alongside
  // Change Customer/Commercials, with no Tab-level presence like every
  // other capability on this page gets. Fetched here, not inside the
  // Go Live feature's own route, matching this page's own established
  // "fetch once per tab" convention (see the comment above).
  let lineItems: GoLiveLineItem[] = []
  try {
    lineItems = await listCurrentLineItemsForCustomer(detail.record.id)
  } catch {
    lineItems = []
  }

  let activityEvents: CustomerActivityEvent[] = []
  try {
    activityEvents = await buildActivityTimelineFromContext(detail.record.id, context)
  } catch {
    activityEvents = []
  }

  /** Task Phase M: the Field History tab's own "Requested By"/"Approved By" columns need resolved labels too, independent of the Activity timeline's own resolution (which only ever surfaces a subset of these as timeline events, never the raw table). */
  let fieldHistoryActorLabels: Map<string, string | null> = new Map()
  try {
    fieldHistoryActorLabels = await resolveActorLabels(context.fieldHistory.flatMap((entry) => [entry.requestedBy, entry.approvedBy]))
  } catch {
    fieldHistoryActorLabels = new Map()
  }

  return (
    <CustomerMasterDetail
      detail={detail}
      snapshot={context.referenceMasterSnapshot}
      commercialConfigurationId={context.commercialConfigurations[0]?.id ?? null}
      changeRequests={context.changeRequests}
      fieldHistory={context.fieldHistory}
      fieldHistoryActorLabels={fieldHistoryActorLabels}
      canDeletePermanently={canDeletePermanently}
      canManageStatus={canManageStatus}
      activityEvents={activityEvents}
      onboardingOrigin={context.onboardingOrigin}
      lineItems={lineItems}
    />
  )
}
