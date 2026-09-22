# Nexus Journey Universe Expansion Audit

Stage A3 to A9 of the Batch 16 to Batch 17 transition. Produced by reading
(not re-executing) `docs/NEXUS_JOURNEY_UNIVERSE.md`, `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`,
`docs/NEXUS_JOURNEY_COVERAGE_MATRIX.md`, `docs/AUTHORIZATION_MODEL.md`,
`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`, `docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md`,
`docs/API_INTEGRATION_ARCHITECTURE.md`, `docs/TECH_DEBT.md`, all of
`docs/journey-runs/BATCH_01_RESULTS.md` through `BATCH_16_RESULTS.md`,
`BATCHES_01_13_LEDGER_AUDIT.md`, `PRODUCT_GAP_TRIAGE_BATCHES_03_06.md`,
`OVERNIGHT_PENDING_APPROVALS.md`, `OVERNIGHT_RUN_REPORT_BATCHES_08_13.md`,
and `MORNING_CATCHUP_AFTER_BATCHES_08_13.md`.

## Scope and method

Batches 1 through 16 (785 executed journeys plus fixture/closure work) were
mined for durable business behaviours, control invariants, edge conditions,
and cross-domain interactions not adequately represented in the canonical
Journey Universe. Every explicit item on the standing checklist (Onboarding,
Commercial Configuration/Change, Authorization, Go Live, Entitlement) was
inspected for permanent coverage. Beyond the checklist, every batch's own
incidental findings, product gaps, and product decisions were reviewed.

Not every one-line note earns a table row. Findings that are already fully
captured in their own existing journey's text with no undocumented business
behaviour left over (for example: `customer_change_requests.row_version`
being unwired but harmless (C-032), the `is_recurring` boolean collapsing a
3-way distinction for future BI purposes only (F-007), or automated
test-coverage gaps with no product-behaviour gap behind them (F-009,
F-011)) were reviewed and required no action. They are not listed as
separate candidates below; this is a deliberate application of "do not
assume every defect deserves a permanent journey," not an oversight.

## Candidate table

| Candidate | Origin batch/finding | Current coverage | Classification | Proposed change | Reason |
|---|---|---|---|---|---|
| Onboarding creator-only draft visibility | Batch 7 A-036, PD-001 | A-036 | ALREADY COVERED | None | A-036 already documents creator-only draft read, decided and implemented. |
| Onboarding backdated effective_date requires BU Head + Finance Head dual approval | Batch 8 A-034, PD-002 | A-034 (original finding only) | EXPAND EXISTING JOURNEY | A-034: add the dual-approval exception variant (`onboarding_effective_date_exceptions`, `approve_onboarding_effective_date_exception`) and the atomicity requirement (exception row must survive independent of the raising error's own rollback) | A-034 only documents the original absence of validation; the actual decided and implemented behaviour (dual sign-off exception, not a hard block) is a materially different, more specific business rule that belongs in the same journey's Regular Path and Audit/Data Integrity Checks. |
| Commercial Configuration Version creation blocked for inactive customer | Batch 9 B-011, PD-003 | B-011 (documents the gap, not the fix) | EXPAND EXISTING JOURNEY | B-011: flip Regular Path/Expected Business Result from "not blocked" to "blocked with a friendly `commercial_version_customer_inactive` error", and add the create-and-redirect route's graceful-catch UX as its own checked variant | B-011's own title still reads "Known gap"; the gap is closed and the current behaviour is the opposite of what the entry says. Preserving history means adding the decided/implemented outcome, not silently rewriting the title. |
| In-flight Customer Change completes even after customer deactivation | Batch 10 C-030, PD-004 | C-030 | ALREADY COVERED | None | C-030 already documents this as decided, intentional current behaviour, with a regression test guarding it. |
| Cross-customer/BU/Territory/Customer scoped authorization | Batch 11 D-022, PD-005 | D-022 (documents total absence only) | EXPAND EXISTING JOURNEY | D-022: add four explicit tier variants (Global, Business Unit, Territory/Geography via `customers.country`, specific Customer) now that `docs/AUTHORIZATION_MODEL.md` §5 documents all four as real and enforced, plus the list/search and shared-queue filtering dimension already covered for the five named domains | D-022 as written describes a total absence ("the most significant finding of the entire run"); the absence is now closed and replaced by a real four-tier model. The journey needs to test the model that exists today, not only the gap that used to exist. |
| Go Live domain not yet extended to full BU/Territory/Customer scoped authorization | Batch 11 go-live authorization follow-up (pre-Batch 14), `docs/AUTHORIZATION_MODEL.md` §18 | Not covered; tracked only in `docs/TECH_DEBT.md` | FUTURE MODULE | Add to future-module backlog: full customer-scope authorization for Go Live, once PD-005's tier model is extended to a sixth domain | The specific information-disclosure bug (customer names leaking in shared queues regardless of go_live permission) was fixed using the existing PD-005 visibility filter. Full per-tier scoping for Go Live itself (matching the other five domains) was never built and remains open, tracked tech debt, not a live defect. |
| Correction category exempted from effective-date ordering guard | Batch 12 E-015, PD-006 | E-015 | ALREADY COVERED | None | E-015 already documents the original finding and the first-phase decision. |
| Correction may move a component's own historical start date backward | PD-006 Phase 4 final business decision, migration `20260930150000` | Not covered under any existing ID | NEW JOURNEY REQUIRED | Allocate E-029: correction category retroactively moves `effective_from` backward, inserting a new row to cover the gap while the original row stays immutable | This is a materially distinct, newly-decided capability from E-015's original scope (which was only about exemption from an ordering guard, not about rewriting a historical start date). It deserves its own canonical journey. |
| Intermediate-history correction must not silently overlap already-covered territory | PD-006 Phase 4 live-retest defect, migration `20260930160000` | Not covered under any existing ID | NEW JOURNEY REQUIRED | Allocate E-030: a second, deeper correction against a stable_component_key with existing corrected history is rejected with `COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY` rather than producing overlapping rows | A real defect (two overlapping `commercial_components` rows for the same key) was found and fixed here; the control invariant it establishes (no silent overlap across correction passes) is durable and distinct from E-029's row-insertion mechanism. |
| Approval must reject an effective date exactly one day after an open component's own start | Batch 14 defect #3, migration `20260930190000` | Not covered under any existing ID | NEW JOURNEY REQUIRED | Allocate E-031: zero-length/adjacent-date period protection, raising `COMMERCIAL_VERSION_EFFECTIVE_DATE_ADJACENT_TO_OPEN_COMPONENT_START` with a friendly message instead of a raw constraint violation | This is a distinct boundary condition from E-029/E-030 (it is about the new component's date being adjacent to, not inside, existing history) and was found live during unrelated MUG re-evaluation testing (G-026), so it has no journey of its own today. |
| Ordinary amendment approval must remain correct after PD-006 redefined the shared approval function | Batch 14 defect #2, migrations `20260930170000` / `20260930180000` | Not covered under any existing ID | REGRESSION TEST ONLY | No Journey Universe entry; keep as an automated regression test guarding `approve_commercial_configuration_version`'s history-resolution ordering | This is a regression in a shared implementation detail (a function reading its own just-closed rows) triggered by an unrelated feature change, not a new business behaviour. Ordinary amendment approval itself is already covered by existing D/E-pack journeys. |
| Fractional slab quantities span band boundaries correctly | Batch 14 G-019 | G-019 | ALREADY COVERED | None | Fixed and already the subject of its own journey plus regression tests. |
| MUG threshold-only edit preserves historical commitment evaluation guards | Batch 15 G-026 | G-026 | ALREADY COVERED | None | Already documented; the three date guards it surfaced live are separately captured as E-029/E-030/E-031 above. |
| Non-recurring/milestone-based revenue recognition method must not imply real posting in the UI | Batch 12 E-019 | E-019 (documents an unescalated open question, never independently browser-verified) | NEW JOURNEY REQUIRED | Allocate E-032: live-verify that UI copy for `full_recognition`/`milestone_based` methods reads as "agreed structure" documentation, not as an implied real revenue-recognition posting, consistent with the platform rule against faking persistence or approval | E-019 explicitly disclosed this as "not independently verified via a live browser render." Given CLAUDE.md's standing rule that the system must never show a control that looks real but does nothing real behind it, this deserves a dedicated, live-verified journey rather than staying an open note inside E-019. |
| Zero-length designation rates array is accepted through to submission | Batch 13 E-022 | E-022 (code-reading only, explicitly "PARTIAL" evidence) | EXPAND EXISTING JOURNEY | E-022: add the missing live-submission verification step so the classification can move from code-reading-supported to fully live-verified | E-022 already exists and is already classified PRODUCT GAP CONFIRMED; it is missing only the live-verification step the batch itself flagged as not performed, not a new business behaviour. |
| Go Live creator-only Save/Submit/Cancel ownership | Batch 16 H-027 | H-027 | ALREADY COVERED | None | Fixed and regression-tested against the same PD-001 pattern. |
| Go Live optimistic row-version conflict on concurrent draft edits | Batch 15 H-004, H-005 | H-004, H-005 | ALREADY COVERED | None | Already documented and live-verified. |
| Timeline must never label an in-progress multi-node approval as final/Live before the terminal node is actually reached | Batch 15 H-020 defect | H-020 (Go Live only; root cause is shared code) | NEW JOURNEY REQUIRED | Allocate AA-023: verify Onboarding, Customer Change, and Commercial Configuration Timelines do not exhibit the same premature-terminal-wording defect that H-020 found and fixed for Go Live, since only the Go Live detail route currently passes `terminalApprovalDetail`/`isRequestFinalized` into the shared `buildWorkflowTransitionEvents` function | H-020's own fix note states the root cause is shared across all four Workflow Runtime V1 domains, but only Go Live's route was fixed and reverified. The other three domains have not been confirmed either way. This is a real, unverified risk, not a settled fact, and it is inherently cross-domain. |
| Go Live direct mutation bypass protection (`fn_protect_go_live_requests_lifecycle`) | Batch 16 H-043 | H-043 | ALREADY COVERED | None | Fixed and regression-tested. |
| Stale workflow node rejected on approve | Batch 15 H-015 | H-015 | ALREADY COVERED | None | Already documented and live-verified. |
| Decision-node routing resolved once and stable across send-back/resubmit | Batch 15 H-022 | H-022 | ALREADY COVERED | None | Already documented and live-verified. |
| Approval idempotency (no-op on already-approved) | Batch 15 H-017 | H-017 | ALREADY COVERED | None | Already documented and live-verified. |
| Cancellation status guards across sent-back/submitted/approved | Batch 16 H-024, H-025, H-026 | H-024, H-025, H-026 | ALREADY COVERED | None | Already documented and live-verified. |
| `go_live_requests.request_number` has no explicit unique index, unlike the sibling `customer_change_requests.request_number` | Batch 16 H-039 | H-039 (journey itself PASS; hardening tracked separately) | REGRESSION TEST ONLY | No new Journey Universe entry; hardening tracked in `docs/TECH_DEBT.md` ("Now" tier) per the Stage A1 reconciliation already completed | Proven not live-exploitable (Postgres sequences are themselves race-safe); this is defense-in-depth consistency debt, not a business-behaviour gap. |
| Concurrent creation of two Go Live requests for the same `stable_component_key` (creation-time TOCTOU) | Batch 15 pre-execution research note (H-001 area) | Not covered under any existing ID | NEW JOURNEY REQUIRED | Allocate H-044: fire concurrent `create_go_live_request` calls against the same `stable_component_key` and confirm whether the uniqueness guard (enforced only at the UI route layer, not by any database constraint or RPC-level check) actually holds under real concurrency | Explicitly flagged in Batch 15's own text as "a genuine TOCTOU race... tracked as a candidate incidental finding, not exercised as a scheduled journey." Never resolved one way or the other. |
| Append-only revocation invariant is a platform-wide pattern, not a single-table quirk | Batch 4 N-010, N-022; Batch 16 H-040 | N-010, N-022, H-040 individually; no journey states the pattern as a single cross-cutting invariant | NEW JOURNEY REQUIRED | Allocate AB-042: a single cross-cutting journey asserting that every grant/revocation-history table in the platform (`user_roles`, `role_permissions`, `user_teams`, and any future one) shares the same rule, revocation is permanent and one-directional, recovery is always a fresh row, never a reactivation | Three independent findings across three different tables and three different batches (N-010/user_roles, N-022/role_permissions, H-040/user_teams) all discovered the identical mechanism piecemeal. Recording it once, explicitly, as a named platform invariant is more durable than three separate incidental notes and protects against a future table silently missing the same protection. |
| `user_teams` append-only revocation (individual finding) | Batch 16 H-040 | H-040 | ALREADY COVERED | None (evidence folded into AB-042 above) | H-040 itself already correctly documents this as expected, intentional behaviour. |
| Commercial Configuration has no deactivate/reactivate capability at all | Batch 11 D-003, D-004, D-015, D-021 | D-003, D-004, D-015, D-021 (rewritten to test the decided permanent absence) | EXPAND EXISTING JOURNEY | **Product Decision Closure (2026-09-22): DECIDED.** Commercial Configuration will NOT gain an independent deactivate/reactivate lifecycle. Customer lifecycle (`customers.is_active`) is the sole mechanism governing whether a commercial relationship remains operational. D-003/D-004/D-015 rewritten in `docs/NEXUS_JOURNEY_UNIVERSE.md` to test the permanent absence going forward; D-021 re-scoped to the customer-lifecycle version of its underlying concern (near-duplicate of PD-004/C-030, classified REGRESSION TEST ONLY). | Was the one item across the entire 40-candidate audit still genuinely open. Now closed alongside I-015 and I-024 (Batch 17's two product gaps) in the same closure pass. See `docs/journey-runs/BATCH_11_RESULTS.md` for the preserved historical finding and its own appended closure note. |
| Legacy ungoverned `create_commercial_change_for_configuration` RPC, orphaned but reachable by `service_role` | Batch 11 D-017; Batch 12 E-020 | D-017, E-020 (document the risk; not fixed, not deleted) | REGRESSION TEST ONLY | No new Journey Universe entry; already correctly recorded as a confirmed-but-not-currently-exploitable architectural risk in the existing journeys | Never invoked from any reachable application code; fixing this means either wiring it into governed workflow or deleting it, which is an engineering cleanup decision, not a new durable business behaviour to test. |
| `pricing_rule_parameters` has no DB-level numeric validation (negative/zero rate acceptable via direct RPC) | Batch 13 F-014 | F-014 (documents the gap; explicitly a deliberate, already-commented architectural deferral) | FUTURE MODULE | Add to future-module backlog: DB-level pricing-parameter validation, deferred by the migration's own comment to "the domain service / Pricing Kernel" | The migration author already documented this as a deliberate deferral to a not-yet-built Pricing Kernel, not a silent oversight. This matches the future-module bucket exactly. |
| Keyboard accessibility: required fields do not consistently expose `aria-required` | Batch 8 ACC-001 addendum | Not covered; only ACC-001 (skip-to-content) exists in the Accessibility pack | NEW JOURNEY REQUIRED | Allocate ACC-002: required form fields (starting with the Country combobox found during ACC-001) consistently expose `aria-required="true"` to assistive technology | ACC-001 fixed and covers only the skip-to-content finding; the aria-required finding was explicitly disclosed as "flagged but not fixed, scope judged broader than this one journey" and has never been picked up since. It is a materially distinct accessibility control from ACC-001. |
| Zero-active-member workflow team silently blocks an entire approval path (recurring environment condition) | Batch 8 A-027 (synthetic); Batch 9 (real, before C-001) | A-027, C-025 (both already document the mechanism) | REGRESSION TEST ONLY | No new Journey Universe entry; note stands as a recommendation for periodic WF-TEST team-membership health checks in the test environment itself, not a product journey | This is a test-fixture/environment-hygiene observation ("the second time this run a zero-active-member team has silently blocked an entire approval path"), not a Nexus product behaviour distinct from what A-027/C-025 already test. |
| Unbounded `getCurrentNexusSession` hang if `supabase.auth.getUser()` never settles | Batch 6, DEFECT-B6-001 | Not tied to any scheduled journey ID | REGRESSION TEST ONLY | No new Journey Universe entry; keep as the automated regression test already added around the `withTimeout` wrapper | A bounded-timeout implementation detail on an infrastructure call, not a distinct business journey. |
| Manual Entitlement Source creation independent of Go Live state | Batch 16 I-001 | I-001 | ALREADY COVERED | None | Already documented and live-verified. |
| Entitlement schedule generation gated on relevant Go Live state (`USAGE_BEFORE_GO_LIVE` boundary) | Not yet executed; already scheduled | I-006 through I-030 (Batch 17, per the pre-audit execution plan) | ALREADY COVERED | None | This is already on the books for Batch 17 in the existing execution plan; it is scheduled work, not an undiscovered gap. |
| Entitlement allocation schedule anchored at Go Live month, not invoice date | Batch 16 I-005 | I-005 | ALREADY COVERED | None | Already documented and live-verified. |
| API-sourced Entitlement creation is out of current product scope | Batch 16 I-003; Stage A2 (this pass) | I-003 | ALREADY COVERED | None | Already resolved: PRODUCT GAP -> PRODUCT DECISION MADE -> FUTURE MODULE, per the Stage A2 work completed immediately before this audit. |
| Import/Bulk-sourced Entitlement creation is out of current product scope | Batch 16 I-004; Stage A2 (this pass) | I-004 | ALREADY COVERED | None | Same as I-003 above; decided together, same root cause. |

## Reconciliation count table

| Category | Count |
|---|---|
| Candidate discoveries reviewed | 40 |
| ALREADY COVERED | 20 |
| EXPAND EXISTING JOURNEY | 4 |
| NEW JOURNEY REQUIRED | 8 |
| REGRESSION TEST ONLY | 5 |
| FUTURE MODULE | 2 |
| PRODUCT DECISION REQUIRED | 1 |

20 + 4 + 8 + 5 + 2 + 1 = 40. Reconciles exactly against the 40 rows in the
candidate table above.

## New journey IDs allocated by this audit

Allocated at the next contiguous ID within each pack, per
`docs/NEXUS_JOURNEY_UNIVERSE.md`'s own per-pack numbering (verified by
scanning every `### <PACK>-NNN` heading directly, since the document's own
Pack index summary table is known to be stale for two packs already, see
below):

- E-029, E-030, E-031, E-032 (Commercial Change pack; prior max E-028)
- H-044 (Go Live pack; prior max H-043)
- AA-023 (Cross-Domain Customer Lifecycle pack; prior max AA-022)
- AB-042 (Security / Direct Action / Server Enforcement pack; prior max AB-041)
- ACC-002 (Accessibility pack; prior max ACC-001)

No existing journey ID was renumbered. No Batch 1 through 16 scheduled
count or historical result was changed. These eight new journeys are not
inserted into any historical batch; they are placed into the future
execution plan per Stage A10 (see `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`).

## Note on the Journey Universe's own Pack index table

While allocating IDs, this audit confirmed (by scanning every `### <PACK>-NNN`
heading directly rather than trusting the summary table) that the Pack
index table near the top of `docs/NEXUS_JOURNEY_UNIVERSE.md` already
understates two packs: Pack A is listed as 35 journeys but the actual
highest ID is A-036 (added Batch 7, per the document's own inline tag);
Pack AB is listed as 40 but the actual highest ID is AB-041 (added Batch 7
closure). This predates this audit and is a pure counting-label
correction, not a reclassification of any journey; it is fixed in the same
pass as the new pack-count updates below, alongside this audit's own eight
additions.
