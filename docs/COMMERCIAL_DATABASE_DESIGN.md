# Nexus: Commercial Database Design

**COMMERCIAL DATABASE DESIGN. DESIGN ONLY. NO MIGRATION YET. NO
IMPLEMENTATION YET.**

**STATUS: LOCKED.**

This document translates the locked `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`
and `docs/COMMERCIAL_TECH_EVALUATION.md` into a logical PostgreSQL/
Supabase database design. Two prior passes preceded this lock: an initial
draft, and a principal-database-architect sanity review that resolved ten
issues and reported one (combined-commitment shortfall allocation) as a
genuine open business question. Finance has since corrected the
underlying business rule: a quantity minimum-usage-guarantee (MUG) was
never actually able to span multiple Commercial Components; it applies
to exactly one Component, which may itself cover several capabilities
priced together. This removes the open business question entirely,
rather than answering it, since the scenario that required an allocation
policy is not a valid Nexus business scenario. §8a of this document
(previously "BUSINESS INPUT REQUIRED") is removed, not replaced with an
allocation policy. No contradiction was found between this design and
either locked source document; neither source document is modified. It
does not create a migration, execute SQL against Supabase, write
application code, or start implementation. Every example is generic and
fictional; no real Nexus customer, contract, or negotiated price appears
anywhere in this document.

## 0. What changed in this revision, and why

1. **Usage Fact scope** moved from `customer_id` to
   `commercial_configuration_id` (§5.7). A customer with multiple
   Commercial Configurations could otherwise have two unrelated
   commercial relationships silently sharing one ambiguous usage number.
2. **Invoice evidence** redesigned from a single row with two
   mutually-exclusive nullable FKs into a header (`invoice_evidence`)
   plus an allocation join table (`invoice_evidence_items`, new, §5.12,
   §5.12a), so one real invoice can reference many Billing Calculations
   and Reconciliation Adjustments.
3. **Commercial Change type** narrowed from a term-specific enum
   (`rate_change`, `mug_change`, ...) to a business-event category
   (`change_category`: `initial_setup`, `renewal`, `amendment`,
   `correction`, `other`, §5.14), since one Commercial Change can contain
   several simultaneous term changes and a single scalar cannot honestly
   describe that.
4. **Initial commercial setup** is now also required to flow through one
   Commercial Change (`change_category = 'initial_setup'`), and
   `commercial_configurations` gains a `commercial_change_id` for uniform
   provenance (§5.1, §5.14).
5. **Combined-commitment shortfall allocation** was found, in this first
   revision, to be a genuine open business question, not decided by this
   document (§8a). **Superseded: see §0a. Finance has since corrected the
   underlying business rule, which removes this question entirely rather
   than answering it.**
6. **Billing Calculation provenance** gains explicit source references
   (`source_earned_result_id`, `source_commercial_commitment_id`) so a
   billed quantity can always be traced to the exact Earned result or
   Commitment that produced it, not only a copied number (§5.10).
7. **Join-table provenance**: `commercial_component_capabilities` and
   `commercial_commitment_components` gain their own `created_at`/
   `created_by` columns; membership facts are financially material and
   are not otherwise recorded anywhere (§5.3, §5.6, §7).
8. **Measurement Definition immutability**: semantic fields
   (`key`, `business_definition`, `counting_rule`, `period_basis`,
   `dimension_keys`, `unit`) are now immutable from creation; only
   `name` and `expected_source` are cosmetically editable, and `status`
   is deprecate-only. A semantic change means creating a new Measurement
   Definition, never editing one in place (§5.4).
9. **Concurrency**: `commercial_configurations` and
   `measurement_definitions` gain `row_version`, since both have genuine
   editable metadata with more than one legitimate outcome per edit,
   unlike every other table in this schema (§9).
10. **Customer / Capability Master sequencing**: this document states,
    without designing it, what minimal master data must exist before a
    Commercial migration can safely add real foreign keys (§23).
11. **Resource-backing removed from `commercial_components`**: the
    Commercial Change (which is the Request) already provides the
    approval trail, comments, and task/workflow anchor; the component is
    an immutable output fact, not an independently actioned object,
    matching Submission Revision's own precedent relative to Request
    (§5.2, §8).
12. **Pricing Kernel implementation version separated from commercial
    terms**: `pricing_calculation_version` and `rounding_policy_version`
    are removed from `commercial_components` (a commercial term does not
    change merely because the Kernel got a bug fix) and now live only on
    `earned_results` and `billing_calculations`, captured fresh at
    calculation time (§5.2, §5.8, §5.10, §11).

## 0a. Revision 2: quantity-MUG scope correction, and the resulting lock

Finance corrected the business rule behind item 5 above. The earlier
belief that a quantity MUG could span multiple Commercial Components was
wrong: SFA and DMS sharing one rate and one combined MUG are not two
Components needing a shortfall allocated between them, they are **one**
Commercial Component (Scope = {SFA, DMS}) with one quantity MUG. This
revision:

1. Removes §8a (combined-commitment shortfall allocation,
   BUSINESS INPUT REQUIRED) entirely. No allocation-policy column, no
   allocation record, and no replacement policy of any kind is added;
   the problem does not exist once the commercial granularity is
   correct.
2. Adds `commercial_commitments.commercial_component_id`, a direct
   foreign key populated only for `kind = 'quantity'`, so a quantity MUG
   resolves to exactly one Component without any join table (§5.5).
3. Narrows `commercial_commitment_components` to minimum **spend**
   commitments only, the one commitment kind Finance did not restrict
   this pass; a trigger rejects any attempt to attach a quantity
   commitment through this join (§5.6).
4. Narrows the commitment-compatibility trigger to a currency-only check
   across a spend commitment's member components; the
   measurement-definition-compatibility branch is removed, since a
   quantity commitment no longer has more than one member to compare
   (§5.6).
5. Strengthens, rather than changes, the existing one-Earned-row-per-
   Component-per-period decision: there was never a real need for an
   allocation layer in Earned, and this revision confirms none exists
   (§5.8).
6. Re-run break tests (§19) all pass under the corrected model; no other
   locked business requirement was lost.

With this correction, no open business question remains against this
design. **COMMERCIAL DATABASE DESIGN: LOCKED.**

## 1. Design goals

Unchanged from the first pass: the smallest schema that preserves every
locked business meaning from `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`,
resolves its named database design questions deliberately, and remains
extensible for deferred future concepts (Wallet, Entitlement Ledger,
Invoicing, Flowable) without schema surgery. This revision adds one more
goal made explicit by the review: **do not let a database design
convenience silently answer a question only Finance can answer.**

## 2. Design principles applied

Nexus-owned contracts; historical reproducibility and append-oriented
Finance history; explicit provenance on every calculated or corrected
fact; effective dating wherever commercial terms change over time;
optimistic concurrency only where genuine simultaneous-edit risk exists,
now correctly applied where that risk is real (§9), not skipped by
habit; immutable finalized Finance evidence; generic platform
infrastructure reused rather than duplicated; Resource Registry
participation only where a genuinely independent, actionable identity is
needed, re-examined this pass and narrowed for Commercial Component
(§5.2); no table created merely because the domain document named a
noun; no duplicated derivable state (the reason `usage_facts.customer_id`
is removed, not kept alongside the new scope column, §5.7); no premature
scale infrastructure; manual-first usage capture, automation-ready
later; a database design finding that surfaces a genuine open business
question is reported, not silently resolved (§8a); public-safe,
fictional examples only; no em dashes.

## 3. Table inventory (revised)

| Table | Purpose | Resource-backed | Mutable | Lifecycle |
|---|---|---|---|---|
| `commercial_configurations` | Stable anchor for one coherent commercial relationship | Yes | Metadata, row-version-protected; `is_active` one-way | Active, then inactive |
| `commercial_components` | The effective-dated unit carrying commercial terms | No (revised) | No (one controlled closure transition) | Effective, then superseded/ended |
| `commercial_component_capabilities` | Many-to-many: component to canonical capability | No | Insert-only, with intrinsic provenance | Permanent once created |
| `measurement_definitions` | Canonical business meaning of a countable quantity | No | Cosmetic metadata, row-version-protected; semantic fields immutable | Active, then deprecated |
| `commercial_commitments` | A minimum quantity commitment (exactly one Component, direct FK) or minimum spend commitment (one or many Components) | No | No (one controlled closure transition) | Effective, then superseded/ended |
| `commercial_commitment_components` | Many-to-many, spend commitments only: commitment to the component(s) it applies to | No | Insert-only, with intrinsic provenance | Permanent once created |
| `usage_facts` | What Finance actually relied upon, scoped per Commercial Configuration, append-only | No | No (insert-only, corrections are new rows) | Permanent |
| `earned_results` | Replayable commercial calculation result | No | No (insert-only; one finalize transition) | Open, then final |
| `earned_result_usage_facts` | Many-to-many: Earned result to the Usage Fact(s) that fed it | No | Insert-only | Permanent |
| `billing_calculations` | What should mathematically be billed for a cycle, with traceable source | No | No (insert-only) | Permanent once created |
| `invoice_eligibility_events` | Immutable eligibility decision events | No | No (insert-only) | Permanent |
| `invoice_evidence` | Header reference to an actual invoice or credit note | No | No (insert-only) | Permanent |
| `invoice_evidence_items` | New: allocation of one invoice/credit-note to one or more Billing Calculations or Reconciliation Adjustments | No | No (insert-only) | Permanent |
| `reconciliation_adjustments` | Earned-vs-billed adjustment candidate | Yes | No (one finalize transition) | Open, then final |
| `commercial_changes` | Commercial-specific meaning of one approved Commercial Change, any category including initial setup | No | No (populated once, at approval) | Permanent once populated |

Fifteen tables (one more than the first pass: `invoice_evidence_items`).
No table for Unbilled (derived, §16), no table for Wallet or Entitlement
Ledger (deferred), no separate Pricing Rule, Billing Policy, or
Reconciliation Policy table (embedded as columns). No allocation table or
column exists for a combined-commitment shortfall: the corrected business
rule (quantity MUG applies to exactly one Component, §5.5) means no such
mechanism is needed (§8a).

## 4. Relationship map (revised)

```
resources (existing)
  |-- commercial_configurations.id = resource_id (resource_type = 'commercial_configuration')
  `-- reconciliation_adjustments.resource_id (resource_type = 'reconciliation_adjustment')

requests (existing, Migration 5)
  `-- commercial_changes.request_id = requests.id (1:1 extension)

commercial_changes
  |-- commercial_configurations.commercial_change_id (creation provenance;
  |     for change_category = 'initial_setup' the configuration and the
  |     change are created together, atomically, in one transaction)
  `-- commercial_components.commercial_change_id (every version of every
        component traces back to the change that produced it)

commercial_configurations
  `-- commercial_components (many, effective-dated, plain uuid id, not
        resource-backed)
        |-- commercial_component_capabilities --> capability master (future, referenced only)
        |-- commercial_commitments.commercial_component_id (direct FK,
        |     quantity commitments only: exactly one Component)
        `-- commercial_commitment_components --> commercial_commitments
              (many-to-many, spend commitments only)

measurement_definitions
  |-- commercial_components.measurement_definition_id
  `-- usage_facts.measurement_definition_id

commercial_configurations
  `-- usage_facts.commercial_configuration_id (the scoping FK; customer
        is derived by joining through the Configuration, never stored
        redundantly on the Usage Fact itself)

usage_facts (self-referencing supersession chain)
  `-- earned_results (via earned_result_usage_facts join)

earned_results
  |-- billing_calculations.source_earned_result_id (nullable; populated
  |     when billing_quantity_basis_used = 'previous_period_actual')
  `-- reconciliation_adjustments (references both Earned and Billed, per
        component and window)

commercial_commitments
  `-- billing_calculations.source_commercial_commitment_id (nullable;
        populated when billing_quantity_basis_used = 'mug')

billing_calculations
  |-- invoice_eligibility_events (append-only decision log)
  `-- invoice_evidence_items.billing_calculation_id (nullable FK)

reconciliation_adjustments
  `-- invoice_evidence_items.reconciliation_adjustment_id (nullable FK)

invoice_evidence (header: external reference, date, amount, currency, source)
  `-- invoice_evidence_items (one or many per header; each references
        exactly one of billing_calculation_id / reconciliation_adjustment_id,
        with its own allocated_amount)
```

## 5. Per-table design

### 5.1 `commercial_configurations` (revised)

**Resource-backed: yes**, unchanged reasoning: attachments, comments, API
identity, and scoped authorization naturally scope to the whole
commercial relationship.

Fields: `id` (= resource_id), `customer_id` (future canonical Customer
identity, external dependency, §23), `key` (stable, immutable), `name`
(editable display label), `relationship_note` (text, optional, editable),
`is_active` (boolean, one-way true-to-false), **`commercial_change_id`**
(new, FK to `commercial_changes.request_id`, `NOT NULL`, immutable once
set), **`row_version`** (new, §9), standard columns.

**Why `commercial_change_id` is required, not optional**: the review
asked how the very first Commercial Configuration and its first
Components are created. The answer chosen here is that initial setup is
itself one Commercial Change (`change_category = 'initial_setup'`,
§5.14), so every Configuration, like every Component, has a uniform
provenance trail back to the approved change that created it; there is
no privileged "created outside any Change" path. This requires the
Configuration row and its creating `commercial_changes` row to be
inserted together, in one transaction, at approval time (an RPC-level
concern, already anticipated in §21 for the analogous Component case,
not a new implementation problem this revision introduces).

**Uniqueness question**: unchanged from the first pass; no forced
uniqueness across legal entity, geography, or contract; only `key` is
unique and immutable.

### 5.2 `commercial_components` (revised)

**Resource-backed: no.** This reverses the first pass. On review, the
stated justification (an approval trail, comments, task/workflow
reference, scoped authorization) is already fully provided by the
Commercial Change that produced the component, which is a Request and
therefore already resource-backed, already carries comments, tasks, and
workflow, and already carries scoped authorization. A Commercial
Component is never independently approved, commented on, or actioned
after it is created; it is an immutable output fact of its Commercial
Change, exactly the same relationship Submission Revision already has to
Request (Submission Revision is not resource-backed; Request is).
Resource-backing every version of every charge line would mean minting
one Resource Registry entry per effective-dated row, with no
corresponding independent action ever taken against most of them; the
cost (a `resources` row and a resource-type-integrity trigger per
version) is not justified by any real benefit. `id` is now a plain
`uuid` primary key, not `resource_id`.

Granularity and effective-dating decisions are unchanged from the first
pass (one component equals one charge line; immutable rows with
`effective_from`/`effective_to` and one controlled closure transition).

Fields: `id` (PK, plain uuid), `commercial_configuration_id` (FK, never
changes), `commercial_change_id` (FK to `commercial_changes.request_id`,
never changes), `supersedes_component_id` (nullable, self-referencing),
`is_recurring` (boolean), scope via `commercial_component_capabilities`
(§5.3), `measurement_definition_id` (nullable), `pricing_rule_kind`
(check constrained), `pricing_rule_parameters` (jsonb, §6),
`billing_cadence`, `billing_timing`, `billing_quantity_basis`,
`reconciliation_cadence`, `transaction_currency`, `effective_from`,
`effective_to`, standard columns.

**Removed in this revision**: `pricing_calculation_version` and
`rounding_policy_version`. These described which Pricing Kernel
implementation build rated a calculation, which is a fact about a
specific Earned or Billing Calculation run, not a fact about the
commercial term itself; keeping them here would have forced a new
Component version merely because the Kernel received a bug fix, which
the review correctly identified as wrong. See §11 for where they now
live.

### 5.3 `commercial_component_capabilities` (revised)

Many-to-many join: `(component_id, capability_id)`, both parts of a
composite primary key (`component_id` renamed from
`component_resource_id` to match §5.2). `capability_id` references the
future canonical Capability/Workflow Master (§23). Insert-only.

**Added in this revision: `created_at`, `created_by`.** The review
correctly identified that component scope membership (which
capabilities a component covers) is financially material and was not
recorded anywhere once the parent component's own audit trail was
considered sufficient; a component's audit event records that the
component was created, not which capability rows were attached to it,
since the join rows are separate INSERTs. Adding intrinsic creation
provenance directly on the join table is the smallest correct fix: no
separate audit trigger is needed (the row is immutable and insert-only,
so `created_at`/`created_by` is already the complete history), matching
the same pattern already used for `invoice_eligibility_events`.

### 5.4 `measurement_definitions` (revised)

**Resource-backed: no**, unchanged.

Fields: `id` (own PK), `key` (stable, **immutable**), `name` (editable),
`unit` (**immutable**), `business_definition` (**immutable**),
`counting_rule` (**immutable**), `period_basis` (**immutable**),
`expected_source` (editable), `dimension_keys` (**immutable**), `status`
(check: `active`, `deprecated`; deprecate-only, one-way, mirroring
`is_active`), **`row_version`** (new, §9), standard columns.

**Immutability decision, resolved in this revision**: the review is
right that a historical Usage Fact pointing at a Measurement Definition
must continue to mean exactly what that definition meant when the fact
was captured. Rather than tracking whether a definition has ever been
used (an extra, error-prone runtime check), every semantic field is
immutable from creation, unconditionally: `key`, `unit`,
`business_definition`, `counting_rule`, `period_basis`,
`dimension_keys`. Only `name` (a cosmetic label) and `expected_source`
(informational, describes today's capture process, not the meaning of
the quantity) remain editable, and `status` may only move
`active -> deprecated`, never back. **A genuine change in business
meaning, counting rule, period basis, or dimension semantics is
represented by creating a new Measurement Definition with a new `key`
and deprecating the old one**, never by editing the old one in place. A
lifecycle-protection trigger (mirroring
`fn_protect_form_version_lifecycle`) enforces this: any UPDATE touching
a semantic column, or any `deprecated -> active` transition, is
rejected.

### 5.5 `commercial_commitments` (revised, quantity-MUG scope correction)

**Persistence decision, resolved in this revision.** Finance corrected
the business rule this table exists to serve: a quantity MUG applies to
exactly one Commercial Component, never several. The many-to-many join
that the first two passes carried (`commercial_commitment_components`)
existed only because of the since-withdrawn belief that a quantity MUG
could span multiple Components; that belief is now gone, and the join is
no longer the right shape for the quantity case. Rather than removing
the join table outright, this revision keeps a generic
commitment-to-component relation only where a genuine business reason
for it still exists: minimum **spend** commitments, which Finance did
not restrict this pass and which may still legitimately span multiple
Components (§8 of `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`, corrected
pass). Quantity commitments get a direct foreign key instead; spend
commitments continue to use the join table (§5.6).

Fields: `id` (own PK), `commercial_change_id` (FK, never changes), `kind`
(check: `quantity`, `spend`), **`commercial_component_id`** (new,
nullable FK to `commercial_components.id`, immutable once set; `NOT
NULL` when `kind = 'quantity'`, `NULL` when `kind = 'spend'`, enforced by
a `CHECK` constraint, §16), `threshold_value` (numeric), `currency`
(required and meaningful only when `kind = 'spend'`), `period` (check:
locked to `monthly` when `kind = 'quantity'`; free among the standard
cadence set when `kind = 'spend'`), `effective_from` (immutable),
`effective_to` (nullable, settable once), standard columns.

Reviewed for a concurrency gap (§9) and confirmed not to need
`row_version`: its only mutable path remains the single `effective_to`
closure transition, protected by the existing conditional-WHERE
approach, unaffected by this revision.

### 5.6 `commercial_commitment_components` (revised, narrowed to spend)

**Scope narrowed in this revision: this join table now exists only for
minimum spend commitments.** A quantity commitment no longer attaches
through this table at all; it uses the direct
`commercial_commitments.commercial_component_id` foreign key instead
(§5.5). Many-to-many join: `(commitment_id, component_id)`
(`component_id` renamed from `component_resource_id` to match §5.2).

**A trigger rejects any insert into this table where the referenced
`commercial_commitments.kind` is not `'spend'`.** This is the smallest
correct guard against the exact confusion this revision corrects: a
quantity commitment must never end up dual-attached (once via its direct
FK, and again via this join), and the schema should not allow the
already-withdrawn multi-component quantity-MUG shape to be reintroduced
through this side door.

**Added in the prior revision, retained: `created_at`, `created_by`.**
Spend-commitment membership (which components a combined spend floor
applies to) remains financially material and is not captured by the
parent commitment's own audit trail; intrinsic creation provenance
directly on the join table is the smallest correct fix, matching
`commercial_component_capabilities` (§5.3).

**Compatibility integrity, narrowed in this revision.** The first two
passes' trigger checked measurement-definition compatibility for
quantity commitments and currency compatibility for spend commitments.
The measurement-definition branch is removed: a quantity commitment no
longer has more than one member component to compare, since it now
resolves to exactly one Component by direct foreign key. The trigger now
only verifies, for a `kind = 'spend'` commitment, that every member
component attached through this join shares the identical
`transaction_currency`, the one cross-component compatibility concern
that remains genuinely necessary, since spend commitments still compare
a money threshold across components that could otherwise be priced in
different currencies.

### 5.7 `usage_facts` (revised)

**Scope decision, resolved in this revision: `commercial_configuration_id`
replaces `customer_id`.** The review's own worked example is the reason:
a customer with two Configurations, both using the same Measurement
Definition (`active_users`), cannot be disambiguated by
`(customer_id, measurement_definition_id, period)` alone. The stable
business scope for a Usage Fact is the commercial relationship it was
captured for, which is the Commercial Configuration, not the customer.
`customer_id` is removed rather than kept alongside the new column,
since it is fully derivable via `commercial_configuration_id ->
commercial_configurations.customer_id` and keeping both would duplicate
state that could drift (a Configuration is never reassigned to a
different customer, so there is no freshness risk in the join, only an
unnecessary second source of truth if both were stored). This design
supports every requirement named in the review: multiple Configurations
for one customer are naturally independent scopes; the same Measurement
Definition can be reused under more than one Configuration without
collision; usage history per relationship is independent by
construction; a future automated source resolves a
`commercial_configuration_id` at ingestion exactly as a manual capturer
does today (the `UsageSource` abstraction's contract does not change);
and no new generic abstraction (no "usage scope" indirection table) was
introduced, since Commercial Configuration already is the correct,
existing scope.

Fields: `id` (own PK), **`commercial_configuration_id`** (FK, replaces
`customer_id`, never changes), `measurement_definition_id` (FK, never
changes), `period_start`/`period_end`, `quantity`, `dimensions` (jsonb,
nullable), `source_type`, `source_reference`, `evidence_reference`,
`origin`, `supersedes_usage_fact_id`, `override_reason`,
`override_approved_by`, `captured_by`, `captured_at`, standard columns.

Everything else (correction/override design, no `row_version`, no
editable draft state) is unchanged from the first pass.

### 5.8 `earned_results` (revised, strengthened by the quantity-MUG correction)

Granularity and finality mechanism unchanged from the first pass (one
row per Commercial Component per earning period; minimal `open`/`final`
model; no `row_version`). This revision strengthens, rather than
changes, that decision: for a combined-rate Component with Scope =
{SFA, DMS} and one monthly quantity MUG of 150, actual combined usage of
130 produces exactly one `earned_results` row, with `raw_quantity = 130`,
`calculated_quantity = 150` (the MUG floor applied once), and one
pricing calculation producing one `calculated_amount`. There was never a
genuine need for an allocation layer splitting the floor across SFA and
DMS, since they are capabilities within one Component's scope, not two
Components; §8a records why the earlier belief that such an allocation
layer was needed has been withdrawn.

Fields unchanged except: **`pricing_calculation_version` and
`rounding_policy_version` are now captured as the Pricing Kernel's own
implementation version at the moment this specific calculation ran**,
not copied from the component (which no longer carries them, §5.2).
This is a stronger, not weaker, replayability guarantee: a historical
Earned result still records exactly which Kernel build and rounding
policy produced it, but a future Kernel bug fix no longer forces a fake
new Component version merely so future calculations pick up the
correction; only future Earned/Billing rows will naturally carry the new
version, while historical rows keep the old one, which is exactly the
distinction the review asked for (Pricing Rule *definition* version,
which is stable and lives with the component's own effective dating,
versus Kernel *implementation* version, which is a runtime fact and
lives with each calculation result).

### 5.9 `earned_result_usage_facts`

Unchanged from the first pass.

### 5.10 `billing_calculations` (revised)

**Provenance decision, resolved in this revision.** The review is
correct that `billing_quantity_basis_used` plus a copied
`basis_quantity` is not sufficient Finance provenance: it names which
kind of basis was used, but not which specific historical row produced
the number. Two new nullable columns close this gap, applying the same
replayability standard already required for Earned:

- `source_earned_result_id` (FK to `earned_results.id`, populated when
  `billing_quantity_basis_used = 'previous_period_actual'`, pointing at
  the exact prior-period Earned result whose `calculated_quantity` was
  used). This reuses Earned's own already-proven provenance chain back
  to Usage Facts, rather than duplicating a second direct link to
  `usage_facts` for the same information.
- `source_commercial_commitment_id` (FK to `commercial_commitments.id`,
  populated when `billing_quantity_basis_used = 'mug'`, pointing at the
  applicable commitment whose threshold determined the billed quantity).

When `billing_quantity_basis_used = 'fixed'`, neither source column is
populated: the amount is a contractual constant already fully
represented on the component itself, so there is nothing further to
trace. A `CHECK` constraint (§16) enforces exactly this shape, using the
same conditional-shape technique already proven for
`invoice_evidence_items` (§5.12a) and `chk_submission_revisions_lifecycle`.

**Also added, mirroring §5.8's reasoning**: `pricing_calculation_version`
and `rounding_policy_version`, capturing which Kernel build performed
this billing calculation's own arithmetic (for example, converting a
commitment threshold or a graduated schedule into a billed amount),
independent of the component's stable commercial terms.

Fields: `id` (own PK), `commercial_component_id`, `billing_period_start`/
`billing_period_end`, `billing_quantity_basis_used`, `basis_quantity`,
**`source_earned_result_id`** (new), **`source_commercial_commitment_id`**
(new), **`pricing_calculation_version`** (new), **`rounding_policy_version`**
(new), `calculated_amount`, `transaction_currency`, standard columns.

### 5.11 `invoice_eligibility_events`

Unchanged from the first pass.

### 5.12 `invoice_evidence` (revised)

**Redesigned as a pure header, cardinality resolved via §5.12a.** The
review's example (one invoice containing two Billing Calculations and a
positive Reconciliation Adjustment) is a real gap in the first pass's
two-mutually-exclusive-nullable-FK shape, which forced exactly one
underlying Nexus financial item per evidence row and would have required
duplicating the same invoice's header facts three times to reference all
three items.

Fields: `id` (own PK), `evidence_kind` (check: `invoice`, `credit_note`),
`external_reference`, `external_date`, `amount` (the invoice/credit
note's own total, as issued), `currency`, `source_system`, standard
columns. The two FK columns from the first pass are removed; allocation
to specific Nexus financial items now lives entirely in
`invoice_evidence_items`.

### 5.12a `invoice_evidence_items` (new)

Allocation join between one `invoice_evidence` header and one or more
underlying Nexus financial items.

Fields: `id` (own PK), `invoice_evidence_id` (FK, never changes),
`billing_calculation_id` (nullable FK), `reconciliation_adjustment_id`
(nullable FK, references `reconciliation_adjustments.resource_id`), a
`CHECK` requiring exactly one of the two to be populated per row
(carrying forward the exactly-one-of-two shape from the first pass's
`invoice_evidence`, now scoped per item instead of per header),
`allocated_amount` (numeric, this item's own share of the header
amount), standard columns.

**Deliberately no uniqueness constraint** on `billing_calculation_id` or
`reconciliation_adjustment_id` within this table: the review asked
whether partial invoicing of one Billing Calculation across more than
one invoice must remain structurally possible even if uncommon. It does;
nothing here prevents the same Billing Calculation from being referenced
by `invoice_evidence_items` rows under two different `invoice_evidence`
headers over time (for example, a partially invoiced amount followed by
a later invoice for the remainder).

**Deliberately no database-enforced reconciliation** between
`sum(invoice_evidence_items.allocated_amount)` for one header and that
header's own `invoice_evidence.amount`: this document does not model
invoice tax or accounting lines (an issued invoice's total may include
amounts outside Commercial's own scope), so a hard equality constraint
would be wrong more often than it would be useful. Any soft consistency
check belongs at the application layer, not the database, per the same
"does this need independent identity" discipline applied throughout this
document: the mismatch-detection logic itself has no independent
identity or lifecycle of its own.

### 5.13 `reconciliation_adjustments`

Unchanged from the first pass; reviewed for resource-backing (§10 of the
review) and reconfirmed as the one Commercial output most plausibly
needing its own approval workflow, task assignment, attachments, and
comments, the same reasoning already applied to Request. Unlike
Commercial Component, a Reconciliation Adjustment genuinely is
independently actioned (approved for additional billing, or approved as
a Credit Note) after it is created, which is exactly the distinction the
review asked this document to draw.

### 5.14 `commercial_changes` (revised)

**Redesigned: `change_type` becomes `change_category`, and its value set
is narrowed to describe the business event, not the individual terms
that changed.** The first pass's enum (`rate_change`, `mug_change`,
`workflow_added`, ...) cannot honestly describe one renewal that changes
a rate, a MUG, adds a workflow, and changes billing cadence all at once,
exactly the case the domain document's own scenario 15 and locked
principle 22 require support for. The review's distinction is adopted
directly: `change_category` (check: `initial_setup`, `renewal`,
`amendment`, `correction`, `other`) describes the kind of business
event; **which individual terms actually changed is never stored as a
separate field**, since it is already fully, correctly, and
non-redundantly evident from which `commercial_components` and
`commercial_commitments` rows reference this `commercial_changes` row as
their `commercial_change_id` (a plain query, not a derived-state column
that could drift from the truth it summarizes, the same anti-duplication
reasoning already applied to Unbilled, §16).

**Initial commercial setup, resolved in this revision**: yes, initial
setup also passes through one Commercial Change
(`change_category = 'initial_setup'`), for the reason given in §5.1: a
uniform provenance path is worth the small cost of an atomic,
two-row-together creation at approval time, and avoids a special-cased
"Configuration created with no Change" exception that every future
report or audit query would otherwise need to account for.

Fields: `request_id` (PK, FK to `requests.id`),
`commercial_configuration_id` (FK; for `change_category = 'initial_setup'`,
set atomically together with the new configuration's own
`commercial_change_id`, §5.1), **`change_category`** (renamed and
narrowed from `change_type`), `effective_date`, `reason`, standard
columns.

No duplicated Request lifecycle fields, unchanged from the first pass.

## 6. Pricing Rule storage decision

Unchanged from the first pass: embedded columns on
`commercial_components` (`pricing_rule_kind`, `pricing_rule_parameters`).
`pricing_calculation_version` no longer lives here (moved to §5.8/§5.10,
per §12 of the review).

## 7. Audit strategy (revised)

Unchanged from the first pass except:

- `commercial_component_capabilities`, `commercial_commitment_components`:
  **still no independent audit trigger**, but now carry their own
  intrinsic `created_at`/`created_by` (§5.3, §5.6), which is the smallest
  correct fix for the review's finding that membership facts are
  financially material and were not otherwise recorded anywhere. A full
  `fn_audit_row` trigger was considered and rejected as unnecessary
  overhead: these rows are never updated or deleted, so
  `created_at`/`created_by` already is the complete, permanent history:
  there is no second state to compare against.
- `commercial_components`: generic full-row audit, unchanged, now keyed
  on `id` instead of `resource_id` (§5.2); no resource-type-integrity
  trigger applies to it any longer (§16).
- `commercial_configurations`, `measurement_definitions`: generic
  full-row audit, unchanged; both now also carry `row_version` (§9),
  which `fn_audit_row` already handles without modification, since it
  audits the whole row generically regardless of which columns changed.

## 8. Resource Registry participation (revised)

| Table | Resource-backed | Reason |
|---|---|---|
| `commercial_configurations` | Yes | Whole-relationship attachments, comments, API identity, scoped authorization |
| `commercial_components` | **No (revised)** | The Commercial Change (a Request) already provides approval trail, comments, and task/workflow anchor; the component is an immutable output fact, not independently actioned, matching Submission Revision's precedent |
| `commercial_commitments` | No | Narrow child concept, no independent addressing need |
| `usage_facts` | No | High volume, granular, parent Configuration anchors future needs |
| `earned_results` | No | High volume, granular, not independently actioned |
| `billing_calculations` | No | Computed fact, not independently actioned |
| `invoice_eligibility_events` | No | Append-only decision log, not independently actioned |
| `invoice_evidence`, `invoice_evidence_items` | No | Minimal reference/allocation tables |
| `reconciliation_adjustments` | Yes | Genuinely independently actioned: approval workflow, tasks, attachments, comments |
| `commercial_changes` | No | The Request it extends already provides resource identity |

## 8a. Combined-commitment shortfall allocation: removed, not answered

**This section previously reported a BUSINESS INPUT REQUIRED finding. It
is removed in this revision, not resolved with an allocation policy,
because Finance corrected the underlying business rule and the question
no longer applies.**

The prior worked example (SFA actual = 100 at rate 100/unit; DMS actual
= 30 at rate 50/unit; combined monthly MUG = 150; shortfall = 20 units;
"which component absorbs the shortfall, at which rate?") described a
scenario that is not valid in Nexus's actual commercial model. If SFA and
DMS genuinely share one rate and one MUG, they are, by definition, priced
together as one commercial line: **one** Commercial Component with
Commercial Scope = {SFA, DMS}, not two Components whose shortfall must be
allocated between them. Under the corrected model, the same numbers
resolve without any allocation step at all: one Component, actual
combined quantity = 130, quantity MUG = 150, chargeable quantity = 150,
priced once, at the one rate that already applies to that one Component
(§5.5, §5.8, `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §8 and scenario 9,
corrected).

No `allocation_policy` column, enum, or per-calculation allocation
record was ever added to this schema, and none is added now. The correct
fix was a business-rule correction to the domain document, not a
database design decision, and this document reflects that correction
rather than inventing a persistence mechanism the corrected rule no
longer needs.

## 9. Concurrency strategy (revised)

**`row_version` is now used on two tables: `commercial_configurations`
and `measurement_definitions`.** The review is correct that "no
`row_version` anywhere" cannot be justified merely by observing that the
transactional Finance tables are append-only; it must be checked
table by table against where genuine mutable, multi-attempt editing
actually exists. Both of these tables have real editable metadata
surfaces (`name`/`relationship_note`/`is_active` on Configuration;
`name`/`expected_source`/`status` on Measurement Definition) with more
than one legitimate outcome per concurrent edit and no single
conditional-WHERE transition that could substitute for a version
counter, unlike every other mutable path in this schema. `row_version`
plus the existing `fn_bump_row_version` infrastructure (already proven
for `submission_revisions`) is the correct, smallest mechanism here, and
is reused rather than duplicated.

Every other mutable transition (`commercial_components`/
`commercial_commitments` closure, `earned_results`/
`reconciliation_adjustments` finalize) remains protected by a
conditional `WHERE` clause on current state, unchanged from the first
pass, since each still has exactly one legitimate transition and no
legitimate concurrent-edit scenario with more than one possible outcome.
Every other table remains insert-only.

## 10. Deletion / retention strategy

Unchanged from the first pass. No hard delete anywhere in this schema.
`invoice_evidence_items` (new) follows the same permanence as its
sibling join tables: as permanent as its owning header row, never edited
after creation.

## 11. Dimension-based usage decision

Unchanged from the first pass (single JSONB `dimensions` column on
`usage_facts`).

## 12. Effective dating decision

Unchanged from the first pass.

## 13. Currency decision

Unchanged from the first pass.

## 14. Entitlement decision

Unchanged from the first pass. `commercial_components.id` (no longer
`resource_id`, §5.2) and `commercial_changes.request_id` remain
sufficient, stable source references for a future Entitlement Ledger.

## 15. Unbilled decision

Unchanged from the first pass: derived, not persisted, now additionally
joining through `invoice_evidence_items` rather than a direct FK on
`invoice_evidence` itself, since eligibility/evidence for one Billing
Calculation is now reached via the allocation table (§5.12a).

## 16. Constraints and invariants (revised)

**Database-enforced:**

- Foreign keys on every relationship named in §5, including the new
  `commercial_configurations.commercial_change_id`,
  `billing_calculations.source_earned_result_id`/
  `source_commercial_commitment_id`, and every `invoice_evidence_items`
  FK.
- `CHECK` constraints: unchanged set from the first pass, plus
  `measurement_definitions.status` (deprecate-only, enforced by trigger,
  not solely by CHECK, §5.4), `commercial_changes.change_category`
  (replacing `change_type`), a shape check on `billing_calculations`
  requiring exactly one of `source_earned_result_id`/
  `source_commercial_commitment_id`/neither to be populated depending on
  `billing_quantity_basis_used` (§5.10), `invoice_evidence_items`'
  exactly-one-of-two-FKs shape (moved from `invoice_evidence`, §5.12a),
  and **`commercial_commitments`' quantity-scope shape** (new this
  revision: `commercial_component_id IS NOT NULL` when
  `kind = 'quantity'`, `commercial_component_id IS NULL` when
  `kind = 'spend'`, §5.5).
- A resource-type-integrity trigger, reusing
  `fn_assert_resource_type(expected_type, pk_column_name)`, now on only
  `commercial_configurations.id` and `reconciliation_adjustments.resource_id`
  (`commercial_components` removed, §5.2, §8).
- A lifecycle-protection trigger per immutable-with-one-transition table
  (`commercial_components`, `commercial_commitments`, `earned_results`,
  `reconciliation_adjustments`), unchanged, **plus a new lifecycle-
  protection trigger on `measurement_definitions`** rejecting any UPDATE
  touching a semantic column and rejecting `deprecated -> active` (§5.4).
- A row-version-bump trigger (`fn_bump_row_version`, already proven for
  `submission_revisions`) on `commercial_configurations` and
  `measurement_definitions` (§9).
- A narrow trigger on `commercial_commitment_components` (revised this
  pass): rejects any insert where the referenced commitment's `kind` is
  not `'spend'`, and enforces currency compatibility across a spend
  commitment's member components. The measurement-definition-
  compatibility branch is removed: a quantity commitment now resolves to
  exactly one Component via a direct foreign key, so there is no
  multi-member set left to compare (§5.5, §5.6).
- Partial unique index enforcing `measurement_definitions.key` and
  `commercial_configurations.key` uniqueness, unchanged.

**Application/domain-layer:** unchanged from the first pass, plus:
whether `sum(invoice_evidence_items.allocated_amount)` for one header is
sensible relative to `invoice_evidence.amount` (deliberately not a
database CHECK, §5.12a).

**Workflow (not built now):** unchanged. No combined-commitment
allocation workflow exists or is needed (§8a).

## 17. Index strategy (revised)

Unchanged list from the first pass, with column renames
(`component_id` in place of `component_resource_id` on both join
tables), plus:

- `usage_facts`: index changed to `(commercial_configuration_id,
  measurement_definition_id, period_start)`.
- `billing_calculations`: add `(source_earned_result_id)`,
  `(source_commercial_commitment_id)`.
- `invoice_evidence_items`: `(invoice_evidence_id)`,
  `(billing_calculation_id)`, `(reconciliation_adjustment_id)`.
- `commercial_commitments`: add `(commercial_component_id)` for "the
  quantity MUG effective for this Component" lookups (new this
  revision, replacing the join-table-based lookup the quantity case
  previously needed).

No index is added for a hypothetical query; each maps to an access
pattern already named in this document.

## 18. Scenario proof (revised)

All scenarios from the first two passes are re-confirmed under the
corrected schema. Updated and additional notes from this revision:

- **Scenario 9, corrected: one combined-rate Component, one quantity
  MUG.** SFA and DMS priced together as one commercial line are one
  `commercial_components` row (Scope = {SFA, DMS} via
  `commercial_component_capabilities`), with one `commercial_commitments`
  row (`kind = 'quantity'`, `commercial_component_id` pointing directly
  at that one Component, `period` locked to `monthly`). Actual combined
  usage = 130, MUG = 150: one `earned_results` row, `calculated_quantity
  = 150`, no allocation between SFA and DMS, because there is only one
  Component to begin with (§5.5, §5.8, `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`
  §8 and scenario 9, corrected).
- **Scenario 17 (new): same numerical rate, separate Components.**
  Component A (Scope = {SFA}, rate 100, quantity MUG 100) and Component B
  (Scope = {DMS}, rate 100, no MUG) are two independent
  `commercial_components` rows, two independent
  `commercial_component_capabilities` memberships, and exactly one
  `commercial_commitments` row (for Component A only,
  `commercial_component_id` pointing at Component A). If SFA's actual
  usage is 80, Component A's `earned_results` row shows
  `calculated_quantity = 100` (the MUG floor); Component B's
  `earned_results` row is computed purely from its own DMS usage, with
  no reference to Component A's commitment at all.
- **Scenario 16, multiple Configurations for one customer, still covers
  Usage**: each Configuration's Usage Facts are independently scoped via
  `commercial_configuration_id` (§5.7); the same Measurement Definition
  (for example `active_users`) can be used under both Configurations
  without ambiguity.
- **Invoice bundling (not a domain-document-numbered scenario but
  directly required by §14 of the domain document)**: one fictional
  invoice referencing two Billing Calculations (SFA, DMS) and one
  positive Reconciliation Adjustment is represented by one
  `invoice_evidence` header and three `invoice_evidence_items` rows.

## 19. Break-test findings (revised, including the ten re-run tests)

All findings from the prior passes are re-confirmed under the corrected
schema (history cannot be overwritten, one Request cannot produce
unrelated Commercial Changes, one Change can affect multiple Components,
corrections can chain, a future Wallet or Entitlement Ledger can be added
without breaking current Pricing, join-table membership is auditable,
Measurement Definition semantics cannot drift, concurrent Configuration
edits cannot silently overwrite, a future Kernel bug fix does not force a
fake Commercial term change). The ten tests requested by this
correction pass:

1. **SFA+DMS with one common rate and one common MUG works as one
   Component with two capability memberships.** Confirmed: one
   `commercial_components` row, Scope = {SFA, DMS} via two
   `commercial_component_capabilities` rows, one `commercial_commitments`
   row (`kind = 'quantity'`) pointing directly at that one Component
   (§5.2, §5.3, §5.5).
2. **No inter-component MUG allocation is required.** Confirmed:
   `earned_results` produces exactly one row for the one Component
   involved; no allocation table, column, or record exists anywhere in
   this schema (§5.8, §8a).
3. **SFA and DMS can have the same numerical rate but remain separate
   Components when only SFA has MUG.** Confirmed: two independent
   `commercial_components` rows are permitted regardless of whether
   their `pricing_rule_parameters` happen to encode the same numeric
   rate; nothing in the schema merges components based on rate equality
   (§5.2, §18 scenario 17).
4. **MUG shortfall in that case applies only to SFA.** Confirmed:
   `commercial_commitments.commercial_component_id` points at exactly one
   Component (SFA's); Component B (DMS) has no `commercial_commitments`
   row referencing it at all, so its `earned_results` row is computed
   with no floor (§5.5, §18 scenario 17).
5. **One Component may have no MUG.** Confirmed: a Component simply has
   no `commercial_commitments` row with its id as
   `commercial_component_id`; nothing requires one (§5.5).
6. **Multiple Components may still coexist for the same or overlapping
   capability scope where different charge lines genuinely exist.**
   Confirmed, unchanged from the first pass: no uniqueness constraint
   prevents two `commercial_components` rows from sharing a capability
   via `commercial_component_capabilities` (§5.2, §5.3).
7. **One Earned result per Component per earning period remains
   sufficient.** Confirmed and strengthened: the corrected model removes
   the only scenario (cross-component allocation) that might have argued
   for a different granularity (§5.8).
8. **No unnecessary MUG-allocation table or policy remains.** Confirmed:
   §8a documents the removal; no `allocation_policy` column, enum, or
   record exists anywhere in this schema.
9. **Historical replay remains intact.** Confirmed: `earned_results`
   still snapshots `pricing_rule_kind`/`pricing_rule_parameters`, the
   Kernel's own `pricing_calculation_version`/`rounding_policy_version`,
   and its feeding Usage Facts via `earned_result_usage_facts`, all
   unaffected by this correction (§5.8, §5.9).
10. **No previous locked business requirement is lost.** Confirmed: the
    correction narrows quantity-MUG scope only; minimum spend commitments
    still may span multiple Components (§5.5, §5.6); every other locked
    principle from `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §2 is
    unaffected.

No break attempt against the corrected design succeeded. No genuine open
business question remains against this design.

## 20. Decisions made on all original §20 Database Design Questions

Unchanged from the first pass; all nine items from
`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §20 remain resolved as recorded
in the first-pass version of this document. The prior revision resolved
eleven further issues (§0) and reported one (§8a) as requiring business
input. This revision resolves that one remaining item, not by deciding a
persistence question but because Finance corrected the underlying
business rule it depended on: no open item of any kind remains against
this document.

## 21. Remaining implementation questions

Unchanged from the prior revision, plus: the exact PL/pgSQL body for the
new `commercial_commitments` quantity/spend shape CHECK and the
`commercial_commitment_components` kind-guard trigger (§5.5, §5.6). None
of these block locking this design; all are implementation-stage detail
following already-proven patterns from Migrations 4 through 6.

## 22. What this document is not

Unchanged from the prior revision. This document no longer carries an
unresolved combined-commitment allocation question (§8a, removed); it is
also not a decision about how minimum spend commitments should be
divided across components when a spend commitment's threshold is
breached, since Finance did not raise that as a question this pass and
this document does not invent one.

Not a log of execution. The Migration 8 portion of this design
(`measurement_definitions`, `commercial_configurations`,
`commercial_changes`, `commercial_components`,
`commercial_component_capabilities`, `commercial_commitments`,
`commercial_commitment_components`) has since been translated into SQL
and applied; execution evidence lives in
`docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` §23, not duplicated
here. The remaining eight tables (Migrations 9 and 10) remain
not-yet-authored. This document stays the design-level record of *why*
each decision was made, not a status log of any migration.

## 23. Customer / Capability Master sequencing (new)

**This document does not create Customer Master or Capability/Workflow
Master schema.** It states, as a dependency finding, what must exist
before a Commercial migration can safely add real foreign keys.

`commercial_configurations.customer_id` and
`commercial_component_capabilities.capability_id` currently reference no
real table. An unenforced UUID with no backing row is not an acceptable
permanent shape in this codebase: it is precisely the class of gap
Migration 6 already had to correct for `requests` (a resource-type
reference with nothing verifying the referenced row was actually the
expected kind), and adding two more unenforced references in the same
migration that just fixed that exact class of problem would reintroduce
it deliberately.

**Recommendation: a minimal Customer Master and a minimal
Capability/Workflow Master must be built, in a preceding, separate
migration, before the Commercial migration.** "Minimal" is load-bearing:
each needs only a stable identity a foreign key can safely target (an
`id`, a stable `key`, a `name`, and a status/lifecycle column at most),
not the full future shape of either domain. Commercial's own work in
this document has now clarified exactly what shape is minimally needed
(a Customer identity distinct from any other Nexus identity; a
Capability/Workflow registry entry stable enough for
`commercial_component_capabilities` to reference), which is enough
concrete grounding to justify resuming the previously deferred 5B1C2
Master Data Resolver now, scoped narrowly to these two minimal tables,
rather than continuing to defer it and letting Commercial add references
to nothing. This is a sequencing recommendation only; neither table is
designed or created in this document.

## 24. Revision log

**First pass**: initial Commercial Database Design, thirteen tables, no
review applied.

**Revision 1**: principal-database-architect sanity review applied;
eleven issues found and resolved by schema revision; one issue (§8a)
found to be a genuine open business question and reported rather than
resolved; table count increased to fifteen (`invoice_evidence_items`
added); no table removed; `commercial_components` resource-backing
removed; `commercial_configurations` and `measurement_definitions`
gained `row_version`; `usage_facts` re-scoped to
`commercial_configuration_id`; `commercial_changes.change_type` narrowed
and renamed to `change_category`.

**Revision 2 (this revision)**: Finance corrected the quantity-MUG scope
business rule (a quantity MUG applies to exactly one Commercial
Component, never several); §8a's open business question is removed, not
answered, since the scenario requiring an allocation policy is not a
valid business scenario under the corrected rule.
`commercial_commitments` gains a direct `commercial_component_id` foreign
key for the quantity case; `commercial_commitment_components` is narrowed
to minimum spend commitments only, with a trigger preventing a quantity
commitment from attaching through it; the commitment-compatibility
trigger's measurement-definition branch is removed (no longer needed with
exactly one member); the one-Earned-row-per-Component-per-period decision
is strengthened, not changed. Table count remains fifteen; no table
added or removed this revision.

**Revision 3 (2026-09-12, additive, first live write path)**: the
onboarding Commercial Rate promotion path this design always anticipated
(§14, §22 of `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`) is now built. Three
small, additive migrations extend this locked schema; no table is added,
removed, or duplicated: `commercial_components` gains a nullable
`fx_snapshot_rate numeric` column (null only when `transaction_currency =
'INR'`, see docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22a); `billing_cadence`/
`reconciliation_cadence` now also accept `one_time`, and
`pricing_rule_kind = 'volume'` now also accepts a `tiers` array (both gaps
§22 of the domain document already named); four new RPCs
(`create_system_commercial_request`, `create_commercial_change_for_configuration`,
`add_commercial_component`, `add_commercial_commitment`) follow the exact
`set_config` actor-audit pattern every existing Commercial RPC already
uses. See `supabase/migrations/20260912210000_commercial_configuration_persistence.sql`,
`20260912211500_commercial_components_one_time_cadence.sql`, and
`20260912212000_commercial_components_volume_tiers_shape.sql` for the
exact SQL, and docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22a for the full
versioning/FX-snapshot/promotion architecture this revision enables.

**Status: LOCKED.** `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` and
`docs/COMMERCIAL_TECH_EVALUATION.md` remain locked and unchanged; no
contradiction between either of them and this design was found.
