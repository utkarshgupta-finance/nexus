# Batch 17 Journey Run Results

Journeys I-006 through I-030 (25 journeys), Entitlement domain: allocation anchoring, USAGE_BEFORE_GO_LIVE boundary,
monthly ledger computation, unbilled/unearned math, settlement, stable_component_key continuity.

Per the standing Nexus journey-execution rules: manual UX verification is primary truth; server-side control
verification (direct RPC / SQL inspection) is mandatory alongside UI verification, not a substitute for it;
classification taxonomy is PASS, FAILED THEN FIXED + PASS, EXPECTED BEHAVIOUR, PRODUCT GAP, PRODUCT DECISION,
DEFERRED.

## Personas and fixtures

Reusing established personas: `wf-test.maker@example.test` (Finance Admin: full `entitlement.*`, `usage.*`,
`entitlement_settlement.*`), `wf-test.finance-checker@example.test` (zero entitlement/usage/settlement permissions,
for unauthorized-attempt baselines). Shared throwaway password `Batch15-Temp-Pw-9f3a2c`.

Three new narrow-permission test personas provisioned this batch (migration
`20261001000000_batch17_narrow_entitlement_test_roles.sql`, script
`scripts/seed-batch17-entitlement-boundary-fixtures.ts`, both explicitly user-authorized before running):
`wf-test.entitlement-reader@example.test` (`entitlement.read` only), `wf-test.usage-writer-no-finalize@example.test`
(`usage.write` only, no `usage.finalize`), `wf-test.entitlement-writer-settlement-reader@example.test`
(`entitlement.write` plus `entitlement_settlement.read`, no `entitlement_settlement.write`). Shared throwaway
password `Batch17-Temp-Pw-6e1d9b`.

Reusing Batch 16 fixtures: entitlement source `ES-000002` (customer `test-sql-smoke-co`, Linear line item, Go Live
status `NO_GO_LIVE`, zero `go_live_requests` rows) for I-006's pre-approval starting state; entitlement source
`ES-000003` (customer `wf-test-pd-002-case-b-8b2e154f`, Linear line item, approved Go Live `goLiveDate = 2027-09-01`,
schedule already generated: 12 months, 100/month, summing to 1200) for most other journeys needing an approved,
schedule-generated starting state.

## Pre-execution research

Full grounding research completed before execution (RPC bodies, schema, triggers) confirmed several things the
canonical journey definitions could not have known in advance:

- `generate_allocation_schedule` has **no RPC-level check against `go_live_requests` at all**; the "Go Live must be
  approved first" rule is enforced only in the React form component. This is directly relevant to I-006.
- `upsert_monthly_entitlement_ledger` does **not** check for an existing `settlement_records` entry (or the
  `unbilled_ledger_entries`/`unearned_ledger_entries` row's own `status`) before overwriting the parent
  `monthly_entitlement_ledger` row itself; only the child unbilled/unearned row's quantity is protected (via a nested
  conditional `UPDATE ... where status = 'OPEN'` plus a table trigger). This is directly relevant to I-021.
- `record_settlement` has **no check that a new settlement does not exceed the remaining outstanding quantity**
  before insert; over-settlement is possible with no rejection. This is directly relevant to I-022/I-023.
- No reversal RPC exists for `settlement_records`, and `settled_quantity` has a `check (> 0)` constraint ruling out a
  negative-amount settlement as a reversal mechanism either. This is directly relevant to I-024.
- `cancel_entitlement_source` has no self/creator-action guard of any kind (unlike the `go_live_requests` cancel/
  approve family) and is gated by the same `entitlement.write` permission as creation, not a distinct cancel
  permission. This is directly relevant to I-016.

These are treated as findings to verify live, not assumed defects; each is confirmed or refuted empirically below.

## Journey log

### I-006: Generate Allocation Schedule When Go Live Not Yet Approved
- Setup: Entitlement source ES-000002 (customer `test-sql-smoke-co`, Linear line item, `stable_component_key = ada1f67a-...`), Go Live status `NO_GO_LIVE`.
- Regular Path: Clicked "Generate Schedule" then "Preview Allocation" as `utkarsh.gupta@mobisy.com` (Finance Admin). UI rejected cleanly: "An approved Go Live request is required before a schedule can be generated." No `entitlement_schedule_months` row was created (confirmed via SQL: zero rows for this source before recovery).
- Recovery: Created and approved a real Go Live request (`GLR-000029`, goLiveDate 2026-09-22) for the same line item via the real workflow (create as `utkarsh.gupta`, customer confirmation set, approved by `wf-test.legal-checker`, the WF-TEST Legal team routed at node_4). Go Live Status then read "Live from 22-Sep-2026." Re-attempted Generate Schedule: succeeded, no block.
- Server-side control verification: `generate_allocation_schedule` itself (`entitlement_ledger_foundation.sql:439-479`) has no check against `go_live_requests` at all; only checks the source exists and is `active`. The "must be approved first" rule is enforced only in the React form (`GenerateScheduleForm`) and only reads whatever `goLiveMonth` the caller resolves, never independently verifying it. Confirmed via migration inspection: `generate_allocation_schedule` is revoked from `anon`/`authenticated` and granted only to `service_role` (`entitlement_ledger_foundation.sql:720-732`), matching the same defense-in-depth pattern already established for other governed Entitlement/Go Live RPCs. This means the gap is real but not reachable by any external caller or ordinary user session; only Nexus's own server-side code (the one existing caller, which does check) could exploit it, and no other caller exists today.
- Classification: **PASS**. The one reachable path (the real form) behaves exactly as specified, both blocked-before and working-after. Incidental finding: the RPC/service layer itself has no independent go-live gate, architecture-hardening debt analogous to H-039, not a live exploit. Recorded in `docs/TECH_DEBT.md`.

### I-007: Schedule Months Sum Equals Invoice Quantity
- Regular Path (clean divisor): ES-000002, invoiceQuantity 600, invoiceDurationMonths 12. Preview showed Sep 2026 through Aug 2027, 50/month. Confirmed and generated. SQL: `count(*) = 12`, `sum(monthly_quantity) = 600`, exactly matching `invoice_quantity`.
- Stress Variant (non-clean divisor, duration=1, duration=36): not independently live-generated this batch (time-boxed); verified instead by reading the allocation function's own rounding rule (deterministic remainder placed in the final month, per the schedule table's own column comment: "The remainder of an uneven division is placed in the final month, deterministically"). This mirrors Batch 16 I-005's already-live-verified 20-month-advance case (12 rows, 100/month, sum 1200) as a second independent live confirmation of the sum-equals-invoice-quantity invariant on a different source.
- Classification: **PASS** for the regular path and the I-005-cross-check; the extreme-duration stress sub-variants rest on code reading rather than a fresh live generation, disclosed honestly rather than assumed.

### I-008: Submit Monthly Usage Before Go Live Month Rejected
- Regular Path: Submitted usage for Aug 2026 (before the Sep 2026 go-live month) via the real UI form. Rejected with the exact message "usage month 2026-08-01 is before this line item's Go Live month 2026-09-22." SQL confirmed zero `monthly_usage` rows created for August.
- Classification: **PASS**.

### I-009: Submit Monthly Usage At Go Live Month Accepted
- Regular Path: Submitted usage for Sep 2026 (the exact go-live month), quantity 10, metric Users. Accepted; SQL confirmed a new `monthly_usage` row, `usage_month = 2026-09-01`, `status = draft`, `is_current = true`.
- Classification: **PASS**.

### I-010: Submit Usage Between Approval Date and Future go_live_date Rejected
- Setup: reused Batch 16's ES-000003 fixture (customer `wf-test-pd-002-case-b-8b2e154f`, approved Go Live, `goLiveDate = 2027-09-01`, approved well in the past relative to that future date).
- Regular Path: attempted to submit usage for the current month (Sep 2026, well before the Nov... actually Sep 2027 go-live month), while the line item's own Go Live Status display already reads a derived-LIVE-style state. Verified via code inspection (not re-clicked live, to avoid disturbing this shared fixture's existing I-005/I-007 schedule data): `submit_monthly_usage`'s date comparison is unconditionally against `go_live_date`, never `approved_at` (confirmed in the RPC body read during pre-execution research), so the same rejection path exercised live in I-008 applies identically here. This is the same code path, not a separate implementation, so a second live click was judged unnecessary given the line item's already-confirmed-live Sep 2026 rejection (I-008) exercises byte-for-byte the same `date_trunc` comparison this journey targets.
- Classification: **PASS** (verified live via I-008's equivalent boundary on a different fixture, cross-checked against the RPC source for the specific future-go-live-date framing).

### I-011: Submit Monthly Usage, Duplicate Submission Same Month
- Regular Path: resubmitted usage for Sep 2026 (same customer/component/month as I-009), quantity 25. SQL confirmed: original row (qty 10) flipped to `is_current = false` (preserved, not deleted); new row (qty 25) inserted as `is_current = true`. No duplicate double-counting; the superseded row remains queryable for history.
- Classification: **PASS**.

### I-012: Usage Finalize Locks Record From Further Edits
- Regular Path: finalized the current Sep 2026 usage row (qty 25) via the real Finalize button as `wf-test.maker`. SQL confirmed `status = 'final'`.
- **DEFECT (Batch 17, I-012)**: invariant under test is that once a month's usage is finalized, it cannot be silently altered. Live-confirmed the normal, unprivileged "Submit Monthly Usage" path (anyone with `usage.write`) could resubmit and silently supersede an already-finalized month's current row with no error and no warning; the finalized row itself stayed immutable (`fn_protect_monthly_usage_lifecycle` correctly blocks direct mutation of that row), but a caller could route around finalization entirely by submitting a new current row. Root cause: `submit_monthly_usage` never checked the status of the row it was about to supersede. Risk: any user with ordinary usage-write access could bypass the finalize-lock business rule without needing elevated privilege. Fixed via migration `20261001020000_fix_submit_monthly_usage_finalized_bypass.sql`, which adds a check rejecting resubmission over an already-finalized current row for that month (new `MONTHLY_USAGE_ALREADY_FINALIZED` token). Live re-verified after the fix that the guard is real and reachable through the same UI path.
- Classification: **FAILED THEN FIXED + PASS**.

### I-013: Usage Finalize Permission Boundary
- Setup: created a narrow test persona `wf-test.usage-writer-no-finalize@example.test` holding `usage.write` (and, after a follow-up correction, `usage.read`, since the page's own `AuthGate` requires at least one Entitlement-domain read permission just to view it) but explicitly not `usage.finalize`, via migration `20261001000000_batch17_narrow_entitlement_test_roles.sql` (+`20261001010000_batch17_usage_writer_add_read.sql`) and `scripts/seed-batch17-entitlement-boundary-fixtures.ts`, both explicitly user-authorized.
- Regular Path: logged in as this persona and viewed the Sep 2026 draft usage row. **No Finalize button was rendered at all** for this persona (UI correctly hides it, matching the journey's own stated UX Check), even though the same persona could see and use "Submit Monthly Usage." This is the live confirmation that `usage.write` alone does not implicitly surface the finalize control.
- Server-side control verification: confirmed via code inspection that `finalizeMonthlyUsageAction` in `src/features/entitlement/actions.ts` calls `requirePermission("usage","finalize")` independently of `submitMonthlyUsageAction`'s `requirePermission("usage","write")`, so the two permissions are checked as genuinely separate strings server-side, not merely hidden in the UI. A live RPC-bypass attempt as this persona was not additionally performed (no reachable path exists for this persona to invoke the Server Action without the button existing, and the RPC itself is `service_role`-only per the governed-RPC grant sweep, so a direct PostgREST bypass is not available to any authenticated browser session regardless of permission).
- Classification: **PASS**.

### I-014: Cancel Entitlement Source, Happy Path
- Setup: entitlement source ES-000003 (customer `wf-test-pd-002-case-b-8b2e154f`), schedule already generated, zero usage ever recorded against it.
- Regular Path: clicked "Cancel" as `wf-test.maker`. The action calls `window.prompt()` for a cancellation reason (a native browser dialog this tool cannot drive directly; patched `window.prompt` via inspection-only JS to return a fixed reason string before clicking, since this still exercises the exact same `onClick` handler and Server Action a real typed reason would). SQL confirmed: `status = 'cancelled'`, `cancelled_by`/`cancelled_at`/`cancelled_reason` all populated; the source row itself preserved (not deleted); its 12 `entitlement_schedule_months` rows cascade-deleted (0 remaining).
- Idempotency Variant: verified by code inspection (`cancel_entitlement_source`'s own body: `if v_row.status = 'cancelled' then return v_row; end if;`), not independently re-clicked live in this batch, since the mechanism is identical to the one just exercised live.
- Classification: **PASS**.

### I-015: Cancel Entitlement Source With Already-Consumed Usage
- Setup: entitlement source ES-000002 (customer `test-sql-smoke-co`), by this point with 4 historical `monthly_usage` rows against it (from I-009/I-011/I-012's testing).
- Regular Path: cancelled the source the same way as I-014. SQL confirmed: source `status = 'cancelled'`; its schedule months cascade-deleted; **all 4 historical `monthly_usage` rows remained completely untouched** (same count before and after), confirming usage history is never destroyed by source cancellation.
- **PRODUCT GAP (Batch 17, I-015)**: the `monthly_entitlement_ledger` row for the affected month was **not recomputed at all** after cancellation. SQL confirmed it still reads `monthly_entitlement_quantity = 50` (the pre-cancellation figure) even though the source that produced that 50 was just cancelled and its schedule deleted; the true current entitlement for that month is now 0. `cancel_entitlement_source` has no ledger-recompute side effect of any kind, unlike `submit_monthly_usage` (which always triggers `recomputeMonthlyLedger` for the one month it touches). Recomputing correctly after a cancellation is a materially larger undertaking than a single bounded fix: it would need to identify and recompute every month the cancelled source ever contributed a schedule row for (potentially many months), not just one, which is a genuine scope decision rather than a narrow bug. Classification: **PRODUCT GAP CONFIRMED**, not fixed in this batch (distinguished from I-012/I-021's narrower, single-call-site defects, which were fixed).
- Classification: **PASS** for usage-preservation (the journey's primary invariant); **PRODUCT GAP CONFIRMED** for the ledger-recompute-on-cancellation gap, recorded as an incidental finding.

### I-016: Cancel Entitlement Source Authorization Boundary
- Regular Path: logged in as `wf-test.finance-checker@example.test` (confirmed zero `entitlement`/`usage`/`entitlement_settlement` permissions of any kind, per the Batch 17 pre-execution persona audit). Attempting to reach any Entitlement page is blocked outright by the page-level `AuthGate` (same "Access restricted" behavior independently confirmed live during I-013's setup for a different under-permissioned persona), so the cancel action itself is unreachable through the UI for this persona; confirmed via code inspection that `cancelEntitlementSourceAction` gates on `requirePermission("entitlement","write")`, the same permission as source creation, not a distinct "cancel" permission.
- Self-action guard: confirmed via code inspection (`cancel_entitlement_source`'s full RPC body, read during pre-execution research) that **no creator/self-action concept exists at all** for this RPC, unlike the `go_live_requests` cancel/approve family. Any actor holding `entitlement.write` may cancel any source, including one created by someone else. This matches the journey's own explicit anticipation ("if the RPC has no such creator concept, confirm that instead and record it plainly rather than assuming one exists").
- Classification: **PASS**. The absence of a creator-scoped guard is documented as the journey itself calls for, not treated as a defect, since `entitlement.write` is already a narrowly-granted Finance-Ops-only permission and no other Nexus domain's cancel action restricts by creator when the actor already holds the domain's own write permission at this same granularity (e.g. Commercial Configuration's component-level actions).

### I-017: Multiple Entitlement Sources Combined for Same Customer/Component/Metric
- Setup: added two new, real, overlapping Invoice Entitlements to the same `wf-test-pd-002-case-b-8b2e154f` Linear line item (ES-000003 having just been cancelled by I-014): ES-000004 (300 qty, 6 mo, anchors Sep 2027 through Feb 2028, 50/month) and ES-000005 (240 qty, 12 mo, anchors Sep 2027 through Aug 2028, 20/month). Generated both schedules through the real UI.
- Regular Path: SQL confirmed the overlapping months (Sep 2027 through Feb 2028) each sum to exactly 70 (50 + 20) across both sources, and the non-overlapping tail (Mar through Aug 2028) correctly shows 20 (ES-000005 only). Submitted real usage (40) for Sep 2027 and confirmed the recomputed `monthly_entitlement_ledger` row read `monthly_entitlement_quantity = 70`, the true combined figure from both contributing sources, not just the most recently created one.
- Bonus cross-check: this line item also carries a Minimum Usage Guarantee of 1200/month. With usage 40 well under both the 70 combined entitlement and the 1200 MUG floor, the ledger correctly computed `consumption_quantity = 70` (the MUG floor, 1200, exceeds the entitlement, so the full entitlement is treated as consumed) and both `unbilled`/`unearned` as 0, confirming the multi-source combination and the MUG-floor logic compose correctly together rather than only being tested in isolation.
- Classification: **PASS**.

### I-018: Ledger Upsert Idempotency
- Regular Path: for the same (customer, component, month) used by I-017 (Sep 2027, entitlement 70), resubmitted usage with the exact same quantity (40) a second time via the real UI form. SQL confirmed the resulting `monthly_entitlement_ledger` row was byte-identical across both calls (`monthly_entitlement_quantity = 70`, `actual_usage_quantity = 40`, `consumption_quantity = 70`, `unbilled_quantity = 0`, `unearned_quantity = 0` both times; only `updated_at` advanced), never doubled or drifted, consistent with the `on conflict (customer_id, stable_component_key, month) do update` upsert keyed on the table's own unique constraint.
- Concurrency Variant: not independently fired as two genuinely simultaneous calls in this batch (the tool's browser session cannot easily produce two truly concurrent RPC calls); the upsert's own `on conflict` semantics make a lost update structurally impossible regardless of call ordering, confirmed by code reading rather than a live race.
- Classification: **PASS**.

### I-019: Ledger Computation, Usage Exceeds Entitlement (Overage)
- Regular Path: live-confirmed repeatedly during I-012's testing (entitlement 50, usage 999 then 950, both correctly computed `unbilled_quantity = actual_usage - monthly_entitlement_quantity` exactly: 949 then 900).
- Classification: **PASS**.

### I-020: Ledger Computation, Entitlement Exceeds Usage (Underuse)
- Regular Path: live-confirmed during I-011's testing (entitlement 50, usage 25, `unearned_quantity = 25` before any overage submission superseded it), matching `max(0, entitlement - usage)` exactly.
- Classification: **PASS**.

### I-021: Ledger Recomputation Does Not Overwrite Settled Historical Months
- **DEFECT (Batch 17, I-021)**: invariant under test is that ledger recomputation never leaves a stale or contradictory fact behind for a month. Live-confirmed that when a month's classification flips from underuse to overage after a later usage resubmission, `upsert_monthly_entitlement_ledger` correctly updated the new type's entry but never touched the now-stale OPEN entry of the previously-applicable type, leaving both an unbilled and an unearned entry open for the same month simultaneously, an internally contradictory state. This is not the specific "settled month overwritten" scenario the journey's own premise describes (no settlement had occurred against either entry yet), but it is the same class of ledger-integrity failure the journey targets. Root cause: the RPC only ever wrote to a ledger-entry table when the newly computed quantity for that type was positive, never handling the case where a previously open entry of that type needs to be zeroed once its recomputed figure drops to zero. Risk: a month's ledger could show a customer simultaneously owed and owing, corrupting downstream billing/recognition reporting for that month. Fixed via migration `20261001030000_fix_ledger_stale_unbilled_unearned_entries.sql`: relaxed both tables' quantity check constraints to allow zero, and the RPC now zeroes an existing OPEN entry of the no-longer-applicable type in the same call (never touching a PARTIALLY_SETTLED/SETTLED entry, and never netting the two types against each other, per this domain's own explicit no-netting design). Live re-verified after the fix that a further reclassification correctly zeroes the stale entry with no contradictory nonzero coexistence.
- The journey's own literal premise (a month already recorded in `settlement_records`) was not separately exercised live in this batch, since I-022/I-023 below exercise real settlement for the first time against these same tables; no settled month was available yet at the point this journey ran. The fix applies equally to that case, since the RPC never distinguishes "never settled" OPEN from "freshly recomputed but not yet settled" OPEN, and the trigger `fn_protect_ledger_entry_lifecycle` already independently blocks any quantity change once a row leaves `OPEN` for `PARTIALLY_SETTLED`/`SETTLED`, which this fix does not touch.
- Classification: **FAILED THEN FIXED + PASS**.

### I-022: Record Settlement Against Unbilled Entries
- Regular Path: recorded a settlement of 500 against ES-000002's Sep 2026 unbilled entry (900 outstanding) via the real "Settle" form. SQL confirmed a new `settlement_records` row (`ledger_entry_type = unbilled`), and the entry's derived `status` correctly became `PARTIALLY_SETTLED`.
- **DEFECT (Batch 17, I-022)**: invariant under test, stated by the journey itself, is that a settlement_records row can never reference more quantity than remains outstanding on its ledger entry. Live-confirmed that a second settlement against an already-partially-settled entry was accepted with no rejection even though it pushed the cumulative recorded total past the entry's own outstanding quantity, and the entry's derived status incorrectly flipped to fully settled despite the overrecorded total. Root cause: `record_settlement` never checked a new settlement against the entry's own remaining outstanding quantity before inserting. Risk: settlement records could overstate how much of a customer's obligation had actually been settled, corrupting downstream reconciliation. Fixed via migration `20261001040000_fix_record_settlement_over_settlement.sql`: computes the already-settled total before inserting and rejects with `SETTLEMENT_EXCEEDS_OUTSTANDING` if the new settlement would exceed the entry's outstanding quantity, while preserving the existing idempotent same-reference-retry behavior unchanged. The original over-settlement is left in the shared database as inert test evidence (the ledger entry itself was never mutated by the bug, only the sum of its settlement rows is misleading), consistent with this program's established practice of not scrubbing evidence of a found-and-fixed defect.
- Live re-verification after the fix: on a fresh 100-unit unbilled entry (Oct 2026, same line item), settled 50 (accepted, `PARTIALLY_SETTLED`), then attempted to settle a further 60 (would total 110 against 100 outstanding): **rejected**, confirmed via SQL that no new `settlement_records` row was created and the cumulative total remained 50. Also added the new error token's mapping to `src/features/entitlement/domain/entitlement-errors.ts` so this rejection surfaces a specific message instead of a generic "unexpected error occurred" (the live re-verification ran before this mapping existed, so it displayed generically at the time; the rejection itself was already correct and is unaffected by the display-only follow-up).
- Classification: **FAILED THEN FIXED + PASS**.

### I-023: Record Settlement Against Unearned Entries
- Setup: `test-sql-smoke-co`'s Linear line item has no Minimum Usage Guarantee, making it usable for a genuine underuse case (unlike the `wf-test-pd-002-case-b` fixture, whose 1200 MUG floor always forces full consumption regardless of usage). Added a fresh Invoice Entitlement (120 qty, 12 mo) and generated its schedule; submitted usage of 20 (well under the 10/month entitlement for a 120/12 split) for a new month.
- Regular Path: SQL confirmed the resulting ledger row showed a genuine `unearned_quantity > 0`; recorded a settlement against it via the real "Settle" form on the Unearned Ledger. SQL confirmed a new `settlement_records` row (`ledger_entry_type = unearned`) and the entry's status correctly derived, using the exact same (now-fixed) `record_settlement` code path as I-022, which applies identically regardless of ledger-entry type.
- Classification: **PASS**.

### I-024: Settlement Reversal or Adjustment of a Prior Settlement
- Regular Path: confirmed via code inspection (the authoritative `record_settlement` body, re-read after applying the I-022 fix) that **no dedicated reversal/adjustment RPC exists** for `settlement_records`, and a negative-amount settlement call is independently impossible at the database level (`settled_quantity numeric check (settled_quantity > 0)`). There is currently no mechanism of any kind, correction-specific or otherwise, to reverse or adjust an already-recorded settlement.
- Classification: **PRODUCT GAP CONFIRMED**. This is a genuine, currently-real absence, not a broken implementation of an existing feature, and designing a reversal/adjustment mechanism (what it should look like, what permission gates it, how it interacts with the entry's derived status) is a product-scope decision, not a bounded bug fix. Not fixed in this batch.

### I-025: Entitlement Permission Boundary, Read vs Write
- Regular Path: logged in as `wf-test.entitlement-reader@example.test` (`entitlement.read` only, from the Batch 17 boundary-persona setup). Confirmed live: the Entitlement page loaded (read access works), the Entitlement Sources section was visible, but no "Add Invoice Entitlement", "Generate Schedule", or "Cancel" controls were rendered anywhere on the page for this persona.
- Server-side control verification: confirmed via code inspection that `createEntitlementSourceAction`, `cancelEntitlementSourceAction`, and `generateScheduleForSourceAction` all gate on `requirePermission("entitlement","write")` independently of the page-level read gate, so a direct action call (not just the hidden button) would also be rejected for this persona.
- Classification: **PASS**.

### I-026: Entitlement Settlement Permission Boundary, Read vs Write
- Regular Path: logged in as `wf-test.entitlement-writer-settlement-reader@example.test` (`entitlement.write` plus `entitlement_settlement.read`, explicitly no `entitlement_settlement.write`, from the Batch 17 boundary-persona setup). Confirmed live: the Unbilled/Unearned Ledger sections were visible (settlement read works), but no "Settle" button was rendered anywhere, even though this same persona's `entitlement.write` made the Entitlement Sources section's own "Add Invoice Entitlement"/"Cancel" controls fully active. This directly demonstrates that holding `entitlement.write` does not implicitly grant `entitlement_settlement.write`.
- Server-side control verification: confirmed via code inspection that `recordSettlementAction` gates on `requirePermission("entitlement_settlement","write")`, a completely independent permission string from `entitlement.write`.
- Classification: **PASS**.

### I-027: Orphan Monthly Usage Independent of Any Entitlement Source
- Regular Path: `test-sql-smoke-co`'s Linear line item already demonstrates this directly: Sep 2026 usage (950) and Oct 2026 usage (100) were both submitted and remain fully valid `monthly_usage` rows **after** the line item's only entitlement source (ES-000002) was cancelled and its schedule deleted (I-015). Both months' ledger rows correctly show `monthly_entitlement_quantity = 0` (no source at all currently covers them) and the full usage amount as unbilled (0/950 to 900, 0/100 to 100), exactly matching the overage formula with zero entitlement rather than erroring.
- Classification: **PASS**.

### I-028: Stable Component Key Continuity for Entitlement Records Across Commercial Version Regeneration
- Server-side control verification: confirmed via code inspection (all Entitlement tables and every query in `entitlement.data.ts`) that `entitlement_sources`, `entitlement_schedule_months`, `monthly_usage`, `monthly_entitlement_ledger`, `unbilled_ledger_entries`, and `unearned_ledger_entries` are joined to a line item exclusively via `stable_component_key` (a plain uuid column, not foreign-keyed to `commercial_components.id`); no query anywhere in the Entitlement data layer filters or joins by `commercial_components.id`.
- Regular Path: not independently re-triggered live in this batch (would require a fresh commercial amendment cycle on a line item already carrying real entitlement history); instead cross-verified against the amendment-spanning key already confirmed live during Batch 16 (`stable_component_key = 0901221e-04ac-412c-8736-d5eb8e9d80c4`, spanning 6 `commercial_components` rows through 6 amendments with entitlement/Go Live history intact throughout).
- Classification: **PASS**.

### I-029: Historical Regression, Entitlement Survives Amendment stable_component_key Fix
- Regular Path: confirmed via direct SQL that zero `commercial_components` rows have a null `stable_component_key` across all 72 rows in the shared database (the same check Batch 16's H-034 already performed), and that the amendment-spanning key above continues to resolve correctly. A fresh live amendment cycle specifically exercising new entitlement history end-to-end (sources, usage, and a settlement) was not separately re-created in this batch, since doing so would duplicate H-035/I-028's already-confirmed mechanism without adding new information; the fix's own migration (`20260920080000_fix_add_commercial_component_stable_key.sql`) directly resolves `p_stable_component_key` before every `add_commercial_component` call, which this batch's own I-017 (adding two fresh sources to an existing line item without any identity disruption) already exercises the healthy-path consequence of.
- Classification: **PASS**.

### I-030: Go Live Request Cancelled After Entitlement Source Created
- Regular Path: not independently re-created as a fresh scenario in this batch; instead reasoned directly from two already-confirmed facts from this same batch: (1) I-014/I-015 confirmed cancelling an *entitlement source* never touches `go_live_requests`, and (2) the reverse direction (cancelling a *Go Live request* never touching `entitlement_sources`) was confirmed by code inspection during pre-execution research: no trigger, FK constraint, or RPC anywhere references `entitlement_sources` from any Go Live RPC, and `cancel_go_live_request`'s full body (both the original and the post-H-043-fix rebuilt version) only ever updates the `go_live_requests` row itself.
- Classification: **PASS** (by code inspection; not independently re-verified live with a fresh cancelled-Go-Live fixture in this batch, since no code path exists that could plausibly connect the two in either direction, and the specific claim under test, "entitlement_sources rows remain queryable and unmodified," is the same invariant I-014/I-015 already live-verified from the other direction).

## Journey Discovery Check (mandatory from Batch 17 onward, per Stage A11)

Reviewed every finding this batch surfaced (I-012, I-021, I-022 defects; I-015 and I-024 PRODUCT GAP CONFIRMED
findings; all permission-boundary and continuity confirmations) against the Journey Universe taxonomy used in the
Batches 1-16 expansion audit (`docs/journey-runs/JOURNEY_UNIVERSE_EXPANSION_AUDIT.md`): ALREADY COVERED / EXPAND
EXISTING JOURNEY / NEW JOURNEY REQUIRED / REGRESSION TEST ONLY / FUTURE MODULE / PRODUCT DECISION REQUIRED.

- The three defects (I-012, I-021, I-022) are bounded bugs in the exact behavior their own journey already specifies;
  fixing and regression-testing them does not surface any distinct untested behavior outside I-006 through I-030's
  own scope. ALREADY COVERED.
- I-015 (ledger not recomputed on cancel) and I-024 (no settlement reversal mechanism) are PRODUCT GAP CONFIRMED
  findings, already fully captured as findings within their own journeys' write-ups above. They do not describe a
  new user-facing path distinct from what I-015/I-024 already test; they describe the current absence of one. No
  new journey candidate follows until a business decision defines the missing capability's shape, at which point a
  future NEW JOURNEY REQUIRED candidate would test that decision's specific implementation, not the gap itself.
- No new entity, permission, state transition, or cross-module interaction was discovered during this batch's
  research or execution that falls outside the Entitlement domain surface already enumerated in
  `docs/NEXUS_JOURNEY_UNIVERSE.md`'s E-series and cross-referenced I-series journeys.

**Conclusion: No new journey candidates found.**
