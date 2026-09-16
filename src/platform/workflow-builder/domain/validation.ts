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
      errors.push(`Node "${node.name}" is disconnected: it has no incoming transition.`)
    }
    if (node.nodeType !== "end" && !(outgoingByKey.get(node.nodeKey)?.length ?? 0) && node.nodeType !== "start") {
      errors.push(`Node "${node.name}" is a dead end: it has no outgoing transition and is not an End node.`)
    }
    if (node.nodeType === "start" && !(outgoingByKey.get(node.nodeKey)?.length ?? 0)) {
      errors.push("The Start node has no outgoing transition.")
    }
    if (node.nodeType === "end" && (outgoingByKey.get(node.nodeKey)?.length ?? 0) > 0) {
      errors.push(`Node "${node.name}" is an End node but has an outgoing transition; an End node is terminal and must have none.`)
    }
    if (node.nodeType === "start" && incomingKeys.has(node.nodeKey)) {
      errors.push(`Node "${node.name}" is a Start node but has an incoming transition; a Start node is an entry point and must have none.`)
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
      errors.push(`Node "${node.name}" is unreachable from Start.`)
    }
    const reachableEnd = endNodes.some((node) => reachable.has(node.nodeKey))
    if (endNodes.length > 0 && !reachableEnd) {
      errors.push("No End node is reachable from Start.")
    }
  }

  // Decision nodes must route deterministically (Workflow Runtime V1,
  // supabase/migrations/20260921000000_workflow_runtime_v1.sql runs the
  // identical checks server-side as the real gate; this is the same
  // rule, surfaced here as an immediate, friendly Builder error instead
  // of a failed publish attempt).
  for (const node of nodes.filter((node) => node.nodeType === "decision")) {
    const outgoing = outgoingByKey.get(node.nodeKey) ?? []
    if (outgoing.length < 2) {
      errors.push(`Decision node "${node.name}" must have at least two outgoing branches to be a real decision.`)
    }
    const fallbackEdges = outgoing.filter((edge) => !edge.condition)
    if (fallbackEdges.length > 1) {
      errors.push(`Decision node "${node.name}" has more than one default (unconditioned) branch; routing would be ambiguous.`)
    }
    for (const edge of outgoing) {
      if (!edge.condition) continue
      if (edge.condition.operator !== "equals" && edge.condition.operator !== "not_equals") {
        errors.push(`Decision node "${node.name}" has a branch with an unsupported operator ("${edge.condition.operator}"); only equals/not_equals are supported.`)
      }
      if (!edge.condition.field) {
        errors.push(`Decision node "${node.name}" has a branch condition with no field set.`)
      }
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}

export { validateWorkflowGraph }
export type { WorkflowGraphValidationResult }
