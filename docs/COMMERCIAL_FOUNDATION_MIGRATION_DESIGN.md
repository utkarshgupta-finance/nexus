# NEXUS COMMERCIAL FOUNDATION

## MIGRATION DESIGN

**STATUS: LOCKED** (design, all three migrations). **Migration 8:
COMPLETE.** Migration 8
(`supabase/migrations/20260908210000_commercial_configuration_foundation.sql`)
has been applied to the linked remote Nexus database and its runtime
gate has passed 24/24. Full execution evidence is in §23; this document
remains the authoritative record of the design decisions themselves,
which are unchanged by that execution. **Migrations 9 and 10: SQL NOT
YET AUTHORED**, remain separate, not-yet-started stages against this
same locked design.

## 0. Principal architect review: corrections applied this revision

A source-trace review checked every lifecycle rule, every proposed
column, and every deferred mechanism in this document against
`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` and
`docs/COMMERCIAL_DATABASE_DESIGN.md`. Four defects were found and are
corrected below; none required reopening the locked 15-table model,
the migration sequencing, or any locked business rule.

1. **Fabricated quotation, `commercial_configurations.is_active`
   (§4)**: the previous revision attributed the phrase "one-way
   true-to-false, mirroring `requests.is_active` exactly" to the
   locked `COMMERCIAL_DATABASE_DESIGN.md` as if quoted verbatim. That
   phrase does not appear anywhere in the locked document; the locked
   text (§5.1) says only `is_active` (boolean, one-way true-to-false).
   The rule itself (one-way, true to false) is genuinely locked; the
   analogy to `requests.is_active` and the quotation marks around it
   were invented at migration-design time. Corrected to cite the
   actual locked source and drop the false quotation.
2. **Invented denormalized column, `earned_results` (§4)**: the
   previous revision added `commercial_configuration_id` to
   `earned_results` labeled "(denormalized)". No such field appears in
   `COMMERCIAL_DATABASE_DESIGN.md` (which, unlike every other table,
   never states an explicit Fields list for `earned_results`), and it
   directly contradicts the locked design's own stated principle
   (§2: "no duplicated derivable state", the exact reasoning that
   removed `usage_facts.customer_id`). `commercial_configuration_id`
   is fully derivable via `commercial_component_id ->
   commercial_components.commercial_configuration_id`. Removed.
3. **Deferred atomic-creation contract, resolved instead of deferred
   (new §3a)**: the previous revision deferred "an RPC atomically
   creating a Configuration + Change + Component set" to "a future
   application/domain-service layer" (old §16). This document's own
   §4 already requires `commercial_configurations.commercial_change_id`
   and (for `initial_setup`) `commercial_changes.commercial_configuration_id`
   to be populated together, in one transaction, which is a database
   creation contract, not an application concern, and the codebase
   already has two proven precedents for exactly this shape
   (`create_request_with_draft`, `create_form_version`). Deferring it
   further would leave a circular foreign-key dependency undiscovered
   until SQL authoring. Resolved now in §3a.
4. **Unflagged non-locked mechanism, `earned_results` recalculation
   (§4, §16)**: `supersedes_earned_result_id` and break test 28 asserted
   a recompute-as-new-row mechanism that is necessary for internal
   consistency (given "immutable except the finalize transition") but
   is not stated in either locked document; `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`
   §13 explicitly leaves "the exact state model" **[PROVISIONAL]**.
   This is now explicitly labeled as a migration-design-level inference,
   not a locked mechanism, and carried into §18 as an open technical
   question rather than presented as settled.

## 0a. Second principal architect review: contradiction resolved, not compromised

The review that produced §0's four corrections left one internal
contradiction: it disclosed `supersedes_earned_result_id`/recalculation
as non-locked (§0 item 4) while simultaneously keeping a uniqueness
contract worded "among current, non-superseded rows" (old §4), which
presupposes the very column it had just flagged as not locked. A
database cannot have a partial-uniqueness concept of "non-superseded"
without a real column backing it.

**Resolved strictly from the locked sources, OPTION B**: re-reading
`docs/COMMERCIAL_DATABASE_DESIGN.md` §5.8 (the only section discussing
`earned_results`) confirms it states granularity ("one row per
Commercial Component per earning period") and finality ("minimal
open/final model") only; it names no supersession field, no
recalculation mechanism, and no partial-uniqueness concept anywhere.
`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §13 confirms the state model
distinguishing "still safe to recompute" from "already relied upon" is
**[PROVISIONAL]**, not locked. **No Earned supersession/recalculation
mechanism is locked in either source.** This is corrected below, not
by inventing a column now, but by removing every trace of a
supersession-dependent contract for `earned_results` and stating
plainly what the locked schema permits today: exactly one Earned
Result row, ever, per `(commercial_component_id, period_start,
period_end)`, full stop, with no schema-level path to recompute it
before or after finalization. If Finance later needs a supported
recalculation path, that is a new, explicit database design decision
for a future migration, not something this document invents to fill
the gap. `supersedes_earned_result_id` is removed entirely (§4); break
test 28 is rewritten to test the resulting plain-uniqueness behavior
instead of a recompute path that does not exist (§14).

This same pass also resolves two items the first review left as vague
"open technical questions" rather than settled postures, per the same
"the SQL author must not decide this later" standard: Measurement
Definition deprecated-reference behavior (§4, resolved to a stated,
locked-consistent posture, not an invented prohibition), and Usage
Fact supersession eligibility for new Earned calculations (§4,
separated explicitly into historical readability versus calculation
eligibility, the latter left to the domain service since no locked
document requires a database trigger for it). See §18a for the
blocking-classification of every remaining open item.

This document translates the locked `docs/COMMERCIAL_DATABASE_DESIGN.md`
(built on the locked `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` and
`docs/COMMERCIAL_TECH_EVALUATION.md`) into an implementation-grade
migration design, the same role
`docs/MASTER_DATA_FOUNDATION_MIGRATION_DESIGN.md` played for Migration 7,
now applied and runtime-proven 40/40. It does not redesign the Commercial
domain or database model; it decides exactly how the already-locked
15-table model becomes real PostgreSQL, in what order, with which
triggers, functions, indexes, and break tests. It does not create a
migration file, execute SQL, connect to Supabase, or write application
code.

## 1. Locked inputs, not reopened here

Every business and database-design decision in
`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` and
`docs/COMMERCIAL_DATABASE_DESIGN.md` is treated as final, including the
quantity-MUG correction: a quantity commitment belongs to exactly one
Commercial Component via a direct foreign key
(`commercial_commitments.commercial_component_id`), never an allocation
policy across components; minimum spend commitments remain the only kind
that may span multiple components, through
`commercial_commitment_components`; Commercial Component is not
Resource-backed (the Commercial Change/Request already provides the
approval trail); Reconciliation Adjustment and Commercial Configuration
are the only Resource-backed Commercial entities; Usage Fact is scoped
by `commercial_configuration_id`; Invoice Evidence is a header with a
separate `invoice_evidence_items` allocation table; Pricing Kernel
implementation version lives only on `earned_results`/
`billing_calculations`, never on `commercial_components`. Nothing in
this document changes any of that.

`docs/MASTER_DATA_FOUNDATION_DESIGN.md` and its migration
(`supabase/migrations/20260908013210_master_data_foundation.sql`) are
COMPLETE and runtime-proven: `customers` and `capabilities` exist as real
tables with real primary keys. This is the first Commercial-adjacent
migration that can add real foreign keys to them instead of the
placeholder UUID references the locked design always anticipated.

## 2. Existing conventions inspected and reused

Migrations 1 through 7 (Platform Core, Audit/Control Hardening, Trigger
EXECUTE Revocation, Form Versioning, Submission Data, Request
Resource-Type Integrity, Master Data Foundation) establish the exact
patterns this design reuses without modification:

- **UUID generation**: `default gen_random_uuid()` on every plain
  primary key; Resource-backed tables reuse `resources.resource_id`
  instead of generating their own.
- **`row_version`**: `integer not null default 1`, `CHECK (row_version
  >= 1)`, bumped exclusively by the existing `fn_bump_row_version()`
  (unmodified, reused verbatim); callers never set it, only supply
  `WHERE row_version = expected`.
- **`updated_at`**: `fn_set_updated_at()` (unmodified, reused verbatim),
  attached only to tables that have a genuine update path.
- **Audit**: `fn_audit_row(pk_column_name)` (unmodified, reused
  verbatim), `AFTER INSERT OR UPDATE OR DELETE`, full-row JSON capture,
  attached even where `DELETE` is expected to always be rejected (so a
  rejected `DELETE` provably produces no audit row, per the
  `BEFORE`-raises-before-`AFTER`-fires guarantee already proven for
  Migration 7).
- **Resource Registry**: `fn_assert_resource_type(expected_type,
  pk_column_name)` (unmodified, reused verbatim, generalized in
  Migration 6 to accept a non-`resource_id`-named PK column); new
  `resource_types` rows inserted only for genuinely Resource-backed
  tables, in the same migration that first needs them, exactly as
  Migration 4 did for `form_version`.
- **Lifecycle protection**: one dedicated function per table whose
  mutable-column shape is genuinely table-specific (the
  JSONB-diff-minus-permitted-columns technique proven by
  `fn_protect_form_version_lifecycle`, `fn_protect_access_grant`,
  `fn_protect_customer_lifecycle`, `fn_protect_capability_lifecycle`),
  never one over-generalized function forced across tables with
  different rules.
- **Pure insert-only immutability**: reused generically. Every table
  with no legitimate `UPDATE` path at all (not even one permitted
  transition) shares one new, table-agnostic function (§7), the same
  reuse discipline already applied to `fn_bump_row_version`/
  `fn_audit_row`/`fn_set_updated_at`, since this function has zero
  table-specific logic to justify a dedicated copy per table.
- **Privilege hardening**: explicit `REVOKE ALL ON TABLE ... FROM anon,
  authenticated` and `REVOKE EXECUTE ON FUNCTION ... FROM public, anon,
  authenticated` per migration, as defense-in-depth on top of Migration
  2's `ALTER DEFAULT PRIVILEGES`, exactly as Migrations 4 and 7 already
  do.
- **RLS**: `ENABLE ROW LEVEL SECURITY`, never `FORCE`, zero policies at
  migration time.
- **Migration safety**: no `IF NOT EXISTS`, no `CREATE OR REPLACE`
  concealment, no explicit `BEGIN`/`COMMIT` (matching every existing
  migration; atomicity remains empirically proven only for Supabase CLI
  2.117.0 on the tested Docker-backed local path,
  `docs/MASTER_DATA_FOUNDATION_MIGRATION_DESIGN.md` §22, and must be
  re-verified, not assumed, if the controlling CLI version ever changes
  before this design is implemented).

## 3. Migration sequencing decision

**Decision: Option B. Three ordered migrations, not one 15-table file.**

This is not a file-size split. It follows the same dependency-layered,
independently-verifiable staging already used for every prior Nexus
migration in this repository (Platform Core before Form Versioning
before Submission Data before Master Data), and the locked Commercial
model itself has a real, one-directional dependency structure: terms,
then facts derived from those terms, then evidence derived from those
facts. Splitting along that boundary means each migration's own runtime
break-test pass can be fully green before the next migration is even
written, exactly the discipline that caught the resource-type-integrity
gap in Migration 6 and validated Migration 7 end-to-end before Master
Data was declared complete.

**Migration 8: Commercial Configuration Foundation** (7 tables)
`commercial_configurations`, `commercial_changes`,
`commercial_components`, `commercial_component_capabilities`,
`measurement_definitions`, `commercial_commitments`,
`commercial_commitment_components`.

*Why this boundary is real*: this is the complete "what commercial terms
currently apply" layer. Nothing in it references Usage, Earned, Billing,
Invoice, or Reconciliation. It is the first migration able to add real
foreign keys to `customers`/`capabilities`. It can be fully
break-tested in isolation: every constraint, lifecycle rule, and
Resource Registry behavior for Configuration/Component/Commitment/
Measurement Definition is provable without a single Usage Fact or
Earned Result existing yet.

*Independently verifiable after Migration 8*: Configuration/Component/
Commitment lifecycle and immutability; Measurement Definition semantic
immutability; the quantity-commitment-is-a-direct-FK rule and the
spend-commitment-membership-currency rule; Resource Registry correctness
for Commercial Configuration; the `commercial_configurations` <->
`commercial_changes` mutual-reference provenance path; real FKs to
`customers`/`capabilities`.

**Migration 9: Commercial Usage and Earned** (3 tables)
`usage_facts`, `earned_results`, `earned_result_usage_facts`.

*Why this boundary is real*: this layer answers "what happened and what
was earned from it," strictly depending on Migration 8's
`commercial_components`, `commercial_commitments`, and
`measurement_definitions` already existing, but never referenced by
anything in Migration 8. It introduces the append-only
correction/supersession pattern (Usage Fact) and the
open/final finality pattern (Earned Result), two genuinely distinct
concurrency/lifecycle shapes not present in Migration 8 at all.

*Independently verifiable after Migration 9*: Usage Fact provenance,
correction, and Finance-override supersession; Earned Result
one-row-per-Component-per-period uniqueness and finality; Pricing
Kernel version capture at calculation time; the Earned-to-Usage-Fact
join.

**Migration 10: Commercial Billing, Invoice, and Reconciliation**
(5 tables) `billing_calculations`, `invoice_eligibility_events`,
`invoice_evidence`, `invoice_evidence_items`,
`reconciliation_adjustments`.

*Why this boundary is real*: this is the evidence/settlement layer,
depending on Migration 9's `earned_results` (for
`source_earned_result_id`) and Migration 8's `commercial_commitments`
(for `source_commercial_commitment_id`), but nothing in Migrations 8 or
9 ever references it. It is also where the second (and last)
Resource-backed Commercial table lives (`reconciliation_adjustments`),
a distinct control-surface concern from Migration 8's
`commercial_configurations`.

*Independently verifiable after Migration 10*: Billing Calculation
source-provenance shape check; Invoice Eligibility append-only decision
log; Invoice Evidence header/items allocation and the
exactly-one-of-two-sources shape per item; Reconciliation Adjustment
Resource Registry behavior, no-netting-by-construction, and finality.

No table is split across migrations; no migration depends on a table
defined in a later migration; each migration's own break tests do not
require any later migration to exist.

## 3a. Resource-backed atomic creation contract (locked this revision)

This was previously deferred to "a future application/domain-service
layer" (old §16). That deferral is withdrawn: the creation contract for
both Resource-backed Commercial entities must be locked before SQL, per
this review, and this codebase already has a proven, twice-repeated
pattern to reuse without modification: `create_form_version`
(`supabase/migrations/20260907014500_form_versioning_foundation.sql`)
and `create_request_with_draft`
(`supabase/migrations/20260907044335_submission_data_foundation.sql`),
both `SECURITY INVOKER` plpgsql functions that insert a `resources` row
(with a literal `resource_type` string) and the feature row inside one
function body, i.e. one implicit transaction, callable only by the
trusted `service_role` app path (`EXECUTE` revoked from `public, anon,
authenticated`), with `fn_assert_resource_type` attached as a
defense-in-depth trigger backstop beneath the function's own
correct-by-construction insert order, exactly as Migration 6's own
comments describe for `create_request_with_draft`.

**`commercial_configurations` (+ its first `commercial_changes` row,
`change_category = 'initial_setup'`)**

1. Must the resource row, the Configuration row, and the initial Change
   row be created atomically? **Yes**, all three, in one transaction:
   `commercial_configurations.commercial_change_id` is `NOT NULL`
   (§5.1), so no Configuration can legally exist without its creating
   Change already existing, and the locked design requires them
   "inserted together, in one transaction, at approval time" (locked
   design §5.1, verbatim).
2. **A dedicated function is required**: `create_commercial_configuration_with_change(...)`,
   `SECURITY INVOKER`, mirroring `create_request_with_draft` exactly.
3. **Invariants enforced**: the Configuration's `commercial_change_id`
   and the Change's `commercial_configuration_id` reference each other
   and nothing else; `change_category` is `'initial_setup'` for this
   path only; the `resources` row is minted with the literal
   `resource_type = 'commercial_configuration'` before the Configuration
   row is inserted, matching the existing precedent's insert order.
4. **Arguments supplied by the caller**: the already-approved
   `request_id` (the Commercial Change *is* the Request, 1:1), the
   Configuration's `customer_id`, `key`, `name`, `effective_date`,
   `reason`, and the acting user, mirroring `create_request_with_draft`'s
   `p_actor_user_id`/`p_audit_request_id` convention.
5. **Generated server-side**: the Configuration's `id` (or accepted as a
   caller-supplied idempotency key, matching `create_request_with_draft`'s
   `p_new_request_id` convention, an implementation choice, not a design
   gap); `created_at`/`updated_at` via column defaults, not set
   explicitly, matching both existing precedents exactly.
6. **Resource Type locking**: yes, via the same two-layer approach
   already proven, the literal string at insert time inside the
   function (correct-by-construction), plus `fn_assert_resource_type('commercial_configuration', 'id')`
   as an unconditional trigger backstop, identical in structure to
   `requests`' own `trg_requests_assert_resource_type`.
7. **Privilege posture**: `SECURITY INVOKER`, not `DEFINER`, identical
   reasoning already documented for both existing precedents (only the
   trusted `service_role` path calls it, which already holds every
   needed privilege; `DEFINER`'s elevation buys nothing and adds
   `search_path` risk). `EXECUTE` revoked from `public, anon,
   authenticated`.
8. **Application never directly `INSERT`s** into `commercial_configurations`
   or `commercial_changes`; only this function does, exactly as ordinary
   application code never directly inserts into `resources` or
   `requests` today.
9. **Failure guarantee**: a plpgsql function body executes inside the
   caller's own transaction; a raised exception at any step (an invalid
   FK, a failed `fn_assert_resource_type` check, a `change_category`
   `CHECK` violation) aborts that transaction entirely, leaving no
   `resources`, `commercial_configurations`, or `commercial_changes` row
   committed, the identical guarantee already relied on for
   `create_request_with_draft`/`create_form_version`; no compensating
   cleanup logic is written or needed.

**Circular foreign-key dependency, resolved (not previously surfaced)**:
because `commercial_configurations.commercial_change_id` is `NOT NULL`
and, for the `initial_setup` case, `commercial_changes.commercial_configuration_id`
must also resolve to that same not-yet-existing Configuration row,
neither row can be inserted first under Postgres's default `NOT
DEFERRABLE, INITIALLY IMMEDIATE` foreign-key timing: whichever table is
inserted first would fail against a row that does not exist yet. This
is a genuine circular dependency, surfaced here rather than left for
SQL authoring to discover. **Resolution**: mark the foreign key
`commercial_changes.commercial_configuration_id REFERENCES
commercial_configurations(id)` as `DEFERRABLE INITIALLY DEFERRED`.
The function inserts `commercial_changes` first (its FK check deferred
to transaction commit), then `commercial_configurations` second
(its own `commercial_change_id` FK is checked immediately and succeeds,
since the `commercial_changes` row already exists by that point); by
commit, the deferred constraint finds the Configuration row now exists
and passes. Every other (non-`initial_setup`) `commercial_changes`
insert is unaffected: deferring this one constraint changes nothing
about when an ordinary renewal/amendment Change's reference to an
already-existing Configuration is checked, only that it is checked at
commit instead of statement-end, which is strictly weaker in no way
that matters here. This same deferred-constraint technique, not a
nullable-then-updated column, is required because `commercial_changes`
has no `UPDATE` path at all (§7); a two-step insert-then-update would
violate that locked immutability rule.

**`reconciliation_adjustments`**

1. Must the resource row and the feature row be created atomically?
   **Yes**, same reasoning as every other Resource-backed table in this
   codebase (`commercial_configurations`, `form_versions`, `requests`):
   an orphaned `resources` row with no backing feature row, or a
   feature row with no `resources` row, are both invalid states this
   codebase never allows to exist even transiently outside one
   transaction.
2. **A dedicated function is required**: `create_reconciliation_adjustment(...)`,
   `SECURITY INVOKER`, no circular dependency here (unlike Commercial
   Configuration, nothing on `reconciliation_adjustments` is referenced
   back by an earlier-inserted row), so the ordinary two-step order
   already proven by `create_form_version` applies directly: insert
   `resources` (`resource_type = 'reconciliation_adjustment'`) first,
   `returning resource_id`, then insert `reconciliation_adjustments`
   using that value.
3. **Invariants enforced**: `resource_type` literal correctness at
   insert time; `status = 'open'` at creation (the only legal initial
   state); `direction` supplied and `CHECK`-constrained.
4. **Arguments supplied**: `commercial_component_id`, `direction`,
   the operational quantity/billing-basis explanation and monetary
   impact fields (locked design §2 item 11), acting user.
5. **Generated server-side**: `resource_id` (via the `resources` insert,
   `returning resource_id into ...`, matching `create_form_version`
   exactly); `created_at`/`updated_at` via defaults.
6. **Resource Type locking**: same two-layer approach:
   `fn_assert_resource_type('reconciliation_adjustment', 'resource_id')`
   as the trigger backstop beneath the function's own correct
   insert order.
7. **Privilege posture**: `SECURITY INVOKER`; `EXECUTE` revoked from
   `public, anon, authenticated`.
8. **Application never directly `INSERT`s** into
   `reconciliation_adjustments`; only this function does.
9. **Failure guarantee**: identical to Commercial Configuration above;
   a raised exception aborts the whole transaction, leaving neither the
   `resources` row nor the `reconciliation_adjustments` row committed.

## 4. Table-by-table implementation contract

Standard columns, not repeated per row below unless a table deviates:
`created_at timestamptz not null default now()`, `created_by uuid
references app_users (id) on delete restrict` (nullable), `updated_at
timestamptz not null default now()`, `updated_by uuid references
app_users (id) on delete restrict` (nullable), present on every table
below **except** the pure insert-only tables noted in §7, which omit
`updated_at`/`updated_by` entirely (no update path exists to populate
them), the same reasoning `invoice_eligibility_events` already states
explicitly in the locked design; this document extends that same,
already-locked reasoning consistently to every other table with no
update path, as a technical clarification, not a business change.

### Migration 8

**`commercial_configurations`**
- Role: stable anchor for one coherent commercial relationship.
- PK: `id` (= `resource_id`, Resource-backed).
- FKs: `customer_id -> customers(id)` (real FK, new), `commercial_change_id -> commercial_changes(request_id)` (`not null`, set atomically with the first Commercial Change, mutual-reference with `commercial_changes.commercial_configuration_id`).
- Immutable: `id`, `key`, `customer_id`, `commercial_change_id`, `created_at`, `created_by`.
- Editable: `name`, `relationship_note`, `is_active`.
- Lifecycle: `is_active` **one-way** `true -> false` only, exactly as locked (`docs/COMMERCIAL_DATABASE_DESIGN.md` §3 table and §5.1: "`is_active` (boolean, one-way true-to-false)"). This is deliberately **not** the same as `customers.is_active` (reversible, per `docs/MASTER_DATA_FOUNDATION_DESIGN.md` §5.2): the locked Commercial design's own text was never revised, so the one-way rule is preserved exactly as locked, not silently harmonized with the unrelated Customer correction. Note: no locked document states this rule "mirrors `requests.is_active`"; that comparison does not appear in either locked source and is not asserted here.
- `row_version`: yes (locked design §9), via `fn_bump_row_version()`.
- Uniqueness: `UNIQUE (key)`.
- Resource Registry: yes; new `resource_types` row `('commercial_configuration', ...)`; `fn_assert_resource_type('commercial_configuration', 'id')`.
- Audit: generic `fn_audit_row('id')`.
- Deletion: no `DELETE`, enforced by the dedicated lifecycle trigger (below), not privilege alone.
- DB-enforced: identity immutability, one-way `is_active`, resource-type integrity, `UNIQUE(key)`.
- App-layer: whether `relationship_note` content is meaningful.

**`commercial_changes`**
- Role: Commercial-specific meaning of one approved Commercial Change; 1:1 extension of `requests`.
- PK: `request_id` (= `requests.id`, not itself Resource-backed; the Request it extends already is).
- FKs: `request_id -> requests(id)`, `commercial_configuration_id -> commercial_configurations(id)`.
- Immutable: every column, populated once at approval.
- Lifecycle: none; no update path at all.
- `row_version`: no.
- CHECK: `change_category in ('initial_setup','renewal','amendment','correction','other')`.
- Resource Registry: no (the Request already provides identity).
- Audit: generic `fn_audit_row('request_id')`.
- Deletion: rejected via the shared pure-insert-only function (§7).
- DB-enforced: 1:1 via shared PK/FK, `change_category` closed set.
- App-layer: whether the individual changed terms (derivable by querying which `commercial_components`/`commercial_commitments` rows reference this `commercial_change_id`) are sensible for the declared category; the atomic RPC creating a Configuration + its first Change + its first Component(s) together for `initial_setup`.

**`commercial_components`**
- Role: the effective-dated unit carrying commercial terms; one component = one charge line.
- PK: `id` (plain `uuid`, **not** Resource-backed, per the locked correction; the Commercial Change/Request is the action boundary).
- FKs: `commercial_configuration_id -> commercial_configurations(id)`, `commercial_change_id -> commercial_changes(request_id)`, `measurement_definition_id -> measurement_definitions(id)` (nullable), `supersedes_component_id -> commercial_components(id)` (nullable, self-referencing).
- Immutable: every column except `effective_to`.
- Editable: `effective_to`, settable exactly once (`null -> date`).
- `row_version`: no; the single closure transition is guarded by a conditional `WHERE effective_to IS NULL` plus a lifecycle trigger, matching `commercial_commitments`/`earned_results`/`reconciliation_adjustments`.
- CHECK: `pricing_rule_kind in ('linear','graduated','volume','dimension','flat')`; a shape check on `pricing_rule_parameters` per kind using the `?`-existence-operator technique (locked §6); `billing_cadence`/`reconciliation_cadence in ('monthly','quarterly','half_yearly','annual')`; `billing_timing in ('advance','arrears')`; `billing_quantity_basis in ('mug','previous_period_actual','fixed')`, required only when `billing_timing = 'advance'`.
- Resource Registry: no.
- Audit: generic `fn_audit_row('id')`.
- Deletion: rejected via the dedicated lifecycle trigger (single-transition class).
- Effective dating (§8 below): `effective_from` immutable, not null; `effective_to` nullable, settable once, no automatic overlap prevention (application/domain-service rule, see §8).
- App-layer: whether a proposed component's `effective_from` is sensible relative to sibling components for the same scope; deeper `pricing_rule_parameters` semantics (tier ordering, non-negative rates).

**`commercial_component_capabilities`**
- Role: many-to-many, component to canonical Capability.
- PK: composite `(component_id, capability_id)`.
- FKs: `component_id -> commercial_components(id)`, `capability_id -> capabilities(id)` (real FK, new).
- Immutable: entire row; insert-only.
- Provenance: `created_at`/`created_by` only (intrinsic, no `updated_at`/`updated_by`, per §7).
- Resource Registry: no.
- Audit: none (intrinsic provenance is the complete history for an insert-only row; matches the locked reasoning already used for this exact table).
- Deletion: rejected via the shared pure-insert-only function.

**`measurement_definitions`**
- Role: canonical business meaning of a countable quantity.
- PK: `id` (plain `uuid`, not Resource-backed).
- Immutable: `id`, `key`, `unit`, `business_definition`, `counting_rule`, `period_basis`, `dimension_keys`, `created_at`, `created_by`.
- Editable: `name`, `expected_source`.
- Lifecycle: `status in ('active','deprecated')`, deprecate-only, one-way.
- `row_version`: yes (locked design §9), via `fn_bump_row_version()`.
- Uniqueness: `UNIQUE (key)`.
- Resource Registry: no.
- Audit: generic `fn_audit_row('id')`.
- Deletion: rejected via the dedicated lifecycle trigger.
- DB-enforced: semantic-field immutability, one-way `status`, `UNIQUE(key)`.
- App-layer: whether a proposed new definition genuinely represents a different semantic meaning versus a cosmetic rename.
- **Deprecated-reference posture, locked this revision (§0a)**: re-reading both locked documents confirms neither prohibits a new `commercial_components`/`usage_facts` row from referencing an already-`deprecated` `measurement_definitions` row, and neither requires it either. Since no prohibition is locked, none is invented. The posture, settled now so the SQL author has nothing left to decide: (1) **FK integrity only at the database level** (an ordinary foreign key, no `status` check on insert); (2) **deprecated Measurement Definitions remain referenceable historically**, exactly as already true for every existing row (deprecation never breaks an existing FK, and this extends the identical guarantee to future FKs too); (3) **the database does not reject a new `commercial_components`/`usage_facts` insert solely because the referenced `measurement_definitions.status = 'deprecated'`**; no trigger or CHECK is added for this; (4) **application/domain-service selection rules** (which definitions are offered when authoring a new Component, or capturing new Usage) **are the correct, and only, place to steer authors away from deprecated definitions for new work**, not a database constraint; (5) **any stronger database-level enforcement requires a future, explicit Finance/business decision** revising `COMMERCIAL_DATABASE_DESIGN.md` itself, not a silent addition here.

**`commercial_commitments`**
- Role: a minimum quantity or minimum spend commitment.
- PK: `id` (plain `uuid`, not Resource-backed).
- FKs: `commercial_change_id -> commercial_changes(request_id)`, `commercial_component_id -> commercial_components(id)` (nullable, **populated only when `kind = 'quantity'`**, the locked correction that removes any allocation question by construction).
- Immutable: every column except `effective_to`.
- Editable: `effective_to`, settable once.
- `row_version`: no; conditional `WHERE effective_to IS NULL` plus lifecycle trigger.
- CHECK: `kind in ('quantity','spend')`; `commercial_component_id is not null` when `kind = 'quantity'` and `null` when `kind = 'spend'` (a single-row CHECK, expressible without a subquery); `period = 'monthly'` when `kind = 'quantity'` (locked, unconditional), free among the standard cadence set when `kind = 'spend'`; `currency` required (`not null`) when `kind = 'spend'`, `null` when `kind = 'quantity'`.
- Resource Registry: no.
- Audit: generic `fn_audit_row('id')`.
- Deletion: rejected via the dedicated lifecycle trigger.
- App-layer: none beyond what the CHECKs already express; the direct FK removes the allocation question entirely, by construction, as locked.

**`commercial_commitment_components`**
- Role: many-to-many, **minimum-spend commitments only**, to the component(s) they apply to.
- PK: composite `(commitment_id, component_id)`.
- FKs: `commitment_id -> commercial_commitments(id)`, `component_id -> commercial_components(id)`.
- Immutable: entire row; insert-only.
- Provenance: `created_at`/`created_by` only.
- Integrity trigger (`BEFORE INSERT`, new, §10): (a) rejects the insert outright if the referenced `commercial_commitments.kind <> 'spend'` (a quantity commitment must never be attachable through this join at all, closing the exact gap the locked correction identified); (b) for the accepted `spend` case, verifies every existing member component of that commitment shares the same `transaction_currency` as the newly inserted one (the narrowed, currency-only compatibility check; the measurement-definition-compatibility branch from the first-pass design no longer applies, since a quantity commitment no longer has more than one member to compare).
- Resource Registry: no.
- Audit: none (intrinsic provenance).
- Deletion: rejected via the shared pure-insert-only function.

### Migration 9

**`usage_facts`**
- Role: append-only Finance-relied-upon quantity, manual-first (`docs/COMMERCIAL_TECH_EVALUATION.md`'s `UsageSource` abstraction: `manual_entry`, `file_import`, `internal_tool`, `external_feed`); no metering/streaming/aggregation infrastructure introduced.
- PK: `id` (plain `uuid`, not Resource-backed).
- FKs: `commercial_configuration_id -> commercial_configurations(id)`, `measurement_definition_id -> measurement_definitions(id)`, `supersedes_usage_fact_id -> usage_facts(id)` (nullable, self-referencing), `override_approved_by -> app_users(id)` (nullable).
- Immutable: every column, unconditionally; no update path exists at all.
- Correction/override: a new row, never an edit; `origin in ('source','correction','finance_override')` distinguishes the reason; `supersedes_usage_fact_id` links it to what it corrects. The original row is never touched.
- **Supersession semantics, made unambiguous (§0a)**: separating historical readability from calculation eligibility, per this review. (1) The original `usage_facts` row is immutable and permanently readable/auditable, unconditionally; this is locked (`COMMERCIAL_DOMAIN_ARCHITECTURE.md` §11: "the original remains as historical evidence"). (2) A correction links back via `supersedes_usage_fact_id`; both the original and the correction remain queryable forever, chained if corrections repeat. (3) **Whether a superseded fact may still be selected into a *new* `earned_result_usage_facts` relationship is a genuinely different question from historical readability, and is not database-enforced.** No locked document requires a trigger preventing this, and none is added: `earned_result_usage_facts.usage_fact_id` is an ordinary FK, satisfied by any existing `usage_facts` row, superseded or not. (4) **The latest, non-superseded correction is the normal authoritative input for a new calculation**, but this is an application/domain-service selection rule (the Pricing Kernel's own input-selection logic, not built in this migration), not a database constraint; nothing here prevents a domain-service bug from technically joining a superseded fact, and no schema change closes that gap in this migration. Stated explicitly rather than left as the ambiguous "usable" from an earlier revision of this document.
- `row_version`: no; not applicable to a table with no update path.
- CHECK: `source_type in ('manual_entry','file_import','internal_tool','external_feed')`; `origin in ('source','correction','finance_override')`; `override_reason`/`override_approved_by` required (not null) only when `origin = 'finance_override'`, expressed with the `?`-existence-operator/`case`-shape technique already proven for `chk_submission_revisions_lifecycle`.
- Resource Registry: no.
- Audit: generic `fn_audit_row('id')` (small JSONB `dimensions` payload, no volume/size concern comparable to `submission_revisions`).
- Deletion: rejected via the shared pure-insert-only function.
- App-layer: which `dimensions` keys are valid for a given `measurement_definitions.dimension_keys`.

**`earned_results`**
- Role: replayable commercial calculation result; one row per Commercial Component per earning period.
- PK: `id` (plain `uuid`, not Resource-backed).
- FKs: `commercial_component_id -> commercial_components(id)`, `measurement_definition_id -> measurement_definitions(id)`, `commercial_commitment_id -> commercial_commitments(id)` (nullable).
- **Note on traceability**: `COMMERCIAL_DATABASE_DESIGN.md` §5.8 states no explicit Fields list for this table (unlike every other table in §5); its field shape here is derived from the table's own locked structural properties, not copied from a locked Fields line. `commercial_component_id` traces to the locked granularity rule ("one row per Commercial Component per earning period", §3 table, §5.8). `measurement_definition_id` and `commercial_commitment_id` trace to `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §13 **[LOCKED]**'s replayability requirement ("which usage fact(s)... whether and how a commitment was applied... all identifiable from the result itself"). **Removed this revision**: a previously-listed `commercial_configuration_id` "(denormalized)" column, which had no locked basis and directly violated the locked design's own anti-duplication principle (`COMMERCIAL_DATABASE_DESIGN.md` §2: "no duplicated derivable state"); it is fully derivable via `commercial_component_id -> commercial_components.commercial_configuration_id`.
- Immutable: every column except the single finalize transition.
- Editable: `status` (`open -> final`, exactly once), `finalized_at`, `finalized_by`, set together.
- `row_version`: no; conditional `WHERE status = 'open'` plus lifecycle trigger.
- **No supersession column. No recalculation mechanism.** Corrected this revision (§0a): re-reading `COMMERCIAL_DATABASE_DESIGN.md` §5.8 and `COMMERCIAL_DOMAIN_ARCHITECTURE.md` §13 confirms neither locks a supersession field, a recalculation path, or a "current row" concept for `earned_results`; §13 explicitly leaves the exact state model **[PROVISIONAL]**. A `supersedes_earned_result_id` column (present in an earlier revision of this document) is removed: inventing it now, with no locked basis, is exactly the silent-invention failure mode this review exists to catch.
- Uniqueness: **plain `UNIQUE (commercial_component_id, period_start, period_end)`, unconditional, no partial predicate.** This is the only uniqueness contract expressible from fields actually present in the locked schema, and it is fully executable by the SQL author with zero further decision: a second `INSERT` for the same Component and period is rejected outright by this constraint, regardless of the existing row's `status`.
- **What this means, stated explicitly**: under the current locked schema, an `earned_results` row cannot be recomputed, replaced, or superseded by any means, before or after finalization. Its substantive fields (`raw_quantity`, `calculated_quantity`, `calculated_amount`, Kernel version fields, etc.) are immutable from creation (the lifecycle trigger permits only the `status`/`finalized_at`/`finalized_by` finalize transition); a second attempt at the same period is rejected by the plain unique constraint above, not accepted as a new "current" row. **If Finance later needs a supported recalculation path** (for example, correcting a wrong Earned calculation while still `open`), that requires a new, explicit database design decision, deciding at minimum whether it is a new column, a relaxed/partial constraint, or a delete-and-reinsert policy, made against real Finance requirements in a future revision of `COMMERCIAL_DATABASE_DESIGN.md` itself, not invented here to fill a gap. This document leaves it as a stated future concern (§18a), not a silently-assumed capability.
- `pricing_calculation_version`/`rounding_policy_version`: captured fresh at calculation time (the Kernel's own version when this row was computed), never copied from `commercial_components` (which no longer carries them, per the locked correction).
- Resource Registry: no.
- Audit: generic `fn_audit_row('id')`.
- Deletion: rejected via the dedicated lifecycle trigger.
- App-layer: the actual Pricing Kernel calculation logic (not built in this migration).

**`earned_result_usage_facts`**
- Role: many-to-many, one Earned result to the Usage Fact(s) that fed it.
- PK: composite `(earned_result_id, usage_fact_id)`.
- FKs: `earned_result_id -> earned_results(id)`, `usage_fact_id -> usage_facts(id)`.
- Immutable: entire row; insert-only.
- Provenance: `created_at`/`created_by` only, added here for the same financial-materiality reason already applied to Migration 8's join tables (which Usage Fact(s) fed a given Earned calculation is itself evidence, not merely structural).
- Resource Registry: no.
- Audit: none (intrinsic provenance).
- Deletion: rejected via the shared pure-insert-only function.

### Migration 10

**`billing_calculations`**
- Role: what should mathematically be billed for a cycle, with traceable source.
- PK: `id` (plain `uuid`, not Resource-backed).
- FKs: `commercial_component_id -> commercial_components(id)`, `source_earned_result_id -> earned_results(id)` (nullable), `source_commercial_commitment_id -> commercial_commitments(id)` (nullable).
- Immutable: every column; insert-only.
- CHECK (source-shape, new): exactly one of `source_earned_result_id`/`source_commercial_commitment_id` populated when `billing_quantity_basis_used = 'previous_period_actual'` or `'mug'` respectively; both `null` when `billing_quantity_basis_used = 'fixed'`.
- `pricing_calculation_version`/`rounding_policy_version`: captured fresh at this calculation's own time.
- `row_version`: no.
- Resource Registry: no.
- Audit: generic `fn_audit_row('id')`.
- Deletion: rejected via the shared pure-insert-only function.

**`invoice_eligibility_events`**
- Role: immutable eligibility decision events; "current" eligibility is always the latest event per Billing Calculation, a derived read.
- PK: `id` (plain `uuid`, not Resource-backed).
- FKs: `billing_calculation_id -> billing_calculations(id)`, `decided_by -> app_users(id)` (nullable).
- Immutable: every column; insert-only.
- Columns: `created_at`/`created_by` only, no `updated_at`/`updated_by` (locked design's own explicit statement for this table).
- Resource Registry: no.
- Audit: **none**, unchanged from the locked design: this table is itself already an append-only decision log; a second audit trail over an audit-shaped table duplicates evidence for no benefit, the same reasoning `audit_log` itself is never audited.
- Deletion: rejected via the shared pure-insert-only function.

**`invoice_evidence`**
- Role: header reference to an actual invoice or credit note produced by a future, separate Invoicing capability; not an invoicing engine.
- PK: `id` (plain `uuid`, not Resource-backed).
- Immutable: every column; insert-only.
- CHECK: `evidence_kind in ('invoice','credit_note')`.
- Resource Registry: no.
- Audit: generic `fn_audit_row('id')`.
- Deletion: rejected via the shared pure-insert-only function.
- Boundary: never becomes the source of earned-revenue calculation; it only records that an external document exists, allocated via `invoice_evidence_items`.

**`invoice_evidence_items`**
- Role: allocation of one invoice/credit-note header to one or more underlying Nexus financial items.
- PK: `id` (plain `uuid`, not Resource-backed).
- FKs: `invoice_evidence_id -> invoice_evidence(id)`, `billing_calculation_id -> billing_calculations(id)` (nullable), `reconciliation_adjustment_id -> reconciliation_adjustments(resource_id)` (nullable).
- Immutable: every column; insert-only.
- CHECK: exactly one of `billing_calculation_id`/`reconciliation_adjustment_id` populated (the only two permitted source types the locked model allows; no other source type is introduced).
- Uniqueness: deliberately none on `billing_calculation_id`/`reconciliation_adjustment_id`; partial invoicing of one Billing Calculation across more than one invoice remains structurally possible, as locked.
- Resource Registry: no.
- Audit: generic `fn_audit_row('id')`.
- Deletion: rejected via the shared pure-insert-only function.

**`reconciliation_adjustments`**
- Role: Earned-vs-billed adjustment candidate; the one Commercial output most plausibly needing its own approval workflow, tasks, attachments, comments.
- PK: `resource_id` (Resource-backed).
- FKs: `commercial_component_id -> commercial_components(id)`, `supersedes_adjustment_id -> reconciliation_adjustments(resource_id)` (nullable, self-referencing).
- Immutable: every column except the single finalize transition.
- Editable: `status` (`open -> final`, exactly once), `finalized_at`, `finalized_by`.
- `row_version`: no; conditional `WHERE status = 'open'` plus lifecycle trigger.
- CHECK: `direction in ('additional_billing','credit_note')`; `status in ('open','final')`.
- Resource Registry: yes; new `resource_types` row `('reconciliation_adjustment', ...)`; `fn_assert_resource_type('reconciliation_adjustment', 'resource_id')`.
- Audit: generic `fn_audit_row('resource_id')`.
- Deletion: rejected via the dedicated lifecycle trigger.
- No-netting: enforced structurally, not by a constraint: each row is its own `direction`; nothing sums or merges rows, by construction, since no aggregate/materialized column exists to net into.

## 5. Effective dating: what is and is not database-enforced

`commercial_components` and `commercial_commitments` are immutable
effective-dated rows: `effective_from` is required and immutable;
`effective_to` starts `null` and may be set exactly once, enforced by
each table's own lifecycle-protection trigger (rejecting any other
column change, and rejecting a second `effective_to` write once it is
non-null). **Database-enforced**: `effective_from` not null;
`effective_to` nullable, write-once; `effective_from`/`effective_to`
ordering (`effective_to is null or effective_to > effective_from`) as a
plain single-row `CHECK`, which needs no subquery and is safe to enforce
at the database level. **Explicitly not database-enforced, and not
invented here**: preventing two effective-dated rows for the same scope
from having overlapping date ranges. The locked domain document
deliberately allows multiple simultaneous Commercial Components for the
same capability scope (a recurring charge, a separate AMC, a one-time
charge, all effective at once); "overlap" is therefore not a
context-free structural property this schema can validate with a single
`CHECK` or unique index without first knowing which rows are supposed to
be mutually exclusive alternatives versus intentionally coexisting
lines, a business/domain-service judgment, not a safe database
constraint. This is stated explicitly here rather than silently
building an automatic overlap-prevention mechanism the locked design
never asked for.

## 6. Measurement Definition lifecycle trigger design

`fn_protect_measurement_definition_lifecycle()`, `SECURITY INVOKER`,
`BEFORE INSERT OR UPDATE OR DELETE`, following the exact
JSONB-diff-minus-permitted-columns technique already proven by
`fn_protect_customer_lifecycle()`/`fn_protect_capability_lifecycle()`:
`DELETE` always rejected; `UPDATE` core-diff excludes only `name`,
`expected_source`, `status`, `row_version`, `updated_at`, `updated_by`
(every other column, including all semantic fields, remains compared and
therefore immutable); an explicit transition guard rejects
`status: 'deprecated' -> 'active'`. This is not a new pattern; it is the
same shape as `fn_protect_capability_lifecycle()`, kept as its own
dedicated function rather than generalized across the two tables, for
the same reason Migration 7 kept Customer and Capability separate: the
column sets differ, and a shared function would be harder to audit than
two short, obvious ones.

## 7. Generic pure-insert-only immutability function (new, shared)

`fn_reject_update_delete()`, `SECURITY INVOKER`, `BEFORE UPDATE OR
DELETE`, no trigger arguments needed:

```
raise exception '% is append-only: % is not permitted', tg_table_name, tg_op;
```

This has zero table-specific logic, unlike every lifecycle-protection
function above, which is exactly the class of case Nexus's own
established convention (`fn_bump_row_version`, `fn_audit_row`,
`fn_set_updated_at`) already reuses across tables rather than
duplicating. Attached, across all three migrations, to: `usage_facts`,
`billing_calculations`, `invoice_eligibility_events`, `invoice_evidence`,
`invoice_evidence_items`, `commercial_changes`,
`commercial_component_capabilities`, `commercial_commitment_components`,
`earned_result_usage_facts`. Each of these tables has no legitimate
`UPDATE` at all (not even one permitted transition, unlike
`commercial_components`/`commercial_commitments`/`earned_results`/
`reconciliation_adjustments`, which each get their own dedicated
single-transition lifecycle function instead).

## 8. Commitment membership integrity trigger (new)

`fn_protect_commitment_component_membership()`, attached `BEFORE INSERT`
on `commercial_commitment_components` only (the table is otherwise
insert-only and protected by §7's generic function for `UPDATE`/
`DELETE`): looks up the referenced `commercial_commitments.kind` for the
row being inserted; rejects outright if `kind <> 'spend'` (closing the
locked correction's own requirement that a quantity commitment must
never be attachable through this join); for the accepted `spend` case,
verifies the new member's `commercial_components.transaction_currency`
matches every existing member's, rejecting otherwise. No
measurement-definition-compatibility branch exists in this trigger, per
the locked correction (a quantity commitment no longer has more than one
member to compare, since it is attached via a direct FK instead).

## 9. Resource Registry seed rows required

Exactly two new `resource_types` rows, each inserted in the migration
that first needs it, matching Migration 4's `form_version` precedent:
`('commercial_configuration', ...)` in Migration 8;
`('reconciliation_adjustment', ...)` in Migration 10. No other
Commercial table registers.

## 10. Audit strategy summary

Generic `fn_audit_row` on every table except:
`commercial_component_capabilities`, `commercial_commitment_components`,
`earned_result_usage_facts` (pure join tables, intrinsic
`created_at`/`created_by` provenance is the complete history, no audit
trigger needed), and `invoice_eligibility_events` (already an
append-only decision log; auditing an audit-shaped table duplicates
evidence for no benefit). No table in this design needs a narrower,
payload-excluding audit trigger the way `submission_revisions` did;
nothing here combines high-frequency writes with a large free-form
JSONB payload. Every `DELETE`-rejecting table is still attached to
`AFTER ... OR DELETE` on its audit trigger, matching Migration 7's own
reasoning: the rejection happens in a `BEFORE` trigger, so a rejected
`DELETE` never reaches the `AFTER` audit trigger, and this is provable,
not merely assumed.

## 11. RLS and privilege strategy

Identical posture to every existing migration: `ENABLE ROW LEVEL
SECURITY` (never `FORCE`) on all 15 tables, zero policies created;
`REVOKE ALL ON TABLE <all 15> FROM anon, authenticated`; `REVOKE EXECUTE
ON FUNCTION` for every new function in this design (the six
table-specific lifecycle functions, the shared
`fn_reject_update_delete()`, and `fn_protect_commitment_component_membership()`)
`FROM public, anon, authenticated`, in addition to Migration 2's
existing default-privilege baseline, as defense-in-depth, not a
correction. `service_role`/`postgres` privileges are untouched
throughout. No UI-facing policy is authored at this stage; that remains
a distinct, later, not-yet-started concern.

## 12. Concurrency summary

`row_version` exists on exactly two of the 15 tables:
`commercial_configurations` and `measurement_definitions`, per the
locked design's own already-settled decision. Every other table is
either fully insert-only (§7) or protected by a single
conditional-`WHERE`-guarded transition backed by a lifecycle trigger
(`commercial_components`, `commercial_commitments`, `earned_results`,
`reconciliation_adjustments`). No table gets `row_version` merely
because it is mutable in some narrow sense; the closure/finalize
transition tables have exactly one legitimate outcome per edit attempt,
which a version counter would not add anything to.

## 13. Deletion posture summary

No hard delete anywhere in the 15 tables, no `deleted_at` column
anywhere (none is required by the locked design). Every table enforces
this via a trigger, never privilege alone: the six single-transition
tables via their own dedicated lifecycle function; the nine pure
insert-only tables via the shared `fn_reject_update_delete()`. This
matches the standing Nexus principle (already proven for
`customers`/`capabilities`) that a trusted role holding ordinary
`DELETE` privilege must still be blocked by the domain rule itself, not
merely by privilege revocation.

## 14. Break-test design (implementation-grade, not yet executable)

Organized per migration, so each migration's own tests can run
immediately after that migration is applied, without waiting for later
migrations. Expected `SQLSTATE`/zero-row behavior stated explicitly
throughout; `P0001` for every lifecycle/immutability trigger raise
(plain `RAISE EXCEPTION`, no custom `ERRCODE` assigned, matching
Migration 7's own convention), `23505` for `UNIQUE` violations, `23514`
for `CHECK` violations, `42501` for privilege denial.

**Migration 8 (Configuration Foundation), 21 tests**

1. Valid `commercial_configurations` insert succeeds; real FK to `customers(id)` enforced (invalid `customer_id` rejected, `23503`).
2. `commercial_configurations` Resource Registry type integrity: a `resources` row typed anything other than `commercial_configuration` cannot back an insert (`P0001` via `fn_assert_resource_type`).
3. `commercial_configurations.is_active` moves `true -> false` (succeeds); a subsequent `false -> true` attempt on the same row is **rejected** (`P0001`), proving this table's one-way rule is distinct from Customer's reversible rule.
4. `commercial_configurations` identity fields (`id`, `key`, `customer_id`, `commercial_change_id`) immutable (`P0001`).
5. `commercial_configurations` `row_version` increments by exactly 1 per update; a stale-`row_version` conditional `UPDATE` affects zero rows.
6. `commercial_changes` 1:1 with `requests`: a second `commercial_changes` row for the same `request_id` is rejected (`23505`, PK violation).
7. `commercial_changes.change_category` outside the closed set rejected (`23514`).
8. `commercial_changes` immutable in full; any `UPDATE` rejected (`P0001`).
9. `commercial_components` insert succeeds with valid FKs to `commercial_configurations`/`commercial_changes`/`measurement_definitions`.
10. `commercial_components` real FK to `capabilities(id)` via `commercial_component_capabilities` enforced (invalid `capability_id` rejected, `23503`).
11. `commercial_components` effective-date closure: `effective_to` settable exactly once (`null -> date` succeeds; a second attempt to change it, or to change any other column, rejected `P0001`).
12. `commercial_components.pricing_rule_parameters` shape check rejects a payload missing the keys required for its declared `pricing_rule_kind` (`23514`).
13. `commercial_components` `DELETE` rejected (`P0001`), including as `service_role`.
14. Two `commercial_components` rows for the identical capability scope, both effective, both succeed (no uniqueness rule prevents this, as locked).
15. `measurement_definitions` semantic fields (`key`, `unit`, `business_definition`, `counting_rule`, `period_basis`, `dimension_keys`) immutable (`P0001`); `name`/`expected_source` remain editable.
16. `measurement_definitions.status` moves `active -> deprecated` (succeeds); `deprecated -> active` rejected (`P0001`).
17. `measurement_definitions` stale `row_version` update affects zero rows.
18. `commercial_commitments` with `kind = 'quantity'` requires `commercial_component_id not null` and `period = 'monthly'`; violating either rejected (`23514`).
19. `commercial_commitments` with `kind = 'spend'` requires `currency not null` and `commercial_component_id null`; violating either rejected (`23514`).
20. `commercial_commitment_components`: attempting to attach a `kind = 'quantity'` commitment through this join is rejected (`P0001`, the new membership-integrity trigger, §8).
21. `commercial_commitment_components`: attaching a second `spend` member with a different `transaction_currency` than the first is rejected (`P0001`); attaching one with the same currency succeeds.

**Migration 9 (Usage and Earned), 8 tests**

22. `usage_facts` insert succeeds, scoped by `commercial_configuration_id`; two Configurations for one customer produce independent, non-colliding Usage Fact histories for the same `measurement_definition_id`.
23. `usage_facts` immutable in full; any `UPDATE` rejected (`P0001`), including as `service_role`.
24. `usage_facts` correction represented as a new row via `supersedes_usage_fact_id`; the original row remains unchanged and queryable.
25. `usage_facts.origin = 'finance_override'` requires `override_reason`/`override_approved_by` populated; omitting either rejected (`23514`).
26. `earned_results` plain, unconditional `UNIQUE (commercial_component_id, period_start, period_end)`: a second insert for the same Component and period is rejected (`23505`) regardless of the existing row's `status`.
27. `earned_results.status` moves `open -> final` (succeeds); `final -> open` rejected (`P0001`).
28. `earned_results` has no recalculation path: an `UPDATE` attempting to change any substantive field (`calculated_quantity`, `calculated_amount`, etc.) on an existing row, whether `open` or `final`, is rejected (`P0001`) by the lifecycle trigger, proving recalculation is unsupported by this schema, not merely untested.
29. `earned_result_usage_facts` join succeeds for multiple Usage Facts feeding one Earned result; the join row itself is immutable (`P0001` on `UPDATE`/`DELETE`).

**Migration 10 (Billing, Invoice, Reconciliation), 12 tests**

30. `billing_calculations` with `billing_quantity_basis_used = 'previous_period_actual'` requires `source_earned_result_id not null` and `source_commercial_commitment_id null`; violating either rejected (`23514`).
31. `billing_calculations` with `billing_quantity_basis_used = 'mug'` requires `source_commercial_commitment_id not null` and `source_earned_result_id null`; violating either rejected (`23514`).
32. `billing_calculations` with `billing_quantity_basis_used = 'fixed'` requires both source columns `null`; either populated rejected (`23514`).
33. `billing_calculations` immutable in full; `DELETE` rejected (`P0001`).
34. `invoice_eligibility_events` append-only: two events for the same `billing_calculation_id` both persist; the "current" eligibility read is the latest by `decided_at`, never a maintained column.
35. `invoice_evidence_items` requires exactly one of `billing_calculation_id`/`reconciliation_adjustment_id`; both populated or both null rejected (`23514`).
36. `invoice_evidence_items` allows the same `billing_calculation_id` to be referenced by two different `invoice_evidence` headers (partial invoicing remains structurally possible, no uniqueness prevents it).
37. `reconciliation_adjustments` Resource Registry type integrity, mirroring test 2.
38. `reconciliation_adjustments.status` moves `open -> final` (succeeds); `final -> open` rejected (`P0001`).
39. `reconciliation_adjustments`: one component's positive and negative adjustments in the same window both persist as separate rows, never netted (no aggregate column exists to net into).
40. `reconciliation_adjustments` `DELETE` rejected (`P0001`), including as `service_role`.
41. Cross-migration: a `billing_calculations.source_earned_result_id` pointing at an Earned result from Migration 9 resolves correctly; an invalid reference is rejected (`23503`).

**Cross-cutting, all three migrations**

42. Audit positive paths: every successful `INSERT` and (where applicable) lifecycle-transition `UPDATE` across all 15 tables produces exactly one corresponding `audit_log` row with `table_name`/`row_id`/`action` matching.
43. Audit-negative paths: every rejected mutation above (identity-field changes, invalid transitions, `DELETE` attempts) produces **no** new `audit_log` row for that attempt, using the `SAVEPOINT`/`ROLLBACK TO SAVEPOINT` harness proven in Migration 7.
44. RLS enabled, not forced, zero policies, on all 15 tables.
45. `anon`/`authenticated` denied `SELECT`/`INSERT`/`UPDATE`/`DELETE` on all 15 tables (`42501`), with role-switch success verified before scoring, per Migration 7's corrected harness pattern.
46. `service_role`/`postgres` (connected role) trusted-path coverage: `SELECT`/`INSERT` succeed where the locked matrix expects `PASS`; `DELETE` still rejected by the domain trigger for every table, never merely by privilege.
47. No forbidden Resource Registry participation: `resource_types`/`resources` contain no unexpected rows for any of the 13 non-Resource-backed Commercial tables.
48. Zero persistent test residue in all 15 tables and `audit_log` after the full pass, verified last, via transaction rollback throughout (no cleanup `DELETE`).

## 15. Migration safety checklist (carried forward from Master Data)

Local migration files are canonical; review precedes apply; the exact
Supabase CLI version in use is confirmed immediately before any
atomicity or apply step (unpinned in this repository, resolved via
`npx` each time); a fresh `db push --dry-run` is required before each of
the three real applies, confirming it plans exactly that migration and
nothing else; no broad `IF NOT EXISTS`; no `CREATE OR REPLACE`
concealment; no constraint weakened merely to make a break test pass; no
cleanup `DELETE` for failed runtime fixtures; every break test
transaction-rollback-bound with `SAVEPOINT` for expected failures;
remote application only after design review and SQL review are both
complete for that migration. Atomicity is not re-assumed from Migration
7's proof; if the controlling Supabase CLI version has changed since
2.117.0, re-verification against the exact new version is required
before Migration 8 is ever applied, following the identical empirical
procedure already documented and executed once.

## 16. Overdesign self-check

**Deliberately not added**: any Entitlement table or ledger; any Wallet/
prepaid-balance table; package/block pricing as a rule kind; an FX
projection table; a materialized Unbilled table; a cross-component
Reconciliation comparison structure; a combined-commitment allocation
column or policy of any kind (the direct-FK correction removes the need
entirely); `deleted_at` on any table; `row_version` on any table beyond
the two the locked design names; a narrower audit trigger anywhere (no
table here combines high-frequency writes with a large free-form JSONB
payload the way `submission_revisions` did); any RLS policy; any new
generic immutability framework beyond the one genuinely-zero-logic
shared function (§7).

**Belongs in a future application/domain-service layer, not this
migration**: the actual Pricing Kernel calculation logic; Invoice
Eligibility decision rules; deeper `pricing_rule_parameters`/
`dimensions` JSON Schema validation; component effective-date overlap
judgment (§5); duplicate-Configuration-key formatting conventions. The
atomic Commercial Configuration + Change creation RPC and the
Reconciliation Adjustment creation RPC are **not** deferred; their
creation contract is locked in §3a of this document, following the
same pattern already proven for Form Version and Request creation. Only
the exact PL/pgSQL body text of those two functions remains
SQL-authoring detail (§18).

**What future automation can replace without changing Commercial
truth**: `usage_facts.source_type` already includes `internal_tool` and
`external_feed` alongside `manual_entry`/`file_import`; a future
metering integration populates rows through the identical schema, no
column change required, exactly as already proven true for
`customers`/`capabilities` accepting a future automated resolver without
schema change.

**Why this remains scale-ready without becoming scale-heavy**: the
three-migration split protects the one thing genuinely expensive to
retrofit later, an independently-verifiable boundary between commercial
terms, derived facts, and settlement evidence, while adding nothing a
current requirement does not already call for: no event bus, no
metering pipeline, no rules engine, no vendor entitlement/billing
product, matching the locked technology evaluation's build-first,
manual-usage-first conclusion exactly.

## 17. Open business questions

None. Every ambiguity considered while authoring this document was
checked against `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` and
`docs/COMMERCIAL_DATABASE_DESIGN.md` first; each was already resolved
there (most directly, the combined-MUG allocation question, already
closed by the locked quantity-MUG-is-a-direct-FK correction, §3 of this
document).

## 18. Open technical questions

Both items raised by the prior revision are now resolved into settled
postures (§4, §0a), not left as open questions: `earned_results`
recalculation (resolved: not supported by the current locked schema;
plain unique constraint, no partial predicate, no invented column) and
`measurement_definitions` deprecated-reference behavior (resolved: FK
integrity only, no DB rejection, application/domain-service selects
appropriately). Neither requires a decision before any of the three
migrations' SQL is authored.

Genuinely deferred, non-blocking implementation detail only: exact
PL/pgSQL body text for the nine functions named in §3a and §6-§8 (this
document settles *what* each must guarantee and *why*, not the SQL);
the exact regenerated migration filenames and timestamps at the moment
each of the three files is actually authored; if Finance later wants a
supported Earned recalculation path, that is a future, separate
database design decision (§4), not a gap in this document.

## 18a. Blocking classification of every remaining question

**Migration 8 SQL: zero blockers.** Every table, FK, CHECK, uniqueness
rule, trigger, and lifecycle function needed for
`commercial_configurations`, `commercial_changes`, `commercial_components`,
`commercial_component_capabilities`, `measurement_definitions`,
`commercial_commitments`, `commercial_commitment_components` is settled,
including the circular-FK resolution (§3a, §19) and the
deprecated-reference posture (§4).

**Migration 9 SQL: zero blockers.** `usage_facts`, `earned_results`,
`earned_result_usage_facts` are fully settled, including the corrected
plain `earned_results` uniqueness contract (§4) and the Usage Fact
eligibility posture (DB permits, domain service selects; §4).

**Migration 10 SQL: zero blockers.** `billing_calculations`,
`invoice_eligibility_events`, `invoice_evidence`, `invoice_evidence_items`,
`reconciliation_adjustments` are fully settled, including the
`reconciliation_adjustments` atomic creation contract (§3a).

**Future / non-blocking**: exact PL/pgSQL function bodies; exact
migration filenames/timestamps; a future Earned recalculation design
(only if Finance later requires one, a new decision against
`COMMERCIAL_DATABASE_DESIGN.md`, not an implementation detail of this
document); a future, stronger Measurement Definition deprecated-reference
enforcement (only if Finance later requires one, same standard).

## 19. Migration 8 internal creation order

Dependency-safe order within Migration 8, made explicit to surface any
circular-FK problem before SQL authoring (one was found and resolved,
§3a):

1. `resource_types` seed row (`'commercial_configuration'`).
2. Functions and triggers first: `fn_protect_measurement_definition_lifecycle()`,
   `fn_reject_update_delete()`, `fn_protect_commitment_component_membership()`,
   `create_commercial_configuration_with_change()`
   (`create_reconciliation_adjustment()` belongs to Migration 10, not
   this one). Functions must exist before the triggers that call them,
   and triggers must exist before any table they protect can safely
   accept writes; creating them before any table's own
   privilege-hardening step keeps the migration file's internal order
   matching Migrations 4-7's own convention (function, then table, then
   trigger attach, then privilege hardening, per table).
3. `measurement_definitions` (no dependency on any other new table in
   this migration).
4. `commercial_changes` and `commercial_configurations` together, in
   the order required by the deferred-constraint resolution in §3a:
   the table DDL for both must exist before either is ever inserted
   into, but the DDL creation order between them is free (DDL creation
   is not itself constrained by the deferred-FK timing, only row
   insertion order is); this document creates `commercial_changes`
   first, matching the row-insertion order chosen in §3a, so the two
   stay visually adjacent in the migration file.
5. `commercial_components` (depends on `commercial_configurations`,
   `commercial_changes`, `measurement_definitions`, and the real FK to
   `capabilities` via the join table created next).
6. `commercial_component_capabilities` (depends on `commercial_components`,
   `capabilities`).
7. `commercial_commitments` (depends on `commercial_changes`,
   `commercial_components`).
8. `commercial_commitment_components` (depends on `commercial_commitments`,
   `commercial_components`).
9. Privilege hardening (`REVOKE`) and `ENABLE ROW LEVEL SECURITY` last,
   across all seven tables and all new functions, matching every prior
   migration's own closing section.

No table in this order references a table created later in the same
list; the only circular dependency in the entire Commercial Foundation
design is the one identified and resolved in §3a.

## 20. Migration 10 resource-type ordering

`reconciliation_adjustments` has no circular dependency (§3a), so its
ordering is the ordinary, already-proven pattern: the
`resource_types` seed row (`'reconciliation_adjustment'`) is inserted
before `create_reconciliation_adjustment()` is defined, which is
defined before `reconciliation_adjustments`' own
`fn_assert_resource_type` trigger is attached, which is attached before
privilege hardening closes the migration, identical in shape to
Migration 8's `commercial_configuration` seeding and Migration 4's
`form_version` precedent. `billing_calculations`, `invoice_eligibility_events`,
`invoice_evidence`, and `invoice_evidence_items` carry no Resource
Registry participation and are unaffected by this ordering; they are
created in any order consistent with their own FK dependencies
(`billing_calculations` before `invoice_eligibility_events`;
`invoice_evidence` before `invoice_evidence_items`, which also depends
on `billing_calculations` and `reconciliation_adjustments` already
existing).

## 21. What this document is not

Not a migration file. Not executable SQL. Not a redesign of any locked
Commercial business or database decision. Not a decision on Pricing
Kernel calculation logic, Entitlement, Wallet, Invoicing orchestration,
or Flowable. Migration 8's shape above has since been translated into
SQL and applied
(`supabase/migrations/20260908210000_commercial_configuration_foundation.sql`,
execution evidence in §23); Migrations 9 and 10 remain future, separate,
not-yet-authored migration files to translate the remaining shapes above
into SQL, following the exact patterns already proven in Migrations 1
through 8.

## 22. Principal architect recommendation

**COMMERCIAL FOUNDATION MIGRATION DESIGN LOCKED.** The internal
contradiction found by the second review (§0a: a disclosed-non-locked
`earned_results` supersession column coexisting with a uniqueness
contract that presupposed it) was resolved by OPTION B, strictly from
the locked sources: no Earned supersession/recalculation mechanism is
locked anywhere, the invented column was removed, and the uniqueness
contract is a plain, unconditional `UNIQUE (commercial_component_id,
period_start, period_end)` using only fields the locked schema actually
has, with the resulting "no recalculation is possible under this
schema" consequence stated openly. The two previously-vague open
questions (Measurement Definition deprecated-reference behavior; Usage
Fact supersession eligibility for new Earned calculations) are settled,
unambiguous postures (§4), not open items an SQL author would have to
resolve mid-authoring. The atomic creation contract for both
Resource-backed entities (§3a) is complete against all ten required
elements, and the single circular foreign-key dependency
(`commercial_changes.commercial_configuration_id`, deferred; insert
order `commercial_changes` then `commercial_configurations`) is
confirmed genuinely necessary and not over-broadened to both
directions. §18a classifies every remaining question: **zero blockers
for Migration 8, 9, or 10 SQL**; only future, non-blocking items
remain, each requiring its own explicit future business/design decision
rather than an invention in this document. The 15-table inventory, the
three-migration sequencing, Resource Registry participation, and every
other locked business rule are unchanged. This document's top banner
now reads **STATUS: LOCKED**, matching `docs/COMMERCIAL_DATABASE_DESIGN.md`
and `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`.

**COMMERCIAL FOUNDATION MIGRATION DESIGN LOCKED.**

## 23. Migration 8 closeout record

**Commercial Configuration Foundation status: COMPLETE.** This section
records only Migration 8's own execution. Migrations 9 and 10 remain
separate, not-yet-started stages against the same locked design (§0-18a);
nothing in this section marks the Commercial Foundation as a whole
complete.

**Migration applied**:
`supabase/migrations/20260908210000_commercial_configuration_foundation.sql`
(commit `0dff254`, "Add Commercial Configuration foundation").

**Migration history alignment**: local migration version
`20260908210000` matches the remote version recorded after apply;
GitHub (`origin/main`) is aligned with the applied state. Applied using
`npx supabase@2.117.0 db push`. The preceding `db push --dry-run`
planned exactly `20260908210000_commercial_configuration_foundation.sql`
and no other migration.

**Runtime gate**: **24/24 PASS, 0 FAIL, 0 BLOCKED.** Tests 1-21 are the
locked Commercial Configuration Foundation break-test baseline (§14);
the locked design baseline remains 21 tests, unchanged by execution.
Tests 22-24 are additional RPC privilege-hardening tests accepted after
principal review, strengthening verification without changing the
locked business design:

- **22.** `service_role` successfully executes
  `create_commercial_configuration_with_change(...)`.
- **23.** `anon` direct `EXECUTE` denied, `SQLSTATE 42501`.
- **24.** `authenticated` direct `EXECUTE` denied, `SQLSTATE 42501`.

**DIAGNOSTIC A1 (deferred FK verification): PASS.** The circular foreign
key `commercial_changes.commercial_configuration_id ->
commercial_configurations(id)` is `DEFERRABLE INITIALLY DEFERRED`.
Because the runtime suite is rollback-bound (no `COMMIT` anywhere in the
harness), commit-time behavior was verified safely, in-transaction, by
forcing `SET CONSTRAINTS ALL IMMEDIATE`: a valid atomic graph resolved
successfully, and a deliberately invalid deferred reference rejected
with `SQLSTATE 23503`, with no permanent test rows required. This is
in-transaction forced deferred-constraint verification, not an actual
`COMMIT` test.

**DIAGNOSTIC C1 (concurrency posture): NOT EXECUTED as a live
two-session test.** The minimum-spend currency race this migration fixes
was already closed by taking a `FOR UPDATE` lock on the parent
`commercial_commitments` row. Release evidence is Test 21's sequential
invariant verification plus principal static proof that the row lock
serializes concurrent inserts. This is not a Migration 8 blocker. A
genuine two-session concurrency regression test remains a future,
non-blocking opportunity if this trigger is ever modified.

**RLS diagnostic: PASS.** All 7 Migration 8 tables verified at runtime:
RLS enabled, `FORCE RLS` false, zero policies.

**Residue evidence: ZERO.** The final successful 24/24 runtime
transaction executed `ROLLBACK`. The integrated `run.sh` runner then
hung at its second, interactive password/residue stage; the stuck Docker
residue process was terminated locally. A separate, independent manual
Dockerized `psql` connection then executed
`.runtime-tests/002_residue_check.sql` directly and returned
`residue_row_count = 0`. `run.sh` did not itself complete the residue
stage for this final run; the zero-residue evidence comes from that
independent post-rollback connection using the same residue SQL.

**Harness-failure history.** Two harness defects were discovered during
live verification and corrected before the final successful gate, both
in `.runtime-tests/` (disposable, untracked, never part of the
migration), neither a production/migration defect:

- A PL/pgSQL composite multi-target `INTO` error.
- Test 22 initially evaluated a harness fixture lookup while already
  under `service_role`, causing `permission denied for table
  rt_fixture`.

Each failed run was followed by an independent residue check that
returned `residue_row_count = 0`. The final corrected run achieved
24/24.

**Final defect status**: P0 outstanding: 0. P1 outstanding: 0. P2
outstanding: 0.

**Accepted P3 observations (non-blocking, not reopened)**:

1. The deferred FK uses PostgreSQL's default `NO ACTION` rather than an
   explicit `ON DELETE` clause, because of the `DEFERRABLE` constraint
   posture and because Commercial Configuration deletion is already
   prohibited.
2. Reciprocal Commercial Change / initial Commercial Configuration
   pairing is correct-by-construction through the atomic RPC rather than
   fully schema-constrained, matching the locked trust boundary (§3a).

**Platform Core hardening follow-up (next step, before Migration 9
begins).** Before Migration 9 starts, Nexus must perform a retrospective
Foundation Regression & Hardening Review of earlier migrations, bringing
them up to the verification standard Migration 8 established. Special
focus on Migrations 1-3, which predate the mature runtime-gate standard;
Migrations 4-7 also need review for any remaining gap against the
current standard, rather than assuming prior testing is equivalent. The
review should cover: callable RPC `EXECUTE` privilege matrix; explicit
`service_role` trusted-path grants; `anon`/`authenticated` denials;
Resource-backed identity integrity; atomic creation behavior; RLS /
zero-policy posture; function `EXECUTE` leakage; `SECURITY INVOKER`/
`SECURITY DEFINER` posture; immutable-history protection; important
concurrency assumptions; rollback / zero-residue runtime verification;
and current remote database state against the intended repository
contract. Any correction found must be implemented through new, forward
migration(s); historical Migrations 1-8 are never edited. Already
observed, and specifically retained for that review rather than fixed
here: `create_form_version`, `publish_form_version`,
`create_request_with_draft`, `submit_revision`, and `create_next_revision`
appear to rely on environment-level `service_role` `EXECUTE`
provisioning rather than a repository-explicit `GRANT`, unlike Migration
8's own `create_commercial_configuration_with_change`, which grants
`EXECUTE` to `service_role` explicitly. No migration numbers are
assigned yet for this review.

**Update: that specific five-RPC finding is now closed.** It was
addressed by the separate forward migration
`supabase/migrations/20260909080000_foundation_rpc_privilege_hardening.sql`,
runtime-verified 20/20 with zero residue rows. See
`docs/FOUNDATION_RPC_PRIVILEGE_HARDENING_DESIGN.md` §21. This closes only
that one finding: the wider retrospective Foundation Regression and
Hardening Review described in this paragraph is still outstanding, and
Migration 9 remains blocked until it closes.

No further gate remains open for the Commercial Configuration
Foundation. Migrations 9 (Usage and Earned) and 10 (Billing, Invoice,
Reconciliation) remain the next, separate, not-yet-started stages
against this same locked design.
