"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { createDefinition, setDefinitionActive, replaceActiveDefinition, createVersion, saveVersionGraph, publishVersion, discardVersion } from "./services/workflow-builder.service"
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
type SetDefinitionActiveResult = { ok: true; definition: WorkflowDefinition } | { ok: false; error: string }
type CreateVersionResult = { ok: true; version: WorkflowDefinitionVersion } | { ok: false; error: string }
type SaveGraphResult = { ok: true; version: WorkflowDefinitionVersion } | { ok: false; error: string; stale?: boolean }
type PublishResult = { ok: true; version: WorkflowDefinitionVersion } | { ok: false; error: string }
type DiscardResult = { ok: true } | { ok: false; error: string }

/** Strips a leading `SOME_TOKEN: ` prefix from a raised Postgres exception message (this module has no typed error-kind parser like every other domain's own `parse*Error`; this is the minimal equivalent so a raw internal token never leaks as the primary user-facing string). */
function stripErrorToken(message: string): string {
  const match = /^[A-Z][A-Z0-9_]*:\s*([\s\S]*)$/.exec(message)
  return match ? match[1] : message
}

/** Checks for a `message: string` shape rather than `instanceof Error`: the Postgrest error thrown by `supabase.rpc()` carries a real message but is not reliably `instanceof Error` across this app's server bundle, which previously made every real RPC error (including well-formed `SOME_TOKEN: ...` messages) fall through to the generic fallback text below. */
function hasStringMessage(error: unknown): error is { message: string } {
  return typeof error === "object" && error !== null && "message" in error && typeof (error as { message: unknown }).message === "string"
}

function toError(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (hasStringMessage(error)) return { ok: false, error: stripErrorToken(error.message) }
  return { ok: false, error: fallback }
}

/** Same as toError, but also flags WORKFLOW_VERSION_DRAFT_STALE so the Builder canvas can offer a Refresh control (Batch 1, K-010), matching the stale-refresh pattern already used on the four governed domains' review pages. */
function toSaveError(error: unknown, fallback: string): { ok: false; error: string; stale?: boolean } {
  if (hasStringMessage(error) && error.message.startsWith("WORKFLOW_VERSION_DRAFT_STALE")) {
    return { ok: false, error: stripErrorToken(error.message), stale: true }
  }
  return toError(error, fallback)
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

/** Task 3 (Workflow Runtime V1, active workflow uniqueness): plain activate/deactivate. Activating raises a named conflict (never silently picks one) if another workflow already holds this context's active slot; use replaceActiveWorkflowDefinitionAction for the one-click governed swap instead. */
async function setWorkflowDefinitionActiveAction(definitionId: string, isActive: boolean): Promise<SetDefinitionActiveResult> {
  try {
    const actor = await requirePermission("workflow_definition", "publish")
    const definition = await setDefinitionActive(definitionId, isActive, actor.appUserId)
    return { ok: true, definition }
  } catch (error) {
    return toError(error, "An unexpected error occurred while changing this workflow's active status.")
  }
}

/** The governed replacement path (task spec: "do not require database intervention"): deactivates whichever other workflow currently holds this context's active slot and activates this one, atomically. */
async function replaceActiveWorkflowDefinitionAction(newDefinitionId: string): Promise<SetDefinitionActiveResult> {
  try {
    const actor = await requirePermission("workflow_definition", "publish")
    const definition = await replaceActiveDefinition(newDefinitionId, actor.appUserId)
    return { ok: true, definition }
  } catch (error) {
    return toError(error, "An unexpected error occurred while activating this workflow.")
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

async function saveWorkflowVersionGraphAction(
  versionId: string,
  nodes: WorkflowNodeDraft[],
  edges: WorkflowEdgeDraft[],
  expectedRowVersion: number
): Promise<SaveGraphResult> {
  try {
    const actor = await requirePermission("workflow_definition", "write")
    const version = await saveVersionGraph(versionId, nodes, edges, expectedRowVersion, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toSaveError(error, "An unexpected error occurred while saving this workflow version.")
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

/** Discard is a write-permission action, not publish: it removes a draft rather than making anything immutable, matching create/save. */
async function discardWorkflowVersionAction(versionId: string): Promise<DiscardResult> {
  try {
    const actor = await requirePermission("workflow_definition", "write")
    await discardVersion(versionId, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toError(error, "An unexpected error occurred while discarding this workflow version.")
  }
}

export {
  createWorkflowDefinitionAction,
  setWorkflowDefinitionActiveAction,
  replaceActiveWorkflowDefinitionAction,
  createWorkflowVersionAction,
  saveWorkflowVersionGraphAction,
  publishWorkflowVersionAction,
  discardWorkflowVersionAction,
}
export type { CreateDefinitionResult, SetDefinitionActiveResult, CreateVersionResult, SaveGraphResult, PublishResult, DiscardResult }
