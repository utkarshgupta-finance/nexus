-- Pre-Batch-19 reconciliation: the Product Decision Closure fix in
-- migration 20261002000000 still let cancel_entitlement_source delete
-- entitlement_schedule_months rows for months not yet reflected in the
-- ledger, i.e. it still stopped future, not-yet-recognized allocation.
-- Re-reading the business decision strictly: "Invoice creates
-- entitlement. That entitlement remains valid unless reduced/reversed
-- through a Credit Note. No CN = entitlement remains." applies to past
-- AND future Invoice entitlement, not only to months already reflected
-- in the ledger. Stopping future allocation on cancellation, with no CN
-- or other financial document behind it, is itself a reduction of
-- Invoice entitlement without the required financial reversal,
-- contradicting the decision.
--
-- Fix: cancel_entitlement_source no longer touches
-- entitlement_schedule_months at all, in either direction. Cancellation
-- becomes a pure administrative/status marker on the entitlement_sources
-- row itself (recorded who/when/why, and blocks further schedule
-- generation from this specific source going forward, since
-- generate_allocation_schedule still requires the source it targets),
-- with zero effect on any already-generated schedule, monthly
-- entitlement, or ledger figure, past or future. This is the correct,
-- literal reading of "no CN = entitlement remains": only a real
-- Credit-Note-driven reduction (still a future module, not built here)
-- may ever reduce Invoice entitlement.

create or replace function cancel_entitlement_source(
  p_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns entitlement_sources
language plpgsql
security invoker
as $function$
declare
  v_row entitlement_sources;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from entitlement_sources where id = p_id for update;
  if not found then
    raise exception 'ENTITLEMENT_SOURCE_NOT_FOUND: no entitlement_sources row for id %', p_id;
  end if;

  if v_row.status = 'cancelled' then
    return v_row;
  end if;

  update entitlement_sources
  set status = 'cancelled', cancelled_reason = p_reason, cancelled_by = p_actor_user_id, cancelled_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;
