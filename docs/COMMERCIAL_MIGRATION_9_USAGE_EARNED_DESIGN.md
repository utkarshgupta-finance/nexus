# Nexus: Commercial Migration 9, Usage and Earned Design

**STATUS: LOCKED.**

**DESIGN ONLY. NO MIGRATION SQL. NO IMPLEMENTATION.**

This document is the migration-level design for Migration 9 (Usage and
Earned): `usage_facts`, `earned_results`, `earned_result_usage_facts`. It
translates the already-locked logical design in
`docs/COMMERCIAL_DATABASE_DESIGN.md` (§5.7, §5.8, §5.9, §7, §8, §16-§19)
and the already-locked migration contract in
`docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` (§4 "Migration 9") into a
single, self-contained M9 reference, checked against the M8 schema as
actually applied
(`supabase/migrations/20260908210000_commercial_configuration_foundation.sql`
and the three subsequent M4-M8 hardening migrations).

Nothing in M8 is reopened. Nothing in M10 is designed. Every example is
generic and fictional.

## 0. Revision note: principal architecture review, two issues corrected

A principal architecture review of the first draft found the earlier
"no recalculation mechanism" position for `earned_results`
(§5/§8 of that draft) internally inconsistent with M9's own stated goals
(correction-safe, replayable, source-traceable): Usage Facts could be
corrected, but a corrected fact for an already-earned historical period
had nowhere to go, because the unconditional
`UNIQUE (commercial_component_id, period_start, period_end)` constraint
made a second row for that period structurally impossible. This
revision fixes that by redesigning `earned_results` as **immutable,
versioned results**: the logical grain (Component + period) is unchanged,
but more than one immutable calculation version may exist for it over
time, chained by an explicit, database-enforced supersession mechanism,
never by updating a prior row.

Two changes follow from this, both detailed below:

1. **`earned_results` versioning** (§5, §7, §8, §12, §13): a
   `result_version` counter and a `supersedes_earned_result_id` self-FK,
   constrained so that at most one non-superseded ("current") version
   exists per logical grain at any time, and Earned calculation
   idempotency is now a caller-supplied identity (mirroring the RPC
   idempotency pattern already proven for
   `create_commercial_configuration_with_change`, §7), not a bare
   uniqueness violation treated as normal retry behavior.
2. **`source_system`** added to `usage_facts` (§3, §7, §12, §13), so a
   `source_event_key` is scoped to the namespace of the system that
   produced it; two different upstream systems can no longer collide on
   the same event key.

Everything else, including the Usage Fact correction model's core shape
(immutable absolute replacement, not signed deltas) and the M10 boundary,
is carried forward unchanged; §4 below re-confirms this after the
Earned-side fix, rather than silently assuming it still holds.

## 0a. Revision note: usage supersession scope, earned lineage scope, earned snapshot consistency

A second principal architecture review, focused on the versioned model
accepted in §0, found three remaining structural gaps, none of which
reopens M8 and none of which touches an area already accepted above.

1. **Usage Fact supersession scope** (§3, §4, §13): the only constraint on
   `supersedes_usage_fact_id` was a self-reference check. Nothing
   prevented a successor from belonging to a different Configuration,
   Measurement Definition, or period than its predecessor, which
   contradicts the correction model's own stated shape (a supersession
   chain represents replacement versions of the *same* measured fact). A
   composite self-FK, mirroring `commercial_components.supersedes_component_id`'s
   own proven pattern, now forces a successor to share its predecessor's
   exact `(commercial_configuration_id, measurement_definition_id,
   period_start, period_end)`. Usage supersession is also now no-fork
   (`UNIQUE (supersedes_usage_fact_id)`), giving one linear correction
   chain per measured fact, the identical decision already made for
   `earned_results` versioning. `dimensions` is deliberately left out of
   this identity (§3, §4): a dimension change is modeled as void plus
   independent recapture, not as an in-chain correction, so no composite
   FK or uniqueness mechanism is built around a `jsonb` column.
2. **Earned lineage scope** (§6, §12): `earned_result_usage_facts` had no
   check preventing a link between an Earned Result and a Usage Fact from
   different Commercial Configurations, between a usage-driven Earned
   Result and a Usage Fact of the wrong Measurement Definition, or between
   a non-usage Earned Result and any Usage Fact at all. A new
   `BEFORE INSERT` trigger, `fn_protect_earned_result_usage_fact_scope()`,
   closes all three gaps.
3. **Earned snapshot consistency** (§5, §12): `earned_results.measurement_definition_id`
   and `commercial_commitment_id` are captured for historical
   self-description (§5), but nothing validated, at insert time, that they
   were actually the right snapshot for the referenced Component. A new
   `BEFORE INSERT` trigger, `fn_protect_earned_result_scope()`, closes this
   gap without adding any new constraint to an M8 table (M8 does not
   already carry the compound keys a composite FK would need, and adding
   them would mean reopening M8's own schema, which this document does
   not do).

## 1. Purpose and boundary

M9 answers exactly five questions:

1. What usage actually happened?
2. What commercial rule/component does that usage relate to?
3. What value has been earned because of that usage?
4. What source facts support each earned result?
5. How do corrections/replays happen without destroying history?

M9 does not answer: when to invoice, whether an invoice is eligible, an
invoice number, invoice document/evidence, collection status, or a
reconciliation adjustment against an invoice. Those are Migration 10
(`billing_calculations`, `invoice_eligibility_events`, `invoice_evidence`,
`invoice_evidence_items`, `reconciliation_adjustments`), not designed
here. Earned and Billed remain separate, per the locked domain principle
(`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §12-§13). Historical Earned
recalculation is decided in this document because it determines Earned
truth itself; the financial consequence of a correction against an
already-billed result (whether a re-earned amount requires an invoice
adjustment) remains M10 reconciliation logic, untouched here (§16).

## 2. Existing M8 dependencies

Read read-only from the applied schema; nothing below is mutated by this
design.

- **`commercial_configurations`** (`id` = `resource_id`, Resource-backed,
  `customer_id -> customers(id)`): the scope FK target for `usage_facts`.
  A Usage Fact scopes to the commercial relationship, not the customer
  directly, since one customer may have more than one Configuration
  (locked, §5.7 of the database design).
- **`measurement_definitions`** (`id`, `key` unique, `unit`,
  `business_definition`, `counting_rule`, `period_basis`,
  `dimension_keys text[]`, `status`): the canonical meaning a Usage Fact
  ties to. `unit` is never copied onto `usage_facts`; it is always reached
  by joining `measurement_definition_id`, the same anti-duplication
  discipline already applied when `usage_facts.customer_id` was removed
  in favor of the Configuration join.
- **`commercial_components`** (`id`, `commercial_configuration_id`,
  `measurement_definition_id` nullable, `pricing_rule_kind`,
  `is_recurring`, `transaction_currency`, `effective_from`/`effective_to`,
  `supersedes_component_id`): the earning grain for `earned_results`
  (one logical row per Component per period, now possibly versioned,
  §5). `pricing_rule_kind = 'flat'` combined with `is_recurring` is the
  existing mechanism for fixed and one-time commercial lines; M9 does not
  add a new column for this, it reuses what M8 already carries.
- **`commercial_commitments`** (`kind in ('quantity','spend')`,
  `commercial_component_id` nullable, populated only for `kind =
  'quantity'`): the direct-FK mechanism that already resolves "MUG applies
  to exactly one Component" without any allocation table. `earned_results`
  references this table only for the quantity case.
- **`resources` / `resource_types`**: the Resource Registry spine. None of
  the three M9 tables mint a `resources` row (§11 below).
- **`customers`**: reached transitively via
  `commercial_configurations.customer_id`; never referenced directly from
  any M9 table.
- **`audit_log`**: the generic `fn_audit_row(pk_column [, resource_id_column])`
  trigger pattern is reused unmodified for `usage_facts` and
  `earned_results`; `earned_result_usage_facts` follows the established
  insert-only-join exception (§11 below).
- **`app_users`**: the actor-reference target for every `created_by`/
  `updated_by`/approval column, unchanged.

## 3. Usage Fact model

**Identity.** `id uuid` is its own PK (`default gen_random_uuid()`), plain
`uuid`, not Resource-backed (§11). There is no separate "business id"
beyond `id` itself: the stable business identity of one Usage Fact is the
row, and the stable identity of one corrected *chain* of facts is the
`supersedes_usage_fact_id` chain rooted at the first submission.
Idempotency is a distinct concern from identity and is resolved in §7.

**Source contract, revised.** Fields: `source_type` (`manual_entry`,
`file_import`, `internal_tool`, `external_feed`, matching the
`UsageSource` abstraction already named in
`docs/COMMERCIAL_TECH_EVALUATION.md` §15) describes **how** the fact
entered Nexus. `source_system` (nullable, new this revision) describes
**which** originating system or dataset produced it (fictional examples
only: a named internal billing-adjacent tool, a named upstream CRM
export, a named partner feed; never a real Nexus integration named here).
`source_reference` (nullable free-text external reference within that
system) and `source_event_key` (nullable, §7) describe the specific
event's identity inside that system's namespace. `evidence_reference`
(nullable pointer to supporting evidence) and `origin` (`source`,
`correction`, `finance_override`) are unchanged. Not every source has an
external id: `source_system`, `source_reference`, and `source_event_key`
are all nullable by design, never assumed present.

**Why `source_system` is required.** Two different upstream systems can
independently produce identical event keys (for example, two unrelated
feeds both numbering their own events `1`, `2`, `3`, ...). Scoping
idempotency by `source_event_key` alone, as the first draft proposed,
would silently treat those as the same event. `source_system` is the
namespace `source_event_key` is unique within (§7).

**Naming reconciliation.** `docs/COMMERCIAL_DATABASE_DESIGN.md` §5.7 names
`captured_by`/`captured_at` as fields of this table. This document does
not add two more columns alongside the standard `created_at`/`created_by`:
for a table whose only lifecycle event is its own insert, "captured" and
"created" name the same event. `created_at`/`created_by` (the standard
columns already used everywhere else) fulfill the locked "captured"
concept without inventing a duplicate pair of columns that would always
hold identical values. `updated_at`/`updated_by` are omitted entirely:
`usage_facts` has no update path at all (§4).

**Measurement.** `measurement_definition_id uuid not null references
measurement_definitions(id) on delete restrict`. `quantity numeric not
null` is the measured value; `unit` is never stored on the row, always
derived via the FK (§2). `period_start date not null`, `period_end date
not null` carry the measured period. `dimensions jsonb` (nullable)
carries dimension values; which keys are valid for a given Measurement
Definition is an application-layer check against
`measurement_definitions.dimension_keys`, not a database CHECK (the same
posture already locked for `measurement_definitions` §11).

**Commercial linkage.** `commercial_configuration_id uuid not null
references commercial_configurations(id) on delete restrict`, exactly as
locked in §5.7 of the database design. A Usage Fact never references
`commercial_components` or `commercial_commitments` directly: which
Component's earning calculation ends up consuming a given fact is decided
when `earned_result_usage_facts` links it in, not at capture time. This
keeps operational usage truth independent of pricing, so a re-priced or
superseded Component never requires touching historical Usage Facts.

**Corrections.** See §4.

**Time semantics.** Three distinct times, never conflated: `period_start`/
`period_end` (when the measured activity happened, at whatever grain the
source reports), `created_at` (when Nexus received/recorded this exact
row), and `commercial_configurations`/`commercial_components` effective
dating (when a commercial term applies, resolved entirely inside M8's own
tables, never duplicated here). No billing period concept is introduced;
that belongs to `billing_calculations` (M10).

## 4. Usage correction model

Usage Facts are immutable from creation; there is no update path at all
(`fn_reject_update_delete`, the same generic trigger already used for
`commercial_changes` and both M8 join tables). A correction is always a
new row:

- `supersedes_usage_fact_id uuid references usage_facts(id) on delete
  restrict` (nullable, self-referencing), linking a correction to the
  fact it replaces. `CHECK (supersedes_usage_fact_id IS DISTINCT FROM
  id)` prevents self-supersession, mirroring the identical check already
  proven on `commercial_components.supersedes_component_id`.
- **Supersession identity, structurally enforced (§0a, new).** A
  supersession chain represents replacement versions of the *same*
  measured fact, not a way to reassign a fact to a different scope. A
  composite self-referencing foreign key, using the same technique already
  proven for `fk_commercial_components_supersedes_within_configuration`
  and for `earned_results` (§5), forces a successor to share its
  predecessor's exact `(commercial_configuration_id,
  measurement_definition_id, period_start, period_end)`: a supporting
  `UNIQUE (commercial_configuration_id, measurement_definition_id,
  period_start, period_end, id)` (a non-restrictive superset of the plain
  PK, existing solely as a valid FK target) plus `FOREIGN KEY
  (commercial_configuration_id, measurement_definition_id, period_start,
  period_end, supersedes_usage_fact_id) REFERENCES usage_facts
  (commercial_configuration_id, measurement_definition_id, period_start,
  period_end, id)`. `MATCH SIMPLE` lets a null `supersedes_usage_fact_id`
  through unchecked, exactly as already relied upon for the Component and
  Earned Result precedents. `dimensions` is deliberately **not** part of
  this identity: putting a `jsonb` column inside a composite FK or a
  bespoke uniqueness mechanism would be disproportionate machinery for
  what is, in practice, a rare correction; a dimension change is instead
  modeled as void plus independent recapture, the same path already used
  for a wrong Configuration or wrong Measurement Definition (below).
- **No forking (§0a, new).** `UNIQUE (supersedes_usage_fact_id)` (nullable
  column; multiple `NULL`s are non-conflicting, so this restricts only
  non-null values). A given predecessor fact can be superseded by at most
  one successor, giving one linear correction chain and a single latest
  fact per measured fact, mirroring the identical no-fork decision already
  made for `earned_results` versioning (§5). Attempting to supersede a
  fact that already has a successor is rejected outright.
- `origin` distinguishes why the row exists: `'source'` (an ordinary
  capture, no predecessor), `'correction'` (an ordinary fix, superseding a
  prior fact), `'finance_override'` (an authorized Finance override of a
  source quantity, per the locked domain rule in
  `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §11). `override_reason` and
  `override_approved_by` are required together exactly when `origin =
  'finance_override'`, and null otherwise, enforced by a single shape
  CHECK (the same `case`-shape technique already proven for
  `chk_submission_revisions_lifecycle`).

**Quantity is never negative and corrections are never signed deltas.**
`CHECK (quantity >= 0)`. This is a replacement model, not an accumulation
model: a correction row carries the corrected absolute quantity for its
period, not a delta to add to the original. This does not change as a
result of the Earned-side redesign in §5: versioning solves how a
correction reaches a new Earned outcome, not how the correction itself is
shaped. The six required correction scenarios all fit without a
signed-delta mechanism, and each now has an unambiguous scope: an
in-chain correction (same Configuration, Measurement Definition, and
period as its predecessor, enforced structurally, §0a) versus a void plus
independent recapture (two genuinely unrelated root facts, not a chain):

- **Wrong quantity**: same Configuration, Measurement Definition, and
  period as the original. Insert a new fact with the corrected quantity,
  `origin = 'correction'`, `supersedes_usage_fact_id` pointing at the
  original. The composite self-FK is satisfied trivially, since nothing
  about the scope changes, only the quantity.
- **Duplicate import**: same scope as the original. Insert a new fact
  with `quantity = 0`, `origin = 'correction'`, superseding the duplicate.
  Voiding a fact is a zero-quantity, same-scope replacement, never a
  cross-scope one; this is exactly why voiding never needs to reach
  outside the composite self-FK's identity, regardless of which of the
  four scenarios below made the void necessary.
- **Wrong dimensions**: `dimensions` is deliberately outside the
  supersession identity (§0a), so a dimension change is never expressed as
  an in-chain correction. Void the fact under its original (still correct)
  Configuration, Measurement Definition, and period, exactly as above, and
  capture an independent new `origin = 'source'` fact with the corrected
  `dimensions`. The void and the recapture are two separate root facts,
  cross-referenced only informally (for example via a shared
  `evidence_reference`), not a supersession chain.
- **Wrong customer / wrong Configuration**: the Configuration is part of
  the supersession identity and is immutable per row, so it can never be
  corrected in-chain. Void the fact under the wrong Configuration (a
  same-scope, zero-quantity correction, as above) and capture an
  independent new `origin = 'source'` fact under the right Configuration.
  The void and the recapture are necessarily two different root facts:
  the composite self-FK would reject any attempt to make the new,
  correctly-scoped fact supersede the old, wrongly-scoped one, since they
  do not share a Configuration.
- **Wrong measurement**: same pattern as wrong Configuration: void under
  the wrong Measurement Definition, capture an independent new `source`
  fact under the right one, since `measurement_definition_id` is also
  part of the supersession identity and immutable per row.
- **Late-arriving data**: an ordinary `origin = 'source'` insert, not a
  correction and not scoped by the supersession identity at all; lateness
  is only a fact whose `period_start`/`period_end` describe an earlier
  period than `created_at` might suggest.

**How duplicate/incorrect facts are voided without ever requiring
cross-scope supersession.** Every void in the five scenarios above is,
by construction, a same-scope correction of the wrongly-scoped fact
itself (its Configuration, Measurement Definition, and period do not
change, only its quantity drops to zero); only the recapture that follows
a void is a new, independently-scoped root fact, never a successor. The
composite self-FK (§0a) therefore never needs an exception for
correction: voiding and recapturing are sufficient for every scope
change, and an in-chain supersession is reserved for the one case where
the scope is genuinely unchanged (wrong quantity, and the zero-quantity
void itself).

**A corrected historical Usage Fact no longer dead-ends.** Under the
revised Earned model (§5, §8), every one of the six scenarios above,
including a correction or a late arrival for a period that already has a
finalized `earned_results` row, has a coherent path to a corrected Earned
outcome: the new or voided Usage Fact becomes eligible input for a new,
superseding Earned Result version for the same logical Component and
period. The original row, and the original Earned Result version it once
fed, are never deleted or edited, satisfying the locked requirement that
history "remains as historical evidence" regardless of any later
correction.

## 5. Earned Result model

**Grain, unchanged.** One logical Earned Result per
`commercial_component_id` per earning period (`period_start`,
`period_end`). What changes in this revision is that the logical grain
may now have **more than one immutable calculation version** over time.
Each version is its own permanent row; none is ever updated to reflect a
recalculation, and none is ever deleted.

**Three distinct identities, kept separate rather than conflated into one
uniqueness rule:**

1. **Logical earning identity**: `(commercial_component_id, period_start,
   period_end)`. Stable for the life of the Component; may have many
   versions.
2. **Calculation attempt identity**: `id`, now **caller-supplied**, not
   `default gen_random_uuid()`. The calculation orchestrator (Pricing
   Kernel job) generates one `id` per attempt to produce a result and
   reuses that exact same `id` if it retries the same attempt (for
   example after a crash or timeout before it knows whether its write
   committed). This mirrors the existing, already-proven Nexus RPC
   idempotency convention where the caller pre-generates the row's own id
   (`p_new_commercial_configuration_id`, `p_new_request_id`) rather than
   letting the database mint one, so a retry can be recognized by primary
   key rather than by re-deriving a synthetic key (§7).
3. **One-current-result invariant**: among all versions sharing one
   logical earning identity, exactly one is ever the current, authoritative
   one, enforced structurally (below), not by a mutable flag.

**Versioning columns.** `result_version integer not null` (`CHECK
(result_version >= 1)`), starting at `1` for the first calculation of a
given logical grain and incrementing by exactly one per accepted
recalculation. `supersedes_earned_result_id uuid references
earned_results(id) on delete restrict` (nullable, self-referencing): null
for the first version of a logical grain, otherwise the immediate
predecessor version it replaces. `CHECK (supersedes_earned_result_id IS
DISTINCT FROM id)` prevents self-supersession.

**Structural, database-enforced integrity (no forking, no cross-grain
supersession, no duplicate roots), the mechanism that makes "one current
result" a provable property rather than an application convention:**

- A **partial unique index**: `UNIQUE (commercial_component_id,
  period_start, period_end) WHERE supersedes_earned_result_id IS NULL`.
  At most one "version 1" (root) row may exist per logical grain; a
  second, independent root chain for the same Component and period is
  rejected outright.
- A **plain unique constraint on `supersedes_earned_result_id`** (nullable
  column; standard SQL treats multiple `NULL`s as non-conflicting, so this
  restricts only non-null values). This means any given version can be
  superseded by at most one successor: no two rows may both claim to
  replace the same predecessor. Attempting to supersede a version that
  already has a successor is rejected by this constraint, which is also
  exactly what prevents "correcting" anything but the current, still-un-
  superseded tip of the chain.
- A **composite self-referencing foreign key**, mirroring the identical,
  already-proven technique used for
  `fk_commercial_components_supersedes_within_configuration`: a
  supporting `UNIQUE (commercial_component_id, period_start, period_end,
  id)` (a superset of the plain PK, existing solely as a valid FK target,
  restricting nothing beyond what `PRIMARY KEY (id)` already guarantees),
  plus `FOREIGN KEY (commercial_component_id, period_start, period_end,
  supersedes_earned_result_id) REFERENCES earned_results
  (commercial_component_id, period_start, period_end, id)`. This forces a
  superseding row to share its predecessor's exact logical grain; a
  version can never supersede a row belonging to a different Component or
  period. `MATCH SIMPLE` (the Postgres default for multi-column FKs) lets
  a null `supersedes_earned_result_id` through unchecked, exactly as
  already relied upon for the Component precedent.

Together, these three constraints guarantee, by induction, that every
logical grain forms exactly one linear chain (one root, each node with at
most one successor, no cross-grain attachment, no cycles, since a row can
only ever supersede a row that already exists): **there is always exactly
zero or one leaf (a row nothing supersedes) per logical grain.** That leaf
is the current, authoritative result, derived by a plain query, never a
stored flag:

```
select *
from earned_results er
where er.commercial_component_id = $1
  and er.period_start = $2
  and er.period_end = $3
  and not exists (
    select 1 from earned_results nr
    where nr.supersedes_earned_result_id = er.id
  );
```

**A new, table-specific `BEFORE INSERT` trigger**,
`fn_protect_earned_result_versioning()`, enforces the one property the
constraints above cannot express declaratively: that `result_version` is
exactly the predecessor's `result_version + 1` (or `1` when
`supersedes_earned_result_id` is null). It locks the predecessor row
`FOR UPDATE` when one is referenced, the same serialization-anchor
technique already used by `fn_protect_commitment_component_membership`,
so two concurrent recalculation attempts for the same logical grain
cannot both compute the same next `result_version`.

**Linkage.** `commercial_component_id uuid not null references
commercial_components(id) on delete restrict` (the earning grain).
`measurement_definition_id uuid references measurement_definitions(id) on
delete restrict` (nullable) and `commercial_commitment_id uuid references
commercial_commitments(id) on delete restrict` (nullable) are both stored
directly on the row, even though both are technically reachable by
joining through `commercial_component_id`, because the locked
replayability requirement
(`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §13: "identifiable from the
result itself") treats an Earned result as self-describing evidence, not
a pointer that requires a live join through Commercial to reconstruct
history. No `commercial_configuration_id` column: that was considered and
explicitly removed in the locked design as pure duplication, since it is
always reachable via `commercial_component_id`.

**Snapshot consistency, database-enforced at insert time (§0a, new).**
Capturing `measurement_definition_id` and `commercial_commitment_id` as
self-describing evidence (above) is only trustworthy if they are
validated, at the moment of insert, against the Component they claim to
describe; otherwise a caller defect could silently record a snapshot that
was never true. A new `BEFORE INSERT` trigger, `fn_protect_earned_result_scope()`,
mirroring the identical, already-proven technique used for
`fn_protect_commercial_commitment_scope()` (which resolves a quantity
Commitment's Component's Configuration and compares it against the
Change's own Configuration), performs two checks by reading
`commercial_components` and, when applicable, `commercial_commitments`:

1. **Measurement compatibility**: `NEW.measurement_definition_id` must be
   `NOT DISTINCT FROM` the referenced `commercial_components.measurement_definition_id`
   (both null for a non-usage Component, or both equal to the same
   Measurement Definition for a usage-driven one). A mismatch is rejected.
2. **Commitment ownership**, only when `NEW.commercial_commitment_id` is
   populated: the referenced `commercial_commitments` row must have
   `kind = 'quantity'` and its own `commercial_component_id` must equal
   `NEW.commercial_component_id`. A spend Commitment, or a quantity
   Commitment belonging to a different Component, is rejected.

Neither check is expressed as a composite FK: M8 does not already carry a
supporting unique key on `commercial_components(id,
measurement_definition_id)` or on `commercial_commitments(commercial_component_id,
id)`, and adding one would mean altering an M8 table's own schema, which
this document does not do (§0a). Both `commercial_components` and
`commercial_commitments` are immutable on every column this trigger
reads (`measurement_definition_id`, `commercial_component_id`, `kind` are
never touched by either table's own lifecycle trigger, whose only
editable column is `effective_to`), so an ordinary, unlocked `SELECT` is
sufficient: there is no concurrent-mutation race for this trigger to
guard against, and no `FOR UPDATE`/`FOR SHARE` is used. This validates
only that the snapshot is a true, structurally consistent reference; it
does not, and must not, attempt any Pricing Kernel arithmetic.

**Calculated values**, unchanged in shape from the first draft.
`raw_quantity numeric` and `calculated_quantity numeric` are both
nullable, and nullable together (`CHECK ((raw_quantity IS NULL) =
(calculated_quantity IS NULL))`): null for a non-usage-based Component
(`pricing_rule_kind = 'flat'`, no Measurement Definition), populated for
every usage-driven Component (`calculated_quantity` is `raw_quantity`
after any MUG floor is applied). `calculated_amount numeric not null` is
the one field always populated, usage-driven or not.
`transaction_currency text not null` mirrors the Component's own
currency, captured fresh at calculation time.

**Calculation lineage.** `pricing_calculation_version text not null` and
`rounding_policy_version text not null` capture the Pricing Kernel's own
implementation version at the moment this specific version was computed,
unchanged from the first draft. Each new `result_version` naturally
captures its own, possibly different, Kernel version, which is itself
part of why a later version can legitimately produce a different
`calculated_amount` from an earlier one for the same logical grain: not
only can the input Usage Facts differ, the Kernel build that computed it
can too.

**Every substantive field, on every version, is immutable from
creation.** Recalculation never updates a prior version's `raw_quantity`,
`calculated_quantity`, `calculated_amount`, `commercial_commitment_id`,
`pricing_calculation_version`, or any other computed field; it only ever
inserts a new row referencing the old one. No destructive update of a
prior result exists anywhere in this design.

## 6. Earned Result lineage model

**`earned_result_usage_facts`**, structurally unchanged from the first
draft: a plain many-to-many bridge, composite PK `(earned_result_id,
usage_fact_id)`, FKs `earned_result_id -> earned_results(id) on delete
restrict` and `usage_fact_id -> usage_facts(id) on delete restrict`,
insert-only, with only `created_at`/`created_by` (no `updated_at`/
`updated_by`, no independent audit trigger, matching the exact reasoning
already applied to `commercial_component_capabilities` and
`commercial_commitment_components`).

**Cross-scope integrity, database-enforced at insert time (§0a, new).**
This bridge is financially material evidence, so the database must not
permit a link between an Earned Result and a Usage Fact that do not
genuinely belong together. Neither table stores the other's scope
directly: `earned_results` reaches a Commercial Configuration only by
joining `commercial_component_id -> commercial_components.commercial_configuration_id`,
and `usage_facts` stores `commercial_configuration_id` directly, so no
declarative composite FK can compare them without denormalizing
Configuration onto one of the two tables purely to support the
constraint, the same anti-duplication trade already declined elsewhere in
this document. A new, dedicated `BEFORE INSERT` trigger,
`fn_protect_earned_result_usage_fact_scope()` (`SECURITY INVOKER`,
matching the existing convention already used by
`fn_protect_commitment_component_membership()` and
`fn_protect_commercial_commitment_scope()` for cross-table reads under
the trusted `service_role` write path), performs three checks on every
insert:

1. Read the linked Earned Result's `commercial_component_id` and
   `measurement_definition_id`; resolve that Component's own
   `commercial_configuration_id` from `commercial_components`.
2. Read the linked Usage Fact's `commercial_configuration_id` and
   `measurement_definition_id`.
3. Reject the insert if the two resolved Configurations differ.
4. Reject the insert if the Earned Result's `measurement_definition_id`
   is null (a non-usage, `pricing_rule_kind = 'flat'` Earned Result):
   such a result must have **zero** linked Usage Facts (§10), so any
   attempt to link one is rejected outright, not silently accepted merely
   because the bridge's own column types technically permit it.
5. Otherwise, reject the insert if the Earned Result's
   `measurement_definition_id` differs from the Usage Fact's own
   `measurement_definition_id`.

All three tables this trigger reads (`earned_results`, `commercial_components`,
`usage_facts`) are immutable on every column read here (Configuration and
Measurement Definition are never touched by any lifecycle trigger's
permitted-column set), so an ordinary, unlocked `SELECT` is sufficient;
no `FOR UPDATE`/`FOR SHARE`/`FOR KEY SHARE` is needed, since there is no
concurrent-mutation race to guard against for columns that never change
after insert.

**Rechecked under versioning: each Earned Result version has its own,
independent lineage.** Since `earned_result_id` is part of the composite
PK, and each version is a distinct row with its own `id`, version `v1`'s
lineage rows and version `v2`'s lineage rows are naturally separate rows;
no schema change was needed for this, only confirmation that nothing
about the bridge table entangles versions. Worked example, mirroring the
scenario named in the architecture review:

```
Component A, January:
  earned_results v1 (id = E1, result_version = 1, supersedes = null)
    earned_result_usage_facts: (E1, A), (E1, B)

  -- a correction to Usage Fact A arrives, replacing it with A2 --

  earned_results v2 (id = E2, result_version = 2, supersedes = E1)
    earned_result_usage_facts: (E2, A2), (E2, B)
```

`v1`'s lineage, `(E1, A)` and `(E1, B)`, is never rewritten, never
deleted, and remains permanently queryable: it correctly and permanently
describes what fed the original calculation, even though that
calculation is no longer current. `v2` is a full recalculation for the
same period, so its own lineage includes every Usage Fact that
contributed to it, both the corrected `A2` and the unaffected `B`; a new
version's lineage is not limited to only the changed facts.

**No `contribution_quantity` column**, unchanged from the first draft.
Each linked Usage Fact's own `quantity` is already visible with a plain
join to `usage_facts`, and Usage Facts remain immutable, so nothing here
can drift. Add a contribution field only if a future requirement needs a
value distinct from the fact's own quantity (for example, a partial
allocation of one fact across more than one Earned Result); no such
requirement exists today.

**Cardinality**, both directions permitted, unchanged:

- One `earned_results` row (one specific version) may link many
  `usage_facts` rows.
- One `usage_fact` row may legitimately link to more than one
  `earned_results` row, whether across different Components sharing a
  Measurement Definition, or across different versions of the same
  Component and period (as `B` does in the example above), **provided
  every such Component shares the Usage Fact's own Configuration and
  Measurement Definition**, which `fn_protect_earned_result_usage_fact_scope()`
  (above) now enforces on every individual link. Which of several
  eligible Components a Usage Fact actually feeds remains a Pricing
  Kernel input-selection decision; whether it is *permitted* to feed a
  given Component at all is no longer left to that decision alone.

**Replay effect on lineage**, restated under the versioned model: a
correction never rewrites existing lineage. It produces a new Earned
Result version with its own new lineage rows, leaving every prior
version's lineage exactly as it was. Whether a superseded Usage Fact may
still be selected as input to a *new* calculation remains a domain-service
selection rule (the Kernel should naturally prefer the latest
non-superseded fact), not a database constraint, the same posture already
locked for `measurement_definitions.status = 'deprecated'` references.

## 7. Idempotency model

Three distinct mechanisms, kept separate rather than merged into one
uniqueness rule, per the architecture review's own framing.

### 7.1 Usage ingestion idempotency

Add `source_system text` (nullable, new this revision) and
`source_event_key text` (nullable) to `usage_facts`.

**Shape rule**, the simplest one that closes the namespace-collision gap
without overconstraining: `CHECK (source_event_key IS NULL OR
source_system IS NOT NULL)`. An event key is only ever meaningful within a
named source system's namespace, so a key can never be recorded without
its namespace. The reverse is allowed: `source_system` may be populated
alone, with a null `source_event_key`, when a source genuinely has no
natural per-event key (for example, an `internal_tool` source that
performs periodic bulk recalculation loads with no discrete per-row
external identity, but whose provenance is still worth recording). No
artificial per-row key is invented for that case; `source_system` alone
still records genuine provenance without claiming a dedup guarantee that
does not exist.

**Idempotency scope**: a **partial unique index**, `UNIQUE
(commercial_configuration_id, source_system, source_event_key) WHERE
source_event_key IS NOT NULL`. Because the shape rule above guarantees
`source_system` is never null wherever `source_event_key` is populated,
every row inside this partial index has both columns populated; there is
no null-related ambiguity inside its scope. `source_type` (how the fact
entered Nexus) is deliberately **not** part of the uniqueness scope: the
same real-world external event, identified by `(source_system,
source_event_key)`, should be recognized as the same event even if the
transport mechanism that carried it into Nexus later changes (for
example, a system first integrated via `file_import` and later upgraded
to `external_feed`).

**Manual entry** (`source_type = 'manual_entry'`) leaves `source_system`
and `source_event_key` both null. No artificial key is invented for a
human capturing a number by hand: there is no reliable natural key to
derive one from, and forcing a synthetic key would either produce false
collisions (two genuinely different manual entries for the same period,
one of them a legitimate later correction) or provide no real protection.
Manual-entry duplicate detection instead relies on the correction model
(§4: a mistaken duplicate is voided with a zero-quantity correction) plus
ordinary human review.

### 7.2 Earned calculation idempotency

**Not a bare uniqueness violation treated as normal retry behavior.**
Instead, the same caller-supplied-identity-plus-replay-comparison
convention already proven for `create_commercial_configuration_with_change`
(`docs/M4_M8_FOUNDATION_HARDENING_DESIGN.md` §12) is reused directly:

- The calculation attempt's identity is the row's own `id` (§5), supplied
  by the calling Pricing Kernel orchestration, not database-generated.
- A proposed RPC, `record_earned_result(p_id uuid,
  p_commercial_component_id uuid, p_period_start date, p_period_end date,
  ... computed fields ...)`, performs an **idempotency probe before any
  insert**: look up `earned_results` by `id = p_id`.
  - **Found, and every substantive field matches** what was just
    recomputed (`commercial_component_id`, `period_start`, `period_end`,
    `raw_quantity`, `calculated_quantity`, `calculated_amount`,
    `transaction_currency`, `pricing_calculation_version`,
    `rounding_policy_version`): this is a genuine retry of the same
    attempt. Return the existing row. No new insert, no new
    `audit_log` row (nothing changed), matching the exact "idempotent
    replay is invisible in the ledger" behavior already locked for
    `create_commercial_configuration_with_change` (§12.6 of that design).
  - **Found, but a substantive field differs**: the same `id` is being
    reused for a genuinely different result, which is a caller defect,
    not a legitimate retry. Raise a named conflict (for example
    `EARNED_RESULT_ID_CONFLICT`), the same posture as
    `CONFIGURATION_CHANGE_CONFLICT`.
  - **Not found**: a new attempt. Locate the current row for
    `(commercial_component_id, period_start, period_end)` (the §5 query),
    lock it `FOR UPDATE` if one exists (the serialization anchor,
    matching the customers-row-lock precedent), set `result_version` to
    its `result_version + 1` and `supersedes_earned_result_id` to its
    `id`; otherwise `result_version = 1` and `supersedes_earned_result_id
    = null`. Insert the new row with `id = p_id`.

This makes retrying a specific calculation attempt safe (the same `id`
always resolves to the same outcome), while a genuinely new attempt
(different `id`, whether because inputs changed or because this is an
intentional recalculation) always and correctly produces a new version,
never a silent no-op and never a duplicate.

### 7.3 Correction/replay idempotency

Follows directly from §7.1 and §7.2: a corrected Usage Fact's own
idempotency is ordinary Usage Fact idempotency; the recalculation it
triggers is ordinary Earned calculation idempotency, with its own fresh
`id` per attempt. No third, separate mechanism exists for "a replay was
already applied."

## 8. Replay/recalculation model

**Historical recalculation is now possible, structurally, for any
period**, correcting the first draft's internally inconsistent position.
A Usage Fact correction (§4) for a period that already has a current
Earned Result produces a new, superseding version rather than dead-ending.

**Worked example**, exactly as posed by the review:

```
Component A, January:
  earned_results v1: result_version = 1, supersedes = null,
    calculated_amount = 100

  -- corrected usage arrives for January --

  earned_results v2: result_version = 2, supersedes = v1.id,
    calculated_amount = 120
```

Both rows are permanently stored. `v1` is never deleted or edited. `v2`
is the current, authoritative Earned truth for Component A / January, by
virtue of being the one row nothing else supersedes (§5), not by any
flag being flipped on `v1`. Whether `v1` had already been referenced by
an M10 Billing Calculation, and what financial adjustment that requires,
is M10 reconciliation logic, entirely untouched by this insert (§16):
`billing_calculations.source_earned_result_id` (an M10 column, not
designed here) always points at one specific, immutable `earned_results.id`
regardless of whether that row is later superseded, so nothing about
this recalculation retroactively changes what an existing Billing
Calculation says it was based on.

**Late-arriving usage for an already-earned period** is captured as an
ordinary new Usage Fact (§4), and is now a legitimate trigger for a new
Earned Result version for that same historical period, computed the same
way as any other correction-triggered recalculation.

**"Current" is a derived property, never a stored flag**, restated from
§5: the query in §5 returns exactly the one row nothing supersedes, for
any logical grain that has ever been calculated, and no row at all for a
grain that never has. There is no "active" column competing with
`status` for meaning (§9 below resolves this explicitly).

**Old `earned_results` versions, and their `earned_result_usage_facts`
lineage, remain permanently readable**, unchanged from the first draft:
this is the audit trail a correction leaves behind, not something a
correction erases.

## 9. Finalization vs. supersession: two axes, never conflated

The architecture review is right that these could collapse into two
competing meanings of "authoritative" if not stated explicitly. They do
not, because they answer different questions:

- **`status` (`open` -> `final`, exactly once per row)** answers: *is
  this specific calculation version itself considered settled/complete?*
  It is a property of one row, checked once, never re-examined by any
  other row.
- **Supersession / current-ness** answers: *among however many versions
  exist for this logical grain, which one is presently the Earned
  truth?* It is a property of the whole chain for a logical grain, never
  stored on any single row, always derived (§5, §8).

**A previously final result may be superseded.** Nothing about `status =
'final'` blocks a new row from being inserted with
`supersedes_earned_result_id` pointing at it: superseding is an insert of
a different row, not an update of the final one, so it is untouched by
`fn_protect_earned_result_lifecycle()`'s one-way `open -> final` rule.
Concretely: `v1` can be finalized, then later superseded by `v2`; `v1`
remains, forever, both `status = 'final'` and superseded. `final` means
"this version is settled," not "this logical grain can never be
corrected again." All four combinations are legitimate and expected over
a grain's lifetime: `(open, current)` (freshly calculated, not yet
reviewed), `(final, current)` (the ordinary steady state), `(open,
superseded)` (a calculation error caught before it was ever finalized),
`(final, superseded)` (the ordinary correction-history state, exactly
`v1` in the worked example above).

No CHECK restricts which predecessor status may be superseded: an `open`
or a `final` predecessor may equally be superseded, since correctness of
the Earned truth must not depend on how far a stale version happened to
get through its own review before a correction arrived.

## 10. Pricing-model coverage

Every pattern already supported by the locked M8 schema, checked against
the versioned M9 model without inventing new M8 columns. Each pattern
below may now legitimately accumulate more than one `earned_results`
version per logical grain over time (§5, §8); this does not change which
M8 columns are involved.

1. **Simple per-user / per-unit** (`pricing_rule_kind = 'linear'`):
   ordinary Usage Facts under the Component's Configuration and
   Measurement Definition feed one Earned Result version per period; no
   M9-specific mechanism beyond the base model.
2. **MUG / minimum usage guarantee for one Component**
   (`commercial_commitments.kind = 'quantity'`, direct FK to exactly one
   Component): `earned_results.commercial_commitment_id` references the
   applicable commitment; `raw_quantity` is the actual measured usage;
   `calculated_quantity` is the MUG floor applied once by the Kernel.
   Fully resolved by the existing direct-FK mechanism, no allocation
   table (already locked, §8a of the database design).
3. **Slab / graduated pricing** (`pricing_rule_kind = 'graduated'` /
   `'volume'`): identical Usage Fact and Earned Result shape as #1; the
   slab structure lives entirely in `commercial_components.pricing_rule_parameters`
   and is a Kernel calculation concern, not an M9 schema concern.
4. **Designation-based pricing**: carried in `usage_facts.dimensions`
   (validated against `measurement_definitions.dimension_keys` at the
   application layer, §3); the Kernel groups and rates by dimension when
   producing an Earned Result version, with no additional M9 column
   required.
5. **One Component covering multiple capabilities with shared rate/MUG**:
   already resolved entirely at the M8 layer
   (`commercial_component_capabilities`, one Component row, one quantity
   MUG); each Earned Result version still represents exactly one period
   for that one Component, regardless of how many capabilities the
   Component's scope covers, confirmed by the locked scenario proof
   (`docs/COMMERCIAL_DATABASE_DESIGN.md` §18, scenario 9).
6. **Minimum spend spanning multiple Components**
   (`commercial_commitments.kind = 'spend'`,
   `commercial_commitment_components` join): the spend threshold is
   evaluated by the Kernel by reading the *current* `earned_results`
   version's `calculated_amount` across every member Component for the
   relevant period; **no schema mechanism in this migration attributes a
   spend shortfall to a specific Component's Earned Result.** Which
   Component (if any) absorbs a minimum-spend top-up is Pricing Kernel
   calculation logic, explicitly out of scope for this document (§15)
   and not designed here.
7. **Fixed or non-usage-based recurring Component**
   (`pricing_rule_kind = 'flat'`, `is_recurring = true`): produces one
   Earned Result version per period with `raw_quantity`/
   `calculated_quantity` both null and `calculated_amount` equal to the
   fixed recurring charge. **No Usage Fact is required or fabricated for
   this case**, and a correction to a fixed charge (for example, a
   contractual amendment) still produces a new version the same way any
   other recalculation does, simply with an empty lineage set.
8. **One-time charges** (`pricing_rule_kind = 'flat'`, `is_recurring =
   false`): same shape as #7, with a single nominal
   `period_start = period_end` (a Kernel-layer convention, for example the
   Component's own `effective_from`), not a recurring-cadence-driven
   period. No Usage Fact required.

**Stated explicitly**: `earned_results` versions for cases #6 (the
spend-threshold Component, if any, absorbing a top-up), #7, and #8 may
legitimately have zero corresponding `earned_result_usage_facts` rows. An
empty lineage set is not an error condition; it correctly reflects that
no Usage Fact caused that particular charge.

## 11. Resource Registry and audit posture

| Table | Resource-backed | Audit | Reasoning |
|---|---|---|---|
| `usage_facts` | No | `fn_audit_row('id')` | High-volume, granular; the parent Configuration already anchors attachments/authorization; audit is still valuable here because corrections and Finance overrides are business-meaningful events worth a permanent before/after trail, matching the locked reasoning already applied to `commercial_changes`, which is also insert-only and still fully audited. |
| `earned_results` | No | `fn_audit_row('id')` | High-volume, granular, not independently actioned. Each new version's own insert is audited as an ordinary insert (nothing special-cased for supersession); audit also captures the one legitimate per-row transition (`open -> final`) the same way it already captures `commercial_components`'/`commercial_commitments`' single closure transition. |
| `earned_result_usage_facts` | No | None (intrinsic `created_at`/`created_by` only) | Pure insert-only join; matches the already-locked, explicitly-reasoned exception for `commercial_component_capabilities` and `commercial_commitment_components`. |

No table is resource-registered merely because it is a join table, and
none is resource-registered merely because the domain document names a
noun. All three tables are evaluated individually against the same test
already used for every other M8/M9 table: does this record need its own
independently actioned identity that its parent does not already
provide? For all three, no: the Configuration (for Usage Facts) and the
Component (for Earned Results and their lineage) already anchor whatever
future independent action is needed.

## 12. Security and privilege posture

Follows the established Nexus posture. Four new trigger functions are
required in total (versioning and lifecycle from the prior revision, plus
two scope-integrity functions from §0a); nothing else is invented.

- **Ownership**: all three tables owned by the migration-applying role,
  same as every M8 table.
- **RLS**: `ENABLE ROW LEVEL SECURITY` on all three, zero policies
  created, matching every table in M4-M8. `service_role` is the only
  data-access path, through explicit RPCs.
- **Mutation pathways**: no direct DML from application code. Dedicated
  `SECURITY INVOKER` RPCs (for example `record_usage_fact`,
  `correct_usage_fact`, `record_earned_result` (§7.2), `finalize_earned_result`),
  with `EXECUTE` revoked from `public`/`anon`/`authenticated` and granted
  only to `service_role`, matching the existing pattern
  (`create_commercial_configuration_with_change`).
- **Triggers on `usage_facts`**: reuses the existing generic
  `fn_reject_update_delete()`. The composite self-FK, the supporting
  unique constraint, and the `UNIQUE (supersedes_usage_fact_id)` no-fork
  constraint (§0a, §4, §13) are declarative and need no trigger.
- **Triggers on `earned_results`**: **three** table-specific `SECURITY
  INVOKER` functions:
  - `fn_protect_earned_result_scope()` (new, `BEFORE INSERT`, §5, §0a):
    validates `measurement_definition_id` compatibility with the
    referenced Component and, when populated, that
    `commercial_commitment_id` is the correct quantity Commitment for
    that same Component. Ordinary unlocked reads only (§5): the columns
    it reads on `commercial_components` and `commercial_commitments` are
    immutable.
  - `fn_protect_earned_result_versioning()` (new, `BEFORE INSERT`, §5):
    enforces `result_version` continuity and locks the predecessor row
    `FOR UPDATE` when one is referenced.
  - `fn_protect_earned_result_lifecycle()` (`BEFORE UPDATE`, structurally
    identical to `fn_protect_commercial_commitment_lifecycle()`): permits
    only `status` (`open -> final`), `finalized_at`, `finalized_by`,
    `updated_at`, `updated_by` to change; rejects `final -> open`; rejects
    `DELETE` unconditionally. Unaffected by versioning or scope: it
    governs one row's own transition, never a cross-row concern.
- **Triggers on `earned_result_usage_facts`**: reuses the existing
  generic `fn_reject_update_delete()`, plus one new, dedicated `SECURITY
  INVOKER` function, `fn_protect_earned_result_usage_fact_scope()`
  (`BEFORE INSERT`, §6, §0a): rejects a link whose Earned Result and
  Usage Fact resolve to different Commercial Configurations, whose Earned
  Result is non-usage (`measurement_definition_id IS NULL`), or whose
  Measurement Definitions do not match. Ordinary unlocked reads only,
  same rationale as above.
- **TRUNCATE**: the shared `fn_reject_truncate()` guard trigger is added
  to all three tables, and `TRUNCATE` is revoked from `service_role` on
  all three, matching every table hardened in
  `20260909120000_m4_m8_destructive_privilege_and_permanence_hardening.sql`.
- **Privileges**: `REVOKE ALL ... FROM anon, authenticated` on all three
  tables (defense-in-depth alongside RLS, matching the M8 baseline).

## 13. Constraint strategy

**`usage_facts`**

- `PRIMARY KEY (id)`.
- `FOREIGN KEY (commercial_configuration_id) REFERENCES
  commercial_configurations(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (measurement_definition_id) REFERENCES
  measurement_definitions(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (supersedes_usage_fact_id) REFERENCES usage_facts(id) ON
  DELETE RESTRICT` (nullable).
- `FOREIGN KEY (override_approved_by) REFERENCES app_users(id) ON DELETE
  RESTRICT` (nullable).
- `FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT`.
- `CHECK (source_type IN ('manual_entry','file_import','internal_tool','external_feed'))`.
- `CHECK (origin IN ('source','correction','finance_override'))`.
- `CHECK (quantity >= 0)`.
- `CHECK (period_end >= period_start)`.
- `CHECK (supersedes_usage_fact_id IS DISTINCT FROM id)`.
- Shape `CHECK`: `override_reason IS NOT NULL AND override_approved_by IS
  NOT NULL` when `origin = 'finance_override'`; both `NULL` otherwise.
- Shape `CHECK` (new, §7.1): `source_event_key IS NULL OR source_system
  IS NOT NULL`.
- `UNIQUE (commercial_configuration_id, source_system, source_event_key)
  WHERE source_event_key IS NOT NULL` (§7.1, revised from the first
  draft to add `source_system`).
- `UNIQUE (commercial_configuration_id, measurement_definition_id,
  period_start, period_end, id)` (new, §0a, §4: a non-restrictive
  superset of the plain PK, existing solely to serve as the composite FK
  target below).
- `UNIQUE (supersedes_usage_fact_id)` (new, §0a, §4: no forking, at most
  one successor per predecessor fact).
- `FOREIGN KEY (commercial_configuration_id, measurement_definition_id,
  period_start, period_end, supersedes_usage_fact_id) REFERENCES
  usage_facts (commercial_configuration_id, measurement_definition_id,
  period_start, period_end, id)` (new, §0a, §4: composite self-FK,
  supersession stays within the same Configuration, Measurement
  Definition, and period, mirroring
  `fk_commercial_components_supersedes_within_configuration`).
- Immutable: every column, unconditionally; no `UPDATE` path exists.

**`earned_results`** (revised for versioning)

- `PRIMARY KEY (id)` (`id` is caller-supplied, §5, §7.2; no `DEFAULT`).
- `FOREIGN KEY (commercial_component_id) REFERENCES
  commercial_components(id) ON DELETE RESTRICT`.
- `FOREIGN KEY (measurement_definition_id) REFERENCES
  measurement_definitions(id) ON DELETE RESTRICT` (nullable).
- `FOREIGN KEY (commercial_commitment_id) REFERENCES
  commercial_commitments(id) ON DELETE RESTRICT` (nullable).
- `FOREIGN KEY (finalized_by) REFERENCES app_users(id) ON DELETE
  RESTRICT` (nullable).
- `FOREIGN KEY (supersedes_earned_result_id) REFERENCES earned_results(id)
  ON DELETE RESTRICT` (nullable, new).
- `UNIQUE (commercial_component_id, period_start, period_end, id)` (new;
  a non-restrictive superset of the plain PK, existing solely to serve
  as the composite FK target below).
- `UNIQUE (commercial_component_id, period_start, period_end) WHERE
  supersedes_earned_result_id IS NULL` (new, partial: at most one root
  version per logical grain).
- `UNIQUE (supersedes_earned_result_id)` (new: no forking, at most one
  successor per predecessor).
- `FOREIGN KEY (commercial_component_id, period_start, period_end,
  supersedes_earned_result_id) REFERENCES earned_results
  (commercial_component_id, period_start, period_end, id)` (new,
  composite self-FK: supersession stays within the same logical grain,
  mirroring `fk_commercial_components_supersedes_within_configuration`).
- `CHECK (result_version >= 1)` (new).
- `CHECK (supersedes_earned_result_id IS DISTINCT FROM id)` (new).
- `CHECK (status IN ('open','final'))`.
- `CHECK (period_end >= period_start)`.
- `CHECK ((raw_quantity IS NULL) = (calculated_quantity IS NULL))`.
- `CHECK (calculated_quantity IS NULL OR calculated_quantity >= 0)`.
- `CHECK (calculated_amount >= 0)`.
- Shape `CHECK`: `finalized_at IS NOT NULL AND finalized_by IS NOT NULL`
  when `status = 'final'`; both `NULL` when `status = 'open'`.
- Cross-row `CHECK` (not expressible declaratively; enforced by
  `fn_protect_earned_result_versioning()`, §5, §12): `result_version`
  equals the referenced predecessor's `result_version + 1`, or `1` when
  there is no predecessor.
- Cross-parent `CHECK` (not expressible declaratively, no supporting M8
  key available; enforced by `fn_protect_earned_result_scope()`, §5, §12,
  §0a): `measurement_definition_id` matches the referenced Component's
  own `measurement_definition_id`; a populated `commercial_commitment_id`
  must be a `kind = 'quantity'` Commitment belonging to the same
  Component.
- Immutable: every column except `status`/`finalized_at`/`finalized_by`
  (and `updated_at`/`updated_by`) on any single row, guarded by
  `fn_protect_earned_result_lifecycle()`; a logical grain's history is
  extended only by inserting a new row, never by updating an old one.

**`earned_result_usage_facts`**, structure unchanged from the first
draft; cross-scope integrity added (§0a).

- `PRIMARY KEY (earned_result_id, usage_fact_id)`.
- `FOREIGN KEY (earned_result_id) REFERENCES earned_results(id) ON
  DELETE RESTRICT`.
- `FOREIGN KEY (usage_fact_id) REFERENCES usage_facts(id) ON DELETE
  RESTRICT`.
- `FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE
  RESTRICT`.
- No additional `CHECK` constraints; the composite PK itself is the
  no-duplicate-link guarantee.
- Cross-parent integrity (new, §6, §0a): no composite FK is used, since
  neither table stores the other's Commercial Configuration directly and
  denormalizing one purely to support a constraint was declined (§6).
  Instead, `fn_protect_earned_result_usage_fact_scope()` (`BEFORE
  INSERT`) rejects a link whose Earned Result and Usage Fact resolve to
  different Configurations, whose Earned Result is non-usage
  (`measurement_definition_id IS NULL`), or whose Measurement Definitions
  do not match. This is no longer left as an application-layer-only
  invariant, as the first draft stated; it is now database-enforced.
- Immutable: entire row; insert-only via `fn_reject_update_delete()`.

## 14. Proposed table definitions at design level

Design-level column shapes, not executable SQL. Standard columns
(`created_at timestamptz not null default now()`, `created_by uuid
references app_users(id) on delete restrict`, plus `updated_at`/
`updated_by` only where an update path exists) follow the convention
already established in `docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md`
§4 and are listed explicitly below rather than assumed silently.

**`usage_facts`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` |
| `commercial_configuration_id` | `uuid not null` | FK |
| `measurement_definition_id` | `uuid not null` | FK |
| `period_start` | `date not null` | |
| `period_end` | `date not null` | |
| `quantity` | `numeric not null` | `>= 0` |
| `dimensions` | `jsonb` | nullable |
| `source_type` | `text not null` | closed set, §13 |
| `source_system` | `text` | nullable, new, §7.1 |
| `source_reference` | `text` | nullable |
| `source_event_key` | `text` | nullable, §7.1 |
| `evidence_reference` | `text` | nullable |
| `origin` | `text not null` | closed set, §13 |
| `supersedes_usage_fact_id` | `uuid` | nullable, self-FK |
| `override_reason` | `text` | nullable, conditional |
| `override_approved_by` | `uuid` | nullable, conditional FK |
| `created_at` | `timestamptz not null` | fulfills "captured_at", §3 |
| `created_by` | `uuid not null` | fulfills "captured_by", §3 |

**`earned_results`** (revised for versioning)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid not null` | PK, **caller-supplied**, no `DEFAULT` (§5, §7.2) |
| `commercial_component_id` | `uuid not null` | FK, part of logical grain |
| `measurement_definition_id` | `uuid` | nullable FK |
| `commercial_commitment_id` | `uuid` | nullable FK |
| `period_start` | `date not null` | part of logical grain |
| `period_end` | `date not null` | part of logical grain |
| `result_version` | `integer not null` | `>= 1`, new, §5 |
| `supersedes_earned_result_id` | `uuid` | nullable, self-FK, new, §5 |
| `raw_quantity` | `numeric` | nullable, together with next |
| `calculated_quantity` | `numeric` | nullable, together with prior |
| `calculated_amount` | `numeric not null` | `>= 0` |
| `transaction_currency` | `text not null` | captured fresh |
| `pricing_calculation_version` | `text not null` | Kernel build id |
| `rounding_policy_version` | `text not null` | Kernel build id |
| `status` | `text not null default 'open'` | `open`/`final`, §9 |
| `finalized_at` | `timestamptz` | nullable, conditional |
| `finalized_by` | `uuid` | nullable, conditional FK |
| `created_at` / `created_by` | | standard |
| `updated_at` / `updated_by` | | standard, needed for finalize |

**`earned_result_usage_facts`**, unchanged

| Column | Type | Notes |
|---|---|---|
| `earned_result_id` | `uuid not null` | PK part, FK (one specific version) |
| `usage_fact_id` | `uuid not null` | PK part, FK |
| `created_at` / `created_by` | | standard, intrinsic provenance only |

## 15. Open business decisions

**Resolved in the second revision pass:**

- **Earned recalculation** (§5, §7.2, §8): resolved as a
  versioned-supersession model with a caller-supplied calculation
  identity. This was misclassified as a future Finance decision in the
  first draft; it is a structural integrity question this document can,
  and now does, answer.
- **Usage ingestion idempotency namespace** (§7.1): resolved with
  `source_system` added alongside `source_event_key`.

**Resolved in this (third) revision pass, all structural integrity
questions this document can answer directly, none requiring a Finance
decision:**

- **Usage supersession scope** (§0a, §4, §13): resolved with a composite
  self-FK forcing a successor to share its predecessor's exact
  Configuration, Measurement Definition, and period, plus a no-fork
  uniqueness constraint.
- **Earned lineage cross-scope integrity** (§0a, §6, §12): resolved with
  a dedicated insert-time trigger rejecting a link across Configurations,
  a Measurement mismatch, or any link to a non-usage Earned Result.
- **Earned snapshot consistency** (§0a, §5, §12): resolved with a
  dedicated insert-time trigger validating `measurement_definition_id`
  and `commercial_commitment_id` against the referenced Component, without
  adding any new constraint to an M8 table.

**Remain genuinely operational, not schema-blocking:**

- **Smallest earning period.** Not a schema question: `period_start`/
  `period_end` accept any date range the calling calculation job
  chooses; the schema does not constrain granularity. Left to whoever
  builds the calculation job.
- **Minimum-spend shortfall attribution.** Which Component (if any)
  absorbs a spend-commitment top-up is Pricing Kernel calculation logic
  (§10, item 6), not represented anywhere in this schema, and does not
  affect M9 structural integrity.

## 16. Explicit M10 exclusions

Nothing in this document represents, references, or anticipates the
column shapes of: `billing_calculations`, `invoice_eligibility_events`,
`invoice_evidence`, `invoice_evidence_items`, `reconciliation_adjustments`.
Invoice timing, invoice eligibility, invoice numbering, invoice evidence,
collection status, and reconciliation adjustments against an invoice are
all Migration 10 concerns, deliberately out of scope here, matching the
already-locked boundary
(`docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` §4 "Migration 10").

**Versioning does not reach into M10, and needs no M10 design decision to
be safe.** An M10 `billing_calculations.source_earned_result_id` (already
named in the locked logical design, not designed here) is an ordinary FK
to one specific, immutable `earned_results.id`; it is unaffected by
whether that row is later superseded, because superseding never mutates
or removes the row a prior Billing Calculation already referenced. What
M10 must decide for itself, when it is designed, is a business/read-time
question, not a structural one this document needs to resolve: whether a
new Billing Calculation should read only the *current* Earned Result
version (§5's query) or may reference a specific historical version
directly, and what happens financially when a version it already billed
is later superseded. Noted here only as a forward pointer; not designed.

## 17. Proposed migration/runtime-test sequence

**Migration 9 internal creation order** (dependency-safe, mirroring the
per-table convention already used in Migration 8: function, then table,
then trigger attach, then privilege hardening, per table):

1. `usage_facts` (depends only on existing M8 tables
   `commercial_configurations`, `measurement_definitions`, and existing
   `app_users`); attach `fn_reject_update_delete()` (existing, reused, no
   new function needed even for the composite self-FK, which is purely
   declarative, §0a); attach `fn_audit_row('id')` (existing, reused); add
   the partial unique index (`commercial_configuration_id, source_system,
   source_event_key`), the composite-FK-supporting unique constraint and
   composite self-FK (`commercial_configuration_id,
   measurement_definition_id, period_start, period_end[, id /
   supersedes_usage_fact_id]`, §0a), the `UNIQUE (supersedes_usage_fact_id)`
   no-fork constraint (§0a), all `CHECK` constraints, and the two ordinary
   indexes (`(commercial_configuration_id, measurement_definition_id,
   period_start)`, `(supersedes_usage_fact_id)`); `ENABLE ROW LEVEL
   SECURITY`; `REVOKE` from `anon`/`authenticated`; attach
   `fn_reject_truncate()`; `REVOKE TRUNCATE` from `service_role`.
2. `fn_protect_earned_result_scope()`, `fn_protect_earned_result_versioning()`,
   and `fn_protect_earned_result_lifecycle()` (new functions; must exist
   before `earned_results` can safely accept writes).
3. `earned_results` (depends on `commercial_components`,
   `measurement_definitions`, `commercial_commitments`, all existing);
   attach all three new trigger functions; attach `fn_audit_row('id')`;
   add the composite-FK-supporting unique constraint, the partial
   root-unique index, the `supersedes_earned_result_id` unique
   constraint, the composite self-FK, and all `CHECK` constraints; same
   RLS/privilege/TRUNCATE hardening as `usage_facts`.
4. `fn_protect_earned_result_usage_fact_scope()` (new function; must
   exist before `earned_result_usage_facts` can safely accept writes).
5. `earned_result_usage_facts` (depends on `earned_results`,
   `usage_facts`, both created above); attach `fn_reject_update_delete()`
   and the new scope-integrity function; add the `(usage_fact_id)` index;
   same RLS/privilege/TRUNCATE hardening, no audit trigger.
6. No Resource Registry seed rows are needed (§11: none of the three
   tables are Resource-backed).

**Proposed runtime-test scenarios**, mirroring the existing
`.runtime-tests` convention, one script per scenario:

1. Manual entry, then a wrong-quantity correction: confirm the original
   row is untouched and still readable, the correction row links via
   `supersedes_usage_fact_id`, and any direct `UPDATE`/`DELETE` attempt on
   either row is rejected.
2. Duplicate `file_import` submission with the same `source_system` and
   `source_event_key` under the same Configuration: confirm the second
   insert is rejected. Confirm the same `source_event_key` under a
   *different* `source_system` (or a different Configuration) is
   accepted, proving the namespace fix.
3. Quantity MUG scenario (§10, item 2): one Component, one quantity
   commitment, actual usage below the MUG threshold; confirm
   `earned_results.calculated_quantity` reflects the floor and
   `commercial_commitment_id` is populated.
4. Flat, non-recurring (one-time) Component: confirm an `earned_results`
   row can be created with `raw_quantity`/`calculated_quantity` both null
   and zero linked `earned_result_usage_facts` rows.
5. Shared Measurement Definition across two Components under one
   Configuration: confirm the same `usage_fact` row can be linked, via
   `earned_result_usage_facts`, to two different `earned_results` rows
   without any uniqueness violation.
6. **Recalculation, the worked example (§8)**: create `v1` for Component
   A / January; insert a correcting Usage Fact; create `v2` with
   `supersedes_earned_result_id = v1.id` and `result_version = 2`;
   confirm the §5 current-result query returns exactly `v2`; confirm
   `v1` and its lineage remain unchanged and readable.
7. **Fork rejection**: attempt to insert a second row also superseding
   `v1` (a second, different "v2"); confirm rejection by the
   `supersedes_earned_result_id` unique constraint.
8. **Root duplication rejection**: attempt to insert a second row for the
   same logical grain with `supersedes_earned_result_id = null`; confirm
   rejection by the partial root-unique index.
9. **Cross-grain supersession rejection**: attempt to insert a row for
   Component A / January whose `supersedes_earned_result_id` points at a
   version belonging to a different Component or period; confirm
   rejection by the composite self-FK.
10. **Version-continuity rejection**: attempt to insert a row with
    `supersedes_earned_result_id = v1.id` but `result_version` other than
    `2`; confirm rejection by `fn_protect_earned_result_versioning()`.
11. **Idempotent replay**: call `record_earned_result` twice with the
    same `p_id` and the same computed inputs; confirm only one row
    exists and no second `audit_log` row is written for the replay.
12. **Id reuse conflict**: call `record_earned_result` twice with the
    same `p_id` but a different `calculated_amount` the second time;
    confirm rejection with a named conflict, not a silent overwrite or a
    second row.
13. Finalize `v1`, then supersede it with `v2` (§9): confirm `v1` remains
    permanently `status = 'final'` and is now also superseded; confirm
    `v1` itself was never updated by the supersession.
14. Attempt to move an already-`final` row `final -> open`, and attempt
    to finalize an already-`final` row a second time: confirm both are
    rejected by `fn_protect_earned_result_lifecycle()`.
15. `TRUNCATE` attempt against each of the three tables by `service_role`:
    confirm rejection.
16. **Usage supersession across Configuration rejected (§0a, §4)**:
    attempt to insert a Usage Fact whose `supersedes_usage_fact_id` points
    at a fact under a different `commercial_configuration_id`; confirm
    rejection by the composite self-FK.
17. **Usage supersession across Measurement rejected (§0a, §4)**: attempt
    to insert a Usage Fact whose `supersedes_usage_fact_id` points at a
    fact with a different `measurement_definition_id`; confirm rejection
    by the composite self-FK.
18. **Usage supersession across period rejected (§0a, §4)**: attempt to
    insert a Usage Fact whose `supersedes_usage_fact_id` points at a fact
    with a different `period_start` or `period_end`; confirm rejection by
    the composite self-FK.
19. **Usage correction fork rejected (§0a, §4)**: insert a valid
    correction superseding a fact, then attempt to insert a second,
    different correction also superseding the same original fact; confirm
    rejection by the `UNIQUE (supersedes_usage_fact_id)` constraint.
20. **Valid same-scope Usage correction succeeds (§4)**: insert a
    wrong-quantity correction sharing its predecessor's exact
    Configuration, Measurement Definition, and period; confirm it is
    accepted and the predecessor remains unchanged and readable.
21. **Earned lineage link across Configuration rejected (§0a, §6)**:
    attempt to link an `earned_results` row to a `usage_facts` row whose
    Configuration differs from the Earned Result's own Component's
    Configuration; confirm rejection by
    `fn_protect_earned_result_usage_fact_scope()`.
22. **Earned lineage link with wrong Measurement rejected (§0a, §6)**:
    attempt to link a usage-driven `earned_results` row to a `usage_facts`
    row with a different `measurement_definition_id`; confirm rejection.
    Separately, attempt to link *any* Usage Fact to a non-usage
    (`measurement_definition_id IS NULL`) `earned_results` row; confirm
    rejection.
23. **Correct lineage link succeeds (§0a, §6)**: link an `earned_results`
    row to a `usage_facts` row sharing both Configuration and Measurement
    Definition; confirm it is accepted.
24. **Earned Result carrying a Measurement incompatible with its
    Component rejected (§0a, §5)**: attempt to insert an `earned_results`
    row whose `measurement_definition_id` does not match (and is not
    `NOT DISTINCT FROM`) the referenced Component's own
    `measurement_definition_id`; confirm rejection by
    `fn_protect_earned_result_scope()`.
25. **Earned Result carrying a Commitment belonging to another Component
    rejected (§0a, §5)**: attempt to insert an `earned_results` row whose
    `commercial_commitment_id` references a quantity Commitment belonging
    to a different Component (or a spend Commitment); confirm rejection
    by `fn_protect_earned_result_scope()`.
