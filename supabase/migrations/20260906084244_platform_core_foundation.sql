-- Nexus Platform Core: foundation migration.
--
-- Creates the minimum durable platform core described in:
--   docs/PLATFORM_ARCHITECTURE.md
--   docs/DATA_ARCHITECTURE.md
--   docs/AUTHORIZATION_MODEL.md
--
-- Scope: application identity (app_users), the Resource Registry
-- (resource_types, resources), authorization (roles, permissions,
-- role_permissions, user_roles), and the database-enforced audit
-- mechanism (audit_log, audit trigger function, immutability).
--
-- Out of scope for this migration (see docs/PLATFORM_ARCHITECTURE.md §12):
-- workflow, tasks, domain events, notifications, policy/configuration
-- tables, attachments, comments. Nothing here seeds real Nexus role,
-- permission, or workflow data; this migration is schema only.
--
-- RLS: every table uses ENABLE ROW LEVEL SECURITY, not FORCE, at this
-- stage, with zero policies. anon/authenticated gain no direct table
-- access from this migration; the application-service layer remains the
-- trusted data-access path (docs/AUTHORIZATION_MODEL.md §6).
--
-- This file has not been applied to any database.


-- =============================================================================
-- Common utilities
-- =============================================================================

-- Reusable trigger: keeps `updated_at` current on every UPDATE. Attached only
-- to tables that have an `updated_at` column.
create function fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function fn_set_updated_at() is
  'Sets updated_at = now() on UPDATE. Attach to any table with an updated_at column.';


-- =============================================================================
-- Application identity
-- =============================================================================

-- 1:1 with auth.users. Nexus reuses the Supabase Auth UUID as its own user
-- ID rather than minting a second identifier. Supabase Auth answers "who is
-- this person"; is_active answers "is this person currently active in
-- Nexus"; roles/permissions answer "what is an active person allowed to
-- do" (see docs/AUTHORIZATION_MODEL.md). Nexus application identity is
-- historical and must survive independently of the authentication
-- identity: ON DELETE RESTRICT, not CASCADE, so deleting an auth.users row
-- cannot silently remove a Nexus identity that other records still refer
-- to. Offboarding is `is_active = false`, never a delete.
create table app_users (
  id         uuid primary key references auth.users (id) on delete restrict,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app_users is
  'Application profile, 1:1 with auth.users. id is the same UUID as auth.users.id. '
  'is_active is the Nexus identity lifecycle flag (offboarding), not a status field '
  'for any business record. Holds no roles, permissions, or other profile fields.';

create trigger trg_app_users_updated_at
  before update on app_users
  for each row
  execute function fn_set_updated_at();

alter table app_users enable row level security;


-- =============================================================================
-- Resource Registry
-- =============================================================================

-- Structural application metadata: which resource types exist. Managed
-- through migrations only, never through a Settings screen, so
-- resources.resource_type cannot drift into uncontrolled free text.
create table resource_types (
  type_code   text primary key,
  description text not null,
  created_at  timestamptz not null default now()
);

comment on table resource_types is
  'Catalog of resource types accepted by the Resource Registry. Migration-managed '
  'structural metadata, not user-editable configuration.';

alter table resource_types enable row level security;

-- The Resource Registry itself. Deliberately thin: identity only, no status,
-- no title, no feature metadata. A participating business table reuses
-- resource_id as its own primary key (see docs/DATA_ARCHITECTURE.md §2).
--
-- Lifecycle: resources is a permanent identity spine, not a business
-- table. A feature record that reuses resource_id may later become
-- inactive, archived, soft deleted, churned, or superseded, entirely on
-- the feature's own table; the resources row itself never reflects that
-- and is never removed, so audit, workflow, tasks, events, attachments,
-- comments, and external API references stay resolvable regardless of
-- the feature record's own lifecycle. When a future feature table is
-- migrated in, minting its resource and inserting its own row must
-- happen in one transaction, so a failed feature insert rolls back the
-- resource mint too.
create table resources (
  resource_id   uuid primary key default gen_random_uuid(),
  resource_type text not null references resource_types (type_code) on delete restrict,
  created_at    timestamptz not null default now(),
  created_by    uuid references app_users (id) on delete restrict
);

comment on table resources is
  'Central identity registry for anything workflow, tasks, audit, events, '
  'attachments, or comments attach to. Stays thin by design: do not add status, '
  'title, or feature-specific columns here. Permanent once created: never '
  'updated or deleted, see trg_resources_immutable below.';

create index idx_resources_resource_type on resources (resource_type);
create index idx_resources_created_by on resources (created_by);

-- resource_id and resource_type are identity, not state, so they must never
-- change after creation, and the row itself must never disappear while
-- Nexus still relies on resource_id being permanently resolvable. Blocking
-- UPDATE and DELETE outright (rather than only guarding the two identity
-- columns) is the simplest rule that matches "permanent identity spine":
-- there is no legitimate reason to modify a resources row at all.
create function fn_resources_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'resources is a permanent identity registry: % is not permitted', tg_op;
end;
$$;

comment on function fn_resources_immutable() is
  'Blocks UPDATE and DELETE on resources unconditionally. Resource identity is permanent.';

create trigger trg_resources_immutable
  before update or delete on resources
  for each row
  execute function fn_resources_immutable();

-- Ordinary Resource Registry inserts are not audited here: they are pure
-- identity minting with no business state of their own. Business-state
-- auditing belongs on the feature/configuration table that reuses
-- resource_id, not on this table.
alter table resources enable row level security;


-- =============================================================================
-- Authorization
-- =============================================================================

-- Named, configurable groupings of permissions. Deactivated via is_active
-- rather than deleted, so historical role_permissions/user_roles rows are
-- never orphaned by removing a role from use.
create table roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references app_users (id) on delete restrict,
  updated_by  uuid references app_users (id) on delete restrict
);

comment on table roles is
  'Configurable role catalog. No real Nexus role names are seeded by this migration.';

create index idx_roles_created_by on roles (created_by);
create index idx_roles_updated_by on roles (updated_by);

create trigger trg_roles_updated_at
  before update on roles
  for each row
  execute function fn_set_updated_at();

alter table roles enable row level security;

-- Resource + action pairs. "Resource" here is a permission-type-level
-- concept (docs/AUTHORIZATION_MODEL.md §3), distinct from the Resource
-- Registry above, which identifies specific record instances.
create table permissions (
  id          uuid primary key default gen_random_uuid(),
  resource    text not null,
  action      text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references app_users (id) on delete restrict,
  updated_by  uuid references app_users (id) on delete restrict,
  unique (resource, action)
);

comment on table permissions is
  'Resource + action catalog. No real Nexus permissions are seeded by this migration.';

create index idx_permissions_created_by on permissions (created_by);
create index idx_permissions_updated_by on permissions (updated_by);

create trigger trg_permissions_updated_at
  before update on permissions
  for each row
  execute function fn_set_updated_at();

alter table permissions enable row level security;

-- Which permissions a role grants. Grant/revoke, not edit-in-place: no
-- updated_at. Revoking a permission removes the row; the removal itself is
-- captured by the audit trigger below.
create table role_permissions (
  id            uuid primary key default gen_random_uuid(),
  role_id       uuid not null references roles (id) on delete restrict,
  permission_id uuid not null references permissions (id) on delete restrict,
  created_at    timestamptz not null default now(),
  created_by    uuid references app_users (id) on delete restrict,
  unique (role_id, permission_id)
);

create index idx_role_permissions_role_id on role_permissions (role_id);
create index idx_role_permissions_permission_id on role_permissions (permission_id);
create index idx_role_permissions_created_by on role_permissions (created_by);

alter table role_permissions enable row level security;

-- Which roles a user holds. scope_resource_id is nullable: NULL means a
-- global assignment; a non-null value scopes the assignment to that
-- resource, whatever type it is (docs/AUTHORIZATION_MODEL.md §5). No scope
-- type is assigned by this migration; only the global case is used.
create table user_roles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references app_users (id) on delete cascade,
  role_id           uuid not null references roles (id) on delete restrict,
  scope_resource_id uuid references resources (resource_id) on delete restrict,
  created_at        timestamptz not null default now(),
  created_by        uuid references app_users (id) on delete restrict
);

comment on table user_roles is
  'Role assignments. scope_resource_id NULL = global. Non-null values reference '
  'resources.resource_id and scope the assignment to that resource.';

create index idx_user_roles_user_id on user_roles (user_id);
create index idx_user_roles_role_id on user_roles (role_id);
create index idx_user_roles_scope_resource_id on user_roles (scope_resource_id);
create index idx_user_roles_created_by on user_roles (created_by);

-- One active global assignment per (user, role); one active assignment per
-- (user, role, scope) once scoped assignment is used. Two partial indexes
-- because a plain UNIQUE(user_id, role_id, scope_resource_id) would treat
-- every NULL scope as distinct and never actually enforce the global case.
create unique index uq_user_roles_global
  on user_roles (user_id, role_id)
  where scope_resource_id is null;

create unique index uq_user_roles_scoped
  on user_roles (user_id, role_id, scope_resource_id)
  where scope_resource_id is not null;

alter table user_roles enable row level security;


-- =============================================================================
-- Audit
-- =============================================================================

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  resource_id   uuid references resources (resource_id) on delete restrict,
  table_name    text not null,
  row_id        uuid not null,
  action        text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  before_value  jsonb,
  after_value   jsonb,
  occurred_at   timestamptz not null default now(),
  actor_user_id uuid references app_users (id) on delete set null,
  request_id    uuid,
  actor_context jsonb
);

comment on table audit_log is
  'Database-enforced, append-only record of row mutation for audited tables. '
  'Distinct from domain events, which represent business meaning rather than '
  'row mutation (see docs/PLATFORM_ARCHITECTURE.md §7). No row in this table '
  'is ever updated or deleted; see trg_audit_log_immutable below.';

create index idx_audit_log_resource_id on audit_log (resource_id);
create index idx_audit_log_actor_user_id on audit_log (actor_user_id);
create index idx_audit_log_table_row on audit_log (table_name, row_id);
create index idx_audit_log_occurred_at on audit_log (occurred_at);

-- Generic audit trigger. Takes exactly one trigger argument: the name of
-- the audited table's primary-key column. Current tables use `id`
-- (execute function fn_audit_row('id')); future resource-backed feature
-- tables that reuse resource_id as their own primary key must attach with
-- execute function fn_audit_row('resource_id') instead. The PK value is
-- read from the row's own JSONB representation using that argument as the
-- JSON key (TG_ARGV[0] ->> the key), never as dynamic SQL. resource_id
-- for the audit_log row is still detected separately, by literal key
-- lookup for a `resource_id` column on the audited row where one exists;
-- for a resource-backed table, row_id and resource_id will legitimately be
-- equal, which is expected, not a bug. Acting-user context is read from
-- transaction-local settings the application service sets with
-- `set_config('app.current_user_id', ..., true)` (and similarly for
-- app.request_id / app.actor_context) at the start of a request. A missing
-- setting simply yields NULL; the trigger never fails a write for lack of
-- context.
--
-- SECURITY DEFINER, with search_path locked down, is required here:
-- audit_log has RLS enabled with zero policies, so an invoker-rights
-- trigger would have its own INSERT into audit_log denied for any
-- non-bypassing role, including a future `authenticated` caller who is
-- validly permitted (by a real policy on the audited table itself) to
-- perform the write that triggers this function. Running as definer lets
-- the audit write succeed regardless of the calling role's own access to
-- audit_log, independent of whether the audited table uses ENABLE or
-- FORCE RLS. search_path is locked to pg_catalog only, not `public`, so
-- name resolution cannot be hijacked by a same-named object created in
-- another schema earlier in some other search_path; audit_log is
-- therefore referenced with its full schema-qualified name below
-- (`public.audit_log`). Every other name used in this function (to_jsonb,
-- nullif, current_setting, the uuid/jsonb/text types, tg_op/tg_argv/
-- tg_table_name) is a built-in resolved from pg_catalog regardless, so no
-- further qualification is needed.
--
-- Privilege-escalation / dynamic-SQL review: this function takes one
-- fixed, migration-supplied trigger argument (never caller-supplied at
-- runtime) and builds no dynamic SQL (no EXECUTE, no string-built
-- identifiers or table names). It only reads TG_OP/TG_TABLE_NAME/TG_ARGV/
-- NEW/OLD, which are trigger-context values the caller cannot redirect to
-- another table or schema, and three session GUCs cast to fixed types
-- (uuid/jsonb). The only statement it runs is a fixed, literal INSERT
-- into public.audit_log. There is no path by which a caller can use this
-- SECURITY DEFINER function to read or write anything beyond appending
-- one row shaped exactly as written here.
create function fn_audit_row()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_row       jsonb;
  v_pk_column text;
  v_row_id    uuid;
  v_res_id    uuid;
begin
  if tg_nargs <> 1 or tg_argv[0] is null or tg_argv[0] = '' then
    raise exception
      'fn_audit_row requires exactly one trigger argument: the primary key '
      'column name (e.g. ''id'' or ''resource_id''), got % argument(s) on table %',
      tg_nargs, tg_table_name;
  end if;
  v_pk_column := tg_argv[0];

  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_row_id := (v_row ->> v_pk_column)::uuid;
  v_res_id := nullif(v_row ->> 'resource_id', '')::uuid;

  insert into public.audit_log (
    resource_id, table_name, row_id, action,
    before_value, after_value,
    actor_user_id, request_id, actor_context
  )
  values (
    v_res_id,
    tg_table_name,
    v_row_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    nullif(current_setting('app.current_user_id', true), '')::uuid,
    nullif(current_setting('app.request_id', true), '')::uuid,
    nullif(current_setting('app.actor_context', true), '')::jsonb
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function fn_audit_row() is
  'Generic AFTER INSERT/UPDATE/DELETE audit trigger. Requires exactly one trigger '
  'argument: the primary key column name, e.g. fn_audit_row(''id'') for current '
  'tables or fn_audit_row(''resource_id'') for future resource-backed feature '
  'tables. Captures resource_id separately when the audited row has one.';

-- Immutability, enforced twice: the REVOKE below removes UPDATE/DELETE
-- privilege from every application-facing role, and this trigger blocks
-- UPDATE/DELETE unconditionally regardless of privilege, so a future
-- migration cannot accidentally regrant its way around it.
create function fn_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only: % is not permitted', tg_op;
end;
$$;

comment on function fn_audit_log_immutable() is
  'Blocks UPDATE and DELETE on audit_log unconditionally. Audit rows are never edited or removed.';

create trigger trg_audit_log_immutable
  before update or delete on audit_log
  for each row
  execute function fn_audit_log_immutable();

-- Belt-and-suspenders: remove UPDATE/DELETE privilege on audit_log from
-- every Supabase application-facing role, in addition to the trigger
-- above. service_role is included because BYPASSRLS bypasses row security
-- policies, not ordinary GRANT/REVOKE privilege, so this REVOKE still
-- applies to it. fn_audit_row() only ever performs INSERT, so this does
-- not affect the audit mechanism itself.
revoke update, delete on audit_log from authenticated, anon, service_role;

-- Attach the generic audit trigger to the authorization tables and
-- app_users. resource_types and resources are intentionally not audited
-- here: resource_types is migration-only structural metadata, and
-- resources is identity-only (insert-once, no update path exists yet).
create trigger trg_audit_app_users
  after insert or update or delete on app_users
  for each row execute function fn_audit_row('id');

create trigger trg_audit_roles
  after insert or update or delete on roles
  for each row execute function fn_audit_row('id');

create trigger trg_audit_permissions
  after insert or update or delete on permissions
  for each row execute function fn_audit_row('id');

create trigger trg_audit_role_permissions
  after insert or update or delete on role_permissions
  for each row execute function fn_audit_row('id');

create trigger trg_audit_user_roles
  after insert or update or delete on user_roles
  for each row execute function fn_audit_row('id');

alter table audit_log enable row level security;


-- =============================================================================
-- Row Level Security: deny-by-default
-- =============================================================================

-- RLS is enabled on every table above (FORCE is deliberately not used at
-- this stage; see the migration header). Deliberately no policies are
-- created in this migration: with RLS enabled and zero policies, `anon`
-- and `authenticated` are denied all access by default, and gain no
-- direct table access from this migration. This is a defense-in-depth
-- boundary; primary authorization stays in the application-service layer
-- (docs/AUTHORIZATION_MODEL.md §6), which is the trusted data-access path
-- and is expected to connect as a role that is not subject to RLS. A
-- permissive `USING (true)` policy is not created merely to make
-- development easier, and direct browser access to any of these tables
-- remains denied until a specific policy is designed and approved.
