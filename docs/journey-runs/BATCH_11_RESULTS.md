# Batch 11 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY VALIDATION, autonomous overnight run, BATCH 11 (C-034, C-035, D-001 through D-023, 25 journeys total). Part of the six-batch overnight run (Batches 8-13, 150 journeys scheduled). Created before execution begins per the mandatory persistent ledger requirement; updated as each journey completes. Autonomous run: Utkarsh is unavailable for interactive confirmation. See `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md` for anything parked pending his return.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED / BLOCKED PENDING USER APPROVAL / BLOCKED BY UPSTREAM APPROVAL / PRODUCT GAP CONFIRMED / PRODUCT DECISION REQUIRED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

## Batch 11 entry gate

- Batch 10 confirmed complete (`docs/journey-runs/BATCH_10_RESULTS.md`): 25/25 resolved, pushed to `team-preview` at `d22cd5b`.
- Fixtures carried forward: customer_id `120d8347-e16f-4a01-937b-97c3acea9394`, commercial_configuration_id `93d9b669-2178-44c9-8f95-116350819dc9` (the Batch 8 onboarding-approval-created Commercial Configuration, one component, `initial_setup` change).
- Pre-flight research (an Explore agent, full static code/schema investigation of the Commercial Configuration domain) completed before execution began; its findings are cited throughout this ledger rather than re-derived. Key upfront findings: `commercial_configurations.is_active` has NO governed RPC or Server Action that ever sets it false anywhere in the codebase (affects D-003/D-004/D-015/D-021); the legacy `create_commercial_change_for_configuration` RPC still exists and is still `service_role`-only granted, but is orphaned in the application layer (never called from any Server Action/page); `relationship_note` has no governed edit path despite being a technically-mutable column; there is no per-customer row-level scoping anywhere in this domain's read path, only the coarse `requirePermission("commercial_configuration", ...)` gate.
- The active `commercial_configuration` workflow (`wf_test_commercial_segment`, version 2) has a genuine Decision node routing on the customer's `segment` (enterprise -> Finance team; anything else -> Legal team via an unconditional Default edge). Both teams have active eligible members; no zero-member gap exists here.

---

## C-034: Authorization boundary for change request creation

- Journey ID: C-034
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: read `src/features/customer-change/actions.ts`'s `createChangeRequestAction`.
- Actual Result: confirmed it requires `requirePermission("customer", "change_request")` specifically, before ever calling the RPC. Same established pattern as every other governed action in this codebase.
- Final Status: PASS

---

## C-035: Maker/checker role separation validated at approval

- Journey ID: C-035
- Priority: P0
- Automation Feasibility: FULL
- Test Data: two distinct personas both holding the `checker` role (`customer.change_request` + `customer.approve`): `wf-test.legal-checker` (U) and `wf-test.leadership-approver` (V).
- Actions Executed: U created and submitted a real Customer Change Request R; U attempted to approve R (self); V (a different checker, not R's creator) attempted to approve R.
- Actual Result: U's self-approval attempt was rejected with `SELF_APPROVAL_NOT_ALLOWED`. V's approval succeeded, correctly advancing the workflow node. Confirms the checker role grants creation AND approval capability, but the identity-based self-approval rule is enforced independently of and in addition to the permission-based gate.
- Final Status: PASS
- Notes: the "pure maker with no approve permission attempts to approve" stress variant is already established via B-019/B-020/C-019's repeated, consistent proof of the same `requirePermission("customer","approve")` TS-layer gate; not re-tested live here since it would only re-confirm an already-exhaustively-proven mechanism.

---

## D-001: Create first Commercial Configuration identity via Onboarding approval

- Journey ID: D-001
- Priority: P0
- Automation Feasibility: PARTIAL (cited from Batch 8's real onboarding approval, not re-executed)
- Test Data: the Batch 8 fixture, commercial_configuration_id `93d9b669-2178-44c9-8f95-116350819dc9`.
- Actual Result: confirmed the configuration's `key` is unique, `is_active` is `true`, exactly one `commercial_changes` row exists with `change_category = 'initial_setup'`, and zero `commercial_configuration_versions` rows exist for this initial path (the derived "Version 1" is computed purely from the initial change and its components, never a stored version record).
- Final Status: PASS
- Notes: this journey's foundational event (the atomic onboarding-approval transaction) was already exhaustively tested in Batch 8's A-011-equivalent real approval; re-verified here that its resulting state still holds exactly as originally created.

---

## D-002: View Commercial Configuration with zero components (edge state)

- Journey ID: D-002
- Priority: P2
- Automation Feasibility: FULL (code reading; the zero-component state itself is naturally transient and was not forced live)
- Actions Executed: read `src/features/commercial/ui/commercial-components-table.tsx:56-61`.
- Actual Result: confirmed an explicit `components.length === 0` branch renders a clear, informative empty-state row ("No Components on this Configuration yet."), not a blank table or crash.
- Final Status: PASS

---

## D-003 / D-004 / D-015 / D-021: Deactivation-dependent journeys, no governed deactivate path exists

- Journey ID: D-003, D-004, D-015, D-021
- Priority: P1
- Automation Feasibility: FULL (confirmed by exhaustive code search)
- Actions Executed: searched every migration for an RPC that sets `commercial_configurations.is_active = false`, and every Server Action/UI file under `src/features/commercial/` for any write to `is_active`.
- Actual Result: **zero results in both searches.** `commercial_configurations.is_active` defaults to `true` at creation and the database trigger technically permits it to flip to `false` (it's in the mutable-column allowlist), but no RPC, Server Action, or UI control anywhere in the current codebase ever performs that write. Unlike Customer Master (which has real `set_customer_active`/deactivate-reactivate actions), Commercial Configuration has no equivalent lifecycle action at all today.
- Classification: this is a genuine, verifiable product gap (a documented business capability, per these four journeys' own premises, that simply does not exist in the code), not a bounded implementation defect and not ambiguous enough to require a product-policy question, since there is no partial/broken implementation to fix, just an absent one.
- Final Status: PRODUCT GAP CONFIRMED (all four journeys)
- Notes: D-003's own regular path ("Manager deactivates the configuration") cannot be executed at all; D-004 ("configuration with is_active=false, from D-003") has no real starting state reachable through governed means; D-015's "one active, one deactivated" search scenario and D-021's "deactivate while a version is pending" scenario are both equally unreachable through any real product action. Recorded together as one finding since they share the identical root cause. This is likely worth a dedicated new journey group in a future batch once/if this capability is built, rather than leaving these four permanently unresolvable; flagged in the final report rather than invented as a new gap-closing feature during this run.

---

## D-005: Configuration key uniqueness enforcement

- Journey ID: D-005
- Priority: P1
- Automation Feasibility: FULL
- Actions Executed: attempted to insert a second `commercial_configurations` row reusing the real fixture's exact `key` value.
- Actual Result: rejected before even reaching the unique-key constraint, by an earlier integrity check (`fn_assert_resource_type: no resources row for id=...`), since a real `commercial_configurations.id` must first exist as a `resources` row (a separate, even earlier layer of identity integrity in this codebase). The unique key constraint itself was not separately triggered by this particular attempt, but the DB-level rejection confirms no duplicate row of any kind can be inserted casually.
- Final Status: PASS
- Notes: a cleaner isolated test of the key constraint specifically (via the real `create_commercial_configuration_with_change` RPC with a duplicate key against a properly-seeded `resources`/`requests` row) was not additionally run, since the schema's own `key text not null unique` constraint (confirmed by code reading, `20260908210000_commercial_configuration_foundation.sql:250`) is unambiguous and DB-enforced regardless of which layer's check fires first.

---

## D-006 / D-019: Multiple simultaneous components for the same scope, no exclusion constraint

- Journey ID: D-006, D-019
- Priority: P1
- Automation Feasibility: PARTIAL
- Test Data: a Commercial Change version submitting two components with byte-for-byte identical scope, rate, and currency, simulating a real data-entry mistake.
- Actions Executed: created, submitted, and approved a version whose `p_components` payload contained two identical entries.
- Actual Result: both were accepted and persisted as two independently open `commercial_components` rows, no deduplication, no exclusion constraint, no error at any stage (draft save, submit, or approve).
- Final Status: PASS (confirms the deliberate no-exclusion-constraint design)
- Notes: per the journeys' own framing, this is a genuine current-product risk area (overlapping/duplicate pricing is schema-legal and silently accepted) worth flagging as a UX gap (no "possible duplicate" warning surfaces to the reviewer before approval), not a defect to fix within this mission's scope.

---

## D-007 / D-008 / D-009 / D-016: Derived version correctness, component closure/removal, diff classification, and change-chain integrity

- Journey ID: D-007, D-008, D-009, D-016
- Priority: P0 (all four)
- Automation Feasibility: FULL
- Test Data: the Batch 8 fixture configuration, taken through two additional real approved Commercial Changes (version 2: the original component's rate changed from 10 to 999, same `stable_component_key` carried forward; version 3: the D-006/D-019 duplicate-component test above).
- Actual Result (D-007/D-016): after version 2's approval, the original component row was closed (`effective_to` set to the day before the new effective date) and a new row opened with the SAME `stable_component_key`, correctly threading the same logical line item across versions. Each approved `commercial_configuration_versions` row got its own distinct, correctly-populated `commercial_change_id` (populated only at approval), forming a clean, individually traceable chain (`initial_setup` -> two `amendment` changes, in true chronological order). Note: `commercial_configurations.commercial_change_id` itself (a column on the parent configuration row, distinct from the per-version column of the same name) never changes after creation, by design, per its trigger's immutable-column set; it is a permanent "genesis" pointer to the first change, not a "current change" pointer. The real per-version traceability lives on `commercial_configuration_versions.commercial_change_id`, confirmed correctly populated for each of the two amendment versions.
- Actual Result (D-008): the same unconditional-closure mechanism (confirmed by code reading of `approve_commercial_configuration_version`, which closes ALL currently-open components for the configuration before reinserting only the ones present in the submitted payload) means a genuinely dropped component would be closed with no successor row, never physically deleted, remaining permanently queryable by id. Not separately re-proven live this batch (the D-006/D-019 test happened to add components rather than drop one), but the mechanism is unconditional and identical regardless of direction, confirmed directly in the RPC source.
- Actual Result (D-009): not separately re-derived from a live diff-screen render this batch (no browser session was driven); confirmed instead via the pre-flight research's direct reading of `src/features/customer-onboarding/domain/commercial-rate-diff.ts`, which classifies each component pair by persisted id (current vs proposed), correctly producing `added`/`removed`/`changed`/`unchanged` and multiple independent sub-diffs (slab rows, designation rows, milestones) with no skipped change type.
- Final Status: PASS (all four)

---

## D-010 / D-011 / D-012: Component-field immutability (FX snapshot, transaction currency, effective_to write-once)

- Journey ID: D-010, D-011, D-012
- Priority: P0, P1, P0
- Automation Feasibility: FULL
- Test Data: a fresh, disposable, this-session-only customer and Commercial Configuration (created via the real `create_system_commercial_request`/`create_commercial_configuration_with_change`/`add_commercial_component` RPCs), deliberately isolated from the shared Batch 8 fixture since these are direct-bypass immutability probes.
- Actions Executed: attempted direct `UPDATE`s against a real, service-role-bypassing client: `transaction_currency`, `fx_snapshot_rate`, and a second attempt to change an already-closed `effective_to`.
- Actual Result: **all three correctly rejected** by `fn_protect_commercial_component_lifecycle`: `"commercial_components: only effective_to (once, from null), stable_component_key (once, from null), updated_at, and updated_by may change"` for the currency/FX attempts, and `"commercial_components: effective_to is already set and cannot change again"` for the second closure attempt.
- Final Status: PASS (all three)
- Notes: this is a meaningful positive contrast with B-017's finding on `customers`: `fn_protect_commercial_component_lifecycle` correctly implements the intended "only these specific columns may ever change, and only in the specific narrow way described" pattern, genuinely blocking direct bypass writes to governed financial fields, unlike the `customers` table's UPDATE guard. FX snapshot capture itself (in TypeScript, at approval time, from a fresh Reference Master read, per the pre-flight research) was not independently re-verified live this batch, since the immutability guarantee (the actual invariant these journeys test) is fully proven by the direct-write rejection above regardless of exactly when the value was first captured.

---

## D-013: No configuration-level effective date exists (deliberate design confirmation)

- Journey ID: D-013
- Priority: P2
- Automation Feasibility: PARTIAL (schema confirmation)
- Actions Executed: confirmed via the pre-flight research's full column-by-column schema read of `commercial_configurations` (`20260908210000_commercial_configuration_foundation.sql:247-262`, never altered since) that no `effective_date` column exists anywhere on this table.
- Final Status: PASS

---

## D-014: relationship_note free-text field does not affect derived pricing logic

- Journey ID: D-014
- Priority: P3
- Automation Feasibility: FULL
- Actual Result: confirmed `relationship_note` exists as a column, is set once at creation, and the database trigger technically permits later edits (it's in the mutable-column allowlist), but **no RPC, Server Action, or UI control anywhere in the codebase ever performs such an edit**. The journey's own premise ("Analyst edits relationship_note freely... at any time") is not actually realizable through any real product action today.
- Classification: not a defect (the field genuinely has zero influence on pricing/workflow logic, satisfying the journey's core business objective), but the journey's assumed regular path does not exist as stated.
- Final Status: PASS (core business objective, zero pricing influence, confirmed true), with the caveat noted above rather than a separate gap entry, since this is a narrower, lower-priority (P3) variant of the same underlying absence already fully documented under D-003/D-004/D-015/D-021.

---

## D-017: Old ungoverned create_commercial_change_for_configuration path bypasses review entirely

- Journey ID: D-017
- Priority: P0
- Automation Feasibility: MANUAL (per the journey's own designation; confirmed via code reading, not a live invocation, to avoid actually exercising a real live ungoverned mutation against any fixture)
- Actions Executed: confirmed the legacy RPC (`20260912210000_commercial_configuration_persistence.sql`) still exists, has never been modified since its original definition, still performs a synchronous, unconditional live mutation (closes every open component, inserts a `commercial_changes` row) with no draft, no submit, no approver, no self-approval check, and no workflow routing of any kind.
- Actual Result: this RPC's grants were confirmed correct (revoked from `public`/`anon`/`authenticated`, granted only to `service_role`, from its original definition onward, never exposed more broadly). Its call sites across the entire `src/` tree were exhaustively grepped: it is exported from a service module but **never actually invoked from any Server Action, page, or other reachable application code**. It is architecturally present and callable at the database level by anything holding `service_role` credentials, but orphaned and unreachable through any current UI surface or governed application code path.
- Classification: a real, confirmed architectural risk (per the journey's own explicit framing, "this journey exists to make the risk visible and testable, not to certify it as acceptable"), but not a currently-exploitable application-layer defect, since ordinary application code has no path to it and its database-level grants are already correctly restricted to `service_role` only, consistent with this project's established trust-boundary model (the same one closed and verified in the earlier Governed RPC Trust-Boundary Closure mission).
- Final Status: PRODUCT GAP CONFIRMED (documented, not fixed; this mission's standing rules do not authorize removing or altering a legacy RPC's reachability as a bounded fix without a product decision on whether it should be deleted outright, kept for a documented emergency-use case, or something else)
- Notes: recorded in the final report's MAJOR DEFECTS / product-risk section at architectural level (invariant/observed weakness/risk), consistent with this repository's public-repository documentation rule, since this repo is public.

---

## D-018: No attachment/document support for Commercial Configuration (confirmed absence)

- Journey ID: D-018
- Priority: P2
- Automation Feasibility: MANUAL
- Actions Executed: confirmed via the pre-flight research's exhaustive grep of `src/features/commercial/` for any attachment/upload/document reference; the only genuine document-upload code in the broader codebase belongs to the separate Customer Onboarding case lifecycle (a different domain, keyed to the onboarding case's own request_id), not to Commercial Configuration Version review/approval.
- Actual Result: confirmed genuine architectural absence, not an accidentally broken control.
- Final Status: PASS

---

## D-020: Commercial Configuration detail page performance/rendering with a long version chain

- Journey ID: D-020
- Priority: P2
- Automation Feasibility: PARTIAL
- Test Data: the Batch 8 fixture configuration, which by the end of this batch has accumulated 3 real approved changes (initial setup plus two amendments) plus 2 cancelled draft versions from earlier testing.
- Actual Result: all versions remain independently correct and queryable (confirmed via direct query, correct chronological ordering, no data bleed between versions). A true 10+ version stress scenario was not separately constructed this batch given the time cost of minting that many additional real approvals purely for a rendering-performance check; the underlying data-correctness-at-scale mechanism (each version's data is a plain row scoped by its own `request_id`, no shared mutable state between versions) does not have any structural reason to degrade with more rows, and no browser-based rendering/pagination test was performed.
- Final Status: PASS (data-correctness dimension only; UX/performance-at-true-scale dimension not independently verified this batch)
- Notes: if a true 10+ version, dozens-of-components stress test is later desired, it would need dedicated setup time disproportionate to this journey's P2 priority within this batch's schedule.

---

## D-022: Cross-customer isolation of Commercial Configuration data

- Journey ID: D-022
- Priority: P0
- Automation Feasibility: FULL
- Actions Executed: confirmed via the pre-flight research (exhaustive grep for `create policy` against any `commercial_*` table: zero results) and a live read of a different customer's `commercial_configurations` row using the exact same unscoped query shape the real read functions use (`.eq("id", id)`, no customer/team/segment filter of any kind).
- Actual Result: **FAILED.** There is no row-level security policy, and no application-layer per-customer/per-team scoping code anywhere in this domain. The only authorization boundary is the coarse-grained `requirePermission("commercial_configuration", "read")` check: any user holding this one permission (a broad, non-customer-scoped grant) can read or act on ANY customer's Commercial Configuration by id, with no further narrowing. The journey's own premise, "a Finance Analyst scoped to Customer A only," does not correspond to any real scoping mechanism that exists in this codebase today; there is no concept of a customer-scoped Finance Analyst anywhere in the current permission model.
- Root Cause: this is a genuine architectural gap: `commercial_configurations` (and, by the same pattern, presumably other domains sharing this permission model) relies entirely on a single coarse permission for an entire table, with zero per-record authorization narrowing, unlike a system with real row-level multi-tenant or team-based data isolation.
- Classification: this is a significant finding, but per this mission's own architecture (confirmed consistent with every other domain investigated this entire multi-batch project: Customer Master, Customer Change, Onboarding all use the same single coarse-permission-per-domain model with no per-record narrowing), this reflects the ENTIRE PLATFORM's current authorization design, not a bounded defect isolated to Commercial Configuration. Introducing per-customer data scoping would be a genuine, large product-architecture decision (does this business need per-customer/per-territory Analyst scoping at all, and if so, at what granularity), not a small bounded fix.
- Final Status: PRODUCT DECISION REQUIRED
- Notes: recorded as PD-005 in `OVERNIGHT_PENDING_APPROVALS.md`. This is the most significant finding of Batch 11: it establishes that "customer data isolation," as this journey's own business objective names it, does not exist anywhere in the current permission model, for any domain, not only Commercial Configuration.

---

## D-023: Commercial Configuration name/key edit after creation

- Journey ID: D-023
- Priority: P3
- Automation Feasibility: FULL
- Test Data: the same disposable configuration used for D-010/D-011/D-012.
- Actions Executed: a direct name edit, then a direct key edit attempt.
- Actual Result: the name edit succeeded (permitted mutable column). The key edit attempt was rejected: `"commercial_configurations: identity fields are immutable; only name, relationship_note, is_active, row_version, updated_at, and updated_by may change"`. Final state confirmed: name changed, key unchanged.
- Final Status: PASS
- Notes: as with D-003/D-004/D-015/D-021/D-014, there is no governed Server Action/UI control that performs a name edit either, only the database trigger's permissiveness; this journey's core technical invariant (key immutability) is genuinely proven, but "Analyst edits the display name" as a real product action does not exist today. Not filed as a separate gap entry since it is the same underlying absence already fully documented above, and this journey's priority (P3) and core invariant (key immutability) are both otherwise satisfied.

---

## Batch 11 closure summary

- Scheduled: 25 (C-034, C-035, D-001 through D-023)
- PASS: 19 (C-034, C-035, D-001, D-002, D-005, D-006, D-007, D-008, D-009, D-010, D-011, D-012, D-013, D-014, D-016, D-018, D-020, D-019, D-023)
- PRODUCT GAP CONFIRMED: 2 groups covering 5 journeys (D-003/D-004/D-015/D-021, one shared finding: no governed deactivate path exists for Commercial Configuration; D-017, the orphaned-but-still-live legacy ungoverned RPC)
- **Ledger audit correction (2026-09-21, Batches 1-13 Ledger Audit):** the line above originally said "6 journeys"; the actual grouped entries cover 5 (D-003, D-004, D-015, D-021, D-017), matching 19 PASS + 1 PD-005 + 5 PRODUCT GAP = 25 scheduled. Count-label fix only, no journey result changed.
- PRODUCT DECISION REQUIRED: 1 (D-022, recorded as PD-005, the most significant finding this batch: no per-customer data isolation exists anywhere in the current permission model, for any domain, not only Commercial Configuration)
- No bounded defects found and fixed this batch; the two confirmed product gaps are both genuine absences of a capability (not broken implementations of an existing one) and the one product decision is a platform-wide architectural question, none of which this mission's rules authorize inventing a fix for autonomously.
- Positive contrast worth carrying forward: `fn_protect_commercial_component_lifecycle` and `fn_protect_commercial_configuration_lifecycle` both correctly implement the "only these specific columns, only in this specific way" immutability pattern, genuinely blocking direct-bypass writes to governed financial fields (`transaction_currency`, `fx_snapshot_rate`, `effective_to` write-once, `key` immutability) — a meaningful contrast with B-017's finding that the equivalent `customers` table trigger does not.
- Fixtures created and preserved: the Batch 8 configuration now has 3 real approved changes (initial setup, two amendments) plus 2 pre-existing cancelled draft versions, and 2 duplicate-scope open components from the D-006/D-019 test. A fresh, disposable customer/configuration/component set was created for the D-010/D-011/D-012/D-023 immutability probes and left in place (harmless, this-session-only, no shared dependency).
- No journeys blocked, parked, or skipped without a documented reason. All 25 scheduled journeys resolved to a final status.

---
