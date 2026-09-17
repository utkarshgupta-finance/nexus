# Batch 5 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY
VALIDATION BATCH 5 (N-024 through N-031, O-001 through O-017, 25
journeys total). Created before execution begins per the mandatory
persistent ledger requirement; updated as each journey completes.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED /
PRODUCT GAP CONFIRMED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

If a journey fails and is later fixed, both Original Status: FAILED and
Final Status: FAILED THEN FIXED + PASS are preserved. History is never
rewritten to make a journey look like it passed the first time.

---

## N-024: Deactivating a Permission (is_active = false) Disables It Everywhere Instantly

- Journey ID: N-024
- Journey Name: Deactivating a Permission (is_active = false) Disables It Everywhere Instantly
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: A permission is granted via multiple different roles to different users
- Actions Executed: TBD
- Expected Result: Admin sets permissions.is_active = false for one permission; every user across every role that granted it immediately loses that specific capability; re-activating restores it to every role/user with a live grant chain, with no re-grant needed
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
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

## N-025: Same User Holds Overlapping Domain Roles

- Journey ID: N-025
- Journey Name: Same User Holds Overlapping Domain Roles (e.g. Checker Plus Team Admin)
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: checker + team_admin (same user)
- Test Data / Record References: TBD
- Starting State: User granted checker (commercial_configuration domain) and team_admin
- Actions Executed: TBD
- Expected Result: User can approve commercial_configuration items and manage teams in the same session without switching identity; permission resolution has no domain-exclusivity assumption baked in
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

## N-026: User Views Their Own Access Summary

- Journey ID: N-026
- Journey Name: User Views Their Own Access Summary
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: any active user
- Test Data / Record References: TBD
- Starting State: Active user with at least one role and one team
- Actions Executed: TBD
- Expected Result: User opens their own profile/access view; sees current roles, teams, derived permissions; no edit controls unless they separately hold user_access.write; this view does not require user_access.read of others
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

## N-027: Search and Filter the User List

- Journey ID: N-027
- Journey Name: Search and Filter the User List
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: A list of many users with varied names/emails/statuses
- Actions Executed: TBD
- Expected Result: Admin searches by name or email fragment, and/or filters by active/inactive/unprovisioned; result set narrows correctly; empty search results state is clear
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (special characters/unicode names)
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

## N-028: updated_by Attribution on Every user_access Edit

- Journey ID: N-028
- Journey Name: updated_by Attribution on Every user_access Edit
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: N/A
- Actions Executed: TBD
- Expected Result: Admin performs any edit; resulting row's updated_by matches the admin's own app_users.id, sourced from the server session, never from client input
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
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
- Notes: Already substantially proven across N-004 through N-009's updated_by/created_by/revoked_by checks in Batch 4.

---

## N-029: Full Historical Role Grant/Revoke Timeline for a User

- Journey ID: N-029
- Journey Name: Full Historical Role Grant/Revoke Timeline for a User
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: user_access_admin, auditor
- Test Data / Record References: TBD
- Starting State: A user with several grant/revoke cycles across their tenure
- Actions Executed: TBD
- Expected Result: Every historical user_roles row is visible in order, each with granted_by/granted_at and revoked_by/revoked_at where applicable, none missing or overwritten; row count matches exact number of events; no row ever hard-deleted
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A (dozens of cycles not literally seeded; mechanism already proven cycle-count-independent)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
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

## N-030: Attempt to Grant a Deactivated (is_active = false) Role

- Journey ID: N-030
- Journey Name: Attempt to Grant a Deactivated (is_active = false) Role
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: A role exists with is_active = false
- Actions Executed: TBD
- Expected Result: Deactivated roles do not appear in the grant-role selector; confirm whether the RPC layer itself rejects a direct grant_user_role call for a deactivated role, or only the UI hides it
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
- Notes: One of the mission's explicit "known open questions to treat as genuine empirical tests." If the RPC itself does not block this, it is a real gap worth flagging in PRODUCT GAP NOTES, not assumed away, per the Universe doc's own framing.

---

## N-031: usage.read and entitlement_settlement.read Are Seeded but Unenforced Anywhere

- Journey ID: N-031
- Journey Name: usage.read and entitlement_settlement.read Are Seeded but Unenforced Anywhere
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: An admin granting a deliberately narrow permission set; a user receiving it
- Test Data / Record References: TBD
- Starting State: A user exists with no entitlement-related permissions
- Actions Executed: TBD
- Expected Result: Grant the target user only usage.read (not entitlement.read) and, separately, only entitlement_settlement.read (not entitlement.read); attempt to view the entitlement/usage/settlement pages; per the 2026-09-16 reconciliation pass, the page gates entry solely on entitlement.read via AuthGate, so neither granted permission actually does anything
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD (this is the authorization variant)
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
- Notes: Do not assume the documented finding is still correct; execute against current code/runtime. If confirmed: classify accurately as a real, still-open product gap (category A per the reconciliation pass). Do not fix without an explicit product decision, since resolving it could mean either wiring up usage.read/entitlement_settlement.read as real independent gates (an authorization architecture change) or removing the unused permission rows entirely — both are product decisions, not a bounded bug fix.

---

## O-001: Create a New Team

- Journey ID: O-001
- Journey Name: Create a New Team
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: Team code does not yet exist
- Actions Executed: TBD
- Expected Result: Admin submits code, name, description; team is created with is_active = true by default; created_by/created_at attribution set from server session
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (very long name/description)
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

## O-002: Attempt to Create a Team With a Duplicate Code

- Journey ID: O-002
- Journey Name: Attempt to Create a Team With a Duplicate Code
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: A team with a given code already exists
- Actions Executed: TBD
- Expected Result: Admin attempts to create a second team with the same code; a uniqueness constraint rejects it with a clear error; two simultaneous submissions of the same new code result in only one success and a clean constraint violation for the other; only one teams row exists for the code afterward
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: TBD
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

## O-003: Reactivate a Deactivated Team

- Journey ID: O-003
- Journey Name: Reactivate a Deactivated Team
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: teams.is_active = false
- Actions Executed: TBD
- Expected Result: Admin clicks Activate; is_active flips true; team becomes assignable again; re-activating an already-active team is a safe no-op; existing user_teams membership rows untouched
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A
- Idempotency Result: TBD
- Audit/Data Integrity Result: N/A
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

## O-004: Deactivate an Active Team

- Journey ID: O-004
- Journey Name: Deactivate an Active Team
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: teams.is_active = true, team has active members
- Actions Executed: TBD
- Expected Result: Admin deactivates the team; team disappears from assignment pickers; user_teams rows for existing members untouched; see O-005 for the critical caveat that this does NOT retroactively affect in-flight approval capability
- Actual Result: TBD
- Regular Path Result: TBD
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

## O-005: Deactivating a Team Does NOT Block Its Existing Members From Approving In-Flight Requests

- Journey ID: O-005
- Journey Name: Deactivating a Team Does NOT Block Its Existing Members From Approving In-Flight Requests
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: team_admin (deactivates the team), M (still-active member)
- Test Data / Record References: TBD
- Starting State: A request is sitting at an Approval node whose responsible team is Team X; Team X has an active member M; Team X is deactivated while M's own membership remains unrevoked
- Actions Executed: TBD
- Expected Result: M, still an unrevoked member of the now-deactivated Team X, successfully approves the pending request; fn_require_workflow_team_membership only checks user_teams.revoked_at, never teams.is_active
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
- Notes: Catalogued as a confirmed real behavior per the grounding brief, not an invented defect; ground actual current behavior; flag to product owners regardless of outcome per the mission's Category F guidance (real gap, do not casually redesign).

---

## O-006: No Edit-Name/Description Control Exists for a Team

- Journey ID: O-006
- Journey Name: No Edit-Name/Description Control Exists for a Team
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: MANUAL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: An existing team with a name/description
- Actions Executed: TBD
- Expected Result: Only Activate/Deactivate controls are present; no "Edit name" or "Edit description" affordance anywhere, and no corresponding Server Action exists to call directly
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
- Notes: Negative-existence test; verify via code inspection of both the UI and actions.ts, not just visual absence.

---

## O-007: No Hard-Delete Control Exists for a Team

- Journey ID: O-007
- Journey Name: No Hard-Delete Control Exists for a Team
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: MANUAL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: An existing team, active or inactive
- Actions Executed: TBD
- Expected Result: No delete control exists anywhere in the team management UI; Deactivate is the only removal-like action available
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
- Notes: Negative-existence test.

---

## O-008: Assign a User to a Team

- Journey ID: O-008
- Journey Name: Assign a User to a Team
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: User is not a member of the target team
- Actions Executed: TBD
- Expected Result: Admin assigns user to team; a new user_teams row is inserted with revoked_at NULL; assigning the same active membership twice does not create a duplicate active row; created_by/granted_by attribution set; attempt without team.write (a distinct permission from user_access.write) denied
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A (see O-025)
- Idempotency Result: TBD
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

## O-009: Remove a User From a Team (Soft Revoke, Not Delete)

- Journey ID: O-009
- Journey Name: Remove a User From a Team (Soft Revoke, Not Delete)
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: User has an active user_teams row for the team
- Actions Executed: TBD
- Expected Result: Admin removes the membership; revoked_at/revoked_by set on the existing row; row never deleted; re-removing an already-revoked membership is a safe no-op; DB trigger forbids hard DELETE; fn_require_workflow_team_membership rejects this user for this team at the very next check
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A
- Idempotency Result: TBD
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

## O-010: Attempt to Un-Revoke a Team Membership in Place

- Journey ID: O-010
- Journey Name: Attempt to Un-Revoke a Team Membership in Place
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: A user_teams row with revoked_at already set
- Actions Executed: TBD
- Expected Result: Any attempt to clear revoked_at on the existing row is blocked by a DB trigger; only a brand-new membership grant restores access; both old and new rows persist as distinct historical events; no "undo removal" control exists in the UI
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD
- UX Result: TBD
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

## O-011: Set a Team Membership as Primary

- Journey ID: O-011
- Journey Name: Set a Team Membership as Primary
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: User has at least one active team membership, none flagged primary
- Actions Executed: TBD
- Expected Result: Admin flags one membership as is_primary = true; that membership is distinguished in the UI; re-setting the same membership as primary is a no-op
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

---

## O-012: Attempt to Set Two Teams as Primary for the Same User

- Journey ID: O-012
- Journey Name: Attempt to Set Two Teams as Primary for the Same User
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: User already has one membership flagged is_primary = true
- Actions Executed: TBD
- Expected Result: Admin attempts to also flag a second active membership as primary; the partial unique index blocks it (reject or atomic unflag of the first, verify actual behavior); at most one active, non-revoked user_teams row per user has is_primary = true, verified against the constraint directly
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (rapid toggling)
- Authorization Result: N/A
- Concurrency Result: TBD
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

## O-013: User Belongs to Multiple Active Teams Simultaneously

- Journey ID: O-013
- Journey Name: User Belongs to Multiple Active Teams Simultaneously
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: User has zero team memberships
- Actions Executed: TBD
- Expected Result: Admin assigns the user to Team A and Team B, both active memberships; user can act for either team; two distinct user_teams rows exist, both revoked_at NULL
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (5+ teams)
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

## O-014: Flat Membership Confirmed, No Team-Lead Concept Exists Anywhere

- Journey ID: O-014
- Journey Name: Flat Membership Confirmed, No Team-Lead Concept Exists Anywhere
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: team_admin, ordinary team member
- Test Data / Record References: TBD
- Starting State: A team with several members, all as plain members
- Actions Executed: TBD
- Expected Result: No "make lead" or "designate as lead" control exists anywhere; every member has identical approval standing; no is_lead or team_lead column exists anywhere in the schema
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
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
- Notes: Negative-existence test confirming a mechanic does NOT exist.

---

## O-015: Team Membership Removed While the Approval Page Is Open (PERMISSION-CHANGE Scenario 5)

- Journey ID: O-015
- Journey Name: Team Membership Removed While the Approval Page Is Open
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: PARTIAL
- Personas: team_admin (revokes membership), M (checker attempting to approve)
- Test Data / Record References: TBD
- Starting State: A request sits at an Approval node responsible to Team X; M is an active Team X member with the review page open
- Actions Executed: TBD
- Expected Result: Admin revokes M's Team X membership while M's page remains open; M clicks Approve; the server-side check re-evaluates fresh and rejects with WORKFLOW_TEAM_REQUIRED even though the button was fully rendered/enabled; no approval record created
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: PASS/TBD (this IS the concurrency scenario)
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
- Notes: PARTIAL automation feasibility per the Universe doc; will use a stale-open-page-plus-out-of-band-revoke pattern, matching how mid-session permission-loss journeys were tested in Batches 3-4.

---

## O-016: Team Membership Restored While the Page Is Open Clears Stale Error State (PERMISSION-CHANGE Scenario 6)

- Journey ID: O-016
- Journey Name: Team Membership Restored While the Page Is Open Clears Stale Error State
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: team_admin (restores membership), M (checker retrying)
- Test Data / Record References: TBD
- Starting State: Continuation of O-015: M just received WORKFLOW_TEAM_REQUIRED on the still-open page
- Actions Executed: TBD
- Expected Result: Admin grants M a fresh Team X membership; M refreshes to clear the stale error; M clicks Approve again; the approval succeeds cleanly with no leftover error banner; a redundant second click does not create a duplicate approval
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: TBD
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD (this IS the recovery variant)
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
- Neighboring Journeys Rerun: O-015
- Final Status: TBD
- Notes: TBD

---

## O-017: User Removed From a Team While a Request Waits on That Team (PERMISSION-CHANGE Scenario 9)

- Journey ID: O-017
- Journey Name: User Removed From a Team While a Request Waits on That Team (My Work List Updates)
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: team_admin, M
- Test Data / Record References: TBD
- Starting State: A request sits at a node responsible to Team X; M is an active Team X member and sees the request in Pending-my-approval
- Actions Executed: TBD
- Expected Result: Admin revokes M's Team X membership; M reloads My Work/Pending-my-approval; the request no longer appears; the underlying request/node assignment is unchanged, only M's visibility changes; restoring membership brings the item back on next load
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (many pending items across teams, only Team X ones disappear)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
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
- Neighboring Journeys Rerun: O-009, O-015
- Final Status: TBD
- Notes: TBD
