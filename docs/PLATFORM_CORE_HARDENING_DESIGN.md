# Nexus: Platform Core Integrity Hardening

## MIGRATION DESIGN

**STATUS: LOCKED** (design). **MIGRATION SQL: NOT YET AUTHORED.**

**SQL AUTHORED: NO. MIGRATION FILE CREATED: NO. MIGRATION TIMESTAMP
ASSIGNED: NO. PRINCIPAL REVIEWED: YES, THREE ROUNDS COMPLETE INCLUDING
THE FINAL LOCK REVIEW. FINAL REVIEWED STATE: P0 = 0, P1 = 0, APPROVED TO
LOCK. DRY-RUN: NOT RUN. REMOTE APPLY: NOT APPLIED. LOCAL/REMOTE MIGRATION
HISTORY: NOT YET CHANGED. RUNTIME HARNESS: NOT AUTHORED. RUNTIME
VERIFICATION: NOT RUN. ZERO-RESIDUE PROOF: NOT RUN. PRESERVATION PROOF:
NOT RUN. HARDENING CLOSEOUT: NOT STARTED.**

**What is locked is the design**: the migration architecture (§3), the
privilege and integrity contracts (§6 through §12), the deferrals (§13,
§21), and the 20-test runtime evidence design (§16). **What is not done
is everything downstream of it.** No SQL exists, no migration file
exists, no harness exists, no gate has run, and **nothing in this
document has been applied to any database.** There is deliberately no
applied-state evidence section: there is nothing to record yet. See §23.1
for the lock record and §23 for the status of every remaining gate.

This document has been through three rounds of independent principal
review. Each returned P0 = 0 and P1 = 1, and **in all three rounds the
single P1 was located entirely in the runtime evidence plan rather than in
the migration architecture.** The migration architecture has passed all
three rounds unchanged.

The round-1 P1 was an invalid official test: a bare `TRUNCATE resources`
that foreign-key dependency checking would have blocked before the new
guard could fire. The round-2 P1 was the blast radius of the fix for it:
`TRUNCATE resources CASCADE` expands to twelve real relations (§2.8),
including `submission_revisions`, whose payload is deliberately not
reconstructable from `audit_log`.

**The round-2 P1 was resolved by removing the destructive statement, not
by instrumenting it.** No official test issues `CASCADE`, and no
`TRUNCATE` is executed against `resources` in any form.

**The round-3 P1 was that removing the statement also removed the only
direct behavioral observation of the guard on `resources`, leaving the
replacement composite resting on an ungated premise.** The composite
transfers Test 19's canary observation to production `resources` on the
grounds that `fn_reject_truncate` is table-independent, and that property
was specified in prose but never machine-gated. A function body with one
table-specific branch would have passed all twenty tests while leaving
`resources` unprotected (§24, D19).

**It is closed by making the premise evidence.** `resources` protection is
now proven as a composite of three official tests: Test 01 (the function's
canonical, table-independent body, asserted from `pg_proc.prosrc`), Test
03 (that exact function object attached, correctly shaped, and enabled on
real `public.resources`), and Test 19 (that same object behaviorally
rejecting a statement-level `TRUNCATE`, on a rollback-bound fictional
canary). §16.0 now states table-independence as a **precondition** on the
composite-proof principle, so the principle is self-limiting. The
governing principle is stated once in §16.0 and applied in §16.7. All
three P1s and every adopted P2 and cheap factual P3 are recorded in §24.

This migration is referred to throughout by its descriptive name,
**Platform Core Integrity Hardening**. No timestamp and no migration
number are assigned. It is specifically **not** "Migration 9": that
number stays reserved by `docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md`
for the Commercial Usage and Earned stage, which remains blocked (§21).

Historical migrations are never edited. Migrations 1 through 8, and the
Foundation RPC Privilege Hardening migration, are immutable history.
Every correction here is a new forward migration.

---

## 1. Purpose

Platform Core (Migrations 1, 2, and 3) protects its permanence and
history contracts with unconditional row-level `BEFORE UPDATE OR DELETE`
triggers, backed by privilege revocation. PostgreSQL does not fire
row-level triggers on `TRUNCATE`, and Row Level Security does not apply
to `TRUNCATE` at all. The privilege that would otherwise stop it was
never revoked from `service_role`.

The result is a confirmed defect: the trusted application role can remove
every row from the audit ledger, the Resource Registry, and both
historical grant tables without firing any guard and without violating
any privilege Platform Core revoked.

This migration closes that defect in both layers, and corrects two
related foreign-key actions that contradict the historical-grant and
audit-immutability contracts for the same underlying reason: a declared
referential action that a separate trigger silently intercepts.

The requirement this migration restores is stated at architecture level
in `docs/DATA_ARCHITECTURE.md` §9: immutability must hold "even if a
future migration accidentally grants broader privileges". Migration 1's
own comment on `audit_log` states the same doctrine in the author's
words: "Immutability, enforced twice: the REVOKE below removes
UPDATE/DELETE privilege from every application-facing role, and this
trigger blocks UPDATE/DELETE unconditionally regardless of privilege, so
a future migration cannot accidentally regrant its way around it."

For `TRUNCATE` there are currently zero layers. This migration restores
both.

---

## 2. Confirmed live evidence

All of the following is established live evidence from read-only
inspection of the linked Nexus project. None of it is inferred from
generic Supabase behavior, and none of it should be re-derived by
argument, or rediscovered by reconnecting, during review.

### 2.1 Existing-table exposure

`has_table_privilege('service_role', <table>, 'TRUNCATE')` returned
**TRUE** for all eight existing Platform Core tables:

`app_users`, `resource_types`, `resources`, `roles`, `permissions`,
`role_permissions`, `user_roles`, `audit_log`.

No `TRUNCATE` was executed at any point.

### 2.2 Pre-hardening `service_role` privilege baseline

This is the authoritative pre-migration baseline for every
non-collateral-damage test in §16. It was measured read-only against the
live database.

For these seven tables:

`app_users`, `permissions`, `resource_types`, `resources`,
`role_permissions`, `roles`, `user_roles`

all eight ordinary table privileges are **TRUE** for `service_role`:

`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `TRIGGER`,
`MAINTAIN`, `TRUNCATE`

For `audit_log`, `service_role` holds:

- **TRUE:** `SELECT`, `INSERT`, `REFERENCES`, `TRIGGER`, `MAINTAIN`,
  `TRUNCATE`
- **FALSE:** `UPDATE`, `DELETE`

The `audit_log` exception is not an anomaly. It is Migration 1's
deliberate belt-and-suspenders revoke (`revoke update, delete on
audit_log from authenticated, anon, service_role`). Any uniform
"all seven non-`TRUNCATE` privileges are true" assertion applied to all
eight tables would false-fail on `audit_log`, so §16 encodes the
exception explicitly.

`MAINTAIN` is a PostgreSQL 17 and later table privilege. Its presence in
this baseline establishes that the live environment is on a version that
has it. `has_table_privilege(..., 'MAINTAIN')` raises rather than
returning false on older servers, so a harness asserting it fails loudly
rather than silently on an unexpected downgrade.

### 2.3 Recurrence source: the public-schema default ACL

For `pg_default_acl` rows where `defaclrole = 'postgres'::regrole` and
`defaclobjtype = 'r'`, the live catalog shows a **schema-specific entry
scoped to `public`** with grantee `service_role` holding:

`DELETE`, `INSERT`, `MAINTAIN`, `REFERENCES`, `SELECT`, `TRIGGER`,
**`TRUNCATE`**, `UPDATE`

with `is_grantable = false` on the `TRUNCATE` entry.

**No global (`defaclnamespace = 0`) `service_role` `TRUNCATE` grant was
present in the returned catalog evidence.**

This establishes the recurrence source precisely: every future table
created by `postgres` in schema `public` receives `service_role`
`TRUNCATE` from this schema-specific default ACL. Without §7, this
migration would close the hole on eight tables and leave every future
Platform Core, feature, and Commercial table to reopen it.

### 2.4 The same entry grants other privileges that must survive

The `public` default ACL entry above also grants `service_role` the
ordinary table privileges the trusted application path depends on. **This
migration removes `TRUNCATE` only.** Stripping the remaining privileges
would break the trusted path and is explicitly out of scope. §16 Test 09
gates on that narrowness against the exact seven-privilege baseline
rather than assuming it.

### 2.5 Other creator-role and other-schema default ACL entries

Separate default ACL entries scoped to the `storage` schema were observed
in the same read-only query. Migration 2's own comment additionally
records a `public`-schema default ACL entry keyed to creator role
`supabase_admin`.

Both are unrelated to this migration's operation and must remain
untouched. No operation in this migration names them. The resulting scope
boundary is stated explicitly in §7.4 rather than left as an inference.

### 2.6 Live foreign-key evidence

Both constraint names and both current delete actions are live-confirmed.
**No further read-only confirmation is required before authoring.**

| Constraint | Child | Parent | Current `ON DELETE` |
|---|---|---|---|
| `user_roles_user_id_fkey` | `public.user_roles.user_id` | `public.app_users.id` | `CASCADE` |
| `audit_log_actor_user_id_fkey` | `public.audit_log.actor_user_id` | `public.app_users.id` | `SET NULL` |

Both are corrected to `RESTRICT` by this migration (§12).

### 2.7 Incidental foreign-key protection, and why it is not a control

Verified from repository SQL across all migrations: `audit_log`,
`user_roles`, and `role_permissions` have **no incoming foreign keys**. A
bare `TRUNCATE` on any of those three succeeds in a single statement. The
other five are referenced, so a bare `TRUNCATE` fails with a dependency
error and requires an explicit `CASCADE`.

`resources` specifically is referenced directly by five tables:
`user_roles`, `audit_log`, `form_versions`, `requests`, and
`commercial_configurations`. That topology is what invalidated the
original bare-`TRUNCATE` official test for `resources`, and the full
consequence of it is recorded in §2.8.

That difference is an accident of the current foreign-key graph, not a
control. `TRUNCATE ... CASCADE` defeats it today, and it disappears the
moment a future migration drops a referencing table. It is recorded here
to rank exposure, never as mitigation, and §16.9 keeps the bare-`TRUNCATE`
observation as a **static, narrative** diagnostic derived from the
foreign-key graph, never as an executed statement and never as an
official Nexus contract.

### 2.8 The `TRUNCATE resources CASCADE` transitive closure

Repository-derived design evidence, established by mechanically computing
the transitive closure of the foreign-key graph across all migration
files. This is important operational evidence and is recorded here
permanently.

`CASCADE` does not stop at the five direct referencers.
`heap_truncate_find_FKs` iterates until no new relation is discovered, so
`TRUNCATE resources CASCADE` expands to **twelve real relations**:

1. `resources`
2. `user_roles`
3. `audit_log`
4. `form_versions`
5. `requests`
6. `commercial_configurations`
7. `commercial_changes`
8. `commercial_commitments`
9. `commercial_components`
10. `commercial_component_capabilities`
11. `commercial_commitment_components`
12. `submission_revisions`

PostgreSQL takes `ACCESS EXCLUSIVE` on every relation in that set.

**Only three of the twelve carry a `BEFORE TRUNCATE` guard after this
migration:** `resources`, `user_roles`, and `audit_log`.
`role_permissions` is correctly absent from the closure, because it
references only `roles` and `permissions`, neither of which is in the
set.

**The closure includes `submission_revisions`, which §21 names as the
highest-priority deferred `TRUNCATE` exposure**, precisely because
Migration 5's audit path deliberately excludes its payload: "`raw_data`
and `effective_data` are never included, on either INSERT or UPDATE,
under any circumstance." A successful `TRUNCATE` of
`submission_revisions` therefore destroys information that cannot be
reconstructed from `audit_log` by explicit design. The closure also
reaches `requests` and `form_versions`, both of which carry their own
permanence contracts, and four Commercial tables.

**This evidence is the reason the runtime gate does not execute
`TRUNCATE resources CASCADE` at all** (§16.7). The M4 through M8
deferral reasoning and scope in §21 are unchanged by this finding: what
changes is the evidence design, not the migration's scope.

---

## 3. Scope: what this migration changes

Eight conceptual operations, in this order. No SQL is authored in this
document.

1. Create one generic `TRUNCATE`-rejection trigger function,
   `fn_reject_truncate()` (§9).
2. Revoke `EXECUTE` on it from `PUBLIC`, `anon`, and `authenticated`
   (§10).
3. Attach a `BEFORE TRUNCATE FOR EACH STATEMENT` trigger using that
   function to exactly four tables: `audit_log`, `resources`,
   `user_roles`, `role_permissions` (§8).
4. Revoke `TRUNCATE` from `service_role` on all eight existing Platform
   Core tables (§6).
5. Remove `TRUNCATE` from `service_role`'s default privileges for future
   tables created by `postgres` in schema `public` (§7).
6. Replace `user_roles_user_id_fkey`'s `ON DELETE CASCADE` with
   `RESTRICT` (§12.1).
7. Replace `audit_log_actor_user_id_fkey`'s `ON DELETE SET NULL` with
   `RESTRICT` (§12.2).
8. Update the affected table, column, and function comments so the
   documented contract matches the enforced one.

**Fail-loud requirement.** Following the precedent set by
`docs/FOUNDATION_RPC_PRIVILEGE_HARDENING_DESIGN.md`, the migration must
fail loudly if an expected object is not present, rather than silently
producing a partially hardened state. That migration achieved this by
naming exact function signatures; the equivalents here are the four table
names in operation 3 and the two exact foreign-key constraint names in
operations 6 and 7. **`DROP CONSTRAINT IF EXISTS` is explicitly
forbidden**: it converts a missing expected object into a silent skip,
which is exactly the outcome this requirement exists to prevent.

---

## 4. Scope exclusions

Deliberately not changed by this migration. Each is reasoned in §11, §13,
or §21.

- No `search_path` pinning on the legacy Migration 1 and 2 trigger
  functions. Deferred platform-wide (§13.1).
- No delete guard on `app_users`. The corrected `RESTRICT` foreign keys
  plus documentation carry it (§13.2).
- No audit trigger or immutability guard on `resource_types` (§13.3).
- No change to `service_role`'s `INSERT` on `audit_log` (§13.4).
- No `TRUNCATE` work on tables created by Migrations 4 through 8 (§21).
- No change to default ACL entries keyed to any creator role other than
  `postgres`, and no change to any schema other than `public` (§7.4).
- No RLS policy is created anywhere. Zero policies on Platform Core
  remains intentional.
- No table grant is added to `service_role` anywhere.
- No seed data. This migration is schema and privilege only.

---

## 5. The defect, stated precisely

PostgreSQL fires `BEFORE`/`AFTER TRUNCATE` triggers only when they are
declared `FOR EACH STATEMENT ... ON TRUNCATE`. A row-level
`BEFORE UPDATE OR DELETE` trigger never fires on `TRUNCATE`, because
`TRUNCATE` removes rows without producing per-row events. Row Level
Security does not gate `TRUNCATE` either.

Platform Core's four permanence and history guards are all row-level:

| Table | Existing guard | Fires on TRUNCATE |
|---|---|---|
| `audit_log` | `trg_audit_log_immutable` | no |
| `resources` | `trg_resources_immutable` | no |
| `user_roles` | `trg_user_roles_protect_grant` | no |
| `role_permissions` | `trg_role_permissions_protect_grant` | no |

Migration 2 revoked `ALL` from `anon` and `authenticated` on all eight
tables, which does include `TRUNCATE`. On the live PostgreSQL version,
`REVOKE ALL ON TABLE` covers `SELECT`, `INSERT`, `UPDATE`, `DELETE`,
`TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN`. On `audit_log` it
additionally revoked `UPDATE, DELETE` from `service_role` as
belt-and-suspenders. It named only those two verbs, so `service_role`
kept `TRUNCATE`.

The consequence is that the control Migration 2 built specifically
against the trusted role has a hole its own author intended to close.

---

## 6. Existing-table privilege hardening

**Revoke `TRUNCATE` from `service_role` on all eight Platform Core
tables.**

Uniform across all eight rather than only the four that receive an
integrity guard. `service_role` is the trusted application path and has
no legitimate reason to truncate any Platform Core table. A partial
revoke would be harder to state, harder to test, and harder to remember
correctly in a future migration. This mirrors Migration 2's own choice to
revoke from `anon` and `authenticated` across all eight rather than table
by table.

The operation names one privilege and one grantee, so it cannot affect
any other privilege or any other role. §16 Test 05 proves that against
the §2.2 baseline rather than assuming it.

Resulting posture per grantee:

- `anon`, `authenticated`: already denied by Migration 2's `REVOKE ALL`.
  Not touched here. §16 Test 06 proves that posture was not collaterally
  altered.
- `PUBLIC`: never granted `TRUNCATE` by any Platform Core migration.
  §16 Test 07 proves no entry appeared.
- Owner: retains its privilege by virtue of ownership. Not revoked, by
  design (§16.5).
- `service_role`: revoked here.

---

## 7. Future-table default-privilege hardening

**Remove `TRUNCATE` from `service_role`'s default privileges for future
tables created by `postgres` in schema `public`.**

This is the only operation that prevents the defect from silently
recurring. It is the same mechanism Migration 2 used to stop
`anon`/`authenticated` regaining table access on future objects, applied
now to the one privilege `service_role` should not receive.

### 7.1 Conceptual operation

Illustrative only. **Not authored migration SQL.** The principal reviewer
must review the exact operation before implementation.

```
-- CONCEPTUAL / PROPOSED. NOT AUTHORED. NOT APPLIED.
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres
  IN SCHEMA public
  REVOKE TRUNCATE ON TABLES
  FROM service_role;
```

### 7.2 Why this works here, specifically

`ALTER DEFAULT PRIVILEGES` does not create a negative entry. It edits the
`defaclacl` of the matching `pg_default_acl` row by removing the
privilege from that grantee's aclitem. Whether that produces the intended
outcome depends entirely on which entry actually carries the grant, and
PostgreSQL composes a schema-specific entry **on top of** any global
entry rather than replacing it.

The live evidence in §2.3 resolves that question rather than leaving it
to inference:

- The `TRUNCATE` grant being removed is itself carried by a
  **schema-specific entry scoped to `public`**, keyed to creator role
  `postgres`. That is exactly the entry this operation edits.
- **No global `service_role` `TRUNCATE` grant was observed.** So this is
  not the unsound case of attempting a schema-scoped revoke against a
  global grant, which would leave the privilege intact.
- `FOR ROLE postgres` is explicit, not implied, matching Migration 2's
  reasoning: a default-privilege rule attached to the wrong
  object-creating role creates false confidence while leaving future
  objects exposed. Migrations in this project execute as `postgres`, and
  every Platform Core object is owned by `postgres`. §16 Test 08 proves
  the ownership half of that assumption still holds, and proves it
  against the named role rather than merely against "one shared owner".

The gate does not rest on this composition reasoning. §16.4's canary is
**behavioral**, so it composes global entries, schema-specific entries,
and hard-wired defaults automatically. If the operation were mis-authored
without `IN SCHEMA public`, the global row would be edited while the
schema row continued to grant `TRUNCATE`, and the canary would correctly
observe `TRUNCATE` still true and fail.

### 7.3 Narrowness

`TRUNCATE` only. The same `public` entry grants `service_role` the
ordinary privileges the trusted path needs (§2.4), and those must
survive. §16 Test 09 gates on the removal **and** on all seven
established surviving privileges remaining true, so an over-broad revoke
fails the gate rather than passing quietly.

### 7.4 What this operation does not do, stated as a scope boundary

It does not affect existing tables, which is why §6 exists separately.

It does not affect objects created by any role other than `postgres`. The
live database also carries default ACL entries keyed to other creator
roles, including `supabase_admin` in schema `public` (§2.5). **A future
`public` table created by a role other than `postgres` is therefore
outside this recurrence-prevention contract.** This migration
deliberately does not modify `supabase_admin` or `storage` defaults:
Nexus migrations do not run as those roles, and editing platform-owned
provisioning entries would be a change with effects far outside Platform
Core.

It does not touch any schema other than `public`. It does not close the
equivalent exposure on the already-created Migration 4 through 8 tables
(§21).

---

## 8. Integrity hardening: the derived attachment rule

Privilege revocation alone is not sufficient, because the architecture
claims database-enforced immutability that survives an accidental
re-grant (§1). A second layer is therefore required, not optional.

**The rule, derived rather than mechanical: a statement-level `TRUNCATE`
guard is attached exactly where Platform Core already has an
unconditional row-level `UPDATE`/`DELETE` permanence or history guard.**

| Table | Existing row-level guard | Statement-level twin |
|---|---|---|
| `audit_log` | `trg_audit_log_immutable` | **yes** |
| `resources` | `trg_resources_immutable` | **yes** |
| `user_roles` | `trg_user_roles_protect_grant` | **yes** |
| `role_permissions` | `trg_role_permissions_protect_grant` | **yes** |
| `app_users` | none | no |
| `resource_types` | none | no |
| `roles` | none | no |
| `permissions` | none | no |

This rule is stated explicitly because it makes the design checkable in
one sentence and gives the next author a clear answer to "should this new
table get one too". **No table gains a new class of protection.** Four
tables have a hole closed in a protection they already claimed to have.

Per-table reasoning for all eight is in §11.

---

## 9. `fn_reject_truncate()` contract

One generic function. Zero table-specific logic.

This is not new infrastructure. Migration 8 already established exactly
this pattern with `fn_reject_update_delete()`, whose own comment
describes it as having "Zero table-specific logic ... the same reuse
discipline already applied to `fn_bump_row_version()`/`fn_audit_row()`/
`fn_set_updated_at()`". The new function is that function's `TRUNCATE`
twin and follows its style deliberately.

| Property | Contract |
|---|---|
| Name | `fn_reject_truncate()` |
| Returns | `trigger` |
| Language | `plpgsql` |
| SECURITY mode | `SECURITY INVOKER` |
| `search_path` | `pg_catalog` |
| Body | Raises unconditionally. No branching, no table access, no dynamic SQL, no catalog lookup, no `TG_RELID`-specific behavior, no data dependency. **Canonical and machine-gated by Test 01** (§16.8.0) |
| Exception code | Plain `RAISE EXCEPTION`, yielding **`P0001`**, no custom `ERRCODE` |
| Message | Names the table through `TG_TABLE_NAME`, so one function serves four tables |
| Timing | `BEFORE TRUNCATE` |
| Level | `FOR EACH STATEMENT` |
| Attached to | `audit_log`, `resources`, `user_roles`, `role_permissions` |
| Trigger names | `trg_<table>_reject_truncate` |

`BEFORE TRUNCATE` and `FOR EACH STATEMENT` are not a preference.
PostgreSQL requires `TRUNCATE` triggers to be statement-level.

**Why the body is a canonical, machine-gated contract rather than a style
preference.** The table-independence of this body is what allows the
`resources` integrity contract to be proven without executing any
`TRUNCATE` against `resources` (§16.7.2). A single table-specific branch
would silently invalidate that proof while every other test continued to
pass, so the body is fixed as a canonical string and asserted by Test 01
through normalized-exact comparison against `pg_proc.prosrc` (§16.8.0).
This is the one function in the repository whose body is gated, and the
reason is specific: it is the only function whose behavioral proof is
deliberately transferred from one relation to another.

**Why a new function rather than adapting an existing one.**
`fn_reject_update_delete()` is named for its operations and is already
attached across the Commercial Foundation. Overloading it with `TRUNCATE`
semantics would make its name wrong and would change behavior for
Migration 8 tables whose contracts this design has not analysed. Four
table-specific functions were also rejected, as four copies of one body.

**Why `SECURITY INVOKER`.** The function only raises. Definer rights buy
nothing: raising an exception requires no privilege, and the body touches
no table. This matches `fn_reject_update_delete()`,
`fn_resources_immutable()`, and `fn_audit_log_immutable()`. No function
in this migration changes security mode.

**Why `search_path = pg_catalog` is sufficient.** The body resolves no
object at all. `TG_TABLE_NAME`, `TG_OP`, and `RAISE`'s format handling
are built-ins resolved from `pg_catalog` regardless. There is no
unqualified object reference to hijack, so the pin is a standards
posture rather than a mitigation of a live path.

**Why `P0001`.** This is the established Nexus convention.
`docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` states "`P0001` for
every lifecycle/immutability trigger raise (plain `RAISE EXCEPTION`, no
custom `ERRCODE` assigned)", and all four existing Platform Core guards
already behave that way. The runtime gate depends on this: `P0001` is
what distinguishes a working guard from the harness sentinel (§16.3). No
special production `ERRCODE` is invented for this function.

**Why `search_path` is pinned on this function but not retrofitted to the
legacy ones.** New objects meet the current standard; legacy debt is
scheduled separately (§13.1). This is an acknowledged inconsistency, not
an oversight: after this migration, 3 of 21 relevant trigger functions
will pin `search_path`. The platform-wide sweep that fixes the rest
belongs to the Migration 4 through 6 retrospective stage.

---

## 10. New function EXECUTE privilege contract

`fn_reject_truncate()` **must not inherit PostgreSQL's default `PUBLIC`
`EXECUTE` posture.** The creating migration must explicitly encode:

- `REVOKE EXECUTE` from `PUBLIC`
- `REVOKE EXECUTE` from `anon`
- `REVOKE EXECUTE` from `authenticated`

`acldefault` for a function grants `PUBLIC` `EXECUTE`, so a newly created
function is callable by `PUBLIC` unless revoked. Migration 2's
`ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM anon,
authenticated` should already keep those two clean for functions created
after it ran. The explicit revokes are still encoded, because **Migration
3 exists precisely because a plausible assumption about which grants were
actually present turned out to be wrong in this project.** §16 Test 02
proves the resulting state rather than assuming it.

**No positive `service_role` `EXECUTE` grant is required, and none is
made.** This is the locked convention, not an analogy:
`docs/FOUNDATION_RPC_PRIVILEGE_HARDENING_DESIGN.md` §12 states
"Trigger-only functions remain a separate category: `REVOKE` as already
practiced, never `GRANT` to any role." The callable-RPC rule in that same
section, which requires an explicit `service_role` grant, applies to
callable application RPCs and must not be applied to trigger-only
functions. Doing so would add a direct-call surface for no benefit, which
is the opposite of what Migrations 2 and 3 established.

**No `service_role` revoke is added either.** Established practice for
trigger functions across Migration 2, Migration 3, and Migration 8 is to
revoke from `PUBLIC`, `anon`, and `authenticated` only. There is also no
surface to close: PostgreSQL refuses a direct call of any
`returns trigger` function, so `EXECUTE` on a trigger function is
inherently non-exercisable. `service_role`'s observed `EXECUTE` state on
the function is recorded as diagnostic detail, never gated, and no revoke
is added merely for symmetry.

Trigger invocation does not require the writing role to hold `EXECUTE` on
the trigger function. Migration 2's own comment states this, and
Migration 3's header restates it.

---

## 11. Table-by-table decisions

### 11.1 `audit_log`

**Privilege revoke: yes. Integrity guard: yes.** Highest-risk object in
the design.

It is the Finance-grade ledger, it has no incoming foreign key so a bare
`TRUNCATE` succeeds, and `docs/DATA_ARCHITECTURE.md` §9 makes a claim
that is currently false: "an attempt to alter or remove an audit row
fails even if a future migration accidentally grants broader privileges."
Both named legs of that control, the `BEFORE UPDATE OR DELETE` trigger
and the `UPDATE`/`DELETE` revoke, are `TRUNCATE`-blind. Restoring the
claim requires both layers.

The owner keeps effective privilege and is stopped by the trigger,
matching how `trg_audit_log_immutable` already blocks the owner on
`UPDATE` and `DELETE`.

`audit_log` is also the child of the second foreign-key correction
(§12.2).

### 11.2 `resources`

**Privilege revoke: yes. Integrity guard: yes.**

`fn_resources_immutable()` is attached `BEFORE UPDATE OR DELETE` only.
Migration 1's table comment is unambiguous: "Permanent once created:
never updated or deleted", and its header calls the table "a permanent
identity spine". Registry permanence is what keeps `resource_id`
resolvable for audit, workflow, tasks, events, attachments, and external
API references. A mechanism that removes every row while leaving that
guarantee formally intact is a contradiction.

Because `resources` is referenced by five tables directly and twelve
relations transitively (§2.7, §2.8), no bare `TRUNCATE` can reach its
guard and a `CASCADE` would put eleven other relations under
`ACCESS EXCLUSIVE` mass deletion. Its integrity contract is therefore
proven as a **composite** of Tests 01, 03, and 19 without executing any
`TRUNCATE` against `resources` (§16.7).

Registry semantics are not weakened anywhere in this design. The guard
only closes an operation already forbidden in intent.

### 11.3 `user_roles`

**Privilege revoke: yes. Integrity guard: yes.**

Source-traced to the Migration 2 lifecycle model.
`fn_protect_access_grant()` opens with an unconditional rejection:
"`% is a historical grant record: rows are revoked, never deleted`".
Migration 2's table comment repeats it. `docs/DATA_ARCHITECTURE.md` §13
states the same, and `docs/engineering/NEXUS_ENGINEERING_PRINCIPLES.md`
§7 elevates it to a principle: "A record where 'what was approved' must
be exactly reconstructable later is append-only, not edited in place:
revoke is an `UPDATE`, not a `DELETE`."

`TRUNCATE` removes rows without firing that guard, and the table has no
incoming foreign key, so it succeeds in one statement. The contract says
rows are never removed; enforcement currently covers only one of the two
ways to remove them.

`user_roles` is also the child of the first foreign-key correction
(§12.1).

### 11.4 `role_permissions`

**Privilege revoke: yes. Integrity guard: yes.**

Identical reasoning to §11.3, and deliberately so: Migration 2 attached
the same `fn_protect_access_grant()` to both tables and gave both the
same historical-grant comment. The symmetry is derived from shared
enforcement, not assumed from similar names. Also has no incoming foreign
key.

### 11.5 `app_users`

**Privilege revoke: yes. Integrity guard: no.**

Row `DELETE` is legitimately permitted for a narrow class of identity.
Migration 1 attaches no immutability trigger, and an identity with no
dependent references is deletable. A table where deletion is legitimately
allowed does not receive a `TRUNCATE` blocker without a separate
architectural reason.

The separate reason was considered seriously and rejected. `app_users` is
audited, a row `DELETE` produces an audit row, and `TRUNCATE` produces
none, so `TRUNCATE` is an unaudited mass deletion that cuts against
"Every business/configuration table gets database-enforced audit
regardless of which code path wrote to it". The privilege layer already
satisfies it: after this migration no role that can reach `app_users`
holds `TRUNCATE`. `anon` and `authenticated` lost it in Migration 2,
`service_role` loses it here, `PUBLIC` never had it. Only the owner
retains it, and the owner is migrations, which are reviewed. A trigger
would block a future migration that legitimately rebuilds the table, in
exchange for closing a path only reviewed code can take.

The delete posture itself, and how the two corrected foreign keys narrow
it, is in §13.2.

### 11.6 `resource_types`

**Privilege revoke: yes. Integrity guard: no.**

Lowest risk of the eight. Unaudited by Migration 1's deliberate choice,
so `TRUNCATE` opens no audit gap that ordinary `DELETE` does not already
have. Deletion of an in-use `type_code` is already blocked by
`resources.resource_type` `ON DELETE RESTRICT`. Included in the uniform
revoke because the trusted path has no reason to truncate a
migration-managed catalog, and excluding one table from an otherwise
uniform revoke would need a justification that does not exist.

### 11.7 `roles`

**Privilege revoke: yes. Integrity guard: no.**

Row `DELETE` is legitimately permitted and audited. `roles` is not a
history table: Migration 1 describes deactivation via `is_active` as the
normal path but does not forbid deletion, and `RESTRICT` foreign keys
from both grant tables already pin any role that ever granted anything,
including through a revoked grant. Same unaudited-mass-delete reasoning
as §11.5: the privilege layer closes it.

### 11.8 `permissions`

**Privilege revoke: yes. Integrity guard: no.**

Identical to §11.7. Row `DELETE` permitted and audited, `RESTRICT`
foreign key from `role_permissions` pins any permission ever granted, no
permanence or history contract in Migration 1 or 2.

---

## 12. Historical and immutable foreign-key corrections

**In scope: both of them.** Two Platform Core foreign keys declare a
referential action that can never successfully execute, because a
separate trigger always intercepts it. Both child tables carry a
historical or immutable contract. Both are corrected to `RESTRICT` in
this migration.

This is the same defect class as the confirmed P1: a declared behavior
that only fails safe because a separate control happens to intercept it.
In every case the schema says one thing and a trigger silently means
another. Correcting one and leaving the other, in a migration explicitly
about making Platform Core's declared contract match its enforced
contract, would be incoherent.

### 12.1 `user_roles_user_id_fkey`: `CASCADE` to `RESTRICT`

Live-confirmed as `ON DELETE CASCADE` (§2.6). It is the only `CASCADE` in
the entire repository, across all nine migration files. Migration 1
declared it, and Migration 2 did not revisit it when it converted
`user_roles` into a historical grant record.

The cascade is unreachable. It issues a `DELETE` on `user_roles`, which
`fn_protect_access_grant()` always rejects with `P0001`.

The latent risk is concrete. If a future migration ever narrowed or
replaced `fn_protect_access_grant()`, the cascade would immediately begin
silently deleting grant history, which is exactly the outcome Migration 2
exists to prevent.

### 12.2 `audit_log_actor_user_id_fkey`: `SET NULL` to `RESTRICT`

Live-confirmed as `ON DELETE SET NULL` (§2.6). This was identified by
independent principal review as the same defect class as §12.1, and the
reviewer was correct.

The `SET NULL` action issues an `UPDATE` on `audit_log`.
`trg_audit_log_immutable` rejects **every** `UPDATE` on `audit_log`
unconditionally with `P0001`. Therefore the declared `SET NULL` action
can never successfully execute.

The consequence today is a confusing failure: deleting an `app_users` row
that has ever been recorded as an audit actor fails with `P0001` from an
audit immutability trigger, which does not state the actual reason and
names a table the caller never asked to touch.

### 12.3 Shared reasoning and mechanics

**Why `RESTRICT` for both.** Deleting the `app_users` parent should fail
directly at the foreign-key layer with `23503`, stating the actual
reason, rather than invoking a referential action that a separate
immutability trigger subsequently rejects with `P0001`. This makes the
declared schema contract match the enforced contract, and it removes the
dependency on a trigger to produce a safe outcome.

`RESTRICT` also matches every other foreign key on both grant tables and
on `audit_log`'s remaining references.

**Why not `NO ACTION`.** `NO ACTION` is deferrable and is checked at the
end of the statement or, if the constraint is deferred, at the end of the
transaction. `RESTRICT` is checked immediately and cannot be deferred.
These are permanence relationships: they should fail immediately, at the
point of the offending statement, not at a transaction boundary where the
cause is harder to attribute. `RESTRICT` is deliberate.

**Mechanics, assessed rather than assumed.**

- **Drop and re-create is required for both.** PostgreSQL cannot alter a
  referential action in place; `ALTER CONSTRAINT` changes only
  deferrability.
- **Both constraint names are live-confirmed** (§2.6). No further
  read-only confirmation is required before authoring. Both are the
  PostgreSQL default `<table>_<column>_fkey` form, because Migration 1
  declared both inline as column constraints. This repository already
  relies on that convention: Migration 2 drops
  `role_permissions_role_id_permission_id_key` by its generated name.
- **Plain `DROP CONSTRAINT` only.** `DROP CONSTRAINT IF EXISTS` is
  forbidden (§3). A missing expected constraint must fail the migration
  loudly.
- **Resulting behavior is equivalent or stronger, for both.** Deleting an
  `app_users` row that holds any grant, active or revoked, or that
  appears as an audit actor, is blocked before and after. What changes is
  the layer and the message: today it fails `P0001` from a trigger;
  afterwards it fails `23503` at the foreign key, and the block no longer
  depends on the trigger.
- **Dependent data implications: none.** Nothing can depend on a
  referential action that has never been able to complete.
- **`NOT NULL` and indexes are unaffected.** Dropping and re-adding a
  foreign key does not alter the column's `NOT NULL` status and does not
  drop `idx_user_roles_user_id` or
  `idx_audit_log_actor_user_id`.
- **Lock and validation cost, stated precisely.** `ALTER TABLE ... DROP
  CONSTRAINT` takes `ACCESS EXCLUSIVE` on the child table. `ALTER TABLE
  ... ADD CONSTRAINT ... FOREIGN KEY` takes `ACCESS EXCLUSIVE` on the
  child table and `SHARE ROW EXCLUSIVE` on the referenced table
  (`app_users`), which blocks writes to the parent for the duration. The
  re-add revalidates existing rows at a cost proportional to child row
  count. No Nexus migration seeds users and Platform Core is
  pre-production, so this is negligible. The migration already takes
  locks of this class through `CREATE TRIGGER`, so the foreign-key work
  does not change the migration's lock character. If low-lock ever
  becomes necessary, `NOT VALID` followed by a separate
  `VALIDATE CONSTRAINT` is the path. It is not needed here.

---

## 13. Deferred and documentation-only findings

### 13.1 Legacy trigger-function `search_path`: DEFER

Corrected counts, established by mechanical enumeration during
independent principal review:

- **20 distinct trigger functions** exist across Migrations 1 through 8.
- **Exactly 2** currently pin `search_path`: `fn_audit_row` (Migration 1)
  and `fn_audit_submission_revision_transition` (Migration 5). Both are
  `SECURITY DEFINER`, both pin `pg_catalog`.
- Therefore **18 of 20** legacy Migration 1 through 8 trigger functions
  do not pin `search_path`.
- After adding `fn_reject_truncate`, **3 of 21** relevant trigger
  functions will pin it. The 21st function is `fn_reject_truncate` itself
  and does not belong to Migrations 1 through 8.

Within Platform Core specifically, four Migration 1 and 2 trigger
functions do not pin `search_path`: `fn_set_updated_at`,
`fn_resources_immutable`, `fn_audit_log_immutable`,
`fn_protect_access_grant`.

All four bodies were inspected. None resolves anything from `public`:
`fn_set_updated_at` calls only `now()`; two only raise; and
`fn_protect_access_grant` uses `to_jsonb()`, the `jsonb - text` operator,
and `IS DISTINCT FROM`. The minimum safe `search_path` for all four is
`pg_catalog`, and `ALTER FUNCTION ... SET search_path` would change only
`proconfig`, preserving body, security mode, owner, and `proacl`, so
Migration 3's revokes would survive.

It is still deferred, for two reasons.

**Exploitability is effectively absent for these four.** A `search_path`
hijack needs a role that can both create a shadowing object and cause the
function to fire. `anon` and `authenticated` hold no privilege on any
table these triggers are attached to, because Migration 2 revoked `ALL`
from them on all eight tables and Migrations 4 through 8 did the same on
their own tables. They can never fire these triggers. The only roles that
can are `postgres` and `service_role`, both of which already write to
these tables directly and gain nothing from shadowing. This reachability
argument does not depend on whether `anon` or `authenticated` hold
`CREATE` on schema `public`, which is measured as a diagnostic in §16.9
to set priority for the deferred work rather than to justify the
deferral.

There is also no reachable indirect path. The only `SECURITY DEFINER`
functions in the platform are the two that already pin `search_path`, and
all **six** callable RPCs are `SECURITY INVOKER` with `EXECUTE` revoked
from the application roles:

- The five created by Migrations 4 and 5 (`create_form_version`,
  `publish_form_version`, `create_request_with_draft`, `submit_revision`,
  `create_next_revision`) have `EXECUTE` revoked from `PUBLIC`, `anon`,
  and `authenticated` by the Foundation RPC Privilege Hardening migration.
- The sixth, `create_commercial_configuration_with_change`, was added by
  Migration 8 and is hardened **within Migration 8 itself**, which revokes
  `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` and grants it
  explicitly to `service_role` only.

The count was previously stated as five, which omitted the Migration 8
RPC. **The deferral conclusion is unchanged**: the sixth RPC is
`SECURITY INVOKER` and is unreachable by `anon` and `authenticated`
exactly like the other five, so it opens no indirect `search_path` path.
Corrected for accuracy, not because it altered the reasoning (§24, D21).

**Fixing four of twenty would not close the class.** Several Migration 4
through 8 bodies do read from `public`, so determining each one's minimum
safe `search_path` requires analysing the remaining bodies individually.
The right home is a single platform-wide pass during the Migration 4
through 6 retrospective stage.

Classified **P3**, disposition **DEFER**. The new function meets the
current standard now (§9).

### 13.2 `app_users` hard delete: DOCUMENT, and narrower than it appears

"Never delete" is not a locked database invariant, and Migration 1's
author did not claim it was. The foreign-key comment is precisely scoped:
`ON DELETE RESTRICT` from `auth.users` exists "so deleting an
`auth.users` row cannot silently remove a Nexus identity **that other
records still refer to**". An unreferenced identity being deletable is
consistent with that wording.

**The durability is already stronger than the draft previously credited,
and this migration makes it explicit.**

Today, any `app_users` identity that has ever been recorded as
`audit_log.actor_user_id` is already effectively undeletable: the
`ON DELETE SET NULL` action attempts an `UPDATE` on immutable `audit_log`
and fails with `P0001` (§12.2). The protection exists, but it is
accidental in form and confusing in message.

After this migration the same durability becomes explicit and correctly
layered:

- `audit_log_actor_user_id_fkey` `RESTRICT` blocks deletion of any
  identity referenced as an audit actor, directly, with `23503`.
- `user_roles_user_id_fkey` `RESTRICT` blocks deletion of any identity
  with grant history, active or revoked, directly, with `23503`.
- The remaining `RESTRICT` foreign keys on `roles`, `permissions`,
  `resources`, `role_permissions`, and the `created_by`/`updated_by`
  columns across Migrations 4 through 8 pin any identity that ever
  created or updated a record.

**A hard-deletable `app_users` identity is therefore narrowly limited to
one that is not referenced by audit history, has no grant history, and
has no other dependent reference.** That is precisely the mistakenly
created, never used identity for which removal capability should be
retained.

The audit trail also survives a delete of such an identity. Every
`app_users` `INSERT` produces an audit row via `trg_audit_app_users`,
`audit_log.row_id` is not a foreign key, and the `DELETE` itself is
audited. Note that an identity's own creation audit row records the
*acting* user in `actor_user_id`, not the created user, so creating an
identity does not by itself pin it. Auditor reconstructability, which is
the actual principle, is intact.

`app_users` also has no `deleted_at` column: the soft-delete mechanism in
`docs/DATA_ARCHITECTURE.md` §10 was deliberately not applied, and
`is_active` is the lifecycle flag. Adding a delete guard would make a
mistakenly created identity permanently unremovable.

Classified **ACCEPTED TRUST BOUNDARY plus DOCUMENTATION GAP**, not a
schema defect. Disposition: **no new delete guard**; the two corrected
foreign keys plus the §22 documentation corrections carry it.

### 13.3 `resource_types` mutability: out of scope

The practical exposure is smaller than the phrasing suggests. An in-use
`type_code` cannot be deleted (`RESTRICT`) and cannot be renamed (no
`ON UPDATE` action means `NO ACTION`, so renaming a referenced key raises
`23503`). What remains editable is the `description` of any type and any
row of an unused type. Neither is material.

The table comment's "not user-editable configuration" describes intent
about the Settings UI, not a database control. Classified **P3
DOCUMENTATION GAP**. No hardening beyond the uniform `service_role`
`TRUNCATE` revoke.

### 13.4 `service_role` `INSERT` on `audit_log`: accepted trust boundary

`service_role` retains `INSERT` on `audit_log` and can therefore forge
audit rows. This is inherent to the trusted-path model and is not changed
here.

Revoking it was assessed and rejected as scope expansion. Both audit
write paths are `SECURITY DEFINER` with `search_path = pg_catalog`
(`fn_audit_row` in Migration 1, `fn_audit_submission_revision_transition`
in Migration 5), so neither needs `service_role` to hold `INSERT`. That
makes a revoke conceivable, but proving no other write path depends on it
requires auditing every function across Migrations 1 through 8.
Classified **P2 ACCEPTED TRUST BOUNDARY**, recorded as a candidate for
the Migration 4 through 6 stage.

This bounds what the runtime gate can claim: "ordinary roles cannot
tamper with the ledger" is proven for `anon` and `authenticated` only.

---

## 14. Audit of rejected TRUNCATE attempts

**No audit row is written for a rejected `TRUNCATE`. The operation fails
without audit evidence, and that is the correct behavior.**

The guard raises inside the statement, aborting it. Any `INSERT` into
`audit_log` performed in that same transaction is rolled back with it, so
an audit row would either vanish or, worse, create the illusion of
evidence. Nexus has no autonomous transaction mechanism, no `dblink`, and
no `pg_background`, and inventing one for this is out of scope and
contrary to the architecture.

This is also the consistent choice. Rejected `UPDATE`s and `DELETE`s on
`audit_log`, `resources`, and the two grant tables produce no audit row
today. A different rule for `TRUNCATE` would make the audit contract
harder to state, not stronger.

The correct home for evidence of a rejected statement is the PostgreSQL
server log, which records the error and is exposed by the platform. This
is a documented decision, not a gap.

---

## 15. Privilege matrix after hardening

Three layers, deliberately separated. **A role holding the privilege is
not the same as being able to complete the statement.**

`TRUNCATE` posture per table and grantee:

| Table | Owner effective | `service_role` | `authenticated` | `anon` | `PUBLIC` | Integrity guard blocks |
|---|---|---|---|---|---|---|
| `app_users` | true | **revoked** | none (M2) | none (M2) | none | no |
| `resource_types` | true | **revoked** | none (M2) | none (M2) | none | no |
| `resources` | true | **revoked** | none (M2) | none (M2) | none | **yes** |
| `roles` | true | **revoked** | none (M2) | none (M2) | none | no |
| `permissions` | true | **revoked** | none (M2) | none (M2) | none | no |
| `role_permissions` | true | **revoked** | none (M2) | none (M2) | none | **yes** |
| `user_roles` | true | **revoked** | none (M2) | none (M2) | none | **yes** |
| `audit_log` | true | **revoked** | none (M2) | none (M2) | none | **yes** |

`service_role`'s surviving non-`TRUNCATE` privileges after hardening,
which Test 05 gates against the §2.2 baseline:

| Table group | Surviving `service_role` privileges |
|---|---|
| `app_users`, `permissions`, `resource_types`, `resources`, `role_permissions`, `roles`, `user_roles` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `TRIGGER`, `MAINTAIN` |
| `audit_log` | `SELECT`, `INSERT`, `REFERENCES`, `TRIGGER`, `MAINTAIN` (`UPDATE` and `DELETE` remain revoked from Migration 1) |

Future tables created by `postgres` in schema `public`: `service_role`
receives no `TRUNCATE` (§7), and retains the same seven ordinary
privileges, which Test 09 gates.

**The owner column must stay `true`.** The fix is not implemented by
stripping the owner. On the four guarded tables the owner is stopped by
the trigger instead, which is the entire point of the two-layer control.
§16.5 explains why the gate proves this as effective privilege rather
than as an ACL entry.

---

## 16. Runtime test plan: 20 official tests

Design only. **The harness is not authored in this document.**

This section states the corrected runtime contract directly. The
design-record defects found and corrected before authoring, including
those found by the two rounds of independent principal review, are
recorded once in §24 so the operative contract stays readable without
losing the lessons.

### 16.0 Runtime-testing safety principle

Durable, and it governs the rest of §16.

> **When an integrity contract can be proven by exact production catalog
> attachment plus a behavioral proof of a generic, table-independent
> enforcement function, prefer that composite proof over executing a wide
> destructive operation against live production relations.**
>
> **This is mandatory where the destructive statement would expand,
> through `CASCADE`, beyond the table whose contract is under test.**
>
> **Qualification, and it is a precondition rather than a caveat: this
> substitution is available only when the enforcement function's
> table-independence is itself an official gated contract. Where the
> function's behavior can vary by table, data, configuration, dynamic
> lookup, or any other runtime state, the composite proof is not
> available for that function unless every such dependency is itself
> gated.**

The reasoning is that such a statement stops testing Nexus and starts
re-testing PostgreSQL's trigger engine, while putting relations under
`ACCESS EXCLUSIVE` mass deletion that the contract under test says
nothing about. The purpose of a Nexus runtime gate is to prove Nexus's
own code and configuration.

**Why the qualification is load-bearing, and why it makes this principle
self-limiting.** The substitution works by transferring a behavioral
observation made at one attachment site to every other attachment site.
That transfer is an inference, and its entire validity rests on the
function behaving identically everywhere. If that premise is merely
documented rather than gated, a single table-specific branch in the
function body defeats the whole composite while every test still passes,
and the one table with no independent behavioral corroboration is exactly
the table left unprotected. That false-PASS was constructed against an
earlier version of this design and is recorded in §24, D19. It is closed
by Test 01's canonical-body assertion (§16.8.0).

**Consequences a future author must respect.**

- A **generic** guard with a gated canonical body (`fn_reject_truncate`,
  and `fn_reject_update_delete` if it is ever brought under an equivalent
  gate) is eligible for this substitution.
- A **table-specific** lifecycle function is not, and cannot be made
  eligible by argument. `fn_protect_form_version_lifecycle`,
  `fn_protect_commercial_component_lifecycle`,
  `fn_protect_access_grant`, and every other function whose body branches
  on state or reads data must be behaviorally tested at each attachment
  site whose contract is being claimed.
- This principle is **not** a general licence to replace behavioral
  testing with catalog inspection. It is a narrow trade available only
  where the behavior being transferred is provably invariant, and where
  the destructive alternative would exceed the contract under test.

Both halves of the trade must hold. Confinement failure alone (§16.7.4)
establishes that a live test should not be run; it does not by itself
establish that a composite proof is adequate to replace it. Only the gated
table-independence of the enforcement function does that.

This principle follows directly from the Nexus Design Review:

- **Finance control (CFO mindset).** Evidence must be obtained by the
  least destructive means that actually proves the control. A wide
  mass-deletion statement issued to prove a single table's guard is not a
  Finance-grade evidence practice.
- **Human simplicity.** A composite of a few small, individually readable
  proofs is easier for a reviewer to check than one statement whose blast
  radius requires a transitive graph computation to understand.
- **Scale-ready, not scale-heavy.** Instrumenting twelve relations to
  make one dangerous statement safe is complexity added to protect a
  choice that should not have been made.

It is applied concretely in §16.7, and it is the reason Tests 17, 18, and
20 remain live while Test 19 does not (§16.7, "Why this is not an
inconsistency").

### 16.1 PostgreSQL lock and subtransaction semantics

The contract the destructive tests rely on:

- `TRUNCATE` acquires `ACCESS EXCLUSIVE` on the target relation, and on
  every relation drawn into a `CASCADE` set.
- Locks acquired after a savepoint are released when that savepoint is
  rolled back. At subtransaction abort the subtransaction's resource
  owner releases the locks it acquired; at subtransaction commit they are
  transferred to the parent instead.
- A PL/pgSQL `BEGIN ... EXCEPTION ... END` block is implemented as a
  subtransaction, so an error escaping the inner block into its handler
  aborts that subtransaction and releases its locks.
- If an outer transaction level independently holds a lock on the same
  relation, that outer hold remains. This applies here in a harmless
  form: the outer-level pre-count takes `ACCESS SHARE`, the
  subtransaction's `ACCESS EXCLUSIVE` is a non-conflicting self-upgrade,
  and on subtransaction abort the `ACCESS EXCLUSIVE` is released while
  the outer `ACCESS SHARE` correctly persists. **An outer weaker lock
  does not retain the subtransaction's stronger mode.**
- PostgreSQL fires **all** `BEFORE STATEMENT` `TRUNCATE` triggers before
  beginning any truncation work, precisely because one of them might
  raise. So a guard that raises stops the statement before any relation
  in the set is modified. Where more than one relation is involved, the
  triggers fire in the order the relations are processed: relations
  listed explicitly in the command first, then relations added by
  cascading. **No operative test in this design depends on that
  ordering**, because no official test issues a multi-relation
  `TRUNCATE` (§16.7). The ordering is recorded because it is the fact
  that makes the `0A000` diagnosis in §16.7 legible, and its review
  history is in §24.

**Consequence.** The lock window is one statement, not the remainder of
the run. The three live production destructive tests are **not** required
to be the last tests. They are still **recommended** to be placed late,
as operational caution rather than correctness: they are the only
statements in any Nexus harness that take `ACCESS EXCLUSIVE` on
`audit_log`, and a harness that aborts early then never reaches them. The
ascending lock-cost order `role_permissions`, `user_roles`, `audit_log`
is retained on the same soft basis. Test 19's destructive statement
touches only a transaction-bound fictional canary relation, so its
placement carries no production lock cost at all.

### 16.2 Fail-safe live TRUNCATE test structure

Mandatory, applied independently to `role_permissions` (Test 17),
`user_roles` (Test 18), `audit_log` (Test 20), and the fictional canary
relation of Test 19 (§16.7). **In every case the `TRUNCATE` names exactly
one relation and reaches exactly one relation. No official test issues
`CASCADE`.**

**The safety property: even if the guard is completely absent or broken,
the test itself forces the `TRUNCATE` to roll back at the subtransaction
boundary. The outer `ROLLBACK` is never the only thing preventing mass
deletion.**

Per-test shape:

1. **Outside the destructive block**, at the outer transaction level,
   capture the table's exact row count into a plain scalar. Capturing it
   inside would take an unnecessary lock and obscure which transaction
   level the observation belongs to.
2. Enter a nested PL/pgSQL exception block, which is a subtransaction.
3. Attempt the `TRUNCATE`.
4. **If control reaches the next statement, the guard did not fire.**
   Raise the harness sentinel **inside the same nested block**.
5. Let the subtransaction abort. This is what undoes the `TRUNCATE` and
   releases the locks.
6. The handler captures `RETURNED_SQLSTATE` and the message into plain
   scalars only. No table access while unwinding.
7. After the subtransaction has unwound, re-read the exact row count at
   the outer level.
8. Classify.

This works because **`TRUNCATE` is transactional in PostgreSQL**. On
abort, including subtransaction abort, the truncation is discarded and
the original data remains live. The rows are genuinely restored, not
merely hidden.

#### Mandatory preconditions

These are requirements on the harness, not incidental prose. A test that
cannot satisfy them records **FAIL**, never a skip.

**A. Executed as the actual table owner (`postgres`).** If the harness
runs as any other role the observed code would be `42501`, a privilege
failure unrelated to the contract under test. For Test 19 the canary
relation is created by the connecting role in the same transaction, so
the executing role is its owner by construction (§16.4, §16.7).

**B. The target table must contain at least one row before the
destructive block.** The row-count leg is the independent second signal,
and it is **vacuous on an empty table**: if `pre_count = 0`, a fully
successful `TRUNCATE` also leaves the count at 0. The harness must
therefore ensure the table is non-empty, creating rollback-bound fixture
rows first where necessary (§18). If `pre_count = 0` at the moment of the
destructive block, **the test fails as invalid evidence** rather than
pretending the preservation leg supplied an independent signal.

**C. The sentinel `RAISE` must be the immediately next statement after
the `TRUNCATE`, inside the same subtransaction.** No statement may
intervene. This placement is the entire fail-safe property: the sentinel
must abort the subtransaction that performed the `TRUNCATE`. Raising it
after the block exited would leave a successful `TRUNCATE` promoted to
the parent transaction, and the design would be back to relying on the
outer `ROLLBACK`. An intervening statement could itself fail and skip the
sentinel.

**D. PASS requires both conditions, and only these two.** Expected guard
`P0001` **and** row count unchanged. **There is no message-content
condition on any official test.** The former `resources` identifier
requirement is removed as unnecessary rather than weakened, because
Test 19 no longer issues a multi-relation `TRUNCATE` and therefore has no
ambiguity about which relation raised (§16.7).

#### Classification

| Observed SQLSTATE | Row count | Verdict |
|---|---|---|
| `P0001` | unchanged | **PASS** |
| `P0001` | changed | **FAIL**: guard raised but rows moved, incoherent, must be surfaced |
| `NX001` sentinel | unchanged | **FAIL**: guard absent or broken; harness forced the rollback |
| `NX001` sentinel | changed | **FAIL**: guard absent **and** forced rollback did not restore rows. Most severe outcome. |
| any other | any | **FAIL**, recording the observed code. `42501` would mean the executing role lacks `TRUNCATE`. `0A000` would mean a foreign-key dependency blocked the statement before the guard was reached, which no official test can now encounter: all four target relations have no incoming foreign key (§2.7), and Test 19's canary is created without one. |

The row-count check is not decoration. It is the independent second
signal that catches a mistyped or mis-scoped sentinel, so a broken guard
cannot read green through a single point of failure.

**Message text is informational only, with no exceptions.** SQLSTATE
alone decides, per the convention locked by the RPC gate, because
PostgreSQL message text is locale-dependent. **No official test in this
design matches message text, matches a substring of message text, or
depends on which relation's trigger raised.** The harness may capture
`TABLE_NAME` or the message into a detail column for diagnosis, and
should, but no PASS condition reads it.

**Structured diagnostics fields are not message text and are not covered
by that prohibition.** `GET STACKED DIAGNOSTICS` exposes typed fields
PostgreSQL populates from the catalog, independent of `lc_messages`. Tests
12 through 14 gate `CONSTRAINT_NAME` on that basis (§16.8.5), which is the
only official use of a diagnostics field beyond `RETURNED_SQLSTATE`
anywhere in this design. The destructive tests in this section gate
`RETURNED_SQLSTATE` only.

**Row-count cost.** An exact count is required; an estimate cannot prove
preservation. These tables are small pre-production. If `audit_log` later
grows to where an exact count is expensive, the substitute is a bounded
proof (a known pre-existing row still present, plus a count floor), not a
weakened assertion.

### 16.3 Sentinel treatment

**Sentinel SQLSTATE: `NX001`.** Chosen deliberately.

- It must not be `P0001`, which is what every Nexus integrity guard
  raises. Reusing it would make a missing guard indistinguishable from a
  working one, which is the exact confusion this structure exists to
  prevent.
- Class `P0` is taken by PL/pgSQL (`P0000` `plpgsql_error`, `P0001`
  `raise_exception`, which is what a plain `RAISE EXCEPTION` yields,
  `P0002` `no_data_found`, `P0003` `too_many_rows`, `P0004`
  `assert_failure`), so the whole class is off limits.
- Class `XX` is PostgreSQL's internal-error class and must not be
  borrowed.
- `NX` is used by neither the SQL standard nor PostgreSQL, and `NX001`
  satisfies the five-character digits-and-uppercase-ASCII requirement
  that `RAISE ... USING ERRCODE` accepts. It does not fall in the
  special success or warning classes `00`, `01`, or `02`.

**Meaning:** guard missing or broken, but the harness successfully forced
the rollback. **Any sentinel occurrence is a FAIL**, never a pass with a
caveat.

The sentinel appears in exactly four places in the harness, one per
destructive test (Tests 17, 18, 19, 20), and nowhere else, so its
presence anywhere in the output is unambiguous. It is a harness construct
only and is never used by any production function.

### 16.4 Future-table canary design (Test 09)

Inside the rollback-bound harness, after the hardening migration is
applied:

1. **Assert the creator-role precondition first, as part of the test.**
   `current_user` must equal the role named in the migration's
   `FOR ROLE` clause, which is `postgres`. If the harness ran as any
   other role, the canary would be owned by that role, the rule would not
   apply, and the test would produce a confidently wrong answer in either
   direction. On failure this records **FAIL, never a skip**: there is
   deliberately no BLOCKED state in this accounting standard.
2. Create one fictional canary table **schema-qualified as
   `public.<canary_name>`**, owned by the connecting role. The
   qualification is not stylistic: an unqualified `CREATE TABLE` resolves
   through `search_path`, and a canary that landed in any other schema
   would be outside the `IN SCHEMA public` rule under test, producing a
   confidently wrong answer in either direction.
3. **Assert the resolved namespace before relying on any privilege
   result.** Resolve the created relation from `pg_class` and assert
   `relnamespace = 'public'::regnamespace`. This eliminates `search_path`
   ambiguity as a source of a false verdict. On failure this records
   **FAIL, never a skip.** Because Test 19 reuses this relation
   (§16.7), the namespace assertion also anchors the behavioral test.
4. **Official assertion, removal:** `has_table_privilege('service_role',
   <canary>, 'TRUNCATE')` is **false**.
5. **Official assertion, non-collateral damage:** all seven established
   surviving privileges remain **true** for `service_role` on the canary:
   `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `TRIGGER`,
   `MAINTAIN`. **All seven must pass.** This is the exact §2.3 baseline
   minus `TRUNCATE`, which is the only privilege the migration edits.
6. **On mismatch, the failure detail must print the expected privilege
   set and the observed privilege set**, and must note that a mismatch
   could also indicate an upstream platform provisioning change, which
   must be investigated before closing the gate rather than assumed to be
   a regression in this migration.
7. Record the full observed privilege set for `service_role`, `anon`, and
   `authenticated` on the canary as diagnostic detail. The `anon` and
   `authenticated` legs corroborate Migration 2's future-table posture
   but are recorded rather than gated, per §16.6.
8. **All Test 09 assertions complete here, and Test 09's verdict is
   recorded, before Test 19 touches the relation.** Test 19 reuses the
   same canary (§16.7) but must not begin until Test 09 has finished, so
   that the two tests remain logically independent: Test 09 observes a
   pristine `postgres`-created table with only its default ACL, and
   nothing Test 19 does can influence Test 09's result.
9. The canary table disappears with the outer `ROLLBACK`, since
   `CREATE TABLE` is transactional.

**Canary relation shape. Deliberately minimal.** The relation exists only
to carry a default-privilege observation (Test 09) and then a
single-relation behavioral `TRUNCATE` (Test 19). Anything beyond that adds
failure modes without adding evidence.

- Schema-qualified `public.<canary_name>`, created by the connecting role.
- **One** simple probe column, of an ordinary scalar type, sufficient to
  insert one deterministic fictional row. It must not be generated or
  identity, and must not depend on a sequence, so nothing outside the
  transaction is consumed and §20.3's sequence qualification does not
  acquire a second case.
- **No foreign keys out**, so the canary depends on no production row.
- **No incoming foreign keys**, which is what guarantees Test 19's
  `TRUNCATE` names one relation and reaches one relation, and why `0A000`
  is structurally impossible there (§16.2 classification).
- **No production trigger** of any kind. Test 19 adds exactly one
  transaction-bound `BEFORE TRUNCATE FOR EACH STATEMENT` trigger
  executing `public.fn_reject_truncate()` (§16.7.3, step C), and nothing
  else is ever attached.
- **No RLS**, and no RLS assumption is needed: both tests run as
  owner/`postgres`, and Test 09 reads privileges through
  `has_table_privilege`, which is a privilege question rather than a
  policy question.
- No comment, index, constraint, or default is required, and none should
  be added.

The canary is not a model of a production table and must not be elaborated
into one.

**Why the exact seven rather than "at least one".** The migration edits
the same default ACL entry that carries all eight privileges. An
"at least one ordinary privilege survives" assertion passes even if the
edit accidentally stripped six of them, which is a catastrophic outcome
reading green through the exact leg designed to catch it. §16.6 states
why gating the exact set here is legitimate.

`MAINTAIN` is included because it is present in the observed live
baseline (§2.2, §2.3). On a PostgreSQL version without it,
`has_table_privilege` raises rather than returning false, so the harness
fails loudly rather than silently.

**Behavioral, not catalog-based.** This composes global entries,
schema-specific entries, and hard-wired defaults automatically, which is
what catalog reading cannot do reliably. A mis-authored operation that
omitted `IN SCHEMA public` would edit the global row while the schema row
continued to grant `TRUNCATE`, and this canary would correctly fail.

**Supplement, not gate:** structured `pg_default_acl` inspection expanded
through `aclexplode`, recorded as a diagnostic for auditability, so a
reviewer can see the catalog state that produced the behavior.

That diagnostic earns its place by covering one case the behavioral
canary structurally cannot see. A correct `IN SCHEMA public` revoke and
that same revoke **plus an unintended additional global
(`defaclnamespace = 0`) `service_role` `TRUNCATE` revoke** produce an
identical result on a `public` canary. The second form is over-broad: it
would remove `TRUNCATE` from `service_role` for future
`postgres`-created tables in **every** schema, which is outside this
migration's stated scope (§7.4). Only the `pg_default_acl` expansion
distinguishes them, by showing whether a global row was edited. **No
additional official test is added for this**, because the outcome is
over-broad rather than unsafe and the diagnostic is sufficient to catch
it during closeout review.

**Residue consequence:** the independent residue checker must confirm
that no relation matching the canary name survives in `pg_class` (§20.1).

### 16.5 Owner contract proof (Test 08)

Ownership confers privileges independently of any explicit grant: when
`relacl` is `NULL` the owner holds everything implicitly, and while a
materialized `relacl` usually does contain an owner entry, requiring one
gates on an implementation detail rather than on the contract. The test
is therefore behavioral, and it resolves the owner from the catalog
rather than assuming it.

For all eight Platform Core tables:

- Resolve each table's owner from `pg_class.relowner`, cast to
  `regrole`.
- Assert all eight share a **single** owner.
- Assert that owner **equals the role named in the migration's
  `ALTER DEFAULT PRIVILEGES ... FOR ROLE` clause**, which is `postgres`.
- Assert `has_table_privilege(<that owner>, <table>, 'TRUNCATE')` is
  **true** for all eight.
- Record the resolved owner name as detail.

**Why the named-role assertion is required and is not hardcoding an
environment accident.** "All eight share one owner" is satisfied if all
eight are owned by some other role, in which case §7's `FOR ROLE
postgres` keying points at a role that does not create Platform Core
objects, §7 is silently ineffective, and the test would pass anyway. §7.2
explicitly relies on this test to prove that half of the assumption. The
migration itself depends on `postgres` being the creator role for future
default privileges, so asserting it is asserting the migration's own
contract.

**The two-layer proof lands in two different tests, which is the point.**
Test 08 proves the owner has effective privilege and that the fix did not
work by stripping the owner. Tests 17, 18, and 20 prove that on
`role_permissions`, `user_roles`, and `audit_log` the operation is
nonetheless rejected, and Tests 01, 03, and 19 prove the same for
`resources` compositely (§16.7). Privilege present, operation blocked.
Neither test alone states the control.

This also removes a trap: a future author seeing an owner-ACL assertion
fail could "fix" it by revoking from the owner, satisfying the letter of
a weaker test while destroying the control it described.

### 16.6 The non-collateral-damage principle

Stated once, and used to justify what is gated versus what is recorded
throughout §16:

> **Gate non-collateral-damage wherever this migration edits the object's
> ACL. Record, rather than gate, unrelated environment state.**

This resolves what would otherwise look inconsistent. Tests 05, 06, 07,
and 09 assert privilege sets that are, in the abstract, platform
provisioning properties. They are legitimately gated because this
migration **edits those exact ACLs**, and a delta assertion evaluated
once, at this migration's own gate, against a baseline measured
immediately beforehand (§2.2, §2.3), is not an eternal architecture
contract. It is the proof that a surgical edit was surgical.

The same principle is why the `anon` and `authenticated` legs of the
Test 09 canary are recorded rather than gated: §7's operation does not
touch those grantees' future-table posture, so re-proving Migration 2's
contract there would put evidence in the wrong record.

Two distinct contracts are therefore in play, and the document keeps them
separate:

- **Architecture contract:** `service_role` must never hold `TRUNCATE` on
  Platform Core tables or on future `public` tables created by
  `postgres`. Permanent, repository-owned, gated forever.
- **Migration non-collateral-damage contract:** this migration changed
  `TRUNCATE` and nothing else. Scoped to this migration's evidence run,
  gated against the recorded live baseline.

### 16.7 The `resources` composite integrity proof (Tests 01 + 03 + 19)

**Decision: the runtime gate does not execute any `TRUNCATE` against
`resources`.** Neither bare nor `CASCADE`. This section states the design
that replaces it, and why the replacement is stronger evidence rather
than weaker.

#### 16.7.1 Why no live `TRUNCATE` of `resources`

Two facts, both repository-derived, close off both forms.

**Bare `TRUNCATE resources` cannot reach the guard.** PostgreSQL checks
foreign-key dependencies for a `RESTRICT`-behavior `TRUNCATE` **before**
statement-level `TRUNCATE` triggers fire, so with `resources` referenced
by five tables the statement raises SQLSTATE **`0A000`** ("cannot
truncate a table referenced in a foreign key constraint") and
`fn_reject_truncate` is never invoked. An official test built on it would
fail deterministically against a fully correct migration. This was the
round-1 P1 (§24, D3).

**`TRUNCATE resources CASCADE` reaches the guard, but expands to twelve
relations.** §2.8 records the full transitive closure. PostgreSQL takes
`ACCESS EXCLUSIVE` on every one of them. Nine of the twelve carry no
`BEFORE TRUNCATE` guard after this migration, and the closure includes
`submission_revisions`, which §21 names as the highest-priority deferred
exposure precisely because its `raw_data`/`effective_data` payload is
deliberately not reconstructable from `audit_log`. It also includes
`requests` and `form_versions`, both permanence-contracted, and four
Commercial tables.

So the only statement that could reach `resources`' guard behaviorally
would be the single widest mass-deletion statement in the Nexus corpus,
aimed through the exact table the document itself identifies as holding
irreplaceable payload, in order to prove a contract about a different
table.

**That is precisely the situation §16.0 forbids.** Surrounding the
statement with twelve preservation counters would make it survivable; it
would not make it correct evidence practice. The right answer is not to
instrument a dangerous statement more heavily. It is not to issue it.

#### 16.7.2 The composite proof

The `resources` `TRUNCATE` integrity contract is stated as the
**conjunction of three independent official tests**, resting on one
documented PostgreSQL guarantee. **All four are required. If any single
one fails, `resources` protection is unproven and the gate does not
close.**

**Test 01 proves the enforcement function is table-independent**, from
`pg_proc.prosrc` for `'public.fn_reject_truncate()'::regprocedure`,
normalized-exact-equal to the canonical body (§16.8.0). This is the leg
that licenses the transfer in the first place, and it is gated rather than
assumed.

**Test 03 proves the production attachment**, on the real
`public.resources` relation, from the catalog (§16.8.2):

- a trigger exists with the expected name
  `trg_resources_reject_truncate`
- timing `BEFORE`
- event `TRUNCATE`
- level `FOR EACH STATEMENT`
- exact function object identity,
  `tgfoid = 'public.fn_reject_truncate()'::regprocedure`
- `tgenabled = 'O'` exactly

**Test 19 proves the enforcement behavior** of that same function object,
under a real statement-level `BEFORE TRUNCATE` invocation, against a
rollback-bound fictional canary relation (§16.7.3).

**All three legs resolve the function through the same catalog identity**,
`'public.fn_reject_truncate()'::regprocedure`, which is what makes the
conjunction a statement about one object rather than three loosely related
observations.

**Why the conjunction is sufficient, and why it is not a weakening.**

`fn_reject_truncate()` has **zero table-specific logic**: no branching,
no table access, no dynamic SQL, no catalog lookup, no data dependency
(§9). Its only variable input is `TG_TABLE_NAME`, which it uses solely to
compose the message text. **Its behavior therefore cannot differ between
the canary and `resources`.** That property is not incidental; it is a
designed-in contract of the function, inherited deliberately from
`fn_reject_update_delete()`, and it is what makes one behavioral proof
legitimately transferable to all four attachment sites.

**That property is now machine-gated by Test 01, and this is the
correction that closes the round-3 P1.** Until it was gated, the transfer
rested on prose: a `fn_reject_truncate` carrying a single table-specific
branch that allowed `resources` while raising on everything else would
have passed Test 03 (attached correctly), Tests 17, 18, and 20 (raises on
those three tables), and Test 19 (the canary is not `resources`), while
leaving `resources` entirely unprotected and the gate reading 20 of 20.
See §24, D19. The premise that makes the composite valid must be evidence,
not assertion, which is also why §16.0 now states it as a precondition on
the principle itself.

The four legs divide the contract along its actual seams:

| Question | Answered by | Evidence type |
|---|---|---|
| Does the enforcement function behave identically for every table, so one behavioral proof transfers? | Test 01 | production catalog, canonical body |
| Is the guard attached to the real `resources`, correctly shaped, enabled, and executing that exact function object? | Test 03 | production catalog |
| Does that exact function object reject a statement-level `TRUNCATE` with `P0001` and leave rows intact? | Test 19 | live behavior |
| Will PostgreSQL invoke an enabled `BEFORE TRUNCATE FOR EACH STATEMENT` trigger before truncating? | PostgreSQL, documented (§16.1) | engine guarantee |

The final row is the only part a live `TRUNCATE resources CASCADE` would
have "proven" that the three official tests do not, and it is not Nexus's
code. **We test our own code and
configuration; we do not re-test PostgreSQL's trigger engine by putting
production relations under a mass-deletion command.**

Nothing in the composite depends on cascade trigger ordering, on message
substring matching, or on any locale-dependent text. The previous
`resources` message-identifier discriminator is therefore **removed as
unnecessary, not weakened**: it existed only to disambiguate which
relation raised inside a twelve-relation set, and there is no longer a
set.

#### 16.7.3 Test 19: `fn_reject_truncate` behavioral canary

**Reuses the Test 09 canary relation**, which keeps the harness simpler
(one fictional relation, one residue selector, one namespace assertion)
while leaving the two tests logically independent: Test 09 completes and
records its verdict against a pristine `postgres`-created table before
Test 19 touches it (§16.4, step 8). Test 19 adds a trigger and a row;
neither can influence a default-privilege observation already made.

Conceptual sequence:

**A.** Test 09 has created `public.<canary_name>`, asserted its resolved
namespace is `public`, completed all default-privilege assertions, and
recorded its verdict.

**B.** Insert at least one fictional row into the canary as
owner/`postgres`.

**C.** Attach a transaction-bound
`BEFORE TRUNCATE FOR EACH STATEMENT` trigger on the canary executing
`public.fn_reject_truncate()`. The function is referenced
schema-qualified. Nothing about the function is redefined, copied, or
adapted: this is the identical production object the migration created
and that Test 01 and Test 03 assert against.

**D.** Capture `pre_count` at the outer transaction level and require
`pre_count > 0`, per §16.2 precondition B. Step B exists to guarantee
this, so the row-count leg is never vacuous.

**E.** Inside the identical fail-safe nested subtransaction structure
used by Tests 17, 18, and 20 (§16.2), attempt **`TRUNCATE` of the canary
relation only**. No `CASCADE`. No other relation is named, and the canary
is created without incoming foreign keys, so no relation can be drawn in.
If control reaches the next statement, the `NX001` sentinel is raised as
the **immediately next statement inside the same subtransaction**, per
§16.2 precondition C.

**F.** PASS requires exactly two conditions:

- `RETURNED_SQLSTATE = 'P0001'`
- `post_count = pre_count`

**G.** `TABLE_NAME` and the message may be captured into the detail
column for diagnosis, and should be. **No PASS condition reads them.** No
production contract depends on message ordering, message content, or
substring matching.

**Safety properties.** The canary is the only relation involved. No
production table is truncated by this test. The trigger, the row, and the
relation all disappear with the outer `ROLLBACK`, and the relation
remains covered by the independent residue proof, which must confirm no
relation matching the canary name survives in `pg_class` (§20.1).

**Failure diagnosis.** A `P0001` here with `post_count = pre_count`
proves the function enforces. An `NX001` proves it does not, and because
the canary is the only relation involved, the failure is unambiguous and
costs nothing to reproduce. A `42501` would mean the harness is not
running as the canary's owner, which contradicts Test 09's own creator
precondition and should be read as a harness fault.

#### 16.7.4 Why this is not an inconsistency with Tests 17, 18, and 20

The distinction is **risk-based and derived, not arbitrary.**

`role_permissions`, `user_roles`, and `audit_log` each have **zero
incoming foreign keys** (§2.7, verified across all migration files). A
bare `TRUNCATE` on any of the three names one relation and reaches
exactly that one relation. The operation is confined to the single
intended table, so the live test's blast radius equals the contract under
test. Those tests stay live, and they are the strongest available
evidence for those three tables: real table, real trigger, real
statement, real row count.

`resources` is categorically different. It is the only one of the four
protected tables whose live `TRUNCATE` cannot be confined: bare is
unreachable and `CASCADE` reaches twelve relations. The exception exists
because the blast radius diverges from the contract, which is exactly the
condition §16.0 names.

Stated as a rule a future author can apply: **keep the live table-specific
`TRUNCATE` test wherever the statement is confined to the table under
test; use the composite proof wherever it is not, and only where the
enforcement function's table-independence is itself gated** (§16.0,
§16.8.0). Applied to the four protected tables today, that yields three
live tests and one composite, and it would yield the same answer for any
table added later without needing this decision re-argued.

**The two conditions are separate and both are required.** Confinement
failure establishes only that the live test should not be run. It does not
establish that a composite proof is adequate to replace it. If a
non-confined table were ever guarded by a function whose body was not
canonical and gated, the correct answer would be neither the live test nor
the composite: it would be to make the function generic and gate it, or to
find a confined behavioral path, before claiming the contract proven.

### 16.8 Official test inventory

| # | Test | Proves |
|---|---|---|
| 01 | `fn_reject_truncate` structural, security, **and canonical table-independent body** catalog contract | exists, returns `trigger`, `plpgsql`, `SECURITY INVOKER`, `search_path = pg_catalog`, owner resolved from catalog, **and `prosrc` normalized-exact-equal to the canonical body, which is the gated proof of table independence** (§16.8.0). **This is the first of the three official legs of the `resources` composite proof** (§16.7.2) |
| 02 | `fn_reject_truncate` EXECUTE contract | `anon`/`authenticated` effective `EXECUTE` false; no `PUBLIC` `EXECUTE` in the function ACL; no positive `service_role` grant required (§16.8.1) |
| 03 | Platform Core `BEFORE TRUNCATE` attachment contract | required on the four protected tables by **exact function OID** (`tgfoid`) and `tgenabled = 'O'` exactly; absent from the other four Platform Core tables; nothing asserted outside Platform Core (§16.8.2). **Also the production-attachment leg of the `resources` composite proof** (§16.7.2) |
| 04 | `service_role` TRUNCATE absent, all 8 | effective privilege false **and** no direct `service_role` `TRUNCATE` aclitem |
| 05 | `service_role` non-TRUNCATE privileges preserved, all 8 | the exact §2.2 live baseline survives, with the `audit_log` `UPDATE`/`DELETE` exception (§16.8.3) |
| 06 | `anon`/`authenticated` TRUNCATE posture preserved, all 8 | Migration 2's posture not collaterally altered |
| 07 | `PUBLIC` direct TRUNCATE posture, all 8 | no `PUBLIC` `TRUNCATE` aclitem appeared |
| 08 | Owner contract, all 8 | §16.5; single shared owner, resolved from catalog, equal to `postgres`, holding effective `TRUNCATE` |
| 09 | Future `postgres`-created public-table default-privilege canary | §16.4; canary schema-qualified in `public` with resolved namespace asserted; `TRUNCATE` false and all seven baseline privileges true |
| 10 | Pre-existing row-level guards unchanged | the four row-level immutability and history guards and their functions still attached and unmodified |
| 11 | Both corrected foreign-key catalog contracts | `user_roles_user_id_fkey` and `audit_log_actor_user_id_fkey` both `RESTRICT`, with expected child column and parent (§16.8.4) |
| 12 | `app_users` parent with active grant: `DELETE` rejected `23503` **from `user_roles_user_id_fkey`** | failure layer moved from trigger to foreign key, and the named constraint is the one that produced it (§16.8.5) |
| 13 | `app_users` parent with revoked grant: `DELETE` rejected `23503` **from `user_roles_user_id_fkey`** | revoked history still pins identity, through the named constraint (§16.8.5) |
| 14 | `app_users` parent referenced only as audit actor: `DELETE` rejected `23503` **from `audit_log_actor_user_id_fkey`** | the corrected `audit_log` foreign key blocks the parent delete directly, through the named constraint (§16.8.5) |
| 15 | Audited-write regression | a normal audited write still produces correct audit evidence |
| 16 | Existing row-level integrity-guard regression | `audit_log` `UPDATE`, `resources` `UPDATE`, grant identity rewrite, grant `DELETE`, all rejected as expected |
| 17 | Fail-safe live TRUNCATE, `role_permissions` | §16.2; `P0001` and unchanged count. Confined: zero incoming foreign keys |
| 18 | Fail-safe live TRUNCATE, `user_roles` | §16.2; `P0001` and unchanged count. Confined: zero incoming foreign keys |
| 19 | `fn_reject_truncate` behavioral canary | §16.7.3; the shared production function rejects a statement-level `TRUNCATE` with `P0001`, rows intact, on a rollback-bound fictional relation. **With Tests 01 and 03 this is the composite `resources` protection proof** (§16.7.2). No production table truncated, no `CASCADE` |
| 20 | Fail-safe live TRUNCATE, `audit_log` | §16.2; `P0001` and unchanged count. Confined: zero incoming foreign keys |

**Official count: 20.**

**Composite contracts, recorded so the inventory is not misread as a
one-test-per-contract list.** Two contracts are deliberately proven by a
conjunction of official tests rather than by a single test, and in both
cases the split follows the catalog/behavior seam:

- **`resources` `TRUNCATE` protection** = Test 01 (canonical
  table-independent body) **and** Test 03 (production attachment by exact
  function OID) **and** Test 19 (behavioral enforcement of that same
  function object), §16.7.2.
- **The two-layer owner control** = Test 08 (owner holds the privilege)
  **and** Tests 17, 18, 20 plus the `resources` composite (the operation
  is nonetheless rejected), §16.5.

Neither is test-count inflation and neither is a weakening. Each leg
proves something the others cannot, and every leg is independently gated
in `MACHINE_SUMMARY`.

#### 16.8.0 Test 01 detail: the canonical body contract

Test 01 keeps every existing leg: the function exists with the expected
signature, `returns trigger`, `language plpgsql`, `SECURITY INVOKER`,
`search_path = pg_catalog`, and an owner resolved from the catalog.

**It gains one further official leg: `pg_proc.prosrc` for
`public.fn_reject_truncate()` must be normalized-exact-equal to the
canonical body.**

**Why this is a deliberate Nexus contract rather than implementation-detail
testing.** §16.7.2 proves the `resources` integrity contract by
transferring Test 19's behavioral observation from a fictional canary to
production `public.resources`. That transfer is valid **only** because the
function has no table-specific behavior. Until this leg existed, that
property was specified in prose (§9) and asserted in the transferability
argument, but nothing in the gate observed it. A function body carrying a
single table-specific branch would satisfy every other test in the
inventory while leaving exactly one table unprotected: see §24, D19, for
the constructed false-PASS this closes. The canonical body is therefore
the machine proof of the property that makes the composite evidence valid,
and it is gated for the same reason §16.8.2 gates `tgenabled`.

**The canonical body.** Conceptual, for the contract's shape. **Not
authored migration SQL.** The literal is fixed when the migration is
authored, and the harness must embed that exact applied text as its
expected constant.

```
-- CONCEPTUAL / PROPOSED. NOT AUTHORED. NOT APPLIED.
begin
  raise exception '% cannot be truncated: TRUNCATE is not permitted on this table', tg_table_name;
end;
```

It contains exactly one statement. `TG_TABLE_NAME` appears exactly once,
as a format argument to `RAISE`, which is diagnostic message composition
and nothing else. The raise is plain, yielding `P0001` per §9.

**The comparison method, stated so it cannot be weakened into a
heuristic.**

1. Read `prosrc` for the function resolved as
   `'public.fn_reject_truncate()'::regprocedure`, so the body inspected
   belongs to the same object Test 03 and Test 19 use.
2. Normalize both the observed and the expected text identically:
   normalize line endings, collapse every run of whitespace to a single
   space, and trim leading and trailing whitespace. Case is **preserved**,
   and any comment written inside the body is part of the canonical string.
   No other transformation is applied.
3. Assert **equality** against a single expected constant.

**Substring matching, regular expressions, keyword-absence checks, and
statement counting are explicitly forbidden as the gate.** "`prosrc` does
not contain `if`" and "`prosrc` contains one `raise`" are both
insufficient: the first is defeated by `case`, dynamic `EXECUTE`, or a
`SELECT`, and the second is defeated by a branch that raises on one path
and returns on another. Only equality against the whole normalized body
excludes the entire class.

**What the equality therefore excludes, by construction.** Any body
containing `if tg_relid = ...`, `if tg_table_name = ...`, `case`, a
dynamic `EXECUTE`, a `SELECT` or any other table access, a catalog lookup,
a `return` path, a data dependency, a special case for `resources`, or a
special case for any other table, differs from the canonical string and
fails. No enumeration of forbidden constructs is required, and none is
relied on.

**Failure detail** must print the normalized expected body and the
normalized observed body, so a mismatch is diagnosable without rerunning
anything. Both are non-secret function source belonging to this
repository's own design, so printing them exposes nothing.

**Obligation on a future author.** The canonical body and this assertion
are a matched pair. Changing `fn_reject_truncate`'s body in a later
migration requires updating this expected constant in the same change, and
requires re-deriving §16.7.2's transferability argument if the new body is
not table-independent.

#### 16.8.1 Test 02 detail

`anon` and `authenticated` are ordinary named roles, so their effective
`EXECUTE` is gated behaviorally with `has_function_privilege(...,
'EXECUTE')`, expected **false** for both.

`PUBLIC` is not a normal named role for this purpose, so
`has_function_privilege('public', ...)` must **not** be used. `PUBLIC` is
proven structurally from `pg_proc.proacl`, expanded through
`aclexplode(coalesce(proacl, acldefault('f', proowner)))`, asserting that
no row with `grantee = 0` carries `EXECUTE`.

`proacl` must also be asserted non-null, which remains part of the Nexus
trigger-function hardening convention: a null `proacl` means the built-in
default is in force, which grants `PUBLIC` `EXECUTE`.

`service_role`'s `EXECUTE` state is recorded as diagnostic detail only.
No positive `service_role` grant is made and no `service_role` revoke is
added (§10).

#### 16.8.2 Test 03 scope

**Positive, required.** For each of exactly `audit_log`, `resources`,
`user_roles`, `role_permissions`, all six legs:

1. a trigger exists with the expected name `trg_<table>_reject_truncate`
2. timing `BEFORE`
3. event `TRUNCATE`
4. level `FOR EACH STATEMENT`
5. **exact function object identity:
   `tgfoid = 'public.fn_reject_truncate()'::regprocedure`**, or the
   equivalent exact OID comparison
6. **`tgenabled = 'O'` exactly**

**Why leg 5 is object identity and not a function name.** Proving only
that the trigger calls *something named* `fn_reject_truncate` is not
enough, because Test 01's canonical-body assertion and Test 19's
behavioral assertion are both made against
`'public.fn_reject_truncate()'::regprocedure`. If Test 03 matched by bare
name, the three legs of the `resources` composite proof could in principle
concern different objects, and the conjunction would prove nothing about
any single one of them. Resolving all three legs through the same catalog
identity is what makes the conjunction sound. This matters most for
`resources`, which has no independent behavioral corroboration.

**Why leg 6 is exactly `'O'` and not `'O'` or `'A'`.** The enabled check
matters at all because an attached but disabled trigger would satisfy a
naive attachment assertion while enforcing nothing. `'O'` is the state the
migration's plain `CREATE TRIGGER` produces, so it is the state the
contract describes. `'A'` (`ENABLE ALWAYS`) is **not** interchangeable
merely because it fires in more situations: it is different behavior with
respect to `session_replication_role`, and adopting it would be a
conscious architecture decision about replication posture that this design
has not made and does not analyse. Accepting `'A'` here would let a future
migration silently change replication behavior without any gate noticing.
If `ENABLE ALWAYS` is ever wanted, it belongs in a separate design with
its own reasoning, and this assertion is what will force that
conversation. `'D'` and `'R'` both fail, correctly.

**This test carries additional weight for `resources`.** For
`role_permissions`, `user_roles`, and `audit_log` the catalog assertion is
corroborated by a live confined `TRUNCATE` (Tests 17, 18, 20). For
`resources` no live `TRUNCATE` is issued (§16.7.1), so Test 03's
`resources` leg is the sole production-attachment evidence and joins Tests
01 and 19 to form the composite proof (§16.7.2). The `resources` leg must
therefore be reported as its own distinct assertion within Test 03, not
merged into an aggregate "all four attached" boolean, so a reviewer can
see which leg of the composite failed.

**Negative, required, Platform Core only.** For each of exactly
`app_users`, `resource_types`, `roles`, `permissions`: no statement-level
`BEFORE TRUNCATE` protection introduced by this migration exists. This is
the over-application check, and it is what proves §8's derived
attachment rule was applied as designed.

**Deliberately not asserted:** anything about tables outside the eight
Platform Core tables. An assertion that `fn_reject_truncate` is attached
to no other table in schema `public` would become stale, and would fail,
the moment later Migration 4 through 8 hardening legitimately reuses the
generic function on the tables named in §21. A gate that punishes correct
future work is a defect, not caution, and it would also discourage
exactly the reuse discipline §9 exists to promote.

A schema-wide inventory of every `BEFORE TRUNCATE` trigger remains
available as a diagnostic (§16.9), so a reviewer can see the wider
posture without the gate going stale.

#### 16.8.3 Test 05 detail

After hardening, for `app_users`, `permissions`, `resource_types`,
`resources`, `role_permissions`, `roles`, `user_roles`, `service_role`
must still hold exactly these seven non-`TRUNCATE` privileges, all true:
`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `TRIGGER`,
`MAINTAIN`.

For `audit_log`, `service_role` must still hold `SELECT`, `INSERT`,
`REFERENCES`, `TRIGGER`, `MAINTAIN` as **true**, and `UPDATE` and
`DELETE` as **false**, per Migration 1's existing revoke.

`TRUNCATE` is covered separately by Test 04 and must be false everywhere.

This is the more important half of the non-collateral-damage proof,
because §6 edits the ACLs of live tables the application depends on now.
A collateral over-broad revoke here would break the trusted path, and
without this test the gate would read green while doing so. §16.6 states
why gating it is legitimate.

#### 16.8.4 Test 11 detail

Catalog contract for both corrected constraints, asserted by exact name:

| Constraint | Child | Parent | Required `ON DELETE` |
|---|---|---|---|
| `user_roles_user_id_fkey` | `user_roles.user_id` | `app_users.id` | `RESTRICT` |
| `audit_log_actor_user_id_fkey` | `audit_log.actor_user_id` | `app_users.id` | `RESTRICT` |

Tests 12, 13, and 14 then prove the behavior, each asserting both the
SQLSTATE and the rejecting constraint's name (§16.8.5). **Each fixture
graph must also be isolated** so that a different foreign key cannot
produce the expected `23503` accidentally (§18). Without isolation, a
single fixture identity referenced by both a grant row and an audit row
would make Tests 12 through 14 mutually indistinguishable, and could also
produce `P0001` from the audit immutability trigger instead of `23503`.
The two mechanisms are kept together deliberately: see §16.8.5.

**Consolidation review.** Three candidates were considered and rejected
as inflation: the creator-role precondition and the canary namespace
assertion are validity conditions of Test 09 and fail it rather than
standing alone; "the owner is blocked by the trigger despite holding
privilege" is already exactly what Tests 17, 18, 20 and the `resources`
composite prove; and the `pg_default_acl` global-entry check is a
diagnostic, not a safety contract (§16.4). Nothing in the inventory is
redundant: Tests 04, 06, and 07 cover distinct grantees, and Tests 12,
13, and 14 prove three distinct pinning contracts through three isolated
fixture graphs.

**Deliberately not tested live, and now consistently so.** No `TRUNCATE`
is issued against any relation whose truncation set exceeds the contract
under test:

- A `TRUNCATE` on an unguarded Platform Core table to prove the guard was
  not over-applied. Test 03's negative leg proves exact attachment from
  the catalog at zero cost, and a live attempt would remove rows until
  rollback for no additional information.
- Any `TRUNCATE` against `resources`, bare or `CASCADE` (§16.7.1).
- Any `CASCADE` anywhere in the official inventory.

#### 16.8.5 Tests 12, 13, and 14 detail: constraint identity

Each of the three parent-delete tests attempts a `DELETE` of its own
isolated `app_users` fixture identity inside a per-test PL/pgSQL exception
handler, and **PASS requires both conditions:**

| Test | Deletion target | Required SQLSTATE | Required `CONSTRAINT_NAME` |
|---|---|---|---|
| 12 | `GRANT_DELETE_TARGET_ACTIVE` | `23503` | `user_roles_user_id_fkey` |
| 13 | `GRANT_DELETE_TARGET_REVOKED` | `23503` | `user_roles_user_id_fkey` |
| 14 | `AUDIT_ACTOR_DELETE_TARGET` | `23503` | `audit_log_actor_user_id_fkey` |

The constraint name is read with
`GET STACKED DIAGNOSTICS ... CONSTRAINT_NAME` inside the handler.

**This is structured diagnostics, not message text, so it does not breach
the locale-independence convention.** `CONSTRAINT_NAME` is a typed
diagnostics field PostgreSQL populates from the catalog, independent of
`lc_messages`. The prohibition in §16.2 is specifically on matching
message text or substrings of it, and this assertion reads no message. The
detail column may still capture `MESSAGE_TEXT` for diagnosis, and no PASS
condition reads it.

**Why this is added on top of fixture isolation rather than instead of
it.** Isolation (§18.1) is what makes the intended constraint the only one
that *can* fire; the `CONSTRAINT_NAME` assertion is what proves it
actually *did*. Isolation alone leaves the correctness of Tests 12 through
14 resting on fixture-construction discipline: if a future harness edit
accidentally gave a deletion target a second `app_users` dependency, or
set `app.current_user_id` to a deletion target during its own fixture
insert, the test would still observe `23503` and still pass while proving
a different constraint. Both corrected foreign keys are `RESTRICT` after
this migration, so both produce the same SQLSTATE, which is exactly why
SQLSTATE alone cannot distinguish them. Asserting the name closes that
gap at no cost and makes each test self-proving.

Tests 13 and 14 are the pair this most protects. Test 13 exists
specifically to prove that a **revoked** grant still pins identity, and
Test 14 exists specifically to prove the **`audit_log`** foreign key
blocks the parent delete. Neither claim survives if the rejection could
have come from the other constraint.

**Keep the fixture isolation regardless.** Defense in depth is appropriate
here: isolation prevents the ambiguity, and the name assertion detects it
if prevention ever lapses. §18.1's isolation requirements are unchanged and
remain mandatory.

### 16.9 Diagnostics

Outside the machine gate, recorded alongside it. **None of these counts
in `MACHINE_SUMMARY`.**

Every diagnostic below is read-only or narrative. **No diagnostic issues a
`TRUNCATE`, and no diagnostic acquires `ACCESS EXCLUSIVE` on any
production relation.**

- **The bare `TRUNCATE resources` observation: STATIC / NARRATIVE
  DIAGNOSTIC ONLY. Not executed.** It is stated as a conclusion derived
  from the repository foreign-key graph: because `resources` is
  referenced by five tables, a bare `TRUNCATE resources` would raise
  `0A000` from the foreign-key dependency layer before
  `fn_reject_truncate` was reached. Recorded as evidence that the
  incidental layer described in §2.7 currently exists, never as an
  official contract, because the topology it depends on is not a control
  and can legitimately change. **The statement is not run.** There is no
  reason to take `ACCESS EXCLUSIVE` on `resources` merely to re-prove
  PostgreSQL's own foreign-key topology behavior, and doing so would
  contradict §16.0. The `pg_constraint` inspection that establishes the
  topology is read-only and is the diagnostic.
- The `TRUNCATE resources CASCADE` transitive closure (§2.8), restated in
  the evidence record so the closeout shows why no `CASCADE` was
  executed. Derived from `pg_constraint`, read-only.
- Full `service_role` privilege observation on all eight tables after
  hardening, beyond the gated set.
- **Pre and post `service_role` privilege snapshot across the tables of
  schema `public`**, recorded if the harness can do so cheaply from
  `has_table_privilege` over `pg_class`. Its purpose is to surface a
  collateral privilege edit that named a table outside the eight, which
  no official test covers. **Diagnostic only.** Unrelated Migration 4
  through 8 environment privileges are deliberately **not** turned into
  this migration's official contract: that would be the eternal-contract
  error §16.6 exists to prevent.
- Measured `TRUNCATE` exposure on the Migration 4 through 8 tables, to
  size the deferred work (§21).
- Whether `anon` and `authenticated` hold `CREATE` on schema `public`,
  the input that sets priority for the deferred `search_path` work
  (§13.1).
- Structured `pg_default_acl` and `aclexplode` inspection, supplementing
  Test 09, and the only evidence that distinguishes a correctly scoped
  `IN SCHEMA public` revoke from one accompanied by an unintended global
  revoke (§16.4).
- Schema-wide inventory of every `BEFORE TRUNCATE` trigger in `public`,
  supplementing Test 03 (§16.8.2).
- Production-row preservation counts (§20.2).

---

## 17. Machine accounting standard

The harness must emit exactly one summary line:

```
MACHINE_SUMMARY official_total=20 official_distinct=20 official_passed=20 official_failed=0
```

The future runner must require **exactly one** matching line (zero means
the harness never reached its report; more than one means ambiguous or
duplicated output, which is a failure and not something to disambiguate
with `tail -n 1`), then gate all four fields **independently**.

`official_distinct` is machine-gated rather than merely printed, because
total, passed, and failed alone would still read green if one test number
were recorded twice while another vanished.

The runner must never accept the mere presence of the text "20 PASS"
anywhere in the output: that string can appear inside a detail column.

Diagnostics, including the static narrative bare-`TRUNCATE resources`
observation, are recorded outside this accounting and never contribute to
any of the four fields.

**The runner is not authored yet.**

---

## 18. Fixture strategy

One outer `BEGIN`, zero `COMMIT` anywhere in the harness, one
unconditional `ROLLBACK`. Expected failures become result rows through
per-test PL/pgSQL exception handlers, which are internally
subtransactions so a raised error never aborts the outer transaction.
`ON_ERROR_STOP` stays on so a genuine harness error fails loudly.

Fixtures must be unmistakably fictional: synthetic actors whose email
addresses end in the reserved `.invalid` domain, and a fixed canary UUID
block distinct from the three already in use by prior harnesses. No real
person, customer, or business data appears anywhere. Every `app_users`
fixture requires a fictional `auth.users` parent row, because
`app_users.id` references `auth.users (id)`.

### 18.1 Isolated fixture identities

One `app_users` identity is not sufficient. If the same identity were
used both as the audited-write actor and as a deletion target, then the
pre-migration `SET NULL` path or, after the migration, the corrected
`audit_log` foreign key would pin it, and Tests 12 through 14 could
observe `P0001` or the wrong `23503` source instead of the intended one.
At minimum four isolated identities are required:

| Fixture | Role in the harness | Isolation requirement |
|---|---|---|
| `ACTOR` | Performs audited writes; supplies `app.current_user_id` and the actor GUC context | **Never** used as a deletion target |
| `GRANT_DELETE_TARGET_ACTIVE` | Referenced by an **active** `user_roles` row; used by Test 12 to prove the parent delete is rejected `23503` through the corrected `RESTRICT` foreign key | Must **never** appear as `audit_log.actor_user_id`, and must have no other dependent reference |
| `GRANT_DELETE_TARGET_REVOKED` | Referenced only by a **revoked** `user_roles` history row; used by Test 13 to prove revoked history also pins identity | Must **never** appear as `audit_log.actor_user_id`, and must have no other dependent reference |
| `AUDIT_ACTOR_DELETE_TARGET` | Referenced **only** by `audit_log.actor_user_id`; used by Test 14 to prove the corrected `audit_log_actor_user_id_fkey` blocks the parent delete with `23503` | Must have **no** `user_roles` dependency and no other dependent reference |

Each deletion-target graph must be isolated so that exactly one foreign
key can produce the expected `23503`, and the test therefore proves the
constraint it names rather than any constraint that happens to fire.

### 18.2 Other fixture rules

Every fixture value must be resolved into plain scalars **before** any
role switch, and no temporary-schema object may be referenced while
role-switched. Temporary objects are owned by the connecting role and
become unreadable under a switched role. This rule is inherited from the
Migration 8 and RPC harnesses, where violating it produced a false
failure.

Where a protected table is empty before its destructive test, the harness
must insert rollback-bound fixture rows first so the per-test row-count
check is non-vacuous (§16.2 precondition B). This applies to Tests 17,
18, and 20. For Test 19 the canary row insert is not conditional: it is
step B of §16.7.3 and always runs, because a freshly created canary is
always empty.

The Test 19 canary trigger is a transaction-bound object like the canary
relation itself, created inside the outer `BEGIN` and disappearing with
the `ROLLBACK`. It references the production `public.fn_reject_truncate()`
schema-qualified. **The function is never redefined, copied, wrapped, or
adapted for the harness**: a copy would prove something about the copy,
not about the deployed object, and would silently break the transferable-
behavior argument in §16.7.2.

No trigger, RLS policy, foreign key, or constraint is disabled or
bypassed to make any test pass. No cleanup `DELETE` exists anywhere; the
rollback is the only cleanup.

---

## 19. Migration coherence: one migration

**Decision: ONE Platform Core Integrity Hardening migration.** This is
settled, not a recommendation with a fallback.

It contains three clearly labelled sections, which together account for
all eight of §3's conceptual operations with none left outside the
structure:

- **A. `TRUNCATE` privilege and integrity hardening** (operations 1
  through 5).
- **B. Historical and immutable foreign-key corrections** (operations 6
  and 7), both concerning `app_users` as parent.
- **C. Comments and schema-contract documentation** (operation 8), which
  makes the documented contract on the affected tables, columns, and
  functions match the contract now enforced.

Section C is a section rather than an afterthought because §1's entire
premise is that a declared contract and an enforced contract had drifted
apart. Leaving the comments outside the described structure would repeat
that error in miniature. The section labelling does not change the
statement order established below.

Reasoning. All of it corrects the same Platform Core trust and integrity
boundary. Neither section changes business data. Both corrected
referential actions are already unreachable in their declared form, so
nothing can depend on the behavior being replaced. Splitting would
produce two design records and two runtime gates for one coherent
correction, which is worse documentation rather than better risk
management, and it would deliver no meaningful risk reduction: the
migration already takes locks of the same class through `CREATE TRIGGER`,
so the foreign-key work does not change its lock character (§12.3).

Deferring the `search_path` item (§13.1) is what actually keeps the
rollback reasoning clean, because that was the item with a platform-wide
blast radius.

**Statement ordering.** The order in §3 is deliberate. Operation 2
immediately follows operation 1 so the new function is never left
`PUBLIC`-callable in the statement stream. Operations 3 through 5 place
the integrity layer before the privilege layer, so no point in the
sequence reads as "privilege removed, guard not yet present". The
foreign-key corrections come last among the schema changes, and comments
last of all.

**Atomicity, stated precisely.** Every statement proposed here is
transactional PostgreSQL DDL: `CREATE FUNCTION`, `REVOKE`,
`CREATE TRIGGER`, `ALTER DEFAULT PRIVILEGES`,
`ALTER TABLE ... DROP CONSTRAINT`, `ALTER TABLE ... ADD CONSTRAINT`, and
`COMMENT`. **When applied together in a single PostgreSQL transaction
they roll back together and do not leave a partial schema state.** This
document does not claim that any particular deployment mechanism
guarantees that wrapping. At implementation time the actual Supabase CLI
execution path must be verified rather than generalised from PostgreSQL
semantics to every deployment mechanism.

---

## 20. Residue and preservation

Two separate post-run requirements. **Both are mandatory for gate
closure. A runner exiting 0 does not close this gate.**

### 20.1 Zero residue rows

An independent, fresh, post-rollback connection verifies that no canary
fixture row survives anywhere the harness could have written, and that
**no relation matching the canary table name from Test 09 survives in
`pg_class`**. That single relation check covers Test 19 as well, since
Test 19 reuses the same relation (§16.7.3), and it implicitly covers the
transaction-bound Test 19 trigger, which cannot outlive the relation it
is attached to.

The residue check must be a separate connection, never a re-query inside
the same session. It selects on fixed, unmistakably fictional canary
identifiers; it never asserts that a table "looks empty", because these
tables legitimately hold data.

**Objects that must be covered.** Every fixture-bearing persistent object
the harness can touch:

`auth.users`, `app_users`, `resource_types`, `resources`, `roles`,
`permissions`, `role_permissions`, `user_roles`, `audit_log`, and the
Test 09 canary relation in `pg_class`.

`auth.users` is included because every `app_users` fixture requires a
fictional `auth.users` parent (§18). It sits outside Platform Core and
would be missed by a checker scoped only to the eight Platform Core
tables.

**`audit_log` must be searched by payload, not only by identifier, and
the rule is stated durably rather than as a closed column list.**

> **The independent residue checker must inspect every `audit_log` field
> capable of holding a harness-supplied canary value.**

At the current schema that includes at least:

| Column | Why it can carry canary evidence |
|---|---|
| `row_id` | the primary key of the audited fixture row |
| `actor_user_id` | the fixture identity that performed the write |
| `request_id` | populated from the harness request GUC contract |
| `actor_context` | JSONB, populated from the `app.actor_context` GUC the `ACTOR` fixture supplies |
| `before_value` | full row image of a fixture row that was updated or deleted |
| `after_value` | full row image of a fixture row that was inserted or updated |

Detection uses deterministic canary UUIDs, email prefixes in the reserved
`.invalid` domain, and explicit JSON markers, so every column above can be
searched by an exact selector rather than a heuristic.

**Why `resource_id` and `db_role` are not additional carriers under this
harness contract, recorded so their absence reads as analysed rather than
overlooked.** `audit_log.resource_id` is populated by `fn_audit_row` only
where the audited row has a column literally named `resource_id`. No
audited Platform Core table has one: `user_roles` names its column
`scope_resource_id`, and `resources` itself is deliberately unaudited by
Migration 1. So `resource_id` stays NULL for every audit row this harness
can generate, and a canary `resources` identifier reaches `audit_log` only
inside `before_value`/`after_value`, both of which are covered above.
`db_role` records the session role, which is `postgres` or `service_role`,
never a harness-supplied value. **Neither exclusion narrows the rule.** If
a future migration attaches `fn_audit_row('resource_id')` to a table this
harness writes, or adds any column that can carry a supplied value, the
rule above already obliges covering it, and this note must be re-derived
rather than trusted.

Two reasons the rule is stated as a rule and not a list. First, a fixture
row deleted during a regression test can survive **only** as historical
evidence inside an audit payload, so a checker reading only identifier
columns would report clean while that evidence persisted. Second,
`actor_context` and `request_id` are reachable independently of
`actor_user_id`: `actor_user_id` is nullable, so a write performed with
actor context set but no `app.current_user_id` would leave canary
evidence in `actor_context` alone. A closed four-column list would miss
both, and would go stale the moment a future migration adds a column to
`audit_log`. **A future author adding an `audit_log` column inherits the
obligation to cover it here.**

Expected result: zero. A non-zero count means rows survived a
rollback-bound transaction. **Stop and investigate. Do not run a cleanup
`DELETE`:** the rollback not taking effect is the defect, not the rows.

### 20.2 Production-row preservation

Because this harness deliberately issues `TRUNCATE` statements against
live production tables, which no other Nexus harness does, the
independent check must compare pre-run and post-run state.

**Scope: exactly the production tables the harness actually
`TRUNCATE`-tests.**

**Mandatory:** `audit_log`, `user_roles`, `role_permissions`. These are
the three targets of Tests 20, 18, and 17.

**`resources` is retained as harmless belt-and-suspenders, not as a
requirement of Test 19.** No `TRUNCATE` is issued against `resources`
anywhere in the harness (§16.7.1), so the mass-deletion instrumentation
rationale does not apply to it. It stays in the check for an independent
reason: `resources` is a permanent identity spine that the harness writes
fixture rows into, so a pre/post comparison is cheap corroboration that
ordinary fixture activity left it intact. **No claim is made that Test 19
requires it.** Its own residue coverage comes from §20.1.

**Deliberately not extended to the §2.8 cascade closure.** The other
eight relations in the theoretical `TRUNCATE resources CASCADE` closure
(`form_versions`, `requests`, `commercial_configurations`,
`commercial_changes`, `commercial_commitments`, `commercial_components`,
`commercial_component_capabilities`, `commercial_commitment_components`)
are **not** included, because **no harness operation touches them**. The
statement that would have reached them does not exist in this design.
Instrumenting relations against a statement the harness never issues
would be evidence theater: it would grow the closeout record while
proving nothing, and it would imply a risk the design has already
eliminated. Removing the dangerous statement is the mitigation; the
counters were only ever a way of surviving it.

**Count condition: `post_count >= pre_count`. Not exact equality.**

Exact equality would be unsound: the live application keeps writing, and
`audit_log` in particular grows continuously, so equality would produce
false failures driven by ordinary platform activity. The `>=` form
follows from the contracts being hardened: every table in this check is
monotonically non-decreasing by design, since `audit_log` is append-only,
`resources` is permanent, and both grant tables are revoke-never-delete.
It cannot false-fail under normal activity and still detects any mass
removal.

**Durable-identifier reinforcement.** Before the run, capture at least
one known existing primary-key or otherwise durable row identifier from
each protected table that is non-empty at that moment. After the run,
for each identifier that was actually captured, verify the row still
exists. This closes the one theoretical case `>=` alone cannot
distinguish: rows destroyed while a larger number were concurrently
added.

This is deliberately conditional on the table being non-empty
pre-run. **Pre-existing production data is not a global prerequisite for
running the gate.** Where a protected table is empty before the run, the
per-test row-count leg is instead made non-vacuous by the destructive
test creating its own rollback-bound fixture rows first (§16.2
precondition B, §18.2).

**Disposition: MANDATORY GATE-CLOSE EVIDENCE, and outside
`MACHINE_SUMMARY`.** It is not part of the 20-test count because it runs
on a separate connection outside the harness transaction and cannot
participate in a single summary line. It is retained because it closes a
failure mode the canary selectors structurally cannot see: a
zero-residue check returns 0 and reads green whether production rows
survived or were destroyed.

### 20.3 Sequence qualification

The claim is **ZERO RESIDUE ROWS**, never unqualified "zero residue".

`audit_log.audit_sequence` is an `IDENTITY` column added by Migration 2,
backed by a PostgreSQL sequence. Sequence increments are
non-transactional: consumed immediately, never rolled back. Any
rollback-bound harness that performs audited writes permanently consumes
sequence values and leaves a gap. That is expected, unavoidable, and is
not row residue.

**Do not inspect, reset, or alter any sequence to tidy it.**

---

## 21. Findings register, and the platform-wide limitation

### P0

None. Exploitation requires possession of the `service_role` secret,
which is server-side only. An actor holding it can already read every
table, write to every table, and forge `audit_log` rows directly, so
`TRUNCATE` adds destruction to a compromise that is already total. Live
confirmation upgraded the finding's evidence status, not its severity.

### P1

**P1-1. CONFIRMED PRODUCTION SCHEMA DEFECT.** `service_role` holds
effective `TRUNCATE` on all eight Platform Core tables, and row-level
guards do not fire on `TRUNCATE`. `audit_log`, `user_roles`, and
`role_permissions` have no incoming foreign keys, so a bare `TRUNCATE` on
any of the three succeeds in one statement. This defeats a control that
`docs/DATA_ARCHITECTURE.md` §9 and Migration 1's own comment both
explicitly claim survives an accidental re-grant. **Closed by this
migration.** This confirmed production defect is the reason the migration
exists and does not block locking a correct design.

**P1-2. STRUCTURALLY CONFIRMED, LIVE PRIVILEGE UNMEASURED, NOT CLOSED
HERE.** The same class of exposure exists on tables created by Migrations
4 through 8.

The **structural** half is repository-confirmed, not suspected. Three
tables outside Platform Core carry an append-only or permanence contract
enforced by row-level triggers **and** have no incoming foreign key, so a
bare `TRUNCATE` would succeed in one statement exactly as it does on
`audit_log`:

- `submission_revisions` (Migration 5)
- `commercial_component_capabilities` (Migration 8)
- `commercial_commitment_components` (Migration 8)

The **live privilege** half is unmeasured: whether `service_role`
currently holds `TRUNCATE` on those tables was not queried. The
§2.3 default-ACL mechanism makes it very likely, but this document does
not claim it as confirmed. §16.9 records measuring it as a diagnostic.

`submission_revisions` is the highest-priority deferred exposure. See the
limitation statement below.

**Newly recorded, and it does not change this deferral's scope.** All
three tables named above appear in the `TRUNCATE resources CASCADE`
transitive closure (§2.8). That fact is what removed the live `CASCADE`
test from the runtime gate (§16.7.1). It does **not** expand this
migration's scope: the tables remain deferred, for the reasons in the
limitation statement below, and the design simply no longer issues a
statement that would have reached them.

**No P1 remains against the proposed design.** Three evidence-plan P1s
have been found and all three are resolved:

- The round-1 P1, an invalid bare-`TRUNCATE` official test for
  `resources` that would have failed deterministically against a correct
  migration. Resolved (§24, D3).
- The round-2 P1, the twelve-relation blast radius of the `CASCADE`
  replacement. **Resolved by eliminating the destructive statement**
  (§16.7.1), not by adding twelve-relation instrumentation (§24, D14).
- The round-3 P1, the ungated table-independence premise that the
  resulting composite proof rested on. **Resolved by gating the premise**:
  Test 01 asserts the canonical body from `pg_proc.prosrc` (§16.8.0), and
  §16.0 restates table-independence as a precondition on the principle
  itself (§24, D19). The composite is now a three-test conjunction
  (§16.7.2). No official test was added; the count stays 20.

All three were runtime-evidence defects. **None reached a migration file,
and none required a change to the migration architecture in §3.**

### P2

- **P2-1. DEFENSE-IN-DEPTH HARDENING.** `user_roles.user_id`
  `ON DELETE CASCADE` contradicts the historical-grant contract. **In
  scope**, closed by this migration (§12.1).
- **P2-2. DEFENSE-IN-DEPTH HARDENING.** `audit_log.actor_user_id`
  `ON DELETE SET NULL` declares an action that immutable `audit_log` can
  never accept. Identified by independent principal review. **In scope**,
  closed by this migration (§12.2).
- **P2-3. DOCUMENTATION GAP.** `app_users` hard delete is permitted for a
  narrow class of unreferenced identity; the documentation implies it
  never happens. **Documentation correction only** (§13.2, §22).
- **P2-4. ACCEPTED TRUST BOUNDARY.** `service_role` retains `INSERT` on
  `audit_log` and can forge audit rows. **Not changed here** (§13.4).
- **P2-5. RUNTIME-EVIDENCE DEFECT, CLOSED.** Test 03 gated a function
  *name* rather than a function *object*, so the legs of the `resources`
  composite were not provably about one object. **Closed** by the exact
  `tgfoid` OID assertion (§16.8.2, §24 D20).
- **P2-6. RUNTIME-EVIDENCE DEFECT, CLOSED.** Tests 12, 13, and 14 gated
  only `23503`, which both corrected `RESTRICT` foreign keys produce, so
  their correctness rested entirely on fixture-construction discipline.
  **Closed** by gating `CONSTRAINT_NAME` from structured diagnostics
  alongside the SQLSTATE, with fixture isolation retained (§16.8.5,
  §24 D20).

### P3

- **P3-1. DEFENSE-IN-DEPTH HARDENING.** 18 of the 20 trigger functions
  across Migrations 1 through 8 do not pin `search_path`. **Deferred
  platform-wide** to the Migration 4 through 6 stage (§13.1).
- **P3-2. DOCUMENTATION GAP.** `resource_types` is described as
  migration-managed and not user-editable, but nothing enforces that
  (§13.3).
- **P3-3. DOCUMENTATION GAP.** A malformed `app.current_user_id` or
  `app.actor_context` aborts an audited write with `22P02`. Fail-closed,
  which is the safe direction, but undocumented.
- **P3-4. DOCUMENTATION GAP.** The P0 through P3 scale is used across
  closeout records but is defined nowhere in `docs/`, and the
  finding-type vocabulary used in this document (`PRODUCTION SCHEMA
  DEFECT`, `DESIGN DEFECT`, `RUNTIME-EVIDENCE DEFECT`, `DOCUMENTATION
  DEFECT`, `ACCEPTED TRUST BOUNDARY`) is net-new. If retained, it should
  be defined once rather than assumed.
- **P3-5. SCOPE BOUNDARY, RECORDED NOT CLOSED.** Default ACL entries
  keyed to creator roles other than `postgres`, including
  `supabase_admin` in schema `public`, are outside this migration's
  recurrence-prevention contract (§7.4).
- **P3-6. EVIDENCE-SCOPE BOUNDARY, DIAGNOSTIC ONLY.** Tests 04 through 09
  gate `service_role` privileges only on the eight Platform Core tables
  and the future-table canary. A collateral privilege edit naming a table
  outside that set would not fail the gate. Covered by the pre/post
  `public`-wide privilege snapshot diagnostic (§16.9) rather than by an
  official test, deliberately: making Migration 4 through 8 environment
  privileges part of this migration's official contract is the
  eternal-contract error §16.6 exists to prevent.

### Platform-wide limitation, stated plainly

**This migration closes Platform Core. It does not prove or close
equivalent `TRUNCATE` exposure on the tables created by Migrations 4
through 8.** The §7 default-privilege change prevents recurrence on
*future* `postgres`-created `public` tables, but the already-created
feature and Commercial tables retain whatever `service_role` privileges
they were granted at creation time.

**Corrected reasoning for why deferring is defensible rather than
negligent.** An earlier draft of this document claimed that destroying
those tables "would be fully recorded in `audit_log`". That was wrong.
Their audit triggers are row-level `INSERT`/`UPDATE`/`DELETE` triggers
and **do not fire on `TRUNCATE`**, which is the entire premise of this
migration. A `TRUNCATE` of any Migration 4 through 8 table would produce
**zero** audit rows, so the destruction itself would be unrecorded.

The accurate and narrower argument is this. Protecting `audit_log` now
preserves the **prior** audit history that already exists for the
affected records, so what those rows contained remains reconstructable
for tables whose audit path captures full row images. It does **not**
create evidence that a later `TRUNCATE` occurred. Ledger-first is still
the right order, for that reason and not the stronger one.

**And that narrower argument does not hold for `submission_revisions`,
which is why it is named as the highest priority.** Migration 5 defines
it as a permanent record ("a permanent record: `DELETE` is not
permitted", "No `deleted_at`: never deleted, in any status"). Its audit
path, `fn_audit_submission_revision_transition`, deliberately excludes
the payload: its own comment states that "`raw_data` and
`effective_data` are never included, on either INSERT or UPDATE, under
any circumstance. The immutable `submission_revisions` row remains the
payload evidence." A successful `TRUNCATE` of `submission_revisions`
could therefore destroy information that **cannot** be reconstructed from
`audit_log` by explicit design.

`commercial_component_capabilities` and
`commercial_commitment_components` are the other two structurally exposed
append-only membership tables.

**All three sit inside the `TRUNCATE resources CASCADE` closure (§2.8),
and the runtime gate is designed so that no Nexus harness statement ever
reaches them.** That is a deliberate consequence of §16.7.1, not a side
effect. It would be incoherent for a migration that defers protecting
`submission_revisions` to be the first thing in the repository to put it
under an `ACCESS EXCLUSIVE` mass-deletion statement.

**This Platform Core migration is deliberately not expanded to fix
them.** Closing them correctly requires analysing each table's own
contract, which is exactly the Migration 4 through 6 retrospective
stage's job, and importing unanalysed contracts into this migration would
cost the coherence that is its main virtue. They remain work for that
later stage, now with the structural exposure and the closure evidence
recorded so it starts from evidence rather than a fresh investigation.

Nothing in this document should be read as closing the platform-wide gap.

---

## 22. Planned documentation corrections

Not made in this task. These land with the migration or immediately after
it, per the rule that documentation changes ship in the same lifecycle as
the capability change they describe.

- **`docs/DATA_ARCHITECTURE.md` §9.** The immutability claim currently
  names only the `BEFORE UPDATE OR DELETE` trigger and the
  `UPDATE`/`DELETE` revoke. Once the statement-level guard and the
  `TRUNCATE` revoke are actually applied, it should be corrected to
  describe the completed control. **It must not be updated before the
  migration is applied:** stating an unapplied control as active would be
  worse than the current gap.
- **`docs/DATA_ARCHITECTURE.md` §10, and Migration 1's characterisation
  of `app_users`.** Correct the hard-delete posture to say that identity
  durability comes from dependent foreign keys, now including the two
  corrected `RESTRICT` actions, plus the audit ledger, and not from a
  delete guard (§13.2).
- **`docs/AUTHORIZATION_MODEL.md` §4 and `docs/DATA_ARCHITECTURE.md`
  §13.** Record that the historical-grant contract is now also enforced
  against `TRUNCATE`, and that the `user_roles` parent-delete path fails
  at the foreign key rather than at the grant trigger.
- **`docs/PLATFORM_CORE_RETROSPECTIVE_RUNTIME_DESIGN.md`**, when written:
  record that Migrations 1 through 3 as authored did not protect
  `TRUNCATE`, and that the protection arrives in this forward migration.

---

## 23. Current status

**The design is LOCKED. Nothing is applied.** There is deliberately no
applied-state evidence section.

| Gate | Status |
|---|---|
| Design record | **LOCKED** (this document, after three rounds of principal review and the round-3 pre-lock amendment) |
| Independent principal review, round 1 | **COMPLETE** (P0 = 0, P1 = 1, in the evidence plan) |
| Independent principal re-review, round 2 | **COMPLETE** (P0 = 0, P1 = 1, in the evidence plan) |
| Round-2 evidence-design amendment applied | **YES** (§16.0, §16.7, §2.8, §20.2, §24 round 2) |
| Independent principal review, round 3 (final lock review) | **COMPLETE** (P0 = 0, P1 = 1, in the evidence plan) |
| Round-3 final pre-lock amendment applied | **YES** (§9, §13.1, §16.0, §16.2, §16.4, §16.7.2, §16.7.4, §16.8.0, §16.8.2, §16.8.5, §19, §20.1, §24 round 3) |
| Proposed-design findings after round-3 amendment | **P0 = 0, P1 = 0** |
| Design lock | **LOCKED** (§23.1) |
| SQL authored | **NO** |
| Migration file created | **NO** |
| Migration timestamp assigned | **NO** (and it is not "Migration 9") |
| Foreign-key constraint names confirmed | **YES**, live-confirmed (§2.6) |
| Pre-hardening privilege baseline captured | **YES**, live-confirmed (§2.2) |
| Dry-run | **NOT RUN** |
| Remote apply | **NOT APPLIED** |
| Local/remote migration history | **NOT YET CHANGED** |
| Runtime harness (20 tests) | **NOT AUTHORED** |
| Runtime verification | **NOT RUN** |
| Zero-residue-rows proof | **NOT RUN** |
| Production-row preservation proof | **NOT RUN** |
| Hardening closeout | **NOT STARTED** |
| Platform Core M1-3 retrospective runtime gate | **BLOCKED** on this migration |
| Foundation 1-7 retrospective program | **IN PROGRESS**, not complete |
| Commercial Migration 9 (Usage and Earned) | **BLOCKED** |

### 23.1 Lock record

**PLATFORM CORE INTEGRITY HARDENING DESIGN: LOCKED.**

Locked on the basis of three completed rounds of independent principal
review. The round-3 final lock review returned **P0 = 0 and P1 = 1**, its
single P1 was the ungated table-independence premise in the composite
`resources` proof, and that P1 is closed by the round-3 pre-lock amendment
(§24, D19). **Final reviewed state of the proposed design: P0 = 0,
P1 = 0, APPROVED TO LOCK.**

What the lock covers:

| Locked item | Locked state |
|---|---|
| Migration architecture | **Eight conceptual operations, §3, unchanged** |
| Migration count | **One** Platform Core Integrity Hardening migration, §19, settled and not a recommendation with a fallback |
| Migration sections | A (`TRUNCATE` privilege and integrity hardening), B (foreign-key corrections), C (comments and schema-contract documentation), §19 |
| Integrity guard attachment | Exactly four tables: `audit_log`, `resources`, `user_roles`, `role_permissions`, §8 |
| Enforcement function | One generic `fn_reject_truncate()`, `SECURITY INVOKER`, `search_path = pg_catalog`, `P0001`, canonical table-independent body, §9 |
| Existing-table privilege | `service_role` `TRUNCATE` revoked on **all eight** Platform Core tables, §6 |
| Future-table privilege | `TRUNCATE` removed from `service_role`'s defaults for tables created by `postgres` in schema `public`, §7 |
| Foreign-key corrections | **Both** locked in scope: `user_roles_user_id_fkey` `CASCADE` to `RESTRICT`, and `audit_log_actor_user_id_fkey` `SET NULL` to `RESTRICT`, §12 |
| Official runtime-test design count | **20**, §16.8 |
| `resources` evidence design | **Composite proof, Test 01 + Test 03 + Test 19**, §16.7.2 |
| Live destructive tests | **Confined only**: Tests 17, 18, 20 on `role_permissions`, `user_roles`, `audit_log`, §16.2, §16.7.4 |
| Behavioral canary | Test 19 on a rollback-bound fictional relation, §16.7.3 |
| Runtime-testing safety principle | §16.0, including its table-independence **precondition** |
| Residue strategy | §20.1, durable rule form, plus the `pg_class` canary check |
| Preservation strategy | §20.2, `post_count >= pre_count` plus durable identifier, scoped to the three live-tested tables with `resources` as belt-and-suspenders |
| Deferrals | M4 through M8 `TRUNCATE` exposure (§21), legacy `search_path` (§13.1), `supabase_admin` and non-`public` default-ACL scope boundary (§7.4, P3-5) |
| Machine gate | The single `MACHINE_SUMMARY` line stated verbatim once in §17, locked at `official_total` 20, `official_distinct` 20, `official_passed` 20, `official_failed` 0, with all four fields gated independently |

**No live `TRUNCATE` of `resources` is permitted by this locked evidence
design, in any form, bare or `CASCADE`.** No official test issues
`CASCADE` anywhere (§16.2, §16.7.1, §16.8). The §2.8 twelve-relation
closure is locked as design evidence explaining why the statement is not
run, never as a statement the harness executes.

**Commercial Migration 9 (Usage and Earned) remains BLOCKED.** This
migration is referred to only by its descriptive name and carries no
number and no timestamp until its forward migration file is authored. It
is specifically **not** "Migration 9": that number stays reserved by
`docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md`.

**Migrations 1 through 8 and the Foundation RPC Privilege Hardening
migration remain immutable history.** No historical migration file is
edited by this work. Every correction here is a new forward migration.

**What the lock does not cover.** No SQL, no migration file, no harness,
no gate result, no applied database state, and none of the §22
documentation corrections. A locked design is an approved plan, not
executed work.

### 23.2 Implementation-time obligation carried past the lock

**The authored `public.fn_reject_truncate()` body and Test 01's canonical
expected body are a matched pair and must be reviewed together.** This
obligation survives the lock deliberately, because it is the one contract
whose literal cannot be fixed at design time (§16.8.0, §25 item 11).

At SQL review the reviewer must confirm all four:

1. **The authored function body remains table-independent**: no
   branching, no `TG_RELID` or `TG_TABLE_NAME` conditional, no `case`, no
   dynamic `EXECUTE`, no table access, no catalog lookup, no data
   dependency, and no special case for `resources` or any other table.
2. **The canonical expected body encoded in Test 01 matches the authored
   production body** under the locked normalization rule in §16.8.0
   (normalize line endings, collapse whitespace runs, trim, preserve
   case, in-body comments included), compared by equality against a
   single expected constant, never by substring, regular expression,
   keyword-absence, or statement counting.
3. **Test 03 gates the exact production function OID**,
   `tgfoid = 'public.fn_reject_truncate()'::regprocedure`, not a function
   name.
4. **Test 19 invokes that exact production function object**,
   schema-qualified, never a copy, wrapper, or adaptation (§18.2).

**The final body literal is deliberately not invented here.** Fixing it
belongs to migration authoring and SQL review. What is locked is the
contract the literal must satisfy and the method by which it is gated.

If a future migration ever changes the function body, the expected
constant must change in the same migration, and §16.7.2's transferability
argument must be re-derived if the new body is not table-independent.

### Sequencing after the lock

1. **Design locked.** Complete: this document, §23.1. The final lock
   review is complete and its single P1 is closed by the round-3
   amendment (§24, D19). Proposed-design findings stand at P0 = 0,
   P1 = 0, and nothing remains open in §25 against the design record.
2. Author the migration; independent principal review of the SQL,
   including the §23.2 matched-pair confirmation. No
   further read-only confirmation is required first: both constraint
   names and the privilege baseline are live-confirmed (§2.2, §2.6).
3. Apply via the Supabase CLI, so the filename timestamp is the version
   recorded remotely, verifying the CLI's actual transaction wrapping at
   that point (§19).
4. Author the 20-test harness and its runner; run the gate; run the
   independent residue and preservation proofs.
5. Record the closeout and make the §22 documentation corrections.
6. Resume the Platform Core M1-3 retrospective runtime design at 50
   official tests and run it.
7. Migration 4 through 6 incremental regression, which must measure and
   close P1-2 and P3-1, starting with `submission_revisions`.
8. Migration 7 evidence reconciliation, then Foundation 1-7 closeout.
9. Only then, Commercial Migration 9 (Usage and Earned).

---

## 24. Review history and corrected design-record defects

Recorded here, separately from the operative contract, because the
repository's precedent is to log design and harness defects distinctly
from production defects rather than absorb them quietly. **None of these
reached any migration file.** The operative sections above state only the
corrected behavior, so the runtime contract stays readable.

### Found during drafting, before first review

- **D1.** An earlier draft asserted that a `TRUNCATE`-acquired
  `ACCESS EXCLUSIVE` lock survives subtransaction rollback. Wrong, and it
  produced a baseless hard test-ordering constraint. Corrected in §16.1,
  which also demotes the late-ordering preference to operational caution.
- **D2.** An earlier draft gated the future-table test on a negative
  "`REVOKE` entry" in `pg_default_acl`, which cannot exist: PostgreSQL
  ACL catalogs encode granted privileges, and a revoke that returns an
  entry to the built-in default deletes the row entirely, so absence
  proves nothing. It would have failed at run time, and the natural
  remedy under time pressure would have been to weaken the assertion
  until it passed, leaving the recurrence-prevention leg effectively
  unproven. Corrected in §16.4 by replacing catalog inspection with a
  behavioral canary.

### Found by independent principal review, round 1

- **D3 (the round-1 P1).** The official live test for `resources` was a
  bare `TRUNCATE`. Because `resources` is referenced by five tables and
  PostgreSQL checks foreign-key dependencies before firing
  statement-level `TRUNCATE` triggers, it would have raised `0A000`
  without ever reaching `fn_reject_truncate`, failing deterministically
  against a fully correct migration. The document already contained the
  fact that would have caught this (§2.7) but had not propagated it into
  the test design.

  The round-1 correction was to make `TRUNCATE resources CASCADE` the
  official test, with a table-identifier assertion to disambiguate which
  relation raised, and to demote the bare attempt to a diagnostic.
  **That correction was itself superseded by D14**, which found the
  `CASCADE` blast radius unacceptable. The current design executes no
  `TRUNCATE` against `resources` at all (§16.7), and the bare attempt is
  now a static narrative diagnostic rather than an executed one (§16.9).
- **D4.** The future-table narrowness leg was "at least one ordinary
  privilege survives", which passes even if the edit stripped six of
  seven. Corrected in §16.4 to the exact seven-privilege baseline.
- **D5.** Narrowness was gated for future tables but only observed as a
  diagnostic for the eight existing tables, which is the half that edits
  live application-facing ACLs. Promoted to official Test 05 (§16.8.3).
- **D6.** The owner test asserted only "one shared owner", which passes
  if that owner is a role other than `postgres`, silently invalidating
  §7's `FOR ROLE` keying while reading green. Corrected in §16.5 to
  assert the named role.
- **D7.** A single `app_users` fixture identity would have made Tests 12
  through 14 mutually indistinguishable and could have produced `P0001`
  from the audit immutability trigger instead of `23503`. Corrected in
  §18.1 with four isolated identities.
- **D8.** Residue detection omitted `auth.users`, which every `app_users`
  fixture requires, and would have searched `audit_log` only by
  identifier columns rather than also by JSONB payload. Corrected in
  §20.1.
- **D9.** The `audit_log.actor_user_id` `ON DELETE SET NULL` action was
  the same declared-versus-enforced defect class as the `user_roles`
  `CASCADE`, and the document's own inclusion criterion implicated it,
  yet it was neither corrected nor mentioned. Brought into scope as
  §12.2 and P2-2.
- **D10.** The Migration 4 through 8 deferral was justified by the claim
  that destroying those tables would be recorded in `audit_log`. That is
  false, because row-level audit triggers do not fire on `TRUNCATE`.
  Corrected in §21, with `submission_revisions` named as the
  highest-priority deferred exposure because its payload is deliberately
  not reconstructable from `audit_log`.
- **D11.** Trigger-function counts were wrong (stated as 17 and 18;
  actually 20 distinct across Migrations 1 through 8, of which 2 pin
  `search_path`). Corrected in §9 and §13.1. The corrected numbers
  strengthen the deferral argument rather than changing it.
- **D12.** Non-durable implementation trivia about relfilenode
  consumption by a rolled-back `TRUNCATE` was recorded as a side effect.
  Removed: it supported no claim the document makes and its terminology
  is version-dependent. Only the `audit_sequence` qualification, which a
  reviewer genuinely needs in order to interpret a visible gap, is
  retained (§20.3).
- **D13.** Smaller factual and wording corrections: `REVOKE ALL ON TABLE`
  now enumerates `MAINTAIN` (§5); atomicity is attributed to PostgreSQL
  transactional DDL rather than to any deployment tool (§19); the
  ambiguous "Migrations 1 through 9 are immutable history" is replaced
  with wording that cannot be confused with the reserved Commercial
  Migration 9 (header); the `supabase_admin` default-ACL scope boundary
  is stated explicitly rather than left implicit (§7.4, P3-5); Test 02
  gates `anon`/`authenticated` behaviorally and `PUBLIC` structurally
  (§16.8.1); and Test 03's schema-wide prohibition is rescoped to
  Platform Core so it cannot go stale when later hardening legitimately
  reuses the generic function (§16.8.2).

### Found by independent principal re-review, round 2

- **D14 (the round-2 P1).** The round-1 fix replaced a bare
  `TRUNCATE resources` with `TRUNCATE resources CASCADE`, and the
  document reasoned about that statement as though it reached the five
  direct referencers. Mechanical computation of the transitive
  foreign-key closure showed it reaches **twelve relations** (§2.8), of
  which nine would carry no `BEFORE TRUNCATE` guard, and the set includes
  `submission_revisions`, the one table §21 itself names as holding
  payload that is deliberately not reconstructable from `audit_log`. The
  design's single most destructive statement was therefore aimed through
  the exact table it had identified as irreplaceable, in order to prove a
  contract about a different table, with preservation instrumented on
  only four of the twelve.

  **Resolved by eliminating the statement, not by instrumenting it.** The
  re-review's own proposed remedy was to extend preservation coverage
  across the twelve-relation closure. That was rejected as the wrong
  direction: it would have made a dangerous statement survivable rather
  than making the evidence practice correct. §16.7 replaces it with a
  composite proof, Test 03 (production catalog attachment) conjoined with
  Test 19 (behavioral proof of the generic, table-independent
  `fn_reject_truncate`), and §16.0 records the resulting principle so the
  same trade is not re-argued next time. **That two-test form was itself
  incomplete and was extended to a three-test conjunction by D19 below**,
  which gated the table-independence premise the transfer depends on. No production relation is
  truncated in order to prove the `resources` contract, and §20.2 is
  deliberately **not** extended to the closure, because no harness
  statement reaches it any more.

- **D15. The re-review's PostgreSQL ordering claim was incorrect, and is
  corrected here for the record.** The re-review asserted that PostgreSQL
  does not document trigger firing order across the relations of a
  `TRUNCATE ... CASCADE` set, and on that basis classified the former
  `resources` message-identifier assertion as resting on an undocumented
  implementation detail. That is wrong: PostgreSQL documents that
  `TRUNCATE` triggers fire in the order the tables are processed, which
  is tables listed explicitly in the command first, then tables added due
  to cascading. The assertion would have been sound on that basis.

  **It is nonetheless removed, as unnecessary rather than weakened.** With
  no multi-relation `TRUNCATE` in the official inventory there is no
  ambiguity about which relation raised, so the discriminator has nothing
  left to discriminate. The operative design now depends on the ordering
  guarantee nowhere, which is a stronger position than depending on it
  correctly. Recorded in history only (§16.1, §16.2 precondition D).

- **D16.** Residue detection for `audit_log` enumerated a closed
  four-column list (`row_id`, `actor_user_id`, `before_value`,
  `after_value`). `request_id` and `actor_context` can also carry
  harness-supplied canary values, and `actor_context` is reachable
  independently because `actor_user_id` is nullable, so a write with
  actor context set and no `app.current_user_id` would leave evidence
  there alone. Replaced in §20.1 with a durable rule covering every
  `audit_log` field capable of holding a harness-supplied value, so it
  does not go stale when a future migration adds a column.

- **D17.** The Test 09 canary was specified as created "in schema
  `public`" without schema-qualifying the `CREATE TABLE` or asserting the
  resolved namespace, leaving `search_path` as an unguarded source of a
  false verdict in either direction. Corrected in §16.4 to require
  `public.<canary_name>` and an explicit
  `relnamespace = 'public'::regnamespace` assertion, which now also
  anchors Test 19.

- **D18.** Smaller factual and scope corrections: `P0000` was mislabelled
  `raise_exception` and is `plpgsql_error`, with `raise_exception` being
  `P0001` (§16.3; the reason the whole `P0` class is off limits is
  unchanged); the `pg_default_acl` diagnostic now records that it is the
  only evidence distinguishing a correctly scoped `IN SCHEMA public`
  revoke from one accompanied by an unintended global revoke (§16.4); a
  pre/post `public`-wide `service_role` privilege snapshot is added as a
  diagnostic for collateral edits naming tables outside the eight (§16.9,
  P3-6); and the bare `TRUNCATE resources` observation is explicitly
  reclassified from an executed diagnostic to a **static, narrative**
  one, since there is no reason to take `ACCESS EXCLUSIVE` on `resources`
  in order to re-prove PostgreSQL's own foreign-key topology behavior
  (§16.9).

- **Round-2 findings that became moot rather than fixed.** The re-review
  raised the cascade trigger-order dependence and the message-substring
  comparison as corrections required before lock. Both are moot under
  D14: Test 19 no longer issues a cascade, and no official test reads
  message text at all (§16.2). They are recorded because a future author
  reading only §16.7 would otherwise not know those assertions ever
  existed, or why they left.

### Found by independent principal review, round 3 (final lock review)

- **D19 (the round-3 P1). UNGATED TABLE-INDEPENDENCE PREMISE IN THE
  COMPOSITE `resources` PROOF.**

  Eliminating `TRUNCATE resources CASCADE` (D14) was correct and is not
  reopened. But removing it also removed the only direct behavioral
  observation of the guard on `resources`, and the replacement composite
  depends on `fn_reject_truncate` being table-independent so that Test
  19's observation on a fictional canary transfers to production
  `public.resources`. **That property had been specified in prose (§9) and
  relied on in the transferability argument (§16.7.2), but nothing in the
  twenty-test inventory observed it.**

  The reviewer constructed a valid false-PASS. A `fn_reject_truncate`
  authored with a single table-specific branch, raising on every relation
  except `resources`, would have passed Test 01 (which inspected only
  signature, language, security mode, `search_path`, and owner), Test 03
  (attached, correctly shaped, enabled), Tests 17, 18, and 20 (those three
  tables are not `resources`, so it raises), and Test 19 (the canary is
  not `resources`, so it raises). `MACHINE_SUMMARY` would have reported 20
  of 20 passing while `resources` was entirely unprotected and
  `TRUNCATE resources CASCADE` removed every row plus eleven further
  relations. The failure is asymmetric by construction: it lands on the
  one table whose behavioral leg had been removed.

  This is the same defect class the document already gates elsewhere.
  §16.8.2 gates `tgenabled` because "an attached but disabled trigger
  would satisfy a naive attachment assertion while enforcing nothing"; a
  table-branching body satisfies a naive behavioral assertion while
  enforcing nothing on one table. D2, D4, and D6 were all corrections of
  assertions that read green while the thing described was broken.

  **Closed by making the premise machine-gated evidence.** Test 01 now
  asserts `pg_proc.prosrc` for
  `'public.fn_reject_truncate()'::regprocedure` normalized-exact-equal to
  the canonical body (§16.8.0), which excludes branching, `TG_RELID`
  behavior, `case`, dynamic `EXECUTE`, table access, catalog lookup, data
  dependency, and per-table special cases by construction rather than by
  keyword heuristic. §16.0 additionally now states table-independence as a
  **precondition** on the composite-proof principle, so the principle is
  self-limiting and cannot be invoked for a function whose behavior varies
  by table, data, configuration, or runtime state unless those
  dependencies are themselves gated. No new official test number was
  added and the count stays 20.

- **D20. Adopted review P2s, both closing evidence-identity gaps rather
  than adding contracts.** Test 03 now gates exact function object
  identity, `tgfoid = 'public.fn_reject_truncate()'::regprocedure`, rather
  than a function name, so all three legs of the `resources` composite
  provably concern one object (§16.8.2). Tests 12, 13, and 14 now gate
  `CONSTRAINT_NAME` from `GET STACKED DIAGNOSTICS` alongside `23503`, so
  each proves the constraint it names rather than resting solely on
  fixture-construction discipline; both corrected foreign keys are
  `RESTRICT`, so SQLSTATE alone cannot distinguish them (§16.8.5).
  `CONSTRAINT_NAME` is a structured diagnostics field rather than message
  text, so the locale-independence convention is intact (§16.2). Fixture
  isolation (§18.1) is retained unchanged as defense in depth.

- **D21. Smaller factual and scope corrections.** The callable-RPC count
  in §13.1 was stated as five and is six: Migration 8 added
  `create_commercial_configuration_with_change`, which is
  `SECURITY INVOKER` and hardened within Migration 8 itself, so the
  `search_path` deferral conclusion is unchanged and that decision is not
  reopened. Test 03's `tgenabled` assertion is confirmed as exactly `'O'`
  and the reviewer's suggestion to also accept `'A'` is **declined**:
  `ENABLE ALWAYS` is different behavior with respect to
  `session_replication_role`, not merely a stronger form, and adopting it
  must be a separate conscious architecture decision (§16.8.2). §19's
  section taxonomy gains Section C so §3's operation 8 (comments and
  schema-contract documentation) is inside the described structure rather
  than outside it. §16.4 now states the canary relation's minimal shape,
  which Test 19's row insert requires. §20.1 records why `resource_id` and
  `db_role` are not additional canary carriers under the current schema
  and harness contract, without weakening the durable rule into a closed
  list.

---

## 25. Review items, all resolved at lock

**All three P1s are resolved** (§24, D3, D14, and D19). The final lock
review confirmed items 3 through 10 below as designed, and its single P1
changed items 1 and 2. Nothing in this list remains open against the
design record; the list is retained because these are the decisions a
future author is most likely to want the reasoning for, and because items
1, 5, and 11 must be re-confirmed against the actual SQL when the
migration is authored.

1. **The composite `resources` proof** in §16.7, now a **three-test**
   conjunction: Test 01 (canonical table-independent body), Test 03
   (production attachment by exact function OID), and Test 19 (behavioral
   proof on a rollback-bound fictional canary). No live `TRUNCATE` against
   `resources` in any form. The round-3 P1 was that the
   zero-table-specific-logic property of `fn_reject_truncate` (§9) is what
   makes one behavioral proof transferable, and it was not gated.
   **Resolved:** it is now Test 01's canonical-body assertion (§16.8.0).
2. **The runtime-testing safety principle** in §16.0, now carrying an
   explicit **precondition** that the enforcement function's
   table-independence must itself be a gated contract, which makes the
   principle self-limiting and prevents it being invoked for
   table-specific, data-dependent, or dynamically resolving functions.
3. **The Test 09 and Test 19 canary sharing** in §16.4 step 8 and
   §16.7.3, specifically whether the two tests remain genuinely
   independent while using one relation.
4. **Tests 17, 18, and 20 remaining live** while Test 19 does not
   (§16.7.4), and whether the confinement rule stated there is the right
   general rule.
5. **The exact `ALTER DEFAULT PRIVILEGES` operation** in §7.1, which
   remains conceptual and must be reviewed before implementation.
6. **The second foreign-key correction** in §12.2 and the resulting
   single-migration decision in §19.
7. **The non-collateral-damage principle** in §16.6, and whether Tests
   05 and 09 gate the right sets against the §2.2 and §2.3 baselines.
8. **The rescoped Test 03** in §16.8.2, specifically that it deliberately
   asserts nothing outside Platform Core, that it gates exact function
   object identity and `tgenabled = 'O'` exactly, and that its `resources`
   leg must be reported as a distinct assertion because it is one leg of a
   composite proof.
9. **The preservation scope** in §20.2: mandatory on `audit_log`,
   `user_roles`, and `role_permissions`, retained as belt-and-suspenders
   on `resources`, and deliberately not extended to the §2.8 closure.
10. **The deferrals** in §13, particularly `search_path` (§13.1), and the
    Migration 4 through 8 limitation in §21 with `submission_revisions`
    named and the closure evidence now recorded.
11. **The canonical body and its expected constant** (§16.8.0). The
    comparison method is settled; the literal is not, because it is fixed
    only when the migration is authored. At SQL review the reviewer must
    confirm that the authored body is table-independent, that it is the
    body the harness will encode as its expected constant, and that the
    two are updated together if either ever changes.

---

## 26. What this document is not

It is not a migration. No SQL is authored, no migration file exists, and
nothing has been applied.

It is not the Platform Core M1-3 retrospective runtime design. That is a
separate record, currently blocked on this migration, and it stays at 50
official tests: the `TRUNCATE` contract created here belongs to this
migration's own gate, not to the record that documents what Migrations 1
through 3 established.

It is not a closeout record. There is no evidence to close on yet.

It is not a claim about Migrations 4 through 8 (§21). In particular, the
`TRUNCATE resources CASCADE` closure recorded in §2.8 is design evidence
about a statement this design deliberately does not execute. It is not an
assertion that the Migration 4 through 8 tables in that closure are
protected, tested, or in scope.

**It is a locked design record and nothing more.** The design is locked
(§23.1); the migration is not authored, not applied, and not verified.
Locking approves the plan. It does not execute it, and no statement in
this document should be read as evidence that any database has changed.
