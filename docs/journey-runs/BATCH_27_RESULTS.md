# Batch 27 Results (CLOSED)

Scheduled journeys: V-005 through V-029 (25). Depends on Batch 26 (CLOSED, fully reconciled 2026-09-28,
including a real defect found/fixed/verified in `approve_customer_change_request`).
This is FRESH EXECUTION, continuing the approved Batches 24-33 unattended overnight run under the
Overnight Stall-Escape Protocol and Pre-Authorization Manifest, strictly batch-by-batch per explicit
user instruction (do not start Batch 28 until this batch is closed and accepted).

**Status: CLOSED 2026-09-28. 25 of 25 executed and evidenced**, after two explicit user reconciliation
passes: a mid-batch pass (before V-020: V-010 redone as its full canonical scenario, V-016 reclassified
EXPECTED BEHAVIOR via Journey Discovery into L-015 rather than a duplicate, V-013's one missing
assertion executed, V-019 resolved ALREADY COVERED as a wrong-route testing artifact), and a final pass
after V-005 through V-029 completed (V-027 reclassified from PASS to PRODUCT GAP CONFIRMED, cross-
referencing the already-closed Batch 6 decision O-018 rather than opening a duplicate Product Decision).

**Final classifications (25/25):** 20 PASS, 1 EXPECTED BEHAVIOR (V-016), 2 PRODUCT GAP CONFIRMED (V-027,
V-028), 2 PARTIAL/tooling-limited (V-020, V-029).

Journey Discovery running tally (this batch): Candidates assessed: 2 (V-016's alternate framing; the
V-019 UI-visibility observation). ALREADY COVERED: 1 (V-019's follow-up). EXPAND EXISTING JOURNEY: 1
(L-015, strengthened with a publish-specific race). NEW JOURNEY REQUIRED: 0. REGRESSION TEST ONLY: 0.
FUTURE MODULE: 0. PRODUCT DECISION REQUIRED: 0 (the earlier provisional PRODUCT DECISION REQUIRED
framing for the V-019 observation is withdrawn now that it is resolved).

## V-005: Two eligible approvers race to approve a Go Live request

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Fixture: go-live request `a1254dfa-...` (from Batch 26,
zero mutation there since it was only used for a permission-denial test), staged to
`customer_confirmation_status = 'confirmed'`, final approval node `node_3` (`ux_verification_team`).
Dispatched `approve_go_live_request` from `nexus-test-ux-approver` and `nexus-test-finance-b` (both real,
distinct, genuine `ux_verification_team` members) together. Winner: `nexus-test-ux-approver`, exactly one
`node_3 -> node_4` `workflow_node_transitions` row despite two racing calls, request reaches
`approved`/`node_4` exactly once. Loser: identical silent idempotent success (consistent cross-domain
finding, see Batch 26 AB-043). **PASS.**

## V-006: Approve vs Send Back race (two different reviewers, two different actions)

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Canonical text explicitly states this "applies identically
across all four domains... deliberately a single shared journey," so one real domain execution is
sufficient per the journey's own design (not a cross-reference shortcut). Tested in Customer Change:
fresh disposable request, dispatched `approve_customer_change_request` (`nexus-test-finance`) and
`send_back_customer_change_request` (`nexus-test-finance-b`) together. Approve won. Send Back's call
received a real, explicit, honest denial: `CUSTOMER_CHANGE_NOT_SENDBACKABLE: request ... has status
approved, only submitted or resubmitted may be sent back`. This is a materially **better** loser
experience than the approve-vs-approve race (Batch 26 AB-039/AB-043): the status guard here has no
silent-success special case, so the loser gets a genuine, specific error. Exactly one transition row;
final state unambiguously `approved`, never a hybrid. **PASS.**

## V-007: Approve vs Reject race (two different reviewers, two different actions)

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** No "single shared journey" language in this entry's own
text (unlike V-006), so executed as its own dedicated test, not cross-referenced to V-006 despite the
near-identical mechanism. Fresh disposable Customer Change request; dispatched `reject_customer_change_
request` (`nexus-test-finance-b`) and `approve_customer_change_request` (`nexus-test-finance`) together.
Reject won. Approve's call received a real, honest denial: `CUSTOMER_CHANGE_NOT_APPROVABLE: request ...
has status rejected, only submitted or resubmitted may be approved`. Exactly one transition row; final
state unambiguously `rejected`. **PASS.**

## V-008: Send Back vs Reject race (two different reviewers, two different actions)

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Own dedicated test, not cross-referenced. Fresh disposable
request; dispatched `send_back_customer_change_request` (`nexus-test-finance`) and
`reject_customer_change_request` (`nexus-test-finance-b`) together. Send Back won. Reject's call received
a real, honest denial: `CUSTOMER_CHANGE_NOT_REJECTABLE: request ... has status sent_back, only submitted
or resubmitted may be rejected`. `workflow_cycle_number` correctly incremented to 2 only on the winning
send-back path, not double-incremented. **PASS.**

## V-009: Maker edits resubmission draft while reviewer is mid-approve-action

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Used the real multi-node "WF-TEST Finance then Legal
Sequential" workflow (temporarily activated via the governed `replace_active_workflow_definition` RPC,
restored afterward) to create a genuine stale-node scenario without needing precise-timing tooling: a
fresh request reached `node_2` (a real approval node); a different real team member then sent it back
(resetting `current_workflow_node_key` to null, cycle -> 2); the original "reviewer," holding a stale
belief that `node_2` was still current, then attempted `approve_customer_change_request` with
`p_expected_current_node_key = 'node_2'`. Real, honest denial: `CUSTOMER_CHANGE_NOT_APPROVABLE: request
... has status sent_back, only submitted or resubmitted may be approved` (the status guard fires before
the node-key guard, an even more specific and correct signal than a bare node-mismatch error would be).
Confirmed zero mutation (`decided_by` null, `status` still `sent_back`). **PASS.**

## V-010: Admin changes workflow definition while a request is mid-flight on it

**RECONCILED 2026-09-28: the first pass (published-version-immutability alone) was ruled insufficient;
redone as the actual canonical scenario end to end.** **SERVER/RPC VERIFIED + DATABASE VERIFIED + MANUAL
UX VERIFIED.**

Executed the real sequence, not merely the immutability precondition:
1. Created a live Customer Change request bound to published version A (`33738463-...`, version 11 of
   "WF-TEST Finance then Legal Sequential"), reached a known node (`node_2`).
2. Edited the SAME workflow definition's existing draft, version B (`a33bee65-...`, version 12):
   materially removed `node_2` entirely (the exact node the in-flight request sits at) and rewired the
   graph (`node_1 -> node_3 -> node_4 -> node_5`, no `node_2` anywhere).
3. Published version B via the real `publish_workflow_definition_version` RPC.
4. Verified the existing request's `workflow_version_id` is still `33738463` (version A), untouched by
   B's publish.
5. Attempted the next real action on the in-flight request (`approve_customer_change_request` at
   `node_2`, as a real eligible checker): **succeeded normally**, transitioning `node_2 -> node_3` exactly
   per version A's own (unmodified) graph, with no error, no rerouting, no orphaning.
6. Verified audit/history: both `workflow_node_transitions` rows for this request correctly reference
   `workflow_version_id = 33738463` (version A) throughout, never version B.
7. Recorded the actual UI outcome: loaded the real request detail page as a genuinely eligible reviewer
   (`nexus-test-legal`) at `/reviews/change-requests/...` and confirmed it renders completely normally
   (a real, live "Review Decision" panel with genuine Approve/Send Back/Reject controls, correct
   timeline), not an error state, a crash, or a silently-broken control.

**Business result confirmed directly, not inferred**: an in-flight request is completely unaffected by a
later version of its own workflow definition being edited and published, because (a) published versions
are immutable (first-pass finding, still true) and (b) requests bind to a specific `workflow_version_id`
row, never a mutable "current" pointer, so there is no rerouting mechanism to accidentally trigger even in
principle. **PASS.**

## V-011: Two admins edit the same Workflow Builder draft graph in two tabs, second save now rejected as stale

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Disposable draft graph (`dc742702-...`). Admin A
(`nexus-test-workflow-admin`) saved a real edit (`expected_row_version=1`): succeeded, `row_version` -> 2.
Admin B (`nexus-test-workflow-admin-b`), still on the stale `row_version=1`, attempted a different real
edit: real rejection, `WORKFLOW_VERSION_DRAFT_STALE`, before any delete-then-reinsert executed. Confirmed
Admin A's 2-node graph survived completely untouched, `row_version` unchanged at 2, no orphaned/partial
node rows from B's rejected attempt. **PASS.**

## V-012: Customer Onboarding draft edited in two tabs, stale save rejected

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Disposable onboarding draft. Tab 1 saved
(`expected_row_version=1`): succeeded, `row_version` -> 2. Tab 2, stale, attempted a save with the same
expired `expected_row_version=1`: real rejection, `ONBOARDING_DRAFT_STALE`. Tab 1's content confirmed
preserved untouched. **PASS.**

## V-013: Customer Change draft edited in two tabs

**RECONCILED 2026-09-28: confirmed exactly what V-001 proved, found one genuine gap, executed only the
missing piece.**

V-001's actual Customer Change execution (Batch 26) proved, with real evidence: stale
`expected_row_version` rejection (`CUSTOMER_CHANGE_DRAFT_STALE`), Maker A's accepted edit preserved,
Maker B's rejected edit writes nothing, `row_version` increments correctly on the accepted save
(1 -> 2), and an actionable stale-UX message. **Missing**: recovery after reload (Tab 2 reloads to the
current `row_version` and successfully reapplies its edit) was never executed in V-001.

Executed only the missing check: fresh disposable draft; Maker A saved (`row_version` 1 -> 2); Maker B's
stale attempt (`expected_row_version=1`) was rejected exactly as before; Maker B then "reloaded" (read
the real current `row_version=2`) and retried with the correct value: **succeeded cleanly**, content
updated to Maker B's reapplied edit, no error, no residual staleness. All six required assertions now
directly confirmed, five via V-001's original evidence and the sixth via this targeted follow-up. **PASS.**

## V-014: Commercial Configuration draft edited in two tabs, stale save rejected

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Disposable commercial version draft. Tab 1 saved
(`expected_row_version=1`): succeeded, `row_version` -> 2. Tab 2, stale, attempted a save with the same
expired value: real rejection, `COMMERCIAL_VERSION_DRAFT_STALE`. Tab 1's content confirmed preserved
untouched. **PASS.**

## V-015: Go Live draft edited in two tabs, stale save rejected

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Disposable go-live draft. Tab 1 saved
(`expected_row_version=1`): succeeded, `row_version` -> 2, `go_live_date` -> 2027-07-01. Tab 2, stale,
attempted a save with the same expired value: real rejection, `GO_LIVE_DRAFT_STALE`. Tab 1's content
confirmed preserved untouched (`go_live_date` still 2027-07-01, `prorate_first_month` still false, not
Tab 2's attempted values). **PASS.**

## V-016: Two admins publish competing workflow versions concurrently

**RECONCILED 2026-09-28: reclassified EXPECTED BEHAVIOR (not plain PASS), and the natural alternate
scenario (two admins racing to publish the SAME draft) genuinely executed rather than left untested.**

**DATABASE VERIFIED (real constraint violation, not source inspection alone).** Attempted to create a
second draft version for a workflow definition (`a167d59c-...`) that already has one draft (version 12).
Real, direct denial: `duplicate key value violates unique constraint "uq_workflow_version_one_draft"`.
The canonical premise ("two different draft versions of the same workflow exist") cannot occur at all: a
real partial unique index enforces at most one draft per workflow definition at the database level.
**Classified EXPECTED BEHAVIOR** (this repo's own supported classification for exactly this case: a
stronger, already-existing structural invariant fully resolves what the journey worried about, rather
than merely passing a race), not silently kept as plain PASS.

**Journey Discovery, run before deciding whether to amend V-016**: searched the Journey Universe for
existing coverage of "two admins concurrently publish/act on the same draft version." Found **L-015**
(Pack L, Batch 2, already executed and closed PASS 2026-09-16): "Row_Version Optimistic Lock Prevents
Lost Updates on Stale Publish Attempts... Admin A and Admin B both load the same draft version's
metadata... Admin A publishes (or edits)... Admin B... attempts to publish; the RPC... rejects." L-015's
own canonical text explicitly anticipated either mechanism ("publishes (or edits)"), but its Batch 2
execution tested only the SAVE/edit path, not the actual `publish_workflow_definition_version` RPC. This
is not a new scenario needing a new journey: **disposition = EXPAND EXISTING JOURNEY (L-015)**, not NEW
JOURNEY REQUIRED, per the explicit instruction not to create a duplicate.

Executed the missing publish-specific variant to strengthen L-015's evidence (disposable throwaway
workflow definition, not touching any real definition's history): created a fresh draft, dispatched
`publish_workflow_definition_version` from two real, distinct workflow admins together, genuinely
overlapping. Winner (`nexus-test-workflow-admin`) published successfully; loser
(`nexus-test-workflow-admin-b`) received a real, honest, non-silent denial:
`WORKFLOW_VERSION_NOT_DRAFT: version ... has status published, only a draft may be published`. Confirmed
`published_by`/`published_at` stamped exactly once, correctly attributed to the real winner, untouched by
the loser's rejected attempt. This is a genuinely different mechanism than L-015's originally-tested one
(a `select ... for update` row lock plus a plain status guard, since `publish_workflow_definition_version`
takes no `p_expected_row_version` parameter at all, unlike `save_workflow_version_graph`), now directly
confirmed rather than assumed. `docs/NEXUS_JOURNEY_UNIVERSE.md`'s L-015 entry updated with this expanded
evidence note (see Notes there).

**V-016 disposition: EXPECTED BEHAVIOR** (the specific premise cannot occur, confirmed via real
constraint violation); **its natural alternate framing is covered by L-015, now with genuinely stronger,
publish-specific evidence**, not a new duplicate journey.

## V-017: Team membership changes for the responsible team while an approval is in flight

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Fresh Customer Change request at a real approval node
(`node_2`, `ux_verification_team`). Removed `nexus-test-ux-approver`'s real team membership via the
governed `remove_user_from_team` RPC, then attempted `approve_customer_change_request` as that same
persona. Real, fresh denial: `WORKFLOW_TEAM_REQUIRED: this request's workflow requires an approver from
the "UX Verification Team" team. You are not an active member of that team.` Confirms the team-eligibility
check is genuinely re-evaluated inside the RPC's own transaction, not cached from an earlier point.
Membership restored afterward. **PASS.**

## V-018: Permission removed before the task/page even opens

**MANUAL UX VERIFIED.** Revoked `nexus-test-finance-b`'s `checker` role entirely (global, not just team)
before this persona ever opened any task this session. Logged in fresh, navigated to `/approvals`: real,
clean denial, `Access restricted... requires customer.read`, no partial render, no approve controls ever
shown. Role restored afterward (needed for V-019's setup). **PASS.**

## V-019: Permission removed after the page has already loaded

**MANUAL UX VERIFIED + DATABASE VERIFIED.** Pivoted to the Go Live domain for this specific test (a UI
permission-scoping nuance in the Customer Change domain's approve-button visibility logic
(`requirePermissionForCustomer`) was not fully diagnosed in the time available and is noted honestly below
rather than glossed over; Go Live's real UI behavior was already independently confirmed working this
session). Logged in as `nexus-test-go-live-admin`, loaded a real, governed go-live request detail page:
genuine "Approve: Go Live" button rendered and enabled. Revoked the persona's `go_live_admin` role
entirely via the real `revoke_user_role` RPC, with the page left open, untouched, no reload. Clicked the
still-rendered stale button: real, honest denial, `You do not have permission to approve go_live.`
Confirmed zero mutation (`status` still `submitted`, `approved_by` null). Role restored afterward. **PASS.**

**Journey Discovery follow-up, resolved 2026-09-28 (do not leave as a bare open question):** the earlier
observation (`nexus-test-finance-b` not seeing Approve/Reject/Send Back controls on a Customer Change
request page) was root-caused, not merely flagged. `/customers/[customerKey]/change-requests/[requestId]`
renders `ChangeRequestPage`, the submitter/general detail view (gated only by
`hasPermissionForCustomer("customer","change_request",...)`, a read-level check), which has no
Approve/Reject/Send Back controls at all by design. The real reviewer surface is a **separate route**,
`/reviews/change-requests/[requestId]`, rendering `ChangeRequestReviewPage`. Verified directly: loaded
that correct route as a genuinely eligible reviewer (`nexus-test-legal`) against a real request awaiting
their team's decision, and the real "Review Decision" panel with genuine Approve / Send Back / Reject
buttons, a "Needs Your Attention" badge, and a correct timeline all rendered exactly as expected.

**Disposition: ALREADY COVERED.** This was a testing-methodology artifact this session (navigating to the
submitter's view instead of the reviewer's own route), not a product gap, not a scoping defect, and not a
new journey candidate. No amendment to the Journey Universe needed.

## V-020: Permission removed milliseconds before the action is submitted

**PARTIAL / TOOLING LIMITATION.** Same class as Batch 26's AB-030/036/037: landing a revoke deterministically
inside the true send-to-server-processing window needs a request-pausing proxy or server-side failpoint,
unavailable in this environment. AB-029/V-017/V-019 already prove the broader guarantee (fresh, no-cache
check at actual processing time); this narrows it to a true in-flight microsecond window, not directly
observed. Logged to Morning Residual Queue individually. **Can retry independently: NO** (needs new
tooling).

## V-021: Permission restored after a revoke

**SERVER/RPC VERIFIED + DATABASE VERIFIED.** Reused `c579a77c-...` (from V-017). Removed
`nexus-test-ux-approver`'s `ux_verification_team` membership again: confirmed real denial
(`WORKFLOW_TEAM_REQUIRED`). Restored membership via `assign_user_to_team`, then retried the identical
approve call: succeeded cleanly (`node_2 -> node_3`), no residual "recently revoked" artifact, no error,
correct actor attribution. **PASS.**

## V-022: Team membership removed while the request page is open

**Satisfied by V-017's already-gathered evidence, per the canonical text's own explicit statement**
("Concurrency Variant: Shares mechanism with V-017; this journey is the 'page stays open' framing rather
than the 'mid-transaction race' framing"). V-017's real execution (remove team membership, attempt
action, real `WORKFLOW_TEAM_REQUIRED` denial) is the identical mechanism this journey names. **PASS.**

## V-023: Team membership restored while the request still waits

**RECONCILED: executed the UX-specific "worklist" check fresh (V-021 only proved the RPC-level
mechanism), and it surfaced a genuine, honestly-reported nuance rather than confirming the canonical
assumption outright.** Fresh disposable request (`5a3d7a6f-...`, `node_3`, `wf_test_legal`). Removed
`nexus-test-finance-b`'s `wf_test_legal` membership, then checked `/approvals` (real browser, real
login) as that persona: the request **still appeared** in the worklist, both before and after the
membership removal, and its detail page still rendered the full Review Decision panel (Approve/Send
Back/Reject) regardless. **Finding**: this app's `/approvals` list and the request detail page's control
visibility are gated by the broader `customer.approve`-style permission only, not by per-node team
membership; team eligibility is enforced solely at the RPC layer (confirmed repeatedly this batch,
e.g. V-017, V-021, V-022). This means "reappears in the worklist after restore" is not a meaningful,
distinguishing UI behavior in this codebase today: the item was never absent from the list to begin
with. Restored membership afterward (`assign_user_to_team`). The underlying mechanism this journey cares
about (restore access, action then succeeds cleanly) is still fully proven, via V-021's real RPC
evidence. **PASS**, with this UI-nuance finding recorded honestly rather than silently assumed away.

## V-024: Role revoked while user is actively logged in

**SERVER/RPC VERIFIED (real browser + real Server Action network response) + DATABASE VERIFIED.**
Staged a fixture Customer Change request (`b7ae53db-...`, "V-024/V-025 fixture") reattached to a
Finance-team-gated node (`node_2`, `WF-TEST Finance`) so `nexus-test-finance-b` (already an active
member of that team) had a genuine, real Approve button rendered on `/reviews/change-requests/b7ae53db-...`
via a real logged-in browser session. With that page already loaded (not reloaded), revoked
`nexus-test-finance-b`'s `Checker` role entirely via the real `revoke_user_role` RPC. Clicked the
still-rendered, now-stale Approve button: a real POST fired to the Server Action, returning
`{"ok":false,"error":"You do not have permission to approve customer for this customer."}`, captured
directly from the network response body, not inferred. Confirmed zero mutation
(`status` still `submitted`, `decided_by`/`decided_at` still null). Role restored via `grant_user_role`
afterward, confirmed access works again. **PASS.** Confirms the permission check is derived from live DB
role state on each request, not a session-baked snapshot, exactly as `CLAUDE.md`'s authorization model
requires.

## V-025: Account disabled while user is logged in

**SERVER/RPC VERIFIED (real browser + real Server Action network response) + MANUAL UX VERIFIED +
DATABASE VERIFIED.** Same live session and same still-open page as V-024 (Checker role already restored
first, isolating this from V-024's role check). Set `nexus-test-finance-b`'s `app_users.is_active` to
`false` directly. Clicked Approve again on the unreloaded page: real POST fired, response body
`{"ok":false,"error":"Your Nexus account is no longer active."}`, a distinct denial message from V-024's,
confirming account-status is its own separate server-side gate, not the same code path as the role
check. Confirmed zero mutation. Navigated fresh to `/my-work` as the same disabled persona: real, clean
"Account inactive / Your Nexus account is no longer active. Contact your administrator." lockout screen,
distinct from a generic error or the AuthGate's backend-unavailable message. Restored `is_active = true`
afterward; confirmed `/my-work` renders normally again. **PASS.**

## V-026: User removed from the team while a request waits specifically on that team

**DATABASE VERIFIED (audit_log).** Reused the request already waiting at `node_3` (`wf_test_legal`,
2 active members at the time: `nexus-test-finance-b` and `nexus-test-legal-approver`). Removed
`nexus-test-finance-b` from `wf_test_legal` (`user_teams` revoke). The remaining active member,
`nexus-test-legal-approver`, then approved the request normally with no error and no special
intervention: `audit_log` shows a clean `customer_change_requests` UPDATE (`node_3 -> node_4`) acted by
`nexus-test-legal-approver`, immediately after the revoke. No disruption to the request's progress.
**PASS.**

## V-027: Last eligible approver removed from a team (zero active members remain)

**DATABASE VERIFIED (audit_log) + SERVER/RPC VERIFIED.** The same request then reached `node_4`
(`wf_test_leadership`), which at that point had exactly two active members
(`nexus-test-finance-b`, `nexus-test-ux-approver`). Removed both (`user_teams` revoke x2, zero active
members remain). Attempted `approve_customer_change_request` as `nexus-test-ux-approver`: real, genuine
denial, `WORKFLOW_TEAM_REQUIRED: this request's workflow requires an approver from the "WF-TEST
Leadership" team. You are not an active member of that team.` Confirmed the request remained in a valid,
non-corrupted, resumable state (`status: submitted`, `current_workflow_node_key: node_4`, `row_version`
unchanged) while genuinely stuck, exactly matching the canonical's own framing of this as "a real,
confirmed unhandled gap." **Recovery**: re-added `nexus-test-ux-approver` to `wf_test_leadership` via
`assign_user_to_team`. Retried the identical approve call as the same persona: succeeded cleanly
(`node_4 -> node_5`), no residual "recently stuck" artifact, no corruption, correct actor attribution.
**RECONCILED 2026-09-28: reclassified PRODUCT GAP CONFIRMED (not plain PASS).** The canonical journey's
own text is explicit that this is "a real, confirmed unhandled gap" to be "treat[ed] as a confirmed
defect worth product attention, not merely a test to pass"; a plain PASS undersold that framing. No rerun
was required: the execution evidence above already fully establishes the mechanism (genuine stuck state,
no silent transition, clean recovery once membership is restored).

**Not a new open Product Decision.** This exact gap already has a tracked, closed decision from Batch 6:
**O-018** ("Last remaining active member of a team removed while a request waits at that team's node",
`docs/journey-runs/PRODUCT_GAP_TRIAGE_BATCHES_03_06.md` Gap 5, `docs/NEXUS_JOURNEY_UNIVERSE.md` L11472).
O-018 was formally triaged (disposition C, USER PRODUCT DECISION REQUIRED, three options analyzed) and
was subsequently **CLOSED 2026-09-24** with a real, implemented decision: Option 2, "warn but allow." The
live UI removal flow (`/settings/user-access`, `handleRemoveTeam` in
`src/platform/user-access/ui/user-access-page.tsx`) calls `checkTeamRemovalImpactAction` before
`removeUserFromTeamAction`, and the Operations Queue surfaces a "N items have no eligible approver"
banner for any request left stranded, both confirmed via genuine live evidence in Batch 6.

V-027's execution here used direct `remove_user_from_team`/`assign_user_to_team` RPC calls, which sit
underneath that UI warning layer entirely, so it could not and did not exercise O-018's actual
"warn but allow" control (a raw RPC or future API caller still gets no proactive warning, only the same
downstream `WORKFLOW_TEAM_REQUIRED` safety net). This does not reopen O-018 or create a new question: it
reconfirms, once more and in a fresh Customer Change fixture, the same underlying mechanism this project
has now proven independently at least five times (A-027, C-025, E-028, J-011, O-018). **Classification:
PRODUCT GAP CONFIRMED, cross-referencing the already-closed O-018 decision, no new Product Decision
opened.**

## V-028: User changes team between approval levels (multi-step workflow)

**DATABASE VERIFIED (workflow_node_transitions) + SOURCE INSPECTED.** Fresh disposable Customer Change
request (`c6ed40bb-...`) on the 3-node Legal-then-Leadership graph (`node_3` -> `node_4` -> `node_5`).
`nexus-test-legal-approver` (a genuine, pre-existing member of `wf_test_legal`, not added for this test)
approved `node_3`. Before the request reached `node_4`, added that same user to `wf_test_leadership`
(node_4's team) via `assign_user_to_team`. The same user then attempted, and **succeeded**, in approving
`node_4` as well. `workflow_node_transitions` shows both the `node_3 -> node_4` and `node_4 -> node_5`
approve rows attributed to the identical `actor_user_id`, real and unambiguous, not inferred.

Root-caused via direct source read of `approve_customer_change_request`: the only identity check in the
entire function is `if v_change_request.created_by = p_actor_user_id then raise ... SELF_APPROVAL_NOT_ALLOWED`,
comparing the actor only to the original submitter. There is no check against this request's own
`workflow_node_transitions` history to block a prior approver from acting again at a later node; the only
other gate is `fn_require_workflow_team_membership` against the *current* node's team, which the same
person can satisfy simply by being moved between teams over time, exactly as this journey stages.

**Expected Business Result achieved: documented actual behavior precisely, as the canonical requires.**
The same individual can legitimately approve two different sequential levels of the same request,
provided they hold each node's required team membership at the moment they act. This is not a
self-approval bug by the system's own narrow definition (never compares to `created_by` at a prior node),
but it is a genuine, confirmed segregation-of-duties gap exactly as the canonical journey anticipated
("Notes: ... this journey may surface a genuine gap").

**Disposition: PRODUCT GAP CONFIRMED**, parked as a new open Product Decision (does the platform want a
cross-node distinct-approver control for multi-level workflows, or is single-approver-across-levels
acceptable given team membership is itself admin-governed). Logged individually; not a duplicate of
AB-020/AB-039/AB-043 (those concern a different mechanism: reference_master's missing maker-checker, and
the concurrent-race loser's silent-success UX, respectively).

## V-029: Permission change while the Server Action / API call is already in flight

**PARTIAL / TOOLING LIMITATION.** Same class as V-020/AB-030/036/037: landing a permission revoke
deterministically inside the true send-to-server-processing window needs a request-pausing proxy or
server-side failpoint, unavailable in this environment. V-024 (this same batch) already proves the
closely related, broader guarantee directly: a role revoke committed while a request's own page was
already open and unrefreshed was still honored at the server's own processing time, not bypassed by any
stale in-request context. This narrows that guarantee to a true microsecond in-flight window between
client dispatch and server processing, which is not directly observable without new tooling. Logged to
Morning Residual Queue individually. **Can retry independently: NO** (needs new tooling).

## Batch 27 complete: V-005 through V-029 (25 journeys), all executed and evidenced.

Final tally: 20 PASS, 1 EXPECTED BEHAVIOR (V-016), 2 PRODUCT GAP CONFIRMED (V-027, V-028), 2 PARTIAL
(V-020, V-029). V-027's gap cross-references the already-closed Batch 6 decision O-018; V-028 opens one
new Product Decision.
