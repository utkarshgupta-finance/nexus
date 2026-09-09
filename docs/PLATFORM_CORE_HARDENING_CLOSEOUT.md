# Platform Core Integrity Hardening Closeout

## 1. Status

STATUS: CLOSED

Scope: Platform Core Migrations 1-3 retrospective hardening.

This does not close the M4-M8 retrospective and does not unblock Commercial Migration 9.

## 2. Why this retrospective was opened

Live inspection confirmed that `service_role` held effective `TRUNCATE` privilege on all eight Platform Core tables: `app_users`, `resource_types`, `resources`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_log`.

This mattered because Platform Core's permanence and history contracts on `audit_log`, `resources`, `user_roles`, and `role_permissions` are enforced by row-level `BEFORE UPDATE OR DELETE` triggers. PostgreSQL does not fire row-level triggers on `TRUNCATE`, and Row Level Security does not apply to `TRUNCATE` either. With the privilege still held, the trusted application role could remove every row from those tables without the guard firing and without violating any privilege already revoked.

This was a confirmed privilege exposure in the live schema, not an observed production incident.

## 3. Hardening applied

Applied in `supabase/migrations/20260909090000_platform_core_integrity_hardening.sql`:

- Revoked `TRUNCATE` from `service_role` on all eight Platform Core tables.
- Removed `TRUNCATE` from `service_role`'s default privileges for future `postgres`-created tables in schema `public`, closing the recurrence path.
- Added a generic `BEFORE TRUNCATE FOR EACH STATEMENT` guard, `public.fn_reject_truncate()`, and attached it to `audit_log`, `resources`, `user_roles`, and `role_permissions`, the four tables that already carry an unconditional row-level permanence or history guard.
- The function is `SECURITY INVOKER`, pins `search_path = pg_catalog`, has a canonical table-independent body, and has `EXECUTE` revoked from `PUBLIC`, `anon`, and `authenticated`.
- Corrected `user_roles_user_id_fkey` from `ON DELETE CASCADE` to `ON DELETE RESTRICT`.
- Corrected `audit_log_actor_user_id_fkey` from `ON DELETE SET NULL` to `ON DELETE RESTRICT`.

Both foreign-key corrections addressed declared referential actions that could never execute, because a separate immutability trigger always intercepted them first.

Full design rationale is recorded in `docs/PLATFORM_CORE_HARDENING_DESIGN.md`, which remains locked and unmodified.

## 4. Pre-apply evidence

- Both foreign-key orphan checks returned 0.
- Supabase CLI 2.117.0 migration batching and transaction behavior was independently reviewed before apply.
- Dry run showed exactly one pending migration: `20260909090000_platform_core_integrity_hardening.sql`.

## 5. Post-apply structural evidence

Confirmed against the live schema after apply:

- Migration recorded remotely.
- `fn_reject_truncate()` body and configuration match the canonical, table-independent contract.
- Exactly four intended `TRUNCATE` triggers exist, all four enabled (`tgenabled = 'O'`), all four attached to the exact expected function OID.
- `service_role` `TRUNCATE` is false on all eight Platform Core tables.
- The `postgres`/`public` default ACL retains the seven intended non-`TRUNCATE` privileges.
- Both corrected foreign keys are validated `RESTRICT` constraints.
- `EXECUTE` on `fn_reject_truncate()` is false for `anon` and `authenticated`.

## 6. Runtime evidence

The runtime harness ran 20 official tests. The final run returned:

MACHINE_SUMMARY official_total=20 official_distinct=20 official_passed=20 official_failed=0

All official Tests 01 through 20 passed, including Tests 17-20, which cover destructive and canary protection paths. A fresh post-rollback connection confirmed zero residue rows across all 10 checked fixture-bearing areas, and production preservation passed for `audit_log`, `user_roles`, `role_permissions`, and `resources`. No `TRUNCATE` was issued against `resources` directly; its protection is proven as a composite of Tests 01, 03, and 19. No harness sentinel condition was observed.

The initial run returned 18/20. Both misses were traced to harness implementation defects (an ambiguous `text[]` scalar-literal concatenation in one test, and a `regclass` display-text comparison in another), not database failures. The database was not changed by that run. The harness was corrected, swept for the same defect class, and independently reviewed before the successful re-run recorded above.

## 7. Artifact identity

Immediately before the successful run:

`.runtime-tests/platform_core_integrity_hardening_runtime.sql`
SHA-256: `22a559cf67a2470fad0d061cca6abd13fead841a1977a985177f94e5c0fdf3a7`

`.runtime-tests/run_platform_core_integrity_hardening.sh`
SHA-256: `1d23db82721b14aa9c93132576a04b6c4fee29cb723fdb4e755ade18294e44d7`

Both hashes were recomputed immediately after execution and matched exactly. `.runtime-tests` is intentionally gitignored, so these hashes are the identity link between the artifacts that were independently reviewed and the artifacts that produced the successful runtime result.

## 8. Final conclusion

The M1-M3 Platform Core retrospective hardening gate is CLOSED.

Carry-forward: the M4-M8 retrospective remains open. Commercial Migration 9 remains blocked until that retrospective is completed.

## 9. Deferred observations

- Runtime diagnostics showed later public tables (created by Migrations 4 through 8) still carry `service_role` `TRUNCATE` exposure.
- The highest-priority later-table review item is `submission_revisions`, because it holds raw and effective submission data that is not reconstructable from `audit_log`.
- `commercial_component_capabilities` and `commercial_commitment_components` should also be included in the later-table review.
- Historical trigger-function `search_path` posture remains a separate deferred review item.

These are carry-forward observations for the M4-M8 retrospective. None of them represents a failure of the M1-M3 gate closed by this document.
