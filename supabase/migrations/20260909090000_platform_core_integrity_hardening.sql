-- Nexus: Platform Core Integrity Hardening.
--
-- Forward migration implementing the locked design in
-- docs/PLATFORM_CORE_HARDENING_DESIGN.md. Referred to by its descriptive
-- name only: it carries no migration number and is specifically not
-- "Migration 9", which stays reserved by
-- docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md for the Commercial Usage
-- and Earned stage.
--
-- The defect it closes (design §1, §5). Platform Core protects its
-- permanence and history contracts with unconditional row-level
-- BEFORE UPDATE OR DELETE triggers backed by privilege revocation.
-- PostgreSQL does not fire row-level triggers on TRUNCATE, and Row Level
-- Security does not apply to TRUNCATE at all. Migration 2 revoked ALL
-- (which includes TRUNCATE) from anon and authenticated, but named only
-- UPDATE and DELETE against service_role on audit_log, so the trusted
-- application path kept TRUNCATE on all eight Platform Core tables. For
-- TRUNCATE there were zero layers. This migration restores both.
--
-- Eight conceptual operations, in the locked order (design §3, §19):
--   A. TRUNCATE privilege and integrity hardening
--      1. create public.fn_reject_truncate()
--      2. revoke its EXECUTE posture from PUBLIC, anon, authenticated
--      3. attach BEFORE TRUNCATE FOR EACH STATEMENT triggers to exactly
--         audit_log, resources, user_roles, role_permissions
--      4. revoke TRUNCATE from service_role on all eight Platform Core
--         tables
--      5. remove TRUNCATE from service_role's default privileges for
--         future tables created by postgres in schema public
--   B. Historical and immutable foreign-key corrections
--      6. user_roles_user_id_fkey: ON DELETE CASCADE to RESTRICT
--      7. audit_log_actor_user_id_fkey: ON DELETE SET NULL to RESTRICT
--   C. Comments and schema-contract documentation
--      8. update the affected table, column, and function comments so the
--         documented contract matches the enforced one
--
-- Fail-loud (design §3). Every object this migration depends on is named
-- exactly: the four trigger target tables, the eight revoke targets, and
-- both foreign-key constraint names. DROP CONSTRAINT IF EXISTS is
-- deliberately not used, so a missing expected constraint fails the
-- migration rather than silently producing a partially hardened state.
--
-- Deliberately out of scope (design §4, §13, §21): no RLS change, no
-- policy, no table ownership change, no seed or business data, no delete
-- guard on app_users, no search_path retrofit on the legacy Migration 1
-- and 2 trigger functions, no TRUNCATE work on the tables created by
-- Migrations 4 through 8 (submission_revisions,
-- commercial_component_capabilities, commercial_commitment_components
-- remain the highest-priority deferred exposure), and no change to
-- default ACL entries keyed to any creator role other than postgres or
-- to any schema other than public.
--
-- Historical migrations are never edited. Migrations 1 through 8 and the
-- Foundation RPC Privilege Hardening migration remain immutable history.
--
-- This file has not been applied to any database.


-- =============================================================================
-- Section A: TRUNCATE privilege and integrity hardening
-- =============================================================================

-- Operation 1. The generic statement-level guard, and the TRUNCATE twin of
-- fn_reject_update_delete() from Migration 8. Zero table-specific logic:
-- one unconditional RAISE, no branching, no table access, no dynamic SQL,
-- no catalog lookup, no TG_RELID behavior, no data dependency, and no
-- reachable success path. TG_TABLE_NAME is used solely to compose the
-- diagnostic message, which is what lets one function serve four tables.
--
-- That table independence is a gated contract, not a style preference
-- (design §9, §16.8.0). The resources TRUNCATE contract is proven as a
-- composite (exact catalog attachment plus a behavioral proof of this
-- function on a rollback-bound fictional relation) rather than by
-- truncating resources, which is referenced by five tables directly and
-- twelve transitively. That transfer is valid only because this body
-- cannot behave differently on one table, so the body is canonical and
-- the runtime gate asserts it from pg_proc.prosrc. Changing it in a later
-- migration requires updating that expected constant in the same change.
--
-- Plain RAISE EXCEPTION, so the SQLSTATE is P0001, the Nexus convention
-- for every lifecycle/immutability trigger raise. No custom ERRCODE is
-- assigned: the runtime gate distinguishes a working guard from a missing
-- one by P0001 specifically.
--
-- SECURITY INVOKER, matching fn_reject_update_delete(),
-- fn_resources_immutable(), and fn_audit_log_immutable(). Definer rights
-- would buy nothing: raising requires no privilege and the body touches no
-- table. search_path is pinned to pg_catalog as the current standard for
-- new functions; the body resolves no object at all, so the pin is a
-- standards posture rather than the mitigation of a live path.
create function public.fn_reject_truncate()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception '% cannot be truncated: TRUNCATE is not permitted on this table', tg_table_name;
end;
$$;

-- Operation 2. acldefault for a function grants PUBLIC EXECUTE, so a newly
-- created function is callable by PUBLIC unless revoked. Migration 2's
-- ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM anon,
-- authenticated should already keep those two clean, but Migration 3
-- exists precisely because a plausible assumption about which grants were
-- actually present turned out to be wrong in this project, so the revokes
-- are encoded explicitly rather than assumed.
--
-- No positive service_role GRANT, per the locked convention in
-- docs/FOUNDATION_RPC_PRIVILEGE_HARDENING_DESIGN.md §12: trigger-only
-- functions are REVOKE-only, never GRANT to any role. The callable-RPC
-- rule that requires an explicit service_role grant applies to callable
-- application RPCs and must not be applied here, since it would add a
-- direct-call surface for no benefit. No service_role revoke is added
-- either, matching Migrations 2, 3, and 8: PostgreSQL refuses a direct
-- call of any function returning trigger, so EXECUTE on a trigger
-- function is inherently non-exercisable. Trigger invocation does not
-- require the writing role to hold EXECUTE on the trigger function.
revoke execute on function public.fn_reject_truncate() from public, anon, authenticated;

-- Operation 3. The derived attachment rule (design §8): a statement-level
-- TRUNCATE guard is attached exactly where Platform Core already has an
-- unconditional row-level UPDATE/DELETE permanence or history guard. That
-- is audit_log (trg_audit_log_immutable), resources
-- (trg_resources_immutable), user_roles (trg_user_roles_protect_grant),
-- and role_permissions (trg_role_permissions_protect_grant). No table
-- gains a new class of protection; four tables have a hole closed in a
-- protection they already claimed to have.
--
-- app_users, resource_types, roles, and permissions deliberately receive
-- no guard: row DELETE is legitimately permitted on each, and the uniform
-- service_role revoke below already closes the mass-deletion path for
-- every role that can reach them (design §11.5 through §11.8).
--
-- BEFORE TRUNCATE and FOR EACH STATEMENT are not a preference: PostgreSQL
-- requires TRUNCATE triggers to be statement-level. Ordinary CREATE
-- TRIGGER, so tgenabled is 'O'. ENABLE ALWAYS is deliberately not used:
-- it is different behavior with respect to session_replication_role, not
-- merely a stronger form, and adopting it would be a separate conscious
-- architecture decision this design has not made.
create trigger trg_audit_log_reject_truncate
  before truncate on public.audit_log
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_resources_reject_truncate
  before truncate on public.resources
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_user_roles_reject_truncate
  before truncate on public.user_roles
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_role_permissions_reject_truncate
  before truncate on public.role_permissions
  for each statement
  execute function public.fn_reject_truncate();

-- Operation 4. Uniform across all eight Platform Core tables rather than
-- only the four that receive an integrity guard: service_role is the
-- trusted application path and has no legitimate reason to truncate any
-- Platform Core table, and a partial revoke would be harder to state,
-- test, and remember correctly in a future migration. This mirrors
-- Migration 2's own choice to revoke from anon and authenticated across
-- all eight.
--
-- One privilege and one grantee, so it cannot affect any other privilege
-- or any other role. service_role keeps SELECT, INSERT, UPDATE, DELETE,
-- REFERENCES, TRIGGER, and MAINTAIN on the seven tables that hold them,
-- and audit_log's existing Migration 1 posture (UPDATE and DELETE already
-- revoked) is left exactly as it is. anon and authenticated were already
-- denied by Migration 2's REVOKE ALL and are not named here. PUBLIC was
-- never granted TRUNCATE by any Platform Core migration. The owner keeps
-- its privilege by virtue of ownership and is stopped by the trigger
-- instead, which is the entire point of the two-layer control: the fix is
-- deliberately not implemented by stripping the owner (design §15).
revoke truncate on table
  public.app_users, public.resource_types, public.resources, public.roles,
  public.permissions, public.role_permissions, public.user_roles,
  public.audit_log
from service_role;

-- Operation 5. The only operation that prevents the defect from silently
-- recurring: without it, this migration would close the hole on eight
-- tables and leave every future Platform Core, feature, and Commercial
-- table to reopen it. Confirmed read-only before authoring that the
-- pg_default_acl row carrying this grant is a schema-specific entry
-- scoped to public and keyed to creator role postgres, and that no global
-- (defaclnamespace = 0) service_role TRUNCATE grant was present, so this
-- schema-scoped revoke edits the entry that actually carries the
-- privilege rather than being composed on top of a global grant.
--
-- FOR ROLE postgres is explicit, not implied, matching Migration 2's
-- reasoning: a default-privilege rule attached to the wrong
-- object-creating role creates false confidence while leaving future
-- objects exposed. Migrations in this project execute as postgres and
-- every Platform Core object is owned by postgres.
--
-- TRUNCATE only. The same entry grants service_role the ordinary
-- privileges the trusted path depends on, and those must survive, so this
-- is deliberately not REVOKE ALL. Scope is exactly one creator role, one
-- schema, one grantee, and one privilege: the global defaults, the storage
-- schema defaults, the supabase_admin entry for this schema, and every
-- other creator role are all correctly left untouched (design §7.4).
alter default privileges for role postgres in schema public
  revoke truncate on tables from service_role;


-- =============================================================================
-- Section B: historical and immutable foreign-key corrections
-- =============================================================================

-- Both corrections are the same defect class as the confirmed TRUNCATE
-- finding: a declared behavior that only fails safe because a separate
-- control happens to intercept it. In both cases the schema says one thing
-- and a trigger silently means another. PostgreSQL cannot alter a
-- referential action in place (ALTER CONSTRAINT changes only
-- deferrability), so drop and re-create is required for both. Both
-- constraint names are live-confirmed and both are the PostgreSQL default
-- <table>_<column>_fkey form, because Migration 1 declared both inline as
-- column constraints.
--
-- Plain DROP CONSTRAINT, never IF EXISTS: a missing expected constraint
-- must fail this migration loudly. Each re-add preserves the child column,
-- parent table, parent column, match type, deferrability, and the absence
-- of an ON UPDATE action, changing only the delete action. Dropping and
-- re-adding a foreign key does not alter the column's NOT NULL status and
-- does not drop idx_user_roles_user_id or idx_audit_log_actor_user_id, so
-- neither index is touched here.
--
-- RESTRICT rather than NO ACTION: NO ACTION is deferrable and is checked
-- at the end of the statement or transaction, while RESTRICT is checked
-- immediately and cannot be deferred. These are permanence relationships,
-- so they should fail at the point of the offending statement. RESTRICT
-- also matches every other foreign key on both grant tables and on
-- audit_log's remaining references.
--
-- Nothing can depend on the behavior being replaced, because neither
-- declared action has ever been able to complete. What changes is the
-- layer and the message: today the parent delete fails P0001 from an
-- immutability trigger that names a table the caller never asked to
-- touch; afterwards it fails 23503 at the foreign key, stating the actual
-- reason, and the block no longer depends on the trigger.

-- Operation 6. Live-confirmed as ON DELETE CASCADE, and the only CASCADE
-- in the repository. Migration 1 declared it; Migration 2 did not revisit
-- it when it converted user_roles into a historical grant record. The
-- cascade is unreachable: it issues a DELETE on user_roles, which
-- fn_protect_access_grant() always rejects. The latent risk is concrete,
-- because a future migration that narrowed or replaced that function would
-- immediately begin silently deleting grant history.
alter table public.user_roles
  drop constraint user_roles_user_id_fkey;

alter table public.user_roles
  add constraint user_roles_user_id_fkey
  foreign key (user_id) references public.app_users (id) on delete restrict;

-- Operation 7. Live-confirmed as ON DELETE SET NULL. The SET NULL action
-- issues an UPDATE on audit_log, and trg_audit_log_immutable rejects every
-- UPDATE on audit_log unconditionally, so the declared action can never
-- successfully execute. actor_user_id stays nullable: it is NULL whenever
-- an audited write carried no actor context, and only the delete action
-- changes here.
alter table public.audit_log
  drop constraint audit_log_actor_user_id_fkey;

alter table public.audit_log
  add constraint audit_log_actor_user_id_fkey
  foreign key (actor_user_id) references public.app_users (id) on delete restrict;


-- =============================================================================
-- Section C: comments and schema-contract documentation
-- =============================================================================

-- This section is not an afterthought. The premise of the whole migration
-- is that a declared contract and an enforced contract had drifted apart,
-- so leaving the comments outside the described structure would repeat
-- that error in miniature. Each comment below preserves the meaning of the
-- comment it replaces and adds only the hardening clarification, and each
-- distinguishes row-level UPDATE/DELETE protection from statement-level
-- TRUNCATE protection, because conflating the two is what produced the
-- defect.

comment on function public.fn_reject_truncate() is
  'Generic BEFORE TRUNCATE FOR EACH STATEMENT guard. Zero table-specific logic: '
  'raises unconditionally on every table it is attached to, with no branching, no '
  'table access, no dynamic SQL, and no success path. TG_TABLE_NAME is used only to '
  'compose the diagnostic message. Row-level UPDATE/DELETE triggers do not fire on '
  'TRUNCATE and RLS does not apply to it, so this is the statement-level twin of '
  'Platform Core''s row-level permanence and history guards. Attached to audit_log, '
  'resources, user_roles, and role_permissions. The body is a canonical contract: '
  'see docs/PLATFORM_CORE_HARDENING_DESIGN.md §9 and §16.8.0 before changing it.';

comment on table public.audit_log is
  'Database-enforced, append-only record of row mutation for audited tables. '
  'Distinct from domain events, which represent business meaning rather than '
  'row mutation (see docs/PLATFORM_ARCHITECTURE.md §7). No row in this table '
  'is ever updated or deleted, and no row is ever removed by TRUNCATE either. '
  'Enforced in two layers per operation class: trg_audit_log_immutable blocks '
  'row-level UPDATE and DELETE unconditionally, and trg_audit_log_reject_truncate '
  'blocks statement-level TRUNCATE, which row-level triggers do not fire on. Both '
  'layers are backed by privilege revocation from every application-facing role, '
  'so a future migration cannot accidentally regrant its way around them.';

comment on table public.resources is
  'Central identity registry for anything workflow, tasks, audit, events, '
  'attachments, or comments attach to. Stays thin by design: do not add status, '
  'title, or feature-specific columns here. Permanent once created: never '
  'updated or deleted, and never emptied by TRUNCATE. trg_resources_immutable '
  'blocks row-level UPDATE and DELETE unconditionally, and '
  'trg_resources_reject_truncate blocks statement-level TRUNCATE, which row-level '
  'triggers do not fire on.';

comment on table public.user_roles is
  'Historical role-assignment record. granted_at/granted_by are created_at and '
  'created_by. An active grant has revoked_at IS NULL; a revoked grant is kept, '
  'never deleted, and its columns are frozen thereafter (trg_user_roles_protect_grant). '
  'Rows are never removed by TRUNCATE either: trg_user_roles_reject_truncate blocks '
  'statement-level TRUNCATE, which the row-level grant guard does not fire on. '
  'scope_resource_id NULL = global. Non-null values reference resources.resource_id '
  'and scope the assignment to that resource. Re-granting after a revoke inserts a '
  'new row; the old one is never reactivated.';

comment on table public.role_permissions is
  'Historical permission-grant record. granted_at/granted_by are created_at and '
  'created_by. An active grant has revoked_at IS NULL; a revoked grant is kept, '
  'never deleted, and its columns are frozen thereafter '
  '(trg_role_permissions_protect_grant). Rows are never removed by TRUNCATE either: '
  'trg_role_permissions_reject_truncate blocks statement-level TRUNCATE, which the '
  'row-level grant guard does not fire on. Re-granting after a revoke inserts a new '
  'row; the old one is never reactivated.';

-- app_users itself gains no delete guard and no TRUNCATE trigger (design
-- §11.5, §13.2): removing a mistakenly created, never used identity stays
-- possible, and there is no deleted_at column. What the comment corrects
-- is the implication that hard delete never happens. Identity durability
-- comes from the dependent RESTRICT foreign keys and the audit ledger,
-- not from a delete guard, and the two corrections in Section B make the
-- two most important of those explicit rather than accidental.
comment on table public.app_users is
  'Application profile, 1:1 with auth.users. id is the same UUID as auth.users.id. '
  'is_active is the Nexus identity lifecycle flag (offboarding), not a status field '
  'for any business record. Holds no roles, permissions, or other profile fields. '
  'Offboarding is is_active = false, never a delete, but hard delete is not blocked '
  'by a trigger: identity durability comes from dependent ON DELETE RESTRICT foreign '
  'keys, which pin any identity with grant history (user_roles_user_id_fkey), any '
  'identity recorded as an audit actor (audit_log_actor_user_id_fkey), and any '
  'identity that ever created or updated a record. A hard-deletable identity is '
  'therefore narrowly limited to one with no audit history, no grant history, and no '
  'other dependent reference.';

comment on column public.user_roles.user_id is
  'The identity the role is granted to. ON DELETE RESTRICT: deleting an app_users '
  'row that holds any grant, active or revoked, fails directly at this foreign key '
  'with 23503. Corrected from ON DELETE CASCADE, which could never complete because '
  'trg_user_roles_protect_grant rejects every DELETE on this historical grant record, '
  'and which would have begun silently deleting grant history if that trigger were '
  'ever narrowed or replaced.';

comment on column public.audit_log.actor_user_id is
  'The Nexus identity that performed the audited write. NULL when the write carried '
  'no actor context; fn_audit_row never fails a write for lack of context. '
  'ON DELETE RESTRICT: deleting an app_users row recorded as an audit actor fails '
  'directly at this foreign key with 23503. Corrected from ON DELETE SET NULL, which '
  'could never complete because trg_audit_log_immutable rejects every UPDATE on '
  'audit_log, so the parent delete previously failed with P0001 from a trigger that '
  'named a table the caller never asked to touch.';
