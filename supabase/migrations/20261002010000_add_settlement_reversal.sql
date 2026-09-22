-- Product Decision Closure (2026-09-22), Batch 17 I-024: business decision
-- is that Nexus should support controlled correction of an incorrect
-- settlement through an immutable, additive reversal/adjustment, never by
-- editing or deleting the original settlement_records row. The original
-- transaction remains permanently visible in history; a new, linked
-- transaction changes the resulting outstanding balance.
--
-- settlement_adjustments is append-only (no update, no delete, matching
-- settlement_records' own existing immutability posture): each row is a
-- reversal of a specific quantity against one original settlement_records
-- row, cannot exceed that settlement's own remaining reversible quantity,
-- carries a reason, an actor, and a timestamp, and is idempotent on
-- (original_settlement_id, reversal_reference), mirroring record_settlement's
-- own established idempotency pattern.

create table settlement_adjustments (
  id                      uuid primary key default gen_random_uuid(),
  original_settlement_id  uuid not null references settlement_records (id) on delete restrict,
  ledger_entry_type       text not null check (ledger_entry_type in ('unbilled', 'unearned')),
  ledger_entry_id         uuid not null,
  reversal_reference      text not null,
  reversed_quantity       numeric not null check (reversed_quantity > 0),
  reason                  text not null,
  reversed_by             uuid references app_users (id) on delete restrict,
  reversed_at             timestamptz not null default now(),

  unique (original_settlement_id, reversal_reference)
);

comment on table settlement_adjustments is
  'Product Decision Closure (Batch 17 I-024, 2026-09-22). An immutable, additive reversal of a prior settlement_records row. The original settlement_records row is never mutated or deleted; a correction only ever adds a linked row here. A ledger entry''s true net-settled total is settlement_records.settled_quantity summed for that entry, minus settlement_adjustments.reversed_quantity summed for that entry.';

create index idx_settlement_adjustments_original on settlement_adjustments (original_settlement_id);
create index idx_settlement_adjustments_entry on settlement_adjustments (ledger_entry_type, ledger_entry_id);

revoke all on settlement_adjustments from anon, authenticated;

alter table settlement_adjustments enable row level security;

create trigger trg_audit_settlement_adjustments
  after insert on settlement_adjustments
  for each row execute function fn_audit_row('id');

/** Reverses (fully or partially) a prior settlement, gated on the same entitlement_settlement.write permission as record_settlement itself (no new approval hierarchy). Cannot reverse more than a settlement's own remaining reversible quantity; safe to retry with the same reversal_reference (idempotent, mirroring record_settlement). Recomputes the ledger entry's derived status from net-settled (settled minus reversed), same OPEN/PARTIALLY_SETTLED/SETTLED thresholds record_settlement itself uses. */
create function reverse_settlement(
  p_settlement_id uuid,
  p_reversal_reference text,
  p_reversal_quantity numeric,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns settlement_adjustments
language plpgsql
security invoker
as $function$
declare
  v_settlement settlement_records;
  v_adjustment settlement_adjustments;
  v_already_reversed numeric;
  v_reversible_remaining numeric;
  v_already_recorded boolean;
  v_total_quantity numeric;
  v_total_settled numeric;
  v_total_reversed numeric;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_settlement from settlement_records where id = p_settlement_id for update;
  if not found then
    raise exception 'SETTLEMENT_NOT_FOUND: no settlement_records row for id %', p_settlement_id;
  end if;

  select exists(
    select 1 from settlement_adjustments
    where original_settlement_id = p_settlement_id
      and reversal_reference = p_reversal_reference
  ) into v_already_recorded;

  if not v_already_recorded then
    select coalesce(sum(reversed_quantity), 0) into v_already_reversed
    from settlement_adjustments where original_settlement_id = p_settlement_id;

    v_reversible_remaining := v_settlement.settled_quantity - v_already_reversed;

    if p_reversal_quantity > v_reversible_remaining then
      raise exception 'SETTLEMENT_REVERSAL_EXCEEDS_SETTLED: reversing % would exceed the % still reversible on this settlement (already reversed %)', p_reversal_quantity, v_reversible_remaining, v_already_reversed;
    end if;

    insert into settlement_adjustments (original_settlement_id, ledger_entry_type, ledger_entry_id, reversal_reference, reversed_quantity, reason, reversed_by)
    values (p_settlement_id, v_settlement.ledger_entry_type, v_settlement.ledger_entry_id, p_reversal_reference, p_reversal_quantity, p_reason, p_actor_user_id)
    returning * into v_adjustment;
  end if;

  if v_adjustment.id is null then
    select * into v_adjustment from settlement_adjustments
    where original_settlement_id = p_settlement_id and reversal_reference = p_reversal_reference;
  end if;

  select coalesce(sum(sr.settled_quantity), 0) into v_total_settled
  from settlement_records sr where sr.ledger_entry_type = v_settlement.ledger_entry_type and sr.ledger_entry_id = v_settlement.ledger_entry_id;

  select coalesce(sum(sa.reversed_quantity), 0) into v_total_reversed
  from settlement_adjustments sa where sa.ledger_entry_type = v_settlement.ledger_entry_type and sa.ledger_entry_id = v_settlement.ledger_entry_id;

  if v_settlement.ledger_entry_type = 'unbilled' then
    select unbilled_quantity into v_total_quantity from unbilled_ledger_entries where id = v_settlement.ledger_entry_id;
    update unbilled_ledger_entries
    set status = case
        when v_total_settled - v_total_reversed <= 0 then 'OPEN'
        when v_total_settled - v_total_reversed >= v_total_quantity then 'SETTLED'
        else 'PARTIALLY_SETTLED'
      end,
      updated_at = now()
    where id = v_settlement.ledger_entry_id;
  else
    select unearned_quantity into v_total_quantity from unearned_ledger_entries where id = v_settlement.ledger_entry_id;
    update unearned_ledger_entries
    set status = case
        when v_total_settled - v_total_reversed <= 0 then 'OPEN'
        when v_total_settled - v_total_reversed >= v_total_quantity then 'SETTLED'
        else 'PARTIALLY_SETTLED'
      end,
      updated_at = now()
    where id = v_settlement.ledger_entry_id;
  end if;

  return v_adjustment;
end;
$function$;

revoke execute on function reverse_settlement(uuid, text, numeric, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function reverse_settlement(uuid, text, numeric, text, uuid, jsonb) to service_role;
