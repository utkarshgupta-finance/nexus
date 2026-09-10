# Commercial Migration 9 Closeout

STATUS: CLOSED

## 1. Scope delivered

Migration 9 introduces the Usage and Earned foundation: three new tables,
`usage_facts`, `earned_results`, and `earned_result_usage_facts`.

Usage Facts record operational usage independently of pricing. Earned
Results record the commercial value earned from that usage, or from a
fixed commercial component that does not depend on usage at all. Lineage
preserves which Usage Facts supported each specific Earned Result
version, permanently.

Earned and Billed remain separate. Billing, invoice eligibility, invoice
evidence, collections, and reconciliation remain Migration 10, not
designed and not built here.

## 2. Key design outcomes

- Usage Facts are immutable once recorded.
- A correction to a Usage Fact is a new fact linked to the one it
  replaces, never an edit of the original.
- Ingestion idempotency is scoped by source system, so two different
  upstream systems can never collide on the same event identity.
- Earned Results are immutable and versioned: a recalculation produces a
  new version rather than altering history.
- Historical recalculation is supported without destroying any prior
  version.
- Exactly one current Earned version exists per Commercial Component and
  earning period at any time.
- Each Earned calculation uses a caller-supplied identity, so retrying
  the same calculation attempt is safe and does not create duplicates.
- The link between Usage Facts and the Earned Result they fed is
  permanent and never rewritten.
- Both usage-driven and fixed, non-usage commercial components are
  supported.
- Finalizing an Earned Result is a separate concept from a later version
  superseding it; one does not block the other.

## 3. Verification completed

- The migration was dry-run and applied successfully to the linked
  project.
- All 25 official Migration 9 runtime scenarios passed.
- Concurrency verification passed.
- Preservation verification passed.
- The rollback-bound test harness confirmed no durable test residue was
  left behind.
- The prior Migration 8 commercial foundation and its hardening remained
  intact throughout.

## 4. Repository state

Design commit: 0d3eed2

Implementation commit: 22cde57

Migration: `20260910100000_commercial_usage_earned_foundation.sql`

Runtime harness files remain gitignored and are not part of the
committed product surface.

## 5. Result

Commercial Migration 9 is CLOSED.

The Commercial foundation now includes:

- M8: Commercial Configuration
- M9: Usage + Earned

Next planned stage: M10: Billing + Invoice + Reconciliation.
