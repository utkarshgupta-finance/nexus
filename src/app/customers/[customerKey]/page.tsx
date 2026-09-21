import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { PageHeader } from "@/components/product/page-header"
import { CustomerMasterDetail } from "@/features/customers/ui/customer-master-detail"
import { getCustomerMasterDetailByKey, loadCustomerDetailContext, buildActivityTimelineFromContext } from "@/features/customers/server"
import { hasPermission, hasPermissionForCustomer } from "@/platform/permissions/server"
import { resolveActorLabels } from "@/platform/audit/server"
import { listCurrentLineItemsForCustomer } from "@/features/go-live/server"
import type { CustomerActivityEvent } from "@/features/customers/server"
import type { GoLiveLineItem } from "@/features/go-live/domain/line-items"

/**
 * Customer Master detail: one record, read-only (task spec §15, §18).
 * Gated the same way every other governed route is (AuthGate +
 * `customer.read`, matching /customers, /my-work, and the Change
 * Customer entry point), wrapped so a missing Supabase credential in
 * this environment shows an honest message instead of crashing the
 * page.
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

const CUSTOMER_READ = { resource: "customer", action: "read" }

export default async function CustomerMasterDetailRoute({
  params,
}: {
  params: Promise<{ customerKey: string }>
}) {
  const session = await getCurrentNexusSession()
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
      <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo={`/customers/${customerKey}`}>
        <div className="flex flex-1 flex-col">
          <PageHeader title="Customer" description="Customer Master backend read is not available in this environment right now." />
        </div>
      </AuthGate>
    )
  }

  if (!detail) {
    return (
      <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo={`/customers/${customerKey}`}>
        <div className="flex flex-1 flex-col">
          <PageHeader title="Customer not found" description={`No Customer Master record exists for "${customerKey}".`} />
        </div>
      </AuthGate>
    )
  }

  // Fetched exactly once here: Change Requests, Field History, the
  // onboarding origin, Commercial Configurations/Versions, and the
  // Reference Master snapshot all previously ran twice, once here and
  // once again inside the Activity timeline builder (Platform Scale
  // Closure, Phase V).
  const [context, canDeletePermanently, canManageStatus, canReadThisCustomer] = await Promise.all([
    loadCustomerDetailContext(detail.record.id),
    hasPermission("customer", "delete_permanent"),
    hasPermission("customer", "approve"),
    // PD-005 (D-022, Batches 1-13 Ledger Audit product decision closure):
    // a global customer.read holder passes as before; a Business
    // Unit/Territory/Customer-scoped holder now also passes, only for a
    // customer within their granted scope.
    hasPermissionForCustomer("customer", "read", detail.record.id),
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
    <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo={`/customers/${customerKey}`} additionalAccessGranted={canReadThisCustomer}>
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
    </AuthGate>
  )
}
