-- Nexus: fn_protect_customer_lifecycle predates segment/business_unit/
-- country/industry/brand_name (added in
-- 20260913060000_customer_change_request_foundation.sql) and blocked all
-- five, discovered via direct smoke-testing of
-- approve_customer_change_request before any TypeScript was written
-- against it (P0001 raised on the first real approval attempt). These
-- five columns are meant to be genuinely changeable, exactly the way
-- name already is: through an approved Customer Change Request only
-- (enforced by application-layer permission checks and the RPC surface,
-- not by this trigger, which only ever guarded "no direct writes to
-- immutable identity fields" and never guarded "who is allowed to call
-- an update"). Extending the allowed set is the correct fix, not
-- loosening the guard's intent.

create or replace function fn_protect_customer_lifecycle()
returns trigger
language plpgsql
as $function$
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

  -- tg_op = 'UPDATE'. name, is_active, segment, business_unit, country,
  -- industry, brand_name, row_version, updated_at, and updated_by are
  -- the only columns ever permitted to change; is_active is permitted
  -- to move in either direction, so it is excluded from this comparison
  -- rather than checked for a specific transition.
  v_old_core := to_jsonb(old) - 'name' - 'is_active' - 'segment' - 'business_unit' - 'country' - 'industry' - 'brand_name' - 'row_version' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new) - 'name' - 'is_active' - 'segment' - 'business_unit' - 'country' - 'industry' - 'brand_name' - 'row_version' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'customers is a permanent master identity: only name, is_active, segment, business_unit, country, industry, brand_name, row_version, '
      'updated_at, and updated_by may change (id=%)', old.id;
  end if;

  return new;
end;
$function$;
