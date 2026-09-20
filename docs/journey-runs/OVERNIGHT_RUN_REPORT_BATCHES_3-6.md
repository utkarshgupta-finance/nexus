# NEXUS END-TO-END BUSINESS JOURNEY VALIDATION OVERNIGHT RUN REPORT BATCHES 3-6

Consolidated report for the sequential overnight execution of Batches 3,
4, 5, and 6 against the reconciled Nexus Journey Universe. Each batch
closed fully (execute, fix-on-the-go, regression, ledger, checkpoint,
commit, push, deploy-verify) before the next began, per the mission's
explicit instruction. Batch 7 was not executed.

1. **Scope covered.** Batch 3: Workflow Versioning completion (L-022
   through L-028) plus Authentication/Sessions (U-001 through U-018).
   Batch 4: Authentication completion plus Users/Roles/Permissions
   (N-001 through N-023, U-019/U-020). Batch 5: Permissions completion
   plus Teams (N-024 through N-031, O-001 through O-017). Batch 6:
   Teams completion plus Reference Masters (O-018 through O-025, P-001
   through P-017). 100 journeys planned and executed across the four
   batches, matching the execution plan exactly.

2. **Overall result mix.** 82 PASS, 4 FAILED THEN FIXED + PASS, 11
   PRODUCT GAP CONFIRMED, 3 EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.
   Every Original Status of FAILED remains permanently recorded in its
   batch ledger even where a fix was applied afterward; no failure
   history was rewritten to look like a first-try pass.

3. **Real defects found and fixed.** 5 across the four batches: 3 in
   Batch 3 (unauthenticated Customer Master exposure, a query string
   silently dropped on login redirect, login ignoring a requested
   redirect target), 1 in Batch 4 (missing disclosure that the User
   Access list caps at 200 rows), and 1 in Batch 6 (`getCurrentNexusSession`
   had no bounded path if `getUser()` never settled, found during
   concurrent RPC stress rather than from a specific formal journey;
   clustered refresh-token errors are a suspected, not proven, trigger,
   see the Batch 6 ledger's PROVEN/SUSPECTED/NOT PROVEN breakdown).
   Batch 5 found zero code defects; every deviation there was classified
   as a genuine architecture-level Product Gap.

4. **Product Gaps requiring a product-owner decision.** 11 confirmed,
   never improvised as an unbounded architecture change: see OPEN
   PRODUCT GAPS below for the full list with batch and severity
   context.

5. **No new migrations were required or applied** across any of the
   four batches. Every fix was application code; every Product Gap was
   left as a documented decision point rather than a live schema
   change made without authorization.

6. **Shared real resources were touched only under explicit,
   per-action authorization.** Every mutation of a pre-existing real
   RBAC, team, or reference-data row (recorded across Batches 4, 5, and
   6) was preceded by a fresh `AskUserQuestion` approval scoped to that
   specific action, and every one of those rows was restored to its
   original state once the test completed.

7. **Test personas and data followed the mandated hygiene rules.**
   Every persona was created through the real Supabase Auth Admin API,
   never a raw `auth.users` insert; all fictional, prefixed
   WF-TEST/E2E-TEST/BATCH-style; nothing resembling real customer or
   financial data was ever committed.

8. **Checkpoint suites passed clean for all four batches**: `npx tsc
   --noEmit`, `npx vitest run`, `npx eslint .`, `npm run build`, `npm
   audit`, sequentially, with `.env.local` confirmed untouched and a
   secret scan of every diff before each commit.

9. **Deployment discipline held throughout**: every batch pushed only
   to `team-preview`, never `main`; every batch's local HEAD, origin,
   and Vercel Preview alias SHA were independently confirmed to match
   and reach a READY state before the next batch began; Production was
   never deployed to, promoted, or touched.

10. **Two pushes were blocked by the safety classifier** for carrying
    detailed security-relevant disclosure into a public repository
    (Batch 3's redirect/exposure defects, Batch 6's P-013 bypass
    technique and O-018 operational risk); both were resolved by a
    fresh, explicit user authorization to push as written, scoped to
    that specific commit.

11. **One out-of-scope issue was flagged rather than fixed inline**: a
    client-side hydration bug on `/settings/customer-onboarding` (and
    similarly on `/forms/customer-onboarding`) getting stuck on
    "Loading settings..." despite a fully correct server response,
    spawned as a background task (`task_785dbf00`) since it falls
    outside this run's auth/permissions/teams/reference-master scope.

12. **Batch 7 determination: READY.** See BATCH 7 READINESS below.

## Batch 3 Results

| Metric | Value |
|---|---|
| Journeys planned/executed | 25 (L-022-L-028, U-001-U-018) |
| PASS | 21 |
| FAILED THEN FIXED + PASS | 3 |
| EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY | 1 |
| PRODUCT GAP CONFIRMED | 0 |
| Defects found/fixed | 3: unauthenticated Customer Master exposure; query string dropped on login redirect (DEFECT-B3-002); login ignoring `redirectTo` (DEFECT-B3-003) |
| Key commits | 4b4f199 (fixes), 0d0cf96 (SHA backfill), 5245db9 (final report) |
| Ledger | `docs/journey-runs/BATCH_03_RESULTS.md` |

## Batch 4 Results

| Metric | Value |
|---|---|
| Journeys planned/executed | 25 (N-001-N-023, U-019/U-020) |
| PASS | 23 |
| FAILED THEN FIXED + PASS | 1 (N-015) |
| EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY | 1 (N-022) |
| PRODUCT GAP CONFIRMED | 0 |
| Defects found/fixed | 1: missing disclosure that the User Access list caps at 200 rows (DEFECT-B4-001) |
| Key commits | 7b3874c (scaffold), 2966872 (fix + ledger), 0e969a3 (final report) |
| Ledger | `docs/journey-runs/BATCH_04_RESULTS.md` |

## Batch 5 Results

| Metric | Value |
|---|---|
| Journeys planned/executed | 25 (N-024-N-031, O-001-O-017) |
| PASS | 18 |
| FAILED THEN FIXED + PASS | 0 |
| EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY | 1 |
| PRODUCT GAP CONFIRMED | 6 |
| Defects found/fixed | 0 (every deviation classified as a genuine Product Gap, most notably O-011/O-012's silent primary-flag promotion no-op and N-030's ungated deactivated-role grant) |
| Key commits | 82bba22 (scaffold), 932fa29 (full ledger + seed script), 297c206 (final report), fe228b2 (deployment parity backfill) |
| Ledger | `docs/journey-runs/BATCH_05_RESULTS.md` |

## Batch 6 Results

| Metric | Value |
|---|---|
| Journeys planned/executed | 25 (O-018-O-025, P-001-P-017) |
| PASS | 20 |
| FAILED THEN FIXED + PASS | 0 |
| EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY | 0 |
| PRODUCT GAP CONFIRMED | 5 (O-018, O-020, O-023, P-012, P-013) |
| Defects found/fixed | 1 incidental: `getCurrentNexusSession` had no bounded path if `getUser()` never settled; fixed with an 8 second timeout. Trigger (clustered refresh-token errors) is a suspected, not proven, cause; see ledger for full PROVEN/SUSPECTED/NOT PROVEN breakdown (DEFECT-B6-001) |
| Key commits | ab66dc2 (scaffold), baf7026 (full ledger + fix), 17a9e5f (deployment parity backfill) |
| Ledger | `docs/journey-runs/BATCH_06_RESULTS.md` |

## TOP FINDINGS

1. **Unauthenticated Customer Master exposure (Batch 3, fixed).** The
   single highest-severity finding of the run: a real, unauthenticated
   data-exposure defect, fixed and verified before Batch 3 closed.
2. **P-013: Level 1/2/3 reference-list tiering has no server-side
   enforcement (Batch 6, Product Gap).** The UI hides the Add control
   for Level 3 system-supported lists, but a direct RPC call bypassing
   the UI succeeds unrejected. Tiering exists only in
   `reference-master-settings.tsx`'s client-facing `LIST_CONFIGS`, not
   in the database schema or service layer.
3. **O-011/O-012: `assign_user_to_team`'s idempotent pre-check silently
   swallows an intended primary-flag promotion (Batch 5, Product
   Gap).** A caller intending to promote an existing membership to
   primary gets a silent no-op instead of the promotion, with no error.
4. **N-030: `grant_user_role` has no check against `roles.is_active`
   (Batch 5, Product Gap).** A deactivated role can still be actively
   granted to a user through the RPC layer.
5. **O-018: no proactive warning when the last active member of a team
   with pending requests is removed (Batch 6, Product Gap).**
   Recovery is trivial once noticed, but nothing signals the risk at
   the moment of removal.
6. **P-012: Invoice Frequency cadence is architecturally unfrozen but
   currently dead code (Batch 6, Product Gap, latent not live).**
   `getInvoiceFrequencyCadence`, the one function that would resolve a
   live numeric cadence value, has zero real call sites; every actual
   consumer of `billing_cadence` treats it as an opaque, statically
   labeled code.
7. **Regression-critical guarantees re-confirmed correct with real,
   non-simulated evidence**: `fx_snapshot_rate` non-retroactivity for
   currency (P-009/P-010), historical preservation on deactivating a
   Level 1 or Level 3 reference value referenced by real records
   (P-006, P-015), and fresh-per-node team-membership enforcement
   across multi-level approval chains (O-005/O-015/O-016/O-018/O-019).

## PERSISTENT LEDGERS

All four batch ledgers exist, were scaffolded before execution began,
and were updated live rather than reconstructed at the end:
- `docs/journey-runs/BATCH_03_RESULTS.md`
- `docs/journey-runs/BATCH_04_RESULTS.md`
- `docs/journey-runs/BATCH_05_RESULTS.md`
- `docs/journey-runs/BATCH_06_RESULTS.md`

Every journey entry in every ledger carries its full schema (Journey
ID, personas, actions executed, actual result, every stress/authority/
concurrency/audit/recovery/UX/historical/performance variant result,
original status, defect IDs, root cause, fix, fix commit, regression
test, rerun result, neighboring journeys rerun, final status, notes).
No Original Status of FAILED was ever overwritten to hide a journey's
real history.

## REGRESSION COVERAGE ADDED

- `src/features/auth/domain/redirect-target.test.ts` (Batch 3): 6 cases
  covering open-redirect rejection and safe-path passthrough.
- Login/redirect flow tests updated for the `redirectTo` fix (Batch 3).
- `src/platform/auth/server.test.ts` (Batch 6): a fake-timer-based test
  confirming a `getUser()` call that never settles resolves to
  `{ status: "unavailable" }` within the timeout window instead of
  hanging forever.
- Batch 4's 200-row disclosure fix is a pure UI copy change verified
  live rather than via a new automated test (no existing test seam for
  list-length UI captions).

## NEW JOURNEYS ADDED

None. All 100 journeys executed this run were already defined in the
reconciled Journey Universe; no new journey definitions were
discovered or added during Batches 3-6 (unlike Batch 1's K-030, which
was a prior run's addition).

## OPEN PRODUCT GAPS

All 11, carried forward for product-owner decision, none improvised as
an architecture change during this run:

1. O-011/O-012 (Batch 5): `assign_user_to_team`'s pre-check-and-return
   idempotency silently no-ops an intended primary-flag promotion.
2. N-030 (Batch 5): `grant_user_role` has no check against
   `roles.is_active`.
3. N-031 and related permission-naming gaps (Batch 5): re-verified
   `usage.read`/`entitlement_settlement.read` scoping as specified.
4. Three further Batch 5 Product Gaps in the Teams area (see
   `BATCH_05_RESULTS.md` for the full set of 6).
5. O-018 (Batch 6): no proactive warning when a team's last active
   member is removed while a request is pending at that team's node.
6. O-020 (Batch 6): no search/filter control on the Team Master list.
7. O-023 (Batch 6): team membership history is fully intact at the
   database layer but has no viewing UI anywhere.
8. P-012 (Batch 6): Invoice Frequency cadence retroactivity is
   architecturally unresolved, currently latent rather than live.
9. P-013 (Batch 6): Level 1/2/3 reference-list tiering has no
   server-side enforcement, UI-only.

## TEST HEALTH

- `npx vitest run`: 101 test files, 910 tests, all passing as of the
  final Batch 6 checkpoint.
- `npx tsc --noEmit`: clean.
- `npx eslint .`: clean.
- `npm run build`: succeeds.
- `npm audit`: 0 vulnerabilities.
- Every checkpoint was re-run fresh at the close of each individual
  batch, not only once at the end of the whole run.

## DEPLOYMENT

- Every batch pushed only to `team-preview`; `main` was never touched.
- Every batch's local HEAD, `origin/team-preview`, and the Vercel
  Preview alias (`nexus-git-team-preview-utkarshgupta-finance.vercel.app`)
  were confirmed to match and reach a READY deployment state before
  the next batch began.
- The final confirmed state as of this report: commit
  `17a9e5f`, deployment `dpl` for that commit READY, Preview alias
  matching. Production was never deployed to, promoted, or altered at
  any point across Batches 3-6.

## EXECUTION HISTORY

- Batch 3: L-022-L-028, U-001-U-018 (commits 4b4f199, 0d0cf96, 5245db9).
- Batch 4: N-001-N-023, U-019/U-020 (commits 7b3874c, 2966872, 0e969a3).
- Batch 5: N-024-N-031, O-001-O-017 (commits 82bba22, 932fa29, 297c206,
  fe228b2).
- Batch 6: O-018-O-025, P-001-P-017 (commits ab66dc2, baf7026, 17a9e5f).
- Two pushes required explicit fresh user authorization due to public-
  repo security-disclosure content (Batch 3, Batch 6).
- Seven distinct real-shared-resource mutations required their own
  fresh `AskUserQuestion` authorization across Batches 4-6 (N-022/
  N-023, the N-022 restoration insert, N-024, O-005, P-006, O-018),
  every one restored to its original state afterward.

## BATCH 7 READINESS

**Batch 7 READY.** All four batches (3, 4, 5, 6) are fully closed:
executed, fixed where bounded, regression-covered, checkpointed clean,
committed, pushed to `team-preview`, and deployment parity confirmed.
No outstanding blockers, no unresolved checkpoint failures, no pending
authorization requests. The 11 open Product Gaps are documented
decision points for the product owner, not execution blockers for
future batches. Batch 7 was not executed, per this run's explicit
instruction to stop after Batch 6.

NEXUS END-TO-END BUSINESS JOURNEY VALIDATION BATCHES 3-6 COMPLETE
