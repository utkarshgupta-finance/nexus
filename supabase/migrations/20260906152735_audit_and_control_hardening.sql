-- Nexus Stage 5: Audit and Control Foundation.
--
-- A focused control-hardening pass on top of Migration 1
-- (20260906084244_platform_core_foundation.sql), before any real user or
-- business data exists. Described in:
--   docs/PLATFORM_ARCHITECTURE.md §7 (audit-readiness principle, actor/
--     context trust contract, audit-log data sensitivity)
--   docs/DATA_ARCHITECTURE.md §12 (direct privilege hardening), §13
--     (historical grant records)
--   docs/AUTHORIZATION_MODEL.md §4 (historical grant records), §6
--     (privilege hardening as a third enforcement layer)
--
-- Scope: converts user_roles and role_permissions from hard-delete
-- grant/revoke to historical grant records, with the full lifecycle
-- enforced at the database level (fn_protect_access_grant: a new grant
-- must begin active, no DELETE, no reactivation, no rewriting grant
-- identity or original evidence, plus CHECK constraints tying
-- revoked_by/revocation_reason to revoked_at and requiring
-- revoked_at >= created_at), adds a monotonic audit ordering column and
-- session-role origin metadata to audit_log, and revokes direct
-- anon/authenticated table, sequence, and function privileges, current
-- and future (via ALTER DEFAULT PRIVILEGES FOR ROLE postgres), as
-- defense-in-depth beneath RLS.
--
-- Out of scope, deliberately (see docs/PLATFORM_ARCHITECTURE.md §12):
-- workflow, tasks, domain events, notifications, policy/configuration
-- tables, attachments, approval/exception tables. No seed data. This
-- migration is schema only.
--
-- This file has not been applied to any database.


-- =============================================================================
-- Access-grant lifecycle enforcement (shared by user_roles and role_permissions)
-- =============================================================================

-- Reusable, without dynamic SQL: computes each row's "identity" as its full
-- JSONB representation minus the four lifecycle columns
-- (revoked_at/revoked_by/revocation_reason/updated_at), which are the only
-- columns either historical-grant table allows to change after insert, and
-- compares old versus new. This works unmodified for both user_roles
-- (identity = user_id, role_id, scope_resource_id, created_at, created_by)
-- and role_permissions (identity = role_id, permission_id, created_at,
-- created_by) because it never needs to name those columns explicitly.
--
-- Enforces, for both tables:
--   - A new grant must always begin active: INSERT requires
--     revoked_at/revoked_by/revocation_reason all NULL. A historical grant
--     is never created already revoked through ordinary application
--     behavior.
--   - DELETE is never permitted; a grant is revoked, never removed.
--   - Once revoked_at is set, it (and revoked_by/revocation_reason) can
--     never change again: no reactivation, no re-revocation, no editing a
--     past revocation's recorded reason.
--   - No other column may change on any UPDATE, at any time, including
--     while still active: the grant identity and its original
--     created_at/created_by evidence are fixed from the moment of insert.
-- A legitimate revoke (revoked_at NULL -> a timestamp, optionally with
-- revoked_by/revocation_reason set at the same time) is the only UPDATE
-- shape this function allows through.
create function fn_protect_access_grant()
returns trigger
language plpgsql
as $$
declare
  v_old_identity jsonb;
  v_new_identity jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception '% is a historical grant record: rows are revoked, never deleted', tg_table_name;
  end if;

  if tg_op = 'INSERT' then
    if new.revoked_at is not null or new.revoked_by is not null or new.revocation_reason is not null then
      raise exception '% is a historical grant record: a new grant must begin active (revoked_at/revoked_by/revocation_reason must all be NULL on insert)', tg_table_name;
    end if;
    return new;
  end if;

  -- From here, tg_op = 'UPDATE'.
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception '% is a historical grant record: revoked_at cannot change once set (no reactivation, no re-revocation)', tg_table_name;
  end if;

  if old.revoked_at is not null and (
    new.revoked_by is distinct from old.revoked_by
    or new.revocation_reason is distinct from old.revocation_reason
  ) then
    raise exception '% is a historical grant record: revoked_by/revocation_reason cannot change once revoked_at is set', tg_table_name;
  end if;

  v_old_identity := to_jsonb(old) - 'revoked_at' - 'revoked_by' - 'revocation_reason' - 'updated_at';
  v_new_identity := to_jsonb(new) - 'revoked_at' - 'revoked_by' - 'revocation_reason' - 'updated_at';

  if v_old_identity is distinct from v_new_identity then
    raise exception '% is a historical grant record: only revoked_at/revoked_by/revocation_reason may ever change, and only from NULL to a value', tg_table_name;
  end if;

  return new;
end;
$$;

comment on function fn_protect_access_grant() is
  'Enforces historical-grant-record lifecycle on user_roles and role_permissions: '
  'INSERT must begin active, no DELETE, no reactivation, no rewriting grant identity '
  'or original evidence. Generic via JSONB diff; do not attach to a table whose only '
  'mutable columns are not exactly revoked_at/revoked_by/revocation_reason/updated_at.';


-- =============================================================================
-- user_roles: historical grant records
-- =============================================================================

-- Revoking access no longer deletes the assignment row. An active grant is
-- revoked_at IS NULL; a revoked one is preserved exactly as it was,
-- because "who had access on a past date, granted by whom, revoked by
-- whom, and why" must be answerable directly from this table, not only by
-- replaying audit_log JSON. granted_at/granted_by are the existing
-- created_at/created_by columns; no duplicate columns are added for
-- naming purity.
alter table user_roles
  add column revoked_at        timestamptz,
  add column revoked_by        uuid references app_users (id) on delete restrict,
  add column revocation_reason text,
  add column updated_at        timestamptz not null default now();

-- If revoked_at is NULL the grant is active and carries no revocation
-- detail; if revoked_at is set, revoked_by/revocation_reason may or may not
-- be (system-originated revocations may have no Nexus user context, and a
-- reason is not yet universally required). What this does not allow is
-- revoked_by or revocation_reason being set while revoked_at is still NULL.
alter table user_roles add constraint chk_user_roles_revocation_state
  check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or (revoked_at is not null)
  );

-- A grant cannot logically be revoked before it was granted.
alter table user_roles add constraint chk_user_roles_revocation_chronology
  check (revoked_at is null or revoked_at >= created_at);

comment on table user_roles is
  'Historical role-assignment record. granted_at/granted_by are created_at/ '
  'created_by. An active grant has revoked_at IS NULL; a revoked grant is kept, '
  'never deleted, and its columns are frozen thereafter (trg_user_roles_protect_grant). '
  'scope_resource_id NULL = global. Non-null values reference resources.resource_id '
  'and scope the assignment to that resource. Re-granting after a revoke inserts a '
  'new row; the old one is never reactivated.';

create index idx_user_roles_revoked_by on user_roles (revoked_by);
create index idx_user_roles_revoked_at on user_roles (revoked_at);

create trigger trg_user_roles_updated_at
  before update on user_roles
  for each row
  execute function fn_set_updated_at();

-- Alphabetically before trg_user_roles_updated_at, so this runs first on
-- UPDATE; it does not depend on ordering, since it explicitly excludes
-- updated_at from the identity comparison either way. Also covers INSERT,
-- so a grant can never be created already revoked.
create trigger trg_user_roles_protect_grant
  before insert or update or delete on user_roles
  for each row
  execute function fn_protect_access_grant();

-- Replace the "one assignment ever" partial unique indexes from Migration 1
-- with "one *active* assignment", so a revoked grant never blocks a later,
-- new grant of the same role/scope to the same user.
drop index uq_user_roles_global;
drop index uq_user_roles_scoped;

create unique index uq_user_roles_global
  on user_roles (user_id, role_id)
  where scope_resource_id is null and revoked_at is null;

create unique index uq_user_roles_scoped
  on user_roles (user_id, role_id, scope_resource_id)
  where scope_resource_id is not null and revoked_at is null;


-- =============================================================================
-- role_permissions: historical grant records
-- =============================================================================

-- Same reasoning as user_roles above: revoking a permission from a role no
-- longer deletes the grant row.
alter table role_permissions
  add column revoked_at        timestamptz,
  add column revoked_by        uuid references app_users (id) on delete restrict,
  add column revocation_reason text,
  add column updated_at        timestamptz not null default now();

-- Same rule as user_roles above.
alter table role_permissions add constraint chk_role_permissions_revocation_state
  check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or (revoked_at is not null)
  );

-- Same rule as user_roles above: a grant cannot be revoked before it was
-- granted.
alter table role_permissions add constraint chk_role_permissions_revocation_chronology
  check (revoked_at is null or revoked_at >= created_at);

comment on table role_permissions is
  'Historical permission-grant record. granted_at/granted_by are created_at/ '
  'created_by. An active grant has revoked_at IS NULL; a revoked grant is kept, '
  'never deleted, and its columns are frozen thereafter '
  '(trg_role_permissions_protect_grant). Re-granting after a revoke inserts a new '
  'row; the old one is never reactivated.';

create index idx_role_permissions_revoked_by on role_permissions (revoked_by);
create index idx_role_permissions_revoked_at on role_permissions (revoked_at);

create trigger trg_role_permissions_updated_at
  before update on role_permissions
  for each row
  execute function fn_set_updated_at();

-- Same reusable lifecycle guard as user_roles; see its definition above.
-- Also covers INSERT, so a grant can never be created already revoked.
create trigger trg_role_permissions_protect_grant
  before insert or update or delete on role_permissions
  for each row
  execute function fn_protect_access_grant();

-- Replace the plain unique constraint from Migration 1 with a partial one
-- scoped to active grants, for the same reason as user_roles above.
alter table role_permissions drop constraint role_permissions_role_id_permission_id_key;

create unique index uq_role_permissions_active
  on role_permissions (role_id, permission_id)
  where revoked_at is null;


-- =============================================================================
-- audit_log: deterministic ordering and origin metadata
-- =============================================================================

-- audit_sequence gives a deterministic row-insertion order that neither
-- the UUID primary key nor occurred_at can provide alone, since multiple
-- rows from one transaction can share an identical timestamp. This orders
-- when rows were inserted, not when their transactions committed:
-- PostgreSQL sequence values are non-transactional (consumed immediately,
-- never rolled back), so under concurrent transactions an earlier
-- audit_sequence value is not guaranteed to belong to the
-- earlier-committing transaction. See docs/DATA_ARCHITECTURE.md §9. The
-- unique constraint's index also serves ORDER BY audit_sequence directly;
-- no separate index is added.
alter table audit_log
  add column audit_sequence bigint generated always as identity,
  add column db_role        text not null default session_user;

alter table audit_log add constraint audit_log_audit_sequence_key unique (audit_sequence);

comment on column audit_log.audit_sequence is
  'Monotonically increasing row-insertion order. Not commit order between concurrent '
  'transactions, PostgreSQL sequences do not guarantee that. Not a substitute for the '
  'primary key; see docs/DATA_ARCHITECTURE.md §9.';

comment on column audit_log.db_role is
  'session_user at write time: the originally authenticated database role, unaffected '
  'by fn_audit_row running as SECURITY DEFINER or by an intervening SET ROLE. '
  'Technical origin metadata for distinguishing the trusted service_role path from '
  'any other origin, not a substitute for actor_user_id.';

-- The IDENTITY column above just created a real sequence
-- (audit_log_audit_sequence_seq), owned by the same role executing this
-- migration. The public-schema default privilege that already grants
-- anon/authenticated broad access to every new table created by that
-- role (confirmed read-only before drafting this migration) grants the
-- same for sequences, so this sequence needs its own explicit revoke now;
-- the ALTER DEFAULT PRIVILEGES statement below only changes what happens
-- to sequences created after it runs, not this one, created earlier in
-- this same migration.
revoke all on sequence audit_log_audit_sequence_seq from anon, authenticated;


-- =============================================================================
-- Direct privilege hardening
-- =============================================================================

-- Supabase grants anon/authenticated broad ordinary table privileges by
-- default; RLS (Migration 1) already blocks them, but Nexus architecture
-- says these clients have no legitimate reason to reach Platform Core
-- tables directly at all. Revoking the underlying privilege is
-- defense-in-depth beneath RLS: if a future policy were ever
-- misconfigured to be permissive, the privilege to exploit it would
-- already be absent. service_role (the trusted application path) is
-- untouched; it already bypasses RLS by attribute and keeps the ordinary
-- privileges it needs.
revoke all on table
  app_users, resource_types, resources, roles, permissions,
  role_permissions, user_roles, audit_log
from anon, authenticated;

-- Ensures a future table created without an explicit GRANT does not
-- silently regain the default anon/authenticated access Supabase would
-- otherwise apply, so this control does not rely on every future
-- migration remembering to repeat it. FOR ROLE postgres is explicit,
-- not implied: confirmed read-only that every Platform Core table and
-- index is owned by postgres, that migrations execute as postgres, and
-- that the pre-existing Supabase default-privilege entry this statement
-- modifies is itself keyed to postgres (a separate entry keyed to
-- supabase_admin also exists for this schema and is correctly left
-- untouched, since our migrations do not run as that role).
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

-- Same reasoning as the table default above, and directly motivated by
-- the audit_log_audit_sequence_seq revoke earlier in this migration:
-- confirmed read-only that Supabase's existing default-privilege
-- configuration for this project grants anon/authenticated USAGE/SELECT/
-- UPDATE on every future sequence created by postgres in this schema,
-- exactly as it does for tables.
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- Confirmed read-only that this project's existing default-privilege
-- configuration also grants anon/authenticated EXECUTE on every future
-- function created by postgres in this schema. A function should not
-- become callable by browser-facing roles merely because a migration
-- created it; service_role (the trusted application path) is
-- deliberately left untouched here, the same as the table and sequence
-- defaults above.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Trigger invocation does not require the writing role to hold EXECUTE on
-- the trigger function, so revoking it from PUBLIC (which anon and
-- authenticated hold EXECUTE through, having no separate grant of their
-- own) removes a direct-call surface with no effect on the triggers
-- themselves. Includes fn_protect_access_grant, created earlier in this
-- migration, for the same reason as the four Migration 1 trigger
-- functions.
revoke execute on function
  fn_set_updated_at(), fn_resources_immutable(), fn_audit_row(),
  fn_audit_log_immutable(), fn_protect_access_grant()
from public;
