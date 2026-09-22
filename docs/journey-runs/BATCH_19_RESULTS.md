# Batch 19 Journey Run Results

Journeys I-031 through I-038 (Entitlement completion), J-001 through J-017 (Workflow Runtime depth: node-type-specific
behavior, decision-node equals/not_equals/fallback, the 10-hop bound). 25 journeys.

Per the standing Nexus journey-execution rules: manual UX verification is primary truth; server-side control
verification (direct RPC / SQL inspection) is mandatory alongside UI verification, not a substitute for it;
classification taxonomy is PASS, FAILED THEN FIXED + PASS, EXPECTED BEHAVIOUR, PRODUCT GAP, PRODUCT DECISION,
DEFERRED.

## Personas and fixtures

`wf-test.maker@example.test` (Finance Admin, full write access). Reused: `wf-test-pd-002-case-b-8b2e154f` (Linear
line item, live since Sep 2027), `test-sql-smoke-co` (Linear line item, no MUG), `wf_test_commercial_segment`
workflow (Decision node keyed on `segment`, bound to `commercial_configuration`), `wf_test_empty` (permanently
zero-member team, Batch 8), Legal team + `wf-test.legal-checker@example.test` (Batch 5/16 mid-flight-revocation
precedent).

## Pre-execution research

Two parallel research passes completed before live execution (see conversation grounding); key findings:

- I-031: allocation anchor month is resolved entirely from `lineItem.currentRequest` (`currentGoLiveRequestForLineItem`,
  which finds the sole `approved` row), never a stale cancelled one; `generate_allocation_schedule` itself has no
  anchor logic, it persists already-computed values. Safe by construction since the `20261003000000` uniqueness fix
  guarantees at most one non-cancelled request per component.
- I-032: legacy `usage_facts`/`earned_results` tables exist but are structurally unconnected to Entitlement (no FK,
  no shared code path) and their own read-model (`finance-activity.ts`) is not wired to any route.
- I-034/I-035: confirmed by code inspection that `create_entitlement_source` has zero duplicate-invoice-reference
  check and zero metric-vs-component validation; both are discovery journeys per their own definition, not asserting
  a specific expected outcome.
- I-038: `record_settlement`'s rejection of a second settlement against a fully-settled entry is purely arithmetic
  (`SETTLEMENT_EXCEEDS_OUTSTANDING`, same token as ordinary over-settlement), not a dedicated "already settled"
  message.
- J-series: `fn_resolve_workflow_next_approval`'s hop bound is exactly 10; `WORKFLOW_GRAPH_DEAD_END` is raised by the
  calling approve RPC (not the resolver itself) when the resolver returns zero rows against a non-null current node.
  `fn_require_workflow_team_membership` never checks `teams.is_active`. `fn_workflow_node_team` is a direct point
  lookup keyed on the request's own bound `workflow_version_id`, never a graph walk. **J-007/J-008's premise is
  stale**: `customer_onboarding` and `customer_change` now both populate a real `segment` decision context (added by
  later migrations after these journeys were drafted); only `go_live` still always passes `{}`.

## I-031: New Go Live Approval After Prior Cancellation Re-Anchors Allocation

- Regular Path / Stress Variant (delay): confirmed via direct SQL against `wf-test-pd-002-case-b-8b2e154f`'s Linear
  line item, which carries the exact prior-cancellation-then-reapproval history live (`GLR-000014` cancelled,
  `go_live_date = 2027-03-01`; `GLR-000015` approved, `go_live_date = 2027-09-01`): both entitlement sources ever
  generated against this component (`ES-000004`, `ES-000005`) anchor at `2027-09-01`, the approved request's date,
  never the cancelled request's `2027-03-01`.
- Stress Variant (acceleration, cancelled-later/approved-earlier): not independently reproduced live. Code
  inspection confirms the anchor resolution (`lineItem.currentRequest.goLiveDate`, sourced from
  `currentGoLiveRequestForLineItem`) has no directional comparison logic at all; it is a flat "read the one current
  approved request's date" lookup with nothing to branch on "earlier vs later," so the delay scenario's live
  confirmation structurally covers the acceleration direction too.
- Server-side control verification: `generate_allocation_schedule` itself has no anchor logic (pure persister of
  already-computed values); anchoring safety is additionally guaranteed by the `20261003000000` partial unique
  index (`uq_go_live_requests_active_component`), which makes more than one non-cancelled request per component
  impossible, so there is never an ambiguous "which approved row" question.
- Classification: **PASS**.

## I-032: Coexistence Flag, Legacy Commercial Usage Fact vs New Entitlement Ledger

- Regular Path: confirmed via code inspection that `usage_facts`/`earned_results`/`earned_result_usage_facts`
  (Commercial's own, older revenue-recognition-evidence tables) have zero FK, shared write path, or code reference
  from anywhere in `src/features/entitlement/`. Their own read-model (`finance-activity.ts`) is not wired to any
  `src/app` route at all, so there is currently no live UI surface where the two systems' "usage" terminology could
  even appear side by side to confuse a user.
- Stress Variant: since no report or UI naively sums both systems (neither is exposed together anywhere), the
  double-counting risk the stress variant probes for has no current reachable surface.
- Classification: **PASS**.

## I-033: Invoice Duration Months Drives Schedule Month Count

- Regular Path: confirmed via SQL that both existing active 12-month sources (`ES-000001`, `ES-000006`) have exactly
  12 schedule rows each.
- Stress Variant (duration=1): live-created a fresh source (`ES-000007`, duration 1) via the real UI, generated its
  schedule; SQL confirmed exactly 1 row, month `2026-09-01`, matching the preview's own "Sep 2026 through Sep 2026"
  display.
- Stress Variant (duration=60): not independently reproduced live. Code inspection of `allocateEvenly`/`monthRange`
  confirms the month-count formula (`end = start + (monthCount-1)`, inclusive both ends) has no hardcoded upper
  bound and is not duration-value-dependent; the same code path already confirmed exact at both 1 and 12 covers 60
  identically.
- Classification: **PASS**.

## I-034: Duplicate Invoice Reference Handling on Source Creation

- Regular Path: live-created a second entitlement source against `test-sql-smoke-co`'s Linear component using the
  exact same `invoice_reference` as an existing active source (`ES-000006`). Accepted with no error, no warning, no
  UI indication of the pre-existing match. Confirmed via code inspection that `entitlement_sources.invoice_reference`
  carries no UNIQUE constraint (DB layer) and `create_entitlement_source` performs no pre-check `select` (RPC layer)
  before insert.
- Classification: **PRODUCT GAP CONFIRMED**. Whether duplicate invoice references should be blocked, warned, or left
  alone is a genuine business-policy question (same invoice number reused across customers is legitimate; even
  within one customer there may be valid reasons for two related entries), not a bounded bug with one obvious
  correct fix. Not invented here. Checked against prior Product Gap/Decision records and TECH_DEBT: no prior
  finding on this specific question exists; this is a new, real finding, not a rediscovery.

**PRODUCT GAP → PRODUCT DECISION → IMPLEMENTED → VERIFIED** (Product Gap Closure, post-Batch-19, 2026-09-22):

- **Business decision**: one Invoice reference must create entitlement at most once, scoped to the customer (Nexus
  has no separate legal-entity concept; `docs/MASTER_DATA_FOUNDATION_DESIGN.md` explicitly rejects one), not scoped
  globally. The same reference remains valid for two different customers.
- **Implementation**: migration `20261006000000_entitlement_source_duplicate_invoice_and_metric_checks.sql`.
  `create_entitlement_source` now does a normalized (`lower(btrim(...))`, matching the existing GST/PAN
  duplicate-detection convention in `src/features/customer-onboarding/domain/duplicate-detection.ts`) lookup against
  `entitlement_sources.customer_id` before inserting, raising `ENTITLEMENT_SOURCE_DUPLICATE_INVOICE_REFERENCE` with
  the exact conflicting source number named in the message.
- **Server-side, race-proof enforcement**: a real unique index,
  `uq_entitlement_sources_customer_invoice_reference on entitlement_sources (customer_id,
  lower(btrim(invoice_reference)))`, covers every status (not just `active`), because the already-closed decision
  that cancellation has zero effect on already-derived entitlement means a cancelled duplicate would still represent
  double-counted entitlement. The RPC's own select-based check is wrapped around the insert inside a `begin ...
  exception when unique_violation` block, so a genuine concurrent race (two requests both past the select) still
  cannot both commit: the loser hits the index, not a raw duplicate row, and receives the same named,
  human-readable error, not a generic constraint violation.
- **Historical data**: live inspection before adding the index found exactly one pre-existing duplicate pair,
  `ES-000006`/`ES-000007` on `test-sql-smoke-co` (`INV-B17-I023`), both self-created during this same batch's
  original I-034 probe. `ES-000007`'s `invoice_reference` was renamed (not deleted) to
  `INV-B17-I023-BATCH19-I034-DUPLICATE-TEST-FIXTURE` (via the migration itself, idempotent), preserving both rows
  and their schedule data as historical evidence while unblocking the constraint. No real/sensitive data existed or
  was touched.
- **Retest, live RPC**: (1) first reference (`INV-I034-TEST-001`) on `test-sql-smoke-co` succeeded, creating
  `ES-000008`; (2) the exact same reference again, same customer, rejected with the named error citing `ES-000008`;
  (2b) a case/whitespace variant (`"  inv-i034-test-001  "`) of the same reference, same customer, also correctly
  rejected, confirming normalization; (5) the same reference against a different customer
  (`wf-test-j-decision-probe`) succeeded, creating `ES-000009`, confirming the per-customer scope; (8) `ES-000006`
  (the original valid source) confirmed unchanged throughout.
- **Manual UX verification, real browser, logged in as `wf-test.maker@example.test`**: navigated to
  `test-sql-smoke-co`'s Linear component Entitlement page, opened the real "Add Invoice Entitlement" form, submitted
  `INV-B17-I023` (exact duplicate of `ES-000006`): the form surfaced the exact server error inline (`"this customer
  already has an Entitlement Source (ES-000006) using invoice reference \"INV-B17-I023\". One invoice can only
  create entitlement once."`), no server-side bypass, no silent success.
- Classification: **PRODUCT GAP → PRODUCT DECISION → IMPLEMENTED → VERIFIED**.

## I-035: Metric Mismatch Between Entitlement Source and Commercial Component's Billed Metric

- Regular Path: in the same live creation as I-034, set `metric = "Outlets"` against a component actually billed on
  `"Users"`. Accepted with no error, no warning, no pre-fill/constraint from the component's own metric. Confirmed
  via code inspection that `create_entitlement_source` performs no comparison against the component's billed metric
  at any layer (RPC, service, or UI form, which renders `metric` as a bare free-text input).
- Stress Variant (case/typo mismatch): the same total absence of comparison logic covers a case-difference mismatch
  identically to a genuine semantic mismatch; no separate reproduction needed since there is no comparison logic of
  any kind to test differently.
- Classification: **PRODUCT GAP CONFIRMED**. Same reasoning as I-034: whether/how strictly to validate metric
  consistency is a business-policy question requiring product input on the correct UX (hard block vs. warn vs.
  constrain the field to the component's known metric), not invented here.

**PRODUCT GAP → PRODUCT DECISION → IMPLEMENTED → VERIFIED** (Product Gap Closure, post-Batch-19, 2026-09-22):

- **Business decision**: an Entitlement Source's metric must match the commercial component's own billed metric;
  a mismatch is rejected.
- **Source-of-truth correction found during implementation**: the obvious candidate,
  `commercial_components.measurement_definition_id -> measurement_definitions.name`, is confirmed **never
  populated** anywhere in this database: `measurement_definitions` has zero rows and 0 of 72 live
  `commercial_components` rows have a `measurement_definition_id` set (confirmed by live query before writing any
  code). Building the check against that column would have silently never fired. The real, populated source of
  truth is `commercial_components.pricing_rule_parameters ->> 'pricingUnit'` (a Reference Master code, `list_key =
  'pricing_unit'`, e.g. `USER`), resolved to its human label (`"User"`) via `reference_options`. This is only ever
  populated for `pricing_rule_kind in ('linear', 'volume', 'graduated')`
  (`src/features/customer-onboarding/domain/commercial-rate.ts`); `flat` and `dimension` components legitimately
  have no unit, so the check is skipped for those rather than inventing a rule those types were never meant to
  carry.
- **Implementation**: same migration as I-034. `create_entitlement_source` resolves the current (`effective_to is
  null`) `commercial_components` row for `p_stable_component_key`, and when its `pricing_rule_kind` is
  linear/volume/graduated with a `pricingUnit` set, compares the resolved label against `p_metric` (both sides
  normalized: lowercased, trimmed, and a single trailing "s" stripped, since Finance's existing free-text values are
  plural, "Users", while the Reference Master label is singular, "User"; this is plain text-matching, not a new
  business rule). Mismatch raises `ENTITLEMENT_SOURCE_METRIC_MISMATCH` naming both the given and expected metric.
- **Server-side enforcement**: entirely inside the RPC; the UI's free-text `Metric` field is unchanged (still plain
  text, per this batch's explicit "do not over-scope" instruction), so there is no client-side gate to rely on.
- **Retest, live RPC**: matching metric (`"Users"` against a `pricingUnit = USER` component, resolved label
  `"User"`) succeeded (`ES-000008`, also reused for the I-034 tests above); mismatched metric (`"Transactions"`)
  correctly rejected with `ENTITLEMENT_SOURCE_METRIC_MISMATCH: metric "Transactions" does not match this
  component's billed metric "User". Use the component's own billed metric.`; the rejected attempt created no row at
  all (confirmed by a direct count query), so no schedule could ever be generated from it.
- **Manual UX verification, real browser**: submitted `metric = "Transactions"` through the real "Add Invoice
  Entitlement" form: the exact server message was shown inline, no silent acceptance. A follow-up submission with
  `metric = "Users"` (matching) and a fresh invoice reference succeeded, and the new source (`ES-000010`) appeared
  immediately in the Entitlement Sources table (screenshot evidence captured).
- **Existing valid sources unchanged**: `ES-000001` through `ES-000006`, `ES-000008`, `ES-000009` untouched; this
  check only ever applies at creation, never retroactively. `ES-000007` (pre-fix, genuinely metric-mismatched:
  `"Outlets"` against a `USER`-priced component) is left exactly as it was, as historical evidence of the original
  gap, consistent with never rewriting a preserved historical fixture.
- **Neighbouring paths unaffected**: `generate_allocation_schedule`, `submit_monthly_usage`,
  `record_settlement`/`reverse_settlement` were not touched by this migration; the full vitest suite (978 tests)
  passes after this change (see Product Gap Closure checkpoint).
- Classification: **PRODUCT GAP → PRODUCT DECISION → IMPLEMENTED → VERIFIED**.

## I-036: No Attachment Support Exists for Entitlement

- Regular Path: confirmed by repeated observation across every Entitlement page rendered during this batch and
  Batch 17/18 (Entitlement Sources, Monthly Usage, Unbilled/Unearned Ledger sections): zero upload/attach affordance
  anywhere. Confirmed via code inspection that `entitlement_sources`/`entitlement_schedule_months`/`settlement_records`
  have no file/storage-bucket reference (`entitlement_sources.document_reference` is a free-text field, not a real
  upload), and no storage-bucket migration exists for Entitlement (unlike Go Live and Onboarding, which each have
  their own document bucket migration).
- UX Check: the free-text `document_reference` field is the only "workaround," confirmed present on the creation
  form but never rendered as a link/preview anywhere, consistent with being a plain reference string.
- Classification: **PASS**.

## I-037: Entitlement Dashboard Status Reflects Derived Go Live Line Item Status

- Regular Path: live-confirmed all three reachable lifecycle stages through the Entitlement UI itself:
  **NO_GO_LIVE** (`test-sql-smoke-co`'s second Linear component) renders `Go Live Status: NO_GO_LIVE` plus a clear
  explanatory note ("An Invoice Entitlement can be recorded before Go Live, but the monthly allocation schedule
  cannot be generated until this line item has an approved Go Live request."); **GO_LIVE_PENDING**
  (`test-customer-1`'s Graduated/tiered component, a real `submitted` request) renders the same clear state and
  identical explanatory note; **LIVE** (`test-sql-smoke-co`'s primary Linear component) renders
  `Go Live Status: Live from 22-Sep-2026`. All three read from `lineItem.goLiveStatus`/`lineItem.currentRequest`,
  populated by the exact same `listCurrentLineItemsForCustomer`/`deriveLineItemGoLiveStatus` call Go Live's own
  screens use (confirmed via code inspection: the Entitlement route calls the identical function, no separate
  computation).
- Stress Variant (CANCELLED): not independently reproduced live (no line item currently sits in a fresh, unconsumed
  CANCELLED-only state in the shared database; H-030 already re-created live history for the one that used to).
  Code inspection confirms `deriveLineItemGoLiveStatus` returns the literal string `"CANCELLED"` in this case, and
  the Entitlement page's own ternary (`goLiveStatus === "LIVE" ? ... : goLiveStatus`) renders that string directly
  in its else-branch, the same code path already live-confirmed correct for the other three states.
- Classification: **PASS**.

## I-038: Fully Settled Ledger Entry Rejects Further Settlement

- Regular Path: submitted fresh usage (15 against an entitlement of 10) for a new month, producing a clean 5-unit
  unbilled entry; recorded a settlement for exactly 5 through the real UI; SQL confirmed the entry's status became
  `SETTLED`.
- Idempotency Variant: attempted a second `record_settlement` call against this now-fully-settled entry (quantity 1,
  a new reference). Correctly rejected: `SETTLEMENT_EXCEEDS_OUTSTANDING: settling 1 would exceed the 0 still
  outstanding on this entry (already settled 5)`. SQL confirmed exactly one `settlement_records` row exists for this
  entry (the original), no second row, no balance change.
- UX Check: the rejection message is the same generic `SETTLEMENT_EXCEEDS_OUTSTANDING` token used for ordinary
  over-settlement, not a dedicated "already fully settled" message; it does clearly state "0 still outstanding,"
  which communicates the terminal state accurately even without a bespoke token. Not escalated to a defect: the
  message is factually correct and clear on inspection, just not maximally distinct from the general case.
- Classification: **PASS**. The Business Objective and Expected Technical Invariant (rejection at exactly zero
  remaining balance, no negative balance possible) are both fully satisfied.

## J-001: Start Node Transparent Pass-Through on Submit

- Regular Path: confirmed via a real `submit_customer_onboarding_case` call (request `878a8686-b837-441c-8af2-4e6e3ed4c8e9`,
  see J-002 below) against a graph beginning `Start -> form_step -> ...`: `current_workflow_node_key` after submit was
  `node_6` (the Approval node), never `node_1` (Start). The `workflow_node_transitions` row recorded
  `from_node_key = null, to_node_key = node_6` directly, with no row ever written for Start itself.
- Server-side control verification: `fn_resolve_workflow_next_approval`'s own body (read in full this batch) never
  returns a `start`-typed node; the loop only `return next`s for `approval` or `end`, walking straight through `start`
  via its single outgoing edge exactly like `form_step`.
- Classification: **PASS**.

## J-002: form_step Node Is Purely Informational, Never Blocks Advancement

- Regular Path + Stress Variant (two consecutive form_step nodes): built a dedicated probe graph
  (`wf_test_j002_j016_formstep`, customer_onboarding, version `93bf14be-00e1-4ff0-ad93-c680b52c1b84`):
  `Start -> form_step -> form_step -> Decision(fallback only) -> form_step -> Approval -> End`. Created a real
  onboarding case, bound it to this graph, and called the real `submit_customer_onboarding_case` RPC. Result:
  `current_workflow_node_key = node_6` (Approval) in one call, correctly walking through both consecutive form_step
  nodes, the fallback-only Decision, and the third form_step.
- Audit/Data Integrity Check: exactly one `workflow_node_transitions` row exists for this request
  (`from_node_key = null, to_node_key = node_6`); no row for either form_step node.
- Classification: **PASS**.

## J-003: Decision Node Segment Equals Match Routes Correctly (Commercial Configuration)

- Regular Path: live end-to-end proof against the real, currently active `wf_test_commercial_segment` v2 graph
  (`3102674e-8ddb-4fd5-8141-22ebf8ef0ea0`). Created a fresh test customer with `segment = 'enterprise'` (fixed at
  insert time; the Customer Master trigger `fn_protect_customer_lifecycle` correctly blocks any later direct
  `UPDATE`, confirmed live when a first attempt to mutate an existing test customer's segment was rejected), created
  a real Commercial Configuration and a draft Commercial Change Version against it (via
  `create_system_commercial_request` / `create_commercial_configuration_with_change` /
  `create_commercial_configuration_version`, the same RPCs the real UI calls), then called the real
  `submit_commercial_configuration_version`. Result: `current_workflow_node_key = node_3`, the `segment equals
  "enterprise"` branch, not the fallback.
- Classification: **PASS**.

## J-004: Decision Node Segment Not_Equals Match Routes Correctly (Commercial Configuration)

- Regular Path + Stress Variant: built a dedicated probe graph (`wf_test_j004_notequals`, commercial_configuration,
  version `589ab609-7d78-4849-af4d-0ace0f375c6c`) with a Decision node carrying one `not_equals(segment,
  "enterprise")` edge plus one fallback edge. Verified via direct calls to `fn_resolve_workflow_next_approval` (the
  exact function `submit_commercial_configuration_version` calls internally; the real customer-segment-to-context
  wiring for this domain was already independently proven end-to-end in J-003 above) with representative context
  values: `segment = "smb"` correctly evaluated `not_equals("enterprise")` true and routed to the not_equals edge's
  target; `segment = "enterprise"` correctly evaluated it false and fell through to the fallback edge instead.
- Classification: **PASS**.

## J-005: Decision Node Fallback (Unconditioned) Edge Taken When No Branch Matches

- Regular Path: built a dedicated probe graph (`wf_test_j005_fallback`, commercial_configuration, version
  `593ba28c-0107-4c6c-840c-f524f20ee837`) with two conditioned edges (`equals "enterprise"`, `equals "smb"`) plus one
  unconditioned fallback edge. Direct `fn_resolve_workflow_next_approval` call with `segment = "mid_market"` (matches
  neither conditioned edge) correctly resolved to the fallback edge's Approval node.
- Classification: **PASS**.

## J-006: Decision Node With No Fallback and No Match Raises WORKFLOW_DECISION_NO_MATCH

- Regular Path: built a dedicated probe graph (`wf_test_j006_nofallback`, commercial_configuration, version
  `946df2db-c99f-4168-bd43-b9e4ad83cb48`) with the same two conditioned edges as J-005 but no fallback edge. Direct
  `fn_resolve_workflow_next_approval` call with `segment = "mid_market"` correctly raised
  `WORKFLOW_DECISION_NO_MATCH: this request did not match any branch of its workflow's Decision step, and the
  Decision step has no default (unconditioned) branch. Ask a Workflow Admin to add a default branch.`
- Classification: **PASS**.

## J-007: Decision Node in Onboarding Domain Always Takes Default/Fallback (Empty Context) — premise corrected

- **Premise correction (per this batch's pre-execution research, now live-confirmed)**: this journey's own canonical
  Starting State ("decision context passed by the onboarding domain is always empty") is stale.
  `submit_customer_onboarding_case`'s body (read in full this batch) builds
  `jsonb_build_object('segment', v_revision.raw_data ->> 'segment')`, a real, non-empty context whenever the
  submitted form data includes a `segment` value. This was added by a later migration after J-007 was originally
  drafted.
- Regular Path (corrected): built a dedicated probe graph (`wf_test_j007_onboarding_decision`, customer_onboarding,
  version `281af27e-c7dc-47b3-bef8-48382dfa09df`) with a `segment equals "enterprise"` edge plus fallback. Created and
  submitted a real onboarding case with `segment: "enterprise"` in its raw data: resolved to `node_3` (the
  equals-enterprise Approval), not the fallback. Created and submitted a second real case with `segment: "smb"`:
  resolved to `node_4` (fallback), confirming the routing is genuinely data-driven, not a coincidence.
- Classification: **PASS** (of the corrected premise). The original canonical premise (context always empty, so a
  segment-conditioned edge in this domain is dead code) is no longer true and the Journey Universe entry needs
  updating; see Journey Discovery Check below.

## J-008: Decision Node in Customer Change Domain Always Takes Default/Fallback (Empty Context) — premise corrected

- **Premise correction**: `submit_customer_change_request`'s body builds
  `jsonb_build_object('segment', coalesce(v_revision.raw_data ->> 'segment', v_customer.segment))`, real and
  non-empty whenever the customer has any segment set or the change itself proposes one.
- Regular Path (corrected), dual-mode proof: built a dedicated probe graph (`wf_test_j008_change_decision`,
  customer_change, version `ff44f4fc-f211-48eb-a1ef-1815eb1d2d26`), same shape as J-007's. (1) Base-customer path:
  created a real Customer Change Request against a test customer with `segment = "smb"` and an empty proposed-value
  payload; submit resolved to `node_4` (fallback), correctly reading the customer's own stored segment. (2)
  Proposed-override path: created a second real Customer Change Request against the same customer, this time
  proposing `segment: "enterprise"` in the change payload; submit resolved to `node_3` (equals-enterprise),
  correctly preferring the proposed value over the customer's stored one, exactly matching the `coalesce(...)`
  precedence read from the code.
- Classification: **PASS** (of the corrected premise); see Journey Discovery Check below.

## J-009: Decision Node in Go Live Domain Always Takes Default/Fallback (Empty Context)

- Regular Path: `submit_go_live_request` and `approve_go_live_request` both still pass `'{}'::jsonb` literally to
  `fn_resolve_workflow_next_approval` (confirmed by direct code read this batch, lines 1532 and 1599 of the runtime
  migration). Historical evidence already exists from Batches 15-16: every real `submit_go_live_request` call ever
  made against the active `wf_test_decision_finance_or_legal` graph (`057929f6-962d-416a-912f-e23253b56597`)
  resolved to `node_4` (the fallback Legal Approval), never `node_3` (the `segment equals "enterprise"` edge), across
  every one of that graph's historical `submit` transition rows queried this batch. This is the one domain of the
  three (go_live, onboarding, customer_change) where the "always empty context" premise remains accurate today.
- Classification: **PASS**.

## J-010: End Node Reached Marks Request Terminal With No Further Actions Possible — mechanism clarified

- Regular Path: reused a real, already-`approved` go_live request (`c8696bac-2c02-47ff-b3c4-5ac5af0cb989`,
  `current_workflow_node_key = node_5`, the End node) from prior-batch history.
- Stress Variant, live-executed against this terminal row: `approve_go_live_request` returned the row **unchanged,
  with no error** (`if v_row.status = 'approved' then return v_row; end if;`, a genuine silent no-op, confirmed by
  both the code and a live call this batch); `send_back_go_live_request` against the same row correctly **raised**
  `GO_LIVE_REQUEST_NOT_SENDBACKABLE: request ... has status approved, only submitted or resubmitted may be sent
  back`.
- **Mechanism clarification** (not a defect): the canonical Expected Technical Invariant text ("any post-terminal
  action attempt is rejected... current-node/team recheck fails") implies every post-terminal action raises an
  error. The actual, live-confirmed behavior is that the two actions use two different mechanisms to reach the same
  safe business outcome (no further mutation ever happens to a terminal request): approve is an idempotent silent
  no-op, send-back is an explicit raise. Both correctly prevent any further progression or mutation; no
  `workflow_node_transitions` row was written by either attempt.
- Classification: **PASS** (of the corrected mechanism description); see Journey Discovery Check below.

## J-011: Approval Node Team With Zero Active Members Blocks Forever

- Reused existing, conclusive live evidence from Batch 8 (A-027): `fn_require_workflow_team_membership` (the exact
  function every `approve_*` RPC calls) called directly against `wf_test_empty` (permanently zero-member team,
  `9b975641-649f-4c5e-91d7-14c94b4be796`) for two different real, otherwise-eligible actors, both rejected with
  `WORKFLOW_TEAM_REQUIRED`. Batch 9 additionally, independently re-confirmed this for real in production-equivalent
  conditions when the live active `customer_change` workflow's Finance node briefly had zero eligible members and
  blocked every real Customer Change approval in the environment until fixed.
- Regression check (this batch): re-read `fn_require_workflow_team_membership`'s current live body via
  `pg_get_functiondef`, confirmed unchanged (still only checks `user_teams.revoked_at is null`); confirmed via direct
  SQL that `wf_test_empty` genuinely still has zero `user_teams` rows (an initial aggregate query misleadingly showed
  1 due to a `LEFT JOIN ... count(*) filter (where ut.revoked_at is null)` artifact on a zero-row team, corrected by
  querying `user_teams` directly).
- Classification: **PASS** (efficient reuse of already-conclusive historical evidence plus a fresh regression check,
  per this program's established practice of not re-reproducing an already-proven mechanism from scratch).

## J-012: Deactivating a Team Does Not Block Its Members From Approving

- Reused existing, conclusive live evidence from Batch 5 (O-series): a real member of `ux_verification_team` was
  assigned, the team was deactivated via `set_team_active`, and `approve_customer_change_request` by that member
  still succeeded normally against a real Customer Change Request.
- Regression check (this batch): confirmed `fn_require_workflow_team_membership`'s live body still contains no
  reference to `teams.is_active` anywhere in its `WHERE` clause (full function body read via `pg_get_functiondef`).
- Classification: **PASS**.

## J-013: Membership Revocation Mid-Flight Removes Eligibility Instantly

- Reused existing, conclusive live evidence from Batch 6: revoking a real approver's `user_teams` membership
  immediately caused a subsequent `approve_customer_change_request` attempt by that same user to fail with
  `WORKFLOW_TEAM_REQUIRED`; restoring the membership let the identical call succeed immediately afterward, fully
  completing that request's multi-level approval chain.
- Regression check (this batch): same `fn_require_workflow_team_membership` body confirmation as J-011/J-012 (live
  re-check at action time, never cached from an earlier page load or an earlier call in the same session).
- Classification: **PASS**.

## J-014: Bounded 10-Hop Walk Raises WORKFLOW_GRAPH_DEAD_END on a Long Decision Chain — DEFECT FOUND, FIX DRAFTED, NOT YET APPLIED

- Hop-counting semantics pinned down by reading `fn_resolve_workflow_next_approval`'s full body this batch:
  `v_hops` increments once per node visited, checked (`if v_hops > 10 then return`) at the **top** of each loop
  iteration, before that node's type is inspected. This means the node at hop 11 is never even inspected; a
  resolution path of exactly 10 total nodes (Start + up to 9 intermediate Decision/form_step nodes, with the 10th
  node being Approval or End) succeeds, while an 11th node is unreachable.
- Regular Path, live-executed: built a dedicated probe graph (`wf_test_j014_hopbound`, commercial_configuration,
  version `dc50e8f5-c254-4149-bd21-de10cdc6d6e7`): `Start -> Decision x9 (each fallback-only) -> Approval -> End`
  (11 total nodes in the walk). Created a real draft Commercial Configuration Version bound to this graph and called
  the real `submit_commercial_configuration_version` RPC.
  **Actual result: no exception was raised.** The version's `status` became `submitted` and
  `current_workflow_node_key` was silently left `null`; a `workflow_node_transitions` row was even written recording
  `to_node_key = null`. This directly contradicts the journey's own Regular Path assertion
  ("WORKFLOW_GRAPH_DEAD_END is raised").
- Root cause (confirmed by direct code read): all four `approve_*` RPCs (`approve_customer_onboarding_case`,
  `approve_customer_change_request`, `approve_commercial_configuration_version`, `approve_go_live_request`) already
  check `if v_next.node_type is null then raise 'WORKFLOW_GRAPH_DEAD_END'...` after calling
  `fn_resolve_workflow_next_approval`. None of the four `submit_*` RPCs
  (`submit_customer_onboarding_case`, `submit_customer_change_request`, `submit_commercial_configuration_version`,
  `submit_go_live_request`) have the equivalent check; all four persist `v_next.node_key` (which is `null` on a
  dead-end resolve) unconditionally. Confirmed by direct read of all four submit RPC bodies this batch; the gap is
  symmetric and systemic across all four domains, not specific to commercial_configuration.
- Boundary Stress Variant (exactly 10 vs. 11 hops), via direct `fn_resolve_workflow_next_approval` calls against the
  same probe graph (a from_node_key-shifted call simulates resuming one node later, precisely testing the boundary
  without building a second full graph): `fn_resolve_workflow_next_approval(version_id, null, {})` (Start counted,
  11 total nodes to reach Approval) returned zero rows (dead end, matches the live submit result above);
  `fn_resolve_workflow_next_approval(version_id, 'node_1', {})` (skip Start, 10 total nodes from there to Approval)
  correctly resolved to the Approval node. The hop bound is confirmed exactly 10, deterministic at the boundary.
- **8-step defect protocol applied**: (1) reproduced live above; (2) root cause identified (missing guard, submit
  vs. approve asymmetry); (3) fix is bounded and safe (mirror the exact guard already proven correct on all four
  `approve_*` siblings, no business-policy judgment required) — migration
  `supabase/migrations/20261005000000_fix_submit_rpcs_missing_dead_end_guard.sql` drafted, adding the identical
  `if v_next.node_type is null then raise 'WORKFLOW_GRAPH_DEAD_END: ...'` guard to all four `submit_*` RPCs,
  immediately after their `fn_resolve_workflow_next_approval` call and before their status-changing `UPDATE`; (4)
  regression coverage: not yet added (parked with the migration, see below); (5) manual retest: not yet
  re-executed (parked); (6) server-side verification: the fix's guard text is identical to the already-verified
  `approve_*` pattern; (7) immediate neighbors (J-006's `WORKFLOW_DECISION_NO_MATCH`, which behaves correctly on
  submit today per direct test, is a different, already-correctly-guarded failure path in the same resolver and is
  unaffected by this fix); (8) this original failure is preserved as `Original result: FAIL` below, not rewritten.
- **Migration applied**: `npx supabase db push --linked` was initially blocked by this session's own permission
  classifier (shared-database RPC mutation without explicit user authorization in this conversation); per the user's
  own standing instruction ("obtain interactive authorization if required; continue independent work while only the
  migration action is parked"), this was surfaced to the user rather than bypassed. The user explicitly authorized
  applying it. Migration `20261005000000_fix_submit_rpcs_missing_dead_end_guard.sql` was pushed via the Supabase CLI
  (never the MCP `apply_migration` tool, per `CLAUDE.md`); `npx supabase migration list --linked` confirms
  `local == remote == 20261005000000`.
- **Retest (post-fix), live**: created a fresh Commercial Configuration Version bound to the same
  `wf_test_j014_hopbound` dead-end probe graph and called the real `submit_commercial_configuration_version` again.
  **Now correctly raises**: `WORKFLOW_GRAPH_DEAD_END: this version's workflow could not resolve to any reachable
  Approval or End node; ask a Workflow Admin to fix the graph`.
- **Regression check (happy path unaffected)**: submitted a fresh, real onboarding case through the actual active
  (non-dead-end) `wf_test_simple_one_step` graph after the fix: still correctly resolves to `current_workflow_node_key
  = node_2`, `status = submitted`, unchanged from pre-fix behavior. The fix only adds a guard for the zero-row case;
  every existing resolvable-graph submit path is untouched.
- The dead-end probe graph and the orphaned pre-fix repro row (`request_id f3e7747d-1b69-41a6-a053-e473b7dc3bbf`,
  `commercial_configuration_id 571e8852-c7e1-48dc-94e9-ce987de2ac22`, `status = submitted`,
  `current_workflow_node_key = null`) are left in place as historical repro evidence of the original failure, per
  this program's "never rewrite an original failure into PASS" rule; the retest used a separate fresh request
  (`c0d608e2-5aee-45e6-b704-546c02c0c0ed`).
- **Original result: FAIL.** Root cause: all four `submit_*` RPCs were missing the dead-end guard their `approve_*`
  siblings already had. Fix: migration `20261005000000` adds the identical guard to all four. Retest: PASS (live,
  post-fix). Classification: **FAILED THEN FIXED + PASS**.

## J-015: WORKFLOW_GRAPH_DEAD_END When Current Node Has No Outgoing Path

- Regular Path: built a dedicated probe graph (`wf_test_j015_deadend`, go_live, version
  `9007ab80-a1a9-4ce9-b2d7-b4eb41cd6288`): `Start -> Approval`, with the Approval node deliberately given no
  outgoing edge at all (not even to an End node) — the exact validation gap the journey describes, since
  `publish_workflow_definition_version`'s server-side check only requires at least one start and one end node
  anywhere in the graph, never that every node has a valid path forward.
- Server-side control verification: direct `fn_resolve_workflow_next_approval(version_id, 'node_2', {})` call
  (`node_2` being the dead-end Approval node, simulating exactly what `approve_go_live_request` calls internally
  with `p_from_node_key = v_row.current_workflow_node_key`) returned zero rows. Combined with
  `approve_go_live_request`'s own already-read body (`if v_next.node_type is null then ... if
  v_row.current_workflow_node_key is null then finalize else raise 'WORKFLOW_GRAPH_DEAD_END' end if`), a real
  request parked at this node would deterministically raise `WORKFLOW_GRAPH_DEAD_END` on approve, unlike J-014's
  submit-side gap.
- Classification: **PASS**.

## J-016: fn_resolve_workflow_next_approval Correctly Resolves First Approval Regardless of Intervening Node Types

- Regular Path: this journey's exact graph shape (`Start -> form_step -> Decision(fallback only) -> form_step ->
  Approval -> End`) is precisely the J-002 probe graph built this batch (`wf_test_j002_j016_formstep`,
  `93bf14be-00e1-4ff0-ad93-c680b52c1b84`); the same live `submit_customer_onboarding_case` call documented under
  J-002 is this journey's own Regular Path evidence: one submit call correctly threaded through both form_step
  nodes and the Decision's fallback edge in a single bounded pass, landing on `node_6` (Approval), with exactly one
  `workflow_node_transitions` row (`from_node_key = null, to_node_key = node_6`).
- Classification: **PASS**. (One fixture graph deliberately serves both J-002's and J-016's own distinct assertions;
  noted explicitly here per this program's evidence-reuse practice.)

## J-017: fn_workflow_node_team Uses Current Node Directly, Never Re-Walks From Start

- Regular Path + Concurrency Variant, live-executed against the real, shared `wf_test_finance_legal_sequential`
  definition: captured `fn_workflow_node_team(v11, 'node_2')` against the currently active published version
  (`33738463-20b2-4bce-b4db-4f134a1c6df1`, real in-flight requests parked there) = `UX Verification Team`. Created a
  new DRAFT version (v12) of the same definition via the real `create_workflow_definition_version` RPC (seeded from
  v11, never published), then reassigned `node_2`'s team to `WF-TEST Legal` in that draft via the real
  `save_workflow_version_graph` RPC. Re-queried `fn_workflow_node_team(v11, 'node_2')` immediately afterward:
  **unchanged**, still `UX Verification Team`, despite the concurrent unpublished draft edit targeting the exact
  same node key. A live end-to-end `approve_customer_change_request` re-proof against one of the real in-flight v11
  requests was attempted but blocked by an unrelated, correctly-working guard (`CUSTOMER_CHANGE_STALE_BASE`, the
  base customer had advanced since those particular fixture requests were created); the direct
  `fn_workflow_node_team` proof above is conclusive on its own since it is the exact lookup every `approve_*` RPC
  calls, scoped to the request's own stamped `workflow_version_id`.
- Classification: **PASS**.

## Defect fixed this batch

**Submit-side dead-end guard missing across all four domains** (found via J-014). All four `approve_*` RPCs already
raised `WORKFLOW_GRAPH_DEAD_END` when `fn_resolve_workflow_next_approval` could not resolve to an Approval/End node;
none of the four `submit_*` RPCs had the equivalent guard, so a structurally over-deep or otherwise dead-ending
graph let a submit silently succeed with `status = submitted` and `current_workflow_node_key = null`, permanently
and silently orphaning the request. Root cause: the guard was added to the four `approve_*` RPCs at some point after
their original authoring but never mirrored onto their `submit_*` siblings; a purely mechanical, safe fix (no
business-policy judgment required). Fix: migration `20261005000000_fix_submit_rpcs_missing_dead_end_guard.sql`,
applied to the shared database with the user's explicit authorization (initially parked by this session's own
permission classifier per the user's own standing "obtain interactive authorization" rule, then applied once
authorized). Retested live post-fix: the same dead-end probe graph now correctly raises
`WORKFLOW_GRAPH_DEAD_END` on submit; a fresh non-dead-end onboarding submit was also re-verified unaffected
(no regression on the happy path). Full detail under J-014 above.

## Journey Discovery Check

Per the mandatory closure check: does Batch 19 reveal any durable business behavior, control invariant, boundary
condition, cross-domain interaction, or regression risk not adequately represented in the Journey Universe?

1. **The submit-side dead-end guard gap itself (J-014's finding) is a cross-domain infrastructure concern, not
   commercial_configuration-specific.** J-014's own canonical scope only names commercial_configuration; the actual
   defect and fix were symmetric across all four domains' `submit_*` RPCs. Classification: **EXISTING JOURNEY
   EXPANDED**. J-014's Domain field should read "All four governed domains (customer_onboarding, customer_change,
   commercial_configuration, go_live)" rather than commercial_configuration alone, mirroring how J-001's own Domain
   field already covers all four. Applied below.
2. **J-007/J-008's stale "always empty context" premise (already corrected above) is itself worth a permanent
   Journey Universe note** so a future batch does not silently regress a correction back to the old premise without
   noticing the code changed. Classification: **EXISTING JOURNEY EXPANDED** (already applied via the
   `[PREMISE CORRECTED, Batch 19, 2026-09-22]` annotations on J-007/J-008 and the `[CONFIRMED CURRENT]` annotation on
   J-009 above, not a new journey ID).
3. **J-010's two different terminal-rejection mechanisms (approve = silent no-op, send-back = explicit raise)**:
   worth a permanent note so a future reader does not assume both raise identically. Classification: **EXISTING
   JOURNEY EXPANDED** (already applied via the `[MECHANISM CLARIFIED, Batch 19, 2026-09-22]` annotation on J-010
   above).
4. **No new PRODUCT GAP, PRODUCT DECISION, or entirely new journey ID candidates were found** beyond the three
   expansions above and the one defect (already fixed). Checked against `TECH_DEBT.md`, prior Product Gap/Decision
   ledgers, and the Journey Universe Expansion Audit before concluding this; none of Batch 19's findings duplicate a
   previously-settled decision.

Applying discovery item 1 to `docs/NEXUS_JOURNEY_UNIVERSE.md`:

---

## Batch 19 Product Gap Closure (post-Batch-19, 2026-09-22)

I-034 and I-035, historically classified PRODUCT GAP at Batch 19 closure, were decided and implemented after Batch
19 closed. Both are documented in full under their own I-034/I-035 sections above (Regular Path / Stress Variant /
Concurrency Variant / retest evidence / manual UX evidence), each closing with **PRODUCT GAP → PRODUCT DECISION →
IMPLEMENTED → VERIFIED**. Batch 19's original historical arithmetic (`22 PASS + 1 FAILED THEN FIXED + PASS + 2
PRODUCT GAP = 25`) is unchanged and not rewritten; this section is additive closure evidence, not a
reclassification.

**Migration**: `20261006000000_entitlement_source_duplicate_invoice_and_metric_checks.sql`, applied to the shared
database via the Supabase CLI (not the MCP `apply_migration` tool).

**Data mutation**: one historical test-fixture row renamed (not deleted): `entitlement_sources.id =
7e99fb24-8852-48b3-94b5-99467c4b95b9` (`ES-000007`), `invoice_reference` changed from `INV-B17-I023` to
`INV-B17-I023-BATCH19-I034-DUPLICATE-TEST-FIXTURE`. This row was itself a Batch 19 test fixture (self-created to
prove the I-034 gap existed), not real or sensitive data. No other row was mutated.

### Journey Discovery Check (I-034/I-035 implementation)

1. **Concurrent duplicate Invoice Source creation**: **ALREADY COVERED** by the implementation itself, not a new
   finding. The unique index (`uq_entitlement_sources_customer_invoice_reference`) plus the RPC's
   `exception when unique_violation` handler make this structurally impossible to lose silently; this is the
   mechanism, not a residual gap.
2. **Normalization/case/whitespace behavior of Invoice references**: **REGRESSION TEST ONLY**. Live-confirmed
   correct (trim + lowercase, matching the existing GST/PAN convention); worth a permanent automated regression
   test if/when this domain gets vitest-level RPC coverage (it does not today; this program's methodology for SQL
   RPC behavior has consistently been live execution + this ledger, matching every other batch), but not a new
   product question.
3. **Customer/legal-entity uniqueness boundary**: **ALREADY COVERED**. Confirmed and documented: Nexus has no
   separate legal-entity concept (`docs/MASTER_DATA_FOUNDATION_DESIGN.md` explicitly rejects one); `customer_id` is
   the correct and only boundary. Not an open question.
4. **Metric lookup across component types**: **EXPAND EXISTING JOURNEY**, applied directly to I-035's own entry in
   `docs/NEXUS_JOURNEY_UNIVERSE.md` rather than a new journey ID (matching the user's own stated expectation): the
   real, populated source of truth (`pricing_rule_parameters ->> 'pricingUnit'`, not
   `measurement_definition_id`) and its scope (`linear`/`volume`/`graduated` only; `flat`/`dimension` skipped) are
   now recorded in both the Journey Universe entry and `docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` §7.2, so a future
   batch does not have to rediscover this from scratch or assume `measurement_definitions` is live data.
5. **A genuinely new structural finding surfaced during implementation, not asked for by name**:
   `measurement_definitions`/`measurement_definition_id` is fully designed in code (types, mappers, a read query)
   but has zero live data and zero live writes anywhere in this database. **PRODUCT DECISION REQUIRED, but not
   urgent**: is `measurement_definitions` an intentionally deferred future capability (in which case its dead
   read-path code should stay as-is, documented as such), or should `commercial_components.measurement_definition_id`
   actually be populated going forward as the long-term canonical source of truth (in which case `pricingUnit`
   free-text-in-jsonb is the interim/legacy mechanism this fix correctly builds against today, and a future
   migration would need to backfill/switch over)? Not invented here; both `docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md`
   and `docs/TECH_DEBT.md`-adjacent context now record the finding precisely so the question can be posed rather
   than silently assumed either way.
6. No candidate required a new journey ID; no candidate was classified FUTURE MODULE beyond what was already
   settled (manual-only source creation, API/Import deferral).

### Closure checkpoint

- Targeted I-034/I-035 tests: all required tests executed and passed (see I-034/I-035 sections above).
- Neighbouring Entitlement tests: `generate_allocation_schedule`, `submit_monthly_usage`, `record_settlement` paths
  unmodified by this migration; full vitest suite green (978/978) after the change.
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.
- Production build: succeeds.
- Manual UX verification: real browser, `wf-test.maker@example.test`, real "Add Invoice Entitlement" form, both
  error paths (duplicate reference, metric mismatch) and the valid-creation path all confirmed live.
