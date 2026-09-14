import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { loadMyWork } from "@/platform/approvals/server"
import { MyWorkPage } from "@/features/my-work/ui/my-work-page"
import type { MyWorkItem } from "@/platform/approvals/domain/my-work"

/**
 * My Work (task spec): real, server-scoped aggregation, replacing the
 * previous fixture (`WORK_ITEMS`). `dynamic = "force-dynamic"`: reads
 * live backend data, so it must never be statically prerendered.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_READ = { resource: "customer", action: "read" }

export default async function MyWorkRoute() {
  const session = await getCurrentNexusSession()
  const appUserId = session.status === "active" ? session.appUserId : null

  let items: MyWorkItem[] = []
  let unavailable = false
  if (appUserId) {
    try {
      // Same imprecision already accepted for commercial_configuration.approve
      // (Commercial Version's own approval permission, folded in here rather
      // than given its own flag): "pending my approval" is an approximation
      // across every request type until per-type routing exists.
      const [canApproveCustomer, canApproveGoLive] = await Promise.all([hasPermission("customer", "approve"), hasPermission("go_live", "approve")])
      items = await loadMyWork(appUserId, canApproveCustomer || canApproveGoLive)
    } catch {
      unavailable = true
    }
  }

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo="/my-work">
      {unavailable ? (
        <div className="flex flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
            <div className="flex items-start gap-2 rounded-md border border-dashed px-4 py-4">
              <p className="text-xs text-muted-foreground">My Work could not be read right now. Try reloading the page.</p>
            </div>
          </div>
        </div>
      ) : (
        <MyWorkPage items={items} />
      )}
    </AuthGate>
  )
}
