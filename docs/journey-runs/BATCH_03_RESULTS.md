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
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: A draft about to be published by a specific admin at a specific time
- Actions Executed: TBD
- Expected Result: Publish action stamps published_at=now(), published_by=the acting admin's id; these values are read back identically at any later point, including after deactivation/supersession
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
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

## L-023: Publish-Time Server-Side Re-Validation Blocks a Structurally Invalid Graph Even Though Draft Save Allowed It

- Journey ID: L-023
- Journey Name: Publish-Time Server-Side Re-Validation Blocks a Structurally Invalid Graph Even Though Draft Save Allowed It
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: Draft saved successfully with a structurally invalid Decision node (only 1 branch)
- Actions Executed: TBD
- Expected Result: Publish-time server-side validation independently re-checks decision-node rules (min 2 branches, max 1 fallback, valid operators) and rejects publish with a clear structural error for each of the 3 sub-cases
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD
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

## L-024: Timeline for a Request Preserves Version-1 Graph Structure Even After Versions 2 and 3 Publish

- Journey ID: L-024
- Journey Name: Timeline for a Request Preserves Version-1 Graph Structure Even After Versions 2 and 3 Publish
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Auditor, any user viewing this request's Timeline today
- Test Data / Record References: TBD
- Starting State: Request fully approved through End under version 1's graph, long before versions 2/3 existed
- Actions Executed: TBD
- Expected Result: Opening this old request's Timeline shows exactly version 1's node keys/labels/structure, regardless of versions 2/3 redefining the same node keys differently
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: TBD
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

## L-025: Two Different Applies_To Contexts Can Each Be Independently Active Simultaneously

- Journey ID: L-025
- Journey Name: Two Different Applies_To Contexts Can Each Be Independently Active Simultaneously
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: Both customer_onboarding and go_live contexts independently set up and activated
- Actions Executed: TBD
- Expected Result: Both definitions coexist with is_active=true simultaneously with no conflict, since the partial unique index is scoped per applies_to value
- Actual Result: TBD
- Regular Path Result: TBD
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
- Notes: TBD

---

## L-026: Publishing a Draft With No Start or No End Node Is Rejected

- Journey ID: L-026
- Journey Name: Publishing a Draft With No Start or No End Node Is Rejected
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: TBD
- Starting State: Draft saved missing an End node (sub-case: missing Start node; sub-case: zero nodes at all)
- Actions Executed: TBD
- Expected Result: Publish-time validation rejects the draft for lacking a required Start or End node; no published version ever lacks either
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD
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
- Notes: The exact enforced minimum should be empirically confirmed against actual publish-time validation code, per the journey's own notes.

---

## L-027: Reactivating a Previously-Deactivated Definition Does Not Misattribute Stale In-Flight Requests

- Journey ID: L-027
- Journey Name: Reactivating a Previously-Deactivated Definition Does Not Misattribute Stale In-Flight Requests
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin, Requestor/Approver holding an in-flight request
- Test Data / Record References: TBD
- Starting State: Definition A active with in-flight requests bound to version 2; admin deactivates A, then later reactivates A
- Actions Executed: TBD
- Expected Result: Throughout the deactivate/reactivate cycle, the in-flight request's workflow_version_id remains version 2's id unchanged. Stress: a new version 3 published while A is deactivated; upon reactivation, new requests resolve to version 3 while the in-flight request remains on version 2
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD
- Authorization Result: N/A
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

## L-028: Historical Regression Class, Any Future Optional-Parameter Addition to a Versioning RPC Must Not Reintroduce Ambiguous Overloads

- Journey ID: L-028
- Journey Name: Historical Regression Class, Any Future Optional-Parameter Addition to a Versioning RPC Must Not Reintroduce Ambiguous Overloads
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: Backend/DB migration author (regression-prevention persona)
- Test Data / Record References: TBD
- Starting State: Current, correct schema state (single overload per function)
- Actions Executed: TBD
- Expected Result: Exactly one overload exists per versioning-lifecycle RPC name (create version, publish version, discard version, activate/deactivate, replace_active_workflow_definition) today
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: TBD
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
- Notes: Generalizes J-020's confirmed historical incident class (approve_* RPC overload ambiguity) to the versioning-lifecycle RPCs; does not assert the incident has occurred here.

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
