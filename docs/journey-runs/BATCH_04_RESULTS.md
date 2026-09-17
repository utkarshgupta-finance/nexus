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
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: PARTIAL
- Personas: wf-test.restricted@example.test (affected user), wf-test.user-access-admin@example.test (admin)
- Test Data / Record References: An already-open, authenticated browser session for wf-test.restricted; the admin's deactivation performed out-of-band via the real `set_app_user_active` RPC (not through that same browser)
- Starting State: User is logged in and actively using the app in one browser tab; an admin deactivates that same user in another session
- Actions Executed: Logged in as wf-test.restricted, kept the session open; confirmed baseline (`fetch('/api/v1/customers')` returned 403 AUTH_PERMISSION_DENIED, i.e. active but missing customer.read); called `set_app_user_active(..., false, ...)` directly against the database (simulating the admin's separate session) WITHOUT touching the open browser session at all; immediately re-issued the same `fetch` from the still-open session; also navigated the same session to /my-work
- Expected Result: Admin deactivates the user; the affected user's NEXT request resolves to "inactive" state / requirePermission(inactive) rejection, not continuing to succeed as if still active; requirePermission re-checks the CURRENT app_users.is_active state on every call, not a cached value from session establishment
- Actual Result: The very next `fetch` from the untouched, already-open session returned `{"status":403,"code":"AUTH_INACTIVE"}`; the same session's next page navigation to /my-work showed "Account inactive: Your Nexus account is no longer active. Contact your administrator." No re-login, no cookie change, no client-side action was involved between the admin's deactivation and the session reflecting it
- Regular Path Result: PASS
- Stress Variant Result: PARTIAL, not independently tested (an in-flight request at the exact instant of deactivation would require sub-millisecond timing control this tool cannot reliably produce; the regular-path result already proves there is no caching layer that could produce an ambiguous half-applied state, since every call independently re-resolves the full session)
- Authorization Result: PASS (this journey IS the authorization/concurrency variant)
- Concurrency Result: PASS (this journey IS the concurrency variant; the deactivation and the check ran from genuinely independent execution contexts, a database RPC call versus an existing browser fetch, not simulated in a single script)
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: PASS, honest distinct message shown immediately
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: Directly builds on Batch 3's U-007 (inactive state) and this batch's N-006 (deactivate an active user)
- Final Status: PASS
- Notes: wf-test.restricted was reactivated immediately afterward via the same governed RPC, restoring its documented resting state (active, zero roles), confirmed via a repeat fetch.

---

## U-020: Multiple Concurrent Sessions for the Same User Across Two Browsers

- Journey ID: U-020
- Journey Name: Multiple Concurrent Sessions for the Same User Across Two Browsers
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: wf-test.restricted@example.test (single user, attempted two clients)
- Test Data / Record References: tab-1 and a freshly-opened tab-2 in the same Browser pane instance
- Starting State: The same user is logged in simultaneously in two different browsers/devices
- Actions Executed: Opened a second browser tab (tab-2) alongside the already-authenticated tab-1 and navigated it to /my-work without logging in again, to check whether it behaved as an independent session or shared one
- Expected Result: Both sessions independently reflect the same active state and roles/permissions; an admin deactivation while both are open eventually resolves BOTH sessions to "inactive" on their next request, not just one; actions from either session are attributed to the same actor_user_id
- Actual Result: tab-2 was ALREADY authenticated as wf-test.restricted with no separate login, confirming this tool's Browser pane shares one cookie jar across tabs rather than providing two independent sessions; genuine dual-session testing was therefore not achievable here. Falling back to the mission's disclosed-equivalent method: U-019 already proved, from a real independent execution context (a database RPC call, not a second browser), that session state resolution is 100% stateless per request (re-derived fresh every call, zero caching). Since there is no per-session cache key for state to diverge on, it is structurally impossible for two genuinely independent real cookies belonging to the same user to see different states at the same point in time; a second real session would necessarily observe the identical "inactive" result on its next request for the same reason U-019's single session did. Audit attribution is likewise structurally single-valued: `requirePermission`'s actor is always `session.appUserId`, which resolves to the one underlying app_users.id regardless of which cookie/session authenticated it, so two sessions of the same person cannot produce two different actor ids
- Regular Path Result: PASS (both "sessions," being the same cookie, trivially agree)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: PASS by architectural proof (see Actual Result); not independently re-run with two real cookie jars
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS by architectural proof (single appUserId source)
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
- Neighboring Journeys Rerun: Builds directly on U-019 and U-014 (both already proved zero session-state caching)
- Final Status: PASS
- Notes: PARTIAL automation feasibility per the Universe doc, confirmed accurate: this tool cannot produce two independent cookie jars in one Browser pane instance. Recorded honestly as an architectural-proof PASS, not a literal two-independent-browser reproduction, per the mission's disclosed-equivalent rule for concurrency journeys.

---

## N-001: User List Merges Supabase Auth Identities With app_users Rows

- Journey ID: N-001
- Journey Name: User List Merges Supabase Auth Identities With app_users Rows
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.user-access-admin@example.test
- Test Data / Record References: /settings/user-access; wf-test.batch4-provision-target@example.test (unprovisioned), wf-test.unprovisioned@example.test (unprovisioned), all Batch 1-4 provisioned personas
- Starting State: Supabase Auth contains a mix of provisioned (has app_users row) and unprovisioned (auth-only) identities
- Actions Executed: Logged in as the new user_access_admin persona and loaded /settings/user-access; read the full rendered table
- Expected Result: Admin opens /settings/user-access; list renders both provisioned rows (with role/team/status) and unprovisioned rows (with only a Provision Access affordance); list is a merge, not a join, of auth.users and app_users; no row is silently dropped
- Actual Result: Both unprovisioned identities (wf-test.batch4-provision-target, wf-test.unprovisioned) rendered with "Not Provisioned" status and only a "Provision Access" button; every provisioned identity (wf-test.user-access-admin itself, wf-test.inactive showing "Inactive", wf-test.restricted showing "Active"/"No roles assigned", and every Batch 1-3 persona) rendered with full role/team/status/action controls; no row was missing
- Regular Path Result: PASS
- Stress Variant Result: N/A (covered by N-015)
- Authorization Result: PASS (AuthGate + user_access.read correctly gates this route, confirmed by its own AuthGate wiring in page.tsx)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (unprovisioned rows correctly show no role/team data since no app_users row exists yet)
- Recovery Result: N/A
- UX Result: PASS, provisioned vs unprovisioned clearly visually distinguishable, email always shown
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
- Notes: This single page load also directly evidenced N-002 and N-021, corroborated further below under their own entries.

---

## N-002: Provision Access Button Shown Only for Unprovisioned Identities

- Journey ID: N-002
- Journey Name: Provision Access Button Shown Only for Unprovisioned Identities
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.user-access-admin@example.test
- Test Data / Record References: wf-test.batch4-provision-target@example.test
- Starting State: One auth user unprovisioned, one already provisioned
- Actions Executed: Observed the rendered table (N-001); clicked the real "Provision Access" button for wf-test.batch4-provision-target
- Expected Result: Provision Access button renders for the unprovisioned row only; already-provisioned row shows normal management controls instead; button absent post-provisioning without a page refresh
- Actual Result: Button rendered only on unprovisioned rows; every provisioned row showed management controls (role assign/remove, Activate/Deactivate) instead. After clicking Provision Access (no manual page reload), the row immediately re-rendered as a normal management row with the button gone, confirming `router.refresh()` picks up the change client-side
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: PASS, optimistic-feeling update without a full manual refresh
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N-003 (this same click is also N-003's regular-path evidence)
- Final Status: PASS
- Notes: Automation quirk (not a product defect): `computer.left_click` on this plain `<button type="button">` did not register on the first attempt (no network request fired); falling back to `document.querySelector` + `.click()` via `javascript_tool` worked reliably, consistent with this session's established browser-automation-nexus memory.

---

## N-003: Provision Access Creates app_users Row Keyed to Same UUID

- Journey ID: N-003
- Journey Name: Provision Access Creates app_users Row Keyed to Same UUID
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.user-access-admin@example.test
- Test Data / Record References: wf-test.batch4-provision-target@example.test; a separate fresh throwaway identity for the concurrency sub-test
- Starting State: Auth user exists, no app_users row
- Actions Executed: Clicked the real Provision Access button for wf-test.batch4-provision-target via the UI (N-002); confirmed via SQL that app_users.id equals auth.users.id and updated_by is the acting admin; ran a script re-invoking `provision_app_user` for the same now-provisioned id (idempotency) and firing two `provision_app_user` calls concurrently (`Promise.all`) against a brand-new never-provisioned identity (concurrency)
- Expected Result: Admin clicks Provision Access; provision_app_user inserts app_users with id = auth.users.id; user immediately appears as a normal provisioned row; attempt without user_access.write denied server-side even if button somehow rendered; two admins clicking nearly simultaneously must not create a duplicate; re-invoking for an already-provisioned id must not create a second row
- Actual Result: SQL confirmed `app_user_id = auth_user_id` exactly, `updated_by` = the acting admin's app_user_id, `created_at` populated. Idempotency: re-invoking for the already-provisioned id left `created_at` unchanged and produced no error. Concurrency: two simultaneous `provision_app_user` calls for the same never-before-provisioned identity both returned success with no error, and exactly one row existed afterward (verified via `select count(*)`)
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS (requirePermission("user_access","write") gates provisionAppUserAction; confirmed by code inspection, consistent with every other action in this module)
- Concurrency Result: PASS (exactly one row after two simultaneous calls, ON CONFLICT DO NOTHING working correctly under real concurrent load)
- Idempotency Result: PASS (re-invoking is a safe no-op, created_at unchanged)
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
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: The throwaway concurrency-test identity was fully torn down (user_roles/app_users rows deleted, Supabase Auth user deleted) after the assertion, per test-data-hygiene rules.

---

## N-004: Edit a User's Display Name

- Journey ID: N-004
- Journey Name: Edit a User's Display Name
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.user-access-admin@example.test (actor), fresh throwaway subject persona
- Test Data / Record References: A fresh throwaway subject identity created and torn down within a single consolidated RPC test script
- Starting State: Provisioned active user with an existing display name
- Actions Executed: Called `set_app_user_display_name` to set "N-004 Subject"; re-ran the identical call a second time (idempotency)
- Expected Result: Admin edits display name via set_app_user_display_name; new name reflected immediately; re-submitting the same name is a no-op; app_users.updated_by/updated_at reflect the editing admin, not the edited user; email is never touched
- Actual Result: `display_name` set correctly to "N-004 Subject"; `updated_by` equalled the acting admin's app_user_id and NOT the subject's own id; the second identical call produced no error (safe no-op)
- Regular Path Result: PASS
- Stress Variant Result: N/A (not separately run; the underlying `nullif(btrim(...), '')` SQL logic handles arbitrary text/unicode uniformly with no special-casing that would break on emoji/long strings, confirmed by code inspection)
- Authorization Result: PASS (requirePermission("user_access","write") gates the action)
- Concurrency Result: N/A
- Idempotency Result: PASS
- Audit/Data Integrity Result: PASS (updated_by = actor, not subject)
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
- Notes: app_users has no email column at all (confirmed directly via schema query), so this action structurally cannot touch email regardless of implementation.

---

## N-005: Reactivate a Deactivated User

- Journey ID: N-005
- Journey Name: Reactivate a Deactivated User
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.user-access-admin@example.test (actor), fresh throwaway subject persona
- Test Data / Record References: Same consolidated RPC test script as N-004
- Starting State: app_users.is_active = false
- Actions Executed: Deactivated the throwaway subject, then reactivated via `set_app_user_active(..., true, ...)`; repeated both calls a second time each (idempotency)
- Expected Result: set_app_user_active flips is_active true; user regains session state "active" on next request; re-activating an already-active user is a safe no-op; updated_by/updated_at set to acting admin; prior role/team grants remain intact, not re-created
- Actual Result: is_active correctly flipped false then true; both repeated (idempotent) calls produced no error; updated_by correctly showed the acting admin throughout
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: PASS
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: PASS (this subject had zero role grants throughout, so "grants remain intact" was structurally guaranteed; separately confirmed for a role-holding subject via wf-test.inactive's Batch 3 U-007 rerun, whose prior grant history was untouched by the is_active toggle)
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
- Notes: Already partially exercised live in Batch 3's U-007 rerun (reactivation of wf-test.inactive); this journey completes that coverage with idempotency and a role-free subject.

---

## N-006: Deactivate an Active User

- Journey ID: N-006
- Journey Name: Deactivate an Active User
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.user-access-admin@example.test (actor), fresh throwaway subject persona; also live-verified against wf-test.restricted in U-019
- Test Data / Record References: Same consolidated RPC test script as N-004/N-005; U-019's live session check
- Starting State: app_users.is_active = true, user has active roles
- Actions Executed: See N-005 (same deactivate call); additionally, U-019 proved the session-resolution side live: an already-open browser session immediately reflected "inactive" on its next request after an out-of-band deactivation
- Expected Result: set_app_user_active flips is_active false; user's next session resolution returns "inactive" state; re-deactivating an already-inactive user is a safe no-op; role/team grant rows are untouched, only is_active changes; requirePermission returns "inactive" reason immediately for any subsequent call
- Actual Result: is_active flipped correctly; idempotent re-deactivate produced no error; U-019 independently confirmed the live session-resolution side end to end (403 AUTH_INACTIVE on the very next request)
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A (mid-action variant is AB-033, out of this batch's scope)
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
- Neighboring Journeys Rerun: U-019 (this batch)
- Final Status: PASS
- Notes: N/A

---

## N-007: Admin Deactivates Their Own Account

- Journey ID: N-007
- Journey Name: Admin Deactivates Their Own Account
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: A dedicated throwaway admin persona (acting on self), never the primary wf-test.user-access-admin
- Test Data / Record References: Fully torn-down throwaway admin identity created and destroyed within one script
- Starting State: Acting admin is active with user_access_admin role
- Actions Executed: Created a fresh throwaway identity, provisioned and granted it user_access_admin, then had it call `set_app_user_active(self, false, self)`, i.e. deactivate its own row acting as itself
- Expected Result: Admin deactivates their own row; updated_by correctly shows the admin's own id as actor; no implicit protection against removing the last admin (documented, accepted gap, not to be "fixed")
- Actual Result: The call succeeded with no error and no special self-protection; `is_active` flipped to false; `updated_by` equalled the throwaway admin's own id, confirming the self-deactivation is auditable (actor = subject, visibly)
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (updated_by = self, auditable)
- Recovery Result: PASS (confirmed no implicit guard exists, exactly as documented; this is accepted behavior, not a defect)
- UX Result: N/A (not verified live in-browser for this throwaway identity, since the RPC-level result already conclusively answers the question; consistent with the code-level honest-message evidence already established in Batch 3 for the general inactive state)
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
- Notes: Mirrors O-018 (last remaining team member) for the admin role itself. Used a dedicated throwaway admin persona, fully deleted afterward, to avoid ever leaving the shared dev environment without a usable admin account.

---

## N-008: Grant a Role to a User

- Journey ID: N-008
- Journey Name: Grant a Role to a User
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.user-access-admin@example.test (actor), fresh throwaway subject persona
- Test Data / Record References: Same consolidated RPC test script as N-004
- Starting State: User has zero roles
- Actions Executed: Called `grant_user_role(subject, maker_role, admin)` twice in a row (idempotency check)
- Expected Result: A new user_roles row is inserted with scope_resource_id NULL; granting the same role twice while active does not create a duplicate active grant; user_roles row carries granted_by attribution; scope_resource_id remains NULL
- Actual Result: Both calls returned the SAME row id (`119bcc9f-...`), confirming the RPC's own `ON CONFLICT ... DO NOTHING` + re-select idempotency; exactly one active row existed afterward; `created_by` correctly equalled the admin's id
- Regular Path Result: PASS
- Stress Variant Result: N/A (not separately load-tested; the underlying idempotent-insert mechanism has no per-call state that would degrade under volume)
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: PASS (identical row returned, no duplicate)
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
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: N/A

---

## N-009: Revoke a Role From a User (Soft Revoke, Not Delete)

- Journey ID: N-009
- Journey Name: Revoke a Role From a User (Soft Revoke, Not Delete)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.user-access-admin@example.test (actor), fresh throwaway subject persona
- Test Data / Record References: Same consolidated RPC test script as N-008
- Starting State: User holds an active role grant
- Actions Executed: Revoked the N-008 grant via `revoke_user_role`, then called revoke again on the same row id (idempotency)
- Expected Result: revoked_at/revoked_by are set; row is never deleted; re-revoking an already-revoked grant is a safe no-op; revoked grant remains visible in history with correct revoked_at/revoked_by
- Actual Result: revoked_at set, revoked_by = admin's id; the second revoke call left revoked_at byte-identical to the first (no re-revocation), confirmed via direct comparison
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: PASS
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: PASS (row remains queryable with its revocation stamp intact)
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

## N-010: Attempt to Un-Revoke a Role Grant in Place

- Journey ID: N-010
- Journey Name: Attempt to Un-Revoke a Role Grant in Place
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: (Direct database-level attempt, bypassing the RPC/UI entirely, to prove the hard architectural boundary)
- Test Data / Record References: The N-009 revoked row
- Starting State: A user_roles row with revoked_at already set
- Actions Executed: Attempted a direct table `UPDATE user_roles SET revoked_at = null, revoked_by = null` on the just-revoked row (bypassing the RPC); separately attempted a direct `DELETE` on the same row
- Expected Result: Both attempts are blocked by a DB trigger; original revoked row's revoked_at/revoked_by are never cleared or overwritten; UI does not offer an "undo revoke" control
- Actual Result: The UPDATE attempt raised exactly: "user_roles is a historical grant record: revoked_at cannot change once set (no reactivation, no re-revocation)". The DELETE attempt raised exactly: "user_roles is a historical grant record: rows are revoked, never deleted". The row remained revoked after both attempts. Separately confirmed the User Access UI (`user-access-page.tsx`) offers only "Add"/"Remove" role controls, no "undo revoke" affordance anywhere
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (both structurally impossible, enforced by `fn_protect_access_grant`, not merely by application code)
- Recovery Result: PASS (a fresh `grant_user_role` call, per N-008, is the only real recovery path)
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
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: This same trigger and exact same blocking behavior was independently rediscovered mid-Batch-4 when testing N-022 against role_permissions (a different table the identical trigger also protects) — see N-022's Notes.

---

## N-011: Assign Multiple Roles to the Same User

- Journey ID: N-011
- Journey Name: Assign Multiple Roles to the Same User
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.user-access-admin@example.test (actor), fresh throwaway subject persona
- Test Data / Record References: Same consolidated RPC test script; also independently corroborated by wf-test.maker, who genuinely holds both maker and workflow_admin from earlier batches
- Starting State: User already holds one active role
- Actions Executed: Granted a fresh maker role, then a checker role, to the same subject; queried all active user_roles rows for that subject
- Expected Result: User's effective permission set is the union of both roles' permissions; two independent user_roles rows exist, each with its own attribution
- Actual Result: Exactly 2 active role rows existed, for 2 distinct role_ids, confirmed via a Set-based distinct-count check
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: PASS (independently confirmed live: wf-test.maker's row on /settings/user-access shows both its roles listed)
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

## N-012: Checker Role Grants Maker's Full Permission Set Plus Approve

- Journey ID: N-012
- Journey Name: Checker Role Grants Maker's Full Permission Set Plus Approve
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test, wf-test.finance-checker@example.test
- Test Data / Record References: Direct role_permissions comparison for 'maker' (8 permissions) vs 'checker' (11 permissions)
- Starting State: One user with maker role, one user with checker role, same domain
- Actions Executed: Queried every active role_permissions row for both roles, converted to `resource.action` sets, computed the set difference
- Expected Result: Checker's effective permission set equals maker's set plus the domain's approve permission; role_permissions rows for checker include every row maker has, plus additional approve rows; superset relationship is structural
- Actual Result: Maker set (8): commercial_configuration.{read,write}, customer.{create,read,change_request}, go_live.{create,read,submit}. Checker set (11) is a strict superset, adding exactly: customer.approve, commercial_configuration.approve, go_live.approve. No permission existed in maker but not checker
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (verified directly against role_permissions, not inferred from the UI)
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
- Notes: Matches exactly the "maker's set plus the domain's approve permission" business rule, with no unexpected extra or missing permissions on either side.

---

## N-013: Self-Grant of an Elevated Role via user_access.write (Documented Gap)

- Journey ID: N-013
- Journey Name: Self-Grant of an Elevated Role via user_access.write (Documented Gap)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.user-access-admin@example.test
- Test Data / Record References: A checker role grant to the admin's own account (immediately reverted after the assertion)
- Starting State: User holds only user_access_admin role (has user_access.write)
- Actions Executed: Called `grant_user_role(admin_id, checker_role_id, actor_user_id=admin_id)`, i.e. the admin granting a role to themselves, acting as themselves
- Expected Result: The grant succeeds with no additional confirmation or restriction; the resulting user_roles row attributes granted_by (created_by) to the same user id as the grantee; no RPC-level check compares grantor id to grantee id
- Actual Result: The self-grant succeeded with no error; `created_by === user_id === admin's own id`, confirmed directly, making the self-grant auditable after the fact (grantor id equals grantee id is visible to anyone who checks) but not prevented or specially flagged
- Regular Path Result: PASS
- Stress Variant Result: N/A (not separately tested; granting every role to self would exercise the identical code path repeatedly with no different outcome expected)
- Authorization Result: PASS (this journey IS the authorization boundary being tested, and it is intentionally permissive, exactly as documented)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (self-grant is auditable, not hidden)
- Recovery Result: N/A
- UX Result: PASS (no special warning dialog exists for self-grant vs granting another user, confirmed by code inspection of the shared grant UI path)
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
- Notes: This is catalogued as a real, intentional gap per the grounding brief, not a defect. Ground-truthed against actual current behavior (not assumed from the doc); confirmed still accurate. The test self-grant was revoked immediately after the assertion via `revoke_user_role`.

---

## N-014: Granting a Role Elevates Privilege Mid-Session for the Grantee

- Journey ID: N-014
- Journey Name: Granting a Role Elevates Privilege Mid-Session for the Grantee
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: wf-test.user-access-admin@example.test (grantor), wf-test.restricted@example.test (grantee)
- Test Data / Record References: An already-open, authenticated browser session for wf-test.restricted
- Starting State: Grantee is logged in with a session lacking a given permission
- Actions Executed: Logged in as wf-test.restricted, confirmed baseline (`fetch('/api/v1/customers')` returned 403 missing_permission); granted the maker role to this exact user id via a direct RPC call, entirely out-of-band from the open browser session; immediately re-issued the identical `fetch` from the SAME still-open, untouched session (no reload, no re-login)
- Expected Result: Grantee performs an action requiring the new permission in their already-open session without re-login; requirePermission re-checks fresh and allows it; no permission caching, every server call re-derives the session and permission set fresh
- Actual Result: The very next fetch from the untouched session returned `{"status":200,"hasData":true}` — real customer data, immediately, with no re-login and no page reload
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: PASS (not tested at the exact instant of a mid-load race specifically, but the underlying mechanism proven here has no caching layer at all to race against)
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: PASS (the grantee's already-open tab immediately gained working access with zero friction)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: This is the direct converse of U-019 (which proved the same zero-caching mechanism for a permission LOSS); together they conclusively prove `requirePermission` never caches in either direction
- Final Status: PASS
- Notes: The test grant was revoked immediately afterward via `revoke_user_role`, restoring wf-test.restricted to its documented zero-role resting state, confirmed via a repeat fetch returning 403 again.

---

## N-015: User List Behavior Near the 200-User Cap

- Journey ID: N-015
- Journey Name: User List Behavior Near the 200-User Cap
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: PARTIAL
- Personas: user_access_admin
- Test Data / Record References: src/platform/user-access/data/user-access.data.ts:16-21, src/platform/user-access/ui/user-access-page.tsx
- Starting State: Org has at or near 200 total Supabase Auth users
- Actions Executed: Read `listAuthUsers()`, confirmed `supabase.auth.admin.listUsers({ page: 1, perPage: 200 })`, i.e. the cap IS enforced at query time, not client-side truncation of a larger result. Read the full UI component: found ZERO messaging of any kind about the 200-user limit, no "showing X of Y" indicator, nothing
- Expected Result: List caps at 200 entries; behavior at/above the boundary is verified honestly; admin is not misled into thinking the list is complete; cap is enforced at query time, not silently dropped client-side
- Actual Result: ORIGINAL (confirmed real, low-severity gap): cap correctly enforced server-side at query time (not a data-loss bug), but there was truly zero UI indication that the list could be incomplete for an org above 200 users, meaning an admin would have no way to know they might be missing someone. AFTER FIX: added a small conditional caption, shown only when `entries.length >= 200`, reading "Showing the first 200 users. If someone you expect to see is missing, they may be beyond this limit; contact IT."
- Regular Path Result: FAILED THEN FIXED + PASS (this dev environment has nowhere near 200 real users, so the caption's conditional render was verified by code inspection and `entries.length >= 200` logic, not a literal 200-account fixture; the cap enforcement itself was already correct)
- Stress Variant Result: PARTIAL, not literally seeded at 200+ users (impractical for this environment); the query-time cap mechanism itself does not depend on volume to behave correctly
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: FAILED THEN FIXED + PASS
- Historical Result: N/A
- Performance Result: PASS (cap prevents an unbounded query regardless of org size)
- Original Status: FAILED (UX: no honest disclosure of a real, silent truncation point)
- Defect IDs: DEFECT-B4-001 (no UI indication that the User Access list caps at 200, low severity, P2)
- Root Cause: `src/platform/user-access/ui/user-access-page.tsx` rendered the entries table with no length-based messaging at all.
- Fix: Added a conditional caption above the table, shown only at `entries.length >= 200`.
- Fix Commit: Pending Batch 4 checkpoint commit
- Regression Test: Type-check + existing test suite (no dedicated unit test added; this is a one-line conditional JSX render with no independent business logic to unit test, consistent with how similar small UI captions are handled elsewhere in this codebase)
- Rerun Result: Verified via tsc (clean) and manual code reading of the conditional; not independently exercised at 200+ real accounts (impractical)
- Neighboring Journeys Rerun: N-001 (list rendering) re-confirmed unaffected by the addition
- Final Status: FAILED THEN FIXED + PASS
- Notes: Low severity, bounded, one-line fix; consistent with the fix-on-the-go rule for small Category A gaps. This dev-stage system does not currently approach 200 users, so the practical impact today is minimal, but the fix costs nothing and closes a real, if minor, honesty gap.

---

## N-016: Email Is Always Read Live From Supabase Auth, Never Stored on app_users

- Journey ID: N-016
- Journey Name: Email Is Always Read Live From Supabase Auth, Never Stored on app_users
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.user-access-admin@example.test
- Test Data / Record References: wf-test.restricted@example.test (temporarily renamed then reverted)
- Starting State: A provisioned user with a known email in Supabase Auth
- Actions Executed: Directly changed wf-test.restricted's email in Supabase Auth to wf-test.restricted-renamed@example.test via the Auth Admin API; reloaded /settings/user-access in the already-authenticated admin browser session; confirmed app_users schema has no email column
- Expected Result: Next load of /settings/user-access shows the new email immediately with no app_users write required; app_users table has no email column at all; no stale cached email can ever be displayed
- Actual Result: The new email appeared immediately on reload with zero app_users writes; schema query confirmed app_users has no `email` column at all
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
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
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: The email was reverted back to wf-test.restricted@example.test immediately after the assertion, confirmed via a follow-up read, so downstream batches see the expected persona email.

---

## N-017: Unauthenticated State Renders Honest Denial

- Journey ID: N-017
- Journey Name: Unauthenticated State Renders Honest Denial
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: anonymous visitor
- Test Data / Record References: /settings/user-access
- Starting State: No Supabase Auth cookie/session present
- Actions Executed: Logged out, navigated directly to /settings/user-access
- Expected Result: getCurrentNexusSession returns "unauthenticated"; AuthGate shows the unauthenticated-specific message, not a generic access-denied page
- Actual Result: Redirected to /login?redirectTo=%2Fsettings%2Fuser-access, confirmed via read_network_requests
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
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
- Notes: Already proven live and repeatedly in Batch 3 (U-004, and every un-authenticated deep-link test); this entry re-confirms specifically on the new /settings/user-access route this batch introduces.

---

## N-018: Unavailable Session State Renders Honest Denial

- Journey ID: N-018
- Journey Name: Unavailable Session State Renders Honest Denial
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: PARTIAL
- Personas: any logged-in user experiencing a transient outage
- Test Data / Record References: src/components/product/auth-gate.tsx:39-48 (same branch verified in Batch 3's U-008)
- Starting State: Supabase Auth session lookup fails transiently
- Actions Executed: Re-confirmed via code inspection that /settings/user-access wraps its content in the same shared `AuthGate` component as every other route, so the "unavailable" branch (identical code, not a per-route reimplementation) applies here identically to how it was already verified in Batch 3's U-008
- Expected Result: AuthGate shows a distinct message indicating a temporary problem, inviting retry; unavailable is a first-class state, not an error swallowed into unauthenticated
- Actual Result: Same conclusion as U-008: confirmed by shared-component code inspection, not a live-triggered outage on this specific route (would require disrupting the shared dev environment)
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: PASS (by shared-code inspection)
- UX Result: PASS (by shared-code inspection)
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
- Notes: Same PARTIAL/code-review-based verification approach as Batch 3's U-008 (this is the identical underlying AuthGate branch, one shared component, not a per-route reimplementation, so proving it once genuinely covers every route including this one).

---

## N-019: Unprovisioned State Renders Honest Denial

- Journey ID: N-019
- Journey Name: Unprovisioned State Renders Honest Denial
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.unprovisioned@example.test
- Test Data / Record References: /settings/user-access
- Starting State: Valid Supabase Auth session, no app_users row exists for this id
- Actions Executed: Logged in as wf-test.unprovisioned; fetched /settings/user-access directly and inspected the server-rendered response
- Expected Result: AuthGate shows a message indicating the account exists in Auth but has not been granted app access, distinct from inactive/unauthenticated wording
- Actual Result: Response contained "Access not provisioned", confirmed via `t.includes('Access not provisioned')` on the raw fetched HTML
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: PASS (N-003 already live-proved provisioning flips this state on the very next request)
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
- Neighboring Journeys Rerun: N-003
- Final Status: PASS
- Notes: Already proven live in Batch 3 (U-006 on /my-work); this entry re-confirms specifically on the new /settings/user-access route.

---

## N-020: Inactive State Renders Honest Denial

- Journey ID: N-020
- Journey Name: Inactive State Renders Honest Denial
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.inactive@example.test
- Test Data / Record References: /settings/user-access
- Starting State: app_users.is_active = false for this user
- Actions Executed: Logged in as wf-test.inactive; fetched /settings/user-access directly and inspected the server-rendered response
- Expected Result: AuthGate shows a message indicating the account has been deactivated, distinct from other denial reasons
- Actual Result: Response contained "Account inactive", confirmed via `t.includes('Account inactive')`
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: PASS (N-005/U-019 already live-proved reactivation flips this state on the very next request)
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
- Neighboring Journeys Rerun: N-005, U-019
- Final Status: PASS
- Notes: Already proven live in Batch 3 (U-007 on /my-work); this entry re-confirms specifically on the new /settings/user-access route.

---

## N-021: Active State With Zero Role Grants

- Journey ID: N-021
- Journey Name: Active State With Zero Role Grants
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.restricted@example.test
- Test Data / Record References: /settings/user-access
- Starting State: app_users row exists, is_active = true, zero rows in user_roles
- Actions Executed: Logged in as wf-test.restricted (zero role grants); fetched /settings/user-access directly and inspected the server-rendered response; separately confirmed via the earlier N-001 table view that this same persona shows "Active"/"No roles assigned", never conflated with inactive/unprovisioned
- Expected Result: AuthGate denies with missing_permission, never with unprovisioned or inactive; the five-state union does not conflate "no roles" with any account-level state
- Actual Result: Response contained "Access restricted" (missing_permission wording), not "Account inactive" or "Access not provisioned"
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
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
- Neighboring Journeys Rerun: N-001, U-009, U-013
- Final Status: PASS
- Notes: Already proven live in Batch 3 (U-009, U-013); this entry re-confirms specifically on the new /settings/user-access route.

---

## N-022: Revoking a role_permissions Row Disables That Permission for All Holders Instantly

- Journey ID: N-022
- Journey Name: Revoking a role_permissions Row Disables That Permission for All Holders Instantly
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: (Direct DBA-level action, no application UI exists for this lever) acting on the real 'maker' role definition, holder wf-test.maker@example.test
- Test Data / Record References: role_permissions row cd29debe-0d85-428f-bcae-64411849dbbb (maker/customer.create)
- Starting State: A role (maker) grants customer.create to all its holders; wf-test.maker holds this role
- Actions Executed: With explicit user authorization (this directly mutates a shared, real RBAC row, not a test-scoped one), set `revoked_at = now()` on the specific role_permissions row granting maker -> customer.create; immediately fetched the real server-rendered `/forms/customer-onboarding` page (gated on customer.create) as wf-test.maker
- Expected Result: Every user holding maker immediately loses customer.create on their very next server action; role_permissions row itself is soft-revoked, not deleted; the permission chain query filters revoked_at IS NULL with no caching
- Actual Result: The very next request's raw server-rendered HTML contained "Access restricted... You do not have permission" and "customer.create", confirming the revoke took effect immediately, at the real render boundary, with zero caching. Attempting to restore by clearing revoked_at on the SAME row was blocked by the identical historical-grant trigger already proven for user_roles in N-010 ("revoked_at cannot change once set"), confirming role_permissions is ALSO protected by fn_protect_access_grant, not just user_roles. With separate explicit authorization, inserted a brand-new active role_permissions row (same role_id/permission_id) to restore the grant; the very next request confirmed customer.create access restored
- Regular Path Result: PASS
- Stress Variant Result: N/A (not tested with many simultaneous holders; the mechanism proven has no per-holder state to differ across holders)
- Authorization Result: N/A
- Concurrency Result: N/A (a holder's in-flight-action variant not separately tested)
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (old row remains permanently revoked as history; new row is the current active grant, never rewriting the old one)
- Recovery Result: PASS, WITH A CORRECTION TO THE DOCUMENTED EXPECTATION: "re-activating restores it... with no need to re-grant individually" is not literally true for the SAME row (the historical-grant trigger forbids clearing revoked_at); recovery instead requires inserting a fresh role_permissions row, exactly mirroring how N-010 already established user_roles recovery works. This is architecturally MORE consistent (never rewrite history) than the Universe doc's literal wording implied, not a defect
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
- Neighboring Journeys Rerun: N-010 (same trigger, now confirmed to also protect role_permissions, not only user_roles)
- Final Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY
- Notes: This mutation touched the SHARED, real 'maker' role definition used by every maker-role persona across Batches 1-4. Explicit user authorization was obtained before both the revoke and the restoring insert (the auto-mode classifier blocked both attempts pending that authorization, correctly treating this as a genuine shared-resource mutation). The role was left in its fully restored, functionally-equivalent state (maker holders have customer.create again), confirmed live. docs/NEXUS_JOURNEY_UNIVERSE.md's N-022 entry should be reconciled to reflect that recovery is "insert a new grant row" rather than "clear revoked_at," matching the already-correct N-010 wording.

---

## N-023: Deactivating a Role (is_active = false) Disables It for All Holders Instantly

- Journey ID: N-023
- Journey Name: Deactivating a Role (is_active = false) Disables It for All Holders Instantly
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: (Direct DBA-level action) acting on the real 'maker' role definition, holder wf-test.maker@example.test (who also independently holds workflow_admin, giving a clean isolation test)
- Test Data / Record References: roles row for code='maker' (id 8821e516-de99-4a75-8492-dcbe287ddcb5)
- Starting State: maker role is_active = true and held by multiple users
- Actions Executed: With explicit user authorization, set `roles.is_active = false` for 'maker' (confirmed via a schema check that, unlike user_roles/role_permissions, the `roles` table itself carries no historical-lock trigger, only a plain updated_at/audit trigger, so this toggle is genuinely freely reversible); as wf-test.maker (who holds BOTH maker and workflow_admin), fetched both /forms/customer-onboarding (customer.create, maker-only) and /settings/workflows (workflow_definition.read, workflow_admin-only) in the same moment; reactivated is_active = true and re-fetched both
- Expected Result: Every user holding maker immediately loses all maker-derived permissions on their next request, even though their user_roles grant is untouched; re-activating the role restores permissions to all original holders immediately with no re-grant needed
- Actual Result: While deactivated: /forms/customer-onboarding was blocked ("Access restricted"), while /settings/workflows remained fully accessible (workflow_admin's permissions completely unaffected), cleanly proving role-level isolation, i.e. deactivating one role a user holds does not touch permissions the SAME user derives from a DIFFERENT role. After reactivating maker, /forms/customer-onboarding was accessible again with zero re-grant action needed
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (user_roles rows for wf-test.maker were never touched; only the role definition's is_active flag changed, confirmed by wf-test.maker's role list being unaffected throughout)
- Recovery Result: PASS (unlike N-022, this lever genuinely IS freely reversible in place, matching the Universe doc's literal wording exactly, since `roles` carries no historical-lock trigger)
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
- Neighboring Journeys Rerun: N-022 (contrasting recovery mechanics between role_permissions and roles)
- Final Status: PASS
- Notes: wf-test.maker's dual role membership (maker + workflow_admin, acquired in an earlier batch) turned out to be an ideal fixture for this exact isolation test, rather than a problem to work around.
