-- Batch 17 I-022: record_settlement never checked a new settlement against
-- the remaining outstanding quantity on its target ledger entry before
-- inserting it. Confirmed live: a 900-unit unbilled entry, already
-- partially settled for 500, accepted a second settlement of 1000 with no
-- rejection, reaching a recorded total of 1500 against an entry that only
-- ever owed 900, while the entry's own status still flipped to 'SETTLED'
-- (misleadingly implying the correct amount was settled). This directly
-- violates this domain's own stated invariant that a settlement_records
-- row cannot reference more quantity than remains outstanding.
--
-- Fix: compute the already-settled total for the target entry before
-- inserting, and reject if the new settlement would push the cumulative
-- total past the entry's own quantity. The existing idempotent
-- same-reference retry path (on conflict do nothing, then re-select) is
-- preserved unchanged, so a genuine retry of an already-recorded
-- settlement is still a safe no-op, not a false rejection.

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
  v_already_recorded boolean;
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

  select exists(
    select 1 from settlement_records
    where ledger_entry_type = p_ledger_entry_type
      and ledger_entry_id = p_ledger_entry_id
      and settlement_reference = p_settlement_reference
  ) into v_already_recorded;

  if not v_already_recorded then
    select coalesce(sum(settled_quantity), 0) into v_total_settled
    from settlement_records
    where ledger_entry_type = p_ledger_entry_type and ledger_entry_id = p_ledger_entry_id;

    if v_total_settled + p_settled_quantity > v_total_quantity then
      raise exception 'SETTLEMENT_EXCEEDS_OUTSTANDING: settling % would exceed the % still outstanding on this entry (already settled %)', p_settled_quantity, v_total_quantity - v_total_settled, v_total_settled;
    end if;
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
