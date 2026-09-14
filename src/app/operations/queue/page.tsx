import { AuthGate } from "@/components/product/auth-gate"
import { PageHeader } from "@/components/product/page-header"
import { OperationalQueueTable } from "@/components/product/operational-queue-table"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { loadOperationalQueue } from "@/platform/approvals/server"
import type { OperationalQueueEntry } from "@/platform/approvals/domain/operational-queue"

/**
 * Operational queue (Platform Scale Closure, Phase L): "what is
 * currently pending, and with whom" across all three governed
 * lifecycles. Not a dashboard (no charts, no aggregation beyond the
 * plain list), a foundation a future SLA/dashboard feature can consume,
 * per the program's own instruction not to build that yet. Gated by the
 * same permission Approvals uses: Nexus has no dedicated manager role
 * yet, so this is not restricted beyond ordinary read access.
 *
 * `dynamic = "force-dynamic"`: reads live backend data, so it must
 * never be statically prerendered.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_READ = { resource: "customer", action: "read" }

export default async function OperationalQueueRoute() {
  const session = await getCurrentNexusSession()

  let entries: OperationalQueueEntry[] = []
  let unavailable = false
  try {
    entries = await loadOperationalQueue()
  } catch {
    unavailable = true
  }

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo="/operations/queue">
      <div className="flex flex-1 flex-col">
        <PageHeader
          title="Operational Queue"
          description="Every pending request across Customer Onboarding, Customer Change, and Commercial Versions: what type, how old, how many times sent back, and which role needs to act."
        />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
          {unavailable ? (
            <div className="flex items-start gap-2 rounded-md border border-dashed px-4 py-4">
              <p className="text-xs text-muted-foreground">Operational queue backend read is not available in this environment right now.</p>
            </div>
          ) : (
            <OperationalQueueTable entries={entries} />
          )}
        </div>
      </div>
    </AuthGate>
  )
}
