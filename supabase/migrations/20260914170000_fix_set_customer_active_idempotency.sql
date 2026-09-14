-- Nexus Platform Scale Closure, Phase C: set_customer_active idempotency.
--
-- The reconciliation audit found set_customer_active was the only
-- decision-style RPC with no idempotent-replay guard: unlike every
-- approve/reject RPC (which returns the existing row unchanged when
-- called again after already reaching that state), a redundant
-- deactivate-already-inactive or reactivate-already-active call blindly
-- re-applied the UPDATE. Two real consequences followed structurally
-- from triggers already on `customers`:
--   - fn_audit_row inserts a duplicate, misleading audit_log row on every
--     call regardless of whether anything actually changed.
--   - fn_bump_row_version bumps customers.row_version unconditionally,
--     which can invalidate an unrelated in-flight Customer Change
--     Request's base_customer_row_version (approve_customer_change_request
--     compares against it), forcing a spurious CUSTOMER_CHANGE_STALE_BASE
--     rejection even though the customer's visible fields never changed.
--
-- Same exact parameter signature as the prior version (no added
-- parameter), so this replaces in place with zero overload-ambiguity
-- risk, per the lesson from the earlier onboarding send-back incident.

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

  select * into v_customer from customers where id = p_customer_id for update;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND: no customers row for id %', p_customer_id;
  end if;

  -- Idempotent replay: a customer already at the requested status returns
  -- unchanged, no DML runs, matching every other decision RPC's pattern.
  if v_customer.is_active = p_is_active then
    return v_customer;
  end if;

  v_context := coalesce(p_actor_context, '{}'::jsonb) || jsonb_build_object('reason', p_reason);

  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', v_context::text, true);

  update customers
  set is_active = p_is_active, updated_by = p_actor_user_id
  where id = p_customer_id
  returning * into v_customer;

  return v_customer;
end;
$function$;

grant execute on function set_customer_active(uuid, boolean, text, uuid, jsonb) to service_role;
revoke execute on function set_customer_active(uuid, boolean, text, uuid, jsonb) from anon, authenticated;
