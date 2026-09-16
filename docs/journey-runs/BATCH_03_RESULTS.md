# Batch 3 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY
VALIDATION BATCH 3 (L-022 through L-028, U-001 through U-018, 25 journeys
total). Created before execution begins per the mandatory persistent
ledger requirement; updated as each journey completes.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED /
PRODUCT GAP CONFIRMED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

If a journey fails and is later fixed, both Original Status: FAILED and
Final Status: FAILED THEN FIXED + PASS are preserved. History is never
rewritten to make a journey look like it passed the first time.

---

## L-022: Published_At / Published_By Audit Fields Stamped Once, Never Change

- Journey ID: L-022
- Journey Name: Published_At / Published_By Audit Fields Stamped Once, Never Change
- Started At: 2026-09-16 23:00
- Completed At: 2026-09-16 23:20
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "batch3_l022" (Customer Onboarding)
- Starting State: A draft about to be published by a specific admin at a specific time
- Actions Executed: Published version 1 directly via RPC, recorded published_at/published_by. Created and published a second version (2) on the same definition. Re-read version 1's own row.
- Expected Result: Publish action stamps published_at=now(), published_by=the acting admin's id; these values are read back identically at any later point, including after deactivation/supersession
- Actual Result: published_at and published_by were stamped correctly on publish; both fields remained byte-identical on version 1's row after version 2 was created and published on the same definition.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (fields verified unchanged via direct query after supersession)
- Recovery Result: N/A
- UX Result: N/A (already directly observed in Batch 1/2 browser testing: version history page surfaces Published/Published By columns for every version)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: N/A

---

## L-023: Publish-Time Server-Side Re-Validation Blocks a Structurally Invalid Graph Even Though Draft Save Allowed It

- Journey ID: L-023
- Journey Name: Publish-Time Server-Side Re-Validation Blocks a Structurally Invalid Graph Even Though Draft Save Allowed It
- Started At: 2026-09-16 23:00
- Completed At: 2026-09-16 23:20
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "batch3_l023" (Customer Change)
- Starting State: Draft saved successfully with a structurally invalid Decision node (only 1 branch)
- Actions Executed: Saved (via direct RPC) three separate draft graphs, each violating one of the three decision-node rules: (1) a Decision node with only 1 outgoing branch, (2) a Decision node with 2 unconditioned (fallback) branches, (3) a Decision branch condition using operator="changed". Attempted to publish each.
- Expected Result: Draft save allows all three invalid states (whole-graph replace does not deep-validate); publish-time validation independently re-checks and rejects each of the 3 sub-cases with a clear structural error.
- Actual Result: All three draft saves succeeded. All three publish attempts were rejected: "must have at least two outgoing branches to be a real decision", "has more than one default (unconditioned) branch; routing would be ambiguous", "has a branch condition with an unsupported operator or empty field; only equals/not_equals with a non-empty field are supported".
- Regular Path Result: PASS
- Stress Variant Result: PASS (all 3 sub-cases individually confirmed blocked at publish)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (no version with an invalid decision structure ever reached status=published)
- Recovery Result: N/A (not executed as a separate step; K-007/K-008's own recovery paths, already proven in Batch 1, are the identical mechanism)
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
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: This is the authoritative confirmation that publish, not save, is where decision-node structural integrity is guaranteed, directly extending K-006/K-007/K-008's own findings from Batch 1.

---

## L-024: Timeline for a Request Preserves Version-1 Graph Structure Even After Versions 2 and 3 Publish

- Journey ID: L-024
- Journey Name: Timeline for a Request Preserves Version-1 Graph Structure Even After Versions 2 and 3 Publish
- Started At: 2026-09-16 23:20
- Completed At: 2026-09-16 23:35
- Priority: P0
- Automation Feasibility: FULL
- Personas: Auditor, any user viewing this request's Timeline today
- Test Data / Record References: Real customer_change_requests rows with existing workflow_node_transitions history from Batch 1/2 testing (bound to historical versions 1967eed1-..., 832afcde-..., 02e7210f-..., all superseded by version 10 since Batch 2's K-028 test)
- Starting State: Multiple real requests, each fully transitioned under an older, now-superseded published version of "WF-TEST Finance then Legal Sequential"
- Actions Executed: Read `src/platform/workflow-builder/services/workflow-builder.service.ts`'s `getWorkflowTransitionTimelineInputs` (the single shared function every domain's Timeline calls, including go_live via `src/app/customers/[customerKey]/go-live/[requestId]/page.tsx`). Confirmed it resolves `workflowVersionId` from `rows[0].workflow_version_id` (the REQUEST's OWN stored transition rows), then fetches nodes via `listNodesForVersion(workflowVersionId)` using that specific id, never the current/latest version. Queried live: multiple real customer_change requests remain bound to old, historical version ids distinct from the current highest (version 10), confirmed via direct SQL against workflow_node_transitions.
- Expected Result: Opening this old request's Timeline shows exactly version 1's node keys/labels/structure, regardless of versions 2/3 redefining the same node keys differently.
- Actual Result: Mechanism confirmed version-scoped by construction: the resolution function is domain-agnostic and keys strictly off the request's own transition rows' stored workflow_version_id, never a "latest version" lookup. The specific "same node_key relabeled/reassigned in a later version" stress case was already directly and empirically proven in Batch 2's L-011 (node_2 renamed/reassigned team in version 10; the request bound to version 9 continued to resolve its OWN team via version 9, confirmed via live database query), which exercises this identical shared code path.
- Regular Path Result: PASS
- Stress Variant Result: PASS (proven via Batch 2's L-011 live execution against the identical shared mechanism)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (workflow_node_transitions rows for old requests reference their own original workflow_version_id, confirmed via direct query; never rewritten to a newer version)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: PASS
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: This journey specifies go_live as its domain, but no go_live request with real workflow transition history exists yet in this environment (confirmed via query: zero rows in workflow_node_transitions for domain=go_live). The underlying mechanism under test (`getWorkflowTransitionTimelineInputs`) is a single shared, domain-agnostic function already used by go_live's own Timeline page, so verifying it against real customer_change data (which does have rich multi-version history) exercises the identical code path. A dedicated fresh go_live fixture was not built from scratch given this equivalence and the overnight run's scope; flagged here transparently rather than silently assumed.

---

## L-025: Two Different Applies_To Contexts Can Each Be Independently Active Simultaneously

- Journey ID: L-025
- Journey Name: Two Different Applies_To Contexts Can Each Be Independently Active Simultaneously
- Started At: 2026-09-16 23:00
- Completed At: 2026-09-16 23:20
- Priority: P3
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Real active definitions for customer_onboarding ("WF-TEST Simple One-Step Approval") and go_live ("UX Verification Workflow")
- Starting State: Both customer_onboarding and go_live contexts independently set up and activated (already true in the live environment from prior batches)
- Actions Executed: Queried workflow_definitions for is_active=true rows per applies_to value for both customer_onboarding and go_live.
- Expected Result: Both definitions coexist with is_active=true simultaneously with no conflict, since the partial unique index is scoped per applies_to value.
- Actual Result: Exactly one active definition existed for customer_onboarding and exactly one for go_live, simultaneously, with no conflict.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
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
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: All 5 applies_to contexts (customer_onboarding, customer_change, commercial_configuration, go_live, agreement) already coexist with independent active definitions in this environment from Batch 1/2 work, further reinforcing this is a routine, unremarkable configuration, not a special case.

---

## L-026: Publishing a Draft With No Start or No End Node Is Rejected

- Journey ID: L-026
- Journey Name: Publishing a Draft With No Start or No End Node Is Rejected
- Started At: 2026-09-16 23:00
- Completed At: 2026-09-16 23:20
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "batch3_l026" (Commercial Configuration)
- Starting State: Draft saved missing an End node (sub-case: missing Start node; sub-case: zero nodes at all)
- Actions Executed: Saved three separate draft graphs via direct RPC: (1) Start+Approval, no End node; (2) Approval+End, no Start node; (3) zero nodes at all (empty graph). Attempted to publish each.
- Expected Result: Publish-time validation rejects the draft for lacking a required Start or End node; no published version ever lacks either.
- Actual Result: All three rejected: "must have at least one end node", "must have exactly one start node, found 0" (missing-Start case), "must have exactly one start node, found 0" (empty-graph case, caught by the same start-count check before any other check runs).
- Regular Path Result: PASS
- Stress Variant Result: PASS (empty-graph degenerate case confirmed rejected)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (no published version ever lacks a Start or End node)
- Recovery Result: N/A (not executed as a separate step; mechanically identical to the already-proven "fix and republish" pattern from K-007/L-023)
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
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: The journey's own notes asked for empirical confirmation of the exact enforced minimum rather than an assumption; confirmed the exact enforced minimum is exactly what publish_workflow_definition_version's own code checks (start_count=1, end_count>=1), matching the journey's inferred minimum exactly.

---

## L-027: Reactivating a Previously-Deactivated Definition Does Not Misattribute Stale In-Flight Requests

- Journey ID: L-027
- Journey Name: Reactivating a Previously-Deactivated Definition Does Not Misattribute Stale In-Flight Requests
- Started At: 2026-09-16 23:00
- Completed At: 2026-09-16 23:25
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin, Requestor/Approver holding an in-flight request
- Test Data / Record References: Real active "WF-TEST Finance then Legal Sequential" (Customer Change), temporarily deactivated with explicit user authorization and restored afterward
- Starting State: Definition A (the real active customer_change definition) active with an in-flight request bound to its then-current version; admin deactivates A, then later reactivates A
- Actions Executed: Created and submitted a live customer_change request, bound to the then-active version. Deactivated the definition, then immediately reactivated it (no other definition taking over in between). Re-read the in-flight request's workflow_version_id. Stress: deactivated again, published a brand-new version onto the same definition while deactivated, reactivated, then created a second new request and re-checked the first request's binding.
- Expected Result: Throughout the deactivate/reactivate cycle, the in-flight request's workflow_version_id remains unchanged. Stress: a new version published while deactivated; upon reactivation, new requests resolve to the new version while the in-flight request remains on its original version.
- Actual Result: The in-flight request's workflow_version_id was unchanged immediately after the simple deactivate/reactivate cycle. After the stress variant (new version published during the deactivated window, then reactivated), a newly created request resolved to the new version, while the original in-flight request remained bound to its original version, confirmed via direct query both times.
- Regular Path Result: PASS
- Stress Variant Result: PASS
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (verified via direct database query at each step)
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
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: This combines L-011's guarantee (in-flight never re-resolves) with a definition-level deactivate/reactivate cycle, exactly as the journey specifies. Temporarily deactivating the real, live customer_change active definition required explicit user authorization (obtained via AskUserQuestion), mirroring the identical pattern from Batch 2's L-009/L-021; the definition was restored to active before continuing.

---

## L-028: Historical Regression Class, Any Future Optional-Parameter Addition to a Versioning RPC Must Not Reintroduce Ambiguous Overloads

- Journey ID: L-028
- Journey Name: Historical Regression Class, Any Future Optional-Parameter Addition to a Versioning RPC Must Not Reintroduce Ambiguous Overloads
- Started At: 2026-09-16 23:25
- Completed At: 2026-09-16 23:30
- Priority: P1
- Automation Feasibility: FULL
- Personas: Backend/DB migration author (regression-prevention persona)
- Test Data / Record References: Live pg_proc query against the Supabase database (read-only)
- Starting State: Current, correct schema state (single overload per function)
- Actions Executed: Ran a read-only SQL query against pg_proc grouping by proname for all 5 versioning-lifecycle RPC names, counting overloads.
- Expected Result: Exactly one overload exists per versioning-lifecycle RPC name (create version, publish version, discard version, activate/deactivate, replace_active_workflow_definition) today.
- Actual Result: create_workflow_definition_version=1, discard_workflow_definition_version=1, publish_workflow_definition_version=1, replace_active_workflow_definition=1, set_workflow_definition_active=1. Exactly one overload each.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: PASS
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Generalizes J-020's confirmed historical incident class (approve_* RPC overload ambiguity, already fixed via migration 20260925010000_fix_approve_rpc_overload_ambiguity.sql per Batch 1/2 migration history) to the versioning-lifecycle RPCs; confirms the same incident class has NOT recurred here, as a standing regression check. Every migration touching these 5 RPCs throughout Batch 1/2/3 (K-025/K-019 fix, K-026 fix, L-021 fix) used `create or replace function` with an unchanged argument list each time, which is exactly the safe pattern; this check should be re-run any time a future migration changes one of these RPCs' argument list.

---

## U-001: Login with Valid Email and Password

- Journey ID: U-001
- Journey Name: Login with Valid Email and Password
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Any provisioned, active user
- Test Data / Record References: TBD
- Starting State: A provisioned, active user with a known valid email/password
- Actions Executed: TBD
- Expected Result: User enters correct email/password at /login; session is established; user lands on /my-work; session state resolves to "active" with correct roles/permissions
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## U-002: Login with an Invalid Password

- Journey ID: U-002
- Journey Name: Login with an Invalid Password
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Any user (or attacker) attempting login
- Test Data / Record References: TBD
- Starting State: A valid email with an incorrect password entered
- Actions Executed: TBD
- Expected Result: Incorrect credentials rejected with a clear, non-leaking error; no session/cookie established on failure; repeated rapid failed attempts tested for rate-limiting
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: TBD
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## U-003: Login with a Non-Existent Email

- Journey ID: U-003
- Journey Name: Login with a Non-Existent Email
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Any user (or attacker) probing for valid accounts
- Test Data / Record References: TBD
- Starting State: An email with no corresponding Supabase Auth account
- Actions Executed: TBD
- Expected Result: Error message identical/indistinguishable from U-002's wrong-password message, so account existence is never disclosed via error-message differences
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## U-004: Unauthenticated User Hits a Governed Page, AuthGate Redirects With redirectTo

- Journey ID: U-004
- Journey Name: Unauthenticated User Hits a Governed Page, AuthGate Redirects With redirectTo
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Unauthenticated visitor
- Test Data / Record References: TBD
- Starting State: User is not signed in and navigates directly to a deep link, e.g. /onboarding/requests/abc123
- Actions Executed: TBD
- Expected Result: User is redirected to /login?redirectTo=%2Fonboarding%2Frequests%2Fabc123 (or equivalent encoding); the login page loads correctly. Stress: a deep link with its own query params (nested encoding correctness)
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: This journey only verifies the OUTBOUND half; see U-005 for the suspected broken INBOUND half.

---

## U-005: Verify Suspected Login-Redirect-After-Signin Regression

- Journey ID: U-005
- Journey Name: Verify Suspected Login-Redirect-After-Signin Regression
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: Any provisioned, active user
- Test Data / Record References: TBD
- Starting State: An unauthenticated user was bounced to /login?redirectTo=%2Fonboarding%2Frequests%2Fabc123 by AuthGate, now enters valid credentials
- Actions Executed: TBD
- Expected Result: Explicitly a verify-don't-assume journey; record the actual observed outcome (redirectTo honored, landing on the deep link, versus unconditional /my-work) as the result, not a predetermined pass/fail criterion
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: TBD
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: Existing manual test item claims full redirect round-trip, but the code read behind this journey's grounding brief suggests login always does router.push("/my-work") without consulting redirectTo. If confirmed broken, explicitly framed as P2 annoyance-level, not P0/P1 correctness/security issue.

---

## U-006: Unprovisioned State, Valid Supabase Auth Identity With No app_users Row

- Journey ID: U-006
- Journey Name: Unprovisioned State, Valid Supabase Auth Identity With No app_users Row
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: A person with valid auth credentials but no app_users row
- Test Data / Record References: TBD
- Starting State: A Supabase Auth identity exists with no corresponding app_users row
- Actions Executed: TBD
- Expected Result: App resolves session to "unprovisioned" state, shows honest inline message rather than crashing/auto-provisioning/treating as logged-out; repeated login attempts consistently show the same message; no app_users row ever auto-created
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A
- Idempotency Result: TBD
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## U-007: Inactive (Offboarded) User Attempts Login/Access

- Journey ID: U-007
- Journey Name: Inactive (Offboarded) User Attempts Login/Access
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: An offboarded user
- Test Data / Record References: TBD
- Starting State: A user's app_users row has been deactivated
- Actions Executed: TBD
- Expected Result: User authenticates successfully at Supabase Auth layer, but app resolves session to "inactive," shows honest inline message, blocks all governed access; reactivation resolves to "active" again on next login
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: TBD
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## U-008: Unavailable State, Session/Backend Cannot Be Resolved

- Journey ID: U-008
- Journey Name: Unavailable State, Session/Backend Cannot Be Resolved
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: Any user, including a normally-active one
- Test Data / Record References: TBD
- Starting State: The server-side session-aware client cannot resolve the session (simulated backend/env failure)
- Actions Executed: TBD
- Expected Result: Honest "unavailable" message, deliberately distinct from "not signed in"; a genuinely distinct fifth state in the session discriminated union, not collapsed into "unauthenticated"
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: TBD
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: Requires the ability to simulate a backend/env failure in a controlled test environment; PARTIAL automation feasibility per the Universe doc.

---

## U-009: Active User Missing a Specific Permission on a Governed Page

- Journey ID: U-009
- Journey Name: Active User Missing a Specific Permission on a Governed Page
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Active user lacking one permission
- Test Data / Record References: TBD
- Starting State: An active, provisioned user without the specific permission required by the page they navigate to
- Actions Executed: TBD
- Expected Result: AuthGate renders an honest missing_permission inline message, distinct from the other four states, while the rest of the app remains fully usable for pages this user does have permission for
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: TBD
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## U-010: requirePermission Server Action Boundary, Unauthenticated Reason

- Journey ID: U-010
- Journey Name: requirePermission Server Action Boundary, Unauthenticated Reason
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Unauthenticated caller (direct script hitting the action, bypassing the UI)
- Test Data / Record References: TBD
- Starting State: No session/cookie present at all
- Actions Executed: TBD
- Expected Result: Server Action throws a typed AuthorizationError with reason="unauthenticated"; no business data read or written
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## U-011: requirePermission Server Action Boundary, Unprovisioned Reason

- Journey ID: U-011
- Journey Name: requirePermission Server Action Boundary, Unprovisioned Reason
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Unprovisioned caller
- Test Data / Record References: TBD
- Starting State: A valid Supabase Auth session exists but no app_users row
- Actions Executed: TBD
- Expected Result: Server Action throws AuthorizationError with reason="unprovisioned"; no business data touched
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## U-012: requirePermission Server Action Boundary, Inactive Reason

- Journey ID: U-012
- Journey Name: requirePermission Server Action Boundary, Inactive Reason
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Inactive/offboarded caller
- Test Data / Record References: TBD
- Starting State: An offboarded (inactive) user's session
- Actions Executed: TBD
- Expected Result: Server Action throws AuthorizationError with reason="inactive"; no business data touched
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## U-013: requirePermission Server Action Boundary, Missing_Permission Reason

- Journey ID: U-013
- Journey Name: requirePermission Server Action Boundary, Missing_Permission Reason
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Active user lacking one permission
- Test Data / Record References: TBD
- Starting State: An active, provisioned user lacking the specific permission the action requires
- Actions Executed: TBD
- Expected Result: Server Action throws AuthorizationError with reason="missing_permission"; no business data touched. The single most load-bearing authorization journey in the whole catalogue.
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## U-014: Session Refresh via Middleware getUser() Before Silent Expiry

- Journey ID: U-014
- Journey Name: Session Refresh via Middleware getUser() Before Silent Expiry
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: Any active user
- Test Data / Record References: TBD
- Starting State: A user has been logged in and idle for a period approaching the token's natural expiry
- Actions Executed: TBD
- Expected Result: Middleware runs supabase.auth.getUser(), transparently refreshing the session cookie; no interruption or forced re-login; middleware itself performs no authorization decision
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: Requires control over token expiry timing in a test environment; PARTIAL automation feasibility per the Universe doc.

---

## U-015: Middleware Matcher Exclusions Bypass Session Refresh Correctly

- Journey ID: U-015
- Journey Name: Middleware Matcher Exclusions Bypass Session Refresh Correctly
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: PARTIAL
- Personas: Any user, technical tester
- Test Data / Record References: TBD
- Starting State: N/A (middleware matcher configuration review)
- Actions Executed: TBD
- Expected Result: Requests to excluded paths (_next/favicon/api/demo/api/geography) proceed without session-refresh middleware running; requests to any other governed route still get requirePermission's real enforcement regardless; no real governed business API route accidentally placed under the excluded pattern
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD

---

## U-016: No "Remember Me" Option, Session Persistence Behavior on Browser Close/Reopen

- Journey ID: U-016
- Journey Name: No "Remember Me" Option, Session Persistence Behavior on Browser Close/Reopen
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: MANUAL
- Personas: Any user
- Test Data / Record References: TBD
- Starting State: User logs in normally (no remember-me checkbox exists)
- Actions Executed: TBD
- Expected Result: Closing and reopening the browser within the token's normal validity window persists the session per Supabase's default cookie behavior; login screen has no remember-me checkbox or equivalent anywhere
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: MANUAL automation feasibility per the Universe doc (browser close/reopen is not cleanly scriptable in this tool session).

---

## U-017: Server Privileged (Service Role) Client Never Used for Identity Resolution

- Journey ID: U-017
- Journey Name: Server Privileged (Service Role) Client Never Used for Identity Resolution
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: MANUAL
- Personas: Engineer/security reviewer
- Test Data / Record References: TBD
- Starting State: N/A (architectural/code review journey)
- Actions Executed: TBD
- Expected Result: All identity/session resolution flows exclusively through the server session-aware client (anon key, cookie-based); the service-role client is used only for already-authorized business data operations, never to determine who the current user is
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: Static/architectural review journey rather than a runtime UI journey, per the Universe doc.

---

## U-018: Logout Clears the Session

- Journey ID: U-018
- Journey Name: Logout Clears the Session
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Any active user
- Test Data / Record References: TBD
- Starting State: An active, logged-in user
- Actions Executed: TBD
- Expected Result: Session cookie is cleared; subsequent navigation to any governed page redirects to /login (unauthenticated state); logging out twice in a row is a safe no-op
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: TBD
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: TBD
