# Nexus: Go Live and Entitlement Ledger Architecture

**Status: IMPLEMENTED.** This is the authoritative document for the Go
Live domain and the Entitlement Ledger (Invoice Entitlement, monthly
allocation, monthly usage, monthly consumption, Unbilled, Unearned, and
their settlement). It contains no real customer data or real financial
figures; every example below is fictional.

This program builds on, and does not modify, Commercial Configuration
(`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`), Customer Lifecycle
(`docs/CUSTOMER_LIFECYCLE.md`), the Workflow Builder (`docs/
CUSTOMER_LIFECYCLE.md` §36), and the self-approval/actor-identity rules
from Program 4 Hardening (`docs/AUTHORIZATION_MODEL.md` §20-21). Agreement
Lifecycle and Legal-Commercial Coverage remain out of scope, unbuilt, and
untouched, per explicit product direction: they are still pending their
own product design.

## 1. Business vocabulary (locked)

These terms are distinct and never collapsed into each other:

- **Commercial Master**: the approved Commercial Configuration/Version for
  a customer. It describes what was agreed (pricing model, cadence, MUG),
  not whether billing has actually started.
- **Go Live**: the governed event that says a recurring commercial line
  item's monthly entitlement allocation may now begin. It is a request
  record with its own lifecycle, not a flag on the Commercial line item.
- **Invoice Entitlement**: the metric quantity pool created by an actual
  invoice (for example, an annual invoice for 6,000 Users). Creating this
  pool never itself starts monthly allocation.
- **Entitlement Allocation**: the deterministic month-by-month split of an
  Invoice Entitlement's quantity, anchored at the Go Live month (never the
  invoice date) for a new period.
- **Monthly Usage**: the actual metered fact for one month (what the
  customer really used), captured independently of entitlement.
- **Entitlement Consumption**: how much of a month's usage is offset
  against that month's entitlement, computed from usage, entitlement, and
  MUG together (§3).
- **Unbilled**: a metric quantity (never a monetary amount) that was used
  but not covered by entitlement, awaiting a future invoice.
- **Unearned**: a metric quantity (never a monetary amount) that was
  entitled but not used, awaiting a future credit note or forfeiture
  decision.
- **MRR Recognition**: the future module that will convert quantities into
  recognized revenue for non-linear pricing models. Not built here; this
  program only creates its integration boundary (§7).

## 2. LOCKED RULE: allocation starts at Go Live, not at the invoice date

Worked example: an annual advance invoice is raised in April 2026 for
6,000 Users, and Go Live for that line item happens in July 2026 with a
12-month duration.

- The Invoice Entitlement pool (6,000 Users) exists from April 2026.
- Monthly Entitlement Allocation does **not** begin until July 2026, and
  runs through June 2027 (500 Users/month).
- There must be no April, May, or June allocation.

Enforced by `previewAllocationSchedule`/`allocateEvenly`
(`src/features/entitlement/domain/allocation.ts`,
`src/features/entitlement/services/entitlement.service.ts`): the anchor
month for a brand-new period (`CREATE_NEW_ENTITLEMENT_PERIOD`) is always
the line item's approved Go Live month, resolved fresh from the real Go
Live request, never a client-supplied value and never the invoice date.
`allocateEvenly` divides the total evenly with 2-decimal precision and
places the entire remainder in the final month, so a division that does
not come out even never silently drops a unit.

The UI (`GenerateScheduleForm` in `src/features/entitlement/ui/
entitlement-detail-page.tsx`) will not let a recurring line item generate
a schedule until it has an approved Go Live request; an Invoice
Entitlement source can still be recorded before that point, matching the
"pool exists, allocation does not" distinction above.

## 3. LOCKED RULE: MUG consumption (three cases)

`computeMonthlyConsumption` (`src/features/entitlement/domain/
consumption.ts`) implements exactly:

```
committedConsumption = max(actualUsage, applicableMug)
consumption = min(committedConsumption, entitlement)
unbilled = max(actualUsage - consumption, 0)
unearned = max(entitlement - consumption, 0)
```

Worked cases (fictional numbers):

1. **Usage exceeds entitlement**: entitlement 500, usage 650, MUG 400.
   Consumption caps at entitlement (500) regardless of MUG. Unbilled =
   650 - 500 = 150. Unearned = 0.
2. **Usage below entitlement, MUG equals entitlement**: entitlement 500,
   usage 300, MUG 500. Committed consumption = max(300, 500) = 500,
   capped at entitlement = 500. Consumption = 500. Unbilled = max(300 -
   500, 0) = 0. Unearned = max(500 - 500, 0) = 0.
3. **Usage below entitlement, no MUG**: entitlement 500, usage 300, MUG
   null. Committed consumption = max(300, 0) = 300. Consumption = 300.
   Unbilled = 0. Unearned = 500 - 300 = 200.

Actual usage is never overwritten by consumption: `monthly_usage.quantity`
and `monthly_entitlement_ledger.actual_usage_quantity` are always the real
metered fact; `consumption_quantity` is a separate, derived column.
`computeMonthlyLedger` composes this with pricing classification (§4): a
`REQUIRES_MRR_RECOGNITION` pricing model still records actual usage but
leaves consumption/unbilled/unearned at zero rather than fabricating a
result (§7).

## 4. LOCKED RULE: no cross-month netting

Every Unbilled and Unearned entry is scoped to exactly one `(customer,
component, month)` and is never netted against another month. An October
+100 Unbilled and a November -100 Unearned (or any other combination)
always remain two separate, independently visible facts; nothing in this
program sums or offsets across months. `unbilled_ledger_entries` and
`unearned_ledger_entries` are both keyed one-to-one with a single
`monthly_entitlement_ledger` row (`unique(monthly_ledger_id)`), which
structurally prevents a cross-month entry from ever existing.

## 5. Stable commercial line item identity

Commercial Configuration mints a new `commercial_components.id` on every
Version approval (`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §4): "the
Users component" is really a chain of superseded rows, not one row. Go
Live and the Entitlement Ledger need one continuing identity for that
chain, so `commercial_components.stable_component_key` (new, additive
column, `supabase/migrations/20260918010000_go_live_domain.sql`) was
added: intended to be minted fresh (own new id) whenever an onboarding
case first creates a component, and carried forward from the prior
version's own `stable_component_key` on every subsequent Version
approval.

`fn_protect_commercial_component_lifecycle` was extended to allow
`stable_component_key` to be set exactly once from null (mirroring the
pre-existing `effective_to` allowance), never mutated afterward.

**Defect and fix (NEXUS ACCEPTANCE CLOSURE, Part B5).** The column was
made `NOT NULL` by the same migration that introduced it, but
`add_commercial_component`'s own `INSERT` was never updated to populate
it: every Commercial Configuration Version approval (fresh onboarding or
an amendment, regardless of Slab-wise MUG) failed outright with a `null
value in column "stable_component_key"` constraint violation from the
moment this migration landed. `approve_customer_onboarding_case` and
`approve_commercial_configuration_version` each carried a follow-up
`UPDATE ... set stable_component_key = ...` intended to fix this up
after the insert, but that code was unreachable dead code: the insert
above it always failed first. Found via a genuine live retest (approving
a real Slab-wise MUG amendment), not assumed working from the passing
unit tests, which never exercised the real RPC.

Fixed in `supabase/migrations/20260920080000_fix_add_commercial_component_stable_key.sql`:
`add_commercial_component` gained a new `p_stable_component_key uuid
default null` parameter and now inserts
`coalesce(p_stable_component_key, p_new_commercial_component_id)`
directly, so the column is always populated correctly at `INSERT` time.
The caller resolves the final key value (`null` to mint fresh, or the
superseded component's own key to carry forward) and passes it in;
neither approval RPC ever writes to `stable_component_key` in a
follow-up `UPDATE` again, since `fn_protect_commercial_component_lifecycle`
would reject changing an already-non-null value to something different.
Re-verified live: the previously-blocked Slab-wise MUG amendment
approved successfully after the fix, materializing as the customer's
new active Commercial Configuration Version with the prior version
correctly superseded.

**Gap closed (Nexus Foundational Hardening, Phase 1).** The RPC-side
carry-forward parameter worked correctly, but nothing on the TypeScript
side called it with a real value: every component minted by an amendment
got a brand new `stable_component_key` equal to its own new row id, every
time, regardless of whether the underlying line item was continuing or
genuinely new.

The actual missing link was one layer higher than first suspected.
`mapOnboardingComponentToCommercialComponentInsert` was never the right
place for it: that mapper only ever produces business-rule fields
(pricing, cadence, FX), and correctly carries no identity of any kind.
The real gap was that `CommercialComponentDraft`
(`src/features/customer-onboarding/domain/commercial-rate.ts`) had no
`stableComponentKey` field at all, conflating identity with `id` (the
transient per-version row id, which is never stable across an
amendment). Fixed by adding `stableComponentKey` to the draft type,
seeding it from the persisted row in `toDraftComponent`
(`.../domain/commercial-configuration-view.ts`), preserving it through a
Rate/MUG/pricing-model-only edit (`changePricingModel`,
`.../ui/commercial-rate-section.tsx`), and sending it through as
`stable_component_key` in `approveVersion`'s RPC payload
(`.../services/commercial-version.service.ts`). A genuinely new
component's `stableComponentKey` is `null` on the draft
(`createComponent`), so the RPC's own `coalesce(p_stable_component_key,
p_new_commercial_component_id)` mints a fresh identity for it, exactly as
designed. Covered by regression tests in `commercial-rate.test.ts`,
`commercial-configuration-view.test.ts`, and
`commercial-version.service.test.ts` (the last asserts the actual RPC
payload, not only the domain mapper). Cross-version identity continuity
is no longer an unverified claim: it is the behavior these tests guard.

Every Go Live request, Entitlement Source, Monthly Usage row, and
Monthly Entitlement Ledger row is keyed by `stable_component_key`, never
by the transient `commercial_components.id`, so a line item's Go Live and
entitlement history survives every future Commercial Version.

## 6. Go Live domain

### 6.1 Line item statuses

`deriveLineItemGoLiveStatus` (`src/features/go-live/domain/types.ts`):

- `NO_GO_LIVE`: no Go Live request exists yet for this line item.
- `GO_LIVE_PENDING`: a non-cancelled request exists but none is approved.
- `LIVE`: an approved request exists.
- `CANCELLED`: every request for this line item was cancelled.

On-Demand line items are always `NO_GO_LIVE` and are never asked to Go
Live at all (§6.4); the UI renders this as "Go Live: Not Required", never
as a misleading "No Go Live".

### 6.2 Request lifecycle

`go_live_requests.status`: `draft` -> `submitted`/`resubmitted` ->
`approved` | `sent_back` (loops back to `resubmitted`) | `cancelled`
(only from `draft`, creator-only). These are the same four governed
states already used by Customer Onboarding and Commercial Version
(`docs/CUSTOMER_LIFECYCLE.md`); Go Live deliberately does not introduce
Suspended, Stopped, or Churned, since nothing in this program's scope
requires them.

### 6.3 Customer confirmation gates approval, not submission

A Go Live request may be submitted for review before the customer has
confirmed readiness (`customer_confirmation_status`: `pending` |
`confirmed`), matching real timelines where internal review starts before
the customer signs off. `approve_go_live_request` raises
`GO_LIVE_CONFIRMATION_REQUIRED` if confirmation is not `confirmed`;
submission itself has no such gate. Evidence is an uploaded document
(`go_live_documents`, types `customer_confirmation`/`signed_uat_document`),
never an unattached internal checkbox declaration.

### 6.4 On-Demand: no Go Live at all

An On-Demand line item (`commercial_components.pricing_rule_parameters.
commercialNature = "on_demand"`, surfaced as `isRecurring: false`) never
creates a Go Live request. `listCurrentLineItemsForCustomer` hardcodes
`goLiveStatus: "NO_GO_LIVE"` and `currentRequest: null` for these, and
`submit_monthly_usage` skips its Go Live gate entirely when
`p_is_recurring = false`. Its entitlement page shows only Monthly Usage
entry (§7.6): there is no entitlement pool to gate.

### 6.5 Self-approval and audit

`approve_go_live_request` and `send_back_go_live_request` both raise
`SELF_APPROVAL_NOT_ALLOWED` if the acting user created the request,
matching the permanent rule in `docs/AUTHORIZATION_MODEL.md` §20. Every
mutation on `go_live_requests`, `go_live_documents`, `entitlement_sources`,
`monthly_usage`, and `settlement_records` is captured by the existing
`fn_audit_row` trigger, including the actor identity snapshot from
Program 4 Hardening (`docs/AUTHORIZATION_MODEL.md` §21).

### 6.6 Workflow Runtime: team routing is real; the permission boundary is not graph-controlled

**[Updated, Nexus Foundational Hardening Phase 2 / Workflow Runtime V1,
supabase/migrations/20260921000000_workflow_runtime_v1.sql. See
docs/WORKFLOW_ENGINE_ARCHITECTURE.md §3a for the full, current picture
across all four governed domains, not only Go Live.]**

Go Live was the first business domain to consume the Workflow Builder
(`docs/CUSTOMER_LIFECYCLE.md` §36) as something more than an authoring
tool, via a minimal Workflow Runtime
(`src/platform/workflow-builder/domain/runtime.ts`):

- `create_go_live_request` resolves and snapshots the currently published
  `go_live` Workflow Definition Version's id onto the request at creation
  time, so an in-flight request keeps the graph it started with even if a
  newer version is later published. Commercial Configuration Version,
  Customer Onboarding, and Customer Change now do the identical
  snapshotting for their own `applies_to`.
- `approve_go_live_request` (and the other three domains' own `approve_*`
  RPCs) now call `fn_resolve_workflow_responsible_team` inside the
  approval transaction itself and require the approving actor to be an
  active member of the Approval node's named team, if one is set. This
  is genuinely enforced, not display-only: a Workflow Admin's team
  choice on an Approval node now controls who may actually approve.
- `resolveWorkflowApprovalStep` (the same graph walk, kept in TS) is
  used only to show that team ahead of time, e.g. an Operational Queue
  "Responsible Team" column; the SQL walk inside the RPC is the real,
  final authority at the moment of approval.

The REQUIRED PERMISSION remains a fixed, hardcoded
`requirePermission("go_live", "approve")` (and the equivalent fixed
permission for the other three domains), never derived from the graph.
This is the one piece of the original security boundary that is
unchanged and non-negotiable: a database-configured workflow graph
routes WHO (which team) approves, never WHICH PERMISSION is required to
approve. Real conditional (Decision-node) routing now exists too, for
Commercial Configuration Version's `segment` field specifically; see
`docs/WORKFLOW_ENGINE_ARCHITECTURE.md` §3a for its exact, bounded scope.

## 7. Entitlement Ledger domain

### 7.1 Interface independence: TypeScript computes, RPC persists

Every business computation, allocation split (`allocation.ts`), MUG
consumption (`consumption.ts`), and pricing-recognition classification
(`pricing-classification.ts`), is a pure, directly unit-tested TypeScript
function with no I/O. The RPCs (`generate_allocation_schedule`,
`upsert_monthly_entitlement_ledger`) only ever persist already-computed
values; none of them re-derive business logic in PL/pgSQL. Manual Finance
entry today and a future API/import integration both call the exact same
`src/features/entitlement/services/entitlement.service.ts` functions
(`submitMonthlyUsage`, `recomputeMonthlyLedger`, and so on): no business
logic is buried only in a React component, satisfying `docs/
API_INTEGRATION_ARCHITECTURE.md` §1's interface-independence principle for
a second real domain.

### 7.2 Entitlement Sources: the invoice-backed pool

`entitlement_sources` records one invoice's worth of entitlement
(reference, date, quantity, metric, duration, optional supporting
document reference). Creating a source never requires Go Live (§2);
confirmed live in Batch 16 (I-001).

**Product decision (Stage A, post-Batch 16): manual only, for now.**
`source_type` is `MANUAL` today; the column's own `check` constraint
already allows `API`/`IMPORT`, but `create_entitlement_source` has no
`p_source_type` parameter at all today, so every call unconditionally
produces `MANUAL` (confirmed live, Batch 16 I-003/I-004). This is now a
deliberate, decided product-scope boundary, not an open question:
API-created and Import/Bulk-created Entitlement Sources are intentionally
out of current scope. Building either requires designing the
non-interactive caller authentication model first
(`docs/API_INTEGRATION_ARCHITECTURE.md` §7, "Service principal / machine
identity"), plus, for Import, a real file-format/validation decision;
see `docs/TECH_DEBT.md` for the exact trigger point. When that work happens, it calls the same
`createEntitlementSource` service function Manual entry already uses,
per the interface-independence principle in
`docs/API_INTEGRATION_ARCHITECTURE.md` §1: no business logic is
duplicated, only a new caller and a new parameter are added.

**LOCKED RULE (Product Decision Closure, 2026-09-22): invoice-created
entitlement persists unless reduced or reversed by the source financial
document's own lifecycle (a Credit Note); no independent entitlement-
source cancellation may erase it.** Cancelling a source
(`cancel_entitlement_source`) stops future, not-yet-recognized monthly
allocation only: it deletes `entitlement_schedule_months` rows for
months that have no `monthly_entitlement_ledger` row yet, but preserves
schedule data for any month already recognized in the ledger, so a
later recompute of an already-recognized month can never silently lose
that source's historical contribution (fixed in migration
`20261002000000_fix_cancel_entitlement_source_preserves_ledgered_months.sql`,
after Batch 17's I-015 found the prior unconditional-delete behavior
created exactly this risk). Nexus has no Credit Note document lifecycle
wired to Entitlement today; the `invoice_evidence`/`credit_note` concept
in `docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md`
is a separate billing-reconciliation bounded context, structurally
unconnected to `entitlement_sources`. A real CN-driven entitlement
reduction/reversal mechanism is a future-module dependency (§8,
`docs/TECH_DEBT.md`), not built here.

### 7.3 Additional-invoice handling: same mechanism, different anchor

There is no separate "period" table. `entitlement_schedule_months` is one
row per `(entitlement_source_id, month)`; the Monthly Entitlement Ledger
sums every source's schedule row for a given `(component, month)`. This
makes "top up an existing period" (`ADD_TO_EXISTING_ENTITLEMENT_PERIOD`)
and "start an overlapping new period" (`CREATE_NEW_ENTITLEMENT_PERIOD`)
the same underlying write, generating more schedule rows, differing only
in which start month `previewAllocationSchedule` proposes:
`ADD_TO_EXISTING` anchors one month after the latest month any existing
schedule for that component already covers; `CREATE_NEW` anchors at the
Go Live month. An overlap is never silently blocked: the preview flags
`overlapsExistingSchedule` and the UI requires a conscious "Confirm and
Generate" click, warning that overlapping months will add to, not
replace, the existing monthly total.

### 7.4 Monthly Usage: independent of entitlement

`monthly_usage` captures the real metered fact for one month,
independently of whatever entitlement exists. `fn_protect_monthly_usage_
lifecycle` allows only `status`/`is_current` to change after insert, and
`status` only moves `draft` -> `final`, never back; a later correction
supersedes the current row (`is_current` unique partial index) rather
than mutating history in place. `submit_monthly_usage` raises
`USAGE_BEFORE_GO_LIVE` for a recurring line item with no approved Go Live
request at or before the usage month; On-Demand usage skips this check
entirely (§6.4).

### 7.5 Monthly Entitlement Ledger: the one computed row per month

`monthly_entitlement_ledger` is the single `(customer, component, month)`
row produced by `recomputeMonthlyLedger`: it sums that month's schedule
quantity, reads the current usage, classifies the pricing model (§7.7),
and calls `computeMonthlyLedger` (§3). It is idempotent
(`insert ... on conflict (customer_id, stable_component_key, month) do
update`), safe to call repeatedly after every usage submission or
schedule regeneration for the affected month.

### 7.6 Unbilled and Unearned: first-class, running, never netted

`unbilled_ledger_entries` and `unearned_ledger_entries` are independent,
append-only-by-status ledgers (`fn_protect_ledger_entry_lifecycle`:
quantity mutable only while `status = 'OPEN'`, frozen forever once any
settlement exists, DELETE forbidden). Settlement is `settlement_records`:
an Invoice reference for Unbilled or a Credit Note reference for
Unearned, supporting partial settlement (`record_settlement` recomputes
`OPEN` -> `PARTIALLY_SETTLED` -> `SETTLED` from `sum(settled_quantity)`
versus the entry's own total). No monetary amount is ever stored; this is
explicitly not an Accounts Receivable or invoicing engine (§8).

**LOCKED RULE (Product Decision Closure, 2026-09-22): settlement
corrections occur through immutable linked reversal/adjustment
transactions rather than mutation or deletion of the original
settlement.** `settlement_adjustments` is a separate, append-only table
(never updated, never deleted): each row reverses a specific quantity
against one `settlement_records` row via `reverse_settlement`, cannot
exceed that settlement's own remaining reversible quantity
(`SETTLEMENT_REVERSAL_EXCEEDS_SETTLED` otherwise), is idempotent on
`(original_settlement_id, reversal_reference)` mirroring
`record_settlement`'s own pattern, and is gated on the same
`entitlement_settlement.write` permission (no new approval hierarchy).
A ledger entry's true net-settled total is `sum(settlement_records.
settled_quantity)` minus `sum(settlement_adjustments.reversed_quantity)`
for that entry; `reverse_settlement` recomputes the entry's derived
`OPEN`/`PARTIALLY_SETTLED`/`SETTLED` status from that net figure using
the same thresholds `record_settlement` itself uses. Built in migration
`20261002010000_add_settlement_reversal.sql`, closing Batch 17's I-024
finding.

For an On-Demand line item, there is no entitlement pool at all, so
`monthlyEntitlementQuantity` is always 0 for it: the same math in §3 then
naturally yields `unbilled = actualUsage`, `unearned = 0`. This is not a
special-cased on-demand branch, it is the correct, unmodified consequence
of "nothing was pre-paid, so everything used is unbilled." The
Entitlement page hides the Entitlement Sources/Schedule sections for
On-Demand line items (there is nothing to show) and shows only Monthly
Usage entry plus the resulting ledger/unbilled sections.

### 7.7 Pricing-model recognition boundary (MRR Recognition integration point)

`classifyPricingRecognition` (`src/features/entitlement/domain/
pricing-classification.ts`):

| Pricing model | Class | Ledger behavior |
|---|---|---|
| Per Unit (`linear`), Flat Fee (`flat`) | `AUTO_FINALIZABLE` | Consumption/Unbilled/Unearned computed and finalized immediately |
| Slab (`volume`), Progressive Slab (`graduated`), Designation-based (`dimension`) | `REQUIRES_MRR_RECOGNITION` | Actual usage still recorded; consumption/unbilled/unearned held at 0, `recognition_status = 'pending_mrr_recognition'` |

This is the entire MRR Recognition integration boundary this program
builds: a `recognition_status` column and an honest "pending" state, never
a fabricated recognized number. The future MRR Recognition module is not
built here (§8); when it exists, it is expected to read rows with
`recognition_status = 'pending_mrr_recognition'` and write back a real
recognized outcome, without this program's tables needing to change
shape.

## 8. What this program deliberately does not build

Per explicit product direction, none of the following exist yet, and
nothing above should be read as simulating them:

- The full MRR Recognition workflow (§7.7 only creates its integration
  boundary).
- A full Invoice/Accounts Receivable engine. Settlement references an
  external invoice/credit note by string reference only.
- Automated ERP invoice integration or automated Usage APIs for external
  systems (the manual/API code paths already share business logic, §7.1,
  so adding a real integration later is additive, not a rewrite).
- Revenue accounting or general-ledger posting of any kind.
- Agreement Lifecycle and Legal-Commercial Coverage (explicitly pending
  their own product design; nothing in this program touches them).
- A Suspended/Stopped/Churned line-item lifecycle. Only `NO_GO_LIVE` /
  `GO_LIVE_PENDING` / `LIVE` / `CANCELLED` exist (§6.1), matching what Go
  Live actually needs today.
- A Credit Note document lifecycle wired to Entitlement (§7.2). Invoice
  entitlement reduction/reversal driven by a real CN is a future-module
  dependency, recorded in `docs/TECH_DEBT.md`, not invented here.
  Settlement reversal itself (§7.6) is built; what is absent is a real
  financial CN document that could drive an entitlement-source-level
  reduction.

## 9. Authorization

New permissions: `go_live.read`/`create`/`submit`/`approve`,
`entitlement.read`/`write`, `usage.read`/`write`/`finalize`,
`entitlement_settlement.read`/`write`. `usage.write` (submit) and
`usage.finalize` are deliberately distinct permissions, so an
organization can let more people submit monthly usage than can finalize
it. New roles: `go_live_admin`, `finance_admin`; the existing `maker`
role additively gained `go_live.read/create/submit` and `checker`
additively gained the full `go_live.*` set including `approve`. See
`docs/AUTHORIZATION_MODEL.md` for the full permission model this extends.

## 10. Resource Registry

Only one new resource type was registered: `go_live_request`. Individual
Entitlement Source/schedule/usage/ledger/settlement rows are
deliberately **not** Resource-backed, matching the existing precedent
that `commercial_components`/commitments are not Resource-backed either:
registering every ledger row would create noise without a real consumer
of that generality today.

## 11. Dates and periods

Go Live Date, Invoice Date, and Settlement Date are business dates
(`YYYY-MM-DD`, no timezone). Usage and allocation months use the new
canonical `MonthKey` (`YYYY-MM`) utilities in `src/lib/month.ts`
(`toMonthKey`, `monthKeyToBusinessDate`, `addMonths`,
`monthsBetweenInclusive`, `monthRange`, `compareMonthKeys`,
`formatMonthKey`), deliberately pure string/integer arithmetic that never
constructs a `Date` object for business semantics, matching `docs/
UI_SYSTEM.md`'s existing business-date rule. Audit timestamps continue to
use the existing UTC-timestamp audit machinery unchanged.

## 12. Concurrency and idempotency

Every new RPC follows the codebase's existing `SELECT ... FOR UPDATE`
plus status-text guard pattern; none introduce a `row_version` optimistic
lock, since none of these records have a genuine "did the base record
move underneath me" concurrent-edit scenario. `generate_allocation_
schedule` is a delete-then-reinsert for one source (idempotent by
construction). `upsert_monthly_entitlement_ledger` is a true upsert on
its natural key, safe to call repeatedly, including from a retried
request.

## 13. Performance

New indexes cover `(customer_id, stable_component_key, month)` on the
ledger and schedule tables, `(stable_component_key)` lookups for sources
and usage, and partial indexes on `status = 'OPEN'` for the Unbilled and
Unearned ledgers plus `go_live_requests.status`. Every new list read
(`listEntitlementSourcesForComponent` and its siblings) is already scoped
to one `stable_component_key`, never an unbounded table scan.

## 14. Testing

Domain math is covered directly: `allocation.test.ts` (even and uneven
splits, remainder placement), `consumption.test.ts` (all three MUG cases
plus edge cases), `pricing-classification.test.ts`, `month.test.ts`, and
`domain/types.test.ts` for the Go Live status/current-request derivation
functions. See `docs/MANUAL_ACCEPTANCE_TEST.md` for the full manual
scenario checklist this program adds to.

## 15. What this document is not

Not a decision on Agreement Lifecycle, Legal-Commercial Coverage, MRR
Recognition, or a real Accounts Receivable/invoicing engine. All four
remain explicitly out of scope (§8) and unimplemented.
