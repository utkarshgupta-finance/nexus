/**
 * Hand-authored row shapes for the Commercial tables/RPC return rows,
 * matching the applied migrations exactly:
 *   supabase/migrations/20260908210000_commercial_configuration_foundation.sql
 *   supabase/migrations/20260910100000_commercial_usage_earned_foundation.sql
 *   supabase/migrations/20260910110000_commercial_billing_invoice_reconciliation_foundation.sql
 *
 * This repo has no generated `supabase gen types` output yet (no
 * Supabase CLI run has been part of any session that built this app
 * layer). These types exist so the data/ layer has something precise to
 * work against in the meantime; regenerate and replace this file with
 * the real generated types the first time a workflow runs
 * `supabase gen types typescript`, and delete this file once that
 * exists.
 *
 * Internal to features/commercial/data/ only. Nothing outside data/
 * should import from this file; see domain/types.ts and
 * domain/mappers.ts for the shapes the rest of the app is allowed to see.
 */

type CommercialConfigurationRow = {
  id: string
  customer_id: string
  key: string
  name: string
  relationship_note: string | null
  is_active: boolean
  commercial_change_id: string
  row_version: number
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

type CommercialChangeRow = {
  request_id: string
  commercial_configuration_id: string
  change_category: "initial_setup" | "renewal" | "amendment" | "correction" | "other"
  effective_date: string
  reason: string | null
  created_at: string
  created_by: string | null
}

type MeasurementDefinitionRow = {
  id: string
  key: string
  name: string
  unit: string
  business_definition: string
  counting_rule: string
  period_basis: string
  dimension_keys: string[]
  expected_source: string | null
  status: "active" | "deprecated"
}

type CommercialComponentRow = {
  id: string
  commercial_configuration_id: string
  commercial_change_id: string
  supersedes_component_id: string | null
  measurement_definition_id: string | null
  is_recurring: boolean
  pricing_rule_kind: "linear" | "graduated" | "volume" | "dimension" | "flat"
  pricing_rule_parameters: Record<string, unknown>
  billing_cadence: "monthly" | "quarterly" | "half_yearly" | "annual" | "one_time"
  billing_timing: "advance" | "arrears"
  billing_quantity_basis: "mug" | "previous_period_actual" | "fixed" | null
  reconciliation_cadence: "monthly" | "quarterly" | "half_yearly" | "annual" | "one_time"
  transaction_currency: string
  /** Null only when transaction_currency = 'INR'. See chk_commercial_components_fx_snapshot_shape. */
  fx_snapshot_rate: number | null
  effective_from: string
  effective_to: string | null
}

type CommercialCommitmentRow = {
  id: string
  commercial_change_id: string
  commercial_component_id: string | null
  kind: "quantity" | "spend"
  threshold_value: number
  currency: string | null
  period: "monthly" | "quarterly" | "half_yearly" | "annual"
  effective_from: string
  effective_to: string | null
}

/**
 * Many-to-many membership, spend commitments only: which Component(s) a
 * kind = 'spend' commercial_commitments row applies to. A kind =
 * 'quantity' commitment never has a row here; it resolves its one
 * Component through commercial_commitments.commercial_component_id
 * directly instead.
 */
type CommercialCommitmentComponentRow = {
  commitment_id: string
  component_id: string
}

type UsageFactRow = {
  id: string
  commercial_configuration_id: string
  measurement_definition_id: string
  period_start: string
  period_end: string
  quantity: number
  dimensions: Record<string, unknown> | null
  source_type: "manual_entry" | "file_import" | "internal_tool" | "external_feed"
  source_system: string | null
  source_reference: string | null
  source_event_key: string | null
  evidence_reference: string | null
  origin: "source" | "correction" | "finance_override"
  supersedes_usage_fact_id: string | null
  override_reason: string | null
  override_approved_by: string | null
  created_at: string
  created_by: string
}

type EarnedResultRow = {
  id: string
  commercial_component_id: string
  period_start: string
  period_end: string
  measurement_definition_id: string | null
  commercial_commitment_id: string | null
  result_version: number
  supersedes_earned_result_id: string | null
  raw_quantity: number | null
  calculated_quantity: number | null
  calculated_amount: number
  transaction_currency: string
  pricing_calculation_version: string
  rounding_policy_version: string
  status: "open" | "final"
  finalized_at: string | null
  finalized_by: string | null
  created_at: string
}

type BillingCalculationRow = {
  id: string
  commercial_component_id: string
  billing_period_start: string
  billing_period_end: string
  billing_quantity_basis_used: "mug" | "previous_period_actual" | "period_actual" | "fixed"
  basis_quantity: number | null
  source_earned_result_id: string | null
  source_commercial_commitment_id: string | null
  pricing_calculation_version: string
  rounding_policy_version: string
  calculated_amount: number
  transaction_currency: string
  created_at: string
}

type InvoiceEligibilityEventRow = {
  id: string
  billing_calculation_id: string
  eligible: boolean
  reason: string
  decided_by: string | null
  created_at: string
}

type InvoiceEvidenceRow = {
  id: string
  evidence_kind: "invoice" | "credit_note"
  external_reference: string | null
  external_date: string | null
  amount: number
  currency: string
  source_system: string | null
  created_at: string
}

type InvoiceEvidenceItemRow = {
  id: string
  invoice_evidence_id: string
  billing_calculation_id: string | null
  reconciliation_adjustment_id: string | null
  allocated_amount: number
  created_at: string
}

type ReconciliationAdjustmentRow = {
  resource_id: string
  commercial_component_id: string
  window_start: string
  window_end: string
  earned_amount: number | null
  billed_amount: number | null
  direction: "additional_billing" | "credit_note"
  monetary_difference: number
  transaction_currency: string
  reason: string
  quantity_explanation: Record<string, unknown> | null
  rate_provenance: Record<string, unknown>
  supersedes_adjustment_id: string | null
  status: "open" | "final"
  finalized_at: string | null
  finalized_by: string | null
  created_at: string
}

export type {
  CommercialConfigurationRow,
  CommercialChangeRow,
  MeasurementDefinitionRow,
  CommercialComponentRow,
  CommercialCommitmentRow,
  CommercialCommitmentComponentRow,
  UsageFactRow,
  EarnedResultRow,
  BillingCalculationRow,
  InvoiceEligibilityEventRow,
  InvoiceEvidenceRow,
  InvoiceEvidenceItemRow,
  ReconciliationAdjustmentRow,
}
