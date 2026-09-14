import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2Icon } from "lucide-react"

import { AuthGate } from "@/components/product/auth-gate"
import { PageHeader } from "@/components/product/page-header"
import { Button } from "@/components/ui/button"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { requirePermission } from "@/platform/permissions/server"
import { getCustomerByKey, loadCustomerDetailContext } from "@/features/customers/server"
import { createChangeRequest } from "@/features/customer-change/services/change-request.service"
import { createVersionFromActive } from "@/features/customer-onboarding/services/commercial-version.service"
import { formatChangeRequestId } from "@/features/customer-change"
import { formatCommercialVersionId } from "@/features/customer-onboarding/server"

/**
 * "Both" from the Change Customer picker (task Phase I): creates one
 * real Customer Change Request AND one real Commercial Configuration
 * Version draft, then lands here showing both as a coordinated pair.
 * There is deliberately no persisted "Change Initiative" parent record
 * linking them (task spec explicitly frames one as something to
 * "evaluate... if useful", not a requirement): backend truth stays
 * exactly as separated as the single-choice paths above, this page is
 * only the coordinating UI. Visiting this route always creates both
 * records, matching the same create-then-show shape every other bare
 * "new" route in this app already uses.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_CHANGE_REQUEST = { resource: "customer", action: "change_request" }

async function CreateBothAndShow({ customerKey }: { customerKey: string }) {
  const customer = await getCustomerByKey(customerKey)
  if (!customer) notFound()

  const context = await loadCustomerDetailContext(customer.id)
  const commercialConfigurationId = context.commercialConfigurations[0]?.id ?? null
  if (!commercialConfigurationId) notFound()

  const detailsActor = await requirePermission("customer", "change_request")
  const commercialsActor = await requirePermission("commercial_configuration", "write")

  const [changeRequest, version] = await Promise.all([
    createChangeRequest(customer.id, detailsActor.appUserId),
    createVersionFromActive(commercialConfigurationId, "amendment", commercialsActor.appUserId),
  ])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2.5">
        <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-success" />
        <p className="text-xs text-muted-foreground">
          Two separate governed changes were started for {customer.name}. Each has its own draft, review, and
          approval; approving one does not require the other to be approved.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">Customer Details Change</span>
            <span className="text-xs text-muted-foreground">{formatChangeRequestId(changeRequest.requestNumber)}, Draft</span>
          </div>
          <Button size="sm" render={<Link href={`/customers/${customerKey}/change-requests/${changeRequest.requestId}`} />}>
            Continue
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">Commercials Change</span>
            <span className="text-xs text-muted-foreground">{formatCommercialVersionId(version.versionNumber)}, Draft</span>
          </div>
          <Button size="sm" render={<Link href={`/commercials/${commercialConfigurationId}/versions/${version.requestId}`} />}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}

export default async function ChangeCustomerBothRoute({ params }: { params: Promise<{ customerKey: string }> }) {
  const { customerKey } = await params
  const session = await getCurrentNexusSession()

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_CHANGE_REQUEST} loginRedirectTo={`/customers/${customerKey}/change/new/both`}>
      <div className="flex flex-1 flex-col">
        <PageHeader title="Change Customer" description="Customer Details + Commercials" />
        <CreateBothAndShow customerKey={customerKey} />
      </div>
    </AuthGate>
  )
}
