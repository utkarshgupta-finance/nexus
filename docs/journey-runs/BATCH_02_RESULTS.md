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
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin, Requestor/Approver
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## K-029: Concurrent Discard Removes a Draft Graph an Editor Is Actively Editing

- Journey ID: K-029
- Journey Name: Concurrent Discard Removes a Draft Graph an Editor Is Actively Editing
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin A (editing), Workflow Admin B (discarding)
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: TBD
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD
- UX Result: TBD
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

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
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-002: Second Draft Creation Attempt Blocked While One Draft Already Exists

- Journey ID: L-002
- Journey Name: Second Draft Creation Attempt Blocked While One Draft Already Exists
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin (x2 for concurrency)
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
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-003: Published Version Is Immutable, Direct Edit Attempt Rejected

- Journey ID: L-003
- Journey Name: Published Version Is Immutable, Direct Edit Attempt Rejected
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-004: Editing Again After Publish Always Creates a Brand-New Draft Version

- Journey ID: L-004
- Journey Name: Editing Again After Publish Always Creates a Brand-New Draft Version
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-005: Version Numbering Increments Correctly Across Multiple Publish Cycles

- Journey ID: L-005
- Journey Name: Version Numbering Increments Correctly Across Multiple Publish Cycles
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-006: Activating a Definition With No Published Version Raises WORKFLOW_DEFINITION_NO_PUBLISHED_VERSION

- Journey ID: L-006
- Journey Name: Activating a Definition With No Published Version Raises WORKFLOW_DEFINITION_NO_PUBLISHED_VERSION
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: TBD
- UX Result: TBD
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-007: Activating a Second Definition for an Already-Active Context Raises WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE

- Journey ID: L-007
- Journey Name: Activating a Second Definition for an Already-Active Context Raises WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin (x2/x3 for concurrency)
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
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-008: Governed Replace-Active Swap Atomically Deactivates Old and Activates New

- Journey ID: L-008
- Journey Name: Governed Replace-Active Swap Atomically Deactivates Old and Activates New
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: TBD
- Idempotency Result: TBD
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-009: Partial Unique Index Holds Under Concurrent Activation Attempts Across Two Fresh Definitions

- Journey ID: L-009
- Journey Name: Partial Unique Index Holds Under Concurrent Activation Attempts Across Two Fresh Definitions
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Two Workflow Admins acting concurrently
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
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-010: Active Version Resolution Picks Highest Version_Number Among Published Versions Under the Active Definition

- Journey ID: L-010
- Journey Name: Active Version Resolution Picks Highest Version_Number Among Published Versions Under the Active Definition
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Requestor
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-011: In-Flight Request Never Re-Resolves to a Newly Published Version

- Journey ID: L-011
- Journey Name: In-Flight Request Never Re-Resolves to a Newly Published Version
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Requestor (created under v1), Workflow Admin (publishes v2 and v3), Approver
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
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-012: In-Flight Request Never Re-Resolves to a Newly Active Definition

- Journey ID: L-012
- Journey Name: In-Flight Request Never Re-Resolves to a Newly Active Definition
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Requestor (created under A), Workflow Admin (performs the swap), Approver
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-013: New Request Created After a New Version Publishes Picks Up the New Version

- Journey ID: L-013
- Journey Name: New Request Created After a New Version Publishes Picks Up the New Version
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Requestor
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-014: New Request Created After Replace-Active Swap Binds to the New Definition's Active Published Version

- Journey ID: L-014
- Journey Name: New Request Created After Replace-Active Swap Binds to the New Definition's Active Published Version
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Requestor
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-015: Row_Version Optimistic Lock Prevents Lost Updates on Stale Publish Attempts

- Journey ID: L-015
- Journey Name: Row_Version Optimistic Lock Prevents Lost Updates on Stale Publish Attempts
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Admin A, Admin B
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: TBD
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD
- UX Result: TBD
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-016: Discard Draft Removes It Cleanly, Last Published Version Remains the Resolvable Active One

- Journey ID: L-016
- Journey Name: Discard Draft Removes It Cleanly, Last Published Version Remains the Resolvable Active One
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-017: Direct API Bypass Attempt to Discard an Already-Published Version Id Is Rejected

- Journey ID: L-017
- Journey Name: Direct API Bypass Attempt to Discard an Already-Published Version Id Is Rejected
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Malicious or buggy API client
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-018: New Definition for an Already-Active Context Is Created Inactive by Default

- Journey ID: L-018
- Journey Name: New Definition for an Already-Active Context Is Created Inactive by Default
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: TBD
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-019: Applies_To Check Constraint Rejects Invalid Values, "Agreement" Confirmed Reserved/Unused

- Journey ID: L-019
- Journey Name: Applies_To Check Constraint Rejects Invalid Values, "Agreement" Confirmed Reserved/Unused
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-020: Multiple Published Versions Coexist as History, Only the Highest Under the Active Definition Is "The" Active One

- Journey ID: L-020
- Journey Name: Multiple Published Versions Coexist as History, Only the Highest Under the Active Definition Is "The" Active One
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin, Auditor
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## L-021: Deactivating the Active Definition Without a Replacement Blocks New Request Creation for That Context

- Journey ID: L-021
- Journey Name: Deactivating the Active Definition Without a Replacement Blocks New Request Creation for That Context
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin (deactivates), Requestor (attempts new request)
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD
- UX Result: TBD
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit if applicable: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD
