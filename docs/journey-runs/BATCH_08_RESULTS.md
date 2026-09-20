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
