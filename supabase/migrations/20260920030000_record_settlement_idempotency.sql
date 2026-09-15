-- =============================================================================
-- Idempotency fix found during NEXUS FULL PRODUCT READINESS Chief
-- Architect review: record_settlement had no client-minted id, no
-- dedup key, and settlement_records carried no unique constraint at
-- all. Unlike the three already-accepted create_* RPCs (docs/TECH_DEBT.md,
-- mitigated by "creation happens via a single navigation, not a
-- repeatable button"), a lost-response retry here does not just create a
-- duplicate shell row: the entry's OPEN/PARTIALLY_SETTLED/SETTLED status
-- is derived from sum(settled_quantity) across every settlement_records
-- row for that entry, so a duplicate insert directly double-counts a
-- real settled quantity and can flip an entry to SETTLED prematurely.
--
-- Fix: settlement_reference is already meant to be a real external
-- reference (an Invoice number for Unbilled, a Credit Note number for
-- Unearned); requiring it to be unique per ledger entry is both a sound
-- idempotency key AND a sound business rule (the same invoice/credit
-- note reference should never settle the same shortfall twice). An
-- exact retry (same entry, same reference) becomes a safe no-op that
-- returns the existing row, matching the `on conflict ... do nothing`
-- pattern already used by grant_user_role.
-- =============================================================================

create unique index uq_settlement_records_entry_reference
  on settlement_records (ledger_entry_type, ledger_entry_id, settlement_reference);

create or replace function record_settlement(
  p_ledger_entry_type text,
  p_ledger_entry_id uuid,
  p_settlement_reference text,
  p_settled_quantity numeric,
  p_settlement_date date,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns settlement_records
language plpgsql
security invoker
as $function$
declare
  v_record settlement_records;
  v_total_quantity numeric;
  v_total_settled numeric;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_ledger_entry_type not in ('unbilled', 'unearned') then
    raise exception 'SETTLEMENT_INVALID_LEDGER_ENTRY_TYPE: % is not a valid ledger entry type', p_ledger_entry_type;
  end if;

  if p_ledger_entry_type = 'unbilled' then
    perform 1 from unbilled_ledger_entries where id = p_ledger_entry_id for update;
    if not found then
      raise exception 'SETTLEMENT_LEDGER_ENTRY_NOT_FOUND: no unbilled_ledger_entries row for id %', p_ledger_entry_id;
    end if;
    select unbilled_quantity into v_total_quantity from unbilled_ledger_entries where id = p_ledger_entry_id;
  else
    perform 1 from unearned_ledger_entries where id = p_ledger_entry_id for update;
    if not found then
      raise exception 'SETTLEMENT_LEDGER_ENTRY_NOT_FOUND: no unearned_ledger_entries row for id %', p_ledger_entry_id;
    end if;
    select unearned_quantity into v_total_quantity from unearned_ledger_entries where id = p_ledger_entry_id;
  end if;

  insert into settlement_records (ledger_entry_type, ledger_entry_id, settlement_reference, settled_quantity, settlement_date, settled_by)
  values (p_ledger_entry_type, p_ledger_entry_id, p_settlement_reference, p_settled_quantity, p_settlement_date, p_actor_user_id)
  on conflict (ledger_entry_type, ledger_entry_id, settlement_reference) do nothing
  returning * into v_record;

  if v_record.id is null then
    select * into v_record from settlement_records
    where ledger_entry_type = p_ledger_entry_type
      and ledger_entry_id = p_ledger_entry_id
      and settlement_reference = p_settlement_reference;
  end if;

  select coalesce(sum(settled_quantity), 0) into v_total_settled
  from settlement_records
  where ledger_entry_type = p_ledger_entry_type and ledger_entry_id = p_ledger_entry_id;

  if p_ledger_entry_type = 'unbilled' then
    update unbilled_ledger_entries
    set status = case when v_total_settled >= v_total_quantity then 'SETTLED' else 'PARTIALLY_SETTLED' end, updated_at = now()
    where id = p_ledger_entry_id;
  else
    update unearned_ledger_entries
    set status = case when v_total_settled >= v_total_quantity then 'SETTLED' else 'PARTIALLY_SETTLED' end, updated_at = now()
    where id = p_ledger_entry_id;
  end if;

  return v_record;
end;
$function$;

comment on function record_settlement(text, uuid, text, numeric, date, uuid, jsonb) is
  'Records one settlement against an Unbilled/Unearned ledger entry, recomputing OPEN/PARTIALLY_SETTLED/SETTLED from '
  'the sum of every settlement against it. Idempotent on (ledger_entry_type, ledger_entry_id, settlement_reference): '
  'an exact retry with the same reference returns the existing row rather than double-counting the settled quantity.';
