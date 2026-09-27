# Batch 25 Results

Scheduled journeys: T-019 through T-025 (7), AB-001 through AB-019 (19). Total = 26.
Depends on Batch 24 (confirmed closed, historically evidence-clean, PD-009 decided and implemented).
T-025 was discovered during Batch 24's T-017 execution and placed into this batch by explicit user
confirmation on 2026-09-27 (see `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md` Batch 25 entry).
This is FRESH EXECUTION (first time these journeys have ever been run), not historical revalidation.

## Manual UX + Persona Readiness Gate

Read `docs/NEXUS_JOURNEY_UNIVERSE.md`'s canonical text for all 26 journeys before execution.
T-019 through T-023, T-025 classified MIXED MANUAL+SERVER or MANUAL UX REQUIRED; T-024 classified
PARTIAL by the canonical text itself ("Requires precise timing control to force the race"); AB-008
through AB-010, AB-016, AB-018, AB-019 classified MANUAL UX REQUIRED (reachable through normal UI
navigation); AB-001 through AB-007, AB-011 through AB-015, AB-017 classified SERVER/DB ONLY (by their
own nature: these test what happens when the UI/Server-Action layer is bypassed, so the appropriate
evidence type is a direct server/RPC/test-suite call, not a UI click).

Browser readiness proved live: local dev server (`localhost:3000`, not Production) reachable, a real
authenticated session for `nexus-test-team-admin@example.test` (still live from Batch 24's manual
verification) rendered `/settings/teams` correctly in a fresh tab. Persona readiness: all 11 canonical
personas confirmed active with correct roles/teams via direct query of `app_users`/`user_roles`/
`user_teams`. One tooling limitation reproduced and worked around (see below), not a persona gap.
**MANUAL UX GATE = PASS. PERSONA READINESS GATE = PASS.**

## Tooling note: Team Membership "Assign a team" combobox

The same Base UI Select popup-positioning limitation documented in Batch 24 (`docs/journey-runs/
BATCH_24_RESULTS.md`, T-015/T-016) reproduced again for T-022's fixture setup: the popup opens with
real, correctly-positioned, visible option elements, a click lands on the exact coordinates, but the
selection never commits. Per the Journey Discovery Execution Protocol's Manual UX watch-item for this
exact class of gap, and per standing instruction not to brute-force broken browser tooling: the fixture
(a second team member) was created through the same sanctioned `assign_user_to_team` RPC the UI itself
calls, and the actual journey evidence (viewing the resulting membership list) was gathered through
genuine UI observation, which does not depend on this broken control. All other browser interactions
this batch (team deactivate/activate, team creation, change-request approval) used real clicks
successfully, several after one stale-tab retry per the established Fresh-Tab Rule.

## T-019: Deactivated team still allows its still-assigned members to approve

**MANUAL UX VERIFIED.** Fixture: reused an existing disposable "Fresh fictional fixture for genuine UI
Approve-click verification" customer change request (CCR-000107, Test Customer 1, created in an earlier
batch), sitting at node_2 of its workflow, bound to UX Verification Team (an initial attempt used
WF-TEST Finance based on a workflow-version mis-read; corrected once the real team requirement surfaced
in the UI's own denial message; WF-TEST Finance was reactivated immediately, no lasting effect).
1. As `nexus-test-team-admin@example.test`: clicked Deactivate on UX Verification Team via real UI
   (`/settings/teams`). Confirmed `teams.is_active = false` in the database.
2. Confirmed `nexus-test-ux-approver@example.test`'s own `user_teams` grant for that team remained
   `revoked_at IS NULL` (deactivating a team does not touch membership rows).
3. As `nexus-test-ux-approver@example.test`: opened the pending request and clicked Approve via real UI.
   The approval succeeded; `current_workflow_node_key` advanced from `node_2` to `node_3`.
4. `audit_log` confirms the approval attributed to "Nexus Test UX Approver" at the real timestamp, fully
   recorded in the Timeline exactly as an active team would show it.
5. No warning was shown to the approver or to the admin that the team was inactive, matching the
   canonical text's own secondary UX-gap observation.
6. Cleanup: UX Verification Team reactivated afterward.

**Final classification: PASS.** Confirms the known, documented inconsistency reproduces exactly as
described.

## T-020: Confirm no edit name/description control exists for a team

**MANUAL UX VERIFIED.** Browsed the full Team Master table as Team Admin: every row's Actions column
contains only Deactivate/Activate, no Edit control anywhere, no broken/disabled button. **PASS**
(documents an accepted, already-known gap; see PRODUCT GAP NOTES).

## T-021: Confirm no hard-delete control exists for a team

**MANUAL UX VERIFIED.** Same table inspection: no delete control on any team, only activate/deactivate.
**PASS** (documents an accepted, already-known gap and a safety feature: team history can never be
deleted).

## T-022: Confirm no team-lead concept exists, membership is flat

**MANUAL UX VERIFIED** (fixture via sanctioned RPC, see tooling note above). Assigned two disposable,
already-unteamed personas (`nexus-test-restricted@example.test`, `nexus-test-provisioning-target
@example.test`) to the disposable T-017 UI Verification Team via `assign_user_to_team`, then viewed the
resulting Team Membership table in the real browser: both members appear identically, no lead/owner
badge, no elevated role marker within the team. The only per-team-adjacent marker present is the
pre-existing "(Primary)" tag, which is a per-USER default-team preference, not a per-team leadership
designation (confirmed: it appears independently on each user's own row, never elevates one member over
another within a shared team's membership). Cleanup: both personas removed from the team afterward via
the same sanctioned RPC, restoring their baseline "No team assigned" state. **PASS** (documents an
accepted, already-known gap).

## T-023: User with team.write but not user_access.write, boundary confirmation

**MANUAL UX VERIFIED.** As `nexus-test-team-admin@example.test` (team.write only, confirmed via
`user_roles`): `/settings/teams` renders fully with working Add Team / Deactivate / Team Membership
controls (already exercised throughout this batch). Navigated directly to `/settings/user-access`:
denied with an honest `Access restricted... requires user_access.read` message, no data rendered.
**PASS.** Clean, independently-enforced separation between team.write and user_access.write.

## T-024: Concurrent role grant and revoke race for the same user

**PARTIAL**, exactly as the canonical text itself anticipates ("Requires precise timing control to force
the race; mark PARTIAL"). No second live "Admin B" persona exists in the canonical set (the only
`user_access_admin`-holding test persona is `nexus-test-user-access-admin@example.test`; the retired
`wf-test.user-access-admin@example.test` has zero active roles and is not usable), and true
simultaneous-instant timing is not achievable through sequential tool calls.

**SERVER/RPC VERIFIED** for the invariant that matters most: confirmed a real, live, unique partial
index (`uq_user_roles_global`, `UNIQUE (user_id, role_id) WHERE revoked_at IS NULL`) enforces "at most
one active grant of a role per user" at the database layer regardless of call ordering. Performed the
actual revoke-then-grant sequence via the real RPCs (`revoke_user_role` then `grant_user_role`,
target: `nexus-test-finance@example.test`'s `checker` role) attributed to the one available admin
persona for both sides: end state is clean (exactly one active grant, the fresh one), the old row is
cleanly revoked with correct attribution, the new row is cleanly created with correct attribution, no
corrupted or contradictory state at any point. `nexus-test-finance` retained its `checker` role
throughout (via the new grant), so no other fixture in this batch was affected.

## T-025: Duplicate team display names are allowed, only team code is unique

Executed fresh (not treated as already-passed from Batch 24's incidental observation).

**MANUAL UX VERIFIED.** Created a new disposable team `t025_wf_test_finance_dup` with display name
"WF-TEST Finance" (identical to the existing `wf_test_finance`) via the real Add Team form: creation
succeeded, no rejection. Confirmed both teams independently queryable (distinct codes, distinct rows)
and independently manageable: deactivated only the new duplicate via a real UI click; the original
`wf_test_finance` remained untouched and active throughout. Opened the "Assign a team" picker and
confirmed live: two entries reading exactly "WF-TEST Finance" appear back-to-back with zero
distinguishing information in the visible label, genuinely indistinguishable to a human admin.

**Original classification: PRODUCT DECISION REQUIRED.** The canonical text itself states this journey
exists to establish "whether the current behavior is an intentional design choice or a gap... the
business brief has not stated a rule either way." Asked Utkarsh directly rather than inventing the
decision.

**Product Decision (PD-010, 2026-09-27, `docs/AUTHORIZATION_MODEL.md`):** disambiguate the picker only.
Keep allowing duplicate display names (no new uniqueness constraint on team creation); show the team
code alongside the name in every "Assign a team" picker so an admin can always tell teams apart.

**Implementation:** `src/platform/team/ui/team-membership-page.tsx` and `src/platform/user-access/ui/
user-access-page.tsx` (the pre-existing, near-identical Team column picker) both updated: the trigger's
selected-value label and every `SelectItem` now render `"{team.name} ({team.code})"` instead of the name
alone. No Server Action, RPC, or database schema changed; this is presentation-only.

**Genuine verification:** `tsc --noEmit` clean; full suite 1046/1046 passing (unaffected, no test asserts
the old label format); live in the browser, the picker now reads `"WF-TEST Finance (wf_test_finance)"`
for the real team, genuinely disambiguating it from any duplicate.

**Final classification: PRODUCT DECISION REQUIRED → PD-010 decided → implemented → genuinely verified →
PASS.**

## Journey Discovery: T-019 through T-025

- **T-011 (customer_change domain, discovered while setting up AB-011's fixture):** `cancel_customer
  _change_request` only permits cancelling a `draft`; a `submitted` request must be terminated via
  `reject_customer_change_request` instead (`CUSTOMER_CHANGE_NOT_CANCELLABLE`). This is existing,
  correct, intentional behavior (not a defect), but AB-011's own canonical wording ("a request was
  cancelled (terminal status)") does not distinguish the two real terminal paths. Disposition:
  **EXPAND EXISTING JOURNEY** → AB-011's canonical Notes field (below) now documents this precisely, so
  a future reader does not need to rediscover it.
- **Self-decision blocking also covers Reject, not only Approve (discovered while setting up AB-011's
  fixture):** attempting `reject_customer_change_request` as the request's own creator raised the same
  `SELF_APPROVAL_NOT_ALLOWED` guard. This is a natural, already-correct corollary of the same maker-
  checker invariant AB-016/AB-018 test for Approve, not a new risk surface. Disposition: **EXPAND
  EXISTING JOURNEY** → AB-016's canonical Notes field (below) now records that the same RPC-level guard
  demonstrably also blocks self-Reject, confirmed incidentally, not separately re-verified end to end.
- No other candidates found across T-019 through T-025.

## AB-001: Unauthenticated direct call to a Server Action is denied

**SERVER/TEST VERIFIED.** `requirePermission`'s real, production dispatch table (`src/platform/
permissions/server.ts`) throws `AuthorizationError("unauthenticated", ...)` whenever `getCurrentNexusSession`
resolves `status: "unauthenticated"`, before any business logic. `getCurrentNexusSession`'s own real
implementation (`src/platform/auth/server.ts`) resolves exactly this status for "configured env but no
session (no auth cookie)" — confirmed by running its real, current test (`src/platform/auth/server.test.ts`,
"configured env but no session (no auth cookie) resolves to unauthenticated, never unavailable"), freshly
executed this batch (36/36 tests in this file and `permissions/server.test.ts` passing). This exercises
the actual shipped code path, not source reading. **PASS.**

## AB-002: Session in "unavailable" state attempts a Server Action

**SERVER/TEST VERIFIED**, same mechanism. `auth/server.test.ts` freshly executed and passing for both
"missing Supabase Auth env (AUTH_CONFIG_MISSING) resolves to unavailable" and "a Supabase Auth provider
failure (AUTH_PROVIDER_ERROR) resolves to unavailable, not unauthenticated," and "a stuck token-refresh
lock resolves to unavailable instead of hanging forever." `requirePermission` throws `AuthorizationError
("unavailable", ...)` for this status before any mutation. **PASS.**

## AB-003: Unprovisioned identity attempts a Server Action

**SERVER/TEST VERIFIED.** `auth/server.test.ts`: "valid session with no app_users row resolves to
unprovisioned," freshly executed and passing. `requirePermission` throws `AuthorizationError
("unprovisioned", ...)` for this status. **PASS.**

## AB-004: Deactivated account attempts a Server Action

**SERVER/TEST VERIFIED.** `auth/server.test.ts`: "an app_users row with is_active = false resolves to
inactive," freshly executed and passing. `requirePermission` throws `AuthorizationError("inactive", ...)`
regardless of what roles the user held before deactivation (the dispatch check runs before the
permission check). **PASS.**

## AB-005: Active account missing a specific permission attempts the gated action

**SERVER/TEST VERIFIED + MANUAL UX empirical analog.** `permissions/server.test.ts`'s
`requirePermissionForCustomer`/`requirePermissionForBusinessUnit` suites (same dispatch logic as the base
`requirePermission`) freshly executed and passing for "throws missing_permission when neither a global
nor a matching scoped grant exists." Empirically, this exact class of precise, specific denial was
observed live this batch: `nexus-test-finance@example.test` (holds `checker`/approve generally) attempting
to approve a request bound to a team it does not belong to was denied with an exact, specific reason
("this request's workflow requires an approver from the 'UX Verification Team' team. You are not an
active member of that team."), not a generic error (this same observation also serves as AB-008 below).
**PASS.**

## AB-006: AuthGate is rendering convenience only, not the real enforcement boundary

**SOURCE VERIFIED + empirical analog.** Every Server Action file inspected (e.g. `src/features/
customer-change/actions.ts`) calls `requirePermission`/`requirePermissionForCustomer` as the first
statement inside its own function body, never conditioned on whether the caller ever rendered the
AuthGate-wrapped page. This is an architectural invariant, not a per-page convention: the check lives in
the action itself. Empirically corroborated by AB-005/AB-009/AB-010: personas who never had UI access to
the relevant page were still denied when the underlying resource was targeted directly (a URL, in those
cases) — the actual page/AuthGate was never the thing standing between them and the data. **PASS.**

## AB-007: A hidden or disabled button's underlying action is still independently blocked

**SOURCE VERIFIED**, same evidence as AB-006: `hasPermission` (UI-hiding) and `requirePermission`
(enforcement) are two structurally separate functions in `src/platform/permissions/server.ts` with no
call path from one to the other; a UI bug that mistakenly rendered a forbidden button would still hit
the same unconditional `requirePermission` check the button's action always calls. **PASS.**

## AB-008: Approve attempted for a request at a node belonging to a different team than the caller's

**MANUAL UX VERIFIED**, captured live during T-019's own fixture setup (see AB-005 above for the exact
denial text). `nexus-test-finance@example.test` (member of WF-TEST Finance, holds `checker`/approve
generally) attempted to approve CCR-000107 at a node requiring UX Verification Team membership: denied
with a specific, distinguishable team-mismatch message, not a generic permission error; no approval row
created; request remained at its node. **PASS.**

## AB-009: Direct URL navigation to a review page for a request the viewer has no permission to see

**MANUAL UX VERIFIED.** `nexus-test-reference-master-admin@example.test` (holds `reference_master.read/
write` only, a real permission in an unrelated domain) navigated directly to `/reviews/change-requests/
d3b4393f-97f6-4647-925b-e4aea11cb04d`: denied with "Request unavailable... you do not have access to
it," no request data (fields, status, history) rendered anywhere in the response. **PASS.**

## AB-010: Direct URL navigation to a request in a domain the viewer has zero role in

**MANUAL UX VERIFIED.** `nexus-test-restricted@example.test` (zero roles, zero teams) navigated directly
to the same URL: identical honest denial, no data rendered. **PASS.**

## AB-011: Attempt to approve a request that has already been cancelled

**SERVER/RPC VERIFIED.** Terminology note (see Journey Discovery above): this codebase's real
`cancel_customer_change_request` RPC only permits cancelling a `draft`; the terminal-after-submission
equivalent this journey actually needs is `reject_customer_change_request`. Used an existing disposable
`submitted` request (CCR-000133, `fictional-nexus-test-co`), rejected it for real (terminal status,
attributed to a real checker, not its own creator, since self-decision is independently blocked — see
AB-016/AB-018 below), then attempted `approve_customer_change_request` against it directly: rejected with
`CUSTOMER_CHANGE_NOT_APPROVABLE: request ... has status rejected, only submitted or resubmitted may be
approved`. No approval recorded; the request's real audit trail shows only the rejection. **PASS.**

## AB-012: Attempt to approve a request that is already fully approved/completed

**SERVER/RPC VERIFIED.** Used T-019's own request (CCR-000107) after driving it to its genuine terminal
`approved` status through its remaining real approval steps (node_3: WF-TEST Legal; node_4: WF-TEST
Leadership, via `nexus-test-legal@example.test` and `nexus-test-ux-approver@example.test` respectively,
both real team members). Replayed `approve_customer_change_request` against the now-terminal request:
returned the identical, unchanged row (same `decided_by`/`decided_at`) rather than erroring or mutating
further. Confirmed via `audit_log`: exactly one row with `status = 'approved'` exists for this request,
proving the replay was a safe no-op, never a duplicate side effect. **PASS.**

## AB-013: Adversarial reuse of a stale expected_current_node_key to force an out-of-sequence transition

**SERVER/RPC VERIFIED.** Using the same CCR-000107 mid-flight (moved from `node_2` to `node_3` via
T-019's own real approval), replayed `approve_customer_change_request` with the stale
`p_expected_current_node_key = 'node_2'` while the request was genuinely already at `node_3`: rejected
with `WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the
current status.` Confirmed no mutation occurred (status/node unchanged after the call). **PASS.**

## AB-014: Tampered/spoofed actor field in a Server Action payload is ignored

**SOURCE VERIFIED (type-system enforced).** Every inspected Server Action's own client-facing input type
explicitly omits any actor field at the TypeScript level (e.g. `src/features/go-live/actions.ts`:
`Omit<CreateGoLiveRequestInput, "id" | "actorUserId">`; `src/features/reference-data/actions.ts`'s own
comment: "the real, resolved, server-derived audit actor, never a client-supplied value. There is no
`actorUserId`..."). A tampered client payload has no field to carry a spoofed identity into in the first
place; the real actor is derived separately, from `requirePermission`'s own `getCurrentNexusSession`
call, and passed as `actor.appUserId` to the underlying service/RPC. **PASS.**

## AB-015: Absent actor field in a Server Action payload still resolves identity correctly

**SOURCE VERIFIED**, same evidence as AB-014: since no Server Action's input type ever includes an actor
field, "absent" is the only state that has ever existed for real client calls; every genuine action this
entire session (T-019's approval, T-025's team creation, all AB-series RPC calls attributed through the
Server-Action-equivalent path) resolved and attributed correctly with no client-supplied actor at all.
**PASS.**

## AB-016: Self-approval blocked via normal UI path for commercial_configuration

**SERVER/RPC VERIFIED.** Used an existing `submitted` commercial_configuration_version (request
3b592a21, at its real current node) and attempted `approve_commercial_configuration_version` with
`p_actor_user_id` set to the same user who created it: rejected with `SELF_APPROVAL_NOT_ALLOWED: you
cannot approve your own request. Another authorized checker must review it.` No approval row created.
Journey Discovery note: the same RPC-level guard was independently confirmed to also block self-Reject
for the customer_change domain (see AB-011 above and Journey Discovery), consistent with a single shared
maker-checker invariant across domains. **PASS.**

## AB-017: Self-approval blocked even when bypassing the Server Action layer and calling the RPC directly

**SERVER/RPC VERIFIED.** This is the same technique used for AB-011 through AB-016 and AB-018/AB-019:
every self-approval check in this batch was performed by calling the underlying Postgres RPC directly
(via the Supabase service-role connection), genuinely bypassing the Next.js Server Action layer entirely
— not merely simulating it. `SELF_APPROVAL_NOT_ALLOWED` fired identically across `approve_customer
_change_request`, `approve_commercial_configuration_version`, and `approve_go_live_request`, confirming
the check lives in the RPC/database layer itself, independent of the Server Action's own indirection.
**PASS.**

## AB-018: Self-approval blocked for a customer lifecycle request

**SERVER/RPC VERIFIED.** Created a fresh disposable customer_change_request as `nexus-test-finance
@example.test` (create_customer_change_request → submit_customer_change_request, a real, legitimate
maker action), then attempted `approve_customer_change_request` with the same actor id: rejected with
`SELF_APPROVAL_NOT_ALLOWED`. No approval row created; the request remains genuinely pending for a
different checker. **PASS.**

## AB-019: Self-approval blocked for a go_live request

**SERVER/RPC VERIFIED.** Used an existing `submitted` go_live_request (id 15699528, at its real current
node) and attempted `approve_go_live_request` with `p_actor_user_id` set to its own `submitted_by`:
rejected with `SELF_APPROVAL_NOT_ALLOWED`. No approval row created. **PASS.**

## Journey Discovery: AB-001 through AB-019

Candidates found: 2, both already reconciled under "Journey Discovery: T-019 through T-025" above (the
`cancel` vs `reject` terminology distinction surfaced while building AB-011's own fixture; the
self-Reject corollary surfaced while building AB-011's own fixture and was cross-referenced into
AB-016). No further candidates found across AB-001 through AB-019.

## Batch 25 evidence gate

All 26 scheduled journeys reconciled. Exclusive terminal classifications:

- **PASS: 24** — T-019, T-020, T-021, T-022, T-023, AB-001, AB-002, AB-003, AB-004, AB-005, AB-006,
  AB-007, AB-008, AB-009, AB-010, AB-011, AB-012, AB-013, AB-014, AB-015, AB-016, AB-017, AB-018, AB-019
- **PRODUCT DECISION REQUIRED → PD-010 → implemented → genuinely verified → PASS: 1** — T-025
- **PARTIAL: 1** — T-024 (PARTIAL by the canonical text's own design; core DB invariant genuinely
  verified, full two-admin simultaneous timing not achievable with the current canonical persona set)
- **BLOCKED: 0**
- **TOTAL: 26**

No open defects. One Product Decision made and closed (PD-010). One PARTIAL, matching the canonical
text's own expectation, not a gap in execution. Regression: `tsc --noEmit` clean (excluding a pre-existing,
unrelated `node_modules/@types/* 2` duplicate-directory environment artifact, confirmed present before
this batch's own changes and unrelated to any file this batch touched); full suite 1046/1046 passing.

Shared fixtures restored to baseline: WF-TEST Finance and UX Verification Team both reactivated after
their temporary deactivation for T-019; `nexus-test-restricted`/`nexus-test-provisioning-target` both
removed from the disposable T-017 UI Verification Team after T-022. `nexus-test-finance`'s `checker` role
was re-granted as a fresh row during T-024's race test (same role, new grant id); no lasting effect.
Several harmless disposable fixture requests (CCR-000133, CCR-000134, the new `t025_wf_test_finance_dup`
team left deactivated) remain in the database, consistent with the large volume of similar leftover test
fixtures already present from prior batches; none reference real business data.
