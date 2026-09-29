# Batch 28 Results (V-030 through V-047, W-001 through W-007)

Status: IN PROGRESS. Not closed. Manual UX Gate = PASS (recovered via
controlled local dev-server restart, 2026-09-28; see below). Manual and
Mixed journey execution has resumed. This file is updated incrementally
as journeys execute.

## Step 0: V-036 canonical reconciliation

Done before batch execution began. V-036's canonical text in `docs/NEXUS_JOURNEY_UNIVERSE.md`
was rewritten from "document the real inconsistency" (pre-PG-040 framing) to test the
CURRENT decided behavior (existing member stays eligible; new routing blocked at both
authoring and runtime; review-page banner; member-level revocation still blocks
immediately). Journey Discovery: ALREADY_COVERED by the existing PG-040 decision and
O-005/T-019's own already-rewritten canonical text. No new journey, no new Product Gap,
Batch 28 denominator unchanged (still 25, V-036 still one of them).

## Step 1: Classification table

| Journey | Evidence class |
|---|---|
| V-030 | MIXED MANUAL + SERVER |
| V-031 | MIXED MANUAL + SERVER |
| V-032 | MIXED MANUAL + SERVER |
| V-033 | MIXED MANUAL + SERVER (investigative) |
| V-034 | MIXED MANUAL + SERVER |
| V-035 | INVESTIGATIVE |
| V-036 | MIXED MANUAL + SERVER |
| V-037 | MIXED MANUAL + SERVER |
| V-038 | MIXED MANUAL + SERVER |
| V-039 | SERVER/DB ONLY |
| V-040 | SERVER/DB ONLY |
| V-041 | INVESTIGATIVE |
| V-042 | MIXED MANUAL + SERVER |
| V-043 | MIXED MANUAL + SERVER |
| V-044 | MIXED MANUAL + SERVER |
| V-045 | MIXED MANUAL + SERVER |
| V-046 | SERVER/DB ONLY |
| V-047 | SERVER/DB ONLY |
| W-001 | MANUAL UX REQUIRED |
| W-002 | SERVER/DB ONLY |
| W-003 | MANUAL UX REQUIRED |
| W-004 | MANUAL UX REQUIRED |
| W-005 | MANUAL UX REQUIRED |
| W-006 | MANUAL UX REQUIRED |
| W-007 | SERVER/DB ONLY |

## Manual UX Gate

- Browser available: YES (Claude Browser pane, localhost:3000).
- Nexus reachable: YES.
- Fresh authenticated session works: YES, confirmed for multiple personas
  (nexus-test-finance-b, nexus-test-ux-approver, nexus-test-legal).
- /my-work renders for an authenticated session: YES, confirmed repeatedly.
- Personas: confirmed via `.env.nexus-test.local` naming convention
  (nexus-test-<role>@example.test, shared password). Confirmed real team
  memberships for finance-b (WF-TEST Finance, UX Verification Team),
  ux-approver (WF-TEST Leadership), legal (WF-TEST Legal).
- Fixtures: real, existing in-flight requests reused wherever a genuinely
  valid (non-stale-base, complete, correct-node) one existed; several old
  Batch 1-13 test fixtures were found to be single-field-populated
  placeholders unusable for full approval flows (see Notes).
- Dual/simultaneous identity: NOT POSSIBLE. All browser tabs in this
  session share one cookie jar/session; opening a second tab does not
  create a second identity. Two-actor scenarios are executed sequentially
  (log out, log in as the other persona) rather than simultaneously. Where
  a canonical journey's "stale page" scenario needs a second actor's
  action to happen while the first actor's page is not refreshed, the
  second actor's action is performed via a separate mechanism (direct
  RPC/SQL representing that actor's real action) while the first actor's
  browser tab is left untouched, consistent with this project's established
  verification pattern for exactly this shape of scenario.
### MANUAL UX GATE = PASS (recovered via controlled dev-server restart, 2026-09-28)

Precise per-route status, each independently confirmed this batch:

- Onboarding review (`/reviews/{requestId}`): WORKS. Used for W-003.
- Customer Change review (`/reviews/change-requests/{requestId}`): WORKS.
  Used for W-004.
- Go Live review (`/customers/{key}/go-live/{id}`): WORKS. Confirmed
  earlier this session (PG-040/PG-056 verification) and not touched since.
- Commercial Version review (`/reviews/commercial-versions/{id}`): now
  WORKS. See recovery record below.

**Controlled local dev server recovery (authorized, 2026-09-28):**
Identified the running Nexus dev server: `next dev` (PID 10359, started
Thu 2026-09-24 09:00:33) as parent of `next-server` (PID 63421, started
Fri 2026-09-25 19:58:27, the sole process listening on port 3000), with
two turbopack worker children. Confirmed both parent and server process
had cwd `/Users/utkarsh.gupta/Desktop/nexus` and this was the only
Nexus-related process tree on the machine (`lsof -iTCP:3000` showed
exactly one listener). Recorded branch `team-preview`, HEAD
`e94047e90dd338a98124777fb20e84bcb8970d2e` before touching anything.
Supabase, `.env` files, `.claude/launch.json`, and any Production/main
context were not touched. Sent `SIGTERM` to the launcher and server PIDs;
confirmed clean exit (no remaining processes, port 3000 free) with no
force-kill needed. Restarted via the repository's own existing dev
command (`.claude/launch.json`'s `nexus-dev` config, i.e. `npm run dev`
→ `next dev`) through `preview_start`.

**Proof of recovery:** created a fresh, well-formed commercial_configuration_version
fixture (`d2485c00-a688-4e61-ab46-d35e13ad8781`, on the existing
`w007-stress-onboarding-config` configuration, submitted to node_4/WF-TEST
Legal) specifically to avoid reusing known-broken historical test data.
Navigated a fresh tab to `/reviews/commercial-versions/d2485c00-a688-4e61-ab46-d35e13ad8781`
as the logged-in session (a WF-TEST Legal-eligible persona, confirmed via
`/my-work` listing this request under "Pending my approval"). Result:
HTTP 200 (`read_network_requests`), full real content rendered (customer
name, reason, effective date, timeline, "Approve & Activate" / "Reject"
controls), no "This page couldn't load" shell, zero console errors
(`read_console_messages`). Also re-confirmed `/my-work`, the onboarding
review route, and the customer-change review route all still render
correctly post-restart.

**Disposition of the earlier symptom:** while capturing these logs, the
freshly restarted server surfaced a genuine server-side exception
(`TypeError: Cannot read properties of undefined (reading 'toLocaleString')`
in `src/features/customer-onboarding/domain/commercial-rate-summary.ts:40`,
thrown from `commercial-rate-diff-view.tsx:163`) on a request to
`/reviews/commercial-versions/4e3bd628-467f-427d-8641-91cb25fd3c5a`. That
specific request is a known-broken pre-existing historical fixture found
earlier this session (`workflow_version_id` null, `current_workflow_node_key`
null, i.e. a leftover record with no workflow ever attached, not part of
the Batch 28 canonical 25 and not created by this session). It is not
what blocked the gate: the gate is confirmed clear against the fresh,
valid fixture above. The `formatQuantity` function only null-checks
(`value === null`) and does not guard `undefined`, so this specific
malformed row's missing quantity value throws where a real, complete
record would not. This is a real bug worth fixing but is scoped to
malformed legacy data, not a defect blocking any Batch 28 journey;
flagged separately for follow-up rather than tracked as a Batch 28 Product
Gap. If V-033, V-042, or W-005 (which also use this route, on their own
real fixtures) hit the same error on genuinely valid data, that would be a
different, confirmed finding and would trigger the Product Gap protocol at
that point.

This clears the blocker previously recorded against **W-005**, **V-033**,
**V-042**, and any other Batch 28 journey whose canonical assertion
requires viewing or acting on the Commercial Version review page. Manual
and Mixed journey execution resumes.

## Journey results (only genuinely executed journeys listed; ledger grows as batch continues)

### V-030: Workflow Admin loses publish permission mid-edit of a draft graph

Classification: MIXED MANUAL + SERVER.
Fixture: real draft workflow_definition_version `fa9cab9d-bfe9-42cf-876d-233d6a57ff5d`
(definition `e8a1dcc8`, version 2, status draft).
Persona: `nexus-test-workflow-admin` (real Workflow Admin role).
MANUAL UX VERIFIED: logged in as the admin, navigated a fresh tab to
`/settings/workflows/e8a1dcc8-e056-4dbf-a0dc-5fdd8f4cdbd0/versions/fa9cab9d-bfe9-42cf-876d-233d6a57ff5d`,
confirmed the real graph editor rendered with live "Save Draft" and
"Validate & Publish" controls. Left this tab open and untouched. Revoked
the admin's `workflow_admin` role via the governed `revoke_user_role` RPC
(actor: `nexus-test-user-access-admin`) without touching the tab. Returned
to the still-open, unreloaded tab and clicked the stale-rendered "Save
Draft" button: the page displayed "You do not have permission to write
workflow_definition." Clicked the still-visible "Validate & Publish"
button next: identical rejection. `read_network_requests` confirms two
distinct `POST` requests fired (one per click), both returning 200 at the
transport level (Server Action error responses, not HTTP error codes) with
the permission denial in the response body. Then performed a fresh
navigation (full reload) to the same URL: the page now showed "Access
restricted: You do not have permission to view this page (requires
workflow_definition.read)", confirming the UI itself reflects the lost
access once it re-checks, not just the mutating actions.
SERVER/DB VERIFIED: `workflow_definition_versions.updated_at` for this row
unchanged across both click attempts (`2026-09-23 19:13:36`), status still
`draft`. No save or publish was recorded from the revoked admin.
Restored the role afterward via `grant_user_role` to leave the persona
usable for future batches.
Journey Discovery: NO NEW CANDIDATE. Matches canonical: server-side role
check gates both Save and Publish independently of client state, and a
fresh navigation correctly reflects the revoked access.
Classification: PASS.

### V-031: Admin's own permission removed while the Settings page is open

Classification: MIXED MANUAL + SERVER.
A different Settings surface than V-030, per instruction: Team Master
(`/settings/teams`).
Persona: `nexus-test-team-admin` (real `team_admin` role).
MANUAL UX VERIFIED: logged in as the team admin, navigated a fresh tab to
`/settings/teams`, confirmed the real "Add Team" form rendered. Filled
Team Code (`v031-stale-probe`) and Team Name (`V031 Stale Probe Team`),
representing unsaved admin work in progress. Left the tab open and
untouched. Revoked the admin's `team_admin` role via the governed
`revoke_user_role` RPC (actor: `nexus-test-user-access-admin`) without
touching the tab. Returned to the stale, still-filled page and clicked the
still-visible "Add Team" button: the page displayed "You do not have
permission to write team." and the team list shown on the same page had
no new `v031-stale-probe` row. `read_network_requests` confirms one `POST`
fired, 200 at the transport level with the denial in the response body.
Fresh navigation (full reload) to the same URL then showed "Access
restricted: You do not have permission to view this page (requires
team.read)."
SERVER/DB VERIFIED: no `teams` row with code `v031-stale-probe` exists.
Restored the role afterward via `grant_user_role`.
Journey Discovery: NO NEW CANDIDATE. Matches canonical: mutation rejected
server-side from the stale page, and a fresh navigation correctly reflects
the revoked access, consistent with V-030's finding on a different
Settings surface.
Classification: PASS.

### V-032: Customer Master changes while a Customer Change request is pending

Classification: MIXED MANUAL + SERVER.
Fixture: on a fresh customer (`ac641ebd-7f18-4ba3-a568-b74f43ed5bed`, "W007
Stress Test Customer"), created two customer_change_requests in the same
initial state (`base_customer_row_version` both captured as 1): Request A
(`8e18df50-bb59-472b-9fba-f06501cbaf9f`, proposing `industry
=v032-request-a-industry`) and Request B (`4d7564a5-03bb-45aa-a411-4b7b4f64c1a3`,
proposing `industry=v032-request-b-industry`). Submitted both, then fully
approved B through both its nodes (Legal, then Leadership), which applied
its field change and incremented `customers.row_version` from 1 to 2,
before ever touching A.
MANUAL UX VERIFIED: logged in as `nexus-test-legal` (the approver for A's
first node), navigated to `/reviews/change-requests/8e18df50-bb59-472b-9fba-f06501cbaf9f`.
The real Current vs Proposed table itself already showed the drift:
Current `v032-request-b-industry` (B's already-applied value) vs Proposed
`v032-request-a-industry` (A's stale proposal). Clicked the real "Approve"
button: the page displayed, directly under Review Decision, "customers row
ac641ebd-7f18-4ba3-a568-b74f43ed5bed changed (row_version 2 vs expected 1)
since this Change Request was created; rebase before approving." Request
A remained in "Submitted / Needs Your Attention" state with Approve/Send
Back/Reject still offered (i.e. not silently stuck, reviewer can still
Send Back for the maker to rebase).
SERVER/DB VERIFIED: request A's status unchanged (`submitted`); customer
`row_version` unchanged at 2 (not re-incremented or corrupted); exactly 1
`customer_field_history` row for this customer (B's, only). Confirmed the
same rejection via direct RPC call first (`CUSTOMER_CHANGE_STALE_BASE`)
before reproducing it through the UI, per architecture: the check fires on
the very first approval attempt at any node, not only the final one.
Journey Discovery: CANDIDATE FOUND, but NOT a Product Gap. The message
shown is real, mapped (`change-errors.ts` maps `CUSTOMER_CHANGE_STALE_BASE`
to kind `change_request_stale_base`), and substantively clear (states the
record changed since this request was created and that a rebase is
needed), matching the canonical UX Check's intent. It is more technical
than ideal (includes the raw customer UUID and "row_version N vs expected
M" phrasing) because this error kind's message defaults to the RPC's own
raw detail text, the same pattern used for every other mapped kind in this
file except the one message PG-056 specifically standardized
(`WORKFLOW_TEAM_INACTIVE`). This is consistent, deliberate existing
behavior, not a newly discovered inconsistency across domains the way
PG-056 was. Disposition: EXPECTED BEHAVIOUR (message could read more
plainly, but is accurate, non-misleading, and does not block or corrupt
anything; not registered as a Product Gap).
Classification: PASS.

### W-003: Double Approve on a Customer Onboarding case

Classification: MANUAL UX REQUIRED.
Fixture: customer_onboarding_cases request_id `e804fc05-1b26-4ac0-a1a2-9ef173d8af3d`
(CO-000103, a genuine, complete, previously-sent-back-and-resubmitted case, final
node_2 of workflow `b2b250c3-e32c-4a03-ac83-9521a70ca2de`, resolves to node_3 'end').
Persona: `nexus-test-ux-approver` (member of the node's responsible team, WF-TEST
Leadership, not the creator).
MANUAL UX VERIFIED: real browser session, real login, navigated to
`/reviews/e804fc05-1b26-4ac0-a1a2-9ef173d8af3d`, filled the Commercial Effective From
date field, then performed a genuine `double_click` computer-tool action (not a
synthetic JS event) directly on the real rendered Approve button (ref-resolved,
confirmed correct on-screen coordinates via a fresh tab's own read_page). Observed
result via `get_page_text` (real-time DOM read, not a stale screenshot): status
changed to "Approved", Timeline shows exactly one new "Leadership Approval (V3)
approved" event under "APPROVAL CYCLE 2", a "Customer approved" confirmation banner,
no error, no duplicate-record message.
SERVER/DB VERIFIED: exactly 1 row in `workflow_node_transitions` for this
resource/domain with action='approve'; exactly 1 row in `customers` for the
resulting `customer_id`.

**UX reconciliation (answered from existing evidence, not rerun):**
1. Was the Approve button genuinely double-clicked? Yes, a real `computer`
   `double_click` action against the real rendered button (not a synthetic
   JS event, not two separate single clicks).
2. Did one or two network/action requests fire? **One.**
   `read_network_requests` for this tab shows exactly one
   `POST /reviews/e804fc05-1b26-4ac0-a1a2-9ef173d8af3d` (200 OK) around the
   click, not two.
3. What happened to the button after the first click? Per source
   (`src/components/product/pending-button.tsx`, used here as
   `<PendingButton pending={pendingAction === "approve"} pendingLabel="Approving...">`
   in `review-detail-page.tsx:344`): the button synchronously disables
   itself (`disabled={pending || disabled}`) and swaps to a spinner +
   "Approving..." label the instant `handleApprove` calls
   `setPendingAction("approve")`, before the async Server Action call even
   resolves. This is a real, deliberate client-side guard, not a tooling
   artifact; the network evidence (exactly one request) is consistent with
   it having engaged before the second click event of the double-click
   gesture could re-invoke the (by-then-disabled) button's handler.
4. What did the user visibly see after the second click? No distinct
   second response: a disabled HTML button does not dispatch further click
   events, so the second click had no separate visible effect; the page
   continued showing whatever the first click's own single in-flight
   request produced. I did not directly capture a screenshot of the
   transient spinner frame itself (this session's screenshot tool was
   unreliable mid-scroll, see below); this answer is based on the network
   log (request count) plus the component's own source, not a directly
   witnessed pixel-level frame.
5. Friendly already-approved response, or client-side prevention? **Client-side
   prevention.** No "already approved" server response was returned or
   applicable, since the server was only ever asked once.

Separately, real server/RPC repeat-call evidence for the same underlying
status-guard (not this journey, but the same mechanism) was already
established earlier this session during PG-036 verification: a same-actor
repeat `approve_go_live_request` call against an already-approved request
returned the row silently with no error, proving the RPC-level idempotency
guarantee independent of the client button's own disabling.

Journey Discovery: CANDIDATE FOUND. W-003's own canonical UX Check
("Second click sees a friendly already-approved message, not a
duplicate-record error surfaced raw") described only one of two real, safe
outcomes. The actually-observed outcome (client-side button disabling
prevents a second request from ever being sent) is at least as safe but
different in kind. Disposition: **EXPAND_EXISTING_JOURNEY**, executed
2026-09-28: `docs/NEXUS_JOURNEY_UNIVERSE.md` W-003's UX Checks and Expected
Technical Invariants fields amended to describe both valid outcomes
(A: client-side prevention via the disabled/pending button; B: server-side
idempotent already-approved response for a request that reaches the RPC by
a path that bypasses the client), with the real observed outcome (A) cited
in the canonical text itself. Not a Product Gap: the underlying safety
invariant (no duplicate Customer Master) holds either way, confirmed by DB
evidence. Disposition CLOSED, canonical text updated, no longer an open
follow-up.
Classification: PASS.

### W-004: Double Approve on a Customer Change request

Classification: MANUAL UX REQUIRED.
Fixture: customer_change_requests request_id `b7ae53db-f476-4b33-a1dc-e869a3159669`
(CCR-000154, a real request with base_customer_row_version matching the customer's
current row_version, i.e. not stale). First advanced once (single click, not the
test itself) past its non-final node_2 (WF-TEST Finance, actor nexus-test-finance-b)
to reach its genuine final node_3 (WF-TEST Legal), so the actual double-click test
targets the request's real finalizing step, matching the canonical's "awaiting
final approval" starting state. A different actor (nexus-test-legal) was used for
the final step to avoid tripping the PG-037 segregation-of-duties control
(same actor, different node, would correctly and separately be blocked; that is
not this journey's subject).
MANUAL UX VERIFIED: real login as `nexus-test-legal`, navigated to
`/reviews/change-requests/b7ae53db-f476-4b33-a1dc-e869a3159669`, performed a genuine
`double_click` on the real rendered Approve button (ref-resolved against a
freshly-confirmed 1280x720 viewport). Result observed via `get_page_text`: redirect
to the customer detail page, no error surfaced.
SERVER/DB VERIFIED: exactly 1 row in `workflow_node_transitions` with
`from_node_key='node_3'` and action='approve' for this resource; exactly 1 row in
`customer_field_history` for this `customer_change_request_id`; `customers.industry`
correctly shows the single applied value ('agritech'); request status = 'approved'.

**UX reconciliation (answered from existing evidence, not rerun):**
1. Was the Approve button genuinely double-clicked? Yes, a real `computer`
   `double_click` action against the real rendered button.
2. Did one or two network/action requests fire? **One.**
   `read_network_requests` for this tab shows exactly one
   `POST /reviews/change-requests/b7ae53db-f476-4b33-a1dc-e869a3159669`
   (200 OK), followed only by the router's own navigation fetches to the
   resulting customer page. No second action POST.
3. What happened to the button after the first click? Per source
   (`change-request-review-page.tsx:202`,
   `<PendingButton pending={isSubmittingAction} pendingLabel="Approving...">`,
   with `setIsSubmittingAction(true)` called synchronously inside
   `handleApprove` before the await): the button disables itself and shows
   "Approving..." immediately on the first click, before the second click
   event of the gesture could re-invoke the handler. Same mechanism as
   W-003, different component instance.
4. What did the user visibly see after the second click? No distinct
   second response, for the same reason as W-003: the button was already
   disabled. Not directly screenshot-confirmed at the pixel level;
   inferred from the network log (single request) plus source. The
   subsequent visible state was the redirect to
   `/customers/batch11-immutability-probe-co`, which followed from the
   single successful request.
5. Friendly already-approved response, or client-side prevention?
   **Client-side prevention**, same as W-003.

Journey Discovery: CANDIDATE FOUND. W-004's canonical UX Check ("Friendly
already-approved message on repeat") was narrower than what real user
double-clicks actually produce (client-side prevention, no second request,
therefore no message of any kind is shown or needed). Disposition:
**EXPAND_EXISTING_JOURNEY**, executed 2026-09-28: `docs/NEXUS_JOURNEY_UNIVERSE.md`
W-004's UX Checks and Expected Technical Invariants fields amended the same
way as W-003's, describing both valid outcomes (A: client-side prevention;
B: server-side idempotent already-approved message for a request that
reaches the RPC by a path that bypasses the client, per the same mechanism
proven this session via PG-036's repeat-call evidence), with the real
observed outcome (A) cited in the canonical text itself. Not a Product Gap:
no duplicate field mutation occurred, confirmed by DB evidence (exactly 1
`customer_field_history` row). Disposition CLOSED, canonical text updated,
no longer an open follow-up.
Classification: PASS.

### V-039: Workflow deactivated while requests reference it

Classification: SERVER/DB ONLY.
Fixture: real `create_customer_change_request` + `submit_customer_change_request`
against workflow_definition `a167d59c` (customer_change domain), producing a genuine
in-flight request `c2284eea-e24e-4b14-95bc-4063cdb15f8a` bound to
`workflow_version_id=a33bee65`.
SERVER/DB VERIFIED: deactivated `a167d59c` (its only active definition for the
domain) directly, confirmed `create_customer_change_request` for a fresh fixture
then failed with `WORKFLOW_NO_ACTIVE_DEFINITION`, while `c2284eea` remained readable
and its own approve path unaffected (its `workflow_version_id` is stored on the row
at creation time and never re-resolved). Reactivated `a167d59c` afterward; state
fully restored.
Journey Discovery: NO NEW CANDIDATE. Matches canonical: deactivation blocks new
work, never disturbs in-flight requests already bound to a version.
Classification: PASS.

### V-040: New workflow becomes active

Classification: SERVER/DB ONLY.
SERVER/DB VERIFIED: called `replace_active_workflow_definition` to atomically
deactivate `a167d59c` and activate a second published customer_change definition;
confirmed a fresh `create_customer_change_request` bound to the new definition's
version, while the pre-existing in-flight fixture (`c2284eea`, still bound to
`a33bee65`) was untouched (unchanged `workflow_version_id`, still advanceable).
Reverted the active definition back to `a167d59c` afterward.
Journey Discovery: NO NEW CANDIDATE. Matches canonical.
Classification: PASS.

### V-046: Node team reassignment affects multiple pending requests uniformly

Classification: SERVER/DB ONLY.
SERVER/DB VERIFIED: attempted the full `approve_customer_change_request` path
first; blocked before reaching the team-membership check by an unrelated
pre-existing defect in older Batch 1-13 fixtures (`CUSTOMER_CHANGE_STALE_BASE`:
their recorded `base_customer_row_version` predates the customer's real current
`row_version`). Pivoted to test the actual mechanism directly: mutated
`workflow_nodes.responsible_team_id` for node `5390cbcb-5d28-4d55-beb7-0fc31bce25ac`
and confirmed, via `fn_workflow_node_team` / `fn_require_workflow_team_membership`
(both resolve live from `workflow_nodes` / `user_teams` on every call, no caching),
that the new team took effect immediately and uniformly across 4 distinct
genuinely-pending real requests sharing that node. Reverted
`responsible_team_id` back to `7373f730-...` afterward.
Journey Discovery: CANDIDATE FOUND. `select proname from pg_proc where proname
ilike '%reassign%'` returns nothing: no governed RPC exists to change a node's
team on an already-published workflow version. The only product-supported path is
authoring a new draft (`save_workflow_version_graph` +
`publish_workflow_definition_version`), which by the platform's own deliberate
immutability guarantee can never retroactively affect requests already bound to
the old published version. This means V-046's literal premise (a team
reassignment "affecting" pending requests) currently has no real user-reachable
trigger in the product; the direct `workflow_nodes` mutation used above represents
"what would happen if this were possible," not an action any real user or admin
flow can take today. Disposition: **EXPAND_EXISTING_JOURNEY**, executed 2026-09-28:
`docs/NEXUS_JOURNEY_UNIVERSE.md` V-046's Expected Technical Invariants field
amended to state plainly that this is a database-level invariant check, not a
reachable admin action today, and that a product decision is needed before
node-team reassignment on a published version becomes a real governed
capability. Not a Product Gap (nothing currently promises this capability);
not a defect (the underlying live-resolution mechanism is correct wherever it
is reached). Disposition CLOSED, canonical text updated, no longer an open
follow-up. The open question of whether to build a real governed
reassignment action is a product decision, not a defect; flagged for
Utkarsh, not auto-resolved.
Classification: PASS.

### V-047: Two unrelated requests acted on concurrently do not interfere

Classification: SERVER/DB ONLY.
Fixtures: two genuinely unrelated real requests in different domains, each
mid-flight from unrelated prior journeys: `c2284eea-e24e-4b14-95bc-4063cdb15f8a`
(customer_change, at node_4, team WF-TEST Leadership) and
`3cfaea0e-03c9-43c4-874a-6711c34b0971` (go_live, at node_2, no team restriction).
SERVER/DB VERIFIED: issued `approve_customer_change_request` for `c2284eea`
(actor `df6bb6ba`, a WF-TEST Leadership member, not the creator) immediately
followed by `approve_go_live_request` for `3cfaea0e` (actor `05fe22cf`, not its
creator), 6 seconds apart. Queried `workflow_node_transitions` for both
`resource_id`s afterward: each produced exactly one new row, correctly scoped to
its own domain/resource, correct `from_node_key`/`to_node_key`
(`c2284eea`: node_4 to node_5, action=approve, actor=df6bb6ba;
`3cfaea0e`: node_2 to node_3, action=approve, actor=05fe22cf), no
cross-contamination of node keys, actors, or domains between the two rows. This
matches the RPCs' own source-level `select ... where id = p_request_id for
update` / `for update` clauses (read earlier this session), which scope locking to
the single target row, never broader.
Note: `approve_go_live_request` returned `status='resubmitted'` rather than a
terminal 'approved' for this request (node_3 is an intermediate confirmation step
in this fixture's go_live workflow, not the final node). This is a domain-specific
status-vocabulary detail unrelated to V-047's actual subject (cross-request
interference) and not investigated further here.
Journey Discovery: NO NEW CANDIDATE. Matches canonical: no false contention
between unrelated requests.
Classification: PASS.

### W-002: Triple Submit stress (programmatic)

Classification: SERVER/DB ONLY.
Fixtures: two fresh draft requests in two different domains, created specifically
for this test: `customer_change_requests` `e5c1e19f-bd86-43ed-868c-8bcb70a6d881`
and `customer_onboarding_cases` `516dd609-cf09-4bcd-abc2-721d06607765`.
SERVER/DB VERIFIED: fired `submit_customer_change_request` 10 times in rapid
sequence against the same draft request id (each call wrapped in its own
exception-catching block so all 10 attempts actually executed regardless of
earlier failures); final state: `status='submitted'`, `current_workflow_node_key
='node_3'`, exactly 1 row in `workflow_node_transitions` for this resource. Source
confirms the guard: `if v_change_request.status not in ('draft', 'sent_back') then
raise exception 'CUSTOMER_CHANGE_NOT_SUBMITTABLE'`, so only the first call could
ever pass. Repeated the same pattern with `submit_customer_onboarding_case` fired
3 times against a second fresh draft: final state `status='submitted'`,
`current_workflow_node_key='node_2'`, exactly 1 transition row. Confirms the same
status-guard shape holds independently in two different domains' submit RPCs.
Journey Discovery: NO NEW CANDIDATE. Matches canonical: repeated Submit calls
produce exactly one transition, regardless of call count.
Classification: PASS.

### W-007: Triple Approve stress across all four domains (programmatic)

Classification: SERVER/DB ONLY.
Fired 10 rapid repeated Approve calls (each wrapped in its own exception-catching
block so all 10 attempts actually executed) against a request awaiting approval
in each of the four domains, then verified final state directly:

- Customer Onboarding: `516dd609-cf09-4bcd-abc2-721d06607765` at its final node_2
  (WF-TEST Leadership), actor `df6bb6ba` (not creator). 10x
  `approve_customer_onboarding_case`. Final: `status='approved'`, exactly 1
  `approve` transition row, exactly 1 row in `customers` for the resulting
  customer key, exactly 1 row in `commercial_configurations` for the resulting
  config key. Source-confirmed guard: once `status='approved'`, a same-actor
  repeat returns the existing row with no new mutation
  (`if v_case.approved_by is not distinct from p_actor_user_id then return
  v_case`), so the customer/config INSERT block is unreachable on repeat calls.
- Customer Change: `e5c1e19f-bd86-43ed-868c-8bcb70a6d881` at node_3 (WF-TEST
  Legal), actor `b2a12ef2` (not creator). 10x `approve_customer_change_request`.
  Final: `status='submitted'` (non-final node), `current_workflow_node_key
  ='node_4'`, exactly 1 `approve` transition row.
- Go Live: `3cfaea0e-03c9-43c4-874a-6711c34b0971` at node_3 (no team
  restriction), actor `99f44f93` (not creator). 10x `approve_go_live_request`.
  Final: `status='approved'`, `current_workflow_node_key='node_4'` (end),
  exactly 1 `approve` transition row for this actor.
- Commercial Configuration Version: fresh fixture `db68f54d-3710-4e44-8f87-
  715b6f90498f` created and submitted for this test, reaching node_4 (WF-TEST
  Legal), actor `b2a12ef2` (not creator). 10x
  `approve_commercial_configuration_version`. Final: `status='approved'`,
  `current_workflow_node_key='node_5'` (end), exactly 1 `approve` transition
  row.

All four domains produced exactly one terminal mutation and one transition row
regardless of the 10x repeat count, matching the pattern already confirmed for
Submit in W-002: the first call succeeds, every subsequent call is blocked by
each domain's own status/node guard (`NOT_APPROVABLE`, `ALREADY_DECIDED`, or a
same-actor idempotent no-op) before any duplicate mutation can occur.
Journey Discovery: NO NEW CANDIDATE. Matches canonical: repeated Approve calls
produce exactly one terminal mutation and one transition, regardless of call
count, uniformly across all four domains.
Classification: PASS.

### V-033: Commercial Version changes while a Go Live request is pending

Classification: INVESTIGATIVE.
Fixture, built fresh end-to-end: commercial_configuration `9845f946-db27-4cc9-806c-4d5ccde87220`
(customer `ac641ebd`, "W007 Stress Test Customer"). Approved a version
("V1", `d2485c00-a688-4e61-ab46-d35e13ad8781`) with a real flat recurring
component (`stable_component_key=4961682a-...`, INR 10,000/month,
effective 2026-09-28). Created and submitted a Go Live request
(`513e087a-36ac-45dc-bb47-d739c4caac4b`) referencing this configuration,
V1, and that stable component. While it sat pending approval at node_4
(WF-TEST Legal), approved a second version ("V2", `8d29a322-...`) on the
same configuration and stable component, amending the fee to INR
15,000/month effective 2026-09-30, which closed out V1's component
(`effective_to = 2026-09-29`) and opened V2's.
MANUAL UX VERIFIED (real inspection, not source-only, per instruction):
logged in as `nexus-test-legal`, opened the real review page at
`/customers/w007-stress-onboarding-customer/go-live/513e087a-36ac-45dc-bb47-d739c4caac4b`.
"COMMERCIAL CONTEXT (LOCKED)" showed "Version 4" (V2's own sequence
number), with no mention of V1 anywhere, no warning that the referenced
version had been superseded since this request was created, and no way
to see the original INR 10,000 figure the request was actually raised
against. "Approve: Go Live" was present but blocked by an unrelated,
correctly-working guard (customer confirmation still Pending), so the
actual approval attempt was not exercised further once the display-layer
finding was confirmed.
Root cause confirmed by reading source, not assumed:
`src/app/customers/[customerKey]/go-live/[requestId]/page.tsx:41` builds
the page's `lineItem` via `listCurrentLineItemsForCustomer`, which always
resolves the CURRENT, still-open commercial component for the stable key,
matched only by `stableComponentKey`. The request's own stored
`commercialVersionId` (fetched via `getGoLiveRequestById`) is never read,
compared, or displayed in `go-live-detail-page.tsx`. The page's own
"(LOCKED)" label is therefore inaccurate.
Journey Discovery: PRODUCT GAP CONFIRMED. Registered as **PG-057** in
`docs/OPEN_PRODUCT_GAPS.md` §A. This is a genuine business-direction fork
(lock to creation-time version and warn/block on drift, vs. intentionally
track current terms and fix the "(LOCKED)" label plus add a drift
indicator), not a unilateral code fix, per the Product Gap Rule. Flagged
for Utkarsh; not auto-resolved.

**Product Decision received (2026-09-29): lock to the creation-time
Commercial Version.** A Go Live request must remain permanently bound to
the version it referenced at creation; approval must be blocked (with a
visible warning) if that version is later superseded, until the
request's own creator explicitly refreshes it against the current
version; the prior reference must be preserved for audit, never silently
discarded.

**Fix implemented and verified under the Product Gap Immediate-Closure
Protocol:** migration `20261017000000_pg057_go_live_locks_referenced_commercial_version.sql`
adds a staleness guard to `approve_go_live_request` (raises
`GO_LIVE_COMMERCIAL_VERSION_SUPERSEDED` when the referenced version's
component has been closed by a later one) and a new governed,
creator-only `refresh_go_live_request_commercial_version` RPC that
rebinds to the current version while preserving the old one on new
columns (`previous_commercial_version_id`, `commercial_version_refreshed_by`,
`commercial_version_refreshed_at`). New pure resolver
`src/features/go-live/domain/referenced-version.ts` (4 unit tests) drives
`go-live-detail-page.tsx`'s locked display, warning banner, and disabled
Approve button; `page.tsx` now sources it from the request's own
`commercialVersionId` instead of `listCurrentLineItemsForCustomer`.
Full suite (1092 tests) and `tsc --noEmit` pass.

Re-verification, live:
1. RPC-level: re-attempted `approve_go_live_request` on the same
   `513e087a-...` fixture used to find the gap: correctly raised
   `GO_LIVE_COMMERCIAL_VERSION_SUPERSEDED`. Called
   `refresh_go_live_request_commercial_version` as its creator: rebound
   to V2, `previous_commercial_version_id` preserved as V1. Re-attempted
   approval: succeeded cleanly (`status=approved`, `node_5`).
2. UI-level, a fresh fixture built for this specifically (config `9845f946`,
   new stable component `2ec1215e-...`, V1 approved then a Go Live request
   `11ff2395-...` created/submitted/confirmed against it, then V2 approved
   to supersede it): the real review page, viewed as a real logged-in
   approver, showed "Referenced Commercial Version: Version 6" (the
   locked, original figures) with a visible warning ("A newer Commercial
   Version (Version 7) is now active...") and a disabled "Approve: Go
   Live" button. Logged in as the request's real creator and clicked the
   real "Refresh to Current Commercial Version" button: the page then
   showed "Referenced Commercial Version: Version 7" with no warning,
   confirmed against the database (`commercial_version_id` updated,
   `previous_commercial_version_id`/`commercial_version_refreshed_by`/`commercial_version_refreshed_at`
   all correctly populated).
3. No-false-positive check: a separate, freshly created Go Live request
   built directly against the then-current version (a third, unrelated
   stable component) submitted, confirmed, and approved cleanly with no
   guard triggered.

Journey Discovery (post-fix): NO NEW CANDIDATE. V-033's canonical text
updated in `docs/NEXUS_JOURNEY_UNIVERSE.md` with the decided behavior.
PG-057 closed in `docs/OPEN_PRODUCT_GAPS.md` (moved to Closed History,
classification PRODUCT GAP RESOLVED + PASS).
Classification: PRODUCT GAP RESOLVED + PASS.

### V-034: Workflow V2 publishes while a V1-bound request is in flight

Classification: MIXED MANUAL + SERVER.
Fixture: real customer_change_request `0302fa3f-1eae-4371-a9ae-c35d30b59fff`
created and submitted against the active customer_change workflow
definition `a167d59c` version 12 (`a33bee65-...`), reaching node_3 ("Legal
Approval"). Stress Variant applied per instruction: authored a new draft
version 13 (`56852399-...`) that renames node_3 to `node_3_renamed`
(deliberately removing the exact node key this in-flight request is
sitting at), then published it, making it the new active version for any
future request.
SERVER/DB VERIFIED: the in-flight request's own row was completely
unaffected by the publish: `workflow_version_id` remained `a33bee65`
(V12), `current_workflow_node_key` remained `node_3`, `status` remained
`submitted`, confirming in-flight requests continue against their
originally-bound graph/version, never re-resolved.
MANUAL UX VERIFIED: logged in as `nexus-test-legal`, opened the real
review page at `/reviews/change-requests/0302fa3f-...`: rendered cleanly
("Submitted / Needs Your Attention", full Current vs Proposed diff,
working Approve/Send Back/Reject controls), no crash, no dead end, despite
the active workflow no longer having a node named `node_3` at all. Clicked
the real "Approve" button: succeeded, redirected to the customer detail
page. Confirmed via DB: request advanced correctly to `node_4`, still
bound to `a33bee65` (V12), fully independent of V13.
Restored the original graph afterward (published a further version 14
recreating `node_3`/`node_4`/`node_5` exactly as before) so the rest of
Batch 28's customer_change journeys are not affected by the deliberately
renamed node from this stress test.
Journey Discovery: NO NEW CANDIDATE. Matches canonical: no silent request
loss; an in-flight request's own bound graph is immutable once set, and
the reviewer sees a clear, working state, not a crash, regardless of what
the currently-active version's graph looks like.
Classification: PASS.

### V-035: Team is renamed (verify: no rename control exists)

Classification: MANUAL (existence check).
MANUAL UX VERIFIED (real inspection, not source-only, per instruction):
logged in as `nexus-test-team-admin`, opened the real `/settings/teams`
page. Read the full rendered team table (24 real rows) and the full Team
Membership section: every team row exposes exactly Team Code, Team Name,
Description, Status, Last Updated, and a single Actions button
(Deactivate/Activate). Team Code and Team Name render as plain static
text, not inputs; clicking directly on a team's name/code cell produced
no navigation, no inline edit, nothing. No pencil/edit icon, no "Rename"
action, no team detail page reachable from this screen exists anywhere
on the page.
Journey Discovery: NO NEW CANDIDATE. Confirms the canonical journey's own
stated expectation exactly ("Expected Business Result: ... this is
expected to be a PRODUCT GAP (no rename control currently exists)"): the
absence of a rename control is the real, current, and already-expected
state, not a newly discovered defect requiring a decision. Not registered
as a new Product Gap (nothing here is ambiguous or was ever promised).
Classification: PASS (canonical expectation confirmed by direct manual
inspection).

### V-036: Team deactivated, members remain eligible (PG-040 decided behavior, end-to-end)

Classification: MIXED MANUAL + SERVER.
Fixture: real customer_change_request `0302fa3f-1eae-4371-a9ae-c35d30b59fff`
(from V-034), already advanced to node_4 ("Leadership Approval", team
WF-TEST Leadership) awaiting final approval.
MANUAL UX VERIFIED: logged in as `nexus-test-team-admin`, opened the real
`/settings/teams` page, clicked the real "Deactivate" button for "WF-TEST
Leadership". Confirmed via DB the team's `is_active` flipped to false.
Logged in as `nexus-test-ux-approver` (an existing eligible member of that
now-inactive team) and opened the real review page for the pending
request: it rendered the exact decided-behavior banner, "The responsible
team for this step, WF-TEST Leadership, has been deactivated. Existing
eligible members of this team can still act on this request. No new work
will be routed to this team going forward," with Approve/Send Back/Reject
still live. Clicked the real "Approve" button: succeeded, redirected to
the customer detail page, which showed "Latest Change Request: Approved."
SERVER/DB VERIFIED, runtime block on new work: created and submitted a
fresh customer_change_request (`c12839c6-...`) against the current active
workflow version, approved it at node_3 (Legal), and confirmed the
attempt to advance it to node_4 (the same, still-inactive-at-that-point
team) correctly raised `WORKFLOW_TEAM_INACTIVE`, leaving it safely parked
at node_3 rather than silently corrupting or crashing.
SERVER/DB VERIFIED, authoring-time block: as Workflow Admin, created a new
draft workflow version and attempted `save_workflow_version_graph`
assigning a node to the still-inactive WF-TEST Leadership team: correctly
rejected with `WORKFLOW_TEAM_INACTIVE: node "Leadership Approval" cannot
be assigned to "WF-TEST Leadership", which is an inactive team.`
Restored state afterward: reactivated WF-TEST Leadership via
`set_team_active`.
Journey Discovery: NO NEW CANDIDATE. Confirms the PG-040 decision holds
end-to-end, exactly as decided: existing assigned work remains fully
actionable by existing members, the reviewer sees a clear, honest warning
(not a silent gap or a crash), and no new work (whether created live or
authored into a graph) can ever be routed to an inactive team.
Classification: PASS.

### V-037: Reference Master value deactivated, historical records unaffected

Classification: MIXED MANUAL + SERVER.
MANUAL UX VERIFIED (real inspection, not source-only, per instruction):
logged in as `nexus-test-reference-master-admin`, opened
`/settings/customer-onboarding`, Industry / Category list. Clicked the
real "Deactivate" button for "FMCG"; the real confirmation dialog itself
stated the exact expected behavior: `Deactivate "FMCG"? It will no longer
be available for new selections. Existing historical records will remain
unchanged.` Confirmed. List updated live to "8 Active - 1 Inactive",
FMCG shown as Inactive.

**Historical side:** logged in as `nexus-test-legal`, opened the real
Customer Details tab for `demo-northstar-consumer-products` (a real,
pre-existing customer with `industry='fmcg'`): "Industry: FMCG" still
displayed exactly as before, unconditionally, no warning, no blank field.

**New-draft side:** opened a real, fresh Customer Onboarding draft
(`CO-000120`) and opened the real "Industry / Category" select dropdown:
its option list was exactly `P021 Activity Test Industry, P-003 Genuine
Add Industry, Consumer Durables, Retail, Healthcare, Automotive, Other,
E2E-TEST Industry` (8 options), FMCG completely absent.

Restored state afterward via `set_reference_option_active` (industry,
fmcg, active).
Journey Discovery: NO NEW CANDIDATE. Matches canonical exactly: historical
truth preserved unconditionally; only forward-looking new-draft selection
is affected; no retroactive mutation of any existing record.
Classification: PASS.

### V-038: User display name changes while historical actions attributed to them exist

Classification: MIXED MANUAL + SERVER (historical).
MANUAL UX VERIFIED: logged in as `nexus-test-user-access-admin`, opened
`/settings/user-access`. Clicked directly on "Nexus Test Finance Approver
B"'s display name: a real inline edit control appeared (textbox +
Save/Cancel). Renamed her to "Nexus Test Finance Approver B (Renamed
V-038)" and saved; confirmed via DB. Also renamed `nexus-test-legal`
("Nexus Test Legal Approver" to "... (Renamed V-038)") via the same
governed RPC the UI control itself calls, to reach a second, real actor
with real `customer_field_history.approved_by` entries.

**Ordinary Timeline (expected to live-resolve):** reloaded the real
review page for `/reviews/change-requests/b7ae53db-...`: her historical
"Approval step approved" entry correctly now showed "Nexus Test Finance
Approver B (Renamed V-038)". Matches canonical.

**Customer Master Activity/History (canonical expects frozen, point-in-
time name):** opened the real Customer Master page for
`batch11-immutability-probe-co` (a real customer `nexus-test-legal`
approved field changes for). Both the "Activity" tab (e.g. "Industry
changed from 'biotech' to 'agritech' ... Nexus Test Legal Approver
(Renamed V-038)") and the "History" tab's Field History table (column
"Approved By", backed directly by `customer_field_history`) showed the
renamed name for her historical entries, not the name at the time of the
original action. This contradicts the canonical journey's stated
invariant that this specific view preserves point-in-time attribution.

Restored both personas to their original display names immediately after
capturing this evidence (`set_app_user_display_name`), since they are
reused across the rest of Batch 28 and future batches.

Journey Discovery: PRODUCT GAP CONFIRMED. Registered as **PG-058** in
`docs/OPEN_PRODUCT_GAPS.md` §A. This is a genuine business-direction fork
(make the Activity/History view actually read the frozen point-in-time
name from `audit_log`'s existing snapshot columns, matching both the
canonical journey and the codebase's own historical-immutability
philosophy for Customer Master; or accept full live-resolution everywhere
as intended and correct the canonical text instead), not a unilateral
code fix, per the Product Gap Rule. Flagged for Utkarsh; not auto-resolved.

**Product Decision received (2026-09-29): freeze Customer Master
Activity/History to point-in-time actor identity.** "Approved By" and
equivalent actor attribution on this specific surface must show the
actor's identity as it was at the moment of the action, sourced from
`audit_log`'s existing `actor_display_name_snapshot`/`actor_email_snapshot`
columns; a later display-name change must never rewrite it. A row with no
correlating snapshot (legacy data, or no audited source table) falls back
gracefully to the actor's current identity, never fabricating a
historical value. Ordinary Timelines (Onboarding/Change Request/Commercial
Version/Go Live review pages) keep live-resolving, unchanged.

**Fix implemented and verified under the Product Gap Immediate-Closure
Protocol:** `src/features/customers/domain/activity.ts` adds
`buildAuditIndex`/`historicalActorLabel`, an exact-match correlation
(table, row id, actor id, timestamp) against a batch of `audit_log` rows,
reliable because a domain row's own lifecycle timestamp
(createdAt/decidedAt/changedAt/sentBackAt) and `audit_log.occurred_at`
are set by the identical `now()` call inside the same transaction
(verified empirically against real data before building this: `b7ae53db`'s
own `decided_at` and its approval audit row's `occurred_at` matched to the
microsecond, `2026-09-28 14:33:30.5635+00`). Used by the four
Activity-tab builders that were live-resolving (`fieldChangeEvents`,
`changeRequestEvents`, `commercialVersionEvents`, `onboardingOriginEvent`);
`statusChangeEvents` already correctly used the snapshot via the
pre-existing `auditRowActorLabel` and was left unchanged.
`src/platform/audit/data/audit-log.data.ts` adds a `listAuditLogForRows`
batch fetch (avoiding an N-query fan-out). `src/features/customers/server/activity.ts`
adds `resolveFieldHistoryActorLabels` for the separate History-tab Field
History table, now keyed by field history entry id rather than actor id
in both `page.tsx` and `customer-master-detail.tsx` (a label keyed only
by actor id could not represent the same actor's identity correctly at
two different points in time). 8 new unit tests
(`activity.test.ts`); full suite (1098 tests) and `tsc --noEmit` pass.

Re-verification, live: renamed `nexus-test-legal` (a real actor with real
historical approvals on `batch11-immutability-probe-co`, the same
customer used to find the gap) to "... (Renamed V-038 Verify)". Reloaded
the same real Change Request Timeline used to find the gap
(`/reviews/change-requests/b7ae53db-...`): correctly showed the new,
renamed name (unchanged, intentional behavior). Reloaded the same
customer's Activity tab: both of her historical entries now correctly
showed "Nexus Test Legal Approver" (the original, pre-rename name), not
the renamed one. Reloaded the History tab's Field History table: its
"Approved By" column showed the same correct, frozen name for the same
entries. Restored the persona's display name afterward.

Journey Discovery (post-fix): NO NEW CANDIDATE. V-038's canonical text
updated in `docs/NEXUS_JOURNEY_UNIVERSE.md` with the decided behavior.
PG-058 closed in `docs/OPEN_PRODUCT_GAPS.md` (moved to Closed History,
classification PRODUCT GAP RESOLVED + PASS).
Classification: PRODUCT GAP RESOLVED + PASS.

### V-041: Commercial component is renamed via the component edit form's free-text Component Name field

MANUAL UX VERIFIED. Persona: `nexus-test-legal` (Commercial Configuration
Maker permissions). Route: `/commercials/7f3a5750-e621-418d-a0a2-865776f99260/versions/5c3a9ea1-101f-414b-87bb-144e2c9aea40`
(draft commercial configuration version CC-000014, amendment, version 14,
found via a DB query joining `commercial_configuration_versions` to
`commercial_components` for a draft with genuinely pre-populated
components, since the first candidate tried, `9e0a9f3d` / CC-000127, was
a bare RPC-created draft with zero components).

Action taken: opened the real rendered page for the draft version. It
showed two existing components: "SFA + DMS" (Recurring, INR 250/User,
100-user MUG, Monthly Advance, effective 01-Dec-2026) and "WhatsApp"
(On-Demand, INR 0.15/Message, Monthly Postpaid, effective 01-Dec-2026),
each with a real "Edit" button. Clicked "Edit" on the "SFA + DMS" row.

Visible result: the edit form rendered with a "Component Name" field as
a genuine `textbox` (placeholder "e.g. SFA", not a disabled/read-only
field, not a dropdown/select), pre-filled with the current value
"SFA + DMS", directly above Pricing Model, Rate, Per, Invoice Frequency,
Invoice Timing, Minimum Usage Guarantee, Effective From/To, and Notes.
Confirmed via full-page screenshot: the field is a real, focusable,
editable text input. No change was saved (navigated away from the form
without clicking Save Component, to avoid mutating shared fixture data
for no reason); this journey only needed to confirm the field's
existence and editability, both directly observed.

This contradicts the journey's prior expectation (previously: "expected
to be N/A, no free-text rename field exists"). Per V-041's own Notes
("If a rename field is found, rewrite this journey with a real path"),
the canonical text in `docs/NEXUS_JOURNEY_UNIVERSE.md` was rewritten
with the real path, and the stale "No free-text component-rename field
exists" line in the PRODUCT GAP NOTES section was corrected to a
RECONCILED note.

This is not a Product Gap: a free-text rename field on a still-draft
component is consistent with the platform's general draft-vs-approved
editability rule (draft records may be edited directly; approved
records may not). No code change required.

Journey Discovery (post-execution): ONE CANDIDATE, EXPAND_EXISTING_JOURNEY,
already actioned inline above (V-041's own canonical text rewritten, no
separate journey needed since this was V-041 correcting itself, exactly
as its own Notes field anticipated).

Classification: PASS (journey corrected from a stale N/A assumption to a
verified real path; no defect found).

### V-042: Commercial component removed in a later commercial version, frozen history preserved

MANUAL UX VERIFIED. Personas: `nexus-test-finance-b` (Commercial Configuration
Maker), `nexus-test-legal` (Commercial Configuration Checker, node_4). Customer:
Aurora Consumer Labs Pvt Ltd (config `7f3a5750-e621-418d-a0a2-865776f99260`).
Starting state: Version 3 (request `20bcd9cb`) approved and active, effective
01-Dec-2026, with two components: "SFA + DMS" (recurring) and "WhatsApp"
(on-demand, INR 0.15/Message, Monthly Postpaid).

Action taken: logged in as `nexus-test-finance-b`, opened the existing draft
amendment (CC-000014, request `5c3a9ea1`, originally created by WF-TEST Maker),
deleted the WhatsApp on-demand component via its real "Delete component"
control (confirmed via the same confirm/cancel prompt seen in V-041), leaving
only SFA + DMS. Submitted with effective date 2027-01-15 and a reason
documenting the journey. Logged out, logged in as `nexus-test-legal` (a
different actor than the submitter, avoiding the platform's self-approval
block, which was independently confirmed live earlier in this same session:
attempting to approve as the original submitter produced "you cannot approve
your own request. Another authorized checker must review it."). Opened
`/reviews/commercial-versions/5c3a9ea1-...`, confirmed the real rendered
Current vs Proposed diff showed only "WhatsApp / Removed / INR 0.15 /
Message", clicked the real "Approve & Activate" button.

Visible result: Version 4 (approved, scheduled) is now the active version,
effective 2027-01-15, showing only SFA + DMS; on-demand commercials shows "No
on-demand commercials on this version." Reloaded Version 3 via its real
"View details" link: it now shows "Superseded", effective_to 2027-01-14, and
still displays WhatsApp with its original frozen values (INR 0.15/Message,
Monthly Postpaid, effective 01-Dec-2026), unchanged. Version 1 and Version 2's
historical records were unaffected.

This confirms the expected business result exactly: removing a component in a
new draft version does not retroactively alter any previously approved/frozen
version that still contains it. No defect found.

Journey Discovery (post-execution): NO NEW CANDIDATE. Confirms existing
behavior, no canonical text change needed.

Classification: PASS.

### V-043: Customer legal name change flows correctly through row_version, field history, and Activity/History

MANUAL UX VERIFIED. Personas: `nexus-test-maker` (Maker), `nexus-test-legal`
(Legal Approval, node_3), `nexus-test-ux-approver` (Leadership Approval,
node_4/final decision). Customer: Test Customer 1 (`ec93474a-...`,
row_version 38 before this journey).

Action taken: logged in as maker, opened the real "Change Customer" flow,
selected "Customer Details", changed the real "Legal Entity Name" field from
"Test Customer 1" to "Test Customer 1 (V-043 Renamed)" in the rendered form
(noted the UI surfaced a real "Required Evidence: company_registration"
notice for this field, which did not block submission), submitted CCR-000162
(request `57de77f0-...`). This particular customer's change workflow turned
out to be two-stage: logged in as `nexus-test-legal` and approved the first
stage ("Legal Approval"), then logged in as `nexus-test-ux-approver` (a
different actor than both the maker and the first approver) and approved the
second stage ("Leadership Approval") via the real "Approve" button on
`/reviews/change-requests/57de77f0-...`.

Visible result: customer page immediately showed the new legal name
"Test Customer 1 (V-043 Renamed)" in the header, Identity panel, and
"Latest Change Request: Approved". Confirmed via direct query:
`customers.row_version` incremented from 38 to 39 exactly;
`customer_field_history` recorded one new row (field_key "name", old_value
"Test Customer 1", new_value "Test Customer 1 (V-043 Renamed)", changed_at
matching decided_at to the microsecond). Reloaded the real History tab: Field
History table correctly shows the same old/new values with "Requested By:
Nexus Test Maker" and "Approved By: Nexus Test UX Approver" (the actual
final decider, not a fabricated actor). Reloaded the real Activity tab: shows
'Legal Entity Name changed from "Test Customer 1" to "Test Customer 1 (V-043
Renamed)"' immediately followed by "Customer Change Request approved", both
attributed to Nexus Test UX Approver, both timestamped 29/09/2026 08:40:18,
consistent with the rest of this customer's long real Activity trail (no
other historical entries were altered or reordered).

This confirms the expected business result: clean, auditable legal-name
change with correct historical preservation, no corruption of any other
in-flight or historical record. No defect found.

Journey Discovery (post-execution): NO NEW CANDIDATE.

Classification: PASS.

### V-044: Self-approval is blocked server-side regardless of Server Action layer, all four domains

MIXED MANUAL + SERVER VERIFIED.

MANUAL UX evidence (Commercial Configuration domain, captured live earlier
in this same session during V-042 setup, reused here since it is exactly
this journey's Regular Path): logged in as `nexus-test-legal`, who had
created and submitted CC-000136 (a real commercial version amendment) and
was also a genuine active member of the node's responsible team (WF-TEST
Legal). Opened the real review page and clicked the real "Approve &
Activate" button. The button was visibly present and clickable (not
hidden/disabled), but the action failed and the page rendered the specific
inline error: "you cannot approve your own request. Another authorized
checker must review it." This is a clear, specific self-approval message,
not a generic permission-denied message, satisfying this journey's UX
Checks requirement.

Stress Variant, all four domains, direct RPC calls bypassing the UI/Server
Action layer entirely (called via direct SQL against the live database,
each against a real submitted request created by the same actor used as
`p_actor_user_id`):
- `approve_customer_onboarding_case` against case `3891b5ae-...` (created
  by WF-TEST Maker), called with that same actor: raised
  `SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another
  authorized checker must review it.`
- `approve_go_live_request` against `11ff2395-...` (created by Nexus Test
  Maker), called with that same actor: raised the identical
  `SELF_APPROVAL_NOT_ALLOWED` message.
- `approve_customer_change_request` against `c12839c6-...` (created by
  Nexus Test Maker), called with that same actor: raised the identical
  message. Also called `reject_customer_change_request` and
  `send_back_customer_change_request` against the same request with the
  same actor: both raised their own domain-appropriate
  `SELF_APPROVAL_NOT_ALLOWED` variant ("you cannot reject your own
  request...", "you cannot send back your own request..."), confirming
  the Regular Path's all-three-actions requirement for at least one domain.
- Confirmed via direct query afterward that none of these calls mutated
  any row: `customer_change_requests.status` for `c12839c6-...` remained
  `submitted` with `decided_by` still null, and no `workflow_node_transitions`
  row was inserted, i.e. the exception fires and rolls back before any
  state change, for every attempted action.

Read the live `approve_customer_onboarding_case` function definition
directly from the database to confirm ordering: the
`if v_case.created_by = p_actor_user_id then raise exception
SELF_APPROVAL_NOT_ALLOWED` check is the second statement in the function
body, running before the status check, before the node/team-membership
check (`fn_require_workflow_team_membership`), and before any other
validation. This confirms the check is unconditional and independent of
whether the actor is even a genuine team member, i.e. self-approval is
rejected before authorization is even evaluated, for the strongest
possible form of this guarantee.

This confirms the expected business result: self-approval is impossible
via any path, in any of the four domains, and the check is implemented
once per RPC, independent of any Server Action-layer gating.

Journey Discovery (post-execution): NO NEW CANDIDATE.

Classification: PASS.

### V-045: p_expected_current_node_key stale value produces a friendlier error, but the fresh row-lock re-check is the real safety net

SERVER VERIFIED (Automation Feasibility: FULL per canonical text). Domain:
Customer Change. Request: CCR-000161 (`c12839c6-...`, W007 Stress Test
Customer, created by Nexus Test Maker, workflow_version `e511146c-...`,
node_3 = WF-TEST Legal / `nexus-test-legal`, node_4 = WF-TEST Leadership /
`nexus-test-ux-approver`), the same request used earlier for V-044's
direct-RPC self-approval tests (left untouched at node_3 since those calls
all failed on the self-approval check before mutating anything).

Setup: called `approve_customer_change_request` as `nexus-test-legal`
(a genuine, non-creator, non-stale actor) with no expected-node param,
which succeeded normally and advanced the request from node_3 to node_4.
This simulates the request having moved on since `nexus-test-legal`'s
client last fetched its state.

Variant A (stale value passed): called
`approve_customer_change_request` again as the same `nexus-test-legal`,
passing `p_expected_current_node_key = 'node_3'` (the value their stale
client still believes is current). Raised: `WORKFLOW_NODE_ALREADY_ADVANCED:
this step was already decided by someone else. Refresh to see the current
status.` A specific, friendly, UX-appropriate message.

Variant B (parameter omitted entirely): called
`approve_customer_change_request` again as the same actor with the
parameter set to null. Raised a different exception:
`WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION: you already approved an earlier
step of this request. A different approver must decide this step.` Less
specific than Variant A's message (correctly, since the RPC has no stale
value to compare against and must fall through to its next protection
layer), but still fully blocks the action.

Confirmed via direct query after both attempts: `customer_change_requests`
for this request still shows `status = submitted`, `current_workflow_node_key
= node_4`, `decided_by = null`, i.e. neither erroring call mutated
anything; both rolled back cleanly before any state change.

This confirms the expected business result exactly: `p_expected_current_node_key`
is a genuine UX nicety (a friendlier, more specific error when present) and
not the actual safety mechanism; the RPC's own `select ... for update` row
lock plus its fresh node/status/segregation-of-duties re-checks (which run
regardless of whether the client passed a hint) are what actually prevent a
stale approval from ever being applied, in both variants equally.

Journey Discovery (post-execution): NO NEW CANDIDATE.

Classification: PASS.

### W-001: Double Submit on a draft request (real double-click)

MANUAL UX VERIFIED. Persona: `nexus-test-maker`. Domain: Customer Change.
Customer: Aurora Consumer Labs Pvt Ltd. Created a real draft (CCR-000163,
request `600a363b-...`), changed the real "Website" field to a fresh test
value, filled Reason and Effective Date. Recorded the network request log
immediately before the action (no pending POST to this request's URL).

Action taken: performed a genuine double-click (a single `double_click`
input event, not two separate sequential clicks) on the real "Submit"
button.

Visible result: the browser navigated away to `/customers` immediately
(the app's normal post-submit redirect), meaning the button was not left
sitting long enough to visually confirm a disabled state mid-flight.
Network log evidence is unambiguous though: exactly one
`POST /customers/aurora-consumer-labs/change-requests/600a363b-...`
request appears in the full request log for this action, not two,
confirming the client did not fire two submit calls for the double-click
(either through button-disable-on-first-click or single-handler
coalescing).

Server/DB evidence: `customer_change_requests` for this request shows
exactly `status = submitted`, `workflow_cycle_number = 1`,
`current_workflow_node_key = node_3` (a single, clean advance from draft).
`workflow_node_transitions` contains exactly one row for this
request (`action = submit`, `from_node_key = null`, `to_node_key =
node_3`, actor = Nexus Test Maker). No duplicate submitted request and no
duplicate workflow instance exist.

This confirms the expected business result: exactly one submitted request
exists, matching both the client-observed network behavior (one request)
and the server-side idempotency guard (one transition row, cycle number
initialized exactly once).

Journey Discovery (post-execution): NO NEW CANDIDATE. Consistent with
W-002's earlier programmatic triple-submit confirmation of the same
status-guard.

Classification: PASS.

### W-005: Double Approve on a Commercial Configuration Version (real double-click)

MANUAL UX VERIFIED. Personas: `nexus-test-finance-b` (created/submitted
CC-000138, an amendment on Aurora Consumer Labs Pvt Ltd's config
`7f3a5750-...`, routed straight to node_4), `nexus-test-legal` (approver,
not creator, WF-TEST Legal team). First attempt used raw pixel coordinates
from a stale screenshot and, per the server logs, hit nothing at all (no
`approveCommercialVersionAction` invocation, confirmed by DB state
unchanged); retried using a ref-based double-click directly on the real
"Approve & Activate" button.

Action taken: real double-click on "Approve & Activate".

Visible result: the browser navigated to the config overview page showing
"Version 5, Approved, Scheduled, effective 2027-03-01" with "Approved By:
Nexus Test Legal Approver". Server log evidence
(`eventCode: commercial.version_approve, operation: approveVersion,
resourceId: 2f46dc41-..., actorUserId: b2a12ef2-..., status: success`)
and the raw request log both show exactly one
`POST /reviews/commercial-versions/2f46dc41-...` invoking
`approveCommercialVersionAction`, not two, for the double-click.

DB evidence: `commercial_configuration_versions` shows exactly
`status = approved`, one `decided_by`/`decided_at` pair.
`workflow_node_transitions` for this resource contains exactly two rows
total (one `submit`, one `approve`), not a duplicate approve row. The
config overview's Version History confirms exactly one new version
(Version 5) was created and activated, with the prior version (4) cleanly
superseded, not double-superseded or corrupted.

This confirms the expected business result: no double activation of a
commercial (pricing/billing) configuration from a real double-click.

Journey Discovery (post-execution): NO NEW CANDIDATE.

Classification: PASS.

### W-006: Double Approve on a Go Live request (real double-click)

MANUAL UX VERIFIED. Personas: `nexus-test-maker` (created/submitted
GLR-000050 for Batch8 Approval Core Co Renamed's "Flat fee" component,
routed to node_4), `nexus-test-legal` (approver, not creator, WF-TEST
Legal team). Customer confirmation evidence was set to Confirmed via the
real `set_go_live_customer_confirmation` RPC (the same RPC the UI's
"Upload Customer Confirmation Email"/"Upload Signed UAT Document" actions
call after a real attachment; a real file upload was not exercisable
through the browser tool's OS-level file picker, so this fixture-setup
step used the RPC directly, not the subject of this journey). Confirmed
live in the UI that the page's own gate correctly updated from "Approval
will be blocked until customer confirmation is marked Confirmed" to no
warning shown once confirmed.

Action taken: real double-click on the real "Approve: Go Live" button.

Visible result: the page updated in place to show "Live", with "Live from
01-Mar-2029, approved 29 Sept 2026, 9:13 am" and a Timeline entry "Legal
Approval approved: line item is now Live · Nexus Test Legal Approver".
Server log evidence shows exactly one
`POST /customers/batch8-approval-core-co/go-live/fb22d4e6-...` invoking
`approveGoLiveRequestAction`, not two, for the double-click.

DB evidence: `go_live_requests` shows exactly one `status = approved`,
one `approved_by`/`approved_at` pair. `workflow_node_transitions` for
this resource contains exactly two rows total (one `submit`, one
`approve`), confirming a single, unambiguous activation event, not a
double-activation of live billing/entitlement.

This confirms the expected business result: no double activation of live
billing from a real double-click, the highest-stakes consequence among
the four domains.

Journey Discovery (post-execution): NO NEW CANDIDATE.

Classification: PASS.

## Outstanding

None. All 25 journeys in Batch 28 have been genuinely executed.
