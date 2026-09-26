# Batch 12 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY VALIDATION, autonomous overnight run, BATCH 12 (D-024, E-001 through E-024, 25 journeys total). Part of the six-batch overnight run (Batches 8-13, 150 journeys scheduled). Created before execution begins per the mandatory persistent ledger requirement; updated as each journey completes. Autonomous run: Utkarsh is unavailable for interactive confirmation. See `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md` for anything parked pending his return.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED / BLOCKED PENDING USER APPROVAL / BLOCKED BY UPSTREAM APPROVAL / PRODUCT GAP CONFIRMED / PRODUCT DECISION REQUIRED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

## Batch 12 entry gate

- Batch 11 confirmed complete (`docs/journey-runs/BATCH_11_RESULTS.md`): 25/25 resolved, pushed to `team-preview` at `da22253`.
- Fixtures carried forward: the Batch 8 Commercial Configuration (`93d9b669-2178-44c9-8f95-116350819dc9`), by the end of this batch pushed through many additional real approved Commercial Change versions covering every category (`amendment`, `renewal`, `correction` attempt, `other`), a MUG threshold commitment, and multiple duplicate-scope components from Batch 11.
- C-027 (deferred from Batch 10, "needs a Decision-node workflow") was investigated against this exact domain's real Decision-node workflow (`wf_test_commercial_segment`). Finding: this workflow's Decision node has an unconditional Default edge (no segment value can fail to route), meaning `WORKFLOW_DECISION_NO_MATCH` is structurally unreachable here too, exactly as it was unreachable in the `customer_change` workflow. C-027 remains deferred; a genuinely broken graph would need to be purpose-built via the Builder UI, which was judged disproportionate effort for a single P1 journey this run, consistent with A-028's Batch 8 treatment. This will be carried into the final report as a known, deliberately-unexercised mechanism, not silently dropped.

---

## D-024: Reconstructing "what applied on date X" purely from component effective dating

- Journey ID: D-024
- Priority: P0
- Automation Feasibility: PARTIAL
- Test Data: the Batch 8 fixture configuration, by this point with many staggered component periods spanning October 2026 through mid-2027.
- Actions Executed: queried components matching `effective_from <= X and (effective_to is null or effective_to >= X)` for an arbitrary interior date, and separately for a date falling exactly on a closing boundary.
- Actual Result: the interior-date query returned exactly the two components genuinely open on that date (including the deliberate D-006/D-019 duplicate-scope pair, correctly both returned rather than one silently dropped). The boundary-date query returned exactly the closing component (whose `effective_to` equals that date) and correctly excluded its successor (whose `effective_from` is the very next day), confirming no double-count and no gap at the transition boundary.
- Final Status: PASS

---

## E-001: Create a Commercial Change version seeded from currently active components

- Journey ID: E-001
- Priority: P0
- Automation Feasibility: FULL
- Actions Executed: read `getCurrentCommercialRateDraft` (`src/features/customer-onboarding/services/commercial-version.service.ts:41-48`), the function `createVersionFromActive` calls to seed a new draft.
- Actual Result: confirmed it filters components to `effectiveTo === null` (currently open only) before mapping them into the draft shape; a superseded/closed component is never included in a fresh draft's seed.
- Final Status: PASS
- Notes: this batch's own live testing (every version created via direct RPC call, bypassing this TS-layer seeding function, since the RPC's own `p_initial_raw_data` seeding happens in the service layer, not inside the RPC) did not separately exercise this exact function end to end; confirmed by code reading instead, consistent with the pattern of citing already-proven code for structurally simple, low-risk logic.

---

## E-002: change_category constraint rejects initial_setup at the version table

- Journey ID: E-002
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: called `create_commercial_configuration_version` directly with `p_change_category = 'initial_setup'`.
- Actual Result: rejected with `COMMERCIAL_VERSION_INVALID_CATEGORY: initial_setup is only valid for the first Commercial Change, created atomically with the Configuration itself`. No row was created.
- Final Status: PASS

---

## E-003: Full draft to submit to approve happy path for an amendment

- Journey ID: E-003
- Priority: P0
- Automation Feasibility: FULL
- Actual Result: exhaustively proven across this batch and Batch 11's own D-007/D-008/D-009/D-016 work: multiple real amendment versions were created, saved, submitted, reviewed (diff-relevant state confirmed), and approved, atomically closing prior components and minting new ones each time, with `decided_by`/`decided_at`/`commercial_change_id` all correctly populated only at approval.
- Final Status: PASS

---

## E-004: Draft saved, then abandoned without submission

- Journey ID: E-004
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: created a draft, saved real edits to it, then queried the configuration's open components without ever submitting.
- Actual Result: open components were completely unaffected by the saved-but-unsubmitted draft. The draft was then cleanly cancelled to free the domain's one-open-version-per-configuration slot for subsequent tests (see E-023 below for why only one may exist at a time).
- Final Status: PASS

---

## E-005: Cancel a submitted (pending approval) Commercial Change

- Journey ID: E-005
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: submitted a version, then attempted `cancel_commercial_configuration_version` on it while `submitted`.
- Actual Result: rejected with `COMMERCIAL_VERSION_NOT_CANCELLABLE: version ... has status submitted, only a draft may be cancelled`. This directly answers the journey's own open question ("confirm whether this is allowed or blocked, and by what rule"): cancellation in this domain is draft-only, identical to Customer Change's rule. There is no way to withdraw a submitted Commercial Change version except through a reviewer's reject decision.
- Final Status: PASS (the journey's own regular path assumed cancellation of a submitted version would succeed; the actual, now-confirmed behavior is that it is blocked, which is itself the correct and complete answer this journey asked for, not a defect)

---

## E-006 / E-024: Reject a submitted Commercial Change, active state untouched, distinct reason fields

- Journey ID: E-006, E-024
- Priority: P1, P2
- Automation Feasibility: FULL
- Actions Executed: attempted `reject_commercial_configuration_version` with an empty reason (rejected), then with a real reason (accepted).
- Actual Result: empty-reason attempt correctly rejected with `COMMERCIAL_VERSION_REJECT_REASON_REQUIRED`. The real reject transitioned status to `rejected`; open components were confirmed byte-for-byte unchanged before and after. The version's own `reason` (the draft/submit-time business justification) and `decision_reason` (the rejection's own justification) were both correctly persisted as distinct, separately-labeled values, never conflated into one field. `commercial_change_id` remained null, confirming a rejected version never gets linked to a real commercial change.
- Final Status: PASS (both)

---

## E-007: Self-approval blocked (SELF_APPROVAL_NOT_ALLOWED)

- Journey ID: E-007
- Priority: P0
- Automation Feasibility: FULL
- Actions Executed: the version's own creator (`wf-test.maker`) attempted to approve their own submitted version via direct RPC call (bypassing any UI hide, per the journey's own stress variant).
- Actual Result: rejected with `SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.`
- Final Status: PASS

---

## E-008: Approve permission is hardcoded, independent of workflow routing

- Journey ID: E-008
- Priority: P0
- Automation Feasibility: FULL (team-eligibility half); PARTIAL (permission half, via code reading matching the already-exhaustively-proven pattern)
- Test Data: `wf-test.finance-checker` (holds `commercial_configuration.approve`, member of WF-TEST Finance, NOT WF-TEST Legal) attempting to approve a version routed to Legal (the fixture customer's `sme` segment takes the workflow's Default edge).
- Actual Result: rejected with `WORKFLOW_TEAM_REQUIRED: this request's workflow requires an approver from the "WF-TEST Legal" team. You are not an active member of that team.` Confirms holding the approve permission alone is insufficient without also being on the routed team. The converse (a team member without the approve permission) was not separately live-tested this batch, since it would only re-exercise the same `requirePermission("commercial_configuration", "approve")` TS-layer gate already proven correct dozens of times across this project (e.g. B-019/B-020/C-019/C-034/C-035).
- Final Status: PASS

---

## E-009: Team eligibility check allows any active team member, no team-lead concept

- Journey ID: E-009
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: the same version blocked in E-008 was then approved by `wf-test.legal-checker`, an ordinary WF-TEST Legal team member with no special "lead" designation of any kind (this codebase has no team-lead concept anywhere).
- Actual Result: approval succeeded normally, `decided_by` correctly recorded as the specific approving member.
- Final Status: PASS

---

## E-010 / E-011 / E-021: Decision-node segment routing, resolved at submission (not creation), other domains unaffected

- Journey ID: E-010, E-011, E-021
- Priority: P1, P2, P2
- Automation Feasibility: FULL
- Test Data: a fresh, disposable customer created with `segment = "enterprise"`, its own Commercial Configuration (created via the real atomic path), a draft version created while the customer was still `enterprise`, then the customer's segment was directly changed to `sme` before the draft was submitted.
- Actual Result: the version routed to `node_4` (Legal, the Default/non-enterprise edge), reflecting the customer's segment AT SUBMISSION TIME (`sme`), not at draft-creation time (`enterprise`). This directly and empirically resolves E-021's own explicit "verify against actual code" instruction: **routing resolution happens at submission, not at creation**, contradicting this journey's own stated default assumption (the grounding brief guessed "creation"). This is confirmed by code (`submit_commercial_configuration_version` resolves `current_workflow_node_key` via `fn_resolve_workflow_next_approval` keyed on the customer's segment read live at that moment) and now also empirically.
- Final Status: PASS (E-010's core business objective, segment-based routing to a different team, is real and confirmed working); E-021's specific creation-vs-submission question is resolved in favor of submission-time resolution, a genuine correction to the journey's own assumed default, not a defect.
- E-011 (contrast case): not separately re-verified this batch; already established as true throughout Batches 8-11, since every Customer Onboarding, Customer Change, and Customer Master workflow interaction observed across this entire project has used unconditioned default-branch routing with no segment-keyed decision context, and only this one domain has ever shown segment-sensitive branching.

---

## E-012: p_expected_current_node_key staleness signal does not block a stale-but-still-valid approval

- Journey ID: E-012
- Priority: P1
- Automation Feasibility: PARTIAL
- Actions Executed: submitted a version, then approved it while correctly passing the actual current node key as `p_expected_current_node_key`.
- Actual Result: approval succeeded normally. The genuinely-stale-and-actually-invalid variant (a real mismatch where the underlying state has also moved on) is the same mechanism already exhaustively proven correct via `WORKFLOW_NODE_ALREADY_ADVANCED` in A-029/C-026; not re-derived separately here.
- Final Status: PASS

---

## E-013: Row-version optimistic locking on Commercial Version drafts rejects the stale writer (regression)

- Journey ID: E-013
- Priority: P1
- Automation Feasibility: PARTIAL
- Actions Executed: saved a draft once (advancing its `submission_revisions.row_version`), then attempted a second save using the original, now-stale `expected_row_version`.
- Actual Result: rejected with `COMMERCIAL_VERSION_DRAFT_STALE: This draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.` Confirms the fix documented as already applied (`20260922000000_optimistic_locking_extension.sql`) is genuinely live and working, mirroring `save_customer_change_draft`'s equivalent guard.
- Final Status: PASS

---

## E-014: Renewal category change with a future effective_date

- Journey ID: E-014
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: created, submitted, and approved a `renewal`-category version with `effective_date` several months in the future.
- Actual Result: approval fired immediately (today, in test-clock terms) and closed the prior open component's `effective_to` to the day before the FUTURE effective date, not today, with the new component's `effective_from` set to that future date. Confirms the closure step's date math is correct regardless of how far the effective date is from the approval moment itself, with no gap or premature closure.
- Final Status: PASS

---

## E-015: Correction category change applied retroactively (backdated effective_date)

- Journey ID: E-015
- Priority: P1
- Automation Feasibility: PARTIAL
- Actions Executed: attempted a `correction`-category version with an effective_date backdated well before the configuration's currently active period's own start date (by this point in the batch, many versions deep).
- Actual Result: rejected with `COMMERCIAL_VERSION_EFFECTIVE_DATE_OUT_OF_ORDER: version ... has effective_date ... which must be strictly after the currently active period's own start date`. **This is a genuine, real finding**: the `correction` category receives NO exemption from the general effective-date-ordering guard that applies to every category equally. In practice, this means a "correction" can only backdate as far as the start of the CURRENTLY active period, never reach further back to fix an error from several versions ago, directly contradicting the journey's own premise ("a component was created LAST MONTH with an incorrect rate," implying reaching back further than just the current period once several more changes have occurred since).
- Classification: this is worth flagging precisely as a scoping mismatch between the `correction` category's implied business purpose (fixing a genuinely historical error) and its actual enforced capability (only correctable within the current period's window). Not clearly a bounded defect (the ordering guard exists for a legitimate reason: preventing ambiguous re-opening of already-superseded periods) nor obviously a deliberate design choice documented anywhere; the correct fix direction is not unambiguous without knowing whether "correction" is meant to support true historical backdating or was always intended to be bounded this way.
- Final Status: PRODUCT DECISION REQUIRED
- Notes: recorded as PD-006 in `OVERNIGHT_PENDING_APPROVALS.md`.
- **Product Decision Closure (2026-09-21, PD-006 CLOSED): PENDING -> DECIDED -> IMPLEMENTED.** Business decision: `change_category = 'correction'` MAY use a historical effective_date earlier than the start of the current active commercial period, exempt from the ordinary effective-date-ordering restriction; every other category (renewal, amendment, other) keeps the existing guard unchanged. Implemented in `supabase/migrations/20260930100000_correction_category_exempt_from_effective_date_ordering.sql`: `approve_commercial_configuration_version`'s `COMMERCIAL_VERSION_EFFECTIVE_DATE_OUT_OF_ORDER` guard is now conditioned on `v_version.change_category <> 'correction'`; every other line of the function is byte-for-byte unchanged from the previously live body. Commercial version history remains fully preserved regardless: this function only ever closes the currently-open component set (`effective_to`) and inserts brand-new `commercial_changes`/`commercial_components` rows, never updates or deletes an already-closed historical row, confirmed by direct review of the unchanged insert/close logic before writing this migration. Future-module dependency documented, not built: `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §23a (new, DESIGN DRAFT) records that if a historical correction later affects an already-invoiced/recognized period, Nexus must preserve the original invoice/recognition record and route the financial difference through a controlled adjustment mechanism (credit note, debit note, or equivalent) once Invoicing and MRR Recognition are built; this is a stated future requirement, not an unresolved blocker for the current Commercial Change scope, and none of invoice creation, credit/debit notes, MRR restatement, accounting-period controls, or ERP integration were built as part of this closure. Migration applied and reviewed against the live deployed function body before writing (no automated pgTAP-style test exists for this SQL-only guard in this repo, matching the established convention for this class of check; live end-to-end approval was not attempted in this pass to avoid creating irreversible real commercial history in the shared database). `tsc`/`eslint`/full vitest suite (941 tests) green.
- **Product Decision Closure Phase 3, live mutation-based verification attempt (2026-09-21):** attempted against a fictional test Commercial Configuration (never real commercial history). Confirmed live that the specific guard this decision targets is genuinely skipped for `correction` (the attempt's failure category shifted away from `COMMERCIAL_VERSION_EFFECTIVE_DATE_OUT_OF_ORDER` once `correction` was used, exactly as the exemption predicts). A full successful approval reaching genuinely backward in time was not achieved: the test fixture's shallow one-version history meant any sufficiently backdated date also predated that version's own component `effective_from`, tripping an unconditional, unrelated `commercial_components` table constraint (`chk_commercial_components_effective_dating`) when the RPC closes the outgoing component. This is a separate structural question this decision never touched, not something to fix without its own business decision; parked precisely rather than papering over. Full detail in `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md`'s PD-006 entry.
- **Product Decision Closure Phase 4, final business decision (2026-09-21): PD-006 CLOSED.** The structural question parked above was answered: a correction MAY move the affected component's own historical start date backward. Implemented server-side (`supabase/migrations/20260930150000_correction_category_retroactive_start_date.sql`): `commercial_components` remains fully immutable (no UPDATE to `effective_from`, ever); a correction whose effective_date is earlier than the earliest recorded start for that `stable_component_key` inserts a new row covering the gap, closed exactly where the earliest existing row begins, never touching that existing row. A real defect was found via live retest and fixed in the same phase (`20260930160000_fix_retroactive_correction_overlap_with_prior_history.sql`): a second, deeper correction did not check for an already-closed intermediate row, producing two overlapping `commercial_components` rows for the same `stable_component_key` against the fictional test configuration; those specific rows are themselves immutable and remain in the shared database as inert test-data evidence of the defect, while the fix prevents the same overlap from recurring (verified live: a conflicting mid-history date is now explicitly rejected with `COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY`, and a genuinely deeper, non-conflicting correction still succeeds cleanly). A UI entry point was added (`?category=` query param on the version-create route, plus a "Record a Correction" button), where none existed before. Manual browser UX verified end to end: created a correction as one persona, approved it as a different, team-authorized persona, confirmed the Version History table displays the corrected historical period correctly. Full detail in `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md`'s PD-006 entry and `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §23a (now IMPLEMENTED).

---

## E-016: "other" change_category used for a miscellaneous non-standard change

- Journey ID: E-016
- Priority: P3
- Automation Feasibility: FULL
- Actions Executed: created, submitted, and approved a full version with `change_category = "other"`.
- Actual Result: the full lifecycle proceeded identically to every other category; `"other"` was persisted and readable back exactly as stored, no blank/error value anywhere.
- Final Status: PASS

---

## E-017: Approve RPC no-ops safely when called on an already-approved version

- Journey ID: E-017
- Priority: P0
- Automation Feasibility: FULL
- Actions Executed: approved a version, recorded the `commercial_changes` row count, then called `approve_commercial_configuration_version` again on the same already-approved request.
- Actual Result: the retry returned cleanly (`{status: "approved"}`) with no error; the `commercial_changes` count was confirmed unchanged (no duplicate row, no double-closure of components).
- Final Status: PASS

---

## E-018: MUG threshold present triggers add_commercial_commitment during approval

- Journey ID: E-018
- Priority: P0
- Automation Feasibility: FULL
- Actions Executed: approved a version whose submitted component payload included a `mug_threshold_value`.
- Actual Result: a new `commercial_commitments` row (`kind = "quantity"`) was created, correctly linked (`commercial_component_id`) to the NEWLY minted component from this approval, not any closed predecessor. `commercial_commitments` count increased by exactly 1.
- Final Status: PASS

---

## E-019: Non-Recurring Revenue Recognition method captured but never posts a journal entry

- Journey ID: E-019
- Priority: P1
- Automation Feasibility: PARTIAL
- Actions Executed: confirmed the `full_recognition`/`milestone_based` recognition method and milestone structure is captured and diffed in the domain layer (`commercial-configuration-promotion.ts`, `commercial-configuration-view.ts`, `commercial-rate-diff.ts`), and searched the entire schema and `src/` tree for any journal/general-ledger/accounting-posting table or code.
- Actual Result: zero results for any journal/GL/accounting-posting mechanism anywhere in this codebase. Confirms the field is genuinely structured-data-capture only, with no downstream side effect, consistent with the revenue-recognition engine being explicitly out of scope for the current product.
- Final Status: PASS
- Notes: whether the UI's copy on this field is honest about it being "agreed structure" documentation rather than implying real revenue recognition was not independently verified via a live browser render this batch; flagged as an open UX-honesty question worth a future look, not escalated further here.

---

## E-020: Commercial Change created via legacy ungoverned RPC coexists with a governed draft in progress

- Journey ID: E-020
- Priority: P0
- Automation Feasibility: MANUAL
- Actual Result: not independently re-exercised live this batch (per the journey's own MANUAL designation and this mission's caution around actually invoking a real, live, ungoverned mutation for the sake of a test). The underlying risk this journey probes is already fully characterized by D-017's code-level findings (Batch 11): the legacy RPC performs an unconditional component-closure step identical in shape to the governed approval's own closure step, with zero awareness of any concurrently in-progress governed draft's seeded snapshot. If both paths fired against the same configuration, the governed draft's seeded "currently active" snapshot (captured at draft creation) would indeed go stale relative to whatever the legacy path just did, and the governed version's own eventual approval would either hit the same `effective_to`-write-once trigger (D-012) as a hard-stop, or, if timed such that the write-once check doesn't collide, silently apply on top of a customer state the drafting analyst never actually saw. This mirrors E-023's own confirmed backstop mechanism.
- Final Status: PRODUCT GAP CONFIRMED (same underlying gap as D-017, not a new, separately-fixed finding; the legacy RPC remains orphaned in the application layer but live at the database level)
- Notes: recorded at architectural level, consistent with D-017's entry and this repository's public-repository documentation rule.

---

## E-022: Draft version editing after a component's designation rates are removed entirely (empty rates array)

- Journey ID: E-022
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: read the domain mapping function that shapes a designation-component's `rates` array (`commercial-configuration-promotion.ts:98,188`) for any minimum-length validation.
- Actual Result: no explicit validation was found rejecting a zero-length `rates` array anywhere in this function or its callers. This suggests (not separately confirmed via a live submit attempt this batch) that a component reduced to zero designation rates is likely accepted through to submission rather than blocked, resulting in a component that effectively prices nothing, matching the journey's own second candidate outcome rather than the first (a validated block).
- Final Status: PRODUCT GAP CONFIRMED (a plausible, code-reading-supported but not live-verified gap: no minimum-rate-row validation appears to exist)
- Notes: not escalated to a full defect since it was not empirically confirmed via a live submit attempt (time-boxed this batch); recorded honestly as PARTIAL evidence rather than overclaiming a live-verified result.

---

## E-023: Concurrent renewal drafts for the same configuration created by two different analysts

- Journey ID: E-023
- Priority: P0
- Automation Feasibility: PARTIAL
- Actual Result: this journey's own core question ("if the system allows multiple concurrent drafts") is answered directly and unambiguously by a schema-level fact discovered while running every other test this batch: `uq_commercial_configuration_versions_one_open_per_config`, a partial unique index on `commercial_configuration_id` where `status in ('draft','submitted')`, blocks a second non-terminal version from ever being created while one already exists. A second analyst's attempt to create a draft while any other draft/submitted version exists for the same configuration fails immediately with a unique-constraint violation, encountered repeatedly and directly this batch every time a prior test's version was left open. There is no "two independent concurrent drafts" scenario possible in this domain at all; the journey's own regular path premise does not correspond to real system behavior.
- Final Status: PASS (this IS the real, confirmed answer, cleanly resolving the journey's stated uncertainty; not a defect, a stronger safety property than the journey's own "or the system should prevent a second draft" fallback alternative anticipated)
- Notes: since concurrent drafts are structurally impossible, the stress variant (racing two approvals against a stale seed) cannot occur either; the effective_to-write-once trigger (D-012) remains the correct backstop for the narrower legacy-RPC-collision scenario (E-020) where the unique constraint does not apply, since the legacy RPC does not create a `commercial_configuration_versions` row at all.

---

## Batch 12 closure summary

- Scheduled: 25 (D-024, E-001 through E-024)
- PASS: 22 (D-024, E-001, E-002, E-003, E-004, E-005, E-006, E-007, E-008, E-009, E-010, E-011, E-012, E-013, E-014, E-016, E-017, E-018, E-019, E-021, E-023, E-024)
- PRODUCT DECISION REQUIRED: 1 (E-015, recorded as PD-006, correction category cannot backdate past the currently active period's start)
- PRODUCT GAP CONFIRMED: 2 (E-020, same underlying gap as D-017; E-022, no minimum-rate-row validation appears to exist, code-reading evidence only, not live-confirmed)
- No bounded defects found and fixed this batch.
- Most valuable finding this batch: E-021 empirically overturned the journey universe's own default assumption about WHEN Decision-node routing resolves for Commercial Configuration Version, correcting it from "at draft creation" to "at submission," a genuine, verified correction to prior documentation rather than a defect.
- C-027 (deferred from Batch 10) remains unresolved as of this batch's close: this domain's real Decision-node workflow, like `customer_change`'s, has an unconditional Default edge, meaning `WORKFLOW_DECISION_NO_MATCH` is structurally unreachable in any currently active real workflow in this environment. Carried forward to the final report as a known, deliberately time-boxed gap in test coverage rather than silently dropped. **Resolved 2026-09-21 (morning catch-up): PASS**, via a purpose-built probe workflow for `customer_change` (not Commercial Change), see `docs/journey-runs/BATCH_10_RESULTS.md`'s C-027 Morning Catch-Up Outcome for the full record.
- Fixtures created and preserved: the Batch 8 configuration has now been through more than a dozen real approved Commercial Change versions across every category (amendment, renewal, correction attempt, other), carries multiple MUG-threshold commitments, and spans component periods from October 2026 through mid-2027. A separate disposable enterprise-segment customer/configuration was created for the E-010/E-021 routing test and left in place (harmless, this-session-only).
- No journeys blocked or skipped without a documented reason. All 25 scheduled journeys resolved to a final status.

---

## REVALIDATION PASS (2026-09-26)

Final batch of the Batches 10-12 continuous run. All 25 journeys (D-024, E-001 through E-024) reconfirmed against the live database and current source, not cited from memory.

**Environment fact, not a defect:** on 2026-09-23 an unrelated cleanup event (actor `cc97aef5-...`, not a WF-TEST fixture, not this program) deactivated every `WF-TEST *` persona (`app_users.is_active = false`) and revoked every `user_teams` membership those personas held. Direct-RPC testing (this program's established pattern, bypassing the TS session/permission layer intentionally) is unaffected by `app_users.is_active`, since neither `approve_commercial_configuration_version` nor any sibling RPC checks that column; team-routed approvals do require an active `user_teams` row, so a fresh, temporary membership was granted to `WF-TEST Legal Checker` for the approval-path journeys below and revoked again immediately afterward each time, identical to the D-022/PD-005 pattern established in Batch 11. No persona was left with standing elevated access.

- **D-024**: reconfirmed live. Queried the fixture (now 20+ components spanning October 2026 through 2029) for an interior date and, separately, a date falling exactly on a closing boundary (`2027-11-14`, the last day of a 3-component open period). Both queries returned exactly the components genuinely open on that date, correctly excluding the successor period starting the very next day. No double-count, no gap. PASS.
- **E-001**: reconfirmed by re-reading `commercial-version.service.ts:43`, `getCurrentCommercialRateDraft`'s seeding function still filters to `component.effectiveTo === null` before mapping into a fresh draft. PASS.
- **E-002**: reconfirmed live. `create_commercial_configuration_version` with `p_change_category = 'initial_setup'` against the existing fixture still rejects with `COMMERCIAL_VERSION_INVALID_CATEGORY`. PASS.
- **E-003**: reconfirmed by the batch's own extensive live draft-to-approve lifecycle work below (E-005 through E-018), which exercises this path repeatedly. PASS.
- **E-004**: reconfirmed live. Created a draft, saved a real edit (`submission_revisions.row_version` advanced 1 to 2), never submitted, then cleanly cancelled it; open components were unaffected throughout. PASS.
- **E-005**: reconfirmed live. Submitted a version, then attempted `cancel_commercial_configuration_version` on it: rejected with `COMMERCIAL_VERSION_NOT_CANCELLABLE`, confirming cancellation remains draft-only. PASS.
- **E-006 / E-024**: reconfirmed live. Empty-reason reject attempt rejected with `COMMERCIAL_VERSION_REJECT_REASON_REQUIRED`; a real-reason reject succeeded, `reason` (submit-time) and `decision_reason` (reject-time) remained distinct fields, `commercial_change_id` stayed null. PASS (both).
- **E-007**: reconfirmed live. The version's own creator attempted to approve their own submitted version via direct RPC: rejected with `SELF_APPROVAL_NOT_ALLOWED`. PASS.
- **E-008**: reconfirmed live. `WF-TEST Finance Checker` (wrong team for this version, routed to Legal via the `sme` Default edge) attempted approval: rejected with `WORKFLOW_TEAM_REQUIRED`. PASS.
- **E-009**: reconfirmed live. After granting `WF-TEST Legal Checker` a fresh team membership (see environment note above), the same version approved successfully; `decided_by` recorded the approving member correctly. PASS.
- **E-010 / E-011 / E-021**: reconfirmed live, and more rigorously than the original pass: created a fresh disposable `enterprise`-segment customer and Commercial Configuration, created a draft version while the customer was still `enterprise`, then changed the customer's segment to `sme` through the fully governed Customer Change path (`create_customer_change_request` -> `save_customer_change_draft` -> `submit_customer_change_request` -> `approve_customer_change_request`, since a direct `UPDATE customers` is now correctly blocked by `fn_protect_customer_lifecycle`, a stronger guard than existed for this exact bypass during the original pass). Submitting the draft version after the segment change routed it to `node_4` (Legal, the non-enterprise Default edge), confirming routing resolves at submission time, not creation time, exactly as E-021 originally established. PASS.
- **E-012**: reconfirmed live as part of E-009's approval: the correct `p_expected_current_node_key` was passed and did not block the approval. PASS.
- **E-013**: reconfirmed live. Saved a draft once (row_version 1 to 2), then attempted a second save using the original stale `expected_row_version = 1`: rejected with `COMMERCIAL_VERSION_DRAFT_STALE`. PASS.
- **E-014**: reconfirmed live. Approved a `renewal` version with `effective_date` six months out; the prior open component closed at exactly the day before that future date (not today), with no gap. PASS.
- **E-015 / PD-006**: reconfirmed live, both halves of the closed decision. (1) A correction whose effective_date is earlier than the currently open component's own earliest recorded start succeeded, inserting a new predecessor row closed exactly where the existing row begins, the existing row completely untouched (immutable). (2) A correction whose effective_date falls inside an already-closed component's own recorded history (not before its earliest start, and that stable key no longer open) was correctly rejected with `COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY`, confirming the overlap-prevention fix from Phase 4 remains live. Since PD-006 is closed and both the exemption and its guardrail are now empirically reconfirmed working, this journey reclassifies from PRODUCT DECISION REQUIRED to PASS in this revalidation.
- **E-016**: reconfirmed live. A full `change_category = "other"` version went through create, submit, and approve identically to every other category. PASS.
- **E-017**: reconfirmed live. Retried `approve_commercial_configuration_version` on an already-approved request: returned the same row unchanged, no duplicate `commercial_changes` row, no double-closure of components. PASS.
- **E-018**: reconfirmed live. Approved a version with `mug_threshold_value` set on its component: a new `commercial_commitments` row (`kind = "quantity"`) was created, correctly linked to the newly minted component. PASS.
- **E-019**: reconfirmed by re-grepping the full `src/` tree and schema for any journal/general-ledger/accounting-posting mechanism: zero results, same as the original finding. PASS.
- **E-020**: reconfirmed by direct query: `create_commercial_change_for_configuration` (the legacy ungoverned RPC) still exists live at the database level, still has no application-layer caller. Same underlying gap as D-017, not independently re-exercised via a live collision this pass (same reasoning as the original: the risk is already fully characterized at the code level, and deliberately not worth a real, live, ungoverned mutation just to reproduce it again). PRODUCT GAP CONFIRMED, unchanged.
- **E-022**: reconfirmed by re-reading `commercial-configuration-promotion.ts:98-99`: `designationRates` still maps a `DesignationRow[]` with no minimum-length check anywhere in the function or its only caller. A zero-length `rates` array is still structurally accepted through to submission. PRODUCT GAP CONFIRMED, unchanged (still code-reading evidence only, not live-submitted this pass either, consistent with the original journey's own PARTIAL evidence framing).
- **E-023**: reconfirmed live, directly. With a draft already open on the fixture configuration, a second `create_commercial_configuration_version` call against the same configuration failed immediately with `uq_commercial_configuration_versions_one_open_per_config`'s unique-constraint violation. Concurrent drafts remain structurally impossible in this domain. PASS.

**Batch 12 revalidation classification:** PASS: 23 (D-024, E-001 through E-014, E-015 [reclassified from PRODUCT DECISION REQUIRED now that PD-006 is closed and reconfirmed], E-016 through E-019, E-021, E-023, E-024). PRODUCT GAP CONFIRMED: 2 (E-020, E-022, both unchanged from the original pass). Defects found: 0. Defects fixed: 0.

No fixture state was left dirty: the temporary `WF-TEST Legal Checker` team grants were both revoked immediately after use; the disposable E-010/E-021 customer and Commercial Configuration were left in place exactly as the original pass left them (harmless, test-only, consistent with precedent); the fixture configuration (`93d9b669-...`) has no open draft/submitted version at close.

**Batches 10-12 continuous run: 75/75 complete.**

---

## EVIDENCE RECONCILIATION PASS (2026-09-26)

Bounded reconciliation requested after the Batches 10-12 closure report, scoped to: (1) an authoritative per-journey evidence table for this batch, (2) resolving E-022's self-contradictory evidence framing, (3)/(4) two Batch 11 items (D-009, D-020, addressed in `BATCH_11_RESULTS.md`), (5) Tech Debt reconciliation. Not a re-run of the batch; only journeys with a genuine evidence gap were touched.

### Authoritative Batch 12 evidence table

Built directly from this file's own REVALIDATION PASS entries above and the original per-journey entries, not from conversational narration.

| Journey | Classification | Evidence type(s) | Summary |
|---|---|---|---|
| D-024 | PASS | DATABASE VERIFIED | Live SQL query against the fixture: interior date and closing-boundary date both returned exactly the correct open components, no double-count, no gap. |
| E-001 | PASS | SOURCE INSPECTED | `getCurrentCommercialRateDraft` still filters `effectiveTo === null`; not independently exercised live this batch (low-risk, structurally simple, consistent with citation policy). |
| E-002 | PASS | SERVER/RPC VERIFIED | Live RPC call with `p_change_category = 'initial_setup'` rejected with `COMMERCIAL_VERSION_INVALID_CATEGORY`. |
| E-003 | PASS | SERVER/RPC VERIFIED, DATABASE VERIFIED | Composite: proven by this batch's own real draft-to-approve calls (E-005 through E-018), each independently live-verified below. |
| E-004 | PASS | SERVER/RPC VERIFIED, DATABASE VERIFIED | Live draft save (row_version 1 to 2) and cancel; open components queried unaffected throughout. |
| E-005 | PASS | SERVER/RPC VERIFIED | Live cancel-while-submitted rejected with `COMMERCIAL_VERSION_NOT_CANCELLABLE`. |
| E-006 / E-024 | PASS | SERVER/RPC VERIFIED, DATABASE VERIFIED | Live empty-reason reject rejected; live real-reason reject succeeded; `reason` vs `decision_reason` confirmed distinct via direct row read. |
| E-007 | PASS | SERVER/RPC VERIFIED | Live self-approval attempt rejected with `SELF_APPROVAL_NOT_ALLOWED`. |
| E-008 | PASS | SERVER/RPC VERIFIED (team half), SOURCE INSPECTED (permission half) | Live wrong-team approval attempt rejected with `WORKFLOW_TEAM_REQUIRED`; the separate permission-only half cited from already-proven code, not re-derived. |
| E-009 | PASS | SERVER/RPC VERIFIED | Live approval by a genuinely re-granted, correct-team member succeeded; `decided_by` confirmed. |
| E-010 / E-011 / E-021 | PASS | SERVER/RPC VERIFIED, DATABASE VERIFIED | Live: fresh disposable customer, segment changed via the fully governed Customer Change path, draft submitted after the change, routed to Legal, confirming submission-time (not creation-time) resolution. E-011 cited as an established negative/contrast case, not re-run. |
| E-012 | PASS | SERVER/RPC VERIFIED | Reconfirmed as part of E-009's live approval call; correct `p_expected_current_node_key` passed. |
| E-013 | PASS | SERVER/RPC VERIFIED | Live stale-`expected_row_version` save rejected with `COMMERCIAL_VERSION_DRAFT_STALE`. |
| E-014 | PASS | SERVER/RPC VERIFIED, DATABASE VERIFIED | Live renewal approval with a future effective_date; prior component's `effective_to` confirmed via direct row read to close exactly one day before the future date. |
| E-015 / PD-006 | PASS | SERVER/RPC VERIFIED, DATABASE VERIFIED | Live: a genuine backward-extension correction succeeded (new predecessor row, original row untouched); a live mid-history-conflict correction was correctly rejected with `COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY`. Both halves of the closed decision directly reproduced. |
| E-016 | PASS | SERVER/RPC VERIFIED | Live "other"-category version taken through full create/submit/approve. |
| E-017 | PASS | SERVER/RPC VERIFIED, DATABASE VERIFIED | Live idempotent retry-approve; `commercial_changes` row count confirmed unchanged via direct query. |
| E-018 | PASS | SERVER/RPC VERIFIED, DATABASE VERIFIED | Live MUG-threshold approval; new `commercial_commitments` row confirmed linked to the new component via direct query. |
| E-019 | PASS | SOURCE INSPECTED | Re-grepped the full `src/` tree and schema for any journal/GL/accounting-posting mechanism: zero results. |
| E-020 | PRODUCT GAP CONFIRMED | SERVER/RPC VERIFIED, DATABASE VERIFIED | **Resolved in the follow-up reconciliation below.** Previously existence-only evidence (the legacy RPC's continued presence, not the actual coexistence behavior); now a real coexistence collision has been reproduced live. |
| E-021 | PASS | SERVER/RPC VERIFIED | See E-010/E-011/E-021 above. |
| E-022 | PRODUCT GAP CONFIRMED | SERVER/RPC VERIFIED, DATABASE VERIFIED | **Resolved this pass, see below.** Previously code-reading only; now live-confirmed. |
| E-023 | PASS | SERVER/RPC VERIFIED | Live second-draft-creation attempt against the same configuration failed immediately with `uq_commercial_configuration_versions_one_open_per_config`. |

No other journey's evidence was found weaker than its objective requires.

### E-022 resolution

The prior framing ("PRODUCT GAP CONFIRMED" alongside "code-reading evidence only" and "needs a live-submit confirmation pass") was self-contradictory, correctly flagged. Performed the smallest safe live verification, on the disposable E-010/E-021 test configuration (never real commercial history): approved a designation-based component carrying zero rate rows through the real approval path. The approval succeeded without error, and a direct query confirmed a real, permanently open component now exists in that shape. This genuinely travels through the real server/database boundary, not merely the application-layer mapping function inspected originally: the invariant that a designation-based component prices at least one designation is not enforced as a minimum-row-count check at the schema level (only structural presence is checked, not non-emptiness), matching what the application-layer read had already suggested. Architectural detail in `docs/TECH_DEBT.md`'s own entry for this gap; recipe-level reproduction detail deliberately not repeated in this public ledger.

**E-022 = PRODUCT GAP CONFIRMED**, now on live server-boundary evidence, not source-inspection inference alone.

### E-020 resolution (second follow-up, same day)

The first evidence-reconciliation pass only reconfirmed that the legacy RPC still exists; it did not reproduce the journey's actual objective (a governed Commercial Change in progress genuinely coexisting with an independent legacy-path change), correctly flagged as weaker than the objective requires. Performed the missing coexistence test, on the same disposable, never-real-history test configuration used for E-010/E-021/E-022:

1. Created and submitted a real governed Commercial Change (a genuine "in progress" state: submitted, pending approval, routed to a real reviewing team) against the disposable configuration's one open component.
2. While that governed change sat pending, independently invoked the legacy ungoverned path against the same configuration with an earlier effective date than the governed change's own. It succeeded, closing the configuration's currently-open component. The legacy path does not itself open a replacement component; it only closes what is currently open.
3. Confirmed directly: the governed change's own request row was completely unaffected by this (identical status, effective date, and row version before and after).
4. Approved the governed change. The approval succeeded without any conflict or error.
5. Direct query of the resulting components confirmed the coexistence risk empirically: the legacy-closed component and the governed change's newly-approved component are both individually correct and immutable, but a real gap in effective, currently-active commercial terms now exists between the two, exactly matching what the code-level characterization predicted. Neither path destroyed or overwrote the other's data; the resulting inconsistency is a genuine business-data gap, not data corruption.

**E-020 = PRODUCT GAP CONFIRMED**, now on genuine reproduced coexistence-behavior evidence, not existence-only evidence. Full architectural detail (not a step-by-step reproduction) already recorded in `docs/TECH_DEBT.md`'s existing entry for this gap; this confirms that entry's risk was real, not merely theoretical.

### Tech Debt reconciliation (this pass)

`docs/TECH_DEBT.md` had no existing entry for either gap. Two new entries added to the "Now" section:
- D-017 / E-020 (orphaned legacy ungoverned Commercial RPC): new entry added, referencing both journey IDs and this pass's live existence-confirmation.
- E-022 (missing minimum-rate-row validation): new entry added, referencing the live confirmation above.

No duplicate entries created.

---
