# M4-M8 Foundation Hardening Design

STATUS: LOCKED

## 1. Executive decision

The M4-M8 retrospective is closed by two forward migrations, applied and independently verified in order, plus one optional hygiene migration that does not gate closure.

- **Migration A: M4-M8 Destructive Privilege and Permanence Hardening.** Revokes `TRUNCATE` from `service_role` on all 13 M4-M8 tables and attaches `public.fn_reject_truncate()` as a `BEFORE TRUNCATE FOR EACH STATEMENT` guard to all 13. Closes P1-1, P1-2, P1-3, P2-1.
- **Migration B: M4-M8 Commercial Integrity and Audit Traceability Hardening.** Two internally separable parts, applied as one migration when the §14 data gates are clean and as two when they are not (§5.2). **Part B1** generalizes `fn_audit_row()` to take an optional resource-id column argument, recreates three audit triggers, and hardens `create_commercial_configuration_with_change()` with a serialization anchor, validation, and idempotency. **Part B2** adds database enforcement for the commercial cross-parent invariants, including the self-supersession prohibition. B1 closes P2-2 and P2-3. B2 closes P2-4 and P2-5.
- **Migration C: Foundation Function search_path Hygiene.** Optional, authored only after A and B are applied and verified, and after the M4-M8 retrospective is closed. Does not block closure.

P2-6 (`supabase_admin` default ACLs) is closed by a narrowed read-only ownership gate over the Nexus-owned object set, plus a schema-wide diagnostic report that never blocks. No privilege change. See §15.

Commercial Migration 9 remains BLOCKED. See §19. **Neither Migration A alone nor Part B1 alone closes the M4-M8 retrospective**, and therefore neither unblocks Commercial Migration 9. See §5.2 and §19.

The four commercial-semantic questions are answered and locked, including the final decision that **a Commercial Component may not supersede itself** while supersession forks remain fully allowed. See §3. Zero business questions remain open. See §20.

Final verdict: PASS. No SQL is authored by this document. No migration may be authored until the §14 pre-apply gates return their required values.

## 2. Scope

### 2.1 The 13 M4-M8 tables

| # | Table | Migration | Resource-backed |
|---|---|---|---|
| 1 | `form_definitions` | M4 | No |
| 2 | `form_versions` | M4 | Yes (`resource_id`) |
| 3 | `requests` | M5 | Yes (`id`) |
| 4 | `submission_revisions` | M5 | No |
| 5 | `customers` | M7 | No |
| 6 | `capabilities` | M7 | No |
| 7 | `measurement_definitions` | M8 | No |
| 8 | `commercial_configurations` | M8 | Yes (`id`) |
| 9 | `commercial_changes` | M8 | No (extends `requests`) |
| 10 | `commercial_components` | M8 | No |
| 11 | `commercial_component_capabilities` | M8 | No |
| 12 | `commercial_commitments` | M8 | No |
| 13 | `commercial_commitment_components` | M8 | No |

M6 (`request_resource_type_integrity`) created no table. It contributed `fn_assert_resource_type()`'s optional-second-argument generalization, which is the exact precedent this design reuses in §11.

### 2.2 In scope

Destructive privilege and statement-level permanence on the 13 tables; audit resource linkage for three tables; one atomic RPC's concurrency and idempotency contract; six commercial integrity invariants (five cross-parent rules plus the self-supersession prohibition); one narrowed ownership gate plus one schema-wide ownership report; the runtime proof design for A and B.

### 2.3 Out of scope

No RLS change. No policy. No table ownership change. No owner privilege revoke. No `supabase_admin` default ACL change. No `postgres`/`public` default ACL change (that recurrence path was already closed by `20260909090000_platform_core_integrity_hardening.sql`). No historical migration edit. No new `fn_reject_truncate()`-equivalent function. No audit-trigger change offered as a substitute for preventing destructive loss. No seed or business data. No P3 remediation except the single coupled item named in §8.3. No historical `audit_log` backfill.

## 3. Locked business semantics

### 3.1 Decision 1: a Commercial Change is strictly tied to exactly one Commercial Configuration

Any Commercial Component created or changed under a Commercial Change must belong to the same Commercial Configuration as that Change.

Invalid and database-prevented state: Change belongs to Configuration A, Component belongs to Configuration B, Component references that Change.

Enforced by Rule 1 (§13.2).

### 3.2 Decision 2: a minimum-spend Commercial Commitment belongs entirely to one Commercial Configuration

Every Component participating in a spend Commitment must belong to the same Commercial Configuration as the Commitment's Commercial Change. Cross-Configuration spend commitments are not supported. Accidental flexibility is removed today rather than preserved.

Enforced by Rule 3 (§13.4). The same one-Configuration rule applied to a quantity Commitment's single directly referenced Component is Rule 2 (§13.3).

### 3.3 Decision 3: Commercial Component supersession may fork

One old Component may legitimately be superseded by multiple new Components. Old Component A may be superseded by both New Component B and New Component C.

Consequences, locked:

- No unique constraint is added on `commercial_components.supersedes_component_id`.
- No one-to-one supersession chain is forced.

### 3.4 Decision 3a: supersession is additionally constrained to one Configuration

Decision 3 answered cardinality only. Scope is a separate question and is answered here: **yes, a superseding Component must belong to the same Commercial Configuration as its predecessor.**

Reasoning. Decision 1 binds every Component to its Change's Configuration. Decision 2 binds every spend Commitment's membership to one Configuration. Rule 4 binds a Configuration to its own initial Change. The locked model is that a Commercial Configuration is a closed commercial world. A supersession edge crossing Configurations would mean a Component in Configuration B claims to continue Configuration A's terms, so A's own effective-terms lineage could only be computed by reading B. Nothing in the locked commercial model supports that reading, and no business requirement asks for it.

Enforced by Rule 5 (§13.6), by a mechanism that leaves forks entirely unconstrained.

### 3.5 Decision 4: a Commercial Component may not supersede itself

**Final business decision, locked. Self-supersession is prohibited.**

A `commercial_components` row may not carry `supersedes_component_id = id`.

| Shape | Verdict |
|---|---|
| `supersedes_component_id IS NULL` (no predecessor) | **Allowed.** Unchanged. |
| A superseded by B, and A superseded by C (a fork) | **Allowed.** Unchanged, per Decision 3. |
| A superseded by B, B later superseded by C (a chain) | **Allowed.** Unchanged. |
| A supersedes A | **Prohibited.** New. |

Reasoning, stated because the rule is new. Supersession is a directed edge from a later Component to the earlier Component whose terms it replaces. A self-edge asserts that a Component replaces itself, which is not a commercial fact any Change can express: the predecessor and the successor are, by definition of the concept, two different rows created by two different Changes. A self-edge is also a one-node cycle in the supersession graph, so any lineage walk that follows `supersedes_component_id` either fails to terminate or must carry a special case that exists only to absorb a row that should never have been written.

Decision 3 and Decision 4 are independent and do not conflict. Decision 3 is about **cardinality**, how many successors one predecessor may have, and the answer stays "any number". Decision 4 is about **identity**, whether a row may be its own predecessor, and the answer is now "no". Prohibiting a self-edge removes exactly one row shape and constrains fork cardinality in no way at all.

Enforced by Rule 6 (§13.7). Gated against existing data by D4 (§14.1).

## 4. Finding-to-remediation map

| Finding | Severity | Remediation | Migration | Blocks closeout |
|---|---|---|---|---|
| P1-1 `service_role` holds effective `TRUNCATE` on all 13 M4-M8 tables | P1 | Revoke `TRUNCATE` from `service_role` on all 13 | A | Yes |
| P1-2 `submission_revisions` bare-truncatable, holds unreconstructable submission evidence | P1 | Revoke plus `BEFORE TRUNCATE` guard | A | Yes |
| P1-3 `commercial_component_capabilities` and `commercial_commitment_components` bare-truncatable, sole record of financially material membership | P1 | Revoke plus `BEFORE TRUNCATE` guard on both | A | Yes |
| P2-1 six additional permanence-guarded tables reachable by `TRUNCATE CASCADE`, no statement-level guard | P2 | Guard attached to all 13, which covers these six and the cascade entry points above them | A | Yes |
| P2-2 `audit_log.resource_id` NULL for `requests`, `commercial_configurations`, `commercial_changes` | P2 | Optional second trigger argument on `fn_audit_row()`; recreate exactly three triggers | B1 | Yes |
| P2-3 `create_commercial_configuration_with_change` lacks locking, retry, and idempotency discipline | P2 | Serialization anchor, validation, replay identity, named conflicts | B1 | Yes |
| P2-4 commercial cross-parent consistency not database-enforced | P2 | Rules 1, 2, 3, 5, and Rule 6 (self-supersession) | B2 | Yes |
| P2-5 `commercial_configurations.commercial_change_id` and `commercial_changes.commercial_configuration_id` can disagree | P2 | Rule 4 | B2 | Yes |
| P2-6 `supabase_admin` default ACLs are a recurrence source, outside Nexus ownership | P2 | Narrowed Nexus-set ownership gate plus schema-wide diagnostic report and `supabase_admin` observation; no privilege change | A (gate D8 and reports R1, R2) | Yes |
| P3 unset `search_path` on 20 SECURITY INVOKER functions | P3 | 19 deferred to optional Migration C; 1 pinned in B2 as a byproduct of the Rule 3 rewrite already required | C (and B2, one function) | No |
| P3 trigger-only `service_role` EXECUTE | P3 | No action; closed as not a defect (Appendix A.1) | None | No |
| P3 ambient `service_role` table DML | P3 | No action; reclassified as by-design (Appendix A.2) | None | No |
| P3 supersession fork question | P3 | **Closed, not a finding.** Forks are an accepted business capability (Decision 3). Scope answered by Decision 3a, self-edge prohibited by Decision 4 | B2 (Rules 5 and 6) | No |
| P3 loose currency value domains | P3 | Deferred pending a locked currency list (Appendix A.4) | None | No |
| P3 `measurement_definitions.dimension_keys` domain | P3 | Deferred pending a locked dimension vocabulary; one non-business sub-item offered to C (Appendix A.5) | Optionally C | No |
| P3 stale "not yet applied" migration headers | P3 | No historical edit; corrected in the M4-M8 closeout document (Appendix A.6) | None | No |

## 5. Migration boundary

### 5.1 Recommended split

Two required forward migrations, in this order, plus one optional third.

**Migration A: M4-M8 Destructive Privilege and Permanence Hardening.**

- Scope: 13 `REVOKE TRUNCATE` targets in one statement; 13 `CREATE TRIGGER` statements; comment updates on the 13 tables and on `fn_reject_truncate()` to record the widened attachment set.
- Dependency: none. Depends only on the 13 tables and on `public.fn_reject_truncate()` existing, both of which are live-confirmed facts of the current schema.
- Why atomic: the privilege layer and the trigger layer are the two halves of one two-layer control. A state in which the revoke landed but a trigger did not, or vice versa, is a partially hardened state that is harder to reason about than either the before or the after. One transaction gives exactly one of the two states.
- What could fail: a missing or differently named table; a pre-existing trigger name collision; `fn_reject_truncate()` absent or redefined. All three fail loudly, because no `IF EXISTS` or `IF NOT EXISTS` is used anywhere in this migration.
- Required pre-apply checks: §14 (D8, D9, D10 as blocking gates; G1 as a capture).
- Runtime test boundary: §16.2. No `TRUNCATE` is ever issued against any of the 10 foreign-key-referenced tables, in any form. No `CASCADE` token appears in any `TRUNCATE` statement the harness executes.
- Blocks M4-M8 closeout: **yes**.

**Migration B: M4-M8 Commercial Integrity and Audit Traceability Hardening.**

Migration B has two internally separable parts, B1 and B2. When the §14.1 data gates all return their required values, both parts are authored as one migration file and applied in one transaction. When they do not, the parts are authored and applied separately per the conditional rule in §5.2. The part boundary is fixed in advance and does not move, so the same content lands either way.

- **Part B1 scope** (independent of existing commercial data): `CREATE OR REPLACE` of `fn_audit_row()` with the §11 two-argument contract; drop and recreate of exactly three audit triggers; `CREATE OR REPLACE` of `create_commercial_configuration_with_change()` with the §12 contract, signature unchanged.
- **Part B2 scope** (validity depends on existing commercial data): two new `UNIQUE` supporting constraints; three new composite foreign keys (Rules 1, 4, 5); one new `CHECK` constraint (Rule 6, self-supersession); one new function `fn_protect_commercial_commitment_scope()` and its trigger and revoke (Rule 2); `CREATE OR REPLACE` of `fn_protect_commitment_component_membership()` with the Rule 3 check added and `search_path` pinned. Comment updates accompany whichever part touches the object.
- Dependency: none on Migration A. Either could technically apply first. A is recommended first because it carries the P1 findings and cannot fail on existing data.
- What could fail in B1: a function body defect, or a missing expected audit trigger. Neither can be caused by existing row data. B1 validates no existing row.
- What could fail in B2: any of the three composite foreign keys and the Rule 6 `CHECK` fails immediately if any existing row violates it, because none is added `NOT VALID`; a function body defect; a constraint or trigger name collision. The two new `UNIQUE` constraints cannot fail on existing data (§13.8).
- Required pre-apply checks: B1 requires G2 and G3 (captures) and nothing else. B2 requires D1 through D7, all hard blocking gates (§14.1).
- Runtime test boundary: §16.3. No commit in any test. No `TRUNCATE` at all. No test creates a fixture that must survive its own transaction.
- Blocks M4-M8 closeout: **yes**, and **both parts are required**. See §5.2.

**Migration C: Foundation Function search_path Hygiene.** Optional. See §8.

### 5.2 Structure challenged, and the locked B1/B2 rule

Merging A and B into one migration is rejected. A changes privileges and adds statement-level triggers and validates no existing data. B re-authors live function bodies and adds constraints that validate every existing row. The two have different failure classes, different pre-apply gates, and different rollback stories. A must be able to land even if the §14.1 gates turn up violators.

**Why the RPC hardening sits in B1 and not B2.** This is a deliberate correction to an earlier draft of this design, which placed it in B2 alongside the constraints. Three reasons, in order of weight.

1. *It cannot fail on existing data.* The RPC rewrite is a `CREATE OR REPLACE` of one function body with an unchanged signature. It validates no row, adds no constraint, and touches no table. No result of D1 through D7 can make it unsafe to apply.
2. *P2-3 is a live correctness defect with a real failure mode.* A retry today fails with a raw `23505` on the `resources` primary key, which an application retry layer may reasonably misclassify as transient and retry indefinitely (§20.1). Parking that behind an unbounded wait for a business decision about unrelated commercial rows is the worse outcome.
3. *Its only coupling to B2 is a benefit, not a precondition.* §12.11 and §12.12 note that Rule 4's composite foreign key makes the RPC's insert order structurally mandatory rather than merely conventional. That is a strengthening of an already correct-by-construction behavior. If B1 lands without B2, the RPC's backlink correctness is exactly what it is today, correct by construction, with no regression and no new gap.

**Conditional boundary rule, locked.** If any of D1 through D7 returns a value other than its required value, Migration B is not authored as one file. It is authored and applied as two:

- **B1: M4-M8 Audit Traceability and Commercial RPC Hardening.** `fn_audit_row()` generalization, the three audit trigger recreations, and the `create_commercial_configuration_with_change()` hardening. Not blocked by any commercial data violation. **Proceeds.**
- **B2: M4-M8 Commercial Integrity Hardening.** Rules 1 through 6, the two supporting `UNIQUE` constraints, and the `fn_protect_commitment_component_membership()` rewrite. **Blocked** until the business decides how to remediate the violating rows, because neither a composite foreign key nor a `CHECK` constraint can be added over a violated invariant and this design will not add one `NOT VALID`.

The trigger condition is objective and evaluated before any SQL is authored. This is a locked rule, not an open question.

**What a B1-only world means, stated explicitly so it cannot be misread.**

- **B1 alone does NOT close the M4-M8 retrospective.** P2-4 and P2-5 remain open findings with blocking remediation outstanding.
- B1 may still be applied and independently verified. Its own runtime tests (§16.3) are meaningful on their own.
- **M4-M8 closeout remains BLOCKED.**
- **Commercial Migration 9 remains BLOCKED.** See §19.
- The only two ways out are: B2 lands, or every B2 finding is formally dispositioned in the closeout with no blocking remediation remaining. A silent deferral is not a disposition.
- No part of B1 may be described, in the closeout or anywhere else, as closing P2-4 or P2-5.

### 5.3 Naming

Neither migration is called "Migration 9". Commercial Migration 9 stays reserved for Usage and Earned by `docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md`. Both migrations are referred to by descriptive name only, matching the precedent set by `20260909090000_platform_core_integrity_hardening.sql`, which carries no migration number.

## 6. Migration A exact contract

Descriptive name: **M4-M8 Destructive Privilege and Permanence Hardening**.

### 6.1 Operations, in locked order

1. Attach `public.fn_reject_truncate()` as a `BEFORE TRUNCATE FOR EACH STATEMENT` trigger to all 13 M4-M8 tables, 13 separate `CREATE TRIGGER` statements, in the §2.1 table order.
2. `REVOKE TRUNCATE ON TABLE` (all 13, one statement) `FROM service_role`.
3. Update the comment on `public.fn_reject_truncate()` to record the widened attachment set (4 Platform Core tables plus 13 M4-M8 tables = 17).
4. Update the comment on each of the 13 tables to distinguish row-level UPDATE/DELETE protection from statement-level TRUNCATE protection, and on `form_definitions` to state the selective-DELETE-permitted / TRUNCATE-prohibited split explicitly.

Triggers precede the revoke, matching the operation order of `20260909090000_platform_core_integrity_hardening.sql`. Nothing depends on the order within one transaction, but the order is locked so the migration text and the runtime gate describe the same sequence.

### 6.2 Reuse, not redefinition

`public.fn_reject_truncate()` is reused unmodified. It is **not** redefined, not `CREATE OR REPLACE`d, and no second rejection function is created.

The function body is a canonical, gated contract: `20260909090000_platform_core_integrity_hardening.sql` records that the `resources` TRUNCATE proof is transferred to that table only because the body cannot behave differently on one table than another, and that the runtime gate asserts the body from `pg_proc.prosrc`. This design depends on the same transfer for 10 tables (§16.2, test A17). Migration A therefore must not touch the body, and the runtime gate re-asserts the identical expected constant.

Its existing posture is preserved and unchanged: `SECURITY INVOKER`, `search_path = pg_catalog`, `EXECUTE` revoked from `PUBLIC`, `anon`, `authenticated`, no positive `service_role` grant.

### 6.3 Trigger contract

- Naming convention: `trg_<table>_reject_truncate`. Applied without exception to all 13.
- Timing: `BEFORE TRUNCATE`. Level: `FOR EACH STATEMENT`. PostgreSQL requires TRUNCATE triggers to be statement-level; this is not a preference.
- Enabled posture: ordinary `CREATE TRIGGER`, so `tgenabled = 'O'`. `ENABLE ALWAYS` is deliberately not used. It is different behavior with respect to `session_replication_role`, not merely a stronger form, and adopting it would be a separate architecture decision this design has not made. The 4 Platform Core triggers are `'O'`, and diverging would make the 17 harder to assert as one set.
- Trigger arguments: none. `tgnargs = 0` for all 13.
- `WHEN` clause: none. TRUNCATE triggers cannot carry one, and the guard is unconditional by design.

The 13 trigger names:

`trg_form_definitions_reject_truncate`, `trg_form_versions_reject_truncate`, `trg_requests_reject_truncate`, `trg_submission_revisions_reject_truncate`, `trg_customers_reject_truncate`, `trg_capabilities_reject_truncate`, `trg_measurement_definitions_reject_truncate`, `trg_commercial_configurations_reject_truncate`, `trg_commercial_changes_reject_truncate`, `trg_commercial_components_reject_truncate`, `trg_commercial_component_capabilities_reject_truncate`, `trg_commercial_commitments_reject_truncate`, `trg_commercial_commitment_components_reject_truncate`.

### 6.4 Privilege contract

One privilege, one grantee. `TRUNCATE` only, `service_role` only.

- Not `REVOKE ALL`. `service_role` is the trusted application data path and keeps `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN` wherever it currently holds them. Each table's own lifecycle trigger constrains what those privileges can actually accomplish.
- `anon` and `authenticated` are not named. Migration 4, 5, 7, and 8 each already executed `REVOKE ALL ... FROM anon, authenticated` on their own tables, and `TRUNCATE` is inside `ALL`. Naming them again would imply a doubt the schema does not support. The runtime gate asserts zero privileges for both (test A08) rather than the migration re-revoking.
- `PUBLIC` was never granted `TRUNCATE` on any M4-M8 table.
- No owner privilege revoke. The owner keeps `TRUNCATE` by virtue of ownership and is stopped by the trigger instead. That is the entire point of the two-layer control and the fix is deliberately not implemented by stripping the owner.
- No default ACL change. The `postgres`/`public` `service_role` `TRUNCATE` default was already removed by `20260909090000_platform_core_integrity_hardening.sql`, so the recurrence path for future `postgres`-created tables in schema `public` is closed. Re-issuing it would be a no-op that falsely implies it was still open.
- No `supabase_admin` default ACL change. That platform role is outside Nexus ownership. Handled by assertion only (§15).

### 6.5 What Migration A does not do

No RLS change. No policy. No ownership change. No audit-trigger change. No foreign-key change. No column change. No `fn_reject_truncate()` body change. No `TRUNCATE` execution of any kind, in the migration or in the harness, against any of the 10 foreign-key-referenced tables. No `CASCADE`.

## 7. Migration B exact contract

Descriptive name: **M4-M8 Commercial Integrity and Audit Traceability Hardening**.

### 7.1 Operations, in locked order

Operations are grouped by part. When both parts ship as one migration, the parts run in this order inside one transaction. When they ship separately, each part is a complete migration on its own and the numbering within it is preserved.

**Part B1 operations.**

1. `CREATE OR REPLACE FUNCTION public.fn_audit_row()` with the two-argument contract of §11.
2. `DROP TRIGGER` then `CREATE TRIGGER` for exactly three triggers: `trg_audit_requests`, `trg_audit_commercial_configurations`, `trg_audit_commercial_changes`. Plain `DROP TRIGGER`, never `IF EXISTS`. Each recreation reproduces the definition captured by gate G3 exactly, except for the argument list (§11.8).
3. `CREATE OR REPLACE FUNCTION public.create_commercial_configuration_with_change(...)` with the §12 contract, signature unchanged.
4. Comment updates on `fn_audit_row()`, on `audit_log` (cutover semantics, §11.10), and on the RPC.

**Part B2 operations.**

5. `ALTER TABLE public.commercial_changes ADD CONSTRAINT uq_commercial_changes_configuration_request UNIQUE (commercial_configuration_id, request_id)`.
6. `ALTER TABLE public.commercial_components ADD CONSTRAINT uq_commercial_components_configuration_id UNIQUE (commercial_configuration_id, id)`.
7. `ALTER TABLE public.commercial_components ADD CONSTRAINT fk_commercial_components_change_within_configuration` composite foreign key (Rule 1).
8. `ALTER TABLE public.commercial_configurations ADD CONSTRAINT fk_commercial_configurations_change_backlink` composite foreign key (Rule 4).
9. `ALTER TABLE public.commercial_components ADD CONSTRAINT fk_commercial_components_supersedes_within_configuration` composite self-referencing foreign key (Rule 5).
10. `ALTER TABLE public.commercial_components ADD CONSTRAINT chk_commercial_components_no_self_supersession CHECK (supersedes_component_id IS DISTINCT FROM id)` (Rule 6).
11. `CREATE FUNCTION public.fn_protect_commercial_commitment_scope()` and `CREATE TRIGGER trg_commercial_commitments_protect_scope` (Rule 2).
12. `CREATE OR REPLACE FUNCTION public.fn_protect_commitment_component_membership()` with the Rule 3 check added and `search_path` pinned (Rule 3, and §8.3).
13. `REVOKE EXECUTE ON FUNCTION public.fn_protect_commercial_commitment_scope() FROM PUBLIC, anon, authenticated`.
14. Comment updates on every B2 object touched, including `commercial_components` to record both the same-Configuration supersession rule and the self-supersession prohibition.

Order matters at exactly two points, both inside B2. Operation 5 must precede operations 7 and 8, because both reference the unique constraint it creates. Operation 6 must precede operation 9. Nothing else is order-dependent, and no B2 operation depends on any B1 operation.

### 7.2 Why the ordering of 5 before 7 and 8 is required

PostgreSQL requires a referenced column list in a foreign key to be backed by a unique or primary key constraint on the parent. `commercial_changes` has a primary key on `request_id` alone, so `(commercial_configuration_id, request_id)` is not yet a valid reference target. Operation 5 supplies it. Operation 6 supplies the equivalent for `commercial_components (commercial_configuration_id, id)`.

Operation 10 depends on nothing. A `CHECK` constraint over two columns of the same row needs no supporting index and no reference target, which is exactly why Rule 6 is expressible as a `CHECK` while Rules 1 through 5 are not (§13.9).

### 7.3 OID preservation and privilege inheritance

Three of the four function operations use `CREATE OR REPLACE` with an unchanged signature, so the function OID is preserved and every privilege already revoked or granted survives automatically without restatement:

- `fn_audit_row()` keeps Migration 3's `REVOKE EXECUTE ... FROM anon, authenticated` and Migration 1's `SECURITY DEFINER` plus `search_path = pg_catalog`.
- `fn_protect_commitment_component_membership()` keeps Migration 8's `REVOKE EXECUTE ... FROM public, anon, authenticated`.
- `create_commercial_configuration_with_change(uuid, uuid, uuid, text, text, date, uuid, text, text, uuid, jsonb)` keeps Migration 8's revoke from `public`/`anon`/`authenticated` and its explicit `GRANT EXECUTE ... TO service_role`.

This is the same OID-preservation reasoning M6 recorded when it generalized `fn_assert_resource_type()`. It is load-bearing: **the RPC's parameter list and return type must not change.** Every behavior in §12 fits inside the existing 11 parameters. `CREATE OR REPLACE FUNCTION` cannot change a return type, and changing the parameter list would create a second function with a fresh OID, default `PUBLIC` EXECUTE, and no `service_role` grant.

Only `fn_protect_commercial_commitment_scope()` is new, so it is the only function needing an explicit revoke (operation 13). It receives no positive `service_role` grant, per the locked convention that trigger-only functions are revoke-only.

### 7.4 What Migration B does not do

No TRUNCATE work. No privilege change to any table. No RLS change. No new column on any table. No new column on `commercial_commitments` (§13.3). **No uniqueness on `supersedes_component_id`, in any form, partial or full.** No change to the deferred circular foreign key. No drop of any existing single-column foreign key. No `NOT VALID` constraint. No historical `audit_log` backfill. No weakening of `audit_log.resource_id`'s foreign key to `resources` (§11.6). No change to `fn_protect_commercial_commitment_lifecycle()`, `fn_reject_update_delete()`, or any other function not named in §7.1.

Rule 6 constrains one row shape only. It does not restrict how many Components may reference the same predecessor, and it does not touch `supersedes_component_id`'s nullability.

## 8. Optional hygiene disposition

### 8.1 Decision

Option **B**, with a strict non-blocking condition: a standalone **Migration C: Foundation Function search_path Hygiene**, authored only after Migrations A and B are applied, independently verified, and the M4-M8 retrospective is closed.

Option A (leave entirely deferred) is rejected only because 20 functions is a bounded, enumerable set, and a hygiene item with no landing place becomes permanent by default. Giving it a named destination costs nothing and commits nothing.

### 8.2 Why it is not mixed into A or B

The coupling test is whether the change shares a failure mode or a proof surface with either migration. It shares neither.

Pinning `search_path` on an existing function requires `CREATE OR REPLACE` of that function's whole body, which is the single riskiest statement class in this repository: it re-authors live trigger logic. Bundling 19 such statements into Migration A would mean a body defect in an unrelated hygiene item aborts the P1 destructive-privilege hardening. Bundling them into Migration B would mean the same defect aborts the commercial integrity hardening. Both couplings are unacceptable, and neither buys anything, because the hygiene items have no runtime interaction with either migration's contracts.

Discovery classified these 20 as hygiene, not security remediation. This design does not promote them. No new evidence was found during this design that would justify promotion.

### 8.3 The single coupled exception

`fn_protect_commitment_component_membership()` is one of the 20. Part B2 must `CREATE OR REPLACE` it anyway, to add the Rule 3 check. Pinning `set search_path = pg_catalog` in that same statement is therefore zero additional risk: the statement is already being written, already being reviewed, and already being proven by the runtime gate, which asserts both the new `prosrc` and the new `proconfig` (test B37).

**Exactly one function is pinned, and only because it is already being rewritten.** No other function receives a `search_path` change in Migration A, in Part B1, or in Part B2. The other 19 stay in the deferred set for optional Migration C, unchanged.

Safety is verifiable rather than assumed. The function's body references only `public.commercial_commitments`, `public.commercial_components`, and `public.commercial_commitment_components`, all already schema-qualified, plus built-ins resolved from `pg_catalog` regardless. Pinning changes no name resolution.

**Locked: this one function's `search_path` is pinned in Migration B. The deferred set reduces from 20 to 19.**

This is a judgment call, stated as a firm recommendation. The alternative, leaving it unpinned and deferring it to C with the other 19, costs nothing either and may be preferred by a reviewer who wants Migration B's diff to contain no hygiene at all. Either choice is defensible; the design picks the first because the rewrite is already mandatory.

The new function `fn_protect_commercial_commitment_scope()` is created with `set search_path = pg_catalog` from birth, per the current standard for new functions established by `fn_reject_truncate()`. It is not part of the deferred set.

### 8.4 Migration C scope, if and when authored

- 19 SECURITY INVOKER M4-M8 functions receive `set search_path = pg_catalog`.
- Optionally, the non-business-dependent `dimension_keys` shape check named in Appendix A.5.
- Nothing else.
- Does not block M4-M8 closeout.

## 9. Table-level TRUNCATE matrix

### 9.1 The matrix

`REVOKE TRUNCATE FROM service_role`: **all 13**. `ATTACH public.fn_reject_truncate()`: **all 13**.

| Table | Row-level DELETE guard today | Revoke | Guard | FK-referenced by another table | Destructive test |
|---|---|---|---|---|---|
| `form_definitions` | None. Selective DELETE deliberately permitted | Yes | Yes | Yes (`form_versions`) | Composite |
| `form_versions` | `fn_protect_form_version_lifecycle` rejects DELETE unconditionally | Yes | Yes | Yes (`requests`) | Composite |
| `requests` | `fn_protect_request_integrity` rejects DELETE unconditionally | Yes | Yes | Yes (`submission_revisions`, `commercial_changes`) | Composite |
| `submission_revisions` | `fn_protect_submission_revision_lifecycle` rejects DELETE unconditionally | Yes | Yes | No | **Direct** |
| `customers` | `fn_protect_customer_lifecycle` rejects DELETE unconditionally | Yes | Yes | Yes (`commercial_configurations`) | Composite |
| `capabilities` | `fn_protect_capability_lifecycle` rejects DELETE unconditionally | Yes | Yes | Yes (`commercial_component_capabilities`) | Composite |
| `measurement_definitions` | `fn_protect_measurement_definition_lifecycle` rejects DELETE unconditionally | Yes | Yes | Yes (`commercial_components`) | Composite |
| `commercial_configurations` | `fn_protect_commercial_configuration_lifecycle` rejects DELETE unconditionally | Yes | Yes | Yes (`commercial_changes`, `commercial_components`) | Composite |
| `commercial_changes` | `fn_reject_update_delete` (insert-only) | Yes | Yes | Yes (`commercial_configurations`, `commercial_components`, `commercial_commitments`) | Composite |
| `commercial_components` | `fn_protect_commercial_component_lifecycle` rejects DELETE unconditionally | Yes | Yes | Yes (self, `commercial_component_capabilities`, `commercial_commitments`, `commercial_commitment_components`) | Composite |
| `commercial_component_capabilities` | `fn_reject_update_delete` (insert-only) | Yes | Yes | No | **Direct** |
| `commercial_commitments` | `fn_protect_commercial_commitment_lifecycle` rejects DELETE unconditionally | Yes | Yes | Yes (`commercial_commitment_components`) | Composite |
| `commercial_commitment_components` | `fn_reject_update_delete` (insert-only) | Yes | Yes | No | **Direct** |

Totals: 13 revoked, 13 guarded, 3 direct destructive tests, 10 composite proofs.

### 9.2 The architecture review: 9, 12, or 13

**Decision: 13.** The discovery's proposal of 9 is rejected. 12 is rejected. The stated preference of 13 is confirmed, on independent semantic grounds rather than by symmetry.

**The 12 tables with an unconditional row-level DELETE guard.** Each of these 12 already claims a permanence or history contract that its own lifecycle function enforces unconditionally against row-level DELETE. PostgreSQL does not fire row-level triggers on TRUNCATE, and Row Level Security does not apply to TRUNCATE at all. Without a statement-level guard these 12 tables have zero layers for TRUNCATE while claiming an absolute contract for DELETE. Attaching the guard closes a hole in a protection each of them already claims to have. No table gains a new class of protection.

This is the identical derived attachment rule that `20260909090000_platform_core_integrity_hardening.sql` applied to Platform Core, and it produces 12 of the 13 here rather than 4 of 8, because the M4-M8 tables are overwhelmingly permanence-guarded while Platform Core's were not.

**`form_definitions`, the single contested table.** It receives the guard. Three independent reasons, none of which is symmetry or reconstructability.

1. *DELETE-one and TRUNCATE-all are not semantically equivalent.* The locked rule permits deleting an unused Form Definition with zero versions. TRUNCATE removes every Form Definition, including every one that does have versions, is referenced by published Form Versions, and anchors live Requests. TRUNCATE is therefore not a bulk form of the permitted operation; it is a different operation that the locked rule never authorized. Allowing DELETE of one unused row while prohibiting TRUNCATE of the whole table is fully consistent, not a contradiction.

2. *A statement-level guard cannot block the permitted selective DELETE.* A `BEFORE TRUNCATE FOR EACH STATEMENT` trigger fires only on TRUNCATE. It is invisible to `DELETE FROM form_definitions WHERE id = ...`. So the permitted operation is preserved exactly, at zero cost. There is nothing to trade off.

3. *`form_definitions` is the root of the form, version, request, submission graph, and `TRUNCATE CASCADE` traverses it.* `form_versions.form_definition_id` references `form_definitions`, `requests.pinned_form_version_id` references `form_versions`, and `submission_revisions.request_id` references `requests`. Every one of those foreign keys is `ON DELETE RESTRICT`, but **`TRUNCATE ... CASCADE` follows referencing tables regardless of the declared referential action.** `ON DELETE RESTRICT` does not constrain TRUNCATE in any way. So `TRUNCATE form_definitions CASCADE` reaches `submission_revisions`, which is P1-2, the highest-severity finding in the whole retrospective. Under the discovery's 9-table set, `form_definitions` would be the one unguarded entry point into that graph.

Belt and braces, both directions are covered. A `BEFORE TRUNCATE` trigger fires for every relation in the truncation set, and CASCADE adds the referencing tables to that set, so guarding `submission_revisions` also aborts `TRUNCATE form_definitions CASCADE`. Guarding `form_definitions` aborts it at the entry point, before any relation in the set is touched. Both layers exist because either alone would depend on an assumption about which relation PostgreSQL reaches first.

**Principle applied as stated.** Reconstructability affects the severity of loss; it does not determine whether wholesale destruction is allowed. `capabilities`, `customers`, and `measurement_definitions` are all relatively reconstructable reference data compared to `submission_revisions`, and all three still receive the guard, because each carries an explicit no-hard-delete contract and each is referenced by financially material commercial rows that would be silently orphaned or destroyed by cascade. Severity ranked the findings; it did not decide the attachment set.

### 9.3 Safe composite-proof strategy

No `TRUNCATE` statement is ever issued, in any form, against any of the 10 foreign-key-referenced tables. No `CASCADE` is ever issued at all.

**Why the direct-test set is exactly 3.** PostgreSQL refuses `TRUNCATE t` when `t` is referenced by a foreign key from a table not itself in the truncation list, raising `cannot truncate a table referenced in a foreign key constraint` (`0A000`). Whether that check is evaluated before or after `BEFORE TRUNCATE` triggers fire is a PostgreSQL implementation detail that is not guaranteed by its documentation, and **this design deliberately does not rely on it in either direction.** A direct destructive test is therefore only meaningful on a table no other table references. Exactly three of the 13 qualify: `submission_revisions`, `commercial_component_capabilities`, `commercial_commitment_components`.

Note that self-reference does not disqualify a table on its own, but `commercial_components` is referenced by three other tables as well, so it is in the composite set regardless.

A useful and non-accidental result: the three tables where a direct destructive proof is available are exactly P1-2 and P1-3, the three highest-severity findings. The tables whose protection matters most are the tables whose protection can be proven by execution.

**Composite proof for the remaining 10.** Protection is established as the conjunction of four independently asserted facts, mirroring the `resources` precedent recorded in the M1-M3 closeout:

- **Canonical body.** `fn_reject_truncate()`'s `pg_proc.prosrc` matches the locked expected constant exactly, and its `proconfig`, `prosecdef`, and `prolang` match. The body has zero table-specific logic: one unconditional `RAISE`, no branching, no table access, no dynamic SQL, no catalog lookup, no data dependency, and no reachable success path. `TG_TABLE_NAME` is used solely to compose the diagnostic message. The function therefore cannot behave differently on one table than on another (test A01).
- **Exact attachment.** For each of the 10, a trigger of the exact locked name exists on the exact table, with `tgtype` encoding `BEFORE` plus `TRUNCATE` plus `STATEMENT`, `tgenabled = 'O'`, `tgnargs = 0`, and `tgfoid` equal to the single `fn_reject_truncate()` OID (test A03).
- **Privilege absence.** `has_table_privilege('service_role', <table>, 'TRUNCATE')` is false (test A05), asserted from the catalog, never by attempting the statement.
- **Behavioral proof of that exact function OID.** Tests A12, A13, and A14 prove that this same function OID, fired by a real `TRUNCATE`, raises `P0001` with the guard's message. Combined with the canonical body, that behavior transfers to every table the same OID is attached to.

The transfer is valid only because the body is canonical, so Migration A must not modify it (§6.2) and any future migration that does must update the expected constant in the same change.

**Recorded as an explicit attestation.** Test A17 names all 10 tables and the four supporting tests (A01, A03, A05, and A12 through A14), so the composite is a stated, reviewable claim rather than an implicit gap in coverage.

**Lock scope of the three direct tests, stated because it is a production-impact boundary.** `TRUNCATE` acquires an `ACCESS EXCLUSIVE` lock on its target relation before any `BEFORE TRUNCATE` trigger fires, so tests A12 through A15 each hold that lock on one of the three join or revision tables until their transaction rolls back. The window is one statement long and the three targets are referenced by nothing, so no cascade set is built and no other relation is locked. This is stated rather than left implicit so the harness is run with the same awareness as any other brief exclusive-lock operation.

### 9.4 Explicitly not used as substitutes

Audit triggers are not a substitute for preventing destructive loss. `fn_audit_row()` is an `AFTER ... FOR EACH ROW` trigger and does not fire on TRUNCATE at all, so a TRUNCATE would destroy rows and leave no audit trace whatsoever. Migration B's audit work is traceability, not protection, and no part of §11 is offered as mitigation for anything in §9. RLS is likewise not a substitute, because RLS does not apply to TRUNCATE.

## 10. Trigger attachment matrix

After Migration A, schema `public` contains exactly **17** triggers whose function is `public.fn_reject_truncate()`.

| Set | Count | Tables | Added by |
|---|---|---|---|
| Platform Core M1-M3 | 4 | `audit_log`, `resources`, `user_roles`, `role_permissions` | `20260909090000_platform_core_integrity_hardening.sql` |
| M4-M8 | 13 | The 13 tables of §2.1 | Migration A |

All 17 share: name pattern `trg_<table>_reject_truncate`, `BEFORE TRUNCATE`, `FOR EACH STATEMENT`, `tgenabled = 'O'`, `tgnargs = 0`, no `WHEN` clause, and one shared function OID.

The runtime gate asserts the count is exactly 17, with no extras (test A02), and separately asserts the original 4 are still present, still enabled, and still bound to the same OID (test A04), so Migration A is proven not to have disturbed the Platform Core guards it depends on for its own precedent.

## 11. Audit resource linkage contract

### 11.1 The defect

`fn_audit_row()` detects the audited row's Resource by literal key lookup: `nullif(v_row ->> 'resource_id', '')::uuid`. That is correct for every audited table whose Resource column is literally named `resource_id`, and correct for every audited table that is not Resource-backed, where NULL is the right answer.

It is wrong for exactly three tables, each of which carries a Resource identity under a differently named column:

- `requests.id` **is** `resources.resource_id`, with `resource_type = 'request'`.
- `commercial_configurations.id` **is** `resources.resource_id`, with `resource_type = 'commercial_configuration'`.
- `commercial_changes.request_id` **is** `requests.id`, which **is** `resources.resource_id`.

For all three, `audit_log.resource_id` is currently NULL on every row, so audit history cannot be joined to the Resource Registry by that column.

### 11.2 API design, independently assessed and accepted

The discovery's proposal is accepted: an optional second trigger argument naming the resource-id column, defaulting to `resource_id`.

It is accepted because it is not a new idiom. M6 solved the byte-for-byte identical problem for `fn_assert_resource_type()`: `requests`' Resource column is named `id`, not `resource_id`, so the function was generalized to take an optional second argument defaulting to `'resource_id'`, preserving `form_versions`' existing single-argument call unchanged. M6's own header records that it was following `fn_audit_row(pk_column_name)`'s precedent. Applying the same shape back to `fn_audit_row()` closes the loop rather than inventing a parallel mechanism.

Alternatives considered and rejected:

- *A table-specific audit function per affected table.* Rejected: three duplicates of logic that already exists and is proven, plus three new SECURITY DEFINER functions to review, plus three new privilege postures.
- *Adding a literal `resource_id` column to the three tables.* Rejected: it denormalizes a value that already equals the primary key, requires making it immutable, requires a backfill, and changes three locked table shapes to work around a function argument.
- *Catalog introspection inside `fn_audit_row()` to discover the Resource column.* Rejected: it would add a catalog lookup to a SECURITY DEFINER function on every audited write, and the answer is static per trigger and already known at `CREATE TRIGGER` time.
- *Deriving `resource_id` at read time only, with no schema change.* Rejected as the sole remedy, because P2-2 is a real traceability defect for all future rows. It is however the correct treatment for historical rows (§11.10).

### 11.3 Trigger argument contract, locked

| `tg_nargs` | `TG_ARGV[0]` | `TG_ARGV[1]` | Resource column used | Behavior |
|---|---|---|---|---|
| 0 | absent | absent | none | Raise. Argument-count error. |
| 1 | row-id column, non-null, non-empty | absent | literal `resource_id` | Byte-identical to today. |
| 1 | null or empty | absent | none | Raise. Existing behavior, unchanged. |
| 2 | row-id column, non-null, non-empty | non-null, non-empty | `TG_ARGV[1]` | New behavior. Column must exist on the row. |
| 2 | row-id column, non-null, non-empty | null or empty string | literal `resource_id` | Treated as omitted, matching `fn_assert_resource_type()`. |
| 3 or more | any | any | none | Raise. Argument-count error. |

Resolution is `coalesce(nullif(tg_argv[1], ''), 'resource_id')`, the exact expression M6 used. The row-id column continues to be read as `(v_row ->> tg_argv[0])::uuid` and the resource column as `(v_row ->> <resolved>)`, both by JSONB key lookup on `to_jsonb(new)` or `to_jsonb(old)`, never as dynamic SQL. No `EXECUTE`, no string-built identifiers. The SECURITY DEFINER privilege-escalation review recorded in Migration 1 continues to hold unchanged, because the new argument is still migration-supplied at `CREATE TRIGGER` time and never caller-supplied at runtime.

### 11.4 Backward compatibility

Absolute. When `tg_nargs = 1`, the resolved resource column is the literal string `resource_id`, and the lookup, the `nullif`, the cast, and the NULL-on-absent behavior are identical to the current implementation. No existing caller changes.

Every existing `fn_audit_row()` caller and why it stays correct with one argument:

| Trigger | Table | Argument | Resource column present | Resulting `resource_id` |
|---|---|---|---|---|
| `trg_audit_app_users` | `app_users` | `'id'` | No | NULL, correct (not Resource-backed) |
| `trg_audit_roles` | `roles` | `'id'` | No | NULL, correct |
| `trg_audit_permissions` | `permissions` | `'id'` | No | NULL, correct |
| `trg_audit_role_permissions` | `role_permissions` | `'id'` | No | NULL, correct |
| `trg_audit_user_roles` | `user_roles` | `'id'` | No (`scope_resource_id` is a different fact) | NULL, correct |
| `trg_audit_form_definitions` | `form_definitions` | `'id'` | No | NULL, correct |
| `trg_audit_form_versions_insert` | `form_versions` | `'resource_id'` | Yes, literally named | The row's `resource_id`, already correct |
| `trg_audit_form_versions_lifecycle` | `form_versions` | `'resource_id'` | Yes, literally named | Already correct |
| `trg_audit_customers` | `customers` | `'id'` | No | NULL, correct |
| `trg_audit_capabilities` | `capabilities` | `'id'` | No | NULL, correct |
| `trg_audit_measurement_definitions` | `measurement_definitions` | `'id'` | No | NULL, correct |
| `trg_audit_commercial_components` | `commercial_components` | `'id'` | No | NULL, correct |
| `trg_audit_commercial_commitments` | `commercial_commitments` | `'id'` | No | NULL, correct |

Exactly three triggers are wrong today and exactly three are recreated. No fourth table needs the second argument. `user_roles.scope_resource_id` deliberately stays undetected: it scopes a grant to a Resource, it is not the Resource the audited row *is*, and conflating them would put a scope pointer into a provenance column.

### 11.5 Complete failure contract for the resolved resource column

The governing principle: **a structural defect is loud, a legitimately absent value is silent, and an invalid value is loud.** Silent coercion of bad data is never chosen.

Three of the five outcomes below are raised by `fn_audit_row()` itself. Two are raised by PostgreSQL beneath it, and are recorded here because they are real behavior of the two-argument path and a future caller must not discover them by accident.

| Case | Where it fails | SQLSTATE | Behavior |
|---|---|---|---|
| Resolved column is not a key on the audited row, `tg_nargs = 2` | `fn_audit_row()` | `P0001` | **Raise.** Named column does not exist. |
| Resolved column is not a key on the audited row, `tg_nargs = 1` | Nowhere | none | **Record NULL.** Backward compatibility, and correct. |
| Resolved column exists and its value is SQL NULL | Nowhere | none | **Record NULL.** Legitimate data state. |
| Resolved column exists, value is not a valid UUID | PostgreSQL `::uuid` cast | `22P02` | **Write fails.** Not caught, not coerced. |
| Resolved column exists, value is a valid UUID with no matching `resources` row | `audit_log.resource_id` foreign key | `23503` | **Write fails.** Not caught, not coerced. |

**Missing column, two-argument call: raise.** A named column that does not exist is a migration authoring error, exactly the class M6 identified when it observed that attaching the old `fn_assert_resource_type()` to `requests` would have failed at trigger-fire time rather than silently validating nothing. It must fail at the first write, not silently record NULL forever. Presence is tested with the JSONB existence operator `?`, not by comparing the extracted value to NULL, because `->>` returns NULL both for an absent key and for a present-but-NULL value, and those two cases must be distinguished. The `?` operator resolves from `pg_catalog`, so the function's pinned `search_path` is unaffected.

**Missing column, one-argument call: NULL, no error.** Required for backward compatibility, and correct: 11 of the 13 surviving one-argument audited tables have no Resource column and NULL is the right answer for all of them.

**NULL value, two-argument call: record NULL, no error.** The founding rule that `fn_audit_row()` never fails a write for a legitimately absent value is preserved for value-level nullness. In practice this branch is unreachable for all three affected triggers, because `requests.id`, `commercial_configurations.id`, and `commercial_changes.request_id` are all `NOT NULL` primary keys. It is specified rather than left undefined so a future two-argument caller on a nullable column has a stated contract instead of a surprise.

**Invalid UUID: `22P02`, deliberately not caught.** The resource column is read as `nullif(v_row ->> <resolved>, '')::uuid`, the same cast shape the function already applies. A two-argument caller that names a text column holding a non-UUID value produces a cast failure and the audited write aborts. No `EXCEPTION WHEN invalid_text_representation` block is added. Swallowing it would mean recording an audit row that silently omits a Resource link the trigger was explicitly configured to capture, which is the precise defect P2-2 exists to fix.

**Unregistered UUID: `23503`, deliberately not caught.** See §11.6.

**No `EXCEPTION` block of any kind is added to `fn_audit_row()`.** The function has none today and gains none. Every failure above either raises deliberately or propagates.

### 11.6 The `audit_log.resource_id` foreign key, and why the three new triggers cannot violate it

This is the load-bearing precondition of the whole two-argument design, and it is stated explicitly rather than assumed.

`audit_log.resource_id` is declared:

> `resource_id uuid references resources (resource_id) on delete restrict`

That foreign key exists today and is **not weakened, dropped, deferred, or made `NOT VALID` by this design.** It has simply never been exercised for `requests`, `commercial_configurations`, or `commercial_changes`, because the value written for those three tables has always been NULL and a NULL referencing column satisfies a foreign key trivially. After Part B1 it is exercised on every audited write to those three tables.

**Structural proof that the three locked triggers cannot produce an unregistered Resource UUID.** Each affected table's resource identity is itself foreign-key chained to `resources`, so a row cannot exist in the audited table unless the `resources` row it will name already exists:

| Trigger | Value written to `audit_log.resource_id` | Chain that guarantees a `resources` row exists |
|---|---|---|
| `trg_audit_requests` | `requests.id` | `requests.id` is the primary key **and** a foreign key to `resources (resource_id)`. A `requests` row cannot exist without it. |
| `trg_audit_commercial_configurations` | `commercial_configurations.id` | `commercial_configurations.id` is the primary key **and** a foreign key to `resources (resource_id)`. Same guarantee. |
| `trg_audit_commercial_changes` | `commercial_changes.request_id` | `commercial_changes.request_id` is a foreign key to `requests (id)`, which is itself a foreign key to `resources (resource_id)`. Two hops, both `NOT NULL`, both enforced. |

For all three the audit trigger is `AFTER ... FOR EACH ROW`, so it fires only once the audited row itself has satisfied its own foreign keys. The `resources` row is therefore committed or at least present in the same transaction before the audit insert runs. `create_commercial_configuration_with_change`'s locked insert order (`commercial_changes`, then `resources`, then `commercial_configurations`) is consistent with this: the `commercial_changes` audit row names the Request's Resource, which predates the whole transaction, and the `commercial_configurations` audit row names the Resource inserted one statement earlier.

`23503` on this foreign key is therefore unreachable for the three locked triggers. It is reachable only for a hypothetical future two-argument caller naming a column that holds a UUID with no Resource Registry entry, and for that caller failing loudly is the correct answer: an audit row asserting a Resource that does not exist is worse than a write that refuses to complete.

Test B08 proves the `23503` behavior on a rollback-bound fictional relation, so the contract is demonstrated rather than merely argued, without any of the three production triggers ever being able to reach it.

### 11.7 May `row_id` and `resource_id` be identical

**Yes, legitimately, and for two of the three triggers they always will be.** Migration 1's own comment already states this: "for a resource-backed table, row_id and resource_id will legitimately be equal, which is expected, not a bug."

`trg_audit_requests` and `trg_audit_commercial_configurations` both resolve to `fn_audit_row('id', 'id')`, so `row_id` and `resource_id` carry the same value. That is not redundancy to be optimized away. `row_id` answers "which row of which table changed" and `resource_id` answers "which Nexus Resource does this concern". For a Resource-backed table those questions have the same answer, and a consumer querying by `resource_id` must find these rows.

### 11.8 The exact three triggers to recreate

| Trigger | Table | Current | Locked new |
|---|---|---|---|
| `trg_audit_requests` | `public.requests` | `fn_audit_row('id')` | `fn_audit_row('id', 'id')` |
| `trg_audit_commercial_configurations` | `public.commercial_configurations` | `fn_audit_row('id')` | `fn_audit_row('id', 'id')` |
| `trg_audit_commercial_changes` | `public.commercial_changes` | `fn_audit_row('request_id')` | `fn_audit_row('request_id', 'request_id')` |

Recreation is required rather than alteration because trigger arguments are fixed at `CREATE TRIGGER` time and PostgreSQL provides no way to alter them. `DROP TRIGGER` then `CREATE TRIGGER`, plain, never `IF EXISTS`, so a missing expected trigger fails the migration loudly.

**Only the argument list changes, and that is verified rather than asserted.** Every other property is reproduced identically: same trigger name, `AFTER INSERT OR UPDATE OR DELETE`, `FOR EACH ROW`, no `WHEN` clause, same function, same enabled posture. Because a `DROP` destroys the evidence, the current definitions are captured before apply by gate **G3** and compared after apply by test **B12** (§14.2, §16.3). The comparison is structural and normalized, not raw text equality, so it cannot be defeated by incidental formatting:

| Property compared | Source |
|---|---|
| Trigger name and table | `pg_trigger.tgname`, `tgrelid` |
| Timing (`AFTER`) and level (`FOR EACH ROW`) | `tgtype` bit decoding |
| Event set (`INSERT`, `UPDATE`, `DELETE`) | `tgtype` bit decoding |
| Function identity | `tgfoid` |
| Enabled posture | `tgenabled` |
| `WHEN` clause presence and expression | `tgqual`, expected NULL for all three |
| `UPDATE OF <columns>` column list | `tgattr`, expected empty for all three |
| Constraint-trigger status, deferrability | `tgisinternal`, `tgconstraint`, `tgdeferrable`, `tginitdeferred` |
| Argument list | `tgnargs`, `tgargs`. **The only permitted difference.** |

The raw `pg_get_triggerdef()` text is also captured by G3 and recorded in the closeout, so a human can diff the before and after directly. The structural tuple is what the automated test compares, because `pg_get_triggerdef()` output is a rendering and not a stable contract.

`form_versions`' two split triggers are not touched, so the narrow `form_versions` audit strategy is preserved exactly. Their definitions are not captured by G3 because they are never dropped.

### 11.9 Should `commercial_changes.resource_id` equal `request_id`

**Yes.** `commercial_changes` is a 1:1 extension of `requests`; `request_id` **is** `requests.id`, which **is** `resources.resource_id`. The Nexus Resource involved in any write to `commercial_changes` is exactly that Request Resource. There is no other candidate: `commercial_changes` mints no Resource of its own, precisely because the Request it extends already provides Resource Registry identity, the same precedent `submission_revisions` follows relative to `requests`.

One consequence to state plainly, because it looks surprising: the `resources` row that `commercial_changes` audit rows point at has `resource_type = 'request'`, not `'commercial_configuration'`. That is correct. The Commercial Change *is* the Request. The Commercial Configuration has its own separate Resource, typed `'commercial_configuration'`, and its own audit rows point at that one.

### 11.10 Historical backfill

**No backfill.** Three reasons, in order of weight.

1. *A backfill would require breaking the append-only contract to repair a convenience column.* `audit_log` is protected by `trg_audit_log_immutable`, which rejects every UPDATE unconditionally, and by `REVOKE UPDATE, DELETE ON audit_log FROM authenticated, anon, service_role`. Backfilling means dropping or disabling that trigger, running mass UPDATEs over the Finance ledger, and restoring it. That is a strictly larger and more dangerous change than the defect it repairs, in a migration whose entire premise is that permanence contracts must hold.

2. *No information is lost, so there is nothing to recover.* `audit_log.table_name` plus `audit_log.row_id` already identify the audited row exactly, and for all three affected tables the `row_id` **is** the `resource_id`. Historical rows are fully resolvable at read time by a one-column mapping. The NULL is a missing denormalized convenience, not missing evidence.

3. *Existing NULL historical rows should not cause history to be rewritten casually.* Confirmed as the right call. A ledger that gets retroactively improved is a ledger whose contents depend on when you read it.

**Cutover semantics, documented so no consumer is surprised.** Rows written before Migration B carry NULL `resource_id` for these three `table_name` values; rows written after carry the correct value. Any consumer reading `audit_log` for `requests`, `commercial_configurations`, or `commercial_changes` must resolve the Resource via `row_id` and must not treat NULL `resource_id` as meaning "no Resource involved". This is recorded in the table comment on `audit_log` and in the M4-M8 closeout document. Test B13 compares the post-apply count against the G2 pre-apply capture and requires exact equality, so the no-backfill decision is proven rather than assumed.

## 12. Commercial RPC idempotency contract

Target: `public.create_commercial_configuration_with_change(p_new_commercial_configuration_id uuid, p_request_id uuid, p_customer_id uuid, p_key text, p_name text, p_effective_date date, p_actor_user_id uuid, p_relationship_note text default null, p_reason text default null, p_audit_request_id uuid default null, p_actor_context jsonb default null)`.

Signature and return type unchanged (§7.3). Rewritten via `CREATE OR REPLACE`.

### 12.1 What the function lacks today

No lock of any kind. No existence check on the Customer or the Request. No activity check on either. No idempotency: a retry carrying the same `p_new_commercial_configuration_id` fails on the `resources` primary key with a raw `23505`, which a caller's retry layer may reasonably misclassify as a transient conflict. No named error for any condition. It is correct only when called exactly once with already-validated inputs.

### 12.2 Serialization anchor

**The `public.customers` row for `p_customer_id`, taken with `SELECT ... FOR UPDATE`.**

Chosen because it is the only pre-existing row that concurrent creation attempts genuinely share. The Configuration does not exist yet, so it cannot be its own anchor. The anchor pattern matches `create_form_version` and `create_request_with_draft`, both of which lock the parent of the thing being created (`form_definitions`), not the thing itself.

The lock is load-bearing rather than decorative: it is what makes the `is_active` check on the Customer non-racy against a concurrent deactivation. Without it, a Configuration could be created for a Customer that was deactivated between the check and the insert.

**Honest limit, stated rather than overclaimed.** `commercial_configurations.key` is globally unique, not unique per Customer. The customers lock therefore serializes same-Customer creation but does **not** serialize two concurrent creations that share a `key` across different Customers. That case is resolved by the unique index on `key`, which is the correct authority for it. This design does not over-serialize to paper over that; see §12.7 for the resulting two-tier outcome.

### 12.3 Lock ordering

Exactly two locks, always in this order, unconditionally:

1. `public.customers` where `id = p_customer_id`, `FOR UPDATE`.
2. `public.requests` where `id = p_request_id`, `FOR UPDATE`.

Outer business parent first, then the operation-identity row. This matches `create_request_with_draft`'s outer-parent-then-row shape.

The second lock exists specifically to make the idempotency probe non-racy. Without it, two concurrent identical retries could both observe no `commercial_changes` row, both proceed, and one would receive a raw `23505` on the `commercial_changes` primary key instead of the idempotent pair. Locking the Request row serializes them, so the second observes the first's committed Change and replays correctly.

**Deadlock survey against every existing Foundation RPC.** `create_form_version` and `publish_form_version` lock `form_definitions` and `form_versions`. `create_request_with_draft` locks `form_definitions`. `submit_revision` locks `requests` then `submission_revisions`. `create_next_revision` locks `requests`. `fn_protect_commitment_component_membership` locks `commercial_commitments`. Nothing anywhere holds `requests` and then requests `customers`, so `customers` then `requests` introduces no cycle. No other code path locks `customers` at all.

No advisory locks. No `LOCK TABLE`. No `NOWAIT`, no `SKIP LOCKED`. Callers block, which is the intended behavior for a creation operation that must not duplicate.

### 12.4 Execution order, locked

1. Set the three audit GUCs.
2. Lock the Customer row. Not found: `CUSTOMER_NOT_FOUND`.
3. Lock the Request row. Not found: `REQUEST_NOT_FOUND`.
4. **Idempotency probe**, before any business validation: read `public.commercial_changes` where `request_id = p_request_id`. If found, run the §12.5 replay identity comparison and either return the existing pair or raise `CONFIGURATION_CHANGE_CONFLICT`.
5. Business validation, create path only: Customer `is_active`, Request `is_active`, configuration key availability, new configuration id availability.
6. Insert `commercial_changes`, then `resources`, then `commercial_configurations`, in that order.
7. Return the pair.

The probe precedes validation deliberately, adopting `create_next_revision`'s explicit rule. A Request or Customer may legitimately have gone inactive after the original call succeeded, and a delayed retry of an operation that already completed must return the completed result rather than fail on state that changed afterwards. Structural failures (`CUSTOMER_NOT_FOUND`, `REQUEST_NOT_FOUND`) precede the probe because they mean the identifiers themselves are wrong.

### 12.5 Retry identity: what genuinely defines "same retry"

**Retry key: `p_request_id`.** `commercial_changes.request_id` is the Change's primary key and is 1:1 with the Request. One Request yields exactly one Commercial Change, permanently. The Request identity is therefore the structural operation identity, the same role `p_new_request_id` plays for `create_request_with_draft`. No `operation_id` column is introduced, consistent with every other Foundation RPC.

Given a found Change, the existing pair is that Change plus the `commercial_configurations` row identified by its `commercial_configuration_id`.

**Must match, or raise `CONFIGURATION_CHANGE_CONFLICT`:**

| Parameter | Compared against | Why it is identity |
|---|---|---|
| `p_new_commercial_configuration_id` | `commercial_changes.commercial_configuration_id` | A different Configuration id under an already-used Request identity is a different operation, not a retry. |
| `p_customer_id` | `commercial_configurations.customer_id` | A different Customer is a different commercial relationship. |
| `p_key` | `commercial_configurations.key` | The key is immutable and business-identifying. |
| `p_effective_date` | `commercial_changes.effective_date` | Effective dating is a Finance control. A different effective date is a different commercial fact. |
| `p_actor_user_id` | `commercial_changes.created_by`, using `IS NOT DISTINCT FROM` | Adopted verbatim from `create_request_with_draft`: without it, a different actor supplying the same identity silently receives someone else's Configuration. `IS NOT DISTINCT FROM` treats two NULLs as a legitimate match, both being system-originated, matching the audit contract's rule that NULL is a valid actor state. |

Additionally, `commercial_changes.change_category` must equal `'initial_setup'`. If the Change found for this `request_id` is a renewal, amendment, correction, or other, that Request was consumed by a non-initial Change and this call is invalid: `CONFIGURATION_CHANGE_CONFLICT`.

**Change kind is not a parameter.** The RPC writes the literal `'initial_setup'`; there is nothing for a caller to vary, so there is nothing to compare. The assertion above is a structural sanity check, not a parameter comparison.

**Deliberately not compared:**

| Parameter | Why not |
|---|---|
| `p_name` | `commercial_configurations.name` is explicitly editable by `fn_protect_commercial_configuration_lifecycle`. It may have legitimately changed after the original success, so comparing it would falsely reject a genuine retry. Same reasoning that makes `create_request_with_draft` refuse to compare `raw_data`. |
| `p_relationship_note` | Explicitly editable, same reason. |
| `p_reason` | A free-text annotation on the Change carrying no business identity. Comparing free text makes retries fragile on whitespace and casing for no integrity gain. |
| `p_audit_request_id` | Audit correlation, per-attempt by nature. |
| `p_actor_context` | Audit context, per-attempt by nature. |
| `p_request_id` | It is the key. Equality is a precondition of reaching the comparison. |

So the locked replay identity is the key plus five compared values plus one structural assertion. A caller retrying the exact same operation gets the existing pair. A caller reusing an identity with different business meaning fails loudly.

### 12.6 Idempotent replay behavior

Returns the existing `(commercial_change, commercial_configuration)` pair as the function's ordinary result. No exception. No new row in `commercial_changes`, `resources`, or `commercial_configurations`. No `UPDATE` of any existing row, so no `audit_log` row is written by the replay: the GUCs are set but no DML runs. The replay is observationally identical to the original call from the caller's perspective and invisible in the ledger, which is correct, because nothing happened.

### 12.7 Exact conflict behavior

All errors are `RAISE EXCEPTION`, `SQLSTATE P0001`, with a leading uppercase token, matching the established RPC convention (`FORM_DEFINITION_NOT_FOUND`, `REQUEST_ID_CONFLICT`, `BOOTSTRAP_MISMATCH`, and so on). Trigger functions use prose messages without a token; RPCs use tokens. That split is pre-existing and is preserved.

| Token | Condition |
|---|---|
| `CUSTOMER_NOT_FOUND` | No `customers` row for `p_customer_id`. |
| `CUSTOMER_INACTIVE` | Customer exists, `is_active = false`, create path only. |
| `REQUEST_NOT_FOUND` | No `requests` row for `p_request_id`. |
| `REQUEST_INACTIVE` | Request exists, `is_active = false`, create path only. |
| `CONFIGURATION_CHANGE_CONFLICT` | A Change exists for `p_request_id` but fails any §12.5 comparison. Message names which comparison failed. |
| `CONFIGURATION_KEY_CONFLICT` | Create path, `p_key` is already held by a different `commercial_configurations` row. |
| `CONFIGURATION_ID_CONFLICT` | Create path, `p_new_commercial_configuration_id` already exists as a `resources` or `commercial_configurations` row while no Change exists for `p_request_id`. A cross-wired identity reuse that would otherwise surface as a raw `23505`. |

**Two-tier key outcome, stated explicitly.** `CONFIGURATION_KEY_CONFLICT` is raised by a pre-check under the locks. A genuinely concurrent cross-Customer collision that the customers lock cannot serialize (§12.2) instead lands on `23505` from the unique index on `key`. That is intentional: the unique index is the true authority, and the named error covers the overwhelmingly common case of a human reusing a key. This is the reverse of `publish_form_version`'s choice not to name `PUBLISHED_VERSION_CONFLICT`, and the reason for the difference is that a duplicate key here is a genuine, expected business condition, not an unreachable integrity failure.

### 12.8 Customer validation

Must exist (`CUSTOMER_NOT_FOUND`). Must be `is_active = true` (`CUSTOMER_INACTIVE`), on the create path only.

The activity requirement is a business judgment, made explicitly. `customers.is_active` is documented as a reversible current-activity and selectability flag. Creating brand-new commercial terms for a Customer is exactly a selection act, so an inactive Customer must not be selectable for it. Existing Configurations on a deactivated Customer are entirely unaffected: no existing row is touched, and reactivation is permitted, so this is not a one-way consequence.

### 12.9 Request validation

Must exist (`REQUEST_NOT_FOUND`). Must be `is_active = true` (`REQUEST_INACTIVE`), on the create path only.

Adopted directly from `submit_revision` and `create_next_revision`, both of which refuse to act on an inactive Request. `requests.is_active` is one-way, so an inactive Request is permanently ended and must not acquire new commercial meaning.

Not validated here: whether the Request's pinned Form Version is a commercial form, and whether the Request has an approved submission. Both are domain-service concerns above the repository boundary. This function is a persistence primitive, not a business API, and the existing `fn_assert_resource_type` backstop plus the `resource_type = 'request'` check already cover Resource Registry integrity.

### 12.10 Actor identity behavior

`p_actor_user_id` is written to `commercial_changes.created_by`, `resources.created_by`, and both `commercial_configurations.created_by` and `updated_by`. NULL is permitted and means system-originated, consistent with the audit contract. Behavior is unchanged from today except that the actor now participates in replay identity via `IS NOT DISTINCT FROM` (§12.5).

`SECURITY INVOKER` is preserved. The only legitimate caller is the trusted `service_role` application path, which already holds every privilege the function needs, so there is nothing to elevate and no reason to accept `SECURITY DEFINER`'s search-path risk. The application service remains responsible for having independently verified the actor from a trusted authenticated session, the same trust contract as every other Nexus write path.

### 12.11 Commercial change relationship validation

The function writes `commercial_changes.commercial_configuration_id = p_new_commercial_configuration_id` and `commercial_configurations.commercial_change_id = p_request_id`, so the mutual backlink is correct by construction. No separate runtime check is added inside the function, because Rule 4's composite foreign key (§13.5) proves it declaratively at insert time for every writer, including any future one. Duplicating it in the RPC would create a second place to keep correct.

**Part-split note.** The RPC hardening ships in Part B1 and Rule 4's foreign key ships in Part B2 (§5.2). If B1 lands without B2, this function's backlink correctness is exactly what it is today: correct by construction, enforced in this one code path. That is not a regression introduced by the split, and no new gap opens. What B2 adds is enforcement for every other writer, present or future. This function does not depend on B2 to be correct, which is precisely why the two can be separated.

### 12.12 Transaction atomicity

Unchanged posture, restated as locked. No `BEGIN`, `COMMIT`, or `ROLLBACK` inside the function. No `EXCEPTION WHEN` block of any kind, so no error is swallowed and fail-loud is preserved. No compensating cleanup logic: any raise aborts the whole transaction, leaving no `resources`, `commercial_changes`, or `commercial_configurations` row committed. The insert order (`commercial_changes`, then `resources`, then `commercial_configurations`) is preserved exactly. That order is already required today by `commercial_configurations.commercial_change_id`'s ordinary immediate foreign key and by the `resources` row having to exist before `commercial_configurations` is inserted. Once Part B2 lands, Rule 4's composite foreign key makes it structurally mandatory for every writer rather than merely conventional (§13.5).

**No internal retry loop.** Matching every other Foundation RPC, none of which has one. Under `READ COMMITTED`, the Supabase default, the `FOR UPDATE` locks give correct serialization with no serialization failures. Under `REPEATABLE READ` or `SERIALIZABLE`, a concurrent conflict may raise `40001`, and retrying is the caller's responsibility. That retry is safe precisely because the operation is idempotent on `p_request_id`.

### 12.13 Audit GUC behavior

Unchanged and locked as-is: three `set_config` calls for `app.current_user_id`, `app.request_id`, and `app.actor_context`, each wrapping the value in `coalesce(x::text, '')`, each with `is_local = true`, all three as the first statements in the body before any lock or DML.

The `coalesce` to empty string rather than passing SQL NULL is preserved deliberately: `fn_audit_row()` reads these back with `nullif(current_setting(...), '')`, which round-trips correctly either way without depending on how `set_config(..., NULL, ...)` behaves for a custom GUC.

They are set on every path, including the replay path, where they are harmless because no DML follows, and including paths that then raise, where the transaction-local setting dies with the aborted transaction. Note that `p_audit_request_id` populates `app.request_id`, the audit correlation identifier, and is distinct from `p_request_id`, the business Request identity. That naming split is pre-existing and preserved.

## 13. Commercial cross-parent integrity contract

### 13.1 Mechanism selection, and one clarification that prevents the likeliest misreading

Six rules, three mechanisms, each chosen for a stated reason.

| Rule | Invariant | Mechanism | Why |
|---|---|---|---|
| 1 (§13.2) | Component's Change is in the Component's Configuration | Composite foreign key | Both columns exist on both sides |
| 2 (§13.3) | Quantity Commitment's Component shares its Change's Configuration | `BEFORE INSERT` trigger | Commitment side has no Configuration column to key on |
| 3 (§13.4) | Spend Commitment's member Components share its Configuration | Extend existing `BEFORE INSERT` trigger | Same reason, and one function already owns that table |
| 4 (§13.5) | Configuration's Change backlinks to that Configuration | Composite foreign key | Both columns exist on both sides |
| 5 (§13.6) | Successor and predecessor share a Configuration | Self-referencing composite foreign key | Both columns exist on the one table |
| 6 (§13.7) | A Component may not supersede itself | `CHECK` constraint | Single-row comparison, no cross-row lookup needed |

Rules 1, 4, and 5 are enforced declaratively by composite foreign keys, because the columns needed to key on already exist on both sides. Rules 2 and 3 are enforced by `BEFORE INSERT` triggers, because the Commitment side has no Configuration column to key on and inventing one would be a denormalized duplicate (§13.3). Rule 6 is the only rule expressible as a `CHECK`, because it is the only one that compares two columns of a single row rather than reaching another row (§13.9).

Two new `UNIQUE` constraints support the composite foreign keys.

**Clarification, stated prominently because it is the most likely misreading of this design.** Neither new `UNIQUE` constraint restricts anything.

- `uq_commercial_changes_configuration_request UNIQUE (commercial_configuration_id, request_id)`: `request_id` is already the primary key of `commercial_changes`, so this pair can never collide unless the primary key already would. It does **not** mean one Change per Configuration. Many Changes may share a Configuration, which is the entire point of the model.
- `uq_commercial_components_configuration_id UNIQUE (commercial_configuration_id, id)`: `id` is already the primary key of `commercial_components`, so the same reasoning applies.

Both exist solely to give PostgreSQL a valid composite reference target, since a foreign key's referenced column list must be backed by a unique or primary key constraint. Their semantic effect is exactly zero. Their only real cost is one additional index on each table.

**Existing single-column foreign keys are kept, not replaced.** Each new composite subsumes an existing single-column foreign key, so the pair is redundant in integrity terms. Keeping both is deliberate: dropping a locked constraint from an applied migration for no integrity gain is a larger change than adding one, and this repository's convention is additive forward fixes. The accepted cost is one extra index probe per insert on tables with very low write volume.

### 13.2 Rule 1: Component's Change must belong to the Component's Configuration

Mechanism: **unique supporting constraint plus composite foreign key.**

- `public.commercial_changes` gains `uq_commercial_changes_configuration_request UNIQUE (commercial_configuration_id, request_id)`.
- `public.commercial_components` gains `fk_commercial_components_change_within_configuration FOREIGN KEY (commercial_configuration_id, commercial_change_id) REFERENCES public.commercial_changes (commercial_configuration_id, request_id) ON DELETE RESTRICT`.

Behavior: inserting a Component whose `commercial_change_id` identifies a Change belonging to a different Configuration fails with `23503`, naming that constraint. This is the exact state Decision 1 declares invalid.

Why declarative rather than a trigger. Both columns already exist on `commercial_components`, both are `NOT NULL`, and both are immutable, so there is no deferrability problem, no null-escape, and no update path to also cover. `MATCH SIMPLE` semantics are irrelevant here because neither column can be NULL. `ON DELETE RESTRICT` matches every other foreign key on the commercial tables. No `ON UPDATE` action, matching repository convention. Immediate, not deferrable: a Component is always inserted after both its Configuration and its Change exist, so deferral would buy nothing.

Immutability, verified rather than assumed: `commercial_changes` is insert-only under `fn_reject_update_delete`, and `fn_protect_commercial_component_lifecycle` permits only `effective_to`, `updated_at`, and `updated_by` to change, so both `commercial_configuration_id` and `commercial_change_id` on the Component are already frozen after insert.

### 13.3 Rule 2: a quantity Commitment's Component must share its Change's Configuration

Mechanism: **new `BEFORE INSERT FOR EACH ROW` trigger.**

- New function `public.fn_protect_commercial_commitment_scope()`, `plpgsql`, `SECURITY INVOKER`, `set search_path = pg_catalog`.
- New trigger `trg_commercial_commitments_protect_scope BEFORE INSERT ON public.commercial_commitments FOR EACH ROW`.
- `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`. No `service_role` grant, per the trigger-only convention.

**Why not declarative.** `commercial_commitments` has no `commercial_configuration_id` column, so there is no column pair to key a composite foreign key on. The declarative route would require adding one, which means: a new `NOT NULL` column on an insert-only immutable Finance table, a backfill of every existing row, a third composite foreign key binding that column to its Change's Configuration, and a change to the locked table shape in `docs/COMMERCIAL_DATABASE_DESIGN.md` §5.5. That is a denormalized duplicate of a fact already reachable in one join, added purely to enable a constraint mechanism. Rejected as overengineering.

**Why `BEFORE INSERT` alone is sufficient.** `fn_protect_commercial_commitment_lifecycle` permits only `effective_to`, `updated_at`, and `updated_by` to change on `commercial_commitments`, and its own comment records that `commercial_component_id`, `kind`, and `currency` are immutable. So `commercial_change_id` and `commercial_component_id` cannot change after insert, and there is no UPDATE path that could later violate the invariant. Covering UPDATE would add an unreachable branch.

**Exact behavior:**

1. Resolve the Change's Configuration: `commercial_configuration_id` from `public.commercial_changes` where `request_id = new.commercial_change_id`. If no row is found, `return new` unchanged and let the existing single-column foreign key raise `23503`. The trigger never duplicates a referential check the foreign key already owns.
2. If `new.kind` is not `'quantity'`, `return new`. Spend Commitments have no direct Component and are covered by Rule 3.
3. If `new.commercial_component_id` is NULL, `return new` and let `chk_commercial_commitments_kind_shape` raise. Row-level `BEFORE` triggers fire before `CHECK` constraints are evaluated, so the trigger must not assume the shape check has already run.
4. Resolve the Component's Configuration from `public.commercial_components` where `id = new.commercial_component_id`. If not found, `return new` and let the foreign key raise.
5. If the two Configuration values differ (`IS DISTINCT FROM`), raise. Prose message naming the table, the Commitment's Change, the Component, and both Configuration values.
6. Otherwise `return new`.

Steps 1, 3, and 4 are the deliberate non-duplication rule: the trigger raises only for the invariant it owns, and defers every referential and shape failure to the constraint that already owns it. Test B32 proves this.

### 13.4 Rule 3: every spend-Commitment member Component must share the Commitment's Configuration

Mechanism: **extension of the existing trigger function** `public.fn_protect_commitment_component_membership()`, via `CREATE OR REPLACE`.

No second trigger is added to `commercial_commitment_components`. The existing function already owns that table's membership integrity, already locks the parent `commercial_commitments` row `FOR UPDATE`, and already reads both the parent Commitment and the new Component. Adding the Configuration check there reuses all three and keeps one function owning one table's membership rules.

**Exact behavior after the change, with the new step in its locked position:**

1. Lock the parent Commitment: `select kind ... from public.commercial_commitments where id = new.commitment_id for update`. Unchanged. This lock is what makes the existing member-to-member currency comparison non-racy under concurrent first-member inserts, and it now also serializes the Configuration check.
2. If `kind` is not `'spend'`, raise the existing non-spend message. Unchanged.
3. **New.** Resolve the Commitment's Configuration by joining the Commitment to `public.commercial_changes` on `request_id = commercial_change_id`, and the new Component's `commercial_configuration_id` from `public.commercial_components`. If either resolves to no row, fall through without raising and let the existing foreign keys own it. If both resolve and differ, raise with a prose message naming the Commitment, the Component, and both Configuration values.
4. The existing member-to-member `transaction_currency` comparison. Unchanged.
5. `return new`.

**The new check is ordered before the currency check, and this ordering is locked.** A Configuration mismatch is the more fundamental violation, and same-Configuration membership makes currency agreement far more likely, so reporting currency first would frequently mask the real cause. Test B35 asserts the ordering by inserting a member that violates both and requiring the Configuration message.

`search_path = pg_catalog` is added in the same statement (§8.3). The body already schema-qualifies every table it touches, so name resolution is unchanged.

Existing behavior is fully preserved: the non-spend rejection and the currency-mismatch rejection both keep their current messages and their current positions relative to each other, and the parent `FOR UPDATE` lock that makes the first-member race safe is unchanged. Test B36 proves both rejections. Test B37 proves the function's OID, body, `proconfig`, and privilege posture.

### 13.5 Rule 4: a Configuration's Change must backlink to that exact Configuration

Mechanism: **composite foreign key**, reusing the `uq_commercial_changes_configuration_request` constraint added for Rule 1.

- `public.commercial_configurations` gains `fk_commercial_configurations_change_backlink FOREIGN KEY (id, commercial_change_id) REFERENCES public.commercial_changes (commercial_configuration_id, request_id) ON DELETE RESTRICT`.

Behavior: inserting a `commercial_configurations` row whose `commercial_change_id` identifies a Change whose `commercial_configuration_id` is not this Configuration fails with `23503`. P2-5's theoretically divergent pair becomes structurally impossible.

**Why this does not break the deliberately circular creation, verified step by step.** The constraint is ordinary and immediate, not deferrable. Inside `create_commercial_configuration_with_change`, at the moment `commercial_configurations` is inserted:

1. `commercial_changes` was already inserted in this same transaction with `commercial_configuration_id = p_new_commercial_configuration_id` and `request_id = p_request_id`. Its own foreign key to `commercial_configurations` is `DEFERRABLE INITIALLY DEFERRED`, so the not-yet-existing Configuration does not block that insert.
2. **Deferral of that foreign key does not defer index maintenance.** The row is physically present and the `uq_commercial_changes_configuration_request` index entry for `(p_new_commercial_configuration_id, p_request_id)` exists as soon as the insert completes.
3. The `commercial_configurations` insert supplies `(id, commercial_change_id) = (p_new_commercial_configuration_id, p_request_id)`, which is exactly that index entry. The immediate composite foreign key resolves successfully.

So no new deferral is needed and the existing deferred constraint is untouched. The circular pair still creates atomically.

**How this is proven, and the one thing a rollback-bound test does not do by itself.** Test B25 is the mandatory regression proof, and its shape is locked because the obvious shape would be silently vacuous.

The pre-existing foreign key `commercial_changes.commercial_configuration_id` is `DEFERRABLE INITIALLY DEFERRED`. PostgreSQL checks a deferred constraint at transaction commit. **A transaction that ends in `ROLLBACK` never reaches that check at all.** So a test that calls the RPC and then rolls back proves only the immediate half of the pair: that Rule 4's new composite foreign key resolves at insert time. It proves nothing whatsoever about the deferred half, while appearing to pass. That is exactly the class of test this design refuses to write.

**Locked resolution: B25 executes `SET CONSTRAINTS ALL IMMEDIATE` after the successful RPC call and before `ROLLBACK`.** That statement forces every deferred constraint in the transaction to be checked at that point rather than at commit. If the deferred circular foreign key is unsatisfied, `SET CONSTRAINTS ALL IMMEDIATE` raises `23503` there and then. If it is satisfied, the statement succeeds and the deferred half is genuinely discharged. The transaction then rolls back as normal.

No commit is required, and none is permitted. `SET CONSTRAINTS ALL IMMEDIATE` is the mechanism that makes a deferred constraint provable inside a rollback-bound test, and it is the only such mechanism. B25 must therefore prove all three of the following, in this order:

1. `create_commercial_configuration_with_change` succeeds end to end and returns a mutually consistent pair.
2. Rule 4's new **immediate** composite foreign key was satisfied at the moment `commercial_configurations` was inserted. Reaching step 1 at all establishes this, because an immediate foreign key failure would have aborted the insert.
3. `SET CONSTRAINTS ALL IMMEDIATE` completes without error, establishing that the pre-existing **deferred** circular foreign key is also satisfied. This is the assertion that a plain rollback would have skipped.

Then `ROLLBACK`.

**A benefit worth naming.** The composite foreign key makes the RPC's insert order structurally mandatory rather than merely conventional. Any future writer that inserts `commercial_configurations` before its `commercial_changes` row now fails at the database instead of producing a divergent pair.

### 13.6 Rule 5: supersession must stay within one Configuration

Adopted, per Decision 3a (§3.4).

Mechanism: **self-referencing composite foreign key**, using the `uq_commercial_components_configuration_id` constraint.

- `public.commercial_components` gains `fk_commercial_components_supersedes_within_configuration FOREIGN KEY (commercial_configuration_id, supersedes_component_id) REFERENCES public.commercial_components (commercial_configuration_id, id) ON DELETE RESTRICT`.

**Forks remain entirely unconstrained.** A foreign key constrains only what the referencing row may point at, never how many rows may point at the same target. Components B and C may both reference predecessor A. No uniqueness of any kind is added on `supersedes_component_id`, as Decision 3 requires. Test B27 proves a fork inserts successfully.

**NULL handling is exactly right by default.** `supersedes_component_id` is nullable and `commercial_configuration_id` is `NOT NULL`. Under `MATCH SIMPLE`, PostgreSQL's default, a composite foreign key is satisfied whenever any referencing column is NULL. So a Component with no predecessor passes with no check performed, which is the desired behavior and needs no special handling. Test B28 asserts it, because relying on `MATCH SIMPLE` semantics without proving them would be assuming a subtlety.

**Same-transaction predecessors still work.** Foreign keys are `AFTER ROW` constraint triggers fired at end of statement, so a single multi-row `INSERT` that supplies A before B and C succeeds, and separate statements succeed as long as A precedes them. A fork created in one transaction is unaffected.

**Rule 5 does not prohibit a self-edge, and is not asked to.** A row whose `supersedes_component_id` equals its own `id` satisfies this foreign key, because it references a row that exists (itself) in the same Configuration (its own). Prohibiting that shape is Rule 6's job, not this constraint's. The two are complementary and neither substitutes for the other. See §13.7.

### 13.7 Rule 6: a Component may not supersede itself

Adopted, per Decision 4 (§3.5). This is the final locked commercial semantics decision and the only rule in §13 added after the independent review.

Mechanism: **`CHECK` constraint.**

- `public.commercial_components` gains `chk_commercial_components_no_self_supersession CHECK (supersedes_component_id IS DISTINCT FROM id)`.

**Exact failure behavior.** Inserting or updating a `commercial_components` row where `supersedes_component_id = id` fails with `SQLSTATE 23514`, naming `chk_commercial_components_no_self_supersession`. The failure is immediate, at the offending statement, with no deferral. There is no trigger, no prose message, and no `P0001`: this is a declarative constraint and it reports as one.

**Why `IS DISTINCT FROM` rather than `<>`.** Both would pass a row with a NULL predecessor, but for different reasons, and only one of them is honest about it.

- `supersedes_component_id <> id` evaluates to **NULL** when `supersedes_component_id` is NULL. A `CHECK` constraint passes when its expression is NULL, so the row is accepted, but only as a side effect of SQL's three-valued-logic rule for `CHECK`. The constraint's behavior on the most common row shape in the table would depend on a subtlety rather than on the predicate.
- `supersedes_component_id IS DISTINCT FROM id` is a **total** predicate. It evaluates to TRUE or FALSE and never to NULL. With a NULL predecessor and a `NOT NULL` `id`, the two operands are genuinely distinct, so it evaluates to TRUE and the row is accepted because the predicate says so.

`IS DISTINCT FROM` is chosen so the constraint means exactly what it reads, on every row, with no reliance on NULL-passes-CHECK.

**NULL predecessor semantics are preserved, verified rather than assumed.**

| `supersedes_component_id` | `id` | `IS DISTINCT FROM` | Row |
|---|---|---|---|
| NULL | any (`NOT NULL`) | TRUE | **Accepted.** No predecessor, unchanged behavior. |
| some other Component's id | this id | TRUE | **Accepted.** Ordinary supersession, including forks. |
| this row's own id | this id | FALSE | **Rejected.** `23514`. |

`supersedes_component_id` stays nullable. Rule 6 adds no `NOT NULL`, no default, and no uniqueness.

**Forks are entirely unaffected.** Rule 6 is a single-row predicate. It reads two columns of the row being written and never looks at another row, so it cannot observe, count, or restrict how many Components reference the same predecessor. Component B and Component C may both supersede Component A after Rule 6 lands exactly as before. Test B27 proves the fork still inserts and test B29 proves the self-edge is rejected, in the same fixture, so the two facts are demonstrated side by side.

**Why a `CHECK` and not a trigger.** A `CHECK` states the invariant precisely, is enforced on `INSERT` and `UPDATE` automatically with no branch to write, and **validates every existing row at `ALTER TABLE` time**, which a `BEFORE INSERT` trigger cannot do. That last property matters: unlike Rules 2 and 3, Rule 6 is self-gating against existing data. It is nonetheless also gated by D4 (§14.1), so the migration author knows the answer before authoring rather than discovering it when the `ALTER TABLE` aborts.

**Why not `NOT VALID`.** Same reason as every other constraint in this design (§13.8). An invariant this design declares must hold from the moment it is declared.

**Immutability, so no `UPDATE` path can violate it later.** `fn_protect_commercial_component_lifecycle` permits only `effective_to`, `updated_at`, and `updated_by` to change, so neither `id` nor `supersedes_component_id` can move after insert. The `CHECK` covers `UPDATE` regardless, at no cost, because a `CHECK` is not opt-in per operation.

### 13.8 Migration-time validation and existing-row compatibility

| Object | Validates existing rows | Can fail on existing data |
|---|---|---|
| `uq_commercial_changes_configuration_request` | Yes, builds an index | **No.** `request_id` is already unique, so the pair cannot collide. |
| `uq_commercial_components_configuration_id` | Yes, builds an index | **No.** `id` is already unique. |
| `fk_commercial_components_change_within_configuration` (Rule 1) | Yes, immediately | **Yes.** Gated by D1. |
| `fk_commercial_configurations_change_backlink` (Rule 4) | Yes, immediately | **Yes.** Gated by D2. |
| `fk_commercial_components_supersedes_within_configuration` (Rule 5) | Yes, immediately | **Yes.** Gated by D3. |
| `chk_commercial_components_no_self_supersession` (Rule 6) | Yes, immediately | **Yes.** Gated by D4. |
| `trg_commercial_commitments_protect_scope` (Rule 2) | **No.** `BEFORE INSERT` only. | No, and that is the problem. Gated by D5. |
| `fn_protect_commitment_component_membership` extension (Rule 3) | **No.** `BEFORE INSERT` only. | No, and that is the problem. Gated by D6, D7. |

No constraint is added `NOT VALID`. An invariant this design declares must hold from the moment it is declared, and a `NOT VALID` constraint would record an invariant the data does not satisfy.

**The asymmetry is the important part, and it is a real risk.** The three composite foreign keys and the Rule 6 `CHECK` fail the migration loudly if any existing row violates them, so those four are self-gating. The two triggers validate nothing retroactively, so pre-existing violators of Rules 2 or 3 would survive Part B2 silently and the migration would report success. **D5, D6, and D7 are therefore hard human gates, not advisory reads.** They are the only control that exists for those two rules against existing data, and no SQL may be authored until all three return zero.

### 13.9 Mechanism decisions not taken, and why

- *CHECK constraint for Rules 1 through 5.* Impossible. Each of those five requires a cross-row lookup, which a `CHECK` cannot perform. Rule 6 is the exception that proves the boundary: it compares two columns of the same row, needs no lookup, and is therefore the one rule a `CHECK` can carry (§13.7).
- *Deferred constraint trigger for any rule.* Rejected. Nothing needs deferral: Rules 1, 2, 3, 5, and 6 all involve rows whose parents already exist at insert time or, for Rule 6, no other row at all, and Rule 4 is satisfied immediately by the RPC's existing insert order (§13.5). Adding deferrability would move failures to commit, where they are harder to attribute, for no benefit. The one genuinely deferred constraint in the commercial model is pre-existing and untouched (§13.5, §17.1).
- *RPC-only validation with no database backstop.* Rejected for all six rules. `commercial_components`, `commercial_commitments`, and both join tables have no atomic RPC at all today; application code inserts into them directly. An RPC-only rule would be enforced in zero code paths for five of the six rules.
- *Extending `fn_protect_commercial_component_lifecycle` for Rules 1, 5, or 6.* Rejected. All three are declaratively expressible, and a foreign key or `CHECK` states the invariant more precisely, is enforced on both `INSERT` and `UPDATE` automatically, and validates existing rows at `ALTER TABLE` time, which a trigger cannot do.
- *A uniqueness constraint of any kind on `supersedes_component_id` to express Rule 6.* Rejected and prohibited. Uniqueness would forbid forks, which Decision 3 explicitly allows. Rule 6 is a per-row identity predicate and must not be confused with a cardinality constraint (§3.5, §13.7).
- *A single combined trigger for Rules 2 and 3.* Rejected. They fire on two different tables, so one function would need two unrelated branches keyed on `TG_TABLE_NAME`, which is exactly the table-specific branching the repository's shared-function convention avoids.

## 14. Pre-apply gates

All queries are READ-ONLY. No DDL, no DML, no `TRUNCATE`. Every query returns a **count only**, except the structural captures in §14.2, which return catalog metadata and never row data. If detail is ever genuinely required, only fictional-safe identifiers may be surfaced, never business row contents, never customer names, never keys, never monetary values, never dates tied to a real relationship.

Gates are numbered in three separated classes, and the class determines what a result means. The old flat `E` series is retired: it mixed blocking gates, captures, and observations under one prefix, which made it possible to read a report-only observation as a blocker.

| Class | Prefix | Meaning | May block a migration |
|---|---|---|---|
| A. Blocking gates | **D** | A count or catalog value with a required result. A deviation stops authoring. | **Yes** |
| B. Structural captures | **G** | Pre-apply state recorded so a named post-apply test can compare against it. No required value. | No, but a missing capture blocks the test that needs it |
| C. Diagnostic reports | **R** | Observed and recorded on every run. Never asserted. | **Never** |

**No R-class observation may ever block a Nexus-owned remediation.** That rule exists because two of the three reports concern platform state Nexus does not own and cannot fix (§15).

No migration may be authored until every D gate that applies to it has been executed and returned its required value, and every G capture it depends on has been recorded.

### 14.1 Class A: blocking gates (D series)

**Part B2 data gates.** All seven require a count of exactly **0**. Each corresponds to an invariant Part B2 declares.

| ID | Rule | What it counts | Required |
|---|---|---|---|
| D1 | Rule 1 | `commercial_components` rows joined to their `commercial_changes` row where the Change's `commercial_configuration_id` differs from the Component's | 0 |
| D2 | Rule 4 | `commercial_configurations` rows joined to their `commercial_changes` row where the Change's `commercial_configuration_id` differs from the Configuration's own `id` | 0 |
| D3 | Rule 5 | `commercial_components` rows with a non-null `supersedes_component_id` joined to the predecessor where the predecessor's `commercial_configuration_id` differs | 0 |
| D4 | Rule 6 | `commercial_components` rows where `supersedes_component_id` is not distinct from `id`, that is, existing self-supersession | 0 |
| D5 | Rule 2 | `commercial_commitments` rows with `kind = 'quantity'` joined to their Change and to their Component where the Component's Configuration differs from the Change's | 0 |
| D6 | Rule 3 | `commercial_commitment_components` rows joined to the Commitment, its Change, and the member Component where the Component's Configuration differs from the Change's | 0 |
| D7 | Rule 3 precondition | `commercial_commitment_components` rows whose parent Commitment has `kind <> 'spend'` | 0 |

Consequence if any of D1 through D7 deviates: **Part B2 is blocked** and Migration B is split per §5.2. Part B1 is unaffected and proceeds.

D1 through D4 and D6 are self-gating in the sense that the corresponding constraint would abort the `ALTER TABLE` anyway. They are still run first, so the author learns the answer before authoring rather than from a failed apply. **D5, D6, and D7 are not self-gating at all**: Rules 2 and 3 are `BEFORE INSERT` triggers that validate nothing retroactively, so a violator would survive Part B2 silently while the migration reported success (§13.8). Those three are the only control that exists.

D4 is new with Decision 4 (§3.5). It must be written with `IS NOT DISTINCT FROM`, not `=`, so the predicate is total and the count cannot be quietly reduced by NULL comparison semantics. Rows with a NULL `supersedes_component_id` are correctly not counted, because a NULL predecessor is not a self-edge.

**Migration A gates.**

| ID | What it checks | Required |
|---|---|---|
| D8 | The narrowed ownership invariant of §15.2: count of Nexus-owned objects in schema `public` whose owner is not `postgres`, over the enumerated Nexus set (8 Platform Core tables, 13 M4-M8 tables, and the Nexus function inventory) | 0 offenders |
| D9 | Count of existing triggers in schema `public` named `trg_%_reject_truncate` | Exactly 4, the Platform Core set. Any other value means a name collision or a missing guard, and Migration A's `CREATE TRIGGER` statements would fail or duplicate |
| D10 | `has_table_privilege('service_role', <table>, 'TRUNCATE')` for each of the 13 | True for all 13, confirming P1-1. A false value means the schema has drifted since discovery and the finding must be re-established before Migration A is authored |

D8, D9, and D10 gate Migration A only. None of them gates Part B1 or Part B2.

### 14.2 Class B: structural captures (G series)

Each capture records pre-apply state that a named post-apply test compares against. A capture has no required value. What it must have is a recorded result: **if a G capture was not taken before apply, the test that depends on it cannot run and the corresponding contract is unproven.**

| ID | What it captures | Consumed by | Gates |
|---|---|---|---|
| G1 | The exact per-table privilege set `service_role` currently holds on each of the 13, as the locked expected matrix | Test A07 | Migration A |
| G2 | Count of `audit_log` rows with NULL `resource_id` for `table_name` in (`requests`, `commercial_configurations`, `commercial_changes`), one count per table. Establishes the documented size of the no-backfill gap | Test B13 | Part B1 |
| G3 | The current definitions of exactly three triggers: `trg_audit_requests`, `trg_audit_commercial_configurations`, `trg_audit_commercial_changes` | Test B12 | Part B1 |

**G3 in full, because it is the capture that guards against silent normalization.** Part B1 drops and recreates these three triggers for the sole purpose of adding a second `fn_audit_row()` argument (§11.8). A `DROP TRIGGER` destroys the evidence of what was there, so if any live trigger has drifted from its migration source, the recreation would silently normalize the drift away and every post-apply assertion would still pass. G3 exists so that cannot happen.

G3 records two things for each of the three triggers:

1. **The rendered definition**, from `pg_get_triggerdef(oid)`, recorded verbatim in the closeout so a human can diff before against after.
2. **The normalized structural tuple**, read from `pg_trigger` and `pg_class`: `tgname`, table, decoded timing, decoded level, decoded event set, `tgfoid`, `tgenabled`, `tgqual` (expected NULL), `tgattr` (expected empty), `tgisinternal`, `tgconstraint`, `tgdeferrable`, `tginitdeferred`, `tgnargs`, and `tgargs`.

Test B12 compares the post-apply structural tuple against G3 and requires every field to match **except** `tgnargs` and `tgargs`, which must differ in exactly the way §11.8 locks. Raw `pg_get_triggerdef()` text is deliberately not the automated comparison, because it is a rendering rather than a stable contract and would be brittle across PostgreSQL versions. It is captured for human review only.

If G3 reveals that any of the three triggers already differs from its migration source in any field other than the argument list, that is a schema-drift finding. Part B1 must not be authored until the drift is understood and the intended post-apply definition is re-locked in §11.8. **This is the one case in which a G capture halts authoring**, and it does so because the capture has revealed a fact, not because the capture itself is a gate.

### 14.3 Class C: diagnostic reports (R series)

Read and recorded on every pre-apply run and on every harness run. **None of these is ever asserted, and none may ever block a migration, a gate, or the M4-M8 closeout.**

| ID | What it reports | Why it is not a gate |
|---|---|---|
| R1 | Default ACL entries keyed to creator role `supabase_admin` in schema `public` | Nexus does not own that role and will not modify its defaults (§15.1). A gate with no available remediation is eventually ignored |
| R2 | Schema-wide scan: every non-extension-owned relation and function in schema `public` whose owner is not `postgres`, including objects outside the Nexus inventory | Supabase may legitimately create platform objects in `public` that Nexus neither owns nor may change. Blocking Migration A on one of those would stop Nexus-owned remediation for a reason unrelated to the 13 tables (§15.2) |
| R3 | **Harness-only, not a pre-apply read.** Optional two-session lock-semantics observation against one pre-existing `customers` row, identified by primary key only (§16.3, §16.4) | It depends on a suitable production row being present. A test that cannot run in every environment must never be able to fail the run. Skipped and reported as skipped when no such row exists |

If R2 reports an offender **inside** the Nexus inventory, that is D8's business and D8 will already have blocked. R2's only unique contribution is visibility into objects outside that inventory, which is information, not a gate.

### 14.4 Gate inventory summary

| Class | IDs | Count | Blocking |
|---|---|---|---|
| A. Blocking gates | D1 through D10 | 10 | Yes |
| B. Structural captures | G1, G2, G3 | 3 | No (but required for their tests) |
| C. Diagnostic reports | R1, R2, R3 | 3 | Never |
| **Total** | | **16** | |

Of the 16, exactly 10 can stop work, and all 10 concern state Nexus owns and can remediate.

Which migration each gate applies to:

| Target | Blocking gates | Required captures |
|---|---|---|
| Migration A | D8, D9, D10 | G1 |
| Part B1 | none | G2, G3 |
| Part B2 | D1 through D7 | none |

Part B1 has no blocking data gate at all. That is the structural fact that makes the §5.2 split sound: nothing in the existing commercial data can make B1 unsafe to apply.

### 14.5 Query construction rules

- **D series: counts only.** `select count(*)` with no row output. D9 and D10 return catalog counts and booleans, never table data.
- **G series: catalog metadata only.** G1 and G3 read `pg_class`, `pg_proc`, `pg_trigger`, and privilege functions. G2 returns three counts. No G capture reads a business column of any table.
- **R series: catalog metadata only.** Object names and owner names, never table data.
- No `select *` against any commercial table, in any class.
- No column that could carry business content appears in any output: not `key`, `name`, `relationship_note`, `reason`, `threshold_value`, `currency`, `pricing_rule_parameters`, `effective_from`, `effective_to`, `raw_data`, `effective_data`.
- Each query is a single statement, run read-only, with no temporary object created.
- Results are recorded in the M4-M8 closeout document with the query text, so every gate is reproducible. D results are recorded as values, G results as the captured structure, R results as observations explicitly labelled non-blocking.

## 15. Supabase platform-boundary and ownership assertion

### 15.1 Position on `supabase_admin`

`supabase_admin` default ACLs are **not modified**. That platform role is outside Nexus ownership. Modifying its defaults would be Nexus reaching into platform configuration it does not own and cannot be responsible for maintaining across Supabase platform changes.

P2-6 is therefore closed by verification, not by remediation.

### 15.2 Invariant selection: the hard gate is the Nexus-owned set, not the whole schema

Three candidate invariants were considered. Only one is used as a blocking gate.

**Candidate 1, rejected as a gate: "everything in schema `public` is owned by `postgres`."** Too broad. Schema `public` in a Supabase project can legitimately contain objects Nexus did not create, including extension-owned objects, and asserting `postgres` ownership over all of them would produce a permanently red gate that Nexus cannot fix.

**Candidate 2, rejected as a gate: "every non-extension-owned relation and function in schema `public` is owned by `postgres`."** This was the earlier draft's locked invariant. Excluding extension members via `pg_depend deptype = 'e'` is a real improvement over Candidate 1, and it is retained as a **diagnostic** (report R2). It is rejected as a **blocking gate** for one concrete reason: extension membership is not the only way a platform object can appear in `public`. Supabase may create an object there that is neither an extension member nor owned by `postgres`, and §15.1 has already committed Nexus to not touching platform-owned objects. Under Candidate 2 such an object would make the gate nonzero and **block Migration A**, halting Nexus-owned P1 remediation for a reason that has nothing to do with the 13 tables and that Nexus has no permission to fix. That is precisely the unfixable-gate failure mode §15.4 rejects elsewhere in this section, applied inconsistently.

**Candidate 3, locked as the hard gate: the Nexus-owned object set.**

> Every relation and every function that Nexus itself created in schema `public` must have owner `postgres`.

The set is defined by Nexus's own migration inventory, which is a known, enumerable, version-controlled fact rather than a guess about what Supabase might create:

| In-scope group | Members |
|---|---|
| Platform Core tables | The 8 tables of M1-M3: `app_users`, `resource_types`, `resources`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_log` |
| M4-M8 tables | The 13 tables of §2.1 |
| Nexus functions | Every function created by Migrations 1 through 8, the Foundation RPC Privilege Hardening migration, and the Platform Core Integrity Hardening migration, regardless of `prosecdef` |
| Objects owned by the above | Indexes, sequences, and constraints belonging to the 21 tables, which in PostgreSQL always share their table's owner |

Staleness is the known weakness of any enumerated list, and it is handled rather than ignored: **R2 is the anti-staleness control.** R2 scans the whole schema on every run and reports any non-extension-owned object not owned by `postgres`, including objects the Nexus inventory does not list. A future Nexus table accidentally omitted from the D8 inventory still surfaces in R2's output, where a human sees it. The difference is that R2 informs and D8 blocks, which is the correct division for a set Nexus controls versus a schema it shares.

### 15.3 Why ownership of the Nexus set is a precondition of the whole of Part A

This is the reason the gate belongs in Migration A's blocking set rather than in a general hygiene list.

Migration A's privilege layer consists of one statement: `REVOKE TRUNCATE ... FROM service_role`. That statement is sufficient only because the tables are owned by `postgres` and `service_role` is not `postgres` and does not inherit from it. If any of the 13 tables were owned by some other role, that owner would hold `TRUNCATE` by virtue of ownership, entirely outside the revoke's reach. The trigger layer would still fire, so the permanence contract would hold, but the two-layer control would silently degrade to one layer, which is exactly the single-layer condition the whole retrospective exists to eliminate.

Note precisely what this argument does and does not require. It requires that **the 21 Nexus tables** are owned by `postgres`. It says nothing at all about an unrelated platform object elsewhere in `public`. Scoping the gate to what the argument actually needs is the correction Candidate 3 makes.

The gate runs as D8 before apply and as test A10 after apply.

### 15.4 The assertions, and which of them can block

| # | Assertion | Class | Runs as | Can block |
|---|---|---|---|---|
| 1 | Every object in the Nexus-owned set (§15.2, Candidate 3) has owner `postgres`. Required: 0 offenders. Catalog sources: `pg_class`, `pg_proc`, `pg_namespace`, `pg_roles` | Blocking gate | D8 pre-apply, test A10 post-apply | **Yes** |
| 2 | No `pg_default_acl` entry keyed to creator role `postgres` and schema `public` grants `TRUNCATE` to `service_role`, and the entry retains its intended non-`TRUNCATE` privileges for `service_role`. Required: 0 offending grants, intended set intact | Blocking gate | Test A09 post-apply | **Yes** |
| 3 | Default ACL entries keyed to creator role `supabase_admin` in schema `public`, observed | Diagnostic report | R1 | **Never** |
| 4 | Schema-wide scan of non-extension-owned objects in `public` not owned by `postgres`, including objects outside the Nexus inventory | Diagnostic report | R2 | **Never** |

Assertion 2 is the recurrence path the Platform Core hardening closed; the standing gate keeps it closed. It is Nexus-owned state, created by a Nexus migration, so it is legitimately blocking.

Assertions 3 and 4 are reports rather than tests because gating on state Nexus cannot change would produce a failing gate with no available remediation, and a gate that cannot be fixed is eventually ignored. Reporting keeps the observation visible on every run, which is the actual goal. If a `supabase_admin` default ever begins granting `TRUNCATE` to `service_role` for objects it creates, R1 surfaces it and the response is a Nexus-side decision recorded at that time, not a silent privilege change made in advance. Both are excluded from the official test count and from the pass/fail total.

**No `supabase_admin` ownership or default privilege is modified by any migration in this design.** Observed, reported, never touched.

### 15.5 Future runtime gate contract

All four assertions are read-only, single-statement, safe to execute against production on any connection with catalog read access. They require no fixture, no transaction, no rollback, and no elevated role. They are designed to be executed by any future runtime gate unchanged, and to be re-executed on every subsequent migration's harness, not only this one.

When a future migration adds a Nexus table or function, it extends Assertion 1's inventory in the same change. R2 is the backstop that surfaces the omission if it does not.

## 16. Runtime proof design

No runtime SQL is authored here. This section locks what must be proven, the exact test inventory, and the harness boundaries.

### 16.1 Harness-wide boundaries, locked

- **No `TRUNCATE` against any of the 10 foreign-key-referenced tables, in any form, ever.** Only `submission_revisions`, `commercial_component_capabilities`, and `commercial_commitment_components` may appear in a `TRUNCATE` statement.
- **No `CASCADE`.** No `TRUNCATE ... CASCADE` is executed anywhere. Test A18 asserts the harness's own SQL text contains no `CASCADE` token in any `TRUNCATE` statement.
- **No commit.** Every test runs inside its own transaction and ends in `ROLLBACK`. No test commits fixture data.
- **No test may depend on a committed fixture.** A test whose contract can only be demonstrated by committing a row it creates is not written. If the contract cannot be proven without a commit, it is proven structurally from the catalog instead, and the substitution is stated openly (§16.4). This rule is what disqualified the earlier two-session concurrency test.
- **No test may depend on a specific production row existing.** A test that reads pre-existing data must degrade to a skipped, reported observation when no suitable row is present, and must never be an official counted test.
- **A test that can pass while proving nothing is a defect, not a test.** Two specific traps are named and closed: a rollback-bound transaction never checks a deferred constraint (closed by B25, §13.5), and an uncommitted fixture is invisible to a second session (closed by B19, §16.4).
- **No DDL against any of the 13 tables.** Fictional relations created for function-level behavioral proofs are created and dropped inside a rolled-back transaction.
- **All fixture data is fictional**, per the public-repository rule.
- **Fresh connection for the residue pass**, so no transaction-local state can mask leftover rows.
- **Sentinel conditions that abort the harness**: any observed `COMMIT`; any `TRUNCATE` naming a table outside the three-table direct set; any `CASCADE` token; any row-count change in any of the 13 tables between the start and end of the run; any new row in `audit_log` at the end of the run.
- **Artifact identity**: SHA-256 of the harness SQL and runner script recorded immediately before and immediately after the successful run, both matching, following the M1-M3 closeout precedent, since `.runtime-tests` is gitignored.

### 16.2 Migration A official test inventory

**20 official tests**, plus two report lines that are deliberately not counted. The count is recalculated from the contracts below, not carried over from an earlier draft. A16 is new, added because the `form_definitions` selective-DELETE contract was previously asserted by argument only.

| ID | Proves |
|---|---|
| A01 | `fn_reject_truncate()` is unmodified: `prosrc` matches the locked canonical constant exactly, `proconfig` pins `search_path = pg_catalog`, `prosecdef` false, and it is a single function OID. The premise of the A17 composite transfer. |
| A02 | Exactly 17 triggers in schema `public` reference `fn_reject_truncate()`. No extras, no omissions. |
| A03 | For each of the 13: correct table, `tgtype` encodes `BEFORE` plus `TRUNCATE` plus `STATEMENT`, `tgenabled = 'O'`, `tgnargs = 0`, `tgfoid` equals the `fn_reject_truncate()` OID. |
| A04 | The 4 Platform Core M1-M3 triggers are still present, still enabled, still bound to the same function OID. M1-M3 guards intact. |
| A05 | `has_table_privilege('service_role', <table>, 'TRUNCATE')` is false for all 13. Asserted from the catalog, never by attempting the statement. |
| A06 | The same is still false for all 8 Platform Core tables. No regression. |
| A07 | Non-`TRUNCATE` privileges preserved: for each of the 13, `service_role`'s privilege set equals the **G1** pre-apply matrix minus `TRUNCATE`, compared as an exact set, not spot-checked. |
| A08 | `anon` and `authenticated` hold zero privileges on all 13. |
| A09 | Assertion 2 of §15.4: the `postgres`/`public` default ACL grants no `TRUNCATE` to `service_role` and retains its intended non-`TRUNCATE` privileges. Recurrence path still closed. |
| A10 | Assertion 1 of §15.4, narrowed: every object in the Nexus-owned set (8 Platform Core tables, 13 M4-M8 tables, Nexus function inventory) has owner `postgres`. The precondition of A05 and A07. Scoped to the Nexus set, not the whole schema, so an unrelated platform object cannot fail it. |
| A11 | RLS unchanged on all 13: `relrowsecurity` true, `relforcerowsecurity` false, zero policies. |
| A12 | **Direct destructive proof, `submission_revisions`.** As owner, in a transaction: `TRUNCATE public.submission_revisions` raises `P0001` with the guard's message. `ROLLBACK`. |
| A13 | **Direct destructive proof, `commercial_component_capabilities`.** Same shape. |
| A14 | **Direct destructive proof, `commercial_commitment_components`.** Same shape. |
| A15 | **Privilege-layer proof.** As `service_role`, `TRUNCATE public.submission_revisions` raises `42501`, proving the privilege layer denies before the trigger layer is reached. One table suffices because A05 establishes the privilege state for all 13 from the catalog. `ROLLBACK`. |
| A16 | **`form_definitions` selective DELETE still permitted.** New. In one transaction: insert a fictional Form Definition, confirm it has zero `form_versions` rows, `DELETE` it by `id`, assert exactly one row was deleted and no exception was raised. `ROLLBACK`. Proves that attaching `trg_form_definitions_reject_truncate` did not alter the locked selective-DELETE contract (§9.2, §17.1). No production row is touched: the row deleted is the fictional row this test created moments earlier. |
| A17 | **Composite attestation for the 10 foreign-key-referenced tables.** Names all 10 tables and the four supporting tests (A01, A03, A05, and A12 through A14), and asserts the conjunction. No `TRUNCATE` is issued. Mirrors the M1-M3 `resources` precedent. |
| A18 | Harness self-check: no `CASCADE` token appears in any `TRUNCATE` statement in the harness SQL, and no `TRUNCATE` names a table outside the three-table direct set. |
| A19 | Production preservation: row counts of all 13 tables identical before and after the entire run. |
| A20 | Zero residue on a fresh connection: no fixture rows in any of the 13 tables, no leftover fictional relation, no leftover trigger, no leftover function, and every test transaction confirmed rolled back. |

| Report | Content |
|---|---|
| R1 | `supabase_admin` default ACL entries for schema `public`, observed. Never asserted, never counted (§15.4). |
| R2 | Schema-wide non-extension ownership scan, including objects outside the Nexus inventory. Diagnostic only, never counted, never blocking (§15.2). |

**Migration A official total: 20** (A01 through A20, contiguous, no gaps). R1 and R2 are reports.

**A16 pairs with A12 through A14 to state the full `form_definitions` contract by execution.** A12 through A14 prove that `TRUNCATE` is rejected on the three tables where a direct proof is safe, and A17 transfers that to `form_definitions`. A16 proves the other half: that the operation the business rule still permits still works. The two together establish "TRUNCATE prohibited, selective DELETE of an unused Form Definition permitted" as a demonstrated fact rather than a claim about trigger semantics.

### 16.3 Migration B official test inventory

**40 official tests.** Recalculated, not carried over. Tests B15, B17, and B33 each carry enumerated sub-assertions counted as one official test, so the total is not inflated by counting variations of one contract separately.

Tests are grouped by part, so the inventory splits cleanly if §5.2's conditional rule fires. **Part B1 owns B01 through B21. Part B2 owns B22 through B37. B38 through B40 are migration-wide and run with whichever part lands, then again after the second.**

**Part B1, audit resource linkage (B01 through B13)**

| ID | Proves |
|---|---|
| B01 | `fn_audit_row()` OID unchanged from pre-apply, so `CREATE OR REPLACE` preserved it. Still `SECURITY DEFINER`, still pins `search_path = pg_catalog`, same owner. `EXECUTE` still false for `PUBLIC`, `anon`, `authenticated`. |
| B02 | **Old one-argument callers still work.** The exact set of triggers with `tgfoid = fn_audit_row` and `tgnargs = 1` matches the §11.4 table of 13, plus behavioral proof on two of them: a non-Resource-backed table (`customers`) still writes `resource_id` NULL, and a Resource-backed one-argument table (`form_versions`, argument `'resource_id'`) still writes the row's `resource_id`. |
| B03 | Argument-count contract: a fictional relation with a zero-argument `fn_audit_row()` trigger raises, and a three-argument one raises. Rollback-bound. |
| B04 | **Missing named column is loud.** A fictional relation with `fn_audit_row('id', 'not_a_column')` raises `P0001` on `INSERT` (§11.5). Rollback-bound. |
| B05 | An empty-string second argument is treated as omitted and resolves to `resource_id`, matching `fn_assert_resource_type()`. Rollback-bound. |
| B06 | **NULL resource value is silent.** A fictional relation with a two-argument trigger naming a nullable column holding NULL writes `audit_log` with `resource_id` NULL and raises nothing (§11.5). Rollback-bound. |
| B07 | **Non-UUID resource value fails `22P02`.** A fictional relation with a two-argument trigger naming a text column holding a non-UUID value aborts the write at the cast, not swallowed, not coerced (§11.5). Rollback-bound. |
| B08 | **Unregistered UUID fails `23503` at the `audit_log` foreign key.** A fictional relation with a two-argument trigger naming a column holding a well-formed UUID absent from `resources` aborts the write at `audit_log.resource_id`'s foreign key. Proves the foreign key is intact and exercised, and that the design does not weaken it (§11.6). Rollback-bound. |
| B09 | `requests`: an insert writes `audit_log` with `resource_id` non-NULL, equal to `requests.id`, and equal to `row_id`. |
| B10 | `commercial_configurations`: an insert writes `resource_id` non-NULL, equal to `id`, equal to `row_id`. |
| B11 | `commercial_changes`: an insert writes `resource_id` non-NULL, equal to `request_id`, equal to `row_id`, and the referenced `resources` row has `resource_type = 'request'` (§11.9). |
| B12 | **Trigger recreation equivalence.** For each of the three recreated triggers, the post-apply normalized structural tuple matches the **G3** pre-apply capture on every field (name, table, timing, level, event set, `tgfoid`, `tgenabled`, `tgqual`, `tgattr`, constraint and deferrability fields) and differs **only** in `tgnargs` and `tgargs`, which equal the values locked in §11.8. Proves the recreation normalized nothing away. |
| B13 | **No historical backfill occurred.** The count of `audit_log` rows with NULL `resource_id` for the three `table_name` values equals the **G2** pre-apply capture exactly, per table. |

**Part B1, commercial RPC contract (B14 through B21)**

| ID | Proves |
|---|---|
| B14 | **Idempotent replay.** Two sequential calls with an identical parameter tuple in one transaction return the same pair, create no second Configuration, Change, or `resources` row, and write `audit_log` rows only for the first call. Single transaction, rollback-bound, no commit needed because the first call's rows are visible to the second within the same transaction. |
| B15 | **Conflicting replay rejected.** Five sub-assertions, one per §12.5 identity field (configuration id, customer id, key, effective date, actor), each raising `CONFIGURATION_CHANGE_CONFLICT`. Counted as one test. |
| B16 | **Cosmetic-difference replay accepted.** A replay differing only in `p_name`, `p_relationship_note`, `p_reason`, `p_audit_request_id`, or `p_actor_context` returns the existing pair without error and without modifying it. |
| B17 | Named conflicts: `CUSTOMER_NOT_FOUND`, `CUSTOMER_INACTIVE`, `REQUEST_NOT_FOUND`, `REQUEST_INACTIVE`, `CONFIGURATION_KEY_CONFLICT`, `CONFIGURATION_ID_CONFLICT`, each raised by its exact designed condition, each asserted by token. Six sub-assertions counted as one test. |
| B18 | **Customer reactivation restores eligibility.** In one transaction: create a fictional Customer with `is_active = false`, call the RPC and assert `CUSTOMER_INACTIVE`; update the same Customer to `is_active = true`; call the RPC again and assert it succeeds. Proves `CUSTOMER_INACTIVE` reads the flag without constraining it and that the rule is not a one-way consequence (§12.8, §17.1). `ROLLBACK`. |
| B19 | **Serialization anchor, proven structurally.** From the deployed function definition in `pg_proc.prosrc`, assert that `create_commercial_configuration_with_change` contains a `SELECT ... FOR UPDATE` against `public.customers` keyed on `p_customer_id` and a `SELECT ... FOR UPDATE` against `public.requests` keyed on `p_request_id`, that both are present exactly once, and that the `customers` lock textually precedes the `requests` lock. Also assert the body contains no `NOWAIT`, no `SKIP LOCKED`, no `LOCK TABLE`, no advisory lock, and no `EXCEPTION` block. Creates nothing, commits nothing, depends on no pre-existing row. See §16.4. |
| B20 | **No partial state.** Force `CONFIGURATION_KEY_CONFLICT` and assert zero rows landed in `commercial_changes`, `resources`, and `commercial_configurations`. |
| B21 | RPC signature and privilege contract unchanged: same OID, identical parameter list and return type, `SECURITY INVOKER`, `EXECUTE` false for `PUBLIC`, `anon`, `authenticated`, true for `service_role`. |

**Part B2, commercial cross-parent integrity (B22 through B37)**

| ID | Proves |
|---|---|
| B22 | Rule 1 rejection: a Component whose `commercial_change_id` belongs to a different Configuration fails `23503` on `fk_commercial_components_change_within_configuration`. |
| B23 | Rule 1 acceptance: a same-Configuration Component inserts successfully. |
| B24 | Rule 4 rejection: a `commercial_configurations` row whose `commercial_change_id` belongs to a different Configuration fails `23503`. Exercised by direct insert, since the RPC is correct by construction. |
| B25 | **Circular creation regression, with the deferred constraint explicitly forced.** `create_commercial_configuration_with_change` succeeds end to end and returns a mutually consistent pair, proving Rule 4's new immediate composite foreign key resolved at insert. Then **`SET CONSTRAINTS ALL IMMEDIATE`** is executed and must complete without error, proving the pre-existing `DEFERRABLE INITIALLY DEFERRED` circular foreign key is also satisfied. Then `ROLLBACK`. The forced check is mandatory: a plain rollback never evaluates a deferred constraint, so without it the deferred half would be unproven while the test appeared to pass (§13.5). No commit. |
| B26 | Rule 5 rejection: a Component whose `supersedes_component_id` is in a different Configuration fails `23503` on `fk_commercial_components_supersedes_within_configuration`. |
| B27 | **Fork acceptance, unchanged by Rule 6.** Two distinct Components both superseding the same predecessor, all in one Configuration, both insert successfully. Proves Decision 3 is preserved, that no uniqueness was introduced on `supersedes_component_id`, and that Rule 6 did not restrict fork cardinality. |
| B28 | **NULL predecessor acceptance.** A Component with `supersedes_component_id` NULL inserts successfully. Two named assertions on one row: the Rule 5 composite foreign key is satisfied by `MATCH SIMPLE` null-escape, and the Rule 6 `CHECK` evaluates to TRUE rather than NULL because `IS DISTINCT FROM` is a total predicate (§13.7). Both are proven rather than assumed. |
| B29 | **Rule 6 self-supersession rejection.** Inserting a `commercial_components` row whose `supersedes_component_id` equals its own `id` fails `23514`, naming `chk_commercial_components_no_self_supersession`. Run in the same fixture as B27 so the fork and the self-edge are demonstrated side by side. |
| B30 | Rule 2 rejection: a quantity Commitment whose Component is in a Configuration other than its Change's raises `P0001` from `trg_commercial_commitments_protect_scope`. |
| B31 | Rule 2 acceptance: a same-Configuration quantity Commitment inserts successfully. |
| B32 | **Rule 2 non-duplication.** A quantity Commitment with a nonexistent `commercial_change_id` raises `23503` from the existing foreign key, not `P0001` from the new trigger. Proves the trigger does not usurp referential checks (§13.3 steps 1, 3, 4). |
| B33 | Rule 3 rejection: a spend-Commitment member Component from a different Configuration raises `P0001` from `fn_protect_commitment_component_membership`. |
| B34 | Rule 3 acceptance: same-Configuration members insert successfully, including a second member added after the first, proving the existing first-member lock path still functions. |
| B35 | **Rule 3 check ordering.** A member violating both Configuration and currency raises the Configuration message, not the currency message. Proves the locked ordering in §13.4. |
| B36 | Rule 3 existing behavior preserved: a quantity Commitment attaching through the join table is still rejected with the original non-spend message, and a same-Configuration currency mismatch is still rejected with the original currency message. |
| B37 | `fn_protect_commitment_component_membership()`: OID unchanged, `prosrc` matches the new canonical body, `proconfig` now pins `search_path = pg_catalog`, `prosecdef` false, `EXECUTE` still revoked from `PUBLIC`, `anon`, `authenticated`. Also asserts this is the **only** function whose `proconfig` changed in Migration B (§8.3). |

**Migration-wide (B38 through B40)**

| ID | Proves |
|---|---|
| B38 | **Privilege contract unchanged by B.** No privilege on any of the 13 tables changed from the post-Migration-A state, and `service_role` `TRUNCATE` is still false on all 13, proving Migration B did not regrant what Migration A revoked. |
| B39 | RLS unchanged by B on all 13: `relrowsecurity` true, `relforcerowsecurity` false, zero policies. |
| B40 | Zero residue on a fresh connection: no fixture Customers, Requests, Form Definitions, Form Versions, Configurations, Changes, Components, Commitments, or memberships; no fixture `resources` rows; no leftover fictional relation, trigger, or function; and `audit_log` row count identical to pre-run. |

| Report | Content |
|---|---|
| R3 | **Optional, harness-only, never counted.** Two-session lock-semantics observation. Runs only if a suitable pre-existing `customers` row is present, identified by its primary key alone with no business column read or recorded. Session 1 takes `SELECT ... FOR UPDATE` on that row, session 2 attempts the same and is observed waiting in `pg_locks`, session 1 rolls back, session 2 acquires and rolls back. Neither session calls the RPC, creates a row, or commits. **Skipped and reported as skipped when no suitable row exists.** The harness never fails because R3 could not run. |

**Migration B official total: 40** (B01 through B40, contiguous, no gaps). R3 is a report.

**Combined official total across A and B: 60.** Migration A 20, Migration B 40. Reports R1, R2, R3 are excluded from both counts and from the pass/fail total.

If §5.2's conditional split fires: Part B1 runs B01 through B21 plus B38 through B40, which is **24 official tests**. Part B2 later runs B22 through B37 plus B38 through B40 again, which is **19 official tests**. The union is still the full 40 distinct contracts.

### 16.4 The two tests that needed redesign, stated openly

Both redesigns exist because the original shape could have **passed while proving nothing**. That failure mode is worse than a missing test, because a missing test is visible.

**B19, the serialization anchor.** The original design proposed a live two-session blocking test: session 1 begins, calls the RPC without committing, and session 2 calls it with the same tuple and is observed blocked on the `customers` row lock.

That test cannot work. For session 2 to block on the `customers` row, session 2 must be able to **see** that row, which means the Customer fixture must be **committed**. An uncommitted fictional Customer created by session 1 is invisible to session 2, which would therefore not block at all: it would raise `CUSTOMER_NOT_FOUND` and the test would record a pass for a code path it never reached. The same applies to the Request fixture and its whole `resources`, `form_versions`, `form_definitions` chain.

Committing the fixture instead is not available. A committed fictional `customers` row cannot be removed afterwards: `fn_protect_customer_lifecycle` rejects `DELETE` unconditionally and Migration A has just blocked `TRUNCATE`. The test would permanently pollute the database with a fictional Customer, violating the zero-residue boundary that the same section claims to enforce.

**Resolution, locked. The proof is split, and neither half needs a commit or a fixture.**

- **Structure is proven statically.** B19 asserts from `pg_proc.prosrc` that the deployed function takes `SELECT ... FOR UPDATE` on `public.customers` and then on `public.requests`, in that order, once each, with no `NOWAIT`, `SKIP LOCKED`, `LOCK TABLE`, advisory lock, or `EXCEPTION` block. This is the contract §12.2 and §12.3 actually claim: that the function establishes those two anchors in that sequence. It is an official test because it is deterministic, environment-independent, and creates nothing.
- **Semantics are observed, not asserted.** R3 optionally demonstrates that a `SELECT ... FOR UPDATE` on an already-committed `customers` row blocks a second session, using only a pre-existing row identified by primary key, with no RPC call and no fixture. It is a report, never counted, and skipped without failure when no suitable row exists, so **the harness never depends on production rows existing**.
- **Replay semantics are proven separately and fully.** B14 exercises the real replay branch inside a single transaction, because the first call's rows are visible to the second call in that same transaction. That is the branch under test, and it needs no second session at all.

What is consciously given up: a live end-to-end demonstration that two concurrent callers of this specific RPC serialize correctly. What is kept: proof that the locks exist, in the right order, with the right modifiers, and proof that `FOR UPDATE` on a committed row blocks when the environment permits observing it. The gap is stated rather than papered over with a test that would have passed vacuously.

**B25, the circular creation regression.** The original design asserted that the deferred circular foreign key was "satisfied at commit" in a test that ends in `ROLLBACK`. A transaction that rolls back never reaches the commit-time check, so that half of the assertion was unreachable. B25 now executes `SET CONSTRAINTS ALL IMMEDIATE` before `ROLLBACK`, which forces the deferred check to happen at a point the test can observe. Full reasoning in §13.5. No commit is required and none is permitted.

### 16.5 What is deliberately not proven by execution

- TRUNCATE behavior on the 10 foreign-key-referenced tables. Proven as a composite (A17). Reason in §9.3.
- Whether PostgreSQL evaluates the foreign-key TRUNCATE check before or after `BEFORE TRUNCATE` triggers. Deliberately not relied on and therefore not tested.
- `supabase_admin` default ACL state. Reported (R1), not asserted (§15.4).
- Ownership of objects in `public` outside the Nexus inventory. Reported (R2), not asserted (§15.2).
- Live two-session serialization of the RPC itself. Structure proven by B19, semantics observed by R3 when the environment allows. Reason in §16.4.
- Rules 2 and 3 against pre-existing rows. Not testable by the triggers, which is why D5, D6, and D7 are hard gates (§13.8, §14.1).

## 17. Explicit do-not-change list

Carried forward from the discovery's validated no-change items, plus the items this design newly confirms. Every line below is a locked no-change for Migrations A, B, and C.

### 17.1 Carried forward from discovery, validated

| Item | Locked posture |
|---|---|
| M4-M8 foreign-key referential actions | Unchanged. No `ON DELETE` or `ON UPDATE` action on any existing M4-M8 foreign key is altered. The only additions are three new composite foreign keys, each `ON DELETE RESTRICT` with no `ON UPDATE` action, matching the surrounding convention, plus one `CHECK` constraint (Rule 6), which carries no referential action at all. |
| The deferred commercial circular foreign key | `commercial_changes.commercial_configuration_id` stays `DEFERRABLE INITIALLY DEFERRED` with `NO ACTION`. Not made immediate, not made `RESTRICT`, not dropped, not re-added. Rule 4's new composite foreign key is separate, immediate, and does not touch it (§13.5). |
| SECURITY INVOKER RPC posture | Unchanged on every Foundation RPC, including the rewritten `create_commercial_configuration_with_change` (§12.10). No RPC becomes `SECURITY DEFINER`. |
| SECURITY DEFINER audit function posture | `fn_audit_row()` stays `SECURITY DEFINER` with `search_path = pg_catalog`. Migration 1's privilege-escalation and dynamic-SQL review continues to hold unchanged under the two-argument contract (§11.3). |
| Submission payload exclusion from `audit_log` | Unchanged. `submission_revisions` keeps its narrow dedicated audit strategy and `raw_data` / `effective_data` are never written to `audit_log`. Nothing in §11 alters what any trigger captures, only which Resource it links to. |
| Narrow `form_versions` audit strategy | Unchanged. Both split triggers (`trg_audit_form_versions_insert` and the `WHEN (old.status is distinct from new.status)` lifecycle trigger) keep their current definitions and their single `'resource_id'` argument. Neither is recreated. |
| No audit triggers on commercial join tables | Unchanged. `commercial_component_capabilities` and `commercial_commitment_components` gain no audit trigger. Their intrinsic `created_at` / `created_by` remains the complete history. |
| `form_definitions` selective DELETE rule | Unchanged and deliberately preserved. Deleting an unused Form Definition with zero versions stays permitted. The statement-level TRUNCATE guard is invisible to `DELETE` and cannot block it (§9.2). **Proven by execution in test A16**, not by argument alone. |
| RLS enabled, not forced, zero policies | Unchanged on all 13 tables. Asserted by tests A11 and B39. |
| Commercial component overlap freedom | Unchanged. No exclusion constraint and no overlap-prevention rule is added. Multiple simultaneous Components for the same capability scope remain permitted; overlap stays a domain-service judgment. |
| `customers.is_active` reversible | Unchanged. Both directions stay permitted by `fn_protect_customer_lifecycle`. §12.8's `CUSTOMER_INACTIVE` check reads the flag; it does not constrain the flag. |
| Commercial configuration and capability status one-way | Unchanged. `commercial_configurations.is_active` stays one-way (true to false). `capabilities.status` and `measurement_definitions.status` stay one-way (active to deprecated). |
| Current `postgres` / `public` default ACL | Unchanged. The `TRUNCATE` removal already applied by the Platform Core hardening is not re-issued, and the seven intended non-`TRUNCATE` privileges are preserved (§6.4). Asserted by test A09. |
| `fn_reject_truncate()` body | Unchanged, byte for byte. It is a canonical gated contract and the premise of the A17 composite transfer (§6.2). Asserted by test A01. |
| Resource type seed behavior | Unchanged. No new `resource_types` row is seeded by either migration, and no existing seed is modified. Neither migration introduces a new Resource-backed table. |
| `fn_assert_resource_type` generalization | Unchanged. Its one-or-two-argument contract, its body, and `trg_requests_assert_resource_type` and `trg_commercial_configurations_assert_resource_type` all stay exactly as they are. §11 reuses its idiom without touching it. |

### 17.2 Newly confirmed by this design

| Item | Locked posture |
|---|---|
| `supabase_admin` ACLs and default privileges | Never modified. Observed and reported only (§15.1, §15.4). |
| Table and function ownership | Never modified. Asserted, not changed (§15.2). |
| Owner privileges | Never revoked. The owner keeps `TRUNCATE` and is stopped by the trigger. The fix is deliberately not implemented by stripping the owner (§6.4). |
| Historical `audit_log` rows | Never backfilled, never updated, never deleted. `trg_audit_log_immutable` is never dropped or disabled (§11.10). |
| `audit_log.resource_id` foreign key to `resources` | Never weakened, never dropped, never deferred, never made `NOT VALID`. The two-argument path begins exercising it for three tables that previously always wrote NULL, and the three locked triggers provably cannot violate it (§11.6). Asserted by test B08. |
| Supersession fork cardinality | Never restricted. Any number of Components may supersede the same predecessor. Rule 6 is a single-row identity predicate and cannot observe cardinality (§3.5, §13.7). Asserted by test B27. |
| `supersedes_component_id` nullability | Unchanged. Stays nullable. Rule 6 adds no `NOT NULL` and no default, and `IS DISTINCT FROM` accepts a NULL predecessor as TRUE (§13.7). Asserted by test B28. |
| Historical migration files | Never edited. Stale headers are corrected in the closeout document instead (Appendix A.6). |
| Existing single-column commercial foreign keys | Never dropped. Each new composite is additive alongside the one it subsumes (§13.1). |
| `commercial_commitments` columns | No `commercial_configuration_id` column is added. Rule 2 is enforced by trigger precisely to avoid it (§13.3). |
| `supersedes_component_id` uniqueness | Never added, in any form, partial or full. Decision 3 forbids it (§3.3, §13.6). Rule 6 is a `CHECK`, not a unique constraint, and must never be implemented as one (§13.9). |
| `create_commercial_configuration_with_change` signature | Never changed. Parameter list and return type stay identical so `CREATE OR REPLACE` preserves the OID and its privilege posture (§7.3). |
| `fn_protect_commercial_commitment_lifecycle` | Not modified. Rule 2 is a separate new function and trigger, not an extension of this one (§13.3). |
| `fn_reject_update_delete` | Not modified. Not in Migration A or B scope. |
| The name "Migration 9" | Never used for A, B, or C. Reserved for Usage and Earned (§19). |
| `TRUNCATE CASCADE` | Never executed, in a migration or in the harness (§16.1). |

## 18. Deferred items

Carried forward beyond this hardening. None blocks M4-M8 closeout.

| Item | Route | Status |
|---|---|---|
| 19 SECURITY INVOKER M4-M8 functions with unset `search_path` | Optional Migration C | Deferred, hygiene, not promoted (§8) |
| Allowed currency domain for `commercial_components.transaction_currency` and `commercial_commitments.currency` | Future Commercial Value Domains migration | Deferred product input (Appendix A.4) |
| Allowed `dimension_keys` vocabulary for `measurement_definitions` | Same | Deferred product input (Appendix A.5) |
| `dimension_keys` no-NULL / no-blank element shape check | Optional Migration C | Deferred, no business input needed (Appendix A.5) |
| Historical `audit_log` NULL `resource_id` rows for the three affected tables | Resolved at read time by `row_id`; recorded in the closeout | Deliberately never backfilled (§11.10) |
| `supabase_admin` default ACL state | Standing report line R1 on every harness run | Observed, never asserted, never modified (§15.4) |
| Ownership of objects in `public` outside the Nexus inventory | Standing report line R2 on every harness run | Observed, never asserted, never blocking (§15.2) |
| Live two-session serialization proof for the Commercial RPC | Structure proven by B19; semantics observed by optional report R3 | Deliberately not an official test, because it cannot run without a committed fixture or a pre-existing row (§16.4) |
| Migration apply-state correction for stale migration headers | M4-M8 closeout document | Deferred to closeout authoring (Appendix A.6) |

## 19. Commercial Migration 9 blocking rule

**Commercial Migration 9 (Usage and Earned) remains BLOCKED.**

The required sequence, in order, with no step skipped or reordered:

1. Settle and apply all required M4-M8 remediation: Migration A and Migration B **in both its parts**, subject to the §14 pre-apply gates.
2. Independently verify it: the full §16 runtime proof, with artifact SHA-256 identity recorded before and after the successful run.
3. Close the M4-M8 retrospective: author the M4-M8 closeout document recording the gate results, structural evidence, runtime evidence, and apply-state correction.
4. Only then may Commercial Migration 9 begin.

**Two ways this gets misread, both closed explicitly.**

*Misreading 1: applying only the destructive-privilege migration unblocks Commercial Migration 9.* **It does not.** Migration A closes the P1 findings, which is the most urgent work, but urgency is not completion. Migration B closes four P2 findings, three of which (P2-4, P2-5, and the RPC hardening in P2-3) are commercial-model integrity findings that Commercial Migration 9 would build directly on top of. Adding Usage and Earned tables above an unenforced commercial consistency model would layer new financially material data on invariants the database does not yet hold.

*Misreading 2: applying Migration A plus Part B1 unblocks Commercial Migration 9.* **It does not.** Part B1 carries P2-2 and P2-3 only. P2-4 and P2-5 live entirely in Part B2, and both are commercial-model integrity findings. A world in which B1 has landed and B2 has not is a world in which the audit linkage and the RPC are hardened while the commercial cross-parent invariants, including the self-supersession prohibition, are still unenforced by the database. That is precisely the substrate Commercial Migration 9 must not be built on.

**The complete unblocking condition, stated as one rule.** Commercial Migration 9 may begin when, and only when, all four of the following hold:

1. Migration A is applied and independently verified.
2. Migration B is complete, meaning **both** Part B1 and Part B2 are applied and independently verified, **or** every Part B2 finding is formally dispositioned in the M4-M8 closeout with no blocking remediation remaining. A silent deferral, an informal agreement, or an intention to do it later is not a disposition.
3. The full §16 runtime gates are complete for whatever was applied, with artifact identity recorded.
4. The M4-M8 closeout document is authored and committed.

Given the current design, Part B2 is expected to be required, not dispositioned away. It carries two P2 findings with concrete database remediation available.

Migration C does not gate step 3 and therefore does not gate Commercial Migration 9.

The name "Migration 9" is used for neither Migration A nor Migration B nor Migration C. It stays reserved for Usage and Earned by `docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md`.

## 20. Open questions

**Zero.**

Every question this design was asked to settle is settled:

- The TRUNCATE trigger attachment set is 13, decided on independent semantic grounds (§9.2).
- The `fn_audit_row()` API design is assessed and accepted, with the full argument contract, missing-column behavior, NULL behavior, invalid-UUID behavior, unregistered-UUID behavior, the `audit_log.resource_id` foreign key, and the identical-`row_id` question all locked (§11.3, §11.5, §11.6, §11.7).
- The backfill question is answered: no backfill, with cutover semantics documented (§11.10).
- The RPC's serialization anchor, lock order, retry identity, replay behavior, and every named error are locked (§12).
- All six commercial rules have a chosen mechanism with stated reasoning, including the rejected alternatives (§13).
- Rule 5 is adopted. Supersession same-Configuration **is** enforced, and forks remain unconstrained (§3.4, §13.6).
- **Rule 6 is adopted. Self-supersession is prohibited by `CHECK (supersedes_component_id IS DISTINCT FROM id)`, forks remain fully allowed, and NULL predecessors remain accepted (§3.5, §13.7).** This was the last open business question and it is now closed by an explicit business decision, not by inference.
- The migration boundary is locked, including which part owns the RPC hardening and a conditional split rule with an objective trigger condition rather than an open question (§5.2).
- The `search_path` disposition is decided, including the single coupled exception (§8).
- The ownership gate is scoped to the Nexus-owned set, with the schema-wide scan demoted to a non-blocking report (§15.2).
- All six P3 items are dispositioned (Appendix A). The supersession fork item is closed as an accepted business capability, not carried as a finding.

### 20.1 New findings surfaced during design

No new P0. No new P1. No new schema-level P2. Three observations, recorded honestly rather than inflated into findings:

1. **Severity amplification on P2-3, not a new finding.** Discovery recorded that `create_commercial_configuration_with_change` "lacks the locking / retry / idempotency discipline" of the other Foundation RPCs. This design establishes it is slightly worse than that phrasing suggests: a retry carrying the same `p_new_commercial_configuration_id` currently fails with a raw `23505` on the `resources` primary key, which an application retry layer may reasonably misclassify as a transient conflict and retry again indefinitely. The function also performs no existence or activity validation on either the Customer or the Request. Fully remediated by §12. No severity change to P2-3 itself.

2. **A design-level risk with a mandatory control, not a schema finding.** Rules 2 and 3 are enforced by `BEFORE INSERT` triggers, which validate nothing retroactively. If pre-existing rows violate either rule, Part B2 applies cleanly and reports success while leaving the violators in place. This is why D5, D6, and D7 are specified as hard human gates rather than advisory reads (§13.8, §14.1). The risk is real and the control is stated; it is not a defect in the schema.

3. **A benign observation, explicitly not a finding.** The insert-only tables (`commercial_changes`, `commercial_component_capabilities`, `commercial_commitment_components`) carry guards that reject all `UPDATE` and `DELETE`, so `trg_audit_commercial_changes`'s `UPDATE` and `DELETE` branches are unreachable. This resembles the defect class the Platform Core hardening addressed for foreign keys, a declared behavior that only fails safe because another control intercepts it, but the direction of failure is opposite and benign: if the reject guard were ever narrowed, the audit trigger would then correctly begin firing, rather than silently destroying history the way an unreachable `ON DELETE CASCADE` would. It fails safe in the good direction. No action.

### 20.2 Deferred product inputs, not open business questions

The currency list (Appendix A.4) and the `dimension_keys` vocabulary (Appendix A.5) are business inputs Nexus has not yet locked. They are counted as deferred product inputs rather than open business questions for this design, because no invariant, gate, migration, or test in this document depends on either. Nothing here is ambiguous while they remain unanswered. They are pre-existing deferrals carried forward, not ambiguity uncovered by this design.

**Remaining open business questions for M4-M8: 0.**
## Appendix A: P3 disposition

Each item below is explicitly dispositioned. None is automatically remediated.

### A.1 Trigger-only `service_role` EXECUTE

**No action. Closed as not a defect, permanently, not deferred.**

PostgreSQL refuses a direct call of any function returning `trigger`, so the privilege is not exercisable. Separately, trigger invocation does not check the writing role's `EXECUTE` privilege on the trigger function, so revoking it would change nothing about who can cause the trigger to fire. Migrations 2, 3, and 8 each reasoned this way, and `20260909090000_platform_core_integrity_hardening.sql` restated it when it declined to revoke `service_role` `EXECUTE` on `fn_reject_truncate()`.

Adding a revoke would create the appearance of closing an exposure that does not exist, which makes the next reviewer's job harder, not easier. Removed from the deferred list rather than carried forward.

### A.2 Ambient `service_role` table DML

**No action. Reclassified as by-design and removed from the deferred list.**

`service_role` **is** the trusted application data path. `SELECT`, `INSERT`, `UPDATE`, and `DELETE` are its designed posture, and every table constrains what those privileges can actually accomplish through its own lifecycle trigger: `commercial_changes` and both join tables reject all `UPDATE` and `DELETE`; `commercial_components` and `commercial_commitments` permit only a single `effective_to` closure; `commercial_configurations`, `customers`, `capabilities`, and `measurement_definitions` permit only named cosmetic and status columns and reject `DELETE`.

Removing DML from `service_role` would break the platform. This was never a finding about excess privilege; it is the architecture, correctly implemented. What made `TRUNCATE` different, and genuinely a P1, is precisely that no trigger layer existed for it.

### A.3 Supersession fork

**Closed. Removed from the finding list entirely.**

This is no longer a P3 item or a question of any kind. **A supersession fork is an accepted business capability**, not a defect, not a risk, and not a deferral. One predecessor Component may be superseded by any number of successor Components, permanently.

Three separate questions were raised under this heading and all three are now answered:

| Question | Answer | Where |
|---|---|---|
| Cardinality: may one predecessor have many successors? | **Yes.** Forks allowed. No uniqueness on `supersedes_component_id`, in any form | Decision 3, §3.3 |
| Scope: must predecessor and successor share a Configuration? | **Yes.** Enforced by Rule 5's composite foreign key, which constrains only what a row points at and never how many rows point at it | Decision 3a, §3.4, §13.6 |
| Identity: may a Component supersede itself? | **No.** Prohibited by Rule 6's `CHECK`, which is a single-row predicate and restricts fork cardinality in no way | Decision 4, §3.5, §13.7 |

Proven by tests B26 (cross-Configuration rejected), B27 (fork accepted), B28 (NULL predecessor accepted), and B29 (self-edge rejected). B27 and B29 share a fixture so that "forks allowed" and "self-supersession prohibited" are demonstrated together and cannot be confused for one another.

### A.4 Free-text currency fields

**Deferred. Not remediated in this hardening.**

Affected: `commercial_components.transaction_currency text not null`, `commercial_commitments.currency text`.

Deferred because the correct fix is a `CHECK` against an allowed currency set or a dedicated domain, and Nexus has not locked its allowed currency list. Encoding a guess would be making a business decision this design is not authorized to make, and a wrong list would be worse than no list: it would reject legitimate data and would need a second migration to widen.

Deferral costs nothing structurally. A `CHECK` added later validates every existing row at `ALTER TABLE` time, so nothing is lost by waiting, and no invariant in Migrations A, B, or C depends on the currency domain.

Route: a future Commercial Value Domains migration, authored after the allowed currency list is locked as a product input.

This is a **deferred product input**, not an open business question for this design. Nothing in this document is ambiguous because of it, and no gate depends on it. See §20.

### A.5 `measurement_definitions.dimension_keys` domain

**Deferred, with one non-business sub-item offered to Migration C.**

`dimension_keys text[] not null default '{}'::text[]` has no constraint on its contents. The allowed dimension vocabulary is a business input not yet locked, so the same reasoning as A.4 applies to the vocabulary itself.

Separable sub-item that requires no business input: a `CHECK` that the array contains no NULL element and no blank or whitespace-only element. That is pure shape hygiene, matching the existing `chk_form_definitions_key_nonblank` precedent, and cannot conflict with any future vocabulary decision. **Recommended for Migration C as optional. Not required. Does not block closeout.**

### A.6 Stale "not yet applied" migration headers

**No historical migration is edited.**

All 10 migration files end with a line stating the file has not been applied to any database. That is now false for the applied ones. It is not corrected in place.

Reasons. Migration immutability is a locked convention that every migration header in this repository restates explicitly, including the one that says "Migrations 1 through 8 and the Foundation RPC Privilege Hardening migration remain immutable history." Editing an applied migration's text breaks the property that makes migration history trustworthy, and it can desynchronize a recorded checksum. The header is also not wrong about anything structural: it was true when written, and the reader's actual question, which migrations are applied, is a question about database state, not about file content.

**Correction route, locked: the apply state is recorded in the M4-M8 closeout document**, alongside the D-series gate results, the G-series captures, the R-series reports, and the runtime evidence. No new file is created, and no historical file is touched. This follows the principle of correcting documentation elsewhere rather than editing an applied migration.

Migrations A and B are authored following the existing convention, including the not-yet-applied line at authoring time, which the closeout document then supersedes.
