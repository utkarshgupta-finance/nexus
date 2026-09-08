# NEXUS MASTER DATA FOUNDATION

## MIGRATION DESIGN

**NO SQL YET. NO DATABASE CHANGES YET.**

**STATUS: LOCKED.**

**PRE-APPLY GATE: Supabase CLI migration atomicity is VERIFIED / PASSED
for CLI 2.117.0 on the tested Docker-backed local execution path (§22).
Migration 7 (`supabase/migrations/20260908013210_master_data_foundation.sql`,
committed) has been authored, principal-reviewed, and dry-run against
the linked remote project (planning exactly that one file). Migration 7
is eligible for controlled apply as a separate, later stage; this
document does not itself apply it.**

This document is the implementation blueprint for the next migration,
translating the locked `docs/MASTER_DATA_FOUNDATION_DESIGN.md` into an
exact PostgreSQL shape, reusing established Nexus migration patterns
inspected directly from Migrations 1 through 6. It does not create a
migration file, write executable SQL, run `supabase db push` or
`db reset`, modify Supabase, write application code, or commit. No
locked design document is modified. Every example is generic and
fictional; no real Nexus customer, contract, or negotiated price appears
anywhere in this document.

## 1. Target

Exactly two tables: `customers`, `capabilities`. No Commercial table, no
Form Data Source Resolver, no Customer 360, no CRM, no Product Catalog,
no additional master table. This mirrors `docs/MASTER_DATA_FOUNDATION_DESIGN.md`
§15's table inventory exactly; nothing is added here that document did
not already propose.

## 2. Migration ordering

Inspected `supabase/migrations/`: six migrations exist, in order:

```
20260906084244_platform_core_foundation.sql
20260906152735_audit_and_control_hardening.sql
20260906210726_revoke_trigger_function_execute.sql
20260907014500_form_versioning_foundation.sql
20260907044335_submission_data_foundation.sql
20260907054608_request_resource_type_integrity.sql
```

The next migration must sort after `20260907054608` and follow the
existing `YYYYMMDDHHMMSS_<name>.sql` convention. Every migration so far
uses a plausible same-day or next-day timestamp rather than a round
number; the proposed filename below follows the same style.

**Proposed filename (not created): `20260907063000_master_data_foundation.sql`**

This runs after all six existing migrations and strictly before any
future Commercial migration, which depends on `customers`/`capabilities`
existing (§17). The exact timestamp is illustrative and must be
regenerated at implementation time (`supabase migration new
master_data_foundation`, or by hand following this same pattern) against
whatever the actual local clock/migration history looks like then; the
important constraint is relative ordering, not this specific value.

## 3. Exact logical DDL shape

Not executable SQL; a declarative shape only, in the same style already
used for candidate shapes in `docs/FORM_VERSIONING_MODEL.md` §27 and
`docs/SUBMISSION_DATA_CONTRACT.md` §18.

```
customers
  id          uuid        primary key default gen_random_uuid()
  key         text        not null unique              -- immutable after insert
  name        text        not null                       -- editable
  is_active   boolean     not null default true          -- reversible both directions
  row_version integer     not null default 1             -- database-maintained only
  created_at  timestamptz not null default now()
  created_by  uuid        references app_users (id) on delete restrict
  updated_at  timestamptz not null default now()
  updated_by  uuid        references app_users (id) on delete restrict

  constraint chk_customers_row_version_positive check (row_version >= 1)

capabilities
  id          uuid        primary key default gen_random_uuid()
  key         text        not null unique              -- immutable after insert
  name        text        not null                       -- editable
  status      text        not null default 'active'
                          check (status in ('active', 'deprecated'))
  row_version integer     not null default 1             -- database-maintained only
  created_at  timestamptz not null default now()
  created_by  uuid        references app_users (id) on delete restrict
  updated_at  timestamptz not null default now()
  updated_by  uuid        references app_users (id) on delete restrict

  constraint chk_capabilities_row_version_positive check (row_version >= 1)
```

Neither table has a `resource_id` column or a foreign key to
`resources`; neither participates in the Resource Registry (§13, per
`docs/MASTER_DATA_FOUNDATION_DESIGN.md` §5.4, §6.4). Neither table gets
a Commercial foreign key in this migration (§17).

## 4. Customer constraints

- **PK**: `id`.
- **`UNIQUE (key)`**: the sole hard identity uniqueness, matching
  `form_definitions.key`'s existing convention exactly (a plain `unique`
  constraint on a `text` column, no partial scoping, since `customers`
  has no soft-delete state to scope around).
- **`NOT NULL`**: `key`, `name`, `is_active`, `row_version`, `created_at`,
  `updated_at`. `created_by`/`updated_by` are **nullable**, matching the
  existing `form_versions`/`app_users`-adjacent convention exactly (§6):
  a system-originated write with no authenticated actor is a valid,
  meaningful state, never an error, per `docs/DATA_ARCHITECTURE.md` §9.
- **`CHECK (row_version >= 1)`**: reused verbatim from
  `chk_form_versions_row_version_positive`.
- **No `CHECK` on `is_active`**: it is a plain boolean; both `true` and
  `false` are legitimate at any time, so no shape constraint is needed
  beyond `NOT NULL`.
- **No format/regex constraint on `key`**: `docs/FORM_VERSIONING_MODEL.md`
  and `docs/SUBMISSION_DATA_CONTRACT.md` establish no such constraint for
  any existing `key` column; inventing one now would be a new convention
  this design does not introduce (§15 below).

## 5. Capability constraints

- **PK**: `id`.
- **`UNIQUE (key)`**: identical reasoning and shape to Customer's.
- **`CHECK (status in ('active', 'deprecated'))`**: the two-value closed
  set, matching the existing `check (status in (...))` idiom used
  verbatim on `form_versions.status` and `measurement_definitions.status`
  (per `docs/COMMERCIAL_DATABASE_DESIGN.md` §5.4).
- **`NOT NULL`**: `key`, `name`, `status`, `row_version`, `created_at`,
  `updated_at`. `created_by`/`updated_by` nullable, same reasoning as §4.
- **`CHECK (row_version >= 1)`**: reused verbatim.
- **No `description`/`category` column, and therefore no constraint for
  either**: `docs/MASTER_DATA_FOUNDATION_DESIGN.md` §6.2 already rejected
  both.

## 6. Lifecycle protection

**Decision: two separate, dedicated functions, `fn_protect_customer_lifecycle()`
and `fn_protect_capability_lifecycle()`, not one shared generic
function.** Considered reusing a single generalized function (the way
`fn_protect_access_grant()` already serves both `user_roles` and
`role_permissions`, and the way `fn_bump_row_version()` and
`fn_audit_row()` already serve every table without modification).
Rejected for lifecycle protection specifically: `fn_protect_access_grant()`
can be shared because both its tables have the *exact same* mutable
column shape (`revoked_at`/`revoked_by`/`revocation_reason`) and the
exact same rule (irreversible one-way revoke). `customers` and
`capabilities` do not share this property: `customers.is_active` is a
plain boolean reversible in both directions, while
`capabilities.status` is a two-value text enum, one-way only. Forcing
one function to parameterize both a boolean-vs-enum column type and a
reversible-vs-one-way rule would make the function harder to read and
audit than two short, obvious ones, exactly the over-generalization this
design is instructed to avoid. Each function instead follows the
existing per-table dedicated pattern already proven by
`fn_protect_form_version_lifecycle()`: one combined
`BEFORE INSERT OR UPDATE OR DELETE` trigger per table that both blocks
`DELETE` unconditionally and validates the permitted `UPDATE` shape,
rather than a separate key-immutability trigger plus a separate
transition trigger (unlike `form_definitions`, which only needed
key-immutability with no additional lifecycle transition to guard,
`customers` and `capabilities` both need identity immutability *and* a
transition rule, so one combined function per table is the smaller
design, mirroring `form_versions`, not `form_definitions`).

**`fn_protect_customer_lifecycle()`** (`BEFORE INSERT OR UPDATE OR
DELETE`):

- `DELETE`: always rejected (§18).
- `INSERT`: no additional shape requirement beyond the table's own
  `NOT NULL`/`CHECK` constraints; `is_active` may begin `true` or
  `false` (no rule forces a new Customer to start active).
- `UPDATE`: compute `old` minus `{is_active, name, row_version,
  updated_at, updated_by}` versus `new` minus the same set (the same
  JSONB-diff-minus-permitted-columns technique already used by
  `fn_protect_access_grant()` and `fn_protect_form_version_lifecycle()`);
  reject if they differ, which rejects any change to `id`, `key`,
  `created_at`, or `created_by`. `is_active` itself is **not**
  constrained to one direction: both `true -> false` and `false ->
  true` pass through this function unrejected, which is the exact
  correction this design implements (`docs/MASTER_DATA_FOUNDATION_DESIGN.md`
  §5.2, §5.2a). This is the one deliberate difference from
  `fn_protect_capability_lifecycle()` below.

**`fn_protect_capability_lifecycle()`** (`BEFORE INSERT OR UPDATE OR
DELETE`):

- `DELETE`: always rejected (§18).
- `INSERT`: `status` must be `'active'` (a new Capability is never
  created already deprecated; there is no locked requirement for that
  case, and inventing one would be speculative).
- `UPDATE`: compute the same kind of core-identity diff, excluding
  `{status, name, row_version, updated_at, updated_by}`; reject if
  `id`/`key`/`created_at`/`created_by` differ. Additionally, and unlike
  Customer, explicitly validate the `status` transition itself: permit
  only `old.status = 'active' and new.status = 'deprecated'` or
  `old.status = new.status` (no change); reject
  `old.status = 'deprecated' and new.status = 'deprecated' is false`
  (i.e., reject any attempted `deprecated -> active` move, and reject
  any value outside the two-member set, which the `CHECK` constraint
  already backstops independently).

Both functions are deliberately written so their verdict never depends
on the value of `row_version` or `updated_at`, the same defensive
property `fn_protect_form_version_lifecycle()` already establishes,
which is what makes trigger firing order against the row-version and
`updated_at` triggers irrelevant to correctness (§11).

## 7. Row version

**Reused verbatim: `fn_bump_row_version()`.** No new row-version function
is created; the existing function already contains no table-specific
logic (`new.row_version := old.row_version + 1` unconditionally) and
already generalizes to any table with a `row_version` column, which its
own comment in Migration 4 anticipated ("can be generalized later if a
second table needs the same behavior"). `customers` and `capabilities`
are exactly that second and third case.

- **Default**: `row_version integer not null default 1` on both tables,
  identical to `form_versions.row_version`.
- **Trigger timing/events**: `BEFORE UPDATE`, one trigger per table
  (`trg_customers_row_version`, `trg_capabilities_row_version`),
  identical shape to `trg_form_versions_row_version`.
- **Ordering interaction**: the lifecycle-protection trigger (§6) never
  inspects `row_version`, so it produces the same verdict whether it
  fires before or after the row-version bump. Naming still follows the
  established alphabetical convention deliberately, not by accident
  (§11): `trg_customers_protect_lifecycle` sorts before
  `trg_customers_row_version`, which sorts before
  `trg_customers_updated_at`, matching the exact ordering already
  established for `form_versions` (`protect_lifecycle` < `row_version`
  < `updated_at`).
- **Optimistic concurrency is an application-layer contract, not a
  trigger-alone guarantee.** This must be stated explicitly, per the
  task's own instruction: the trigger's only job is to make
  `row_version` unforgeable (a caller cannot persist an arbitrary
  value). Detecting a stale write is the *application/domain layer's*
  responsibility, using the same conditional-`UPDATE` shape already
  proven for `form_versions`' draft-content saves
  (`docs/FORM_VERSIONING_MODEL.md` §11): `UPDATE customers SET ... WHERE
  id = ? AND row_version = ? RETURNING *` (and identically for
  `capabilities`), where `?` is the `row_version` the caller most
  recently read. Zero rows returned means either a concurrent edit (the
  precondition failed) or the row no longer exists; the repository layer
  disambiguates, exactly as already designed for Form Version draft
  saves. The trigger alone, with no conditional `WHERE`, would silently
  allow a last-write-wins update; it is the *combination* of the
  unforgeable counter and the caller-supplied precondition that provides
  the actual guarantee. No RPC is required for this: like ordinary Form
  Version draft saves, a single conditional `UPDATE` statement is already
  atomic on its own, so no multi-statement transaction problem exists
  here (`docs/FORM_VERSIONING_MODEL.md` §11).
- **Break-test proof of staleness**: two application-layer reads of the
  same row (both observing `row_version = N`), then one issues the
  conditional update and succeeds (`row_version` becomes `N+1`), then
  the second issues the same conditional update using its now-stale
  `row_version = N` and receives zero rows back, proving the second
  write was correctly rejected rather than silently overwriting the
  first (§18, tests 7 and 25a).

## 8. Audit trigger

**Reused verbatim: `fn_audit_row('id')`.** No new audit infrastructure,
no narrow/scoped audit variant: both tables are small, writes are
infrequent (a name edit, or the lifecycle transition), and neither has
the high-frequency/large-payload combination that justified
`form_versions`' targeted `WHEN`-scoped audit
(`docs/FORM_VERSIONING_MODEL.md` §19). This is the same conclusion
already reached for `form_definitions`, `commercial_configurations`, and
`measurement_definitions`.

- `create trigger trg_audit_customers after insert or update or delete
  on customers for each row execute function fn_audit_row('id');` and
  identically `trg_audit_capabilities` on `capabilities`.
- **`INSERT` audited**: yes, full row via `to_jsonb(new)`.
- **`UPDATE` audited**: yes, full before/after row via
  `to_jsonb(old)`/`to_jsonb(new)`.
- **`DELETE`**: the trigger is attached to fire on `DELETE` too (matching
  the existing `form_definitions`/`form_versions` convention exactly),
  but it can never actually run in practice, because
  `fn_protect_customer_lifecycle()`/`fn_protect_capability_lifecycle()`
  (both `BEFORE`) unconditionally raise an exception on any `DELETE`
  attempt first, aborting the entire statement before the `AFTER` audit
  trigger would ever fire. This is not a gap; it is the same "rejected
  mutation cannot produce a mutation audit row" guarantee already relied
  upon for `form_versions` (§10 below).
- **`row_version` changes appear naturally**: because `fn_audit_row`
  captures the full row via `to_jsonb`, and the row-version bump trigger
  runs `BEFORE` the row is actually written, the audit row's
  `after_value` already reflects the bumped `row_version`, with no
  special-casing needed.
- **No `resource_id` needed**: `fn_audit_row` already handles a table
  with no `resource_id` column, reading `v_res_id` as `NULL` via
  `nullif(v_row ->> 'resource_id', '')`, exactly as it already does for
  `form_definitions`. `row_id` (from `id`) remains fully sufficient.
- **No `resource_types` seed row, no `resources` insert**: confirmed,
  see §13.

## 9. RLS

**Locked pattern, applied unchanged.** `alter table customers enable row
level security;` and `alter table capabilities enable row level
security;`. **Not** `FORCE ROW LEVEL SECURITY`, matching every existing
Platform Core table. **Zero policies are created in this migration**,
which, combined with `ENABLE` and no policy, denies `anon`/
`authenticated` all direct access by default (`docs/DATA_ARCHITECTURE.md`
§12). The trusted `service_role` application path remains untouched and
is the intended route to these tables. This is confirmed to be literally
zero policies after the migration, exactly matching Migrations 1 and 4's
own stated posture; no policy authoring is designed here or deferred to
a named future step beyond "when a real, reviewed access pattern needs
one."

## 10. Privilege hardening

**Inspected Migration 2 and Migration 4 directly.** Migration 2 already
runs `alter default privileges for role postgres in schema public revoke
all on tables from anon, authenticated`, the equivalent for sequences,
and `revoke execute on functions from anon, authenticated`, all scoped
to future objects created by `postgres` in the `public` schema. Because
`customers`/`capabilities` and their new functions will be created by
the same migration-owning role, **they already have zero anon/
authenticated privileges the moment they are created**, purely from
Migration 2's existing default-privilege rule; no new `ALTER DEFAULT
PRIVILEGES` statement is needed in Migration 7 to establish this.

**Explicit `REVOKE`s are still required, as defense-in-depth, not a
correction**, following Migration 4's own stated reasoning verbatim
("Stage 5A proved Supabase can carry separate explicit role grants that a
default-privilege rule alone would not remove, so this migration does
not rely solely on that default holding"):

- `revoke all on table customers, capabilities from anon, authenticated;`
- `revoke execute on function fn_protect_customer_lifecycle(),
  fn_protect_capability_lifecycle() from public, anon, authenticated;`
  (the row-version and audit functions are not re-revoked here, since
  they already exist and were already revoked in Migration 4/1
  respectively; no new function-privilege statement is needed for
  functions this migration does not create).
- No new sequence exists to revoke: both tables use `gen_random_uuid()`
  as a column default, not an `IDENTITY`/`SERIAL` column, so no sequence
  object is created by either table (unlike `audit_log.audit_sequence`
  in Migration 2, which specifically needed its own sequence revoke
  because it used `generated always as identity`).
- `service_role` and `postgres` are left untouched throughout, matching
  every existing migration.

**Nothing is accidentally left open**: no new `EXECUTE` grant is issued
to any role in this migration; no table `GRANT` is issued to
`anon`/`authenticated`; the two explicit `REVOKE`s above are strictly
additive hardening on top of an already-zero baseline.

## 11. Trigger ordering

PostgreSQL fires same-timing/same-event triggers on a table in
alphabetical order by trigger name. This migration's trigger set per
table, and the exact ordering it produces:

**`BEFORE INSERT OR UPDATE OR DELETE`** (single combined trigger):
`trg_customers_protect_lifecycle` / `trg_capabilities_protect_lifecycle`
runs alone at this event scope.

**`BEFORE UPDATE`** (two triggers, alphabetical):
1. `trg_customers_protect_lifecycle` (also fires here, since it is
   declared `BEFORE INSERT OR UPDATE OR DELETE`, so it participates in
   every `BEFORE UPDATE` firing too, first alphabetically: `protect_...`
   sorts before `row_version`/`updated_at`).
2. `trg_customers_row_version` (bumps `row_version`).
3. `trg_customers_updated_at` (sets `updated_at = now()`, reusing
   `fn_set_updated_at()` unchanged).

(Identically for `capabilities`.)

**`AFTER INSERT OR UPDATE OR DELETE`**: `trg_audit_customers` /
`trg_audit_capabilities` alone.

**Why this ordering is safe, proven rather than assumed**: the
lifecycle-protection function never reads `row_version` or `updated_at`
(§6), so it produces an identical accept/reject verdict regardless of
whether it runs before or after the row-version/`updated_at` triggers;
this is the same argument `fn_protect_form_version_lifecycle()`'s own
comment already makes verbatim, and this design deliberately preserves
it rather than assuming ordering is irrelevant without checking. Because
the lifecycle trigger is `BEFORE` and unconditionally raises on any
rejected shape, a rejected write never reaches the row-version bump, the
`updated_at` set, or the `AFTER` audit insert: the entire statement
rolls back atomically, so no partial mutation and no misleading audit
row can ever result from a rejected write (§10 above, §18 tests 13/33
below, using the corrected `SAVEPOINT` harness, §21).
Trigger names are chosen deliberately (`protect_lifecycle` alphabetically
first among the `BEFORE` set) to match the existing convention exactly,
not merely to be descriptive.

## 12. Function security

- **`fn_protect_customer_lifecycle()`, `fn_protect_capability_lifecycle()`**:
  `SECURITY INVOKER` (the default; no `SECURITY DEFINER` clause).
  Reasoning, matching `fn_protect_form_version_lifecycle()` and
  `fn_protect_access_grant()` exactly: these functions only inspect
  `OLD`/`NEW` and either raise or pass the row through; they perform no
  privileged read/write beyond the triggering statement's own row, so
  there is no privilege gap for `SECURITY DEFINER` to close, and adding
  it would only introduce the well-known search-path-hijacking exposure
  for zero benefit.
- **`fn_bump_row_version()`, `fn_audit_row()`**: unchanged, already
  exist. `fn_audit_row()` is `SECURITY DEFINER` with `search_path =
  pg_catalog`, already justified in Migration 1 (it must be able to
  insert into `audit_log` regardless of the calling role's own RLS-gated
  access to that table); nothing about `customers`/`capabilities` changes
  that reasoning, and neither new table's presence requires touching
  `fn_audit_row()` itself.
- **No new `SECURITY DEFINER` function is introduced by this migration
  at all.** Neither `customers` nor `capabilities` needs an atomic
  multi-statement RPC the way `create_form_version`/
  `publish_form_version` did (§7: ordinary conditional single-statement
  `UPDATE`s are already atomic on their own); there is no function here
  playing that role, so the `SECURITY DEFINER`/`SECURITY INVOKER`
  question that mattered for those two RPCs does not arise for this
  migration.

## 13. Resource Registry confirmation

**Explicitly confirmed: Migration 7 does not touch the Resource
Registry in any way.** No `insert into resource_types (...)` for
`'customer'` or `'capability'`; no `resources` row minted for either
table; no `fn_assert_resource_type` attachment to either table; neither
table has a `resource_id` column at all. This follows directly from
`docs/MASTER_DATA_FOUNDATION_DESIGN.md` §5.4/§6.4/§7 (neither table is
resource-backed) and is checked here specifically because it is exactly
the kind of accidental scope-creep §33's overdesign review calls out.

## 14. Indexes

Beyond the unique indexes PostgreSQL creates automatically to back
`PRIMARY KEY` and `UNIQUE (key)` on each table, **no additional index is
added**. `docs/MASTER_DATA_FOUNDATION_DESIGN.md` §17 already reached this
conclusion and named `is_active`/`status` filtering as a *hypothetical*
future need, not a known one; adding either now would be exactly the
speculative indexing this design and `docs/DATA_ARCHITECTURE.md` §5 both
reject ("further indexes are added for the columns a feature actually
filters or sorts by, decided when that query pattern exists"). No
foreign key exists yet on either table pointing outward (§17), so there
is no foreign-key index to add either; the future Commercial migration
will index its own new foreign keys per its own standard practice, not
this one.

## 15. Key semantics: database versus application layer

**Database-enforced**: `key` is `NOT NULL`, `UNIQUE`, and immutable after
insert (via the lifecycle-protection trigger's core-identity diff, §6).
Uniqueness and immutability are the two properties
`docs/MASTER_DATA_FOUNDATION_DESIGN.md` actually locks; nothing more.

**Application-layer, deliberately not a database constraint**: any
formatting convention (allowed character set, length guidance),
whitespace normalization (trimming), or casing convention for a
newly-authored `key`. No regex `CHECK` is added, because no existing
Nexus `key` column (`form_definitions.key`, `measurement_definitions.key`)
has one either; inventing a new, stricter convention here, unmatched by
any existing table, would be a new pattern this migration has no mandate
to introduce. If a real, concrete formatting need is identified later
(for example, a future admin screen), it is validated at the application
layer at that time, consistent with `docs/MASTER_DATA_FOUNDATION_DESIGN.md`
§16's own "application-layer, kept separate" list.

## 16. Case sensitivity

**Decision: case-sensitive, plain `text` uniqueness, matching
`form_definitions.key` exactly.** Inspected `form_definitions.key text
not null unique`: no `citext`, no functional `lower(key)` unique index,
no case-folding of any kind. `CUSTOMER_ABC` and `customer_abc` are two
different keys under this convention, the same as they would be for two
different `form_definitions.key` values today. This migration does not
introduce a new, different convention (case-insensitive uniqueness)
found nowhere else in the schema; doing so here, and only here, would be
an unexplained inconsistency for a future reader to puzzle over. If
case-insensitive matching is later found to be a real, general need
across every `key`-bearing table in Nexus, that is a schema-wide
convention change to consider deliberately across all of them, not a
one-off decision made silently inside this migration.

## 17. Commercial dependency (documented only, not built)

Migration 7 creates only the FK **targets**. It does not add:

- `commercial_configurations.customer_id -> customers(id)`
- `commercial_component_capabilities.capability_id -> capabilities(id)`

because `commercial_configurations` and `commercial_component_capabilities`
do not exist yet; there is nothing to attach a foreign key to. No
placeholder table, no deferred/`NOT VALID` constraint, and no forward
reference of any kind is created in Migration 7 for this purpose. The
future, separate Commercial migration is expected to add these two
foreign keys as part of creating the Commercial schema itself, per
`docs/COMMERCIAL_DATABASE_DESIGN.md` §23 and
`docs/MASTER_DATA_FOUNDATION_DESIGN.md` §19; this document only records
that dependency, it does not discharge it.

## 18. Break-test plan

**40 tests** (tests 1 through 39, plus 25a), organized by area; each
states the exact expected outcome. **Corrected this pass**: the prior
draft miscounted this as 41 by treating the harness note below as if it
were itself a test; it is not, it is shared setup guidance the numbered
tests reference, so it is not counted. The total changed from the
original 39 only because a symmetric Capability stale-`row_version`
test was added for coverage parity with Customer (25a); no test was
removed to preserve a round number, and none is added merely to inflate
the count, and the existing tests are not renumbered merely for
aesthetics.

**Harness note, corrected this pass, applies to every test below marked
"(SAVEPOINT)"**: a plain `BEGIN; <succeed>; <fail>; <more assertions>;
ROLLBACK;` does not work in PostgreSQL. Once any statement inside a
transaction raises an error, that transaction is aborted and every
subsequent command is rejected with "current transaction is aborted"
until a `ROLLBACK` (or `ROLLBACK TO SAVEPOINT`) is issued; there is no
way to "continue testing" past an error inside the same transaction
without one. Every test below that deliberately provokes a rejection (a
`CHECK`/`UNIQUE` violation or a lifecycle-trigger exception) and then
needs to make a further assertion in the same session (most importantly,
"and no audit row was created") therefore uses this exact shape:

```
BEGIN;
  <create whatever baseline row/state this test needs>
  SAVEPOINT before_expected_failure;
  <attempt the forbidden statement>              -- expected: raises
  ROLLBACK TO SAVEPOINT before_expected_failure;   -- clears the abort,
                                                    -- discards only the
                                                    -- failed attempt's
                                                    -- (nonexistent) effects
  <assert on audit_log, row state, etc., inside the same still-open
   transaction, now usable again>
ROLLBACK;                                          -- outer rollback:
                                                    -- nothing this test
                                                    -- did is ever committed
```

The outer `ROLLBACK` is what guarantees no test residue (§21); the inner
`SAVEPOINT`/`ROLLBACK TO SAVEPOINT` is what makes it possible to assert
anything *after* an expected failure without needing a second, separate,
committed session. A test with no expected failure in its own sequence
(for example, test 1's plain insert) needs no `SAVEPOINT`; the outer
`BEGIN`/`ROLLBACK` alone is sufficient for those.

**Customers**

1. Insert customer succeeds (valid `key`, `name`; `is_active`/
   `row_version` take their defaults).
2. Duplicate `key` insert rejected (`UNIQUE (key)` violation).
3. Same `name`, different `key`, insert succeeds (no uniqueness on
   `name`).
4. `UPDATE customers SET key = ...` rejected by
   `fn_protect_customer_lifecycle()`.
5. `UPDATE customers SET name = ...` succeeds; `row_version` increments;
   `updated_at` advances.
6. `row_version` increments by exactly 1 per successful `UPDATE`
   (verify old vs new).
7. Stale `row_version` update fails through the intended conditional
   pattern, **corrected this pass**: the caller never sets `row_version`
   in its own `SET` clause; only `WHERE row_version = <expected>` is
   theirs to control, exactly as `fn_bump_row_version()`'s own comment
   states ("callers cannot choose an arbitrary persisted row_version;
   only the WHERE-clause precondition they supply is theirs to
   control," §7). Concretely: after the baseline insert and one
   successful rename (test 5), the row is at `row_version = N+1`.
   Attempting `UPDATE customers SET name = 'different value' WHERE id =
   <id> AND row_version = N` (the *pre-rename* value, now stale) returns
   **zero rows**, because the precondition no longer matches. The
   database trigger owns the `N -> N+1` transition entirely; the
   application/domain layer's only job is supplying the correct
   `expected` value in `WHERE`, never writing to the column directly.
8. `UPDATE customers SET is_active = false` (from `true`) succeeds.
9. `UPDATE customers SET is_active = true` (from `false`, on the same
   row from test 8) succeeds, proving reactivation, the corrected rule.
10. `DELETE FROM customers WHERE id = ?` rejected by
    `fn_protect_customer_lifecycle()`.
11. An `audit_log` row with `action = 'INSERT'`, `table_name =
    'customers'` exists after test 1.
12. An `audit_log` row with `action = 'UPDATE'` exists after test 5,
    with `before_value`/`after_value` reflecting the name change and the
    bumped `row_version`.
13. **(SAVEPOINT harness)** Test 4's rejected `key` update produces
    **no** new `audit_log` row for that attempt: `BEGIN`; insert the
    baseline customer; `SAVEPOINT`; attempt the `key` update (raises);
    `ROLLBACK TO SAVEPOINT`; `SELECT count(*) FROM audit_log WHERE
    table_name = 'customers' AND row_id = <id> AND action = 'UPDATE'`
    returns `0` (only the baseline `INSERT` audit row exists, if any);
    outer `ROLLBACK`. This proves the exception aborts the statement
    before the `AFTER` audit trigger ever fires, without leaving the
    session unable to run the follow-up `SELECT`.
14. `select relrowsecurity from pg_class where relname = 'customers'`
    is `true` (RLS enabled).
15. `select count(*) from pg_policies where tablename = 'customers'` is
    `0` (zero policies).
16. `SELECT * FROM customers` as `anon` fails (denied by RLS with no
    policy, and by revoked table privilege).
17. `SELECT * FROM customers` as `authenticated` fails, same reasoning.
18. `INSERT`/`UPDATE`/`DELETE` as `anon` all fail.
19. `INSERT`/`UPDATE`/`DELETE` as `authenticated` all fail.

**Capabilities**

20. Insert capability with `status = 'active'` (or default) succeeds.
21. Duplicate `key` insert rejected.
22. Same `name`, different `key`, insert succeeds.
23. `UPDATE capabilities SET key = ...` rejected.
24. `UPDATE capabilities SET name = ...` succeeds; `row_version`
    increments.
25. `row_version` increments by exactly 1 per successful `UPDATE`.
25a. Stale `row_version` update on `capabilities` fails, same pattern as
    test 7: after one successful rename, attempt a second `UPDATE`
    using the pre-rename `row_version` value; zero rows returned. The
    caller never writes to `capabilities.row_version` directly, same
    rule as Customer.
26. `UPDATE capabilities SET status = 'deprecated'` (from `'active'`)
    succeeds.
27. `UPDATE capabilities SET status = 'active'` (from `'deprecated'`, on
    the same row from test 26) rejected by
    `fn_protect_capability_lifecycle()`, proving one-way-only.
28. `UPDATE capabilities SET status = 'retired'` (a value outside the
    two-member set) rejected, primarily by the `CHECK` constraint
    (defense-in-depth: the lifecycle function's own transition check
    would also reject it independently, since it is not one of the two
    permitted shapes).
29. `DELETE FROM capabilities WHERE id = ?` rejected.
30. After test 26 (deprecated), a plain `SELECT * FROM capabilities
    WHERE id = ?` through the trusted path still returns the row
    unchanged in every other column, proving deprecation does not hide
    or alter the historical row.
31. An `audit_log` `INSERT` row exists after test 20.
32. An `audit_log` `UPDATE` row exists after test 24 (rename) and after
    test 26 (deprecate), each a separate row.
33. **(SAVEPOINT harness)** Test 23's and test 27's rejected attempts
    each produce **no** new `audit_log` row: same shape as test 13,
    substituting the `key`-mutation attempt (test 23) or the
    `deprecated -> active` attempt (test 27) as the statement inside the
    `SAVEPOINT`, each checked as its own `BEGIN` … `ROLLBACK` block.
34. RLS enabled on `capabilities` (`pg_class.relrowsecurity = true`).
35. Zero policies on `capabilities`.
36. `anon`/`authenticated` direct `SELECT`/`INSERT`/`UPDATE`/`DELETE` all
    fail.

**General**

37. `select * from resource_types where type_code in ('customer',
    'capability')` returns zero rows.
38. `select * from resources where resource_type in ('customer',
    'capability')` returns zero rows (this predicate is really "no
    resources row was ever minted for a customers/capabilities row,"
    checked by confirming neither table's `id` values appear as a
    `resources.resource_id`).
39. No persistent test row remains in either table after the break-test
    pass, achieved entirely via transaction rollback (§21), since `DELETE`
    is intentionally unavailable as a cleanup mechanism and must not be
    worked around.

## 19. Privilege test matrix

| Role | SELECT | INSERT | UPDATE | DELETE | EXECUTE (`fn_protect_customer_lifecycle`/`fn_protect_capability_lifecycle`) |
|---|---|---|---|---|---|
| `postgres` / migration owner | PASS | PASS | PASS | FAIL (blocked by lifecycle trigger, not privilege) | PASS (owns the function; irrelevant in practice, since triggers do not require the writer to hold EXECUTE) |
| `service_role` (trusted path) | PASS | PASS | PASS (conditional, per §7) | FAIL (same trigger, not a privilege gap; `service_role` is never granted a bypass of the domain rule) | N/A, not called directly |
| `authenticated` | FAIL (RLS + revoked privilege) | FAIL | FAIL | FAIL | FAIL (revoked explicitly, §10) |
| `anon` | FAIL | FAIL | FAIL | FAIL | FAIL (revoked explicitly, §10) |

**Execution note**: every `FAIL` cell in this matrix is an expected
error. If more than one cell is checked in a single scripted session
against the same connection (rather than one fresh connection per
check), each `FAIL` attempt must use the same `SAVEPOINT`/
`ROLLBACK TO SAVEPOINT` harness as §18's audit-negative tests (§21),
since an unhandled error would otherwise abort that session's
transaction and block every subsequent check in the same script. A
harness that opens one fresh connection/transaction per matrix cell
avoids needing `SAVEPOINT` at all; either approach is acceptable as long
as one expected failure never silently prevents a later check in the
same run from executing.

`service_role`'s `DELETE` row is deliberately `FAIL`, not `PASS`: the
locked design requires the no-hard-delete rule to be a **domain**
guarantee, enforced by the database regardless of which trusted role
attempts it, not merely an application-convention that a sufficiently
privileged path could bypass (per the task's own instruction: "a trusted
server path could still attempt DELETE; database must enforce the locked
no-delete rule"). Privilege revocation alone would not be sufficient to
prove this, since `service_role` is never privilege-revoked (it needs
ordinary table privileges to do its job); the lifecycle trigger is what
actually makes `DELETE` fail even for a role that holds the underlying
`DELETE` privilege.

## 20. Audit test plan

**Customers**: INSERT audit (test 11), rename UPDATE audit (test 12),
deactivate audit (`is_active: true -> false`, its own `audit_log`
`UPDATE` row with that exact before/after difference visible in
`before_value`/`after_value`), reactivate audit (`is_active: false ->
true`, a separate `audit_log` `UPDATE` row, proving reactivation itself
is captured, not merely permitted), rejected `key` mutation produces no
successful mutation audit (test 13).

**Capabilities**: INSERT audit (test 31), rename audit, deprecate audit
(`status: active -> deprecated`), rejected reactivation
(`deprecated -> active`) produces no successful mutation audit (test
33).

**Audit-negative procedure, corrected this pass (applies to test 13 and
test 33 identically, and to any future audit-negative test added to
either table).** The exact nine-step shape, matching §18's harness note:

1. `BEGIN`.
2. Create baseline state (insert the row the forbidden mutation will be
   attempted against).
3. Optionally record the current `audit_log` row count for this
   `row_id`, if useful for the assertion in step 8.
4. `SAVEPOINT before_expected_failure`.
5. Attempt the forbidden mutation (a `key` update, or a
   `deprecated -> active` transition).
6. Confirm the expected error was raised (the exception message/SQLSTATE
   the lifecycle-protection function produces).
7. `ROLLBACK TO SAVEPOINT before_expected_failure`, clearing the aborted
   state and discarding the failed attempt's (nonexistent) effects,
   while keeping the outer transaction and its baseline state usable.
8. Inspect `audit_log`: confirm no new `UPDATE` row exists for this
   `row_id` beyond whatever existed at step 3's baseline, proving the
   rejected mutation produced no successful mutation audit.
9. Outer `ROLLBACK`, so the baseline row created in step 2 is never
   committed either.

**Confirmed captured on every audit row**: `table_name` (`'customers'`
or `'capabilities'`), `row_id` (the table's own `id`), `action`
(`INSERT`/`UPDATE`), `before_value`/`after_value` (full row JSON, as
`fn_audit_row` already does unmodified), `actor_user_id`/`request_id`/
`actor_context` where the calling transaction set the corresponding
`app.*` session GUCs, `NULL` where it did not (a valid state, per
`docs/PLATFORM_ARCHITECTURE.md` §7), and `db_role` (`session_user` at
write time, from Migration 2's existing `audit_log.db_role` column,
requiring no change here). No new audit column, table, or mechanism is
added; every one of these is already produced by the existing,
unmodified `fn_audit_row()`.

## 21. Transaction-safe test-data strategy

Because `DELETE` is permanently unavailable on both tables (by design,
§18 test 10/29), break tests must never leave a committed row behind,
and cleanup must never be achieved by weakening or working around that
guarantee (no disabling triggers, no temporary `DELETE` grant, no
temporary trigger drop).

**Corrected this pass: a plain `BEGIN; <succeed>; <expected failure>;
<more assertions>; ROLLBACK;` does not work.** Once a statement inside a
transaction raises an error, PostgreSQL marks that transaction aborted;
every subsequent statement (including a harmless `SELECT` meant only to
assert on prior state) is rejected with "current transaction is
aborted, commands ignored until end of transaction block" until a
`ROLLBACK` or `ROLLBACK TO SAVEPOINT` is issued. The first draft of this
document did not account for this and must be corrected.

**Two harness shapes, chosen per test, both ending in one outer
`ROLLBACK`:**

- **Success-only tests** (no statement in the sequence is expected to
  fail): a single `BEGIN` … `ROLLBACK` is sufficient. Example: test 1
  (plain insert), test 5 (rename), test 8/9 (deactivate/reactivate).
- **Tests that deliberately provoke an expected failure and then need a
  further assertion in the same session** (most importantly, "and no
  audit row resulted"): `BEGIN`; create baseline state;
  `SAVEPOINT before_expected_failure`; attempt the forbidden statement;
  confirm it raised; `ROLLBACK TO SAVEPOINT before_expected_failure`
  (this clears the aborted state, discarding only the failed attempt,
  while the baseline state created before the savepoint remains intact
  and the session is usable again); perform the follow-up assertion;
  outer `ROLLBACK`. This is §18's harness note and §20's nine-step
  audit-negative procedure, restated here as the general rule this
  design now follows throughout: tests 4, 10, 13, 21, 23, 27, 28, 29,
  33, and every anon/authenticated privilege-denial check (16-19, 36,
  §19) that needs a same-session follow-up assertion all use this exact
  shape, substituting only which forbidden statement sits inside the
  `SAVEPOINT`.

**Stale-`row_version` tests (7, 25a) need neither `SAVEPOINT` nor a
second committed session**: the "stale" attempt does not raise an
error at all, it simply matches zero rows (`UPDATE ... WHERE row_version
= <stale>` with no matching row is a normal, successful, zero-row-affected
statement, not an exception), so the transaction is never aborted in the
first place. The baseline insert, the first successful conditional
update, and the second, now-stale conditional update all run inside one
ordinary `BEGIN` … `ROLLBACK`, in sequence, with no savepoint required;
the proof is the second update's `0`-row result, observed before the
outer rollback discards everything.

**No fictional Customer or Capability row is ever left committed** in
the remote database purely to prove this migration works. Every test's
evidence is a statement's own returned row count, raised error, or a
same-transaction `SELECT` against `audit_log`/`pg_class`/`pg_policies`,
observed before the outer rollback, never a row a later, separate,
committed query re-reads after commit. `DELETE` is never used, disabled,
or bypassed as a cleanup mechanism anywhere in this strategy.

## 22. Migration atomicity

**DESIGN STATUS: LOCKED. EXECUTION STATUS: VERIFIED / PASSED for
Supabase CLI 2.117.0 on the tested Docker-backed local execution path.**
This section is an execution gate on *applying* Migration 7, not an open
database-design question. Nothing about the `customers`/`capabilities`
shape, constraints, lifecycle rules, audit, concurrency, or privilege
boundary ever depended on this section's outcome; those were already
locked independently (§3 through §21). This gate is now closed for the
tested path; Migration 7 is eligible for controlled apply as a separate,
later stage.

**Provenance of this evidence.** Two prior passes attempted this
empirical check from within the Claude Code task environment used to
author this design and could not complete it: that sandboxed environment
has no Docker, no local Postgres binary, and no package manager able to
install either. The empirical test recorded below was performed
separately, outside that sandboxed session, in an environment with
Docker actually available, following the exact reproduction procedure
this document itself specified. This section records that reported
result; it does not claim the test was executed inside the same session
that authored this document.

**Exact CLI version tested**: **2.117.0**, the same version identified in
the prior passes. This project still does not pin a Supabase CLI version
anywhere (`package.json`/`package-lock.json` contain no `supabase`
entry); every invocation resolves via `npx` to whatever version `npx`
fetches at that moment. This matters directly to the regression context
that motivated this check: a reported migration-execution regression in
CLI 2.115.0/2.116.0 (a pipelined extended-protocol path not equivalent to
a transaction block) would not be caught by reasoning from generic
PostgreSQL protocol semantics alone, which is exactly why this was
tested empirically against the exact installed version rather than only
reasoned about.

**Test environment**: Docker Desktop, Docker Engine 29.7.2, aarch64.

**Isolation method**: a detached temporary Git worktree at
`/tmp/nexus-atomicity-21170`, created from commit
`8914240642b87c9eb2516c567ca524c6363bfb7c`, the commit immediately before
Migration 7 was added to this repository. That commit's
`supabase/migrations/` contained exactly the six canonical migrations
(`20260906084244_platform_core_foundation.sql` through
`20260907054608_request_resource_type_integrity.sql`) and did not
contain Migration 7. This kept the experiment fully isolated from the
real Migration 7 file and from the remote linked project: no remote
command was used at any point in this test.

**Baseline**: starting the local Supabase stack from that worktree
applied exactly the six canonical migrations; local migration history
confirmed exactly those six versions before the probe was introduced.

**Probe migration**: `20260908021336_TEMP_atomicity_probe.sql`, created
only inside the temporary worktree, never committed to this repository.
Its SQL: create a uniquely named fictional table
(`public._temp_atomicity_probe_21170`), insert one row (`id = 1`), then
`SELECT 1 / 0` as a deterministic final failure. A local dry-run before
applying it planned exactly that one migration. No Nexus business table,
no Commercial object, and no confidential data of any kind was
referenced.

**Observed failure**: the local apply failed exactly as designed, with
`SQLSTATE 22012` (division by zero).

**Post-failure evidence**:

1. `select to_regclass('public._temp_atomicity_probe_21170')` (the probe
   table) returned `NULL`: the table created earlier in the same
   migration did not survive the later failure.
2. Because the table itself did not survive, the row inserted into it
   did not survive either.
3. `supabase_migrations.schema_migrations` contained zero rows for
   version `20260908021336`: the failed migration was not recorded as
   applied.

**Conclusion**: Supabase CLI 2.117.0 was empirically confirmed to
execute the tested Docker-backed local migration path atomically at
whole-file level. A deterministic failure in a later statement rolled
back the earlier DDL and DML from the same migration file, and the
failed migration version was not recorded in
`supabase_migrations.schema_migrations`. **This evidence supports
exactly the tested path and CLI version; it is not a claim that every
Supabase CLI execution path, version, environment, or deployment mode is
universally atomic.** A future CLI upgrade that changes migration
execution mechanics should trigger re-verification before being relied
upon.

**Cleanup, reported alongside the result**: the local Supabase stack was
stopped with no backup of its state; the temporary Git worktree was
removed; the probe migration was destroyed along with the worktree
(never present in the real repository); `git worktree prune` was run;
no Supabase Docker containers remained running afterward. The real
Nexus working tree was confirmed unchanged throughout, Migration 7 was
not applied during this test, and `.claude/launch.json` remained the
only untracked file in the real repository.

**What this closes, and what it does not.** This closes the atomicity
pre-apply gate for CLI 2.117.0 on the tested local path. It does not
mean Migration 7 has been applied anywhere, and it does not mean the 40
break tests (§18) have passed: those require Migration 7 itself to be
applied to a real database first, which has not happened. A remote
`db push --dry-run` for the actual Migration 7 file already passed
separately (planning exactly
`20260908013210_master_data_foundation.sql` and nothing else), and
remains a distinct, already-recorded piece of evidence from this
atomicity check. Migration 7's actual controlled apply, and running the
40 break tests against the applied schema, remain separate, later,
not-yet-performed stages.

## 23. Failure / retry behavior

**DESIGN STATUS: LOCKED (the principles below). EXECUTION STATUS:
retry policy for one specific contingency (whether earlier statements
survive a later failure) cannot be finalized until §22's gate is
satisfied; both contingencies are documented and neither blocks locking
this design.** The following principles are locked for Migration 7 and
any future migration that does not have a specific, documented reason to
differ:

- **Unexpected pre-existing `customers`/`capabilities` schema fails
  loudly.** Migration 7 uses plain `CREATE TABLE`, `CREATE FUNCTION`, and
  `CREATE TRIGGER`, none guarded by `IF NOT EXISTS` or `OR REPLACE`,
  matching the existing convention: Migration 4's own comment states
  this policy explicitly for its own `resource_types` seed row ("No ON
  CONFLICT guard: an incompatible pre-existing row would mean this
  migration's assumptions about the current schema state are wrong, and
  migration failure is preferable to silently accepting that"). Migration
  7 follows the identical policy: if `customers` or `capabilities`
  already exists unexpectedly, or a function/trigger name collides, the
  migration must fail with a clear PostgreSQL error, not silently skip or
  replace the unexpected object.
- **No broad `IF NOT EXISTS` is used to conceal drift.** This is a
  deliberate absence, not an oversight; a migration that could
  "succeed" against an already-drifted schema would hide exactly the
  kind of local/remote mismatch that must instead surface immediately.
- **No silent constraint/function/trigger replacement.** Nothing in
  Migration 7 uses `CREATE OR REPLACE` for a function or `DROP ... IF
  EXISTS` before a `CREATE`; every object is created exactly once, and a
  name collision is a failure to investigate, not a condition to route
  around.
- **A migration-history mismatch (local migration files versus the
  remote `supabase_migrations.schema_migrations` table) is investigated,
  not worked around.** `supabase migration list` (or `db push
  --dry-run`'s own comparison) is the diagnostic step; a mismatch is
  resolved by understanding why local and remote disagree, never by
  force-applying regardless.
- **A failed migration is diagnosed before any retry is attempted.**
  §22's empirical atomicity check is now VERIFIED / PASSED for CLI
  2.117.0 on the tested Docker-backed local path: a failure partway
  through a migration file leaves the schema exactly as it was before
  the attempt, so a diagnosed-and-fixed retry is simply re-running
  `db push` against the corrected file, with no manual partial-schema
  cleanup expected. This is confirmed for the tested path and CLI
  version specifically (§22); a future CLI upgrade that changes
  migration execution mechanics should trigger re-verification before
  this retry policy is relied upon again without question.
- **Local migration history and remote migration history must remain
  aligned.** The normal workflow (§24) is the only sanctioned path:
  author the local migration file, review it, `db push --dry-run`, then
  `db push`. The Supabase MCP `apply_migration` tool is never used for
  this, per `CLAUDE.md` and every prior Commercial/Master Data document's
  own repeated instruction: it records an apply-time timestamp instead of
  the filename's timestamp, desyncing local and remote history in a way
  that is difficult to detect later and would itself become exactly the
  kind of drift this section's other principles guard against.

## 24. Remote migration workflow (future sequence only, not performed now)

1. Author the migration locally as a new timestamped file
   (`supabase migration new master_data_foundation`, or a hand-written
   file following the existing naming pattern), replacing this
   document's illustrative filename with the actual generated timestamp.
2. Review the file (this document's §3 through §17 is the blueprint that
   review is checked against).
3. `npx supabase db push --dry-run` and inspect the planned change.
4. `npx supabase db push`.
5. Never use the Supabase MCP `apply_migration` tool for this, per
   `CLAUDE.md` and `docs/COMMERCIAL_DATABASE_DESIGN.md`'s own repeated
   instruction: it records an apply-time timestamp instead of the
   filename's timestamp, desyncing local and remote migration history.

None of these five steps are performed as part of this design task.

## 25. Migration verification checklist (for the future implementation turn)

**DESIGN STATUS: LOCKED. EXECUTION STATUS: every gate below is now
satisfied through dry-run; only the actual apply and post-apply steps
remain, as a separate, later stage.** Authoring, diffing, building,
linting, principal SQL review, the §22 atomicity check, and
`db push --dry-run` have all been completed and passed; nothing here
blocks proceeding to a controlled apply when that stage is deliberately
started.

**Before writing SQL:**
- `git status` (confirm a clean, expected working tree before starting).
- Confirm the existing migration count (six) and that local migration
  files match `supabase migration list`'s remote history (no drift).

**After writing SQL, before applying anywhere:**
- Inspect the full diff of the new migration file.
- `grep` for secrets/credentials/connection strings; confirm none.
- Grep for the em dash character; confirm none.
- `npm run build`.
- `npm run lint`.

**Before remote apply:**
- Perform the §22 empirical atomicity check against a local Supabase
  stack (a throwaway local migration with a deliberate late failure,
  confirming whether earlier statements persist), against the exact
  installed CLI version confirmed via `npx supabase --version`
  immediately beforehand. **Completed**: VERIFIED / PASSED for CLI
  2.117.0 on a Docker-backed local path (§22). A future CLI upgrade that
  changes migration execution mechanics should trigger
  re-verification before this step is treated as satisfied again
  without question.
- `npx supabase db push --dry-run`; read the planned DDL in full before
  proceeding. **Completed** against the linked remote project: planned
  exactly `20260908013210_master_data_foundation.sql` and nothing else.

**After remote apply:**
- Confirm migration history now includes the new migration at its
  correct version.
- Inspect `customers`/`capabilities` table shape, constraints, and
  indexes directly (read-only `execute_sql`/`list_tables` via the
  Supabase MCP is acceptable for this inspection step, per `CLAUDE.md`'s
  own carve-out for read-only MCP use).
- Inspect triggers on both tables and confirm the exact set and ordering
  designed in §11.
- Inspect RLS status and policy count (§9, §18 tests 14-15/34-35).
- Inspect table and function privileges (§10, §19).
- Execute the full break-test plan (§18) and privilege matrix (§19)
  against the applied schema.
- Confirm no test residue remains (§21).
- `npm run build`.
- `npm run lint`.

## 26. Remaining implementation questions

**DESIGN STATUS: LOCKED, no remaining design question. EXECUTION
STATUS: no apply-time gate remains open.** None block *writing*
Migration 7 against this blueprint, and the one item that gated safely
*applying* it, the §22 empirical atomicity check, is now VERIFIED /
PASSED for CLI 2.117.0 on a Docker-backed local execution path (§22).
Migration 7 is committed
(`supabase/migrations/20260908013210_master_data_foundation.sql`,
principal-reviewed, remote `db push --dry-run` passed) and eligible for
controlled apply as a separate, later, not-yet-performed stage. No
runtime break test (§18) has passed yet, because Migration 7 has not
been applied to any database; that remains a distinct, later step from
this atomicity verification.

Genuinely deferred, non-blocking implementation detail: the exact
PL/pgSQL body text for `fn_protect_customer_lifecycle()`/
`fn_protect_capability_lifecycle()` (this document settles *what* each
must guarantee and *why*, §6, the same settled-versus-SQL split already
used in `docs/FORM_VERSIONING_MODEL.md` §23); the exact regenerated
migration filename timestamp at the moment the file is actually authored
(§2); and the exact test harness/script used to execute §18/§21's break
tests (a one-off manual `psql`/Supabase-SQL-editor session, or a
lightweight script, is an implementation choice, not a design gap).

## Review for overdesign (§33 self-check)

- Nothing added beyond `docs/MASTER_DATA_FOUNDATION_DESIGN.md`'s own
  field list: no `description`, `category`, geography, or CRM field on
  either table.
- No new generic/reusable infrastructure was invented where an existing
  one already applies: `fn_bump_row_version()` and `fn_audit_row()` are
  reused unmodified; only the two lifecycle-protection functions are new,
  and each is justified individually (§6) rather than forced into one
  over-generalized function.
- No Commercial foreign key, table, or forward dependency is created in
  this migration (§17); the dependency is documented, not built.
- No Resource Registry participation was introduced for either table
  (§13), confirmed explicitly.
- Customer deactivation is confirmed reversible in both directions
  throughout this document (§3, §6, §18 tests 8-9); no accidental
  one-way phrasing remains.
- Capability reactivation is confirmed rejected throughout (§6, §18 test
  27); no accidental permissiveness was introduced.
- Every break test that mutates a row is designed to run inside an outer
  `BEGIN`/`ROLLBACK`, with a `SAVEPOINT`/`ROLLBACK TO SAVEPOINT` around
  any statement expected to fail so a same-transaction follow-up
  assertion remains possible (§18, §21, corrected this pass); `DELETE`
  being forbidden never blocks test cleanup, and no test is left in an
  unusable aborted transaction state.
- Migration atomicity is no longer asserted from a mischaracterized
  guarantee ("per-statement DDL transactionality" was imprecise) or left
  as an unverified finding; §22 now records an empirical, Docker-backed
  local test result for the exact CLI version this project uses, scoped
  explicitly to the tested path and version, not generalized further.
- No ordinary role privilege is left open: `anon`/`authenticated` table
  and function access is explicitly revoked in addition to the
  already-sufficient Migration 2 default-privilege baseline (§10).
- Trigger ordering is proven, not assumed: §6 and §11 both show the
  lifecycle functions' verdicts are independent of `row_version`/
  `updated_at`, the same argument already established (and now reused)
  from `fn_protect_form_version_lifecycle()`.

## What this document is not

Not a migration file. Not executable SQL. Not an implementation. Not a
decision on Commercial, the Form Data Source Resolver, Customer 360, or
any other future capability. Every shape above is a blueprint for the
next, separate implementation turn to translate into the actual
`supabase/migrations/*.sql` file, following the exact patterns already
proven in Migrations 1 through 6.
