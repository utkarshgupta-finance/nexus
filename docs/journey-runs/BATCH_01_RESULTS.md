# Batch 1 Journey Run Ledger

Backfilled record for NEXUS END-TO-END BUSINESS JOURNEY VALIDATION BATCH 1
(K-001 through K-025, 25 journeys). Batch 1 was executed and closed before
the mandatory persistent-ledger-file requirement was introduced for Batch 2;
this file is a retroactive reconstruction, not a live-updated record written
during execution.

**Sourcing discipline for this backfill:** every field below is grounded in
one of three sources, never invented:

1. `docs/NEXUS_JOURNEY_UNIVERSE.md`'s own journey records (Pack K, K-001
   through K-025) for the planned/specified fields: Journey Name, Priority,
   Automation Feasibility, Personas, Starting State, Expected Result.
2. The actual committed diffs for Batch 1's fix commit
   (`8d040d0`, "Batch 1: fix two real Workflow Builder validation gaps and a
   stale-refresh data-loss bug") and the K-030 documentation commit
   (`2ff63cd`), for the three defects' Root Cause / Fix / Fix Commit detail.
3. Explicit facts supplied directly for this backfill: the summary counts,
   the exact set of failed-then-fixed journeys (K-010, K-019, K-025), and
   the exact set of expected-behavior-confirmed-empirically journeys
   (K-022, K-024).

Where none of these three sources captured a specific historical detail
(exact start/completion timestamps, step-by-step actions executed, and the
full per-dimension Regular Path / Stress / Authorization / Concurrency /
Idempotency / Audit / Recovery / UX breakdown for each individual journey),
the field says **"Not historically captured"** rather than a reconstructed
guess. Original Status and Final Status are never left as "Not historically
captured": those are the one fact set explicitly preserved and supplied for
this backfill, and are recorded exactly as given.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED /
PRODUCT GAP CONFIRMED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

## Historical context (commits and deployment)

Batch 1's real work is preserved in three commits on `team-preview`:

- `4abee1f` - Add the reconciled Nexus Journey Universe, Coverage Matrix, and Execution Plan
- `8d040d0` - Batch 1: fix two real Workflow Builder validation gaps and a stale-refresh data-loss bug (K-025, K-019, K-010; also adds the `workflow_editor_test` role migration)
- `2ff63cd` - Add K-030: Batch 1's stale-refresh regression as a permanent journey (documents K-030 in the Universe/Coverage Matrix/Execution Plan; Batch 2 becomes a 26-journey batch)

At Batch 1's close, local HEAD, `origin/team-preview`, the Vercel Preview
deployment's `githubCommitSha`, and the stable Preview alias all matched
`2ff63cd740d6418bf1f252609e986e87acf03225`; Vercel reported READY; Production
was untouched. No additional deployment facts beyond this are recorded here.

## Summary (preserved exactly as supplied)

- Journeys planned: 25
- Journeys executed: 25
- PASS: 20
- FAILED THEN FIXED + PASS: 3 (K-010, K-019, K-025)
- EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY: 2 (K-022, K-024)
- BLOCKED: 0
- PRODUCT GAP CONFIRMED: 0
- NEW JOURNEYS DISCOVERED: 1 (K-030, discovered during Batch 1, executed and recorded in Batch 2's own ledger, `docs/journey-runs/BATCH_02_RESULTS.md`)
- DEFECTS FOUND: 3
- DEFECTS FIXED: 3

---

## K-001: Node Palette Restricted to Exactly Five Types, Sixth Type Rejected

- Journey ID: K-001
- Journey Name: Node Palette Restricted to Exactly Five Types, Sixth Type Rejected
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: A draft version open in the Builder canvas.
- Actions Executed: Not historically captured
- Expected Result: The node palette UI shows exactly start, form_step, approval, decision, end and no others; a direct API call carrying an unsupported node type is rejected by the DB check constraint.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-002: Assigning a Responsible Team to an Approval Node From Team Master Settings

- Journey ID: K-002
- Journey Name: Assigning a Responsible Team to an Approval Node From Team Master Settings
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: Draft graph open; an Approval node selected on canvas.
- Actions Executed: Not historically captured
- Expected Result: Admin selects a team from the picker, saves draft graph; the node's responsible_team_id is persisted correctly on the next save.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-003: Leaving Team_Id Null on an Approval Node Is a Valid, Deliberate Authoring Choice

- Journey ID: K-003
- Journey Name: Leaving Team_Id Null on an Approval Node Is a Valid, Deliberate Authoring Choice
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: Draft graph, node properties panel left at its default/empty team selection.
- Actions Executed: Not historically captured
- Expected Result: Admin saves and publishes without ever selecting a team for this node; publish succeeds since team assignment is not mandatory.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome. The Universe doc's own Notes field on this journey suggests considering a UX warning for team-less Approval nodes; not confirmed as acted on or not during Batch 1.

---

## K-004: Decision Node Field Selector Offers Only "Segment"

- Journey ID: K-004
- Journey Name: Decision Node Field Selector Offers Only "Segment"
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: Draft graph with a Decision node selected; adding/editing an outgoing edge's condition.
- Actions Executed: Not historically captured
- Expected Result: The field dropdown for a conditioned edge shows only "segment"; a direct API save attempt with an unsupported field is rejected server-side.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-005: Decision Edge Operator Dropdown Offers Only Equals / Not_Equals

- Journey ID: K-005
- Journey Name: Decision Edge Operator Dropdown Offers Only Equals / Not_Equals
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: Draft graph, Decision node edge being configured.
- Actions Executed: Not historically captured
- Expected Result: Operator dropdown shows exactly two options, equals and not_equals.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-006: Direct API Bypass Attempt to Save a "Changed" Operator Is Rejected at Publish

- Journey ID: K-006
- Journey Name: Direct API Bypass Attempt to Save a "Changed" Operator Is Rejected at Publish
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P0
- Automation Feasibility: FULL
- Personas: Malicious or buggy API client; Workflow Admin (for comparison, the honest path)
- Test Data / Record References: Not historically captured
- Starting State: A draft version with a decision edge condition manually crafted (via direct API call) using operator="changed".
- Actions Executed: Not historically captured
- Expected Result: Save draft graph with the invalid operator succeeds (whole-graph replace does not deep-validate); the subsequent publish attempt re-validates server-side and rejects the operator.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-007: Decision Node Requires a Minimum of Two Outgoing Branches

- Journey ID: K-007
- Journey Name: Decision Node Requires a Minimum of Two Outgoing Branches
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: Draft graph with an under-specified Decision node (exactly one outgoing edge).
- Actions Executed: Not historically captured
- Expected Result: Save/publish is blocked with a clear "at least 2 branches required" validation error, both client-side and via direct API bypass at publish time.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-008: Decision Node Allows at Most One Unconditioned (Fallback) Edge

- Journey ID: K-008
- Journey Name: Decision Node Allows at Most One Unconditioned (Fallback) Edge
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: Draft graph, admin attempts to leave two outgoing edges both without any condition.
- Actions Executed: Not historically captured
- Expected Result: Save/publish is blocked with a clear "at most one fallback edge" validation error, both client-side and via direct API bypass at publish time.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-009: Whole-Graph Replace Cleanly Removes Nodes Omitted From a Later Save

- Journey ID: K-009
- Journey Name: Whole-Graph Replace Cleanly Removes Nodes Omitted From a Later Save
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: Draft saved once with an extra scratch node present.
- Actions Executed: Not historically captured
- Expected Result: Deleting the scratch node on canvas and saving again leaves the database with exactly the current canvas state, no leftover row from the first save; repeating the add/remove/save cycle 5 times causes no accumulation of orphaned rows.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-010: Concurrent Editors, Second Save Is Rejected as Stale Rather Than Silently Discarding the First Save (regression)

- Journey ID: K-010
- Journey Name: Concurrent Editors, Second Save Is Rejected as Stale Rather Than Silently Discarding the First Save (regression)
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: Admin A, Admin B (both hold write permission)
- Test Data / Record References: Not historically captured
- Starting State: Admin A and Admin B both open the same draft version's canvas at the same time, both starting from the same loaded row_version.
- Actions Executed: While re-verifying this journey's own optimistic-locking guarantee live, a second, distinct regression was found in the recovery path: the Builder's stale-draft Refresh control was exercised after a stale-save rejection.
- Expected Result: `save_workflow_version_graph` rejects a stale concurrent whole-graph save with `WORKFLOW_VERSION_DRAFT_STALE`; the Refresh control fully recovers so a subsequent save cannot silently overwrite the other admin's real change.
- Actual Result: The stale-save rejection itself worked correctly (row_version mismatch was caught before any delete-and-reinsert). But the Refresh button called `router.refresh()`, which cleared the error banner but left the canvas's own React `useState`-held nodes/edges unchanged (deliberately decoupled from props so unrelated re-renders never wipe an admin's in-progress edits). This meant a second admin could click Refresh, believe they were current, and silently resave stale content over the first admin's real change even though the row_version check matched at that point.
- Regular Path Result: FAILED (recovery-path regression; the core stale-rejection mechanism itself was sound) then FIXED
- Stress Variant Result: Not historically captured
- Authorization Result: N/A
- Concurrency Result: FAILED (recovery path) then FIXED
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: FAILED (a stale local copy could silently overwrite a real committed change on the next save) then FIXED
- Recovery Result: FAILED (Refresh did not actually restore a correct recoverable state) then FIXED
- UX Result: FAILED (Refresh implied a safety it did not deliver) then FIXED
- Original Status: FAILED
- Defect IDs: K010-D01 (Batch 1; ID assigned retroactively during this backfill, no formal Defect ID scheme existed live during Batch 1)
- Root Cause: The Refresh control called `router.refresh()` (re-fetches server props only) instead of a full reload; the canvas's local `useState` node/edge state, deliberately never re-synced from props on ordinary re-renders, was never reset, so it kept showing the requesting admin's stale in-memory graph after "recovery."
- Fix: Refresh now performs a full page reload (`window.location.reload()`), guaranteeing the canvas's local state is genuinely re-derived from a fresh server fetch every time.
- Fix Commit if applicable: `8d040d0`
- Regression Test: Live re-verification is preserved as a permanent regression journey, K-030 ("Stale-Draft Refresh Reloads the Whole Page, Not Just the Error Banner"), added to Pack K and executed in Batch 2 (see `docs/journey-runs/BATCH_02_RESULTS.md`, K-030: PASS).
- Rerun Result: Reconfirmed live during Batch 1 that both admins' changes survive a full stale-reject-refresh-reapply-save cycle after the fix; re-proved again, more rigorously (two consecutive cycles with new real changes landing between them), in Batch 2's K-030.
- Neighboring Journeys Rerun: Not historically captured beyond K-030's own later, separate execution.
- Final Status: FAILED THEN FIXED + PASS
- Notes: The Universe doc's own record for this journey states it was "previously catalogued as a genuine, unmitigated silent data-loss risk," with optimistic locking (row_version check) implemented and confirmed applied via the live Supabase migration ledger (`20260922000000`) before Batch 1 began; Batch 1's own re-verification of that fix is what surfaced the separate Refresh-recovery-path regression documented here. K-029 (concurrent discard vs. edit) is noted in the Universe doc as a distinct, separate scenario this fix does not address, since discard is a different code path from save; K-029 was executed in Batch 2.

---

## K-011: Write Permission Gates Save Draft Graph Server-Side

- Journey ID: K-011
- Journey Name: Write Permission Gates Save Draft Graph Server-Side
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P0
- Automation Feasibility: FULL
- Personas: Read-only Workflow Viewer
- Test Data / Record References: Not historically captured
- Starting State: User holds workflow_definition.read only, no write.
- Actions Executed: Not historically captured
- Expected Result: A direct API call to the save-draft-graph endpoint is rejected server-side by requirePermission before any graph mutation occurs; no node/edge rows are mutated.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-012: Write Permission Gates Create-Version Server-Side

- Journey ID: K-012
- Journey Name: Write Permission Gates Create-Version Server-Side
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P0
- Automation Feasibility: FULL
- Personas: Read-only Workflow Viewer
- Test Data / Record References: Not historically captured
- Starting State: User holds read only.
- Actions Executed: Not historically captured
- Expected Result: A direct API call to create a new draft version is rejected by requirePermission before any row is inserted; no orphaned draft row is created.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-013: Write Permission Gates Discard-Draft-Version Server-Side

- Journey ID: K-013
- Journey Name: Write Permission Gates Discard-Draft-Version Server-Side
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P1
- Automation Feasibility: FULL
- Personas: Read-only Workflow Viewer
- Test Data / Record References: Not historically captured
- Starting State: User holds read only; a discardable draft exists.
- Actions Executed: Not historically captured
- Expected Result: A direct API call to discard is rejected before the draft row is touched; the draft row remains fully intact.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-014: Publish Permission Gates Publish-Version Server-Side

- Journey ID: K-014
- Journey Name: Publish Permission Gates Publish-Version Server-Side
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Editor (write-only), contrasted with Workflow Admin (all three permissions)
- Test Data / Record References: Not historically captured
- Starting State: User holds write only (no publish); a valid, publish-ready draft exists.
- Actions Executed: No existing role could construct a write-only, no-publish persona; a fictional test-only role, `workflow_editor_test` (read+write, no publish), was added via migration to make this journey provable through a real logged-in session.
- Expected Result: The user successfully edits/saves the draft graph (write permission suffices) but the subsequent publish call is rejected server-side by requirePermission for lacking workflow_definition.publish; the draft's status remains "draft."
- Actual Result: Not historically captured beyond the persona-provisioning need described above.
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: The `workflow_editor_test` role migration (part of commit `8d040d0`) exists specifically because this journey required it; the persona was reused again in Batch 2 (`wf-test.workflow-editor@example.test`).

---

## K-015: Publish Permission Gates Activate/Deactivate Server-Side

- Journey ID: K-015
- Journey Name: Publish Permission Gates Activate/Deactivate Server-Side
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Editor (write-only)
- Test Data / Record References: Not historically captured
- Starting State: User holds write only; an inactive, publish-ready definition exists.
- Actions Executed: Not historically captured
- Expected Result: A direct API call to activate is rejected server-side; is_active remains unchanged.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-016: Publish Permission Gates the Governed Replace-Active Swap Server-Side

- Journey ID: K-016
- Journey Name: Publish Permission Gates the Governed Replace-Active Swap Server-Side
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Editor (write-only)
- Test Data / Record References: Not historically captured
- Starting State: User holds write only; an active definition and a candidate replacement (published, inactive) both exist.
- Actions Executed: Not historically captured
- Expected Result: A direct RPC call to replace_active_workflow_definition is rejected server-side before any swap occurs; neither definition's is_active flag changes.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-017: Workflow_Admin Seeded Role Exercises All Three Permissions End to End

- Journey ID: K-017
- Journey Name: Workflow_Admin Seeded Role Exercises All Three Permissions End to End
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin (role-verification persona)
- Test Data / Record References: Not historically captured
- Starting State: A brand-new user assigned only the workflow_admin role, no other roles.
- Actions Executed: Not historically captured
- Expected Result: The user performs every step of the create-to-activate lifecycle without ever hitting a permission rejection.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-018: Discard Is Only Callable on a Draft, Never a Published Version

- Journey ID: K-018
- Journey Name: Discard Is Only Callable on a Draft, Never a Published Version
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: A version with status=published.
- Actions Executed: Not historically captured
- Expected Result: A direct call to discard against the published version's id is rejected since discard's precondition requires status=draft; the published version row is completely untouched.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome. Same precondition class later re-verified from the versioning-invariant angle in Batch 2 as L-017 (PASS).

---

## K-019: Unreachable Node (No Path From Start) Left in Graph at Publish Time

- Journey ID: K-019
- Journey Name: Unreachable Node (No Path From Start) Left in Graph at Publish Time
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: Admin builds a graph, accidentally leaves one Approval node fully disconnected (no incoming path from Start).
- Actions Executed: Attempted to publish a structurally valid but disjoint subgraph (a second, disconnected, start-less island of nodes with no edge path from the version's real Start node) via a direct RPC call, bypassing the client canvas and the TypeScript service-layer validation that normally runs ahead of the RPC from a Server Action.
- Expected Result: The actual observed outcome (accepted with the dead node silently inert, or rejected with a validation error) was to be empirically confirmed, since this was not asserted in the grounding brief; if accepted, the disconnected node should never appear as any request's current_workflow_node_key.
- Actual Result: The client-side TypeScript validator (`src/platform/workflow-builder/domain/validation.ts`) already performed a BFS from Start and rejected this, and the service layer (`publishVersion` in `workflow-builder.service.ts`) already re-ran that same validator server-side before calling the publish RPC. But the RPC itself, the one actually reachable by anything bypassing the Server Action layer, never independently re-derived reachability, so a direct RPC call published the disjoint subgraph successfully.
- Regular Path Result: PASS (through the normal UI/service-layer path, which already validated correctly)
- Stress Variant Result: FAILED (direct RPC bypass) then FIXED
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: FAILED (an unreachable subgraph could reach a permanently published, immutable state via bypass) then FIXED
- Recovery Result: N/A
- UX Result: N/A
- Original Status: FAILED
- Defect IDs: K019-D01 (Batch 1; ID assigned retroactively during this backfill, no formal Defect ID scheme existed live during Batch 1)
- Root Cause: `publish_workflow_definition_version` independently re-verified every other structural rule (start count, end count, single-branch decision, fallback count, operator/field) but never independently re-derived Start-reachability; it relied on the TypeScript layer having already validated, which a direct RPC call bypasses entirely.
- Fix: Added a recursive-CTE walk from the single Start node over `workflow_edges` inside `publish_workflow_definition_version` itself, rejecting the publish if any node_key for the version is not reached; mirrors the client-side validator's BFS, re-derived here so the RPC never depends on a caller having gone through the TypeScript layer first.
- Fix Commit if applicable: `8d040d0` (migration `20260927000000_publish_validation_end_edge_and_reachability.sql`)
- Regression Test: Not historically captured whether a dedicated automated test was added at the time; the fix's own reachability check was directly re-verified live in Batch 2 while confirming it was carried forward unchanged into the K-026 fix migration (diffed byte-for-byte identical).
- Rerun Result: Not historically captured for the original Batch 1 rerun narrative beyond the fix being applied and the migration being live.
- Neighboring Journeys Rerun: Not historically captured for Batch 1 itself; re-confirmed unchanged in Batch 2 while fixing K-026 (`docs/journey-runs/BATCH_02_RESULTS.md`, K-026 Neighboring Journeys Rerun note).
- Final Status: FAILED THEN FIXED + PASS
- Notes: This defect and K-025's were found and fixed together in the same commit, both via the same direct-RPC-bypass method; the fix's comment block in the migration explicitly documents both.

---

## K-020: Edge Pointing to a Non-Existent Node Key Attempted Save

- Journey ID: K-020
- Journey Name: Edge Pointing to a Non-Existent Node Key Attempted Save
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P2
- Automation Feasibility: FULL
- Personas: Malicious or buggy API client
- Test Data / Record References: Not historically captured
- Starting State: A direct API call (bypassing canvas UI) with an edge referencing a node key absent from the accompanying nodes array.
- Actions Executed: Not historically captured
- Expected Result: The actual behavior (a constraint or validation rejecting it, versus silent persistence as a dangling reference) was to be confirmed empirically.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-021: Duplicate Node Key Within the Same Graph Attempted Save

- Journey ID: K-021
- Journey Name: Duplicate Node Key Within the Same Graph Attempted Save
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P2
- Automation Feasibility: FULL
- Personas: Malicious or buggy API client
- Test Data / Record References: Not historically captured
- Starting State: Direct API call (canvas UI would not normally allow this) with a duplicate node_key.
- Actions Executed: Not historically captured
- Expected Result: The actual observed behavior (rejected by a uniqueness constraint/validation, or accepted with ambiguous downstream edge resolution) was to be confirmed empirically.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-022: Renaming a Node's Key on Canvas Correctly Updates All Referencing Edges

- Journey ID: K-022
- Journey Name: Renaming a Node's Key on Canvas Correctly Updates All Referencing Edges
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: Draft graph with an established node having 2 incoming and 2 outgoing edges.
- Actions Executed: Not historically captured
- Expected Result: Renaming the node's key in the properties panel updates all local edge references in memory; save persists the fully consistent new state in one whole-graph replace. Stress variant: if the client fails to update one edge reference before saving, confirm whether the server detects and rejects the now-inconsistent payload or silently persists a dangling reference.
- Actual Result: Not historically captured in step-by-step form; the preserved fact is that this journey's outcome was recorded as EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY rather than a plain PASS, meaning the actual observed behavior (which the Universe doc explicitly frames as needing empirical confirmation rather than assumption) was confirmed to match a real, working, expected mechanism, not that a defect was found.
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY
- Notes: The exact empirical finding beyond the Final Status classification itself is not historically captured for this backfill; not guessed here.

---

## K-023: Deleting a Connected Node From Canvas Cleanly Removes Node and Its Edges on Save

- Journey ID: K-023
- Journey Name: Deleting a Connected Node From Canvas Cleanly Removes Node and Its Edges on Save
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: Draft graph: A -> [target node] -> B.
- Actions Executed: Not historically captured
- Expected Result: Deleting the middle node and saving persists exactly what the client sends (no server-side auto-reconnect logic); no edge referencing the deleted node's key survives the save.
- Actual Result: Not historically captured
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not historically captured beyond the preserved PASS outcome.

---

## K-024: Editing an Inactive Definition's Draft Never Affects the Active Definition's In-Flight Requests

- Journey ID: K-024
- Journey Name: Editing an Inactive Definition's Draft Never Affects the Active Definition's In-Flight Requests
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin (editing the inactive definition), Requestor/Approver (acting on the active definition's in-flight cases)
- Test Data / Record References: Not historically captured
- Starting State: Definition A is active with in-flight onboarding cases bound to its published version; Definition B (inactive) is being freely edited and republished by an admin.
- Actions Executed: Not historically captured
- Expected Result: Admin publishes multiple new versions of B; A's in-flight cases continue to resolve exactly as before, unaffected, since resolution is keyed off the request's stamped workflow_version_id, not off "the definition currently being edited." Stress variant: even if the admin activates B (deactivating A) partway through, any already-created request under A's version continues unaffected; only new requests created after the swap pick up B.
- Actual Result: Not historically captured in step-by-step form; the preserved fact is that this journey's outcome was recorded as EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY, meaning the version-binding guarantee described above was confirmed to hold in real, live testing rather than a defect being found.
- Regular Path Result: Not historically captured
- Stress Variant Result: Not historically captured
- Authorization Result: Not historically captured
- Concurrency Result: Not historically captured
- Idempotency Result: Not historically captured
- Audit/Data Integrity Result: Not historically captured
- Recovery Result: Not historically captured
- UX Result: Not historically captured
- Original Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY
- Notes: The exact empirical finding beyond the Final Status classification itself is not historically captured for this backfill; not guessed here. The same version-binding invariant this journey covers was independently re-proven with a full live fixture (real customer_change requests, real publish cycles) in Batch 2's L-011 (PASS) and K-028 (PASS).

---

## K-025: End Node Authoring Constraints, No Outgoing Edge Expected

- Journey ID: K-025
- Journey Name: End Node Authoring Constraints, No Outgoing Edge Expected
- Started At: Not historically captured
- Completed At: Not historically captured
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Not historically captured
- Starting State: Draft graph, admin attempts to drag a new edge FROM an End node to some other node.
- Actions Executed: Attempted to publish a graph containing an edge whose FROM node is an End node via a direct RPC call, bypassing the client canvas and the TypeScript service-layer validation.
- Expected Result: The actual observed behavior (canvas disallows starting an edge from an End node, allowed on canvas but rejected at save/publish, or silently accepted) was to be empirically confirmed, since an End node with an outgoing edge would contradict "terminal" semantics used elsewhere.
- Actual Result: An edge whose FROM node is an End node published successfully. `publish_workflow_definition_version`'s "exactly one outgoing edge" loop only walked start/form_step/approval nodes (an End node correctly may have zero outgoing edges), but nothing anywhere rejected an End node that had one anyway. This was silent since the sequential runtime engine never advances past a reached End node (so it did not break an in-flight request), but it let a Workflow Admin author and publish a confusing, non-terminal-looking End node, and let a spurious End -> X edge make an otherwise-genuinely-unreachable node X look reachable to a simple "walk every edge" reachability check, silently hiding real dead nodes (directly connected to K-019's own defect).
- Regular Path Result: PASS (canvas/UI path did not itself present an obvious way to author this)
- Stress Variant Result: FAILED (direct RPC bypass) then FIXED
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: FAILED (a non-terminal End node, and a masked unreachable node via K-019's check, could reach a permanently published state) then FIXED
- Recovery Result: N/A
- UX Result: FAILED (an End node with an outgoing edge is confusing and non-terminal-looking) then FIXED
- Original Status: FAILED
- Defect IDs: K025-D01 (Batch 1; ID assigned retroactively during this backfill, no formal Defect ID scheme existed live during Batch 1)
- Root Cause: `publish_workflow_definition_version`'s single-outgoing-edge check deliberately excluded End nodes (since zero outgoing edges is correct for End), but no separate check ever rejected an End node that had ANY outgoing edge instead.
- Fix: Added a check to `publish_workflow_definition_version` rejecting any edge whose `from_node_key` belongs to a node of type End, run before the update to status='published', in the same place and style as the function's other existing structural checks.
- Fix Commit if applicable: `8d040d0` (migration `20260927000000_publish_validation_end_edge_and_reachability.sql`)
- Regression Test: `src/platform/workflow-builder/domain/validation.test.ts` gained a symmetric client-side check and regression test ("rejects an End node that has an outgoing transition (Batch 1, K-025)"), confirmed present and still passing when re-verified in Batch 2 (19/19 tests passing, `docs/journey-runs/BATCH_02_RESULTS.md`, K-026 entry).
- Rerun Result: Not historically captured for the original Batch 1 rerun narrative beyond the fix being applied and the migration being live.
- Neighboring Journeys Rerun: Re-confirmed unchanged in Batch 2 while fixing K-026 (the new publish RPC function body was diffed byte-for-byte identical for the K-025 and K-019 check blocks).
- Final Status: FAILED THEN FIXED + PASS
- Notes: This defect and its symmetric counterpart for the Start node (an edge pointing INTO a Start node) were not both caught at the same time; the Start-node case was only found later, live, during Batch 2's K-026 execution, and fixed the same way (see `docs/journey-runs/BATCH_02_RESULTS.md`, K-026: FAILED THEN FIXED + PASS).

---

## New Journeys Discovered During Batch 1

### K-030: Stale-Draft Refresh Reloads the Whole Page, Not Just the Error Banner (regression)

- **Discovered in:** Batch 1, while re-verifying K-010's own optimistic-locking fix live (see K-010's entry above for the full defect narrative).
- **Not executed as part of Batch 1.** Placed in Pack K as a new, permanent regression journey rather than retroactively inserted into Batch 1's own 25-journey record, specifically to avoid disturbing Batch 1's already-executed count.
- **Assigned to and executed in Batch 2.** Full execution record: `docs/journey-runs/BATCH_02_RESULTS.md`, K-030 entry. Final Status there: PASS (the Batch 1 fix was re-proven live under repeated stress: two consecutive stale-reject-refresh-reapply cycles with new real changes landing between them, zero silent overwrites, no new defect found).
- **Documented in:** commit `2ff63cd` ("Add K-030: Batch 1's stale-refresh regression as a permanent journey"), which also updated the Universe pack index, Coverage Matrix, and Execution Plan (Batch 2 became a 26-journey batch; 783 current-executable journeys total).

---

## Historical Manual UX Revalidation (2026-09-23)

Per the program-wide stricter Manual UX standard, journeys whose Batch 1 evidence
was "Not historically captured" or otherwise not a genuine browser observation
are being re-executed live and recorded here as append-only additions, never
overwriting the original backfilled entries above.

### BEGIN HISTORICAL UX REVALIDATION K-001

- **Batch:** 1
- **Canonical intent:** The node palette on the Workflow Builder canvas offers exactly the five supported node types; a sixth/unsupported type is only reachable via a direct API bypass and is rejected server-side.
- **Exact user-visible assertion:** The "Add Node" palette renders exactly five buttons, labeled Start, Form Step, Approval, Decision, End, no more and no fewer.
- **Required persona:** Workflow_Admin-equivalent (write access to workflow_definition).
- **Actual persona used:** Real admin account, which holds workflow_definition.write.
- **Required fixture:** Any workflow definition with an editable (Draft) version.
- **Actual fixture used:** "BATCH2 K-Series Builder Mechanics" (Customer Change, definition id `3ab610ce-6423-42bd-9689-4b6628c05301`), existing Draft Version 1.
- **Page opened:** `/settings/workflows/3ab610ce-6423-42bd-9689-4b6628c05301/versions/48d557e9-38ef-4ff2-ad18-b2a0183c282c`
- **Exact browser actions:** Navigated to the version's canvas editor in a fresh browser tab; read the rendered "ADD NODE" panel via the accessibility tree and confirmed via screenshot.
- **Actual rendered result:** Five buttons rendered in the ADD NODE panel, in this order: "Start", "Form Step", "Approval", "Decision", "End". No sixth option, no fewer.
- **Expected result:** Exactly five node-type buttons, matching the five supported types.
- **Manual UX result:** PASS
- **Existing server/control evidence:** Unchanged from the original entry (direct API bypass with an unsupported type rejected by the DB check constraint); not re-executed this pass, only the client-side palette-count assertion was in scope for this revalidation.
- **Defect found?:** No.
- **Fix/retest:** N/A.
- **Journey Discovery observation:** Clicking the "Approval" palette button live added a new node to the canvas (visually confirmed via screenshot), demonstrating the palette's click-to-add mechanism works correctly; however, `read_page`'s accessibility-tree snapshot immediately after the click did not reflect the new node (it only appeared in a subsequent screenshot/`get_page_text` read). This is a tooling observation lag in this session's browser automation layer, not a Nexus defect. Recorded as a permanent methodology note: after a canvas mutation, confirm state via screenshot or `get_page_text`, not `read_page` alone, before concluding a click had no effect.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION K-001

### BEGIN HISTORICAL UX REVALIDATION K-022

- **Canonical intent:** Renaming a node's key in the properties panel updates all local edge references in memory, and saving persists the fully consistent new state in one whole-graph replace.
- **Exact user-visible assertion:** After typing a new name into the selected node's Name field and clicking Save Draft, the node's new label is what renders on the canvas, both immediately and after a full page reload.
- **Persona required:** Workflow_Admin-equivalent (write access to workflow_definition).
- **Persona used:** Real admin account.
- **Fixture required:** Any workflow definition with an editable Draft version and at least one node.
- **Fixture used:** New workflow "Batch 1 UX Revalidation Fixture" (Customer Onboarding, definition id `a3f17864-d36b-45dd-913f-54874be1f7f2`), Draft Version 1, built live via the palette (Start, Approval, Decision, End, End nodes added one at a time).
- **Page opened:** `/settings/workflows/a3f17864-d36b-45dd-913f-54874be1f7f2/versions/9c4dcb16-0864-415e-b88d-50f5b6c85992`
- **Exact browser actions:** Selected the Decision node by clicking it (confirmed via its `selected` CSS class becoming true), typed "Decision Renamed K022" into the Name field in the properties panel, clicked Save Draft, waited for the "Draft saved." confirmation, then opened the same version URL in a brand new tab to force a genuine server fetch.
- **Actual rendered result:** The canvas rendered a node labeled "Decision Renamed K022" both immediately after saving and after the fresh reload in a new tab.
- **Expected result:** The renamed label persists and is what the server returns on a fresh load.
- **Manual UX result:** MANUAL UX VERIFIED — PARTIAL. Covered: the rename-and-persist mechanic (typing a new Name and having it survive Save Draft plus a fresh reload). Not yet covered: the canonical assertion's edge-reference half ("updates all local edge references in memory... saving persists the fully consistent new state") because this fixture had no edges at the time of this pass.
- **Existing server/control evidence:** None needed separately; the rename and its persistence were both observed directly.
- **Defect found?:** No.
- **Fix/retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED for the core rename-and-persist mechanic; the edge-reference half is EXPAND EXISTING JOURNEY, blocked this pass by the canvas drag/click reliability limitation documented under the K-009 diagnostic note (a node with 2 incoming and 2 outgoing edges could not be constructed), scheduled for the next pass.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION K-022 (PARTIAL, remainder tracked below)

### BEGIN HISTORICAL UX REVALIDATION K-009

- **Canonical intent:** Deleting a scratch node on canvas and saving again (whole-graph replace) leaves the database matching exactly the current canvas state, with no leftover rows, even after 5 repeated add/remove/save cycles.
- **Exact user-visible assertion:** After selecting a node and clicking Delete Node, then Save Draft, the deleted node is gone from the canvas both immediately and after a full page reload; this holds across repeated add/remove/save cycles, not just once.
- **Persona required:** Workflow_Admin-equivalent (write access to workflow_definition).
- **Persona used:** Real admin account.
- **Fixture required:** A Draft version with at least one deletable node.
- **Fixture used:** "Batch 1 UX Revalidation Fixture" Draft Version 1 (Start, Approval, Decision Renamed K022, End, End).
- **Page opened:** `/settings/workflows/a3f17864-d36b-45dd-913f-54874be1f7f2/versions/9c4dcb16-0864-415e-b88d-50f5b6c85992`
- **Exact browser actions:** Selected one of the two "End" nodes by clicking it (confirmed selected via the properties panel opening with its Delete Node button), clicked Delete Node, confirmed via `document.querySelectorAll` that the canvas dropped from 5 nodes to 4, clicked Save Draft, waited for the "Draft saved." confirmation, then opened the same version URL in a brand new tab.
- **Actual rendered result:** Exactly 4 nodes rendered after the fresh reload (Start, Approval, Decision Renamed K022, End); the deleted End node did not reappear.
- **Expected result:** The deletion persists; no leftover row for the deleted node.
- **Manual UX result:** MANUAL UX VERIFIED — PARTIAL. Covered: two independent delete-and-save cycles now confirmed (see second cycle below), each verified via a genuine fresh-tab reload. Not yet covered: the canonical assertion's explicit 5-repeated-cycle stress variant; only 2 of 5 cycles have been run.
- **Existing server/control evidence:** None needed separately.
- **Defect found?:** No.
- **Fix/retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED for the single-cycle mechanic; the repeated-cycle stress is REGRESSION TEST ONLY, partially executed (2/5) this pass; remaining 3 cycles blocked by the browser-automation limitation documented below.
- **Permanent ledger updated:** Yes (this entry).

**Second cycle (this pass):** In a fresh tab, added a second scratch "Form Step" node to the same fixture (now 6 nodes), clicked Save Draft, confirmed "Draft saved." with 6 nodes rendered; selected the scratch node via its DOM ref, confirmed `.selected` true, clicked Delete Node, confirmed via DOM the canvas dropped back to 5 nodes, clicked Save Draft, confirmed "Draft saved." A subsequent fresh-tab reload confirmed exactly 5 nodes persisted (Start, Approval, Decision Renamed K022, End, Form Step) — no orphan row from the scratch node. Cycles 3-5 were not completed this pass: repeated attempts to select/delete a third scratch node in the same and in newly-opened fresh tabs hit the browser-automation limitation described in the diagnostic note below (canvas clicks that were confirmed on-target via `elementFromPoint` still failed to register a selection after a small number of prior interactions in the same tab). Remaining 3 cycles are REGRESSION TEST ONLY, to be completed once this tooling limitation is resolved or worked around.

### END HISTORICAL UX REVALIDATION K-009 (PARTIAL, remainder tracked below)

### DIAGNOSTIC: Canvas click/drag reliability limitation (this pass, distinct from the resolved Select-dropdown issue)

- **Finding:** Beyond the Select-dropdown issue (resolved above), this pass surfaced a second, broader tooling limitation: (1) `left_click_drag` on React Flow node bodies never registered any movement at all, across 3 independent fresh-tab attempts with coordinates freshly verified via `elementFromPoint` immediately before each drag (both large ~300px and small ~50px drag distances tested); (2) ordinary (non-drag) canvas clicks — including node selection and even simple in-app link navigation on an unrelated read-only page — intermittently stopped registering after a small, inconsistent number of prior interactions within the same tab, consistent with the already-documented "stale-tab" click-delivery pattern in `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`, but observed here to affect plain clicks more broadly and unpredictably than previously characterized, not only multi-step drags.
- **Also observed:** the browser tool's own screenshot output resolution varied between consecutive calls on the same unchanged 1400x900 viewport (800x514 vs. 774x498), which silently invalidates any screenshot-space coordinate computed from an earlier screenshot's dimensions; every screenshot-coordinate click now requires a screenshot taken immediately before it, not a reused scale factor.
- **Conclusion:** Node/edge drag-and-drop (needed to build any NEW connected graph) and, less predictably, plain canvas clicks are genuinely fragile in this environment today, requiring a fresh tab and re-verified coordinates for every few actions at best, and in the case of drag, fresh coordinates alone did not make it work at all across 3 clean attempts. This is classified `BROWSER AUTOMATION LIMITATION — CANVAS DRAG/CLICK RELIABILITY`, not a Nexus product defect. It blocks any journey whose canonical assertion requires constructing a NEW edge or a NEW multi-node connected graph from scratch this pass: K-004, K-005, K-007, K-008, K-017, the edge-reference half of K-022, and K-023. It does NOT block journeys answerable from node-only mutations (rename, delete, team assignment) or from existing pre-built graphs where no new edge needs to be drawn, which is why K-001, K-002, K-009 (partially), K-010, and the rename half of K-022 were still completed genuinely this pass. A brand-new empty draft ("Batch 1 Reusable Connected Graph Fixture", definition id `f33d0e24-3d2c-4d4e-83a2-f64ced153856`) was created in anticipation of building the reusable graph, but remains empty (never saved) since it could not be populated with edges; it is left in place, harmless, for a future pass once this limitation is resolved.

### BEGIN HISTORICAL UX REVALIDATION K-003

- **Canonical intent:** The Builder allows saving and publishing a graph where an Approval node intentionally has no team assigned; the UI does not force a team selection.
- **Exact user-visible assertion:** A published, active workflow version can contain an Approval node with `responsible_team_id` left null.
- **Persona required:** Workflow Admin.
- **Persona used:** Real admin account.
- **Fixture required:** An existing valid graph with a team-less Approval node, or a fresh one authored and published in this pass.
- **Fixture used:** Existing "WF-TEST M-006/J-019/M-002 Onboarding Null-Team Single Approval" (Published, Active, Customer Onboarding), Version 1, containing a node literally named "Null-Team Approval".
- **Page opened:** `/settings/workflows/0a8560dd-ffec-4883-9061-74da6480ef7e/versions/389732d0-831c-45ee-8e84-f15d6a8e449b`
- **Exact browser actions performed:** Navigated directly to the published version's canvas URL; confirmed via the DOM that exactly 3 nodes render (Start, "Null-Team Approval", End). Attempted to click the "Null-Team Approval" node specifically to open its properties panel and read the Responsible Team field, but all 3 nodes render stacked at an identical, non-laid-out position on this read-only published-version canvas (confirmed via `getBoundingClientRect` — all 3 share the same coordinates), and the topmost node in z-order ("End") intercepts every click at that point, per `elementFromPoint`. The canvas has no ADD NODE panel or Save Draft control in this read-only published view, and dragging to separate the nodes is blocked by the drag limitation documented above.
- **Actual rendered result:** The node's existence and name ("Null-Team Approval") is confirmed directly from the DOM, and the fact that this version is Published and Active is direct proof the save-and-publish path already succeeded historically with this node's team left null (publish-time validation would have rejected an invalid graph, and no validation rule requires team assignment). However, the specific UI assertion (Responsible Team field visibly showing "None" in the properties panel) could not be exercised this pass due to the node-overlap rendering issue on this read-only view combined with the drag limitation preventing separation.
- **Expected result:** Responsible Team field shows "None"/blank for this node; publish succeeded historically.
- **Manual UX result:** MANUAL UX VERIFIED — PARTIAL. Covered: genuine confirmation via DOM that a team-less Approval node exists in an actually-published, actually-active version (strong indirect evidence the assertion holds, since publish-time validation runs server-side and does not require team_id). Not yet covered: the specific properties-panel "None" rendering, blocked by node-overlap + drag limitation.
- **Existing server/control evidence:** The version's Published/Active status itself, read directly from the Settings > Workflows list and the version table, is genuine control evidence (not inferred from words like "verified" — it is the actual server-recorded status of a real row).
- **Defect found?:** No.
- **Fix/regression/browser retest:** N/A this pass.
- **Journey Discovery observation:** ALREADY COVERED for the core assertion (team-less node can be published); EXPAND EXISTING JOURNEY for the properties-panel visual confirmation, blocked by the canvas limitation above, scheduled for a future pass once resolved.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION K-003 (PARTIAL)

### DIAGNOSTIC ADDENDUM: existing-edge interaction recipe (resolves the block above for K-004/K-005/K-007/K-008)

Continuing this same pass per the user's explicit continuous-execution directive, a working recipe was found for interacting with EXISTING edges (as opposed to drawing NEW ones, which remains blocked by the drag limitation above): (1) find the edge's actual SVG path via `document.querySelector('[data-id="..."] path.react-flow__edge-interaction')`; (2) walk `getPointAtLength(totalLength * f)` for `f` from 0.02 to 0.98 in small steps, converting each point to screen space via the path's `getScreenCTM()`; (3) use `document.elementFromPoint` at each candidate to find a point that genuinely resolves to that specific edge (not an overlapping node); (4) click that point via a screenshot taken immediately beforehand (never a reused scale factor). This reliably opens the edge's Transition properties panel. Using this recipe on the existing Draft fixture "WF-TEST J005 two-conditioned plus fallback" (`3b2681fa-862d-47c4-abcb-ea31afa299c2`, version `593ba28c-0107-4c6c-840c-f524f20ee837`), K-004, K-005, K-007, and K-008 were all genuinely completed below.

### BEGIN HISTORICAL UX REVALIDATION K-004

- **Canonical intent:** The decision-edge condition editor's field dropdown is limited to SUPPORTED_DECISION_FIELDS (today, only "segment").
- **Exact user-visible assertion:** Opening the Field dropdown on any Decision node's outgoing edge shows exactly one selectable option, "segment".
- **Persona required:** Workflow Admin.
- **Persona used:** Real admin account.
- **Fixture required:** An existing Decision node with a conditioned outgoing edge.
- **Fixture used:** Existing "WF-TEST J005 two-conditioned plus fallback" (Draft), Decision -> "ApprovalA (enterprise)" edge (`node_2->node_3`), Field=segment, Operator=equals, Value=enterprise.
- **Page opened:** `/settings/workflows/3b2681fa-862d-47c4-abcb-ea31afa299c2/versions/593ba28c-0107-4c6c-840c-f524f20ee837`
- **Exact browser actions performed:** Selected the Decision->ApprovalA edge via a genuine on-path click (recipe above); confirmed the Transition panel opened showing Field=segment; clicked the Field combobox; confirmed via `read_page` that the opened listbox contains exactly one `option`, "segment".
- **Actual rendered result:** The Field dropdown's listbox rendered exactly one option, "segment".
- **Expected result:** Only "segment" selectable.
- **Manual UX result:** PASS
- **Existing server/control evidence:** None needed separately; the option list was read directly from the live DOM.
- **Defect found?:** No.
- **Fix/regression/browser retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION K-004

### BEGIN HISTORICAL UX REVALIDATION K-005

- **Canonical intent:** The decision-edge operator dropdown offers only equals/not_equals.
- **Exact user-visible assertion:** Opening the Operator dropdown on any Decision node's outgoing edge shows exactly two options, "equals" and "not_equals".
- **Persona required:** Workflow Admin.
- **Persona used:** Real admin account.
- **Fixture used:** Same as K-004 (Decision->ApprovalA edge on "WF-TEST J005 two-conditioned plus fallback").
- **Page opened:** Same as K-004.
- **Exact browser actions performed:** With the same edge selected, clicked the Operator combobox; confirmed via `read_page` that the opened listbox contains exactly two options, "equals" and "not_equals".
- **Actual rendered result:** The Operator dropdown's listbox rendered exactly "equals" and "not_equals", nothing else (no "changed" or any other operator).
- **Expected result:** Only equals/not_equals selectable.
- **Manual UX result:** PASS
- **Existing server/control evidence:** None needed separately.
- **Defect found?:** No.
- **Fix/regression/browser retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION K-005

### BEGIN HISTORICAL UX REVALIDATION K-007

- **Canonical intent:** A Decision node with fewer than 2 outgoing edges is blocked at save/publish.
- **Exact user-visible assertion:** Attempting Validate & Publish on a Decision node with only 1 outgoing edge is rejected with a clear "at least 2 branches" style error.
- **Persona required:** Workflow Admin.
- **Persona used:** Real admin account.
- **Fixture used:** "WF-TEST J005 two-conditioned plus fallback", temporarily mutated (not saved): deleted the Decision->ApprovalA edge and the Decision->ApprovalD (fallback) edge via the on-path-click + Delete Transition recipe, leaving only Decision->ApprovalB (smb) as the Decision node's sole outgoing edge.
- **Page opened:** Same as K-004.
- **Exact browser actions performed:** Selected and deleted 2 of the Decision node's 3 outgoing edges one at a time (confirming the remaining edge list via DOM after each deletion); clicked Validate & Publish; read the rendered error banner; reloaded the page (without ever clicking Save Draft) to discard the mutation and confirm the original 7-edge graph was restored.
- **Actual rendered result:** "Cannot publish an invalid workflow: ... Decision node "Decision" must have at least two outgoing branches to be a real decision." (plus expected secondary errors about the two now-disconnected Approval nodes, a correct side effect of the deliberate deletion, not a defect). After reload, all 7 original edges and 6 nodes were confirmed restored — the mutation was never persisted.
- **Expected result:** Publish blocked with a clear minimum-branches error.
- **Manual UX result:** PASS
- **Existing server/control evidence:** None needed separately; the rejection was observed directly as rendered UI.
- **Defect found?:** No.
- **Fix/regression/browser retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION K-007

### BEGIN HISTORICAL UX REVALIDATION K-008

- **Canonical intent:** A Decision node with 2+ unconditioned (fallback) edges is blocked at save/publish.
- **Exact user-visible assertion:** Attempting Validate & Publish on a Decision node with 2 unconditioned outgoing edges is rejected with a clear "at most one fallback" style error.
- **Persona required:** Workflow Admin.
- **Persona used:** Real admin account.
- **Fixture used:** "WF-TEST J005 two-conditioned plus fallback", temporarily mutated (not saved): selected the Decision->ApprovalA (enterprise) edge and clicked "Clear (make this the default branch)", removing its condition so it became a second fallback alongside the existing Decision->ApprovalD (fallback) edge.
- **Page opened:** Same as K-004.
- **Exact browser actions performed:** Selected the Decision->ApprovalA edge via the on-path-click recipe; clicked "Clear (make this the default branch)"; confirmed the panel now showed Field="Unset (default branch)"; clicked Validate & Publish; read the rendered error; reloaded the page (without saving) to discard the mutation.
- **Actual rendered result:** "Cannot publish an invalid workflow: Decision node "Decision" has more than one default (unconditioned) branch; routing would be ambiguous." After reload, the original graph (ApprovalA back to its "enterprise" condition) was confirmed restored.
- **Expected result:** Publish blocked with a clear ambiguous-routing error.
- **Manual UX result:** PASS
- **Existing server/control evidence:** None needed separately.
- **Defect found?:** No.
- **Fix/regression/browser retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION K-008

### BEGIN HISTORICAL UX REVALIDATION K-017

- **Canonical intent:** A brand-new user holding only the seeded workflow_admin role can perform the complete create-definition -> create-version -> save-draft-graph -> publish -> activate lifecycle unassisted.
- **Manual UX result:** BLOCKED (this pass). This journey fundamentally requires authoring a NEW connected graph (at minimum Start -> End with a real edge) from scratch, which requires working edge-drawing drag — confirmed non-functional in 3 independent, disciplined fresh-tab attempts this pass (see diagnostic note above). A definition and empty draft version were created ("Batch 1 Reusable Connected Graph Fixture") in anticipation of this journey but could not be populated with any edge.
- **Journey Discovery observation:** ALREADY COVERED historically per the coverage register; REGRESSION TEST ONLY, scheduled for the next pass once the drag limitation is resolved.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION K-017 (BLOCKED — tooling)

### BEGIN HISTORICAL UX REVALIDATION K-023

- **Canonical intent:** Deleting the middle node of a chain (A -> [node] -> B) and saving persists exactly what the client sends (no server-side auto-reconnect), so no edge referencing the deleted node's key survives the save.
- **Exact user-visible assertion:** After deleting a node that has real incoming and outgoing edges and saving, neither edge survives; the graph is not auto-reconnected (A does not gain a new direct edge to B).
- **Persona required:** Workflow_Admin-equivalent (write access to workflow_definition).
- **Persona used:** Real admin account.
- **Fixture required:** A Draft version with a node that has both an incoming and an outgoing edge.
- **Fixture used (this pass):** "Batch 1 UX Revalidation Fixture" Draft Version 1, but the deleted node (an "End" node) had no edges connected to it at the time, since edge-drawing had not yet succeeded on this fixture.
- **Page opened:** `/settings/workflows/a3f17864-d36b-45dd-913f-54874be1f7f2/versions/9c4dcb16-0864-415e-b88d-50f5b6c85992`
- **Exact browser actions:** Same delete-and-save sequence recorded under K-009 above.
- **Actual rendered result:** The node disappeared and stayed gone after reload, but this does not exercise K-023's specific claim, since there were no edges to test for survival or auto-reconnect.
- **Expected result:** Neither the incoming nor outgoing edge of a deleted middle node survives the save, and no new edge is auto-created between its former neighbors.
- **Manual UX result:** BLOCKED (this pass). The only genuine evidence obtained so far (node deletion persists) belongs to K-009, not to K-023's own canonical assertion, which specifically concerns edges. Not yet exercised at all.
- **Existing server/control evidence:** None.
- **Defect found?:** No (assertion not yet tested).
- **Fix/retest:** N/A.
- **Journey Discovery observation:** NEW JOURNEY REQUIRED is not applicable, this is the original K-023 journey itself, still pending; blocked this pass by the same canvas drag/click reliability limitation documented under the K-009 diagnostic note, scheduled for the next pass once a node with real incoming/outgoing edges can be constructed.
- **Permanent ledger updated:** Yes (this entry, correcting the prior overbroad PASS claim for K-023).

### END HISTORICAL UX REVALIDATION K-023 (BLOCKED pending reusable edge fixture)

### BEGIN HISTORICAL UX REVALIDATION K-010

- **Canonical intent:** Two concurrent editors load the same draft version. The second editor's save is rejected as stale (a friendly error, not a silent overwrite or a raw database error) rather than the first editor's real change being silently discarded. The Refresh control fully recovers the second editor to the current true state.
- **Exact user-visible assertion:** After Admin A saves first, Admin B's own Save Draft click on the same (now stale) version shows a friendly message explaining the draft changed since it was loaded, with a Refresh control; clicking Refresh reloads the whole page and shows Admin A's real change, not a stale or half-recovered state.
- **Persona required:** Two independent Workflow_Admin-equivalent sessions (Admin A, Admin B).
- **Persona used:** Real admin account, in two separate browser tabs both authenticated as the same account (the assertion is about optimistic-locking on the version row, not about two distinct identities).
- **Fixture required:** A Draft version both sessions load before either saves.
- **Fixture used:** "Batch 1 UX Revalidation Fixture" Draft Version 1 (Start, Approval, Decision Renamed K022, End at the start of this pass).
- **Page opened:** `/settings/workflows/a3f17864-d36b-45dd-913f-54874be1f7f2/versions/9c4dcb16-0864-415e-b88d-50f5b6c85992`, opened in two separate fresh browser tabs (Admin A, Admin B) before either saved.
- **Exact browser actions:** Both tabs loaded the same version. In Admin A's tab, clicked "Form Step" to add a node, confirmed via the DOM that it was added, clicked Save Draft, and confirmed "Draft saved." In Admin B's tab (still holding the pre-save version), clicked Save Draft. Confirmed the rendered error banner text, then clicked the Refresh button shown alongside it, then confirmed via the DOM that Admin B's canvas now shows Admin A's Form Step node.
- **Actual rendered result:** Admin B's Save Draft attempt rendered: "This workflow draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes." with a Refresh button. Clicking Refresh reloaded the page and rendered all 5 nodes including Admin A's Form Step node, confirming a full, correct recovery rather than a partial or stale one.
- **Expected result:** Stale save rejected with a friendly message; Refresh fully recovers to the current true state; Admin A's change is never silently lost or overwritten.
- **Manual UX result:** PASS
- **Existing server/control evidence:** None needed separately; both the rejection and the recovery were observed directly as rendered UI.
- **Defect found?:** No. This reconfirms the K-010/K-030 fix (Refresh performs a full page reload, not just a client-side banner clear) is still correct.
- **Fix/retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED. A follow-on step (Admin B re-adding their own intended change and saving successfully after refresh) was attempted but not completed in this pass due to click-delivery flakiness in Admin B's tab, unrelated to the core canonical assertion (which is about the rejection and the recovery, both of which are confirmed). REGRESSION TEST ONLY: revisit the post-refresh successful resave as a supplementary check if time allows later in this batch.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION K-010

### DIAGNOSTIC: Base UI Select Dropdown (Responsible Team picker)

- **Prior state:** 9+ prior attempts across two Select instances (this same "Responsible Team" field and the "Applies To" field) all failed to change the trigger's displayed value, using screenshot-coordinate clicks, ref-based clicks that later turned out to still be coordinate-derived, and keyboard navigation. A dedicated source-code investigation found no explicit stacking/pointer-events/z-index bug.
- **Disciplined re-diagnostic (this pass), on a genuinely fresh tab:** (1) selected the Approval node via a JS-`elementFromPoint`-confirmed coordinate, opening its properties panel; (2) clicked the "Responsible Team" combobox trigger via its real `read_page` DOM ref (`ref_25`); (3) confirmed via screenshot that the option list rendered visibly open; (4) captured the actual option elements via a fresh `read_page` call, which for the first time returned each option's real accessible text (`generic "UX Verification Team"` etc.) mapped to a specific `ref_N`, rather than the blank/unlabelled option refs seen when a stale ref set was reused; (5) confirmed the popup's `pointer-events: auto` and `opacity: 1` via `getComputedStyle` immediately before clicking; (6) clicked the "UX Verification Team" option by that ref; (7) confirmed the trigger's visible text changed to "UX Verification Team" immediately, then clicked Save Draft, confirmed "Draft saved.", reloaded the page in the same tab, reselected the node, and confirmed the value persisted through a genuine server round-trip.
- **Root cause of the prior 9+ failures:** every previous attempt clicked the option by a screenshot-space coordinate (or a coordinate derived from a stale/mistimed `read_page` snapshot of the Portal-rendered popup), never by a freshly-captured, correctly-labelled DOM ref taken immediately after confirming the popup was open and interactive. The Base UI Select component itself has no defect; the failure was in this program's own click-targeting methodology for Portal-rendered popups specifically.
- **Conclusion:** This is NOT a `BROWSER AUTOMATION LIMITATION — BASE UI SELECT`. The dropdown is fully operable by genuine browser automation provided the option is clicked via a freshly-captured DOM ref (never a screenshot coordinate) taken after the popup is confirmed open. This unblocks every Batch 1 journey previously suspected to depend on this component (K-002, K-004, K-005), which are executed below using this same method.

### BEGIN HISTORICAL UX REVALIDATION K-002

- **Canonical intent:** An admin can pick any existing team as an Approval node's `responsible_team_id` via the canvas node-properties panel; reassigning to a different team in a later session fully replaces the old assignment (never merges or leaves the old value alongside the new one).
- **Exact user-visible assertion:** Node properties panel reflects the currently-saved team correctly on reopen; the Regular Path (pick a team, save) and Stress Variant (reassign to a different team in a later edit session, save again, confirm the old assignment is fully replaced) both hold.
- **Persona required:** Workflow Admin.
- **Persona used:** Real admin account (only Workflow Admin-equivalent session available; the canonical assertion is about the picker mechanic, not about a specific role identity).
- **Fixture required:** A Draft graph with an Approval node selected.
- **Fixture used:** "Batch 1 UX Revalidation Fixture" Draft Version 1, Approval node.
- **Page opened:** `/settings/workflows/a3f17864-d36b-45dd-913f-54874be1f7f2/versions/9c4dcb16-0864-415e-b88d-50f5b6c85992`, fresh tab.
- **Exact browser actions performed:** Selected the Approval node; opened the "Responsible Team" combobox via its DOM ref; clicked the "UX Verification Team" option via its DOM ref; confirmed the trigger showed "UX Verification Team"; clicked Save Draft, confirmed "Draft saved."; reloaded the page in the same tab, reselected the node, confirmed "UX Verification Team" persisted (Regular Path, genuine server round-trip). Then, in the same session, reopened the combobox, selected "WF-TEST Finance" instead, confirmed the trigger changed to "WF-TEST Finance", saved, reloaded again, reselected the node, and confirmed the panel showed only "WF-TEST Finance" (Stress Variant: old assignment fully replaced, not merged or duplicated).
- **Actual rendered result:** Regular Path: "Responsible Team" showed "UX Verification Team" both immediately after selection and after a full reload. Stress Variant: after reassignment, save, and reload, "Responsible Team" showed only "WF-TEST Finance"; no trace of "UX Verification Team" remained anywhere in the panel.
- **Expected result:** Team assignment persists correctly; reassignment fully replaces the prior value.
- **Manual UX result:** PASS
- **Existing server/control evidence:** None needed separately; both states were confirmed directly as rendered UI after genuine page reloads.
- **Defect found?:** No.
- **Fix/regression/browser retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION K-002
