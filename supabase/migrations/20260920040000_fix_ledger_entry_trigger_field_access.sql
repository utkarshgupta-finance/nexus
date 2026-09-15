-- =============================================================================
-- Real bug found during NEXUS LOCAL UX + E2E ACCEPTANCE live browser
-- testing: recording a SECOND settlement against any Unbilled or
-- Unearned entry (moving it from OPEN to a later status, or from
-- PARTIALLY_SETTLED onward) always failed with:
--
--   record "new" has no field "unearned_quantity"
--
-- fn_protect_ledger_entry_lifecycle is one shared trigger function
-- attached to both unbilled_ledger_entries and unearned_ledger_entries.
-- The original body wrote the two field-specific guards as two separate
-- top-level `if` statements:
--
--   if tg_table_name = 'unbilled_ledger_entries' and new.unbilled_quantity ... then ...
--   if tg_table_name = 'unearned_ledger_entries' and new.unearned_quantity ... then ...
--
-- Because `new`/`old` are generic PL/pgSQL RECORD variables here (the
-- function has no fixed row type, since it serves two differently-shaped
-- tables), referencing a field name that does not exist on the
-- CURRENTLY FIRING table's row raises an error immediately, even though
-- the `tg_table_name` half of the AND is false: PL/pgSQL's RECORD field
-- resolution is not guaranteed to be skipped by boolean short-circuiting
-- the way a plain scalar comparison would be. The fix nests each
-- field-specific check inside its own `if tg_table_name = ... then`
-- block instead of a single combined `and` condition, so the other
-- table's field name is never referenced at all while that branch is
-- not taken.
--
-- Real impact before this fix: a second settlement against any ledger
-- entry (completing a partial settlement, or any settlement after the
-- first) failed outright. Partial settlement therefore could never
-- reach SETTLED through the application. Confirmed via a live browser
-- reproduction against fictional test data before this fix, and
-- retested after.
-- =============================================================================

create or replace function fn_protect_ledger_entry_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception '% is an immutable ledger record: DELETE is not permitted', tg_table_name;
  end if;

  if tg_op = 'UPDATE' and old.status <> 'OPEN' then
    if tg_table_name = 'unbilled_ledger_entries' then
      if new.unbilled_quantity is distinct from old.unbilled_quantity then
        raise exception 'LEDGER_ENTRY_FROZEN: % quantity is frozen once settlement has begun (id=%)', tg_table_name, old.id;
      end if;
    elsif tg_table_name = 'unearned_ledger_entries' then
      if new.unearned_quantity is distinct from old.unearned_quantity then
        raise exception 'LEDGER_ENTRY_FROZEN: % quantity is frozen once settlement has begun (id=%)', tg_table_name, old.id;
      end if;
    end if;
  end if;

  return new;
end;
$function$;
