import type {
  BillingCalculationRow,
  CommercialChangeRow,
  CommercialCommitmentRow,
  CommercialComponentRow,
  CommercialConfigurationRow,
  EarnedResultRow,
  InvoiceEligibilityEventRow,
  InvoiceEvidenceItemRow,
  InvoiceEvidenceRow,
  MeasurementDefinitionRow,
  ReconciliationAdjustmentRow,
  UsageFactRow,
} from "./row-types"
import type {
  BillingCalculation,
  CommercialChange,
  CommercialCommitment,
  CommercialComponent,
  CommercialConfiguration,
  EarnedResult,
  InvoiceEligibilityEvent,
  InvoiceEvidence,
  InvoiceEvidenceItem,
  MeasurementDefinition,
  ReconciliationAdjustment,
  UsageFact,
} from "../domain/types"

/**
 * Pure row -> domain mapping functions: the one place row shapes
 * (./row-types.ts) and domain shapes (../domain/types.ts) both need to
 * be visible, by design, as the translation boundary between them,
 * matching docs/PLATFORM_ARCHITECTURE.md's own framing ("Repositories...
 * translate between domain shapes and storage shapes"). Lives in data/,
 * not domain/, so that domain/ never has any reason to import
 * row-types.ts at all. No I/O, no Supabase dependency: every function
 * here is a plain data transform and should stay unit testable without a
 * database.
 */

function toCommercialConfiguration(row: CommercialConfigurationRow): CommercialConfiguration {
  return {
    id: row.id,
    customerId: row.customer_id,
    key: row.key,
    name: row.name,
    relationshipNote: row.relationship_note,
    isActive: row.is_active,
    originatingChangeId: row.commercial_change_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toCommercialChange(row: CommercialChangeRow): CommercialChange {
  return {
    id: row.request_id,
    commercialConfigurationId: row.commercial_configuration_id,
    category: row.change_category,
    effectiveDate: row.effective_date,
    reason: row.reason,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}

function toMeasurementDefinition(row: MeasurementDefinitionRow): MeasurementDefinition {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    unit: row.unit,
    businessDefinition: row.business_definition,
    countingRule: row.counting_rule,
    periodBasis: row.period_basis,
    dimensionKeys: row.dimension_keys,
    expectedSource: row.expected_source,
    status: row.status,
  }
}

function toCommercialComponent(row: CommercialComponentRow): CommercialComponent {
  return {
    id: row.id,
    commercialConfigurationId: row.commercial_configuration_id,
    commercialChangeId: row.commercial_change_id,
    supersedesComponentId: row.supersedes_component_id,
    measurementDefinitionId: row.measurement_definition_id,
    isRecurring: row.is_recurring,
    pricingRuleKind: row.pricing_rule_kind,
    pricingRuleParameters: row.pricing_rule_parameters,
    billingCadence: row.billing_cadence,
    billingTiming: row.billing_timing,
    billingQuantityBasis: row.billing_quantity_basis,
    reconciliationCadence: row.reconciliation_cadence,
    transactionCurrency: row.transaction_currency,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
  }
}

/**
 * Maps one commercial_commitments row to the CommercialCommitment
 * discriminated union. For kind = 'spend', `memberComponentIds` must be
 * supplied by the caller (resolved from commercial_commitment_components
 * separately, since a single commitment row does not carry its own
 * membership set); passing an empty array for a spend row is a caller
 * bug, not a valid "no members" state, and throws rather than silently
 * producing a spend commitment attached to nothing.
 */
function toCommercialCommitment(row: CommercialCommitmentRow, memberComponentIds: string[] = []): CommercialCommitment {
  if (row.kind === "quantity") {
    if (!row.commercial_component_id) {
      throw new Error(
        `commercial_commitments row ${row.id} has kind='quantity' but no commercial_component_id, violating chk_commercial_commitments_kind_shape.`
      )
    }
    return {
      kind: "quantity",
      id: row.id,
      commercialChangeId: row.commercial_change_id,
      commercialComponentId: row.commercial_component_id,
      thresholdValue: row.threshold_value,
      currency: null,
      period: "monthly",
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
    }
  }

  if (!row.currency) {
    throw new Error(
      `commercial_commitments row ${row.id} has kind='spend' but no currency, violating chk_commercial_commitments_kind_shape.`
    )
  }
  if (memberComponentIds.length === 0) {
    throw new Error(
      `commercial_commitments row ${row.id} has kind='spend' but no resolved commercial_commitment_components membership was supplied.`
    )
  }

  return {
    kind: "spend",
    id: row.id,
    commercialChangeId: row.commercial_change_id,
    memberComponentIds,
    thresholdValue: row.threshold_value,
    currency: row.currency,
    period: row.period,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
  }
}

function toUsageFact(row: UsageFactRow): UsageFact {
  return {
    id: row.id,
    commercialConfigurationId: row.commercial_configuration_id,
    measurementDefinitionId: row.measurement_definition_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    quantity: row.quantity,
    dimensions: row.dimensions,
    sourceType: row.source_type,
    sourceSystem: row.source_system,
    sourceReference: row.source_reference,
    sourceEventKey: row.source_event_key,
    evidenceReference: row.evidence_reference,
    origin: row.origin,
    supersedesUsageFactId: row.supersedes_usage_fact_id,
    overrideReason: row.override_reason,
    overrideApprovedBy: row.override_approved_by,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}

function toEarnedResult(row: EarnedResultRow): EarnedResult {
  return {
    id: row.id,
    commercialComponentId: row.commercial_component_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    measurementDefinitionId: row.measurement_definition_id,
    commercialCommitmentId: row.commercial_commitment_id,
    resultVersion: row.result_version,
    supersedesEarnedResultId: row.supersedes_earned_result_id,
    rawQuantity: row.raw_quantity,
    calculatedQuantity: row.calculated_quantity,
    calculatedAmount: row.calculated_amount,
    transactionCurrency: row.transaction_currency,
    pricingCalculationVersion: row.pricing_calculation_version,
    roundingPolicyVersion: row.rounding_policy_version,
    status: row.status,
    finalizedAt: row.finalized_at,
    finalizedBy: row.finalized_by,
    createdAt: row.created_at,
  }
}

function toBillingCalculation(row: BillingCalculationRow): BillingCalculation {
  return {
    id: row.id,
    commercialComponentId: row.commercial_component_id,
    billingPeriodStart: row.billing_period_start,
    billingPeriodEnd: row.billing_period_end,
    billingQuantityBasisUsed: row.billing_quantity_basis_used,
    basisQuantity: row.basis_quantity,
    sourceEarnedResultId: row.source_earned_result_id,
    sourceCommercialCommitmentId: row.source_commercial_commitment_id,
    pricingCalculationVersion: row.pricing_calculation_version,
    roundingPolicyVersion: row.rounding_policy_version,
    calculatedAmount: row.calculated_amount,
    transactionCurrency: row.transaction_currency,
    createdAt: row.created_at,
  }
}

function toInvoiceEligibilityEvent(row: InvoiceEligibilityEventRow): InvoiceEligibilityEvent {
  return {
    id: row.id,
    billingCalculationId: row.billing_calculation_id,
    eligible: row.eligible,
    reason: row.reason,
    decidedBy: row.decided_by,
    createdAt: row.created_at,
  }
}

function toInvoiceEvidence(row: InvoiceEvidenceRow): InvoiceEvidence {
  return {
    id: row.id,
    evidenceKind: row.evidence_kind,
    externalReference: row.external_reference,
    externalDate: row.external_date,
    amount: row.amount,
    currency: row.currency,
    sourceSystem: row.source_system,
    createdAt: row.created_at,
  }
}

/**
 * invoice_evidence_items enforces exactly one of billing_calculation_id /
 * reconciliation_adjustment_id at the database level
 * (chk_invoice_evidence_items_exactly_one_target). This throws rather
 * than silently picking one if that invariant is ever violated in a row
 * this mapper is asked to translate, since a caller receiving neither or
 * both would otherwise get a confusing, contract-violating domain object.
 */
function toInvoiceEvidenceItem(row: InvoiceEvidenceItemRow): InvoiceEvidenceItem {
  const target = row.billing_calculation_id
    ? { kind: "billing_calculation" as const, billingCalculationId: row.billing_calculation_id }
    : row.reconciliation_adjustment_id
      ? {
          kind: "reconciliation_adjustment" as const,
          reconciliationAdjustmentId: row.reconciliation_adjustment_id,
        }
      : null

  if (!target) {
    throw new Error(
      `invoice_evidence_items row ${row.id} has neither billing_calculation_id nor reconciliation_adjustment_id set, violating chk_invoice_evidence_items_exactly_one_target.`
    )
  }

  return {
    id: row.id,
    invoiceEvidenceId: row.invoice_evidence_id,
    target,
    allocatedAmount: row.allocated_amount,
    createdAt: row.created_at,
  }
}

function toReconciliationAdjustment(row: ReconciliationAdjustmentRow): ReconciliationAdjustment {
  return {
    id: row.resource_id,
    commercialComponentId: row.commercial_component_id,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    earnedAmount: row.earned_amount,
    billedAmount: row.billed_amount,
    direction: row.direction,
    monetaryDifference: row.monetary_difference,
    transactionCurrency: row.transaction_currency,
    reason: row.reason,
    quantityExplanation: row.quantity_explanation,
    rateProvenance: row.rate_provenance,
    supersedesAdjustmentId: row.supersedes_adjustment_id,
    status: row.status,
    finalizedAt: row.finalized_at,
    finalizedBy: row.finalized_by,
    createdAt: row.created_at,
  }
}

export {
  toCommercialConfiguration,
  toCommercialChange,
  toMeasurementDefinition,
  toCommercialComponent,
  toCommercialCommitment,
  toUsageFact,
  toEarnedResult,
  toBillingCalculation,
  toInvoiceEligibilityEvent,
  toInvoiceEvidence,
  toInvoiceEvidenceItem,
  toReconciliationAdjustment,
}
