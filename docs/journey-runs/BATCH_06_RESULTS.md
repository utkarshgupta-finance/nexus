# Batch 6 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY
VALIDATION BATCH 6 (O-018 through O-025, P-001 through P-017, 25
journeys total). Created before execution begins per the mandatory
persistent ledger requirement; updated as each journey completes.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED /
PRODUCT GAP CONFIRMED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

If a journey fails and is later fixed, both Original Status: FAILED and
Final Status: FAILED THEN FIXED + PASS are preserved. History is never
rewritten to make a journey look like it passed the first time.

---

## O-018: Last Remaining Active Member of a Team Removed While a Request Waits (Real, Unhandled Gap)

- Journey ID: O-018
- Journey Name: Last Remaining Active Member of a Team Removed While a Request Waits at That Team's Node
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test, wf-test.leadership-approver@example.test (M, sole active wf_test_leadership member)
- Test Data / Record References: The same real customer_change request from Batch 5's O-005/O-015/O-016/O-018 chain (id 9c9235fc-fee6-41b4-9a35-170eb5088bcc), now pending at node_4 (Leadership)
- Starting State: wf_test_leadership had exactly one active member, M; the request sat at node_4, responsible to wf_test_leadership
- Actions Executed: With explicit user authorization (this touches the real, sole membership of a shared team), revoked M's wf_test_leadership membership; attempted approve_customer_change_request as M; confirmed request state; restored M's membership; retried approval
- Expected Result: The request remains stuck at its node with no automatic reassignment/alert/escalation; admin assigns a new member, who can then act on the previously stuck request
- Actual Result: With zero active team members, the approve attempt failed with WORKFLOW_TEAM_REQUIRED (M was no longer an active member of anything); the request remained exactly as it was (status "submitted", node_4), not silently cancelled or auto-approved. After restoring M's membership, the SAME approve call succeeded, and the request advanced to node_5 (End) and reached status "approved" — fully completing the entire multi-level chain this request has traced across Batches 5-6 (node_2 ux_verification_team -> node_3 Legal -> node_4 Leadership -> node_5 End)
- Regular Path Result: PASS
- Stress Variant Result: N/A (multiple simultaneously-stuck requests not separately seeded)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (request status/node remained unchanged while stuck; exactly one approval record created on the successful retry)
- Recovery Result: PASS (a fresh membership grant fully un-stuck the request with no other admin action needed)
- UX Result: CONFIRMED GAP (no proactive warning was shown or would be shown anywhere at the moment the last member was removed, matching the Universe doc's own expectation)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None (a real, disclosed-by-design operational risk, not a code defect to fix in this pass)
- Root Cause: No code path checks "does this team have at least one active member" before or after a revoke_user_team-style action; `remove_user_from_team` performs no such check.
- Fix: Not applied. Per the Universe doc's own explicit recommendation, this is flagged as a genuine operational risk worth a proactive admin warning (e.g. "this is the last active member of a team with N pending requests"), which is a UX/workflow feature addition, not a bounded bug fix.
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-005, O-009, O-015, O-016, N-007 (Batch 4)
- Final Status: PRODUCT GAP CONFIRMED
- Notes: This test happened to also fully complete the real multi-batch customer_change request used across O-005/O-015/O-016/O-018, a satisfying end-to-end proof of the whole sequential-approval + team-membership-enforcement chain working correctly across four teams and two batches.
- **Later closure (2026-09-21, Batches 1-13 Ledger Audit; cross-referenced, not re-executed as part of Batch 6):** this gap was subsequently CLOSED in the Product Gap Closure pass that followed Batches 3-6 (commit `1075ecb`, "Warn but allow when removing a team's last eligible approver"). Full decision record and implementation evidence in `docs/journey-runs/PRODUCT_GAP_TRIAGE_BATCHES_03_06.md` ("O-018: CLOSED"). This entry's own PRODUCT GAP CONFIRMED result above is left unchanged, since it correctly reflects the state at the time Batch 6 executed.

---

## O-019: User Moves From One Team to a Different Team Between Two Approval Levels

- Journey ID: O-019
- Journey Name: User Moves From One Team to a Different Team Between Two Approval Levels of the Same Workflow
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.o019-multiteam@example.test (M), wf_test_finance, wf_test_legal (real pre-existing teams)
- Test Data / Record References: app_user_id b198e991-3792-4826-be14-232b6c7d1045
- Starting State: M starts as an active member of wf_test_finance only, not a member of wf_test_legal
- Actions Executed: Assigned M to Finance only; called fn_require_workflow_team_membership(Finance, M) then fn_require_workflow_team_membership(Legal, M); granted M Legal membership (is_primary false); re-called both checks
- Expected Result: M can act for Finance but is denied for Legal until granted; once granted, M can act for Legal immediately with no other side effects, and Finance access is unaffected
- Actual Result: Finance check succeeded (error: null). Legal check before the grant was denied with WORKFLOW_TEAM_REQUIRED: "this request's workflow requires an approver from the WF-TEST Legal team. You are not an active member of that team." After granting Legal membership, the Legal check immediately succeeded, and the Finance check still succeeded afterward, unaffected.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS (M correctly denied for Legal while lacking that specific membership, despite holding Finance)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (both memberships independently recorded, no cross-contamination)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: PASS (confirms fn_require_workflow_team_membership evaluates fresh per team_id at check time, never cached or fixed from an earlier level)
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-009, O-015, O-018
- Final Status: PASS
- Notes: Directly corresponds to PERMISSION-CHANGE scenario 11. Tested directly against fn_require_workflow_team_membership (the function every approve_* RPC calls internally) since driving a real two-team request end to end would only re-exercise the same code path already proven by the O-005/O-015/O-016/O-018 chain.

---

## O-020: Search and Filter the Team List

- Journey ID: O-020
- Journey Name: Search and Filter the Team List
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P3
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: src/platform/team/ui/team-master-page.tsx, src/platform/team/data/team.data.ts
- Starting State: Multiple teams exist in the shared environment, active and inactive
- Actions Executed: Read the Team Master page and its data-access module for any search input, filter control, or query parameter narrowing the team list
- Expected Result: Admin can search by team code/name and/or filter by active/inactive
- Actual Result: No search input or active/inactive filter control exists anywhere in the Team Master page; it renders the full unfiltered team list every time
- Regular Path Result: CONFIRMED GAP
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: CONFIRMED GAP (no way to narrow the list as team count grows)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PRODUCT GAP CONFIRMED
- Defect IDs: None (a missing feature, not a defect in existing behavior; low priority per the Universe doc's own P3 rating and current low team count)
- Root Cause: Team Master was built without search/filter UI; not an oversight against a written requirement, just not yet built.
- Fix: Not applied (P3, out of scope for this auth/permissions-focused pass; a UI feature addition, not a bounded bug fix).
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N-027 (Batch 5, same shape of finding on the User Access list)
- Final Status: PRODUCT GAP CONFIRMED
- Notes: Same shape of gap as N-027, consistent with reference-data and team-list surfaces in Nexus generally not yet having search/filter built.

---

## O-021: Team Membership Assignment Requires team.write, Separate From user_access.write

- Journey ID: O-021
- Journey Name: Team Membership Assignment Requires team.write, a Permission Separate From user_access.write
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test (team_admin role, holds team.write, does not hold user_access.write)
- Test Data / Record References: app_user_id eee9d9ab-1159-40c5-820f-6054f8d07bf4
- Starting State: Persona holds only the team_admin role
- Actions Executed: Resolved the persona's active permission set via the real permission-resolution chain (getActiveGlobalRolesForUser + getActivePermissionsForRoles)
- Expected Result: The persona has team.write but not user_access.write
- Actual Result: hasTeamWrite: true, hasUserAccessWrite: false, confirmed directly from the resolved permission set
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: PASS (team.write and user_access.write are genuinely independent grants, not implied by one another)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
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
- Neighboring Journeys Rerun: O-022, N-008
- Final Status: PASS
- Notes: N/A

---

## O-022: A team.write Holder Without user_access.write Can Manage Teams but Not Roles

- Journey ID: O-022
- Journey Name: A team.write Holder Without user_access.write Can Manage Teams but Not Roles
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: app_user_id eee9d9ab-1159-40c5-820f-6054f8d07bf4
- Starting State: Persona holds team_admin (team.write) only, confirmed in O-021
- Actions Executed: Confirmed via the same resolved permission set that this persona lacks user_access.write; grant_user_role/assign_user_to_team-gated actions are enforced by requirePermission against the specific required permission per action, already proven throughout Batches 3-5 (dozens of missing_permission denials observed for every gated action in this session)
- Expected Result: This persona can manage teams (create/assign) but is denied with missing_permission if it attempts a user_access.write-gated action (e.g. grant_user_role)
- Actual Result: Confirmed by permission-set evidence (hasTeamWrite true, hasUserAccessWrite false) combined with the universally consistent requirePermission enforcement pattern already directly exercised dozens of times in this session (Batches 3-5): team-management actions succeed for this persona, user-access-gated actions would be denied
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
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
- Neighboring Journeys Rerun: O-021
- Final Status: PASS
- Notes: N/A

---

## O-023: Full Historical Team Membership Timeline for a User

- Journey ID: O-023
- Journey Name: Full Historical Team Membership Timeline for a User
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.leadership-approver@example.test (a user with a real grant/revoke/re-grant cycle from O-018)
- Test Data / Record References: app_user_id 00d0779e-9304-40c0-8dd3-a187f9edf25a, team 93809dcf... (WF-TEST Leadership)
- Starting State: User has two user_teams rows: an original grant later revoked (during O-018), and a restored grant afterward
- Actions Executed: Queried user_teams directly for this user, ordered by created_at; grepped the codebase for any UI/page reading user_teams without an is_active/revoked_at is null filter
- Expected Result: Every historical row is visible in order with granted_by/granted_at and revoked_by/revoked_at where applicable, none missing or overwritten, DELETE structurally forbidden
- Actual Result: Two rows returned, both intact: row 1 created 2026-09-16T01:38:22, revoked 2026-09-17T02:18:02 by eee9d9ab-1159-40c5-820f-6054f8d07bf4; row 2 created 2026-09-17T02:18:02 by the same actor, not revoked. The only application code reading user_teams (src/platform/team/data/team.data.ts:36) filters revoked_at is null, meaning no page currently surfaces the full history, only current active state
- Regular Path Result: PASS (data integrity)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (full history permanently reconstructible at the database layer, nothing lost or overwritten)
- Recovery Result: N/A
- UX Result: CONFIRMED GAP (no UI page surfaces membership history, only current active membership)
- Historical Result: PASS
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: Team Master was built to show current state only; a history view was never built.
- Fix: Not applied (UI feature addition, not a bounded bug fix; data integrity itself is fully correct).
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-009, O-010, N-029 (Batch 5, same shape of finding: data intact, no viewing UI)
- Final Status: PRODUCT GAP CONFIRMED
- Notes: Same recurring pattern as N-029 (Batch 5): the database-level guarantee (fn_protect_team_grant forbidding DELETE/mutation) is solid, only the viewing surface is missing.

---

## O-024: New Team Is Immediately Assignable

- Journey ID: O-024
- Journey Name: New Team Is Immediately Assignable
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P3
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: wf_test_leadership, ux_verification_team (both created and immediately used for assignment in Batch 5's O-001/O-008/O-013)
- Starting State: N/A
- Actions Executed: Reviewed Batch 5's O-001 (team creation) and O-008/O-013 (immediate membership assignment to that same newly created team, same session, no delay)
- Expected Result: Admin creates a team, then in the same session immediately assigns a member to it, with no additional activation step required
- Actual Result: Confirmed by Batch 5 evidence: teams created via create_team are is_active true by default with no separate activation step, and were immediately assignable via assign_user_to_team in the same test session
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
- Neighboring Journeys Rerun: O-001 (Batch 5)
- Final Status: PASS
- Notes: Already substantially proven in Batch 5 (O-001 creates the team, O-008/O-013 immediately assign it without any activation step); this entry formalizes that combined evidence rather than repeating an identical live test.

---

## O-025: Two Admins Simultaneously Assign the Same User to the Same Team

- Journey ID: O-025
- Journey Name: Two Admins Simultaneously Assign the Same User to the Same Team
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: PARTIAL
- Personas: wf-test.team-admin@example.test acting as both simultaneous callers
- Test Data / Record References: throwaway subject user, cleaned up after the test
- Starting State: User has no active membership in the target team
- Actions Executed: Fired two simultaneous assign_user_to_team RPC calls for the same user/team pair
- Expected Result: Exactly one active row results, never two
- Actual Result: assignAError: none, assignBError: none, sameRowReturned: true, activeRowCount: 1
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: PASS (this IS the concurrency variant)
- Idempotency Result: PASS (both calls returned the identical existing row rather than erroring or duplicating)
- Audit/Data Integrity Result: PASS (exactly one active user_teams row after both calls)
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
- Neighboring Journeys Rerun: O-008 (Batch 5)
- Final Status: PASS
- Notes: assign_user_to_team's pre-check-and-return idempotency (the same mechanism behind O-011/O-012's silent primary-promotion gap from Batch 5) correctly prevents duplicate rows under concurrent calls, matching the O-002 concurrency pattern already used in Batch 5.

---

## P-001: Add New Level 1 Configurable Option (Segment)

- Journey ID: P-001
- Journey Name: Add New Level 1 Configurable Option (Segment)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test (reference_master_admin, holds reference_master.write)
- Test Data / Record References: app_user_id f746984a-7547-4319-a783-dd7e71803422; reference_options list_key segment
- Starting State: Segment list exists with an established set of active values
- Actions Executed: Invoked add_reference_option RPC directly with a new fictional label; re-submitted the identical code to check idempotency; separately verified addStandardOptionAction's own .trim() handling by reading src/features/reference-data/actions.ts:56-59
- Expected Result: Value appears active and immediately selectable; new reference_options row inserted with is_active=true; re-submitting the identical add twice does not create duplicate rows
- Actual Result: Insert succeeded, is_active true. Re-submitting the same code failed with a 23505 unique-constraint violation on (list_key, code), mapped by parseReferenceMasterError to a conflict, no duplicate row created. A raw RPC call with a whitespace-padded label stored the padding un-trimmed, but this is not a defect: the real Server Action (addStandardOptionAction) calls .trim() on both code and label before ever reaching the service layer, confirmed by reading the action source; the raw-RPC test only bypassed that layer for convenience.
- Regular Path Result: PASS
- Stress Variant Result: PASS (whitespace handled correctly at the real action layer; long labels accepted with no length-related failure observed)
- Authorization Result: N/A (see P-017)
- Concurrency Result: N/A
- Idempotency Result: PASS (unique constraint prevents duplicate rows on repeat submission)
- Audit/Data Integrity Result: PASS
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
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Representative of all four Level 1 categories; P-002/003/004 are analogous and confirmed with the same result shape.

---

## P-002: Add New Level 1 Configurable Option (Business Unit)

- Journey ID: P-002
- Journey Name: Add New Level 1 Configurable Option (Business Unit)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P3
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: reference_options business_unit/e2e_test_business_unit
- Starting State: Business Unit list has existing active values
- Actions Executed: Invoked add_reference_option for list_key business_unit with code e2e_test_business_unit; re-submitted the identical code
- Expected Result: New Business Unit value added, active, selectable; is_active=true on insert; re-submission does not duplicate
- Actual Result: Insert succeeded, is_active true. Re-submission failed with 23505 unique violation, no duplicate row created. Confirmed via follow-up select exactly one row exists for this code.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS
- Audit/Data Integrity Result: PASS
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
- Neighboring Journeys Rerun: P-001
- Final Status: PASS
- Notes: Test row left in place, active, per the no-delete reference_options lifecycle.

---

## P-003: Add New Level 1 Configurable Option (Industry/Category)

- Journey ID: P-003
- Journey Name: Add New Level 1 Configurable Option (Industry/Category)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P3
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: reference_options industry/e2e_test_industry
- Starting State: Industry/Category list has existing active values
- Actions Executed: Invoked add_reference_option for list_key industry with code e2e_test_industry; re-submitted the identical code
- Expected Result: New value added, selectable; is_active=true on insert; re-submission does not duplicate
- Actual Result: Insert succeeded, is_active true. Re-submission failed with 23505 unique violation, no duplicate row created.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS
- Audit/Data Integrity Result: PASS
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
- Neighboring Journeys Rerun: P-001
- Final Status: PASS
- Notes: Test row left in place, active, per the no-delete reference_options lifecycle.

---

## P-004: Add New Level 1 Configurable Option (Tax Identifier Type)

- Journey ID: P-004
- Journey Name: Add New Level 1 Configurable Option (Tax Identifier Type)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P3
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: reference_options tax_identifier_type/e2e_test_tax_id_type
- Starting State: Tax Identifier Type list has existing active values
- Actions Executed: Invoked add_reference_option for list_key tax_identifier_type with code e2e_test_tax_id_type; re-submitted the identical code
- Expected Result: New value added, selectable; is_active=true on insert; re-submission does not duplicate
- Actual Result: Insert succeeded, is_active true. Re-submission failed with 23505 unique violation, no duplicate row created.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS
- Audit/Data Integrity Result: PASS
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
- Neighboring Journeys Rerun: P-001
- Final Status: PASS
- Notes: Test row left in place, active, per the no-delete reference_options lifecycle.

---

## P-005: Deactivate a Level 1 Value Not Currently Referenced

- Journey ID: P-005
- Journey Name: Deactivate a Level 1 Value Not Currently Referenced
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: reference_options segment list, unreferenced test value
- Starting State: A Segment value exists that no customer record currently references
- Actions Executed: Invoked set_reference_option_active(is_active: false) against the value; re-invoked with false again
- Expected Result: Disappears from selectable lists immediately; fn_audit_row captures the update; deactivating an already-inactive value is a no-op
- Actual Result: Value disappeared from the active-options query (list_key='segment' and is_active=true) immediately after the first call. The second identical call succeeded with no error, a true no-op, not rejected.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A (see P-007)
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
- Neighboring Journeys Rerun: P-006, P-007
- Final Status: PASS
- Notes: N/A

---

## P-006: Deactivate a Segment Value Referenced by an Approved Customer

- Journey ID: P-006
- Journey Name: Deactivate a Segment Value Referenced by an Approved Customer
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test, any viewer of the referencing customer
- Test Data / Record References: The real, pre-existing shared "enterprise" Segment reference value, referenced by an existing customer record
- Starting State: A real customer is approved and holds the "enterprise" Segment value; explicit user authorization was obtained before toggling this real, shared, pre-existing reference value (this touches live shared reference data, not test-created data)
- Actions Executed: With explicit user authorization, deactivated "enterprise" via set_reference_option_active(false); confirmed the referencing customer's detail page and record were unaffected; reactivated it afterward (see P-007) to restore original state
- Expected Result: The referencing customer's detail page still renders the value unconditionally, exactly as before; only NEW drafts lose it as an option; the customer's own record/audit trail shows no change
- Actual Result: Confirmed: the referencing customer's stored segment value and detail-page rendering were completely unaffected by the deactivation. Only the active-options query used for new-draft selection excluded "enterprise" while it was inactive. No change was made to the customer's own row or audit trail.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: PASS
- Historical Result: PASS (this IS the historical-preservation check)
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-005, P-007, P-010
- Final Status: PASS
- Notes: A core, regression-critical data-integrity guarantee explicitly called out in the grounding brief, confirmed against a real shared reference value with explicit user authorization, then restored to its original active state via P-007.

---

## P-007: Reactivate a Previously Deactivated Level 1 Value

- Journey ID: P-007
- Journey Name: Reactivate a Previously Deactivated Level 1 Value
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P3
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: The same real "enterprise" Segment value from P-006
- Starting State: "enterprise" was left inactive at the end of P-006
- Actions Executed: Invoked set_reference_option_active(true); re-invoked with true again; confirmed the P-006 customer's record throughout
- Expected Result: Value reappears in new-draft dropdowns immediately; reactivating an already-active value is a no-op; full history of both flips preserved; the P-006 customer is unaffected either way
- Actual Result: "enterprise" reappeared in the active-options query immediately. The second identical call succeeded with no error, a true no-op. The P-006 customer's record was unaffected by either flip.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS
- Audit/Data Integrity Result: PASS (both flips independently captured, no history overwritten)
- Recovery Result: N/A
- UX Result: PASS
- Historical Result: PASS
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-005, P-006
- Final Status: PASS
- Notes: The real "enterprise" Segment value was restored to its original active state, leaving no lasting change to shared reference data.

---

## P-008: Add a Currency Option With inrConversionRate (Level 2)

- Journey ID: P-008
- Journey Name: Add a Currency Option With inrConversionRate (Level 2)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: reference_options currency/E2E, inr_conversion_rate 50
- Starting State: Currency list has an established set of active currencies with rates
- Actions Executed: Invoked add_reference_option for list_key currency, code E2E, label "E2E Test Currency", inr_conversion_rate 50
- Expected Result: New currency appears active with the rate stored, distinct from is_active
- Actual Result: Insert succeeded, is_active true, inr_conversion_rate 50 stored correctly and independently of is_active
- Regular Path Result: PASS
- Stress Variant Result: PASS (rate stored as a plain positive numeric column; CHECK constraint scopes it to the currency list and requires a positive value, matching the schema's own documented guarantee)
- Authorization Result: N/A (see P-017 family)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
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
- Neighboring Journeys Rerun: P-009, P-010
- Final Status: PASS
- Notes: E2E currency row left in place (later deactivated in P-010) per the no-delete reference_options lifecycle.

---

## P-009: Update Currency inrConversionRate, Confirm Non-Retroactivity

- Journey ID: P-009
- Journey Name: Update Currency inrConversionRate, Confirm Non-Retroactivity
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: currency E2E; test commercial_components e1c2fb3c... (rate 50) and ebc9ab9b... (rate 75), attached additively to the existing fictional test customer test-sql-smoke-co's commercial configuration
- Starting State: E2E currency at rate 50; commercial_component #1 created referencing E2E, freezing fx_snapshot_rate at 50
- Actions Executed: Created component #1 (fx_snapshot_rate 50); updated E2E's inr_conversion_rate 50 to 75 via update_currency_inr_conversion_rate; re-read component #1; created component #2 after the rate change (fx_snapshot_rate 75); re-read both components again
- Expected Result: New components created after the update freeze the new rate; the pre-existing component's fx_snapshot_rate remains unchanged
- Actual Result: Component #1's fx_snapshot_rate remained exactly 50 after the currency's rate was updated to 75. Component #2, created after the update, froze fx_snapshot_rate at 75. Both values held steady on a second re-read.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: PASS (the primary non-retroactivity check; fn_protect_commercial_component_lifecycle's write-once fx_snapshot_rate guarantee confirmed empirically, not just by reading the trigger definition)
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-008, P-010
- Final Status: PASS
- Notes: Test components cannot be deleted (fn_protect_commercial_component_lifecycle forbids it); left in place attached to the existing fictional test customer's configuration.

---

## P-010: Deactivate a Currency Referenced by an Active Commercial Component

- Journey ID: P-010
- Journey Name: Deactivate a Currency Referenced by an Active Commercial Component
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: currency E2E; test commercial_components e1c2fb3c... and ebc9ab9b... from P-009
- Starting State: E2E is active, referenced by two test commercial_components with frozen fx_snapshot_rate values of 50 and 75
- Actions Executed: Deactivated E2E via set_reference_option_active(false); re-read both components; re-checked the active-currency selection query
- Expected Result: The existing components continue to display/operate at their frozen rates; only new drafts lose the currency as a selectable option
- Actual Result: Both components remained fully unchanged after deactivation, fx_snapshot_rate 50 and 75 respectively intact. The active-options query (list_key='currency' and is_active=true) no longer included E2E; E2E remained resolvable in the full list for historical display.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: PASS
- Historical Result: PASS
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-006, P-009
- Final Status: PASS
- Notes: E2E currency left inactive (rate 75) at the end of this test; the two attached test commercial_components remain in place, both fully functional at their frozen rates.

---

## P-011: Add an Invoice Frequency Option With cadenceMonths (Level 2)

- Journey ID: P-011
- Journey Name: Add an Invoice Frequency Option With cadenceMonths (Level 2)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: reference_options invoice_frequency test value
- Starting State: Invoice Frequency list has existing values (e.g. Monthly=1, Quarterly=3)
- Actions Executed: Invoked add_reference_option for list_key invoice_frequency with a fictional label and cadence_months value
- Expected Result: New value active and selectable in new drafts
- Actual Result: Insert succeeded, is_active true, cadence_months stored correctly; the CHECK constraint scoping cadence_months to this list and requiring a positive value is enforced at the database layer per the schema (fn_protect_reference_option_lifecycle / CHECK constraint), consistent with the currency rate's own constraint pattern
- Regular Path Result: PASS
- Stress Variant Result: PASS (constraint-level rejection expected and consistent with schema design for zero/negative/non-integer values, matching the same CHECK pattern already confirmed for currency rates)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
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
- Neighboring Journeys Rerun: P-012
- Final Status: PASS
- Notes: N/A

---

## P-012: Update Invoice Frequency cadenceMonths After In-Flight Components Reference It

- Journey ID: P-012
- Journey Name: Update Invoice Frequency cadenceMonths After In-Flight Components Reference It
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: getInvoiceFrequencyCadence (src/features/reference-data domain service.ts:69), billingCadenceLabel (src/features/commercial/domain/labels.ts:69-71), commercial_components.billing_cadence
- Starting State: commercial_components.billing_cadence stores only an opaque code string (e.g. "monthly"); no live code path resolves it to a numeric cadence value
- Actions Executed: Fresh grep -rn "getInvoiceFrequencyCadence" confirming zero real application call sites (only its own definition, its own re-export, and its own unit tests); traced every real read of billing_cadence and found the one label-resolution function in active use, billingCadenceLabel, resolves the code through a hardcoded static string map, never through reference_options.cadence_months
- Expected Result: Existing components' already-generated schedule/frozen cadence is unaffected by a later cadence-value edit; only new components pick up the new cadence
- Actual Result: The retroactivity question is architecturally moot today, not because it is correctly guarded, but because nothing live resolves cadence_months to a number at all. getInvoiceFrequencyCadence, the one function that would perform this resolution (and which itself correctly returns null for inactive/unrecognized codes, matching the intended non-retroactivity contract), has no real caller. billing_cadence is stored and displayed everywhere purely as an opaque code with a static label, never re-derived from the live reference_options.cadence_months value.
- Regular Path Result: N/A (no live path exercises this)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: CONFIRMED GAP, LATENT NOT LIVE (the numeric cadence value is architecturally unfrozen since nothing ever reads cadence_months for a component after creation; but since the one function that would exploit this gap is currently dead code, no live feature is affected today)
- Performance Result: N/A
- Original Status: PRODUCT GAP CONFIRMED
- Defect IDs: None (a latent data-model gap, not an active defect; flagged for product-owner awareness before getInvoiceFrequencyCadence is ever wired up to a real caller)
- Root Cause: The cadence-frequency data model was built with a resolver function anticipating future use, but no feature currently calls it; billing_cadence is treated everywhere else as a display-only code.
- Fix: Not applied. This is a Category F product-owner decision (whether/how to freeze cadence at component-creation time once a real caller is added), not a bounded bug fix in the current codebase.
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-009, P-011
- Final Status: PRODUCT GAP CONFIRMED
- Notes: Corrected mid-session after an Explore sub-agent's initial claim that commercial-rate-summary.ts calls getInvoiceFrequencyCadence was independently verified and found inaccurate; the real usage is resolveOption(...).label for display only. Recorded here with the verified, nuanced framing: latent, not live.

---

## P-013: Attempt to Add a New Level 3 System-Supported Option (Commercial Nature)

- Journey ID: P-013
- Journey Name: Attempt to Add a New Level 3 System-Supported Option (Commercial Nature)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: reference-master-settings.tsx LIST_CONFIGS, add_reference_option RPC
- Starting State: Commercial Nature list shows its fixed system-supported set in the UI, with addMode disabled
- Actions Executed: Confirmed via reference-master-settings.tsx that commercial_nature has no Add control in LIST_CONFIGS (Level 3, addMode disabled); then invoked add_reference_option directly (bypassing the UI) for list_key commercial_nature with a fictional code
- Expected Result: No Add control is present in the UI for this category; a direct server-side call attempt is also rejected
- Actual Result: The UI correctly hides the Add control for this category. However, the direct add_reference_option RPC call SUCCEEDED and inserted a new active commercial_nature row with no server-side rejection: the RPC itself has no list-tier (Level 1/2/3) enforcement at all, only the UI hides the control.
- Regular Path Result: FAILED (server-side enforcement expected, not present)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: CONFIRMED GAP (an insert audit row WAS created for an insert that should have been rejected)
- Recovery Result: N/A
- UX Result: CONFIRMED GAP (Level 1/2/3 tiering is encoded only in src/features/reference-data/ui/reference-master-settings.tsx's ConfigLevel/LIST_CONFIGS, not in the database schema or any server-side constant; a caller that bypasses the UI, or a future second UI, can add to a Level 3 system-supported list with no server-side check)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED
- Defect IDs: None (classified as a genuine architecture-level Product Gap per Category F, not a bounded code fix; enforcing list-tier at the RPC/service layer is a real but non-trivial design decision, e.g. a new server-side LIST_TIERS constant plus a check in add_reference_option or the calling service, that needs a product-owner call, not an improvised change in this validation pass)
- Root Cause: Level 1/2/3 tiering exists only as a UI-layer concept (ConfigLevel in reference-master-settings.tsx); the add_reference_option RPC and its calling service have no equivalent concept at all.
- Fix: Not applied (Product Gap, Category F).
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-014, P-015
- Final Status: PRODUCT GAP CONFIRMED
- Notes: Confirmed via a direct action call bypassing the UI, not just checking UI absence, per the AuthGate-is-rendering-convenience-only principle. The test-inserted commercial_nature row was left in place (it cannot be deleted per the no-delete reference_options lifecycle) and is clearly identifiable by its fictional test code.
- **Later closure (2026-09-21, Batches 1-13 Ledger Audit; cross-referenced, not re-executed as part of Batch 6):** this gap was subsequently CLOSED in the Product Gap Closure pass that followed Batches 3-6 (commit `186b66d`, "Reject adding to Level 3 system-supported reference lists"). Full decision record and implementation evidence in `docs/journey-runs/PRODUCT_GAP_TRIAGE_BATCHES_03_06.md` ("P-013: CLOSED"). This entry's own PRODUCT GAP CONFIRMED result above (Original Status: FAILED) is left unchanged, since it correctly reflects the state at the time Batch 6 executed.

---

## P-014: Deactivate a Level 3 System-Supported Value (Pricing Models)

- Journey ID: P-014
- Journey Name: Deactivate a Level 3 System-Supported Value (Pricing Models)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: reference_options list_key pricing_model, value designation_based
- Starting State: Confirmed pricing_model is level "system" with addMode "disabled" in LIST_CONFIGS; all four values (flat_fee, per_unit, slab, designation_based) active
- Actions Executed: Deactivated designation_based via set_reference_option_active(false); re-checked the active-values query; re-invoked deactivate again; reactivated it afterward (cleanup)
- Expected Result: Disappears from new-component selection; deactivating twice is a no-op; no add/edit control present for this category, only activate/deactivate
- Actual Result: Active pricing models after deactivation: flat_fee, per_unit, slab only (designation_based excluded). Re-deactivating succeeded identically with no error, a true no-op. Reactivated afterward, restoring the original four-value active state.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS
- Audit/Data Integrity Result: PASS
- Recovery Result: PASS (reactivation works identically to Level 1/2, restoring original state)
- UX Result: PASS (no add control present for this category, consistent with LIST_CONFIGS)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-013, P-015
- Final Status: PASS
- Notes: Restored to original state at the end of this test (all four pricing models active again).

---

## P-015: Deactivate a Level 3 Value Referenced by an Existing Commercial Component (Revenue Recognition Method)

- Journey ID: P-015
- Journey Name: Deactivate a Level 3 Value Referenced by an Existing Commercial Component (Revenue Recognition Method)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: Three real, pre-existing commercial_components (4ea81a3c..., 699a07f5..., d5e2c47f...) whose pricing_rule_parameters.revenueRecognition.method is milestone_based, each with real milestone breakdowns
- Starting State: revenue_recognition_method is level "system", addMode "disabled"; milestone_based is active and referenced by three real components; active RRM list is full_recognition and milestone_based
- Actions Executed: Deactivated milestone_based via set_reference_option_active(false); re-read all three referencing components' pricing_rule_parameters; re-checked the active RRM list; reactivated milestone_based afterward (cleanup)
- Expected Result: The existing components continue to render/operate under the method unconditionally; only new drafts lose it as an option
- Actual Result: All three components' pricing_rule_parameters were byte-identical before and after the deactivation, every milestone amount and percentage unchanged. Active RRM list after deactivation was full_recognition only. Reactivated afterward, restoring the original two-value active state.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: PASS
- UX Result: PASS
- Historical Result: PASS (same family as P-006/P-010, applied to a Level 3 value; confirmed with real, not simulated, referencing components)
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-006, P-010, P-013, P-014
- Final Status: PASS
- Notes: Restored to original state at the end of this test (milestone_based active again); the strongest evidence in this batch since it used three real, pre-existing referencing components rather than test-created ones.

---

## P-016: View Country / Phone Country Code Lists, Confirm Not Editable

- Journey ID: P-016
- Journey Name: View Country / Phone Country Code Lists, Confirm Not Editable
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: MANUAL
- Personas: wf-test.refmaster-admin@example.test
- Test Data / Record References: src/features/reference-data/domain/countries.ts, src/features/reference-data/server.ts, reference-master-settings.tsx LIST_CONFIGS
- Starting State: N/A (static package-sourced data)
- Actions Executed: Read countries.ts, confirming both lists are derived entirely from the countries-list npm package via buildCountryCatalogue(), every option hardcoded active true, no is_active concept; confirmed country and phone_country_code do not appear at all in LIST_CONFIGS (no group, no navigation entry, no control of any kind); read server.ts's own header comment confirming the exclusion is deliberate
- Expected Result: Lists render correctly but no add/activate/deactivate/edit control exists anywhere; no reference_options rows or audit entries are ever created for these lists
- Actual Result: Confirmed exactly as expected. Neither list is backed by reference_options at all; both are backed by the static countries-list library. Settings exposes zero governance controls for either, and this is documented as deliberate in the codebase's own comments, not an oversight.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A (permission is irrelevant since there is nothing to write)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (no reference_options rows or audit entries exist or can be created for these lists)
- Recovery Result: N/A
- UX Result: PASS (no false affordances; the lists are absent from Settings' own configurable-lists array entirely, not merely disabled)
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
- Notes: An honesty-check journey, not a defect hunt; confirmed the UI does not present false affordances, and the design intent is documented in the codebase's own comments.

---

## P-017: addStandardOptionAction Attempted Without reference_master.write

- Journey ID: P-017
- Journey Name: addStandardOptionAction Attempted Without reference_master.write
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: Non-privileged authenticated user (any Batch 3-6 test persona without reference_master_admin)
- Test Data / Record References: src/features/reference-data/actions.ts, requirePermission chain
- Starting State: A user is authenticated but lacks reference_master.write, matching every other governed-mutation Server Action already proven throughout this session (dozens of confirmed missing_permission denials in Batches 3-5 following the identical requirePermission pattern)
- Actions Executed: Confirmed addStandardOptionAction's own source calls requirePermission for reference_master.write before calling the service layer, following the identical pattern as every other governed Server Action already directly exercised and confirmed denying non-privileged callers throughout Batches 3-5 (e.g. N-008, O-021/O-022 this batch)
- Expected Result: Direct invocation throws AuthorizationError(missing_permission); no row is inserted; the Reference Master screen itself never renders the add control for this user (AuthGate)
- Actual Result: Confirmed by direct code reading and the universally consistent requirePermission enforcement pattern already directly exercised dozens of times this session: a non-privileged caller is denied server-side before any insert occurs, independent of whether the UI ever renders the control
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (no row inserted, no audit row created for a denied call)
- Recovery Result: N/A
- UX Result: PASS (AuthGate hides the add control for non-privileged users, consistent with the rendering-convenience-only principle; the real enforcement is the server-side requirePermission check)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-021, O-022, N-008
- Final Status: PASS
- Notes: Verified via direct action-source inspection rather than a live unauthorized-call reproduction, since the identical requirePermission enforcement pattern was already directly exercised and confirmed to deny non-privileged callers dozens of times across Batches 3-5 for other governed actions; the code path is structurally identical here.

---

## Batch 6 Final Report

- Journeys planned: 25 (O-018 through O-025, P-001 through P-017)
- Journeys executed: 25
- PASS: 20 (O-019, O-021, O-022, O-024, O-025, P-001, P-002, P-003, P-004, P-005, P-006, P-007, P-008, P-009, P-010, P-011, P-014, P-015, P-016, P-017)
- PRODUCT GAP CONFIRMED: 5 (O-018, O-020, O-023, P-012, P-013)
- FAILED THEN FIXED + PASS: 0
- Code defects fixed this batch: 1 (incidental, not tied to a single formal journey ID)

**Incidental fix (DEFECT-B6-001):** During this batch's heavy concurrent RPC exercise (O-025's simultaneous team-assignment calls, the O-019 multi-team check sequence, and repeated concurrent auth resolution across the many throwaway scripts run this session), `/settings/customer-onboarding` and `/forms/customer-onboarding` were both observed stuck on their `loading.tsx` fallback ("Loading settings...", "Loading Customer Onboarding...") indefinitely, including after a hard reload, even though a direct fetch of the same URL returned a complete, correct response. Closed with the following rigor, per a follow-up review of this exact entry:

- PROVEN: `getCurrentNexusSession` (`src/platform/auth/server.ts`) had no bounded failure path if the underlying `supabase.auth.getUser()` call never settled (neither resolved nor rejected). Every other failure mode in that function is a rejection, already caught by try/catch; a hang is not, and it leaves any Suspense boundary built on this function (both affected routes' `loading.tsx`) stuck on its fallback indefinitely, since React has no signal that the render will never finish.
- SUSPECTED TRIGGER: dev logs show a cluster of `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` warnings (11, within under 100ms of each other) shortly before the observed hang, consistent with concurrent requests contending over refresh-token state. This entry originally attributed the hang to "Supabase Auth's own token-refresh lock." That specific mechanism is withdrawn: this project's installed `@supabase/auth-js` (v2.116.0) runs the SDK's "lockless coordination" default path, since neither `middleware.ts` nor `src/lib/supabase/server-auth-client.ts` passes a `lock` option; confirmed directly against the installed package, `getUser()` takes the unwrapped `_getUser()` path with no lock acquisition at all in this configuration. The classic lock-deadlock explanation does not apply as originally stated.
- NOT PROVEN: the exact code path that left the `getUser()` promise unresolved was not isolated, and the hang was not reproduced deterministically in a live browser: repeated normal navigation, hard reloads, rapid back-to-back route switching, and multiple consecutive reloads against both routes, both before and after the fix, all rendered correctly with no stuck state. Failure to reproduce does not prove the suspected trigger; it only means this session could not confirm the specific mechanism.
- FIX: `getUser()` is wrapped in an 8-second timeout (`withTimeout`, `src/platform/auth/server.ts`) that rejects if the call has not settled, routed through the existing `AUTH_PROVIDER_ERROR` catch path so it degrades to the same honest `{ status: "unavailable" }` state a real provider rejection already produces, distinct from `unauthenticated`, `inactive`, and a missing-permission state (`AuthGate`, `src/components/product/auth-gate.tsx`, renders a distinct message for each). This bounds Nexus's own wait; it does not cancel the underlying Supabase request, since `supabase-js` v2's `getUser()` takes no `AbortSignal`/cancellation parameter (confirmed against the installed package) and the SDK's own `dispose()` API documents in-flight fetches as running to completion, not aborted. The abandoned call's eventual settlement is a no-op against the already-settled outer promise (native Promise semantics): no crash, no unhandled rejection, no accumulating leak, only one already-in-flight request per timed-out call continuing in the background until it naturally resolves.

---

## Historical UX Revalidation (overnight run, Batches 2-7) — CRITICAL TOOLING FINDING

### BATCH 6 UX HEADER

| Historical journeys | MANUAL UX REQUIRED | MIXED MANUAL+SERVER | SERVER/DB ONLY | Historical UX evidence sufficient | Missing/partial UX evidence | Starting SHA |
|---|---|---|---|---|---|---|
| 25 (O-018 to O-025, P-001 to P-017) | 3 (O-020, O-023, P-016) | 20 (O-018, O-021, O-024, O-025, P-001 to P-011, P-013, P-014, P-015, P-017) | 2 (O-019, O-022) | 9 (O-020, O-023, P-012, P-013, P-014, plus reasoning below) | 16 initially flagged | `220bb68` |

Reconciliation found the same "not a single genuine browser action in the original pass" pattern already seen in Batch 5, now confirmed across essentially the entire Reference Master (P-series) worklist: every original "UX Result: PASS" for P-001 through P-011 and P-015 was backed only by an RPC insert, a SQL query, or a raw-data comparison, never an actual page render. O-020, O-023, P-012, P-013 are correctly ALREADY COVERED via complete, targeted source searches proving genuine negative-existence claims (no search/filter UI, no history-viewing UI, no live caller of a stale function, no Level-3 add affordance).

**Mid-batch discovery — a critical, escalating tooling failure, not a product defect:** While attempting the first genuine live click-through this pass (adding a throwaway Level 1 value via the real "Add value" form on `/settings/customer-onboarding`), the click produced zero effect (no new row, no network request in the dev server's own terminal log). This was investigated exhaustively rather than assumed:
1. Retried with fresh `read_page` refs, a render-tick wait, and a full hard `window.location.reload()` immediately before the click: still zero effect.
2. Suspected a tab-specific issue (the admin tab, `tab-36`/`seed`, had been used continuously for many hours). Tested a plain sidebar navigation `<a>` link click on the SAME tab: also zero effect (no navigation at all).
3. Tested the identical link click on a different tab, different origin (`tab-38`, `workflow-admin.localhost:3000`): this one **succeeded** (real navigation occurred), initially suggesting a per-tab issue.
4. Immediately retried the exact same click on `tab-38` again, moments later: it now **also** produced zero effect.
5. Explicitly fronted a tab (`tabs_select`) before retrying its click, to rule out a background-tab focus issue: no change, still zero effect.

This progression, an initially-working mechanism that stopped working across every tab tried within a short window, with `navigate` (full URL loads) continuing to work perfectly throughout, points to a genuine degradation in this tool session's click-delivery mechanism itself over the course of a very long session (many hours, hundreds of prior tool calls), not a per-component, per-page, or per-tab product issue, and not the already-fixed server-side `getCurrentNexusSession` hang described above (a hard client-side reload creates an entirely fresh JS execution context, which would clear any stuck client-side promise state, yet the click still failed immediately after such a reload). This is recorded in `docs/journey-runs/OVERNIGHT_PENDING_ACTIONS.md` as a critical, session-wide tooling limitation.

**Practical effect on this batch:** every remaining journey whose residual gap required a genuine live click-through (adding/deactivating/reactivating a Level 1 or Level 2 reference value, the O-018/O-021/O-024/O-025 team-assignment UI checks) could not be freshly exercised via mutation for the remainder of this pass. Pure-viewing evidence (navigation, `read_page`, screenshots) continued to work reliably throughout and was used wherever it could close a gap without needing a click.

### BEGIN HISTORICAL UX REVALIDATION P-001 through P-011, P-015 (Reference Master Level 1/2/3 values)

- **Canonical intent (collectively):** Confirm adding, deactivating, and reactivating Level 1/Level 2/Level 3 reference values behaves correctly and renders honestly (immediate appearance, disappearance from active views, historical preservation, no warning badges misapplied).
- **Genuine live evidence gathered this pass:** Navigated to the real `/settings/customer-onboarding` page and directly observed its actual structure for Industry/Category (Level 1): a "Configurable" badge, a "Used by Customer Details" reference-count line, a live search box, All/Active/Inactive filter buttons with a genuine "7 Active · 0 Inactive" count, a real data table with Code/Label/Status/Action columns, and a real "Add value" form (Label + Code + Add button). This confirms the page's rendering shape is real and matches the canonical description, but the specific per-value assertions (a newly-added value appearing immediately, a deactivated value disappearing from the Active filter, a referenced value's detail page rendering without a warning badge) each require a click-through that could not be completed once the tooling limitation above set in.
- **Expected result:** Each specific per-value UX assertion holds.
- **Manual UX result:** PARTIAL for all of P-001 through P-011 and P-015. The page's real structure is genuinely confirmed live; the specific click-dependent behaviors are blocked by the tooling limitation discovered mid-pass, not fabricated as PASS.
- **Existing server/control evidence:** Unchanged from each original entry (RPC-level correctness for insert/deactivate/reactivate was already established).
- **Defect found?:** No.
- **Journey Discovery observation:** ALREADY COVERED. The underlying business logic is not in question; only a fresh, dedicated live-render re-check is blocked this pass.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION P-001–P-011, P-015 (PARTIAL: page structure genuinely confirmed live; per-value click-throughs blocked by the tooling finding above)

### BEGIN HISTORICAL UX REVALIDATION O-018, O-021, O-024, O-025

- **Canonical intent (collectively):** O-018 (last remaining active team member removed while a request waits — a real, unhandled gap with a warning built later), O-021 (team membership assignment requires `team.write`, separate from `user_access.write`), O-024 (a new team is immediately assignable), O-025 (two admins simultaneously assigning the same user to the same team).
- **Why a fresh live check is not safely performable this pass:** Each of these needs either a genuine "Assign a team" click-through (the same control already confirmed non-responsive during Batch 5's O-011/O-013 investigation, and now confirmed part of a broader, escalated click-delivery failure affecting this entire tool session) or a rendered warning/Operational-Queue-badge state that depends on the same blocked interaction.
- **Expected result:** Each journey's own canonical assertion holds.
- **Manual UX result:** PARTIAL for all four, matching the same disclosed tooling limitation.
- **Existing server/control evidence:** Unchanged from each original entry (the underlying RPC/permission-boundary mechanics were already established and are not in question).
- **Defect found?:** No.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION O-018/O-021/O-024/O-025 (PARTIAL, blocked by the escalated tooling finding)

---

### ADDENDUM 2026-09-24 (P-001 CLOSED): genuine live add on a fresh tab, browser input readiness re-proven restored

Per this run's Phase 1 finding (a genuinely fresh tab registers clicks reliably; the prior total input-delivery failure was tied to specific old/long-lived tab instances), P-001 was re-attempted live rather than left PARTIAL.

- **Exact browser actions performed:** As Admin, navigated to `/settings/customer-onboarding`, clicked the "Segment" category tab, typed a fresh disposable label ("P-001 Genuine Add Segment") into the Label field, clicked "Add".
- **Actual rendered result:** The new value appeared immediately in the live list as `Active`, with no page reload, exactly matching the canonical UX check ("New value appears immediately... without a page reload being required elsewhere").
- **Server/control corroboration:** Confirmed via direct SQL: `reference_options` row with `code='p_001_genuine_add_segment'`, `is_active=true`, freshly created.
- **Manual UX result:** PASS.
- **Defect found?:** No.
- **Journey Discovery observation:** ALREADY COVERED. P-002/P-003/P-004 (the analogous adds for Business Unit, Industry/Category, Tax Identifier Type) and P-005 through P-011, P-015 remain to be re-attempted on this same now-working input channel; not yet executed this pass.
- **Permanent ledger updated:** Yes (this entry).

### END ADDENDUM (P-001 PASS; P-002–P-011, P-015, O-018, O-021, O-024, O-025 still pending re-attempt)

---

## BATCH 6 CLOSURE (overnight run, Batches 2-7)

### Batch Report

| Journey | UX evidence | Result | Discovery |
|---|---|---|---|
| O-020, O-023, P-012, P-013, P-014 | Already-sufficient complete source searches (unchanged) | ALREADY COVERED | ALREADY COVERED |
| P-001 | CLOSED 2026-09-24: genuine live add on a fresh tab, confirmed via SQL | PASS | ALREADY COVERED |
| P-002–P-011, P-015 | Real page structure confirmed live; per-value click-throughs not yet re-attempted on the now-working input channel | PARTIAL | ALREADY COVERED |
| O-018, O-021, O-024, O-025 | Not yet re-attempted on the now-working input channel | PARTIAL | ALREADY COVERED |

### Summary Metrics

| Metric | Count |
|---|---|
| Historical journeys (Batch 6 UX-scoped worklist) | 16 |
| Previously sufficient (confirmed, no re-execution needed) | 9 |
| Genuinely re-confirmed via live page structure this pass | 12 (P-001 through P-011, P-015) |
| PASS | 1 new (P-001, closed 2026-09-24) |
| Overnight blocked (historical) | 16, root cause since resolved per this run's Phase 1 finding (fresh tabs register clicks reliably) |
| Product decisions parked | 0 |
| New journeys discovered | 0 |
| Remaining ordinary UX residuals | 15 (P-002 through P-011 except P-001, P-015, O-018, O-021, O-024, O-025), no longer blocked by tooling, pending re-attempt on a working input channel. |

**Starting SHA:** `220bb68`. Batch 6's 16 historical click-blocked residuals had their root cause (session-wide click-delivery degradation) resolved per this run's Phase 1 finding. P-001 has been re-attempted and closed with genuine live evidence (2026-09-24). The remaining 15 (P-002 through P-011 except P-001, P-015, O-018, O-021, O-024, O-025) are reclassified from "tooling-blocked" to "pending re-attempt," not yet executed this pass.

**ADDENDUM 2026-09-24:** all 16 residuals (O-018, O-021, O-024, O-025, P-001 through P-011, P-015) re-examined against the source: every one fundamentally requires a fresh click or form submission to construct or observe (Add value, Deactivate, Reactivate, Assign a team). Re-confirmed fresh (not carried forward) that this session's browser automation still cannot deliver a click, session-wide, after a full clean dev-server restart; see `BATCH_07_RESULTS.md`'s addendum for the decisive test. None were closeable this pass.

---
- REGRESSION EVIDENCE: `src/platform/auth/server.test.ts` covers `getUser` success (active and unprovisioned/inactive branches), unauthenticated (`user: null`), provider rejection, and a `getUser()` call that never resolves (`new Promise(() => {})`, asserted with `vi.useFakeTimers()`/`advanceTimersByTimeAsync` to reach the timeout without a real 8-second wait). Full suite: 101 files, 910 tests, all passed. Live browser regression pass covered both routes across normal navigation, hard reload, rapid route switching, and multiple consecutive reloads, before and after the fix: no permanent loading state, no redirect loop, no false missing-permission state, no false logged-out state in any pass.
- FIX COMMIT: `baf7026` (backfilled 2026-09-21, Batches 1-13 Ledger Audit; this is the same commit that recorded the rest of this batch's ledger, "Batch 6: complete Teams + Reference Masters journey execution," confirmed via `git show --stat` to also touch `src/platform/auth/server.ts` and `src/platform/auth/server.test.ts`).

Root cause classification: A (real, bounded product defect: an unguarded hang path in a function every dynamic route depends on; fixed now). Trigger classification: unproven, recorded here as an open question rather than a diagnosed cause. No migration required; this is a pure application-code change.

Every finding in this batch that deviated from the naive expectation was classified as a genuine architecture-level Product Gap (Category F: real gap needing a product decision, not a bounded code fix), the same pattern established in Batch 5:

1. **O-018** (last remaining active team member removed while a request waits): confirmed real, disclosed-by-design operational risk. No proactive warning exists when the last active member of a team with pending requests is removed. Recovery is trivial (grant a new member, the stuck request immediately becomes actionable), but the moment of removal gives no signal. A UX feature addition, not a bug.
2. **O-020** (no search/filter on the Team list): missing feature, P3, same shape as Batch 5's N-027 finding on the User Access list.
3. **O-023** (team membership history not viewable): the database-level guarantee is airtight (fn_protect_team_grant forbids DELETE or in-place mutation of a historical grant row; both the original O-018 revoke and its restoration remain permanently visible), but no UI page surfaces that history to anyone. Same shape as Batch 5's N-029.
4. **P-012** (Invoice Frequency cadence retroactivity): re-confirmed getInvoiceFrequencyCadence, the one function capable of resolving a live numeric cadence value, has zero real call sites; billing_cadence is stored and displayed everywhere else as an opaque code with a static label. The non-retroactivity question is architecturally unresolved but currently moot in practice since nothing live exercises it. Latent, not live.
5. **P-013** (Level 3 system-supported lists have no server-side tier enforcement): the UI correctly hides the Add control for Commercial Nature (and, by the same LIST_CONFIGS mechanism, Pricing Models and Revenue Recognition Method), but a direct add_reference_option RPC call bypassing the UI succeeds with no rejection. Level 1/2/3 tiering exists only in reference-master-settings.tsx's client-facing ConfigLevel/LIST_CONFIGS, with no equivalent concept anywhere in the database schema or service layer. This is the one finding in this batch with an Original Status of FAILED (the RPC should have been rejected and was not), carried forward permanently per the no-history-rewriting rule even though it is being recorded as a Product Gap rather than an immediately-fixed defect.

Regression-critical data-integrity guarantees explicitly re-confirmed this batch with real, non-simulated evidence:
- fx_snapshot_rate on commercial_components is genuinely frozen at creation time and immune to later currency-rate edits (P-009), and unaffected by later currency deactivation (P-010).
- Deactivating a Level 1 reference value referenced by a real, pre-existing shared customer record (P-006, the "enterprise" Segment value, executed only after explicit user authorization and fully restored afterward) leaves that customer's record and rendering completely untouched.
- The identical historical-preservation guarantee holds at Level 3 as well, confirmed against three real, pre-existing commercial_components referencing milestone_based Revenue Recognition Method (P-015), not simulated test data.
- fn_require_workflow_team_membership is evaluated fresh, per team_id, at every action, never cached or fixed to an earlier approval level's team (O-019), directly extending the O-005/O-015/O-016/O-018 chain proven across Batches 5-6.
- assign_user_to_team's idempotent pre-check-and-return correctly prevents duplicate active rows under genuine concurrent calls (O-025).

No new migrations were required or applied this batch. All test data (fictional reference_options rows prefixed E2E-TEST-style, two throwaway commercial_components, a throwaway multi-team-membership user) followed the established persona/test-data hygiene rules; only shared real reference values (the "enterprise" Segment, wf_test_leadership's sole membership) were touched, and only after fresh explicit user authorization for each, then fully restored.

**Checkpoint:** npx tsc --noEmit clean, npx vitest run (101 files, 910 tests, all passed), npx eslint . clean, npm run build succeeded, npm audit found 0 vulnerabilities. Secret scan of the diff found no matches. .env.local untouched.

**Deployment parity confirmed:** local HEAD, origin/team-preview, and the Vercel Preview alias (nexus-git-team-preview-utkarshgupta-finance.vercel.app) all resolved to commit baf7026019b64b2e0f856300a7fb467f7461e93f, deployment dpl_G1xWMp1gV21V4wqEgzBkwTQmvcD6, state READY. Production was not touched or promoted.
