import { notFound, redirect } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { PageHeader } from "@/components/product/page-header"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { requirePermissionForCustomer, hasPermissionForCustomer } from "@/platform/permissions/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { createVersionFromActive, listVersionsForConfiguration } from "@/features/customer-onboarding/services/commercial-version.service"
import { CommercialVersionOperationError } from "@/features/customer-onboarding/domain/commercial-version-errors"

/**
 * "Create New Version" entry point (Customer Lifecycle V1, task
 * §10-13), mirroring /forms/customer-onboarding/page.tsx's own
 * create-then-redirect shape: visiting this bare route, once authorized,
 * always creates one real, persisted Commercial Configuration Version
 * whose draft is seeded from the configuration's current active
 * Components, and immediately redirects to its own stable URL.
 */
export const dynamic = "force-dynamic"

const COMMERCIAL_CONFIGURATION_WRITE = { resource: "commercial_configuration", action: "write" }

async function CreateAndRedirect({ configId }: { configId: string }) {
  const configuration = await commercialConfigurationService.getCommercialConfiguration(configId)
  if (!configuration) notFound()

  const actor = await requirePermissionForCustomer("commercial_configuration", "write", configuration.customerId)

  /**
   * Real defect found via live retest: visiting this bare route while a
   * draft/submitted Commercial Version already exists for this
   * configuration (the "Change Customer > Commercials" card always links
   * here regardless) used to crash with a raw duplicate-key error, a real
   * navigation dead end. At most one open version may exist per
   * configuration (uq_commercial_configuration_versions_one_open_per_config);
   * redirect straight to it instead, since that is exactly the record the
   * user needs to continue.
   */
  let redirectTarget: string
  try {
    const version = await createVersionFromActive(configId, "amendment", actor.appUserId)
    redirectTarget = `/commercials/${configId}/versions/${version.requestId}`
  } catch (error) {
    if (!(error instanceof CommercialVersionOperationError)) throw error

    if (error.commercialVersionError.kind === "commercial_version_already_open") {
      const versions = await listVersionsForConfiguration(configId)
      const openVersion = versions.find((existing) => existing.status === "draft" || existing.status === "submitted")
      if (!openVersion) throw error
      redirectTarget = `/commercials/${configId}/versions/${openVersion.requestId}`
      redirect(redirectTarget)
      return null
    }

    /**
     * PD-003 (Product Decision Closure, manual UX verification fix):
     * live-testing found this bare create-and-redirect route had no
     * catch for the real, working server-side block
     * (COMMERCIAL_VERSION_CUSTOMER_INACTIVE), so the honest RPC
     * rejection surfaced as a raw "This page couldn't load" crash
     * instead of an explained state, matching Customer Change's own
     * wording for the identical rule (`createChangeRequestAction`).
     */
    if (error.commercialVersionError.kind === "commercial_version_customer_inactive") {
      return (
        <div className="flex flex-1 flex-col">
          <PageHeader
            title="Customer is inactive"
            description="This customer is inactive. Reactivate the customer before creating a new Commercial Configuration Version."
          />
        </div>
      )
    }

    throw error
  }

  redirect(redirectTarget)
  return null
}

export default async function NewCommercialConfigurationVersionRoute({ params }: { params: Promise<{ configId: string }> }) {
  const { configId } = await params
  const session = await getCurrentNexusSession()

  // PD-005 follow-up (Product Decision Closure): scope the gate itself by
  // the configuration's customer, matching the scoped check CreateAndRedirect
  // now enforces before the actual mutation.
  const configuration = await commercialConfigurationService.getCommercialConfiguration(configId)
  const canAccessThisConfiguration = configuration
    ? await hasPermissionForCustomer("commercial_configuration", "write", configuration.customerId)
    : false

  return (
    <AuthGate
      session={session}
      requiredPermission={COMMERCIAL_CONFIGURATION_WRITE}
      loginRedirectTo={`/commercials/${configId}/versions/new`}
      additionalAccessGranted={canAccessThisConfiguration}
    >
      <CreateAndRedirect configId={configId} />
    </AuthGate>
  )
}
