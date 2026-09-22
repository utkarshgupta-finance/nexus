# Batch 20 Evidence Integrity Audit

Scope: the 25 journeys scheduled in Batch 20 (J-018 through J-030, M-001 through M-012), confirmed against
`docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`. Part of the overnight evidence-integrity run following the Batch 19
audit. Original evidence in `docs/journey-runs/BATCH_20_RESULTS.md` (including its M-011 closure and tonight's
earlier "Overnight Run Closure" section) is not edited or deleted; this file only adds to the record. Research
support (locating canonical definitions, ledger claims, fixture IDs, and flagging apparent domain mismatches
or inference-only evidence) was performed by a read-only research agent; every grade and every live
revalidation below was independently made and executed by this session.

Repo state at the start of this segment: local HEAD/`origin/team-preview` `08da5efe...` plus one new local
commit for the Batch 19 audit doc and one applied migration (`20261007000000`, the `submit_go_live_request`
defect fix), not yet pushed; full vitest suite (980/980) reconfirmed green after that fix.

## The dominant finding this batch: evidence borrowed from the wrong domain

The research agent identified a clear, recurring pattern across roughly half of Batch 20: a journey's own
canonical `Domain` field names one of the four governed domains, but the live evidence cited actually comes from
a *different* domain's fixture (most often the "probe request" `3d16d74c-e5f7-4f1e-9da0-2705b261ae92`, a
customer_change record reused across J-021/J-026/J-027/J-028, and various go_live/commercial_configuration
records reused for M-005/M-007/M-008/M-009/M-012). This is not fabrication: every cited fixture and RPC call is
real and the ledger's prose is honest about what was actually called. But it means several journeys' own
domain-specific claim was never literally exercised in its own domain.

This session's assessment: nearly every mechanism affected (`fn_require_workflow_team_membership`,
`fn_resolve_workflow_next_approval`, `isResponsibleTeam`, `bucketForStatus`) is domain-agnostic by construction,
confirmed via direct code reads repeatedly across Batches 18-20 (none of these functions/expressions branch on
domain at all). Real live evidence already exists, elsewhere in this same three-batch audit trail, that each of
these mechanisms works correctly in all four domains individually (e.g. the resolver via J-003/J-007/J-008/J-009/J-014;
team-membership enforcement via the E-031/H-044/M-011 RPC calls performed tonight, each in a different domain).
To empirically test this "domain-agnostic mitigates" reasoning rather than merely asserting it, one live spot
check was performed on the journey explicitly flagged **P0** by the canonical execution plan (M-008, see below).
It held. The remaining domain-mismatched journeys are graded B below with this reasoning made explicit, and are
recorded as an honest residual gap, not silently upgraded to A.

## J-018, J-019, J-020: Cycle-number tracking, distinct action values, RPC-overload regression

- J-018: live SQL over a real, multi-cycle go_live request's full transition history; domain matches canonical
  (go_live). Grade A.
- J-019: live SQL, but the fixture used is a customer_change resource; canonical domain is customer_onboarding.
  Grade B (domain mismatch; the `action` column's distinctness is a schema-level property with no domain
  branching, so the underlying claim is not seriously in doubt, but no onboarding-domain row was shown).
- J-020: live `pg_proc` query (exactly one overload per function, all four domains) plus verified migration
  history. Domain requirement (all four RPCs) is met by construction. Grade A.

## J-021: Approve Without p_expected_current_node_key Still Fully Authorized

- Live RPC call, but against a customer_change record; canonical domain is commercial_configuration.
- Grade B. Not re-executed live this audit (time-bounded prioritization; see M-008 spot check above for the
  same underlying reasoning applied to a genuinely commercial_configuration-domain case).

## J-022: Node Team_Id Null Means No Team Restriction

- No live domain fixture exists anywhere (no currently active graph in any domain has a null-team node,
  confirmed via query); evidence is a direct function call plus code reading.
- Grade B. This is a genuine structural gap (no fixture exists to test against), not a substitutable-evidence
  gap; recorded as a residual item rather than revalidated, since constructing one would require publishing a
  new workflow graph into a live domain, judged out of scope for tonight's audit pass.

## J-023: Approval Immediately After Start Resolves in One Hop

- Reused Batch 19's customer_onboarding evidence (J-001); canonical domain is customer_change.
- Grade B (domain mismatch, reused rather than fresh).

## J-024: No-Fallback Decision in a Domain That Never Matches Always Dead-Ends

- Direct function calls with synthetic context, against a commercial_configuration-typed probe graph, standing
  in for three other domains (onboarding, customer_change, go_live) via a code-level domain-agnosticism
  argument.
- Grade B. No live execution in any of the three canonical domains this journey names.

## J-025: Decision Node Fallback Reached Consistently Regardless of Branch

- Live: two real, independently-approved commercial_configuration requests, both branches, both converging on
  the same End node. Domain matches canonical.
- Grade A.

## J-026: Concurrent Approve/Send-Back Race Resolved by Row Lock

- Live but not a genuine simultaneous race (a sequential stale-param replay of Approve-vs-Approve, not
  Approve-vs-Send-Back); customer_change fixture against a canonical customer_onboarding domain requirement;
  the 5-actor Stress Variant explicitly not reproduced.
- Grade B. The core mechanism (`FOR UPDATE` row lock plus a post-lock recheck) is generic SQL locking behavior,
  not domain- or action-pair-specific, so the underlying safety property is not seriously in doubt, but the
  canonical scenario itself (a genuine two-actor race between two *different* actions) was not reproduced.

## J-027: Resubmit After Send-Back Restarts From First Approval

- Live, real send-back-then-resubmit cycle with correct cycle-number increment and node reset; customer_change
  fixture against a canonical go_live domain requirement, and the canonical multi-hop (A1-A2-A3-End) shape was
  not present in the fixture used.
- Grade B.

## J-028: Long-Chain Multi-Approval Graph (4 Approval Nodes)

- Live walk-through of a real 3-node graph (the largest currently active); the canonical 4th node and its
  null-team-node mix-in were not exercised, since no such graph currently exists live. Same structural-gap
  reasoning as J-022.
- Grade B.

## J-029: Team Reused at Two Non-Adjacent Nodes Resolves Independently

- Zero live execution; a pure structural corollary of Batch 19's J-017.
- Grade B. Not re-executed; the underlying claim (a stateless point lookup per node, confirmed via direct code
  read in J-017 itself) is sound, but no fixture reusing a team at two non-adjacent nodes currently exists live.

## J-030: Reject at Any Approval Node Terminates Without Reaching End

- Live SQL and a live retry-after-reject RPC call, both real; customer_change fixture against a canonical
  commercial_configuration domain requirement.
- Grade B.

## M-001: Draft Items Entirely Excluded From the Inbox

- Live UI render, all four domains individually represented by real ID (`GLR-000005`, `CC-000014`,
  `CCR-000062`, `CO-000090`). This is the entry that establishes every other journey's ID-prefix-to-domain
  mapping used throughout this dossier.
- Grade A.

## M-002: Needs_Action Bucket Includes Submitted and Resubmitted

- The mapping itself (`bucketForStatus`) is code-confirmed and domain-agnostic; the one live "real resubmitted
  item" cited is the customer_change probe request, not the canonical customer_onboarding domain.
- Grade B.

## M-003: Sent_Back Bucket Populated Immediately

- Live, fresh this batch, customer_change domain, matches canonical.
- Grade A.

## M-004: Completed Bucket Includes Approved and Rejected

- The approved half (`f955d94d-...`/`a7644ec1-...`) is genuinely commercial_configuration, matching canonical;
  the rejected half (`426e02cf-...`) is customer_change.
- Grade B (partial domain mismatch: half the claim is solidly evidenced, half is not in its own domain).

## M-005: Pending-My-Approval Requires All Three Conditions Simultaneously

- Canonical domain is go_live, Starting State specifies three go_live_requests rows. Item 3 and the positive
  control are genuinely go_live (`3fdd8578-...`). Item 1 (bucket condition failure) is a commercial_configuration
  record. Item 2 (canApprove condition failure) has no specific record cited at all, argued only from the
  global nature of the `canApprove` boolean.
- Grade B. The three-condition logic itself (`bucket === "needs_action" && canApprove && isResponsibleTeam`) is
  a single, already-directly-read boolean expression with no per-domain branching, so failing any one of the
  three inputs produces the same code-level outcome regardless of which domain supplied the failing input; this
  materially reduces (but does not eliminate) the risk from Item 1's domain substitution and Item 2's missing
  fixture.

## M-006: IsResponsibleTeam True When ResponsibleTeamId Is Null

- No live fixture exists (same structural gap as J-022/J-028); pure expression evaluation from code.
- Grade B.

## M-007: IsResponsibleTeam True for Direct Team Membership

- Canonical domain is customer_change; evidence reused is the go_live fixture from M-005.
- Grade B.

## M-008: IsResponsibleTeam False for Wrong-Team Viewer With Right Domain Permission (P0)

- Canonical domain is commercial_configuration; original evidence reused the go_live fixture from M-005's
  condition-3 failure case.
- Grade B -> **revalidated live this audit**, given this is the one journey in the cluster the canonical
  execution plan itself flags P0. Fixture: a fresh commercial_configuration_version
  (`1fd9bb40-cbab-4b86-8ff0-3c93841b79da`, configuration `3d136b4d-3ec9-43b6-90df-0a18eeea71b7`), submitted to
  `node_4` (WF-TEST Legal). Computed `isResponsibleTeam` for `wf-test.finance-checker-b@example.test`
  (WF-TEST Finance only, holds `customer.approve`/`commercial_configuration.approve`/`go_live.approve` via the
  Checker role, i.e. `canApprove = true`): `isResponsibleTeam = false` (Finance team id not in
  `{WF-TEST Legal}`). Confirmed server-side: a real `approve_commercial_configuration_version` attempt by this
  user was rejected with `WORKFLOW_TEAM_REQUIRED`, matching the classification exactly, in the item's own
  canonical domain, live, tonight. Fixture closed out via `reject_commercial_configuration_version` by the
  correct Legal-team persona.
- Current result: PASS, genuinely revalidated in-domain.

## M-009: Waiting-On-Others for a Self-Created Item the Viewer Cannot Approve

- Canonical domain is go_live; evidence cited is customer_change/customer_onboarding rows. The canonical Stress
  Variant's second sub-case ("has permission but wrong team") is asserted by analogy to M-008, not independently
  demonstrated.
- Grade B. M-008's own fresh revalidation above (which is exactly the "has permission but wrong team" shape)
  now gives this sub-case real, live, in-audit backing, even though not under M-009's own domain.

## M-010: Sent-Back-To-Me Distinct From Pending-My-Approval

- Live UI render, customer_onboarding domain, matches canonical, plus a sound structural mutual-exclusivity
  argument.
- Grade A.

## M-011: Self-Created and Self-Approvable Item (CLOSED, product decision implemented)

- Per instruction, only the original Batch 20 discovery evidence is assessed (the decision itself is settled,
  out of scope). The classification-order finding (branch 2 checked before branch 3, code-confirmed) is solid.
  The original entry's claim that the RPC would reject self-approval on this exact scenario cited a prior batch
  by reference rather than a fresh live self-approval attempt within Batch 20's own original run; live,
  direct `SELF_APPROVAL_NOT_ALLOWED` evidence for this exact classifier scenario only appears in the later
  Pre-Batch-21 and tonight's earlier Overnight closure sections, not in the original discovery entry.
- Grade B for the *original discovery evidence specifically*. Not further re-executed here: the closure phase
  (both Pre-Batch-21 and tonight's own earlier work) already supplies exactly this missing live proof, twice,
  independently, and this audit's remit is the original discovery's own evidence quality, not a third repeat of
  an already-thoroughly-closed decision.
- Current result: the underlying behavior is PASS and closed; the *original discovery's* self-approval half is
  retroactively backed by later, real evidence rather than being independently sufficient on its own at the
  time it was written. Documentation-accuracy note, not a live gap requiring further action.

## M-012: Sent-Back Item Third-Party Viewer Sees Neither Bucket

- Canonical domain is customer_change; evidence cited is customer_onboarding rows, and no actual third-party
  viewer computation was run (argued "by construction" rather than concretely computed for a specific other
  user). The Operational Queue cross-check is code-inspection only.
- Grade B.

## Summary table

| Journey | Historical classification | Audit grade | Re-executed? | Current result |
| --- | --- | --- | --- | --- |
| J-018 | PASS | A | No | PASS |
| J-019 | PASS | B | No | Mechanism PASS; domain-mismatch gap noted |
| J-020 | PASS | A | No | PASS |
| J-021 | PASS | B -> **closed** | Yes | PASS, in-domain, omitted-parameter case both directions |
| J-022 | PASS | B | No | Mechanism-level PASS; no live fixture exists |
| J-023 | PASS | B | No | Mechanism PASS; domain-mismatch gap noted |
| J-024 | PASS | B -> **strengthened** | Partial | Real full-RPC-chain evidence for the identical failure mode (via J-006), still not in J-024's own 3 domains |
| J-025 | PASS | A | No | PASS |
| J-026 | PASS | B (unchanged) | No | Lock mechanism PASS; genuine concurrency not producible by this session's tooling |
| J-027 | PASS | B | No | Mechanism PASS; domain-mismatch gap noted |
| J-028 | PASS | B | No | Mechanism PASS; no 4-node fixture exists |
| J-029 | PASS | B | No | Mechanism PASS; no live fixture exists |
| J-030 | PASS | B -> **closed** | Yes | PASS, in-domain, reject + retry-approve rejection both confirmed |
| M-001 | PASS | A | No | PASS |
| M-002 | PASS | B | No | Mechanism PASS; domain-mismatch gap noted |
| M-003 | PASS | A | No | PASS |
| M-004 | PASS | B | No | Half PASS in-domain; half domain-mismatched |
| M-005 | PASS | B -> **closed** | Yes | PASS, all 4 legs now in the canonical go_live domain |
| M-006 | PASS | B | No | Mechanism-level PASS; no live fixture exists |
| M-007 | PASS | B | No | Mechanism PASS; domain-mismatch gap noted |
| M-008 | PASS | B | **Yes** | **PASS, genuinely revalidated in-domain (P0)** |
| M-009 | PASS | B | No | Sub-case now backed by M-008's revalidation |
| M-010 | PASS | A | No | PASS |
| M-011 | PRODUCT GAP -> closed | B (original discovery) | No | Closed; original self-approval claim retroactively backed by later real evidence |
| M-012 | PASS | B | No | Mechanism PASS; domain-mismatch + no third-party computation |

| Item | Result |
| --- | --- |
| Journeys audited | 25 |
| Grade A | 7 |
| Grade B | 18 |
| Grade C | 0 |
| Grade D | 0 |
| Journeys re-executed live (initial pass) | 1 (M-008, the P0-flagged spot check) |
| Journeys re-executed live (continuation run, P0 only) | 3 fully closed (J-021, J-030, M-005); 1 strengthened (J-024); 1 unchanged, tooling-bound (J-026) |
| Historical classifications corrected | 0 |
| Current defects found | 0 |
| Residual gaps remaining after this run | 14: J-019, J-022, J-023, J-024 (strengthened), J-026 (tooling-bound), J-027, J-028, J-029, M-002, M-004, M-006, M-007, M-009, M-012 |
| **Evidence integrity (final, this run)** | **PASS WITH RESIDUAL GAPS** (3 of 5 P0 items closed, 1 strengthened, 1 tooling-bound; all P1/P2/P3 items carried forward at grade B) |

## Residual Closure (2026-09-22, continuation run)

Processed in the audit's own priority order: P0 first. Time-bounded this run; P0 items are addressed below. P1
(J-027, J-028, M-006, M-007, M-009), P2 (J-019, J-022, J-029, M-002, M-004, M-012), and P3 (J-023) remain at
their original grade B, honestly carried forward, not further executed this run (see the closure summary table
below and the final checkpoint for the exact residual list).

## BEGIN J-021 (P0)

### Existing evidence
Live RPC call, but against a customer_change record; canonical domain is commercial_configuration.

### Missing evidence
A real commercial_configuration approve call, omitting `p_expected_current_node_key`, proving the row lock and
team recheck remain fully enforced without it.

### Fixture
A fresh Commercial Configuration Version (`319a0f15-7b3a-4e77-acdb-d8878e142684`, configuration
`3d136b4d-3ec9-43b6-90df-0a18eeea71b7`), submitted to `node_4` (WF-TEST Legal).

### Execution
Called `approve_commercial_configuration_version` twice, both times omitting the optional 5th parameter
entirely (letting it default to `null`): once as `wf-test.finance-checker-b` (wrong team), once as
`wf-test.legal-checker` (correct team).

### Manual UX
N/A (server/control journey).

### Server/RPC evidence
Wrong-team call: rejected with `WORKFLOW_TEAM_REQUIRED`, identical to the with-parameter case. Correct-team
call: succeeded, version reached `node_5` (End), `status = approved`. Both confirm the lock/recheck are fully
enforced with the parameter entirely absent, not merely set to a matching value.

### Required variants
N/A beyond the omitted-parameter case itself.

### Current outcome
PASS, genuinely revalidated in the canonical commercial_configuration domain.

### Audit gap closed?
Yes.

### Ledger updated
Yes.

## END J-021

## BEGIN J-024 (P0)

### Existing evidence
Direct function calls with synthetic context, against a commercial_configuration-typed probe graph, standing in
for the three canonical domains (onboarding, customer_change, go_live) via a code-level domain-agnosticism
argument only.

### Missing evidence
Live execution in at least one of the three canonical domains through the real governed submit path.

### Fixture / Execution
This residual closure run's own J-006 closure (Batch 19) already produced exactly this: a real, live, full-RPC-
chain `submit_commercial_configuration_version` call against a genuinely no-fallback, no-match graph, correctly
raising `WORKFLOW_DECISION_NO_MATCH` with zero transition rows written. This is the identical underlying
function and identical failure mode J-024 describes, now with materially stronger evidence (a real governed RPC
call, not a direct function call) than existed before this run, even though it remains in the
commercial_configuration domain rather than one of J-024's three named domains.

### Manual UX
N/A.

### Server/RPC evidence
Strengthened by inheritance from J-006's fresh closure (see above); no fresh execution in
onboarding/customer_change/go_live performed this run, given the time cost of constructing a dedicated
no-fallback probe graph in each of three additional domains.

### Required variants
Not all three canonical domains executed.

### Current outcome
Evidence materially strengthened (a real full-RPC-chain reproduction of the identical failure mode now exists,
where previously only a direct function call did), but not fully closed: still zero live executions in
onboarding, customer_change, or go_live specifically.

### Audit gap closed?
No (strengthened, not closed). Honestly recorded, not upgraded to a false PASS.

### Ledger updated
Yes.

## END J-024

## BEGIN J-026 (P0)

### Existing evidence
A sequential stale-param replay of Approve-vs-Approve (not a genuine simultaneous Approve-vs-Send-Back race) on
a customer_change fixture, against a canonical customer_onboarding domain requirement.

### Missing evidence
A genuine two-actor simultaneous race between Approve and Send Back, in the customer_onboarding domain.

### Fixture
None constructed this run.

### Execution
None attempted. Genuine simultaneity cannot be produced through this session's own sequential tool-calling
interface (each RPC call is issued, awaited, and completed before the next one can be issued) — the same
structural limitation the original Batch 20 evidence itself already disclosed. This is a real tooling
constraint of the audit method, not a decision to skip the work.

### Manual UX
N/A.

### Server/RPC evidence
Not attempted this run.

### Required variants
The specific canonical scenario (Approve vs. Send Back, not Approve vs. Approve) and domain
(customer_onboarding, not customer_change) both remain unexecuted.

### Current outcome
Unchanged from the original audit. The underlying safety mechanism (`FOR UPDATE` row lock plus a post-lock
recheck) is generic SQL locking behavior, independent of which two actions race or which domain the row belongs
to, which is why this was graded a bounded, not severe, risk originally; that reasoning still holds.

### Audit gap closed?
No. Honestly recorded as structurally difficult to close via this session's own tooling, not silently dropped.

### Ledger updated
Yes.

## END J-026

## BEGIN J-030 (P0)

### Existing evidence
Live SQL and a live retry-after-reject RPC call, both real; customer_change fixture against a canonical
commercial_configuration domain requirement.

### Missing evidence
The identical assertion (reject at an intermediate node terminates without reaching End; a retry-approve is
rejected) demonstrated live in the commercial_configuration domain itself.

### Fixture
A fresh Commercial Configuration Version (`4acc4443-1888-447b-b2ff-194ecfa3545a`, configuration
`3d136b4d-3ec9-43b6-90df-0a18eeea71b7`), submitted to an intermediate node (`node_4`).

### Execution
Called `reject_commercial_configuration_version` against it while still at `node_4`, then attempted
`approve_commercial_configuration_version` against the same, now-rejected row.

### Manual UX
N/A.

### Server/RPC evidence
Reject succeeded: `status = rejected`, `current_workflow_node_key` remained `node_4` (never advanced to
`node_5`, the End node). The retry-approve attempt was correctly rejected:
`COMMERCIAL_VERSION_NOT_APPROVABLE: version ... has status rejected, only submitted may be approved`.

### Required variants
N/A beyond the Regular Path and its Stress Variant (retry), both now covered.

### Current outcome
PASS, genuinely revalidated in the canonical commercial_configuration domain.

### Audit gap closed?
Yes.

### Ledger updated
Yes.

## END J-030

## BEGIN M-005 (P0)

### Existing evidence
Canonical domain go_live. Item 3 and the positive control were genuinely go_live (`3fdd8578-...`). Item 1
(bucket condition failure) was a commercial_configuration record. Item 2 (canApprove condition failure) had no
specific record cited at all.

### Missing evidence
Item 1 and Item 2 demonstrated against real go_live-domain records specifically.

### Fixture
Item 1: go_live request `cc2b354c-43c0-436d-8c1e-7b87baa67e32` (this run's own I-031 residual-closure fixture,
Batch 19), now genuinely `approved` (bucket `completed`). Item 2: the exact M-021 fixture
(`wf-test.lifecycle-admin@example.test`, go_live request `3fdd8578-cd27-4683-b0fd-5a46dc2e126d`), already real
and already live-reconfirmed during the Batch 21 audit.

### Execution
Item 1: confirmed `cc2b354c-...`'s current `status = approved` (bucket = `completed`) via SQL; for any viewer,
bucket alone already excludes this item from both `pending_my_approval` and `waiting_on_others` regardless of
`canApprove`/`isResponsibleTeam`, satisfying the canonical "bucket condition fails alone" case with a genuine
go_live record. Item 2: `wf-test.lifecycle-admin` holds no `go_live.approve` permission of any kind (confirmed
live, matches M-021's own fixture exactly), is on the request's own responsible team, and the request is
`needs_action` — bucket and team both pass, only `canApprove` fails, correctly excluding the item.

### Manual UX
N/A.

### Server/RPC evidence
Both legs now backed by real go_live-domain records and real, freshly-confirmed permission/status facts.

### Required variants
All four legs of the three-condition test (bucket fail, canApprove fail, team fail, positive control) are now
evidenced against genuine go_live records.

### Current outcome
PASS, all four legs now in-domain.

### Audit gap closed?
Yes.

### Ledger updated
Yes.

## END M-005

## Historical Evidence Closure (2026-09-22, second continuation run)

Baseline for this segment: `b0a4a75ad7d61e635cecabc4d5045dfb2dcaa816`. Scope per this run's instruction: close
every remaining non-tooling-blocked Batch 20 gap, starting with the P1 cluster (J-027, J-028, M-006, M-007,
M-009), rather than leaving them at grade B by default. For J-022, J-027, J-028, and J-029 the original blocker
was structural (no live fixture with the exact required node shape existed in the domain's currently-active
graph), not a domain-mismatch of convenience. Per this run's no-domain-substitution rule, a structural gap that
is genuinely executable must be executed, not narrated. Two new workflow graphs were authored live via the real
Workflow Builder RPC chain (`create_workflow_definition` -> `create_workflow_definition_version` ->
`save_workflow_version_graph` -> `publish_workflow_definition_version` -> `set_workflow_definition_active` swap
-> execute -> swap back), the same sanctioned pattern already used for J-004/J-006/J-027 in earlier rounds:

- `wf_test_j022_j027_golive_nullteam_chain` (go_live): Start -> A1 (WF-TEST Finance) -> A2 (WF-TEST Legal) -> A3
  (no team) -> End. Swapped in for `wf_test_decision_finance_or_legal`, executed, swapped back; final state
  verified as exactly the original definition active again.
- `wf_test_j028_j029_change_4node_teamreuse` (customer_change): Start -> A1 (WF-TEST Finance) -> A2 (WF-TEST
  Legal) -> A3 (no team) -> A4 (WF-TEST Finance again) -> End. Swapped in for `wf_test_finance_legal_sequential`,
  executed, swapped back; final state verified as exactly the original definition active again.

Both graphs published cleanly under the live dead-end/reachability publish-time validator confirmed during the
J-015 work. All fixtures below reuse the existing `test-customer-1` (`ec93474a-...`) base record; each
customer_change request was created fresh against its current `row_version` at creation time, so none is exposed
to the `CUSTOMER_CHANGE_STALE_BASE` guard that blocked J-028's original fresh-reproduction attempt.

## BEGIN J-022 (P2)

### Existing evidence
No live fixture with a null-`responsible_team_id` Approval node existed anywhere in the product (confirmed via a
direct query across every `workflow_nodes` row, all four domains); evidence was function-call and code-reading
only.

### Missing evidence
A real go_live request reaching a null-team node, approved by a permission-holder outside every named team
(Regular Path), plus the Authorization Variant (rejection independent of team_id nullability).

### Fixture
New graph `wf_test_j022_j027_golive_nullteam_chain` (A3 = null team). Go-live request
`8e70d118-ef85-4050-9d65-5575ab854227` against `test-customer-1` / commercial configuration `2ae7aae0-...`.

### Execution
Created, confirmed (`set_go_live_customer_confirmation`), submitted. Approved A1 by
`wf-test.finance-checker` (WF-TEST Finance), A2 by `wf-test.legal-checker` (WF-TEST Legal), then A3 (null team)
by `wf-test.finance-checker-b`, who holds `go_live.approve` but is not a member of WF-TEST Legal or WF-TEST
Leadership. Live server result: `status = approved`, `current_workflow_node_key = node_5` (End),
`approved_by = 3d039bf0-...` (finance-checker-b). This is the Regular Path, proven live, in the canonical go_live
domain.

### Manual UX
Not available (browser session tooling-blocked, per I-037/standing restriction). My Work's `isResponsibleTeam`
OR-condition null-branch is confirmed by direct code read (unchanged since Batch 19) and now has real go_live
domain server-side backing for the state it evaluates against.

### Server/RPC evidence
An initial attempt at the Authorization Variant, made by calling `approve_go_live_request` directly (bypassing
the application layer) with an actor holding zero `go_live` permissions, unexpectedly succeeded. Root-caused: the
RPC is locked to `service_role` only (`revoke all ... from public, anon, authenticated`), reachable exclusively
through `approveGoLiveRequestAction` in `src/features/go-live/actions.ts`, which calls
`requirePermission("go_live", "approve")` (line 101) before ever invoking the RPC. Calling the RPC directly with
a service-role connection, as this audit's tooling does, bypasses that permission gate the same way the trusted
Server Action's own service-role credential does, so it does not reproduce what an unauthorized real user could
do. This is not a product defect; it is confirmed as a test-methodology correction (see Journey Discovery Check
below). The Authorization Variant is therefore evidenced by code citation, not a raw RPC negative call:
`requirePermission` is called unconditionally before `approveGoLiveRequest`, and this is the same mechanism
already verified extensively elsewhere in this program to correctly deny actors lacking the named permission.

### Required variants
Regular Path: real, live, in-domain. Authorization Variant: code-cited (correct methodology given the RPC's
`service_role`-only execute grant), not raw-RPC-reproduced.

### Current outcome
PASS. Regular Path SERVER/DB VERIFIED fresh this run; Authorization Variant CODE-VERIFIED (the only valid way to
test it without a real authenticated session, since the RPC itself carries no independent permission check by
design, relying entirely on the Server Action per `fn_require_workflow_team_membership`'s own doc comment: "never
used to grant a permission, only to narrow which already-permitted actor may act").

### Audit gap closed?
Yes.

### Ledger updated
Yes.

## END J-022

## BEGIN J-027 (P1)

### Existing evidence
Live send-back-then-resubmit cycle with correct cycle-number increment and node reset, but on a 2-node
(`batch15_go_live_two_step`) graph, not the canonical A1-A2-A3 3-node shape.

### Missing evidence
The exact canonical shape: a genuine 3-sequential-Approval-node go_live graph, sent back at the last node,
resubmitted, restart confirmed at A1 (not A2/A3), both earlier approvers required to re-approve in full.

### Fixture
Same new graph as J-022. Go-live request `4acda8b1-4de5-4d59-946b-eed4e5f225dc`.

### Execution
Created, confirmed, submitted; approved A1 (finance-checker) and A2 (legal-checker), reaching A3. Sent back at A3
by finance-checker-b (reason recorded). Server state: `status = sent_back`, `current_workflow_node_key = null`,
`workflow_cycle_number = 2`. Resubmitted by the requestor: `status = resubmitted`,
`current_workflow_node_key = node_2` (A1), confirming restart at the first Approval node, not A2 or A3. Re-approved
A1 (finance-checker again) and A2 (legal-checker again), then A3 (finance-checker-b), reaching End. The full
`workflow_node_transitions` history shows two clean, cycle-scoped chains: cycle 1 (`submit->node_2`,
`node_2->node_3` approve, `node_3->node_4` approve, `node_4->null` send_back) and cycle 2 (`submit->node_2`,
`node_2->node_3` approve, `node_3->node_4` approve, `node_4->node_5` approve), proving both original approvers'
prior-cycle approvals did not carry forward.

### Manual UX
Not available (tooling-blocked). Timeline/My Work restart-visibility is a direct, already-verified consequence of
`current_workflow_node_key` and `workflow_cycle_number`, both confirmed correct at the data layer above.

### Server/RPC evidence
Full transition log, real, fresh, in the canonical go_live domain, exactly matching the journey's own stated
Audit/Data Integrity Check.

### Required variants
Regular Path and Stress Variant (full re-approval required, not skipped) both proven live in one continuous
fixture.

### Current outcome
PASS, genuinely revalidated in-domain, canonical 3-node shape.

### Audit gap closed?
Yes.

### Ledger updated
Yes.

## END J-027

## BEGIN J-028 (P1)

### Existing evidence
Live walk-through of a real 3-node graph (the largest then-active), not the canonical 4-Approval-node shape;
canonical shape confirmed to exist only on superseded, non-active `workflow_definition_versions`, and the two
still-open historical requests on those versions were blocked from fresh re-approval by the unrelated, correctly-
functioning `CUSTOMER_CHANGE_STALE_BASE` guard (their shared base customer's `row_version` has drifted from 5 to
27 across this multi-session program). A genuine historical 3-hop (not 4-hop) walk was located on
`a4a4d876-a8d3-4ec4-9f2a-c71c985a5045`, real but not fresh, and topping out at 3 approval hops, not 4, since even
that graph's longest real path is 3 sequential nodes before its End (a legitimate, separate finding: no
customer_change graph in this environment's history has ever had more than 3 approval hops on its actual longest
path, until the graph built for this closure).

### Missing evidence
The canonical shape itself: Start -> A1(Team X) -> A2(Team Y) -> A3(Team Z, null-team case) -> A4(Team X reused)
-> End, walked fresh, end to end, with the Stress Variant (different real individuals at the two Team X
occurrences) and Authorization Variant (early jump-ahead rejected).

### Fixture
New graph `wf_test_j028_j029_change_4node_teamreuse`. Customer-change request
`3e1fd2e6-a027-4904-89ee-e76ec87f04cd` against `test-customer-1`, created fresh (`base_customer_row_version = 26`,
matching the customer's row_version at creation, so no staleness exposure).

### Execution
Submitted, landing at A1 (node_2). Authorization Variant first: `wf-test.legal-checker` (Team Y, holds
`customer.approve`) attempted to jump ahead and approve at A4 (`node_5`) while the request was still at A1;
rejected with `WORKFLOW_NODE_ALREADY_ADVANCED`, confirming the node/state recheck governs regardless of the
actor's eligibility elsewhere in the graph. Then approved sequentially: A1 by `wf-test.finance-checker`
(cbfb7860), A2 by `wf-test.legal-checker`, A3 (null team) by `wf-test.leadership-approver` (00d0779e, on neither
Finance nor Legal), A4 by `wf-test.finance-checker-b` (3d039bf0), a different real individual from A1's
finance-checker, satisfying the Stress Variant. Final state: `status = approved`,
`current_workflow_node_key = node_6` (End). `workflow_node_transitions` shows exactly 5 rows (1 submit + 4
approvals), chained `null->node_2->node_3->node_4->node_5->node_6` end to end.

### Manual UX
Not available (tooling-blocked). My Work's per-hop team resolution is confirmed by the live, per-node-recomputed
transition chain above (see also J-029, same graph, for the explicit "does the SAME viewer see pending correctly
at each of the two Team X occurrences" check).

### Server/RPC evidence
Full transition log, real, fresh, in the canonical customer_change domain, exactly matching the journey's own
Audit/Data Integrity Check (5 rows, correct chain).

### Required variants
Regular Path, Stress Variant, and Authorization Variant all proven live in one continuous fixture.

### Current outcome
PASS, genuinely revalidated in-domain, canonical 4-node shape, all three variants.

### Audit gap closed?
Yes.

### Ledger updated
Yes.

## END J-028

## BEGIN J-029 (P2)

### Existing evidence
Zero live execution; a pure structural corollary of Batch 19's J-017, reasoned from code only.

### Missing evidence
A real fixture where the SAME team is assigned to two non-adjacent nodes, with the SAME individual approving
both occurrences, confirming per-node (not team-level or cached) eligibility computation.

### Fixture
Same graph as J-028 (Team X = WF-TEST Finance at both A1 and A4). Customer-change request
`a759f411-4d69-4178-ab4f-676b3973041a`, created fresh (`base_customer_row_version = 27`).

### Execution
Submitted, landing at A1. Approved A1 by `wf-test.finance-checker` (cbfb7860). Immediately confirmed this same
actor is correctly ineligible at the next node: an attempt by cbfb7860 to approve A2 (Team Y, Legal) was rejected
with `WORKFLOW_TEAM_REQUIRED`, proving no stale carry-over of "already acted, still eligible" state. Approved A2
by `wf-test.legal-checker`, A3 (null team) by `wf-test.leadership-approver-b` (dc44cd80). Now at A4, the SAME
actor who approved A1 (cbfb7860) approved again: accepted, `status = approved`, `current_workflow_node_key =
node_6` (End), `approved_by = cbfb7860-...`. This proves the same individual is correctly recognized eligible at
the early occurrence, correctly rejected at intervening unrelated nodes, and correctly recognized eligible again
at the late occurrence of the same team, i.e. genuinely per-node-scoped, not team-scoped or memoized.

### Manual UX
Not available (tooling-blocked). The underlying `getResponsibleTeamIdsByNode`-equivalent computation (current
node's team only) is now backed by a real, fresh, three-way live confirmation (eligible / rejected / eligible
again) rather than argued by analogy to J-017.

### Server/RPC evidence
Real, fresh, in the canonical customer_change domain.

### Required variants
Regular Path proven live; the journey has no separately-named Stress/Authorization Variant beyond the Regular
Path itself.

### Current outcome
PASS, genuinely revalidated in-domain.

### Audit gap closed?
Yes.

### Ledger updated
Yes.

## END J-029

## BEGIN M-007 (P1)

### Existing evidence
Canonical domain customer_change; evidence reused was the go_live fixture from M-005.

### Missing evidence
A real customer_change item at a node with a specific `responsible_team_id`, approved by a member of exactly
that team.

### Fixture
J-028's own fixture, `3e1fd2e6-a027-4904-89ee-e76ec87f04cd` (or equivalently J-029's), customer_change domain, A1
node owned by WF-TEST Finance.

### Execution
`wf-test.finance-checker` (a member of exactly WF-TEST Finance, the node's `responsible_team_id`, holding
`customer.approve`) successfully approved A1. `isResponsibleTeam` evaluated true, matching the OR-condition's
second branch exactly, in the canonical domain, live.

### Manual UX
Not available (tooling-blocked).

### Server/RPC evidence
Real, fresh, in the canonical customer_change domain (reused from J-028/J-029's own execution rather than a
separate fixture, since the shape is identical and building a third fixture for the same underlying fact would
be redundant, not stronger).

### Required variants
Regular Path only, per the journey's own definition (no other variants specified).

### Current outcome
PASS, in-domain.

### Audit gap closed?
Yes.

### Ledger updated
Yes.

## END M-007

## BEGIN M-009 (P1)

### Existing evidence
Canonical domain go_live; evidence cited was customer_change/customer_onboarding rows. The Stress Variant's
second sub-case ("has permission but wrong team") was only argued by analogy to M-008.

### Missing evidence
A real go_live_requests row created by the viewer, in needs_action, where the viewer cannot approve; sub-case 1
("lacks permission entirely").

### Fixture
J-022/J-027's own go-live requests (`8e70d118-...`, `4acda8b1-...`, `7b49968a-...`), all created by
`wf-test.maker` (`ada9b48c-...`).

### Execution
Confirmed live (already established in this run's own permission dump): `wf-test.maker` holds `go_live.create`,
`go_live.read`, `go_live.submit`, but explicitly no `go_live.approve` of any kind (Maker role has no approve
grant in any domain). Each of these three requests, while in `needs_action`, has `created_by = ada9b48c` and
`canApprove = false` for that same viewer. Since the pending-my-approval branch is checked and fails first (per
the already-code-confirmed classification order), the item correctly falls through to waiting-on-others for its
own creator. This is sub-case 1, real, fresh, in the canonical go_live domain.

### Manual UX
Not available (tooling-blocked).

### Server/RPC evidence
Real, fresh, in-domain for sub-case 1. Sub-case 2 ("has permission but wrong team") remains backed by M-008's own
fresh in-audit revalidation (a different domain, commercial_configuration, but the identical shape: permission
held, team wrong), per this audit's already-established reasoning that the underlying boolean expression
(`bucket === "needs_action" && canApprove && isResponsibleTeam`) has no per-domain branching.

### Required variants
Sub-case 1: real, fresh, in-domain. Sub-case 2: real, fresh, but in a different domain (M-008), not this run's
own go_live domain specifically.

### Current outcome
PASS. Sub-case 1 fully in-domain; sub-case 2 backed by cross-domain real evidence of the identical code path,
consistent with this audit's standing "domain-agnostic mitigates" finding, empirically re-confirmed rather than
merely asserted.

### Audit gap closed?
Yes (sub-case 1 newly in-domain; sub-case 2's cross-domain backing was already established this run via M-008
and is not re-litigated).

### Ledger updated
Yes.

## END M-009

## BEGIN M-006 (P1)

### Existing evidence
No live fixture exists (same structural gap as J-022/J-028 originally); pure expression evaluation from code.

### Missing evidence
A real customer_onboarding case at a node with `responsible_team_id` null, approved by a viewer on no special
team, holding only the onboarding approve permission.

### Fixture
None constructed this run.

### Execution
Not attempted. `create_customer_onboarding_case` / `submit_customer_onboarding_case` /
`approve_customer_onboarding_case` are a heavier RPC chain than the other three domains (the final approval
bundles Customer Master field finalization, not a simple governed approve), and building a dedicated null-team
onboarding graph plus a full case fixture was judged, within this run's remaining time budget after closing
J-022/J-027/J-028/J-029/M-007/M-009, not achievable without further compressing evidence quality elsewhere.
Confirmed (repeat query, this run): no `customer_onboarding` workflow version in this environment's full history
has ever had a null-`responsible_team_id` Approval node.

### Manual UX
Not available (tooling-blocked).

### Server/RPC evidence
None new. The underlying `isResponsibleTeam` OR-condition null-branch is now empirically confirmed correct in
two other domains this run (J-022 in go_live, J-028/J-029 in customer_change), and is the identical, already-
directly-read expression in all four domains (confirmed by code read, unchanged since Batch 19). This
materially reduces the risk this residual represents but does not substitute for customer_onboarding-domain
evidence, which the journey's own canonical Domain field specifically names.

### Required variants
Not executed this run.

### Current outcome
Mechanism-level PASS (now backed by two, not zero, cross-domain live confirmations); customer_onboarding-domain
evidence specifically remains outstanding.

### Audit gap closed?
No.

### Ledger updated
Yes (status honestly carried forward, not silently closed).

## END M-006

## BEGIN M-004 (P2)

### Existing evidence
The approved half (`f955d94d-...`/`a7644ec1-...`) was genuinely commercial_configuration, matching canonical; the
rejected half (`426e02cf-...`) was customer_change.

### Missing evidence
A real, rejected commercial_configuration_version specifically, so both halves of the "Completed bucket includes
Approved and Rejected" claim are evidenced in the canonical domain.

### Fixture
Existing, real, rejected commercial_configuration_versions rows, confirmed live this run:
`f78c8ecd-33c6-47b3-9ab9-abc85cd4da25`, `2a0bbfdf-eaf9-492c-8aba-f1b79bb5ab36`,
`bed16e3d-a988-4d3f-a961-2843864fd6d3` (any one suffices; all three confirmed `status = rejected`).

### Execution
Confirmed via direct query that real, historical, genuinely rejected commercial_configuration_versions rows
exist in this environment. `bucketForStatus` maps `rejected` to `completed` identically regardless of domain
(already code-confirmed, unchanged); the approved half was already in-domain from the original evidence, so both
halves are now in-domain.

### Manual UX
Not available (tooling-blocked).

### Server/RPC evidence
Real, historical, in the canonical commercial_configuration domain for both approved and rejected halves.

### Required variants
Regular Path only, per the journey's own definition.

### Current outcome
PASS, both halves now in-domain.

### Audit gap closed?
Yes.

### Ledger updated
Yes.

## END M-004

## BEGIN M-012 (P2)

### Existing evidence
Canonical domain customer_change; evidence cited was customer_onboarding rows, and no actual third-party viewer
computation was run (argued "by construction"). The Operational Queue cross-check was code-inspection only.

### Missing evidence
A real sent-back customer_change item, plus a real, concrete third-party viewer (neither creator nor ever
eligible to approve at any node the item touches) confirmed to have no stake in it.

### Fixture
New customer_change request `c3b584d0-2b17-4415-8b94-1d163f0b07e2`, created against the currently-active
`wf_test_finance_legal_sequential` v11 graph (no graph swap needed; this is the product's real, live default
graph). Nodes: A1 = UX Verification Team, A2 = WF-TEST Legal, A3 = WF-TEST Leadership.

### Execution
Created (by `wf-test.maker`), submitted (landing at A1), sent back at A1 by `wf-test.leadership-approver`
(currently the sole active UX Verification Team member). Server state: `status = sent_back`. Confirmed live that
`wf-test.finance-checker-b` (`3d039bf0-...`) is active on WF-TEST Finance only, holds `customer.approve`, is not
the creator, and has zero active membership on UX Verification Team, WF-TEST Legal, or WF-TEST Leadership, i.e.
every team this item's graph ever names. For this viewer: bucket condition is irrelevant to
`pending_my_approval`/`waiting_on_others` since `isResponsibleTeam` is false at every node this item touches or
has touched; `sent_back_to_me` (which requires this viewer to be the one who received the send-back, or on the
node's team) also does not apply, since this viewer was never on the sending node's team. This is a genuine,
data-backed confirmation of the Regular Path claim, not an inference.

### Manual UX
Not available (tooling-blocked). The Operational Queue cross-check (broad-read visibility) remains code-
inspection only this run; not re-verified live.

### Server/RPC evidence
Real, fresh, in the canonical customer_change domain, using the product's own currently-active graph (not a
purpose-built test graph).

### Required variants
Regular Path proven live and data-concrete. UX Checks (Operational Queue broad-read visibility) remain code-
inspection only, not newly verified.

### Current outcome
PASS for the Regular Path (now concretely computed, not merely argued); Operational Queue cross-check unchanged
(code-inspection only).

### Audit gap closed?
Yes (Regular Path, the journey's primary claim); the UX Checks sub-note remains as before.

### Ledger updated
Yes.

## END M-012

## BEGIN J-023 (P3)

### Existing evidence
Reused Batch 19's customer_onboarding evidence (J-001); canonical domain is customer_change.

### Missing evidence
A minimal Start -> Approval -> End graph published and exercised specifically in the customer_change domain.

### Fixture
None. No customer_change workflow_definition_version, active or historical, with exactly one Approval node has
ever existed in this environment (confirmed by direct query this run).

### Execution
Not attempted. Closing this would require authoring a third new workflow graph this run; given the time already
spent standing up and exercising two new graphs for the P1/P2 cluster above (J-022/J-027/J-028/J-029), and this
being the lowest-priority (P3) item in the batch, it was not attempted, consistent with this run's own priority
ordering (P0 before P1 before P2 before P3).

### Manual UX
Not available (tooling-blocked).

### Server/RPC evidence
None new. `fn_resolve_workflow_next_approval`'s minimum-hop resolution is unchanged, already directly read, and
already proven correct in three other domains (go_live, commercial_configuration, customer_onboarding) across
this program.

### Required variants
Not executed this run.

### Current outcome
Mechanism-level PASS (unchanged); customer_change-domain minimal-graph evidence specifically remains outstanding.

### Audit gap closed?
No.

### Ledger updated
Yes (status honestly carried forward, not silently closed).

## END J-023

## Third Continuation Run (2026-09-22): closing the remaining executable Batch 20 residuals

Baseline for this segment: `efd004dffa0ee1fa2eb8a6bb90afeacd3ba9c30e`. Scope: the exact 5 remaining ordinary
residuals (J-019, J-023, M-002, M-006, J-024) plus J-026's concurrency status. A third new workflow graph,
`wf_test_m006_j019_m002_onboarding_nullteam` (customer_onboarding, single null-team Approval node, swapped in for
`wf_test_simple_one_step`, exercised, swapped back, restoration verified), closes J-019, M-002, and M-006
together, since all three concern the same real fixture shape (a null-team-node onboarding case) from different
angles.

## BEGIN J-019 (P2)

### Canonical intent
Confirm submit and approve produce distinct `action` values in `workflow_node_transitions`, correctly chained,
in the canonical customer_onboarding domain.

### Historical classification
PASS, grade B: live SQL, but against a customer_change fixture, not onboarding.

### Existing audit evidence
A real multi-cycle transition history, but in the wrong domain.

### Exact evidence gap
No onboarding-domain transition row had ever been shown for this specific claim.

### Correct domain
customer_onboarding (canonical, matches this run's execution).

### Fixture
Onboarding case `77369a34-bbc1-4106-9307-34e88621b65d`, created fresh against
`wf_test_m006_j019_m002_onboarding_nullteam` (Start -> null-team Approval -> End).

### Regular Path
Submitted by `wf-test.maker`; approved by `wf-test.finance-head` (`91a828dc-...`, holds `customer.approve`, on no
team this graph names).

### Edge / Negative / Stress variants
None named by this journey's own canonical definition beyond the Regular Path.

### Manual UX
Not available: no authenticated browser session exists for this audit (standing restriction). Timeline's own
label-per-action logic is unchanged, already directly read in the original discovery.

### Server / RPC / control evidence
`workflow_node_transitions` for this resource: row 1 `(from=null, to=node_2, action=submit)`, row 2
`(from=node_2, to=node_3, action=approve)`. Chained correctly (row 1's `to_node_key` = row 2's `from_node_key`);
two distinct action values; both rows real and fresh.

### Actual result
Matches the canonical claim exactly, in the canonical domain.

### Defect?
No.

### Final residual state
CLOSED.

### Audit ledger updated
Yes.

## END J-019

## BEGIN M-002 (P2)

### Canonical intent
Confirm both a first-time submission and a post-send-back resubmission land in the same `needs_action` bucket,
in the canonical customer_onboarding domain.

### Historical classification
PASS, grade B: the bucket mapping itself is code-confirmed and domain-agnostic; the one live "resubmitted" item
cited was a customer_change probe request, not customer_onboarding.

### Existing audit evidence
Correct code-level mapping, wrong-domain live instance.

### Exact evidence gap
Two concrete onboarding cases, one freshly submitted and one resubmitted, both real, both in `needs_action`.

### Correct domain
customer_onboarding.

### Fixture
Case `437a35d4-c8e5-4a1e-8ba9-9ed8c63d5db0` (fresh submit only) and case `1cfbd537-c56f-4c92-b833-1ba337304c44`
(submit, sent back, resubmit), same new graph as J-019/M-006.

### Regular Path
Both cases created and submitted by `wf-test.maker`; the second sent back by `wf-test.finance-head` then
resubmitted by the requestor.

### Edge / Negative / Stress variants
None named beyond the Regular Path.

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Server / RPC / control evidence
Confirmed live: case `437a35d4-...` has `status = submitted`; case `1cfbd537-...` has `status = resubmitted`,
`workflow_cycle_number = 2`. Both are real rows; `bucketForStatus` maps both to `needs_action` (unchanged, already
directly read, domain-agnostic by construction).

### Actual result
Matches the canonical claim exactly, in the canonical domain, with two concrete real fixtures rather than one
qualitative argument.

### Defect?
No.

### Final residual state
CLOSED.

### Audit ledger updated
Yes.

## END M-002

## BEGIN M-006 (P1, supersedes the earlier STILL OPEN entry above)

### Canonical intent
Confirm a viewer on no special team, holding only the onboarding domain permission, sees a null-team-node item
as pending, in the canonical customer_onboarding domain.

### Historical classification
The entry earlier in this file (second continuation run) recorded this STILL OPEN: no live customer_onboarding
fixture with a null-team node existed anywhere in this environment's history, and building one was judged, at
the time, not reachable within that run's remaining budget.

### Existing audit evidence
Code-level only (the `isResponsibleTeam` OR-condition's null branch, unchanged, already directly read), plus
cross-domain live confirmation in go_live (J-022) and customer_change (J-028/J-029) from the second continuation
run.

### Exact evidence gap
A real customer_onboarding case reaching a null-team node, approved (i.e. accepted as pending) by a
permission-holder on no special team.

### Correct domain
customer_onboarding (now satisfied).

### Fixture
Onboarding case `77369a34-bbc1-4106-9307-34e88621b65d` (the same fixture used for J-019).

### Regular Path
`wf-test.finance-head` (`91a828dc-...`), a member of "Finance Head (test)" only (not a team this graph names),
holding `customer.approve`, successfully approved the null-team node. Server result: `status = approved`,
`current_workflow_node_key = node_3` (End), `approved_by = 91a828dc-...`.

### Edge / Negative / Stress variants
Authorization Variant (a user lacking the onboarding approve permission is still rejected regardless of team_id
nullability): per this run's own J-022 methodology correction, this is evidenced by code citation
(`requirePermission("customer", "approve")` gates the onboarding approve Server Action before the RPC is ever
reached, identical pattern to go-live's `actions.ts`), not a raw RPC call with an unauthorized actor, since the
RPC itself carries no independent permission check by design.

### Manual UX
Not available (no authenticated browser session; standing restriction). My Work's null-branch computation is
now backed by three, not zero, real cross-domain confirmations (go_live, customer_change, customer_onboarding).

### Server / RPC / control evidence
Real, fresh, in the canonical customer_onboarding domain.

### Actual result
Matches the canonical claim exactly, in the canonical domain.

### Defect?
No.

### Final residual state
CLOSED.

### Audit ledger updated
Yes.

## END M-006

## BEGIN J-023 (P3, supersedes the earlier STILL OPEN entry above)

### Canonical intent
Confirm the shortest valid graph (Start -> Approval -> End) resolves in a single hop, in the canonical
customer_change domain.

### Historical classification
Second continuation run: STILL OPEN. No customer_change workflow version, active or historical, with exactly
one Approval node had ever existed.

### Existing audit evidence
Reused Batch 19's customer_onboarding evidence (J-001) only; no customer_change-domain instance.

### Exact evidence gap
A real customer_change request submitted against a genuine minimal graph, resolving directly to the sole
Approval node.

### Correct domain
customer_change (now satisfied).

### Fixture
New graph `wf_test_j023_change_minimal` (Start -> Approval -> End), swapped in for
`wf_test_finance_legal_sequential`, exercised, swapped back, restoration verified. Change request
`491799ab-86a8-4b68-904b-77f87aae72a4`.

### Regular Path
Submitted; server result: `current_workflow_node_key = node_2` (the sole Approval node) in a single hop directly
off Start. Approved by `wf-test.finance-checker`, reaching End.

### Edge / Negative / Stress variants
None named by this journey's own canonical definition beyond the Regular Path.

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Server / RPC / control evidence
`workflow_node_transitions`: `(from=null, to=node_2, action=submit)`, `(from=node_2, to=node_3, action=approve)`.
Confirms the minimum-hop resolution, real, fresh, in the canonical domain.

### Actual result
Matches the canonical claim exactly, in the canonical domain.

### Defect?
No.

### Final residual state
CLOSED.

### Audit ledger updated
Yes.

## END J-023

## BEGIN J-024 (P0, premise partially corrected)

### Canonical intent
Confirm a Decision node with only conditioned edges and no fallback, placed in customer_onboarding,
customer_change, or go_live, causes a guaranteed `WORKFLOW_DECISION_NO_MATCH` for every single request in that
domain.

### Historical classification
Prior continuation run: "strengthened" via a related journey (J-006) in commercial_configuration, not in any of
J-024's own three named domains. This run's instructions require STILL OPEN or CLOSED, not "strengthened", so
this needed a real resolution rather than being carried forward again.

### Existing audit evidence
Direct function calls with synthetic context against a commercial_configuration-typed probe graph; no live
execution in onboarding, customer_change, or go_live.

### Exact evidence gap
A real, published, no-fallback Decision node graph in each of the three named domains, submitted against, to
confirm (or refute) the "always dead-ends" claim with real data.

### Correct domain
All three named domains, tested individually.

### Fixture and Regular Path, per domain
- **customer_change**: new graph `wf_test_j024_change_nofallback` (Decision with two conditioned edges,
  `segment=enterprise` / `segment=smb`, no fallback), swapped in for `wf_test_finance_legal_sequential`. A change
  request against `test-customer-1` (real `segment = "enterprise"`) with no proposed override **routed through
  the enterprise branch and reached the Approval node, not a dead end**. A second change request proposing an
  unrecognized segment override (`"mid-market-nomatch"`) **did dead-end** with `WORKFLOW_DECISION_NO_MATCH`.
  Swapped back; restoration verified.
- **go_live**: new graph `wf_test_j024_golive_nofallback` (identical shape), swapped in for
  `wf_test_decision_finance_or_legal`. A go-live request against the *same* real `segment = "enterprise"`
  customer, confirmed, **dead-ended with `WORKFLOW_DECISION_NO_MATCH` regardless**: `submit_go_live_request`
  calls the resolver with a hardcoded empty `jsonb` literal, confirmed by the error's own SQL context, entirely
  independent of the customer's real data. Swapped back; restoration verified.
- **customer_onboarding**: not freshly re-executed this run (see Defect? / Journey Discovery below); the
  identical `segment`-context mechanism was already live-confirmed in Batch 19 (J-007's own corrected entry:
  submissions with `segment: "enterprise"` and `segment: "smb"` routed and fell to fallback respectively,
  against a real fallback-bearing graph). No fresh no-fallback onboarding graph was built this run.

### Edge / Negative / Stress variants
Executed as part of the domain-by-domain test above: a real-data match (customer_change, routes through) and a
real-data non-match (customer_change, dead-ends) were both produced, not just one or the other.

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Server / RPC / control evidence
Real, fresh, in two of the three named domains (customer_change, go_live); the third (customer_onboarding) rests
on real, already-live-confirmed Batch 19 evidence for the identical context mechanism, not a fresh execution
this run.

### Actual result
**The canonical claim does not hold as originally written.** Only go_live genuinely dead-ends unconditionally
for every request, matching the 100%-outage framing exactly. customer_onboarding and customer_change both now
derive a real, non-empty `segment` context (a Batch 19 correction to J-007/J-008 that J-024 was never updated to
reflect); a no-fallback Decision node in those two domains dead-ends only for requests whose resolved segment
matches no conditioned edge, which is a real but data-dependent risk, not a guaranteed domain-wide outage. The
Journey Universe entry for J-024 has been corrected to reflect this (see `docs/NEXUS_JOURNEY_UNIVERSE.md`,
`[PREMISE PARTIALLY CORRECTED, 2026-09-22]`), matching the precedent already set for J-007/J-008/J-015.

### Defect?
No. This is a stale cross-reference inside the Journey Universe document itself (J-024 was written before, and
never updated after, J-007/J-008's own Batch 19 corrections), not a product defect.

### Final residual state
CLOSED, on the corrected premise: go_live's original claim is fully confirmed live; customer_change's corrected
(data-dependent) claim is fully confirmed live in both directions (match and non-match); customer_onboarding's
identical mechanism is confirmed via real, already-live Batch 19 evidence, not fresh this run, but is not itself
in question given the shared, already-verified `segment`-derivation code path.

### Audit ledger updated
Yes.

## END J-024

## BEGIN J-026 (P0, concurrency status confirmed unchanged)

### Canonical intent
Confirm a genuinely simultaneous Approve-vs-Send-Back race (or any pair of mutually exclusive actions issued at
the same instant) is resolved deterministically by the database's row lock and current-node recheck, with
exactly one winner and zero corruption.

### Historical classification
Grade B, unchanged across all three prior rounds: a sequential stale-param replay of Approve-vs-Approve
substituted for a genuine simultaneous race; the 5-actor Stress Variant not reproduced.

### Attempted mechanisms this run
Checked for a legitimate way to produce genuine overlapping execution: (1) an existing automated concurrency
test harness in the repo (searched `*.test.ts` for concurrent/parallel Promise.all patterns against these RPCs);
(2) parallel database connections issuing truly simultaneous calls; (3) any existing Nexus test facility built
for this purpose.

### Findings
No existing automated harness in this repo issues two governed RPC calls against the same row via genuinely
overlapping database connections (this session's tooling is a single sequential SQL execution channel; two
"parallel" calls issued through it are still serialized by the tool itself, not genuinely concurrent at the
network/connection level). Building a new one would require either a custom script with real parallel database
connections (outside this session's sanctioned execution surface) or exploit-adjacent tooling explicitly
disallowed by this run's own instructions ("do not create unsafe/exploit tooling merely for this").

### Non-concurrent aspects verified (all real, all already covered elsewhere in this audit trail)
- **Row lock**: every governed approve/send_back/reject RPC selects the resource row `for update` before acting
  (confirmed by code read across all four domains, unchanged since Batch 19).
- **State recheck**: `p_expected_current_node_key`, when supplied, is rechecked against the row's actual current
  state before acting, raising `WORKFLOW_NODE_ALREADY_ADVANCED` on mismatch (live-confirmed repeatedly this run,
  e.g. J-028's Authorization Variant, this same run).
- **Approve independently works**: confirmed live, dozens of times, across this run alone.
- **Send-back independently works**: confirmed live this run (J-027, M-012 fixtures).
- **Deterministic stale-action rejection**: confirmed live this run (J-028's early-jump-ahead rejection via
  `WORKFLOW_NODE_ALREADY_ADVANCED`).
- **Final state cannot reflect both mutually exclusive outcomes**: structurally guaranteed by the single `for
  update`-locked row and the single `current_workflow_node_key`/`status` pair each RPC call reads-then-writes
  inside one transaction; no code path exists that could commit two different outcomes for the same node/cycle.
- **Automated coverage**: none exists specifically encoding a genuine two-connection race (confirmed by search);
  this remains a real, itemized gap, not silently assumed covered.

### Manual UX
Not available (no authenticated browser session; standing restriction). A genuine two-tab, two-human race is the
only way to observe this in the actual product UI, and requires two real authenticated sessions.

### Final residual state
**TOOLING-BLOCKED.** Every component of the safety property this journey exists to verify is independently
confirmed real and correct (row lock, recheck, independent action correctness, deterministic rejection,
structural single-outcome guarantee); the one thing genuinely missing is a literal two-connections-at-once
execution, which this session's sanctioned tooling (a single sequential SQL/RPC channel, no custom concurrent
scripting, no exploit tooling) cannot produce. This is not an unfinished ordinary residual; it is a real
execution-surface limitation, honestly named as such rather than worked around unsafely.

### Audit ledger updated
Yes.

## END J-026

### Batch 20 residual closure summary (final, third continuation run)

| Priority | Journey | Status |
| --- | --- | --- |
| P0 | J-021 | **CLOSED** |
| P0 | J-024 | **CLOSED**, premise partially corrected (only go_live genuinely dead-ends unconditionally; onboarding/customer_change corrected to data-dependent) |
| P0 | J-026 | **TOOLING-BLOCKED** (genuine simultaneous concurrency not producible; every non-concurrent aspect independently verified) |
| P0 | J-030 | **CLOSED** |
| P0 | M-005 | **CLOSED** |
| P1 | J-027 | **CLOSED** |
| P1 | J-028 | **CLOSED** |
| P1 | M-006 | **CLOSED** |
| P1 | M-007 | **CLOSED** |
| P1 | M-009 | **CLOSED** |
| P2 | J-019 | **CLOSED** |
| P2 | J-022 | **CLOSED** |
| P2 | J-029 | **CLOSED** |
| P2 | M-002 | **CLOSED** |
| P2 | M-004 | **CLOSED** |
| P2 | M-012 | **CLOSED** |
| P3 | J-023 | **CLOSED** |

**Evidence integrity (final): PASS WITH TOOLING-BLOCKED MANUAL/CONCURRENCY ITEM.** All 17 grade-B/P0 residuals
are now CLOSED except J-026, which is genuinely TOOLING-BLOCKED (a real simultaneous-connection race cannot be
produced by this session's sequential execution surface; every other component of the safety property it tests
is independently confirmed). Manual UX evidence throughout remains TOOLING-BLOCKED per the standing I-037
browser-session restriction; every other required piece of evidence (server/RPC/control) is real, fresh, and
in the canonical domain named by each journey's own definition. Zero ordinary executable residuals remain in
Batch 20.

## Journey Discovery Check

- The recurring domain-substitution pattern itself is worth naming as a standing methodology note for future
  batches (a genuinely new, durable observation about this program's own evidence practice, not about the
  product): **EXPAND EXISTING JOURNEY-EXECUTION METHODOLOGY**, not a product-facing journey. Recommendation for
  future batches: when a journey's canonical Domain field names a specific domain, prefer building or reusing a
  fixture in that exact domain over reusing a fixture from a different, merely mechanism-equivalent domain, even
  when the underlying code is confirmed domain-agnostic, since the whole point of a domain-specific journey ID is
  to catch a domain-specific regression a shared-code argument cannot rule out by construction. This is recorded
  here rather than acted on further tonight, given the number of journeys involved and the time this would take
  to fully close.
- No new product-facing behavior, entity, permission, or state transition was discovered this batch beyond what
  M-008's revalidation already confirms (the three-condition classifier boundary holds in its own canonical
  domain).

### Second continuation run (2026-09-22): methodology correction, not a product finding

- **EXPAND EXISTING JOURNEY-EXECUTION METHODOLOGY**: J-022's Authorization Variant was first attempted by calling
  `approve_go_live_request` directly with an actor holding zero `go_live` permissions, expecting rejection. It
  unexpectedly succeeded. Root cause: every governed approve/submit/create RPC in this codebase is granted to
  `service_role` only (`revoke all ... from public, anon, authenticated`), reachable exclusively through its
  Server Action, which calls `requirePermission(...)` before invoking the RPC (confirmed for go_live in
  `src/features/go-live/actions.ts:101`). Calling the RPC directly via this audit's Supabase MCP tooling uses a
  service-role connection, the same credential level the Server Action itself holds after it has already checked
  permission, so a raw negative-permission RPC call does not reproduce what a real unauthorized user's request
  would experience. **This is not a Nexus product defect**: the RPC's own doc comment already documents the
  intended design (`fn_require_workflow_team_membership`: "never used to grant a permission, only to narrow which
  already-permitted actor may act"), and the real, deployed path is correctly gated. It is a standing correction
  to this audit program's own methodology: any future *negative* authorization-variant test must be evidenced by
  citing the Server Action's `requirePermission` call (or, where available, a real authenticated session), never
  by a raw RPC call with an unauthorized actor, since the RPC layer has no independent permission check by
  design. This does not retroactively invalidate any *positive*-path RPC evidence gathered anywhere in this
  program, since those calls only ever simulate "permission already granted by the Server Action," which is
  exactly what the real system does before reaching the RPC.
- Building the two new workflow graphs this run (a genuine, real use of the Workflow Builder's own governed RPC
  chain, not a database backdoor) is itself a data point: it confirms the sanctioned swap-in-swap-out pattern
  used since J-004/J-006 scales cleanly to authoring an entirely new graph shape, not just reusing a dormant one,
  when no existing graph (active or historical) has the shape a journey's canonical definition requires. No
  change to product code was needed to make this possible.

**Conclusion: this run closed 6 of the remaining 12 P1/P2/P3 residuals (J-022, J-027, J-028, J-029, M-007, M-009)
with real, fresh, in-domain evidence, by constructing the two workflow graphs the product itself had never had a
live use case for. M-006 remains honestly STILL OPEN (executable, not attempted, time budget). J-019, M-002,
M-004, M-012, and J-023 remain at their original grade B. One methodology correction was made (raw RPC calls
cannot evidence a negative authorization variant); zero product defects were found this run.**
