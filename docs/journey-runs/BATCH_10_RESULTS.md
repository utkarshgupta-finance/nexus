# Batch 10 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY VALIDATION, autonomous overnight run, BATCH 10 (C-009 through C-033, 25 journeys total). Part of the six-batch overnight run (Batches 8-13, 150 journeys scheduled). Created before execution begins per the mandatory persistent ledger requirement; updated as each journey completes. Autonomous run: Utkarsh is unavailable for interactive confirmation. See `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md` for anything parked pending his return.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED / BLOCKED PENDING USER APPROVAL / BLOCKED BY UPSTREAM APPROVAL / PRODUCT GAP CONFIRMED / PRODUCT DECISION REQUIRED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

## Batch 10 entry gate

- Batch 9 confirmed complete (`docs/journey-runs/BATCH_09_RESULTS.md`): 25/25 resolved, pushed to `team-preview` at `bae1535`.
- Fixtures carried forward: customer_id `120d8347-e16f-4a01-937b-97c3acea9394` ("Batch8 Approval Core Co", row_version 13, active), a real Customer Change Request R1 (`af320504-4326-4817-8272-f4cb81d16591`) still `submitted` at its Finance Approval node (segment/business_unit change, deliberately left mid-flight after being correctly rejected once for base-customer staleness), the disposable customer `4570bc11-6752-4380-a939-f3efc0b152a7` with one genuine approved Customer Change and zero commercial configurations, and `wf-test.leadership-approver` now also an active member of `ux_verification_team` (Finance Approval node) in addition to `wf_test_leadership`.
- Environment fix from Batch 9 remains in effect: the live `customer_change` workflow's Finance Approval node now has an eligible approver, so real end-to-end Customer Change approval chains can continue to be tested.
- No new fixture gaps identified for Batch 10 at entry; C-025's "zero eligible approver" scenario will reuse the existing `wf_test_empty` team fixture from Batch 8 rather than the (now-fixed) `ux_verification_team`.

---

## C-019: Self-approval blocked

- Journey ID: C-019
- Priority: P0
- Automation Feasibility: FULL
- Test Data: R1 (submitted, Finance node), created by `wf-test.maker`.
- Actions Executed: `wf-test.maker` attempted `approve_customer_change_request` on their own request.
- Actual Result: rejected with `SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.`
- Final Status: PASS
- Notes: same segregation-of-duties guarantee as A-012, confirmed consistently applied to Customer Change.

---

## C-016: Send back requires non-empty reason

- Journey ID: C-016
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: `send_back_customer_change_request` with a whitespace-only reason.
- Actual Result: rejected with `CUSTOMER_CHANGE_SEND_BACK_REASON_REQUIRED: a reason is required to send this request back`. Whitespace-only correctly treated as empty (server trims before checking), not accepted as valid.
- Final Status: PASS

---

## C-012: Send back with reason

- Journey ID: C-012
- Priority: P0
- Automation Feasibility: FULL
- Test Data: R1.
- Actions Executed: `send_back_customer_change_request` with a real reason as `wf-test.leadership-approver` (the Finance node's approver, not the creator).
- Actual Result: status transitioned to `sent_back`.
- Final Status: PASS

---

## C-013: Resubmit after send back

- Journey ID: C-013
- Priority: P0
- Automation Feasibility: FULL
- Test Data: R1, re-saved and resubmitted.
- Actions Executed: maker edited the draft, called `submit_customer_change_request` again.
- Actual Result: status transitioned to `resubmitted`. The prior send-back reason remained queryable in `customer_change_send_backs`, preserved historically alongside the new submission.
- Final Status: PASS

---

## C-017 / C-020 / C-031: Approve happy path writes field history per changed field; idempotent re-approval; name change approved without evidence

- Journey ID: C-017, C-020, C-031 (combined, since C-020 and C-031 both naturally extend C-017's same request)
- Priority: P0
- Automation Feasibility: FULL
- Test Data: a fresh request (R1 turned out to be permanently stale after an earlier intervening approval in Batch 9 advanced the shared customer's row_version past R1's captured base; see the dedicated finding below. A new request, R7, was created against the customer's then-current row_version instead) proposing three genuinely-differing fields (`name`, `state`, `city`), including a Legal Entity Name change.
- Actions Executed: full 3-node approval (Finance, Legal, Leadership) as three distinct real approvers; then a redundant re-approval retry as the Finance approver.
- Actual Result (C-017): all three fields applied to the real `customers` row exactly as proposed; exactly three `customer_field_history` rows written, one per field, each with correct old/new values.
- Actual Result (C-020): the redundant re-approval retry returned `{status: "approved"}` cleanly with no error, and no additional `customer_field_history` rows were written (count unchanged), confirming the idempotent-on-approved-status guard.
- Actual Result (C-031): the Legal Entity Name change was approved purely on the informational `company_registration` evidence-type requirement, with zero actual document ever attached anywhere (Customer Change has no attachment mechanism at all, confirmed in C-028 below); `customer_field_history` for the `name` field records old/new value and the real approving actor, with no field or flag anywhere falsely implying a document was reviewed.
- Final Status: PASS (all three)

---

## Finding: R1's base_customer_row_version was never refreshed by send-back/resubmit, permanently staling it

- Not a separately-numbered journey; a real behavior discovered while attempting to complete R1's own lifecycle for C-017, directly relevant to C-013 and C-029.
- R1 was created in Batch 9 against the shared fixture customer at `base_customer_row_version = 11`. An intervening, separately-approved change request in that same batch advanced the customer's real `row_version` to 13 before R1 was ever approved. R1 was then sent back (C-012) and resubmitted (C-013) in this batch, but `submit_customer_change_request` does not re-capture `base_customer_row_version` on resubmit, it only ever gets set once, at creation, by `create_customer_change_request`. So R1 remained stuck comparing against `11` forever, and its final approval attempt correctly failed with `CUSTOMER_CHANGE_STALE_BASE: ... row_version 13 vs expected 11`, even after a full send-back/resubmit cycle.
- This directly and empirically answers C-029's own open question ("verify against code for whether R2 auto-recreates its base_customer_row_version on resubmit, or must be entirely recreated"): **it does not auto-recreate.** Send-back and resubmit only affect the request's own draft/submission lifecycle, never its captured base customer snapshot. The only real recovery path once a request goes stale is to abandon it (it can no longer be approved, ever, at any node) and create an entirely new request against the customer's current state, not to send it back and resubmit the same one.
- Classification: not a defect. This is the exact intended behavior of the whole-row staleness guard, just not previously confirmed empirically for the resubmit path specifically. R1 was deliberately left in this permanently-stale, un-approvable `submitted` state as a durable fixture demonstrating this exact condition for anyone reviewing this ledger later.

---

## C-026: Stale page approve attempt on Customer Change

- Journey ID: C-026
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: called `approve_customer_change_request` with `p_expected_current_node_key = "node_3"` against a request actually still sitting at `node_2`.
- Actual Result: rejected with `WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.` Same mechanism as A-029, confirmed applied identically to Customer Change.
- Final Status: PASS

---

## C-029: Two concurrent change requests on the same customer, first-approved wins

- Journey ID: C-029
- Priority: P0
- Automation Feasibility: FULL
- Test Data: two pairs of requests created against the same customer at the same base row_version: RA/RB both proposing `postal_code` (overlapping field), RC/RD proposing disjoint fields (`website` vs `primary_contact_designation`).
- Actions Executed: fully approved RA (and separately RC), then attempted to approve RB (and RD).
- Actual Result: both RB and RD were rejected with `CUSTOMER_CHANGE_STALE_BASE`, identically, regardless of whether the second request's proposed fields overlapped with the first's. Confirms the staleness guard is a genuine whole-row version check, not a field-level check: even a completely disjoint-field second request is still correctly blocked from being blindly applied against a customer row that has moved on.
- Final Status: PASS
- Notes: recovery path is the same as documented in the finding above (R1): the second request cannot be rescued by send-back/resubmit, only by abandoning it and creating a fresh one against the customer's now-current state.

---

## C-033: Field history append-only integrity across multiple approved requests on the same field

- Journey ID: C-033
- Priority: P0
- Automation Feasibility: FULL
- Test Data: three sequential, separately-approved requests changing `billing_currency` on the same customer (starting value INR; changed to usd, then to inr, then back to usd, the round-trip stress variant).
- Actions Executed: created, submitted, and fully approved each of the three requests in sequence.
- Actual Result: exactly three `customer_field_history` rows exist for `billing_currency`, in correct chronological order, each recording the correct old/new value pair and its own approving actor, none overwritten or merged. The round-trip back to an earlier value (`inr` to `usd`, the same value the field started to differ from two steps back) was still recorded as a genuine new history entry, confirming the "actual change" comparison is always against the CURRENT value only, never any older historical value.
- Final Status: PASS

---

## C-014 / C-015: Reject is terminal, requires non-empty reason, never touches customers

- Journey ID: C-014, C-015
- Priority: P0, P1
- Automation Feasibility: FULL
- Actions Executed: attempted `reject_customer_change_request` with an empty reason (rejected), then with a real reason (accepted), then attempted to reject the same already-rejected request again.
- Actual Result: empty-reason attempt correctly rejected with `CUSTOMER_CHANGE_REJECT_REASON_REQUIRED`. The real reject transitioned status to `rejected`; the customer's `website`/`row_version` were confirmed byte-for-byte unchanged before and after; zero `customer_field_history` rows exist for the rejected request. Re-rejecting the already-rejected request returned cleanly (`{status: "rejected"}`) as an idempotent no-op, rather than raising an error, per the RPC's own explicit early-return for an already-`rejected` status (distinct from send-back, which has no such early-return and would instead raise `CUSTOMER_CHANGE_NOT_SENDBACKABLE` if attempted on an already-sent-back request).
- Final Status: PASS
- Notes: rejected status is a genuine, distinct terminal state from `sent_back` (which remains revisable), confirmed both by the state machine's guard conditions and by the customer record's complete non-mutation.

---

## C-021 / C-022 / C-023: Cancel lifecycle

- Journey ID: C-021, C-022, C-023
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: a non-creator attempted to cancel a draft (rejected), the real creator cancelled the same draft (succeeded), and a separate submitted (non-draft) request's creator attempted to cancel it (rejected).
- Actual Result: non-creator cancel rejected with `CUSTOMER_CHANGE_CANCEL_NOT_OWNER: only the creator of request ... may cancel it`. Creator's cancel succeeded, status `cancelled`. Non-draft cancel attempt rejected with `CUSTOMER_CHANGE_NOT_CANCELLABLE: request ... has status submitted, only a draft may be cancelled`.
- Final Status: PASS (all three)

---

## C-009 / C-010 / C-011: Requirement computation, combination, and informational-only enforcement

- Journey ID: C-009, C-010, C-011
- Priority: P1, P2, P1
- Automation Feasibility: FULL
- Test Data: a request proposing only a name change (C-009); a separate request proposing segment, business_unit, name, AND website simultaneously (C-010/C-011).
- Actual Result (C-009): a single `company_registration` evidence-kind requirement was persisted with the exact rule reason text.
- Actual Result (C-010): all 4 requirements from the combined change (FINANCE_HEAD, 2x BU_HEAD, company_registration evidence) were persisted together, none dropped or overwritten.
- Actual Result (C-011): the combined request was fully approved through all 3 real workflow nodes by three ordinary `customer.approve` holders, none of whom hold any FINANCE_HEAD/BU_HEAD-specific role; all four proposed fields were applied to the real customer record despite none of the four informational requirements ever having any dedicated per-requirement sign-off recorded. Confirms this is a deliberate V1 simplification (a single Approve/Send Back/Reject decision is the entire authorization surface, requirement count notwithstanding), not an accidental gap.
- Final Status: PASS (all three)

---

## C-018: Proposed-but-unchanged field is silently skipped in history

- Journey ID: C-018
- Priority: P1
- Automation Feasibility: FULL
- Test Data: a request proposing two fields, `website` (set to the value already current, an accidental no-op re-proposal) and `postal_code` (a genuine change).
- Actual Result: exactly one `customer_field_history` row was written, for `postal_code` only. No spurious history row was created for the unchanged `website` value, confirming field history writes are conditioned on an actual value diff, not merely presence in `proposedValues`.
- Final Status: PASS

---

## C-024: Workflow version resolved once at creation for Customer Change

- Journey ID: C-024
- Priority: P0
- Automation Feasibility: PARTIAL (confirmed by code reading; the identical mechanism was already live-proven for Onboarding in A-014, Batch 7)
- Actions Executed: read `create_customer_change_request` (captures `workflow_version_id` from the currently-active+published version into the request row once, at creation) and `approve_customer_change_request` (uses only `v_change_request.workflow_version_id` throughout its entire execution, never re-queries `workflow_definition_versions`).
- Actual Result: confirmed the same resolve-once, never-rebind pattern already proven for Onboarding applies identically here. A request's stored `workflow_version_id` cannot change post-creation regardless of any later workflow version being published.
- Final Status: PASS
- Notes: not re-proven with a fresh live publish-a-competing-version test, since the mechanism is structurally identical code to A-014's already-live-verified case and does not depend on domain-specific logic.

---

## C-025: WORKFLOW_TEAM_REQUIRED gap in Customer Change

- Journey ID: C-025
- Priority: P0
- Automation Feasibility: FULL
- Actual Result: this exact gap (a workflow node whose responsible team has zero active members raises `WORKFLOW_TEAM_REQUIRED` for every actor identically, with no self-service recovery) was proven twice this run: synthetically in Batch 8 (A-027, a deliberately-constructed empty test team) and, more significantly, for real in Batch 9, where the live, active `customer_change` workflow's own Finance Approval node was discovered to have zero eligible approvers before being fixed. Both confirm the same mechanism and the same documented known gap (mirrors A-027, cross-domain per AA-010).
- Final Status: PASS
- Notes: no new live reproduction was staged this batch since Batch 9's real-environment instance already provides stronger evidence than a fresh synthetic one would.

---

## C-027: WORKFLOW_DECISION_NO_MATCH on Customer Change

- Journey ID: C-027
- Priority: P1
- Automation Feasibility: PARTIAL
- Original Overnight Status: DEFERRED. This journey needs a workflow with a Decision node, which the then-active `customer_change` workflow did not have (it was a pure 3-step sequential Approval chain). Deferred to Batch 12 on the theory that Commercial Change's own real Decision-node workflow would be the natural place to test this mechanism.
- Batch 12 follow-up (recorded there in full): Commercial Change's real Decision-node workflow turned out to ALSO have an unconditional Default edge, meaning no segment value can ever fail to route, so `WORKFLOW_DECISION_NO_MATCH` remained structurally unreachable there too. Remained genuinely unresolved through the end of the overnight run, correctly carried into the final report as a known, deliberately time-boxed gap rather than silently dropped.

### MORNING CATCH-UP OUTCOME (2026-09-21)

- Morning Action: since no existing real workflow (in either domain) has a Decision node lacking a default branch, closing this required purpose-building one. Read `fn_resolve_workflow_next_approval`'s exact Decision-node resolution logic (raises `WORKFLOW_DECISION_NO_MATCH` when a request's context matches none of the conditioned branches and no unconditioned/fallback branch exists) and `publish_workflow_definition_version`'s exact publish-time validation (requires a Decision node to have >= 2 outgoing branches and <= 1 default branch; does NOT require a default branch to exist at all), confirming a publishable-but-genuinely-incomplete Decision graph is a real, reachable product shape, not merely a hypothetical.
- Built a dedicated, temporary probe workflow for `customer_change` via the real Workflow Builder RPCs (`create_workflow_definition`, `create_workflow_definition_version`, `save_workflow_version_graph`, `publish_workflow_definition_version`): Start -> Decision(segment) -> [segment=enterprise -> Approval A | segment=sme -> Approval B] -> End, deliberately with zero default/fallback branch. Confirmed it published successfully (2 branches, 0 fallback, valid per the real constraint).
- Since only one workflow per domain may be active at a time (`uq_workflow_definitions_one_active_per_config`) and testing requires binding a real request to this probe graph, this step required briefly swapping the live, shared active `customer_change` workflow definition. Given the real (if narrow) risk to any concurrent real request during that window, this was surfaced to Utkarsh directly in chat before proceeding; he explicitly authorized doing the swap-test-restore sequence in one uninterrupted run.
- Executed: activated the probe workflow (`replace_active_workflow_definition`, atomic swap); created a disposable customer with `segment = "startup"` (matching neither conditioned branch); created and saved a real Customer Change Request draft against it; called `submit_customer_change_request`.
- Rerun Result: submit correctly failed with `WORKFLOW_DECISION_NO_MATCH: this request did not match any branch of its workflow's Decision step, and the Decision step has no default (unconditioned) branch. Ask a Workflow Admin to add a default branch.` The request's own state was confirmed byte-for-byte unchanged before and after the failed submit (`status: draft`, `current_workflow_node_key: null` both times), confirming no partial state corruption occurred.
- Cleanup: immediately restored the original active workflow definition via the same atomic `replace_active_workflow_definition` RPC, confirmed via direct query that exactly one `customer_change` workflow is active again and it is the original one (`wf_test_finance_legal_sequential`). The probe workflow definition remains in the database, inactive and clearly named ("C-027 Decision No-Match Probe (temporary, morning catch-up)"), harmless to leave in place.
- Final Status: **PASS**

---

## C-028: No attachment support exists for Customer Change

- Journey ID: C-028
- Priority: P2
- Automation Feasibility: MANUAL
- Actions Executed: searched `src/features/customer-change/` for any attachment/upload/document reference.
- Actual Result: zero matches anywhere in the domain's feature code. Confirmed this is a genuine architectural absence (no attachments platform module is wired into this domain at all), not an accidentally broken upload control, consistent with C-009's and C-031's evidence-informational-only behavior.
- Final Status: PASS
- Notes: recorded explicitly to prevent a future tester from misclassifying this absence as a defect.

---

## C-030: Customer deactivated while a Change Request is already in flight

- Journey ID: C-030
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: two isolated live tests. First, a request was submitted, then the customer was deactivated (via the real `set_customer_active` RPC) before attempting approval. Second, a request was created, submitted, AND approved entirely while the customer was already inactive throughout, with no intervening staleness.
- Actual Result: in the first (realistic) scenario, the approval attempt failed, but with `CUSTOMER_CHANGE_STALE_BASE`, not any `is_active`-specific error, because `set_customer_active` itself advances `customers.row_version` as a normal side effect of any real state change, which incidentally trips the base-staleness guard before any is_active question is ever reached. In the second (isolated) scenario, with no staleness in play, the full 3-node approval succeeded completely, genuinely mutating the (still-inactive) customer's governed fields. Confirms `approve_customer_change_request` has NO direct `is_active` check anywhere in its own logic.
- Root Cause / Classification: this is a genuine product-policy question, not a bounded implementation defect. In practice, through the real UI, a maker cannot create a NEW request against an inactive customer (B-010's TS-layer guard) and cannot successfully rebase a stale one against an inactive customer either (creation is blocked), so the realistic exploitable window is narrow. But it is not zero: a request that was already submitted, awaiting review, on a customer that was active at submission time and becomes inactive later, before that specific request's row_version happens to have advanced independently, could still complete successfully with no is_active check ever firing. This is an emergent property of two unrelated mechanisms interacting, not a deliberate design decision documented anywhere.
- Final Status: PRODUCT DECISION REQUIRED
- Notes: recorded as PD-004 in `OVERNIGHT_PENDING_APPROVALS.md`. Customer was restored to active immediately after each test.
- **Product Decision Closure (2026-09-21, PD-004 CLOSED): PENDING -> DECIDED -> VERIFIED AS INTENTIONAL CURRENT BEHAVIOUR.** Business decision: do NOT block approval merely because the customer became inactive after the request was validly created; a valid Customer Change or Commercial Change request may continue through its normal approval workflow even if the underlying customer subsequently becomes inactive. This is the current behavior exactly as this journey found it, so no code change was made (per this task's own instruction: "If current behaviour already matches this decision, do not add unnecessary code... verify it, document the decision, add/retain regression coverage"). Verified: `approve_customer_change_request`'s live RPC body was re-read in full during this closure and confirmed to still contain no `is_active` check anywhere (unchanged since this journey ran). Regression coverage added: `src/features/customer-change/data/change-request.data.test.ts` now has a dedicated test asserting the RPC call carries no `is_active`/customer-status parameter of any kind, so a future generic inactive-customer guard added elsewhere cannot silently regress this decision without that test visibly failing first. Cross-checked against PD-003's new inactive-customer guard on Commercial Configuration Version *creation* (`supabase/migrations/20260930090000_...sql`): confirmed that guard only touches `create_commercial_configuration_version`, never `approve_commercial_configuration_version` or `approve_customer_change_request`, so PD-003's fix cannot have accidentally broken this journey's intended behavior. `tsc`/`eslint`/full vitest suite (941 tests) green.

---

## C-032: Change request's own row_version column is unwired, real protection is pessimistic lock

- Journey ID: C-032
- Priority: P2
- Automation Feasibility: PARTIAL (schema/code-level inspection, per the journey's own designation)
- Actions Executed: searched all migrations for a `row_version`-incrementing trigger on `customer_change_requests` (none found, unlike `customers`' own `trg_customers_row_version`), and searched `approve_customer_change_request`/`send_back_customer_change_request`/`reject_customer_change_request` for any reference to the request's own `row_version` column (none found; only `base_customer_row_version`, a distinct column compared against `customers.row_version`, is ever referenced).
- Actual Result: confirmed. `customer_change_requests.row_version` exists as a column (defaulting to 1) but is never read, compared, or incremented by any RPC. The real concurrency protection for the request's own status transitions is the `SELECT ... FOR UPDATE` row lock taken at the start of every mutating RPC, combined with an explicit status-text guard (e.g. `only submitted or resubmitted may be approved`), exactly the same pattern already documented for Onboarding cases.
- Final Status: PASS
- Notes: this is a real, documented cross-cutting inconsistency (row-version optimistic locking is wired for `customers` but not for `customer_change_requests` itself), not a bug in the actual concurrency-safety mechanism, which works correctly via the row lock regardless. Flagged here, per the journey's own intent, so no future tester mistakenly assumes this unwired column is meaningful.

---

## Batch 10 closure summary

- Scheduled: 25 (C-009 through C-033)
- PASS: 23 (C-009, C-010, C-011, C-012, C-013, C-014, C-015, C-016, C-017, C-018, C-019, C-020, C-021, C-022, C-023, C-024, C-025, C-026, C-028, C-029, C-031, C-032, C-033)
- PRODUCT DECISION REQUIRED: 1 (C-030, recorded as PD-004)
- Originally deferred to Batch 12 (natural home, not counted against this batch's completeness): 1 (C-027, needs a Decision-node workflow, which Commercial Change has and the current `customer_change` workflow does not). **Resolved 2026-09-21 (morning catch-up): PASS**, via a purpose-built probe workflow, see C-027's own Morning Catch-Up Outcome above.
- No defects found this batch. One notable non-defect empirical finding: R1's `base_customer_row_version` was never refreshed by send-back/resubmit, permanently staling it; documented as the correct, intended behavior of the whole-row staleness guard rather than a bug, and left in place as a durable fixture.
- Fixtures created and preserved: the shared customer (`120d8347-e16f-4a01-937b-97c3acea9394`) now carries name "Batch8 Approval Core Co Renamed", `row_version` in the low 40s, billing_currency `usd`, segment/business_unit `sme`, and a full, correctly-ordered field history chain across many approved requests this batch. R1 remains permanently `submitted`-but-unapprovable, a deliberate durable fixture demonstrating the staleness-recovery finding above.
- No journeys blocked, parked, or skipped without a documented reason. All 25 scheduled journeys resolved to a final status (24 resolved outright, 1 correctly deferred to its natural home in Batch 12).

---
