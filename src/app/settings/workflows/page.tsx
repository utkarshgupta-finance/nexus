import { AuthGate } from "@/components/product/auth-gate"
import { SettingsNav } from "@/components/product/settings-nav"
import type { SettingsNavItem } from "@/components/product/settings-nav"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { sessionHasPermission } from "@/platform/permissions"
import { listDefinitions, listVersionsForDefinition } from "@/platform/workflow-builder/server"
import { resolveActorLabels } from "@/platform/audit/server"
import { WorkflowDefinitionsPage } from "@/platform/workflow-builder/ui/workflow-definitions-page"
import type { DefinitionRow } from "@/platform/workflow-builder/ui/workflow-definitions-page"

/**
 * Workflows list (task Phase N/O): Name/Applies To/Version/Status/Last
 * Updated/Updated By. `dynamic = "force-dynamic"` matching every other
 * route reading live backend/session data in this app.
 */
export const dynamic = "force-dynamic"

const WORKFLOW_READ = { resource: "workflow_definition", action: "read" }

export default async function WorkflowsRoute() {
  const session = await getCurrentNexusSession()

  let rows: DefinitionRow[] = []
  let unavailable = false
  try {
    const definitions = await listDefinitions()
    const actorLabels = await resolveActorLabels(definitions.map((definition) => definition.updatedBy))
    rows = await Promise.all(
      definitions.map(async (definition) => {
        const versions = await listVersionsForDefinition(definition.id)
        const latest = versions[0] ?? null
        return {
          definition,
          latestVersionNumber: latest?.versionNumber ?? null,
          latestVersionStatus: latest?.status ?? null,
          hasPublishedVersion: versions.some((version) => version.status === "published"),
          updatedByLabel: definition.updatedBy ? (actorLabels.get(definition.updatedBy) ?? null) : null,
        }
      })
    )
  } catch {
    unavailable = true
  }

  const canWrite = await hasPermission("workflow_definition", "write")
  const canPublish = await hasPermission("workflow_definition", "publish")

  const navItems: SettingsNavItem[] = []
  if (sessionHasPermission(session, "reference_master", "read")) navItems.push({ href: "/settings/customer-onboarding", label: "Reference Master" })
  if (sessionHasPermission(session, "team", "read")) navItems.push({ href: "/settings/teams", label: "Team Master" })
  navItems.push({ href: "/settings/workflows", label: "Workflows" })
  if (sessionHasPermission(session, "user_access", "read")) navItems.push({ href: "/settings/user-access", label: "User Access" })

  return (
    <AuthGate session={session} requiredPermission={WORKFLOW_READ} loginRedirectTo="/settings/workflows">
      <SettingsNav items={navItems} />
      {unavailable ? (
        <div className="flex flex-1 flex-col">
          <p className="p-6 text-xs text-muted-foreground">Workflows could not be read right now. Please try again shortly.</p>
        </div>
      ) : (
        <WorkflowDefinitionsPage rows={rows} canWrite={canWrite} canPublish={canPublish} />
      )}
    </AuthGate>
  )
}
