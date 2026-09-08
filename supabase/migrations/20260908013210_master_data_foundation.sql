-- Nexus: Master Data Foundation (Customer + Capability).
--
-- Translates the locked docs/MASTER_DATA_FOUNDATION_DESIGN.md and
-- docs/MASTER_DATA_FOUNDATION_MIGRATION_DESIGN.md into schema. Creates
-- the smallest canonical Customer and Capability/Workflow identities so
-- a future Commercial migration can add real foreign keys for
-- commercial_configurations.customer_id and
-- commercial_component_capabilities.capability_id, instead of
-- unenforced UUID references.
--
-- Scope: exactly two tables, customers and capabilities, plus only the
-- trigger functions/triggers the locked design requires for each.
--
-- Out of scope, deliberately: any Commercial table, the Form Data
-- Source Resolver, Customer 360, CRM, a Product Catalog, Entitlement,
-- Usage, any seed business data (no Customer or Capability row is
-- inserted by this migration), any resource_types row for 'customer' or
-- 'capability', any resources row, and fn_assert_resource_type: neither
-- table is resource-backed (docs/MASTER_DATA_FOUNDATION_DESIGN.md §5.4,
-- §6.4).
--
-- Neither table participates in the Resource Registry, so this
-- migration never touches resource_types or resources.
--
-- This file has not been applied to any database. Migration atomicity
-- (whether this whole file applies as one all-or-nothing unit under the
-- installed Supabase CLI) is UNVERIFIED as of this migration's
-- authoring; see docs/MASTER_DATA_FOUNDATION_MIGRATION_DESIGN.md §22.
-- No explicit BEGIN/COMMIT is added here while that remains unverified,
-- matching every other migration in this repository, none of which
-- contains a top-level transaction-control statement.


-- =============================================================================
-- customers: canonical Customer identity
-- =============================================================================

-- Not resource-backed (docs/MASTER_DATA_FOUNDATION_DESIGN.md §5.4): a
-- Customer row is a stable master identity, not an independently
-- actioned object; the Commercial Change/Request that eventually
-- references a Customer already provides the approval trail, comments,
-- and task/workflow anchor a resource-backed table would exist for.
-- id is a plain uuid, not a resource_id.
create table customers (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  is_active   boolean not null default true,
  row_version integer not null default 1,
  created_at  timestamptz not null default now(),
  created_by  uuid references app_users (id) on delete restrict,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users (id) on delete restrict,

  constraint chk_customers_row_version_positive check (row_version >= 1)
);

comment on table customers is
  'Canonical Nexus Customer identity. key is stable and immutable once set; '
  'name is an editable display label. is_active is a reversible current-activity/ '
  'selectability flag, not a churn marker and not one-way: a returning customer may '
  'be represented either by reactivating this same row (is_active false -> true) or '
  'by a new customers row, a business decision this table does not encode. No hard '
  'delete, no deleted_at: history that already references a customers row must '
  'remain resolvable forever. See docs/MASTER_DATA_FOUNDATION_DESIGN.md §5.';

comment on column customers.is_active is
  'Reversible selectability flag. Both true -> false and false -> true are '
  'permitted; see fn_protect_customer_lifecycle(). Not a substitute for a future '
  'Customer 360 churn concept.';


-- =============================================================================
-- capabilities: canonical Capability/Workflow identity
-- =============================================================================

-- Not resource-backed (docs/MASTER_DATA_FOUNDATION_DESIGN.md §6.4): pure
-- reference/catalog data, the same category as measurement_definitions;
-- a Capability row is never independently actioned. id is a plain uuid,
-- not a resource_id.
create table capabilities (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  status      text not null default 'active' check (status in ('active', 'deprecated')),
  row_version integer not null default 1,
  created_at  timestamptz not null default now(),
  created_by  uuid references app_users (id) on delete restrict,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users (id) on delete restrict,

  constraint chk_capabilities_row_version_positive check (row_version >= 1)
);

comment on table capabilities is
  'Canonical Nexus Capability/Workflow identity (for example, a fictional SFA or '
  'DMS capability reference). key is stable and immutable once set; name is an '
  'editable display label. status is one-way (active -> deprecated only): unlike '
  'customers.is_active, a deprecated Capability is never reactivated, since a '
  'genuine semantic change is represented by a new Capability identity, not an '
  'edited or reactivated old one. No hard delete, no deleted_at. See '
  'docs/MASTER_DATA_FOUNDATION_DESIGN.md §6.';

comment on column capabilities.status is
  'One-way lifecycle: active -> deprecated only. deprecated -> active is rejected '
  'by fn_protect_capability_lifecycle(). A retired Capability remains valid on '
  'every historical reference that already used it.';


-- =============================================================================
-- Customer lifecycle protection
-- =============================================================================

-- Combined identity-immutability and DELETE guard in one trigger, the
-- same shape already proven by fn_protect_form_version_lifecycle():
-- SECURITY INVOKER (no privilege elevation needed, this function only
-- inspects OLD/NEW and raises or passes the row through), and the core
-- comparison deliberately excludes row_version/updated_at/updated_by so
-- this function's verdict never depends on those columns' values,
-- regardless of trigger firing order relative to
-- trg_customers_row_version/trg_customers_updated_at.
--
-- is_active is also excluded from the core comparison: this is the
-- locked, corrected business rule (docs/MASTER_DATA_FOUNDATION_DESIGN.md
-- §5.2, §5.2a) that is_active is reversible in both directions, not a
-- one-way switch. This function does not decide whether a particular
-- reactivation is the "same" canonical customer or a "different" one;
-- that identity judgment is explicitly a future business decision, not
-- a database rule (docs/MASTER_DATA_FOUNDATION_DESIGN.md §5.2a).
create function fn_protect_customer_lifecycle()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'customers is a permanent master identity: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  -- tg_op = 'UPDATE'. name, is_active, row_version, updated_at, and
  -- updated_by are the only columns ever permitted to change; is_active
  -- is permitted to move in either direction, so it is excluded from
  -- this comparison rather than checked for a specific transition.
  v_old_core := to_jsonb(old) - 'name' - 'is_active' - 'row_version' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new) - 'name' - 'is_active' - 'row_version' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'customers is a permanent master identity: only name, is_active, row_version, '
      'updated_at, and updated_by may change (id=%)', old.id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_customer_lifecycle() is
  'Enforces customers lifecycle: no DELETE; UPDATE may change only name/is_active/ '
  'row_version/updated_at/updated_by; id/key/created_at/created_by are immutable. '
  'is_active is deliberately not restricted to one direction: docs/ '
  'MASTER_DATA_FOUNDATION_DESIGN.md §5.2/§5.2a locks it as reversible.';

create trigger trg_customers_protect_lifecycle
  before insert or update or delete on customers
  for each row
  execute function fn_protect_customer_lifecycle();


-- =============================================================================
-- Capability lifecycle protection
-- =============================================================================

-- Same combined shape as fn_protect_customer_lifecycle(), but with the
-- opposite is_active-equivalent rule: status is one-way. SECURITY
-- INVOKER for the same reason. The core comparison excludes name/status/
-- row_version/updated_at/updated_by so this function's verdict never
-- depends on those columns' values, independent of trigger firing order.
create function fn_protect_capability_lifecycle()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'capabilities is a permanent master identity: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'active' then
      raise exception
        'capabilities: a new Capability must be created active (got status=%)', new.status;
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE'. name, status, row_version, updated_at, and
  -- updated_by are the only columns ever permitted to change.
  v_old_core := to_jsonb(old) - 'name' - 'status' - 'row_version' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new) - 'name' - 'status' - 'row_version' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'capabilities is a permanent master identity: only name, status, row_version, '
      'updated_at, and updated_by may change (id=%)', old.id;
  end if;

  -- Unlike customers.is_active, status is one-way: a semantic change is
  -- represented by a new Capability identity, never a reactivated old
  -- one (docs/MASTER_DATA_FOUNDATION_DESIGN.md §6.3). The CHECK
  -- constraint already rejects any value outside ('active','deprecated');
  -- this is the one remaining transition to reject within that set.
  if old.status = 'deprecated' and new.status = 'active' then
    raise exception
      'capabilities: deprecated -> active is not permitted (id=%); a semantic '
      'change is a new Capability identity, not a reactivation', old.id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_capability_lifecycle() is
  'Enforces capabilities lifecycle: no DELETE; a new row must start active; UPDATE '
  'may change only name/status/row_version/updated_at/updated_by; id/key/created_at/ '
  'created_by are immutable; status is one-way (active -> deprecated only), unlike '
  'customers.is_active. See docs/MASTER_DATA_FOUNDATION_DESIGN.md §6.3.';

create trigger trg_capabilities_protect_lifecycle
  before insert or update or delete on capabilities
  for each row
  execute function fn_protect_capability_lifecycle();


-- =============================================================================
-- Row-version and updated_at triggers (reusing existing functions unchanged)
-- =============================================================================

-- fn_bump_row_version() and fn_set_updated_at() already exist (Migration
-- 1, Migration 4) and are reused verbatim; neither is redefined here.
-- row_version is entirely database-maintained: a caller's UPDATE never
-- sets it directly, only the WHERE-clause precondition
-- (row_version = expected) is the caller's to control
-- (docs/MASTER_DATA_FOUNDATION_MIGRATION_DESIGN.md §7).
--
-- Trigger names are chosen so the alphabetical BEFORE UPDATE firing
-- order is protect_lifecycle, then row_version, then updated_at,
-- matching the ordering already established for form_versions
-- (docs/FORM_VERSIONING_MODEL.md §9-11). Correctness does not depend on
-- this order, since neither lifecycle function inspects row_version or
-- updated_at, but the names are chosen deliberately, not left to
-- accident (docs/MASTER_DATA_FOUNDATION_MIGRATION_DESIGN.md §11).
create trigger trg_customers_row_version
  before update on customers
  for each row
  execute function fn_bump_row_version();

create trigger trg_customers_updated_at
  before update on customers
  for each row
  execute function fn_set_updated_at();

create trigger trg_capabilities_row_version
  before update on capabilities
  for each row
  execute function fn_bump_row_version();

create trigger trg_capabilities_updated_at
  before update on capabilities
  for each row
  execute function fn_set_updated_at();


-- =============================================================================
-- Audit
-- =============================================================================

-- Generic full-row audit, reusing fn_audit_row('id') unmodified, the
-- same conclusion already reached for form_definitions and
-- commercial_configurations: small rows, infrequent writes, no
-- payload-size concern that would justify a narrower, targeted audit
-- trigger. Attached to fire on DELETE too, matching the existing
-- form_definitions/form_versions convention exactly, even though DELETE
-- can never actually reach this AFTER trigger: the BEFORE lifecycle
-- trigger above unconditionally raises on any DELETE attempt first,
-- aborting the statement before this trigger would fire, so a rejected
-- DELETE never produces a misleading audit row.
create trigger trg_audit_customers
  after insert or update or delete on customers
  for each row execute function fn_audit_row('id');

create trigger trg_audit_capabilities
  after insert or update or delete on capabilities
  for each row execute function fn_audit_row('id');


-- =============================================================================
-- Privilege hardening
-- =============================================================================

-- Migration 2 already sets `alter default privileges for role postgres
-- in schema public revoke all on tables/sequences from anon,
-- authenticated` and `revoke execute on functions from anon,
-- authenticated`, so customers, capabilities, and the two new lifecycle
-- functions above already have zero anon/authenticated privileges the
-- moment they are created. The explicit REVOKEs below are
-- defense-in-depth, not a correction, following Migration 4's own
-- stated reasoning verbatim: a default-privilege rule alone should not
-- be relied on exclusively. No sequence exists for either table (both
-- use gen_random_uuid() as a column default, not an IDENTITY column),
-- so there is no sequence privilege to revoke here.
revoke all on table customers, capabilities from anon, authenticated;

revoke execute on function
  fn_protect_customer_lifecycle(),
  fn_protect_capability_lifecycle()
from public, anon, authenticated;


-- =============================================================================
-- Row Level Security: deny-by-default
-- =============================================================================

-- Same posture as every existing Platform Core table
-- (docs/DATA_ARCHITECTURE.md §12): ENABLE, not FORCE, RLS; zero
-- policies. anon/authenticated are denied all direct access to
-- customers and capabilities by RLS itself, beneath the privilege
-- hardening above. The application-service layer, connecting as
-- service_role, remains the trusted data-access path.
alter table customers enable row level security;
alter table capabilities enable row level security;
