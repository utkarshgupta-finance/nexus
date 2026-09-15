import { notFound } from "next/navigation"
import type { Edge } from "@xyflow/react"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { loadWorkflowGraph } from "@/platform/workflow-builder/server"
import { listActiveTeams } from "@/platform/team/server"
import { WorkflowCanvasEditor } from "@/platform/workflow-builder/ui/workflow-canvas-editor"
import type { FlowNode } from "@/platform/workflow-builder/ui/workflow-canvas-editor"

export const dynamic = "force-dynamic"

const WORKFLOW_READ = { resource: "workflow_definition", action: "read" }

export default async function WorkflowCanvasRoute({
  params,
}: {
  params: Promise<{ definitionId: string; versionId: string }>
}) {
  const { definitionId, versionId } = await params
  const session = await getCurrentNexusSession()

  const [graph, teams] = await Promise.all([loadWorkflowGraph(versionId), listActiveTeams()])
  if (!graph) notFound()

  const initialNodes: FlowNode[] = graph.nodes.map((node) => ({
    id: node.nodeKey,
    position: { x: node.positionX, y: node.positionY },
    data: {
      label: node.name,
      nodeType: node.nodeType,
      responsibleTeamId: node.responsibleTeamId,
      requiredResource: node.requiredResource,
      requiredAction: node.requiredAction,
      requiredFields: node.config.requiredFields ?? [],
    },
  }))

  const initialEdges: Edge[] = graph.edges.map((edge) => ({
    id: `${edge.fromNodeKey}->${edge.toNodeKey}`,
    source: edge.fromNodeKey,
    target: edge.toNodeKey,
    label: edge.label ?? undefined,
    data: { condition: edge.condition },
  }))

  const isReadOnly = graph.version.status === "published"

  return (
    <AuthGate session={session} requiredPermission={WORKFLOW_READ} loginRedirectTo={`/settings/workflows/${definitionId}/versions/${versionId}`}>
      <WorkflowCanvasEditor version={graph.version} initialNodes={initialNodes} initialEdges={initialEdges} teams={teams} isReadOnly={isReadOnly} />
    </AuthGate>
  )
}
