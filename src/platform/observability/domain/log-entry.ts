import type { NexusErrorCode } from "../../errors"

/**
 * Pure log-line shaping (Platform Scale Program, Phase A), kept out of
 * `../server.ts` (which carries the `server-only` guard) so this stays
 * directly unit-testable without a server context, matching the pattern
 * every feature's own domain/service split already follows.
 */

type LogStatus = "success" | "failure"

type OperationLogInput = {
  eventCode: string
  operation: string
  resourceType?: string
  resourceId?: string
  correlationId?: string
  actorUserId?: string | null
  status: LogStatus
  durationMs?: number
  errorCode?: NexusErrorCode
}

type OperationLogLine = OperationLogInput & { occurredAt: string }

/** Builds the exact JSON-serializable shape a log line writes, given an explicit `now` (never `new Date()` internally) so this stays deterministic and testable. */
function buildOperationLogLine(entry: OperationLogInput, now: Date): OperationLogLine {
  return { ...entry, occurredAt: now.toISOString() }
}

/** A per-operation correlation id, safe to return to a user in an error message ("Reference: NX-...") and to match against a structured log line. Takes an explicit random source so it stays deterministic and testable; callers use `crypto.randomUUID` in practice. */
function buildCorrelationId(randomUuid: string): string {
  return `NX-${randomUuid.replace(/-/g, "").slice(0, 8).toUpperCase()}`
}

export { buildOperationLogLine, buildCorrelationId }
export type { OperationLogInput, OperationLogLine, LogStatus }
