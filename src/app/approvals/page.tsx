import { AuthGate } from "@/components/product/auth-gate"
import { PageHeader } from "@/components/product/page-header"
import { ApprovalInboxTable } from "@/components/product/approval-inbox-table"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { loadApprovalInbox } from "@/platform/approvals/server"
import type { ApprovalInboxItem } from "@/platform/approvals/domain/types"

/**
 * Unified Approvals inbox (task Phase E): one operational surface over
 * Customer Onboarding, Customer Change Requests, and Commercial
 * Configuration Version reviews, replacing the sidebar's previously
 * fragmented three-page Reviews flow (still reachable at /reviews/* for
 * each type's own decision screen; this page only unifies the list).
 *
 * `dynamic = "force-dynamic"`: reads live backend data across three
 * governed lifecycles, so it must never be statically prerendered.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_READ = { resource: "customer", action: "read" }

export default async function ApprovalsRoute() {
  const session = await getCurrentNexusSession()

  let items: ApprovalInboxItem[] = []
  let unavailable = false
  try {
    items = await loadApprovalInbox()
  } catch {
    unavailable = true
  }

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo="/approvals">
      <div className="flex flex-1 flex-col">
        <PageHeader title="Approvals" description="Customer Onboarding, Customer Change Requests, and Commercial Versions awaiting a decision." />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
          {unavailable ? (
            <div className="flex items-start gap-2 rounded-md border border-dashed px-4 py-4">
              <p className="text-xs text-muted-foreground">Approvals backend read is not available in this environment right now.</p>
            </div>
          ) : (
            <ApprovalInboxTable items={items} />
          )}
        </div>
      </div>
    </AuthGate>
  )
}
