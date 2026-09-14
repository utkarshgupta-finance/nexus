import "server-only"

import { NextResponse } from "next/server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import type { ActiveNexusUser } from "@/platform/auth"
import { ApplicationError, toApplicationErrorResponse, toUnexpectedErrorResponse } from "@/platform/errors"
import { newCorrelationId, logOperation } from "@/platform/observability/server"
import { codeForDenialReason, httpStatusForCode } from "./domain/status"

/**
 * Shared support for `/api/v1/*` route handlers (Platform Scale Program,
 * Phase B): same-session authorization (never a parallel permission
 * system, docs/AUTHORIZATION_MODEL.md §13), consistent error responses
 * (`{error: {code, message, correlationId}}`, never a raw stack or
 * Postgres detail), and exactly one structured log line per request.
 *
 * This is an internal, same-session API today: it authorizes through the
 * same Supabase Auth session cookie the UI already uses, not a machine
 * credential. External/machine authentication is deliberately not built
 * here; see docs/API_INTEGRATION_ARCHITECTURE.md §7 for the documented
 * future model. Building it now, just to make this API reachable from
 * outside a browser, would mean inventing an insecure credential scheme
 * with no real caller to validate it against.
 */

/** Enforces the same resource+action permission model as the UI. Throws ApplicationError (never AuthorizationError directly) so route handlers only ever need to catch one error type. */
async function requireApiPermission(resource: string, action: string, correlationId: string): Promise<ActiveNexusUser> {
  try {
    return await requirePermission(resource, action)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new ApplicationError(codeForDenialReason(error.reason), error.message, correlationId)
    }
    throw error
  }
}

function jsonError(error: ApplicationError): NextResponse {
  return NextResponse.json({ error: toApplicationErrorResponse(error) }, { status: httpStatusForCode(error.code) })
}

/**
 * Wraps a v1 route handler body: generates one correlation id for the
 * whole request, authorizes, logs exactly one success/failure line, and
 * ensures no error response ever leaks more than `{code, message,
 * correlationId}` regardless of what the handler itself threw.
 */
async function handleApiV1Request(
  routeLabel: string,
  handler: (correlationId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const correlationId = newCorrelationId()
  const startedAt = performance.now()
  try {
    const response = await handler(correlationId)
    logOperation({ eventCode: "api.request", operation: routeLabel, status: "success", correlationId, durationMs: Math.round(performance.now() - startedAt) })
    return response
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt)
    if (error instanceof ApplicationError) {
      logOperation({ eventCode: "api.request", operation: routeLabel, status: "failure", correlationId, durationMs, errorCode: error.code })
      return jsonError(error)
    }
    logOperation({ eventCode: "api.request", operation: routeLabel, status: "failure", correlationId, durationMs, errorCode: "UNEXPECTED" })
    return NextResponse.json({ error: toUnexpectedErrorResponse(correlationId) }, { status: 500 })
  }
}

export { requireApiPermission, handleApiV1Request, jsonError }
