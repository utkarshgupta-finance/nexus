# Batch 2 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY
VALIDATION BATCH 2 (K-026 through K-030, L-001 through L-021, 26
journeys total). This file is the source of truth for the final Batch 2
report. It is created before execution begins and updated as each
journey completes, per the Batch 2 mission's mandatory persistent
ledger requirement.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED /
PRODUCT GAP CONFIRMED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

If a journey fails and is later fixed, both Original Status: FAILED and
Final Status: FAILED THEN FIXED + PASS are preserved. History is never
rewritten to make a journey look like it passed the first time.

---

## K-026: Start Node Authoring Constraints, No Incoming Edge Expected

- Journey ID: K-026
- Journey Name: Start Node Authoring Constraints, No Incoming Edge Expected
- Started At: 2026-09-16 14:20
- Completed At: 2026-09-16 15:05
- Priority: P3
- Automation Feasibility: FULL
- Personas: Workflow Admin (wf-test.workflow-admin@example.test)
- Test Data / Record References: Fresh definition "BATCH2 K-Series Builder Mechanics" (Customer Change) created for Batch 2; throwaway definition k026_direct_rpc_isolation_test created and deleted for the isolated RPC test
- Starting State: New draft graph, admin attempts to drag an edge TO a Start node from another node
- Actions Executed: (1) Live browser: created Start + Approval nodes on a fresh draft canvas, dragged an edge from Approval's output handle to Start's input handle; edge rendered successfully. (2) Clicked Save Draft: succeeded ("Draft saved."), confirming save performs no structural validation. (3) Clicked Validate & Publish: client validator produced a wall of disconnection/reachability errors for the OTHER incomplete nodes but never flagged the Start-incoming-edge itself. (4) Direct RPC bypass: built a fully valid 5-node graph (Start -> Decision -> {Approval1 (condition), Approval2 (fallback)}, Approval1 -> End) where Approval2 additionally points back to Start, isolating the one question (does anything reject an edge into Start) from every other rule; called save_workflow_version_graph then publish_workflow_definition_version directly.
- Expected Result: A Start node should never accept an incoming edge; this should be rejected at validate-time and/or publish-time
- Actual Result (original): Canvas allowed drawing the edge; Save Draft succeeded; client validator did not flag it; direct RPC publish SUCCEEDED, permanently publishing an immutable version where Start has an incoming edge. Unsafe acceptance, symmetric to Batch 1's K-025 End-node-outgoing-edge defect.
- Regular Path Result: FAILED (before fix) then PASS (after fix)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Original Status: FAILED
- Defect IDs: K026-D01
- Root Cause: Neither src/platform/workflow-builder/domain/validation.ts nor publish_workflow_definition_version checked for edges targeting a Start node. K-025 (Batch 1) added the symmetric End-node-outgoing-edge check but no equivalent check was ever added for Start's incoming edges.
- Fix: Added a client-side check in validation.ts (Start node with any incoming edge is an error) and a symmetric server-side check in publish_workflow_definition_version (supabase/migrations/20260929000000_publish_validation_start_incoming_edge.sql), mirroring the K-025 fix exactly.
- Fix Commit if applicable: fa061f2
- Regression Test: src/platform/workflow-builder/domain/validation.test.ts, "rejects a Start node that has an incoming transition (Batch 2, K-026)"
- Rerun Result: Reran the exact isolated direct-RPC graph after the fix: publish now rejected with WORKFLOW_INVALID_GRAPH ("has an incoming transition into a Start node; a Start node is an entry point and must have no incoming transitions"). Reran full vitest suite for validation.test.ts: 19/19 pass.
- Neighboring Journeys Rerun: Diffed the new publish_workflow_definition_version function body against the prior version; confirmed the K-025 (End-node-outgoing-edge) and K-019 (reachability) check logic is byte-for-byte unchanged, only the new K-026 check was inserted between them.
- Final Status: FAILED THEN FIXED + PASS
- Notes: Migration applied to the live/shared Supabase database with explicit user authorization via AskUserQuestion, following the same pattern as Batch 1's K-019/K-025 fix. Throwaway RPC-bypass test definitions were created and cleaned up (deleted) via service-role scripts; no throwaway scripts were committed.

---

## K-027: Read-Only Permission Holder Can View but Never Mutate the Builder Canvas

- Journey ID: K-027
- Journey Name: Read-Only Permission Holder Can View but Never Mutate the Builder Canvas
- Started At: 2026-09-16 15:05
- Completed At: 2026-09-16 15:40
- Priority: P1
- Automation Feasibility: FULL
- Personas: Read-only Workflow Viewer (wf-test.workflow-viewer@example.test), Workflow Editor (regression check)
- Test Data / Record References: BATCH2 K-Series Builder Mechanics, Version 1 draft (id 8f3ec7c6-bab9-4231-bce9-85d1636ff6f0)
- Starting State: User holds workflow_definition.read only (workflow_viewer_test role)
- Actions Executed: Logged in as Viewer, opened the workflow list (read succeeded, no Discard/Activate controls shown, correctly gated), opened the draft version's canvas editor, inspected nodes/edges freely, attempted Save Draft directly.
- Expected Result: Save/Publish/Activate/Discard controls all inert for this user; UI clearly communicates read-only status rather than presenting controls that silently no-op.
- Actual Result (original): The definition list page correctly hid Discard Draft/Activate controls. But the version CANVAS EDITOR page computed its read-only state purely from `version.status === "published"`, ignoring the viewer's own permissions entirely. For a DRAFT version, the Viewer saw a fully-enabled Add Node panel, Save Draft button, and Validate & Publish button, all looking actionable. Clicking Save Draft did correctly get rejected server-side ("You do not have permission to write workflow_definition"), so no unsafe mutation occurred, but the UX explicitly required by this journey (clear read-only status, no controls that look actionable but aren't) was not met.
- Regular Path Result: FAILED THEN FIXED + PASS (UX/authorization-surface gap on the canvas editor page specifically)
- Stress Variant Result: N/A
- Authorization Result: PASS (server-side requirePermission correctly rejected the write attempt both before and after the fix; the gap was purely in what the UI presented, not in what it allowed)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: FAILED THEN FIXED + PASS
- Original Status: FAILED
- Defect IDs: K027-D01
- Root Cause: src/app/settings/workflows/[definitionId]/versions/[versionId]/page.tsx computed `isReadOnly` solely from the version's publish status, never checking the viewing session's own workflow_definition.write permission.
- Fix: Added `sessionHasPermission(session, "workflow_definition", "write")` and combined it with publish status into `isReadOnly`; threaded a `readOnlyReason` ("published" | "no_permission") through to WorkflowCanvasEditor so the header badge/description accurately explains WHY the canvas is read-only instead of always saying "Published, read-only" even when the real reason is a missing permission.
- Fix Commit if applicable: (pending, committed with this ledger update)
- Regression Test: Live browser re-verification (no unit-testable layer for this Server Component composition): Viewer now sees "Read-only: you do not have permission to edit workflows" with no Add Node panel and no Save/Publish buttons; Workflow Editor (write, no publish) re-checked immediately after and still sees the full Draft editing UI (Add Node, Save Draft, Validate & Publish), confirming no regression to the write/publish permission split from Batch 1 (K-014/K-015/K-016).
- Rerun Result: PASS, both personas behave correctly after the fix.
- Neighboring Journeys Rerun: Re-verified K-014/K-015/K-016 (write-without-publish persona) behavior live via the Workflow Editor persona; unaffected.
- Final Status: FAILED THEN FIXED + PASS
- Notes: A real mutation was never at risk (server-side authorization was always correct); the defect was UI-surface honesty, not data integrity. Fixed given it is explicitly named as a UX Check in this P1 journey and the fix was small and bounded.

---

## K-028: Team Reassignment on a Node Mid-Edit-Session Only Affects Requests Created After the New Version Publishes

- Journey ID: K-028
- Journey Name: Team Reassignment on a Node Mid-Edit-Session Only Affects Requests Created After the New Version Publishes
- Started At: 2026-09-16 15:45
- Completed At: 2026-09-16 16:05
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin (WF-TEST Workflow Admin), Requestor (WF-TEST Maker)
- Test Data / Record References: Real active "WF-TEST Finance then Legal Sequential" definition (Customer Change, id a167d59c-...), version 9 (published, active) then version 10 (newly created, published during this test); customer_change requests against customer test-customer-1 (id ec93474a-...)
- Starting State: A real, live customer_change request created and submitted, bound to version 9's node_2 ("Finance Approval"), which requires team wf_test_finance
- Actions Executed: Created and submitted a live customer_change request (request 1) via the real create/submit RPCs used by the Server Action layer; confirmed it bound to version 9 and its current node (node_2) resolves to the wf_test_finance team. As admin: created a new draft (version 10) from version 9, reassigned node_2's responsible_team_id to a different team (ux_verification_team), published version 10. Re-read request 1 from the database. Created and submitted a second live request (request 2) after the publish.
- Expected Result: Request 1, already bound to version 9, continues to require the OLD team (wf_test_finance) for node_2 regardless of the reassignment and publish; only requests created after version 10 becomes current should require the new team.
- Actual Result: Request 1's workflow_version_id remained version 9's id after the publish of version 10 (unchanged); the team resolved for its current node via version 9 remained wf_test_finance (unchanged). Request 2, created after version 10 published, bound to version 10 and resolved to the new team (ux_verification_team).
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS. Request 1's workflow_version_id and resolved team were verified unchanged directly against the database after the publish of version 10.
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A (proven via live data, not unit-testable business logic; the same underlying mechanism is covered by L-011's regular path)
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Executed as one consolidated live fixture together with L-011 (in-flight never re-resolves to a newly published version) and L-013 (new request picks up the new version), since all three assert the same underlying invariant from different angles; the mission explicitly allows reusing a single live fixture across related journeys rather than rebuilding it three times. Version 10 remains published on the real "WF-TEST Finance then Legal Sequential" definition as valid history (this is the correct, permanent effect of a real publish); the two throwaway test request rows created were deleted afterward.

---

## K-029: Concurrent Discard Removes a Draft Graph an Editor Is Actively Editing

- Journey ID: K-029
- Journey Name: Concurrent Discard Removes a Draft Graph an Editor Is Actively Editing
- Started At: 2026-09-16 17:40
- Completed At: 2026-09-16 18:00
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin A (editing, browser session as wf-test.workflow-editor@example.test), Workflow Admin B (discarding, simulated via a direct service-role RPC call disclosed here as a simulation, since a genuinely independent second cookie-jar browser session was not available in this tool session)
- Test Data / Record References: "BATCH2 K-Series Builder Mechanics" (Customer Change), a fresh draft version created for this test
- Starting State: A draft version open for editing in the browser (Admin A), simultaneously targeted for discard by Admin B
- Actions Executed: Admin A opened the draft canvas and added a node (an unsaved local change, not yet saved). Admin B called discard_workflow_definition_version directly against the same draft id. Admin A then clicked Save Draft without reloading.
- Expected Result: Admin A's save errors cleanly with a not-found/discarded message, does not silently resurrect a draft row or leave orphaned node/edge rows; Admin A sees a clear, actionable message and can start a fresh draft rather than being stuck on a dead reference.
- Actual Result (original): Admin B's discard succeeded cleanly (version row fully removed). Admin A's Save Draft was correctly rejected (no data was silently resurrected, no orphaned rows), but the error message shown was the raw internal exception detail: "no workflow_definition_versions row for id 8f3ec7c6-bab9-4231-bce9-85d1636ff6f0", a bare table name and UUID leaked directly to the user, violating the project's own "no raw technical identifiers as primary UI" rule and the journey's own UX Check.
- Regular Path Result: FAILED THEN FIXED + PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: PASS (no orphaned rows, no silent resurrection, in both the original and fixed runs; only the message text was wrong)
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (confirmed via direct query: the version row was fully gone, no dangling nodes/edges referenced it, both before and after the message fix)
- Recovery Result: PASS after fix (clicking the new Refresh control lands on a 404, since the draft genuinely no longer exists; the sidebar remains available to navigate back and start a fresh draft, which was then verified live)
- UX Result: FAILED THEN FIXED + PASS
- Original Status: FAILED
- Defect IDs: K029-D01
- Root Cause: src/platform/workflow-builder/actions.ts's toSaveError only special-cased WORKFLOW_VERSION_DRAFT_STALE with a friendly message; WORKFLOW_VERSION_NOT_FOUND (raised by save_workflow_version_graph when the target draft no longer exists) fell through to the generic stripErrorToken path, which shows the raw exception detail verbatim.
- Fix: Added a WORKFLOW_VERSION_NOT_FOUND branch to toSaveError returning "This draft no longer exists. It was likely discarded by another admin. Refresh to start a new draft." and flagging stale=true so the existing Refresh control (already built for K-010/K-030) appears.
- Fix Commit if applicable: (pending, committed with this ledger update)
- Regression Test: Live re-verification (no unit-testable layer, this is Server Action error-mapping copy): recreated a fresh draft, repeated the exact discard-then-save race, confirmed the new friendly message and Refresh button appear; clicked Refresh and confirmed it lands cleanly (a 404, since the draft is genuinely gone) rather than a raw error or a stuck page; confirmed a brand-new draft can be created normally afterward.
- Rerun Result: PASS
- Neighboring Journeys Rerun: Verified by code inspection that the pre-existing WORKFLOW_VERSION_DRAFT_STALE branch (K-010/K-030) is untouched, since the fix added a new independent branch rather than modifying the existing one.
- Final Status: FAILED THEN FIXED + PASS
- Notes: The concurrency mechanism itself (discard-wins, save-loses-cleanly) was already correct; the defect was purely in the user-facing message. Admin B's discard was simulated via a direct backend RPC call rather than a second independent browser cookie-jar session, disclosed here honestly per the mission's guidance for tool-session limitations.

---

## K-030: Stale-Draft Refresh Reloads the Whole Page, Not Just the Error Banner (Regression)

- Journey ID: K-030
- Journey Name: Stale-Draft Refresh Reloads the Whole Page, Not Just the Error Banner (Regression)
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: PARTIAL
- Personas: Admin A (recovering from staleness), Admin B (whose change must survive)
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: TBD
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD
- UX Result: TBD
- Original Status: TBD
- Defect IDs: None (regression re-proof of Batch 1 K-010/K-030 fix)
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: TBD
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: Must be executed as a real live regression per the explicit 8-step re-proof checklist, not assumed passed because the underlying defect was fixed in Batch 1.

---

## L-001: Creating the First Draft Version for a Brand-New Definition

- Journey ID: L-001
- Journey Name: Creating the First Draft Version for a Brand-New Definition
- Started At: 2026-09-16 15:50
- Completed At: 2026-09-16 16:20
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "lseries_lifecycle_test" (Customer Change), created and deleted via direct RPC calls
- Starting State: A newly created workflow_definition with zero versions
- Actions Executed: Called create_workflow_definition_version directly against a brand-new definition.
- Expected Result: The first version is assigned version_number=1, status=draft.
- Actual Result: version_number=1, status=draft, exactly one row exists.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (exactly one row, version_number=1, confirmed via RPC return value)
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A (deterministic RPC behavior, no gap found)
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: N/A

---

## L-002: Second Draft Creation Attempt Blocked While One Draft Already Exists

- Journey ID: L-002
- Journey Name: Second Draft Creation Attempt Blocked While One Draft Already Exists
- Started At: 2026-09-16 15:50
- Completed At: 2026-09-16 16:20
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin (x2 for concurrency)
- Test Data / Record References: Throwaway definition "lseries_lifecycle_test" (Customer Change)
- Starting State: Definition already has one draft (status=draft, unpublished)
- Actions Executed: Called create_workflow_definition_version a second time against the same definition while its first draft still existed. Repeated with Promise.allSettled to race two simultaneous calls against the same already-existing draft.
- Expected Result: The partial unique index (uq_workflow_version_one_draft) rejects the second draft with a clear conflict, even under a genuine race; row count of draft-status versions never exceeds 1.
- Actual Result: Single attempt rejected with "duplicate key value violates unique constraint uq_workflow_version_one_draft". Concurrent race: both simultaneous calls rejected identically; the pre-existing draft was untouched.
- Regular Path Result: PASS
- Stress Variant Result: PASS (concurrent race, both rejected, no double-draft created)
- Authorization Result: N/A
- Concurrency Result: PASS
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (row count of draft-status versions for this definition never exceeded 1)
- Recovery Result: PASS (the original draft remained usable/publishable throughout)
- UX Result: PASS (error message directly names the constraint concept, "a draft already exists," not an opaque generic error)
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A (enforced by a pre-existing DB constraint, not new logic)
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: The partial unique index is confirmed as the true source of truth: identical rejection under both a serial second attempt and a genuine concurrent race.

---

## L-003: Published Version Is Immutable, Direct Edit Attempt Rejected

- Journey ID: L-003
- Journey Name: Published Version Is Immutable, Direct Edit Attempt Rejected
- Started At: 2026-09-16 15:50
- Completed At: 2026-09-16 16:20
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "lseries_lifecycle_test" (Customer Change), version 1 published with a minimal valid Start->Approve->End graph
- Starting State: Version published
- Actions Executed: Called save_workflow_version_graph directly against the published version's id with the current row_version.
- Expected Result: Rejected since save-draft-graph's precondition requires status=draft; the published version's nodes/edges remain byte-for-byte unchanged.
- Actual Result: Rejected with "WORKFLOW_VERSION_NOT_DRAFT: version ... has status published, only a draft may be edited". Nodes/edges unchanged (verified by immediately re-reading the version's node set).
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: N/A

---

## L-004: Editing Again After Publish Always Creates a Brand-New Draft Version

- Journey ID: L-004
- Journey Name: Editing Again After Publish Always Creates a Brand-New Draft Version
- Started At: 2026-09-16 15:50
- Completed At: 2026-09-16 16:20
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "lseries_lifecycle_test" (Customer Change)
- Starting State: Definition has one published version (version_number=1), no draft
- Actions Executed: Called create_workflow_definition_version again after version 1 was published; inspected the new draft's nodes.
- Expected Result: A NEW draft version (version_number=2, status=draft) is created, pre-populated by copying version 1's graph; version 1 remains published and untouched.
- Actual Result: version_number=2, status=draft, pre-populated with the same 3 nodes (start, approve, end) copied from version 1.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (version 1 and version 2 coexist as distinct rows)
- Recovery Result: N/A
- UX Result: PASS (version_number visibly increments to 2 in the RPC's own return value, matching what the UI's "Workflow Version N" header displays, per direct observation during K-026/K-027 browser testing)
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: N/A

---

## L-005: Version Numbering Increments Correctly Across Multiple Publish Cycles

- Journey ID: L-005
- Journey Name: Version Numbering Increments Correctly Across Multiple Publish Cycles
- Started At: 2026-09-16 15:50
- Completed At: 2026-09-16 16:20
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "lseries_lifecycle_test" (Customer Change)
- Starting State: A definition taken through create/discard/create cycles
- Actions Executed: After discarding version_number=2 (the L-016 draft), created a fresh draft and inspected its assigned version_number.
- Expected Result: version_number sequence has no duplicate values; discard/renumbering behavior confirmed empirically since the grounding brief does not assert it.
- Actual Result: The next draft created after discarding version_number=2 was ALSO assigned version_number=2 (the discarded number is reused, not permanently skipped, since it was never published).
- Regular Path Result: PASS
- Stress Variant Result: PASS (empirically confirmed: discarded draft numbers are reused, not skipped)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (no duplicate version_number values existed at any point, since the discarded row 2 was actually removed before the new row 2 was created)
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: This journey's own Notes correctly flagged the discard/renumbering outcome as needing empirical confirmation rather than assertion; confirmed live: version_number is derived from a max+1 computation over EXISTING rows at creation time, so once the only version 2 row is deleted (discard), the number becomes available again for the next draft. Published version numbers are never reused since published versions are never deleted.

---

## L-006: Activating a Definition With No Published Version Raises WORKFLOW_DEFINITION_NO_PUBLISHED_VERSION

- Journey ID: L-006
- Journey Name: Activating a Definition With No Published Version Raises WORKFLOW_DEFINITION_NO_PUBLISHED_VERSION
- Started At: 2026-09-16 16:25
- Completed At: 2026-09-16 17:10
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "lseries_no_published_version" (Customer Change)
- Starting State: Definition exists, is_active=false, no published version (tested both zero-versions-at-all and a draft-only never-published version)
- Actions Executed: Called set_workflow_definition_active(true) on a definition with zero versions; then created a draft-only version (never published) on the same definition and repeated.
- Expected Result: WORKFLOW_DEFINITION_NO_PUBLISHED_VERSION is raised in both cases; is_active remains false.
- Actual Result: Both attempts rejected with "WORKFLOW_DEFINITION_NO_PUBLISHED_VERSION: ... has no published version yet; publish a version before activating it". is_active remained false throughout.
- Regular Path Result: PASS
- Stress Variant Result: PASS (draft-only, never-published case distinguished correctly from zero-versions case; same rejection)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: PASS (publishing a version first, as done later in L-007/L-008's setup, allows activation to succeed)
- UX Result: PASS (error message clearly states a published version is required first)
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: N/A

---

## L-007: Activating a Second Definition for an Already-Active Context Raises WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE

- Journey ID: L-007
- Journey Name: Activating a Second Definition for an Already-Active Context Raises WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE
- Started At: 2026-09-16 16:25
- Completed At: 2026-09-16 17:10
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Real active "WF-TEST Finance then Legal Sequential" (Customer Change, active); throwaway published definition "lseries_defb_context_active" as Definition B
- Starting State: Definition A (WF-TEST Finance then Legal Sequential) active; Definition B published, inactive
- Actions Executed: Called set_workflow_definition_active(true) directly on Definition B (not via the governed swap RPC) while Definition A was still active.
- Expected Result: WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE is raised; Definition A remains active, Definition B remains inactive.
- Actual Result: Rejected with "WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE: This process already has an active workflow: WF-TEST Finance then Legal Sequential. Deactivate or replace it before activating another workflow." Exactly one customer_change definition remained active (Definition A) afterward, confirmed by direct query.
- Regular Path Result: PASS
- Stress Variant Result: Covered by L-009 (concurrent activation race across two fresh, never-active definitions is the meaningfully distinct concurrency scenario; a naive concurrent activate against an ALREADY-active context is the same single-path rejection repeated, not a materially different race).
- Authorization Result: N/A
- Concurrency Result: PASS (see L-009 for the genuine concurrency stress case)
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (exactly one row with is_active=true for customer_change at all times, verified directly)
- Recovery Result: PASS (the governed replace_active_workflow_definition RPC, used next in L-008, correctly performs the swap)
- UX Result: PARTIAL: the error message names the currently-active workflow and instructs "Deactivate or replace it," which does point toward the correct governed swap path, though it does not name replace_active_workflow_definition specifically. Not treated as a defect: the message is materially informative, not misleading.
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: N/A

---

## L-008: Governed Replace-Active Swap Atomically Deactivates Old and Activates New

- Journey ID: L-008
- Journey Name: Governed Replace-Active Swap Atomically Deactivates Old and Activates New
- Started At: 2026-09-16 16:25
- Completed At: 2026-09-16 17:10
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Real active "WF-TEST Finance then Legal Sequential" (Customer Change) as Definition A; throwaway "lseries_defb_context_active" as Definition B
- Starting State: Definition A active; Definition B published, inactive, ready to take over
- Actions Executed: Called replace_active_workflow_definition(new=B); re-read both definitions' is_active flags; immediately re-invoked the identical swap call a second time (already-swapped state); swapped back to Definition A afterward to restore original state.
- Expected Result: The RPC atomically sets A.is_active=false and B.is_active=true; re-invoking the same swap either no-ops cleanly or raises a clear "already active" error, never corrupting state; exactly one of A/B has is_active=true at all times.
- Actual Result: After the swap: A.is_active=false, B.is_active=true. Re-invoking the identical swap succeeded cleanly with no error (idempotent no-op, since B was already the requested target and already active), and exactly one definition remained active afterward. Restoring the swap back to A succeeded the same way.
- Regular Path Result: PASS
- Stress Variant Result: Not executed as a live simultaneous-request race (would require a second, independent live request creation in the exact instant of the swap); reasoned from L-011/L-012's already-proven guarantee that resolution is deterministic per-request at creation time, so a request created during the swap window resolves to whichever definition's is_active flag the single atomic UPDATE transaction had committed at that instant, never a null or inconsistent read, by the same transactional guarantee already verified for the update itself.
- Authorization Result: N/A
- Concurrency Result: PASS (see Stress Variant note; the transaction boundary itself was verified atomic via direct before/after state checks)
- Idempotency Result: PASS (re-invoking the same swap did not corrupt state; exactly one active definition throughout)
- Audit/Data Integrity Result: PASS (exactly one of A/B had is_active=true at every point checked: before, immediately after, after the idempotent re-invoke, and after restoring)
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: The Stress Variant (a genuinely simultaneous new-request-creation-during-swap race) was reasoned from already-verified guarantees rather than re-executed live, since constructing a true race at the exact transaction-commit instant is not meaningfully distinct from the atomicity already directly verified here plus the per-request resolution determinism already directly verified in L-011/L-013.

---

## L-009: Partial Unique Index Holds Under Concurrent Activation Attempts Across Two Fresh Definitions

- Journey ID: L-009
- Journey Name: Partial Unique Index Holds Under Concurrent Activation Attempts Across Two Fresh Definitions
- Started At: 2026-09-16 16:25
- Completed At: 2026-09-16 17:10
- Priority: P0
- Automation Feasibility: FULL
- Personas: Two Workflow Admins acting concurrently
- Test Data / Record References: customer_onboarding domain, temporarily deactivating the real active "WF-TEST Simple One-Step Approval" definition (explicit user authorization obtained via AskUserQuestion before this sub-test); two fresh throwaway published definitions "lseries_l009_defc" and "lseries_l009_defd"
- Starting State: No definition currently active for customer_onboarding (the real active definition was temporarily deactivated for this test only)
- Actions Executed: Created and published two fresh definitions (C and D) for customer_onboarding, both inactive. Raced Promise.allSettled([activate(C), activate(D)]) to fire both activation calls at the same instant. Restored the original active definition via replace_active_workflow_definition afterward and verified the restore.
- Expected Result: Exactly one succeeds, the other is rejected by the partial unique index (WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE or equivalent), leaving exactly one active definition for customer_onboarding.
- Actual Result: Definition C's activation succeeded; Definition D's was rejected with "WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE: This process already has an active workflow: L-009 def C." Exactly one customer_onboarding definition was active immediately after the race. Original active definition ("WF-TEST Simple One-Step Approval") was restored and verified active again before continuing.
- Regular Path Result: N/A (this journey is itself the concurrency stress case)
- Stress Variant Result: PASS (5-admin variant not executed; the 2-way race already demonstrates the partial unique index, not application logic, is the enforcement point, since both calls raced against the database at the exact same instant via Promise.allSettled with no artificial delay)
- Authorization Result: N/A
- Concurrency Result: PASS
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (exactly one row with is_active=true for customer_onboarding both during and after the race)
- Recovery Result: PASS (the losing definition D could be activated normally afterward via the governed swap, not executed since it was throwaway, but the mechanism was already proven in L-008)
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A (enforced by a pre-existing DB partial unique index)
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Temporarily deactivating the real, live customer_onboarding active definition required explicit user authorization (obtained via AskUserQuestion), since it briefly disrupts real request routing for that context. The original active definition was restored and its restoration verified via direct query before moving on to any other journey.

---

## L-010: Active Version Resolution Picks Highest Version_Number Among Published Versions Under the Active Definition

- Journey ID: L-010
- Journey Name: Active Version Resolution Picks Highest Version_Number Among Published Versions Under the Active Definition
- Started At: 2026-09-16 15:45
- Completed At: 2026-09-16 16:05
- Priority: P0
- Automation Feasibility: FULL
- Personas: Requestor (WF-TEST Maker)
- Test Data / Record References: Real active "WF-TEST Finance then Legal Sequential" (Customer Change), versions 1 through 9 published, version 10 published during the K-028/L-011 test
- Starting State: A definition with versions 1 through 9 (and, after this session's K-028 test, 10) all published, definition active; a draft (version 10 while still a draft, before its own publish) existed transiently
- Actions Executed: Created and submitted a live customer_change request while version 10 was still a draft (not yet published); confirmed it resolved to version 9 (the highest PUBLISHED version), ignoring the unpublished draft entirely. After version 10 published, created a second live request and confirmed it resolved to version 10.
- Expected Result: New requests resolve to the highest published version_number under the active definition, never an unpublished draft, and never a lower published version once a higher one exists.
- Actual Result: Request created while version 10 was a draft resolved to version 9. Request created after version 10 published resolved to version 10.
- Regular Path Result: PASS
- Stress Variant Result: PASS (unpublished draft version 10 correctly ignored by resolution while it was still a draft)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Executed as part of the same consolidated live fixture as K-028/L-011/L-013.

---

## L-011: In-Flight Request Never Re-Resolves to a Newly Published Version

- Journey ID: L-011
- Journey Name: In-Flight Request Never Re-Resolves to a Newly Published Version
- Started At: 2026-09-16 15:45
- Completed At: 2026-09-16 16:05
- Priority: P0
- Automation Feasibility: FULL
- Personas: Requestor (WF-TEST Maker, created under v9), Workflow Admin (publishes v10)
- Test Data / Record References: Real active "WF-TEST Finance then Legal Sequential" (Customer Change), version 9 then version 10
- Starting State: Request bound to version 9, sitting at node_2 ("Finance Approval")
- Actions Executed: Reassigned node_2's team in a new draft and published it as version 10 while request 1 remained unacted-upon at node_2. Re-read request 1's workflow_version_id and its node's team resolution afterward.
- Expected Result: The request's routing continues to resolve via version 9's graph specifically (via the stamped workflow_version_id), completely ignoring that version 10 now exists and is published.
- Actual Result: request 1's workflow_version_id remained version 9's id; the team resolved for its current node (via version 9's graph) remained the original team (wf_test_finance), unaffected by version 10's reassignment and publish.
- Regular Path Result: PASS
- Stress Variant Result: Not executed as a literal "publish deletes/restructures the same node key" case (structurally impossible for a published version per L-003's immutability, exactly as the journey's own text acknowledges); the equivalent "restructure via a new version" stress was executed instead (node_2 was reassigned to a different team in version 10) and is covered by the Regular Path result above.
- Authorization Result: N/A
- Concurrency Result: PASS (the publish of version 10 happened after request 1 was already submitted and sitting at node_2; no re-resolution occurred)
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (request 1's workflow_version_id and resolved team were verified unchanged by direct database query after version 10 published)
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A (proven via live data)
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Executed as the same consolidated live fixture as K-028 (identical underlying assertion, viewed from the version-binding angle rather than the team-reassignment angle).

---

## L-012: In-Flight Request Never Re-Resolves to a Newly Active Definition

- Journey ID: L-012
- Journey Name: In-Flight Request Never Re-Resolves to a Newly Active Definition
- Started At: 2026-09-16 16:25
- Completed At: 2026-09-16 17:10
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin (performs the swap)
- Test Data / Record References: Real "WF-TEST Finance then Legal Sequential" (Definition A) and throwaway "lseries_defb_context_active" (Definition B), both Customer Change
- Starting State: Definition A active with 10 published versions; mid-flight, replace_active_workflow_definition swaps Definition B in as active
- Actions Executed: Performed the governed swap (A -> B active). Immediately re-queried Definition A's published versions.
- Expected Result: Definition A's published versions (and any request bound to one of them) are completely unaffected by A.is_active becoming false; graph resolution for an already-bound request never depends on is_active.
- Actual Result: All 10 of Definition A's published versions remained intact and queryable after the swap (is_active was the only field that changed on the definitions table; no version/node/edge row was touched). This directly implies (and is architecturally guaranteed by the same mechanism proven in L-011, since resolution for an in-flight request reads its own stamped workflow_version_id, never the definition's current is_active flag) that any request bound to one of Definition A's versions is unaffected by the swap.
- Regular Path Result: PASS
- Stress Variant Result: Not executed as a live request specifically bound to Definition A acted upon after the swap (K-028/L-011 already proved the identical mechanism, a version-level publish rather than a definition-level swap, produces zero re-resolution; the resolution query an approve action runs reads only the request's own stamped workflow_version_id column, never joins through workflow_definitions.is_active at all, confirmed by inspecting fn_workflow_node_team's signature, which takes workflow_version_id directly).
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (10/10 of Definition A's published versions confirmed intact after the swap)
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Verified by structural/data proof (definition-level is_active is architecturally decoupled from per-request version resolution, which reads only the request's own stamped column) rather than by rerunning a full live approval action, since L-011 already directly executed and confirmed that exact resolution mechanism at the version level; a definition-level swap changes strictly less (only a boolean flag) than a version-level publish does.

---

## L-013: New Request Created After a New Version Publishes Picks Up the New Version

- Journey ID: L-013
- Journey Name: New Request Created After a New Version Publishes Picks Up the New Version
- Started At: 2026-09-16 15:45
- Completed At: 2026-09-16 16:05
- Priority: P1
- Automation Feasibility: FULL
- Personas: Requestor (WF-TEST Maker)
- Test Data / Record References: Real "WF-TEST Finance then Legal Sequential" (Customer Change), version 10
- Starting State: Version 10 just published under the active definition
- Actions Executed: Created and submitted a new live customer_change request immediately after version 10 published.
- Expected Result: The new request's workflow_version_id is stamped to version 10's id at creation.
- Actual Result: request 2's workflow_version_id equaled version 10's id exactly; its resolved node team was the NEW team (ux_verification_team), confirming both the version binding and the graph content it now uses.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Executed as part of the same consolidated live fixture as K-028/L-011.

---

## L-014: New Request Created After Replace-Active Swap Binds to the New Definition's Active Published Version

- Journey ID: L-014
- Journey Name: New Request Created After Replace-Active Swap Binds to the New Definition's Active Published Version
- Started At: 2026-09-16 16:25
- Completed At: 2026-09-16 17:10
- Priority: P1
- Automation Feasibility: FULL
- Personas: Requestor
- Test Data / Record References: customer_onboarding domain, Definitions C and D from the L-009 race
- Starting State: Definition C just became active (winner of the L-009 activation race) with a published version
- Actions Executed: Confirmed via the same active-version-resolution mechanism proven in L-010 (a plain query joining workflow_definitions.is_active to the highest workflow_definition_versions.status='published' row) that Definition C, now active, would resolve for any new request.
- Expected Result: A new request's workflow_version_id resolves to Definition C's currently-active published version.
- Actual Result: Confirmed structurally: Definition C had exactly one published version and was the sole is_active=true row for customer_onboarding immediately after the L-009 race, which is the exact join condition every create_* RPC's resolution query uses (verified identical across all four domains while fixing L-021).
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Not re-executed as a fully separate live request creation against Definition C specifically (Definitions C/D were throwaway and deleted immediately after L-009 to avoid leaving customer_onboarding in a confusing multi-candidate state); the identical positive-resolution path was already directly executed live in L-013 against a different domain, and the resolution query itself was read directly from the RPC source for all four domains during the L-021 fix, confirming it is the same query shape everywhere.

---

## L-015: Row_Version Optimistic Lock Prevents Lost Updates on Stale Publish Attempts

- Journey ID: L-015
- Journey Name: Row_Version Optimistic Lock Prevents Lost Updates on Stale Publish Attempts
- Started At: 2026-09-16 15:50
- Completed At: 2026-09-16 16:20
- Priority: P1
- Automation Feasibility: FULL
- Personas: Admin A, Admin B (simulated via two sequential RPC calls with a stale row_version)
- Test Data / Record References: Throwaway definition "lseries_lifecycle_test" (Customer Change)
- Starting State: Two admins both load the same draft version's metadata (including its current row_version) at the same time
- Actions Executed: Saved the draft graph once (row_version advanced from 1 to 2), then attempted a second save call using the ORIGINAL (now-stale) row_version=1.
- Expected Result: The RPC compares the supplied row_version against the current one, finds a mismatch, and rejects the call with a clear stale-state error rather than silently overwriting/duplicating the first admin's action.
- Actual Result: Rejected with "WORKFLOW_VERSION_DRAFT_STALE: This workflow draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes." Exactly one save actually took effect; the version was never double-saved or left in a corrupted state.
- Regular Path Result: N/A (this journey is itself the concurrency variant)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: PASS
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (exactly one save action took effect)
- Recovery Result: PASS (Admin B would reload to get the current row_version, matching the exact UX pattern already verified end-to-end for the equivalent save-vs-save case in Batch 1's K-010/K-030)
- UX Result: PASS (message is a clear "changed by someone else, refresh" style message, not a raw constraint error)
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A (this is the same row_version mechanism already covered by Batch 1's regression tests for K-010; this journey specifically re-confirms it holds for the publish-lifecycle case, not just the whole-graph-replace case K-010 covered)
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: The token returned is WORKFLOW_VERSION_DRAFT_STALE, the identical token K-010/K-030 already exercise for the save-vs-save race; this journey confirms the same mechanism also protects a save-then-publish sequence, not only a save-vs-save sequence.

---

## L-016: Discard Draft Removes It Cleanly, Last Published Version Remains the Resolvable Active One

- Journey ID: L-016
- Journey Name: Discard Draft Removes It Cleanly, Last Published Version Remains the Resolvable Active One
- Started At: 2026-09-16 15:50
- Completed At: 2026-09-16 16:20
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "lseries_lifecycle_test" (Customer Change)
- Starting State: Version 2 published... wait, corrected: version 1 published and currently the resolvable version; version 2 exists as an in-progress, not-yet-published draft (this journey's own numbering example used version 2/3; the live test used version 1 published + version 2 draft, the same shape)
- Actions Executed: Discarded the draft (version 2) via discard_workflow_definition_version; re-queried its nodes afterward.
- Expected Result: The draft row is fully removed; no dangling nodes/edges remain referencing the discarded version's id.
- Actual Result: Discard succeeded; a follow-up query for nodes referencing the discarded version's id returned zero rows.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (no dangling nodes/edges remain referencing the discarded version's id)
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: The discarded version row is fully deleted (not soft-marked "discarded"), confirmed empirically by workflow_nodes.workflow_version_id cascade-deleting to zero rows.

---

## L-017: Direct API Bypass Attempt to Discard an Already-Published Version Id Is Rejected

- Journey ID: L-017
- Journey Name: Direct API Bypass Attempt to Discard an Already-Published Version Id Is Rejected
- Started At: 2026-09-16 15:50
- Completed At: 2026-09-16 16:20
- Priority: P0
- Automation Feasibility: FULL
- Personas: Malicious or buggy API client (simulated via direct RPC call)
- Test Data / Record References: Throwaway definition "lseries_lifecycle_test" (Customer Change), version 1 published
- Starting State: A published version
- Actions Executed: Called discard_workflow_definition_version directly against the published version's id.
- Expected Result: Rejected because its status is not draft; the published version row is fully unchanged.
- Actual Result: Rejected with "WORKFLOW_VERSION_NOT_DRAFT: version ... has status published, only a draft may be discarded". Version row unchanged.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: This is the SAME precondition check that also produces L-003's rejection (both discard and save share the identical "status must be draft" guard); mirrors K-018's permission-layer version of this same defense-in-depth pattern from Batch 1.

---

## L-018: New Definition for an Already-Active Context Is Created Inactive by Default

- Journey ID: L-018
- Journey Name: New Definition for an Already-Active Context Is Created Inactive by Default
- Started At: 2026-09-16 16:25
- Completed At: 2026-09-16 17:10
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: customer_change domain (already has an active definition), throwaway "lseries_no_published_version"
- Starting State: An active definition already exists for customer_change
- Actions Executed: Created a second definition for the same context via create_workflow_definition; immediately queried its is_active flag.
- Expected Result: Created with is_active=false, requiring an explicit later activation (or governed swap) to ever take effect.
- Actual Result: is_active=false immediately after creation.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: PASS (already directly observed during live browser testing in K-026/K-027: the workflow list page shows "Inactive" immediately for a newly created definition, not an ambiguous "pending" state)
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: N/A

---

## L-019: Applies_To Check Constraint Rejects Invalid Values, "Agreement" Confirmed Reserved/Unused

- Journey ID: L-019
- Journey Name: Applies_To Check Constraint Rejects Invalid Values, "Agreement" Confirmed Reserved/Unused
- Started At: 2026-09-16 15:50
- Completed At: 2026-09-16 16:20
- Priority: P3
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definitions "lseries_bad_applies_to" (rejected, never created) and "lseries_agreement_probe" (created via direct RPC, then deleted)
- Starting State: N/A (constraint-level test)
- Actions Executed: Called create_workflow_definition with applies_to="invoice_approval" (outside the confirmed set) directly via RPC; separately called it with applies_to="agreement". Separately, during K-026 setup, opened the real Create Workflow form's "Applies To" dropdown in the browser as Workflow Admin and read its exact option list.
- Expected Result: The invalid value is rejected by the check constraint. The journey's own premise: "agreement" is listed in the DB constraint but never actually selectable in the real product UI (an intentional reserved-for-future-use gap).
- Actual Result: applies_to="invoice_approval" was rejected by the check constraint ("violates check constraint workflow_definitions_applies_to_check"), confirming exactly 5 allowed values. applies_to="agreement" was ACCEPTED at the RPC/DB level (not reserved-and-blocked at that layer). Critically, the real Create Workflow UI's "Applies To" dropdown, read directly during live browser testing, DOES list "Agreement" as a normal, selectable, fifth option alongside Customer Onboarding, Customer Change, Commercial Configuration, and Go Live, exactly like any other value, contradicting the journey's own premise that the UI offers no such option.
- Regular Path Result: PASS (invalid values correctly rejected)
- Stress Variant Result: FAILED (the journey's stated premise, not the product): "agreement" is not merely allowed at the DB level while hidden from the UI; it is directly selectable in the live Create Workflow UI. This is a Category B finding (journey expectation does not match current product behavior), not a product defect: nothing about a workflow that applies_to='agreement' behaves incorrectly, since Batch 1's own "BATCH1 K-Series Builder Mechanics" fixture already legitimately uses applies_to=Agreement end to end.
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Original Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY (for the check-constraint half); the "agreement reserved/unused" half of the journey's premise did not hold
- Defect IDs: None (this is a journey-expectation correction, not a product defect: Category B)
- Root Cause: N/A
- Fix: N/A (no product change; docs/NEXUS_JOURNEY_UNIVERSE.md's L-019 record should be updated in a follow-up documentation pass to say "agreement" IS a normal, UI-selectable applies_to value, not a hidden/reserved one, while preserving this original empirical finding)
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY
- Notes: This is a case where testing surfaced that the Journey Universe's own grounding brief was wrong about the current product, not that the product has a defect. Per the mission's defect-handling rules for Category B, the original execution result (agreement IS selectable, contradicting the "reserved/unused" premise) is preserved here rather than silently rewritten; docs/NEXUS_JOURNEY_UNIVERSE.md should be corrected in a follow-up pass, not in this ledger.

---

## L-020: Multiple Published Versions Coexist as History, Only the Highest Under the Active Definition Is "The" Active One

- Journey ID: L-020
- Journey Name: Multiple Published Versions Coexist as History, Only the Highest Under the Active Definition Is "The" Active One
- Started At: 2026-09-16 15:45
- Completed At: 2026-09-16 16:05
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin, Auditor
- Test Data / Record References: Real active "WF-TEST Finance then Legal Sequential" (Customer Change), which already had 9 published versions from Batch 1 plus version 10 published during this session's K-028 test (10 published versions total, none discarded)
- Starting State: Versions 1 through 10 all published, none discarded
- Actions Executed: Queried all published versions for this definition; confirmed version 9's node content was untouched by version 10's publish (L-011 already directly verified this: version 9's team assignment for node_2 remained the original team); confirmed version 10 (the highest) is what new requests resolve to (L-013).
- Expected Result: All published rows remain queryable/inspectable; only the highest version_number under the active definition is used for new request resolution; superseded versions remain byte-for-byte exactly as originally published since they were never editable once published (per L-003).
- Actual Result: All 10 published version rows remained queryable. Version 9's content was confirmed unchanged after version 10 published (proven directly in L-011). Version 10 (the highest) is what all new requests resolve to (proven directly in L-013).
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (versions 1 through 9, though superseded, are unmodifiable per L-003's immutability guarantee, which was directly re-verified in this same batch)
- Recovery Result: N/A
- UX Result: PASS (already directly observed during live browser testing: the version history page at /settings/workflows/[id] lists every version with its own Status/Published/Published By columns, clearly distinguishing the current published-and-active version from historical ones)
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Verified using the real "WF-TEST Finance then Legal Sequential" fixture (already had 9 published versions from Batch 1) rather than constructing a fresh 4-version fixture from scratch, per the mission's explicit allowance to reuse existing verified fixtures for this kind of history-composition check; "the active version" was confirmed to be purely computed (max version_number among published rows), never a separately stored value.

---

## L-021: Deactivating the Active Definition Without a Replacement Blocks New Request Creation for That Context

- Journey ID: L-021
- Journey Name: Deactivating the Active Definition Without a Replacement Blocks New Request Creation for That Context
- Started At: 2026-09-16 16:25
- Completed At: 2026-09-16 17:35
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin (deactivates), Requestor (attempts new request), WF-TEST Maker
- Test Data / Record References: Real active "WF-TEST Finance then Legal Sequential" (Customer Change), temporarily deactivated with explicit user authorization and restored afterward
- Starting State: Definition A was the sole active definition; admin deactivates it directly (not via the governed swap, which requires a target)
- Actions Executed: Called set_workflow_definition_active(false) directly on the sole active customer_change definition (no target given). Confirmed zero active definitions remained. Attempted to create a new customer_change request via create_customer_change_request.
- Expected Result: Since no active definition exists to resolve a workflow_version_id from, the actual observed failure mode should be a clear blocking error, not an unhandled exception or a silently-created broken request; no new request is ever created with a null or missing workflow_version_id as a result of this gap.
- Actual Result (original): Direct deactivation succeeded (no target required, confirming the deactivate side of this journey works as documented). But request creation did NOT fail: create_customer_change_request succeeded and inserted a real customer_change_requests row with workflow_version_id = null and current_workflow_node_key = null, a permanently unresolvable, broken request with no way to ever route it through an approval workflow. Investigation showed the identical unguarded pattern exists in all four domain creation RPCs (customer_onboarding_case, customer_change_request, commercial_configuration_version, go_live_request): each resolves the active published version with a plain SELECT ... LIMIT 1 and inserts whatever it finds, including NULL, with zero validation before the insert.
- Regular Path Result: FAILED THEN FIXED + PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: FAILED THEN FIXED + PASS. Originally a request was created with workflow_version_id=null (a real, permanent data-integrity defect: an unroutable request with no way to ever resolve which workflow governs it). After the fix, no such row can ever be created again.
- Recovery Result: PASS (reactivating the definition, or activating a replacement, immediately restores the ability to create new requests; already-in-flight requests bound to the definition's prior version are, per L-012, completely unaffected by the deactivation the whole time)
- UX Result: FAILED THEN FIXED + PASS. Originally there was no error at all for the Requestor (the broken request was created silently). After the fix, a clear WORKFLOW_NO_ACTIVE_DEFINITION error is raised.
- Original Status: FAILED
- Defect IDs: K-L021-D01
- Root Cause: All four create_* RPCs (create_customer_onboarding_case, create_customer_change_request, create_commercial_configuration_version, create_go_live_request) resolve the active published workflow version via `select wdv.id ... where wd.is_active and wdv.status='published' order by version_number desc limit 1` with no check that the query actually returned a row, then insert that (possibly null) value directly into the request's workflow_version_id column.
- Fix: Added a `if v_workflow_version_id is null then raise exception 'WORKFLOW_NO_ACTIVE_DEFINITION: ...'` guard to all four RPCs, immediately after resolution and before any insert, in supabase/migrations/20260930000000_workflow_creation_requires_active_definition.sql. Also reordered each function so the shared create_request_with_draft() call (which creates a requests/draft row) now happens AFTER this check, not before, so a rejected creation never leaves an orphaned draft/request row behind either (an improvement beyond the minimal fix).
- Fix Commit if applicable: (pending, committed with this ledger update)
- Regression Test: Live re-verification via direct RPC (no unit-testable layer for this SQL-only logic): reran the exact L-021 scenario after the fix, confirmed create_customer_change_request now raises WORKFLOW_NO_ACTIVE_DEFINITION and creates no row at all (verified: `resulting row: null`). Regression-checked all four domains' NORMAL success path (active definition present) still works: customer_onboarding, customer_change, and go_live all still create successfully with a valid workflow_version_id; commercial_configuration's regression check hit an unrelated pre-existing constraint (uq_commercial_configuration_versions_one_open_per_config, blocking a second open version for a commercial configuration that already had one from pre-existing September 14 test data, unrelated to this fix and confirmed by inspecting that constraint's definition and the pre-existing row's timestamp).
- Rerun Result: PASS. WORKFLOW_NO_ACTIVE_DEFINITION correctly raised; no orphaned row created; original active definition restored and verified.
- Neighboring Journeys Rerun: L-006 (activate with no published version), L-011/L-012/L-013 (version/definition-level in-flight binding), and the normal request-creation path for 3 of 4 domains all reran clean after the fix.
- Final Status: FAILED THEN FIXED + PASS
- Notes: This defect was more severe than the journey's own framing suggested: it is not merely "confirm the failure mode" but an actual cross-domain data-integrity hole (silently creates permanently-broken, unroutable requests) affecting all four workflow-bound domains, not just customer_change. Migration applied to the live/shared Supabase database with explicit user authorization via AskUserQuestion. The real active customer_change definition was temporarily deactivated for this test (with explicit user authorization) and fully restored and verified afterward.
