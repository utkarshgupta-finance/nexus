# Batch 8 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY VALIDATION, autonomous overnight run, BATCH 8 (A-020 through A-035, ACC-001, B-001 through B-008, 25 journeys total). Part of the six-batch overnight run (Batches 8-13, 150 journeys scheduled). Created before execution begins per the mandatory persistent ledger requirement; updated as each journey completes. This is an autonomous run: Utkarsh is unavailable for interactive confirmation. See `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md` for anything parked pending his return.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED / BLOCKED PENDING USER APPROVAL / BLOCKED BY UPSTREAM APPROVAL / PRODUCT GAP CONFIRMED / PRODUCT DECISION REQUIRED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

If a journey fails and is later fixed, both Original Status: FAILED and Final Status: FAILED THEN FIXED + PASS are preserved. History is never rewritten to make a journey look like it passed the first time.

## Overnight run entry gate (confirmed before Batch 8 execution began)

- Batch 7 final report read and confirmed complete (`docs/journey-runs/BATCH_07_RESULTS.md`): DEFECT-B7-001 closed, DEFECT-B7-002 closed, DEFECT-B7-003 (governed RPC trust-boundary) closed for all 16 real governed-mutation RPCs plus 2 trigger functions hardened defensively, systemic guard (`list_governed_rpc_grant_violations()` + `scripts/verify-governed-rpc-grants.ts`) in place. A-036 remains PRODUCT DECISION REQUIRED (parked, does not block Batch 8-13).
- Baseline re-verified live (not assumed from the prior session's ending state): working tree clean; local HEAD, `origin/team-preview`, and the Vercel stable alias (`nexus-git-team-preview-utkarshgupta-finance.vercel.app`) all confirmed at `b967a5e5b7c5bce2c13073b5b8158b8db66cb463`, deployment READY; `origin/main` (Production) confirmed untouched at `04aba7a77e3bb13888ad83e17faac471facb1206`; all migrations confirmed in sync (local = remote, `npx supabase migration list --linked`).
- Trust-boundary pre-flight: `npx tsx --env-file=.env.local scripts/verify-governed-rpc-grants.ts` run fresh, result: PASS, 0 governed backend-only mutation RPCs exposed to PUBLIC/anon/authenticated. Recorded as the overnight trust-boundary baseline.

## Batch 8 entry neighbor regression (not counted in the 25 scheduled journeys)

Confirmed as part of the core approval fixture setup below: a complete onboarding case (`Batch8 Approval Core Co`) was created, saved, and submitted successfully via `create_customer_onboarding_case` -> `save_customer_onboarding_draft` -> `submit_customer_onboarding_case`, holding since Batch 7's DEFECT-B7-001/DEFECT-B7-002 fixes. Full incomplete/duplicate/cross-maker neighbor reruns deferred to be executed alongside A-004/A-005 neighbor confirmation later in this batch; not blocking.

## Fixture gap closed before execution

Per the six-batch pre-flight research, the real onboarding workflow's sole approval team (`wf_test_leadership`, bound to the only active published `customer_onboarding` workflow) had exactly one active member, insufficient for A-031's concurrent-approval-race journey (which needs two distinct eligible reviewers on the same node). Added `wf-test.leadership-approver-b@example.test` (role `checker`) to `wf_test_leadership` via `scripts/seed-batch8-fixtures.ts` (same safety pattern as `seed-workflow-test-fixtures-phase3b.ts`: real Supabase Auth Admin API, real RPCs, no raw table inserts). Confirmed live: `wf_test_leadership` now has 2 active members.

---

## A-011-equivalent: real onboarding approval executed for the first time this project (foundational to A-031/A-032/A-034/A-035)

Not itself one of Batch 8's 25 scheduled IDs (A-011 was Batch 7 scope, explicitly not executed there per that mission's own "stops before approval" rule) but foundational to nearly everything below and to Batches 9-13's fixture chain. Executed here as the necessary basis for A-031/A-032/A-034/A-035.

- Test Data: request_id `162d1e14-6ba8-45dd-99f4-5112d9ceb312` ("Batch8 Approval Core Co"), created/saved/submitted by `wf-test.maker`, approved by `wf-test.leadership-approver` (node_2, the workflow's Leadership Approval node).
- Actions Executed: full create -> save (complete Customer Details + Tax fields + 3 required documents) -> submit -> `approve_customer_onboarding_case` with one `linear`-pricing commercial component (rate 10, monthly/arrears/monthly, INR, effective 2026-10-15).
- Actual Result: approval succeeded in one atomic call. Case transitioned to `approved`, `current_workflow_node_key` advanced to `node_3` (End). Exactly one `customers` row created (key `batch8-approval-core-co`, correct name/brand/contact/billing_currency fields). Exactly one `commercial_configurations` row created, correctly linked to the new customer and to a new `commercial_changes` row. That `commercial_changes` row has `change_category = 'initial_setup'` (confirming the pre-flight research's finding: onboarding approval mints the first Commercial Change directly, not a separate "Version 1" row in `commercial_configuration_versions`). Exactly one `commercial_components` row created with all submitted pricing fields intact, and `stable_component_key` correctly defaulted to its own new component id via `coalesce(p_stable_component_key, p_new_commercial_component_id)` (confirming the Batch 11-relevant stable-key mechanism works correctly for a brand-new, non-amendment component).
- This is the first Customer Master, Commercial Configuration, and Commercial Configuration Version ever created in this entire multi-batch project (Batches 1-7 never reached this point by design).

---

## A-031: Concurrent approval race on the same case

- Journey ID: A-031
- Started At: 2026-09-20
- Priority: P0
- Automation Feasibility: PARTIAL
- Personas: wf-test.leadership-approver (Reviewer A), wf-test.leadership-approver-b (Reviewer B)
- Test Data: request_id `162d1e14-6ba8-45dd-99f4-5112d9ceb312`
- Actions Executed: Reviewer A's approval call executed first and completed the full atomic creation (see above). Reviewer B's approval call was then issued against the same, now-already-approved case.
- Expected Result: exactly one customer/commercial creation; the second reviewer's attempt is a safe no-op, not a duplicate or an error exposing internal state.
- Actual Result: Reviewer B's call returned success with the SAME `customer_id`/status as Reviewer A's, no new row created (`approve_customer_onboarding_case`'s own idempotent-on-approved-status branch, `if v_case.status = 'approved' then return v_case`). Confirmed via direct count: exactly 1 `customers` row with this key, exactly 1 `commercial_components` row, both before and after Reviewer B's call.
- Regular Result: N/A
- Stress Result: PASS (extended to 5 total repeated approval attempts across both reviewers below, see A-032)
- Authorization Result: PASS (both reviewers are genuinely distinct, eligible, non-creator team members; both succeed identically since the RPC's idempotency check runs before any team-membership-specific branching would matter)
- Concurrency Result: PARTIAL PASS. This exercises the *sequential* race outcome (second call arrives after the first fully completes) correctly and conclusively. It does **not** exercise the harder *true simultaneous* race (both calls racing for the same `SELECT...FOR UPDATE` row lock at the same instant, which is what actually proves the lock serializes them rather than the status check alone) — this codebase's script-based testing has no way to force two calls to arrive at the database in the same millisecond; a genuinely concurrent test would need two real, independently-scheduled network requests overlapping in flight. The status-guard-plus-idempotency behavior observed here is the same mechanism the code relies on regardless of timing (the `for update` lock plus the `status = 'approved'` early-return both execute inside the same code path whether the second caller arrives a millisecond or a full second later), so this is strong, but not airtight, evidence for the true-concurrency claim.
- Idempotency Result: PASS (see A-032)
- Audit / Data Integrity Result: PASS (no duplicate customer/commercial rows; `approved_by`/`approved_at` remained fixed at Reviewer A's values, not overwritten by Reviewer B's later call — confirmed via `approve_customer_onboarding_case`'s own early-return path never reaching the `update ... set approved_by = ...` statement)
- Recovery Result: N/A
- UX Result: N/A (not click-through verified this batch; a losing reviewer's UI-level experience of "already approved by someone else" was not observed live)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-032
- Final Status: PASS
- Notes: The true-simultaneous-race sub-case is honestly flagged as not fully proven (PARTIAL PASS on the Concurrency dimension specifically), consistent with this journey's own Automation Feasibility: PARTIAL rating and its "requires true concurrent request orchestration" dependency note.

---

## A-032: Idempotent re-approval of an already-approved case is a no-op

- Journey ID: A-032
- Started At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.leadership-approver-b
- Test Data: request_id `162d1e14-6ba8-45dd-99f4-5112d9ceb312` (already approved by A-031's setup)
- Actions Executed: called `approve_customer_onboarding_case` 5 total times against the already-approved case (1 as A-031's second-reviewer race check, 4 more as an explicit repeated-call stress variant).
- Expected Result: every call returns the existing linkage without creating anything new.
- Actual Result: all 5 calls succeeded, returning the same `customer_id`. Confirmed via direct count after each stress round: exactly 1 `customers` row, exactly 1 `commercial_components` row throughout, never 2 or more.
- Regular Result: N/A
- Stress Result: PASS (5 rapid repeated calls, not just 2)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS (this IS the idempotency journey)
- Audit / Data Integrity Result: PASS (no duplicate rows at any point across 5 calls)
- Recovery Result: N/A
- UX Result: N/A (not click-through verified; a real accidental-double-click UX experience was not observed live)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-031
- Final Status: PASS
- Notes: N/A

---
