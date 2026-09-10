/**
 * Nexus-owned Commercial domain types.
 *
 * These are application-facing shapes, not raw Supabase row types. UI code,
 * services, and read models should only ever see types from this file (or
 * from ./errors.ts), never a generated database row shape. Row shapes stay
 * inside features/commercial/data/, mapped into these types by
 * ./mappers.ts.
 *
 * Field names are camelCase Nexus conventions, independent of the
 * underlying snake_case column names, so a future column rename does not
 * ripple into UI code.
 *
 * Source of truth for every shape below: the applied migrations
 * (supabase/migrations/20260908210000_commercial_configuration_foundation.sql,
 * 20260910100000_commercial_usage_earned_foundation.sql,
 * 20260910110000_commercial_billing_invoice_reconciliation_foundation.sql),
 * cross-checked against docs/COMMERCIAL_DATABASE_DESIGN.md and the two
 * later migration design docs.
 */

// =============================================================================
// Id aliases
// =============================================================================
//
// Plain string aliases, not branded/nominal types: this codebase has no
// existing precedent for branded ids, and the extra type machinery is not
// justified yet by a bug class this feature has actually hit. Revisit if
// id mixups become a real problem.

type CommercialConfigurationId = string
type CommercialChangeId = string
type CommercialComponentId = string
type CommercialCommitmentId = string
type MeasurementDefinitionId = string
type UsageFactId = string
type EarnedResultId = string
type BillingCalculationId = string
type InvoiceEligibilityEventId = string
type InvoiceEvidenceId = string
type InvoiceEvidenceItemId = string
type ReconciliationAdjustmentId = string
type CustomerId = string
type AppUserId = string

// =============================================================================
// Shared enums
// =============================================================================

/** Both billing_cadence and reconciliation_cadence use this same shape. */
type BillingCadence = "monthly" | "quarterly" | "half_yearly" | "annual"

type BillingTiming = "advance" | "arrears"

/**
 * commercial_components.billing_quantity_basis (M8, locked): the
 * advance-only quantity basis a Component agrees to. Never populated for
 * an arrears Component. Distinct from BillingQuantityBasisUsed below,
 * which is a runtime snapshot on one Billing Calculation, not this
 * Component-level policy.
 */
type BillingQuantityBasis = "mug" | "previous_period_actual" | "fixed"

/**
 * billing_calculations.billing_quantity_basis_used (M10): the basis
 * actually used for one specific calculation. Adds 'period_actual' (M10)
 * to the three M8 values, for arrears billing off the same period's own
 * Earned Result. Never mutate a Commercial Component's own
 * BillingQuantityBasis policy based on this value.
 */
type BillingQuantityBasisUsed = BillingQuantityBasis | "period_actual"

type PricingRuleKind = "linear" | "graduated" | "volume" | "dimension" | "flat"

type CommitmentKind = "quantity" | "spend"

type UsageFactSourceType = "manual_entry" | "file_import" | "internal_tool" | "external_feed"

type UsageFactOrigin = "source" | "correction" | "finance_override"

type EarnedResultStatus = "open" | "final"

type CommercialChangeCategory = "initial_setup" | "renewal" | "amendment" | "correction" | "other"

type InvoiceEvidenceKind = "invoice" | "credit_note"

type ReconciliationDirection = "additional_billing" | "credit_note"

type ReconciliationStatus = "open" | "final"

// =============================================================================
// Commercial Configuration and Commercial Change
//
// Distinct concepts, never collapsed: a Configuration is the stable
// anchor for one customer relationship; a Change is one approved event
// that altered it. A Configuration always has exactly one originating
// Change (initial_setup) and may have any number of later Changes.
// =============================================================================

type CommercialConfiguration = {
  id: CommercialConfigurationId
  customerId: CustomerId
  key: string
  name: string
  relationshipNote: string | null
  /** One-way: true -> false only. Not the same field as customers.is_active. */
  isActive: boolean
  originatingChangeId: CommercialChangeId
  createdAt: string
  updatedAt: string
}

type CommercialChange = {
  /** Also the underlying Request's id (1:1 extension), never a separate identity. */
  id: CommercialChangeId
  commercialConfigurationId: CommercialConfigurationId
  category: CommercialChangeCategory
  effectiveDate: string
  reason: string | null
  createdAt: string
  createdBy: AppUserId | null
}

// =============================================================================
// Measurement Definition
// =============================================================================

type MeasurementDefinition = {
  id: MeasurementDefinitionId
  key: string
  name: string
  unit: string
  businessDefinition: string
  countingRule: string
  periodBasis: string
  dimensionKeys: string[]
  expectedSource: string | null
  status: "active" | "deprecated"
}

// =============================================================================
// Commercial Component
// =============================================================================

type CommercialComponent = {
  id: CommercialComponentId
  commercialConfigurationId: CommercialConfigurationId
  commercialChangeId: CommercialChangeId
  /** Set when this Component's terms were later superseded by a new one. */
  supersedesComponentId: CommercialComponentId | null
  measurementDefinitionId: MeasurementDefinitionId | null
  isRecurring: boolean
  pricingRuleKind: PricingRuleKind
  pricingRuleParameters: Record<string, unknown>
  billingCadence: BillingCadence
  billingTiming: BillingTiming
  /** Null for an arrears Component; required for an advance one. */
  billingQuantityBasis: BillingQuantityBasis | null
  reconciliationCadence: BillingCadence
  transactionCurrency: string
  effectiveFrom: string
  /** Null while the Component remains open-ended. */
  effectiveTo: string | null
}

// =============================================================================
// Commercial Commitment
//
// A discriminated union, not one flat shape with nullable fields: the
// locked M8 shape CHECK (chk_commercial_commitments_kind_shape) makes
// quantity and spend genuinely different objects, not the same object
// with an optional field. A quantity commitment resolves to exactly one
// Component via a direct FK and is always monthly with no currency of
// its own. A spend commitment has no direct Component FK at all; its
// membership is a set, via commercial_commitment_components, preserved
// here as memberComponentIds, never flattened into separate
// single-Component objects. One spend commitment shared by several
// Components remains one CommercialCommitment value with several ids in
// memberComponentIds, not several CommercialCommitment values.
// =============================================================================

type CommercialCommitment =
  | {
      kind: "quantity"
      id: CommercialCommitmentId
      commercialChangeId: CommercialChangeId
      commercialComponentId: CommercialComponentId
      thresholdValue: number
      currency: null
      period: "monthly"
      effectiveFrom: string
      effectiveTo: string | null
    }
  | {
      kind: "spend"
      id: CommercialCommitmentId
      commercialChangeId: CommercialChangeId
      /** One or more Components this spend commitment covers, via commercial_commitment_components. Never empty for a correctly-formed row. */
      memberComponentIds: CommercialComponentId[]
      thresholdValue: number
      currency: string
      period: BillingCadence
      effectiveFrom: string
      effectiveTo: string | null
    }

// =============================================================================
// Usage Fact (M9)
// =============================================================================

type UsageFact = {
  id: UsageFactId
  commercialConfigurationId: CommercialConfigurationId
  measurementDefinitionId: MeasurementDefinitionId
  periodStart: string
  periodEnd: string
  quantity: number
  dimensions: Record<string, unknown> | null
  sourceType: UsageFactSourceType
  sourceSystem: string | null
  sourceReference: string | null
  sourceEventKey: string | null
  evidenceReference: string | null
  origin: UsageFactOrigin
  /** Set when this row corrects or overrides an earlier fact. The earlier fact is never edited or removed. */
  supersedesUsageFactId: UsageFactId | null
  overrideReason: string | null
  overrideApprovedBy: AppUserId | null
  createdAt: string
  createdBy: AppUserId
}

// =============================================================================
// Earned Result (M9)
//
// Earned truth, never Billed truth. A recalculation is always a new
// version, chained by supersedesEarnedResultId; the "current" version is
// derived, never stored, as the one version nothing else supersedes.
// =============================================================================

type EarnedResult = {
  id: EarnedResultId
  commercialComponentId: CommercialComponentId
  periodStart: string
  periodEnd: string
  /** Null for a non-usage (flat) Component. */
  measurementDefinitionId: MeasurementDefinitionId | null
  /** Populated only when a 'mug' quantity Commitment applied. */
  commercialCommitmentId: CommercialCommitmentId | null
  resultVersion: number
  supersedesEarnedResultId: EarnedResultId | null
  rawQuantity: number | null
  calculatedQuantity: number | null
  calculatedAmount: number
  transactionCurrency: string
  pricingCalculationVersion: string
  roundingPolicyVersion: string
  status: EarnedResultStatus
  finalizedAt: string | null
  finalizedBy: AppUserId | null
  createdAt: string
}

// =============================================================================
// Billing Calculation (M10)
//
// Billed truth, distinct from Earned truth and from Invoice Evidence.
// Immutable, insert-only, permanent, never versioned: a wrong calculation
// is corrected only through a Reconciliation Adjustment, never a
// replacement Billing Calculation row.
// =============================================================================

type BillingCalculation = {
  id: BillingCalculationId
  commercialComponentId: CommercialComponentId
  billingPeriodStart: string
  billingPeriodEnd: string
  billingQuantityBasisUsed: BillingQuantityBasisUsed
  /** Null only when billingQuantityBasisUsed = 'fixed'. */
  basisQuantity: number | null
  /** Populated only for 'previous_period_actual'/'period_actual'. */
  sourceEarnedResultId: EarnedResultId | null
  /** Populated only for 'mug'. */
  sourceCommercialCommitmentId: CommercialCommitmentId | null
  pricingCalculationVersion: string
  roundingPolicyVersion: string
  calculatedAmount: number
  transactionCurrency: string
  createdAt: string
}

// =============================================================================
// Invoice Eligibility Event (M10)
//
// Append-only decision log: answers "when did this become eligible or
// ineligible, and why," never "has this been invoiced." Current
// eligibility is always the latest event, a derived read, never a stored
// flag on BillingCalculation.
// =============================================================================

type InvoiceEligibilityEvent = {
  id: InvoiceEligibilityEventId
  billingCalculationId: BillingCalculationId
  eligible: boolean
  reason: string
  decidedBy: AppUserId | null
  createdAt: string
}

// =============================================================================
// Invoice Evidence (M10)
//
// A pure external-document header. Never the source of a calculation.
// Allocation to what it covers lives entirely in InvoiceEvidenceItem.
// =============================================================================

type InvoiceEvidence = {
  id: InvoiceEvidenceId
  evidenceKind: InvoiceEvidenceKind
  externalReference: string | null
  externalDate: string | null
  amount: number
  currency: string
  sourceSystem: string | null
  createdAt: string
}

// =============================================================================
// Invoice Evidence Item (M10)
//
// One allocation row: an Invoice Evidence header against exactly one of a
// Billing Calculation or a Reconciliation Adjustment, never both, never
// neither.
// =============================================================================

type InvoiceEvidenceItem = {
  id: InvoiceEvidenceItemId
  invoiceEvidenceId: InvoiceEvidenceId
  target:
    | { kind: "billing_calculation"; billingCalculationId: BillingCalculationId }
    | { kind: "reconciliation_adjustment"; reconciliationAdjustmentId: ReconciliationAdjustmentId }
  allocatedAmount: number
  createdAt: string
}

// =============================================================================
// Reconciliation Adjustment (M10)
//
// The explicit correction layer between Earned, Billing, and Invoice
// truth. Resource-backed. An aggregate comparison result for one
// Commercial Component and reconciliation window, never a singular
// source-row FK: a window may span more than one Billing Calculation or
// Earned Result. Multiple candidates may coexist for the same
// Component/window; nothing nets them.
// =============================================================================

type ReconciliationAdjustment = {
  /** Also the Resource Registry id ('reconciliation_adjustment'). */
  id: ReconciliationAdjustmentId
  commercialComponentId: CommercialComponentId
  windowStart: string
  windowEnd: string
  /** Populated together, only when a two-sided Earned-vs-Billed comparison applies. */
  earnedAmount: number | null
  billedAmount: number | null
  direction: ReconciliationDirection
  monetaryDifference: number
  transactionCurrency: string
  reason: string
  /** Populated only when a quantity/billing-basis comparison is meaningful. */
  quantityExplanation: Record<string, unknown> | null
  /** Always populated: the effective-rate/commercial-period evidence behind monetaryDifference. */
  rateProvenance: Record<string, unknown>
  /** Set when this row corrects an earlier candidate. The earlier row is never edited. */
  supersedesAdjustmentId: ReconciliationAdjustmentId | null
  status: ReconciliationStatus
  finalizedAt: string | null
  finalizedBy: AppUserId | null
  createdAt: string
}

export type {
  CommercialConfigurationId,
  CommercialChangeId,
  CommercialComponentId,
  CommercialCommitmentId,
  MeasurementDefinitionId,
  UsageFactId,
  EarnedResultId,
  BillingCalculationId,
  InvoiceEligibilityEventId,
  InvoiceEvidenceId,
  InvoiceEvidenceItemId,
  ReconciliationAdjustmentId,
  CustomerId,
  AppUserId,
  BillingCadence,
  BillingTiming,
  BillingQuantityBasis,
  BillingQuantityBasisUsed,
  PricingRuleKind,
  CommitmentKind,
  UsageFactSourceType,
  UsageFactOrigin,
  EarnedResultStatus,
  CommercialChangeCategory,
  InvoiceEvidenceKind,
  ReconciliationDirection,
  ReconciliationStatus,
  CommercialConfiguration,
  CommercialChange,
  MeasurementDefinition,
  CommercialComponent,
  CommercialCommitment,
  UsageFact,
  EarnedResult,
  BillingCalculation,
  InvoiceEligibilityEvent,
  InvoiceEvidence,
  InvoiceEvidenceItem,
  ReconciliationAdjustment,
}
