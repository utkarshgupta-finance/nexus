import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { getDefinition, listVersionsForDefinition } from "@/platform/workflow-builder/server"
import { resolveActorLabels } from "@/platform/audit/server"
import { WorkflowVersionHistoryPage } from "@/platform/workflow-builder/ui/workflow-version-history-page"
import type { VersionRow } from "@/platform/workflow-builder/ui/workflow-version-history-page"

export const dynamic = "force-dynamic"

const WORKFLOW_READ = { resource: "workflow_definition", action: "read" }

export default async function WorkflowVersionHistoryRoute({ params }: { params: Promise<{ definitionId: string }> }) {
  const { definitionId } = await params
  const session = await getCurrentNexusSession()

  const definition = await getDefinition(definitionId)
  if (!definition) notFound()

  const versions = await listVersionsForDefinition(definitionId)
  const actorIds = versions.flatMap((version) => [version.publishedBy, version.updatedBy])
  const actorLabels = await resolveActorLabels(actorIds)

  const rows: VersionRow[] = versions.map((version) => ({
    version,
    publishedByLabel: version.publishedBy ? (actorLabels.get(version.publishedBy) ?? null) : null,
    updatedByLabel: version.updatedBy ? (actorLabels.get(version.updatedBy) ?? null) : null,
  }))

  const canWrite = await hasPermission("workflow_definition", "write")
  const hasDraft = versions.some((version) => version.status === "draft")

  return (
    <AuthGate session={session} requiredPermission={WORKFLOW_READ} loginRedirectTo={`/settings/workflows/${definitionId}`}>
      <WorkflowVersionHistoryPage definition={definition} rows={rows} canWrite={canWrite} hasDraft={hasDraft} />
    </AuthGate>
  )
}
