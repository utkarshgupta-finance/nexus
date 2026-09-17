# Batch 4 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY
VALIDATION BATCH 4 (U-019, U-020, N-001 through N-023, 25 journeys
total). Created before execution begins per the mandatory persistent
ledger requirement; updated as each journey completes.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED /
PRODUCT GAP CONFIRMED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

If a journey fails and is later fixed, both Original Status: FAILED and
Final Status: FAILED THEN FIXED + PASS are preserved. History is never
rewritten to make a journey look like it passed the first time.

---

## U-019: Deactivate User Mid-Session, Next Request Reflects Inactive State

- Journey ID: U-019
- Journey Name: Deactivate User Mid-Session, Next Request Reflects Inactive State
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: PARTIAL
- Personas: The affected user, User Access Admin
- Test Data / Record References: TBD
- Starting State: User is logged in and actively using the app in one browser tab; an admin deactivates that same user in another session
- Actions Executed: TBD
- Expected Result: Admin deactivates the user; the affected user's NEXT request resolves to "inactive" state / requirePermission(inactive) rejection, not continuing to succeed as if still active; requirePermission re-checks the CURRENT app_users.is_active state on every call, not a cached value from session establishment
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (in-flight request at exact moment of deactivation)
- Authorization Result: TBD (this journey IS the authorization/concurrency variant)
- Concurrency Result: TBD (this journey IS the concurrency variant)
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
- Notes: Requires two concurrent sessions/timing control; PARTIAL automation feasibility per the Universe doc. Directly builds on Batch 3's U-007 (inactive state) and N-006 (deactivate an active user).

---

## U-020: Multiple Concurrent Sessions for the Same User Across Two Browsers

- Journey ID: U-020
- Journey Name: Multiple Concurrent Sessions for the Same User Across Two Browsers
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: Single user, using two clients
- Test Data / Record References: TBD
- Starting State: The same user is logged in simultaneously in two different browsers/devices
- Actions Executed: TBD
- Expected Result: Both sessions independently reflect the same active state and roles/permissions; an admin deactivation while both are open eventually resolves BOTH sessions to "inactive" on their next request, not just one; actions from either session are attributed to the same actor_user_id
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: TBD
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
- Notes: Requires two real concurrent browser sessions in test; PARTIAL automation feasibility per the Universe doc. Where the Browser pane cannot maintain two separate cookie jars, one real browser session plus a faithfully-equivalent backend action stand in, disclosed here per the mission's concurrency-testing rule.

---

## N-001: User List Merges Supabase Auth Identities With app_users Rows

- Journey ID: N-001
- Journey Name: User List Merges Supabase Auth Identities With app_users Rows
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: Supabase Auth contains a mix of provisioned (has app_users row) and unprovisioned (auth-only) identities
- Actions Executed: TBD
- Expected Result: Admin opens /settings/user-access; list renders both provisioned rows (with role/team/status) and unprovisioned rows (with only a Provision Access affordance); list is a merge, not a join, of auth.users and app_users; no row is silently dropped
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A (covered by N-015)
- Authorization Result: TBD
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

## N-002: Provision Access Button Shown Only for Unprovisioned Identities

- Journey ID: N-002
- Journey Name: Provision Access Button Shown Only for Unprovisioned Identities
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: One auth user unprovisioned, one already provisioned
- Actions Executed: TBD
- Expected Result: Provision Access button renders for the unprovisioned row only; already-provisioned row shows normal management controls instead; button absent post-provisioning without a page refresh
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

## N-003: Provision Access Creates app_users Row Keyed to Same UUID

- Journey ID: N-003
- Journey Name: Provision Access Creates app_users Row Keyed to Same UUID
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: Auth user exists, no app_users row
- Actions Executed: TBD
- Expected Result: Admin clicks Provision Access; provision_app_user inserts app_users with id = auth.users.id; user immediately appears as a normal provisioned row; attempt without user_access.write denied server-side even if button somehow rendered; two admins clicking nearly simultaneously must not create a duplicate; re-invoking for an already-provisioned id must not create a second row
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: TBD
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

## N-004: Edit a User's Display Name

- Journey ID: N-004
- Journey Name: Edit a User's Display Name
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: Provisioned active user with an existing display name
- Actions Executed: TBD
- Expected Result: Admin edits display name via set_app_user_display_name; new name reflected immediately; attempt without user_access.write denied; re-submitting the same name is a no-op; app_users.updated_by/updated_at reflect the editing admin, not the edited user; email is never touched
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (unicode/emoji/very long name)
- Authorization Result: TBD
- Concurrency Result: N/A
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

## N-005: Reactivate a Deactivated User

- Journey ID: N-005
- Journey Name: Reactivate a Deactivated User
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: app_users.is_active = false
- Actions Executed: TBD
- Expected Result: Admin clicks Activate; set_app_user_active flips is_active true; user regains session state "active" on next request; attempt without user_access.write denied; re-activating an already-active user is a safe no-op; updated_by/updated_at set to acting admin; prior role/team grants remain intact, not re-created
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
- Notes: Already partially exercised live in Batch 3's U-007 rerun (reactivation of wf-test.inactive); this journey formalizes and completes that coverage from the admin-action side.

---

## N-006: Deactivate an Active User

- Journey ID: N-006
- Journey Name: Deactivate an Active User
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: app_users.is_active = true, user has active roles
- Actions Executed: TBD
- Expected Result: Admin clicks Deactivate; set_app_user_active flips is_active false; user's next session resolution returns "inactive" state; attempt without user_access.write denied; re-deactivating an already-inactive user is a safe no-op; role/team grant rows are untouched (not revoked), only is_active changes; requirePermission returns "inactive" reason immediately for any subsequent call
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A (mid-action variant is AB-033, out of this batch's scope)
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

## N-007: Admin Deactivates Their Own Account

- Journey ID: N-007
- Journey Name: Admin Deactivates Their Own Account
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: user_access_admin (acting on self)
- Test Data / Record References: TBD
- Starting State: Acting admin is active with user_access_admin role
- Actions Executed: TBD
- Expected Result: Admin deactivates their own row; their own subsequent requests resolve to inactive and they are logged out of privileged views; updated_by correctly shows the admin's own id as actor; no implicit protection against removing the last admin (documented, accepted gap, not to be "fixed")
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD (org may need a second admin; verify no special guard exists, do not invent one)
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
- Notes: Mirrors O-018 (last remaining team member) for the admin role itself. Test carefully: must not leave the shared dev environment with zero usable admin accounts; use a dedicated throwaway admin persona for this journey, not the primary test admin used across other journeys.

---

## N-008: Grant a Role to a User

- Journey ID: N-008
- Journey Name: Grant a Role to a User
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: User has zero roles
- Actions Executed: TBD
- Expected Result: Admin selects a role and grants via grant_user_role; a new user_roles row is inserted with scope_resource_id NULL; user's next session carries the new permission set; attempt without user_access.write denied; granting the same role twice while the first grant is still active is either rejected or does not create a duplicate active grant; user_roles row carries granted_by attribution; scope_resource_id remains NULL
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (granting many roles in quick succession)
- Authorization Result: TBD
- Concurrency Result: N/A
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

## N-009: Revoke a Role From a User (Soft Revoke, Not Delete)

- Journey ID: N-009
- Journey Name: Revoke a Role From a User (Soft Revoke, Not Delete)
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: User holds an active role grant
- Actions Executed: TBD
- Expected Result: Admin revokes the role via revoke_user_role; the row's revoked_at/revoked_by are set; row is never deleted; attempt without user_access.write denied; re-revoking an already-revoked grant is a safe no-op; a DB trigger forbids hard DELETE on user_roles; revoked grant remains visible in history with correct revoked_at/revoked_by
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

## N-010: Attempt to Un-Revoke a Role Grant in Place

- Journey ID: N-010
- Journey Name: Attempt to Un-Revoke a Role Grant in Place
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: A user_roles row with revoked_at already set
- Actions Executed: TBD
- Expected Result: Any attempt to clear revoked_at on the existing row directly, or via any control implying "undo revoke," is blocked by a DB trigger; admin must instead grant a fresh role row to restore access; original revoked row's revoked_at/revoked_by are never cleared or overwritten; UI does not offer an "undo revoke" control; both the old revoked row and new grant row persist as two distinct historical events
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

## N-011: Assign Multiple Roles to the Same User

- Journey ID: N-011
- Journey Name: Assign Multiple Roles to the Same User
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: User already holds one active role
- Actions Executed: TBD
- Expected Result: Admin grants a second, different role; user's effective permission set is the union of both roles' permissions; two independent user_roles rows exist, each with its own attribution; list page shows both roles clearly
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

## N-012: Checker Role Grants Maker's Full Permission Set Plus Approve

- Journey ID: N-012
- Journey Name: Checker Role Grants Maker's Full Permission Set Plus Approve
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: maker, checker
- Test Data / Record References: TBD
- Starting State: One user with maker role, one user with checker role, same domain
- Actions Executed: TBD
- Expected Result: Checker's effective permission set equals maker's set plus the domain's approve permission; every action maker can do, checker can also do; role_permissions rows for checker include every row maker has, plus one additional approve row; superset relationship is structural, verifiable directly against role_permissions
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
- Notes: TBD

---

## N-013: Self-Grant of an Elevated Role via user_access.write (Documented Gap)

- Journey ID: N-013
- Journey Name: Self-Grant of an Elevated Role via user_access.write (Documented Gap)
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: User holds only user_access_admin role (has user_access.write)
- Actions Executed: TBD
- Expected Result: Admin opens their own user row and grants themselves an elevated role via grant_user_role; the grant succeeds with no additional confirmation or restriction (this is the documented, accepted authorization boundary being tested, not a bug); the resulting user_roles row correctly attributes granted_by to the same user id as the grantee, making the self-grant auditable after the fact; no RPC-level check compares grantor id to grantee id for role grants
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
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
- Notes: This is catalogued as a real, intentional gap per the grounding brief, not to be "fixed" without an explicit product decision. Ground actual current behavior; do not assume the documented finding is stale.

---

## N-014: Granting a Role Elevates Privilege Mid-Session for the Grantee

- Journey ID: N-014
- Journey Name: Granting a Role Elevates Privilege Mid-Session for the Grantee
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: user_access_admin (grantor), maker (grantee)
- Test Data / Record References: TBD
- Starting State: Grantee is logged in with a session lacking a given permission
- Actions Executed: TBD
- Expected Result: Admin grants grantee a new role; grantee performs an action requiring the new permission in their already-open session without re-login; requirePermission re-checks fresh and allows it; no permission caching, every server call re-derives the session and permission set fresh
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: TBD (grant lands while grantee's page is mid-load)
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
- Notes: This is the direct converse of Batch 3's mid-session-permission-loss scenarios (already confirmed live for revocation in this codebase's architecture); this journey specifically tests the grant direction.

---

## N-015: User List Behavior Near the 200-User Cap

- Journey ID: N-015
- Journey Name: User List Behavior Near the 200-User Cap
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: PARTIAL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: Org has at or near 200 total Supabase Auth users
- Actions Executed: TBD
- Expected Result: List caps at 200 entries; behavior at/above the boundary is verified honestly (which 200, any indication more exist); admin is not misled into thinking the list is complete; cap is enforced at query time, not silently dropped client-side
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (org has significantly more than 200 auth users)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: TBD
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: PARTIAL automation feasibility per the Universe doc (creating ~200 real test users is impractical); verify via code inspection of the actual query limit plus a small-scale functional check, not a literal 200-user seed.

---

## N-016: Email Is Always Read Live From Supabase Auth, Never Stored on app_users

- Journey ID: N-016
- Journey Name: Email Is Always Read Live From Supabase Auth, Never Stored on app_users
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: A provisioned user with a known email in Supabase Auth
- Actions Executed: TBD
- Expected Result: Email is changed in Supabase Auth directly; next load of /settings/user-access shows the new email immediately with no app_users write required; app_users table has no email column at all (confirm via schema, not just UI); no stale cached email can ever be displayed
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
- Notes: TBD

---

## N-017: Unauthenticated State Renders Honest Denial

- Journey ID: N-017
- Journey Name: Unauthenticated State Renders Honest Denial
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: anonymous visitor
- Test Data / Record References: TBD
- Starting State: No Supabase Auth cookie/session present
- Actions Executed: TBD
- Expected Result: Visitor navigates to any AuthGate-wrapped route; getCurrentNexusSession returns "unauthenticated"; AuthGate shows the unauthenticated-specific message, not a generic access-denied page; message text is distinct from unprovisioned/inactive messages
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
- Notes: Already proven live and repeatedly in Batch 3 (U-004, and every un-authenticated deep-link test); this entry re-confirms on /settings/user-access specifically since N-001 through N-016 are new routes this batch introduces.

---

## N-018: Unavailable Session State Renders Honest Denial

- Journey ID: N-018
- Journey Name: Unavailable Session State Renders Honest Denial
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: PARTIAL
- Personas: any logged-in user experiencing a transient outage
- Test Data / Record References: TBD
- Starting State: Supabase Auth session lookup fails transiently
- Actions Executed: TBD
- Expected Result: getCurrentNexusSession returns "unavailable"; AuthGate shows a distinct message indicating a temporary problem, inviting retry, rather than telling the user to log in; once the underlying failure clears, the very next request resolves to the correct real state without requiring logout; unavailable is a first-class state, not an error swallowed into unauthenticated
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
- Notes: Same PARTIAL/code-review-based verification approach as Batch 3's U-008 (this is the identical underlying AuthGate branch, now confirmed applicable on /settings/user-access too, a new route this batch adds).

---

## N-019: Unprovisioned State Renders Honest Denial

- Journey ID: N-019
- Journey Name: Unprovisioned State Renders Honest Denial
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: newly-invited employee, not yet provisioned
- Test Data / Record References: TBD
- Starting State: Valid Supabase Auth session, no app_users row exists for this id
- Actions Executed: TBD
- Expected Result: getCurrentNexusSession returns "unprovisioned"; AuthGate shows a message indicating the account exists in Auth but has not been granted app access, distinct from inactive/unauthenticated wording; after an admin provisions the user (N-003), the very next request resolves to unprovisioned no longer
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
- Notes: Already proven live in Batch 3 (U-006); this entry confirms the same on /settings/user-access and re-confirms the recovery path (N-003's provisioning) resolves it.

---

## N-020: Inactive State Renders Honest Denial

- Journey ID: N-020
- Journey Name: Inactive State Renders Honest Denial
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: deactivated former employee
- Test Data / Record References: TBD
- Starting State: app_users.is_active = false for this user
- Actions Executed: TBD
- Expected Result: getCurrentNexusSession returns "inactive"; AuthGate shows a message indicating the account has been deactivated, distinct from other denial reasons; after reactivation (N-005), the very next request resolves to active, correctly carrying roles/permissions again
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
- Notes: Already proven live in Batch 3 (U-007); this entry confirms the same on /settings/user-access and re-confirms the recovery path (N-005's reactivation) resolves it.

---

## N-021: Active State With Zero Role Grants

- Journey ID: N-021
- Journey Name: Active State With Zero Role Grants
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: newly provisioned user awaiting role assignment
- Test Data / Record References: TBD
- Starting State: app_users row exists, is_active = true, zero rows in user_roles
- Actions Executed: TBD
- Expected Result: getCurrentNexusSession returns "active" with empty roles/permissions arrays; every AuthGate-wrapped route the user visits denies with missing_permission, never with unprovisioned or inactive; hasPermission returns false for every resource/action pair; requirePermission throws missing_permission for all of them; the five-state union does not conflate "no roles" with any account-level state
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD
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
- Notes: Already proven live in Batch 3 (U-009, U-013 using wf-test.restricted); this entry formalizes that same evidence under N-021's own ID and confirms it applies specifically to /settings/user-access as well.

---

## N-022: Revoking a role_permissions Row Disables That Permission for All Holders Instantly

- Journey ID: N-022
- Journey Name: Revoking a role_permissions Row Disables That Permission for All Holders Instantly
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: user_access_admin (acting on role definition), multiple makers
- Test Data / Record References: TBD
- Starting State: A role (e.g. maker) grants permission X to all its holders; multiple users hold this role
- Actions Executed: TBD
- Expected Result: Admin revokes permission X from the role definition; every user holding that role immediately loses permission X on their very next server action, with no per-user change needed; role_permissions row itself is soft-revoked (revoked_at/revoked_by), not deleted; the permission chain query filters role_permissions.revoked_at IS NULL on every check, with no caching
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (role held by many users simultaneously)
- Authorization Result: N/A
- Concurrency Result: TBD (a holder's action in flight when revoked)
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

## N-023: Deactivating a Role (is_active = false) Disables It for All Holders Instantly

- Journey ID: N-023
- Journey Name: Deactivating a Role (is_active = false) Disables It for All Holders Instantly
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: TBD
- Starting State: A role is_active = true and held by multiple users
- Actions Executed: TBD
- Expected Result: Admin sets roles.is_active = false; every user holding that role immediately loses all permissions derived from it on their next request, even though their individual user_roles grant is untouched; user_roles rows for affected users remain unchanged; re-activating the role restores permissions to all original holders immediately, with no need to re-grant individually; the permission chain query filters roles.is_active on every check
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
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
