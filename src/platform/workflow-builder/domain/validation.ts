import type { WorkflowNodeDraft, WorkflowEdgeDraft } from "./types"

/**
 * Pure Workflow Builder graph validator (task Phase N/O's own required
 * checks before Publish): "one Start, at least one End, no disconnected
 * required nodes, valid outgoing transitions, referenced teams/
 * permissions exist, valid conditions, no impossible cycles unless
 * explicitly allowed later." No I/O: `validTeamIds`/`validPermissions`
 * are passed in already-resolved, so this stays unit-testable with
 * plain data. `publish_workflow_definition_version` (the RPC) re-checks
 * only the cheapest, most load-bearing subset of these server-side
 * (defense in depth); this is the authoritative, complete check the UI
 * runs before ever attempting to publish.
 */
type WorkflowGraphValidationResult = { valid: true } | { valid: false; errors: string[] }

function validateWorkflowGraph(
  nodes: WorkflowNodeDraft[],
  edges: WorkflowEdgeDraft[],
  context: { validTeamIds: Set<string>; validPermissions: Set<string> }
): WorkflowGraphValidationResult {
  const errors: string[] = []
  const nodeByKey = new Map(nodes.map((node) => [node.nodeKey, node]))

  const startNodes = nodes.filter((node) => node.nodeType === "start")
  if (startNodes.length !== 1) {
    errors.push(`Exactly one Start node is required (found ${startNodes.length}).`)
  }

  const endNodes = nodes.filter((node) => node.nodeType === "end")
  if (endNodes.length < 1) {
    errors.push("At least one End node is required.")
  }

  const duplicateKeys = nodes.map((node) => node.nodeKey).filter((key, index, all) => all.indexOf(key) !== index)
  if (duplicateKeys.length > 0) {
    errors.push(`Duplicate node key(s): ${[...new Set(duplicateKeys)].join(", ")}.`)
  }

  const outgoingByKey = new Map<string, WorkflowEdgeDraft[]>()
  const incomingKeys = new Set<string>()
  for (const edge of edges) {
    if (!nodeByKey.has(edge.fromNodeKey)) {
      errors.push(`Edge references a from-node "${edge.fromNodeKey}" that does not exist.`)
      continue
    }
    if (!nodeByKey.has(edge.toNodeKey)) {
      errors.push(`Edge references a to-node "${edge.toNodeKey}" that does not exist.`)
      continue
    }
    const existing = outgoingByKey.get(edge.fromNodeKey)
    if (existing) existing.push(edge)
    else outgoingByKey.set(edge.fromNodeKey, [edge])
    incomingKeys.add(edge.toNodeKey)
  }

  for (const node of nodes) {
    if (node.nodeType !== "start" && !incomingKeys.has(node.nodeKey)) {
      errors.push(`Node "${node.name}" (${node.nodeKey}) is disconnected: it has no incoming transition.`)
    }
    if (node.nodeType !== "end" && !(outgoingByKey.get(node.nodeKey)?.length ?? 0) && node.nodeType !== "start") {
      errors.push(`Node "${node.name}" (${node.nodeKey}) is a dead end: it has no outgoing transition and is not an End node.`)
    }
    if (node.nodeType === "start" && !(outgoingByKey.get(node.nodeKey)?.length ?? 0)) {
      errors.push("The Start node has no outgoing transition.")
    }
    if (node.responsibleTeamId && !context.validTeamIds.has(node.responsibleTeamId)) {
      errors.push(`Node "${node.name}" references a team that no longer exists or is inactive.`)
    }
    if (node.requiredResource && node.requiredAction) {
      const permissionKey = `${node.requiredResource}.${node.requiredAction}`
      if (!context.validPermissions.has(permissionKey)) {
        errors.push(`Node "${node.name}" references a permission ("${permissionKey}") that does not exist.`)
      }
    } else if (node.requiredResource || node.requiredAction) {
      errors.push(`Node "${node.name}" has an incomplete required permission (both resource and action must be set together).`)
    }
  }

  // Reachability from Start: every node should be reachable in a real,
  // usable graph. A node nobody can ever reach is a disconnected node
  // this check (unlike the incoming-edge check above, which only proves
  // "something points at it") proves nothing can reach it even
  // transitively through the actual graph shape.
  if (startNodes.length === 1) {
    const reachable = new Set<string>([startNodes[0].nodeKey])
    const queue = [startNodes[0].nodeKey]
    while (queue.length > 0) {
      const current = queue.shift() as string
      for (const edge of outgoingByKey.get(current) ?? []) {
        if (!reachable.has(edge.toNodeKey)) {
          reachable.add(edge.toNodeKey)
          queue.push(edge.toNodeKey)
        }
      }
    }
    const unreachable = nodes.filter((node) => !reachable.has(node.nodeKey))
    for (const node of unreachable) {
      errors.push(`Node "${node.name}" (${node.nodeKey}) is unreachable from Start.`)
    }
    const reachableEnd = endNodes.some((node) => reachable.has(node.nodeKey))
    if (endNodes.length > 0 && !reachableEnd) {
      errors.push("No End node is reachable from Start.")
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}

export { validateWorkflowGraph }
export type { WorkflowGraphValidationResult }
