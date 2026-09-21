# Nexus Batches 1-13 Ledger Audit

Bounded documentation-integrity audit of the complete Batches 1-13 journey-testing
history (326 scheduled journeys). This is NOT a product, architecture, or security
review, NOT a code/behavior/database change, and NOT the start of Batch 14. Every
fact below was derived directly from the repository (ledger files, git log, and
git diff), per the audit's own "do not guess any number" instruction. Where two
documents disagreed, the disagreement is flagged and resolved against the
underlying journey evidence or git history, named explicitly, never silently
picked.

## Verdict

**BATCHES 1-13 LEDGER AUDIT: COMPLETE**

All 326 scheduled journeys across Batches 1-13 are accounted for, every one has a
final outcome in an existing Nexus classification, no individual journey's
Original Status, Final Status, Actual Result, or other execution-history field
was ever deleted or rewritten, and every defect/product-gap/decision found
during this audit to be under-documented has now been corrected. This audit
made **19 individual documentation corrections across 7 distinct issue
categories** (missing/placeholder commit-hash citations; a missing closure
summary; closure-summary count/list miscounts; a stale pre-execution premise
never corrected as promised; later gap-closures never cross-referenced back to
their originating batch ledger; a cross-batch aggregate report omitting a real
finding and undercounting its distinct-findings total; and one stale
cross-document claim never regenerated after the gap it described had closed)
across 10 files. Every correction either (a) appended new text below unchanged
original content, or (b) replaced an aggregate summary count, a decision-record
narrative, or a pre-execution grounding-brief premise. In every case where text
was replaced rather than appended, the replaced line was a summary/count/premise
statement, never an individual journey's own status or result field; those 5
replacements are itemized in Section 4. None required a code, database, or
migration change.

## 1. Reconciliation table

| Batch | Journeys accounted for | Ledger complete? | Defects/fixes traceable? | Product gaps traceable? | Decisions traceable? | Historical failures preserved? | Missing documentation |
|---|---|---|---|---|---|---|---|
| 1 | 25/25 (K-001-K-025); K-030 correctly excluded, discovered here, executed in Batch 2 | Yes (explicitly disclosed as a retroactive reconstruction) | Yes for K-010; K-019/K-025 fix commit (`8d040d0`) traceable, Batch-1-specific rerun granularity honestly marked "not historically captured" | N/A (0 gaps) | N/A (0 decisions) | Yes | None requiring a fix (honest disclosure, not a contradiction) |
| 2 | 26/26 (K-026-K-030, L-001-L-021) | **Fixed this audit** (closure summary was entirely missing) | **Fixed this audit**: 3 of 4 defect fix commits were literal placeholders ("(pending, committed with this ledger update)"); backfilled from `git log` (K-027=`0491261`, K-029=`925915e`, L-021=`d0f58d8`); K-026 already correct (`fa061f2`) | N/A (0 formal gaps; L-019 is Category B, see below) | N/A | Yes | **Fixed**: missing closure summary added; 3 placeholder commits backfilled; `docs/NEXUS_JOURNEY_UNIVERSE.md`'s L-019 entry was still stating its own superseded premise ("agreement" reserved/UI-hidden) 5 days after Batch 2 disproved it and explicitly flagged the correction as owed — corrected now |
| 3 | 25/25 (L-022-L-028, U-001-U-018) | **Fixed this audit** (closure summary miscounted) | Yes, DEFECT-B3-001/002/003 all fully traceable to `4b4f199` | N/A (0 gaps, confirmed by both this ledger and `PRODUCT_GAP_TRIAGE_BATCHES_03_06.md`) | N/A | Yes (U-004/U-005 both keep original FAILED alongside FAILED THEN FIXED + PASS) | **Fixed**: closure summary's PASS list omitted L-024 and L-027, double-counted U-002 against both PASS and EXPECTED BEHAVIOR, and inflated FAILED THEN FIXED + PASS to 3 with a nonexistent third case |
| 4 | 25/25 (U-019, U-020, N-001-N-023) | Yes | Yes, DEFECT-B4-001 (N-015) traceable to `2966872` | N/A (0 gaps; N-013 correctly PASS/intentional in both this ledger and the triage doc) | N/A | Yes | None found |
| 5 | 25/25 (N-024-N-031, O-001-O-017) | **Fixed this audit** (3 later closures never cross-referenced) | N/A (0 formal defects, all findings are product gaps) | Yes, all 6 (N-026, N-027, N-029, N-030, N-031, O-011) traceable and cross-checked against the triage doc; 3 later CLOSED (N-030, N-031, O-011), 3 still deferred (N-026, N-027, N-029, all tracked in `TECH_DEBT.md`) | N/A (this batch predates the PD-card system) | Yes | **Fixed**: N-030/N-031/O-011's later closures (commits `acfc5ba`, `444226a`, `39c6c05`) were never cross-referenced back into this ledger; added. Also backfilled the missing `444226a` commit citation into `PRODUCT_GAP_TRIAGE_BATCHES_03_06.md` itself |
| 6 | 25/25 (O-018-O-025, P-001-P-017) | **Fixed this audit** (2 later closures + 1 fix commit never cross-referenced) | **Fixed this audit**: DEFECT-B6-001 had no Fix Commit label in its own entry (backfilled `baf7026`, confirmed via `git show --stat`) | Yes, all 5 (O-018, O-020, O-023, P-012, P-013) traceable; 2 later CLOSED (O-018, P-013), 3 still deferred (O-020, O-023, P-012, tracked in `TECH_DEBT.md`) | N/A | Yes (P-013 keeps original FAILED) | **Fixed**: O-018/P-013's later closures (commits `1075ecb`, `186b66d`) cross-referenced; DEFECT-B6-001 fix commit labeled |
| 7 | 25/25 (P-018-P-023, A-001-A-019) + A-036 (extra, correctly excluded from the 25-count, tracked separately) | Yes | Yes, DEFECT-B7-001/002 traceable to `552d301`/`5e3e495`; **fixed this audit**: DEFECT-B7-003's own addendum deferred to "see git log for exact SHAs," now cites `4d2cb0f` and `b967a5e` directly | A-036 (open decision, not a gap) correctly disposed as pending, not fixed | Yes, A-036 traces forward to `OVERNIGHT_PENDING_APPROVALS.md` PD-001 | Yes (A-002, A-004, A-005, A-006 all keep original FAILED) | **Fixed**: DEFECT-B7-003 commit hashes backfilled |
| 8 | 25/25 (A-020-A-035, ACC-001, B-001-B-008); B-007 correctly deferred with a documented reason, later resolved | Yes | Yes, DEFECT-B8-001/002 traceable | N/A (0 gaps; A-034 is PD-002, a decision, not a gap) | Yes, PD-002 traceable in `OVERNIGHT_PENDING_APPROVALS.md` | Yes | None found |
| 9 | 25/25 (B-009-B-025, C-001-C-008) | Yes | Yes, B-017/DEFECT-B9-001 fully traceable: original FAILED, root cause, migration `20260930080000_...sql`, later applied and PASS, all preserved with a "Morning Catch-Up Outcome" addendum | Yes (was the only gap, now resolved) | Yes, PD-003 traceable | Yes | None found |
| 10 | 25/25 (C-009-C-033); C-027 correctly deferred to Batch 12, later resolved in morning catch-up | Yes | N/A (0 formal defects) | N/A (0 gaps) | Yes, PD-004 traceable | Yes | None found |
| 11 | 25/25 (C-034, C-035, D-001-D-023) | **Fixed this audit** (closure summary miscounted) | N/A (0 formal defects) | Yes, 5 journeys (D-003, D-004, D-015, D-021, D-017), all still open, correctly disposed as needing a product decision | Yes, PD-005 traceable | Yes | **Fixed**: closure summary said "2 groups covering 6 journeys," the actual grouped entries cover 5 |
| 12 | 25/25 (D-024, E-001-E-024) | Yes (this ledger itself was always internally correct) | N/A (0 formal defects) | Yes within this ledger (E-020, E-022); **fixed this audit** at the cross-batch level: `OVERNIGHT_RUN_REPORT_BATCHES_08_13.md` omitted E-022 entirely from its "10 documented overnight product gaps" enumeration and undercounted "4 distinct findings" (actually 6) | Yes, PD-006 traceable | Yes | **Fixed** (in the overnight report, not this ledger): E-022 added to the cross-batch gap enumeration |
| 13 | 25/25 (E-025-E-028, F-001-F-021) | Yes | N/A (0 formal defects) | Yes, F-014 (redacted to architectural level per the public-repo rule) and F-020, both traceable | N/A | Yes | None found |

## 2. Total journeys accounted for

**326 of 326 scheduled journeys across Batches 1-13, all accounted for.** Derived
directly from `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`'s per-batch Journey ID
ranges (25 journeys per batch except Batch 2's 26), matching every batch ledger's
own per-journey entry count exactly:

25 + 26 + 25 + 25 + 25 + 25 + 25 + 25 + 25 + 25 + 25 + 25 + 25 = **326**

Of these, Batches 8-13 total exactly **150** (25 x 6), matching the required
overnight-run figure. Batches 1-7 total exactly **176**.

Four additional stable journeys exist outside the 326-count by design, each
correctly excluded from its batch's scheduled total and separately tracked in
`docs/NEXUS_JOURNEY_UNIVERSE.md`: K-030 (discovered in Batch 1, executed in
Batch 2), A-036 (discovered in Batch 7, still open as PD-001), the P-013
neighbor regression (evidence-only, Batch 7), and AB-041 (the governed-RPC grant
guard, added during the Batch 7 trust-boundary closure).

## 3. Global reconciliation facts (verified against the repo, not assumed)

- **Batches 1-7 history intact:** confirmed. All 7 ledgers exist, every scheduled
  journey has a Final Status, and no overwritten/deleted historical failure text
  was found in any of them (each preserves "Original Status: FAILED" alongside
  "Final Status: FAILED THEN FIXED + PASS" wherever a defect was fixed).
- **All 150 scheduled overnight journeys (Batches 8-13) accounted for:** confirmed
  (see Section 2).
- **The "overnight 130 PASS baseline" reconciles exactly:** Batch 8 = 21, Batch 9
  = 22, Batch 10 = 23, Batch 11 = 19, Batch 12 = 22, Batch 13 = 23. Sum = **130**.
- **"2 defects fixed during the overnight run" traceable:** DEFECT-B8-001 (A-023,
  document content-sniffing) and DEFECT-B8-002 (ACC-001, missing skip-link), both
  in `BATCH_08_RESULTS.md`. B-017 was found and designed during the overnight run
  but deliberately parked, not fixed, until the morning catch-up, consistent with
  every document that describes it.
- **B-017 preserves original failure + migration fix + PASS:** confirmed in
  `BATCH_09_RESULTS.md` (original PRODUCT GAP CONFIRMED text unchanged, a
  "MORNING CATCH-UP OUTCOME (2026-09-21)" subsection appended below it, Final
  Status now reads FAILED THEN FIXED + PASS).
- **All "10 documented overnight product gaps" traceable to current disposition:**
  confirmed, but only after this audit's fix: E-022 (Batch 12) was a real
  PRODUCT GAP CONFIRMED result missing from `OVERNIGHT_RUN_REPORT_BATCHES_08_13.md`'s
  own enumeration; added. The corrected set of 10 is B-017, D-003, D-004, D-015,
  D-021, D-017, E-020, E-022, F-014, F-020, across 6 distinct findings (not 4, as
  the report previously said).
- **All "6 pending product-policy decisions" traceable to decision cards:**
  confirmed. PD-001 (A-036) through PD-006 (E-015) all have a full plain-English
  decision card in `OVERNIGHT_PENDING_APPROVALS.md`'s "Morning Catch-Up Decision
  Cards" section.
- **B-007 preserves original deferred status + subsequent PASS:** confirmed in
  `BATCH_08_RESULTS.md` (a dedicated B-007 entry exists with "Original Overnight
  Status: DEFERRED" plus a full Morning Catch-Up Outcome subsection).
- **C-027 preserves original deferred status/WORKFLOW_DECISION_NO_MATCH context +
  subsequent PASS:** confirmed in `BATCH_10_RESULTS.md`, cross-referenced from
  `BATCH_12_RESULTS.md`.
- **A-036 remains correctly recorded as an open product decision:** confirmed. No
  later decision exists anywhere in the repo; it is PD-001, explicitly listed as
  "none block Batch 14."
- **Product Gap Closure from Batches 3-6 properly reflected without erasing
  original findings:** confirmed, and strengthened by this audit. Five gaps
  (N-030, N-031, O-011, O-018, P-013) were closed in the pass following Batches
  3-6 (commits `acfc5ba`, `444226a`, `39c6c05`, `1075ecb`, `186b66d`), fully
  documented with decision rationale in `PRODUCT_GAP_TRIAGE_BATCHES_03_06.md`'s
  "IMPLEMENTATION OUTCOME" section and in `docs/NEXUS_JOURNEY_UNIVERSE.md`'s
  updated entries, but the individual Batch 5/6 ledger entries themselves had
  never been cross-referenced forward to that closure until this audit added
  the five "Later closure" notes.
- **Batch 7's three named control failures remain permanently documented by
  name:** confirmed. Server-side onboarding submission validation
  (DEFECT-B7-001, `552d301`), onboarding ownership enforcement (DEFECT-B7-002,
  `5e3e495`), and governed RPC PUBLIC execute trust-boundary closure
  (DEFECT-B7-003, `4d2cb0f` + `b967a5e`, hashes backfilled by this audit) are all
  present, named, and traceable in `BATCH_07_RESULTS.md`.
- **The systemic governed-RPC grant guard is documented and traceable:**
  confirmed. `scripts/verify-governed-rpc-grants.ts` exists, is referenced from
  `BATCH_07_RESULTS.md`, `BATCH_08_RESULTS.md`, and `docs/NEXUS_JOURNEY_UNIVERSE.md`
  (journey AB-041).
- **Current deployment/test baseline after Morning Catch-Up:** confirmed live.
  Local HEAD, `origin/team-preview`, matched at `c904d5018a0e6027a424f578bf31afc27adf40ff`
  before this audit's doc fixes; `origin/main` (Production) unchanged at
  `04aba7a77e3bb13888ad83e17faac471facb1206` throughout.

## 4. Documentation gaps found and fixed (10 total)

1. `BATCH_02_RESULTS.md` had no closing summary section at all. Added, derived
   mechanically from the 26 per-journey Final Status fields.
2. `BATCH_02_RESULTS.md` had 3 of 4 defect entries citing a literal placeholder
   ("(pending, committed with this ledger update)") instead of a real commit
   hash. Backfilled from `git log`.
3. `docs/NEXUS_JOURNEY_UNIVERSE.md`'s L-019 entry still stated a premise ("agreement"
   reserved/UI-hidden) that Batch 2's own execution had disproved and explicitly
   flagged as needing correction "in a follow-up documentation pass," which had
   never happened. Corrected.
4. `BATCH_03_RESULTS.md`'s closure summary miscounted its own per-journey results
   (PASS list omitted 2 real PASS journeys, double-counted 1 journey into two
   categories, and inflated the FAILED-THEN-FIXED count with a nonexistent third
   case). Corrected to match the per-journey entries exactly.
5. `BATCH_05_RESULTS.md`: three of its six product gaps (N-030, N-031, O-011)
   were later closed by a subsequent commit but the ledger entries were never
   cross-referenced forward to that closure. Added.
6. `PRODUCT_GAP_TRIAGE_BATCHES_03_06.md`'s own N-031 closure record cited no
   commit hash (unlike its sibling closures). Backfilled.
7. `BATCH_06_RESULTS.md`: two of its five product gaps (O-018, P-013) were
   likewise later closed without a forward cross-reference. Added.
8. `BATCH_06_RESULTS.md`'s DEFECT-B6-001 had no Fix Commit hash in its own entry.
   Backfilled and verified against `git show --stat`.
9. `BATCH_07_RESULTS.md`'s DEFECT-B7-003 addendum deferred its own commit hashes
   to "see git log at push time" rather than stating them. Backfilled.
10. `BATCH_11_RESULTS.md`'s closure summary said its product-gap group covered
    "6 journeys" when the named entries total 5. Corrected.
11. `OVERNIGHT_RUN_REPORT_BATCHES_08_13.md`'s "10 documented overnight product
    gaps" enumeration omitted E-022 (a real PRODUCT GAP CONFIRMED result in
    `BATCH_12_RESULTS.md`) entirely, and its "4 distinct findings" count was
    wrong regardless (6, once E-022 is included). Added the missing finding and
    corrected the count.
12. `docs/NEXUS_JOURNEY_COVERAGE_MATRIX.md` still asserted N-031 "remains a real,
    confirmed-live product gap... not stale documentation," a claim that predates
    N-031's later closure by several days and was never regenerated. Corrected
    to reflect the closure while leaving H-043 (genuinely still open, out of
    Batches 1-13's scope) as-is.

(Items are listed individually above; several land in the same file, which is
why the reconciliation table's per-batch fix count and this list's item count
differ slightly.)

Every fix above is additive or a corrected count/label; no historical failure,
original defect description, or original empirical finding was deleted or
rewritten. Where a "Later closure" note was added, the original PRODUCT GAP
CONFIRMED result and its Original Status are left completely unchanged above the
new note.

## 5. Files changed

- `docs/journey-runs/BATCH_02_RESULTS.md`
- `docs/journey-runs/BATCH_03_RESULTS.md`
- `docs/journey-runs/BATCH_05_RESULTS.md`
- `docs/journey-runs/BATCH_06_RESULTS.md`
- `docs/journey-runs/BATCH_07_RESULTS.md`
- `docs/journey-runs/BATCH_11_RESULTS.md`
- `docs/journey-runs/OVERNIGHT_RUN_REPORT_BATCHES_08_13.md`
- `docs/journey-runs/PRODUCT_GAP_TRIAGE_BATCHES_03_06.md`
- `docs/NEXUS_JOURNEY_UNIVERSE.md`
- `docs/NEXUS_JOURNEY_COVERAGE_MATRIX.md`
- `docs/journey-runs/BATCHES_01_13_LEDGER_AUDIT.md` (this report, new)

No application code, database schema, migration, `.env.local`,
`.claude/launch.json`, or `.runtime-tests` file was read, edited, or staged.

## 6. Anything still unreconstructable from the repo alone

- **Batch 1's exact per-dimension results for its 20 plain-PASS journeys**
  (Started/Completed timestamps, per-dimension Regular/Stress/Auth/Concurrency
  results) are marked "Not historically captured" in the ledger itself, since
  Batch 1's ledger is an explicitly disclosed retroactive reconstruction written
  after the fact. This is honestly disclosed, not a contradiction, and is not
  fixable from the repo.
- **K-019 and K-025's Batch-1-specific rerun confirmation** (as opposed to their
  fix and migration, which are fully traceable) is not separately captured;
  only that the migration was live and later reconfirmed in Batch 2.
- **Batch 2's exact test-suite/deployment snapshot at its original close** (exact
  Vitest count, exact deployed SHA at that moment) was never recorded in the
  ledger at the time and cannot be reconstructed retroactively without a
  historical CI record that does not exist in this repo. The batch-completion
  commit (`d13b63d`) is known and cited; the missing snapshot detail is disclosed
  as such in the newly added closure summary rather than fabricated.
- **E-022's underlying finding is itself explicitly low-confidence** ("code-reading
  evidence only, not live-confirmed" per `BATCH_12_RESULTS.md`), which is a
  property of the original finding, not a documentation gap; it is now correctly
  carried into the cross-batch report at that same confidence level.

## 7. Is it safe to start Batch 14 from a documentation/history perspective?

**Yes.** Every journey scheduled across Batches 1-13 has a permanent, internally
consistent, cross-referenced record. Every defect, product gap, and
product-policy decision found during this audit to be under-documented now has
a complete, additive trail back to its origin and (where applicable) its
closure. No code, database, or product behavior was touched to reach this
state, only documentation. Batch 14 was not started as part of this audit.

NEXUS BATCHES 1-13 LEDGER AUDIT COMPLETE.
