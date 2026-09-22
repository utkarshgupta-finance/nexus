-- Product Decision Closure (2026-09-22), Batch 17 I-015: business decision
-- is that an invoice-created Entitlement Source's entitlement remains
-- valid unless reduced/reversed through a Credit Note; cancelling an
-- Entitlement Source record must never, by itself, erase entitlement
-- already reflected in the Monthly Entitlement Ledger. cancel_entitlement_source
-- previously deleted every entitlement_schedule_months row for the source
-- unconditionally, including months a monthly_entitlement_ledger row had
-- already recognized. Any later recompute of one of those months (a
-- correction resubmission, for example) would then silently lose this
-- source's historical contribution, with no Credit Note or other
-- financial document behind the change.
--
-- Fix: cancellation now only deletes schedule rows for months that have
-- no monthly_entitlement_ledger row yet (months never recognized, so
-- stopping their future allocation is the legitimate, non-financial
-- meaning of cancelling a source). Schedule rows for any month already
-- reflected in the ledger are preserved, so a future recompute of that
-- month still sees this source's original contribution. This is a
-- bounded correction to the existing mechanism, not a Credit Note
-- workflow; a real Credit Note-driven entitlement reduction remains a
-- future module dependency (Nexus has no Credit Note document lifecycle
-- wired to Entitlement today).

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

  delete from entitlement_schedule_months esm
  where esm.entitlement_source_id = p_id
    and not exists (
      select 1 from monthly_entitlement_ledger mel
      where mel.stable_component_key = esm.stable_component_key
        and mel.month = esm.month
    );

  update entitlement_sources
  set status = 'cancelled', cancelled_reason = p_reason, cancelled_by = p_actor_user_id, cancelled_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;
