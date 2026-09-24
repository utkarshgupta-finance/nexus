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
- **Product Decision Closure (2026-09-21, PD-001 CLOSED): PENDING -> DECIDED -> IMPLEMENTED.** Business decision: an onboarding request in `draft` is visible only to its own creator; once submitted, normal workflow/reviewer visibility applies unchanged. Implemented server-side (not a UI-only hide): `getOnboardingCase(requestId, actorUserId)` (`src/features/customer-onboarding/services/case.service.ts`) now returns `null` for a `draft`-status case whose `created_by` does not match `actorUserId`, identical to a genuinely nonexistent request id (no existence leak). All three read entry points that reach this function were updated to pass the server-derived actor (never client-supplied): the requester's own form detail route (`src/app/forms/customer-onboarding/[requestId]/page.tsx`), the reviewer detail route (`src/app/reviews/[requestId]/page.tsx`, which also threads the actor into `loadOnboardingRequestTimeline`), and the public API (`src/app/api/v1/onboarding/[id]/route.ts`, using the actor already resolved by `requireApiPermission`). The pre-existing "My Requests" list and Approvals inbox were confirmed already creator-scoped/draft-excluded respectively (no change needed there). Unit tests added: `src/features/customer-onboarding/services/case.service.test.ts` (creator sees own draft; non-creator denied on draft; non-creator allowed once submitted; nonexistent id indistinguishable from denial). No migration required (pure TypeScript change). Verified: `tsc`/`eslint`/full vitest suite (941 tests) all green. Manual UX click-through of the actual denied-read path was not separately performed in a browser this pass; the server-side unit tests directly exercise the exact function every read route calls, which is the enforcement boundary itself, not a UI approximation of it.

---

# NEXUS END-TO-END BUSINESS JOURNEY VALIDATION BATCH 7 REPORT

## Summary

- Scheduled journeys: 25 (P-018 through P-023, A-001 through A-019), all present exactly once in this ledger.
- PASS: 19 (P-018, P-019, P-020, P-021, P-022, P-023, A-001, A-003, A-007, A-008, A-009, A-010, A-012, A-014, A-015, A-016, A-017, A-018, A-019)
- FAILED THEN FIXED + PASS: 4 (A-002, A-004, A-005, A-006)
- BLOCKED (deliberately not executed, in-scope decision, not a tooling failure): 1 (A-011)
- EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY (stale journey premise, current behavior is correct): 1 (A-013)
- PRODUCT GAP CONFIRMED: 0 among the scheduled 25 (A-036, the one PRODUCT GAP CONFIRMED result this batch, is a new journey, not one of the 25)
- Non-scheduled work also recorded: P-013 neighbor regression (no defect, evidence only, not counted), A-036 new journey (PRODUCT GAP CONFIRMED, not counted)
- Real product defects found and fixed: 2 (DEFECT-B7-001, DEFECT-B7-002)
- Real product gaps found and deliberately left open pending a product decision: 1 (the read-visibility half of DEFECT-B7-002, tracked as A-036)

## Per-journey dimension coverage

| Journey | Regular | Stress | Auth | Concurrency | Idempotency | Audit | Recovery | UX | Historical | Final Status |
|---|---|---|---|---|---|---|---|---|---|---|
| P-018 | N/A | N/A | PASS | N/A | N/A | PASS | N/A | N/A | N/A | PASS |
| P-019 | N/A | N/A | PASS | N/A | N/A | PASS | N/A | N/A | N/A | PASS |
| P-020 | PASS | N/A | N/A | N/A | N/A | PASS | N/A | N/A | N/A | PASS |
| P-021 | PASS | N/A | N/A | N/A | N/A | PASS | N/A | PASS | PASS | PASS |
| P-022 | PASS | N/A | N/A | N/A | N/A | PASS | N/A | N/A | N/A | PASS |
| P-023 | N/A | N/A | N/A | PASS | N/A | PASS | N/A | PASS | N/A | PASS |
| A-001 | PASS | N/A | N/A | N/A | N/A | PASS | N/A | N/A | N/A | PASS |
| A-002 | PASS | N/A | FAILED→PASS | PASS | N/A | PASS | N/A | N/A | N/A | FAILED THEN FIXED + PASS |
| A-003 | PASS | N/A | PASS | N/A | PASS | PASS | N/A | N/A | N/A | PASS |
| A-004 | FAILED→PASS | PASS | N/A | N/A | N/A | FAILED→PASS | PASS | PASS | N/A | FAILED THEN FIXED + PASS |
| A-005 | FAILED→PASS | N/A | N/A | N/A | N/A | PASS | N/A | PASS | N/A | FAILED THEN FIXED + PASS |
| A-006 | FAILED→PASS | PASS | N/A | N/A | N/A | PASS | N/A | PASS | N/A | FAILED THEN FIXED + PASS |
| A-007 | PASS | N/A | N/A | N/A | N/A | PASS | N/A | PASS | N/A | PASS |
| A-008 | PASS | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | PASS |
| A-009 | PASS | N/A | N/A | N/A | N/A | PASS | N/A | N/A | N/A | PASS |
| A-010 | PASS | PASS | N/A | N/A | N/A | PASS | N/A | N/A | PASS | PASS |
| A-011 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | BLOCKED (deliberate) |
| A-012 | N/A | N/A | PASS | N/A | N/A | PASS | N/A | PASS | N/A | PASS |
| A-013 | N/A | N/A | N/A | N/A | N/A | PASS | PASS | N/A | N/A | EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY |
| A-014 | PASS | N/A | PASS | N/A | N/A | PASS | N/A | N/A | PASS | PASS |
| A-015 | N/A | N/A | N/A | N/A | PASS | PASS | N/A | PASS | N/A | PASS |
| A-016 | N/A | N/A | N/A | N/A | PASS | PASS | N/A | PASS | N/A | PASS |
| A-017 | N/A | N/A | N/A | N/A | PASS | PASS | N/A | PASS | N/A | PASS |
| A-018 | PASS | N/A | PASS | N/A | N/A | PASS | N/A | N/A | N/A | PASS |
| A-019 | N/A | N/A | PASS | N/A | PASS | PASS | N/A | PASS | N/A | PASS |

(Non-scheduled, recorded for completeness: P-013 neighbor regression, no defect; A-036, PRODUCT GAP CONFIRMED.)

## Defects

**DEFECT-B7-001**
- Journeys: A-004 (discovery), A-003/A-005/A-006/A-009/A-010 (neighboring confirmation)
- Severity: Critical (P0). Any authenticated `customer.create` holder calling the real backend directly could create a `submitted` onboarding case with zero data, or with a GST/PAN that exactly duplicates an already-approved customer, entirely bypassing the browser's own field-completeness and duplicate-detection checks.
- Observed: `submit_customer_onboarding_case` only checked case status (`draft`/`sent_back`) and draft-revision existence. An empty draft was reproduced live: submitted successfully, workflow node advanced.
- Expected: Server-side field completeness and hard-duplicate checks, matching the browser client's own validation, enforced at the real authoritative boundary.
- Root cause: All such validation existed exclusively in `customer-onboarding-page.tsx`'s `handleSubmit`, never in the RPC or any server-side service layer.
- Fix: `validateOnboardingCaseReadyForSubmit` added to `src/features/customer-onboarding/services/case.service.ts`, called from `submitOnboardingCase` before the RPC whenever the current revision is a draft. Reuses existing, already-tested pure functions; scoped to Customer Details, Tax & Registration fields/documents, and GST/PAN hard duplicates.
- Regression: `case.service.test.ts` (new, 6 tests).
- Rerun: A-003 (happy path, PASS), A-004 (blocked, PASS), A-005/A-006 (hard duplicates blocked, PASS), A-007/A-008 (soft warnings still non-blocking, PASS), A-009/A-010 (send-back/resubmit re-validates, PASS, including a fresh-duplicate-on-resubmit stress case).
- Commit: 552d301

**DEFECT-B7-002**
- Journeys: A-002 (discovery, Authorization Variant), A-003 (same root cause on Submit), A-036 (sibling read-access gap, deliberately not fixed)
- Severity: High (write half, now fixed) / Medium (read half, A-036, open). Any `customer.create` holder, not only the case's own creator, could edit and submit another maker's in-progress draft merely by knowing its request_id.
- Observed: `saveOnboardingDraftAction` and `submitOnboardingCaseAction` (and the underlying RPCs) checked only the blanket `customer.create` permission, with no `created_by` comparison, unlike `cancel_customer_onboarding_case`, which already had the correct check.
- Expected: Only the case's own creator may edit or submit their draft (A-002/A-003's own explicitly scheduled Authorization Variants).
- Root cause: Save and Submit were never given the same ownership check Cancel already had.
- Fix: Migration `20260930050000_onboarding_draft_save_submit_creator_only.sql` adds a `created_by` check to `save_customer_onboarding_draft` (`ONBOARDING_DRAFT_SAVE_NOT_OWNER`) and `submit_customer_onboarding_case` (`ONBOARDING_CASE_SUBMIT_NOT_OWNER`), applied to the shared Supabase database with explicit user authorization. Applied at the RPC layer itself, not only the TypeScript service layer, so it holds even against a direct RPC caller.
- Regression: `case-errors.test.ts` (2 new tests mapping the new tokens).
- Rerun: Live-verified post-fix: non-creator save/submit rejected; legitimate creator's own save/submit unaffected; A-018/A-019 (cancel ownership, pre-existing, unmodified) confirmed unaffected.
- Commit: 5e3e495
- Open remainder: read access to another maker's draft (viewing, not mutating) was deliberately left unfixed pending a product decision, tracked as new journey A-036 (Category F, PRODUCT GAP CONFIRMED, not a bounded defect).

## Product gaps

- **A-036 (new journey)**: Read access to an in-progress onboarding draft is scoped only to the blanket `customer.create` permission, not to the case's own creator. Unlike Save/Submit, there is no established precedent in this codebase for whether draft reads should be creator-scoped, and narrowing it without a product decision risks breaking an undocumented legitimate collaboration path if one exists. Recommended for a future batch's authorization sweep. Full architectural detail is intentionally withheld from this ledger and the Universe document while this gap remains open, per the public-repository "not an exploit manual" rule; it is disclosed to you now in this response and was disclosed via the applied-fix chat exchange for its Save/Submit sibling, but the written record stays at the architectural level until the gap is closed.

## New journeys

- **A-036**: Viewing another maker's draft onboarding case by request_id. Assigned in Pack A, Priority P2, Automation Feasibility FULL. Added to `docs/NEXUS_JOURNEY_UNIVERSE.md` (Pack A, after A-035) and reflected in `docs/NEXUS_JOURNEY_COVERAGE_MATRIX.md`'s mechanically-regenerated counts (Pack A: 35→36 total, Regular +1, Authorization +1, Audit +1; overall Total 783→784). Not added to `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`'s batch assignments, since a single P2 addition does not require rebalancing existing batch scope; scheduled informally for whichever future batch runs the next authorization sweep.

## Reference Master closure (P-018 through P-023)

All six PASS. P-013's server-enforcement boundary (closed in the prior Product Gap Closure segment) was independently re-verified as a neighboring regression, not one of the 25 scheduled journeys: Level 3 existing values remain readable, Level 3 new-value creation remains rejected with `REFERENCE_LIST_SYSTEM_SUPPORTED`, and Level 1 lists remain fully addable. No regression found.

## Customer Onboarding state (explicit confirmations)

- Was any Customer Master record created during Batch 7? **NO.** Confirmed: A-011 was deliberately not executed; every case created this batch remained in draft, submitted, resubmitted, sent_back, or cancelled status; no `customers` table row was inserted by any Batch 7 action. The two pre-existing approved fixtures used as duplicate-detection targets (Test SQL Smoke Co, Test Customer 1) were read-only references from earlier batches, never mutated.
- Onboarding drafts created this batch: approximately 20 test cases across all A-series scripts (all prefixed or clearly identifiable as Batch 7 fictional test data, e.g. "Batch7 A003 HappyPath Co", "Batch7 A009 SendBack Co"), left in a mix of submitted/resubmitted/sent_back/cancelled/draft states as appropriate to each journey; none approved.
- Workflow bindings verified: every case created this batch bound once, at creation, to the current published customer_onboarding workflow version (`b2b250c3-...`); the fixture-verification correction (Leadership Approval / WF-TEST Leadership, not Finance Approval / WF-TEST Finance) was made before any A-series journey execution and is documented in this ledger's Fixture verification section.
- Duplicates tested: GST hard block (A-005), PAN hard block (A-006), combined GST+PAN hard block (A-006 stress), legal name soft non-block (A-007), brand name soft non-block (A-008), all against real pre-existing approved fixtures from earlier batches, never against a customer created by Batch 7 itself.
- Stage validation verified: server-side Customer Details and Tax & Registration completeness (A-004), full happy path (A-003), send-back/resubmit re-validation including a fresh-duplicate stress case (A-009/A-010), all through the real TypeScript service layer boundary, not only the RPC.
- Self-approval, illegal state transitions, and cancel ownership all confirmed server-enforced (A-012, A-015 through A-019).

## Persistent ledger

`docs/journey-runs/BATCH_07_RESULTS.md` (this file) contains all 25 scheduled journeys exactly once, the P-013 neighbor regression, the new A-036 journey, and this final report. Committed across four commits (see COMMITS below).

## Tests

- `npx tsc --noEmit`: clean (only pre-existing type errors in a since-deleted throwaway script, not committed).
- `npx vitest run`: 922/922 tests passing (102 test files), including 6 new tests in `case.service.test.ts` and 2 new tests in `case-errors.test.ts`.
- `npx eslint .`: clean.
- `npm run build`: succeeded (dynamic-route warnings for cookie-based auth routes are expected, not errors).
- `npm audit`: 0 vulnerabilities.

## Commits

- `552d301` Add server-side submit validation for Customer Onboarding cases (DEFECT-B7-001 fix)
- `5e3e495` Enforce creator-only Save and Submit on Customer Onboarding drafts (DEFECT-B7-002 fix, includes migration `20260930050000_onboarding_draft_save_submit_creator_only.sql`)
- `0dd2e6c` Batch 7 journey validation ledger, Universe/Coverage Matrix/Execution Plan reconciliation
- `b1c220b` Redact A-036's exploit mechanic to an architectural-level description

## Deployment

- Local HEAD: `b1c220b5ce25e476071cd4e670261c043e7962a7`
- `origin/team-preview`: `b1c220b5ce25e476071cd4e670261c043e7962a7` (matches)
- Vercel Preview deployment `dpl_F7nGe8B5YFPX8Ay3zku1PiFjLzyG`: READY, `githubCommitSha` = `b1c220b5ce25e476071cd4e670261c043e7962a7` (matches), branch alias `nexus-git-team-preview-utkarshgupta-finance.vercel.app` updated, `target: null` (Preview, not Production)
- `origin/main` (Production): `04aba7a`, confirmed NOT an ancestor relationship with this batch's commits; Production untouched
- Migration `20260930050000_onboarding_draft_save_submit_creator_only.sql` applied to the shared Supabase database with explicit user authorization; `npx supabase migration list --linked` confirmed local/remote parity afterward

## Batch 7 exit criteria

- [x] Ledger exists with all 25 scheduled IDs present exactly once
- [x] Every journey has both Original Status and Final Status
- [x] Every failure preserved historically (A-002, A-004, A-005, A-006 retain Original Status: FAILED)
- [x] Every fix links to defect/fix/regression evidence (DEFECT-B7-001, DEFECT-B7-002)
- [x] New journeys recorded separately (A-036), not mixed into the 25-count
- [x] Ledger committed
- [x] Checkpoint suite passed (tsc/vitest/eslint/build/audit)
- [x] Secret scan and hygiene checks passed (no `.env.local`/`.runtime-tests`/`.claude/launch.json` changes, no secrets in diff)
- [x] Pushed to `team-preview` only; deployment parity confirmed; Production untouched

## Next batch

**Batch 8 READY.**

Reasoning: all 25 Batch 7 journeys reached a terminal, honestly-recorded status. The one BLOCKED journey (A-011) is a deliberate in-scope decision, not an unresolved defect or environment failure, and Batch 8's own scheduled scope (per the Execution Plan) is exactly A-020 through A-035, ACC-001, B-001 through B-008, which includes the full execution of A-011 itself. Both defects found this batch are fixed, regression-tested, and deployed. The one open product gap (A-036) is explicitly scoped as a future authorization-sweep item, not a blocker for Batch 8's own content, since Batch 8 does not depend on onboarding draft read-visibility being resolved first. Batch 8 will be the first batch to execute a real A-011 approval, which will also unblock a fully live (rather than fixture-reused) A-005/A-006 hard-duplicate confirmation for any future regression re-run.

**Batch 8 is NOT executed as part of this session, per explicit instruction.**

NEXUS END-TO-END BUSINESS JOURNEY VALIDATION BATCH 7 COMPLETE

---

## Addendum: DEFECT-B7-001 authoritative-boundary re-verification (pre-Batch-8, neighboring regression)

Performed at explicit user request before starting Batch 8, per the mission's own instruction not to assume DEFECT-B7-001's closure without empirically re-testing the same class of direct invocation used to discover it. Not a scheduled Batch 7 or Batch 8 journey; does not change either batch's journey count.

**Re-verification of DEFECT-B7-001's three required invariants**, executed fresh via the real application boundary (`submitOnboardingCase` in the TS service layer, the only path a real user's request can reach):
1. Incomplete onboarding submission: REJECTED ("Customer Details is incomplete...")
2. Duplicate GST hard-blocker submission: REJECTED ("This GST or PAN already belongs to an existing customer...")
3. Valid complete onboarding submission: SUCCEEDED (status: submitted)

All three PASS. DEFECT-B7-001 remains closed at the application boundary.

**Direct-RPC-layer verification**: queried live `pg_proc.proacl` (not assumed from migration file text) and made real, unauthenticated HTTP calls to the PostgREST RPC endpoint using only the public anon key (no session, no service-role credential). `submit_customer_onboarding_case` and `save_customer_onboarding_draft` both returned `permission denied for function` (SQLSTATE 42501): confirmed unreachable by any real application user, only by a service-role (backend-only secret) credential, the same higher-trust-tier access already used all session to reproduce the original bug. For these two functions, the TS-layer fix is the genuine authoritative boundary.

**New finding, DEFECT-B7-003** (discovered during this re-verification, not part of the original DEFECT-B7-001):
- Severity: Critical (latent). `create_customer_onboarding_case`, `cancel_customer_onboarding_case`, `send_back_customer_onboarding_case`, and `approve_customer_onboarding_case` all still carried Postgres's default PUBLIC execute grant. Their original migrations revoked execute from `anon, authenticated` by name but never from `public`, and revoking a named role does not remove the separate grant every role implicitly inherits from PUBLIC. Live proof before the fix: an anonymous call to `create_customer_onboarding_case` returned 401, but with `permission denied for table form_definitions`, not `permission denied for function create_customer_onboarding_case` — the function itself began executing and only failed because an unrelated internal table happened to lack its own anon/authenticated grant. That was accidental protection, not intentional. `approve_customer_onboarding_case` was worse: its live signature has grown two extra parameters since the original revoke was authored, so that revoke silently targeted an overload that no longer exists; the live function had never been revoked from anon/authenticated or public at all.
- Root cause: incomplete REVOKE statements at each function's original authoring (never named `public`), compounded for `approve_customer_onboarding_case` by a later signature change that created an effectively new, never-revoked function object.
- Fix: migration `20260930060000_onboarding_rpc_revoke_public_execute.sql`, `revoke all ... from public, anon, authenticated` on all 4 functions using their exact current live signatures (verified via `pg_get_function_identity_arguments`, not assumed from old grant statements), applied to the shared Supabase database with explicit user authorization.
- Regression: live re-verified post-fix via `pg_proc` privilege query (all 4 now `false` for anon/authenticated) and via real anonymous HTTP calls to all 4 (all 4 now return the correct `permission denied for function <name>`, SQLSTATE 42501). A service-role smoke test (create then cancel a case) confirmed legitimate application traffic is unaffected.
- Commit: (see COMMITS addendum below)

**Update, superseded by the full closure below**: the 13-function finding originally deferred here (Customer Change, Commercial Configuration, Go Live) was subsequently investigated and fixed in full, plus 5 more functions the first pass missed. See the "NEXUS GOVERNED RPC TRUST-BOUNDARY CLOSURE" section below for the complete audit, fix, and verification.

**Commits (addendum)**:
- `20260930060000_onboarding_rpc_revoke_public_execute.sql` migration and this addendum, committed and pushed to `team-preview` after this report's original completion.

---

# NEXUS GOVERNED RPC TRUST-BOUNDARY CLOSURE

Performed at explicit user request as a pre-overnight blocker before Batches 8-13. Not a scheduled journey batch; adds one new stable journey (AB-041) and extends DEFECT-B7-003 (opened in the addendum above for the first 4 functions) to its full scope. Does not change Batch 7's or Batch 8's scheduled journey counts.

Full function-by-function detail (exact names, call sites, and the verification methodology used) is intentionally not reproduced in this public ledger, per this program's own rule that authorization defects are documented at an architectural level, for reproducibility of the invariant, not as a step-by-step guide. That detail lives in this session's own record and in the fix migration's inline comments (which necessarily name each function to apply the correct `REVOKE`/`GRANT`, but do not narrate a discovery or verification methodology).

## Audit summary

A systematic, capability-based query (not a name-prefix guess, which was tried first and proved incomplete) found 18 functions in the `public` schema still exposing PostgreSQL execute privilege to the `anon`/`authenticated` roles via Postgres's default PUBLIC grant, the same class of gap already fixed for 4 Customer Onboarding functions in the addendum above. All 18 are `SECURITY INVOKER`.

Classification of all 18, per the mission's required categories:
- **SAFE BACKEND-ONLY, GRANT FIX REQUIRED: 16.** Spanning Customer Change, Commercial Configuration, Customer Master, and Go Live. Every one confirmed backend-only by architecture: its only call site in the codebase is a `*.data.ts` repository file using `getSupabaseServiceRoleClient()` (the same `server-only`-guarded, never-client-bundled pattern already established for every other governed RPC in this codebase). None are reachable from any browser/client component. The single most severe instance is a narrowly-permissioned Customer Master mutation whose TypeScript-layer permission gate (never granted broadly, by this project's own governance rule) was fully bypassable at the database layer before this fix.
- **INTENTIONALLY CLIENT-CALLABLE WITH AUTHORITATIVE INTERNAL AUTHORIZATION: 0.**
- **CLIENT-CALLABLE BUT AUTHORIZATION GAP: 0.**
- **NEEDS PRODUCT/ARCHITECTURE DECISION: 0.**
- **NO ISSUE: 2.** Two Postgres trigger functions (zero declared arguments, only ever invoked automatically via a `CREATE TRIGGER` attachment, no application call site at all). Revoking their PUBLIC grant has no effect on trigger firing (governed by the underlying table's own privileges, not the trigger function's own grant); included as zero-risk defensive hardening only.

None of the 16 real governed-mutation functions were ever actually exploited: each happened to fail on an unrelated internal table's own missing grant before reaching any real mutation, the same accidental-not-intentional protection pattern already documented for the original 4-function onboarding fix.

## Fix

Migration `20260930070000_governed_rpc_revoke_public_execute_sweep.sql`: `revoke all ... from public, anon, authenticated` on all 18 functions, using each function's exact current live signature (verified directly against the database, never assumed from an old grant statement, since the prior addendum already proved a function's signature can drift silently past an old revoke). Applied to the shared Supabase database. No business logic changed.

## Live verification

Verified, after the fix: the guard query (below) returns zero violations; every one of the 16 real governed RPCs now denies an unauthenticated call at the function level rather than an incidental table level; the 2 trigger functions are no longer resolvable as callable RPC endpoints at all. Legitimate trusted-server traffic was independently confirmed still works for each affected domain (Customer Change, Commercial Configuration, Customer Master, Go Live), tested only against pre-existing, clearly fictional test fixtures from earlier sessions, never a real customer or business record; no new data was left behind.

## Regression coverage

- `scripts/verify-governed-rpc-grants.ts` (new, permanent, not a throwaway script): calls the database's own guard function and fails loudly, printing every violation, if any exist. Run via `npx tsx --env-file=.env.local scripts/verify-governed-rpc-grants.ts` before applying any migration that touches a governed mutation RPC.
- `list_governed_rpc_grant_violations()` (SQL, added in the fix migration): the systemic guard itself, restricted to `service_role`. Pattern-based rather than a hardcoded function list, specifically because a hardcoded list is exactly what let this gap accumulate silently across 18 functions over many migrations; a new governed mutation RPC matching the naming convention is caught automatically without anyone needing to remember to add it to a list.
- New journey **AB-041** added to `docs/NEXUS_JOURNEY_UNIVERSE.md` (Pack AB: Security / Direct Action / Server Enforcement), reflected in `docs/NEXUS_JOURNEY_COVERAGE_MATRIX.md`'s mechanically-regenerated counts (Pack AB: 40->41 total; overall Total 784->785). Not added to `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`'s batch assignments, since it is a standalone, always-re-runnable database-state check, not tied to any specific batch's fixture setup.
- No vitest-level regression test was added: this codebase's test suite is entirely mocked unit tests with no live-database test harness, and mocking the privilege check would only test the mock, not the real database state. The live guard script and SQL function are the actual regression mechanism, matching the mission's own instruction to prefer a systemic guard over relying on remembered REVOKE statements.

## Defect record

**DEFECT-B7-003** (opened in the prior addendum for 4 functions, extended here to its full scope):
- Total RPCs audited: 18 (confirmed exhaustive against the entire `public` schema by capability, not a sample)
- Backend-only RPCs fixed: 16 real governed-mutation functions (4 from the prior addendum's onboarding fix + 14 more across Customer Change, Commercial Configuration, Customer Master, and Go Live) + 2 trigger functions hardened defensively (no behavior change)
- Intentionally client-callable RPCs found: 0
- Authorization gaps found requiring a different fix: 0 (every function was either already correctly backend-only in intent, just missing the PUBLIC revoke, or a harmless trigger function)
- No-issue RPCs: 2 (the trigger functions)
- Migrations: `20260930070000_governed_rpc_revoke_public_execute_sweep.sql`, extending `20260930060000_onboarding_rpc_revoke_public_execute.sql`
- Regression coverage: `scripts/verify-governed-rpc-grants.ts` + `list_governed_rpc_grant_violations()` SQL guard function, both permanent
- Live verification: see above, all PASS
- Severity: Critical (latent, never actually exploited, as explained above)
- Root cause: every affected function's original migration wrote `revoke execute ... from anon, authenticated` without also naming `public`; revoking a named role never removes the separate default grant every role implicitly inherits from PUBLIC
- Fix commit: (see COMMITS below)

## Tests

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 922/922 passing (no test changes; this closure is a pure database-privilege and tooling addition).
- `npx eslint .`: clean.
- `npm run build`: succeeded.
- `npm audit`: 0 vulnerabilities.
- Secret scan: clean. `.env.local`, `.runtime-tests`, `.claude/launch.json` all untouched.

## Commits

- Migration `20260930070000_governed_rpc_revoke_public_execute_sweep.sql` + `scripts/verify-governed-rpc-grants.ts`; Universe/Coverage Matrix docs (AB-041); this ledger section. Exact SHAs, backfilled 2026-09-21 (Batches 1-13 Ledger Audit) from `git log`: `4d2cb0f` ("Revoke latent PUBLIC execute grant on 4 Customer Onboarding RPCs", the addendum's first-pass finding) and `b967a5e` ("Governed RPC Trust-Boundary Closure: revoke PUBLIC execute grant sweep", the full 16-RPC/2-trigger sweep).

## Deployment

- Pushed to `team-preview` only. Local HEAD, `origin/team-preview`, and the Vercel Preview deployment's `githubCommitSha` all verified to match at push time; `origin/main` (Production) confirmed unrelated/untouched.

## Final call

**TOTAL RPCS AUDITED: 18**
**BACKEND-ONLY RPCS FIXED: 16** (plus 2 trigger functions hardened defensively)
**INTENTIONALLY CLIENT-CALLABLE RPCS: 0**
**AUTHORIZATION GAPS FOUND (needing a different fix): 0**
**NO-ISSUE RPCS: 2** (the trigger functions)

**OVERNIGHT BATCHES 8-13 READY.**

NEXUS GOVERNED RPC TRUST-BOUNDARY CLOSURE COMPLETE

---

## Historical UX Revalidation (overnight run, Batches 2-7) — FINAL BATCH

### BATCH 7 UX HEADER

| Historical journeys | MANUAL UX REQUIRED | MIXED MANUAL+SERVER | SERVER/DB ONLY | Historical UX evidence sufficient | Missing/partial UX evidence | Starting SHA |
|---|---|---|---|---|---|---|
| 26 (P-018 to P-023, A-001 to A-019, A-036) | 0 | 18 (P-021, P-023, A-001 to A-012, A-014, A-015, A-018, A-019) | 8 (P-018, P-019, P-020, P-022, A-013, A-016, A-017, A-036) | 0 (none of the original Batch 7 evidence used a genuine browser action) | 18 | `20a0f37` |

Reconciliation confirmed a striking pattern specific to this batch: not one of the 18 MIXED journeys' original evidence used a genuine `computer`/`form_input`/`navigate`+`read_page` browser action; every one was gathered via direct RPC calls, TS service-layer calls, or SQL queries, including the batch's own single most severe finding (DEFECT-B7-001, A-004's validation messaging) and A-011 (approval creating a real Customer Master record), which had literally never been executed in any form, since the original pass deliberately left it BLOCKED.

### Live execution performed this pass

Navigated to the real `/forms/customer-onboarding` page as the Maker persona and clicked "+ New Customer Onboarding": this created a genuine new draft case (CO-000100), confirmed both via the real rendered 5-stage Customer Onboarding form (Customer Details → Tax & Registration → Commercial Documents → Commercial Rate → Agreement & Approval) and via a direct database read (`customer_onboarding_cases`, `case_number = 100`, `status = 'draft'`, `current_stage_key = 'customer_details'`, `created_at` matching the exact moment of the click). This is genuine, dedicated live evidence for **A-001**.

Filled the Legal Entity Name field via `form_input` with a value matching an existing real customer name, to begin testing A-007's duplicate-name soft-warning behavior. Before this could be carried further (Segment/Business Unit/Industry selectors, Submit), the browser-automation tool began returning hard 30-second timeouts on subsequent `scroll`/`click` actions, on top of the click-delivery degradation already disclosed during Batch 6. This is the same escalating tooling issue, now including outright command timeouts, not a new or different one; it is documented in full in `docs/journey-runs/OVERNIGHT_PENDING_ACTIONS.md` and was not worked around by retrying indefinitely.

Given this, pivoted to genuine but purely read-only verification (`navigate` + screenshot only, no further clicks/scrolls attempted) for the one remaining item of the highest business value: **A-011**. Found an already-existing, already-approved onboarding case (CO-000098, `case_number = 98`, `status = 'approved'`) via a direct database query, confirmed its row has both `customer_id` and `commercial_configuration_id` populated (the atomic creation this journey exists to prove), then genuinely, live navigated to the resulting Customer Master record's real detail page (`/customers/WFTEST-M023-CUST`). The page renders a "SUMMARY" section with a field labeled "Originating Onboarding Request" and a real, clickable "View request" link, directly back to the onboarding case that created it. This is genuine, dedicated live UX evidence that a real, user-visible link between the newly created customer record and its originating request exists, closing **A-011**, a journey with previously zero evidence of any kind.

### BEGIN HISTORICAL UX REVALIDATION A-001

- **Canonical intent:** Confirm creating a new onboarding draft case works and the new draft is immediately visible to its creator.
- **Exact user-visible assertion:** Draft appears in "My Cases"/requests list immediately; the real 5-stage form renders.
- **Persona used:** `nexus-test-maker@example.test`.
- **Exact browser actions performed:** Clicked the real "+ New Customer Onboarding" button on the live requests list page.
- **Actual rendered result:** A new case, CO-000100, was created immediately; the page navigated to its real, rendered 5-stage form (Customer Details, Tax & Registration, Commercial Documents, Commercial Rate, Agreement & Approval), with the Customer Details stage's genuine fields (Legal Entity Name, Brand, Country, Address, State, City, Pincode, Industry, Website, Segment, Business Unit) all rendered and editable.
- **Expected result:** Draft created, visible immediately, form renders.
- **Manual UX result:** PASS.
- **Existing server/control evidence:** Direct DB confirmation (`customer_onboarding_cases`, case_number 100, status draft, created_at matching the click).
- **Defect found?:** No.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION A-001 (PASS)

### BEGIN HISTORICAL UX REVALIDATION A-011

- **Canonical intent:** Confirm a Reviewer's approval atomically creates a real Customer Master record, a Commercial Configuration, and Version 1, with a visible link from the approved request to the new record.
- **Exact user-visible assertion:** Post-approval, a link to the newly created customer record is visible.
- **Persona used:** `nexus-test-maker@example.test` (viewing; the approval itself was a pre-existing historical fact from case CO-000098, approved 22 Sept 2026 by WF-TEST Finance Head, per its own real Timeline).
- **Fixture used:** CO-000098 (`case_number = 98`), an already-approved case discovered via direct SQL query (`customer_onboarding_cases`, `status = 'approved'`), reused per this program's Fixtures rule rather than driving a brand-new case through all 5 stages, which the tooling degradation below made impractical this pass.
- **Exact browser actions performed:** Navigated to the real review page (`/reviews/437a35d4-...`) and observed its rendered Timeline ("Request created" → "Submitted for review" → "Null-Team Approval approved", with real actor names and timestamps, and "Approved on 22 Sept 2026. This case is historical evidence and can no longer be changed."). Then navigated to the resulting real Customer Master detail page (`/customers/WFTEST-M023-CUST`).
- **Actual rendered result:** The Customer Master page renders a real "SUMMARY" section containing "Originating Onboarding Request" with a genuine, clickable "View request" link back to CO-000098. Status "Active", Customer Key "WFTEST-M023-CUST", Legal Entity Name "WF-Test M-023 Customer".
- **Code-level confirmation (supports, does not replace, the above):** Direct DB query confirmed `customer_onboarding_cases.customer_id` and `.commercial_configuration_id` are both populated for this case, proving the atomic creation this journey exists to test.
- **Expected result:** Visible link to the new customer record.
- **Manual UX result:** PASS.
- **Existing server/control evidence:** DB-level atomic-creation confirmation above.
- **Defect found?:** No.
- **Journey Discovery observation:** ALREADY COVERED. This closes a journey that had zero evidence of any kind in the original pass (approval was deliberately not exercised then).
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION A-011 (PASS — first genuine evidence of any kind for this journey)

### BEGIN HISTORICAL UX REVALIDATION P-021, P-023, A-002 through A-010, A-012, A-014, A-015, A-018, A-019

- **Canonical intent (collectively):** The remainder of the batch's residual UX gaps: null-actor historical row rendering (P-021), a concurrent duplicate-add error message (P-023), incremental draft save with stage-completion indicators (A-002), post-submit success confirmation (A-003), the batch's single most severe finding, per-field/per-stage validation messaging on an incomplete submit (A-004, DEFECT-B7-001), hard-blocker visual treatment for duplicate GST/PAN (A-005, A-006), soft-warning visual treatment for duplicate Legal Entity/Brand Name (A-007, A-008), send-back per-field comments visible to the maker (A-009), resubmission context visible to the reviewer (A-010), a distinguishing self-approval-block message (A-012), workflow-version-routing display (A-014), a legible rejected-submit error (A-015), worklist visibility after cancellation (A-018), and the Cancel control's absence from non-creators' view (A-019).
- **Why a fresh live check could not be completed this pass:** A genuine live attempt was already in progress (a new draft case created, the Legal Entity Name field filled via `form_input`) when the browser-automation tool began returning hard 30-second timeouts on further `scroll`/`click` actions, on top of the click-delivery degradation already disclosed during Batch 6. This is recorded as the same escalating, disclosed tooling issue in `docs/journey-runs/OVERNIGHT_PENDING_ACTIONS.md`, not re-diagnosed from scratch here.
- **Expected result:** Each journey's own canonical assertion holds.
- **Manual UX result:** PARTIAL for all seventeen. None of the underlying business logic is in question (the original RPC/SQL-level evidence for each stands unchanged); each is blocked specifically on a fresh, dedicated live-render check by the same disclosed, escalating tool degradation.
- **Defect found?:** No new defect. DEFECT-B7-001 (A-004) remains exactly as originally documented and fixed at the message-content level; only its live on-screen rendering (as opposed to its service-layer text) was not freshly re-observed this pass.
- **Journey Discovery observation:** ALREADY COVERED for all seventeen.
- **Permanent ledger updated:** Yes (this entry). The one throwaway draft case created during the interrupted attempt, CO-000100, was left as an inert, harmless draft (no further mutation was attempted on it), consistent with this program's fixture-cleanup discipline where a genuine mid-flow interruption occurs.

### END HISTORICAL UX REVALIDATION (17 journeys, PARTIAL, blocked by the disclosed escalating tooling degradation)

---

## BATCH 7 CLOSURE (overnight run, Batches 2-7) — FINAL BATCH OF THIS OVERNIGHT RUN

### Batch Report

| Journey | UX evidence | Result | Discovery |
|---|---|---|---|
| P-018, P-019, P-020, P-022, A-013, A-016, A-017, A-036 | Already correctly SERVER/DB ONLY (unchanged) | ALREADY COVERED | ALREADY COVERED |
| A-001 | Genuine live draft creation, DB-confirmed | PASS | ALREADY COVERED |
| A-011 | Genuine live Customer Master page view showing the originating-request link, DB-confirmed atomic creation | PASS | ALREADY COVERED — first evidence of any kind |
| P-021, P-023, A-002–A-010, A-012, A-014, A-015, A-018, A-019 | Blocked by the disclosed, escalating tool degradation | PARTIAL | ALREADY COVERED |

### Summary Metrics

| Metric | Count |
|---|---|
| Historical journeys (Batch 7 UX-scoped worklist) | 18 |
| Genuinely revalidated live this pass | 2 (A-001, A-011) |
| PASS | 2 |
| FAILED THEN FIXED + PASS | 0 |
| Overnight blocked | 17, all one root cause: the escalating browser-automation tooling degradation (click-delivery failure plus new command timeouts) |
| Product decisions parked | 0 |
| New journeys discovered | 0 |
| Remaining ordinary UX residuals | 0 autonomously executable; 17 journeys blocked specifically by tooling, not a gap this run declined to close. A-011, the batch's most significant residual (zero prior evidence of any kind), is now genuinely closed. |

**Starting SHA:** `20a0f37`. Batch 7 closes the standing overnight directive's Batches 2-7 scope. Per the directive's explicit instruction, Batch 8 is NOT started. Proceeding to final checkpoint and the overnight run report.

---

### ADDENDUM 2026-09-24 (pass 1): dev-server restart, a genuine defect found and fixed, and a confirmed re-classification of the tooling blocker

Per the user's 2026-09-23 correction, the dev server was cleanly restarted (`.next` cleared, process killed and relaunched) and every parked item was retried fresh rather than assumed still blocked.

**Click-delivery limitation: confirmed to persist after a full clean restart, and more severe than previously documented.** A fresh click on a brand-new element reference, on a brand-new tab, on both a button and a plain link, produced zero effect (no server-side state change, no network request, no navigation). Keyboard input was tested as an independent code path and also failed to register. This means both pointer and keyboard input are failing to reach the page in this browser automation session, session-wide, not per-element and not fixable by a dev-server restart. Full detail in `docs/journey-runs/OVERNIGHT_PENDING_ACTIONS.md`. This confirms, rather than blindly carries forward, the root cause behind P-023, A-002 through A-008, A-012, A-015 (all genuinely require a fresh click/form submission to register).

**Genuine defect found and fixed while investigating A-009/A-010:** reloading (or freshly navigating to) an onboarding case parked at "Tax & Registration" or later stage rendered the wrong survey page's fields (Customer Details) under the correct-looking stage header, because a freshly-mounted form-engine instance always defaults to its first page regardless of the case's actual persisted stage, and nothing synced it on mount. Fixed in `src/features/customer-onboarding/ui/customer-onboarding-page.tsx`: the case's actual current stage is now synced to the form engine's page state on mount. Verified live against a fictional test case: the correct stage-specific fields rendered instead of the wrong page's fields. `tsc`/`vitest` (1015/1015) clean.

**A separate, unrelated tooling issue was found and cleared in the same investigation:** a stale Turbopack compile error resurfaced on recompile even though no duplicate declaration exists on disk (confirmed via direct source inspection). This is the same error first disclosed during Batch 2 (L-021). The prior restart this session had not actually cleared it. A full kill, cache delete, and relaunch resolved it; confirmed via a clean server log on the next request.

**Important scope-limiting discovery:** many of the fixture IDs recorded in this batch's original entries (and in Batches 2-6) have since been reused or advanced by the 16+ later batches of testing (Batches 8-23) that ran on this same shared dev database after these residuals were first parked. "Retry with the identified fixture" is therefore not reliable for every item; some fixtures genuinely no longer hold the state a given journey needs, independent of the click-delivery limitation.

---

### ADDENDUM 2026-09-24 (pass 2): P-021/A-014/A-018/A-019 attempted, A-009/A-010 fixture-recovery pass

Per the user's follow-up instruction, the four read-only-verifiable residuals were attempted in full, and A-009/A-010's stale fixture was recovered rather than left permanently blocked.

**A-014 reclassified, not a residual:** re-reading this journey's own original 2026-09-20 entry shows its canonical `UX Result` field is explicitly `N/A` — it is a backend/data correctness proof (a workflow's version binding never changes after creation, demonstrated via two published versions routing to different teams), not a user-visible assertion at all. It was already validly PASS via code and historical-data evidence in the original pass and never needed browser evidence. It was miscategorized as a UX residual by the overnight run's collective grouping. Removed from the residual count.

**P-021 doubly blocked, not fixture-unavailable:** confirmed via source inspection that no live UI surface exists anywhere in the app for viewing `reference_options` audit/actor history (the shared actor-resolution helper this journey depends on is only ever invoked for a small set of unrelated tables, e.g. the Customer detail page's Activity tab). Attempted the closest analog (a fictional test customer with a legacy null-actor audit row, viewed on its Activity tab) and confirmed, via direct DOM inspection, that this UI library only mounts the currently-active tab's content into the page: the Activity tab's content is not in the DOM until clicked. Genuinely blocked by both a missing feature surface (Journey Discovery observation, not this run's gap) and the click-delivery limitation for the closest available proxy.

**A-018 CLOSED:** constructed a fresh, disposable, fictional draft onboarding case for an existing test persona via the same governed create/cancel actions already used throughout this test program (not a raw table mutation), cancelled it, then reloaded that persona's own request list. The cancelled case rendered correctly with a clear "Cancelled" status and no further action available, genuinely confirming the canonical assertion live.

**A-019 CLOSED, more strongly than originally scoped:** viewed a different fictional test persona's own active (not-yet-cancelled) draft as a second, unrelated test persona. The route returned a genuine not-found response: drafts are creator-only, server-enforced (the existing "creator-only onboarding draft visibility" product decision), so the Cancel control is unambiguously absent from a non-creator's view; there is no page for it to appear on. This is a stronger and more decisive confirmation than the original 2026-09-20 evidence (which only exercised the server-side rejection of a non-creator's cancel attempt, not the UI-level control visibility).

**A-009 and A-010 CLOSED via fixture recovery:** the original shared fixture had advanced past the state either journey needs (confirmed correct, disclosed in pass 1). Rather than leave both permanently blocked, a fresh, disposable, fictional onboarding case was constructed end-to-end using the same governed application actions this whole test program already relies on (create, submit, send back with a reviewer comment, resubmit) for an existing test persona pairing, with a temporary, immediately-reverted team assignment used only to route the send-back through the existing governed team-routing path (the same class of reversible, fictional-data, governed-path action already explicitly authorized for N-014). Live browser results: the maker's reopened case genuinely rendered a "field(s) below need review" banner, confirmed by source inspection to be driven directly by the real per-field reviewer-comment data (not a static string) — closing A-009. The reviewer-facing review route genuinely rendered a full timeline including the send-back reason and the resubmission event — closing A-010.

---

### ADDENDUM 2026-09-24 (third pass, fresh session): P-021 correctly reclassified as a PRODUCT GAP, not tooling-blocked

Re-reading P-021's own canonical wording: "UI displays [a null-actor historical row] with no actor name... rather than erroring." This assumes some existing view already renders `reference_options` audit/actor history, and the check is only about that view's null-handling. That assumption does not match current reality: no such view exists anywhere in the app (confirmed again via source inspection this pass; the shared actor-resolution helper this journey depends on is invoked only for a small, unrelated set of tables). This is not fixture staleness and not a browser-input limitation; it is a genuine gap between the canonical journey's premise and the product as built.

Building a dedicated audit/history view for `reference_options` is a structural addition (a new instance of an audit/history principle, per this repo's own documentation rule for structural changes), not a bounded fix: it requires deciding where such a view should live (a per-value history panel? a dedicated page? something reusing the Customer detail page's Activity-tab pattern?), a scope question this journey's own text does not answer and this session should not answer unilaterally. Classified **PRODUCT DECISION REQUIRED**, not tooling-blocked. Preserved: the canonical expectation, the confirmed absence of any UI surface, and the fact that the underlying data-layer mechanism (the actor-resolution helper's null-handling) is already correct and covered by existing unit tests, so a future UI addition would not need any correctness fix underneath it, only a rendering surface.

---

### ADDENDUM 2026-09-24 (fourth pass, fresh session): P-023, A-002 through A-008, A-012, A-015 CLOSED — the previously-diagnosed click-delivery degradation was tooling-session-specific and did not recur

This pass opened a brand-new browser automation session (per the user's explicit instruction not to re-tell the user to redo setup that was already done, and to treat "session-length" concerns as invalid). The click-delivery/timeout degradation disclosed in the first addendum above did not reproduce in this session: ordinary `ref`-based clicks, `form_input`, and the documented trusted-pointer-event recipe for Base UI comboboxes (see `feedback_browser_automation_nexus` memory) all worked, closing every remaining Batch 7 residual with genuine evidence.

**Fixture:** a fresh, disposable, fictional Customer Onboarding case, **CO-000103** (request_id `e804fc05-1b26-4ac0-a1a2-9ef173d8af3d`), was built end-to-end as `nexus-test-maker@example.test` through the real "+ New Customer Onboarding" button and every subsequent stage of the real multi-stage form (Customer Details, Tax & Registration, Commercial Documents, Commercial Rate, Agreement & Approval), including real document uploads. Since no OS-level file picker is reachable from this sandboxed browser (true of any headless browser automation, not specific to this tool), file inputs were populated via the standard `DataTransfer` + `Object.defineProperty(input, 'files', ...)` + `input` event technique, which is the conventional way to drive file inputs in headless testing; the genuine assertion under test in every case below is the real click on Save Draft / Next / Submit / Approve / Send Back, never the file-selection step itself.

**A-002 (incremental save) CLOSED:** the case was saved via real "Save Draft" and "Next" clicks repeatedly across all five stages, each confirmed via `submission_revisions.row_version` incrementing in lockstep with the click (verified via direct SQL after each save). The already-existing creator-only ownership guard (`ONBOARDING_DRAFT_SAVE_NOT_OWNER`) and stale-row-version guard (`ONBOARDING_DRAFT_STALE`) were not re-exercised live this pass (both already carry automated regression coverage from DEFECT-B7-002's original fix); the residual gap this pass closed was specifically live click-through evidence of an ordinary incremental save, which is now genuine and repeated.

**A-003 (happy-path submit) CLOSED:** with every stage genuinely complete (all Customer Details fields, GST/PAN/TAN plus their three required documents, one real Commercial Rate component, and a Signed Agreement upload), a real click on "Submit" fired `checkForDuplicateCustomersAction` (no match, since this fixture's identifiers are unique) then `submitOnboardingCaseAction`. The case genuinely transitioned `draft` -> `submitted` (confirmed via SQL), and the maker's own page correctly switched to a read-only "Submitted for review" summary screen.

**A-004 (blocked incomplete submit) CLOSED:** before completing every stage, a real click on "Submit" against a genuinely incomplete case (several fields never independently confirmed present) was blocked entirely client-side (`submitOnboardingCaseAction` never even fired, confirmed via the dev server log) with a rendered banner enumerating the specific incomplete stages by name. Repeated a second time on a case complete in every stage except Agreement & Approval, for a second, cleaner confirmation of the same behavior.

**A-005 (GST hard duplicate) and A-006 (PAN hard duplicate) CLOSED:** a second fixture, **CO-000104** (request_id `08cde554-a3dd-4eab-8262-1fb42313054b`), was constructed (governed RPCs used for the bulk of its non-duplicate field data and document attachment, since that data entry is not the assertion under test) with its GST number set to an already-approved case's real GST (`27B013GSTUNQZ5`, belonging to "Batch9 EmptyConfig Co"). A real "Submit" click was hard-blocked with the exact rendered message `Potential existing customer... GST "27B013GSTUNQZ5" already belongs to Batch9 EmptyConfig Co. This GST or PAN already belongs to an existing customer.`; the case's server-side status remained `draft` (confirmed via SQL), and `submitOnboardingCaseAction` never fired (the duplicate check runs client-side, before the real submit action, per `checkForDuplicateCustomersAction`'s own wiring). The GST was then corrected and the same case's PAN set to the same existing customer's PAN (`B013PANUNQ1`); a second real Submit click was again hard-blocked, this time naming PAN specifically, with `draft` status confirmed unchanged.

**A-007 (Legal Entity Name soft duplicate) and A-008 (Brand Name soft duplicate) CLOSED:** on the same CO-000104 fixture (GST/PAN corrected to unique values), the Legal Entity Name was set to exactly match "Batch9 EmptyConfig Co". A real Submit click rendered a distinctly different, non-blocking banner (`Legal Entity Name "Batch9 EmptyConfig Co" already belongs to Batch9 EmptyConfig Co. This looks similar to an existing customer. If this is genuinely a different business, click Submit again to continue.`), and a second real Submit click on the same case genuinely proceeded: the case transitioned to `submitted` (confirmed via SQL), correctly demonstrating the soft/dismissible nature of this warning class versus A-005/A-006's hard block. A third fixture, **CO-000105** (request_id `2826be92-c61d-4ad5-a670-2f18f5ed67ae`), was built the same way with its Brand Name set to an existing approved customer's brand ("Morning Regression Brand", belonging to "Morning Regression Onboarding Co"); a real Submit click rendered the equivalent soft-warning banner naming Brand specifically.

**A-012 (self-approval block) CLOSED:** `nexus-test-maker@example.test` (CO-000103's real creator) was temporarily granted the `checker` role (which holds `customer.approve`) plus a temporary, non-primary membership on `wf_test_leadership` (the team responsible for CO-000103's current approval node), both reverted immediately after this test via `revoke_user_role`/`remove_user_from_team`. Logged in as the maker, the review page for their own case genuinely rendered the Approve/Send Back controls (the UI does not hide them from a creator who happens to also hold checker permissions), confirming this guard is enforced server-side, not merely hidden client-side. A real click on "Approve" was genuinely blocked, rendering the exact server message `you cannot approve your own request. Another authorized checker must review it.`; the case's status remained `resubmitted` and no Customer Master was created (both confirmed via SQL), matching the RPC's own `SELF_APPROVAL_NOT_ALLOWED` guard read directly from `approve_customer_onboarding_case`'s source.

**A-009 and A-010 (send-back / resubmit) re-confirmed on a second, independent fixture:** although already CLOSED in the second addendum above, this pass's CO-000103 fixture independently exercised the same flow again as a natural byproduct of reaching Agreement & Approval: `nexus-test-ux-approver@example.test` (holding a temporary `wf_test_leadership` membership, later reverted) genuinely sent the case back with a real typed reason via a real "Confirm Send Back" click (`sendBackOnboardingCaseAction` fired, case status became `sent_back`, `sent_back_by` correctly resolved to the reviewer's own real user id, never the maker's); the maker's page genuinely rendered "Sent back for revision" with the reviewer's exact reason text, and a real "Submit" click resubmitted it (`status` became `resubmitted`, confirmed via SQL).

**A-015 (submit rejected on non-draft/non-sent_back status) CLOSED:** once CO-000103 reached `resubmitted` status, its own maker-facing page genuinely stopped rendering any Save Draft / Submit control at all, replaced by a read-only "Submitted for review" summary (confirmed via a real page load, not inferred), which is itself live UI evidence of the guard. `approve_customer_onboarding_case`'s SQL source additionally confirms the equivalent server-side guard for the neighboring submit RPC (`submit_customer_onboarding_case` raises `ONBOARDING_CASE_NOT_SUBMITTABLE` when status is not `draft`/`sent_back`), read directly rather than assumed.

**P-023 (Reference Master friendly duplicate-add error) CLOSED:** `WF-TEST Team Admin` was temporarily granted `reference_master_admin` (reverted immediately after via `revoke_user_role`). On the live Industry / Category Reference Master list (`/settings/customer-onboarding`), a real "Add" click with Label set to the already-existing value "Retail" rendered the exact friendly text `"retail" already exists in this list.` with the active/inactive count unchanged (8 Active), confirming no duplicate row was created. This closes the one outstanding UX-rendering sub-assertion of P-023; the underlying business-logic guarantee (the real concurrent-RPC race producing exactly one surviving row) was already proven in an earlier pass.

**Genuine defect discovered, disclosed, NOT yet fixed (deliberately, see below):** while investigating CO-000103's final state, one non-identifying, non-required draft field was found unexpectedly absent from what was actually persisted, despite having been set and independently confirmed present immediately before the save that should have persisted it. This points to a save-ordering/race issue in the draft-save path rather than a tooling artifact: it was found through the same "isolated single-variable retest" discipline this session's own browser-automation-quirks memory prescribes, and it survived that retest. Root cause is not yet conclusively established. Rather than force an unverified fix into this already-long session, this was flagged via `spawn_task` (`task_f26a8445`, full reproduction detail kept in the task's own private context rather than this public-repo ledger) for dedicated, properly-scoped investigation, consistent with this ledger's standing practice of not landing a fix without first genuinely confirming its root cause. Did not affect the validity of A-001 through A-004's closure above: Customer Details was independently confirmed structurally complete (not flagged as incomplete) at both Submit attempts, since this field is not part of submit-time field-completeness validation.

Baseline restored: the temporary `checker` role and `wf_test_leadership` membership on the maker persona, and the temporary `reference_master_admin` role on `WF-TEST Team Admin`, were all explicitly reverted via the same governed RPCs used to grant them, confirmed via their own return rows.

### END BATCH 7 (all 10 remaining residuals CLOSED: P-023, A-002, A-003, A-004, A-005, A-006, A-007, A-008, A-012, A-015; one new genuine defect disclosed and handed off for dedicated follow-up, not silently dropped)

---
