import Link from "next/link"
import { notFound } from "next/navigation"
import { FileTextIcon, LayersIcon, ReceiptIcon } from "lucide-react"

import { AuthGate } from "@/components/product/auth-gate"
import { PageHeader } from "@/components/product/page-header"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { getCustomerByKey, loadCustomerDetailContext } from "@/features/customers/server"

/**
 * "Change Customer" entry point (task Phase I: "from Customer, Change
 * Customer, then choose Customer Details / Commercials / Both").
 * Backend truth stays exactly as governed today: a Customer Details
 * change is still one Customer Change Request
 * (create_customer_change_request), a Commercials change is still one
 * Commercial Configuration Version draft
 * (create_commercial_configuration_version); this page only unifies the
 * DISCOVERY of those two existing, previously disconnected entry points
 * (`/customers/[customerKey]/change-requests/new`,
 * `/commercials/[configId]/versions/new`, the latter of which had no
 * link pointing to it anywhere in the app before this task) under one
 * "Change Customer" action, never merging the two governed records
 * themselves into one table or blob.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_READ = { resource: "customer", action: "read" }

async function ChangeCustomerChoices({ customerKey }: { customerKey: string }) {
  const customer = await getCustomerByKey(customerKey)
  if (!customer) notFound()

  const [context, canChangeDetails, canChangeCommercials] = await Promise.all([
    loadCustomerDetailContext(customer.id),
    hasPermission("customer", "change_request"),
    hasPermission("commercial_configuration", "write"),
  ])
  const commercialConfigurationId = context.commercialConfigurations[0]?.id ?? null

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-4 sm:px-6 sm:py-6">
      <p className="text-xs text-muted-foreground">What would you like to change for {customer.name}?</p>

      {canChangeDetails ? (
        <Link
          href={`/customers/${customerKey}/change-requests/new`}
          className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-foreground/30"
        >
          <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Customer Details</span>
            <span className="text-xs text-muted-foreground">
              Legal Entity Name, address, contact, tax identifiers, and every other governed Customer Master field.
              Creates a Customer Change Request.
            </span>
          </span>
        </Link>
      ) : null}

      {canChangeCommercials && commercialConfigurationId ? (
        <Link
          href={`/commercials/${commercialConfigurationId}/versions/new`}
          className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-foreground/30"
        >
          <ReceiptIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Commercials</span>
            <span className="text-xs text-muted-foreground">
              Pricing, billing cadence, and commercial components. Creates a new Commercial Configuration Version
              draft, seeded from what is currently active.
            </span>
          </span>
        </Link>
      ) : null}

      {canChangeDetails && canChangeCommercials && commercialConfigurationId ? (
        <Link
          href={`/customers/${customerKey}/change/new/both`}
          className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-foreground/30"
        >
          <LayersIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Both</span>
            <span className="text-xs text-muted-foreground">
              Start a Customer Details change and a Commercials change together. Each stays a separate governed
              record with its own review and approval.
            </span>
          </span>
        </Link>
      ) : null}

      {!canChangeDetails && !canChangeCommercials ? (
        <p className="text-xs text-muted-foreground">You do not have permission to change this customer.</p>
      ) : null}
      {canChangeCommercials && !commercialConfigurationId ? (
        <p className="text-xs text-muted-foreground">
          This customer has no Commercial Configuration yet, so a Commercials change is not available.
        </p>
      ) : null}
    </div>
  )
}

export default async function ChangeCustomerRoute({ params }: { params: Promise<{ customerKey: string }> }) {
  const { customerKey } = await params
  const session = await getCurrentNexusSession()

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo={`/customers/${customerKey}/change/new`}>
      <div className="flex flex-1 flex-col">
        <PageHeader title="Change Customer" description={customerKey} />
        <ChangeCustomerChoices customerKey={customerKey} />
      </div>
    </AuthGate>
  )
}
