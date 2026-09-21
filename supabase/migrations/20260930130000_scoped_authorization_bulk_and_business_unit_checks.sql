-- PD-005 (D-022, Product Decision Closure follow-up): extends the scoped
-- authorization foundation (20260930110000) with the two capabilities
-- the single-record check (fn_user_has_customer_scoped_permission) does
-- not cover: (1) bulk resolution for LIST/search surfaces, so a scoped
-- user's list is genuinely filtered, not just gated at the page level;
-- (2) a business_unit-only check for Customer Onboarding cases before
-- approval, when no customer row exists yet to scope by. Both reuse the
-- exact same resources/business_unit_resources/territory_resources
-- tables and the exact same resolution chain; nothing new is invented.

-- Every customer id a user can act on for (resource, action): every
-- customer, if the user holds a global grant; otherwise every customer
-- whose own id/business_unit/territory resource matches one of the
-- user's scoped grants.
create function fn_user_scoped_customer_ids(p_user_id uuid, p_resource text, p_action text) returns table (customer_id uuid)
language sql stable as $function$
  select c.id
  from customers c
  where exists (
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
        or ur.scope_resource_id = c.id
        or ur.scope_resource_id in (select resource_id from business_unit_resources where business_unit_key = c.business_unit)
        or ur.scope_resource_id in (select resource_id from territory_resources where country = c.country)
      )
  );
$function$;

-- Business-unit-only check, for a record that does not yet have a
-- resolved customer (a Customer Onboarding case before approval creates
-- one). Global grant passes as always; otherwise the grant must be
-- scoped directly to this business_unit's own resource.
create function fn_user_has_business_unit_scoped_permission(p_user_id uuid, p_resource text, p_action text, p_business_unit text) returns boolean
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
        or (p_business_unit is not null and ur.scope_resource_id in (select resource_id from business_unit_resources where business_unit_key = p_business_unit))
      )
  );
$function$;

-- Every business_unit value a user can act on for (resource, action):
-- every value, if the user holds a global grant; otherwise only the
-- business_unit values their scoped grants directly cover. Used to
-- filter the Onboarding portion of cross-customer list surfaces
-- (Approvals inbox, My Work, Operational Queue) without a resolved
-- customer id to filter by.
create function fn_user_scoped_business_units(p_user_id uuid, p_resource text, p_action text) returns table (business_unit_key text)
language sql stable as $function$
  select bur.business_unit_key
  from business_unit_resources bur
  where exists (
    select 1
    from user_roles ur
    join roles ro on ro.id = ur.role_id and ro.is_active
    join role_permissions rp on rp.role_id = ro.id and rp.revoked_at is null
    join permissions pe on pe.id = rp.permission_id and pe.is_active
    where ur.user_id = p_user_id
      and ur.revoked_at is null
      and pe.resource = p_resource
      and pe.action = p_action
      and (ur.scope_resource_id is null or ur.scope_resource_id = bur.resource_id)
  );
$function$;

-- Page-level existence check for a list/search surface: does this user
-- hold ANY active grant at all for (resource, action), global or
-- scoped, regardless of which specific rows it resolves to right now?
-- Distinct from fn_user_scoped_customer_ids on purpose: a scoped grant
-- that currently matches zero customers (e.g. a brand-new territory
-- with no customers yet) must still let its holder open the list page
-- and see an honest empty result, not an "Access restricted" page that
-- would incorrectly imply they hold no permission at all.
create function fn_user_has_any_scoped_permission(p_user_id uuid, p_resource text, p_action text) returns boolean
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
  );
$function$;

revoke execute on function fn_user_scoped_customer_ids(uuid, text, text) from public, anon, authenticated;
revoke execute on function fn_user_has_business_unit_scoped_permission(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function fn_user_scoped_business_units(uuid, text, text) from public, anon, authenticated;
revoke execute on function fn_user_has_any_scoped_permission(uuid, text, text) from public, anon, authenticated;
grant execute on function fn_user_scoped_customer_ids(uuid, text, text) to service_role;
grant execute on function fn_user_has_business_unit_scoped_permission(uuid, text, text, text) to service_role;
grant execute on function fn_user_scoped_business_units(uuid, text, text) to service_role;
grant execute on function fn_user_has_any_scoped_permission(uuid, text, text) to service_role;
