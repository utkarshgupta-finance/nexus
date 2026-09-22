-- Batch 17 I-021: upsert_monthly_entitlement_ledger only ever touched an
-- unbilled_ledger_entries/unearned_ledger_entries row when the newly
-- computed quantity for that specific type was > 0. When a month's
-- classification flips (e.g. underuse becomes overage after a later,
-- larger usage submission for the same month), the stale OPEN entry of
-- the no-longer-applicable type was never updated, leaving a
-- contradictory ledger state: an open "customer owes Nexus" (unbilled)
-- entry and an open "Nexus owes the customer" (unearned) entry
-- coexisting for the same month, when only one can be true. Confirmed
-- live: Sep 2026 showed unbilled=949 (correct, current) and a stale
-- unearned=25 (left over from before usage was resubmitted from 25 to
-- 999), both status OPEN.
--
-- Fix: an OPEN entry of the type that is no longer supported by the
-- current computation is zeroed in place (not deleted, not silently
-- reinterpreted as settled) so the ledger never shows two contradictory
-- open obligations for the same month. The two ledger tables are still
-- never netted against each other's quantity, per this domain's own
-- stated design; this only ever zeroes an entry against its own,
-- independently recomputed figure. A PARTIALLY_SETTLED or SETTLED entry
-- is left untouched either way (already protected by
-- fn_protect_ledger_entry_lifecycle), since a real settlement already
-- occurred against it and reversing that is a distinct, out-of-scope
-- business decision.

alter table unbilled_ledger_entries drop constraint unbilled_ledger_entries_unbilled_quantity_check;
alter table unbilled_ledger_entries add constraint unbilled_ledger_entries_unbilled_quantity_check check (unbilled_quantity >= 0);

alter table unearned_ledger_entries drop constraint unearned_ledger_entries_unearned_quantity_check;
alter table unearned_ledger_entries add constraint unearned_ledger_entries_unearned_quantity_check check (unearned_quantity >= 0);

create or replace function upsert_monthly_entitlement_ledger(
  p_customer_id uuid,
  p_stable_component_key uuid,
  p_commercial_version_id uuid,
  p_month date,
  p_metric text,
  p_monthly_entitlement_quantity numeric,
  p_actual_usage_quantity numeric,
  p_mug_quantity numeric,
  p_consumption_quantity numeric,
  p_unbilled_quantity numeric,
  p_unearned_quantity numeric,
  p_recognition_status text,
  p_go_live_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns monthly_entitlement_ledger
language plpgsql
security invoker
as $function$
declare
  v_row monthly_entitlement_ledger;
  v_unbilled_entry_id uuid;
  v_unearned_entry_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  insert into monthly_entitlement_ledger (
    customer_id, stable_component_key, commercial_version_id, month, metric,
    monthly_entitlement_quantity, actual_usage_quantity, mug_quantity, consumption_quantity,
    unbilled_quantity, unearned_quantity, recognition_status, go_live_request_id
  )
  values (
    p_customer_id, p_stable_component_key, p_commercial_version_id, p_month, p_metric,
    p_monthly_entitlement_quantity, p_actual_usage_quantity, p_mug_quantity, p_consumption_quantity,
    p_unbilled_quantity, p_unearned_quantity, p_recognition_status, p_go_live_request_id
  )
  on conflict (customer_id, stable_component_key, month) do update
  set commercial_version_id = excluded.commercial_version_id,
      metric = excluded.metric,
      monthly_entitlement_quantity = excluded.monthly_entitlement_quantity,
      actual_usage_quantity = excluded.actual_usage_quantity,
      mug_quantity = excluded.mug_quantity,
      consumption_quantity = excluded.consumption_quantity,
      unbilled_quantity = excluded.unbilled_quantity,
      unearned_quantity = excluded.unearned_quantity,
      recognition_status = excluded.recognition_status,
      go_live_request_id = excluded.go_live_request_id,
      updated_at = now()
  returning * into v_row;

  select id into v_unbilled_entry_id from unbilled_ledger_entries where monthly_ledger_id = v_row.id;
  if p_unbilled_quantity > 0 then
    if v_unbilled_entry_id is null then
      insert into unbilled_ledger_entries (monthly_ledger_id, customer_id, stable_component_key, month, metric, unbilled_quantity)
      values (v_row.id, p_customer_id, p_stable_component_key, p_month, p_metric, p_unbilled_quantity);
    else
      update unbilled_ledger_entries set unbilled_quantity = p_unbilled_quantity, updated_at = now()
      where id = v_unbilled_entry_id and status = 'OPEN';
    end if;
  elsif v_unbilled_entry_id is not null then
    update unbilled_ledger_entries set unbilled_quantity = 0, updated_at = now()
    where id = v_unbilled_entry_id and status = 'OPEN';
  end if;

  select id into v_unearned_entry_id from unearned_ledger_entries where monthly_ledger_id = v_row.id;
  if p_unearned_quantity > 0 then
    if v_unearned_entry_id is null then
      insert into unearned_ledger_entries (monthly_ledger_id, customer_id, stable_component_key, month, metric, unearned_quantity)
      values (v_row.id, p_customer_id, p_stable_component_key, p_month, p_metric, p_unearned_quantity);
    else
      update unearned_ledger_entries set unearned_quantity = p_unearned_quantity, updated_at = now()
      where id = v_unearned_entry_id and status = 'OPEN';
    end if;
  elsif v_unearned_entry_id is not null then
    update unearned_ledger_entries set unearned_quantity = 0, updated_at = now()
    where id = v_unearned_entry_id and status = 'OPEN';
  end if;

  return v_row;
end;
$function$;
