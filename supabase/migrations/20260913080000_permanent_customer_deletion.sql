-- Nexus: Customer Lifecycle V1, Permanent Customer Deletion.
--
-- Consistent with docs/DATA_ARCHITECTURE.md §10 ("soft deletion is the
-- default; hard deletion is a deliberate, narrow exception") and
-- docs/CUSTOMER_LIFECYCLE.md §5's own design: a customer may be
-- PERMANENTLY, physically removed only when it carries no protected
-- business history. "Protected business history" is defined precisely
-- against the real schema, never invented: any `commercial_components`
-- row (a real priced service was ever configured), any row in the real
-- M9/M10 evidence chain (`usage_facts`, `earned_results`,
-- `billing_calculations`, `reconciliation_adjustments`, all reachable
-- only through a Commercial Component, so impossible if zero Components
-- exist), or any APPROVED Customer Change Request (a real governance
-- decision was made). An empty-shell Commercial Configuration + its
-- initial_setup Change (the atomic byproduct of
-- `approve_customer_onboarding_case` even for zero components) carries
-- no such history and is cleaned up as part of the same deletion, not a
-- reason to block it.
--
-- `customers` has carried an unconditional DELETE-rejecting trigger
-- since its own foundation migration
-- (fn_protect_customer_lifecycle, 20260908013210_master_data_foundation.sql).
-- This migration extends that trigger with a narrow, session-local
-- bypass (`app.permit_customer_delete`), set only by
-- `delete_customer_permanently` for the duration of its own transaction,
-- never exposed as a general escape hatch.
--
-- `customer_deletion_audit` follows the exact same "no FK back to the
-- described row" discipline `audit_log.row_id` already established
-- (20260906084244_platform_core_foundation.sql): a plain, unconstrained
-- snapshot column, so the fact and detail of a deletion survives the
-- row it describes, permanently, independent of the Customer FK
-- lifecycle.
--
-- This file has not been applied to any database as of authoring.

-- =============================================================================
-- customer_deletion_audit: permanent, FK-free deletion evidence
-- =============================================================================

create table customer_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  /** Deliberately NOT a foreign key: this row must remain fully readable forever, even though the customer row it describes no longer exists. */
  customer_id uuid not null,
  customer_key text not null,
  customer_name text not null,
  segment text,
  business_unit text,
  country text,
  industry text,
  brand_name text,
  was_active boolean not null,
  reason text not null,
  deleted_by uuid references app_users (id),
  deleted_at timestamptz not null default now()
);

comment on table customer_deletion_audit is
  'Permanent record that a customer was permanently deleted, and a snapshot of what it was. No foreign key to customers(id) by design (docs/CUSTOMER_LIFECYCLE.md §5): this evidence must survive the row it describes.';

revoke all on customer_deletion_audit from anon, authenticated;
grant select, insert on customer_deletion_audit to service_role;

create trigger trg_customer_deletion_audit_reject_update_delete
  before update or delete on customer_deletion_audit
  for each row execute function fn_reject_update_delete();

-- =============================================================================
-- Extend fn_protect_customer_lifecycle with a narrow, session-local
-- bypass for the one governed deletion path below.
-- =============================================================================

create or replace function fn_protect_customer_lifecycle()
returns trigger
language plpgsql
as $function$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.permit_customer_delete', true), '') = 'true' then
      return old;
    end if;
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

-- =============================================================================
-- delete_customer_permanently: the atomic, eligibility-re-checked delete
-- =============================================================================

/**
 * Re-verifies eligibility itself (never trusts a client-side or even a
 * prior TypeScript-layer check alone): raises a named exception
 * identifying exactly which protected history blocks the delete, so a
 * caller can never race past a stale eligibility read. `customer.delete_permanent`
 * is enforced at the TypeScript Server Action layer
 * (requirePermission("customer", "delete_permanent")), the same pattern
 * every other governed mutation in this codebase already follows; this
 * function does not re-check permissions itself.
 */
create or replace function delete_customer_permanently(
  p_customer_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_deletion_audit
language plpgsql
as $function$
declare
  v_customer customers;
  v_component_count integer;
  v_approved_change_request_count integer;
  v_audit customer_deletion_audit;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'CUSTOMER_DELETE_REASON_REQUIRED: a reason is required to permanently delete a customer';
  end if;

  select * into v_customer from customers where id = p_customer_id for update;
  if not found then
    raise exception 'CUSTOMER_DELETE_NOT_FOUND: no customers row for id %', p_customer_id;
  end if;

  select count(*) into v_component_count
  from commercial_components cc
  join commercial_configurations cf on cf.id = cc.commercial_configuration_id
  where cf.customer_id = p_customer_id;

  if v_component_count > 0 then
    raise exception 'CUSTOMER_DELETE_HAS_COMMERCIAL_HISTORY: customer % has % real Commercial Component(s); permanent deletion is blocked', p_customer_id, v_component_count;
  end if;

  select count(*) into v_approved_change_request_count
  from customer_change_requests
  where customer_id = p_customer_id and status = 'approved';

  if v_approved_change_request_count > 0 then
    raise exception 'CUSTOMER_DELETE_HAS_APPROVED_CHANGE_HISTORY: customer % has % approved Customer Change Request(s); permanent deletion is blocked', p_customer_id, v_approved_change_request_count;
  end if;

  insert into customer_deletion_audit (
    customer_id, customer_key, customer_name, segment, business_unit, country, industry, brand_name,
    was_active, reason, deleted_by
  )
  values (
    v_customer.id, v_customer.key, v_customer.name, v_customer.segment, v_customer.business_unit,
    v_customer.country, v_customer.industry, v_customer.brand_name,
    v_customer.is_active, p_reason, p_actor_user_id
  )
  returning * into v_audit;

  delete from customer_change_request_requirements
  where customer_change_request_id in (select request_id from customer_change_requests where customer_id = p_customer_id);

  delete from customer_change_requests where customer_id = p_customer_id;
  delete from customer_field_history where customer_id = p_customer_id;
  delete from customer_onboarding_cases where customer_id = p_customer_id;

  delete from commercial_components
  where commercial_configuration_id in (select id from commercial_configurations where customer_id = p_customer_id);

  delete from commercial_configuration_versions
  where commercial_configuration_id in (select id from commercial_configurations where customer_id = p_customer_id);

  delete from commercial_changes
  where commercial_configuration_id in (select id from commercial_configurations where customer_id = p_customer_id);

  delete from commercial_configurations where customer_id = p_customer_id;

  perform set_config('app.permit_customer_delete', 'true', true);
  delete from customers where id = p_customer_id;

  return v_audit;
end;
$function$;

grant execute on function delete_customer_permanently(uuid, text, uuid, jsonb) to service_role;
revoke execute on function delete_customer_permanently(uuid, text, uuid, jsonb) from anon, authenticated;
