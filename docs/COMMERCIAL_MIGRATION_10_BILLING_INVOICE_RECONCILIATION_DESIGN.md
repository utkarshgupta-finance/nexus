# Nexus: Commercial Migration 10, Billing, Invoice, and Reconciliation Design

**STATUS: LOCKED.**

**DESIGN ONLY. NO MIGRATION SQL. NO IMPLEMENTATION.**

This document is the migration-level design for Migration 10 (Billing,
Invoice, Reconciliation): `billing_calculations`, `invoice_eligibility_events`,
`invoice_evidence`, `invoice_evidence_items`, `reconciliation_adjustments`.
It builds on the already-locked logical sketch in
`docs/COMMERCIAL_DATABASE_DESIGN.md` (§5.10-5.13, §7, §8, §13, §15, §16,
§18) and `docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` (§4 "Migration
10"), verified against the M8 and M9 schema as actually applied
(`supabase/migrations/20260908210000_commercial_configuration_foundation.sql`,
`supabase/migrations/20260910100000_commercial_usage_earned_foundation.sql`).

M8 and M9 are not reopened. Every example is generic and fictional.

## 0. Revision note: what this document adds beyond the existing sketch

The logical sketch for these five tables predates one thing this
document must account for: **`earned_results` is versioned.**
`docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md` revised
`earned_results` from a flat immutable table into an immutable, versioned
one (`result_version`, `supersedes_earned_result_id`, currentness
derived, never stored), after the M10 sketch was written. That M9
document's own §16 left one explicit forward pointer unresolved: whether
a Billing Calculation must read only the current Earned Result version,
and what happens financially when a version it already billed is later
superseded. §9 below resolves this.

Nothing else already locked is changed. Where this document adds a
column, an enum value, or a mechanism the higher-level sketch did not
yet spell out, it says so explicitly and explains why, the same
discipline `COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` itself used when
elaborating Migration 8's and Migration 9's own sketches into full
contracts.

## 0a. Revision note: Billing Calculation versioning corrected

An earlier pass of this draft mirrored M9's `earned_results` versioning
mechanism (`calculation_version`, `supersedes_billing_calculation_id`,
"current version" derivation) onto `billing_calculations`. That was
design drift, not a faithful reading of the locked architecture, and is
reversed in this revision.

The locked design's own distinction is intentional, not an oversight it
left to be filled in: **Earned Results represent economic truth and may
need historical recalculation** (M9's own reason for versioning them);
**Billing Calculations represent a historical billing decision made with
the information available at that time**, and are locked as insert-only,
permanent once created, with billing corrections handled exclusively by
`reconciliation_adjustments`, never by a superseding or corrected Billing
Calculation row. §3, §8, §9, §10, §15, §16, §17, and §19 below are all
revised accordingly. No other table's design changes in this revision.

## 0b. Revision note: Reconciliation Adjustment source links removed

An earlier pass of this draft added two nullable singular FK columns,
`source_earned_result_id` and `source_billing_calculation_id`, to
`reconciliation_adjustments`, intended to record the one specific row
that triggered a given adjustment. That is design drift for the same
reason as §0a: a reconciliation window is not bound to a single Billing
Calculation. Billing and reconciliation cadences are independent
(§18); an annual reconciliation window can span four quarterly
`billing_calculations` rows and several `earned_results` rows, so a
singular `source_billing_calculation_id` would misrepresent the
provenance of the reconciliation result whenever the window spans more
than one. This revision removes both columns and instead carries the
comparison itself, `earned_amount`, `billed_amount`, and the derived
`monetary_difference`, directly on each `reconciliation_adjustments`
row, alongside the free-text `reason`. §7, §9, §15, §16, §17, and §18
below are revised accordingly. No other table's design changes in this
revision.

## 0c. Revision note: quantity and rate provenance restored

A source-trace against `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §10
found a genuine gap, not present in the field names claimed in an
earlier review pass (those exact names never appear anywhere in this
repository's history), but real against the locked prose itself.
`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §10, part A, `[LOCKED]`,
reads in full: "Reconciliation preserves an operational quantity or
billing-basis difference wherever a quantity comparison is meaningful,
and separately preserves the monetary difference, which is the actual
Finance outcome. Sufficient effective-rate and commercial-period
provenance is preserved to explain the monetary amount. Nexus never
manufactures a fabricated quantity by dividing a monetary difference by
a single rate when more than one rate was effective during the
period... the monetary difference stands on its own, supported by
rate/period provenance, without a forced quantity explanation."

Before this revision, `reconciliation_adjustments` carried
`earned_amount`/`billed_amount`/`monetary_difference` (the Finance
outcome) and free-text `reason` (why the adjustment exists), but
nothing captured the operational quantity/billing-basis difference
when meaningful, nor the effective-rate/commercial-period provenance
this locked passage requires to explain the monetary amount. `reason`
alone is not that: a reason explains why an adjustment exists, not how
its monetary figure can be reconstructed and audited. This revision
adds two columns to `reconciliation_adjustments`: `quantity_explanation`
(nullable `jsonb`, populated only when a quantity/billing-basis
comparison is meaningful, matching the locked "without a forced
quantity explanation" language exactly) and `rate_provenance` (`jsonb`,
not null, since the locked text frames effective-rate/commercial-period
provenance as unconditionally preserved, "the monetary difference
stands on its own, supported by rate/period provenance"). §7, §15, and
§16 below are revised accordingly. No other table's design changes in
this revision; this is a narrow traceability correction against
already-locked domain architecture, not a new business decision.

## 1. Purpose and M9/M10 boundary

M10 answers exactly seven questions:

1. What Earned value is eligible to be billed?
2. When is it eligible?
3. What billing calculation was performed?
4. Which specific Earned Result version was used?
5. What invoice evidence proves what was actually invoiced?
6. What differences exist between Earned and Billed?
7. How are corrections and reconciliation adjustments recorded without
   rewriting history?

M9 owns Earned truth exclusively. **M10 never mutates an Earned Result to
make it agree with an invoice.** Earned, Billing Calculation, Invoice, and
Reconciliation Adjustment are four distinct concepts, never collapsed:

- **Earned** (M9): the commercial economic value earned, independent of
  billing timing or eligibility.
- **Billing Calculation** (M10): what the billing logic says should be
  billed for a defined scope and period, using a specific, named source.
- **Invoice Evidence** (M10): Nexus's record that a real external
  invoice or credit note document exists; never the source of a
  calculation.
- **Reconciliation Adjustment** (M10): a permanent, auditable explanation
  for a difference between what was earned/billed and what invoice
  evidence actually shows.

## 2. Existing M8/M9 dependencies

Read read-only from the applied schema; nothing below is mutated by this
design.

- **`commercial_components`** (`id`, `commercial_configuration_id`,
  `billing_cadence`, `billing_timing` (`advance`/`arrears`),
  `billing_quantity_basis` (`mug`/`previous_period_actual`/`fixed`,
  required only when `billing_timing = 'advance'`), `reconciliation_cadence`,
  `transaction_currency`, `pricing_rule_kind`, `effective_from`/`effective_to`):
  the scope and policy every M10 row ultimately traces back to. M10 reads
  this table's billing policy; it never writes to it.
- **`commercial_commitments`** (`id`, `kind` (`quantity`/`spend`),
  `commercial_component_id` nullable): the source for `'mug'`-basis
  Billing Calculations.
- **`earned_results`** (`id` caller-supplied, `commercial_component_id`,
  `period_start`/`period_end`, `result_version`,
  `supersedes_earned_result_id`, `calculated_amount`,
  `transaction_currency`, `status`): the source for
  `'previous_period_actual'`/`'period_actual'`-basis Billing Calculations
  (§9). Immutable and versioned; M10 only ever reads it.
- **`resources`/`resource_types`**: only `reconciliation_adjustments`
  mints a `resources` row (§12).
- **`audit_log`**: the generic `fn_audit_row(pk_column [, resource_id_column])`
  pattern is reused unmodified.
- **`app_users`**: the actor-reference target for every actor column.

## 3. Billing Calculation model

**Immutable, insert-only, permanent once created, exactly as already
locked.** `billing_calculations` carries no `calculation_version`, no
`supersedes_billing_calculation_id`, no "current Billing Calculation"
concept, and no correction chain of any kind (§0a). Every column is
immutable from creation. `fn_reject_update_delete()` (reused, unmodified)
rejects every `UPDATE`/`DELETE` unconditionally, the same pure-insert-only
posture already used for `commercial_changes` and every M9/M10 insert-only
table. There is no `fn_protect_billing_calculation_lifecycle()` and no
finalize transition of any kind: this table has nothing to transition.

**A wrong calculation is never replaced; it stays exactly as it was
computed.** If `billing_calculations` row B1 incorrectly calculated 90
against an Earned amount of 100, B1 remains permanently 90. No B2 row is
ever created to supersede or correct it. The financial correction is
recorded as a `reconciliation_adjustments` row (§7, §17 scenario 12),
never as a second or replacement Billing Calculation. This is the entire
reason `reconciliation_adjustments` exists as a separate table, not a
detail this document is free to route around by giving
`billing_calculations` its own correction mechanism.

**Grain, and exactly one calculation per grain, database-enforced.** One
row per `(commercial_component_id, billing_period_start,
billing_period_end)`. The locked design's own Migration 10 contract
(`docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` §4) states no
uniqueness constraint on this grain at all, only "immutable... insert-only,"
so this document is not overriding an already-locked constraint by adding
one. It is, however, the strongest interpretation the locked design
actually supports, not an invention: because correction is handled
exclusively through `reconciliation_adjustments` and never through a
second or replacement Billing Calculation row, a genuine, intended second
row for the same grain is not a legitimate outcome under any
circumstance the locked design describes; it could only ever be an
accidental duplicate. A plain, unconditional `UNIQUE
(commercial_component_id, billing_period_start, billing_period_end)`
constraint enforces exactly this, and it is not versioning: no self-FK,
no chain, no "current" concept, nothing to derive, just an ordinary grain
uniqueness constraint of the same shape already used elsewhere in this
schema (for example `commercial_configurations.key`).

**Tested against every named cycle and correction shape; none requires a
second row for the identical grain.** Monthly, quarterly, and annual
cycles (§17 scenarios 1-3) each still resolve to exactly one
`(commercial_component_id, billing_period_start, billing_period_end)`
tuple per cycle; the cadence only changes how wide the window is, never
whether more than one row can share it. A one-time charge (scenario 4)
and a milestone charge (scenario 5) each use one nominal period, so the
grain is satisfied once, by construction. A technical retry (§10, §17
scenario 18) reuses the same caller-supplied `id` with identical inputs
and returns the existing row; it never attempts a second row for the
grain at all. Partial invoicing (scenario 8) never touches
`billing_calculations`: it adds `invoice_evidence`/
`invoice_evidence_items` rows against the one existing Billing
Calculation, so the grain constraint is not even in play. A billing
error corrected through reconciliation (scenario 12) is, by this
revision's own design, never a second `billing_calculations` row at all,
the correction is a `reconciliation_adjustments` row instead, so it
cannot conflict with a constraint on a table it never writes to. No
scenario in this list, or in the full §17 set, requires two
`billing_calculations` rows for the same grain; the `UNIQUE` constraint
is retained as stated above.

**Singular source, unchanged.** `source_earned_result_id` and
`source_commercial_commitment_id` are plain, singular FK columns, never a
join table or an array, matching the locked design's own singular-source
shape exactly. No document anywhere states a Billing Calculation can
aggregate more than one Earned Result; the locked Role description itself
reads "what should mathematically be billed for a cycle, with **traceable
source**" (singular). This document does not change that.

**Source basis, one addition to the locked enum, explained.** The locked
`billing_quantity_basis_used` enum (`'mug'`, `'previous_period_actual'`,
`'fixed'`) was written before this table's own detailed design pass and
does not yet name a value for the most common case this migration must
support: **arrears billing**, where the amount is based on the same
period's own, now-closed, actual Earned Result. `commercial_components`
already treats arrears as structurally distinct (`billing_quantity_basis`
is required only for `advance` and is `null` for `arrears`), so nothing
in `'mug'`/`'previous_period_actual'`/`'fixed'` was ever meant to cover
it. This document adds **`'period_actual'`**: populated whenever the
billing amount is based on the Earned Result for the exact same period
being billed (arrears), as distinct from `'previous_period_actual'`
(advance billing using an earlier period's actual as a proxy). Both
populate `source_earned_result_id`; which of the two applies is fully
recoverable later by comparing the referenced Earned Result's own period
against `billing_period_start`/`billing_period_end`, so nothing is
duplicated, only named. This is the same kind of necessary elaboration
`COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` itself performed when turning
each table's first sketch into a full contract, not a reopening of any
already-applied decision (this column does not exist in any applied
migration yet).

**Shape, unchanged from the locked design**: `source_earned_result_id`
populated only for `'previous_period_actual'`/`'period_actual'`;
`source_commercial_commitment_id` populated only for `'mug'`; neither
populated for `'fixed'`; `basis_quantity` populated together with
whichever source is used, null for `'fixed'`.

**Snapshot scope validation, mirroring `fn_protect_earned_result_scope()`.**
A new `fn_protect_billing_calculation_scope()` (`BEFORE INSERT`) validates,
by the identical pattern already proven in M9: `source_earned_result_id`,
if populated, must belong to the same `commercial_component_id`, and its
own period must equal the billing period (`'period_actual'`) or precede
it (`'previous_period_actual'`); `source_commercial_commitment_id`, if
populated, must be `kind = 'quantity'` and belong to the same Component.
No pricing arithmetic; relationship integrity only.

**Caller-supplied identity, for retry safety only, never for version
identity (§10).** `id` is caller-supplied (no default) so a technical
retry after a timeout can be recognized and answered idempotently, the
same reason `earned_results.id` is caller-supplied; it does not imply, and
must not be read as implying, that this table has versions. A
`record_billing_calculation` RPC probes by `id` first: found with
identical substantive inputs returns the existing row unchanged (a
retry); found with a mismatched payload raises a named conflict (a
caller defect, the same identity reused for a genuinely different
calculation). Not found by `id` means a genuinely new attempt, which
must still respect the one-row-per-grain constraint above: the RPC locks
the stable parent `commercial_components` row first (the same corrected
lock-then-fresh-requery pattern M9 had to repair once for
`record_earned_result`, applied here from the start, §14), then probes by
grain as a named pre-check before attempting the insert, so a genuine
duplicate attempt (a different `id`, the same grain) raises a named
conflict rather than surfacing a raw constraint violation; the plain
unique constraint on the grain remains the final, authoritative guard
regardless.

## 4. Invoice Eligibility Event model

**Answers "when did this become eligible or ineligible, and why," never
"has this been invoiced."** Append-only, one row per eligibility decision.
Columns: `id`, `billing_calculation_id` (FK), `eligible
boolean not null`, `reason text not null` (free text; illustrative
reasons only, per the locked domain document, never a closed workflow
engine), `decided_by` (nullable FK to `app_users`, since some decisions
are system-driven, for example a billing date being reached, not a human
action), `created_at`/`created_by` only, matching the already-locked
statement for this exact table ("no `updated_at`/`updated_by`").

**Single source of truth, matching the already-locked read pattern
exactly**: "current eligibility" is always the latest event per Billing
Calculation, a derived query, never a stored flag on
`billing_calculations`. This resolves the design brief's own A/B/C
question as option B, exactly as already locked; no duplicated lifecycle
state exists anywhere in this model.

No idempotency key is added: each eligibility decision is a genuine,
discrete Finance or system action, not an externally-keyed event subject
to redelivery, so the `source_system`/`source_event_key` pattern used
for `usage_facts` does not apply here.

## 5. Invoice Evidence model

**A pure header, exactly as already locked.** Columns:
`id`, `evidence_kind` (`invoice`/`credit_note`), `external_reference`,
`external_date`, `amount`, `currency`, `source_system`, standard columns.
No FK to any Nexus financial item; allocation lives entirely in
`invoice_evidence_items` (§6). Never the source of a calculation.

**Ingestion idempotency, an application of the identical pattern already
proven for `usage_facts`, not a new mechanism.** The locked column list
already names the two fields that form the natural key:
`source_system` and `external_reference` (the external document's own
number). A partial unique index on `(source_system, evidence_kind,
external_reference) WHERE source_system IS NOT NULL AND external_reference
IS NOT NULL` deduplicates externally-sourced evidence exactly as
`usage_facts` deduplicates externally-keyed usage; manually entered
evidence (no `source_system`) is never deduplicated, for the identical
reason manual usage entry is not: there is no reliable natural key to
derive one from.

**Namespace evaluated against Configuration/customer/legal-entity scope,
not added.** An external accounting or billing system's own document
numbering is, by ordinary real-world behavior, already unique within
that one system: one source system, one number sequence, never reused
across its own customers or entities. `source_system` already carries
that scope. Adding Configuration, customer, or legal-entity scope on
top would require a column `invoice_evidence` deliberately does not
have (§1, §12): this table is a pure header with no FK to any Nexus
financial item, by design, and allocation to a specific Commercial
Configuration happens entirely through `invoice_evidence_items` (§6),
not the header. Denormalizing that scope onto the header solely to
widen an idempotency key would violate the same "pure header" decision
this design otherwise holds throughout. If a specific `source_system`
is later found to reuse document numbers across its own sub-ledgers,
the smallest safe fix is scoping that one `source_system`'s ingestion
externally (for example, a compound `external_reference` assembled
before it reaches this table), not widening this header's key with
scope it does not otherwise carry.

**A "debit note" is represented as `evidence_kind = 'invoice'`** (a
supplementary invoice document), not a third enum value: the locked
two-value enum already covers every case Nexus needs to represent, and
this document does not extend it, unlike §3's addition (which closed a
genuine structural gap `commercial_components` itself already implies).
An external system's own label for a supplementary invoice does not
change which Nexus concept it is.

**Correction is a new row, never an edit, though no
`supersedes_evidence_id` column exists.** `invoice_evidence` is fully
immutable and insert-only, matching the locked design exactly. If a
recorded document was wrong because the *external* document itself was
corrected or replaced, Nexus records the correction the same way it
always does: a new `invoice_evidence` row (typically a `credit_note`
offsetting the wrong one, followed by a corrected `invoice`), never an
edit of the original. A pure Nexus-side transcription mistake (the
external document was right, Nexus mis-recorded it) has no dedicated
repair path in this design; it uses the identical new-row correction
path, matching the same discipline already applied to `usage_facts` (a
mistaken entry is voided, never edited). This is a deliberate scope
boundary, not an oversight: adding a distinct "fix my own data entry"
mechanism duplicates a correction path that already exists.

**Resource Registry, reconsidered and reaffirmed.** `invoice_evidence`
plausibly could benefit from independent Resource identity later (a real
invoice document is a natural place to attach a PDF, leave a comment, or
anchor a dispute workflow). This document keeps it **not** Resource-backed
for this migration: the locked design already decided this, nothing in
this migration's actual required capability (record evidence, allocate
it, reconcile against it) needs independent action anchoring yet, and a
plain UUID primary key can become a `resource_id` later without
disturbing anything that already references it. Matches the "scale-ready,
not scale-heavy" posture; not a reflexive rubber stamp of the locked
answer (§12 restates this decision with its full reasoning next to the
other four tables').

## 6. Invoice Evidence Item model

**Exactly the locked shape.** Columns: `id`, `invoice_evidence_id` (FK,
never changes), `billing_calculation_id` (nullable FK), `reconciliation_adjustment_id` (nullable
FK to `reconciliation_adjustments.resource_id`), a shape `CHECK`
requiring exactly one of the two populated, `allocated_amount numeric not
null check (allocated_amount >= 0)` (this item's own share of the header
amount, a magnitude; the header's `evidence_kind` carries the sign/
direction, the same "no signed-amount column, sign carried by an enum"
posture used throughout this design), standard columns. Immutable,
insert-only.

**M:N, explicitly locked and unchanged.** One Billing Calculation may be
represented across many invoices over time (partial billing, §17
scenario 8), and one invoice may represent many Billing Calculations and
Reconciliation Adjustments together (§17 scenario 10). No uniqueness
constraint exists on `billing_calculation_id` or
`reconciliation_adjustment_id`, exactly as already locked, and this
document adds nothing further: an over-invoiced or under-invoiced sum
relative to a Billing Calculation's own `calculated_amount` is not
rejected by the database (§11 addresses where that control belongs).

`billing_calculation_id` references one specific, permanent
`billing_calculations` row (§3): since that row is never replaced or
superseded, an existing item's meaning is never moved or reinterpreted by
a later correction, which is always a separate `reconciliation_adjustments`
row (§7), never a change to the Billing Calculation the item already
points at.

## 7. Reconciliation Adjustment model

**The explicit correction layer between historical Earned, Billing, and
Invoice truth.** Every one of the four domains locked by this design
(Earned, Billing Calculation, Invoice Evidence, Reconciliation Adjustment,
§1) is permanent once created; none of the first three carries its own
correction chain. `reconciliation_adjustments` is where every financial
difference between them is recorded, structurally, not as a generic
accounting journal: it must support, at minimum, an Earned Result that
changed after a Billing Calculation was already made (§17 scenario 11), a
Billing Calculation that was itself wrong (§17 scenario 12), a partial-
invoicing difference Finance decides needs its own adjustment, additional
billing owed, a credit-note-direction correction, a rounding difference,
and a Finance-authorized adjustment with no single triggering row at all.
It is deliberately not a place to record arbitrary signed journal
entries: every row still has the same fixed shape (one Component, one
window, one `direction`, one `amount`, §16), never a free-form ledger
line.

**What it adjusts, resolved from the already-locked shape, not
reopened.** `reconciliation_adjustments.commercial_component_id` is a
singular FK (already locked); the grain is the Commercial Component. The
locked relationship-map language, "references both Earned and Billed, per
component and window," is honored by adding `window_start`/`window_end`
(not null) alongside the already-locked `commercial_component_id`, so a
reconciliation candidate is always scoped to one Component and one
window, matching that exact locked phrase. Named `window_*`, not
`period_*`, deliberately: a reconciliation window is a distinct concept
from a `billing_calculations.billing_period_*` or an `earned_results`
earning period, and may span several of either (§0b). No polymorphic
target is introduced.

**Provenance, an aggregate comparison result, not a singular triggering-
row FK (§0b).** An earlier draft added `source_earned_result_id` and
`source_billing_calculation_id`, both nullable FKs, to record the one
row that triggered a given adjustment. That does not hold up against the
locked "per component and window" grain once billing and reconciliation
cadences are allowed to differ, which they already are (quarterly
billing, annual reconciliation is an ordinary configuration, not an edge
case): one annual reconciliation window can legitimately compare against
four separate quarterly `billing_calculations` rows and several
`earned_results` rows, so a single `source_billing_calculation_id` would
name only one of the four and misrepresent itself as the whole result's
provenance. This revision removes both columns. In their place,
`reconciliation_adjustments` carries the comparison itself:
`earned_amount numeric` and `billed_amount numeric`, both nullable,
populated together whenever the adjustment genuinely compares one earned
figure against one billed figure for the Component/window (the common
case, §17 scenarios 11-12); left null together for adjustments that have
no such two-sided shape (a rounding correction, a manual Finance
adjustment with no changed source row, §17 scenario 15), matching the
identical "nullable together, populated when applicable" convention
already used for `basis_quantity` on `billing_calculations` (§3). No
database `CHECK` ties `monetary_difference` arithmetically to
`earned_amount`/`billed_amount` when both are present: rounding and
policy nuance can make an exact equality too rigid to enforce safely,
the same reasoning already applied to `invoice_evidence_items.
allocated_amount` against its header total. If a specific Billing
Calculation or Earned Result row is worth naming as the reason for an
adjustment, that fact belongs in the free-text `reason` (already
not-null on this table), not a structural FK; per §17 scenario 12, a
Billing Calculation error is recorded as `reason = 'billing calculation
error'`, with no `source_billing_calculation_id` column to populate. No
source join table is added either: nothing in this migration's actual
required capability demands exact many-row lineage from a reconciliation
candidate back to every Billing Calculation or Earned Result it
compared against; if that genuinely becomes a Finance requirement later,
it is an additive join table, not a reason to reopen this grain now.

**Amount and direction, unchanged in posture, renamed for clarity
(§0b).** `amount` is renamed `monetary_difference` to name what it
actually is now that `earned_amount`/`billed_amount` sit beside it: the
delta between the two, or the directly-stated correction size when no
two-sided comparison applies. `monetary_difference numeric not null
check (monetary_difference > 0)` (a magnitude, never signed) and the
already-locked `direction` (`additional_billing`/`credit_note`) together
express the same information a signed number would, matching the
identical "sign carried by an enum, not by the numeric value" convention
already used for `invoice_evidence`/`invoice_evidence_items`.
`transaction_currency text not null`, captured fresh, matching every
other financial table in this schema.

**Quantity and rate provenance, restored against locked domain
architecture (§0c).** `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §10 part
A requires that Reconciliation "preserves an operational quantity or
billing-basis difference wherever a quantity comparison is meaningful,"
separately preserves the monetary difference, and preserves "sufficient
effective-rate and commercial-period provenance... to explain the
monetary amount," explicitly without ever fabricating a quantity when
one would be meaningless. Two columns satisfy this exactly:
`quantity_explanation jsonb`, nullable, populated only when a
quantity/billing-basis comparison is genuinely meaningful for this
adjustment, matching the locked "without a forced quantity explanation"
language precisely; and `rate_provenance jsonb not null`, always
populated, since the locked text frames effective-rate/commercial-period
provenance as unconditionally preserved regardless of whether a
quantity explanation applies. Neither column is a structural FK back to
a specific Earned Result or Billing Calculation row (§0b still holds):
both are self-describing evidence captured at adjustment-creation time,
the same "captured fresh, not re-derived through a join" posture used
for `transaction_currency` throughout this schema. No JSON Schema
validation framework is introduced for either column's internal shape,
matching the same minimal-structural-check posture already applied to
`commercial_components.pricing_rule_parameters` (§16 lists the column,
not a key-level contract).

**No netting, unchanged and re-affirmed.** Multiple adjustment candidates
may legitimately coexist for the same Component and window; nothing sums
or merges them, by construction, exactly as already locked.

**Correction, using the already-locked `supersedes_adjustment_id`, scoped
narrower than `earned_results`' mechanism on purpose.** Because multiple
independent adjustment candidates can legitimately coexist for one
Component/window (no-netting, above), the "exactly one current per
logical grain" three-constraint mechanism used for `earned_results` (and,
unlike an earlier draft of this document, not used for
`billing_calculations`, which has no versioning or "current" concept at
all, §3) does not apply here either: there is no single grain to protect.
This document keeps the correction guarantee narrower and correctly
scoped to the chain itself, not the grain: a self-reference `CHECK`
preventing self-supersession, and a plain unique constraint on
`supersedes_adjustment_id` preventing one adjustment from being corrected
by two different successors (forks prohibited, database-enforced).
Neither the Component, the window, nor `direction` is database-enforced
to match between a correction and what it supersedes. Concerning the
same Component/window/direction is the expected, ordinary case, but not
one this design forces structurally: unlike a Billing Calculation grain
correction (routed entirely outside the chain, through a new adjustment
row, §3) or an Earned Result correction (a true recalculation of the
same economic fact), a Reconciliation Adjustment correction may itself
need to fix a wrong Component, window, or direction assigned to the
original candidate, exactly the kind of error a rigid composite-FK
would then block from ever being correctable. Multiple unrelated
adjustment candidates coexisting in the same Component/window remain
possible regardless of any correction chain, unchanged from the
no-netting posture above: no unconditional `UNIQUE
(commercial_component_id, window_start, window_end)` exists or is added
for this table, since more than one adjustment can legitimately be open
for the same Component and window at once.

**Finalization, independent from supersession, exactly mirroring §9's
resolution for Earned Results.** The already-locked `status`
(`open -> final`, once) answers "is this specific adjustment settled,"
never "is this still the current explanation." A finalized adjustment
may still be superseded by a later correction; nothing here or elsewhere
blocks that.

**"Resolved," derived, not stored.** Matching the same "prefer one
source of truth, avoid duplicated lifecycle state" discipline used for
eligibility (§4): a reconciliation adjustment is "outstanding" when no
`invoice_evidence_items` row yet references it, and "resolved" once at
least one does. No separate status value or column represents this; it
is always a derived read against `invoice_evidence_items`.

**Resource Registry, unchanged from the locked decision.** Yes: the one
Commercial output genuinely needing its own approval workflow, tasks,
attachments, and comments, the same reasoning already applied to
Request. New `resource_types` row `('reconciliation_adjustment', ...)`.

**Atomic creation contract, fully specified here, not deferred to SQL
authoring.** `create_reconciliation_adjustment()` follows the identical
Resource-plus-row creation pattern already proven for
`commercial_configurations` (M8), not a new mechanism:

- The `resources` row and the `reconciliation_adjustments` row are
  created in the same statement-level transaction, inside one
  `SECURITY INVOKER` function; any failure after the `resources` insert
  (a `CHECK` violation, a bad FK) rolls back both, leaving neither half
  created, the same guarantee M8 already relies on.
- `resources.resource_type = 'reconciliation_adjustment'`, matching the
  `resource_types` seed row above.
- `resource_id` is caller-supplied (no default), exactly mirroring
  `commercial_configurations`' own Resource-backed creation, not
  `earned_results`'/`billing_calculations`' caller-supplied `id` (those
  are retry identity on an ordinary PK, a different reason, §3, §10):
  here, the RPC must know the id before it exists to insert both the
  `resources` row and the `reconciliation_adjustments` row referencing
  it inside one transaction.
- Actor and provenance: a single `p_actor_user_id` parameter populates
  both `resources.created_by` and
  `reconciliation_adjustments.created_by`, the same "one actor, written
  once, referenced consistently" pattern already used for
  `create_commercial_configuration_with_change`.
- The RPC is the sole sanctioned creation path, matching every other
  M8/M9/M10 table's posture (§14): `EXECUTE` is revoked from
  `public`/`anon`/`authenticated`, granted only to `service_role`. A raw
  `INSERT` remains technically reachable by `service_role` at the SQL
  level (RLS does not restrict `service_role`), the same as everywhere
  else in this schema, but the atomic-pair guarantee above is the reason
  application code is expected to use the RPC exclusively, never a
  direct insert into either table.
- Resource-type integrity is enforced by the same existing mechanism
  already used for every other Resource-backed table, not a new one:
  the shared assertion that `resources.resource_type` for a given
  `resource_id` matches the owning domain table, checked on insert.

No workflow beyond the already-locked `open -> final` lifecycle (§7
above) is introduced by this contract; it answers only how the row
comes to exist, not what happens to it afterward.

## 8. Earned vs. Billable vs. Invoiced vs. Reconciled semantics

Four distinct amounts, never collapsed, each answerable by reading a
different table, none of them ever rewritten to agree with another:

- **Earned amount**: `earned_results.calculated_amount` for the current
  (non-superseded) version of a Component/period, or a specific historical
  version by id. Owned entirely by M9.
- **Billable amount**: `billing_calculations.calculated_amount` for the
  one, permanent row that exists for a Component/billing period, if any.
  A Billing Calculation may exist, computed, with a real
  `calculated_amount`, **before** it is eligible to invoice; "billable"
  describes what the
  billing logic says should eventually be invoiced, not a decision to
  invoice it now (§17 scenario 6: Earned 100, no eligible
  `invoice_eligibility_events` row yet, so nothing is actually invoiced
  today even though a Billing Calculation already states 100).
- **Invoiced amount**: `sum(invoice_evidence_items.allocated_amount)` for
  a given Billing Calculation, read across however many
  `invoice_evidence` headers actually reference it over time. Never
  database-enforced to equal `calculated_amount`; a real invoice's total
  may legitimately differ (partial billing, rounding, an external
  system's own adjustment).
- **Reconciled difference**: the gap between what is Earned/Billable and
  what is actually Invoiced, explained by zero or more
  `reconciliation_adjustments` rows scoped to the same Component and
  window. Detecting that a gap exists (comparing the current Earned
  Result version, or the one permanent Billing Calculation, against
  accumulated invoice evidence) is a
  Billing Kernel / application-layer responsibility, not a database
  trigger: no M10 trigger fires automatically when an M9 `earned_results`
  row is superseded, both because M10 must never reach back and touch M9,
  and because creating a cross-migration trigger dependency between two
  independently closed migrations is exactly the kind of coupling this
  design avoids. The application layer detects the divergence and records
  the adjustment through `create_reconciliation_adjustment` (the RPC name
  already anticipated in `COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` §19).

## 9. Correction/supersession model

Four distinct domains, each corrected its own way, never conflated:

| Domain | Correction path |
|---|---|
| **Earned correction** | A new `earned_results` version in M9 (`result_version`, `supersedes_earned_result_id`). M10 never participates in this and never reads it as anything other than an ordinary, permanent FK target. |
| **Billing Calculation correction** | The original `billing_calculations` row is never touched, replaced, or superseded (§3). A `reconciliation_adjustments` row records the delta. |
| **Invoice Evidence correction** | The original `invoice_evidence` row remains permanent. A new `invoice_evidence` row (typically a `credit_note`, then a corrected `invoice`) records the correcting external document (§5). |
| **Reconciliation Adjustment correction** | A new `reconciliation_adjustments` row may supersede an earlier one using the already-locked `supersedes_adjustment_id` chain (§7), scoped to that one chain, not to a shared per-grain "current" guarantee. |

Full per-table posture:

| Table | Model |
|---|---|
| `billing_calculations` | Immutable, insert-only, permanent (§3). No version column, no supersession column, no correction chain of any kind. A wrong calculation is corrected exclusively through a `reconciliation_adjustments` row. |
| `invoice_eligibility_events` | Immutable, insert-only, no correction concept at all: a later decision is simply a later event; "current" is always the latest, so nothing needs correcting in place. |
| `invoice_evidence` | Immutable, insert-only; a correction is a new row (§5), never a supersession chain. |
| `invoice_evidence_items` | Immutable, insert-only; an allocation, once recorded, is permanent evidence of what was represented at that time. |
| `reconciliation_adjustments` | Immutable except the single open/final transition; corrected via the already-locked `supersedes_adjustment_id`, scoped to the chain, not a per-grain uniqueness guarantee (§7). |

**The forward pointer M9 left open is resolved here**: whether a new
Billing Calculation reads only the current Earned Result version, or a
specific historical one, is a Billing Kernel decision, not a database
constraint. `source_earned_result_id` is an ordinary FK, satisfied by any
existing `earned_results` row, current or superseded, exactly mirroring
the identical, already-locked posture for
`earned_result_usage_facts.usage_fact_id` in M9 ("the database permits,
the domain service selects"). What happens financially when a version a
Billing Calculation already used is later superseded is answered in
full by §17 scenario 11 and §8's reconciliation mechanism: the original
Billing Calculation is never rewritten or replaced; a new reconciliation
candidate records the difference.

## 10. Idempotency model

Reuses exactly three already-proven Nexus patterns, no new mechanism
invented:

- **Caller-supplied identity for retry safety, not for version identity**
  (`billing_calculations`, §3): the same `id` retried with identical
  substantive inputs returns the existing row (a genuine technical
  retry); the same `id` retried with a mismatched payload raises a named
  conflict (a caller defect). A genuinely new attempt uses a different
  `id`, and is still bound by the ordinary one-row-per-grain constraint:
  it either succeeds as the grain's one and only row, or is rejected,
  named, as a duplicate attempt (§3). Nothing about `id` reuse
  represents, or is permitted to represent, a business correction; that
  is `reconciliation_adjustments`' role alone (§7, §9).
- **Source-system-namespaced natural key** (`invoice_evidence`, mirroring
  `usage_facts`): `(source_system, evidence_kind, external_reference)`
  deduplicates externally-sourced evidence; manual entry is never
  deduplicated.
- **Plain insert, no dedup key** (`invoice_eligibility_events`,
  `invoice_evidence_items`, `reconciliation_adjustments`' own creation):
  each row is a genuine, discrete new fact (a decision, an allocation, an
  adjustment candidate), not a redelivery-prone external event.

`create_reconciliation_adjustment`, per the already-locked M8 forward
reference, follows the same atomic Resource-plus-row creation pattern
already proven for `commercial_configurations`, since it is the one
M10 table that mints a `resources` row.

## 11. Currency model

No FX conversion anywhere in this design, matching the already-locked,
explicit exclusion ("Deliberately not added: ...an FX projection table").
`invoice_evidence.currency`, `billing_calculations.transaction_currency`,
and `reconciliation_adjustments.transaction_currency` are each captured
directly, never derived through a join, mirroring the identical
"captured fresh" posture already used for `earned_results` and
`commercial_components`. If a real invoice's currency ever genuinely
differs from the Billing Calculation's own currency, that is itself a
reconciliation-worthy difference (§7), not a conversion this schema
performs. Cross-currency FX reconciliation, if ever required, is a
distinct future concern, out of scope here exactly as already locked.

## 12. Resource Registry decisions

| Table | Resource-backed | Reasoning |
|---|---|---|
| `billing_calculations` | No | Computed fact, not independently actioned. |
| `invoice_eligibility_events` | No | Append-only decision log, not independently actioned. |
| `invoice_evidence` | No | Reconsidered explicitly (§5); plausible future candidate, not required for this migration's actual capability; upgrading a plain uuid to a resource id later does not disturb anything that already references it. |
| `invoice_evidence_items` | No | Pure allocation row, no independent addressing need. |
| `reconciliation_adjustments` | Yes | Genuinely independently actioned: approval workflow, tasks, attachments, comments, the same test already applied to Request and Commercial Configuration. |

Decided individually against the same "does this need independently
actioned identity beyond its parent" test used throughout M8/M9, not by
which table name sounds most important.

## 13. Audit posture

| Table | Audit | Reasoning |
|---|---|---|
| `billing_calculations` | `fn_audit_row('id')` | Generic, reused; captures every new row's own insert. |
| `invoice_eligibility_events` | None | Already an append-only decision log; auditing an audit-shaped table duplicates evidence for no benefit, matching the already-locked reasoning. |
| `invoice_evidence` | `fn_audit_row('id')` | Generic, reused; financially material external-document evidence. |
| `invoice_evidence_items` | `fn_audit_row('id')` | Generic, reused; an allocation is itself financially material. |
| `reconciliation_adjustments` | `fn_audit_row('resource_id')` | Generic, reused; captures the one finalize transition and every new correction's own insert. |

## 14. Security posture

Follows the established Nexus posture unmodified, at design level, for
all five tables: `ENABLE ROW LEVEL SECURITY`, not `FORCE`, zero policies;
`anon`/`authenticated` denied direct access; `service_role` as the sole
data-access path through explicit `SECURITY INVOKER` RPCs with `EXECUTE`
revoked from `public`/`anon`/`authenticated` and granted only to
`service_role`; the shared `fn_reject_truncate()` guard and
`TRUNCATE` revoked from `service_role` on all five; immutable history
protected by dedicated immutability/scope triggers and the shared
`fn_reject_update_delete()`, never by privilege alone. Not reopening any
prior hardening; nothing here narrows or widens what M4-M9 already
established.

**One concurrency lesson carried forward deliberately.** M9's own review
found that locking a "current row" directly, rather than a stable parent
identifier first, does not actually serialize concurrent attempts the
way it appears to. `record_billing_calculation`'s design (§3, §10) locks
the stable `commercial_components` row first, then performs the grain
existence probe as a separate, fresh statement, exactly the corrected
pattern M9 had to repair after shipping the other one, applied here from
the start. This concurrency discipline is unrelated to, and does not
reintroduce, versioning: the probe exists only to make the one-row-per-
grain constraint's duplicate-attempt error a named, graceful one instead
of a raw constraint violation (§3); the constraint itself, not the probe,
is what actually prevents a second row.

## 15. Constraint strategy

**`billing_calculations`**: PK `id` (caller-supplied, no default, retry
identity only, §3); FKs `commercial_component_id`,
`source_earned_result_id` (nullable), `source_commercial_commitment_id`
(nullable); `CHECK (billing_period_end >= billing_period_start)`; `CHECK
(billing_quantity_basis_used IN ('mug','previous_period_actual',
'period_actual','fixed'))`; shape `CHECK` tying `source_earned_result_id`/
`source_commercial_commitment_id`/`basis_quantity` to
`billing_quantity_basis_used` exactly as §3 describes; `CHECK
(calculated_amount >= 0)`; a single plain, unconditional `UNIQUE
(commercial_component_id, billing_period_start, billing_period_end)`
enforcing exactly one calculation per grain (§3). No self-FK, no
composite-grain-matching FK, no partial index, no chain: this is not a
versioning mechanism.

**`invoice_eligibility_events`**: PK `id`; FK `billing_calculation_id`;
FK `decided_by` (nullable); no further CHECKs beyond `eligible`'s boolean
type and `reason` being `not null`.

**`invoice_evidence`**: PK `id`; `CHECK (evidence_kind IN
('invoice','credit_note'))`; `CHECK (amount >= 0)`; partial unique index
on `(source_system, evidence_kind, external_reference) WHERE
source_system IS NOT NULL AND external_reference IS NOT NULL`.

**`invoice_evidence_items`**: PK `id`; FK `invoice_evidence_id`; FKs
`billing_calculation_id`/`reconciliation_adjustment_id` (both nullable);
shape `CHECK` requiring exactly one of the two; `CHECK (allocated_amount
>= 0)`; deliberately no uniqueness on either target FK.

**`reconciliation_adjustments`**: PK `resource_id`; FK
`commercial_component_id`; FK `supersedes_adjustment_id` (nullable,
self-referencing, no composite-grain match, §7); `CHECK
(supersedes_adjustment_id IS DISTINCT FROM resource_id)`; plain unique on
`supersedes_adjustment_id` (no-fork); `CHECK (direction IN
('additional_billing','credit_note'))`; `CHECK (status IN
('open','final'))`; `CHECK (monetary_difference > 0)`; `CHECK
(window_end >= window_start)`; shape `CHECK` tying
`finalized_at`/`finalized_by` to `status`, matching `earned_results`'
identical shape check. No FK columns for source provenance (§0b, §7):
`earned_amount`/`billed_amount` are plain nullable `numeric`, not FKs.
`quantity_explanation jsonb` (nullable) and `rate_provenance jsonb not
null` (§0c, §7): neither is a structural FK either, both are
self-describing evidence captured at creation time. Deliberately no
unconditional `UNIQUE (commercial_component_id, window_start,
window_end)`: multiple adjustment candidates coexist by design (§7).

Every foreign key in this migration is `ON DELETE RESTRICT`, matching
every table in M4-M9; no `CASCADE` anywhere.

## 16. Design-level proposed columns for all five tables

**`billing_calculations`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, caller-supplied, no default, retry identity only |
| `commercial_component_id` | `uuid not null` | FK, part of unique grain |
| `billing_period_start` | `date not null` | part of unique grain |
| `billing_period_end` | `date not null` | part of unique grain |
| `billing_quantity_basis_used` | `text not null` | `mug`/`previous_period_actual`/`period_actual`/`fixed` |
| `basis_quantity` | `numeric` | nullable, null iff `fixed` |
| `source_earned_result_id` | `uuid` | nullable FK |
| `source_commercial_commitment_id` | `uuid` | nullable FK |
| `pricing_calculation_version` | `text not null` | Kernel build id |
| `rounding_policy_version` | `text not null` | Kernel build id |
| `calculated_amount` | `numeric not null` | `>= 0` |
| `transaction_currency` | `text not null` | captured fresh |
| `created_at` / `created_by` | | standard, no update path exists |

**`invoice_eligibility_events`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `billing_calculation_id` | `uuid not null` | FK |
| `eligible` | `boolean not null` | |
| `reason` | `text not null` | free text |
| `decided_by` | `uuid` | nullable FK |
| `created_at` / `created_by` | | standard, intrinsic provenance only |

**`invoice_evidence`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `evidence_kind` | `text not null` | `invoice`/`credit_note` |
| `external_reference` | `text` | nullable |
| `external_date` | `date` | nullable |
| `amount` | `numeric not null` | `>= 0` |
| `currency` | `text not null` | |
| `source_system` | `text` | nullable |
| `created_at` / `created_by` | | standard, no update path exists |

**`invoice_evidence_items`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `invoice_evidence_id` | `uuid not null` | FK |
| `billing_calculation_id` | `uuid` | nullable FK, conditional |
| `reconciliation_adjustment_id` | `uuid` | nullable FK, conditional |
| `allocated_amount` | `numeric not null` | `>= 0` |
| `created_at` / `created_by` | | standard, intrinsic provenance only |

**`reconciliation_adjustments`**

| Column | Type | Notes |
|---|---|---|
| `resource_id` | `uuid` | PK, Resource-backed, caller-supplied |
| `commercial_component_id` | `uuid not null` | FK |
| `window_start` | `date not null` | reconciliation window, distinct from a billing/earning period |
| `window_end` | `date not null` | |
| `earned_amount` | `numeric` | nullable, populated together with `billed_amount` when applicable |
| `billed_amount` | `numeric` | nullable, populated together with `earned_amount` when applicable |
| `direction` | `text not null` | `additional_billing`/`credit_note` |
| `monetary_difference` | `numeric not null` | `> 0`, magnitude only |
| `transaction_currency` | `text not null` | captured fresh |
| `reason` | `text not null` | free text, may name a specific triggering row descriptively |
| `quantity_explanation` | `jsonb` | nullable, populated only when a quantity/billing-basis comparison is meaningful (§0c) |
| `rate_provenance` | `jsonb not null` | effective-rate/commercial-period provenance explaining the monetary amount (§0c) |
| `supersedes_adjustment_id` | `uuid` | nullable, self-FK, no composite-grain match |
| `status` | `text not null default 'open'` | `open`/`final` |
| `finalized_at` | `timestamptz` | nullable, conditional |
| `finalized_by` | `uuid` | nullable, conditional FK |
| `created_at` / `created_by` / `updated_at` / `updated_by` | | standard, needed for finalize |

## 17. Scenario proofs

For each, the records created and the records left untouched:

1. **Monthly arrears usage billing**: Usage Facts and Earned Result exist
   (M9, untouched). New `billing_calculations` row, `basis_used =
   'period_actual'`, `source_earned_result_id` = that period's Earned
   Result. Nothing in M9 is touched.
2. **Quarterly advance fixed recurring billing**: Earned Result exists
   for the fixed component (M9, no Usage Facts involved). New
   `billing_calculations` row, `basis_used = 'fixed'`, no source
   pointers, `billing_period` = the quarter being billed in advance.
3. **Annual advance fixed recurring billing**: identical shape to
   scenario 2, annual cadence.
4. **One-time charge**: identical shape to scenario 2, one nominal
   period (`billing_period_start = billing_period_end`).
5. **Milestone charge**: identical shape to scenario 2; milestone
   acceptance is recorded as an `invoice_eligibility_events` row
   (`eligible = true`, `reason = 'milestone accepted'`), not a new
   basis value or a new table.
6. **Usage earned but not yet billing-eligible**: Earned Result exists.
   A `billing_calculations` row may or may not yet exist. Either way, no
   `invoice_eligibility_events` row says `eligible = true` yet, so
   nothing is invoiced today even if `calculated_amount` already states
   100 (§8).
7. **Usage earned and then billed**: scenario 6 continued through an
   `eligible = true` event, an `invoice_evidence` row, and an
   `invoice_evidence_items` row. Nothing prior is touched.
8. **Partial invoice against one Billing Calculation**: one
   `billing_calculations` row (100). First `invoice_evidence` +
   `invoice_evidence_items` (60). Later, second `invoice_evidence` +
   `invoice_evidence_items` (40), same `billing_calculation_id`. Neither
   invoice nor the Billing Calculation is edited.
9. **Multiple invoices against one Billing Calculation**: the general
   case of scenario 8, any number of times, over any span of time.
10. **One invoice containing multiple Billing Calculations**: one
    `invoice_evidence` header, multiple `invoice_evidence_items` rows,
    each with a different `billing_calculation_id`.
11. **Earned v1 billed, then Earned v2 supersedes it**: `billing_calculations`
    row B1 (the one, permanent calculation for this Component/period)
    references `earned_results` v1 (immutable, permanent). Later,
    `earned_results` v2 supersedes v1 in M9 (untouched by M10). B1 is
    never edited, never replaced, and still says v1. The original
    `invoice_evidence`/`invoice_evidence_items` remain intact. A new
    `reconciliation_adjustments` row (`window_start`/`window_end` =
    this Component's earning period, `earned_amount` = v2's amount,
    `billed_amount` = B1's `calculated_amount`, `direction =
    'additional_billing'`, `monetary_difference = 20`, `reason = 'earned
    result superseded after billing, v2 supersedes v1'`) records the
    difference. Nothing is rewritten anywhere.
12. **Billing Calculation corrected after creation**: B1 = 90, already
    invoiced. The error is discovered; B1 remains permanently 90 and is
    never edited, replaced, or superseded, and the original
    `invoice_evidence_items` row keeps referencing it unchanged. A new
    `reconciliation_adjustments` row (`window_start`/`window_end` =
    B1's own billing period, `billed_amount = 90`, `earned_amount =
    100`, `direction = 'additional_billing'`, `monetary_difference =
    10`, `reason = 'billing calculation error, B1 undercalculated'`)
    records the correction; `reason` names B1 descriptively, no
    structural FK to it exists (§0b, §7). If additional billing is
    required, a later `invoice_evidence_items` row allocates against
    this Reconciliation Adjustment, not against B1.
13. **Invoice evidence corrected/replaced**: the original
    `invoice_evidence` row is never edited. A new `invoice_evidence` row
    (typically `evidence_kind = 'credit_note'` offsetting the wrong one,
    then a corrected `invoice`) is recorded, with its own
    `invoice_evidence_items` allocation.
14. **Credit-like adjustment**: new `reconciliation_adjustments` row
    (`direction = 'credit_note'`), optionally later linked to a new
    `invoice_evidence` (`evidence_kind = 'credit_note'`) via
    `invoice_evidence_items.reconciliation_adjustment_id`.
15. **Rounding difference**: new `reconciliation_adjustments` row,
    `reason = 'rounding difference'`, small `monetary_difference`,
    `direction` depending on which way the rounding went,
    `earned_amount`/`billed_amount` both left null: no two-sided
    comparison exists for a pure rounding correction, only the delta
    and the free-text reason.
16. **Idempotent repeated invoice import**: `record_invoice_evidence`
    called twice with the same `(source_system, evidence_kind,
    external_reference)` and identical payload returns the existing row;
    no second row.
17. **Same external invoice identity reused with conflicting payload**:
    second call with a differing `amount`/`external_date` raises a named
    conflict; no row is overwritten.
18. **Billing calculation replay after timeout**: `record_billing_calculation`
    called twice with the same caller-supplied `id` and identical inputs
    returns the existing row; no second row, no duplicate audit event.
    This is retry idempotency, not a business correction; a second,
    genuinely different attempt (a different `id`) for the same grain is
    rejected under the one-row-per-grain constraint (§3), not accepted as
    a new version.
19. **Invoice recorded before all expected billing evidence is
    available**: `invoice_evidence` (header) can be recorded on its own
    the moment the external document exists; `invoice_evidence_items`
    (allocation) is added once the corresponding `billing_calculations`
    row exists, with no ordering requirement enforced beyond the target
    row existing at the moment the item itself is inserted.
20. **Reconciliation outstanding vs. resolved**: "outstanding" is a
    `reconciliation_adjustments` row with no `invoice_evidence_items` row
    yet referencing it; "resolved" is the same row once at least one
    does. Both are derived reads, never a stored status value (§7).

## 18. Open business decisions

**Resolved architecturally in this pass, none required a Finance
decision to draft safely:**

- Billing Calculation grain (singular Earned Result/Commitment source,
  no aggregation): already locked, confirmed unchanged.
- Exactly one Billing Calculation per `(commercial_component_id,
  billing_period_start, billing_period_end)` is database-enforced (a
  plain unique constraint), not merely RPC-enforced: the locked design
  never stated this constraint explicitly, but with correction routed
  exclusively through `reconciliation_adjustments` (never a superseding
  Billing Calculation, §3), a genuine second row for the same grain can
  only ever be an accidental duplicate, never a legitimate outcome, so
  the database is the correct place to prevent it.
- One Billing Calculation invoiced across multiple invoices, and one
  invoice covering multiple Billing Calculations: already locked,
  confirmed unchanged.
- `evidence_kind` stays a two-value enum; a debit note is represented as
  a supplementary `invoice`.
- "Reconciliation resolved" is derived from `invoice_evidence_items`
  linkage, never a stored status.
- Reconciliation amounts stay unsigned, with `direction` carrying sign,
  matching the already-locked convention.
- A manual Finance adjustment with no changed Earned Result or Billing
  Calculation is directly supported: `earned_amount`/`billed_amount`
  left null together, `monetary_difference` and free-text `reason`
  carry the full record.
- `reconciliation_adjustments.source_earned_result_id`/
  `source_billing_calculation_id`, present in an earlier draft, are
  removed (§0b): a reconciliation window can span more than one Billing
  Calculation and Earned Result, so a singular source FK would name
  only one contributor and misstate itself as the whole result's
  provenance. `earned_amount`/`billed_amount`/`monetary_difference`
  carry the comparison instead; a specific triggering row, when one
  exists, is named descriptively in `reason`.
- A Reconciliation Adjustment correction is not database-enforced to
  keep the same Component, window, or `direction` as what it supersedes
  (§7): the correction may itself be fixing a wrong Component, window,
  or direction assignment on the original candidate, which a rigid
  composite-FK match would block.
- `quantity_explanation`/`rate_provenance` are added to
  `reconciliation_adjustments` (§0c): a genuine gap against
  `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §10 part A, found by
  source-trace, not the literal field names an earlier review pass
  claimed were already locked (those names never appear anywhere in
  this repository's history). `rate_provenance` is not null
  (unconditionally preserved, per the locked text); `quantity_explanation`
  is nullable (populated only when meaningful, per the locked
  "without a forced quantity explanation" language).
- Invoice-identity uniqueness is scoped per `source_system` (§5), not
  globally or per legal entity; Nexus has no "legal entity" concept
  anywhere in the schema today, and introducing one is out of scope for
  this migration.

**Deliberately deferred, non-blocking:**

- Whether a reconciliation adjustment should ever be allowed to span
  more than one Commercial Component in a single row remains an open
  domain-document `[PROVISIONAL]` marker. The locked schema shape
  (`commercial_component_id` singular) already resolves the structural
  question; a future cross-component scenario, if Finance ever needs one,
  is representable today as multiple single-component adjustment rows.
  Not a blocker.
- Exact eligibility `reason` vocabulary (period completed, milestone
  accepted, PO received, and so on) is intentionally left as free text,
  not a closed enum, matching the locked domain document's own
  "illustrative reasons only" posture.

## 19. Proposed migration/runtime-test sequence

**Migration 10 internal creation order** (dependency-safe, mirroring the
per-table convention already used in Migrations 8 and 9):

1. `resource_types` seed row (`'reconciliation_adjustment'`).
2. `fn_protect_billing_calculation_scope()` (new function; `billing_calculations`
   otherwise needs only the existing, reused `fn_reject_update_delete()`,
   no versioning function of any kind).
3. `billing_calculations` (depends on `commercial_components`,
   `earned_results`, `commercial_commitments`, all existing); the plain
   unique grain constraint (§3, §15) is declared inline, no composite
   self-FK or partial index.
4. `invoice_eligibility_events` (depends on `billing_calculations`).
5. `invoice_evidence` (no new dependency).
6. `invoice_evidence_items` (depends on `invoice_evidence`,
   `billing_calculations`; `reconciliation_adjustments` created next).
7. `create_reconciliation_adjustment()` (must exist before
   `reconciliation_adjustments` accepts writes, matching the M8 atomic-
   creation-RPC ordering convention).
8. `reconciliation_adjustments` (depends on `commercial_components`;
   plain self-FK, no-fork unique on `supersedes_adjustment_id`, `CHECK`s
   attached; no composite-grain-matching FK, per §7).
9. `finalize_reconciliation_adjustment()`,
   `record_billing_calculation()`, `record_invoice_eligibility_event()`,
   `record_invoice_evidence()`, `record_invoice_evidence_item()`
   (remaining RPCs).
10. Privilege hardening, TRUNCATE guards, RLS enablement across all five
    tables and every new function, matching every prior migration's own
    closing section.

**Proposed runtime-test scenario coverage**, mirroring the M9 harness
convention (one official test id per scenario, rollback-bound main
harness, a separate isolated concurrency phase for
`record_billing_calculation`'s stable-parent-lock mechanism, a
preservation pass confirming M8/M9/B1/B2 posture remains intact): at
minimum, one test per §17 scenario (20), plus immutability rejection
tests for all five tables, plus a grain-duplicate rejection test for
`billing_calculations` (a second row for the same
`commercial_component_id`/`billing_period_start`/`billing_period_end`
under a different `id` is rejected by the plain unique constraint, §3,
distinct in kind from M9's own no-fork/root-uniqueness tests, since there
is no chain here to test), plus Resource Registry and privilege posture
preservation checks. Not authored in this document; this is design only.

## 20. P0/P1/P2 assessment

**P0 = 0.** No schema-blocking Finance question remains: every question
named in the design brief resolves either from already-locked text or
from a safe, explicitly-stated architectural default consistent with
established M8/M9 precedent.

**P1 = 0.** Three genuine architecture-correction findings across this
document's revisions, all resolved, none remaining open:

- An earlier draft mirrored M9's Earned Result versioning onto
  `billing_calculations`, contradicting the locked distinction between
  Earned economic truth, which may need historical recalculation, and a
  Billing Calculation, which is a permanent record of a historical
  decision made with the information available at the time. Corrected:
  `billing_calculations` is immutable, insert-only, with no version or
  supersession concept, and every billing correction is represented
  exclusively through `reconciliation_adjustments` (§0a, §3, §9).
- A later draft added `source_earned_result_id`/
  `source_billing_calculation_id` singular FKs to
  `reconciliation_adjustments`, which would misstate provenance whenever
  a reconciliation window spans more than one Billing Calculation or
  Earned Result, an ordinary outcome once billing and reconciliation
  cadence are allowed to differ. Corrected: both columns removed;
  `earned_amount`/`billed_amount`/`monetary_difference` carry the
  comparison instead, with `reason` available for descriptive,
  non-structural provenance (§0b, §7, §9, §15, §16, §17, §18).
- A source-trace against `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §10
  part A found `reconciliation_adjustments` was missing the quantity/
  billing-basis difference and effective-rate/commercial-period
  provenance that locked passage requires to explain the monetary
  amount; free-text `reason` alone does not satisfy it. Corrected:
  `quantity_explanation` (nullable) and `rate_provenance` (not null)
  added (§0c, §7, §15, §16, §18).

**P2 = 2**, both explicitly named as deferred, non-blocking, in §18:
whether a reconciliation adjustment ever needs to span multiple
Components in one row (currently representable as multiple rows), and
the exact eligibility `reason` vocabulary (intentionally free text, not
a closed enum).
