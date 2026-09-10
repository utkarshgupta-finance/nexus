import * as reconciliationData from "../data/reconciliation.data"
import { toReconciliationAdjustment } from "../data/mappers"
import type { ReconciliationAdjustment } from "../domain/types"
import type { CreateReconciliationAdjustmentInput } from "../data/reconciliation.data"

/**
 * Application service for Reconciliation Adjustment (M10).
 *
 * Every write function takes `actorUserId` as its own explicit
 * parameter, never as a field inside the business-payload object; see
 * configuration.service.ts's own header comment for why.
 */

async function createReconciliationAdjustment(
  input: Omit<CreateReconciliationAdjustmentInput, "actorUserId">,
  actorUserId: string
): Promise<ReconciliationAdjustment> {
  const row = await reconciliationData.createReconciliationAdjustment({ ...input, actorUserId })
  return toReconciliationAdjustment(row)
}

async function finalizeReconciliationAdjustment(
  resourceId: string,
  actorUserId: string
): Promise<ReconciliationAdjustment> {
  const row = await reconciliationData.finalizeReconciliationAdjustment(resourceId, actorUserId)
  return toReconciliationAdjustment(row)
}

async function listReconciliationAdjustments(commercialComponentId: string): Promise<ReconciliationAdjustment[]> {
  const rows = await reconciliationData.listReconciliationAdjustmentsByComponentId(commercialComponentId)
  return rows.map(toReconciliationAdjustment)
}

async function listReconciliationAdjustmentsForComponents(
  commercialComponentIds: string[]
): Promise<ReconciliationAdjustment[]> {
  const rows = await reconciliationData.listReconciliationAdjustmentsByComponentIds(commercialComponentIds)
  return rows.map(toReconciliationAdjustment)
}

export {
  createReconciliationAdjustment,
  finalizeReconciliationAdjustment,
  listReconciliationAdjustments,
  listReconciliationAdjustmentsForComponents,
}
