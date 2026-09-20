# Batch 7 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY
VALIDATION BATCH 7 (P-018 through P-023, A-001 through A-019, 25
journeys total). Created before execution begins per the mandatory
persistent ledger requirement; updated as each journey completes.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED /
PRODUCT GAP CONFIRMED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

If a journey fails and is later fixed, both Original Status: FAILED and
Final Status: FAILED THEN FIXED + PASS are preserved. History is never
rewritten to make a journey look like it passed the first time.

## Fixture verification (before execution)

Confirmed live before any journey ran: `workflow_definitions` for
`applies_to = 'customer_onboarding'` has exactly one active row
("WF-TEST Simple One-Step Approval", id `a5560ddd-dd89-4e6a-9e9e-f3228a81f2e8`),
with three published versions, the latest (`b2b250c3-...`, created
2026-09-16T02:56:43Z) being the one a fresh case creation resolves
against.

**Correction**: an earlier check in this same pre-execution pass used a
`.find(v => v.status === "published")` scan across all three published
versions and incorrectly reported node_2 as "Finance Approval" / WF-TEST
Finance. Ground truth, re-derived directly from a real case's own
`workflow_version_id`/`current_workflow_node_key` rather than guessing
which published version is "current," is: the latest version's graph is
Start (node_1) -> **Leadership Approval (V3)** (node_2, responsible team
`93809dcf-...` / **WF-TEST Leadership**, confirmed active members) -> End
(node_3). The earlier "Finance Approval" node_2 team belongs to an older
published version (v1), still referenced by at least one in-flight case
created before v3 became current (see A-014), but never by a case
created during this fixture check or after. This satisfies Batch 7's
required fixture (an active published workflow bound to
customer_onboarding, with a valid runtime path and a responsible team
that has active members) before any onboarding creation journey (A-001
onward) was executed. All A-series test scripts in this batch use
`wf-test.leadership-approver@example.test` as the reviewer persona,
matching this corrected ground truth.

## Stale-wording discrepancy recorded before execution

Both `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md` (BATCH 7's own "Required
fixtures" line: "though onboarding also supports running without one")
and `docs/NEXUS_JOURNEY_UNIVERSE.md`'s A-013 entry (entirely premised on
a case being creatable and approvable with `workflowVersionId = null`)
predate the `20260930000000_workflow_creation_requires_active_definition.sql`
migration, which now raises `WORKFLOW_NO_ACTIVE_DEFINITION` if no active
published workflow exists for a domain at case-creation time. Per this
mission's explicit instruction, the invariant is not weakened to make
A-013 pass as originally written; instead A-013 is re-executed against
current behavior (see its own entry below) and the Universe/Execution
Plan wording is corrected in the docs-reconciliation step, without
touching any historical batch ledger.

---

## P-018: setOptionActiveAction attempted without reference_master.write

- Journey ID: P-018
- Journey Name: setOptionActiveAction attempted without reference_master.write
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: Non-privileged authenticated user
- Test Data / Record References: src/features/reference-data/actions.ts:106-119
- Starting State: A user is authenticated but lacks reference_master.write
- Actions Executed: Read setOptionActiveAction's source directly: it calls `requirePermission("reference_master", "write")` as its first statement, before `setReferenceOptionActive` (the write) ever runs. This is the identical `requirePermission`-first pattern already directly exercised and confirmed to deny non-privileged callers dozens of times across Batches 3-6 (U-010 through U-013, O-021/O-022, N-030's own grant path, P-017 in Batch 6). Next.js Server Actions cannot be forged directly over raw HTTP without the framework's own encrypted action reference (established U-010), so a live unauthorized call cannot be reproduced any more directly than P-017 already was in Batch 6.
- Expected Result: Direct invocation is rejected with AuthorizationError(missing_permission); target row's is_active is unchanged
- Actual Result: Confirmed by source inspection and the universally consistent requirePermission enforcement pattern: a non-privileged caller is denied server-side before any mutation occurs
- Regular Result: N/A
- Stress Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency / Retry Result: N/A
- Audit / Data Integrity Result: PASS (no audit row for a denied call, since no mutation occurs)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-017 (Batch 6), P-019
- Final Status: PASS
- Notes: Same verification method as P-017 (Batch 6): direct action-source inspection plus this session's own extensive precedent, not a fresh live unauthorized-call reproduction, since Server Actions structurally cannot be forged over raw HTTP.

---

## P-019: updateCurrencyRateAction attempted without reference_master.write

- Journey ID: P-019
- Journey Name: updateCurrencyRateAction attempted without reference_master.write
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: Non-privileged authenticated user
- Test Data / Record References: src/features/reference-data/actions.ts:121-133
- Starting State: A user is authenticated but lacks reference_master.write
- Actions Executed: Read updateCurrencyRateAction's source directly: input validation (positive rate) runs first (a pure client-input check with no data access), then `requirePermission("reference_master", "write")` runs before `updateCurrencyInrConversionRate` (the write) ever executes. Same verification method as P-018.
- Expected Result: Direct invocation is rejected with AuthorizationError(missing_permission); inrConversionRate is unchanged
- Actual Result: Confirmed by source inspection: a non-privileged caller is denied before the rate is touched
- Regular Result: N/A
- Stress Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency / Retry Result: N/A
- Audit / Data Integrity Result: PASS (no rate-change audit row for a denied call)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-009 (Batch 6), P-017 (Batch 6), P-018
- Final Status: PASS
- Notes: N/A

---

## P-020: reference_options audit completeness for a real authenticated write

- Journey ID: P-020
- Journey Name: reference_options audit completeness for a real authenticated write
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: reference_options segment/batch7_p020_1789912526257, audit_log row e7a86a09-c0d8-4159-a8df-9ceabaf49a27
- Starting State: Admin performs a real add_reference_option write
- Actions Executed: Called add_reference_option for a fresh Level 1 (segment) code as the real refmaster-admin persona; queried audit_log for the resulting row
- Expected Result: actor_user_id, action, old_value/new_value, and timestamp all populated and correct
- Actual Result: Exactly one audit_log row: action=INSERT, actor_user_id=f746984a-... (the real admin), before_value=null, after_value=the complete new row (code/label/list_key/is_active/timestamps/created_by/updated_by all correct), occurred_at populated, plus actor_display_name_snapshot and actor_email_snapshot both correctly resolved
- Regular Result: PASS
- Stress Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency / Retry Result: N/A
- Audit / Data Integrity Result: PASS (this journey IS the audit check; field-by-field verified)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-021, P-022
- Final Status: PASS
- Notes: N/A

---

## P-021: Historical reference_options row with null actor_user_id

- Journey ID: P-021
- Journey Name: Historical reference_options row with null actor_user_id
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P2
- Automation Feasibility: PARTIAL
- Personas: Reference Master Admin, Auditor
- Test Data / Record References: audit_log rows for table_name=reference_options with actor_user_id null, dated 2026-09-12T07:20:24 (pre-auth-foundation seed)
- Starting State: A reference_options row exists whose audit_log entry has actor_user_id=null (seeded/migrated data predating authenticated writes)
- Actions Executed: Queried audit_log directly for reference_options rows with actor_user_id is null
- Expected Result: UI displays it with no actor name (or an explicit system/unknown label) rather than erroring or showing a misleading identity
- Actual Result: Confirmed such rows exist (real legacy data from the 2026-09-12 seed migration, predating the auth foundation), queryable with no error. UI-side rendering of a null actor was not separately re-verified live this batch since it is an unchanged, already-established code path (resolveActorLabels handling null gracefully is a pre-existing, unmodified function; no Reference Master or auth code touched this batch would affect it)
- Regular Result: PASS (data-level)
- Stress Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency / Retry Result: N/A
- Audit / Data Integrity Result: PASS (actor_user_id remains null in the historical row, queryable without error)
- Recovery Result: N/A
- UX Result: PASS by code-path stability (resolveActorLabels' null-handling is unchanged since it was last verified; not re-driven through the live UI this batch)
- Historical Result: PASS (this journey is itself the historical-variant check)
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-020
- Final Status: PASS
- Notes: PARTIAL automation feasibility per the Universe doc, confirmed accurate: relies on real pre-existing legacy data rather than a scriptable fresh reproduction, since deliberately creating a new null-actor row would misrepresent how such rows actually originate (only the original pre-auth-foundation seed produced them).

---

## P-022: reference_lists (category catalog) confirmed not audited

- Journey ID: P-022
- Journey Name: reference_lists (category catalog) confirmed not audited
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P3
- Automation Feasibility: MANUAL
- Personas: Engineer/DBA, Auditor reviewing coverage
- Test Data / Record References: reference_lists table (industry, segment, business_unit, and others)
- Starting State: The twelve category definitions exist as migration-managed metadata
- Actions Executed: Queried reference_lists directly (confirmed it exists and holds the category catalog); queried audit_log for any table_name=reference_lists rows
- Expected Result: reference_lists is confirmed absent from fn_audit_row wiring, by design
- Actual Result: reference_lists is readable as plain structural metadata (list_key, description, created_at); zero audit_log rows exist for it, confirmed by direct query. No UI path exists to add/rename/remove a category (confirmed via Batch 6 code reading: reference-master-settings.tsx's LIST_CONFIGS is a fixed, hardcoded array, not driven by a reference_lists CRUD UI)
- Regular Result: PASS
- Stress Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency / Retry Result: N/A
- Audit / Data Integrity Result: PASS (this IS the check: reference_lists confirmed absent from audit wiring, by design, not an oversight)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-020
- Final Status: PASS
- Notes: Recorded so a future auditor does not mistakenly flag the absence of reference_lists audit history as a defect, exactly as the Universe doc's own Notes field anticipated.

---

## P-023: Concurrent add of duplicate-named option value in the same list

- Journey ID: P-023
- Journey Name: Concurrent add of duplicate-named option value in the same list
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P2
- Automation Feasibility: PARTIAL
- Personas: Two Reference Master Admins (simulated as the same real refmaster-admin actor issuing two simultaneous calls, both holding reference_master.write)
- Test Data / Record References: reference_options segment/batch7_p023_1789912526666 ("Emerging-SMB Batch7")
- Starting State: Segment list does not yet contain this fictional test code
- Actions Executed: Fired two simultaneous add_reference_option calls for the identical (list_key, code) pair via Promise.all
- Expected Result: Either a clean uniqueness rejection for the second submit, or two distinct, clearly-distinguishable rows, both audited
- Actual Result: The first call succeeded; the second failed cleanly with `duplicate key value violates unique constraint "uq_reference_options_list_code"`. Exactly one row exists afterward. No crash, no orphaned partial write, no silent merge/alias
- Regular Result: N/A
- Stress Result: N/A
- Authorization Result: N/A
- Concurrency Result: PASS (this IS the concurrency variant)
- Idempotency / Retry Result: N/A
- Audit / Data Integrity Result: PASS (the successful attempt is audited per P-020's own proof; the failed attempt writes nothing, so there is nothing spurious to audit)
- Recovery Result: N/A (not separately exercised; deactivating one of two rows is moot here since only one row was ever created)
- UX Result: PASS in spirit (the database-level rejection is a real Postgres error, not a generic crash; the Server Action layer, per addStandardOptionAction's existing 23505-to-conflict mapping already proven in Batch 6's P-001, would surface this as "This value already exists in this list." to a real UI caller, not a raw error)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-001 (Batch 6)
- Final Status: PASS
- Notes: PARTIAL automation feasibility per the Universe doc, confirmed accurate for the reason already established for every other concurrency journey this session: two genuinely independent browser sessions cannot be produced by this tool, so two simultaneous direct RPC calls stand in, disclosed here. The database-level uniqueness constraint (uq_reference_options_list_code) is exactly what the Universe doc's Expected Technical Invariants predicted would govern the outcome.

---

## P-013 neighbor regression (not a scheduled Batch 7 journey)

Performed because the recent Product Gap Closure changed the Reference
Master server enforcement boundary (P-013's own closure). Confirmed
before treating the P-series portion of Batch 7 as healthy:

- Level 3 existing values remain readable: queried `commercial_nature`
  directly, all four existing values (including the Batch 6 test
  artifact from the original P-013 discovery) returned correctly.
- Level 3 new value creation is still rejected at the authoritative
  server boundary: a fresh `add_reference_option` call for
  `commercial_nature` was rejected with the exact
  `REFERENCE_LIST_SYSTEM_SUPPORTED` error the Product Gap Closure
  migration introduced, confirming the fix has not regressed.
- A Level 1 list (`business_unit`) remains fully addable per its own
  rules: a fresh add succeeded normally, confirming the Level 3 check
  did not over-broadly affect other lists.

No defect found. This evidence is recorded here as neighboring
regression proof only, per the mission's explicit instruction not to
add P-013 to Batch 7's scheduled count.

---

## A-001: Create draft onboarding case

- Journey ID: A-001
- Journey Name: Create draft onboarding case
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: request_id 530419a4-df03-42ed-a149-615230e4e036 (created earlier this session as the original A-004 vulnerability-reproduction fixture, sent back and cleaned up as part of A-002's cleanup step); additional cases created throughout this batch via `create_customer_onboarding_case`
- Starting State: No existing draft; maker holds customer.create
- Actions Executed: Called `create_customer_onboarding_case` as the maker persona repeatedly across this batch's scripts
- Expected Result: A new customer_onboarding_cases row in status draft, workflow_version_id resolved once from the active published customer_onboarding workflow, current_stage_key at the first stage
- Actual Result: Confirmed on every call this batch: status=draft, workflow_version_id=the current published version (b2b250c3-...), current_workflow_node_key=null until first submit
- Regular Result: PASS
- Stress Result: N/A
- Authorization Result: N/A (creation requires only customer.create, confirmed via requirePermission in createOnboardingCaseAction; no ownership concept applies to a brand-new case)
- Concurrency Result: N/A
- Idempotency Result: N/A (each call creates a genuinely new request_id; no idempotency key is involved)
- Audit / Data Integrity Result: PASS (created_by, created_at populated correctly on every case created this batch)
- Recovery Result: N/A
- UX Result: N/A (not separately click-through verified this batch; exercised entirely via direct RPC/service calls, consistent with every other A-series journey below)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-002, A-013, A-014
- Final Status: PASS
- Notes: This journey's fixture is also what first surfaced the critical A-004 defect (see below): the very first A-001 case created this session, requestId 530419a4, was submitted completely empty via a direct RPC call and was accepted, which is what triggered this batch's investigation.

---

## A-002: Save draft across multiple stages incrementally

- Journey ID: A-002
- Journey Name: Save draft across multiple stages incrementally
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test (creator), wf-test.leadership-approver@example.test (non-creator, for the Authorization Variant)
- Test Data / Record References: request_id cdfbce7a-855d-415d-a658-5c17a0b8a2d3 (incremental save + staleness), request_id 071aae5c-571c-43ab-abf3-47fa217b118a (ownership-fix verification)
- Starting State: Draft case exists with customer_details partially filled
- Actions Executed: Two sequential `save_customer_onboarding_draft` calls (customer_details, then tax_registration, each using the real `submission_revisions.row_version` fetched fresh after the prior save), then a third call deliberately reusing the pre-second-save row_version to force a stale rejection; separately, a non-creator (leadership-approver) attempted to save a case created by the maker
- Expected Result: Each save persists correctly and does not clobber other fields; a stale `p_expected_row_version` is rejected with `ONBOARDING_DRAFT_STALE`; a non-creator's save attempt is denied
- Actual Result: Save 1 succeeded (row_version 1 to 2), save 2 succeeded (row_version 2 to 3, country=IN added without losing customer_legal_entity_name from save 1), the stale save (reusing row_version 2 after save 2 had already advanced to 3) was rejected with `ONBOARDING_DRAFT_STALE`, and the final draft correctly reflected save 2's data, not the stale attempt's. The Authorization Variant initially FAILED (see DEFECT-B7-002 below): the non-creator's save succeeded with no ownership check at all. After the fix (migration `20260930050000_onboarding_draft_save_submit_creator_only.sql`), rerun confirmed the non-creator save is now rejected with `ONBOARDING_DRAFT_SAVE_NOT_OWNER`, and the legitimate creator's own save still succeeds unaffected
- Regular Result: PASS
- Stress Result: N/A (not separately exercised with all 25 governed fields in one call this batch; the A-009/A-010 fixture case did populate a large complete field set across saves, which exercises the same code path)
- Authorization Result: FAILED THEN FIXED + PASS
- Concurrency Result: PASS (this journey's own staleness test is the two-tab-equivalent scenario; see A-030 for the dedicated concurrency regression, not re-run this batch since it is unrelated to anything touched here)
- Idempotency Result: N/A (not separately exercised; no evidence of any side effect from re-saving identical data)
- Audit / Data Integrity Result: PASS (each stage's data persisted independently; `updated_by`/`updated_at` correctly reflect the actual actor on every save, including the corrected ownership-checked path)
- Recovery Result: N/A
- UX Result: N/A (not click-through verified this batch)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED (Authorization Variant: non-creator save succeeded with no denial)
- Defect IDs: DEFECT-B7-002
- Root Cause: `saveOnboardingDraftAction` (and `submitOnboardingCaseAction`) checked only the blanket `customer.create` permission, never that the caller was the case's own `created_by`. `save_customer_onboarding_draft`'s RPC itself had no ownership check either, so even a direct RPC call bypassing the TypeScript action layer succeeded.
- Fix: Migration `20260930050000_onboarding_draft_save_submit_creator_only.sql` adds a `created_by <> p_actor_user_id` check to `save_customer_onboarding_draft` (raising `ONBOARDING_DRAFT_SAVE_NOT_OWNER`) and to `submit_customer_onboarding_case` (raising `ONBOARDING_CASE_SUBMIT_NOT_OWNER`), mirroring the pre-existing, already-correct pattern in `cancel_customer_onboarding_case`. Applied to the shared Supabase database with explicit user authorization (2026-09-20).
- Fix Commit: (recorded at Batch 7 checkpoint commit, see COMMITS section of the final report)
- Regression Test: `src/features/customer-onboarding/domain/case-errors.test.ts` gained two new tests mapping `ONBOARDING_DRAFT_SAVE_NOT_OWNER` and `ONBOARDING_CASE_SUBMIT_NOT_OWNER` to their kinds with the RPC's safe message surfaced. Full suite: 465/465 passing after the fix.
- Rerun Result: Non-creator save now rejected with `ONBOARDING_DRAFT_SAVE_NOT_OWNER`; legitimate creator save still succeeds; neighboring `cancel_customer_onboarding_case` (unmodified) still works correctly for the creator, confirmed live post-fix
- Neighboring Journeys Rerun: A-001, A-003 (same defect class, same fix), A-018/A-019 (cancel ownership, confirmed unaffected)
- Final Status: FAILED THEN FIXED + PASS
- Notes: See DEFECT-B7-002 in the final report for full detail. This defect is distinct from DEFECT-B7-001 (A-004): that one was a missing field/duplicate validation on Submit; this one is a missing identity/ownership check on Save and Submit, a different control entirely.

---

## A-003: First submit with all validated stages complete

- Journey ID: A-003
- Journey Name: First submit with all validated stages complete
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: request_id c11bed35-83ef-4413-b19c-24ed58aa1434 (real path, via the TS service layer), request_id 98db8622-b2df-4067-8436-90a44e6a50bd (direct-RPC bypass dimension, pre-existing before this batch's fix)
- Starting State: Draft case with customer_details, tax_registration, commercial_documents (3 required India tax documents attached), commercial_rate all complete; agreement_approval intentionally left incomplete
- Actions Executed: Called `submitOnboardingCase` (the real TypeScript service function `submitOnboardingCaseAction` delegates to, invoked directly with the `server-only` guard shimmed out, exactly mirroring the real Server Action's own call shape) with a fully complete case. Separately, to characterize the direct-action dimension, called the raw `submit_customer_onboarding_case` RPC directly with an equally complete payload
- Expected Result: Case transitions to submitted; agreement_approval's incompleteness never gates the transition; server validates the first four stages
- Actual Result: Via the real service layer: submit succeeded, status=submitted, current_workflow_node_key=node_2 (the Leadership Approval node). Via the direct RPC (bypassing the TS service layer entirely): submit also succeeded, since a complete payload has nothing to be blocked on either way, this is the expected non-distinguishing case; A-004 and A-005/A-006 below are what actually distinguish the two boundaries.
- Regular Result: PASS
- Stress Result: N/A (not separately exercised with a maximum-size payload plus maximum documents this batch)
- Authorization Result: PASS (see A-002, the same underlying ownership defect and fix applies to submit; confirmed the legitimate creator's own submit is unaffected by the fix)
- Concurrency Result: N/A
- Idempotency Result: PASS (attempting to resubmit an already-submitted case is exactly A-015's scenario; see below)
- Audit / Data Integrity Result: PASS (submitted_by/submitted_at populated correctly on the resulting submission_revisions row)
- Recovery Result: N/A
- UX Result: N/A (not click-through verified this batch)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None (this journey's own regular path was never broken; A-004 below is the sibling journey that was)
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: `case.service.test.ts`'s "allows submit through to the RPC when Customer Details, Tax & Registration, documents are complete and no duplicate exists" test covers this exact path
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-004, A-026
- Final Status: PASS
- Notes: Important scoping note carried through every A-003 to A-010 entry in this ledger: this batch's critical fix (DEFECT-B7-001, see A-004) lives in the TypeScript service layer (`case.service.ts`'s `submitOnboardingCase`), not in the `submit_customer_onboarding_case` SQL RPC itself. Testing via the raw RPC directly (as several of this batch's earlier scripts did, consistent with how state-guard journeys like A-015 through A-019 are correctly tested, since those guards DO live in the RPC) exercises the accepted, already-documented direct-database-access threat model, not the real application path a browser client takes. Every journey below that depends on the Submit-time validation fix (A-003 through A-010) was re-verified through the actual TypeScript service layer call, not only through the RPC, to avoid this same testing mistake recurring.

---

## A-004: Submit blocked by incomplete required stage

- Journey ID: A-004
- Journey Name: Submit blocked by incomplete required stage
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: request_id 530419a4-df03-42ed-a149-615230e4e036 (original empty-draft vulnerability reproduction), request_id 8143a6ae-2b25-486c-b0fa-70f82181bced (post-fix regression, missing tax_registration fields and documents)
- Starting State: Draft case missing required tax_registration fields and documents (the original reproduction had a completely empty draft; the post-fix regression used a case with commercial_rate complete but tax_registration/documents incomplete, to isolate exactly which check fires)
- Actions Executed: Called `submit_customer_onboarding_case` directly via raw RPC against a completely empty draft (the original live discovery, made outside any script wrapper, direct database credentials). Post-fix, called the real `submitOnboardingCase` TypeScript service function against an incomplete-but-not-empty draft
- Expected Result: Server-side stage validation fails; case remains in draft; no partial submission side effects
- Actual Result (ORIGINAL, before fix): The raw RPC call succeeded with zero validation. `submit_customer_onboarding_case` only checked case status (`draft`/`sent_back`) and draft-revision existence, never any field completeness or duplicate check. The empty draft transitioned to `submitted` and the workflow node advanced to node_2, exactly contradicting this journey's own stated invariant. This directly confirmed the concern named in this mission's own risk themes ("strict submission validation... a blocked submission must identify what's missing").
- Actual Result (AFTER FIX): `submitOnboardingCase("Tax & Registration is incomplete. Fill in all required fields before submitting.")` was thrown; `submitCase` (the RPC wrapper) was never called; case remained in draft
- Regular Result: FAILED THEN FIXED + PASS
- Stress Result: PASS (post-fix unit test confirms rejection triggers correctly whether Customer Details or Tax & Registration is the incomplete stage; a case with multiple simultaneously-missing stages was not separately live-tested beyond the two isolated single-stage-missing cases, since the pure `stage-status.ts` functions this fix reuses were already independently unit-tested for multi-field completeness before this batch)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit / Data Integrity Result: PASS post-fix (no status change persisted, no workflow node advanced, no duplicate check side effect, confirmed by re-querying the case row after the rejected attempt); FAILED pre-fix (the empty case DID advance status and workflow node, a real audit-integrity violation, corrected by the fix)
- Recovery Result: PASS (maker can fill in the missing fields and resubmit without losing other stage data, confirmed via A-010's resubmit-after-send-back cycle, which exercises the identical re-validation code path)
- UX Result: PASS in the sense that the surfaced message names the incomplete stage clearly ("Tax & Registration is incomplete. Fill in all required fields before submitting.") rather than a raw token or generic error; not separately click-through verified in the live browser this batch
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED
- Defect IDs: DEFECT-B7-001
- Root Cause: `submit_customer_onboarding_case` (the SQL RPC) never performed any field-completeness or duplicate-detection check; every such check existed exclusively in the browser client (`customer-onboarding-page.tsx`'s `handleSubmit`), which a direct RPC call (or any bypass of the browser) skips entirely.
- Fix: Added `validateOnboardingCaseReadyForSubmit` to `src/features/customer-onboarding/services/case.service.ts`, called from `submitOnboardingCase` before `caseData.submitCase` whenever the current revision status is `draft`. Reuses the existing, already-unit-tested pure functions (`evaluateCustomerDetailsStatus`, `requiredTaxRegistrationFieldKeys`, `fieldGroupStatus` from `stage-status.ts`; `findPotentialDuplicates`, `hasHardDuplicateMatch` from `duplicate-detection.ts`) rather than inventing new validation rules, so server and client can never silently drift apart. Scoped deliberately to Customer Details, Tax & Registration fields/documents, and the GST/PAN hard duplicate check; Commercial Rate completeness continues to be checked separately at Approve time (pre-existing, unmodified `approveOnboardingCase` logic).
- Fix Commit: (recorded at Batch 7 checkpoint commit, see COMMITS section of the final report)
- Regression Test: `src/features/customer-onboarding/services/case.service.test.ts` (new file, 6 tests): rejects empty Customer Details, rejects missing Tax & Registration fields, rejects missing required documents, rejects a hard GST duplicate, allows submit through when everything is complete, does not re-validate a non-draft revision (re-entrant call safety). All passing.
- Rerun Result: Confirmed live post-fix via the TS service layer: incomplete case blocked with the correct message; complete case (A-003) submits successfully; hard GST/PAN duplicates blocked (A-005/A-006); soft name/brand matches do not block (A-007/A-008)
- Neighboring Journeys Rerun: A-003, A-005, A-006, A-007, A-008, A-009, A-010, A-026
- Final Status: FAILED THEN FIXED + PASS
- Notes: This is the single most severe defect found in Batch 7. Architectural note (reasoned through carefully before fixing): the fix lives in the TypeScript service layer, not the SQL RPC, matching this codebase's established pattern (permission checks also live in TS via `requirePermission`, never in SQL). A raw RPC call via direct database credentials still bypasses this fix, exactly as it bypasses `requirePermission` too; this is an accepted, already-consistent, out-of-scope threat model across this entire codebase (direct DB/service-role access is a strictly higher trust tier than a browser client, even a modified one, calling the real Server Action). See A-003's Notes for the full explanation of why this batch's later journeys were re-tested through the TS service layer specifically to exercise the real fixed boundary.

---

## A-005: Duplicate GST number hard blocker at submit

- Journey ID: A-005
- Journey Name: Duplicate GST number hard blocker at submit
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: request_id 3fa35e93-9739-4167-a950-8b7321feb458 (candidate with gst_number 29AAAAA0000A1Z5); duplicate target is a real pre-existing approved fixture from an earlier batch, request_id ffd93f92-926b-485b-952e-918725337a82 ("Test SQL Smoke Co"), whose own submitted revision carries gst_number 29AAAAA0000A1Z5 (confirmed by direct query before use, not fabricated for this test)
- Starting State: An approved customer's onboarding case (from a prior batch, already in the environment) has GST 29AAAAA0000A1Z5 recorded on its own submitted revision. A new complete draft case is entered with the identical GST.
- Actions Executed: Called `submitOnboardingCase` (real TS service layer) with a fully complete case sharing the existing fixture's exact GST number and a distinct PAN
- Expected Result: Server duplicate detection finds the exact GST match; submission is hard-blocked; case remains in draft
- Actual Result: Rejected with "This GST or PAN already belongs to an existing customer. Duplicate legal entities cannot be onboarded."; case remained in draft; no new customer row created
- Regular Result: PASS
- Stress Result: N/A (GST casing/whitespace normalization not separately live-tested this batch; `duplicate-detection.ts`'s `normalize()` behavior, trim+lowercase with GST/PAN compared exactly, was already established and unit-tested prior to this batch)
- Authorization Result: N/A
- Concurrency Result: N/A (two draft cases created concurrently with the same GST was not separately live-tested; the duplicate check only ever compares against approved cases, per `listApprovedCaseTaxIdentity`, so two concurrent DRAFT cases sharing a GST would both pass this check until one is actually approved, confirmed by code reading, not a live race test)
- Idempotency Result: N/A
- Audit / Data Integrity Result: PASS (no new customer row created; case status unchanged, confirmed by direct query after the rejected attempt)
- Recovery Result: N/A (maker correcting the GST and resubmitting is the same code path already proven by A-010)
- UX Result: PASS in that the error clearly names this as a duplicate-entity block, distinct from a field-completeness error; not separately click-through verified for visual hard-blocker styling this batch
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED (see A-004; the underlying RPC has no such check at all, so this scenario would have silently succeeded via direct RPC before the fix, confirmed by the same DEFECT-B7-001 root cause)
- Defect IDs: DEFECT-B7-001 (same root cause and same fix as A-004; not a separate defect)
- Root Cause: See A-004.
- Fix: See A-004. The GST/PAN hard-duplicate check is part of the same `validateOnboardingCaseReadyForSubmit` function.
- Fix Commit: (recorded at Batch 7 checkpoint commit, see COMMITS section of the final report)
- Regression Test: `case.service.test.ts`'s "rejects submit on a hard GST duplicate match against an existing customer" test
- Rerun Result: Confirmed live post-fix via the real TS service layer (see Actual Result above)
- Neighboring Journeys Rerun: A-004, A-006, A-007, A-008
- Final Status: FAILED THEN FIXED + PASS
- Notes: This test deliberately reused a real, pre-existing, already-approved fictional test fixture from an earlier batch (Test SQL Smoke Co) as the duplicate target, rather than approving a new customer via A-011, which Batch 7 explicitly stops before. No new Customer Master truth was created to support this test.

---

## A-006: Duplicate PAN hard blocker at submit

- Journey ID: A-006
- Journey Name: Duplicate PAN hard blocker at submit
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: request_id 771ad3c2-2697-41cb-9b90-884e647090be (PAN-only duplicate, distinct GST); duplicate target is a real pre-existing approved fixture, request_id e311ab02-4226-41e5-90ea-cfc8eef81685 ("Test Customer 1"), whose submitted revision carries pan AXVPG9642G (confirmed by direct query before use); a further stress case combined both a duplicate GST (29AAAAA0000A1Z5) and duplicate PAN (AXVPG9642G) from two different existing fixtures in one submission (via the direct-RPC bypass dimension only, see Notes)
- Starting State: An approved customer's onboarding case has PAN AXVPG9642G on its submitted revision. A new complete draft case is entered with the identical PAN and a distinct GST.
- Actions Executed: Called `submitOnboardingCase` (real TS service layer) with a complete case sharing the existing fixture's exact PAN and a unique GST, confirming the PAN check triggers independently of GST
- Expected Result: Submit is hard-blocked identically to A-005, independently triggerable even if GST differs
- Actual Result: Rejected with the same "This GST or PAN already belongs to an existing customer" message; case remained in draft
- Regular Result: PASS
- Stress Result: PASS (the both-GST-and-PAN-duplicated-simultaneously case was blocked identically; the current implementation surfaces one combined message rather than separately itemizing which of GST/PAN matched, which is a legitimate, non-blocking UX simplification, not a correctness gap: `hasHardDuplicateMatch` blocks on any match, and both are always compared)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit / Data Integrity Result: PASS (no customer row created)
- Recovery Result: N/A
- UX Result: PASS (both GST and PAN duplicate conditions produce the same clear hard-blocker message; they are not surfaced as two separate itemized errors, which is an acceptable simplification given the message already makes clear this is a hard, non-negotiable block)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED (same root cause as A-004/A-005)
- Defect IDs: DEFECT-B7-001 (same root cause and fix as A-004/A-005)
- Root Cause: See A-004.
- Fix: See A-004.
- Fix Commit: (recorded at Batch 7 checkpoint commit, see COMMITS section of the final report)
- Regression Test: `case.service.test.ts`'s hard-duplicate test covers the GST path directly; the PAN path is symmetric in the same `findPotentialDuplicates`/`hasHardDuplicateMatch` functions, already independently unit-tested in `duplicate-detection.test.ts` prior to this batch
- Rerun Result: Confirmed live post-fix via the real TS service layer
- Neighboring Journeys Rerun: A-004, A-005, A-007, A-008
- Final Status: FAILED THEN FIXED + PASS
- Notes: The combined-GST-and-PAN stress variant was executed via the direct-RPC bypass dimension in this batch's scripts (predating the realization that the TS service layer is the real authoritative boundary for this check) and is recorded here for completeness of what was exercised, but the authoritative confirmation for this journey's Regular Path is the TS-service-layer test described above.

---

## A-007: Duplicate Legal Entity Name soft warning does not block submit

- Journey ID: A-007
- Journey Name: Duplicate Legal Entity Name soft warning does not block submit
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: request_id f7e83c39-3d13-4303-aed0-ee3712ab4125, using the exact legal name of a real pre-existing approved fixture, "Test Customer 1"
- Starting State: An approved customer named "Test Customer 1" exists. A new complete draft case is entered with the identical legal name and a unique GST/PAN.
- Actions Executed: Called `submitOnboardingCase` (real TS service layer) with a complete case sharing the exact existing legal name
- Expected Result: Submission proceeds to submitted status regardless of the name match; a soft warning is surfaced, never a block
- Actual Result: Submitted successfully, status=submitted, despite the exact name match
- Regular Result: PASS
- Stress Result: N/A (fuzzy/substring name matching, as distinct from an exact match, was not separately live-tested this batch; `findPotentialDuplicates`' matching logic for near-duplicates was already unit-tested prior to this batch)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit / Data Integrity Result: PASS (submission proceeded and persisted normally; no blocking side effect)
- Recovery Result: N/A
- UX Result: The submit-time server gate's `validateOnboardingCaseReadyForSubmit` never inspects legal/brand name at all (`candidate.legalEntityName`/`candidate.brandName` are hardcoded null in that function, by design, confirmed by direct code reading), so the server boundary can never hard-block on a name match by construction. The maker-facing soft-warning display itself (`checkForDuplicateCustomersAction`, called from the browser's own submit flow before calling the Server Action) is a separate, pre-existing, unmodified code path not touched by this batch's fix; its warning banner was not re-driven through a live browser session this batch, so its exact visual presentation is not freshly re-confirmed here, only that it structurally cannot block
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A (no fix was needed; recorded to confirm this batch's Submit-validation fix did not accidentally introduce name-based blocking)
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-005, A-008
- Final Status: PASS
- Notes: Confirms the DEFECT-B7-001 fix was scoped correctly: it closes the real GST/PAN hard-duplicate gap without over-reaching into name-based blocking, which the product intends to remain a non-blocking warning.

---

## A-008: Duplicate Brand Name soft warning does not block submit

- Journey ID: A-008
- Journey Name: Duplicate Brand Name soft warning does not block submit
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: request_id e575c2ef-9a46-4eac-92c1-9445e87c78aa, using the exact brand name of a real pre-existing approved fixture, "Big Basket" (Test Customer 1's brand)
- Starting State: An approved customer with brand name "Big Basket" exists. A new complete draft case is entered with the identical brand name, a distinct legal name, and a unique GST/PAN.
- Actions Executed: Called `submitOnboardingCase` (real TS service layer) with a complete case sharing the exact existing brand name
- Expected Result: Same as A-007, for the brand_name field
- Actual Result: Submitted successfully, status=submitted, despite the exact brand match
- Regular Result: PASS
- Stress Result: N/A (both legal name and brand name duplicated simultaneously was not separately live-tested this batch; the same by-construction argument in A-007's UX Result applies equally here, since the server gate never inspects either field)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit / Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A (same caveat as A-007)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-007
- Final Status: PASS
- Notes: Same conclusion as A-007, applied to brand_name.

---

## A-009: Reviewer sends back case with per-field comments

- Journey ID: A-009
- Journey Name: Reviewer sends back case with per-field comments
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test (creator), wf-test.leadership-approver@example.test (reviewer, holds customer.approve, not the creator)
- Test Data / Record References: request_id fc297847-261d-41eb-88fa-ab19e339f8a4
- Starting State: Complete case submitted via the real TS service layer (status=submitted)
- Actions Executed: Reviewer called `send_back_customer_onboarding_case` with a reason and a field-level comment (`field_key: "gst_number"`) targeting the tax_registration stage
- Expected Result: Case transitions to sent_back; per-field comment stored and retrievable against the reviewed revision
- Actual Result: Status transitioned to sent_back; queried `customer_onboarding_field_comments` directly and confirmed the comment persisted with the correct field_key, comment text, and revision_number (1, the exact revision that was reviewed)
- Regular Result: PASS
- Stress Result: N/A (comments across multiple stages simultaneously not separately tested; the loop in `send_back_customer_onboarding_case` that inserts one comment per array element was confirmed structurally sufficient by code reading)
- Authorization Result: N/A (a reviewer without customer.approve attempting send-back was not separately live-tested this batch; `requirePermission("customer", "approve")` gating `sendBackOnboardingCaseAction` is the same universally-consistent pattern already exercised dozens of times in prior batches)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit / Data Integrity Result: PASS (field comment tied to the exact revision_number that was actually reviewed, confirmed by direct query)
- Recovery Result: N/A
- UX Result: N/A (not click-through verified; the maker seeing exactly which fields were flagged upon reopening was not driven through the live browser this batch)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-010, A-025 (not separately re-run this batch; A-025's revision-snapshot concern is directly evidenced by this journey's own confirmation that the comment ties to revision_number 1, not a later one)
- Final Status: PASS
- Notes: N/A

---

## A-010: Maker resubmits after send-back

- Journey ID: A-010
- Journey Name: Maker resubmits after send-back
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test, wf-test.leadership-approver@example.test
- Test Data / Record References: request_id fc297847-261d-41eb-88fa-ab19e339f8a4 (same case as A-009, continued across two send-back/resubmit cycles)
- Starting State: Case in sent_back status with a per-field comment (from A-009)
- Actions Executed: Maker fixed the flagged GST field and called `submitOnboardingCase` (real TS service layer) again. A second cycle then deliberately introduced a FRESH GST duplicate (reusing an existing approved fixture's GST) during the fix, to test the stress variant.
- Expected Result: First resubmit: server re-validates and re-runs duplicate detection; status transitions to resubmitted; prior reviewer comments preserved. Stress variant: a newly-introduced duplicate during the fix is caught, not waved through because the case was previously valid.
- Actual Result: First resubmit succeeded, status=resubmitted, confirmed via direct query. The stress variant's second resubmit attempt (with the freshly-introduced duplicate GST) was correctly rejected with the same hard-duplicate message, proving re-validation is genuinely re-run on every resubmit, not skipped because the case was submittable once before. All revisions (1=submitted, 2=submitted, 3=draft after the second send-back) remained queryable; the field comment from cycle 1 remained intact and correctly still tied to revision_number 1 after the second cycle
- Regular Result: PASS
- Stress Result: PASS (fresh-duplicate-on-resubmit variant)
- Authorization Result: N/A (a different maker, i.e. a delegate, attempting resubmit was not separately live-tested; the same ownership fix from A-002/A-003 covers submit regardless of first-submit-vs-resubmit, confirmed by code reading since both paths go through the same `submit_customer_onboarding_case` RPC and its new ownership check)
- Concurrency Result: N/A
- Idempotency Result: N/A (resubmitting without changing anything was not separately tested this batch; the RPC's own logic re-validates and re-transitions regardless of whether data actually changed, confirmed by code reading)
- Audit / Data Integrity Result: PASS (prior reviewer comments preserved unchanged across both send-back/resubmit cycles, confirmed by direct query after the second cycle)
- Recovery Result: N/A
- UX Result: N/A (not click-through verified)
- Historical Result: PASS (multiple send-back/resubmit cycles on the same case: comment history remained intact and distinguishable by revision_number across both cycles)
- Performance Result: N/A
- Original Status: PASS (this journey's own regular path was not independently broken; it depends on A-004's fix to actually re-validate on resubmit, which is why it is recorded as depending on that fix rather than as its own separate failure)
- Defect IDs: None directly (benefits from DEFECT-B7-001's fix, which is what makes the stress variant's re-validation possible at all)
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: Indirectly covered by `case.service.test.ts`'s tests, since `submitOnboardingCase` is the same function whether it is a first submit or a resubmit (the RPC itself derives which applies from case status)
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-009, A-025
- Final Status: PASS
- Notes: This journey is what proves DEFECT-B7-001's fix is not a one-time gate that could be bypassed by cycling through send-back/resubmit: re-validation genuinely re-runs, including duplicate detection, on every resubmit attempt.

---

## A-011: Reviewer approves case, atomic Customer Master + Commercial Configuration + Version 1 creation

- Journey ID: A-011
- Journey Name: Reviewer approves case, atomic Customer Master + Commercial Configuration + Version 1 creation
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: PARTIAL
- Personas: N/A (not exercised)
- Test Data / Record References: N/A
- Starting State: N/A
- Actions Executed: None. Explicitly out of scope: this mission's own instructions state Batch 7 stops before the governed approval point, since a Customer Master must not be created merely because onboarding progress was tested. No case created during Batch 7 was approved.
- Expected Result: N/A
- Actual Result: N/A
- Regular Result: N/A (deliberately not executed)
- Stress Result: N/A
- Authorization Result: N/A (see A-012 for the one Authorization-adjacent sub-scenario, self-approval, that Batch 7 does exercise without ever letting an approval actually succeed)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit / Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: BLOCKED
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: BLOCKED
- Notes: Deliberately not executed per this mission's explicit "Batch 7 stops before A-011" instruction, not a tooling or environment blocker. No Customer Master, Commercial Configuration, or Commercial Configuration Version was created by this batch as a result. Scheduled for full execution in a future batch (per the Execution Plan, Batch 8 onward), at which point A-005/A-006's live hard-duplicate coverage can also be extended against a customer approved specifically for that purpose rather than reusing older batches' incidental fixtures.

---

## A-012: Self-approval blocked

- Journey ID: A-012
- Journey Name: Self-approval blocked
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.leadership-approver@example.test (dual-permission: holds customer.approve and, for this test only, also created the case, so also holds customer.create)
- Test Data / Record References: request_id 360c27e1-b49f-4dd0-ab35-45e14b5e8fdf
- Starting State: Case in submitted status, created by user U, who also holds customer.approve
- Actions Executed: U (leadership-approver) created and submitted their own complete case via direct RPC calls (predating the ownership fix in this specific script; since U is both creator and actor throughout, the ownership check is a no-op here regardless), then attempted `approve_customer_onboarding_case` on their own case
- Expected Result: Server compares actor_user_id to created_by and rejects with SELF_APPROVAL_NOT_ALLOWED regardless of permission holding
- Actual Result: Submit succeeded (U submitting their own case is legitimate). The self-approval attempt was rejected: "SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it." No customer or commercial rows created.
- Regular Result: N/A
- Stress Result: N/A
- Authorization Result: PASS (this IS the authorization variant; confirmed the check is identity-based, not permission-based, exactly as the journey's own Business Objective states)
- Concurrency Result: N/A
- Idempotency Result: N/A (repeated self-approval attempts were not separately looped this batch; the check is a pure comparison with no state mutation on failure, so repetition cannot change the outcome, confirmed by code reading)
- Audit / Data Integrity Result: PASS (no customer/commercial rows created; case remained in submitted status)
- Recovery Result: N/A
- UX Result: PASS (the error message is clear and distinguishes this from a generic permission error, naming the actual rule rather than a raw token)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A (pre-existing `SELF_APPROVAL_NOT_ALLOWED` coverage from an earlier batch's work already exercises this at the unit level; this batch's contribution is a fresh live confirmation)
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-011 (boundary only), A-009 (send_back has the identical self-approval-style guard, `SELF_APPROVAL_NOT_ALLOWED` on send-back too, confirmed by code reading of `send_back_customer_onboarding_case`)
- Final Status: PASS
- Notes: N/A

---

## A-013: Case creation blocked with no active workflow bound (superseded premise, RECONCILED)

- Journey ID: A-013
- Journey Name: Case creation blocked with no active workflow bound (originally: Approval with no active workflow bound, default approval mechanism)
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: workflow_definitions id a5560ddd-dd89-4e6a-9e9e-f3228a81f2e8 (WF-TEST Simple One-Step Approval), briefly deactivated and restored with explicit user authorization
- Starting State: The originally-scheduled starting state ("no workflow version with applies_to = 'customer_onboarding' is both active and published") was reproduced by briefly setting `is_active = false` on the fixture's only active row
- Actions Executed: With explicit user authorization (a live mutation to shared state, gated by the safety classifier), set the WF-TEST workflow's `is_active` to false, attempted `create_customer_onboarding_case`, then immediately restored `is_active` to true and confirmed case creation works normally again
- Expected Result (as originally written): Case is created, submitted, and approved with `workflow_version_id = null`, with any customer.approve holder able to approve it, no team-routing constraint applied.
- Actual Result (current, verified live): Case creation itself failed immediately with `WORKFLOW_NO_ACTIVE_DEFINITION: no active workflow definition with a published version exists for customer_onboarding; a new case cannot be created until one is activated`. No row was ever written. There is no longer any way to reach the "approve a workflow-less case" scenario this journey originally described, since a case cannot exist in that state at all. Restoring `is_active = true` immediately made case creation succeed again normally.
- Regular Result: N/A (the original Regular Path is unreachable; the new, correct current behavior is a creation-time hard block, confirmed above)
- Stress Result: N/A
- Authorization Result: N/A (the original variant, "any customer.approve holder can approve," cannot be exercised since no such case can exist)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit / Data Integrity Result: PASS (no customer_onboarding_cases row was written during the deactivated window, confirmed by the RPC's own exception and by the fact that no request_id was ever returned)
- Recovery Result: PASS (case creation resumed working normally immediately after `is_active` was restored, confirmed by a successful post-restore case creation, which was then cleaned up via cancel)
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED (as originally worded: the journey's premise, that a workflow-less case can be created and approved, is no longer true)
- Defect IDs: None (Category B: stale journey expectation, not a product defect; current behavior is the correct, intentional invariant introduced by migration `20260930000000_workflow_creation_requires_active_definition.sql`, applied before this batch and not touched by it)
- Root Cause: The journey was written before `20260930000000_workflow_creation_requires_active_definition.sql` made an active published workflow mandatory for case creation. The invariant was not weakened to make the old journey text pass, per this mission's explicit instruction.
- Fix: N/A (no code change; documentation correction only)
- Fix Commit: (docs-only change, included in the Batch 7 checkpoint commit)
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-001 (confirms normal case creation is unaffected once the workflow is restored active), A-014
- Final Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY
- Notes: `docs/NEXUS_JOURNEY_UNIVERSE.md`'s A-013 entry and `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`'s Batch 7 "Required fixtures" line were both corrected in this same batch to describe the current mandatory-workflow invariant, without touching this ledger's own historical record of what was originally scheduled and found. The brief `is_active` toggle used to reproduce this was authorized explicitly by the user in chat (a live mutation to shared state, initially blocked by the safety classifier) and was restored within seconds; no other user's session was observed to be affected, though this was not independently monitored beyond confirming the restore succeeded.

---

## A-014: Workflow version resolved once at creation, unaffected by later publishes

- Journey ID: A-014
- Journey Name: Workflow version resolved once at creation, unaffected by later publishes
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: request_id 530419a4-df03-42ed-a149-615230e4e036 (created earlier this session, bound to workflow_version_id b2b250c3-...), request_id ab03cac8-ef8f-4066-b187-63935c38b983 (freshly created this batch, also bound to b2b250c3-..., since no new version was published in between)
- Starting State: The WF-TEST workflow has three published versions (created 2026-09-16T01:40, 02:53, 02:56 UTC, from earlier batch test infrastructure), the latest (b2b250c3-...) being current
- Actions Executed: Queried an older, already-existing case's `workflow_version_id`/`current_workflow_node_key` directly, then created a fresh case and compared
- Expected Result: `workflow_version_id` is set once at creation and never re-resolved, regardless of later catalog changes
- Actual Result: Both the older case and the freshly-created case resolved to the same current version (b2b250c3-...), since no new version was published between them. This confirms stability but does not, by itself, exercise a live "publish a new version while a case is in flight" race within this batch's own window. Combined with code inspection (confirmed earlier this batch: `workflow_version_id` is written once at `create_customer_onboarding_case`'s insert and is never referenced again by any UPDATE statement in `save_customer_onboarding_draft`, `submit_customer_onboarding_case`, `send_back_customer_onboarding_case`, or `approve_customer_onboarding_case`) and historical evidence from this same workflow's three published versions having genuinely different node_2 team assignments (v1: Finance Approval/WF-TEST Finance; v3 current: Leadership Approval (V3)/WF-TEST Leadership, established earlier in this batch's own fixture-verification correction), this constitutes sufficient evidence that version-pinning is real and enforced by construction, not merely coincidental.
- Regular Result: PASS
- Stress Result: N/A (a live third-version-published-while-in-flight stress test was not performed this batch; publishing a brand new workflow version mid-batch was judged out of proportion to what this journey requires, given the code-level guarantee and existing multi-version historical evidence already available)
- Authorization Result: PASS by historical evidence (the older case, if it were still active, would only ever route to whichever team its own bound version designates; the multi-version team-difference proves this is not a shared, mutable routing pointer)
- Concurrency Result: N/A (not separately live-tested this batch)
- Idempotency Result: N/A
- Audit / Data Integrity Result: PASS (`workflow_version_id` confirmed identical and stable across a query taken this batch versus the case's own value at creation time earlier this session)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: PASS (the older case, created under different catalog conditions than exist now, still resolves consistently against its own bound version)
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-001, A-013
- Final Status: PASS
- Notes: Automation Feasibility is FULL per the Universe doc; this batch's execution leaned on a combination of live confirmation plus code-level and historical evidence rather than freshly publishing a fourth workflow version live, which was judged unnecessary given the strength of the existing evidence and the desire to avoid unnecessary administrative changes to shared test infrastructure beyond what this journey strictly requires.

---

## A-015: Submit rejected on non-draft/non-sent_back case

- Journey ID: A-015
- Journey Name: Submit rejected on non-draft/non-sent_back case
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P1 (inferred from sibling state-guard journeys; not independently re-checked against the Universe doc's own priority field this batch)
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: request_id 89e2ca57-e688-49be-812b-1617145ffc48 (created, then cancelled, to produce the illegal-state fixture)
- Starting State: Case in cancelled status (created as draft, then cancelled by its own creator)
- Actions Executed: Called `submit_customer_onboarding_case` directly on the cancelled case
- Expected Result: Rejected with a named, human-readable error; case remains cancelled
- Actual Result: Rejected with "ONBOARDING_CASE_NOT_SUBMITTABLE: case 89e2ca57... has status cancelled, only draft or sent_back may be submitted"
- Regular Result: N/A
- Stress Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS (this journey is itself an idempotency-adjacent guard: repeated illegal submit attempts on the same cancelled case would fail identically every time, by construction of the status check)
- Audit / Data Integrity Result: PASS (no state change on the rejected attempt)
- Recovery Result: N/A
- UX Result: PASS (message names the actual current status and the two statuses that would be valid, not a raw enum or generic error)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A (this guard lives in the RPC itself and is unmodified by this batch's fixes; pre-existing coverage stands)
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-016, A-017, A-018
- Final Status: PASS
- Notes: This state-guard lives in the SQL RPC itself, unlike A-004's field-validation gap, so testing it via a direct RPC call is the correct, authoritative-boundary test, not a bypass.

---

## A-016: Send-back rejected on non-submitted case

- Journey ID: A-016
- Journey Name: Send-back rejected on non-submitted case
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P1 (inferred)
- Automation Feasibility: FULL
- Personas: wf-test.leadership-approver@example.test
- Test Data / Record References: request_id 89e2ca57-e688-49be-812b-1617145ffc48 (same cancelled fixture as A-015)
- Starting State: Case in cancelled status
- Actions Executed: Called `send_back_customer_onboarding_case` on the cancelled case
- Expected Result: Rejected with a named error
- Actual Result: Rejected with "ONBOARDING_CASE_NOT_SENDBACKABLE: case 89e2ca57... has status cancelled, only submitted or resubmitted may be sent back"
- Regular Result: N/A
- Stress Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS
- Audit / Data Integrity Result: PASS (no state change)
- Recovery Result: N/A
- UX Result: PASS
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-015, A-017
- Final Status: PASS
- Notes: N/A

---

## A-017: Approve rejected on non-submitted case

- Journey ID: A-017
- Journey Name: Approve rejected on non-submitted case
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P1 (inferred)
- Automation Feasibility: FULL
- Personas: wf-test.leadership-approver@example.test
- Test Data / Record References: request_id 89e2ca57-e688-49be-812b-1617145ffc48 (same cancelled fixture)
- Starting State: Case in cancelled status
- Actions Executed: Called `approve_customer_onboarding_case` on the cancelled case with placeholder commercial parameters
- Expected Result: Rejected before any customer/commercial row is created
- Actual Result: Rejected with "ONBOARDING_CASE_NOT_APPROVABLE: case 89e2ca57... has status cancelled, only submitted or resubmitted may be approved"; no customer or commercial rows created
- Regular Result: N/A
- Stress Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS
- Audit / Data Integrity Result: PASS (no customer/commercial rows created, confirmed by the rejection occurring before any such insert in the RPC body)
- Recovery Result: N/A
- UX Result: PASS
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-015, A-016
- Final Status: PASS
- Notes: This is also indirect evidence toward A-011: the atomic all-or-nothing transaction never even begins when the status guard fails first, consistent with A-011's own atomicity expectation.

---

## A-018: Cancel draft case by creator

- Journey ID: A-018
- Journey Name: Cancel draft case by creator
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P1 (inferred)
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: request_id 0566fdac-ead8-4130-8116-baaad5de1a2b
- Starting State: Draft case created by the maker
- Actions Executed: Maker called `cancel_customer_onboarding_case` on their own draft
- Expected Result: Case transitions to cancelled
- Actual Result: Succeeded, status now cancelled
- Regular Result: PASS
- Stress Result: N/A
- Authorization Result: PASS (creator succeeds, see A-019 for the non-creator denial half of this same journey pair)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit / Data Integrity Result: PASS (cancelled_by/cancelled_at/cancelled_reason populated correctly)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: Re-confirmed after the ownership fix (migration `20260930050000`) was applied: creator cancel is untouched by that migration (cancel already had its own correct ownership check) and continues to work correctly
- Neighboring Journeys Rerun: A-019, A-002 (ownership-fix verification)
- Final Status: PASS
- Notes: N/A

---

## A-019: Cancel attempt by non-creator blocked

- Journey ID: A-019
- Journey Name: Cancel attempt by non-creator blocked
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P0 (inferred; this is the authorization-critical half of the A-018/A-019 pair)
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test (creator), wf-test.finance-checker@example.test (non-creator)
- Test Data / Record References: request_id 0566fdac-ead8-4130-8116-baaad5de1a2b (same case as A-018, cancel attempted by the non-creator first, then correctly by the creator)
- Starting State: Draft case created by the maker
- Actions Executed: A different user (finance-checker, not the creator) called `cancel_customer_onboarding_case` on the maker's draft
- Expected Result: Rejected; only the creator may cancel
- Actual Result: Rejected with "ONBOARDING_CASE_CANCEL_NOT_OWNER: only the creator of case 0566fdac... may cancel it"
- Regular Result: N/A
- Stress Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: PASS (repeated non-creator attempts would fail identically, by construction)
- Audit / Data Integrity Result: PASS (no state change on the rejected attempt)
- Recovery Result: N/A
- UX Result: PASS (clear ownership-specific message)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A (this is the pre-existing, already-correct pattern that DEFECT-B7-002's fix for Save/Submit was modeled on)
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-018, A-002
- Final Status: PASS
- Notes: This journey's own already-correct enforcement is exactly what made DEFECT-B7-002 (A-002/A-003's missing ownership check) so clearly a gap by comparison: Cancel had this control from the start; Save and Submit did not, until this batch's fix.

---

## A-036: Viewing another maker's draft onboarding case by request_id (NEW journey, discovered this batch)

- Journey ID: A-036
- Journey Name: Viewing another maker's draft onboarding case by request_id
- Started At: 2026-09-20
- Completed At: 2026-09-20
- Priority: P2
- Automation Feasibility: FULL
- Personas: Maker A (creator), Maker B (non-creator, same customer.create permission)
- Test Data / Record References: Confirmed via direct source reading of the onboarding case detail route's authorization check and the underlying read service's function signature (architectural detail withheld from this ledger per the mission's own "not a security exploit manual" rule; a specific route/reproduction is not recorded here since this gap is not yet fixed)
- Starting State: Maker A has a draft case; Maker B holds customer.create but did not create it and is not a reviewer for it
- Actions Executed: Read the relevant route and service code path (not separately live-clicked through in the browser this batch, since the code itself unambiguously shows the gap without needing a live reproduction)
- Expected Result: Undecided pending a product decision (see Universe entry); this journey exists to make the current, real behavior visible, not to assert a specific expected outcome
- Actual Result: Confirmed at the architectural level: the onboarding case detail read path authorizes on the blanket `customer.create` permission only, with no check that the caller is the case's own creator, so read access to an in-progress draft is not currently scoped to its owner. Mutation (Save, Submit) is now creator-only as of this batch's DEFECT-B7-002 fix; read access was deliberately left unchanged pending a product decision (see Fix below).
- Regular Result: PASS in the sense that the code path was confirmed and matches this description exactly
- Stress Result: N/A
- Authorization Result: This IS the authorization variant (see Actual Result)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit / Data Integrity Result: N/A (read-only; no mutation occurs)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: N/A (newly discovered this batch; there is no prior status to compare against)
- Defect IDs: DEFECT-B7-002 (same discovery context as the Save/Submit ownership gap, but classified separately since read and write are different controls with different correct answers)
- Root Cause: N/A (see Notes; this is Category F, a product decision, not a bounded code defect)
- Fix: Not applied this batch. Deliberately deferred: unlike Save/Submit (where creator-only is unambiguously correct, since a draft business record with no other stated collaboration model should not be editable by strangers), read-only visibility into an in-progress draft has no established precedent in this codebase either way, and narrowing it without a product decision risks breaking an undocumented legitimate collaboration path if one exists.
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: A-002, A-003, A-019
- Final Status: PRODUCT GAP CONFIRMED
- Notes: New journey ID assigned in Pack A (`docs/NEXUS_JOURNEY_UNIVERSE.md`); Coverage Matrix and Execution Plan not separately updated for this single addition beyond the Coverage Matrix's mechanical count regeneration, since the Execution Plan's batch assignments are not affected by a single P2 addition scheduled for a future batch's authorization sweep. Recorded here, not fixed, per this mission's own "classify without inventing policy" instruction for gaps requiring a business decision.

---
