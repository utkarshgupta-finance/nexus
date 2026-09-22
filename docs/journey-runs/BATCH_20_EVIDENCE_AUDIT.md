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

### Batch 20 residual closure summary (this run)

| Priority | Journey | Status after this run |
| --- | --- | --- |
| P0 | J-021 | **Closed** |
| P0 | J-024 | Strengthened, not fully closed (honestly recorded) |
| P0 | J-026 | Unchanged; structurally hard to close via this session's tooling (honestly recorded) |
| P0 | J-030 | **Closed** |
| P0 | M-005 | **Closed** |
| P1 | J-027, J-028, M-006, M-007, M-009 | Not addressed this run; original grade B stands |
| P2 | J-019, J-022, J-029, M-002, M-004, M-012 | Not addressed this run; original grade B stands |
| P3 | J-023 | Not addressed this run; original grade B stands |

**Evidence integrity (final, this run): PASS WITH RESIDUAL GAPS.** 3 of 5 P0 items fully closed; 1 strengthened;
1 honestly left open due to a structural tooling limitation (genuine concurrent RPC calls cannot be produced by
this session's sequential tool interface). All 12 P1/P2/P3 items remain at their original grade B, explicitly
not silently closed.

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

**Conclusion: one journey (M-008) genuinely revalidated in its own domain, confirming the domain-agnostic-code
reasoning empirically for the one P0-flagged case. No new defects found this batch. A large, honestly-recorded
set of domain-mismatch and missing-fixture residual gaps remains open across roughly 18 of 25 journeys; none of
them contradict any live evidence gathered so far, and the shared, domain-agnostic implementation substantially
(not completely) mitigates the risk each carries.**
