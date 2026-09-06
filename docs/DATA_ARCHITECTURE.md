# Nexus: Data Architecture

This document defines database standards for Nexus, to be applied before
any real feature table is created. It contains no real schema for a real
Nexus feature and no confidential business data. All table and column
names below are illustrative patterns, not a finalized schema.

**Status: locked design.** See `docs/PLATFORM_ARCHITECTURE.md` for how
these standards fit the overall platform. Nothing in this document has
been implemented. No database table exists because of this document.

## 1. Principles

- Prefer strong relational structure for important business facts. A fact
  that must be queried, joined, constrained, or audited belongs in a typed
  column, not a JSON blob.
- Use JSON only where variable shape genuinely outweighs relational
  integrity, for example a payload whose structure legitimately varies by
  type and is consumed by rules rather than joined on field by field.
  Default to relational; JSON is the exception that needs a reason.
- Every important business record carries enough metadata to answer who,
  what, when, and what changed, without the feature author remembering to
  add it. Audit is enforced by the database (§9), not left to
  application-code discipline.
- Reversibility matters. Prefer patterns that extend without a breaking
  migration over patterns that are simplest today but narrow the future.

## 2. Resource Registry and application identity

Workflow, tasks, audit, events, attachments, and comments all attach to
"any business record." Instead of a raw `entity_type + entity_id` pair
repeated in each of those capabilities, Nexus uses one central registry,
gated by a small, migration-managed catalog of the types it accepts:

```
resource_types
  type_code   text, primary key
  description text, not null

resources
  resource_id   uuid, primary key
  resource_type text, not null references resource_types(type_code)
  created_at    timestamptz, not null
  created_by    uuid, not null references app_users
```

`resource_types` exists to prevent uncontrolled free-text drift in
`resources.resource_type`: a new resource type is added through a
migration, as structural application metadata, never through a Settings
screen. It is not user-editable configuration.

A business table that needs any platform capability reuses `resource_id`
as its own primary key: minting a resource (insert into `resources`) and
inserting the feature row happen in the same transaction, using the same
UUID. There is exactly one identifier per record; code that already holds
a business record already holds its resource ID, so no translation join is
needed to act on it.

Platform capability tables reference `resources.resource_id` as a real,
indexed foreign key: `workflow_instances.resource_id`, `tasks.resource_id`,
`audit_log.resource_id`, `domain_events.resource_id`, and similarly for
attachments and comments when built.

`resources` stays deliberately thin: the columns above, nothing else. No
status, no title, no feature metadata. Reference and master data tables
(§6) that carry no workflow, audit, task, or event relationship do not
register here.

**Application identity** follows the same "reuse the ID, do not mint a
second one" principle, one level up. Supabase Auth owns `auth.users` and
answers "who is this person"; Nexus maintains its own minimal profile
table, `app_users`, in a strict 1:1 relationship with it:

```
app_users
  id         uuid, primary key, references auth.users(id)
  created_at timestamptz, not null
  updated_at timestamptz, not null
```

`app_users.id` is the same UUID as the corresponding `auth.users.id`; no
separate application user ID is minted. `app_users` holds only the
minimal profile Nexus needs and nothing speculative: no employee fields,
no organizational metadata that has no immediate consumer. Roles and
permissions are never stored here or in Supabase Auth metadata; see
`docs/AUTHORIZATION_MODEL.md`.

## 3. Standard columns

Every business table (not lookup/reference tables, §6) includes:

| Column | Purpose |
|---|---|
| `id` (= `resource_id` where the table participates in platform capabilities) | Primary key. UUID, safe to expose, safe to generate before the row is written, and reveals nothing about sequence or volume. |
| `created_at` | Set once, never updated. |
| `updated_at` | Updated on every write. |
| `created_by` | References `app_users`, or `system` for automated processes. |
| `updated_by` | References `app_users` for the most recent write. |

`created_by` / `updated_by` capture who made the current row what it is.
They are not a substitute for the audit trail (§9), which captures full
history.

## 4. Naming

- Tables: `snake_case`, plural (`work_items`, `workflow_instances`).
- Columns: `snake_case`, singular concepts (`status`, `owner_id`).
- Foreign keys: `<referenced_table_singular>_id`
  (`workflow_instance_id`, `role_id`, `resource_id`).
- Booleans read as a predicate: `is_active`, `is_current`, never `active`
  or `flag`.
- Status-like values are backed by a reference table (§6) or a database
  enum, not free text, unless the value is genuinely user-authored.

## 5. Keys, constraints, and concurrency

- **Primary keys**: UUID on every table, generated at write time.
- **Foreign keys**: declared and enforced at the database level, always.
  A relationship worth modeling is worth constraining.
- **Deletion default**: `RESTRICT` (or `NO ACTION`). Audit history,
  workflow instances, tasks, and event history are never removed as a side
  effect of deleting a business record. `CASCADE` is reserved for rows
  with no independent meaning apart from their parent (for example, a
  workflow transition row cascading if its instance were ever hard
  deleted, which is itself rare given soft deletion is the default, §10).
- **Unique constraints**: applied wherever a business rule requires
  uniqueness (one current version of a configuration key, one active role
  assignment per user/role/scope combination), enforced by the database
  rather than trusted to application-level checks. A "current version"
  uniqueness constraint is a partial unique index scoped to the current or
  non-deleted row, so history rows never collide with each other:
  `UNIQUE (...) WHERE deleted_at IS NULL`.
- **Indexing**: every foreign key is indexed. Further indexes are added
  for the columns a feature actually filters or sorts by, decided when
  that query pattern exists, not speculatively.
- **Concurrency**: tables that participate in a workflow carry an integer
  `version` column, incremented on every write. The application service
  that performs an update checks the version it read against the version
  in the database and rejects the write if they differ, rather than
  silently overwriting a newer change. This is required for
  workflow-participating tables because maker-checker is exactly the
  condition concurrent edits are likely under. It is not required for
  reference or configuration tables with low write contention.

## 6. Reference and master data

Extensible lists a feature selects from (statuses, categories, reasons)
live in generic reference tables rather than as hardcoded enums scattered
through application code: a stable code, a display label, an active flag,
and a sort order. A feature's foreign key points at the reference table's
code. Adding a new value is a configuration change (`platform/policy/`),
not a code deploy. Reference tables do not register in the Resource
Registry and are not audited row-by-row the way business records are;
their changes are still captured through the same audit mechanism (§9)
because they are still writes to a database table.

## 7. Versioning and effective dating

Two needs both get called "versioning" and are kept distinct:

- **Configuration versioning**: a policy or reference value can have more
  than one version over time, each with an effective start (and optionally
  end) date, so the platform can answer both "what is this worth now" and
  "what was this worth on a given date." Shape: a logical key, a version
  number or effective-from date, and an `is_current` flag maintained by the
  write path.
- **Business record amendment**: an approved record is never overwritten
  in place. A later change creates a new row linked to the original (a
  `supersedes_id` or equivalent reference), preserving the exact approved
  state. See §9.

Both patterns are append-oriented: history is added, never destroyed.
Applying either pattern to a given table is deferred until that table
actually needs it (`docs/PLATFORM_ARCHITECTURE.md` §12); the shape is
decided now so the first feature that needs it does not invent its own.

## 8. Configuration tables

Configuration falls into the categories set out in
`docs/PLATFORM_ARCHITECTURE.md` §5. This section defines the two shapes
that are genuinely generic; every other category is ordinary strongly
typed relational tables (workflow definitions and transitions,
notification rules, authorization tables), not covered again here.

- **Reference/master data**: the shape in §6.
- **Policy configuration**: a mandatory catalog gates a generic value
  store. Nothing can exist in the value store without first being declared
  in the catalog.

  ```
  policy_definitions
    key                 text, primary key
    data_type           text, not null   -- text | number | boolean | date | timestamp
    owner               text, not null
    default_value       text
    validation_rule      text
    requires_approval    boolean, not null default false
    description         text

  policy_values
    key             text, references policy_definitions(key)
    value_text      text
    value_number    numeric
    value_boolean   boolean
    value_date      date
    value_timestamp timestamptz
    effective_from  date, not null
    effective_to    date
    is_current      boolean, not null
    UNIQUE (key) WHERE is_current
    CHECK (exactly one of value_text, value_number, value_boolean,
           value_date, value_timestamp is non-null, matching the
           data_type declared on policy_definitions)
  ```

  A policy value whose key has no `policy_definitions` row cannot be
  written. Storing one typed column per data type, rather than a single
  `value text`, lets the database itself enforce that a value actually
  matches its declared type instead of trusting every reader to parse a
  string correctly. Anything with more structure than one typed scalar (a
  rule with more than one meaningful field, or its own relationships)
  graduates out of this pattern into its own relational table instead of
  being forced into `policy_values`. This table is not created until a
  real policy value needs it; see
  `docs/PLATFORM_ARCHITECTURE.md` §12.

This mandatory-catalog gate is what keeps configuration flexible without
becoming an ungoverned key-value dumping ground: the storage is generic,
but nothing can be stored that was not first typed, owned, and (if
required) marked for approval.

## 9. Audit and append-only records

Two related but distinct mechanisms:

- **Audit log (database-enforced)**: every table holding business or
  configuration state has a reusable PostgreSQL trigger function attached
  through its migration, so a write is captured regardless of which path
  produced it (UI, API, scheduled job, integration, bulk import, or any
  other trusted path), and regardless of whether the calling
  application-service code remembered to log anything. The trigger writes
  to a single `audit_log` table:

  ```
  audit_log
    id              uuid, primary key
    audit_sequence  bigint, generated always as identity, unique
    resource_id     uuid, references resources(resource_id)
    table_name      text, not null
    row_id          uuid, not null   -- the audited row's own primary key
    action          text, not null   -- insert, update, delete
    before_value    jsonb
    after_value     jsonb
    occurred_at     timestamptz, not null
    actor_user_id   uuid             -- references app_users; null for
                                     -- system-originated writes
    db_role         text, not null   -- session role that performed the
                                     -- write; technical origin metadata
    request_id      uuid             -- correlates rows from one
                                     -- request/job/integration call
    actor_context   jsonb            -- role/workflow context, supplied by
                                     -- the application service into the
                                     -- transaction where the database
                                     -- cannot infer it
  ```

  `resource_id` is populated when the audited table participates in the
  Resource Registry (§2); `row_id` is always populated, so a table that
  has not (yet) registered as a resource is still fully audited.
  `before_value`/`after_value` are JSON deliberately: the shape of
  "before/after" necessarily varies by table, and this data is read, not
  joined on. This mechanism is distinct from domain events, which
  represent business meaning, not row mutation; see
  `docs/PLATFORM_ARCHITECTURE.md` §7 and `docs/EVENTS_AND_NOTIFICATIONS.md`.

  **Ordering.** `id` is a UUID, generated for external reference safety,
  not for ordering. Multiple rows produced within one transaction can
  share an identical `occurred_at`, so `audit_sequence`, a monotonically
  increasing identity column, exists to give a reviewer a deterministic
  row-insertion order that neither the UUID nor the timestamp can provide
  alone. Precisely: `audit_sequence` orders when rows were inserted
  (assigned at write time), not when their transactions committed.
  PostgreSQL sequences are non-transactional, a value is consumed
  immediately and never rolled back, so under concurrent transactions a
  row assigned an earlier `audit_sequence` value is not guaranteed to
  belong to a transaction that committed first. This is sufficient for
  reconstructing the order of statements within one transaction (which is
  what motivated adding it) and is not claimed to be more than that.

  **Actor identity is never client-supplied.** `actor_user_id` is only
  ever populated from `app.current_user_id`, which only the
  application-service layer sets, and only after independently verifying
  the caller's identity from a trusted, authenticated session; see
  `docs/PLATFORM_ARCHITECTURE.md` §7 for the full trust contract. `db_role`
  is captured automatically (the session's current role at write time) and
  needs no application cooperation.

  **Sensitivity.** Because `before_value`/`after_value` capture a row in
  full, no audited table may ever store a secret or credential in a plain
  column; see `docs/PLATFORM_ARCHITECTURE.md` §7.

  **Immutability is enforced at the database level, not only assumed.**
  `audit_log` has no application role granted `UPDATE` or `DELETE`, and
  carries its own `BEFORE UPDATE OR DELETE` trigger that raises an
  exception, so an attempt to alter or remove an audit row fails even if a
  future migration accidentally grants broader privileges.

- **Append-only amendment**: for records where "what was approved" must
  remain exactly reconstructable, the record is never destructively
  updated post-approval. An amendment is a new row referencing the one it
  amends (§7). This is a stronger guarantee than the audit log alone: the
  audit log says what changed, the append-only record guarantees the
  prior approved state still physically exists as its own row.

Not every table needs the append-only pattern; it is reserved for records
where reconstructing an exact historical approved state is a real
requirement.

## 10. Soft deletion vs hard deletion

- Business records that have ever been visible to a workflow, an approval,
  or an audit trail are soft deleted: a `deleted_at` timestamp, null while
  active, never physically removed. Deleting a record is itself an audited
  action.
- Data with no business or audit significance (an unsubmitted draft, a
  cache, a purely derived value) can be hard deleted.
- The default for a new feature table is soft deletion. Hard deletion is
  the deliberate exception.

## 11. Workflow, task, and event linking

`workflow_instances`, `tasks`, and `domain_events` all reference
`resources.resource_id` (§2) rather than a bespoke foreign key per feature
table. `workflow_instances` additionally reference the `workflow_
definition` they were created from; `tasks` additionally reference an
assignee (user or role) and a due date, and optionally the
`workflow_instance` that produced them; `domain_events` additionally carry
an event type and a JSON payload, appropriate here because event shapes
vary by type and are consumed by rules rather than joined on. This keeps
all three engines feature-agnostic: a new feature table becomes attachable
to workflow, tasks, and events without any change to those capabilities.

## 12. Row Level Security

Nexus runs on Supabase, so PostgreSQL Row Level Security is enabled on
every application table by default, from the first migration. RLS is a
defense-in-depth boundary, not the primary authorization mechanism:
primary authorization stays in the application-service layer
(`docs/AUTHORIZATION_MODEL.md` §6), which has the full
resource/action/scope model available to it. RLS policies deny direct
table access unless a specific, reviewed policy has been designed and
approved for that table; a permissive `USING (true)` policy for any
authenticated user is not created merely to make development easier.
Service credentials capable of bypassing RLS are never present in source
code or this public repository.

**Direct privilege hardening.** Supabase grants broad ordinary privileges
(`SELECT`/`INSERT`/`UPDATE`/`DELETE`/etc. on tables, `USAGE`/`SELECT`/
`UPDATE` on sequences, `EXECUTE` on functions) to `anon` and
`authenticated` on every `public` schema object by default, relying on RLS
alone to restrict actual table access, and confirmed read-only against the
project's `pg_default_acl` before this was implemented, not assumed. Since
Nexus's browser and mobile clients have no legitimate reason to reach
Platform Core tables, sequences, or functions directly, those default
privileges are revoked outright on every current Platform Core object,
and `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public` is set,
explicitly naming the role, so future tables, sequences, and functions in
the schema do not silently regain them either. `FOR ROLE` is explicit
rather than implied, because a default-privilege rule attached to the
wrong object-creating role would create false confidence while leaving
future objects exposed; `postgres` was confirmed, read-only, to be both
the actual owner of every existing Platform Core object and the role
Supabase migrations execute as in this project. This is defense-in-depth
beneath RLS, not a replacement for it: if a future policy were ever
misconfigured to be permissive, the underlying privilege would already be
absent. The trusted server-side path (`service_role`) is never touched by
any of this; it already bypasses RLS by attribute and continues to hold
the ordinary privileges it needs. `EXECUTE` on the audit and immutability
trigger functions is additionally revoked from `PUBLIC` directly: trigger
invocation does not require the writing role to hold `EXECUTE` on the
trigger function, so revoking it removes a direct-call surface with zero
effect on the triggers themselves.

## 13. Historical grant records

`user_roles` and `role_permissions` are historical grant records rather
than rows that are hard-deleted on revoke; see
`docs/AUTHORIZATION_MODEL.md` §4 for the reasoning. Both tables add:

```
  granted_at         -- reuses created_at
  granted_by         -- reuses created_by
  revoked_at         timestamptz, null while active
  revoked_by         uuid, references app_users, null while active
  revocation_reason  text, null; populated per application-level policy,
                     not a blanket database requirement
  updated_at         timestamptz, not null   -- revoking is now an update
```

An active grant is `revoked_at IS NULL`. The uniqueness rule from §5 (keys
and constraints) extends here: the partial unique indexes that enforce
"one active assignment" are scoped to `WHERE revoked_at IS NULL`, so a
revoked row never collides with a later, new grant of the same
role/scope, or the same permission, to the same target. Revoking is an
`UPDATE`, not a `DELETE`, which the existing generic audit trigger already
covers without any change to the trigger itself, and which additionally
means the grant/revoke history is directly queryable from the table
itself, without reconstructing it from `audit_log`.

## 14. What this document does not cover

No table here is a finalized schema. Column lists above are the standard
shape every table follows, not the complete definition of any real Nexus
table. Real feature tables are designed when that feature is implemented,
following these standards, against the approved product requirements for
that feature.
