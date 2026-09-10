# Commercial Migration 10 Closeout

STATUS: M10 CLOSED

## 1. Migration

`supabase/migrations/20260910110000_commercial_billing_invoice_reconciliation_foundation.sql`

## 2. Scope

Migration 10 introduces the Billing, Invoice, and Reconciliation
foundation: five new tables.

- `billing_calculations`
- `invoice_eligibility_events`
- `invoice_evidence`
- `invoice_evidence_items`
- `reconciliation_adjustments`

## 3. Key permanent invariants

**Billing Calculations**

- One row per Commercial Component per billing cycle, database enforced.
- Immutable and insert only.
- No versioning and no supersession of any kind.
- A billing correction is never a new or edited Billing Calculation; it
  always goes through Reconciliation instead.

**Eligibility**

- Append only events.
- Current eligibility is always derived from the latest event.
- No mutable current-status flag exists anywhere.

**Invoice Evidence**

- A pure external document header.
- Allocation to what the evidence covers lives entirely in
  `invoice_evidence_items`.
- Supports partial invoicing and many-to-many allocation between
  invoices and Billing Calculations or Reconciliation Adjustments.
- Invoice Evidence is a record of external documents, not an invoicing
  or accounting engine.

**Reconciliation**

- Independent from billing cadence; a reconciliation window may span
  more than one billing cycle.
- Multiple adjustment candidates may coexist for the same Component and
  window. Nothing nets them together.
- Resource backed, with its own approval, task, and attachment surface.
- Lifecycle is open to final, one way only.
- A correction is a new adjustment that supersedes a prior one, never an
  edit of history.
- No singular Billing Calculation or Earned Result foreign key: a
  reconciliation window can span more than one of either, so provenance
  is carried as data on the adjustment itself, not a single source link.
- Quantity and rate provenance are retained on each adjustment, present
  only where a quantity comparison is meaningful.

## 4. Security and control posture

- Row Level Security enabled on every new table, with zero policies.
- Direct access from `anon` and `authenticated` roles is denied.
- All mutation goes through sanctioned RPCs; there is no other supported
  write path.
- Destructive privileges (truncate, direct update, direct delete on
  immutable evidence) are denied.
- Immutable financial evidence is protected at the database level, not
  by application convention alone.
- The Reconciliation lifecycle transition is audited.
- The existing Nexus Resource Registry is reused for Reconciliation
  Adjustments; no new identity mechanism was introduced.

## 5. Runtime verification

- 51 official runtime tests defined and executed.
- 51 passed, 0 failed, 0 missing, 0 skipped.
- 0 concurrency failures across all tested races.
- 0 preservation failures.
- The verification transaction rolled back as designed; no test data was
  committed.
- Verification artifact identity was confirmed stable across the run.
- No fixture or scratch residue remained after verification.

## 6. Preservation

- Commercial Migration 8 (Commercial Configuration) remained intact.
- Commercial Migration 9 (Usage and Earned) remained intact.
- All prior hardening migrations remained intact.

## 7. Remaining items (non-blocking)

Two items are intentionally deferred as future operational or product
decisions. Neither blocks the current foundation.

- Whether a reconciliation adjustment should ever span more than one
  Commercial Component in a single row.
- The exact vocabulary used for eligibility reasons.

## 8. Sequence status

Commercial Migration 8: Commercial Configuration Foundation. CLOSED.

Commercial Migration 9: Commercial Usage and Earned. CLOSED.

Commercial Migration 10: Commercial Billing, Invoice and Reconciliation.
CLOSED.

The Commercial database foundation now covers Configuration, Usage and
Earned, and Billing, Invoice, and Reconciliation.

This closes the current M8 through M10 foundation sequence. It does not
mean all future Commercial work is complete; further Commercial features
may still be designed and built on top of this foundation.
