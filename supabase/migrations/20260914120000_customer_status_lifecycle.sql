-- Nexus: Customer Deactivation lifecycle (task Phase I).
--
-- Replaces the ad-hoc plain `update customers set is_active = ...`
-- data call (src/features/customers/data/customers.data.ts's own
-- setCustomerActive) with a real, governed RPC, for one concrete
-- reason found while auditing this phase: a plain PostgREST `.update()`
-- call never calls `set_config('app.current_user_id', ...)` first, so
-- `fn_audit_row`'s trigger (which reads `current_setting
-- ('app.current_user_id', true)`, not the row's own `updated_by`
-- column) recorded every prior deactivate/reactivate with a NULL actor
-- in audit_log, even though `updated_by` on the customers row itself
-- was correct. The Customer Activity timeline's own status-change
-- events (task Phase C) read `audit_log.actor_user_id` directly, so
-- this was a real, silent "who did this" gap, not a hypothetical one.
--
-- Also requires a reason (task Phase I: "Deactivate requires: reason"),
-- persisted into audit_log's own `actor_context` column (the same
-- established mechanism `approve_customer_change_request` and every
-- other governed RPC already use for actor-audit context), never a new
-- column on `customers` itself for a single free-text field.
--
-- This file has not been applied to any database as of authoring.

create or replace function set_customer_active(
  p_customer_id uuid,
  p_is_active boolean,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customers
language plpgsql
as $function$
declare
  v_customer customers;
  v_context jsonb;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'CUSTOMER_STATUS_REASON_REQUIRED: a reason is required to deactivate or reactivate a customer';
  end if;

  v_context := coalesce(p_actor_context, '{}'::jsonb) || jsonb_build_object('reason', p_reason);

  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', v_context::text, true);

  update customers
  set is_active = p_is_active, updated_by = p_actor_user_id
  where id = p_customer_id
  returning * into v_customer;

  if not found then
    raise exception 'CUSTOMER_NOT_FOUND: no customers row for id %', p_customer_id;
  end if;

  return v_customer;
end;
$function$;

grant execute on function set_customer_active(uuid, boolean, text, uuid, jsonb) to service_role;
revoke execute on function set_customer_active(uuid, boolean, text, uuid, jsonb) from anon, authenticated;
