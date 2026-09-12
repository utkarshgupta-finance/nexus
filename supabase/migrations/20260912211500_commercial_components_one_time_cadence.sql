-- Nexus: allow 'one_time' as a Commercial Component billing/reconciliation
-- cadence.
--
-- Closes the exact gap docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22 already
-- named: "Invoice Frequency: ...One-Time | BillingCadence plus a
-- one_time value it does not yet have | new value: billing_cadence's
-- CHECK constraint only accepts the four real cadences." A Non-Recurring
-- component (and an On-Demand component with no chosen Invoice Frequency)
-- has no genuine monthly/quarterly/half_yearly/annual cadence; storing
-- one of those four for a one-off charge would misrepresent it.
--
-- Widens the two Commercial-Component-specific CHECK constraints only
-- (commercial_components.billing_cadence, .reconciliation_cadence).
-- commercial_commitments.period is untouched: a commitment is never
-- "one_time" (quantity commitments are always monthly; spend commitments
-- use a real recurring cadence), so its CHECK constraint correctly keeps
-- only the original four values.
--
-- This file has not been applied to any database as of authoring.

alter table commercial_components drop constraint commercial_components_billing_cadence_check;
alter table commercial_components add constraint commercial_components_billing_cadence_check
  check (billing_cadence in ('monthly', 'quarterly', 'half_yearly', 'annual', 'one_time'));

alter table commercial_components drop constraint commercial_components_reconciliation_cadence_check;
alter table commercial_components add constraint commercial_components_reconciliation_cadence_check
  check (reconciliation_cadence in ('monthly', 'quarterly', 'half_yearly', 'annual', 'one_time'));

comment on column commercial_components.billing_cadence is
  'How often the customer is invoiced. One of the four real recurring cadences, or one_time '
  'for a Non-Recurring component (or an On-Demand component with no chosen Invoice Frequency), '
  'which has no genuine recurring cadence. See docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22.';
