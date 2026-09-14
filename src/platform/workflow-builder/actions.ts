"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { createDefinition, createVersion, saveVersionGraph, publishVersion } from "./services/workflow-builder.service"
import type { WorkflowAppliesTo, WorkflowNodeDraft, WorkflowEdgeDraft, WorkflowDefinition, WorkflowDefinitionVersion } from "./domain/types"

/**
 * Real, database-backed Workflow Builder mutations (task Phase N/O).
 * Every action derives the authenticated actor server-side via
 * `requirePermission`, never accepts a client-supplied actor id.
 * `workflow_definition.write` gates draft-authoring actions (create/
 * save), matching every other domain's own create/write permission;
 * `workflow_definition.publish` is its own, separate permission (task
 * spec: publishing is the consequential, immutable-making action, not
 * just another edit).
 */

type CreateDefinitionResult = { ok: true; definition: WorkflowDefinition } | { ok: false; error: string }
type CreateVersionResult = { ok: true; version: WorkflowDefinitionVersion } | { ok: false; error: string }
type SaveGraphResult = { ok: true; version: WorkflowDefinitionVersion } | { ok: false; error: string }
type PublishResult = { ok: true; version: WorkflowDefinitionVersion } | { ok: false; error: string }

function toError(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: fallback }
}

async function createWorkflowDefinitionAction(code: string, name: string, appliesTo: WorkflowAppliesTo): Promise<CreateDefinitionResult> {
  try {
    const actor = await requirePermission("workflow_definition", "write")
    const definition = await createDefinition(code, name, appliesTo, actor.appUserId)
    return { ok: true, definition }
  } catch (error) {
    return toError(error, "An unexpected error occurred while creating this workflow.")
  }
}

async function createWorkflowVersionAction(definitionId: string): Promise<CreateVersionResult> {
  try {
    const actor = await requirePermission("workflow_definition", "write")
    const version = await createVersion(definitionId, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toError(error, "An unexpected error occurred while creating this workflow version.")
  }
}

async function saveWorkflowVersionGraphAction(versionId: string, nodes: WorkflowNodeDraft[], edges: WorkflowEdgeDraft[]): Promise<SaveGraphResult> {
  try {
    const actor = await requirePermission("workflow_definition", "write")
    const version = await saveVersionGraph(versionId, nodes, edges, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toError(error, "An unexpected error occurred while saving this workflow version.")
  }
}

async function publishWorkflowVersionAction(versionId: string): Promise<PublishResult> {
  try {
    const actor = await requirePermission("workflow_definition", "publish")
    const version = await publishVersion(versionId, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toError(error, "An unexpected error occurred while publishing this workflow version.")
  }
}

export { createWorkflowDefinitionAction, createWorkflowVersionAction, saveWorkflowVersionGraphAction, publishWorkflowVersionAction }
export type { CreateDefinitionResult, CreateVersionResult, SaveGraphResult, PublishResult }
