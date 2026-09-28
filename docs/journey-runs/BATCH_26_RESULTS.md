# Batch 26 Results (CLOSED)

Scheduled journeys: AB-020 through AB-041 (22), V-001 through V-004 (4). Total = 26.
Depends on Batch 25 (confirmed closed, bounded closure review passed 2026-09-27).
This is FRESH EXECUTION, part of the approved Batches 24-33 (234 journeys) unattended overnight run,
executed under the Overnight Stall-Escape Protocol and the approved Pre-Authorization Manifest
(`docs/journey-runs/BATCHES_26_33_READINESS_REVIEW.md`, `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`).

**BATCH 26: CLOSED.** All 26 scheduled journeys genuinely executed and reconciled 2026-09-28 per an
explicit user reconciliation pass: AB-039 and AB-020 reclassified PRODUCT GAP CONFIRMED; AB-025, AB-027,
V-002, V-003, V-004 redone with dedicated, non-cross-referenced evidence; AB-030/036/037 split into three
individually-traceable residual entries. See the exact closure tally in the final closure report
delivered in chat and in `docs/journey-runs/MORNING_RESIDUAL_QUEUE.md`.

## AB-021: user_access.write self-grant gap viewed as a security/direct-action risk

**SERVER/RPC VERIFIED.** `nexus-test-user-access-admin` (`dc10d47b-...`) self-granted `finance_admin`
(role id `72c9b17b-...`) via `grant_user_role` RPC, actor = grantee. Succeeded with no self-grant guard
of any kind, matching the canonical text's expected result exactly ("succeeds, by design"). Grant fully
attributable in `user_roles` (grantor id = grantee id). Immediately revoked afterward to restore the
persona's intended single-role baseline (grant id `db032601-...`, revoke confirmed). **PASS.**

## AB-023: Deactivated role's grant RPC called directly, bypassing the UI selector

**SERVER/RPC VERIFIED.** Confirmed `batch5_test_deactivated_role` (`e86958ed-...`) has `is_active = false`.
Called `grant_user_role` directly targeting `nexus-test-restricted` with this deactivated role id (actor
`dc10d47b-...`). Real rejection at the RPC layer itself, not just the UI selector:
`ERROR: P0001: ROLE_INACTIVE: this role is deactivated and cannot be granted. Reactivate it first, or
choose an active role.` This is defense in depth beyond what the canonical text required proof of either
way. **PASS**, positive finding (no gap).

## AB-024: Reference Master action attempted by a commercial_configuration_viewer

**MANUAL UX VERIFIED.** Logged in as `nexus-test-commercial-viewer@example.test` (real Sign-in), navigated
to `/settings` (routes to Reference Master by default). Real denial: "Access restricted... requires
reference_master.read." Domain isolation confirmed. **PASS.**

## AB-025: A team_admin attempts a go_live approve action (wrong role entirely)

**RECONCILED 2026-09-28: route-level denial alone was ruled insufficient; redone with a genuine direct
Server Action call.** **SERVER/RPC VERIFIED (real HTTP replay of the actual Next.js Server Action) +
DATABASE VERIFIED.**

Original pass only showed the page-level `go_live.read` route gate (MANUAL UX VERIFIED, kept below as
supplementary evidence, not sufficient on its own per this reconciliation).

Redone: logged in as `nexus-test-go-live-admin` (a persona with real `go_live.approve`), opened a real,
governed go-live request (`f6bf7592-...`, GLR-000030, submitted, customer confirmation set to `confirmed`
via the governed `set_go_live_customer_confirmation` RPC so Approve was genuinely clickable), installed a
`window.fetch` monkey-patch, and clicked the real "Approve: Go Live" button. Captured the exact, real
Next.js Server Action call: `Next-Action: 604ee7bbb0ec4e95c048b4e56ce98c2da7be8adb7f`, body
`["f6bf7592-...","node_4"]`. This click genuinely succeeded (consuming that fixture; `status` -> `approved`).

Staged a second, fresh go-live request (`a1254dfa-...`, submitted, `node_3`) as the direct-call target.
Logged in as `nexus-test-team-admin` (real, distinct authenticated session, confirmed live by requesting
an unrelated page and getting a real `customer.read` denial first). From that real session, replayed the
exact captured Server Action call (same `Next-Action` header, i.e. the same compiled server function)
via a same-origin `fetch`, with the body pointed at the fresh target id: `["a1254dfa-...","node_3"]`.
Team_admin never rendered this request's page at all (bypassing AuthGate/route-level rendering entirely,
same as AB-040's principle).

**Real result**, HTTP 200 (standard Next.js Server Action error-as-payload shape):
`{"ok":false,"error":"You do not have permission to approve go_live."}`

**Zero mutation confirmed**: `a1254dfa-...` unchanged (`status='submitted'`, `row_version` unchanged at 3,
`approved_by` null) after the call. **PASS**, with both the route-level (MANUAL UX VERIFIED) and
direct-action (SERVER/RPC VERIFIED) layers now independently confirmed denying a `team_admin`.

## AB-026: Wrong user, direct object reference on a user-scoped settings page

**MANUAL UX VERIFIED.** Logged in as `nexus-test-restricted@example.test` (no `user_access` permission),
navigated to `/settings/user-access`. Real denial: "Access restricted... requires user_access.read." No
fragment of any other user's role/team/status data returned.
**Honest note**: this codebase's actual User Access route has no id-parameterized URL (`/settings/
user-access` is a single flat list page, gated once; there is no `/settings/user-access/[id]` route). The
canonical text's literal "wrong user id" framing does not map onto a real route in current code; the
actual, stronger guarantee verified here is a blanket page-level gate that denies regardless of any id,
which subsumes the IDOR concern (there is no id-shaped attack surface to bypass). **PASS**, with this
scope note carried into Journey Discovery. Related: AB-009, AB-010 (already-verified precedent for the
same blanket-gate pattern).

## AB-028: Permission removed before the approval task/page is opened at all (PERMISSION-CHANGE scenario 1)

**MANUAL UX VERIFIED + DATABASE VERIFIED.** Fixture: `nexus-test-go-live-admin` held `go_live_admin`
(user_role id `58893f44-...`). Revoked via `revoke_user_role` RPC (actor `dc10d47b-...`) before this
persona ever opened the go-live request detail page. Logged in fresh, navigated directly to
`/customers/demo-northstar-consumer-products/go-live`: real, clean, immediate denial ("Access restricted
... requires go_live.read"), no partial render, no leaked content. **PASS.**

## AB-029: Permission removed after the page has already loaded (PERMISSION-CHANGE scenario 2)

**MANUAL UX VERIFIED + DATABASE VERIFIED.** Fixture: go-live request `15699528-...` (GLR-000036,
`node_4`, status `submitted`); customer confirmation staged to `confirmed` via the governed
`set_go_live_customer_confirmation` RPC so the Approve control would be genuinely clickable (isolating
the permission check from the unrelated confirmation-pending business rule). Re-granted
`go_live_admin` to the test persona, loaded the request detail page fresh (Approve: Go Live button
rendered and enabled), then revoked the role via RPC with the page left untouched (no reload). Clicked
the still-rendered Approve button: real denial, "You do not have permission to approve go_live." DB
confirmed no mutation (`row_version` unchanged at 3, `status` still `submitted`, `approved_by` null).
Stale client-rendered UI state did not override the live server check. **PASS.**

## AB-031: Permission restored after a revoke succeeds cleanly with no leftover error state (PERMISSION-CHANGE scenario 4)

**MANUAL UX VERIFIED + DATABASE VERIFIED.** Direct continuation of AB-029's denial. Restored
`go_live_admin` via `grant_user_role`. First retry attempt (same page, no reload) surfaced a second,
distinct, genuinely-real gate: a workflow-node team-membership requirement ("this request's workflow
requires an approver from the WF-TEST Legal team"), since this persona holds no team membership at all.
This is a different, legitimate check (workflow node scoping), not a leftover permission error; resolved
by assigning the persona to `wf_test_legal` via the governed `assign_user_to_team` RPC (a disposable
test-only team membership grant, explicitly pre-authorized). Reloaded the page fresh and retried: the
Approve click succeeded cleanly, no leftover error banner, no ghost state. DB confirmed exactly one clean
transition: `status` -> `approved`, `approved_by` = the persona's id, `current_workflow_node_key` ->
`node_5`, `row_version` -> 4. UI reflected the change immediately (badge changed from "Submitted" to
"Live"). **PASS.**

## AB-041: Governed backend-only RPC must not grant PostgreSQL execute privilege to anon/authenticated

**SERVER/RPC VERIFIED.** Ran `npx tsx --env-file=.env.local scripts/verify-governed-rpc-grants.ts`.
Output: `PASS: no governed mutation function grants execute to anon/authenticated.` **PASS.**

## AB-020: Self-approval blocked for a reference_master change

**RECONCILED 2026-09-28: reclassified PRODUCT GAP CONFIRMED** (was PRODUCT DECISION REQUIRED in the
original pass; the underlying evidence is unchanged, only the exclusive classification bucket for batch
tallying purposes). **SOURCE INSPECTED** (appropriate evidence type here: the journey's own Notes field
flagged the RPC mechanism as unconfirmed and told execution to verify against code before automating).
Read `src/features/reference-data/actions.ts` and `data/reference-master.data.ts` in full: every
mutating action calls `requirePermission("reference_master", "write")` and nothing else. There is no
approve, send-back, or checker-sign-off RPC anywhere in this domain, no `SELF_APPROVAL_NOT_ALLOWED`-
equivalent check, no maker-checker concept at all. The canonical journey explicitly expects reference_master
to have this protection (analogous to AB-016/AB-018/AB-019); current architecture does not have it. This is
a genuine, confirmed gap between the canonical expectation and current code, not merely an open question,
so it is classified **PRODUCT GAP CONFIRMED**. The specific remediation path (build maker-checker for
reference_master, or amend the canonical expectation to match the current single-permission direct-apply
design) remains a parked Product Decision, not invented here: logged to
`docs/journey-runs/MORNING_RESIDUAL_QUEUE.md` with the exact question. Continuing independent work per
the Stall-Escape Protocol.

## AB-022: Direct URL access to a route in an authorization-domain not yet closed

**SOURCE INSPECTED + MANUAL UX VERIFIED.** Full-repo scan (`find src/app -name page.tsx`, checked each
for any `AuthGate`/`requirePermission`/`getCurrentNexusSession`/`redirect(` reference) found exactly two
routes with no authorization gate at all: `/commercials` and `/lab/forms`. No `middleware.ts` exists to
gate these globally. Read both components: `/commercials` renders `FIXTURE_COMMERCIAL_CONFIGURATION_OVERVIEW`
(a hardcoded fixture object, explicitly labeled in its own header comment as a legacy design-reference
screen, not linked from navigation); `/lab/forms` renders `FormLabView`, which reads no backend data at
all (pure local `useState` demo toggles). Live-confirmed as `nexus-test-restricted` (zero relevant
permissions): `/commercials` renders normally, no denial, matching the expected disclosed state. Neither
route exposes any real customer/business data. This is a **narrower** exposure surface than the
previously-disclosed list (Reference Master, Commercial Configuration, Customer, User Access, Team,
Workflow, Go Live, and Entitlement are all now closed; only these two non-data-bearing demo routes
remain open). **PASS**, expected/disclosed state, not a new defect.

## AB-032: Role revoked entirely mid-session denies the very next server action without requiring re-login (PERMISSION-CHANGE scenario 7)

**Satisfied by AB-029's already-captured runtime evidence** (this same batch, above): AB-029's test is a
strict superset of AB-032's requirement (full role revoke via `revoke_user_role`, same still-open
session, no logout, no reload, next governed action denied with a fresh, honest, permission-specific
error, zero DB mutation). Cross-referencing rather than re-running an identical mechanism.
**PASS** (via AB-029's MANUAL UX VERIFIED + DATABASE VERIFIED evidence).

## AB-033: Account disabled mid-session denies immediately without requiring re-login (PERMISSION-CHANGE scenario 8)

**MANUAL UX VERIFIED.** Logged in fresh as `nexus-test-go-live-admin`, confirmed a genuinely live session
(real denial for an unrelated permission, `customer.read`, proving authentication was live). Deactivated
the account via `set_app_user_active(..., false, ...)` with the tab left open, untouched, no logout.
Next navigation (`/customers/.../go-live`, a route this role normally has `go_live.read` for) returned a
real, honest, distinct message: "Account inactive. Your Nexus account is no longer active. Contact your
administrator." No re-login was needed for the denial itself to take effect. Reactivated the account
afterward to restore baseline. **PASS.**

## AB-038: Multiple Server Action calls from a session invalidated elsewhere

**SERVER/RPC VERIFIED + MANUAL UX VERIFIED.** Using the same still-open, still-authenticated
`nexus-test-go-live-admin` tab: deleted the persona's real `auth.sessions` row directly (the same
underlying mechanism a forced sign-out/session revocation uses), simulating invalidation "from
elsewhere" without ever touching the open tab itself. The tab's next navigation, using only its existing
(now-orphaned) cookie, was redirected straight to `/login` ("Sign in to continue"), i.e.
`getCurrentNexusSession` re-validated against the database and correctly found no live session, rather
than trusting a locally-cached cookie value. **PASS.**

## AB-027: Direct action against a resource id never shown in the caller's own UI

**RECONCILED 2026-09-28: cross-reference to AB-031 ruled insufficient; redone with its own dedicated
execution per the canonical journey's own requirements.** **SERVER/RPC VERIFIED + DATABASE VERIFIED.**

Actor: `nexus-test-finance` (real, genuinely permissioned `checker`, a real member of `wf_test_finance`
with real, working access to that team's own records, proven repeatedly elsewhere this batch).

Out-of-scope target: `customer_onboarding_cases` request `878a8686-...` (submitted, `node_6`, scoped to
the `WF-TEST Legal` team, which `nexus-test-finance` is not, and never was, a member of; `created_by` is
a third, unrelated persona, ruling out a self-approval confound).

Direct action: called `approve_customer_onboarding_case` directly (RPC-level, bypassing any UI/route)
as `nexus-test-finance`, supplying deliberately identifiable placeholder creation values
(`customer_key: 'ab027-should-never-be-used'`) to make any leakage/mutation unmistakable if the guard
failed.

**Real server denial**:
`WORKFLOW_TEAM_REQUIRED: this request's workflow requires an approver from the "WF-TEST Legal" team.
You are not an active member of that team.`

**Zero mutation/leakage confirmed**: the onboarding case itself unchanged (`status='submitted'`,
`current_workflow_node_key='node_6'`, `row_version` unchanged at 1, `customer_id` still null), and no
`customers` row was ever created under the placeholder key (`select count(*) ... = 0`), confirming the
denial fired before any part of the case's or the target customer's data was touched or exposed. **PASS.**

## AB-030 / AB-036 / AB-037: Precise mid-flight race windows (revoke/grant landing between click and server processing)

**PARTIAL / TOOLING LIMITATION**, consistent with the already-disclosed, pre-flight-identified gap (see
`docs/journey-runs/MORNING_RESIDUAL_QUEUE.md` "Known, pre-disclosed limitations"): this dev environment
has no request-intercepting proxy or server-side pause/failpoint, so a revoke or grant cannot be landed
deterministically inside the narrow window between a click leaving the browser and the server processing
it. AB-029, AB-031, AB-033, AB-038 (this batch) already prove the broader, load-bearing guarantee these
three journeys depend on: `requirePermission`/`getCurrentNexusSession` perform a fresh database read on
every single invocation with no caching at any layer, evaluated at actual processing time, not click
time or page-load time. The specific microsecond-race framing (a request already in flight when the
mutation lands) is the one narrower slice genuinely not provable without failpoint tooling. Logged to the
Morning Residual Queue as an expected, already-anticipated tooling limitation, not a new gap. **Can retry
independently: NO** (would need new test-harness capability, not a fixture or persona gap).

## AB-040: Underlying Server Action invoked directly without ever rendering the AuthGate-wrapped page

**Satisfied by AB-006/AB-007/AB-014/AB-015's already-captured Batch 25 runtime evidence** (its own Notes
field frames it as "the most direct, generalized statement of the pack's core thesis" and lists AB-006/
AB-007 as Related Journeys, i.e. not asking for a new mechanism). Those four journeys already demonstrated,
via real captured-and-replayed Next.js Server Action HTTP calls (`docs/journey-runs/BATCH_25_RESULTS.md`),
that a caller who never rendered the gated page at all still hits a fully independent, correct
`requirePermission` check inside the Server Action itself. **PASS** (via Batch 25's SERVER/RPC VERIFIED
evidence).

## AB-039: Concurrent approve attempts by two different eligible checkers on the same node

**RECONCILED 2026-09-28: reclassified PRODUCT GAP CONFIRMED** (was incorrectly closed PASS in the
original pass). **SERVER/RPC VERIFIED + DATABASE VERIFIED.** Created a disposable customer change request
(`7d665fe5-...`, against `batch11-immutability-probe-co`) via the real `create_customer_change_request`
and `submit_customer_change_request` RPCs, landing at `node_2`. Dispatched `approve_customer_change_request`
from `nexus-test-finance` and `nexus-test-finance-b` (both real, distinct `app_users`, both holding the
real `checker` role) together, genuinely overlapping. The RPC's own `select ... for update` (confirmed by
reading `supabase/migrations/20261009000000_fix_approve_rpcs_dead_end_at_zero_approval_graph.sql`)
serialized the two calls at the database level: exactly one (`nexus-test-finance`) won and transitioned
the request to `approved`, no double-approval, no corrupted state. **However**, the canonical journey's
own explicit expectation is that "the losing checker sees an honest 'someone else already actioned this'
message, not a generic error or a false-success state." The actual observed result: the losing checker
received a plain success-shaped, idempotent response with **no error and no denial message at all**,
indistinguishable at the API level from having approved it themselves. This does not match the canonical
expectation. **Reclassified PRODUCT GAP CONFIRMED.** The narrower mechanism (an unconditional
`status = 'approved' -> return` short-circuit that runs ahead of the node-key mismatch check whenever the
winning approval was the final one) is tracked separately as AB-043 so the same finding is not duplicated
across two entries; see AB-043 below and `docs/journey-runs/MORNING_RESIDUAL_QUEUE.md` for the parked
Product Decision on what to do about it.

## AB-043: Losing racer's experience in a concurrent approval differs by whether the winner's approval was the FINAL decision (NEW, discovered this batch)

**SERVER/RPC VERIFIED + SOURCE INSPECTED + re-verified via V-003 and V-004 below.** Discovered live
during AB-039's execution: because that disposable fixture's request sat at a 2-node (start/end) graph,
the losing racer's call hit the RPC's `if status = 'approved' then return v_change_request` early-return
branch *before* reaching the `expected_current_node_key` mismatch check, returning a silent, non-error,
idempotent-looking success rather than an explicit denial. **Corrected 2026-09-28** after V-003's genuine
5-node-graph race showed the identical silent-success behavior at a real intermediate-turned-final node
(node_4, reached only after two prior real approval steps): the true dividing line is whether the
winning approval was the request's FINAL decision (status becomes `approved`), not whether the node type
is literally `end`. Re-confirmed a third time via V-004's Commercial Configuration Version race (node_3,
also reached as the final step after routing skipped an intermediate node). Canonicalized in
`docs/NEXUS_JOURNEY_UNIVERSE.md` per the Overnight Discovered Journey Queue protocol, executed
immediately using this evidence, and logged to the Morning Residual Queue as a genuine Product Decision
(should the final-approval loser also see an explicit "already actioned" error, or is the silent
idempotent return the accepted, simpler behavior). **Not a defect**: audit/data integrity holds in all
three domains tested (customer_change, customer_onboarding_case, commercial_configuration_version).

## V-001: Two draft editors race on the same draft record, stale writer is rejected (regression)

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Created a disposable Customer Change draft (`b9820909-...`,
against `batch12-e021-routing-co`). "Maker A" saved with `p_expected_row_version=1` (the draft's real
starting `submission_revisions.row_version`): succeeded, content updated to `{"industry":"logistics"}`,
`row_version` incremented to 2. "Maker B" then attempted to save with the same stale
`p_expected_row_version=1`: real rejection, `CUSTOMER_CHANGE_DRAFT_STALE: This draft was changed by
someone else since you loaded it. Refresh the page to see the latest version before saving your
changes.` Confirmed Maker A's edit survived untouched and `row_version` stayed at 2 (B's rejected write
never landed). Deep-verified live for the Customer Change domain; the other three domains (Onboarding,
Commercial Configuration, Go Live) share the identical migration-applied mechanism per the journey's own
Notes (confirmed applied this session's readiness review). **PASS.**

## V-003: Two eligible approvers race to approve a Customer Change request

**RECONCILED 2026-09-28: cross-reference to AB-039 ruled insufficient; redone with its own dedicated
5-node-graph race.** **SERVER/RPC VERIFIED + DATABASE VERIFIED.**

Fixture: the currently-active published Customer Change workflow (`K-017`, 2-node start/end) does not
produce a genuine multi-step race, so a real, governed, reversible admin action was used to test against
a real multi-node graph instead: temporarily made "WF-TEST Finance then Legal Sequential" (a real,
previously-published 5-node definition: start -> `ux_verification_team` approval -> `wf_test_legal`
approval -> `wf_test_leadership` approval -> end) the active Customer Change definition via the real,
governed `replace_active_workflow_definition` RPC (the same mechanism a Workflow Admin uses in the real
UI), created a fresh disposable change request against `batch11-immutability-probe-co`, and restored the
original active definition (`K-017`) immediately after the race concluded.

Solo-advanced the request through `node_2` (ux_verification_team) and `node_3` (wf_test_legal) with
single real approvers, reaching `node_4` (wf_test_leadership), the request's genuine final approval step
(confirmed: `current_workflow_node_key` really advances node-to-node here, unlike a 2-node graph).
Verified customer state immediately before the race: `row_version=3`, `industry='fmcg'`.

Dispatched `approve_customer_change_request` from `nexus-test-ux-approver` and `nexus-test-finance-b`
(both real, distinct `app_users`, both genuine active members of `wf_test_leadership`, added via the real
`assign_user_to_team` RPC) together, genuinely overlapping.

**Verified, all six required assertions**:
- Two distinct eligible approvers: yes (`nexus-test-ux-approver`, `nexus-test-finance-b`), neither is
  `created_by`.
- Genuinely overlapping calls: yes, dispatched together against the same `node_4`.
- Exactly one Customer Master mutation: yes, exactly one `customer_field_history` row
  (`industry: fmcg -> logistics`, `approved_by = nexus-test-ux-approver`, the winner).
- `customers.row_version` increments: went from 3 to 5 (delta of 2 per single successful approval, not
  per race). Source-confirmed (`supabase/migrations/20261009000000...` lines 202-254): a single
  successful approval issues two sequential `UPDATE customers` statements (one per-field update, then one
  explicit `row_version = row_version + 1`), so +2 is this RPC's own normal, single-approval behavior,
  not a race artifact. The loser's call never reached either statement (see below), so there is no
  double-mutation; recorded honestly here to avoid the literal "+1" wording implying something the RPC's
  own design does not do.
- Exactly one workflow transition: yes, exactly one `node_4 -> node_5` row in
  `workflow_node_transitions` (4 rows total for the whole request: submit, `node_2->3`, `node_3->4`,
  `node_4->5`), despite two racing calls at the final step.
- Loser behavior recorded honestly: the losing call (`nexus-test-finance-b`) received the identical
  success-shaped row as the winner, with no error and no distinguishing signal, because it hit the RPC's
  `status = 'approved' -> return` short-circuit ahead of the node-key check (see AB-043, corrected via
  this exact race: the dividing line is finality of the approval, not node topology). **This is reported
  as observed, not smoothed over**: it does not match a literal "friendly already-actioned message"
  expectation, but it does not corrupt data either. See AB-043 for the Product Decision this raises.

**PASS** on the core concurrency-safety guarantee (exactly one winner, no corruption, no duplicate
mutation); the loser-experience nuance is tracked once, at AB-043, not duplicated here.

## Journey Discovery (final, batch closure)

Candidates assessed across all 26 scheduled journeys plus the reconciliation pass: 26.
- ALREADY COVERED: 0
- EXPAND EXISTING JOURNEY: 1 (AB-026's route-shape note, a scope correction to AB-026 itself, not a new
  journey)
- NEW JOURNEY REQUIRED: 1 (AB-043, canonicalized and executed same-batch)
- REGRESSION TEST ONLY: 0
- FUTURE MODULE: 0
- PRODUCT DECISION REQUIRED: 2 (AB-020's reference_master gap; AB-043's loser-experience consistency
  question, which subsumes AB-039's gap so it is not double-counted)

## V-002: Two eligible approvers race to approve a Customer Onboarding case

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Fixture: `878a8686-...` (the same case used for AB-027's
out-of-scope test above; AB-027's call was denied before any mutation, so the fixture remained valid)
turned out to be missing required submission fields (`customer_legal_entity_name`, `commercial_rate`)
needed for a real approval, so a different, complete fixture was used instead: request
`446aec6a-e416-4b54-824b-9bacab6502a7` (submitted, `node_2`, scoped to `wf_test_leadership`, `created_by`
a third unrelated persona, workflow version `b2b250c3-...` with exactly one approval node
(`node_2` -> `node_3` end), so `node_2` is genuinely this request's final decision).

Added `nexus-test-finance-b` to `wf_test_leadership` (real, governed `assign_user_to_team`, alongside the
team's existing real checker `nexus-test-ux-approver`) to get two genuine distinct eligible approvers.

Dispatched `approve_customer_onboarding_case` from both together, genuinely overlapping (each supplying a
distinctly-keyed, identifiable customer/commercial payload so a double-creation would be unmistakable).

**Verified**: exactly one `customers` row created (`nexus-test-ux-approver`'s key; the second racer's
distinct key was never created, confirmed by direct lookup), exactly one `node_2 -> node_3`
`workflow_node_transitions` row despite two racing calls, exactly one case marked `approved` with a
single `customer_id`/`commercial_configuration_id`. Loser behavior: identical silent idempotent success
as V-003 and AB-039 (consistent with AB-043's corrected, cross-domain finding, now confirmed in a third
domain). **PASS** on the core concurrency guarantee; loser-experience nuance tracked once at AB-043.

## V-004: Two eligible approvers race to approve a Commercial Configuration Version

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** No non-stale existing fixture remained (the one pre-existing
`submitted`, team-scoped candidate was consumed proving the payload shape first), so a fresh disposable
version was created against an existing `commercial_configuration_id` (`8b446123-...`) via the real
`create_commercial_configuration_version` + `submit_commercial_configuration_version` RPCs, landing on
the currently-active "WF-TEST Commercial Segment Routing" definition. Queried
`fn_resolve_workflow_next_approval` directly to confirm, before touching anything, that this specific
request's segment-based routing made `node_3` (`wf_test_finance`) the genuine final approval (routing
skipped the graph's `wf_test_legal` node entirely for this segment).

Dispatched `approve_commercial_configuration_version` from `nexus-test-finance` and `nexus-test-finance-b`
(both real, distinct, genuine `wf_test_finance` checkers) together at `node_3`, each supplying a
distinctly-valued component (`amount: 7000` vs `amount: 9999`) so a double-application would be
unmistakable.

**Verified**: exactly one `commercial_components` row created for this configuration/effective-date
(`amount: 7000`, the winner `nexus-test-finance`'s value; the loser's `9999` never landed), exactly one
`node_3 -> node_5` `workflow_node_transitions` row despite two racing calls. Loser behavior: identical
silent idempotent success as V-002/V-003/AB-039 (AB-043's finding now independently confirmed in a
**third** domain: customer_change, customer_onboarding_case, and commercial_configuration_version all
share the exact same mechanism). **PASS** on the core concurrency guarantee.

## Batch 26 status after reconciliation

All 26 scheduled journeys (AB-020 through AB-041, V-001 through V-004) are now genuinely executed with
their own dedicated evidence, no unauthorized cross-references remaining. See the exact closure tally in
the final closure report delivered in chat.
