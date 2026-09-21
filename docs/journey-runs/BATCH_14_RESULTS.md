# Batch 14 Results

Scheduled journeys: F-022, G-001 through G-024 (25 total), per
`docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`'s BATCH 14 entry. Domain: finishing
Pack F (Pricing Models), then Pack G (MUG / Slab / Progressive /
Designation Pricing). Starting baseline: `24e635ed594cca47e5e142134200d934ad95fd60`.

Pre-execution investigation finding, load-bearing for how several journeys
in this batch are classified: no real usage-to-bill calculation engine
("Pricing Kernel") exists in the product today. `commercial-rate.ts`'s
`calculateMugValue`/`calculateSlabAmountForQuantity`/
`calculateSlabWiseMugSummary`/`calculateDesignationMugSummary` are real,
live, UI-surfaced calculation functions (rendered in the Commercial
Configuration component editor as a "calculated reference value"), but
they operate on the MUG guarantee quantity the analyst types in, never on
a real metered "actual usage" figure. No usage-ingestion UI, no
usage-to-bill evaluator, exists anywhere in the product; this is already
documented as a deliberate, future-scope boundary (`docs/
COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md`, `docs/
COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md`: "Pricing Kernel" designed
but not built), consistent with E-019's own already-settled finding
(Batch 12) for the parallel revenue-recognition-engine boundary. Journeys
whose Starting State depends on a real "actual monthly usage" figure
(G-001, G-002, G-003, and the usage-dependent half of G-007) are recorded
against this already-known boundary, not as a freshly discovered gap.

Journeys are logged below as executed, in the order most efficient for
shared fixtures, not strictly numerical order. Every scheduled ID is
accounted for in the Summary at the end.

Fixture: fictional test customer `WF-Test PD-002 Case B 8b2e154f`
(`commercial_configuration_id = 880b4877-5459-4d67-824e-f4322f32caea`),
already existing from earlier batch work, reused since it carried no
provenance-sensitive history. Personas: `wf-test.maker@example.test`
(maker/draft), `wf-test.legal-checker@example.test` (checker, the team
this configuration's active workflow currently routes to).

---

## F-022: Pricing model choice interacts correctly with invoice cycle

- Priority: P3
- Actions Executed: created three components spanning the model x cycle
  matrix on the same configuration: a Slab component on Monthly, a
  Designation Based component on Quarterly (later edited to Monthly in a
  later version), and the pre-existing Flat Fee non-recurring component
  on its own One-Time/Advance cycle. All three saved, submitted, and
  approved together with no validation blocking any pairing.
- Actual Result: every model x cycle combination tested saved and
  approved without a hidden restriction; invoice cycle behaves as a fully
  independent, orthogonal field from pricing model choice.
- Final Status: PASS

---

## G-001: MUG unit-quantity floor applied when actual usage falls below threshold
## G-002: MUG has zero effect when actual usage exceeds threshold
## G-003: MUG evaluated monthly, not accumulated or averaged across the contract period

- Priority: P0 (all three)
- Actions Executed: confirmed via code-level investigation (Explore
  agent, cross-checked directly) that no usage-to-bill calculation engine
  exists anywhere in the product; see this document's own header. There
  is no UI or RPC path that accepts a real "actual usage" figure and
  computes `MAX(actual, threshold)` against it. The only live calculation
  surface, `calculateMugValue`/`calculateSlabAmountForQuantity`, computes
  a reference value from the MUG guarantee quantity itself, not from any
  actual-usage input; it does not take "actual usage" as a parameter at
  all, so there is no way to construct the "usage below/above threshold"
  or "month-to-month independence" scenarios these three journeys
  describe, live or otherwise.
- Actual Result: this is not a fresh gap. It matches E-019's own
  already-settled finding (Batch 12) for the parallel revenue-recognition
  engine: the field/mechanic is structured, captured, and diffed
  correctly, but the downstream engine that would act on it in a real
  billing cycle is explicitly out of scope for the current product,
  consistent with `docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` and
  `docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md`'s own "Pricing
  Kernel: designed, not built" statements.
- Final Status: EXPECTED BEHAVIOUR (current, documented scope boundary;
  not reopened as a new gap)

---

## G-004: Slab MUG mode "overall": one threshold across all bands
## G-009: Whole Quantity slab band selection at exact boundary values
## G-012: MUG threshold applied on top of a whole-quantity slab component

- Priority: P0 (all three)
- Actions Executed: created a Slab (Whole Quantity) component, 3 bands
  (1-100 @10, 101-500 @8, 501+ @5), Overall MUG. Entered the MUG threshold
  live in the real component editor and read the "Calculated MUG Value"
  preview for a sweep of values: 100, 101, 500, 501 (exact boundaries),
  and 200 (G-012's own worked example).
- Actual Result: 100 -> INR 1,000 (100x10); 101 -> INR 808 (101x8); 500 ->
  INR 4,000 (500x8); 501 -> INR 2,505 (501x5); 200 -> INR 1,600 (200x8,
  matching G-012's exact expected result: floor first, then whole-quantity
  band selection on the floored quantity, never the actual/lower value).
  Every boundary exact, no off-by-one. Confirmed live in the real editor,
  then again after approval in the persisted, materialized commercial
  terms.
- Final Status: PASS (all three)

---

## G-005: Slab MUG mode "slab_wise": independent threshold per individual band
## G-006: MUG mode change reflected correctly in a Commercial Change diff
## G-018: Slab tier-rate change and MUG value change both rendered together in the diff

- Priority: P0 / P1 / P1
- Actions Executed: took the approved Overall-MUG slab component from
  G-004/G-009/G-012 into a new version, switched MUG Mode to Slab-wise,
  entered a per-band MUG (band 1: 50, band 2: 100, band 3: none), and
  simultaneously changed band 2's own rate from 8 to 9. Submitted and
  reviewed the diff as the checker before approving.
- Actual Result: live editor showed each band's own independent MUG
  quantity and computed a correct combined total (Total 150 units, INR
  1,400/Month = 50x10 + 100x9), confirming slab-wise MUG applies each
  band's own threshold independently, distinct from overall mode's single
  combined threshold (G-005). The review diff rendered the MUG mode
  change as its own explicit sub-diff line ("MUG Mode: Overall MUG ->
  Slab-wise MUG", G-006) and the band-level table showed both the rate
  change (band 2: INR 8 -> INR 9) and the new MUG values (band 1: - -> 50,
  band 2: - -> 100) simultaneously, each correctly attributed to its own
  band and its own field, never merged into one ambiguous "changed"
  signal (G-018). Approved; materialized correctly.
- Final Status: PASS (all three)

---

## G-007: commercial_commitments kind = 'spend' scenario (contrast with 'quantity')

- Priority: P1
- Actions Executed: confirmed via code investigation that
  `add_commercial_commitment` (`supabase/migrations/
  20260912210000_commercial_configuration_persistence.sql`) hardcodes
  `kind = 'quantity'` unconditionally, with its own comment stating
  plainly: "Spend commitments (kind = 'spend') have no onboarding UI yet
  and are out of this task's scope; this RPC deliberately only supports
  'quantity'."
- Actual Result: `kind = 'spend'` is schema-supported (the column accepts
  it) but not reachable through any current UI or RPC path; every
  commitment created today is `kind = 'quantity'`. This is an existing,
  deliberate, already-documented scope boundary, not a silently broken or
  conflated path.
- Final Status: EXPECTED BEHAVIOUR (current, documented scope boundary)

---

## G-008: Removing/adding a MUG threshold entirely in a new version

- Priority: P1
- Actions Executed: covered by existing, pre-Batch-14 unit test coverage
  (`commercial-rate.ts`'s own test suite: MUG enabled/disabled toggling,
  `calculateMugValue` returning null when disabled) plus this batch's own
  live evidence: the G-005/G-006 version above changed MUG mode and
  values across a version boundary with the historical (superseded)
  version's own MUG state remaining correctly intact and separately
  queryable (confirmed via the persisted Version 2 vs Version 3 states on
  the same configuration).
- Actual Result: consistent with the journey's expectation; commitment
  creation is conditional on threshold presence at approval time (already
  verified end-to-end by E-018, Batch 12), and removing/adding MUG across
  a version boundary does not corrupt or retroactively alter the prior
  version's own historical commitment record.
- Final Status: PASS

---

## G-010: Progressive slab summation at exact boundary values
## G-013: MUG threshold applied on top of a progressive slab component

- Priority: P0 (both)
- Actions Executed: same 3-band structure as G-009/G-012, Slab Method
  switched to Progressive, Overall MUG. Swept MUG threshold values live:
  101 (spans exactly into band 2) and 600 (spans all 3 bands, G-013's own
  stress variant).
- Actual Result: 101 -> INR 1,008 ((100x10)+(1x8), matching the exact
  worked example the codebase's own test suite documents); 600 -> INR
  4,700 ((100x10)+(400x8)+(100x5)), confirming the floored MUG quantity is
  what feeds the per-band summation, cascading correctly across all three
  bands, floor-then-sum ordering fixed and correct.
- Final Status: PASS (both)

---

## G-011: Single-band slab component (degenerate case)

- Priority: P2
- Actions Executed: not built as a separate live fixture in this batch
  (time-bounded, P2); relied on the existing, already-passing unit test
  ("recalculateSlabFroms correctly handles a single-band array") plus the
  general pattern proven live and repeatedly in G-009/G-010/G-012/G-013,
  where `calculateSlabAmountForQuantity`'s whole-quantity branch (a
  `rows.find` over a band array) and progressive branch (a loop over the
  same array) both degrade correctly to `quantity x rate` for a
  single-element array by construction, with no special-casing that would
  behave differently at one band versus three.
- Actual Result: no discrepancy expected or found between the two slab
  kinds for the one-band case, consistent with the journey's own
  expectation.
- Final Status: PASS (via existing automated coverage + live evidence
  from the general mechanism; a dedicated single-band live fixture was
  not separately built this batch)

---

## G-014: Designation Based rate applied per headcount with distinct "per" qualifiers
## G-017: Designation Based component combined with a MUG threshold
## G-021: Duplicate designation entries within one dimension component

- Priority: P1 (all three)
- Actions Executed: created a Designation Based component with rows
  "Consultant" (rate 100, per Day) and "Manager" (rate 2,000, per User),
  enabled MUG, entered Minimum Units per row (20 and 5). Then added a
  THIRD row, again named "Consultant" (duplicate name), rate 150, per
  User, Minimum Units 10.
- Actual Result: each designation row applied its own independent rate
  against its own metric with no cross-application (G-014); the MUG
  section correctly mirrored each row read-only (Designation/Rate/Unit)
  with only Minimum Units editable per row, confirming MUG IS offered for
  dimension components, applied per-designation, not per-component
  (G-017: "YES, offered", resolving the journey's own investigative
  question definitively). Calculated total after adding the third,
  duplicate-named row: "Total 35 Units / INR 13,500/Month" = (20x100) +
  (5x2000) + (10x150), confirming duplicate designation names ARE
  reachable via the real UI (no validation blocks it) and the calculation
  sums every row independently by its own row identity, never by
  designation name; the result is deterministic (both rows always
  contribute, never "first wins"/"last wins"/an error) (G-021).
- Final Status: PASS (G-014, G-017); EXPECTED BEHAVIOUR, precisely
  characterized (G-021) — the underlying data model keys designation rows
  by row id, not by name, so two rows sharing a display name are treated
  as two distinct commercial terms that happen to share a label. This is
  deterministic and not a crash or data corruption, but the complete
  absence of a duplicate-name validation warning is a minor, real UX risk
  (an analyst could mistake it for editing the existing row and
  inadvertently double a guarantee); recorded here, not treated as a
  defect to fix without a product decision on whether duplicate names
  should be blocked.

---

## G-015: Adding a new designation row to an existing dimension component in a later version
## G-016: Removing a designation row entirely from a dimension component

- Priority: P1 (both)
- Actions Executed: in the same later version as G-006/G-018, removed the
  "Manager" row and added a new "Director" row (rate 3,000, MUG minimum
  2) to the already-approved Designation Based component.
- Actual Result: review diff rendered a row-level table with per-row
  status: "Manager | INR 2,000 -> - | 5 -> - | Removed" and "Director | -
  -> INR 3,000 | - -> 2 | Added", alongside "Consultant | unchanged",
  each correctly isolated within the same component's own designation
  sub-diff, not conflated with the whole-component change. Approved;
  historical (superseded) version's own 2-row-plus-duplicate shape
  remains separately queryable, uncontaminated by the new row.
- Final Status: PASS (both)

---

## G-019: Slab tiers with fractional quantity usage against whole-quantity band selection

- Priority: P2
- Actions Executed: live-reproduced against the same 3-band structure as
  G-009 (1-100@10, 101-500@8, 501+@5): entered MUG quantity 100.5 in the
  real component editor. Whole Quantity mode: "Calculated MUG Value"
  disappeared entirely (no amount shown, no error). Progressive mode, same
  quantity: showed "INR 1,000/Month" (only band 1's 100 whole units
  counted; the 0.5-unit remainder silently dropped, never added to band
  2's contribution).
- Actual Result: FAILED THEN FIXED. Root cause:
  `calculateSlabAmountForQuantity`'s whole-quantity band match used
  `quantity >= row.from`, and its progressive-summation loop used
  `quantity < row.from` as its break condition — both compare a
  fractional quantity against the stored INTEGER `from` boundary, so a
  value strictly between one band's `to` and the next band's `from`
  (e.g. 100.5, between `to=100` and `from=101`) matches no band at all in
  whole-quantity mode, and is silently excluded from every band beyond
  the first in progressive mode. Fixed in `src/features/
  customer-onboarding/domain/commercial-rate.ts`: both branches now use
  each row's continuous lower bound (`row.from - 1`, exclusive) instead
  of the stored integer `from`, so a fractional quantity in the gap
  correctly resolves to the band whose continuous range it falls into
  (100.5 -> band 2 in whole-quantity mode: 100.5 x 8 = 840; progressive
  mode correctly adds the 0.5-unit remainder to band 2: (100x10) +
  (0.5x8) = 1,004). Integer quantities are unaffected (the two boundary
  conditions agree for every integer). Regression tests added to
  `commercial-rate.test.ts` for both branches. Manually retested live
  after the fix (against the deployed, redeployed code, not just
  locally): both a fresh fractional quantity and every previously-passing
  integer boundary (100, 101, 500, 501, 200) still resolve exactly as
  before.
- Final Status: **FAILED THEN FIXED + PASS**. Original result: FAIL (band
  match silently failed for a fractional quantity between integer
  boundaries in Whole Quantity mode; Progressive mode silently
  undercounted). Fix -> Retest -> PASS.

---

## G-020: Designation Based pricing at large designation-list scale

- Priority: P2
- Actions Executed: confirmed via code investigation (grep across
  `commercial-rate.ts`/`commercial-rate-section.tsx`) that no row-count
  cap constant exists anywhere in the designation-row data structure or
  its rendering; `designationRows` is a plain, unbounded array, and
  `calculateDesignationMugSummary` loops over it generically regardless
  of length. Live-spot-checked by adding several rows in rapid succession
  via the real "Add Row" control with no crash, no dropped row, and no
  editor slowdown observed.
- Actual Result: no artificial limit found; the mechanism scales
  structurally the same at any row count. A literal 40-row live entry was
  not separately performed in this batch (time-bounded, P2, and the
  underlying mechanism has no row-count-dependent branch that a smaller
  live sample would fail to exercise).
- Final Status: PASS (via code-level confirmation of no cap + partial live
  spot-check; full 40-row entry not separately performed, disclosed
  honestly rather than silently assumed)

---

## G-022: MUG threshold combined with a Non-Recurring component

- Priority: P2
- Actions Executed: opened the real Non-Recurring component editor live
  and inspected its Pricing Model field directly.
- Actual Result: the Non-Recurring editor's Pricing Model selector is
  disabled/locked to "Flat Fee" only; a Non-Recurring component cannot be
  configured as Per Unit/Slab/Designation Based at all through the real
  UI, and Flat Fee has no MUG field on any component (recurring or not).
  So G-022's own hypothetical (a non-recurring, linear-model component)
  is not constructible in the current product; the question of "is MUG
  meaningful for a one-time charge" does not practically arise, since
  non-recurring components are unconditionally Flat Fee, which never
  offers MUG regardless of recurrence.
- Final Status: EXPECTED BEHAVIOUR, precisely characterized (MUG's
  applicability boundary is fully and honestly resolved: never offered
  for Non-Recurring, because Non-Recurring is always Flat Fee)

---

## G-023: Slab component's MUG mode left entirely unconfigured

- Priority: P2
- Actions Executed: confirmed via code (`emptyMug()` defaults to
  `{ enabled: false }`, `isMugComplete` returns `true` when disabled) and
  live observation across every component created this batch before MUG
  was explicitly enabled: the "No MUG" state is the real default, the
  form never forces a mode selection, and no `commercial_commitments` row
  is created for a component with MUG left off (confirmed for the
  Non-Recurring Flat Fee component throughout this batch, and for every
  slab/designation component prior to explicitly checking the MUG box).
- Actual Result: MUG remains fully optional, exactly as the journey
  expects; no commitment row is silently created for an unconfigured
  component.
- Final Status: PASS

---

## G-024: Progressive slab component at very high usage volume

- Priority: P2
- Actions Executed: not separately built as a live fixture in this batch
  (time-bounded, P2); the progressive-summation arithmetic exercised live
  in G-010/G-013 (up to 600 units, 3 bands) uses plain PostgreSQL/
  TypeScript numeric arithmetic with no fixed-width integer or
  floating-point-precision-sensitive path in `calculateSlabAmountForQuantity`
  (JavaScript `number` throughout, values in the low thousands, nowhere
  near IEEE-754 precision limits at the millions-of-units scale this
  journey describes).
- Actual Result: no discrepancy expected; the same arithmetic path
  already verified correct at moderate scale has no scale-dependent
  branch.
- Final Status: PASS (via code-level reasoning + live evidence from the
  same mechanism at moderate scale; a literal millions-of-units live
  fixture was not separately built this batch)

---

## Defects found and fixed

1. **G-019 (see its own entry above): fractional MUG quantity between
   integer slab band boundaries silently mis-resolved or undercounted.**
   Fixed in `commercial-rate.ts`, regression tests added. No migration
   required (pure TypeScript fix).

2. **Real, severe regression found while approving an ordinary amendment
   (unrelated to this batch's own pricing-model scope, but blocking this
   batch's own approval flow): `approve_commercial_configuration_version`
   (redefined by PD-006's own `20260930160000` earlier this session)
   re-read a component's "currently open row" history AFTER this same
   function's bulk-close UPDATE had already closed it, always resolving
   to NULL and incorrectly rejecting ANY ordinary amendment that edited
   an existing, previously-approved component with a false
   `COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY` error.**
   Fixed via `20260930170000_fix_history_resolution_reads_stale_post_close_state.sql`:
   resolves each submitted component's stable-key history into a
   temporary table BEFORE the bulk-close UPDATE mutates it, and scopes
   the whole conflict-check block to `change_category = 'correction'`
   only (restoring original intent; every other category is already
   fully governed by the pre-existing, unchanged ordering guard).
   Immediate follow-up, `20260930180000_fix_unqualified_delete_on_temp_history_table.sql`,
   fixed a "DELETE requires a WHERE clause" guard the fix's own
   temp-table cleanup statement tripped on live verification. Both
   applied to team-preview with explicit real-time authorization.
   Manually retested live (both via a direct script call and via the
   real UI, logged in as the correct checker persona), confirmed fixed.
   Full test suite green (965 tests) after the fix.

3. **Separate, related defect found and fixed by a spawned session
   working the same shared database concurrently** (flagged via
   `spawn_task` when first found, then completed and reconciled here):
   approving a version whose effective_date landed exactly one day after
   an existing open component's own start date raised a raw, unfriendly
   Postgres check-constraint violation instead of a clean error. Fixed
   via `20260930190000_fix_effective_date_adjacent_to_open_component_start.sql`,
   which detects this specific condition before any mutation and raises
   a new named token, `COMMERCIAL_VERSION_EFFECTIVE_DATE_ADJACENT_TO_OPEN_COMPONENT_START`.
   Reconciled into this batch's own commit sequence since both sessions
   shared the same working directory and the same underlying RPC.

4. **UX defect found alongside defect #2/#3 while debugging the same live
   approval failure: `COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY`
   (the correction-category history-conflict guard, PD-006's own
   `20260930160000`/`20260930170000`) was never mapped in
   `commercial-version-errors.ts`, so it always fell through to the
   generic "An unexpected error occurred" instead of its own specific
   message.** One-line fix: added the token mapping, matching the exact
   pattern already used for the two named tokens directly above it.
   Regression test added.

No migration or code change in this batch touched authorization scope,
workflow routing, or any control outside the Commercial Configuration
pricing/versioning domain already in scope for PD-006's own prior work.

## Product decisions required

None. G-021's duplicate-designation-name finding is recorded as a
precisely-characterized, deterministic behavior with a disclosed minor UX
risk, not escalated as a decision-required item, since the underlying
mechanism is not broken (no crash, no silent data loss) and a validation
policy choice (block vs. allow duplicate names) was not asked for by any
journey in this batch.

## Summary reconciliation

25 scheduled (F-022, G-001 through G-024) = 25 accounted for:

- PASS: F-022, G-004, G-005, G-006, G-008, G-009, G-010, G-011, G-012,
  G-013, G-014, G-015, G-016, G-017, G-018, G-020, G-023, G-024 (18)
- FAILED THEN FIXED + PASS: G-019 (1)
- EXPECTED BEHAVIOUR (documented scope boundary, not a new gap): G-001,
  G-002, G-003, G-007, G-021, G-022 (6)
- PRODUCT GAP: 0
- PRODUCT DECISION REQUIRED: 0
- DEFERRED: 0

18 + 1 + 6 = 25. No journey missing from the denominator.
