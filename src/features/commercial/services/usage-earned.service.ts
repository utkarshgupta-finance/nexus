import * as usageEarnedData from "../data/usage-earned.data"
import { toEarnedResult, toUsageFact } from "../data/mappers"
import type { EarnedResult, UsageFact } from "../domain/types"
import type { CorrectUsageFactInput, RecordEarnedResultInput, RecordUsageFactInput } from "../data/usage-earned.data"

/**
 * Application service for Usage Fact and Earned Result (M9).
 *
 * Every write function takes `actorUserId` as its own explicit
 * parameter, never as a field inside the business-payload object; see
 * configuration.service.ts's own header comment for why.
 */

async function recordUsageFact(input: Omit<RecordUsageFactInput, "actorUserId">, actorUserId: string): Promise<UsageFact> {
  const row = await usageEarnedData.recordUsageFact({ ...input, actorUserId })
  return toUsageFact(row)
}

async function correctUsageFact(
  input: Omit<CorrectUsageFactInput, "actorUserId">,
  actorUserId: string
): Promise<UsageFact> {
  const row = await usageEarnedData.correctUsageFact({ ...input, actorUserId })
  return toUsageFact(row)
}

async function recordEarnedResult(
  input: Omit<RecordEarnedResultInput, "actorUserId">,
  actorUserId: string
): Promise<EarnedResult> {
  const row = await usageEarnedData.recordEarnedResult({ ...input, actorUserId })
  return toEarnedResult(row)
}

async function finalizeEarnedResult(earnedResultId: string, actorUserId: string): Promise<EarnedResult> {
  const row = await usageEarnedData.finalizeEarnedResult(earnedResultId, actorUserId)
  return toEarnedResult(row)
}

async function listUsageFacts(commercialConfigurationId: string): Promise<UsageFact[]> {
  const rows = await usageEarnedData.listUsageFactsByConfigurationId(commercialConfigurationId)
  return rows.map(toUsageFact)
}

async function listEarnedResults(commercialComponentId: string): Promise<EarnedResult[]> {
  const rows = await usageEarnedData.listEarnedResultsByComponentId(commercialComponentId)
  return rows.map(toEarnedResult)
}

async function listEarnedResultsForComponents(commercialComponentIds: string[]): Promise<EarnedResult[]> {
  const rows = await usageEarnedData.listEarnedResultsByComponentIds(commercialComponentIds)
  return rows.map(toEarnedResult)
}

export {
  recordUsageFact,
  correctUsageFact,
  recordEarnedResult,
  finalizeEarnedResult,
  listUsageFacts,
  listEarnedResults,
  listEarnedResultsForComponents,
}
