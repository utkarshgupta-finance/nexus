-- PD-005 (D-022, Batches 1-13 Ledger Audit product decision closure):
-- extends the Resource Registry / scope_resource_id design already
-- documented as a future extension in docs/AUTHORIZATION_MODEL.md §5
-- into a real, enforced scope hierarchy: Global -> Business Unit ->
-- Territory/Geography -> Specific Customer. `user_roles.scope_resource_id`
-- already existed for exactly this; nothing about its schema changes
-- here, only that it is now actually populated and actually resolved.
--
-- Structural design note: §5 also names a nested `org_scopes`
-- (resource_id, parent_resource_id) hierarchy table for the case where
-- "access to legal entity B implies access to business units under B."
-- That table is NOT added here, because Nexus has no real BU-contains-
-- territory-contains-customer org chart to populate it with today
-- (business_unit and country are independent columns on `customers`,
-- not a nested structure), and inventing one would be inventing a
-- business mapping that does not exist. Instead, each of the three
-- scope tiers below is resolved directly and independently: a grant is
-- either global, or scoped to one specific business_unit, one specific
-- territory (country), or one specific customer. A user's effective
-- access to a customer record is the union of every active grant that
-- matches globally, matches that customer's own business_unit, matches
-- that customer's own country, or matches that customer directly. This
-- is still the documented Global -> BU -> Territory -> Customer
-- hierarchy (each tier strictly narrower than the one before it), just
-- without a literal parent/child resource tree that would have to be
-- fabricated. If a real nested org chart is needed later, `org_scopes`
-- remains buildable additively on top of this, exactly as §5 describes.

-- 1. Register the three new resource types this scope model needs.
-- 'customer' was previously and deliberately excluded from the Resource
-- Registry (20260908013210_master_data_foundation.sql); it is added now
-- because scoping specifically requires customers to be addressable as
-- resources. This does not change customers.id itself, which remains a
-- plain uuid; a paired resources row (same id) is added alongside it.
insert into resource_types (type_code, description) values
  ('customer', 'A single Customer Master record, addressable as a scope target.'),
  ('business_unit', 'A Business Unit value from the existing business_unit reference list, addressable as a scope target.'),
  ('territory', 'A Territory/Geography value, derived from the existing customers.country field (no dedicated Territory reference list exists yet), addressable as a scope target.')
on conflict (type_code) do nothing;

-- 2. Lookup tables mapping an existing business value to its stable
-- resource identity. Not new reference lists and not new business data:
-- business_unit_resources only ever contains values already present in
-- the existing business_unit reference_options list; territory_resources
-- only ever contains country values already present on a real customers
-- row. Both are backfilled from what already exists, never invented.
create table business_unit_resources (
  business_unit_key text primary key,
  resource_id uuid not null references resources (resource_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table territory_resources (
  country text primary key,
  resource_id uuid not null references resources (resource_id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table business_unit_resources is 'PD-005: stable resource identity for each existing business_unit value, so it can be a scope_resource_id target. Structural prerequisite, not a new business list; values come only from the existing business_unit reference_options.';
comment on table territory_resources is 'PD-005: stable resource identity for each existing customers.country value, so it can be a scope_resource_id target. Structural prerequisite: no dedicated Territory/Geography entity exists in Nexus yet, so country is used as the current best-available proxy, backfilled only from real, already-present customer data, never invented.';

-- 3. Backfill: one resources row per existing customer, reusing
-- customers.id as resources.resource_id directly (no separate mapping
-- table needed, unlike business_unit/territory, since customers.id is
-- already a stable uuid).
insert into resources (resource_id, resource_type, created_by)
select c.id, 'customer', c.created_by
from customers c
where not exists (select 1 from resources r where r.resource_id = c.id);

-- 4. Backfill: one resources + business_unit_resources row per distinct
-- business_unit value already present on a real customer. distinct_bu
-- deduplicates on business_unit ALONE first; only then is exactly one
-- gen_random_uuid() generated per already-distinct value in v_new_bu and
-- reused for both inserts. (A single `select distinct col, gen_random_uuid()`
-- would NOT deduplicate correctly: the volatile random value differs per
-- source row, so DISTINCT would never actually collapse two customers
-- sharing the same business_unit into one row.)
with distinct_bu as (
  select distinct business_unit as business_unit_key
  from customers
  where business_unit is not null
    and business_unit not in (select business_unit_key from business_unit_resources)
),
v_new_bu as (
  select business_unit_key, gen_random_uuid() as resource_id from distinct_bu
),
ins_resources as (
  insert into resources (resource_id, resource_type, created_by)
  select resource_id, 'business_unit', null from v_new_bu
  returning resource_id
)
insert into business_unit_resources (business_unit_key, resource_id)
select business_unit_key, resource_id from v_new_bu;

-- 5. Backfill: one resources + territory_resources row per distinct
-- country value already present on a real customer, same pattern and
-- same fix (distinct-then-generate, never distinct-with-a-random-column).
with distinct_territory as (
  select distinct country
  from customers
  where country is not null
    and country not in (select country from territory_resources)
),
v_new_territory as (
  select country, gen_random_uuid() as resource_id from distinct_territory
),
ins_resources as (
  insert into resources (resource_id, resource_type, created_by)
  select resource_id, 'territory', null from v_new_territory
  returning resource_id
)
insert into territory_resources (country, resource_id)
select country, resource_id from v_new_territory;

-- 6. Keep resources / business_unit_resources / territory_resources
-- current as new customers are created or an existing customer's
-- business_unit/country changes. Registration only, never a business
-- decision: it mints an identity for whatever value the row already
-- has, it never invents a value.
create function fn_register_customer_scope_resources() returns trigger
language plpgsql as $function$
declare
  v_bu_resource_id uuid;
  v_territory_resource_id uuid;
begin
  if tg_op = 'INSERT' then
    insert into resources (resource_id, resource_type, created_by)
    values (new.id, 'customer', new.created_by)
    on conflict (resource_id) do nothing;
  end if;

  if new.business_unit is not null then
    select resource_id into v_bu_resource_id from business_unit_resources where business_unit_key = new.business_unit;
    if v_bu_resource_id is null then
      insert into resources (resource_id, resource_type, created_by) values (gen_random_uuid(), 'business_unit', new.updated_by)
      returning resource_id into v_bu_resource_id;
      insert into business_unit_resources (business_unit_key, resource_id) values (new.business_unit, v_bu_resource_id)
      on conflict (business_unit_key) do nothing;
    end if;
  end if;

  if new.country is not null then
    select resource_id into v_territory_resource_id from territory_resources where country = new.country;
    if v_territory_resource_id is null then
      insert into resources (resource_id, resource_type, created_by) values (gen_random_uuid(), 'territory', new.updated_by)
      returning resource_id into v_territory_resource_id;
      insert into territory_resources (country, resource_id) values (new.country, v_territory_resource_id)
      on conflict (country) do nothing;
    end if;
  end if;

  return new;
end;
$function$;

create trigger trg_register_customer_scope_resources
  after insert or update of business_unit, country on customers
  for each row execute function fn_register_customer_scope_resources();

-- 7. Resolve every scope_resource_id a given customer record satisfies:
-- its own customer-resource id, its business_unit's resource id (if
-- registered), and its territory's resource id (if registered). Used by
-- the permission check below and directly reusable by the TypeScript
-- layer for building an admin-facing "what does this scope cover"
-- display if ever needed.
create function fn_customer_scope_resource_ids(p_customer_id uuid) returns table (resource_id uuid)
language sql stable as $function$
  select p_customer_id
  union
  select bur.resource_id from customers c join business_unit_resources bur on bur.business_unit_key = c.business_unit where c.id = p_customer_id
  union
  select tr.resource_id from customers c join territory_resources tr on tr.country = c.country where c.id = p_customer_id;
$function$;

-- 8. The actual scoped-access check: does this user hold any currently
-- active grant, for this resource/action, that is either global or
-- matches one of this customer's own scope resource ids (its own
-- customer id, its business_unit, or its territory)? Mirrors the exact
-- resolution chain docs/AUTHORIZATION_MODEL.md §13 already documents
-- (app_users -> user_roles (active) -> roles (active) -> role_permissions
-- (active) -> permissions (active)), extended to also accept a scoped
-- user_roles row when it matches.
create function fn_user_has_customer_scoped_permission(p_user_id uuid, p_resource text, p_action text, p_customer_id uuid) returns boolean
language sql stable as $function$
  select exists (
    select 1
    from user_roles ur
    join roles ro on ro.id = ur.role_id and ro.is_active
    join role_permissions rp on rp.role_id = ro.id and rp.revoked_at is null
    join permissions pe on pe.id = rp.permission_id and pe.is_active
    where ur.user_id = p_user_id
      and ur.revoked_at is null
      and pe.resource = p_resource
      and pe.action = p_action
      and (
        ur.scope_resource_id is null
        or ur.scope_resource_id in (select resource_id from fn_customer_scope_resource_ids(p_customer_id))
      )
  );
$function$;

-- 9. Grant a scoped role: exactly one of the three scope parameters must
-- be provided (matching this task's "Global / BU / Territory / Customer"
-- scope semantics; a plain global grant continues to use the existing
-- grant_user_role, unchanged). Resolves the given business value to its
-- registered resource id and inserts the scoped user_roles row. Mirrors
-- grant_user_role's own ROLE_INACTIVE guard and idempotent-on-existing
-- pattern exactly.
create function grant_scoped_user_role(
  p_user_id uuid,
  p_role_id uuid,
  p_scope_business_unit text,
  p_scope_territory text,
  p_scope_customer_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns user_roles
language plpgsql
security invoker
as $function$
declare
  v_row user_roles;
  v_role_is_active boolean;
  v_scope_resource_id uuid;
  v_scope_count int;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  v_scope_count := (case when p_scope_business_unit is not null then 1 else 0 end)
                 + (case when p_scope_territory is not null then 1 else 0 end)
                 + (case when p_scope_customer_id is not null then 1 else 0 end);
  if v_scope_count <> 1 then
    raise exception 'SCOPED_GRANT_REQUIRES_EXACTLY_ONE_SCOPE: provide exactly one of scope_business_unit, scope_territory, or scope_customer_id; use grant_user_role for a global grant';
  end if;

  select is_active into v_role_is_active from roles where id = p_role_id;
  if not found then
    raise exception 'ROLE_NOT_FOUND: no roles row for id %', p_role_id;
  end if;
  if not v_role_is_active then
    raise exception 'ROLE_INACTIVE: this role is deactivated and cannot be granted. Reactivate it first, or choose an active role.';
  end if;

  if p_scope_customer_id is not null then
    if not exists (select 1 from resources where resource_id = p_scope_customer_id and resource_type = 'customer') then
      raise exception 'SCOPE_CUSTOMER_NOT_FOUND: no registered customer resource for id %', p_scope_customer_id;
    end if;
    v_scope_resource_id := p_scope_customer_id;
  elsif p_scope_business_unit is not null then
    select resource_id into v_scope_resource_id from business_unit_resources where business_unit_key = p_scope_business_unit;
    if v_scope_resource_id is null then
      raise exception 'SCOPE_BUSINESS_UNIT_NOT_FOUND: % is not a registered business_unit value', p_scope_business_unit;
    end if;
  else
    select resource_id into v_scope_resource_id from territory_resources where country = p_scope_territory;
    if v_scope_resource_id is null then
      raise exception 'SCOPE_TERRITORY_NOT_FOUND: % is not a registered territory value', p_scope_territory;
    end if;
  end if;

  select * into v_row from user_roles
  where user_id = p_user_id and role_id = p_role_id and scope_resource_id = v_scope_resource_id and revoked_at is null;
  if found then
    return v_row;
  end if;

  insert into user_roles (user_id, role_id, scope_resource_id, created_by)
  values (p_user_id, p_role_id, v_scope_resource_id, p_actor_user_id)
  on conflict (user_id, role_id, scope_resource_id) where scope_resource_id is not null and revoked_at is null do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from user_roles
    where user_id = p_user_id and role_id = p_role_id and scope_resource_id = v_scope_resource_id and revoked_at is null;
  end if;

  return v_row;
end;
$function$;

revoke execute on function fn_register_customer_scope_resources() from public, anon, authenticated;
revoke execute on function fn_customer_scope_resource_ids(uuid) from public, anon, authenticated;
revoke execute on function fn_user_has_customer_scoped_permission(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function grant_scoped_user_role(uuid, uuid, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function fn_user_has_customer_scoped_permission(uuid, text, text, uuid) to service_role;
grant execute on function grant_scoped_user_role(uuid, uuid, text, text, uuid, uuid, jsonb) to service_role;
