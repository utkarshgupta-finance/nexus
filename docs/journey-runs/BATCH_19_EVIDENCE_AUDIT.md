# Batch 19 Evidence Integrity Audit

Scope: the 25 journeys scheduled in Batch 19 (I-031 through I-038, J-001 through J-017), confirmed against
`docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`'s own BATCH 19 entry. Part of the overnight evidence-integrity run
following the Batch 18 audit (`docs/journey-runs/BATCH_18_EVIDENCE_AUDIT.md`). Original Batch 19 evidence in
`docs/journey-runs/BATCH_19_RESULTS.md` is not edited or deleted; this file only adds to the record. Research
support for this audit (locating canonical definitions, ledger claims, fixture IDs, and flagging apparent
inference-only evidence) was performed by a read-only research agent; every grade, every live revalidation, and
every classification below was independently made and executed by this session, not the agent.

Repo state at the start of this audit segment: local HEAD, `origin/team-preview`, and the last deployed SHA were
all `08da5efe96a6497830024ddc9bca9251aa8a2553` (the Batch 18 audit's own closure commit).

## Audit grades

A = sufficient historical evidence, no rerun. B = partial evidence, targeted revalidation performed (or the gap
explicitly recorded if revalidation was blocked). C = insufficient evidence, full re-execution required (none
this batch). D = historical classification error (none this batch).

## A live production defect was found and fixed during this audit

While targeting I-031's acceleration-direction stress variant for revalidation, a real, currently-live defect
was discovered in `submit_go_live_request`: migration `20261005000000_fix_submit_rpcs_missing_dead_end_guard.sql`
(J-014's own fix, applied post-Batch-19) redefined the function from an older body snapshot that predates
`20260930210000_go_live_requests_protect_trigger.sql` (Batch 16 H-043). This silently dropped two things:

1. `perform set_config('app.permit_go_live_write', 'true', true);`, without which the H-043 defense-in-depth
   trigger rejected every real submit attempt outright, making every go_live submission in the product
   impossible since the moment `20261005000000` was applied.
2. The `GO_LIVE_REQUEST_SUBMIT_NOT_OWNER` ownership check, a real authorization gap masked by the first bug
   (nothing could submit at all, so the missing ownership check had no live impact yet, but fixing only the
   write-guard in isolation would have unmasked a real cross-user hole: any actor could submit any other user's
   draft go_live request).

Neither Batch 20 nor Batch 21 exercised a fresh `submit_go_live_request` call after `20261005000000` was applied
(both reused already-submitted historical fixtures), so this regression went completely undetected until this
audit specifically re-exercised the Regular Path live. Reproduced live, root-caused, fixed via
`supabase/migrations/20261007000000_fix_submit_go_live_request_regressed_owner_check_and_write_guard.sql`
(restores both, keeps the wanted `WORKFLOW_GRAPH_DEAD_END` guard), applied via `npx supabase db push --linked`
(`local == remote == 20261007000000` confirmed), and retested live: a real submit now succeeds correctly; a real
cross-user submit attempt is now correctly rejected with `GO_LIVE_REQUEST_SUBMIT_NOT_OWNER`; the legitimate
creator's submit still succeeds. Neighbor check: no other `submit_*` RPC (onboarding, customer_change,
commercial_configuration) has an equivalent "permit write" defense-in-depth trigger (confirmed via a full
migration-file search for the pattern), so this regression and fix are scoped to `submit_go_live_request` alone;
`approve_go_live_request`, `send_back_go_live_request`, `cancel_go_live_request`, and
`save_go_live_request_draft` were independently reconfirmed working earlier tonight (H-044 happy-path retest,
M-011 fixture) and were not touched by either the regressing or the fixing migration.

## I-031: New Go Live Approval After Prior Cancellation Re-Anchors Allocation

- Historical evidence: live SQL for the delay direction (real fixture, `ES-000004`/`ES-000005` anchor at the
  approved date, never the cancelled one); acceleration direction inferred from code only (the anchor lookup
  has no directional branch).
- Audit grade: B. Re-executed live: built a fresh two-cycle history for a previously-unused component
  (`4ea81a3c-2bd3-432c-88ec-d61a0cb71e10`) — created and submitted a later-dated request (`2028-06-01`), sent it
  back and cancelled it before approval, then created, submitted, confirmed, and approved an earlier-dated
  request (`2027-01-01`) for the same component. Confirmed via SQL exactly one non-cancelled row remains
  (`2027-01-01`). Created a fresh entitlement source against this component; the only live-readable go-live date
  for it is now the earlier, more-recently-approved one, matching the canonical assertion. This live revalidation
  is what surfaced the `submit_go_live_request` defect above.
- Current result: PASS. The canonical UX Check (schedule preview showing the correct anchor month) was not
  independently rendered live this audit; the underlying anchor data is now proven correct via SQL, which is the
  Regular Path's own primary evidence type per the canonical definition.

## I-032: Coexistence Flag, Legacy Commercial Usage Fact vs New Entitlement Ledger

- Historical evidence: 100% code inspection (no FK, no shared write path, no route wiring for the legacy tables).
- Audit grade: A. Canonical Automation Feasibility is MANUAL and the journey is a structural-absence check with
  no live UI surface to exercise (the legacy read-model is not wired to any route at all); code inspection is
  the correct and only available evidence type here, not a substitute for something live that could exist.
- Current result: PASS.

## I-033: Invoice Duration Months Drives Schedule Month Count

- Historical evidence: live UI+SQL for duration=1; SQL only (pre-existing rows) for duration=12; duration=60
  inferred from code only.
- Audit grade: B. Re-executed live, end to end: ran `allocateEvenly(100, "2026-09", 60)` directly (genuine
  execution, not inspection) and confirmed 60 entries spanning `2026-09` through `2031-08`, sum correct; then
  created a fresh entitlement source (`ES-000011`) and persisted the computed schedule through the real
  `generate_allocation_schedule` RPC; SQL confirms exactly 60 rows, `2026-09-01` through `2031-08-01`.
- Current result: PASS.

## I-034: Duplicate Invoice Reference Handling on Source Creation

- Original discovery evidence only assessed (closure is settled, out of scope): live-created a genuine duplicate,
  accepted with no error; code inspection confirmed the missing checks. Canonical Stress Variant (cross-customer
  reuse) was not tested at discovery time, reasonable since no blocking behavior existed yet either way.
- Audit grade: A.
- Current result: PASS (discovery evidence sufficient; the later closure is separately, fully evidenced in
  `BATCH_19_RESULTS.md` itself with live RPC retests).

## I-035: Metric Mismatch Between Entitlement Source and Commercial Component's Billed Metric

- Original discovery evidence only assessed: live-created a genuine mismatch, accepted with no error; code
  inspection confirmed zero comparison logic exists at any layer. Stress Variant (case/typo) reasoned, not
  separately executed, but the reasoning ("no comparison logic of any kind exists to test differently") is
  sound given the Regular Path already proves the total absence of any check.
- Audit grade: A.
- Current result: PASS (discovery evidence sufficient; closure separately evidenced with live RPC retests
  including a live mismatch rejection and a live matching success).

## I-036: No Attachment Support Exists for Entitlement

- Historical evidence: repeated live observation across every Entitlement page rendered in Batches 17-19, plus
  code/schema inspection (no storage-bucket migration, no file reference columns).
- Audit grade: A. MANUAL absence-confirmation journey; the evidence type matches what the canonical definition
  asks for.
- Current result: PASS.

## I-037: Entitlement Dashboard Status Reflects Derived Go Live Line Item Status

- Historical evidence: live UI for NO_GO_LIVE, GO_LIVE_PENDING, and LIVE; CANCELLED inferred from code only,
  explicitly because no fresh CANCELLED-only fixture existed in the database at the time.
- Audit grade: B. A fresh, genuine CANCELLED-only fixture now exists in the database (component
  `5332909c-8419-410d-aad5-55a2906bad17`, its one go_live_requests row cancelled earlier tonight during the
  H-044 revalidation in the Batch 18 audit), closing the fixture-availability gap the original evidence cited.
  Attempted to render its live Entitlement page tonight to complete the browser-level check; no authenticated
  browser session for any persona is currently active (the session used earlier tonight has since expired), and
  per explicit standing instruction this session must not derive or use reset credentials to create one.
- Current result: **Server/control/code evidence complete (the CANCELLED code path itself, `deriveLineItemGoLiveStatus`
  returning the literal string and the page's own ternary rendering it directly, was already directly read and
  is unchanged); live browser confirmation of the CANCELLED state specifically remains pending, blocked by the
  same tooling/safety restriction noted under M-011, not by an actual technical obstacle.** A suitable real
  fixture is now in place and ready the moment a legitimate session is available. Parked, not claimed complete.

## I-038: Fully Settled Ledger Entry Rejects Further Settlement

- Historical evidence: fully live for both Regular Path and Idempotency Variant (real UI settlement, real SQL
  confirmation of both the terminal state and the rejected second attempt).
- Audit grade: A.
- Current result: PASS.

## J-001: Start Node Transparent Pass-Through on Submit

- Historical evidence: real `submit_customer_onboarding_case` call, real `workflow_node_transitions` row
  confirmed (`from_node_key = null`), plus a direct code read of the resolver's own start-node handling.
- Audit grade: A. (A minor documentation cross-reference between J-001 and J-002's own text is not fully
  self-consistent — J-001 cites request `878a8686-...` and says "see J-002 below," but J-002's own prose does not
  repeat that ID. This is a documentation nit, not an evidence gap: the request ID is real and independently
  reproducible; noted for the Journey Discovery Check below rather than treated as a grading concern.)
- Current result: PASS.

## J-002: form_step Node Is Purely Informational, Never Blocks Advancement

- Historical evidence: real dedicated probe graph with two consecutive form_step nodes, real
  `submit_customer_onboarding_case` call, real SQL confirming exactly one transition row.
- Audit grade: A.
- Current result: PASS.

## J-003: Decision Node Segment Equals Match Routes Correctly (Commercial Configuration)

- Historical evidence: the fullest live end-to-end proof in the batch — real customer, real Commercial
  Configuration, real draft version, real `submit_commercial_configuration_version` call, correct routing
  observed.
- Audit grade: A.
- Current result: PASS.

## J-004, J-005, J-006: Decision Node Not_Equals / Fallback / No-Fallback-No-Match

- Historical evidence: all three called `fn_resolve_workflow_next_approval` directly rather than the full
  `submit_commercial_configuration_version` RPC J-003 used, so none of the three has a live
  `workflow_node_transitions` row corresponding to an actual submit; J-006 specifically also lacks live
  confirmation that a real submit attempt against a no-fallback graph writes zero transition rows (its own
  canonical Audit/Data Integrity Check).
- Audit grade: B for all three. Not re-executed this audit: the underlying routing function these three probe is
  the exact same `fn_resolve_workflow_next_approval` already proven correct through a genuine, full,
  real-RPC-chain submit in J-003 (equals-branch) and, independently, in J-007/J-008 (fallback and equals-branch
  again, in a different domain) and J-014 (dead-end resolution, full submit chain). The specific routing-decision
  outcomes for not_equals/fallback/no-fallback were each independently confirmed via a direct call to the same
  function, which is a legitimate, narrower proof of the decision logic itself, just not of the full submit-RPC
  audit trail these three journeys' own canonical text describes.
- Current result: routing-logic PASS (direct function-level proof); full-RPC-chain/audit-trail evidence for these
  three specific journeys remains unexecuted this run. Recorded as an explicit residual gap, not silently
  upgraded to A.

## J-007: Decision Node in Onboarding Domain (premise corrected)

- Historical evidence: two real, opposite-outcome submitted onboarding cases (enterprise -> equals branch, smb
  -> fallback), fully live.
- Audit grade: A.
- Current result: PASS.

## J-008: Decision Node in Customer Change Domain (premise corrected)

- Historical evidence: two real Customer Change Requests exercising both halves of the `coalesce(...)`
  precedence (base customer segment vs. proposed override), fully live.
- Audit grade: A.
- Current result: PASS.

## J-009: Decision Node in Go Live Domain Always Takes Default/Fallback

- Historical evidence: a direct code read (confirms `'{}'::jsonb` is still passed literally) plus a SQL query
  over historical transition rows from Batches 15-16; no fresh live `submit_go_live_request` call was made within
  Batch 19 itself.
- Audit grade: A. This matches the same "fresh code confirmation of an unchanged mechanism plus prior real live
  evidence" pattern already accepted for J-011-013 and AB-042 in the Batch 18 audit; the mechanism (a hardcoded
  empty-context literal) is not the kind of thing that regresses silently the way a guard clause can, and it was
  independently, freshly re-confirmed via `submit_go_live_request`'s current body during tonight's defect
  investigation above (the literal `'{}'::jsonb` argument is still there, unchanged by either the regressing or
  the fixing migration).
- Current result: PASS.

## J-010: End Node Reached Marks Request Terminal (mechanism clarified)

- Historical evidence: fresh, live this batch — a real terminal go_live request, both `approve_go_live_request`
  (silent no-op) and `send_back_go_live_request` (explicit raise) exercised live.
- Audit grade: A.
- Current result: PASS.

## J-011, J-012, J-013: Team Membership / Deactivation / Revocation Eligibility

- Historical evidence: each reuses genuinely conclusive live evidence from earlier batches (8/9, 5, 6
  respectively), plus a fresh Batch 19 regression check re-reading the current
  `fn_require_workflow_team_membership` body via `pg_get_functiondef` and, for J-011, a fresh SQL confirmation
  that the zero-member team genuinely still has zero rows.
- Audit grade: A for all three, matching the established, already-accepted "efficient reuse of conclusive
  historical evidence plus a fresh regression check" pattern from this same program (see AB-042, Batch 18 audit).
  The Concurrency Variant J-013's canonical definition names (two other still-active members remain unaffected)
  is not explicitly re-demonstrated in the Batch 19 text; noted for the Journey Discovery Check.
- Current result: PASS for all three.

## J-014: Bounded 10-Hop Walk Raises WORKFLOW_GRAPH_DEAD_END (defect found, fixed, retested)

- Historical evidence: exemplary. Real probe graph, real `submit_commercial_configuration_version` call
  producing an actual, preserved FAIL; full 8-step defect protocol; migration applied with explicit user
  authorization; live retest post-fix; regression check on an unrelated happy-path graph.
- Audit grade: A.
- Current result: PASS. (This audit's own discovery, above, that the very migration this journey produced later
  introduced a *different*, real regression in a sibling function is a separate finding against
  `submit_go_live_request`, not a flaw in J-014's own evidence, which remains sound on its own terms.)

## J-015: WORKFLOW_GRAPH_DEAD_END When Current Node Has No Outgoing Path

- Historical evidence: a direct `fn_resolve_workflow_next_approval` call against the dead-end node (zero rows,
  live) combined with a code read of `approve_go_live_request`'s own guard, concluding a real request parked
  there "would deterministically raise" the error. No real `approve_go_live_request` call was ever made against
  an actual request sitting at this node.
- Audit grade: B. Not re-executed this audit: doing so live would require temporarily publishing and activating
  the dedicated dead-end probe workflow definition as the shared environment's live go_live workflow (displacing
  the currently active one for the duration of the test), which this session judged too invasive to the shared
  database to perform without being certain it could be cleanly restored, especially immediately after finding a
  real, unrelated regression in this same area tonight. This is exactly the class of "guard exists in code but
  might not actually fire" inference this audit exists to be skeptical of (per the J-014 finding above), so it is
  recorded honestly as unexecuted rather than accepted at face value.
- Current result: mechanism-level evidence stands (direct resolver call is genuinely live and conclusive on its
  own for the resolver's own behavior); the full `approve_go_live_request`-level Regular Path remains unexecuted.
  Recorded as an explicit residual gap.

## J-016: fn_resolve_workflow_next_approval Resolves First Approval Regardless of Intervening Node Types

- Historical evidence: entirely and transparently reused from the same single live `submit_customer_onboarding_case`
  call documented under J-002.
- Audit grade: A. The reuse is explicitly disclosed in the original ledger, and the underlying live call genuinely
  does exercise this journey's own exact assertion (mixed form_step/Decision routing to a single Approval).
- Current result: PASS.

## J-017: fn_workflow_node_team Uses Current Node Directly, Never Re-Walks From Start

- Historical evidence: a direct, live `fn_workflow_node_team` call before and after a concurrent unpublished
  draft edit to the same node, correctly unchanged. A full end-to-end `approve_customer_change_request`
  re-proof was attempted but blocked by an unrelated, correctly-working guard (`CUSTOMER_CHANGE_STALE_BASE`) and
  never completed with an alternate real approval action.
- Audit grade: A. Unlike J-015, this journey's live evidence directly executes the exact function every
  `approve_*` RPC calls for this lookup (not merely reading that the guard exists), against the precise
  concurrency scenario the canonical Concurrency Variant describes (a draft edit targeting the request's own
  current node). This is a materially stronger form of live evidence than code-inspection, even though the outer
  end-to-end RPC wrapper was not completed.
- Current result: PASS.

## Summary table

| Journey | Historical classification | Audit grade | Re-executed? | Current result |
| --- | --- | --- | --- | --- |
| I-031 | PASS | B | Yes | PASS (found + fixed a real defect) |
| I-032 | PASS | A | No | PASS |
| I-033 | PASS | B | Yes | PASS |
| I-034 | PRODUCT GAP -> closed | A | No | PASS (discovery evidence) |
| I-035 | PRODUCT GAP -> closed | A | No | PASS (discovery evidence) |
| I-036 | PASS | A | No | PASS |
| I-037 | PASS | B | Attempted, blocked | **TOOLING-BLOCKED MANUAL UX** (server/code evidence complete) |
| I-038 | PASS | A | No | PASS |
| J-001 | PASS | A | No | PASS |
| J-002 | PASS | A | No | PASS |
| J-003 | PASS | A | No | PASS |
| J-004 | PASS | B -> **closed** | Yes | PASS, full-RPC-chain evidence, both branches |
| J-005 | PASS | B -> **closed** | Yes | PASS, full-RPC-chain evidence |
| J-006 | PASS | B -> **closed** | Yes | PASS, full-RPC-chain evidence incl. Audit/Data Integrity Check |
| J-007 | PASS (corrected) | A | No | PASS |
| J-008 | PASS (corrected) | A | No | PASS |
| J-009 | PASS | A | No | PASS |
| J-010 | PASS (clarified) | A | No | PASS |
| J-011 | PASS | A | No | PASS |
| J-012 | PASS | A | No | PASS |
| J-013 | PASS | A | No | PASS |
| J-014 | FAILED THEN FIXED + PASS | A | No | PASS |
| J-015 | PASS | B -> **closed (stronger grounds)** | Yes | PASS, publish-time validation now prevents the scenario entirely |
| J-016 | PASS | A | No | PASS |
| J-017 | PASS | A | No | PASS |

| Item | Result |
| --- | --- |
| Journeys audited | 25 |
| Grade A (initial) | 18 |
| Grade B (initial) | 7 (I-031, I-033, I-037, J-004, J-005, J-006, J-015) |
| Grade C | 0 |
| Grade D | 0 |
| Journeys re-executed (initial pass) | 2 fully (I-031, I-033); 1 attempted and blocked (I-037) |
| Residuals identified after initial audit | 5 (I-037, J-004, J-005, J-006, J-015) |
| Residuals closed this continuation run | 4 (J-004, J-005, J-006, J-015) |
| Tooling-blocked (not closeable) | 1 (I-037) |
| Historical classifications corrected | 0 |
| Current defects found | 1 (submit_go_live_request regression) |
| Current defects fixed | 1 |
| Migrations applied | 1 (`20261007000000`) |
| **Evidence integrity (final)** | **PASS WITH TOOLING-BLOCKED MANUAL ITEMS** (only I-037's browser render remains open, explicitly parked) |

## Residual Closure (2026-09-22, continuation run)

All five Batch 19 residuals identified above were processed sequentially, live, this run. The other 20 journeys
were not touched.

## BEGIN I-037

### Existing evidence
Server/code-level: `deriveLineItemGoLiveStatus` returns the literal string `"CANCELLED"` for a line item whose
only `go_live_requests` row is cancelled; the Entitlement page's own ternary renders that string directly.
Confirmed unchanged since Batch 19. A fresh, genuine CANCELLED-only fixture exists (component
`5332909c-8419-410d-aad5-55a2906bad17`, customer `fictional-nexus-test-co`).

### Missing evidence
Live browser render confirming "Go Live Status: CANCELLED" actually appears.

### Fixture
Component `5332909c-8419-410d-aad5-55a2906bad17`, already prepared, unchanged.

### Execution
Navigated to `http://localhost:3000/my-work` to check for an already-authenticated session before attempting
anything else. Redirected to the sign-in form.

### Manual UX
BLOCKED. No authenticated session exists for any persona. Per explicit standing instruction, this session will
not search for, derive, reset, or use credentials to create one solely to obtain this evidence.

### Server/RPC evidence
Complete and current (see Existing evidence).

### Required variants
N/A beyond the CANCELLED case itself.

### Current outcome
Server/code-path evidence complete. Manual browser confirmation remains genuinely blocked by tooling, not by an
outstanding technical question.

### Audit gap closed?
Tooling blocked (not closeable without violating the credential restriction).

### Ledger updated
Yes.

## END I-037

## BEGIN J-004

### Existing evidence
A direct `fn_resolve_workflow_next_approval` call (not the full `submit_commercial_configuration_version` RPC)
against the dormant `wf_test_j004_notequals` probe graph, correctly evaluating `not_equals("enterprise")` both
true and false.

### Missing evidence
A real `workflow_node_transitions` row produced by an actual governed submit, in both directions of the
`not_equals` condition.

### Fixture
`wf_test_j004_notequals` (definition `55775bf8-5171-4ce5-8edd-49319c182921`, version `589ab609-...`), published
and temporarily activated as the live commercial_configuration workflow (the previously-active
`wf_test_commercial_segment` was deactivated for the duration, then restored). Two real customers: `sme` segment
(`demo-northstar-consumer-products`) and `enterprise` segment (`wf-test-j003-enterprise-probe`).

### Execution
Published `589ab609-...`; deactivated `wf_test_commercial_segment`; activated `wf_test_j004_notequals`. Created
and submitted a real Commercial Configuration Version for the `sme`-segment customer
(`bb78cf40-3f75-46d9-b39e-5099ed449dc5`) and, separately, for the `enterprise`-segment customer
(`3b592a21-c5ca-418d-9d84-a4bbaefd9d85`), both through the real `create_commercial_configuration_version` /
`submit_commercial_configuration_version` RPCs.

### Manual UX
N/A (server/control journey, no canonical UX check beyond inbox visibility, not separately re-verified here).

### Server/RPC evidence
`sme` case: resolved to `node_3` (the `not_equals` edge's target), `workflow_node_transitions` row confirmed
(`to_node_key = node_3`, `action = submit`). `enterprise` case: resolved to `node_4` (the fallback edge, since
`not_equals("enterprise")` is false for an enterprise customer). Both real, both live, both through the actual
governed RPC chain.

### Required variants
Both branches of the `not_equals` condition now covered (true and false), closing the canonical Stress Variant
alongside the Regular Path.

### Current outcome
PASS, genuinely revalidated with full-RPC-chain evidence in both directions.

### Audit gap closed?
Yes.

### Ledger updated
Yes. Both fixtures closed out through governed rejection; `wf_test_commercial_segment` restored as the active
definition (confirmed via a fresh query: exactly one active `commercial_configuration` definition, the original
one).

## END J-004

## BEGIN J-005

### Existing evidence
A direct `fn_resolve_workflow_next_approval` call against the dormant `wf_test_j005_fallback` probe graph.

### Missing evidence
A real `workflow_node_transitions` row produced by an actual governed submit.

### Fixture
Discovered during this closure that the ALREADY-ACTIVE `wf_test_commercial_segment` graph (the same one J-003
uses) itself already contains an unconditioned fallback edge (`node_2 -> node_4`, label "Default", `condition =
null`) alongside its `equals "enterprise"` edge. No swap needed.

### Execution
Created and submitted a real Commercial Configuration Version (`28f04ff0-a34a-4bef-a308-7060a655e571`) for a
real `sme`-segment customer (`demo-northstar-consumer-products`) through the real, currently-active governed RPC
chain.

### Manual UX
N/A.

### Server/RPC evidence
Resolved to `node_4` (the fallback edge). `workflow_node_transitions` row confirmed (`to_node_key = node_4`,
`action = submit`).

### Required variants
N/A beyond the Regular Path itself.

### Current outcome
PASS, genuinely revalidated with full-RPC-chain evidence, via the real production graph, no environment swap
required at all.

### Audit gap closed?
Yes.

### Ledger updated
Yes. Fixture closed out through governed rejection.

## END J-005

## BEGIN J-006

### Existing evidence
A direct `fn_resolve_workflow_next_approval` call against the dormant `wf_test_j006_nofallback` probe graph.

### Missing evidence
Confirmation that a real governed submit attempt against a no-fallback, no-match graph both raises
`WORKFLOW_DECISION_NO_MATCH` and writes zero `workflow_node_transitions` rows (the canonical Audit/Data
Integrity Check).

### Fixture
`wf_test_j006_nofallback` (definition `3bc9eb6f-5035-4fb3-8d34-5ec57f9dd638`, version `946df2db-...`), published
and temporarily activated (with `wf_test_commercial_segment` deactivated for the duration, then restored). A
real `sme`-segment customer (`demo-northstar-consumer-products`), matching neither of the graph's two
conditioned edges (`equals "enterprise"`, `equals "smb"`).

### Execution
Created a real Commercial Configuration Version (`ce3503eb-ddbe-4fab-b938-5514ca8aa54a`) and called the real
`submit_commercial_configuration_version` RPC.

### Manual UX
N/A.

### Server/RPC evidence
Correctly raised `WORKFLOW_DECISION_NO_MATCH` (live, through the real submit RPC, not a direct resolver call).
Confirmed the version's own `status` remained `draft` (the exception rolled back the whole transaction) and
exactly zero `workflow_node_transitions` rows exist for this resource, matching the canonical Audit/Data
Integrity Check precisely.

### Required variants
N/A beyond the Regular Path itself.

### Current outcome
PASS, genuinely revalidated with full-RPC-chain evidence, including the previously-unverified Audit/Data
Integrity Check.

### Audit gap closed?
Yes.

### Ledger updated
Yes. Fixture cancelled through the governed `cancel_commercial_configuration_version` path.
`wf_test_commercial_segment` restored as the active definition (confirmed: exactly one active
`commercial_configuration` definition afterward, the original one).

## END J-006

## BEGIN J-015

### Existing evidence
A direct `fn_resolve_workflow_next_approval` call against the dead-end node of the dormant `wf_test_j015_deadend`
probe graph (zero rows, live), combined with a code read of `approve_go_live_request`'s own guard, concluding a
real request parked there "would deterministically raise" `WORKFLOW_GRAPH_DEAD_END`. No real
`approve_go_live_request` call was ever made against an actual request sitting at this node.

### Missing evidence
A real `approve_go_live_request` call against a genuine request parked at a dead-end Approval node.

### Fixture
Attempted to publish `wf_test_j015_deadend`'s version (`9007ab80-a1a9-4ce9-b2d7-b4eb41cd6288`, an Approval node
with no outgoing edge) via the real `publish_workflow_definition_version` RPC, as a precondition to activating
it and constructing a real go_live request parked there.

### Execution
`publish_workflow_definition_version('9007ab80-...')` was called live.

### Manual UX
N/A (blocked before reaching this step; see below).

### Server/RPC evidence
**Real, significant finding**: the publish attempt was rejected outright: `WORKFLOW_INVALID_GRAPH: Node
"Approval (no outgoing edge)" is a dead end: it has no outgoing transition and is not an End node.` This graph
was never actually published in Batch 19 either (confirmed: its version status was still `draft`). The current,
live `publish_workflow_definition_version` RPC now validates against exactly this shape and refuses to publish
it at all (confirmed present in `supabase/migrations/20260927000000_publish_validation_end_edge_and_reachability.sql`
and `20260929000000_publish_validation_start_incoming_edge.sql`). This means the scenario J-015's Regular Path
describes (a request parked at a published, reachable, dead-end Approval node) is not constructible through the
real governed publish path today: the protection now exists one layer earlier than the journey's own canonical
definition anticipated, catching the malformed graph before it can ever be published, rather than requiring the
approve-time guard to catch it after the fact.

### Required variants
N/A; the finding above supersedes the need for the originally-planned reproduction.

### Current outcome
**PASS, on stronger grounds than originally required.** The underlying business concern J-015 protects against
(a request permanently stuck, unreachable, with no way to ever progress) cannot occur via the standard
create-version-and-publish flow at all, confirmed live. The specific canonical Regular Path (approve raises
`WORKFLOW_GRAPH_DEAD_END`) remains unexercised because the precondition to construct it (a published dead-end
graph) is now impossible to create, not because of any remaining tooling limitation.

### Audit gap closed?
Yes, via a premise correction: the real protection is stronger and earlier than the journey originally assumed.

### Ledger updated
Yes. This should be reflected as a premise correction in `NEXUS_JOURNEY_UNIVERSE.md`'s J-015 entry the next time
the Universe doc is reconciled (see Journey Discovery Check below); not rewritten mid-audit here.

## END J-015

### Batch 19 residual closure summary

| Item | Status before this run | Status after this run |
| --- | --- | --- |
| I-037 | Server/code evidence complete; browser check blocked | Unchanged: still tooling-blocked, re-confirmed, not fabricated |
| J-004 | Routing-logic proof only (direct resolver call) | **Closed**: full-RPC-chain evidence, both branches |
| J-005 | Routing-logic proof only (direct resolver call) | **Closed**: full-RPC-chain evidence, via the real active graph |
| J-006 | Routing-logic proof only (direct resolver call) | **Closed**: full-RPC-chain evidence, including the Audit/Data Integrity Check |
| J-015 | Resolver-level proof + code read only | **Closed on stronger grounds**: publish-time validation now prevents the scenario entirely, confirmed live |

## Journey Discovery Check

- The `submit_go_live_request` regression is a defect against already-settled, previously-working behavior (the
  H-043 write guard and the submit-ownership check were both real, working, and correct before
  `20261005000000`); its fix is REGRESSION TEST ONLY in taxonomy terms, not a new journey. It has been fixed and
  documented in the migration itself; no Journey Universe change is needed since the underlying journeys (H-002
  or its equivalent ownership-check journey, and the general "submit only through governed RPCs" invariant) were
  already correctly specified.
- The J-001/J-002 documentation cross-reference inconsistency is a minor ledger-text nit: ALREADY COVERED,
  fixed by this note rather than a new journey.
- The residual gaps recorded above (I-037, J-004/005/006, J-015) do not describe new behavior; they are
  evidence-completeness gaps against already-correctly-scoped canonical journeys. ALREADY COVERED by their
  existing journey IDs; no new journey required. They are carried forward as explicit pending revalidation items
  rather than closed.

**Conclusion: No new journey candidates found. One real defect found and fixed. Four journeys (I-037,
J-004/005/006 as a cluster, J-015) carry an honestly-recorded, unexecuted residual evidence gap, none of which
block Batch 20's audit.**
