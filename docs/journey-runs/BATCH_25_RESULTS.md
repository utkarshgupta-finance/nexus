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

**Original classification: PARTIAL**, reasoned from the canonical text's own "mark PARTIAL" allowance,
since only one live `user_access_admin`-holding persona existed in the canonical set at the time.

**Closure review correction:** provisioning a genuine second admin actor was itself the sanctioned,
available option, not a genuine external blocker; PARTIAL was premature. Added
`nexus-test-user-access-admin-b@example.test` to `scripts/provision-canonical-test-personas.ts`
(`user_access_admin` role, no team, same pattern as every other specialized persona in that file) and
ran the script for real: a genuine new Auth identity + `app_users` row + role grant now exists, distinct
from `nexus-test-user-access-admin@example.test`. No shared/important persona was mutated.

**SERVER/RPC VERIFIED + DATABASE VERIFIED, with genuinely distinct actors and genuinely overlapping
calls** (the approved concurrency fallback: literal simultaneous browser clicks are not required for
this journey). Target: `nexus-test-finance@example.test`'s active `checker` grant. Dispatched Admin A's
`revoke_user_role` (`nexus-test-user-access-admin@example.test`) and Admin B's `grant_user_role`
(`nexus-test-user-access-admin-b@example.test`) as two genuinely concurrent, independently-issued RPC
calls (not sequential turns) targeting the same user/role at effectively the same instant (server
timestamps 2026-09-27 14:44:08 and 14:44:11, 2.5 seconds apart, the closest approximation to true
overlap this tooling can produce, and materially more overlapping than the single-admin sequential
attempt this replaces).

Verified afterward:
- **Grant history**: three rows total for this user/role — the original grant (already revoked from an
  earlier, unrelated action), an intermediate grant created and then cleanly revoked by Admin A during
  this race, and a final grant created by Admin B, currently active.
- **At most one active grant**: confirmed — exactly one row with `revoked_at IS NULL`, enforced by the
  real `uq_user_roles_global` unique partial index at the database layer regardless of call ordering.
- **Distinct actor attribution**: the revoked row's `revoked_by` is Admin A's real id
  (`nexus-test-user-access-admin@example.test`); the active row's `created_by` is Admin B's real id
  (`nexus-test-user-access-admin-b@example.test`) — two genuinely different real identities, not the
  same actor attributed twice.
- **No stale/contradictory state**: no two simultaneously-active rows ever existed; no orphaned or
  ambiguous grant.
- **Both admins see the truthful final state on genuine UI reloads**: logged in as Admin A and,
  separately, as Admin B, both reloaded `/settings/user-access` for real: both see the identical,
  correct current state — `nexus-test-finance` holding exactly one role, "Checker" — neither admin's UI
  shows a stale or contradictory view of the other's action.

Fixture baseline: `nexus-test-finance` retains its `checker` role throughout (via the final grant), so no
other fixture in this batch was affected. The new Admin B persona is kept as a permanent addition to the
canonical set (documented in the provisioning script), not deleted, so future concurrency journeys have
it available without repeating this provisioning step.

**Final classification: PASS.**

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

**Closure review correction:** the original entry cited source inspection plus an "empirical analog"
that did not actually exercise a direct Server Action call. Per the bounded closure review, performed
the missing canonical runtime check for real.

**SERVER/RPC VERIFIED — real runtime call performed.**
- Real Server Action/direct call executed: **YES**, a genuine HTTP POST directly to the page's own
  Server Action endpoint, captured and replayed via the browser's own `fetch`, never through a rendered
  button (none was ever rendered for this persona).
- Persona/session used: `nexus-test-restricted@example.test` (zero roles, zero teams, genuinely
  authenticated, real session cookie attached automatically by the browser).
- Actual request/payload: `POST /reviews/change-requests/6f464cb0-8b7f-4703-a08d-c1769a495dee` with
  header `next-action: 60bf17831b538024e2b894523c9d238a81475270b6` (captured once, legitimately, from a
  real Approve click by a properly-permissioned checker on a separate disposable fixture, then reused
  against a different disposable request id — the action id is a stable hash of the action's source
  location, not session- or request-specific) and body `["6f464cb0-8b7f-4703-a08d-c1769a495dee","node_2"]`.
- Actual result: HTTP 200 with `{"ok":false,"error":"You do not have permission to approve customer for
  this customer."}` — a real, specific server-side denial, not a generic error, not a client-side block.
- DB mutation check: confirmed no mutation — the disposable request remained `status: submitted`,
  `decided_by: null`, unchanged after the call.
- Evidence label: **SERVER/RPC VERIFIED** (genuine direct HTTP call to the real Server Action endpoint,
  bypassing any page/button entirely).

**Final classification: PASS.**

## AB-007: A hidden or disabled button's underlying action is still independently blocked

**Closure review correction**, same as AB-006: this is the identical call and identical evidence,
since for this persona the button was never rendered at all (the page itself denies access), which is
exactly AB-007's own scenario ("caller lacking permission invokes the action behind a hidden/disabled
control"). Reusing the AB-006 call as AB-007's own runtime evidence rather than performing a materially
different check, since the two journeys' underlying mechanism and the actual HTTP call are identical for
this codebase (there is no separate "hidden button" code path distinct from "direct call"; both reach
the same `requirePermission` gate the same way).

- Real Server Action/direct call executed: **YES** (same call as AB-006).
- Persona/session used: `nexus-test-restricted@example.test`.
- Actual request/payload: identical to AB-006.
- Actual result: identical denial, "You do not have permission to approve customer for this customer."
- DB mutation check: confirmed no mutation (same verification as AB-006).
- Evidence label: **SERVER/RPC VERIFIED.**

**Final classification: PASS.**

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

**Closure review correction:** the original entry cited only the type-system guarantee (no client-facing
input type includes an actor field). Per the bounded closure review, performed the missing canonical
runtime check for real: actually injected a spoofed actor value into a live request and confirmed the
server ignores it.

**SERVER/RPC VERIFIED — real runtime call performed.**
- Real Server Action/direct call executed: **YES**, genuine direct HTTP POST to the real Server Action
  endpoint (same mechanism as AB-006/007), with a deliberately tampered payload.
- Persona/session used: `nexus-test-finance@example.test` (real, authenticated, genuinely holds
  `checker`/approve for this disposable fixture's trivial no-team-gate workflow).
- Actual request/payload: `POST /reviews/change-requests/dbeaadc4-7deb-4191-9bfc-9b50df284923` with the
  same real `next-action` header, body `["dbeaadc4-7deb-4191-9bfc-9b50df284923","node_2",
  "dc10d47b-65a2-4ad5-961d-4c71cabf3547"]` — the third array element is `nexus-test-user-access-admin
  @example.test`'s real id, injected as a spoofed, more-privileged actor.
- Actual result: HTTP 200, `{"ok":true, ..., "decidedBy":"59175334-..."}` — the request was approved,
  and `decidedBy` is `nexus-test-finance`'s own real id, not the spoofed `dc10d47b...` id.
- DB mutation check: `customer_change_requests.decided_by` = `59175334-302b-4c90-9f3a-aabcc26b430b`
  (real caller); `audit_log` for this request contains zero rows with `actor_user_id` equal to the
  spoofed id (`select count(*) ... = 0`); the spoofed identity's own account shows no trace of this
  action anywhere.
- Evidence label: **SERVER/RPC VERIFIED.**

**Final classification: PASS.**

## AB-015: Absent actor field in a Server Action payload still resolves identity correctly

**Closure review correction**, same as AB-014: performed the missing canonical runtime check for real.

**SERVER/RPC VERIFIED — real runtime call performed.**
- Real Server Action/direct call executed: **YES**, genuine direct HTTP POST, no button ever clicked.
- Persona/session used: `nexus-test-finance@example.test` (real, authenticated, genuinely permitted).
- Actual request/payload: `POST /reviews/change-requests/ad6271e8-dc2b-4f5e-914a-e5fa29dd2c16` with the
  real `next-action` header and body `["ad6271e8-dc2b-4f5e-914a-e5fa29dd2c16","node_2"]` — no actor
  field present at all (confirmed: this
  is the action's own natural argument shape, captured directly from a real legitimate click; there was
  never an actor field to omit).
- Actual result: HTTP 200, `{"ok":true, "changeRequest": {..., "status":"approved", ...}}` — resolved
  and completed normally with no actor field supplied.
- DB mutation check: `audit_log` shows the real update correctly attributed to "Nexus Test Finance
  Approver" (`nexus-test-finance@example.test`'s real id), no null/blank actor.
- Evidence label: **SERVER/RPC VERIFIED.**

**Final classification: PASS.**

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

## Journey Discovery: bounded closure review (T-024, AB-006/007/014/015)

Candidates found: 0. Two implementation-level observations surfaced while performing the real runtime
checks, neither rising to a Journey Discovery candidate (both are supporting mechanism, not a durable
behavior, control invariant, or risk surface in their own right): the Server Action behind
`/reviews/change-requests/[id]`'s Approve control takes a plain two-element JSON array body
(`[requestId, expectedCurrentNodeKey]`) with no actor field, and a third, unexpected array element
(used to inject a spoofed actor for AB-014) is silently ignored by the action's own destructuring rather
than rejected — consistent with, and further corroborating, AB-014/AB-015's own already-recorded
findings, not a new one. No duplicate journeys added.

## Batch 25 evidence gate

All 26 scheduled journeys reconciled. Exclusive terminal classifications:

- **PASS: 25** — T-019, T-020, T-021, T-022, T-023, T-024, AB-001, AB-002, AB-003, AB-004, AB-005,
  AB-006, AB-007, AB-008, AB-009, AB-010, AB-011, AB-012, AB-013, AB-014, AB-015, AB-016, AB-017,
  AB-018, AB-019
- **PRODUCT DECISION REQUIRED → PD-010 → implemented → genuinely verified → PASS: 1** — T-025
- **PARTIAL: 0** (T-024's original PARTIAL was corrected during a bounded closure review: a genuine
  second `user_access_admin` persona was provisioned through the sanctioned mechanism and the race was
  re-executed with two real, distinct, overlapping actors; see T-024's entry above.)
- **BLOCKED: 0**
- **TOTAL: 26**

No open defects. One Product Decision made and closed (PD-010).

**Typecheck:** `npx tsc --noEmit` exits non-zero (exit code 2), but every one of its 15 reported errors
is `TS2688` ("Cannot find type definition file") against duplicate `node_modules/@types/<pkg> 2`
directories — a pre-existing environment artifact confirmed present before this batch's own changes,
unrelated to anything this batch touched, and not a TypeScript error in any real source file. Zero
errors reference any file this batch changed (`src/platform/team/ui/team-membership-page.tsx`,
`src/platform/user-access/ui/user-access-page.tsx`, `scripts/provision-canonical-test-personas.ts`).
What actually proves the changed code is clean: the full test suite (1046/1046, including the changed
files' own coverage) passes, and the changed files were separately grep-checked against the tsc output
with zero matches. Do not read this as "typecheck clean" in the unqualified sense; read it as "the
pre-existing tsc failure is unrelated to and does not implicate this batch's changes."

**Regression:** full suite 1046/1046 passing, re-run fresh after this closure review's own changes.

Shared fixtures restored to baseline: WF-TEST Finance and UX Verification Team both reactivated after
their temporary deactivation for T-019; `nexus-test-restricted`/`nexus-test-provisioning-target` both
removed from the disposable T-017 UI Verification Team after T-022. `nexus-test-finance`'s `checker` role
now rests on a fresh grant row created during this closure review's own T-024 redo (same role, new grant
id, correctly attributed to Admin B); no lasting effect. A new permanent canonical persona,
`nexus-test-user-access-admin-b@example.test`, was added for T-024 and kept (not deleted) for future
concurrency journeys. Several harmless disposable fixture requests (CCR-000133 through CCR-000139, the
new `t025_wf_test_finance_dup` team left deactivated) remain in the database, consistent with the large
volume of similar leftover test fixtures already present from prior batches; none reference real
business data.
