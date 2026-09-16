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
- Stress Variant Result: N/A
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

## K-027: Read-Only Permission Holder Can View but Never Mutate the Builder Canvas

- Journey ID: K-027
- Journey Name: Read-Only Permission Holder Can View but Never Mutate the Builder Canvas
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Read-only Workflow Viewer
- Test Data / Record References: TBD
- Starting State: TBD
- Actions Executed: TBD
- Expected Result: TBD
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
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
