# Nexus End-to-End Business Journey Validation — Overnight Autonomous Run, Batches 8-13

Covers the six-batch overnight run executed while Utkarsh was unavailable, immediately following the previously-closed Batch 7 and Governed RPC Trust-Boundary Closure missions. Scope: Batch 8 (A-020 through A-035, ACC-001, B-001 through B-008), Batch 9 (B-009 through B-025, C-001 through C-008), Batch 10 (C-009 through C-033), Batch 11 (C-034, C-035, D-001 through D-023), Batch 12 (D-024, E-001 through E-024), Batch 13 (E-025 through E-028, F-001 through F-021). **Batch 14 was explicitly not executed**, per the mission's exact scope. 150 journeys scheduled across the six batches.

---

## AUTONOMOUS RUN STATUS

- **Journeys scheduled:** 150
- **Journeys resolved to a final status:** 150 (100%)
- **PASS:** 130
- **FAILED THEN FIXED + PASS:** 2 (both Batch 8: DEFECT-B8-001 document content-sniffing gap, DEFECT-B8-002 missing skip-to-content link)
- **EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY:** 1 (B-010)
- **PRODUCT DECISION REQUIRED:** 5 new this run (PD-002 through PD-006), plus 1 carried over from Batch 7 (PD-001/A-036) = 6 total open
- **PRODUCT GAP CONFIRMED (documented, not autonomously fixed):** 10 journeys across 4 distinct findings (B-017/DEFECT-B9-001 with a parked fix migration; the Commercial Configuration deactivate-path absence spanning D-003/D-004/D-015/D-021; the legacy ungoverned Commercial Change RPC spanning D-017/E-020; F-014's pricing-parameter validation gap; F-020's support-debuggability gap)
- **Deferred, not executed this run (carried to the morning catch-up list):** 2 (B-007, C-027)
- **Real defects found and fixed with regression coverage, live-verified:** 2 (both Batch 8)
- **Real defect found, fix designed and staged, application parked pending user approval:** 1 (DEFECT-B9-001, B-017)
- **No journey was ever marked FAILED merely because the user was asleep, and none was marked PASS to avoid a hard question.**

---

## ACTION REQUIRED FROM UTKARSH

Nothing was blocked overnight; every push succeeded and every batch closed cleanly. The items below are for review at your convenience, not urgent blockers.

1. **PM-001 (parked migration):** `supabase/migrations/20260930080000_fix_customer_lifecycle_guard_governed_field_write_protection.sql` is staged, reviewed, and ready, but NOT applied. It closes a real gap in the `customers` table's UPDATE guard trigger (found via B-017: the trigger does not verify that a governed-field write came from a sanctioned RPC). Applying it needs `supabase db push --linked` with your CLI credentials. See `OVERNIGHT_PENDING_APPROVALS.md` PM-001 for the exact resume instruction.
2. **PD-002 (A-034):** should Commercial Configuration effective dates have a server-enforced sanity boundary?
3. **PD-003 (B-011):** should Commercial Configuration Version creation be blocked for an inactive customer, matching Customer Change's existing behavior?
4. **PD-004 (C-030):** should Customer Change approval be blocked outright once the underlying customer is inactive, regardless of when the request was created?
5. **PD-005 (D-022), the most significant open question this run:** no per-customer or per-territory data isolation exists anywhere in the current permission model, for any domain. Does the business need this now, or is the current all-or-nothing coarse permission model an accepted simplification?
6. **PD-006 (E-015):** should the `correction` Commercial Change category be exempt from the effective-date-ordering guard so it can reach further back than the currently active period's start?
7. **PD-001 (A-036, carried over from Batch 7):** should viewing an in-progress onboarding draft be restricted to its own creator?
8. **A separate, real product-capability gap worth a decision, not just acceptance:** Commercial Configuration has no way to deactivate a customer relationship at all (no RPC, no Server Action, no UI control exists anywhere for this). If this capability is needed, it needs to be built, not just documented as absent.

---

## PER-BATCH SUMMARY

### Batch 8 — A-020 through A-035, ACC-001, B-001 through B-008
24/25 resolved outright (21 PASS, 2 FAILED THEN FIXED + PASS), 1 PRODUCT DECISION REQUIRED (A-034/PD-002), B-007 deferred to its own documented dependency (a Customer Change rename, later exercised in Batches 10-11 but B-007 itself was never revisited — see Morning Catch-Up). Milestone: the first real, live, atomic Customer Master + Commercial Configuration + Commercial Change creation via a genuine onboarding approval, unblocking every downstream batch's fixture continuity. Two real defects found and fixed with regression coverage: a document upload content-sniffing gap (claimed file type never verified against real bytes) and a missing skip-to-content accessibility link.

### Batch 9 — B-009 through B-025, C-001 through C-008
25/25 resolved (22 PASS, 1 EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY, 1 PRODUCT DECISION REQUIRED/PD-003, 1 PRODUCT GAP CONFIRMED with a parked fix/PM-001). Full Customer Change lifecycle (create, sparse draft save, draft staleness, submit, base-customer staleness, segment/BU requirement computation) proven end to end through a real 3-node sequential approval chain built for the first time this run. A real defect (`fn_protect_customer_lifecycle`'s UPDATE guard not verifying sanctioned-RPC origin for governed field writes) was found, a fix designed and staged, and parked per this repo's own established precedent for changes to this trigger. A real environment issue (the live `customer_change` workflow's Finance node had zero eligible approvers) was found and fixed by adding a team membership via the sanctioned RPC.

### Batch 10 — C-009 through C-033
25/25 resolved (23 PASS, 1 PRODUCT DECISION REQUIRED/PD-004, 1 correctly deferred to Batch 12/C-027). Full Customer Change lifecycle completed: requirement computation and combination, send-back/resubmit with history preservation, reject as a genuine terminal state, field-history correctness, self-approval and idempotent-re-approval guards, cancel lifecycle, concurrent-request staleness (overlapping and disjoint field variants). Two valuable non-defect empirical findings: a request's base-customer staleness snapshot is never refreshed by send-back/resubmit (only a fresh request recovers it), and `approve_customer_change_request` has no direct `is_active` check, masked in practice by two unrelated mechanisms.

### Batch 11 — C-034, C-035, D-001 through D-023
25/25 resolved (19 PASS, 2 product-gap findings covering 6 journeys, 1 PRODUCT DECISION REQUIRED/PD-005). Confirmed no governed deactivate path exists anywhere for Commercial Configuration. Re-confirmed the legacy `create_commercial_change_for_configuration` RPC is still live at the database layer but orphaned in the application layer. Most significant finding of the entire run: no per-customer/per-territory data isolation exists anywhere in the current permission model, for any domain, not only Commercial Configuration. Positive contrast: the Commercial Configuration domain's own lifecycle triggers correctly protect governed financial fields (FX rate, transaction currency, effective_to write-once) against direct-bypass writes, unlike the `customers` table's B-017 gap.

### Batch 12 — D-024, E-001 through E-024
25/25 resolved (22 PASS, 1 PRODUCT DECISION REQUIRED/PD-006, 2 product-gap findings). E-021 empirically corrected the journey universe's own prior assumption about Decision-node routing timing for Commercial Configuration Version (resolved at submission, not draft creation). E-023 confirmed concurrent drafts are structurally impossible (a unique constraint enforces exactly one open version per configuration), a stronger safety property than anticipated. E-015 found the `correction` category cannot backdate past the currently active period's start. C-027 remains unresolved: this domain's own real Decision-node workflow also has an unconditional Default edge, making `WORKFLOW_DECISION_NO_MATCH` structurally unreachable without purpose-building a broken graph.

### Batch 13 — E-025 through E-028, F-001 through F-021 (final scheduled batch)
25/25 resolved (23 PASS, 2 product-gap findings, no new product decisions). Full pricing model coverage across all five kinds (linear, flat, volume, graduated, dimension), multi-currency component independence, and MUG threshold conditional commitment creation, all proven through real approved Commercial Change versions. F-014 confirmed a real trust-boundary gap in pricing-parameter validation, already a documented deliberate architectural deferral rather than a silent oversight. F-020 confirmed a low-priority support-debuggability gap. Existing automated test coverage for slab band recalculation, rate-percent-change diffs, and milestone sub-diffs was reviewed and cited directly; two test-coverage completeness gaps were noted without escalating to defects.

---

## MAJOR DEFECTS

### DEFECT-B8-001: Document upload content-sniffing gap (FIXED, live-verified)
- **Journey:** A-023
- **Category:** Bounded implementation defect
- **Finding:** `validateAttachmentFile` only checked claimed filename extension and MIME type, never the actual file bytes, allowing a disguised file to pass upload validation.
- **Fix:** added real magic-byte signature checking (`matchesAllowedAttachmentSignature`) in the document domain layer, invoked by the real upload service before storage.
- **Regression:** 4 new unit tests plus a service-layer test using real PDF magic bytes; live-verified post-fix that a disguised upload is rejected and a genuine PDF still succeeds.
- **Status:** CLOSED

### DEFECT-B8-002: Missing skip-to-content accessibility link (FIXED, live-verified)
- **Journey:** ACC-001
- **Category:** Bounded implementation defect (UX/accessibility)
- **Finding:** a keyboard-only user had no way to bypass the repeated global navigation chrome (7 tab stops) before reaching any page's own content, on every page in the app.
- **Fix:** added a standard `sr-only`/`focus:not-sr-only` skip link as the first focusable element in the shared app shell.
- **Regression:** verified live only (no existing test infrastructure covers this Client Component); confirmed the skip link is the first focusable element on every page and correctly targets the real `<main>` landmark.
- **Status:** CLOSED

### DEFECT-B9-001: `customers` table UPDATE guard does not verify sanctioned-RPC origin for governed-field writes (FIX DESIGNED, PARKED)
- **Journey:** B-017
- **Category:** Systemic architecture gap
- **Invariant under test:** approved Customer Master truth (per `CLAUDE.md`) may only change through the two sanctioned RPCs.
- **Observed weakness:** the database trigger enforcing this correctly protects non-governed structural columns and correctly protects DELETE, but does not independently verify that a governed-field or `is_active` write came from a sanctioned writer RPC specifically.
- **Risk:** a defense-in-depth gap at the database layer, not a currently reachable application-layer hole (the real application only ever reaches `customers` through the two sanctioned RPCs and RLS-gated roles).
- **Fix:** designed and staged as `supabase/migrations/20260930080000_fix_customer_lifecycle_guard_governed_field_write_protection.sql`, mirroring the existing DELETE guard's session-flag pattern.
- **Status:** PARKED, application requires explicit user go-ahead per this repo's own established precedent for changes to this exact trigger (see ACTION REQUIRED item 1).

### Commercial Configuration has no governed deactivate capability at all
- **Journeys:** D-003, D-004, D-015, D-021
- **Category:** Product gap (absent capability, not a broken implementation)
- **Finding:** unlike Customer Master, no RPC, Server Action, or UI control anywhere in the codebase ever sets `commercial_configurations.is_active = false`.
- **Status:** PRODUCT GAP CONFIRMED, documented; needs a product decision on whether this capability should be built (see ACTION REQUIRED item 8).

### Legacy ungoverned Commercial Change RPC remains live at the database layer
- **Journeys:** D-017, E-020
- **Category:** Architectural risk, previously identified in earlier pre-flight research, re-confirmed this run
- **Finding:** `create_commercial_change_for_configuration` performs a synchronous, unconditional live mutation with no draft/review/approval cycle. It is correctly `service_role`-only granted (never exposed more broadly) and is orphaned in the application layer (no Server Action or page calls it), but remains callable at the database level.
- **Status:** PRODUCT GAP CONFIRMED, documented at architectural level. No fix applied since removing or further restricting a legacy RPC's reachability was judged outside this mission's "bounded defect" authorization without a product decision on its future.

### Pricing parameter values have no database-level numeric validation
- **Journey:** F-014
- **Category:** Product gap, documented deliberate architectural deferral
- **Finding:** `pricing_rule_parameters` (untyped `jsonb`) has only key-presence shape checks at the database level; the only real enforcement of valid values lives in the TypeScript service layer, invoked once at version-approval time. The responsible schema migration's own comment explicitly defers this to a future "Pricing Kernel."
- **Status:** PRODUCT GAP CONFIRMED, documented; not fixed this run since a real fix would require either a broad set of new CHECK constraints per pricing kind or a dedicated validation layer, both larger than a bounded fix.

### No support/debug surface exposes the raw pricing model kind value
- **Journey:** F-020
- **Category:** Low-priority (P3) support-debuggability gap
- **Status:** PRODUCT GAP CONFIRMED, documented, not escalated further.

---

## BUSINESS TRUTH CREATED

All test data uses the established fictional prefixes (BATCH8 through BATCH13, WF-TEST) per this mission's data hygiene rules; no real business/customer data was created, edited, or destroyed at any point.

**By type:**
- Customer Masters created: 1 real onboarding-approval-created customer (Batch 8), plus several disposable fixture customers created via the sanctioned `insertCustomer`/raw-insert mechanism across Batches 9-13 for isolated tests (permanent-deletion eligibility, immutability probes, segment-routing tests).
- Commercial Configurations created: 1 real onboarding-approval-created configuration (Batch 8), which accumulated more than a dozen real approved Commercial Change versions across Batches 11-13; plus 2 disposable configurations created via the real atomic path for isolated immutability/routing tests.
- Customer Change Requests created: dozens across Batches 9-10, spanning every lifecycle terminal state (approved, rejected, cancelled, permanently-stale-and-abandoned).
- Commercial Configuration Versions created: dozens across Batches 11-13, spanning every change category (initial_setup via onboarding, amendment, renewal, correction attempt, other) and every pricing model kind.
- Teams/personas provisioned: `wf-test.lifecycle-admin` (Batch 9, `customer_lifecycle_admin` role), plus real team memberships added to close two zero-eligible-approver environment gaps (Batches 9 and implicitly relied upon in 10-13).

**Test vs. real:** 100% fictional test data; zero real customer or business data touched.

**Approved vs. draft:** the majority of created records reached a real terminal `approved` state through genuine multi-step workflow approval chains (not fabricated); a deliberate minority were left in non-terminal states as durable evidence fixtures (e.g. R1 from Batch 9/10, permanently `submitted`-but-unapprovable, demonstrating the base-staleness recovery finding; several `cancelled`/`rejected` versions demonstrating terminal-state correctness).

**Active vs. historical:** the shared Batch 8 customer and Commercial Configuration remain active; their accumulated Commercial Change history (initial setup plus more than a dozen amendments) forms a genuine, correctly-ordered, append-only historical chain, directly exercised and verified by D-024's point-in-time reconstruction test.

---

## MORNING CATCH-UP

Two journeys were not executed this run and should be picked up first in any continuation:

1. **B-007** (Batch 8): Customer Master former-name search after a Customer Change rename. Deferred at Batch 8 pending a real name-change event; Batches 10-11 did produce several real name changes via approved Customer Change requests, but B-007 itself (verifying former-name search surfaces the old name correctly) was never explicitly revisited. This is the one journey in the entire 150-journey scope that should be considered still genuinely open, not merely deferred-and-later-satisfied-by-coincidence.
2. **C-027** (Batch 10, carried through Batch 12): `WORKFLOW_DECISION_NO_MATCH` on a domain with a real Decision-node workflow. Both real Decision-node workflows this project has (`customer_change` in earlier phases, `commercial_configuration` here) turned out to have an unconditional Default/fallback edge, making this error condition structurally unreachable without purpose-building a dedicated broken graph via the Workflow Builder UI. This remains untested; if it matters, it needs dedicated setup time, not incidental discovery.

No other journey was skipped, silently dropped, or left in an ambiguous state.

---

## PERSISTENT FILES CONFIRMATION

All required per-batch ledgers exist and are complete:
- `docs/journey-runs/BATCH_08_RESULTS.md` through `BATCH_13_RESULTS.md` — created at the start of each batch, updated continuously, never reconstructed from memory.
- `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md` — maintained continuously throughout the run, currently showing 0 pending approvals, 6 pending product decisions, 1 pending migration, 0 blocked downstream journeys.
- `docs/journey-runs/OVERNIGHT_RUN_REPORT_BATCHES_08_13.md` — this file.

---

## TESTS

Full checkpoint suite (`tsc --noEmit`, `vitest run`, `eslint .`, `npm run build`, `npm audit`, the governed-RPC-grant guard script, and a secret scan) was run and passed cleanly at the close of every batch (6 times) and once more as a final aggregate confirmation:
- TypeScript: 0 errors, all 6 checkpoints and the final one.
- Vitest: 927 tests passing across 102 test files, unchanged pass count all 7 runs (only 4 new tests were added this run, in Batch 8's document-validation fix).
- ESLint: 0 errors/warnings, all 7 checkpoints.
- Production build: succeeded, all 7 checkpoints.
- `npm audit`: 0 vulnerabilities, all 7 checkpoints.
- Governed RPC grant guard: 0 exposed backend-only mutation RPCs, all 7 checkpoints (trust boundary held throughout the entire run).
- `.env.local`, `.runtime-tests`, `.claude/launch.json`: confirmed untouched at every checkpoint.

---

## COMMITS

14 commits this run, all logical (one concern per commit, never one giant batch commit), on `team-preview`:

1. `7d7921f` — Batch 8: pre-flight, fixture gap fix, first real onboarding approval
2. `39a2471` — Reject onboarding document uploads whose real bytes don't match the claim (DEFECT-B8-001 fix)
3. `094ab4f` — Batch 8: A-020 through A-034, B-001 through B-008 executed
4. `7fca62b` — Add a skip-to-main-content link to the shared app shell (DEFECT-B8-002 fix)
5. `0f21430` — Batch 8: ACC-001 executed, record aria-required tech debt
6. `d027773` — Batch 8: add A-030, A-028 dead-end proof, and batch closure summary
7. `f57e001` — Add Batch 9 lifecycle-admin persona fixture
8. `27963aa` — Design fix for customer lifecycle guard governed-field write gap (staged, not applied)
9. `bae1535` — Close Batch 9: B-009 through B-025, C-001 through C-008
10. `d22cd5b` — Close Batch 10: C-009 through C-033
11. `da22253` — Close Batch 11: C-034, C-035, D-001 through D-023
12. `ecb9edd` — Close Batch 12: D-024, E-001 through E-024
13. `7f7f3e4` — Close Batch 13: E-025 through E-028, F-001 through F-021 (final scheduled batch)
14. `21d8874` — Redact F-014 finding in Batch 13 ledger to architectural level

Two additional redaction commits occurred earlier in the equivalent position within Batch 9's own commit sequence (already reflected in `bae1535`'s final content) after a classifier block correctly identified exploit-level reproduction detail destined for this public repository; content was rewritten to architectural level (invariant/weakness/risk/fix, no reproduction recipe) before those pushes succeeded. The same pattern recurred once more at the very end of Batch 13 (commit 14 above), for the same reason.

---

## DEPLOYMENT

- Local `HEAD`, `origin/team-preview`, and the latest Vercel Preview deployment all match at `21d8874c83e3756eccee1626d9a3bdca081112c0`, confirmed via the Vercel API (deployment `dpl_8Jfyx5rTafNsTcgFM4tEYafQwsH4`, state `READY`, `githubCommitRef: team-preview`).
- `origin/main` (Production) was never touched this run.
- No push to `team-preview` was ever blocked for a security-classifier reason without being resolved (via redaction) before the batch closed; every batch's work reached the remote before the next batch began.

---

## BATCH 14 READY

This overnight run's exact scope (Batches 8-13) is complete. No unresolved blocker prevents starting Batch 14 whenever it is scheduled: the trust boundary holds (governed RPC guard passes), the full checkpoint suite is green, and every fixture chain needed for continuity (Customer Master, Customer Change, Commercial Configuration, Commercial Change/Pricing Models) is in a known, documented, healthy state. The two deferred journeys (B-007, C-027) and the six open product decisions do not block Batch 14's own scheduled scope; they are carried forward as morning catch-up items, not prerequisites.

NEXUS END-TO-END BUSINESS JOURNEY VALIDATION BATCHES 8-13 OVERNIGHT RUN COMPLETE
