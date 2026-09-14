import "server-only"

import { buildOperationLogLine, buildCorrelationId } from "./domain/log-entry"
import type { OperationLogInput, LogStatus } from "./domain/log-entry"
import type { NexusErrorCode } from "../errors"

/**
 * Minimal structured server logging (Platform Scale Program, Phase A).
 * Every meaningful operational log is one JSON line with a fixed,
 * narrow field set, never a free-form context bag: the shape itself
 * (`./domain/log-entry.ts`'s `OperationLogInput`) is what makes it
 * impossible to accidentally log a token, cookie, password, or service
 * key, since there is no field wide enough to hold one. Writes to
 * stdout/stderr, which Vercel already captures and makes searchable; a
 * persisted operational-event table is deliberately not built here
 * (docs/TECH_DEBT.md records the trigger for when it would be worth it).
 */

function logOperation(entry: OperationLogInput): void {
  const line = buildOperationLogLine(entry, new Date())
  const serialized = JSON.stringify(line)
  if (entry.status === "failure") {
    console.error(serialized)
  } else {
    console.log(serialized)
  }
}

function newCorrelationId(): string {
  return buildCorrelationId(crypto.randomUUID())
}

/**
 * Times an operation and logs exactly once, success or failure, with a
 * fresh correlation id unless the caller already has one (an API request
 * that wants its own id threaded through). Rethrows whatever the
 * operation threw, unchanged, so this never swallows or reshapes an
 * error; it only observes.
 */
async function withLoggedOperation<T>(
  entry: Omit<OperationLogInput, "status" | "durationMs" | "correlationId" | "errorCode">,
  operation: () => Promise<T>,
  correlationId: string = newCorrelationId()
): Promise<T> {
  const startedAt = performance.now()
  try {
    const result = await operation()
    logOperation({ ...entry, status: "success", durationMs: Math.round(performance.now() - startedAt), correlationId })
    return result
  } catch (error) {
    const errorCode = error instanceof Error && "code" in error ? (error as { code?: NexusErrorCode }).code : undefined
    logOperation({
      ...entry,
      status: "failure",
      durationMs: Math.round(performance.now() - startedAt),
      correlationId,
      errorCode,
    })
    // Platform Scale Closure, Phase T: the correlation id is otherwise
    // only ever visible in the server log; attaching it to the rethrown
    // error is what lets a Server Action surface "Reference: NX-..." back
    // to the user on an unexpected failure, so support can find the
    // matching log line without asking them to reproduce it.
    if (error instanceof Error) (error as Error & { correlationId?: string }).correlationId = correlationId
    throw error
  }
}

export { logOperation, newCorrelationId, withLoggedOperation }
export type { OperationLogInput, LogStatus }
