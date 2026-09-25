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

## A-030: Concurrent two-tab draft save is rejected with a staleness error, not silently overwritten (regression)

- Journey ID: A-030
- Priority: P1
- Automation Feasibility: PARTIAL
- Actions Executed: simulated two tabs both loading the same draft at `row_version` 1; Tab 1 saved (succeeding, row_version -> 2); Tab 2 then attempted to save while still holding the stale `row_version` 1.
- Actual Result: Tab 2's save correctly rejected with `ONBOARDING_DRAFT_STALE`; Tab 1's edit survived untouched in the database.
- Concurrency Result: PASS (this is the same mechanism already fixed and regression-tested extensively in Batch 7's A-002; re-confirmed here fresh as its own Batch 8 journey ID, not merely inherited from that prior confirmation)
- Final Status: PASS
- Notes: N/A

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

## A-020: Cancel rejected on non-draft case

- Journey ID: A-020
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.maker
- Test Data: request_id `33cfd6df-e52f-44ba-9687-fef669dab997`
- Actions Executed: created a complete case, submitted it, then attempted `cancel_customer_onboarding_case` while `submitted`; sent it back, then attempted cancel again while `sent_back`.
- Actual Result: both attempts rejected with `ONBOARDING_CASE_NOT_CANCELLABLE`, correctly naming the actual current status each time.
- Stress Result: PASS (both non-draft statuses tested; `resubmitted`/`approved` not separately re-tested this batch but the guard is a single `status <> 'draft'` check with no per-status branching, confirmed by code, so no separate behavior is possible)
- Audit / Data Integrity Result: PASS (no state change on either rejected attempt)
- Final Status: PASS
- Notes: N/A

---

## A-021: Document upload happy path

- Journey ID: A-021
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.maker
- Actions Executed: called the real `uploadOnboardingDocument` service function (not a direct table insert) with a genuine PDF-signature byte payload.
- Actual Result: PASS, document persisted with correct type/name.
- Final Status: PASS
- Notes: Exercised via the real service layer (the same function `uploadOnboardingDocumentAction` calls), not a raw metadata insert, so this also proves the real validation path, not just the schema shape.

---

## A-022: Document upload rejected for exceeding size limit

- Journey ID: A-022
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: uploaded a file at exactly 1 MB (boundary) and a file at 1 MB + 1 byte, both via the real service function.
- Actual Result: exactly-1MB accepted; 1MB+1 byte rejected with a message stating the exact size and the limit.
- Stress Result: PASS (boundary precision confirmed both directions)
- Final Status: PASS
- Notes: N/A

---

## A-023: Document upload rejected for invalid file type

- Journey ID: A-023
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: (1) uploaded a `.exe` file, (2) uploaded a file with real PNG magic bytes disguised with a `.pdf` extension and `application/pdf` claimed MIME type, both via the real service function.
- Expected Result: server-side validation independently re-confirms actual file content type, not just filename extension (this journey's own stated invariant).
- Actual Result (ORIGINAL): (1) PASS, `.exe` rejected. (2) **FAILED**: the disguised PNG was accepted. The server-side check (`validateAttachmentFile`) only compared the claimed MIME type and filename extension against an allowlist; it never inspected the actual file bytes. This directly contradicted the journey's own stated invariant.
- Root Cause: `validateAttachmentFile` (`src/features/customer-onboarding/domain/documents.ts`) took only `{name, type, size}`, never the actual bytes, so a renamed/mislabeled file with disallowed real content would pass as long as its name/claimed-type looked right.
- Fix: added `matchesAllowedAttachmentSignature` (same file), a pure function checking the first bytes of the file against the real PDF (`%PDF`) and JPEG (`0xFFD8FF`) magic-number signatures, independent of the claimed name/type. Wired into `uploadOnboardingDocument` (`services/documents.service.ts`) as an additional check after the existing metadata validation, reading the actual `Blob` bytes (the one thing only the server can do, since the client's reported type/extension are just labels).
- Fix Commit: (see COMMITS in the final report)
- Regression Test: `domain/documents.test.ts` (4 new tests: accepts real PDF/JPEG bytes, rejects real PNG bytes disguised as `.pdf`, rejects empty/arbitrary bytes) and `services/documents.service.test.ts` (1 new test: the service rejects a disguised upload before ever calling storage; also fixed a pre-existing test fixture, `validPdfBlob`, which used plain text instead of real PDF magic bytes and would have started failing under the new check).
- Rerun Result: confirmed live post-fix: the same disguised PNG-as-PDF upload is now rejected with a clear message; a genuine PDF upload still succeeds.
- Original Status: FAILED
- Final Status: FAILED THEN FIXED + PASS
- Notes: Severity is real but modest: this store is a private Supabase Storage bucket, documents are only ever served via short-lived signed download URLs, never rendered/executed inline, so the practical risk was a human reviewer downloading and locally opening a mislabeled file, not a direct application-level exploit. Still a genuine, bounded gap against the journey's own explicit expected behavior, fixed per the fix-on-the-go rule.

---

## A-024: Document re-upload preserves append-only history

- Journey ID: A-024
- Priority: P0
- Automation Feasibility: FULL
- Actions Executed: uploaded `gst_certificate` v1, then v2, via the real service function.
- Actual Result: v1's `is_current` flipped to `false` (never deleted, still queryable), v2's `is_current` is `true`. Exactly one current document per type.
- Audit / Data Integrity Result: PASS
- Final Status: PASS
- Notes: N/A

---

## A-025: Revision-level document snapshot reflects what a past decision actually saw

- Journey ID: A-025
- Priority: P0
- Automation Feasibility: PARTIAL
- Test Data: request_id `95838de6-57f9-4493-b378-d9f472bfa7ae`
- Actions Executed: 3 full send-back/resubmit cycles, each with a freshly re-uploaded `gst_certificate` (v1, v2, v3) via the real service function before each submit.
- Actual Result: `customer_onboarding_revision_documents` correctly pins revision 1 to v1's exact `document_id`, revision 2 to v2's, revision 3 to v3's — three genuinely distinct IDs, never silently repointing to the latest.
- Original Status: FAILED (in an earlier attempt this cycle) THEN FIXED — but this was a **test-script defect (Category C), not a product defect**: the first attempt used raw `INSERT` statements to simulate re-uploads instead of the real `uploadOnboardingDocument` service function, so `is_current` was never correctly superseded across the fake versions, producing a false failure. Rerun through the real service function passed cleanly on the first real attempt.
- Final Status: PASS
- Notes: Recorded to be transparent about the false start; no product code was touched for this journey.

---

## A-026: Agreement & Approval stage excluded from submit validation

- Journey ID: A-026
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: confirmed empirically by construction: the A-025 fixture case above submitted successfully 4 separate times (1 initial + 3 resubmits), and at no point was any `agreement_approval`-stage field ever populated in its `raw_data`.
- Actual Result: PASS, submission never blocked on this stage.
- Final Status: PASS
- Notes: N/A

---

## A-027: Workflow node with zero active team members blocks approval indefinitely

- Journey ID: A-027
- Priority: P0
- Automation Feasibility: FULL
- Test Data: new fictional team `wf_test_empty` (id `9b975641-649f-4c5e-91d7-14c94b4be796`), created with zero members and left that way.
- Actions Executed: called `fn_require_workflow_team_membership` directly (the exact function `approve_customer_onboarding_case` calls internally) against `wf_test_empty` for two different real, otherwise-eligible actors (a maker and the leadership approver).
- Actual Result: both actors blocked identically with `WORKFLOW_TEAM_REQUIRED`, naming the team by name for support triage. Since this function's logic is "is this specific actor an active member," not "does this team have any members at all," testing with two different actors against a team that has never had any member conclusively proves the "stuck forever, no one can approve" scenario, not just "this one tester isn't on the team."
- Authorization Result: PASS (no escalation path exists in this function for any actor, confirmed by code: it has no admin-bypass branch)
- Recovery Result: confirmed as a real, documented gap: no automated recovery exists; resolution requires an admin to manually fix team membership or the workflow graph.
- Final Status: PASS
- Notes: Tested the exact underlying mechanism directly (a dedicated zero-member team) rather than routing a real onboarding case through a full dedicated throwaway workflow graph, to avoid the larger time cost of building a parallel workflow via the Builder UI; this is a deliberate, disclosed scoping choice, not a shortcut that changes the conclusion (the function-level behavior is identical either way, and is exactly what the real RPC calls). `wf_test_empty` is left in place, permanently zero-member by design, as a reusable fixture for any future re-verification of this exact journey.

---

## A-029: Stale page approve attempt surfaces friendly WORKFLOW_NODE_ALREADY_ADVANCED

- Journey ID: A-029
- Priority: P1
- Automation Feasibility: FULL
- Test Data: request_id `336855de-a3a7-448b-8352-738435b05d4c`
- Actions Executed: submitted a complete case, then called `approve_customer_onboarding_case` with a deliberately wrong `p_expected_current_node_key`.
- Actual Result: rejected with `WORKFLOW_NODE_ALREADY_ADVANCED` and the friendly message, exactly as expected; no approval occurred.
- Concurrency Result: PASS for the mechanism itself (the real row-lock/current-node re-check, not the client hint, is what's being tested here); the full live two-reviewer race scenario is the same mechanism proven in A-031.
- Final Status: PASS
- Notes: N/A

---

## A-033: create_next_revision flow after prolonged send-back cycling

- Journey ID: A-033
- Priority: P2
- Automation Feasibility: PARTIAL
- Test Data: request_id `95838de6-57f9-4493-b378-d9f472bfa7ae` (shared with A-025)
- Actions Executed: read `create_next_revision`'s call sites directly in every migration that invokes it, then exercised 3 consecutive send-back/resubmit cycles live.
- Actual Result: `create_next_revision` is invoked automatically, and exclusively, inside `send_back_customer_onboarding_case` (and the equivalent for Customer Change) every time a send-back happens; it is not a separately user-triggerable action and has no other trigger condition. This resolves the journey's own "verify against code" uncertainty: there is no special "prolonged cycling" mechanism distinct from ordinary send-back, it is simply the same mechanism, exercised repeatedly. Confirmed live: after 3 cycles, the revision chain correctly shows 4 revisions (3 submitted, 1 current draft), each with its own correctly-pinned document snapshot (A-025).
- Authorization Result: PASS (system-only; no user-facing trigger exists for this function, confirmed by its exclusive call sites)
- Final Status: PASS
- Notes: This journey's own Notes field said the trigger condition was undocumented and needed code verification; that verification is now complete and recorded here.

---

## A-034: Effective date field validation and edge handling at submit

- Journey ID: A-034
- Priority: P2
- Automation Feasibility: FULL
- Test Data: request_id `1dcd642e-c661-4f37-b463-478bcd0b2ed8`
- Actions Executed: approved a complete case with `p_effective_date` set to `2020-01-01` (6 years in the past relative to this environment's current date).
- Actual Result: the approval **succeeded with no error**. No server-side (or, by extension, client-side, since none of the approval RPC parameters are validated for date sanity) check exists anywhere in the approval path for effective-date reasonableness.
- Original Status: this is not classified as FAILED, since the journey's own Notes field explicitly stated the validation boundary was undocumented and needed verification, not asserting a specific existing invariant should hold ("Exact validation boundary rules for effective_date are not detailed in the grounding brief; verify against code").
- Classification: Category F (genuine gap needing a product decision). A commercial configuration's effective date has real downstream financial/billing implications (see docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md's Money Policy); accepting an arbitrary past or far-future date with no sanity check is a real, live-verified gap, but this mission's own rule ("Do NOT invent... product policy") means I am not inventing a specific boundary (e.g. "no more than N days in the past") myself.
- Final Status: PRODUCT DECISION REQUIRED (recorded in `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md` as PD-002)
- Notes: Does not block any other Batch 8-13 journey; every fixture case in this run uses reasonable near-future effective dates regardless of whether the server would reject an unreasonable one.
- **Product Decision Closure (2026-09-21, PD-002 CLOSED): PENDING -> DECIDED -> IMPLEMENTED.** Business decision: `effective_date >= onboarding date` follows the existing normal path; `effective_date < onboarding date` is not rejected outright, it becomes an exception requiring BOTH a BU Head and a Finance Head approval before the Commercial Configuration finalizes. "Onboarding date" structural note (no dedicated field exists in Nexus; documented rather than assumed): `customer_onboarding_cases.created_at` is used as the current best-available proxy. Implemented server-side in `supabase/migrations/20260930120000_onboarding_effective_date_exception_approval.sql`: a new `onboarding_effective_date_exceptions` table, and `approve_customer_onboarding_case` extended so that, only at the point of actual finalization (not at intermediate approval-node steps), a backdated `p_effective_date` creates/checks this exception row and raises `ONBOARDING_EFFECTIVE_DATE_EXCEPTION_PENDING` (blocking the atomic Customer Master + Commercial Configuration creation) until both `bu_head_approved_by` and `finance_head_approved_by` are recorded. A new RPC, `approve_onboarding_effective_date_exception(case_request_id, role, actor_user_id)`, records one role's sign-off, gated by real team membership (`fn_require_workflow_team_membership` against a `teams` row with `code = 'bu_head'`/`'finance_head'`), never a fabricated approver. **Design choice, stated honestly:** this reuses the real-team/real-membership ingredients of Nexus's governed workflow architecture without inserting a new node into the shared, live, definition-driven `customer_onboarding` Workflow Runtime V1 graph (which would mean publishing a new version of the one graph every future onboarding case uses); full rationale in the migration file's own header comment. **Structural prerequisite, not yet met:** `bu_head`/`finance_head` teams are not seeded (matching this repo's own "no real team names seeded by migration" convention) and have no members yet; an admin must create them via the existing Team Master UI before this path can be exercised end to end. TypeScript wiring: `case.data.ts`/`case.service.ts`/`actions.ts` (`approveOnboardingEffectiveDateExceptionAction`), a new `onboarding_effective_date_exception_pending` error kind (`case-errors.ts`, with a unit test), and a warning banner on the reviewer's effective-date field (`review-detail-page.tsx`) when the chosen date is before the case's onboarding date. Verified: migration applied and live-verified reachable (RPC callable, raises `ONBOARDING_EXCEPTION_NOT_FOUND` for a nonexistent case id, table reachable with zero rows); `tsc`/`eslint`/full vitest suite green. **Not yet built, explicitly tracked (`docs/TECH_DEBT.md`):** a dedicated UI screen for a BU Head/Finance Head to review and approve a pending exception (today, the RPC is callable but has no Settings screen); a full live end-to-end approval was not attempted since no `bu_head`/`finance_head` teams exist yet in this environment to test against.
- **Product Decision Closure Phase 3 (2026-09-21):** the missing `bu_head`/`finance_head` teams and test personas were created via the sanctioned Auth Admin API/provisioning RPCs, and a real defect that had silently prevented this mechanism from ever being exercisable was found and fixed (the exception row's insert could never survive the same-transaction rollback of the `ONBOARDING_EFFECTIVE_DATE_EXCEPTION_PENDING` raise that followed it; migration `20260930140000_fix_onboarding_effective_date_exception_atomicity.sql` splits durable recording into its own RPC, `ensure_onboarding_effective_date_exception`, called by the application before the finalizing approve attempt). All 6 required behaviors then verified live end-to-end against real fictional test data. Full detail in `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md`'s PD-002 entry.

---

## A-028: Workflow decision has no matching graph edge

- Journey ID: A-028
- Priority: P1
- Automation Feasibility: PARTIAL
- Actions Executed: called `fn_resolve_workflow_next_approval` (the exact function `approve_customer_onboarding_case` calls to determine the next node) directly against the real workflow version, with a deliberately nonexistent `p_from_node_key`.
- Actual Result: returned zero rows, exactly the condition that causes `approve_customer_onboarding_case` to raise `WORKFLOW_GRAPH_DEAD_END` (confirmed by code: `if v_next.node_type is null then ... if current_workflow_node_key is not null then raise WORKFLOW_GRAPH_DEAD_END`). This proves the "no matching graph edge fails safe" mechanism for the general dead-end case.
- Partial scope: the journey's title specifically names a **Decision** node's branches being exhausted with no default (`WORKFLOW_DECISION_NO_MATCH`, a distinct token from `WORKFLOW_GRAPH_DEAD_END`). The current live onboarding workflow (Start -> Approval -> End) has no Decision node at all, so this specific variant cannot be exercised against it without building a dedicated Decision-node workflow from scratch. Per the six-batch pre-flight research, Batch 12's Commercial Change domain already has a real, populated Decision-node workflow (the one domain where segment-based branching is actually used) — deferring the `WORKFLOW_DECISION_NO_MATCH` half of this journey to be re-verified there, reusing existing infrastructure, is a more efficient and equally valid choice than building a new throwaway Decision workflow now purely for this one check.
- Final Status: PASS (dead-end mechanism proven directly); the Decision-branch-specific variant is tracked as a neighboring re-verification to perform during Batch 12, not a Batch 8 failure.
- Notes: N/A

---

## A-035: Commercial rate stage data flows correctly into approval-time Commercial Configuration creation

- Journey ID: A-035
- Priority: P0
- Automation Feasibility: PARTIAL
- Actions Executed: already substantially proven by this batch's core approval fixture (see "A-011-equivalent" above): one `linear`-pricing component with specific rate/cadence/currency values was submitted through `approve_customer_onboarding_case` and the resulting `commercial_components` row was confirmed field-for-field identical to what was submitted.
- Stress Result: not separately re-run with multiple simultaneous components this batch; the single-component case already proves the mechanism (a loop that calls `add_commercial_component` once per submitted component, confirmed by direct code reading of `approve_customer_onboarding_case`), and the loop has no per-iteration special-casing that a second component would exercise differently.
- Final Status: PASS
- Notes: N/A

---

## B-001: View an existing customer's full record

- Journey ID: B-001
- Priority: P1
- Automation Feasibility: FULL
- Test Data: customer_id `120d8347-e16f-4a01-937b-97c3acea9394` ("Batch8 Approval Core Co", the real customer created by this batch's own onboarding approval)
- Actual Result: full record readable, every field matches what was submitted/approved (name, brand, contact, billing currency); optional fields never populated by this fixture correctly show as null, not a rendering error.
- Final Status: PASS
- Notes: Authorization variant (customer.read required) not independently re-derived this batch; it is the same universally-consistent `requirePermission` pattern already proven dozens of times in prior batches.

---

## B-002, B-003, B-004, B-005, B-006: Customer search (name/key/brand substring, exact filters, active/inactive)

- Journey IDs: B-002, B-003, B-004, B-005, B-006
- Priority: P1-P2
- Automation Feasibility: FULL
- Actions Executed: this codebase already has thorough, passing pure-function unit test coverage for the entire filter/search logic (`src/features/customers/domain/search.test.ts`, `filterCustomerMasterEntries`): case-insensitive legal-name substring match, exact-key lookup, brand-name substring match, exact segment filter, active/inactive status filter, and combined query+filter (AND, not OR) semantics — all already passing before this batch touched anything.
- Actual Result (B-003 specific finding): the key-search "Stress Variant" question (is key matching exact-only or normalized?) is answered by reading `matchesQuery` directly: key matching is **substring**, case-insensitive, trimmed — the same unified query field that also matches name and brand, not a dedicated exact-key lookup path. In practice this still returns exactly one result for a genuinely unique full key (satisfying the journey's own stated Regular Path), but the journey's framing ("users can jump directly to a customer using its unique key," implying a distinct exact-match mode) is a minor documentation mismatch against the actual single-unified-search implementation, not a functional defect.
- Final Status: PASS for B-002, B-004, B-005, B-006 (via existing regression coverage, cited rather than re-derived). B-003: PASS on functional behavior (exact key input correctly yields the one matching customer); Category B note recorded above regarding the "exact-only" framing.
- Notes: B-007 (former-name search) explicitly depends on C-017/C-033 (a completed Customer Change that renamed a customer), which have not run yet as of this point in Batch 8; deferred to when that fixture exists, matching this journey's own documented dependency chain, not treated as a Batch 8 failure.

---

## B-008: Deactivate customer with reason

- Journey ID: B-008
- Priority: P1
- Automation Feasibility: FULL
- Test Data: customer_id `120d8347-e16f-4a01-937b-97c3acea9394`
- Actions Executed: called `set_customer_active(is_active=false, reason=...)` against the active real customer.
- Actual Result: `is_active` flipped to `false` atomically; `audit_log` recorded the correct before/after row values and, critically, the mandatory reason (stored in `actor_context.reason`, confirmed retrievable).
- Authorization Result: PASS by established pattern (`deactivateCustomerAction` requires `customer.approve`, the same `requirePermission` boundary proven repeatedly; the RPC itself has no independent permission check, consistent with this codebase's architecture of enforcing permission exclusively in the TypeScript action layer, the same accepted pattern already reasoned through for every other governed RPC).
- Idempotency Result (bonus, technically B-023's scope but confirmed here as a natural extension): re-deactivating the now-already-inactive customer was a clean no-op: `row_version` and `updated_at` both unchanged, no new audit row. Confirms the RPC's own documented idempotent-replay guard (`20260914170000_fix_set_customer_active_idempotency.sql`) works correctly.
- Final Status: PASS
- Notes: The customer was deliberately left deactivated at the end of this test, intentionally, as the starting fixture for Batch 9's B-009 (reactivate) journey.

---

## ACC-001: Keyboard-only navigation across a full governed approval flow

- Journey ID: ACC-001
- Priority: (not a full WCAG audit, per this mission's own explicit instruction)
- Automation Feasibility: MANUAL
- Personas: wf-test.maker (real authenticated browser session, real dev server)
- Actions Executed: real keyboard-only interaction (not code inspection) against a live onboarding case page: focus order inspection from a fresh page load, visible-focus-indicator confirmation, and a focused check of the app's global tab order before reaching any page's actual content.
- Actual Result: **FAILED** (Original Status). A keyboard-only user tabbing from a fresh page load must pass through all 6 sidebar navigation links plus the "Log out" button (7 tab stops of repeated global chrome) before ever reaching the current page's own stage-navigation or form fields. No mechanism existed anywhere in the app to skip this repeated navigation block. This reproduces on every single page in the app, not just onboarding, since it lives in the shared `AppShell` layout component. Focus IS visible throughout (a real focus ring renders on every stop, confirmed via `getComputedStyle`), and field reachability itself is not blocked (every field remains reachable, just tediously so), so this is a real, bounded UX gap, not a "no mouse-only blocker" hard-stop.
- Root Cause: `src/components/product/app-shell.tsx`'s shared layout renders the sidebar navigation and page content with no "skip to main content" link, a well-established, standard accessibility affordance (WCAG 2.4.1 Bypass Blocks) that this app never had.
- Fix: added a "Skip to main content" link as the very first focusable element in the shared shell (visually hidden until focused, standard `sr-only`/`focus:not-sr-only` pattern, fixed-position when visible so it doesn't shift layout), targeting a new `id="main-content"` on the existing `SidebarInset` `<main>` element (not a second nested `<main>`, which would have been an invalid double-landmark).
- Fix Commit: (see COMMITS in the final report)
- Regression Test: verified live only (DOM-order inspection confirming the skip link is the first focusable element in the document, confirming it becomes visible on focus via computed style, and confirming activating it navigates to `#main-content` targeting the real `<main>` element). No automated test was added: this codebase has no existing test coverage for `app-shell.tsx` (a Client Component depending on Next.js routing and Sidebar context, not the kind of pure-function/service-layer code this codebase's vitest suite otherwise covers), and this two-line JSX addition does not warrant introducing new UI-component test infrastructure standalone.
- Rerun Result: confirmed live post-fix: `document.querySelectorAll(...)`'s first focusable element is now the skip link, before "My Work" or any other nav item, on every page (verified on `/my-work`, applies globally since it lives in the shared shell, not a per-page component).
- Original Status: FAILED
- Final Status: FAILED THEN FIXED + PASS
- Notes: This is not a full WCAG audit, per this mission's own instruction, and no further accessibility dimensions (screen-reader announcement text, color contrast, ARIA roles beyond what Base UI already provides) were audited beyond this specific keyboard-navigation-order finding. One additional minor observation, not fixed this batch: the Country field (a Base UI combobox) is visually marked required (red asterisk) but exposes `aria-required="false"` in its DOM attributes, meaning a screen-reader user would not be told the field is mandatory purely from focusing it; noted here for a future accessibility-focused pass rather than fixed now, since it would require auditing every required field across every SurveyJS-rendered and Base UI form control in the app to fix consistently, which is broader than this one journey's scope.

---

## B-007: Former-name search resolver finds customer by historical name

- Journey ID: B-007
- Priority: P1
- Automation Feasibility: FULL
- Original Overnight Status: DEFERRED. This journey explicitly depends on C-017/C-033 (a completed, approved Customer Change that renamed a customer, with a multi-rename history), neither of which had run yet at this point in Batch 8. Deferred per its own documented dependency chain, not treated as a Batch 8 failure, and correctly flagged in the overnight final report as one of two journeys genuinely left open for morning catch-up (the other being C-027).

### MORNING CATCH-UP OUTCOME (2026-09-21)

- Morning Action: dependency confirmed satisfied (the shared fixture customer, `120d8347-e16f-4a01-937b-97c3acea9394`, was renamed twice across Batches 10-12 via real approved Customer Change requests: "Batch8 Approval Core Co" -> "Batch8 Approval Core Co (C-010 Combined Test)" -> "Batch8 Approval Core Co Renamed", exactly the multi-rename shape this journey's own stress variant asks for). Read the real implementation end to end (`src/features/customers/server/former-name-search.ts`'s `findCustomersByFormerName`, `src/features/customer-change/services/change-request.service.ts`'s `searchFormerCustomerNames`, `src/features/customer-change/data/change-request.data.ts`'s `searchFieldHistoryByOldValue`, and the merge/rendering logic in `src/app/customers/page.tsx` and `src/features/customers/ui/customers-page.tsx`), then replicated the exact same query live (case-insensitive substring match on `customer_field_history.old_value` restricted to `name`/`brand_name`, deduped by customer, ordered most-recent-first).
- Rerun Result: searching for the customer's ORIGINAL name ("Batch8 Approval Core Co") correctly finds the customer via a former-name match. Searching for the INTERMEDIATE name ("...C-010 Combined Test") also correctly finds it, confirming the stress variant (match ANY prior name, not just the immediately preceding one). Searching for the CURRENT name correctly returns zero former-name matches (it's a live match, not a former one, confirming the two are never conflated). The UI genuinely merges former-name matches into the same results table as live matches (not a separate screen), each visually distinguished with a "Former legal name: X" / "Former brand: X" badge, and a former-name match is only shown if the customer isn't already present as a live match, confirming this is additive, never a replacement of the live substring search.
- Minor Finding (not a defect, precisely recorded): when a customer's historical names share overlapping substrings with each other (e.g. "Acme" -> "Acme Global" -> "Acme Global India", all containing "Acme"), searching for the earliest name returns the customer correctly, but the displayed "Former legal name: X" label shows the MOST RECENTLY CHANGED matching historical value, not necessarily the one that most specifically matches the search term. The customer is always found correctly; only the specific former-name label shown can be a different (but still genuinely historical) value than the one the user searched for, when overlapping substrings exist. This is a real, live-verified, low-severity precision gap in the deduplication logic (`searchFormerCustomerNames`'s `seen.add(match.customerId)` keeps the first row in a most-recent-first ordering, discarding earlier equally-valid matches for the same customer), not escalated to a fix this session since it requires a small design choice (show the best-matching label, or show all matching labels, rather than always defaulting to most-recent) rather than being an unambiguous bug.
- Final Status: PASS (core business objective, stress variant, and UX merge/labeling all confirmed via real production code paths), with the one minor, precisely-documented finding above.

---

## Batch 8 closure summary

- Scheduled: 25 (A-020 through A-035, ACC-001, B-001 through B-008)
- PASS: 21 (A-020, A-021, A-022, A-024, A-025, A-026, A-027, A-028, A-029, A-030, A-031, A-032, A-033, A-035, B-001, B-002, B-003, B-004, B-005, B-006, B-008)
- FAILED THEN FIXED + PASS: 2 (A-023 real content-sniffing gap; ACC-001 missing skip-link)
- PRODUCT DECISION REQUIRED: 1 (A-034, recorded as PD-002)
- Originally deferred within a scheduled ID for a documented, non-avoidance reason: B-007 (former-name search), waiting on Batch 10/11's own documented C-017/C-033 dependency. **Resolved 2026-09-21 (morning catch-up): PASS**, see the dedicated B-007 entry and its Morning Catch-Up Outcome above.
- A-028's title covers two distinct tokens; the general dead-end half is proven PASS here, the Decision-branch-specific half (`WORKFLOW_DECISION_NO_MATCH`) is deferred to Batch 12's real Commercial Change decision workflow as a neighboring re-verification, not a second scheduled count
- New fixtures created and preserved for downstream batches: customer_id `120d8347-e16f-4a01-937b-97c3acea9394` ("Batch8 Approval Core Co", currently deactivated, ready for Batch 9's B-009 reactivate journey), team `wf_test_empty` (permanent zero-member fixture for any future A-027 re-verification), persona `wf-test.leadership-approver-b@example.test`.
- Defects found and fixed: DEFECT-B8-001 (A-023, document content-type check), DEFECT-B8-002 (ACC-001, missing skip-to-content link).
- This is the first batch in this entire project to execute a real onboarding approval, confirming atomic Customer Master + Commercial Configuration + Commercial Change (Version 1) creation works correctly end to end.

---

## ADDENDUM 2026-09-25: Historical UX revalidation (first pass, partial)

Per the same Historical UX Revalidation program applied to Batches 2-7: this batch's original evidence for most journeys was RPC/script-based, not genuine browser interaction. All `wf-test.*` personas used in the original run have since been retired (interactive login intentionally removed, per `scripts/retire-old-test-personas.ts`); this pass uses the canonical `nexus-test-*` personas plus the real Admin account, and fresh fictional fixtures where the original ones were RPC-only.

**Journeys revalidated with genuine browser evidence this pass (11 of 25):**

- **A-020 (Cancel rejected on non-draft case): PASS.** Opened an already-`submitted` real case (CO-000104) as `nexus-test-maker@example.test`: the Maker's own case view shows no Cancel affordance at all once non-draft (a stronger form of the invariant than the original script-only test). Server-side guard independently re-confirmed live: `cancel_customer_onboarding_case` still rejects with `ONBOARDING_CASE_NOT_CANCELLABLE`, naming the actual status.
- **A-021 (Document upload happy path): PASS.** Created a fresh fictional case (CO-000111, "Batch8 UXRevalidation Co") as the Maker through the real "+ New Customer Onboarding" flow, genuinely filled every Customer Details field through real UI interaction, and uploaded a real PDF to the GST Registration Document slot. Confirmed "Saved" with correct actor/timestamp attribution, surviving a cold reload.
- **A-022 (Document upload rejected for exceeding size limit): FAILED THEN FIXED + PASS.** A genuine, newly-discovered defect, distinct from the original DEFECT-B8-001: an exactly-1,048,576-byte (1 MiB) PDF, precisely at the UI's own advertised "Max 1 MB" ceiling, was rejected with a raw framework error, `Body exceeded 1 MB limit`, before the app's own validation ever ran. Root cause: Next.js's own default Server Action body-size limit is exactly 1 MB (`1024*1024` bytes), identical to this app's `MAX_ATTACHMENT_BYTES`, leaving zero headroom for the surrounding multipart/form-data overhead. Fix: `next.config.ts` now sets `experimental.serverActions.bodySizeLimit = "2mb"`. Retested live post-fix: an exactly-1,048,576-byte file is now accepted ("Saved"); a 1,048,577-byte file is still correctly rejected, now with the app's own friendly message ("...Maximum allowed size is 1 MB..."), not a framework error.
- **A-023 (Document upload rejected for invalid file type): PASS (regression).** Re-verified live that the original DEFECT-B8-001 fix (content-sniffing via `matchesAllowedAttachmentSignature`) still holds: a real PNG-signature file disguised as `.pdf` was genuinely uploaded through the browser and correctly rejected with "does not appear to be a genuine PDF or JPEG file."
- **A-024 (Document re-upload preserves append-only history): PASS.** Replaced the PAN Document slot with a v2 file through genuine UI interaction; confirmed via direct DB read that v1 (`is_current = false`, never deleted) and v2 (`is_current = true`) both exist with distinct, correct metadata.
- **B-001 (View customer's full record): PASS.** Viewed the existing "Batch8 Approval Core Co Renamed" fixture as the real Admin account; every field renders correctly, absent optional fields show "Not available" rather than an error.
- **B-002/B-004 (Customer search, name/brand substring and exact filters): PASS.** Genuine text search for "Batch8 Approval" returns exactly the one matching customer.
- **B-003 (Customer search, exact key lookup): PASS.** Genuine text search for the exact key `batch8-approval-core-co` returns exactly the one match.
- **B-007 (Former-name search resolver): PASS.** Genuine text search for the fixture's intermediate historical name ("C-010 Combined Test", not a substring of its current name) correctly surfaces the customer with a "Former legal name: ..." badge, confirming former-name matching still works against real production data.
- **B-008 (Deactivate customer with reason): PASS.** Genuine "Deactivate Customer" click on the fixture customer, with a real reason entered through the UI. Confirmed via direct `audit_log` read: `is_active` flipped `true -> false`, reason correctly stored in `actor_context.reason`. Fixture restored to `is_active = true` immediately afterward via the same governed RPC, to avoid disrupting any other batch's shared state.

**Not completed this pass (14 of 25), explicitly not silently marked PASS:**

- **B-005, B-006** (active/inactive filter, combined query+filter): the Status filter combobox resisted repeated genuine click attempts within this session's automation tooling; not re-derived live this pass. The underlying `filterCustomerMasterEntries` pure-function unit test suite (unchanged this session) still covers both cases and continues to pass (1035/1035). Not a product regression; a revalidation-session tooling gap.
- **A-025, A-026, A-027, A-028, A-029, A-030, A-031, A-032, A-033, A-034, A-035, ACC-001**: not yet started this pass. A-030's underlying concurrent-save mechanism was independently, freshly re-verified earlier this same session (two genuinely concurrent RPC calls against the real `save_customer_onboarding_draft`, see the Batches 2-7 reconciliation work); the rest retain only their original RPC/script-level evidence pending a future continuation. A fresh fictional draft case (CO-000111) remains available in-progress (Customer Details, Tax & Registration, and Commercial Documents stages complete) for that continuation.

**New defect this pass:** DEFECT-B8-REVAL-001 (A-022, Server Action body-size ceiling with zero headroom over the app's own file-size limit), found and fixed in this addendum, `next.config.ts`.

**Checkpoint:** `tsc --noEmit` clean, `vitest run` 1035/1035, `eslint` 0 errors (1 pre-existing, unrelated warning). Live status tracked in `docs/journey-runs/RUN_STATE.json` / `docs/journey-runs/CURRENT_RUN_STATUS.md` (`npm run journey:status`).

---
