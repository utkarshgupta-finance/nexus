"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react"
import type { Node, Edge, NodeChange, EdgeChange, Connection, NodeTypes } from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PendingButton } from "@/components/product/pending-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import { saveWorkflowVersionGraphAction, publishWorkflowVersionAction } from "../actions"
import type { WorkflowNodeType, WorkflowDefinitionVersion, WorkflowNodeDraft, WorkflowEdgeDraft } from "../domain/types"
import type { Team } from "@/platform/team/server"

/**
 * Workflow Builder canvas (task Phase N/O): React Flow owns canvas/node/
 * edge/selection/drag-drop/connection MECHANICS only, exactly as the
 * task spec requires. Nexus owns the semantic model: what a node saves
 * as (node_key/node_type/responsible_team/required_resource+action/
 * config), computed here and sent through `saveWorkflowVersionGraphAction`,
 * never React Flow's own internal representation persisted as-is.
 * `position_x`/`position_y` are the one piece of React Flow's own state
 * that IS persisted, deliberately, since canvas layout is genuinely
 * presentation state worth remembering between sessions.
 *
 * Restrained V1 (task spec): default node rendering, no custom node
 * components, no animation, no arbitrary scripting. A node's semantic
 * fields are edited in the right config panel, never inline on the
 * canvas itself.
 */

const NODE_TYPE_LABELS: Record<WorkflowNodeType, string> = {
  start: "Start",
  form_step: "Form Step",
  approval: "Approval",
  decision: "Decision",
  end: "End",
}

const NODE_TYPES_PALETTE: WorkflowNodeType[] = ["start", "form_step", "approval", "decision", "end"]

type NodeData = {
  label: string
  nodeType: WorkflowNodeType
  responsibleTeamId: string | null
  requiredResource: string | null
  requiredAction: string | null
  requiredFields: string[]
}

type FlowNode = Node<NodeData>

function nextNodeKey(existing: FlowNode[]): string {
  let index = existing.length + 1
  while (existing.some((node) => node.id === `node_${index}`)) index += 1
  return `node_${index}`
}

function WorkflowCanvasEditor({
  version,
  initialNodes,
  initialEdges,
  teams,
  isReadOnly,
}: {
  version: WorkflowDefinitionVersion
  initialNodes: FlowNode[]
  initialEdges: Edge[]
  teams: Team[]
  isReadOnly: boolean
}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null)

  const nodeTypes = useMemo<NodeTypes>(() => ({}), [])

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current))
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge({ ...connection, id: `${connection.source}->${connection.target}` }, current))
  }, [])

  function addNode(nodeType: WorkflowNodeType) {
    setNodes((current) => {
      const nodeKey = nextNodeKey(current)
      const newNode: FlowNode = {
        id: nodeKey,
        position: { x: 80 + current.length * 40, y: 80 + current.length * 30 },
        data: {
          label: NODE_TYPE_LABELS[nodeType],
          nodeType,
          responsibleTeamId: null,
          requiredResource: null,
          requiredAction: null,
          requiredFields: [],
        },
      }
      return [...current, newNode]
    })
  }

  function updateSelectedNodeData(patch: Partial<NodeData>) {
    setNodes((current) => current.map((node) => (node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node)))
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return
    setNodes((current) => current.filter((node) => node.id !== selectedNodeId))
    setEdges((current) => current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId))
    setSelectedNodeId(null)
  }

  function toDrafts(): { nodeDrafts: WorkflowNodeDraft[]; edgeDrafts: WorkflowEdgeDraft[] } {
    const nodeDrafts: WorkflowNodeDraft[] = nodes.map((node) => ({
      nodeKey: node.id,
      nodeType: node.data.nodeType,
      name: node.data.label,
      responsibleTeamId: node.data.responsibleTeamId,
      requiredResource: node.data.requiredResource,
      requiredAction: node.data.requiredAction,
      config: { requiredFields: node.data.requiredFields },
      positionX: node.position.x,
      positionY: node.position.y,
    }))
    const edgeDrafts: WorkflowEdgeDraft[] = edges.map((edge) => ({
      fromNodeKey: edge.source,
      toNodeKey: edge.target,
      label: typeof edge.label === "string" ? edge.label : null,
      condition: null,
    }))
    return { nodeDrafts, edgeDrafts }
  }

  async function handleSave() {
    setMessage(null)
    setIsSaving(true)
    const { nodeDrafts, edgeDrafts } = toDrafts()
    const result = await saveWorkflowVersionGraphAction(version.id, nodeDrafts, edgeDrafts)
    setIsSaving(false)
    if (result.ok) {
      setMessage({ kind: "success", text: "Draft saved." })
      router.refresh()
    } else {
      setMessage({ kind: "error", text: result.error })
    }
  }

  async function handlePublish() {
    setMessage(null)
    setIsPublishing(true)
    const { nodeDrafts, edgeDrafts } = toDrafts()
    const saveResult = await saveWorkflowVersionGraphAction(version.id, nodeDrafts, edgeDrafts)
    if (!saveResult.ok) {
      setIsPublishing(false)
      setMessage({ kind: "error", text: saveResult.error })
      return
    }
    const publishResult = await publishWorkflowVersionAction(version.id)
    setIsPublishing(false)
    if (publishResult.ok) {
      setMessage({ kind: "success", text: "Published. This version is now immutable." })
      router.refresh()
    } else {
      setMessage({ kind: "error", text: publishResult.error })
    }
  }

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={`Workflow Version ${version.versionNumber}`}
        description={isReadOnly ? "Published, read-only" : "Draft"}
        actions={
          isReadOnly ? (
            <Badge variant="ghost" className="bg-success/10 text-success">
              Published
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <PendingButton size="sm" variant="outline" pending={isSaving} pendingLabel="Saving..." onClick={handleSave}>
                Save Draft
              </PendingButton>
              <PendingButton size="sm" pending={isPublishing} pendingLabel="Publishing..." onClick={handlePublish}>
                Validate &amp; Publish
              </PendingButton>
            </div>
          )
        }
      />

      {message ? (
        <p className={`px-4 py-2 text-xs sm:px-6 ${message.kind === "error" ? "text-destructive" : "text-success"}`}>{message.text}</p>
      ) : null}

      {isMobile ? (
        <div className="mx-4 mt-2 flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border bg-card p-6 text-center sm:mx-6">
          <p className="text-sm font-medium text-foreground">This canvas works best on a larger screen</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Building and editing a workflow needs more room than a phone screen offers. Open this page on a tablet or desktop to
            add, connect, and configure nodes.
          </p>
        </div>
      ) : (
      <div className="flex flex-1 gap-3 px-4 pb-4 sm:px-6">
        {!isReadOnly ? (
          <div className="flex w-40 shrink-0 flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm">
            <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Add Node</span>
            {NODE_TYPES_PALETTE.map((nodeType) => (
              <Button key={nodeType} variant="outline" size="sm" onClick={() => addNode(nodeType)}>
                {NODE_TYPE_LABELS[nodeType]}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="min-h-[500px] flex-1 rounded-lg border">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={isReadOnly ? undefined : onNodesChange}
            onEdgesChange={isReadOnly ? undefined : onEdgesChange}
            onConnect={isReadOnly ? undefined : onConnect}
            nodesDraggable={!isReadOnly}
            nodesConnectable={!isReadOnly}
            elementsSelectable
            onNodeClick={(_event, node) => {
              setSelectedNodeId(node.id)
              setSelectedEdgeId(null)
            }}
            onEdgeClick={(_event, edge) => {
              setSelectedEdgeId(edge.id)
              setSelectedNodeId(null)
            }}
            onPaneClick={() => {
              setSelectedNodeId(null)
              setSelectedEdgeId(null)
            }}
            fitView
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap pannable={false} zoomable={false} />
          </ReactFlow>
        </div>

        {!isReadOnly && (selectedNode || selectedEdge) ? (
          <div className="flex w-64 shrink-0 flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm">
            {selectedNode ? (
              <>
                <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                  {NODE_TYPE_LABELS[selectedNode.data.nodeType]} Node
                </span>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="node-name">Name</label>
                  <Input id="node-name" value={selectedNode.data.label} onChange={(event) => updateSelectedNodeData({ label: event.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Responsible Team</label>
                  <Select
                    value={selectedNode.data.responsibleTeamId ?? ""}
                    onValueChange={(value) => updateSelectedNodeData({ responsibleTeamId: String(value) || null })}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="None">
                        {() => teams.find((team) => team.id === selectedNode.data.responsibleTeamId)?.name ?? "None"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="node-resource">Required Permission</label>
                  <div className="flex gap-1.5">
                    <Input
                      id="node-resource"
                      placeholder="resource"
                      className="w-1/2"
                      value={selectedNode.data.requiredResource ?? ""}
                      onChange={(event) => updateSelectedNodeData({ requiredResource: event.target.value || null })}
                    />
                    <Input
                      placeholder="action"
                      className="w-1/2"
                      value={selectedNode.data.requiredAction ?? ""}
                      onChange={(event) => updateSelectedNodeData({ requiredAction: event.target.value || null })}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="node-fields">Required Fields (comma-separated)</label>
                  <Input
                    id="node-fields"
                    value={selectedNode.data.requiredFields.join(", ")}
                    onChange={(event) =>
                      updateSelectedNodeData({ requiredFields: event.target.value.split(",").map((field) => field.trim()).filter(Boolean) })
                    }
                  />
                </div>
                <Button variant="outline" size="sm" className="text-destructive" onClick={deleteSelectedNode}>
                  Delete Node
                </Button>
              </>
            ) : null}
            {selectedEdge ? (
              <>
                <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Transition</span>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="edge-label">Label</label>
                  <Input
                    id="edge-label"
                    placeholder="e.g. Approve, Send Back, Reject"
                    value={typeof selectedEdge.label === "string" ? selectedEdge.label : ""}
                    onChange={(event) =>
                      setEdges((current) => current.map((edge) => (edge.id === selectedEdge.id ? { ...edge, label: event.target.value } : edge)))
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    setEdges((current) => current.filter((edge) => edge.id !== selectedEdge.id))
                    setSelectedEdgeId(null)
                  }}
                >
                  Delete Transition
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      )}
    </div>
  )
}

export { WorkflowCanvasEditor }
export type { FlowNode, NodeData }
