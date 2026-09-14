"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { withCorrelationReference } from "@/platform/errors"
import { GoLiveOperationError } from "./domain/go-live-errors"
import {
  createGoLiveRequest,
  saveGoLiveRequestDraft,
  submitGoLiveRequest,
  sendBackGoLiveRequest,
  approveGoLiveRequest,
  cancelGoLiveRequest,
  setGoLiveCustomerConfirmation,
} from "./services/go-live.service"
import { uploadGoLiveDocument, getGoLiveDocumentDownloadUrl } from "./services/documents.service"
import type { GoLiveRequest, GoLiveDocumentType, PersistedGoLiveDocumentMetadata } from "./domain/types"
import type { CreateGoLiveRequestInput } from "./data/go-live.data"
import type { DocumentUploadInput } from "./services/documents.service"

/**
 * Real, database-backed Go Live Server Actions. Each derives the
 * authenticated actor server-side via `requirePermission`, never
 * accepts a client-supplied actor id. `go_live.create` gates the
 * maker-side actions (create/save/submit/confirmation/attachments,
 * since preparing a Go Live request is a creation activity, matching
 * Customer Onboarding's own `customer.create` convention);
 * `go_live.approve` gates the checker-side actions (send back/approve),
 * a fixed, hardcoded permission never redirected by workflow graph
 * configuration (see platform/workflow-builder/domain/runtime.ts).
 */

type GoLiveActionResult = { ok: true; request: GoLiveRequest } | { ok: false; error: string }

function toGoLiveActionError(error: unknown): { ok: false; error: string } {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof GoLiveOperationError && error.goLiveError.kind === "unknown") {
    return { ok: false, error: withCorrelationReference(error.message, error) }
  }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: "An unexpected error occurred while updating this Go Live request." }
}

async function createGoLiveRequestAction(input: Omit<CreateGoLiveRequestInput, "id" | "actorUserId">): Promise<GoLiveActionResult> {
  try {
    const actor = await requirePermission("go_live", "create")
    const request = await createGoLiveRequest({ ...input, id: crypto.randomUUID(), actorUserId: actor.appUserId })
    return { ok: true, request }
  } catch (error) {
    return toGoLiveActionError(error)
  }
}

async function saveGoLiveRequestDraftAction(id: string, goLiveDate: string, prorateFirstMonth: boolean, comment: string | null): Promise<GoLiveActionResult> {
  try {
    const actor = await requirePermission("go_live", "create")
    const request = await saveGoLiveRequestDraft({ id, goLiveDate, prorateFirstMonth, comment, actorUserId: actor.appUserId })
    return { ok: true, request }
  } catch (error) {
    return toGoLiveActionError(error)
  }
}

async function submitGoLiveRequestAction(id: string): Promise<GoLiveActionResult> {
  try {
    const actor = await requirePermission("go_live", "submit")
    const request = await submitGoLiveRequest(id, actor.appUserId)
    return { ok: true, request }
  } catch (error) {
    return toGoLiveActionError(error)
  }
}

async function sendBackGoLiveRequestAction(id: string, reason: string): Promise<GoLiveActionResult> {
  try {
    const actor = await requirePermission("go_live", "approve")
    const request = await sendBackGoLiveRequest(id, reason, actor.appUserId)
    return { ok: true, request }
  } catch (error) {
    return toGoLiveActionError(error)
  }
}

async function approveGoLiveRequestAction(id: string): Promise<GoLiveActionResult> {
  try {
    const actor = await requirePermission("go_live", "approve")
    const request = await approveGoLiveRequest(id, actor.appUserId)
    return { ok: true, request }
  } catch (error) {
    return toGoLiveActionError(error)
  }
}

async function cancelGoLiveRequestAction(id: string, reason: string | null): Promise<GoLiveActionResult> {
  try {
    const actor = await requirePermission("go_live", "create")
    const request = await cancelGoLiveRequest(id, reason, actor.appUserId)
    return { ok: true, request }
  } catch (error) {
    return toGoLiveActionError(error)
  }
}

async function setGoLiveCustomerConfirmationAction(id: string, confirmed: boolean): Promise<GoLiveActionResult> {
  try {
    const actor = await requirePermission("go_live", "create")
    const request = await setGoLiveCustomerConfirmation(id, confirmed, actor.appUserId)
    return { ok: true, request }
  } catch (error) {
    return toGoLiveActionError(error)
  }
}

type UploadGoLiveDocumentActionResult = { ok: true; document: PersistedGoLiveDocumentMetadata } | { ok: false; error: string }

async function uploadGoLiveDocumentAction(
  goLiveRequestId: string,
  documentType: GoLiveDocumentType,
  file: DocumentUploadInput
): Promise<UploadGoLiveDocumentActionResult> {
  try {
    const actor = await requirePermission("go_live", "create")
    const document = await uploadGoLiveDocument({ goLiveRequestId, documentType, file, actorUserId: actor.appUserId })
    return { ok: true, document }
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message }
    if (error instanceof Error) return { ok: false, error: error.message }
    return { ok: false, error: "An unexpected error occurred while uploading this document." }
  }
}

async function getGoLiveDocumentDownloadUrlAction(documentId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    await requirePermission("go_live", "read")
    const url = await getGoLiveDocumentDownloadUrl(documentId)
    if (!url) return { ok: false, error: "This document could not be found." }
    return { ok: true, url }
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message }
    return { ok: false, error: "An unexpected error occurred while preparing this download." }
  }
}

export {
  createGoLiveRequestAction,
  saveGoLiveRequestDraftAction,
  submitGoLiveRequestAction,
  sendBackGoLiveRequestAction,
  approveGoLiveRequestAction,
  cancelGoLiveRequestAction,
  setGoLiveCustomerConfirmationAction,
  uploadGoLiveDocumentAction,
  getGoLiveDocumentDownloadUrlAction,
}
export type { GoLiveActionResult, UploadGoLiveDocumentActionResult }
