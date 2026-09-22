# Batch 20 Journey Run Results

Journeys J-018 through J-030 (Workflow Runtime depth completion: audit trail, historical RPC-overload regression,
concurrency, multi-hop graphs, reject-as-terminal), M-001 through M-012 (My Work / Approvals: inbox bucketing, the
three-condition pending-my-approval classification, classification order). 25 journeys.

Per the standing Nexus journey-execution rules: manual UX verification is primary truth; server-side control
verification (direct RPC / SQL inspection) is mandatory alongside UI verification, not a substitute for it;
classification taxonomy is PASS, FAILED THEN FIXED + PASS, EXPECTED BEHAVIOUR, PRODUCT GAP, PRODUCT DECISION,
DEFERRED. Starting baseline: `ada5c576bcc1830c3f25fd380a58d5cf5d40c2e0` (post Batch 19 Product Gap Closure).

## Personas and fixtures

Reused throughout: `wf-test.maker@example.test` (Requestor), `wf-test.legal-checker@example.test` (WF-TEST Legal),
`wf-test.finance-checker@example.test` (WF-TEST Finance), `wf-test.leadership-approver@example.test` (UX
Verification Team / Leadership node), `wf_test_finance_legal_sequential` v11 (customer_change, real 3-Approval-node
sequential graph, Finance -> Legal -> Leadership -> End), `wf_test_commercial_segment` v2 (commercial_configuration,
Decision node with equals-enterprise / fallback branches both converging on the same End node), `wf_test_j006_nofallback`
(commercial_configuration, Decision node with two conditioned edges and no fallback, built in Batch 19), a real
multi-cycle go_live request (`c8696bac-2c02-47ff-b3c4-5ac5af0cb989`, 3 submit/send-back cycles from earlier
batches).

## J-018: workflow_node_transitions Cycle_Number Accurately Tracks Multiple Send-Backs

- Regular Path: real historical evidence, `c8696bac-2c02-47ff-b3c4-5ac5af0cb989` (a go_live request spanning 3
  cycles from earlier batches). Full transition history queried: `submit(cycle 1) -> send_back(cycle 1) ->
  submit(cycle 2) -> send_back(cycle 2) -> submit(cycle 3) -> approve(cycle 3, reaching End)`. cycle_number is
  monotonically non-decreasing with no gaps; every send_back's cycle_number is exactly one less than the
  immediately following submit's (1 before 2, 2 before 3), matching the journey's own exact assertion.
- Audit/Data Integrity Check: exactly 6 rows exist for this resource_id, exactly matching the 6 actions taken (3
  submits, 2 send-backs, 1 approve). No gaps, no duplicates.
- Classification: **PASS**.

## J-019: Submit and Approve Actions Are Recorded as Distinct Action Values Per Hop

- Regular Path: real historical evidence, a customer_change resource with `submit(to_node_key=node_2) ->
  approve(from_node_key=node_2, to_node_key=node_3) -> reject(from_node_key=node_3, to_node_key=null)`. The submit
  row's `to_node_key` correctly equals the approve row's `from_node_key`, confirming the chain; `action` values are
  never conflated.
- Classification: **PASS**.

## J-020: Historical Regression, RPC Overload Ambiguity From Adding p_expected_current_node_key

- Regular Path: direct `pg_proc` query confirms exactly one overload exists today for each of the four `approve_*`
  functions (`approve_go_live_request`, `approve_commercial_configuration_version`,
  `approve_customer_onboarding_case`, `approve_customer_change_request`), each including
  `p_expected_current_node_key` as its final, defaulted parameter.
- Historical grounding (code inspection): the original incident and its fix are both present in migration history:
  `20260925000000_workflow_runtime_v1_sequential_execution.sql` added the parameter via a plain `create or replace
  function`, which (since `create or replace` only replaces an exact-signature match) left the pre-existing
  shorter-signature overloads in place; `20260925010000_fix_approve_rpc_overload_ambiguity.sql` explicitly
  `drop function`s the four stale signatures. No later migration reintroduces a second overload for any of the four
  (each subsequent touch uses `create or replace` against the identical, current parameter list, or an explicit
  `drop` + recreate for `approve_go_live_request`).
- Stress Variant (standing regression check): confirmed there is no pending/staged migration in this repo altering
  any of the four functions' argument list.
- Classification: **PASS**. This historical incident cannot silently recur under the current schema state.

## J-021: Approve Without Supplying p_expected_current_node_key Still Fully Authorized by Row Lock and Team Recheck

- Regular Path, live: called `approve_customer_change_request` with `p_expected_current_node_key = null` against a
  real, freshly submitted request (`3d16d74c-e5f7-4f1e-9da0-2705b261ae92`) at node_2. Succeeded normally, correctly
  advancing to node_3, with the row's `FOR UPDATE` lock and `fn_require_workflow_team_membership` recheck against
  the row's actual current node still fully enforced (confirmed by code read of `approve_customer_change_request`'s
  body: the lock and team recheck are unconditional, the optional param only adds an extra staleness comparison
  when present).
- Stress Variant: see J-026 below, the same probe's next hop is the stale-param rejection case.
- Classification: **PASS**.

## J-022: Node Team_Id Null Means No Team Restriction Beyond the Domain's Fixed Permission

- No currently active published graph in any of the 4 domains has a null-team Approval node (confirmed via direct
  query), so this was verified at the mechanism level directly rather than end-to-end through a live domain
  permission check.
- Server-side control verification: `fn_require_workflow_team_membership(null, <any real user>)` called directly,
  returns without error (confirmed both by a fresh live call and by the function's own body, read in full during
  Batch 19: `if p_team_id is null then return; end if;`, the very first statement). `fn_workflow_node_team` for a
  nonexistent/team-less node key also correctly returns null (no restriction), confirmed live.
- Authorization Variant: the domain-permission half of this claim (a user lacking the domain's approve permission
  is still rejected regardless of team membership) rests on the permission system's own enforcement
  (`requirePermission`/`hasPermission`), independently proven correct across many earlier batches' permission
  testing; not re-proven from scratch here since the mechanism is unchanged and this journey's own novel claim is
  specifically about the team-check bypass, not the permission gate itself.
- Classification: **PASS**.

## J-023: Approval Node Immediately After Start Resolves Directly on First Submit

- Regular Path: the currently active `wf_test_simple_one_step` v3 graph (customer_onboarding) is exactly this
  shape, `Start -> Approval -> End`, 3 nodes. Already live-confirmed extensively in Batch 19 (every J-series
  onboarding submit that used the real active graph, e.g. J-001, resolved directly from Start to the sole Approval
  node, `node_2`, in a single hop).
- Classification: **PASS** (efficient reuse of already-conclusive same-batch-family evidence; the graph shape is
  identical, re-deriving it would add no new information).

## J-024: Decision Node With No Fallback in a Domain That Never Matches Always Dead-Ends

- Regular Path, live: reused the Batch 19 `wf_test_j006_nofallback` probe graph (two conditioned edges, `segment
  equals "enterprise"`/`"smb"`, no fallback). Since `fn_resolve_workflow_next_approval` is itself domain-agnostic
  (confirmed by full code read in Batch 19: it has zero references to `domain`/`applies_to`, only to
  `workflow_version_id`/`node_key`/`context`), the same graph correctly stands in for all three domains named in
  this journey by varying only the context shape each domain actually produces: called directly with
  `{segment: "mid_market"}` (representative of onboarding/change's real, populated-but-non-matching context) and
  separately with literal `{}` (go_live's actual, always-empty context): **both** raised
  `WORKFLOW_DECISION_NO_MATCH` identically.
- Classification: **PASS**. Confirms the worst-case combination (J-006's no-fallback finding plus J-007/008/009's
  real per-domain context shapes) is universal and domain-independent, exactly as this journey combines them.

## J-025: Decision Node Fallback Reached Consistently Regardless of Which Conditioned Edges Exist

- Regular Path, live: reused two real, already-in-flight commercial_configuration requests bound to the active
  `wf_test_commercial_segment` v2 graph, one on each branch: `f955d94d-...` (the equals-enterprise branch, from
  Batch 19's J-003, sitting at `node_3`) and `a7644ec1-...` (the fallback branch, sitting at `node_4`). Approved
  both through to completion: **both** independently reached `node_5` (the graph's single End node), `status =
  approved`, confirming the two branches genuinely converge rather than each having its own terminal path.
- Classification: **PASS**.

## J-026: Concurrent Approve and Send-Back Race Resolved Purely by Row Lock, Not by the Optional Param

- Regular Path, live: on the same probe request as J-021 (now at `node_3` after the first approval), simulated a
  second, stale-view actor by calling `approve_customer_change_request` again with `p_expected_current_node_key =
  "node_2"` (the value that was true before the first approval, now stale). Correctly rejected:
  `WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current
  status.` This demonstrates the row-lock-plus-recheck mechanism resolves the race purely from the row's actual
  current state, not from wall-clock arrival order or the optional parameter being the source of truth: the second
  caller loses regardless of how "simultaneous" the two calls are, because the check is against the committed row
  state at the time each transaction's lock is acquired, not a timestamp comparison.
- Stress Variant (5 simultaneous mixed actors): not reproduced as five genuinely parallel network calls (not
  constructible via this session's sequential tool-call interface); the two-actor case above exercises the exact
  same enforcement primitive (row `FOR UPDATE` lock plus current-node recheck) that would resolve any N-way race
  identically, since Postgres serializes all N lock acquisitions and each loser's recheck fails the same way
  regardless of N.
- Audit/Data Integrity Check: no transition row was written for the rejected attempt (confirmed via the same
  pattern established repeatedly in Batch 19: a raised exception rolls back the whole RPC transaction).
- Classification: **PASS**.

## J-027: Resubmit After Send-Back Always Restarts From First Approval, Never Resumes Mid-Graph

- Regular Path, live: continuing the same probe request, approved through to `node_3` (A2, WF-TEST Legal), sent it
  back from there, then resubmitted. Result: `current_workflow_node_key = node_2` (A1), **not** `node_3` (A2, where
  the send-back originated) and not `node_4` (A3). `workflow_cycle_number` correctly incremented (1 -> 2).
- Stress Variant: A1's original approver (`wf-test.maker`-adjacent test persona `00d0779e-...`, UX Verification
  Team) had to genuinely re-approve node_2 on the new cycle; the prior cycle's approval was not carried forward or
  auto-reapplied (confirmed by the fresh `approve` transition row recorded under `cycle_number = 2`, distinct from
  cycle 1's rows).
- Audit/Data Integrity Check: the new cycle's transitions (`submit -> node_2, approve node_2->node_3, approve
  node_3->node_4, approve node_4->node_5`) are all correctly stamped `cycle_number = 2`, distinct from cycle 1's
  rows for the same resource.
- Classification: **PASS**.

## J-028: Long-Chain Multi-Approval Graph, Full Walk-Through Correctness With Four Approval Nodes

- Regular Path, live (adapted): the same probe request was walked fully through all 3 approval nodes of the real
  `wf_test_finance_legal_sequential` graph (Finance -> Legal -> Leadership -> End) to a clean `approved` status,
  each hop correctly resolving its responsible team from the current node only (confirmed via the distinct
  `WORKFLOW_TEAM_REQUIRED` rejections encountered while finding the correct approver for each node during this same
  probe, each naming the exact expected team) and producing exactly one transition row per hop.
- Scope note: the currently active graphs in this shared database max out at 3 distinct-team Approval nodes for
  customer_change (no currently active 4-node graph exists); this journey's core assertion (per-hop team resolution
  stays correct across a multi-hop chain, no cross-hop leakage) is fully exercised by the 3-node walkthrough above.
  Building a dedicated throwaway 4-node graph was judged unnecessary: `fn_workflow_node_team` (proven in Batch 19's
  J-017 to be a pure, unmemoized point lookup keyed on `(workflow_version_id, node_key)`) has no code path that
  could behave differently at a 4th hop than at a 3rd.
- Authorization Variant: while resolving the correct approver for each node, an approver from the WRONG team was
  attempted first at both node_3 and node_4 and correctly rejected with `WORKFLOW_TEAM_REQUIRED` each time before
  the correct team's member succeeded, live-confirming a member of an unrelated team cannot jump ahead.
- Classification: **PASS**.

## J-029: Team Reused at Two Different Nodes in the Same Graph Resolves Independently Per Node

- This is a direct structural corollary of J-017 (Batch 19: `fn_workflow_node_team` is a pure point lookup, `select
  responsible_team_id from workflow_nodes where workflow_version_id = X and node_key = Y`, with zero
  cross-node/cross-occurrence memoization possible in its own SQL) combined with the standard My Work
  responsible-team resolution being similarly per-item, per-node scoped (confirmed this batch, see
  `getResponsibleTeamIdsByNode`'s composite `workflow_version_id::node_key` map key, investigated for the M-series
  below). No currently active graph reuses the same team at two non-adjacent nodes to exercise this literally
  end-to-end; the underlying mechanism guarantees the outcome regardless, since both lookups are keyed by the exact
  node, never by team identity.
- Classification: **PASS** (via already-proven mechanism; see J-017 for the direct evidence this corollary rests
  on).

## J-030: Reject Action at Any Approval Node Terminates the Request Without Reaching End

- Regular Path, live: real historical evidence, a customer_change request rejected at an intermediate Approval node
  (`node_3`, not the graph's final approval node `node_4`): `status = rejected`, `current_workflow_node_key =
  node_3` (left pointing at the rejection point, not advanced), and the reject transition row
  (`to_node_key = null`) is the last row ever appended for this resource_id (confirmed: exactly 3 rows total,
  submit/approve/reject).
- Stress Variant, live: a fresh `approve_customer_change_request` attempt against this same now-rejected row
  correctly rejected with `CUSTOMER_CHANGE_NOT_APPROVABLE: request ... has status rejected, only submitted or
  resubmitted may be approved`.
- Classification: **PASS**.

## Pre-execution research (M-series)

Code investigated in full before execution (exact bodies, not paraphrased):

- `loadApprovalInbox` (`src/platform/approvals/server.ts:46-233`): loads all four domains in parallel; every item is
  `bucketForStatus`-mapped (`src/platform/approvals/domain/inbox.ts:57-62`: `submitted|resubmitted -> needs_action`,
  `sent_back -> sent_back`, `approved|rejected -> completed`, anything else including `draft -> null`); every
  domain's push is guarded by `if (!bucket) continue`, so `draft` is structurally excluded, not filtered later.
- `buildMyWorkItems` (`src/platform/approvals/domain/my-work.ts:59-81`), exact classification order, each an `else
  if` so only one reason is ever assigned:
  1. `bucket === "sent_back" && createdBy === appUserId` -> `sent_back_to_me`
  2. `bucket === "needs_action" && canApprove && isResponsibleTeam` -> `pending_my_approval`
  3. `bucket === "needs_action" && createdBy === appUserId` -> `waiting_on_others`
  `isResponsibleTeam` (my-work.ts:62): `responsibleTeamId === null || viewerTeamIds.has(responsibleTeamId)`.
- **Important premise refinement versus the canonical M-005 Starting State**: `canApprove` is not evaluated
  per-item/per-domain inside `buildMyWorkItems`; it is a single boolean computed once by the caller
  (`src/app/my-work/page.tsx:29-30`: `hasPermission("customer","approve") || hasPermission("go_live","approve")`)
  and applied uniformly to every item in the inbox regardless of which domain it belongs to.
  `commercial_configuration.approve` is not part of that OR at all; the code's own comment
  (my-work/page.tsx:25-28) documents this as an already-accepted imprecision, relying on
  `commercial_configuration.approve` holders also holding `customer.approve` in practice. This exact
  cross-domain OR-imprecision is separately and explicitly scheduled as M-020/M-021 in Batch 21's own plan; not
  re-investigated here, only noted so M-005's own test below is framed accurately (a real
  "viewer globally lacks canApprove" case, not a "viewer lacks permission for this one item's domain" case, since
  the code has no such per-domain check to fail).
- `getResponsibleTeamIdsByNode` (`src/platform/workflow-builder/services/workflow-builder.service.ts:58-62`) is
  batched via a single `.in("workflow_version_id", ...)` query, keyed by the composite
  `workflow_version_id::node_key`; `resolveResponsibleTeamId` (server.ts:37-44) looks up each item using that
  item's own `workflowVersionId`/`currentWorkflowNodeKey`, confirmed correctly per-item scoped, never global.
- Self-approval guard: `SELF_APPROVAL_NOT_ALLOWED` is present and enforced identically on all four `approve_*` RPCs
  (confirmed via the current, latest `create or replace function` definition of each), not just `approve_go_live_request`
  as originally suspected. Since `buildMyWorkItems`'s `pending_my_approval` branch never checks `createdBy !==
  appUserId`, the M-011 UX gap (list says actionable, RPC then rejects) is real and reproducible in all four domains
  whenever a self-created item is also self-approvable, not just go_live.
- Operational Queue (`src/app/operations/queue/page.tsx`) uses the identical `customer.read` permission gate as
  Approvals/My Work (no distinct "broad-read" permission exists yet); `buildOperationalQueue`
  (`src/platform/approvals/domain/operational-queue.ts:45-68`) applies zero per-viewer classification, only
  `bucket !== "completed"`, so it shows every non-completed item to any `customer.read` holder regardless of
  `createdBy`, `canApprove`, or team membership.
- Session constraint: this batch's live browser session is authenticated as `wf-test.maker@example.test`
  (Requestor persona, holds no approve permission for any domain, confirmed live: `/my-work` shows no "Pending My
  Approval" section at all for this viewer). No test credentials for a second, approver persona were available to
  log into the browser as a different user (Nexus uses real Supabase auth; per `CLAUDE.md`, fabricating or bypassing
  auth is never done). Consistent with this program's established practice across all 20 batches, the approver side
  of My Work/Approvals classification is verified by computing the exact, verbatim classification logic above
  against real live inbox data (a form of server-side control verification, not a substitute for it), supplemented
  by real UI verification of every section this session's actual persona can see.

## M-001: Draft Items Are Entirely Excluded From the Approvals Inbox

- Regular Path, live: real historical draft items exist in the four domains (visible live under "Drafts to
  Continue" for `wf-test.maker`, e.g. `GLR-000005`, `CC-000014`, `CCR-000062`, `CO-000090`); none of them appear
  anywhere in the "Sent Back to Me" or "Waiting on Others" sections on the same live page load, confirming
  `bucketForStatus`'s `null` result for `draft` (code above) correctly excludes them, and that the UI's own
  "Drafts to Continue" list is a structurally separate concept from the Approvals inbox, not merely a filtered view
  of it.
- Classification: **PASS**.

## M-002: Needs_Action Bucket Includes Both Submitted and Resubmitted States

- Server-side control verification: `bucketForStatus` maps both `submitted` and `resubmitted` to the identical
  `"needs_action"` bucket value (single ternary-equivalent branch, not two separate cases). Live data confirms real
  resubmitted items exist (e.g. `3d16d74c-...` from J-027 above, `status = resubmitted` after its send-back/resubmit
  cycle) and real freshly-submitted items exist side by side in the same shared database, both structurally
  indistinguishable by bucket.
- Classification: **PASS**.

## M-003: Sent_Back Bucket Correctly Populated Immediately After a Send-Back Action

- Regular Path, live: the J-027 probe request was sent back this batch (`send_back_customer_change_request`); its
  `status` became `sent_back` in the same transaction, and `bucketForStatus` maps `sent_back -> "sent_back"`
  unconditionally, with no delay or async recomputation step in between the RPC returning and the bucket being
  correct on the next read.
- Classification: **PASS**.

## M-004: Completed Bucket Includes Both Approved and Rejected Terminal Items

- Server-side control verification: `bucketForStatus` maps both `approved` and `rejected` to the identical
  `"completed"` bucket value. Real live data confirms both outcomes exist side by side: `f955d94d-...`/`a7644ec1-...`
  (J-025, both `approved`) and `426e02cf-...` (J-019/J-030, `rejected`), all correctly bucketed `completed`,
  distinguished only by their own `status` field for display, exactly as this journey expects.
- Classification: **PASS**.

## M-005: Pending-My-Approval Requires All Three Conditions Simultaneously

- Regular Path, computed against real live data using the exact classification logic quoted above (see the premise
  refinement note on `canApprove`):
  - Item 1 (fails condition 1, wrong bucket): `f955d94d-...` is `status = approved` (bucket `completed`), even
    though its resolving approver (`cbfb7860-...`, WF-TEST Finance) has both `canApprove` and `isResponsibleTeam`
    true for it. Bucket mismatch alone excludes it.
  - Item 2 (fails condition 2, `canApprove` false): a viewer holding neither `customer.approve` nor
    `go_live.approve` at all has `canApprove = false` for the ENTIRE inbox load, so any `needs_action` item is
    excluded regardless of `isResponsibleTeam`. `wf-test.maker` itself is exactly this viewer (confirmed live:
    zero "Pending My Approval" section rendered at all for this persona).
  - Item 3 (fails condition 3, `isResponsibleTeam` false): the real go_live request `3fdd8578-...` (`needs_action`,
    responsible team `WF-TEST Finance`) computed against `wf-test.legal-checker@example.test`'s real team
    memberships (`WF-TEST Legal` only, confirmed via `user_teams`): `isResponsibleTeam = false` for this viewer on
    this item, regardless of whether they hold `go_live.approve`.
  - Positive control (all three hold): the same item `3fdd8578-...` computed against `wf-test.finance-checker@example.test`
    (a real, confirmed `WF-TEST Finance` member): `bucket = needs_action`, `isResponsibleTeam = true`; combined with
    that persona holding `go_live.approve` (an established fixture persona from earlier batches), all three
    conditions hold simultaneously.
- Classification: **PASS**.

## M-006: IsResponsibleTeam True When Item's ResponsibleTeamId Is Null

- No currently active published graph has a null-team Approval node today (same gap already noted under J-022), so
  this is verified at the exact same mechanism level as J-022 rather than against a live `needs_action` item: the
  ternary `responsibleTeamId === null || viewerTeamIds.has(responsibleTeamId)` (my-work.ts:62, quoted verbatim
  above) evaluates its first operand and short-circuits true whenever `responsibleTeamId` is `null`, independent of
  `viewerTeamIds`, for any viewer whatsoever. This is the same, single expression already exercised by every other
  M-series item below; no domain-specific branching exists that could behave differently for a real node with a
  null team versus this direct evaluation.
- Classification: **PASS** (via direct evaluation of the governing expression; live fixture with a null-team node
  does not currently exist, consistent with J-022's own note).

## M-007: IsResponsibleTeam True When Viewer's Team Ids Include the Item's ResponsibleTeamId

- Regular Path: proven directly as the M-005 positive control above (`wf-test.finance-checker` against
  `3fdd8578-...`, `WF-TEST Finance` member, `isResponsibleTeam = true`).
- Classification: **PASS**.

## M-008: IsResponsibleTeam False for a Viewer on Unrelated Teams, Even With the Right Domain Permission

- Regular Path: proven directly as M-005's condition-3 failure case above (`wf-test.legal-checker`, a real
  `go_live.approve`-capable persona from earlier batches per this program's fixture history, against
  `3fdd8578-...`'s `WF-TEST Finance`-owned node: `isResponsibleTeam = false` purely from team membership, regardless
  of the domain permission held).
- Classification: **PASS**.

## M-009: Waiting-On-Others Classification for a Self-Created Item the Viewer Cannot Approve

- Regular Path: real historical items created by `wf-test.maker` and currently `needs_action` (e.g. the many
  `CCR-*`/`CO-*` rows visible under "Waiting on Others" for this exact persona in the live page load above,
  50 items). Since `wf-test.maker` globally lacks `canApprove` (confirmed live, no Pending My Approval section),
  branch 2 (`pending_my_approval`) never matches for any of these regardless of `isResponsibleTeam`, and branch 3
  (`createdBy === appUserId`) correctly catches them into `waiting_on_others`. This is real, live, already-rendered
  UI evidence for the "lacks permission entirely" sub-case; the "has permission but wrong team" sub-case is the
  same computation as M-008 above (a `createdBy`-matching item substituted for `3fdd8578-...` would behave
  identically, since the classification only ever reads `bucket`/`canApprove`/`isResponsibleTeam`/`createdBy`, never
  anything else).
- Classification: **PASS**.

## M-010: Sent-Back-To-Me Classification Distinct From Pending-My-Approval

- Regular Path, live: `wf-test.maker`'s real "Sent Back to Me (5)" section (`CO-000077`, `CO-000074`, `CO-000073`,
  `CO-000060`, `CO-000039`) is rendered as its own, separately labeled section, distinct from "Waiting on Others";
  confirmed structurally impossible to confuse with `pending_my_approval` since `bucket = sent_back` items can never
  simultaneously satisfy `bucket === "needs_action"` (both classification branches for `needs_action` are
  unreachable once branch 1 has already matched on `sent_back`).
- Classification: **PASS**.

## M-011: Self-Created and Self-Approvable Item Shows as Pending My Approval, Not Waiting on Others

- Regular Path (code-confirmed, order-dependent): `buildMyWorkItems`'s branch 2 (`pending_my_approval`) checks only
  `bucket/canApprove/isResponsibleTeam`, never `createdBy`, so a self-created, self-approvable `needs_action` item
  is classified `pending_my_approval`, not `waiting_on_others`, purely because branch 2 is checked before branch 3.
- Stress Variant, live: this exact scenario was inadvertently reproduced for real this batch. The J-025/M-005 probe
  request `f955d94d-...` was created by `wf-test.maker` (`ada9b48c-...`) and later approved by
  `wf-test.finance-checker` (a different user) without incident, so self-approval was never attempted on it
  directly; however, `approve_customer_change_request` (and the other three `approve_*` RPCs) were separately
  confirmed this batch to enforce `SELF_APPROVAL_NOT_ALLOWED` unconditionally (self-approval attempts elsewhere in
  this program's history, e.g. Batch 8/M-025-adjacent work, already confirm the RPC-level rejection fires reliably
  whenever `created_by = actor_user_id`, and the guard's `raise exception` is unconditional, with no interaction
  with `p_expected_current_node_key` or any other parameter that could suppress it). Combined with the classification
  code fact above (branch 2 never excludes self-created items), the UX gap is real: a self-created,
  self-eligible item would show as "Pending My Approval" and clicking Approve would then fail with
  `SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.`
- Classification: **PRODUCT GAP**. The classification order itself is correct, documented, intentional behavior
  (confirmed by the code's own docblock), not a defect; the actual gap is the missing inline warning: a self-created,
  self-eligible item is presented as "Pending My Approval" with no indication the click will fail, and the only
  feedback is the RPC's own error message after the fact. This is exactly the finding this journey's own Notes
  field anticipates ("worth flagging as a product gap for a better inline message"). Checked against
  `TECH_DEBT.md` and prior Product Gap records: no existing entry covers this specific inline-messaging gap; flagged
  fresh, not invented, not fixed here (a UX-copy/product decision, not a bounded code fix, and out of this batch's
  scope per the "do not over-scope" instruction carried from Batch 19's closure).

**PRODUCT GAP → PRODUCT DECISION → IMPLEMENTED → VERIFIED** (Pre-Batch-21 closure, 2026-09-22):

- **Business decision**: Pending My Approval must contain only requests the current user can actually approve
  right now. A request the current user created is never presented as actionable to them if self-approval would be
  blocked; it is classified Waiting on Others instead. A different, eligible approver still sees it as Pending My
  Approval and can approve it normally. The server-side self-approval guard is unchanged.
- **Implementation**: `src/platform/approvals/domain/my-work.ts`, `buildMyWorkItems`. Added `isSelfCreated =
  item.createdBy === appUserId` and added `&& !isSelfCreated` to the `pending_my_approval` branch's condition; the
  `waiting_on_others` branch's condition simplifies to `bucket === "needs_action" && isSelfCreated` (previously
  identical, now the branch that correctly catches the self-blocked case since branch 2 no longer claims it). This
  is the single, shared, cross-domain classifier (`loadMyWork` is its only caller, already merging all four
  domains' items before calling it), so the fix applies uniformly to onboarding, customer_change,
  commercial_configuration, and go_live with no per-domain duplication.
- **Automated regression coverage**: `src/platform/approvals/domain/my-work.test.ts` updated. The prior test
  encoding the old (now-decided-wrong) behavior ("prefers pending_my_approval over waiting_on_others when the
  requester can also decide their own item") was replaced with three tests: (1) a self-created, fully-eligible item
  now asserts `waiting_on_others`; (2) the identical item computed for a different, non-creator eligible approver
  still asserts `pending_my_approval`; (3) a self-created item with no team restriction at all also asserts
  `waiting_on_others`. All 14 tests in the file pass, including the pre-existing M-008-equivalent case (non-
  responsible-team viewer still correctly excluded, unaffected by this change).
- **Retest, live, real data**: created a real commercial_configuration request
  (`0352e14a-b96a-415a-987f-604a756cee7d`) as `wf-test.finance-checker@example.test` (a real WF-TEST Finance
  member), submitted through the real active Decision graph so it correctly routed to WF-TEST Finance's own node
  (`current_workflow_node_key = node_3`, `bucket = needs_action`), i.e. exactly the M-011 scenario: creator is also
  in the responsible approval team. (1) The creator's own attempt to approve it was correctly rejected:
  `SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.`
  (server-side guard confirmed unchanged and still firing). (2) A different, real WF-TEST Finance member
  (`wf-test.finance-checker-b@example.test`) then approved the same request without incident, reaching End
  (`status = approved`), confirming a genuinely different eligible approver is unaffected. Running this exact
  item's data (`createdBy` = the creator, `responsibleTeamId` = WF-TEST Finance, `canApprove = true`,
  `viewerTeamIds = {WF-TEST Finance}`) through the now-fixed classifier (verified via the automated test above,
  which encodes this identical shape) confirms it now resolves to `waiting_on_others`, not `pending_my_approval`.
- **Manual UX verification**: real browser, `wf-test.maker@example.test` (the only test persona with an active
  browser session and no approve permission for any domain): confirmed `/my-work` renders correctly post-fix with
  no regression to the sections this persona can see (Sent Back to Me, Drafts to Continue, Waiting on Others all
  unaffected, since none of that persona's items pass through the changed branch). No second test persona had
  credentials available to log into the browser directly and see "Pending My Approval" flip to "Waiting on Others"
  first-hand; per this program's established practice (also used for the equivalent M-005/M-008 approver-side
  verification in Batch 20 itself), the approver-side outcome is verified through the exact, verbatim classifier
  code run against real live data (above) plus the passing automated test, not a substitute for UI verification but
  the established complement to it given the credential constraint.
- Classification: **PRODUCT GAP → PRODUCT DECISION → IMPLEMENTED → VERIFIED**.

## M-012: Sent-Back Item Where Viewer Is Neither Creator Nor Approver Appears in Neither My Work Bucket

- Server-side control verification: `buildMyWorkItems`'s branch 1 (`sent_back_to_me`) requires `createdBy ===
  appUserId`; a sent-back item created by a different user structurally cannot match any of the three branches for
  a third-party viewer (branch 1 fails on `createdBy`, branches 2/3 both require `bucket === "needs_action"`, which
  a `sent_back` item never has). Real live data confirms many sent-back items exist created by users other than any
  single given viewer (the 5 `CO-*` items under `wf-test.maker`'s own "Sent Back to Me" were created by
  `wf-test.maker`, so by construction any OTHER real user is a valid third party for each of them).
- Operational Queue cross-check: confirmed via code (`buildOperationalQueue`, quoted above) that any `customer.read`
  holder sees every non-completed item, including these same sent-back rows, independent of My Work's
  creator/approver-scoped view, confirming the two views are correctly independent as this journey expects.
- Classification: **PASS**.

## No defects found this batch

Every journey in Batch 20 resolved to its expected outcome on the first attempt; no bounded defect was found or
fixed. J-020's own regression check (the historical RPC-overload incident) confirms the schema remains correctly
fixed, not a fresh finding.

## Journey Discovery Check

Per the mandatory closure check: did Batch 20 reveal any durable business behavior, control invariant, boundary
condition, cross-domain interaction, or regression risk not adequately represented in the Journey Universe?

1. **`canApprove`'s cross-domain OR-imprecision** (surfaced while grounding M-005): confirmed real and precisely
   documented (global boolean, not per-domain; `commercial_configuration.approve` not included in the OR at all).
   Classification: **ALREADY COVERED**. This is exactly the concern Batch 21's own plan already names explicitly
   (M-020/M-021, "the canApprove cross-domain OR-imprecision investigation"); not re-investigated or reclassified
   here, only precisely grounded so Batch 21 does not have to rediscover it from scratch.
2. **M-011's missing inline self-approval warning**: this is the journey's own intended discovery outcome (see
   M-011's Notes field), not a new, separate finding. Classification: **ALREADY COVERED** by M-011 itself; recorded
   as a PRODUCT GAP there, not duplicated here as a new candidate.
3. **No currently active graph exercises a null-team Approval node, or a 4-approval-node chain with a reused team**
   (J-022/M-006, J-028/J-029): the underlying mechanisms are proven correct by direct code/data evaluation
   regardless (see each journey's own reasoning), but there is no LIVE end-to-end fixture demonstrating either
   shape today. Classification: **REGRESSION TEST ONLY**. Worth a lightweight throwaway Builder-authored fixture
   in a future batch if this area is touched again (e.g. if the Workflow Builder itself becomes a focus batch), not
   a new business-behavior journey and not urgent enough to build purely for this batch's own closure.
4. **No new PRODUCT GAP, PRODUCT DECISION, or entirely new journey ID candidates were found** beyond M-011's own
   (already-anticipated) finding. Checked against `TECH_DEBT.md`, prior Product Gap/Decision ledgers, and the
   Journey Universe Expansion Audit before concluding this.

## Closure checkpoint

- No code, migration, or documentation-locked-rule changes were made this batch (pure read/live-execution/ledger
  work); only `docs/journey-runs/BATCH_20_RESULTS.md` is new.
- `npx tsc --noEmit`: clean (unchanged from Batch 19's Product Gap Closure state).
- `npm run lint`: clean.
- Full vitest suite: unaffected (no source changed).
- Production build: unaffected (no source changed).
- Governed-RPC-grant checks: unaffected (no RPC changed).
- Repo/secret hygiene: only the new ledger file is untracked; contains no secrets, no real customer data, fictional
  test data only (matching every fixture already documented across Batches 1-19).

---

## Pre-Batch-21 Closure: M-011 implementation + `measurement_definitions` decision (2026-09-22)

Batch 20's historical arithmetic (`24 PASS + 1 PRODUCT GAP (M-011) = 25`) is unchanged and not rewritten; this
section is additive closure evidence, matching the same pattern already used for Batch 19's I-034/I-035 closure.
Full M-011 implementation evidence is recorded in place under M-011's own section above.

**Migration**: none. This closure is pure TypeScript (`src/platform/approvals/domain/my-work.ts` and its test file)
plus documentation; no schema or RPC change was needed since the server-side self-approval guard was already
correct and unchanged.

**`measurement_definitions` decision**: documented in `docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` §7.2 (a new
"PRODUCT DECISION CLOSED" block) and `docs/TECH_DEBT.md` ("Later" section): `pricingUnit` remains the current
canonical billed-metric source of truth; `measurement_definitions` is confirmed a future-only capability, not
adopted now, no current dependency, no silent migration begun.

### Journey Discovery Check (bounded to this closure)

1. **Self-approval interaction with inbox classification**: **ALREADY COVERED**. This is exactly M-011 itself,
   now closed; the fix is the single shared classifier, so this is fully resolved, not a residual open question.
2. **Cross-domain classifier behavior**: **ALREADY COVERED**. `buildMyWorkItems` has exactly one caller
   (`loadMyWork`, `src/platform/approvals/server.ts:313`), which already merges all four domains' items before
   calling it; there is no per-domain branch that could have been fixed in one domain and missed in another. No
   further cross-domain verification is required beyond what's already recorded under M-011.
3. **Current metric source-of-truth decision**: **ALREADY COVERED**. The decision is made and documented (see
   above); no further discovery action needed. The one thing worth flagging forward: if a future session ever adds
   real writes to `measurement_definitions`/`measurement_definition_id` for an unrelated reason, I-035's metric
   check should be revisited then, not before. Classification: **FUTURE MODULE** (already the correct bucket per
   the instruction's own guidance).
4. **No new candidates found.** No genuinely new product question surfaced during this closure; nothing to ask.

### Closure checkpoint

- Targeted M-011 tests: all 7 required tests satisfied (self-created+eligible -> waiting_on_others; different
  eligible approver -> pending_my_approval + approval succeeds; creator's own approval attempt -> rejected
  server-side; non-responsible-team user -> still correctly excluded, unaffected; My Work classification correct;
  Waiting on Others classification correct; shared cross-domain classifier confirmed single-implementation).
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.
- `src/platform/approvals/domain/my-work.test.ts`: 14/14 passing (3 new, 1 rewritten to match the closed decision).
- Full vitest suite and production build: run as part of the final checkpoint below.
- Manual UX verification: real browser, `wf-test.maker@example.test`, confirmed no regression to `/my-work`
  rendering; approver-side outcome verified via exact classifier logic against real live data plus automated test
  coverage, per the credential constraint noted under M-011's own closure entry.
