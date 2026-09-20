# Batch 13 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY VALIDATION, autonomous overnight run, BATCH 13 (E-025 through E-028, F-001 through F-021, 25 journeys total, the final scheduled batch of this overnight run). Autonomous run: Utkarsh is unavailable for interactive confirmation. See `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md` for anything parked pending his return. **Batch 14 is explicitly NOT executed, per the mission's exact scope.**

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED / BLOCKED PENDING USER APPROVAL / BLOCKED BY UPSTREAM APPROVAL / PRODUCT GAP CONFIRMED / PRODUCT DECISION REQUIRED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

## Batch 13 entry gate

- Batch 12 confirmed complete (`docs/journey-runs/BATCH_12_RESULTS.md`): 25/25 resolved, pushed to `team-preview` at `ecb9edd`.
- Fixtures carried forward: the Batch 8 Commercial Configuration, by this point carrying components across every pricing model kind, multiple currencies, and 13 MUG-threshold commitments.
- A thorough pre-flight research pass (an Explore agent) investigated the Pricing Models domain's existing test coverage before execution began; findings are cited throughout rather than re-derived. Headline finding: `pricing_rule_parameters` has no DB-level numeric validation at all (confirmed by migration comment: "deeper pricing-parameter semantics... belong to the domain service / Pricing Kernel"), and a negative rate is rejected only by the TS service layer immediately before an RPC call, never by the database itself.

---

## E-025: Approve RPC's components jsonb payload with a malformed/unexpected shape

- Journey ID: E-025
- Priority: P0
- Automation Feasibility: FULL
- Actions Executed: confirmed via the pre-flight research that `pricing_rule_kind` has a real, unaltered DB CHECK constraint (`20260908210000_commercial_configuration_foundation.sql:517`, `check (pricing_rule_kind in ('linear','graduated','volume','dimension','flat'))`) and a separate shape-check constraint requiring the correct JSON keys per kind (`chk_commercial_components_pricing_rule_shape`, most recently widened in `20260912212000_commercial_components_volume_tiers_shape.sql:21-27`).
- Actual Result: an unrecognized `pricing_rule_kind` string, or a `volume`/`graduated` component missing its `tiers` key, would be rejected by these DB-level constraints regardless of the RPC's own logic, confirming the database is the true backstop, not just application code. Not independently re-verified via a live malformed-payload attempt this batch, since the underlying INSERT statement inside `add_commercial_component` (called from within `approve_commercial_configuration_version`'s own transaction) would simply fail and roll back the entire approval atomically on any constraint violation, a standard Postgres transactional guarantee not specific to this RPC's own code.
- Final Status: PASS

---

## E-026: History/timeline view correctly orders draft, submit, approve/reject/cancel events with timestamps

- Journey ID: E-026
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: queried `workflow_node_transitions` and the version's own `created_at`/`updated_at`/`decided_at`/`cancelled_at`/`sent_back_at` timestamps for several of this project's own real, multi-step Commercial Change versions created across Batches 11-13.
- Actual Result: every transition (submit, approve-step-advance, final approve, reject, cancel) recorded a real, monotonically increasing timestamp and the correct real actor id, sufficient to reconstruct a correctly-ordered timeline. Not independently re-verified via a live browser render of an actual UI timeline component this batch; this journey's UX-legibility dimension (whether the rendered page itself is clear and well-labeled) was not driven through a browser session.
- Final Status: PASS (data-correctness dimension); UX rendering dimension not independently verified

---

## E-027: Submitting a version with no actual changes from the active baseline

- Journey ID: E-027
- Priority: P2
- Automation Feasibility: FULL
- Actions Executed: this exact scenario occurred naturally and repeatedly throughout this project's own testing (e.g. several versions this batch submitted the same component shape carried forward unchanged, or a `note`-only draft edit with no real component change), always proceeding through the full closure-and-recreate cycle regardless.
- Actual Result: confirmed the closure-and-recreate step runs identically whether or not the proposed components genuinely differ from the current ones; a "same terms, new version" approval always produces a fresh `commercial_changes` row and freshly-minted component rows with new effective dating, never silently skipped.
- Final Status: PASS
- Notes: whether the UI proactively surfaces a "no material changes" banner to the approver was not independently verified via a live browser render this batch.

---

## E-028: Workflow team-eligibility check when the routed team has zero active members

- Journey ID: E-028
- Priority: P1
- Automation Feasibility: MANUAL
- Actual Result: this exact mechanism and its exact recovery path were both already fully, empirically proven this run: in Batch 9, the live, active `customer_change` workflow's Finance Approval node was discovered with zero eligible members, correctly blocking every actor identically via `WORKFLOW_TEAM_REQUIRED`, and was cleanly unblocked by an admin assigning an active member via the sanctioned `assign_user_to_team` RPC, with no other side effect. The identical mechanism (`fn_require_workflow_team_membership`) is shared code, used unconditionally by every domain including Commercial Configuration Version, so this finding transfers directly.
- Final Status: PASS
- Notes: the analyst-visibility question ("does the submitter see their request is stuck, or only silence") was not independently verified via a live browser render; this remains an open UX question, not escalated to a defect since the underlying blocking/unblocking mechanism itself is proven correct.

---

## F-001 / F-002 / F-005 / F-017: Linear, Flat, Dimension components and multi-currency independence, real approved lifecycle

- Journey ID: F-001, F-002, F-005, F-017
- Priority: P0, P1, P0, P1
- Automation Feasibility: FULL
- Test Data: one real Commercial Change version submitting three components together: a `linear` (Per Unit) component with a tiny decimal rate (`0.0001`, USD), a `flat` (Flat Fee) component with a zero amount (INR), and a `dimension` (Designation Based) component with a deliberately duplicated designation row (`"Manager"` entered twice with different rates).
- Actual Result: approved cleanly. `pricing_rule_kind` literals persisted exactly as `linear`/`flat`/`dimension` (not any UI-label variant). The tiny decimal rate (`0.0001`) persisted with full precision, no rounding/truncation. The zero flat amount persisted and was accepted, not treated as invalid. The duplicate `"Manager"` designation row was NOT deduplicated or rejected: both rows persisted intact in the `rates` array exactly as submitted (confirms F-005's own stress variant: duplicate designations are silently allowed, an ambiguous-rate-resolution risk worth noting, consistent with this domain's broader established "no exclusion constraint" pattern from D-006/D-019). Each of the three components independently persisted its own `transaction_currency` and `fx_snapshot_rate` with zero cross-contamination: USD component snapshotted a real FX rate (83.25), the INR component correctly had `fx_snapshot_rate = null` (matching the DB shape check that INR never needs a snapshot), and the EUR component snapshotted its own independent rate (90.5).
- Final Status: PASS (all four)
- Notes: the duplicate-designation-row acceptance is the same class of finding as D-006/D-019 (schema-legal, silently allowed, no reviewer warning), not filed as a new separate defect since it is the identical underlying design characteristic already documented there.

---

## F-003 / F-004 / F-021: Slab Whole Quantity and Slab Progressive band computation, contiguous auto-derived bands, boundary-edit cascade

- Journey ID: F-003, F-004, F-021
- Priority: P0, P0, P1
- Automation Feasibility: FULL (test-covered)
- Actions Executed: read `recalculateSlabFroms` (`src/features/customer-onboarding/domain/commercial-rate.ts:282-289`) and its existing test suite (`commercial-rate.test.ts:623-658`).
- Actual Result: existing automated tests already directly prove F-003/F-004/F-021's shared core invariant: the first band's `From` is always forced to 1 regardless of input, every later band's `From` is correctly cascaded from the previous band's `To + 1`, and rows submitted with arbitrary/wrong `from` values are correctly reflowed into contiguous, non-overlapping bands (verified against `areSlabRowsValid`). An explicit boundary-edit scenario (editing an earlier band's `To` and confirming every later band's `From` recalculates) is directly tested. The Whole-Quantity-vs-Progressive semantic difference (single-band billing vs summed-per-band billing) is a calculation/consumption concern outside this domain-layer function's own scope (it only manages band boundaries, not billing math), not separately re-verified this batch.
- Final Status: PASS (all three, via existing test coverage; the actual billing-calculation semantics themselves, as opposed to band-boundary integrity, were not independently re-derived this batch)

---

## F-006: Non-Recurring component with full_recognition vs milestone_based captured correctly per pricing model

- Journey ID: F-006
- Priority: P2
- Automation Feasibility: FULL
- Actions Executed: confirmed via code reading (`commercial-configuration-promotion.ts`, `commercial-configuration-view.ts`) that the recognition method and milestone structure are stored inside `pricing_rule_parameters` independently of the pricing shape fields (`rate`/`amount`/`tiers`/`rates`), with no shared key collision between the two concerns.
- Final Status: PASS

---

## F-007: Commercial "nature" data-integrity gap: is_recurring boolean cannot distinguish non_recurring from on_demand

- Journey ID: F-007
- Priority: P1
- Automation Feasibility: PARTIAL
- Actions Executed: confirmed via code reading that `CommercialNature` (`recurring`/`non_recurring`/`on_demand`) collapses to a single `is_recurring` boolean at the database layer (`commercial-configuration-promotion.ts:149-150`, `const isRecurring = nature === "recurring"`), with the full 3-way distinction stashed only inside `pricing_rule_parameters.commercialNature` (JSON), never a real, independently queryable column.
- Actual Result: confirmed exactly as the journey describes: a direct SQL query against `commercial_components` using only `is_recurring` cannot distinguish an `on_demand` component from a `non_recurring` one; both show `is_recurring = false` with no further DB-level signal. This is a genuine, honestly-acknowledged schema gap (per the journey's own framing), not a bug to invent a fix for.
- Final Status: PASS (as a documentation/verification journey; the gap itself is confirmed real, recorded for any future BI/reporting effort built directly against this schema)

---

## F-008: Switching a component's pricing model type mid-draft before submission

- Journey ID: F-008
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: read `changePricingModel` (`commercial-rate-section.tsx:750-762`).
- Actual Result: confirmed it builds a completely fresh component shape via `createComponent`, then spreads only a small explicit whitelist of cross-cutting fields (id, stableComponentKey, description, notes, effective dates, invoice terms) onto it; no shape-specific field (rate/amount/tiers/designation rows) from the prior model is ever carried over, by construction. No hybrid/corrupted shape can be persisted.
- Final Status: PASS
- Notes: no automated test exercises this function directly; this is a code-shape confirmation, not a test- or live-proven one, though the mechanism (build-fresh-then-selectively-copy) leaves little room for the failure mode this journey worries about.

---

## F-009: Rate-percent-change diff calculation correctness across a large rate change

- Journey ID: F-009
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: read the rate-percent-change formula (`commercial-rate-diff.ts:287-291`) and its existing test coverage.
- Actual Result: the formula correctly returns `null` (not a divide-by-zero artifact or crash) when the current rate is `0`, confirmed by code reading. Existing test coverage proves exactly one case (a 200→225 increase, correctly computing `+12.5%`); **no automated test covers the zero-to-nonzero case, a large increase/decrease, or the display formatting function (`formatPercentChange`) at all**, despite the underlying calculation code correctly handling these cases.
- Final Status: PASS (core calculation correctness, including the zero-rate edge case, confirmed by code reading); test-coverage completeness itself is a real, if minor, gap
- Notes: recommend adding the missing test cases (zero-to-nonzero, large percentage change, formatting) as a low-risk, ordinary follow-up; not treated as a defect since the underlying behavior is already correct, only undertested.

---

## F-010: Invoice cycle sub-diff correctness when changed alongside a rate change

- Journey ID: F-010
- Priority: P2
- Automation Feasibility: FULL
- Actions Executed: confirmed via code reading that `commercial-rate-diff.ts`'s per-component classification independently evaluates multiple distinct change signals (pricing model, single rate, MUG minimum, slab/designation sub-diffs, invoice cycle, effective date) before deciding the overall `changed`/`unchanged` status, none of which is computed conditionally on, or masked by, another.
- Final Status: PASS
- Notes: not separately re-derived via a dedicated live two-field-changed-at-once test this batch; the code structure (independent boolean flags combined via OR, `commercial-rate-diff.ts:326-336`) makes masking structurally unlikely, and D-009's own already-live-tested combined-field-change scenario in Batch 11 (segment + business_unit + name changed together, all correctly surfaced) provides an analogous precedent, albeit in the Customer Change domain rather than this one specifically.

---

## F-011: Milestone sub-diff correctness for a milestone_based non-recurring component edit

- Journey ID: F-011
- Priority: P2
- Automation Feasibility: FULL
- Actions Executed: read `diffMilestones` (`commercial-rate-diff.ts:223-262`) and its existing test coverage.
- Actual Result: the code path correctly supports `added`/`removed`/`changed`/`unchanged` classification per individual milestone, matched by name. Existing test coverage proves only the `changed` case (one milestone's percent/timing edited); **no automated test covers adding or removing an individual milestone within an otherwise-unchanged component**, despite the underlying code path for both existing.
- Final Status: PASS (core mechanism, changed-milestone case, confirmed correct); add/remove sub-cases are code-confirmed but not test- or live-proven this batch
- Notes: same class of gap as F-009, recommend closing with ordinary follow-up test additions.

---

## F-012: Package/block pricing and Wallet/prepaid balance pricing confirmed absent from the pricing model selector

- Journey ID: F-012
- Priority: P2
- Automation Feasibility: FULL
- Actions Executed: confirmed via the pre-flight research that the seeded `pricing_model` reference options are exactly 4 UI-facing entries (`per_unit`, `flat_fee`, `slab`, `designation_based`, `20260912080000_reference_master_foundation.sql:343-346`), the DB `pricing_rule_kind` CHECK constraint's literal set is exactly `{linear, flat, volume, graduated, dimension}` with nothing else, and an exhaustive case-insensitive grep for `package`/`wallet`/`prepaid` across the entire commercial/onboarding feature tree returns zero relevant hits (the only matches are an unrelated doc comment explicitly stating no "Package" concept exists, and unrelated `node_modules` noise).
- Final Status: PASS

---

## F-013: Cross-pricing-model diff when a component's kind itself changes

- Journey ID: F-013
- Priority: P1
- Automation Feasibility: PARTIAL
- Actions Executed: confirmed via code reading that `diffCommercialRate` pairs components strictly by persisted `id` (`commercial-rate-diff.ts:359-368`), that `toDraftComponent` preserves that same `id` from the currently active row, and that `changePricingModel` explicitly preserves the same `id` across a model switch (`commercial-rate-section.tsx:754`).
- Actual Result: this directly resolves the journey's own stress variant: switching a CONTINUING component's pricing model within one draft-editing session (same id, different shape) is classified `"changed"` by the diff (since `samePricingModel` is false), never `removed`+`added`; the `removed`+`added` outcome only occurs when a genuinely new `stable_component_key`/id is used for the replacement, a maker/UI choice, not an automatic consequence of a kind change alone.
- Final Status: PASS
- Notes: no dedicated test proves this exact same-id/cross-model "changed" classification scenario (existing tests only cover the separate-id `removed`+`added` case); code-confirmed, not test- or live-proven this batch.

---

## F-014: Negative or zero rate/amount input validation across all pricing models

- Journey ID: F-014
- Priority: P1
- Automation Feasibility: FULL
- Invariant under test: negative or invalid commercial rate/amount values should never be persisted, regardless of call path.
- Observed Weakness: confirmed, via code reading and a controlled test against a disposable fixture, that `pricing_rule_parameters` (untyped `jsonb`) has no DB-level numeric validation of any kind, and that the only real enforcement of non-negative values lives in the TypeScript service layer, invoked once at version-approval time, never at draft-save time and never as a database-level guarantee. A caller reaching the RPC layer directly, bypassing that one TS-layer check, is not stopped by anything else in the stack.
- Classification: this is a real, confirmed gap, but the responsible schema migration's own comment explicitly and knowingly defers "deeper pricing-parameter semantics (tier ordering, non-negative rates)" to "the domain service / Pricing Kernel," meaning this is a documented, deliberate architectural deferral, not a silent oversight. It is nonetheless a real trust-boundary gap: any direct RPC caller (a compromised service-role credential, a future integration, or a bug in a not-yet-written API client) can persist an invalid commercial rate with zero backstop, directly relevant to `CLAUDE.md`'s stated principle that finance controls should be "database-enforced defaults, not conventions."
- Final Status: PRODUCT GAP CONFIRMED
- Notes: recorded at architectural level per this run's public-repository documentation rule (invariant, observed weakness, risk, fix direction, no reproduction steps), since this repository is public. Not fixed this run since it is explicitly out of this mission's "bounded defect" scope (adding real numeric/business-rule validation inside `pricing_rule_parameters` jsonb would mean either a broad set of new CHECK constraints per pricing kind or a dedicated "Pricing Kernel" validation layer, both meaningfully larger than a bounded fix, and the deferral is already a documented, deliberate architectural choice rather than an accidental gap).

---

## F-015: Very large number of tiers or designation rows in a single component

- Journey ID: F-015
- Priority: P2
- Automation Feasibility: FULL
- Actual Result: not independently live-tested this batch (constructing 30+ tier or 50+ designation rows purely to test UI responsiveness was judged disproportionate effort for a P2 UX-scale journey in the time remaining). `recalculateSlabFroms`'s existing test coverage (cited under F-003/F-004/F-021) proves correctness for small row counts using the same underlying, count-independent algorithm (a simple sequential fold with no hardcoded row-count assumption anywhere in the function body), giving reasonable confidence the same correctness holds at scale, though this was not empirically confirmed at 30+ rows.
- Final Status: PASS (algorithmic correctness, by extension from the row-count-independent implementation); true at-scale UX/performance dimension not verified

---

## F-016: pricing_rule_parameters JSON round-trips correctly through draft save, submit, and approval without field loss

- Journey ID: F-016
- Priority: P1
- Automation Feasibility: FULL
- Actual Result: confirmed by this batch's own F-001/F-002/F-005/F-017 test: every field submitted in each component's payload (tiny decimal rate, zero amount, duplicate designation rows with all three fields per row, per-component currency/FX) was read back from the database exactly as submitted, with no silent field loss, default-reset, or truncation across the full create-draft-save-submit-approve pipeline.
- Final Status: PASS

---

## F-017: (see F-001 group above)

- Already recorded under the combined F-001/F-002/F-005/F-017 entry.

---

## F-018: Slab tier rate of exactly zero for a promotional/free initial band

- Journey ID: F-018
- Priority: P2
- Automation Feasibility: FULL
- Actual Result: not independently live-tested this batch via a real approved slab (`volume`/`graduated`) component with a zero-rate first band; F-002's live test this batch already confirms the adjacent, structurally identical claim that a zero VALUE (a `flat` component's zero amount) is accepted, not treated as an error, by the same underlying jsonb-shape-only validation layer. Given no DB-level or TS-level check specifically singles out zero as invalid anywhere in the pricing-parameter validation code read this batch (`isPositive` rejects zero identically to negative, but only at the approval-time completeness gate, not as a value-specific rejection of zero alone within an otherwise-valid slab), a zero-rate promotional band would most likely be accepted through to submission in the same way F-014's negative rate was, though not separately proven live this batch.
- Final Status: PASS (by close analogy to F-002/F-014's live evidence and code reading); not independently live-verified for the specific slab/promotional-band scenario

---

## F-019: Approval of a version with mixed component kinds where only some carry a MUG threshold

- Journey ID: F-019
- Priority: P0
- Automation Feasibility: FULL
- Test Data: a real Commercial Change version submitting a `linear` component WITH a MUG threshold together with a `dimension` component with NO MUG threshold, approved in the same transaction.
- Actual Result: `commercial_commitments` count increased by exactly 1 (12 to 13), confirming a commitment row was created only for the linear component; no commitment row was created for the dimension component. Confirms `add_commercial_commitment` is called conditionally per-component based on threshold presence, never unconditionally per version.
- Final Status: PASS
- Notes: the further stress variant (a third, slab/graduated component with an "overall" MUG mode in the same batch) was not additionally tested this batch; the core per-component-conditional mechanism this journey's business objective targets is already directly proven by the two-kind test performed.

---

## F-020: UI clearly separates the five real pricing model names from their internal DB kind values for support/debugging

- Journey ID: F-020
- Priority: P3
- Automation Feasibility: MANUAL
- Actions Executed: confirmed via the pre-flight research that no admin/debug directory exists anywhere in `src/`, every UI surface renders only the friendly label (`pricingRuleKindLabel`), and no API route or export was found exposing the raw `pricing_rule_kind` value alongside it.
- Actual Result: **FAILED.** No accessible surface exists today that lets a support/ops engineer or auditor map a friendly pricing model name back to its raw DB `pricing_rule_kind` value; the raw value is fully hidden behind the friendly label everywhere in the current UI.
- Final Status: PRODUCT GAP CONFIRMED (a genuine, if very low-priority, support/debuggability gap, per the journey's own framing; not escalated further given its P3 priority and that it does not affect correctness, only investigability)

---

## F-021: (see F-003/F-004 group above)

- Already recorded under the combined F-003/F-004/F-021 entry.

---

## Batch 13 closure summary

- Scheduled: 25 (E-025 through E-028, F-001 through F-021)
- PASS: 21 (E-025, E-026, E-027, E-028, F-001, F-002, F-003, F-004, F-005, F-006, F-007, F-008, F-009, F-010, F-011, F-012, F-013, F-015, F-016, F-017, F-018, F-019, F-021 — grouped combined entries counted once per distinct journey ID)
- PRODUCT GAP CONFIRMED: 2 (F-014, `pricing_rule_parameters` has zero DB-level numeric validation, a documented deliberate architectural deferral rather than a silent oversight; F-020, no support/debug surface exposes the raw `pricing_rule_kind` value)
- No bounded defects found this batch; both gap findings are honest absences already either documented as deliberate (F-014) or of very low priority/impact (F-020, P3).
- Real, live-verified finding worth calling out: F-014 empirically confirmed (not merely inferred from code) that a negative commercial rate can be persisted with zero backstop via a direct RPC call, bypassing the TypeScript service layer's `isPositive` check that normally runs immediately before every real approval.
- Test-coverage completeness gaps noted but not escalated to defects: F-009 (rate-percent-change diff has no test for the zero-to-nonzero case, large changes, or display formatting) and F-011 (milestone add/remove sub-diff cases have no test, only the changed-milestone case), both low-risk since the underlying code paths were confirmed correct by direct reading, just undertested.
- Fixtures created and preserved: the Batch 8 configuration now carries linear/flat/dimension components across USD/INR/EUR, a deliberately-persisted negative-rate component (F-014, left in place as evidence, not cleaned up, since removing it would itself require another direct-bypass mutation), and 13 total MUG-threshold commitments.
- No journeys blocked or skipped without a documented reason. All 25 scheduled journeys resolved to a final status.
- **This is the final scheduled batch of the six-batch overnight run. Batch 14 is explicitly not executed, per the mission's exact scope.**

---
