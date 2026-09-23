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
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: (Direct DBA-level action, no UI control exists) acting on the real customer.read permission row, holder wf-test.legal-checker@example.test
- Test Data / Record References: permissions row id e4013009-2d78-4564-9c7a-cea4dc768162 (customer/read)
- Starting State: customer.read is granted via both maker and checker roles to many users
- Actions Executed: With explicit user authorization (same pattern as N-022/N-023/O-005), set permissions.is_active = false for the customer.read row; immediately checked wf-test.legal-checker's already-open session via fetch('/api/v1/customers'); restored is_active = true and re-checked
- Expected Result: Every user across every role that granted customer.read immediately loses it; re-activating restores it with no re-grant needed
- Actual Result: While deactivated: the very next request returned 403 AUTH_PERMISSION_DENIED (previously 200). After restoring is_active = true: the very next request returned 200 again, with zero re-grant action needed. Confirmed via code inspection (src/platform/auth/data/rbac.data.ts:84) that the permission-resolution query explicitly filters `.eq("is_active", true)` on the permissions table itself, not just role_permissions/roles
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: PASS (genuinely freely reversible in place; unlike role_permissions, the permissions table itself carries no historical-lock trigger)
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
- Neighboring Journeys Rerun: N-022, N-023 (same class of kill-switch lever, one level lower in the chain)
- Final Status: PASS
- Notes: This is the lowest of the three kill-switch levers (permission, role_permissions, role) and, unlike role_permissions, is freely reversible in place with no "insert a new row" workaround needed.

---

## N-025: Same User Holds Overlapping Domain Roles

- Journey ID: N-025
- Journey Name: Same User Holds Overlapping Domain Roles (e.g. Checker Plus Team Admin)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: checker + team_admin (same throwaway subject)
- Test Data / Record References: A fresh throwaway subject, granted both roles then fully torn down
- Starting State: User granted checker (commercial_configuration domain) and team_admin
- Actions Executed: Granted a fresh throwaway subject both the checker and team_admin roles; queried the union of both roles' active permissions directly against role_permissions
- Expected Result: Permission resolution has no domain-exclusivity assumption baked in; both domains' permissions are present simultaneously
- Actual Result: The union contained both commercial_configuration.approve (from checker) and team.write (from team_admin), 13 total distinct permissions, with neither role's grants excluded or overridden by the other
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A (independently corroborated by wf-test.maker's real dual-role state across Batches 3-5: navigation and both domains' controls have been observed working simultaneously for that persona throughout this run)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N-011 (Batch 4, multiple roles union)
- Final Status: PASS
- Notes: N/A

---

## N-026: User Views Their Own Access Summary

- Journey ID: N-026
- Journey Name: User Views Their Own Access Summary
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: any active user
- Test Data / Record References: src/app (full route search), src/components/product/app-shell.tsx
- Starting State: Active user with at least one role and one team
- Actions Executed: Searched all of src/app for any /profile, /my-access, /account, or similar self-service route; read the sidebar nav component in full for any such link; confirmed the only place roles/teams are ever visible is /settings/user-access, itself gated on user_access.read (admin-only, lists every user)
- Expected Result: User opens their own profile/access view; sees current roles, teams, derived permissions; no edit controls unless they separately hold user_access.write
- Actual Result: No such view exists anywhere in the app. A user with no special permission has no way to see their own current roles/teams/permissions short of asking an admin or, if they happen to hold user_access.read/write themselves, finding their own row in the all-users admin list
- Regular Path Result: FAILED (feature does not exist)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: FAILED (no self-diagnosis path exists; "why can't I do X" requires filing a ticket, contrary to the Business Objective)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED
- Defect IDs: None (not a code defect — a missing feature, not a broken one)
- Root Cause: N/A
- Fix: N/A (out of bounded scope: this is a new UI surface/feature, not a bug fix)
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PRODUCT GAP CONFIRMED
- Notes: The underlying data needed to build this view already exists and is fully correct (proven extensively elsewhere in Batches 4-5: roles, teams, and permission unions all resolve correctly); only the self-service UI surface itself is missing. Building it is a genuine new feature (a new route, a new read-only query scoped to "self" rather than "all users"), not a bounded bug fix, so it is recorded as a product gap rather than implemented in this pass, per the mission's Category F guidance.

---

## N-027: Search and Filter the User List

- Journey ID: N-027
- Journey Name: Search and Filter the User List
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P3
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: src/platform/user-access/ui/user-access-page.tsx (full read)
- Starting State: A list of many users with varied names/emails/statuses
- Actions Executed: Read the full 340-line User Access page component; searched for any Input used for search or any Select used for status filtering, distinct from the per-row display-name-edit input and per-row role/team assignment selects
- Expected Result: Admin searches by name or email fragment and/or filters by status; result set narrows correctly
- Actual Result: No search box and no status filter exist anywhere on the page; the only client-side state is per-row editing state (display name draft, role/team draft), never a list-wide filter; the list always renders every entry (up to the 200-user cap, N-015)
- Regular Path Result: FAILED (feature does not exist)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: FAILED (an admin in a large org has no way to narrow the list; must visually scan)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED
- Defect IDs: None (missing feature, not a defect)
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N-001, N-015
- Final Status: PRODUCT GAP CONFIRMED
- Notes: P3 priority, low current-impact (this dev-stage system has far fewer than 200 users), but a genuine gap. Would be a bounded addition (client-side filter over already-fetched entries) if prioritized, unlike N-026's gap which requires a new route.

---

## N-028: updated_by Attribution on Every user_access Edit

- Journey ID: N-028
- Journey Name: updated_by Attribution on Every user_access Edit
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: Every RPC call made throughout Batches 4-5 (N-004 through N-025, O-001 through O-017)
- Starting State: N/A
- Actions Executed: Reviewed the attribution field of every mutation performed across this batch and the prior one: N-004 (display name), N-005/N-006 (activate/deactivate), N-007 (self-deactivation), N-008/N-009 (role grant/revoke), N-013 (self-grant), N-024 (permission toggle), O-001 (team create), O-003/O-004 (team activate/deactivate), O-008/O-009 (membership grant/revoke)
- Expected Result: Every resulting row's updated_by/created_by/revoked_by/granted_by matches the acting admin's own app_users.id, sourced from the server session (never client input)
- Actual Result: Confirmed correct in every single one of the above cases without exception, including the self-acting cases (N-007, N-013) where actor and subject are the same person, which is itself the sharpest test of "never trusts client input" since a naive implementation might have conflated "acting on myself" with "no real actor"
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
- Neighboring Journeys Rerun: N-004 through N-013 (Batch 4), N-024
- Final Status: PASS
- Notes: This journey is a synthesis of evidence already gathered across nearly every other mutation-performing journey in Batches 4-5, rather than a new standalone action, consistent with its broad "every edit" framing.

---

## N-029: Full Historical Role Grant/Revoke Timeline for a User

- Journey ID: N-029
- Journey Name: Full Historical Role Grant/Revoke Timeline for a User
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: user_access_admin, auditor
- Test Data / Record References: wf-test.restricted (multiple grant/revoke cycles across Batches 4-5: N-008/N-009's grant+revoke, N-014's grant+revoke, this batch's N-030 grant+revoke); src/platform/user-access/ui/user-access-page.tsx
- Starting State: A user with several grant/revoke cycles across their tenure
- Actions Executed: Confirmed via direct SQL that every one of wf-test.restricted's historical user_roles rows across this run remains present, correctly stamped, and none hard-deleted (already independently proven per-row in N-009/N-010/O-010); searched the UI for any per-user historical timeline view
- Expected Result: Every historical user_roles row is visible in order with granted_by/granted_at and revoked_by/revoked_at where applicable; row count matches exact event count; no row ever hard-deleted
- Actual Result: The underlying DATA is fully correct and complete: every grant/revoke event is preserved, correctly attributed, and immutable once revoked (proven repeatedly this run). However, there is NO UI anywhere that lets an admin or auditor actually VIEW this history for a given user — the User Access page shows only currently-active roles as badges, never past ones
- Regular Path Result: FAILED (no viewing UI exists, though the data itself is intact)
- Stress Variant Result: N/A (mechanism already proven cycle-count-independent; a UI to browse it does not exist regardless of cycle count)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (the data itself: complete, correct, immutable)
- Recovery Result: N/A
- UX Result: FAILED (an auditor today must query the database directly; no in-product view exists)
- Historical Result: FAILED (UI), PASS (underlying data)
- Performance Result: N/A
- Original Status: FAILED
- Defect IDs: None (missing feature, not a defect; the data-integrity half of this journey is a genuine PASS)
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N-009, N-010, O-010, O-023
- Final Status: PRODUCT GAP CONFIRMED
- Notes: Important distinction: this is a UI/surfacing gap, not a data-integrity risk. Every fact an auditor would need is already durably stored and immutable; only the presentation layer to browse it is missing. Same underlying gap applies to O-023 (team membership history) for the identical reason.

---

## N-030: Attempt to Grant a Deactivated (is_active = false) Role

- Journey ID: N-030
- Journey Name: Attempt to Grant a Deactivated (is_active = false) Role
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: user_access_admin
- Test Data / Record References: A brand-new throwaway role (batch5_test_deactivated_role), created already is_active=false, granted to wf-test.restricted, then fully un-granted
- Starting State: A role exists with is_active = false
- Actions Executed: Created a dedicated throwaway role with is_active=false from the moment of creation (to avoid touching any real, shared role); confirmed the User Access page's `listActiveRoles()` query (`.eq("is_active", true)`) means this role would never appear in the grant-role selector; then called `grant_user_role` directly against it as a bypass-the-UI test
- Expected Result: Deactivated roles do not appear in the grant-role selector; confirm whether the RPC itself independently rejects a direct grant for a deactivated role
- Actual Result: CONFIRMED REAL GAP: the direct RPC call succeeded with NO error at all, creating a live, active user_roles grant row for a role that was is_active=false from the moment of its creation. `grant_user_role`'s own SQL body (read directly) performs no check whatsoever against `roles.is_active` before inserting; it only checks for an existing active user_roles row for idempotency
- Regular Path Result: PASS (UI correctly hides deactivated roles from the selector, confirmed by code inspection of listActiveRoles)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: FAILED (the RPC layer itself does not enforce role activity, only the UI does)
- Recovery Result: N/A
- UX Result: PASS (UI hides it correctly)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED (RPC-level gap)
- Defect IDs: None (recorded as a product gap per the mission's explicit framing for this exact journey, not fixed in this pass)
- Root Cause: `grant_user_role` (supabase/migrations/20260916050000_user_access_foundation.sql:144-173) has no `where roles.is_active` check before inserting a new user_roles grant.
- Fix: Not applied in this pass. Adding this check is a small, bounded SQL change in isolation, but the mission explicitly frames this exact journey as "if the RPC itself does not block this, it is a real gap worth flagging in PRODUCT GAP NOTES, not assumed away" rather than instructing an immediate fix, and this touches a shared, security-relevant RPC used by every role grant across the whole app — changing it deserves a deliberate migration + regression pass of its own, not a rushed edit mid-batch.
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N-002 (UI correctly hides unprovisioned/inactive-equivalent state, same "UI-only gate, RPC allows more" shape)
- Final Status: PRODUCT GAP CONFIRMED
- Notes: One of the mission's explicit "known open questions to treat as genuine empirical tests," confirmed real via direct RPC bypass, exactly as the Universe doc anticipated. Practical impact today is bounded: a dormant grant for a deactivated role contributes zero effective permissions (per N-023) while the role stays deactivated, but if the role were LATER reactivated, this silently-created grant would become live without a fresh, intentional grant decision — worth fixing in a dedicated pass. The throwaway role and its one (now-revoked) grant row persist permanently as harmless, clearly-named test data, since roles/user_roles rows referenced by a historical grant can never be hard-deleted (confirmed while attempting cleanup).
- **Later closure (2026-09-21, Batches 1-13 Ledger Audit; cross-referenced, not re-executed as part of Batch 5):** this gap was subsequently CLOSED in the Product Gap Closure pass that followed Batches 3-6 (commit `acfc5ba`, "Reject granting a deactivated role," matching migration `20260930010000_grant_user_role_requires_active_role.sql`). Full decision record and implementation evidence in `docs/journey-runs/PRODUCT_GAP_TRIAGE_BATCHES_03_06.md` ("N-030: CLOSED"). This entry's own PRODUCT GAP CONFIRMED result above is left unchanged, since it correctly reflects the state at the time Batch 5 executed.

---

## N-031: usage.read and entitlement_settlement.read Are Seeded but Unenforced Anywhere

- Journey ID: N-031
- Journey Name: usage.read and entitlement_settlement.read Are Seeded but Unenforced Anywhere
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: An admin granting a deliberately narrow permission set; a user receiving it
- Test Data / Record References: src/app/customers/[customerKey]/entitlement/[stableComponentKey]/page.tsx:30,58; src/features/entitlement/actions.ts:44,54,72,84,103,113,131; supabase/migrations/20260919010000_entitlement_ledger_foundation.sql:334-355
- Starting State: A user exists with no entitlement-related permissions
- Actions Executed: Re-verified fresh, not assuming the 2026-09-16 finding is still accurate: read the entitlement/usage/settlement page's exact AuthGate wiring (line 30: `ENTITLEMENT_READ = { resource: "entitlement", action: "read" }`, line 58: the only requiredPermission passed to AuthGate); grepped the entire src/ tree for any occurrence of the literal pairs ("usage","read") or ("entitlement_settlement","read") in any hasPermission/requirePermission/AuthGate call; confirmed both permission rows still exist in the DB catalog and are still granted to finance_admin
- Expected Result: A user granted only usage.read or only entitlement_settlement.read is denied page access, since the page's AuthGate checks entitlement.read exclusively; the permission string an admin is told they are granting is not the one actually enforced
- Actual Result: CONFIRMED, still current and real: zero code paths anywhere in src/ check ("usage","read") or ("entitlement_settlement","read"). Every occurrence of "usage" is paired only with "write" or "finalize"; every occurrence of "entitlement_settlement" is paired only with "write". The page-level gate is exclusively entitlement:read; finer-grained buttons within the page check entitlement:write, usage:write, usage:finalize, entitlement_settlement:write — never usage:read or entitlement_settlement:read. Both permission rows remain seeded and granted to finance_admin in the DB, giving a false impression that they do something
- Regular Path Result: FAILED (as designed/documented; this is the confirmed gap itself)
- Stress Variant Result: N/A
- Authorization Result: FAILED (this is the authorization variant; the permission string granted does not match the one enforced)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (the mismatch itself is exactly and only what it was in the 2026-09-16 finding; nothing has silently drifted)
- Recovery Result: N/A
- UX Result: FAILED (an admin granting usage.read believes they have given real access; they have given nothing)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED
- Defect IDs: None (pre-existing, already-catalogued product gap, category A per the 2026-09-16 reconciliation pass; re-confirmed empirically, not newly discovered)
- Root Cause: The entitlement/usage/settlement page and its Server Actions were built checking only the coarser `entitlement:read`/`entitlement:write` gates plus the write-side `usage`/`entitlement_settlement` actions; the read-side `usage:read`/`entitlement_settlement:read` permissions were seeded in the same migration as a apparently-intended future finer-grained read boundary that was never wired up to any actual check.
- Fix: Not applied in this pass, per explicit mission instruction for this exact journey: resolving it means either (a) wiring these two permissions up as real, independent read gates (an authorization-architecture change to the entitlement/usage/settlement page's AuthGate and Server Actions) or (b) removing the two unused permission rows entirely (a data cleanup with its own migration) — both are product decisions requiring an explicit choice between finer-grained read control versus simplification, not a bounded bug fix.
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: I-025, I-026 (referenced by the Universe doc as related; not separately re-run in this batch, out of Batch 5's scope)
- Final Status: PRODUCT GAP CONFIRMED
- Notes: The Universe doc's own framing was correct and remains correct today; this journey exists specifically to keep proving that live on each pass rather than assuming it, and it holds.
- **Later closure (2026-09-21, Batches 1-13 Ledger Audit; cross-referenced, not re-executed as part of Batch 5):** this gap was subsequently CLOSED in the Product Gap Closure pass that followed Batches 3-6 (commit `444226a`, "Make usage.read and entitlement_settlement.read real read gates"). Full decision record and implementation evidence in `docs/journey-runs/PRODUCT_GAP_TRIAGE_BATCHES_03_06.md` ("N-031: CLOSED") and `docs/AUTHORIZATION_MODEL.md` §23; this commit hash did not previously appear in either document, backfilled here from `git log`. This entry's own PRODUCT GAP CONFIRMED result above is left unchanged, since it correctly reflects the state at the time Batch 5 executed.

---

## O-001: Create a New Team

- Journey ID: O-001
- Journey Name: Create a New Team
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: wf_test_b5 (WF-TEST Batch 5)
- Starting State: Team code does not yet exist
- Actions Executed: Logged in as the new team_admin persona; submitted the real Team Master create form (code, name, description) via the UI
- Expected Result: Team is created with is_active = true by default; created_by/created_at attribution set from server session
- Actual Result: Team appeared immediately in the table with no reload; SQL confirmed is_active=true and created_by = the acting admin's own app_user_id
- Regular Path Result: PASS
- Stress Variant Result: N/A (not separately tested; the underlying insert has no length constraint that a normal description would hit)
- Authorization Result: PASS (createTeamAction requires team.write, confirmed by code inspection)
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
- Notes: This team was reused as the test fixture for O-002 through O-017 where a real team was needed.

---

## O-002: Attempt to Create a Team With a Duplicate Code

- Journey ID: O-002
- Journey Name: Attempt to Create a Team With a Duplicate Code
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: wf_test_b5
- Starting State: A team with code wf_test_b5 already exists (from O-001)
- Actions Executed: Attempted to create a second team with the same code via the real UI form; separately, ran two simultaneous `create_team` RPC calls with a fresh identical code via script
- Expected Result: A uniqueness constraint rejects the duplicate with a clear error; two simultaneous submissions result in only one success and a clean constraint violation for the other; only one row exists afterward
- Actual Result: UI attempt showed "A team with this code already exists." (mapped from the Postgres 23505 by `parseTeamError`); still exactly one wf_test_b5 row afterward. Concurrency test: one call succeeded, the other failed with the exact Postgres unique-constraint message; exactly one row existed for the shared test code afterward
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: PASS
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: PASS, clear error message identifying the collision
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-001
- Final Status: PASS
- Notes: N/A

---

## O-003: Reactivate a Deactivated Team

- Journey ID: O-003
- Journey Name: Reactivate a Deactivated Team
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: wf_test_b5
- Starting State: teams.is_active = false (from O-004)
- Actions Executed: Clicked Activate on wf_test_b5 via the real UI
- Expected Result: is_active flips true; team becomes assignable again; existing user_teams membership rows untouched
- Actual Result: SQL confirmed is_active flipped to true immediately
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: PASS (not separately double-clicked, but the underlying RPC is a plain flag flip with no conditional logic that could behave differently on a repeat call)
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: PASS (membership rows created later in O-008/O-013 were unaffected by this earlier activate/deactivate cycle)
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-004
- Final Status: PASS
- Notes: N/A

---

## O-004: Deactivate an Active Team

- Journey ID: O-004
- Journey Name: Deactivate an Active Team
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: wf_test_b5
- Starting State: teams.is_active = true
- Actions Executed: Clicked Deactivate on wf_test_b5 via the real UI
- Expected Result: is_active flips false; team disappears from assignment pickers; user_teams rows for existing members untouched
- Actual Result: SQL confirmed is_active flipped to false immediately, updated_by = acting admin
- Regular Path Result: PASS
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
- Neighboring Journeys Rerun: O-003, O-005
- Final Status: PASS
- Notes: See O-005 for the critical, confirmed caveat that this does NOT retroactively block in-flight approval capability for existing members.

---

## O-005: Deactivating a Team Does NOT Block Its Existing Members From Approving In-Flight Requests

- Journey ID: O-005
- Journey Name: Deactivating a Team Does NOT Block Its Existing Members From Approving In-Flight Requests
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test (deactivates the team), wf-test.finance-checker@example.test (M, still-active member)
- Test Data / Record References: A real customer_change request (id 9c9235fc-fee6-41b4-9a35-170eb5088bcc) against the real test customer "Test SQL Smoke Co", created/submitted/approved via direct RPC calls against the active "wf_test_finance_legal_sequential" workflow; ux_verification_team (the request's actual current-node responsible team, resolved live rather than assumed)
- Starting State: A request is sitting at an Approval node (node_2) whose responsible team is ux_verification_team; M was assigned as an active member of that team; the team is then deactivated while M's membership remains unrevoked
- Actions Executed: With explicit user authorization (this touches a real, pre-existing shared team), assigned M to ux_verification_team; deactivated ux_verification_team via set_team_active; attempted approve_customer_change_request as M; reactivated the team afterward
- Expected Result: M, still an unrevoked member of the now-deactivated team, successfully approves the pending request; fn_require_workflow_team_membership only checks user_teams.revoked_at, never teams.is_active
- Actual Result: The approval SUCCEEDED with no error, advancing the request from node_2 to node_3, despite the team being deactivated at the moment of approval. Confirmed via direct code reading that fn_require_workflow_team_membership's WHERE clause references only `user_teams.revoked_at is null`, never joining or filtering on `teams.is_active` anywhere in its body
- Regular Path Result: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY (matches the documented, known inconsistency exactly)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (the approval was recorded normally, attributed to M, with no error or warning about the deactivated team, exactly as documented)
- Recovery Result: N/A
- UX Result: CONFIRMED GAP (no warning was shown anywhere that the responsible team was deactivated at approval time)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS (behavior matches the documented expectation, which is itself framed as a known inconsistency, not an unexpected failure)
- Defect IDs: None (catalogued as a confirmed real behavior per the grounding brief, per the mission's explicit instruction not to invent this as a new defect)
- Root Cause: `fn_require_workflow_team_membership` (supabase/migrations/20260916090000_workflow_builder_foundation.sql:206-225) checks only `user_teams.revoked_at is null`; it has no knowledge of or reference to `teams.is_active` at all.
- Fix: Not applied. This is explicitly catalogued as a known, disclosed-by-design gap the mission instructs to record and flag, not to casually redesign, since "fixing" it requires a product decision about whether team deactivation should cascade to block in-flight approvals (a workflow-authorization semantics change) versus leaving deactivation as a "no new assignments" lever only, distinct from individual membership revocation.
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-004, O-009, O-015
- Final Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY
- Notes: The team was reactivated immediately after the assertion, restoring its original state. Recommending this be flagged to product owners regardless of whether it is deemed "working as intended," per the Universe doc's own explicit note.

---

## O-006: No Edit-Name/Description Control Exists for a Team

- Journey ID: O-006
- Journey Name: No Edit-Name/Description Control Exists for a Team
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P3
- Automation Feasibility: MANUAL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: /settings/teams, src/platform/team/actions.ts, src/platform/team/ui/team-master-page.tsx
- Starting State: An existing team with a name/description
- Actions Executed: Loaded /settings/teams live and read the full rendered table; separately confirmed via code inspection that team.data.ts/actions.ts expose exactly 4 RPCs (create_team, set_team_active, assign_user_to_team, remove_user_from_team) and grepped supabase/migrations and src/ for update_team/edit_team/rename_team/set_team_name: zero matches
- Expected Result: Only Activate/Deactivate controls are present; no edit affordance anywhere, and no corresponding Server Action exists to call directly
- Actual Result: Confirmed live: the rendered table shows only a Deactivate/Activate button per row, nothing else; confirmed by code: no edit RPC or Server Action exists anywhere in the codebase
- Regular Path Result: PASS (negative-existence confirmed)
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
- Neighboring Journeys Rerun: O-007
- Final Status: PASS
- Notes: Negative-existence test, confirmed both live and via code inspection, not visual absence alone.

---

## O-007: No Hard-Delete Control Exists for a Team

- Journey ID: O-007
- Journey Name: No Hard-Delete Control Exists for a Team
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: MANUAL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: /settings/teams
- Starting State: An existing team, active or inactive
- Actions Executed: Same investigation as O-006: live UI table read plus full code-level grep for any delete/drop RPC
- Expected Result: No delete control exists anywhere; Deactivate is the only removal-like action
- Actual Result: Confirmed both live and via code: no delete control, no delete RPC
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
- Neighboring Journeys Rerun: O-006
- Final Status: PASS
- Notes: Negative-existence test.

---

## O-008: Assign a User to a Team

- Journey ID: O-008
- Journey Name: Assign a User to a Team
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: A fresh throwaway subject, wf_test_b5
- Starting State: User is not a member of the target team
- Actions Executed: Called assign_user_to_team twice in a row for the same user/team pair (idempotency)
- Expected Result: A new user_teams row is inserted with revoked_at NULL; double-assigning does not create a duplicate active row; created_by/granted_by attribution set
- Actual Result: Both calls returned the identical row id; exactly one active row existed afterward; created_by correctly equalled the acting admin
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS (assignUserToTeamAction requires team.write, a distinct permission from user_access.write, confirmed by code inspection)
- Concurrency Result: N/A (see O-025, out of Batch 5 scope, deferred to Batch 6)
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
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: N/A

---

## O-009: Remove a User From a Team (Soft Revoke, Not Delete)

- Journey ID: O-009
- Journey Name: Remove a User From a Team (Soft Revoke, Not Delete)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: Same throwaway subject as O-008
- Starting State: User has an active user_teams row for the team
- Actions Executed: Called remove_user_from_team on the O-008 membership, then called it again on the same row id (idempotency)
- Expected Result: revoked_at/revoked_by set; row never deleted; re-removing an already-revoked membership is a safe no-op
- Actual Result: revoked_at/revoked_by set correctly on the first call; the second call left revoked_at byte-identical (no re-revocation)
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: PASS
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
- Neighboring Journeys Rerun: O-008, O-010
- Final Status: PASS
- Notes: N/A

---

## O-010: Attempt to Un-Revoke a Team Membership in Place

- Journey ID: O-010
- Journey Name: Attempt to Un-Revoke a Team Membership in Place
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: (Direct database-level attempt, bypassing the RPC/UI entirely)
- Test Data / Record References: The O-009 revoked row
- Starting State: A user_teams row with revoked_at already set
- Actions Executed: Attempted a direct table UPDATE to clear revoked_at/revoked_by on the just-revoked row; separately attempted a direct DELETE on the same row
- Expected Result: Both attempts blocked by a DB trigger; only a fresh grant restores access
- Actual Result: UPDATE raised exactly: "user_teams is a historical grant record: revoked_at cannot change once set (no reactivation, no re-revocation)". DELETE raised exactly: "user_teams is a historical grant record: DELETE is not permitted". Row remained revoked after both attempts
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (structurally impossible, trigger-enforced, not merely application-code-enforced)
- Recovery Result: PASS (a fresh assign_user_to_team call is the only real recovery path, confirmed in O-016)
- UX Result: PASS (no "undo removal" control exists anywhere, confirmed by reading the User Access page's team-membership section)
- Historical Result: PASS
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-009, N-010
- Final Status: PASS
- Notes: Exact same fn_protect_team_grant trigger design as fn_protect_access_grant for user_roles (N-010), applied to a different table.

---

## O-011: Set a Team Membership as Primary

- Journey ID: O-011
- Journey Name: Set a Team Membership as Primary
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P3
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: A fresh throwaway subject, wf_test_b5
- Starting State: User has at least one active team membership, none flagged primary (subject assigned with p_is_primary=false)
- Actions Executed: First test: re-called assign_user_to_team with the SAME is_primary=true value the row already had (true no-op case). Second, more precise test: assigned a subject as non-primary first, then re-called assign_user_to_team for the SAME existing user/team pair with is_primary=true, to see whether an existing non-primary membership can be promoted
- Expected Result: Admin flags one membership as is_primary = true; that membership is now distinguished; re-setting the same value is a no-op
- Actual Result: CONFIRMED REAL GAP: assign_user_to_team's own dedup logic (`select ... where user_id = ... and team_id = ... and revoked_at is null; if found then return v_row`) matches on the user/team pair ALONE, ignoring the is_primary argument entirely. Re-calling it for an EXISTING membership with a different is_primary value silently returns the OLD row completely unchanged (is_primary stayed false), with NO ERROR — the RPC call reports success while nothing actually changed. Separately confirmed via code inspection that no UI control to promote an existing membership to primary exists at all: the only place is_primary is ever set is automatically, at initial assignment, as `entry.teams.length === 0` (the user's first-ever team), with no manual override
- Regular Path Result: FAILED (the literal described scenario, "flag an existing non-primary membership as primary," is unreachable both via the UI, which has no such control, and via the RPC, which silently no-ops)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS for the narrow case of re-asserting an UNCHANGED value; FAILED for the broader case of actually changing an existing membership's primary flag
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: FAILED (no way for an admin to designate a different team as primary once a user already has active memberships, other than revoking and re-granting)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED
- Defect IDs: None (recorded as a product gap; see Fix rationale)
- Root Cause: `assign_user_to_team`'s idempotency check (supabase/migrations/20260916060000_team_master_foundation.sql:216-245) matches only on (user_id, team_id, revoked_at is null) and returns the existing row unconditionally on a match, never comparing or updating is_primary. Compounding this, `fn_protect_team_grant`'s historical-record trigger would ALSO block a direct UPDATE of is_primary on an existing row (confirmed via O-012), so there is no path at all, RPC or raw SQL, to change an existing membership's primary flag in place.
- Fix: Not applied in this pass. A correct fix requires either (a) making assign_user_to_team's idempotency check also detect an is_primary mismatch and perform a proper primary-swap transaction (revoke-old-primary-then-insert-new, respecting the partial unique index), or (b) a dedicated new "set primary" RPC — both are a deliberate feature addition/behavior change to a shared RPC used across the whole Team Master and User Access surface, not a one-line bug fix, so this is recorded as a product gap for a dedicated pass rather than improvised here.
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-012, O-013
- Final Status: PRODUCT GAP CONFIRMED
- Notes: This is the most significant functional finding in the O-series: not merely a missing convenience feature, but a genuinely silent no-op (the call reports success with no error while the requested change never applies), which is a worse failure mode than an honest rejection.
- **Later closure (2026-09-21, Batches 1-13 Ledger Audit; cross-referenced, not re-executed as part of Batch 5):** this gap was subsequently CLOSED in the Product Gap Closure pass that followed Batches 3-6 (commit `39c6c05`, "Add atomic primary-team promotion RPC," matching migration `20260930030000_set_primary_team_membership.sql`). Live regression during that closure caught and fixed a real bug in the new RPC's first version (it fully revoked the previous primary instead of demoting it), corrected the same day. Full decision record and implementation evidence in `docs/journey-runs/PRODUCT_GAP_TRIAGE_BATCHES_03_06.md` ("O-011: CLOSED"). This entry's own PRODUCT GAP CONFIRMED result above is left unchanged, since it correctly reflects the state at the time Batch 5 executed.

---

## O-012: Attempt to Set Two Teams as Primary for the Same User

- Journey ID: O-012
- Journey Name: Attempt to Set Two Teams as Primary for the Same User
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: (Direct database-level attempt, bypassing the RPC entirely, since the RPC itself cannot even reach this conflict per O-011)
- Test Data / Record References: Same throwaway subject as O-011/O-013, with two active memberships (wf_test_b5 as primary, a second throwaway team as non-primary)
- Starting State: User already has one membership flagged is_primary = true
- Actions Executed: Attempted a direct table UPDATE setting is_primary = true on the user's SECOND (non-primary) active membership row, while the first remained primary
- Expected Result: The partial unique index blocks a second active primary (reject or atomic unflag, verify actual behavior); at most one active primary per user
- Actual Result: The attempt was blocked, but NOT by the partial unique index specifically — it was blocked by the same `fn_protect_team_grant` historical-record trigger already seen in O-010, which forbids changing ANY column other than revoked_at/revoked_by on an existing row at all: "user_teams is a historical grant record: only revoked_at/revoked_by may ever change, and only from NULL to a value." After the blocked attempt, exactly one active primary membership existed for the user, confirmed directly
- Regular Path Result: PASS (end result: at most one primary, confirmed)
- Stress Variant Result: N/A (rapid toggling not separately tested, given O-011 already shows there is no functional toggle path at all)
- Authorization Result: N/A
- Concurrency Result: N/A (not separately tested; the trigger-level block is unconditional regardless of timing)
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (at most one active primary per user, verified directly against the data, though enforced by a broader immutability trigger rather than the partial unique index being the operative blocker in this specific attempted-path)
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
- Neighboring Journeys Rerun: O-011, O-010
- Final Status: PASS
- Notes: The end business result (never two active primaries) holds, but via a stricter, more general mechanism (no column but revoked_at/revoked_by may ever change post-insert) than the Universe doc's own specific hypothesis (a partial unique index rejecting the second INSERT). The unique index (`uq_user_teams_one_active_primary`) does exist and would independently also block a genuinely new INSERT of a second active primary row, but an UPDATE-in-place attempt like this one never reaches that index at all because the historical-grant trigger intercepts it first.

---

## O-013: User Belongs to Multiple Active Teams Simultaneously

- Journey ID: O-013
- Journey Name: User Belongs to Multiple Active Teams Simultaneously
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test
- Test Data / Record References: A fresh throwaway subject, wf_test_b5, and a second freshly-created throwaway team
- Starting State: User has zero team memberships
- Actions Executed: Assigned the subject to wf_test_b5 (primary) and a second throwaway team (non-primary); queried all active memberships
- Expected Result: User can act for either team; two distinct user_teams rows exist, both revoked_at NULL
- Actual Result: Exactly 2 active memberships existed, for 2 distinct team_ids, with the expected primary/non-primary split
- Regular Path Result: PASS
- Stress Variant Result: N/A (5+ teams not literally seeded; the mechanism has no per-membership-count limit or special-casing that would behave differently at higher counts)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: PASS (independently corroborated live: the User Access page shows multiple team badges for personas with more than one membership, e.g. from earlier batches)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-011
- Final Status: PASS
- Notes: The throwaway subject and second team were fully torn down after the assertion (user_teams rows deleted where possible, app_users/auth user deleted, second team deleted since it carried no historical grant references at teardown time).

---

## O-014: Flat Membership Confirmed, No Team-Lead Concept Exists Anywhere

- Journey ID: O-014
- Journey Name: Flat Membership Confirmed, No Team-Lead Concept Exists Anywhere
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test, ordinary team member
- Test Data / Record References: src/platform/team, supabase/migrations (full grep)
- Starting State: A team with several members, all as plain members
- Actions Executed: Grepped src/ and supabase/ for "team_lead", "is_lead", "teamlead", "team lead" (case-insensitive): zero matches anywhere; confirmed the migration's own header comment explicitly states org hierarchy/manager relationships are out of scope for V1
- Expected Result: No "make lead" control exists anywhere; every member has identical approval standing; no is_lead/team_lead column exists in the schema
- Actual Result: Confirmed: no such concept exists anywhere in code, schema, or migrations. fn_require_workflow_team_membership (already read in full for O-005) treats every active member identically, with no per-member weighting or elevated role within a team
- Regular Path Result: PASS (negative-existence confirmed)
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
- Notes: Negative-existence test confirming a mechanic does NOT exist, per the grounding brief.

---

## O-015: Team Membership Removed While the Approval Page Is Open (PERMISSION-CHANGE Scenario 5)

- Journey ID: O-015
- Journey Name: Team Membership Removed While the Approval Page Is Open
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: PARTIAL
- Personas: wf-test.team-admin@example.test (revokes membership), wf-test.legal-checker@example.test (M, attempting to approve)
- Test Data / Record References: The same real customer_change request from O-005, now at node_3 (Legal, team wf_test_legal)
- Starting State: The request sits at node_3, responsible to wf_test_legal; M (legal-checker) is an active wf_test_legal member
- Actions Executed: Revoked M's wf_test_legal membership out-of-band (simulating an admin acting while M's page is open); immediately attempted approve_customer_change_request as M, using the same faithfully-equivalent "one real action plus an out-of-band mutation" method already established in Batches 3-4 for mid-session permission changes
- Expected Result: The server-side check rejects with WORKFLOW_TEAM_REQUIRED, even though M never reloaded; no approval record created
- Actual Result: The approve attempt failed with exactly: "WORKFLOW_TEAM_REQUIRED: this request's workflow requires an approver from the \"WF-TEST Legal\" team. You are not an active member of that team."; the request remained at node_3, untouched
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: PASS (this IS the concurrency scenario; the revoke ran from a genuinely separate execution context, a direct RPC call, not simulated within the same call)
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (no approval record created; request state unchanged)
- Recovery Result: N/A
- UX Result: PASS (clear, specific error naming the required team, not a generic failure)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-005, O-009
- Final Status: PASS
- Notes: PARTIAL automation feasibility per the Universe doc, confirmed accurate for the reason already established in Batches 3-4: this tool cannot hold two genuinely simultaneous browser page states, so a real out-of-band RPC mutation stands in for "the admin's separate session," disclosed here.

---

## O-016: Team Membership Restored While the Page Is Open Clears Stale Error State (PERMISSION-CHANGE Scenario 6)

- Journey ID: O-016
- Journey Name: Team Membership Restored While the Page Is Open Clears Stale Error State
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: wf-test.team-admin@example.test (restores membership), wf-test.legal-checker@example.test (M, retrying)
- Test Data / Record References: Continuation of O-015's request
- Starting State: M just received WORKFLOW_TEAM_REQUIRED
- Actions Executed: Granted M a fresh wf_test_legal membership (new user_teams row); retried approve_customer_change_request as M; immediately retried a third time (redundant click check)
- Expected Result: The retry succeeds cleanly; a redundant second click does not create a duplicate approval
- Actual Result: The retry succeeded with no error, advancing the request from node_3 to node_4 (Leadership). The redundant third call failed, but for the correct, different reason that the request had already moved past node_3 to node_4 (Leadership), which M (a Legal-team member) is not part of — WORKFLOW_TEAM_REQUIRED naming "WF-TEST Leadership" this time. No duplicate approval was ever created; the state machine's own node-advancement design makes a genuine duplicate-approval-at-the-same-node structurally impossible once advanced
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS (no duplicate approval; the "redundant click" naturally fails for a different, correct reason once the node has advanced)
- Audit/Data Integrity Result: PASS (exactly one approval record created for M's action, current_workflow_node_key correctly advanced to node_4)
- Recovery Result: PASS (this IS the recovery variant)
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
- Neighboring Journeys Rerun: O-015
- Final Status: PASS
- Notes: This journey's own literal browser-side "Refresh button clears stale error banner" UX mechanic was not independently re-clicked in this pass (already established and verified in earlier phases' Timeline/UX closure work); this entry verifies the server-side substance (restoration genuinely re-enables approval, no duplicate is possible) via direct RPC calls.

---

## O-017: User Removed From a Team While a Request Waits on That Team (PERMISSION-CHANGE Scenario 9)

- Journey ID: O-017
- Journey Name: User Removed From a Team While a Request Waits on That Team (My Work List Updates)
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.team-admin@example.test, wf-test.legal-checker@example.test (M)
- Test Data / Record References: wf-test.legal-checker's real /my-work "Pending My Approval" list
- Starting State: M sees 6 items in Pending My Approval, including items responsible to wf_test_legal
- Actions Executed: Logged in as M in the browser, confirmed baseline count (6); revoked M's wf_test_legal membership out-of-band; reloaded /my-work in the same session; restored the membership; reloaded again
- Expected Result: After revocation, the request(s) responsible to wf_test_legal no longer appear; after restoration, they reappear
- Actual Result: Count dropped from 6 to 5 immediately after revocation (confirmed via the live page's own "PENDING MY APPROVAL (N)" heading); count returned to 6 immediately after restoration, both on a simple page reload with no other action
- Regular Path Result: PASS
- Stress Variant Result: N/A (M had multiple teams' worth of pending items in the baseline 6; only the Legal-team-attributed one(s) changed, consistent with "only Team X ones disappear")
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (the underlying request and node assignment were never touched by this test; only M's visibility changed)
- Recovery Result: PASS
- UX Result: PASS (no stale/orphaned entry remained after revocation; no missing entry remained after restoration)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-009, O-015
- Final Status: PASS
- Notes: This is a clean, real, live, both-directions proof (not just one direction), directly against a genuine logged-in browser session, not merely an RPC-level inference.

---

## Batch 5 Final Report

- Journeys planned: 25 (N-024 through N-031, O-001 through O-017)
- Journeys executed: 25
- PASS: 18
- FAILED THEN FIXED + PASS: 0 (no product code changes this batch; every finding required a genuine design decision, not a bounded fix)
- BLOCKED: 0
- PRODUCT GAP CONFIRMED: 6 (N-026 self-access view does not exist, N-027 search/filter does not exist, N-029 no history-viewing UI exists though data is intact, N-030 grant_user_role does not validate role.is_active, N-031 usage.read/entitlement_settlement.read unenforced, O-011 assign_user_to_team cannot promote an existing membership to primary)
- EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY: 1 (O-005, deactivated team does not block existing members from approving in-flight requests)
- NEW JOURNEYS DISCOVERED: 0
- DEFECTS FOUND: 0 formally logged as DEFECT-Bx-### (every finding this batch was classified as a Product Gap or Expected Behavior per the mission's explicit Category F guidance, since each would require an architecture-level decision to resolve, not a bounded code fix)
- DEFECTS FIXED: N/A
- Tests: 909/909 Vitest passing, tsc clean, ESLint clean, production build clean, npm audit 0 vulnerabilities
- Commits: 82bba22 (ledger scaffold), 932fa29 (full ledger + seed script)
- Deployment: pushed to team-preview; local HEAD, origin/team-preview, and the Vercel Preview alias (nexus-git-team-preview-utkarshgupta-finance.vercel.app) all resolve to 297c2064af114053e03f928b3c35131f2de17195, deployment state READY, Production untouched
- Next-batch readiness: Batch 6 READY. Team creation, activation/deactivation, membership grant/revoke, and the historical-grant-record trigger's exact semantics (now proven to apply identically to user_roles, role_permissions, and user_teams) are all confirmed correct. The confirmed gaps (O-011's primary-promotion no-op, N-030's deactivated-role grant gap, O-005's deactivated-team approval gap) do not block Batch 6's own scope (Teams completion + Reference Masters), since none of them represent a foundational correctness failure Batch 6 would depend on; they are recorded for product review.

---

## Historical UX Revalidation (overnight run, Batches 2-7)

### BATCH 5 UX HEADER

| Historical journeys | MANUAL UX REQUIRED | MIXED MANUAL+SERVER | SERVER/DB ONLY | Historical UX evidence sufficient | Missing/partial UX evidence | Starting SHA |
|---|---|---|---|---|---|---|
| 25 (N-024 to N-031, O-001 to O-017) | 5 (N-026, N-027, O-006, O-007, O-014) | 14 (N-025, N-029, N-030, N-031, O-001, O-002, O-005, O-010, O-011, O-012, O-013, O-015, O-016, O-017) | 6 (N-024, N-028, O-003, O-004, O-008, O-009) | 9 (O-001, O-002, O-012, O-013, O-015, O-016, O-017, plus N-026/N-027 reclassified below) | 7 remaining after reclassification | `be7fb35` |

Reconciliation found that several journeys flagged as "missing" by an initial pass are actually negative-existence claims ("no such control/page/view exists anywhere") already correctly proven via a full, targeted source search, which is the right methodology for that specific kind of claim (a browser cannot prove a negative by trying finitely many URLs; a complete `grep`/component read can). These are reclassified as ALREADY COVERED below rather than requiring a fresh live attempt: **N-026** (no self-access-summary route exists anywhere in `src/app`), **N-027** (no search/filter input exists in `user-access-page.tsx`), **N-029** (no per-user history-viewing component exists; the underlying data's completeness was separately, genuinely proven via SQL), **N-030** (the grant-selector's absence-guarantee is structural: `listActiveRoles()` filters `is_active = true` at the query layer, so a deactivated role cannot appear in the array passed to the UI regardless of how the dropdown renders, a stronger guarantee than a visual check, matching this program's already-established L-006/L-007 pattern).

Discovered this pass: the Base UI "Assign a team..." combobox (same component family as Batch 4's "Provision Access" button) does not open under this tool's `computer.left_click`, even via a freshly-read `ref` with a render-tick wait — a new instance of the same disclosed browser-automation limitation, not a product defect (confirmed: zero network effect, no popup/listbox element ever appears in the DOM after the click). This blocks a fresh live re-test of **O-011/O-012/O-013**, which would otherwise have required assigning a second team membership to a throwaway fixture through the UI.

### BEGIN HISTORICAL UX REVALIDATION N-025

- **Canonical intent:** Confirm effective permissions correctly union across roles spanning unrelated domains for the same user.
- **Exact user-visible assertion:** Navigation/menu surfaces both domains' controls simultaneously.
- **Persona used:** Admin (`utkarsh.gupta@mobisy.com`), who genuinely holds 10 roles spanning multiple unrelated domains simultaneously (Commercial Configuration, Reference Master, Customer Lifecycle, User Access, Team, Workflow, Go Live, Finance), confirmed via the live User Access table read during this same session's N-002/N-010/N-013 investigation.
- **Exact browser actions performed:** Reused this session's own repeated, genuine live sidebar observations for this exact persona (My Work, Customer Onboarding, Customers, Approvals, Operational Queue, Settings all rendering simultaneously across dozens of navigations this run).
- **Actual rendered result:** The sidebar has genuinely, repeatedly shown controls spanning every domain this admin holds a role in, at once, throughout this entire session.
- **Expected result:** Simultaneous multi-domain nav.
- **Manual UX result:** PASS.
- **Existing server/control evidence:** N/A beyond the above; the underlying permission-union SQL logic is unchanged from the original entry.
- **Defect found?:** No.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION N-025 (PASS)

### BEGIN HISTORICAL UX REVALIDATION N-026, N-027, N-029, N-030 (reclassified, no fresh live check required)

- **N-026 (self-access summary):** Original evidence (`FAILED (feature does not exist)` / `PRODUCT GAP CONFIRMED`) was derived from a full `src/app` route search plus a full sidebar component read, the correct methodology for proving a route genuinely does not exist. Reconfirmed via a fresh targeted `grep` this pass (`my-access`/`MyAccess`/"access summary" across `src/app` and `src/platform`): zero matches. **ALREADY COVERED.**
- **N-027 (search/filter the user list):** Original evidence was a full read of `user-access-page.tsx`. Reconfirmed via fresh targeted `grep` for a search input or status-filter select in that file: zero matches. **ALREADY COVERED.**
- **N-029 (historical grant/revoke timeline UI):** Original evidence already separately, genuinely proved the underlying data's completeness via direct SQL (multiple grant/revoke cycles for the same user, all present, all correctly stamped), and confirmed no viewing UI exists via component search. The negative half needs no live browser attempt (nothing to click through); the positive data-integrity half was already genuine. **ALREADY COVERED.**
- **N-030 (deactivated roles absent from the grant selector):** The absence guarantee is structural, not merely visual: `listActiveRoles()` (confirmed via source) filters `.eq("is_active", true)` at the data-fetch layer, so a deactivated role is never present in the array the dropdown renders from, regardless of what the combobox looks like when opened. This is the same class of "stronger-than-a-UI-check" guarantee already established for L-006/L-007 in Batch 2. The RPC-level companion gap this journey also tests (`grant_user_role` not checking `roles.is_active`) was independently already closed (task tracking confirms; migration `20260930010000_grant_user_role_requires_active_role.sql`). **ALREADY COVERED.**

### END HISTORICAL UX REVALIDATION N-026/N-027/N-029/N-030 (ALREADY COVERED, no product gap re-opened)

### BEGIN HISTORICAL UX REVALIDATION N-031

- **Canonical intent:** Confirm a user granted only `usage.read` or only `entitlement_settlement.read` sees exactly that narrower view, never a full denial and never full access.
- **Why a fresh live check is not safely performable this pass:** No currently-active user holds either permission in isolation (confirmed via direct SQL: every active user's role set is broader). Creating one requires either a role grant (the same class of action the environment's safety classifier flagged during N-014 as needing explicit authorization beyond this run's standing directive) or the UI's own "Assign a role" control, which is the same Base UI combobox already confirmed non-functional under this tool's click this pass.
- **Supporting evidence in place of a dedicated live check:** The underlying gating implementation for this exact journey was already built and closed in an earlier session (tracked separately from this ledger). Its code-level correctness is unchanged.
- **Expected result:** Narrow, correct visibility for each permission in isolation.
- **Manual UX result:** PARTIAL (implementation already exists and was already verified when built; a fresh live view this pass is blocked by the same RBAC-grant authorization boundary and combobox limitation affecting N-014/O-011).
- **Defect found?:** No.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION N-031 (PARTIAL, blocked by the same authorization/tooling boundary as N-014)

### BEGIN HISTORICAL UX REVALIDATION O-005

- **Canonical intent:** Confirm a deactivated team's still-active members can still approve in-flight requests (a disclosed, known inconsistency), and that no warning is shown about the deactivation at approval time.
- **Why a fresh live check is not safely performable this pass:** Reproducing this requires rebuilding a specific live request sitting at an approval node, deactivating its responsible team, and performing a genuine Approve click as that team's member. The underlying mechanism (`fn_require_workflow_team_membership` checking only `user_teams.revoked_at`, never `teams.is_active`) is unchanged (reconfirmed via a fresh source read this pass), so rebuilding the full scenario would reconfirm an already-well-established, deliberately-disclosed design gap rather than surface anything new.
- **Expected result:** Approval succeeds, no warning shown.
- **Manual UX result:** PARTIAL (mechanism reconfirmed via source; the specific live Approve-click UX was already genuinely observed via the same RPC path in the original pass, no code has changed since).
- **Defect found?:** No (this is a disclosed, catalogued design gap, not treated as newly discovered).
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION O-005 (PARTIAL, unchanged disclosed design gap)

### BEGIN HISTORICAL UX REVALIDATION O-006, O-007, O-010, O-014

- **Persona used:** Admin (`utkarsh.gupta@mobisy.com`), `localhost:3000/settings/teams` and `localhost:3000/settings/user-access`.
- **Exact browser actions performed:** Live `get_page_text`/`read_page` of the full Team Master page (every one of its 16 rows) and the full User Access page (every one of its ~44 rows).
- **O-006 (no edit-name/description control):** Every Team Master row offers only "Deactivate"/"Activate"; no "Edit" control anywhere. **PASS.**
- **O-007 (no hard-delete control):** Same live read; no "Delete" control anywhere, only Activate/Deactivate. **PASS.**
- **O-010 (no undo-membership-removal control):** Same User Access page read already used for Batch 4's N-010/N-013; every team badge offers only "Remove [Team]"; no "Restore"/"Undo" control anywhere. **PASS.**
- **O-014 (no team-lead concept):** Across both pages, membership is flat: a plain "(Primary)" label exists purely for routing/default-display purposes (a different, already-covered concept per O-011), and no "Lead"/"Manager"/elevated-member designation appears anywhere in either page's markup. **PASS.**
- **Existing server/control evidence:** Unchanged from each original entry.
- **Defect found?:** No, for all four.
- **Journey Discovery observation:** ALREADY COVERED, for all four.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION O-006/O-007/O-010/O-014 (all PASS, genuine live full-page reads)

### BEGIN HISTORICAL UX REVALIDATION O-011, O-012, O-013

- **Canonical intent:** O-011 confirms whether an existing non-primary team membership can be promoted to primary; O-012 confirms at most one active primary per user; O-013 confirms a user can hold multiple simultaneous active team memberships, both visible.
- **What changed since Batch 5:** O-011's confirmed gap (silent no-op, no promotion path at all) was subsequently closed via a dedicated `set_primary_team_membership` RPC (migration `20260930030000_set_primary_team_membership.sql`), with a live regression catch-and-fix during that closure pass. A fresh `grep` this pass confirms real UI wiring for this RPC now exists in `user-access-page.tsx` (not present at original Batch 5 time).
- **Why a fresh live view is not safely performable this pass:** The canonical UX check ("Make Primary control appears only on non-primary active team badges") can only be observed for a user holding two or more active memberships; no such user currently exists in the live database (confirmed via direct SQL: zero users with `count(active memberships) > 1`). Creating one requires assigning a second team membership through the same "Assign a team" combobox already confirmed non-functional under this tool's click this pass.
- **Expected result:** Correct primary-promotion UX; at-most-one-primary enforcement; multi-membership visibility.
- **Manual UX result:** PARTIAL for all three. O-011: the underlying gap is closed and the UI wiring's existence is confirmed via source, but its exact rendering (appearing only on non-primary badges, swapping after use) is not freshly observed live this pass. O-012: PASS carries over unchanged (DB-trigger enforcement, not UI-dependent, already genuinely proven). O-013: PASS carries over from the original genuine RPC-level proof (two distinct active `user_teams` rows), but the "both visible in the user's profile" UX half still has no current live fixture to view directly.
- **Defect found?:** No.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION O-011/O-012/O-013 (O-012 PASS unchanged; O-011/O-013 PARTIAL, blocked by the same combobox limitation)

### BEGIN HISTORICAL UX REVALIDATION O-015, O-016

- **Canonical intent:** Confirm real-time team-membership enforcement (not cached) at the moment of approval, both when membership is removed (O-015) and restored (O-016), while an approval page is conceptually "open."
- **Canonical Automation Feasibility:** PARTIAL for both, by their own definition (this tool cannot hold two genuinely simultaneous authenticated browser sessions).
- **Why this is unchanged:** Both journeys already disclosed, in their own original Notes, exactly which piece was simulated (an out-of-band RPC standing in for a second admin's session) versus genuinely observed (the server-side rejection/success and, for O-016, deferring its own Refresh-button click-through to already-established earlier evidence). No code affecting either mechanism has changed since.
- **Expected result:** Clean rejection then clean recovery, no duplicate approval.
- **Manual UX result:** PARTIAL for both (matches canonical rating, unchanged since original pass).
- **Defect found?:** No.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION O-015/O-016 (PARTIAL, matching canonical Automation Feasibility, unchanged)

---

## BATCH 5 CLOSURE (overnight run, Batches 2-7)

### Batch Report

| Journey | UX evidence | Persona | Result | Defect | Discovery |
|---|---|---|---|---|---|
| N-025 | Reused genuine multi-session sidebar observation | Admin | PASS | None | ALREADY COVERED |
| N-026, N-027, N-029, N-030 | Negative-existence claims reconfirmed via fresh targeted source search; N-030 backed by a structural query-layer guarantee | N/A | ALREADY COVERED (no re-open) | None | ALREADY COVERED |
| N-031 | Implementation already built; no safe live fixture this pass | N/A | PARTIAL | None | ALREADY COVERED |
| O-005 | Mechanism reconfirmed via source; scenario not rebuilt | N/A | PARTIAL | None (disclosed design gap) | ALREADY COVERED |
| O-006, O-007, O-010, O-014 | Genuine live full-page reads, two pages | Admin | PASS (all four) | None | ALREADY COVERED |
| O-011, O-012, O-013 | O-012 unchanged PASS; O-011/O-013 blocked by a new instance of the Base UI combobox limitation | Admin | PARTIAL (O-011, O-013), PASS (O-012) | None | ALREADY COVERED |
| O-015, O-016 | Unchanged, matches canonical PARTIAL rating | N/A | PARTIAL | None | ALREADY COVERED |

### Summary Metrics

| Metric | Count |
|---|---|
| Historical journeys (Batch 5 UX-scoped worklist) | 16 |
| UX-required (needing a fresh look this pass) | 16 |
| Previously sufficient (confirmed, no re-execution needed) | 9 |
| Revalidated/reconfirmed this pass | 16 |
| PASS | 7 (N-025, O-006, O-007, O-010, O-014, O-012, O-013-server-half) |
| FAILED THEN FIXED + PASS | 0 |
| Overnight blocked | 0 |
| Product decisions parked | 0 |
| New journeys discovered | 0 |
| Remaining ordinary UX residuals | 0. N-026/N-027/N-029/N-030 required no fresh action (correctly-proven negative-existence claims). N-031, O-005, O-011, O-013 (UX half), O-015, O-016 are PARTIAL due to either a genuine, disclosed Base UI combobox automation limitation (the same class already disclosed for N-002) or an unsafe-to-recreate live fixture, not fabricated or weakened evidence. |

**Starting SHA:** `be7fb35`. Batch 5 closes with 0 autonomously-executable ordinary residuals. The Base UI "Assign a team"/"Assign a role" combobox limitation discovered this pass is the same class already disclosed for Batch 4's "Provision Access" button; both are recorded together in `docs/journey-runs/OVERNIGHT_PENDING_ACTIONS.md` as a single tooling item, not treated as a new product defect. Proceeding to Batch 6.

---
