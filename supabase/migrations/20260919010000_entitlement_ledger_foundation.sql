-- Nexus: Go Live + Entitlement Ledger, Phases F-N. The Entitlement
-- Ledger domain: Invoice Entitlement sources, the monthly allocation
-- schedule they generate, monthly Usage capture, the computed Monthly
-- Entitlement Ledger, and the Unbilled/Unearned running ledgers with
-- their settlement foundation.
--
-- Permanent rules this schema exists to enforce:
--
-- 1. An invoice may create an Entitlement Source before Go Live. The
--    pool exists immediately; monthly ALLOCATION (entitlement_schedule_months
--    rows) is only ever generated for months at or after the line
--    item's Go Live month. Pre-Go-Live months get zero allocation, not
--    a deferred one.
-- 2. Usage is always monthly, independent of invoice frequency (annual,
--    quarterly, whatever the Commercial billing_cadence is).
-- 3. UNBILLED and UNEARNED are metric quantities (Users, Outlets,
--    whatever the line item's own unit is), never monetary balances.
-- 4. No cross-month netting, ever: October's Unbilled and November's
--    Unearned for the same line item are two independent open ledger
--    entries, ONLY ever closed by their own Settlement, never offset
--    against each other.
--
-- Business computation (MUG consumption rules, pricing-model
-- classification into AUTO_FINALIZABLE vs REQUIRES_MRR_RECOGNITION) is
-- deliberately NOT written in PL/pgSQL: it lives in TypeScript, pure and
-- directly unit-testable
-- (src/features/entitlement/domain/consumption.ts), matching this
-- codebase's own established split (commercial-rate-diff.ts computes,
-- RPCs persist). Every RPC below takes already-computed values and
-- performs the governed, idempotent write; none re-derives business
-- logic from raw inputs itself.
--
-- This file has not been applied to any database as of authoring.

-- =============================================================================
-- entitlement_sources: the raw Invoice Entitlement fact.
-- =============================================================================

create sequence entitlement_source_number_seq;

create table entitlement_sources (
  id                      uuid primary key default gen_random_uuid(),
  source_number           integer not null default nextval('entitlement_source_number_seq'),
  customer_id             uuid not null references customers (id) on delete restrict,
  stable_component_key    uuid not null,
  commercial_version_id   uuid references commercial_configuration_versions (request_id) on delete restrict,
  invoice_reference       text not null,
  invoice_date            date not null,
  invoice_quantity        numeric not null check (invoice_quantity > 0),
  metric                  text not null,
  invoice_duration_months integer not null check (invoice_duration_months > 0),
  document_reference      text,
  source_type             text not null default 'MANUAL' check (source_type in ('MANUAL', 'API', 'IMPORT')),
  status                  text not null default 'active' check (status in ('active', 'cancelled')),
  cancelled_reason        text,
  cancelled_by            uuid references app_users (id) on delete restrict,
  cancelled_at            timestamptz,
  created_at              timestamptz not null default now(),
  created_by              uuid references app_users (id) on delete restrict,
  updated_at              timestamptz not null default now(),
  updated_by              uuid references app_users (id) on delete restrict
);

comment on table entitlement_sources is
  'Go Live + Entitlement Ledger, Phase F. An invoice-derived entitlement pool. May exist before the line item''s Go Live: an invoice creates the pool, but monthly allocation (entitlement_schedule_months) only ever starts at the Go Live month. Manual Finance entry today (source_type = MANUAL); the same create_entitlement_source RPC is the one path a future API/import integration calls too, never a parallel write path.';

create index idx_entitlement_sources_component on entitlement_sources (stable_component_key);
create index idx_entitlement_sources_customer on entitlement_sources (customer_id);

create trigger trg_entitlement_sources_updated_at
  before update on entitlement_sources
  for each row execute function fn_set_updated_at();

alter table entitlement_sources enable row level security;

create trigger trg_audit_entitlement_sources
  after insert or update or delete on entitlement_sources
  for each row execute function fn_audit_row('id');

-- =============================================================================
-- entitlement_schedule_months: the monthly allocation an Entitlement
-- Source generates, anchored at Go Live. Deliberately one row per
-- (source, month): the Monthly Entitlement Ledger sums every
-- schedule_months row for a given (component, month) across ALL
-- sources, so "add an additional invoice to an already-live line item"
-- is not a special case requiring mutation of existing rows, only an
-- additional source whose own schedule rows cover the relevant months.
-- =============================================================================

create table entitlement_schedule_months (
  id                    uuid primary key default gen_random_uuid(),
  entitlement_source_id uuid not null references entitlement_sources (id) on delete restrict,
  customer_id           uuid not null references customers (id) on delete restrict,
  stable_component_key  uuid not null,
  month                 date not null,
  monthly_quantity      numeric not null check (monthly_quantity >= 0),
  created_at            timestamptz not null default now(),
  created_by            uuid references app_users (id) on delete restrict,

  unique (entitlement_source_id, month)
);

comment on table entitlement_schedule_months is
  'Go Live + Entitlement Ledger, Phase G. One row per (Entitlement Source, month). Regenerated wholesale (delete-then-reinsert for that source) by generate_allocation_schedule, never hand-edited per month. The remainder of an uneven division is placed in the final month, deterministically.';

create index idx_entitlement_schedule_months_component_month on entitlement_schedule_months (stable_component_key, month);

alter table entitlement_schedule_months enable row level security;

-- =============================================================================
-- monthly_usage: append-only revisions, one current row per
-- (customer, stable_component_key, month).
-- =============================================================================

create table monthly_usage (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references customers (id) on delete restrict,
  stable_component_key  uuid not null,
  commercial_version_id uuid references commercial_configuration_versions (request_id) on delete restrict,
  usage_month           date not null,
  metric                text not null,
  quantity              numeric not null check (quantity >= 0),
  source                text not null default 'MANUAL' check (source in ('MANUAL', 'API', 'IMPORT')),
  status                text not null default 'draft' check (status in ('draft', 'final')),
  notes                 text,
  is_current            boolean not null default true,
  submitted_by          uuid references app_users (id) on delete restrict,
  submitted_at          timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

comment on table monthly_usage is
  'Go Live + Entitlement Ledger, Phase H. One current row per (customer, stable_component_key, usage_month); a resubmission supersedes rather than overwrites (fn_protect_monthly_usage_lifecycle), so a finalized month''s history is never silently lost. Recurring line items are gated: usage cannot be submitted for a month before the line item''s own Go Live month (enforced in submit_monthly_usage). On-Demand line items have no such gate: usage/event entry is itself the operational trigger, with no Go Live concept at all.';

create unique index uq_monthly_usage_current on monthly_usage (customer_id, stable_component_key, usage_month) where is_current = true;
create index idx_monthly_usage_component_month on monthly_usage (stable_component_key, usage_month);

create or replace function fn_protect_monthly_usage_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'MONTHLY_USAGE_IMMUTABLE: monthly_usage rows are never deleted, only superseded via is_current';
  end if;

  if tg_op = 'UPDATE' then
    if old.customer_id is distinct from new.customer_id
      or old.stable_component_key is distinct from new.stable_component_key
      or old.commercial_version_id is distinct from new.commercial_version_id
      or old.usage_month is distinct from new.usage_month
      or old.metric is distinct from new.metric
      or old.quantity is distinct from new.quantity
      or old.source is distinct from new.source
      or old.notes is distinct from new.notes
      or old.submitted_by is distinct from new.submitted_by
      or old.submitted_at is distinct from new.submitted_at
    then
      raise exception 'MONTHLY_USAGE_IMMUTABLE: only status and is_current may ever change on monthly_usage after insert';
    end if;

    if old.status = 'final' and new.status <> 'final' then
      raise exception 'MONTHLY_USAGE_FINAL: month % is already finalized and cannot be un-finalized', old.usage_month;
    end if;
  end if;

  return new;
end;
$function$;

create trigger trg_protect_monthly_usage_lifecycle
  before update or delete on monthly_usage
  for each row execute function fn_protect_monthly_usage_lifecycle();

alter table monthly_usage enable row level security;

create trigger trg_audit_monthly_usage
  after insert or update or delete on monthly_usage
  for each row execute function fn_audit_row('id');

-- =============================================================================
-- monthly_entitlement_ledger: the computed monthly bucket. The MONTH is
-- the fundamental accounting bucket; each row is (customer, stable
-- component, month). Recomputed idempotently by
-- upsert_monthly_entitlement_ledger whenever the schedule or usage
-- inputs for that month change; the running Unbilled/Unearned entries
-- it spawns are separate rows that freeze once settlement begins.
-- =============================================================================

create table monthly_entitlement_ledger (
  id                            uuid primary key default gen_random_uuid(),
  customer_id                   uuid not null references customers (id) on delete restrict,
  stable_component_key          uuid not null,
  commercial_version_id         uuid references commercial_configuration_versions (request_id) on delete restrict,
  month                         date not null,
  metric                        text not null,
  monthly_entitlement_quantity  numeric not null default 0,
  actual_usage_quantity         numeric not null default 0,
  mug_quantity                  numeric,
  consumption_quantity          numeric not null default 0,
  unbilled_quantity             numeric not null default 0,
  unearned_quantity             numeric not null default 0,
  recognition_status            text not null check (recognition_status in ('auto_finalized', 'pending_mrr_recognition')),
  go_live_request_id            uuid references go_live_requests (id) on delete restrict,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),

  unique (customer_id, stable_component_key, month)
);

comment on table monthly_entitlement_ledger is
  'Go Live + Entitlement Ledger, Phase I/J/K. unbilled_quantity/unearned_quantity are metric quantities (users, outlets, whatever this line item''s own unit is), never monetary values: pricing converts quantity to money later, for invoicing/MRR Recognition, never here. No cross-month netting: each row stands alone. recognition_status is auto_finalized only for simple, deterministic pricing models (Per Unit); complex multi-rate models (Slab, Progressive, Designation-based) always land pending_mrr_recognition, since final commercial recognition for those requires the future MRR Recognition module this program deliberately does not build.';

create index idx_monthly_entitlement_ledger_customer_month on monthly_entitlement_ledger (customer_id, month);
create index idx_monthly_entitlement_ledger_component_month on monthly_entitlement_ledger (stable_component_key, month);
create index idx_monthly_entitlement_ledger_recognition on monthly_entitlement_ledger (recognition_status) where recognition_status = 'pending_mrr_recognition';

alter table monthly_entitlement_ledger enable row level security;

-- =============================================================================
-- unbilled_ledger_entries / unearned_ledger_entries: first-class running
-- ledgers, one entry per monthly_entitlement_ledger row that has a
-- non-zero quantity. Quantity is frozen once any Settlement exists
-- against it (fn_protect_ledger_entry_lifecycle): recompute may keep
-- adjusting an OPEN entry's quantity as new usage/schedule facts arrive
-- within the same month, but never after Finance has started settling
-- it against a real reference.
-- =============================================================================

create table unbilled_ledger_entries (
  id                  uuid primary key default gen_random_uuid(),
  monthly_ledger_id   uuid not null unique references monthly_entitlement_ledger (id) on delete restrict,
  customer_id         uuid not null references customers (id) on delete restrict,
  stable_component_key uuid not null,
  month               date not null,
  metric              text not null,
  unbilled_quantity   numeric not null check (unbilled_quantity > 0),
  status              text not null default 'OPEN' check (status in ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table unbilled_ledger_entries is
  'Go Live + Entitlement Ledger, Phase L. Excess monthly consumption over monthly entitlement, as a metric quantity. Settled through a future Invoice reference (settlement_records), never netted against any other month''s Unearned.';

create index idx_unbilled_ledger_entries_component on unbilled_ledger_entries (stable_component_key, status);
create index idx_unbilled_ledger_entries_open on unbilled_ledger_entries (customer_id) where status <> 'SETTLED';

create table unearned_ledger_entries (
  id                  uuid primary key default gen_random_uuid(),
  monthly_ledger_id   uuid not null unique references monthly_entitlement_ledger (id) on delete restrict,
  customer_id         uuid not null references customers (id) on delete restrict,
  stable_component_key uuid not null,
  month               date not null,
  metric              text not null,
  unearned_quantity   numeric not null check (unearned_quantity > 0),
  status              text not null default 'OPEN' check (status in ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table unearned_ledger_entries is
  'Go Live + Entitlement Ledger, Phase M. Unused monthly entitlement, as a metric quantity. Settled through a future Credit Note reference (settlement_records), never netted against any other month''s Unbilled.';

create index idx_unearned_ledger_entries_component on unearned_ledger_entries (stable_component_key, status);
create index idx_unearned_ledger_entries_open on unearned_ledger_entries (customer_id) where status <> 'SETTLED';

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
    if tg_table_name = 'unbilled_ledger_entries' and new.unbilled_quantity is distinct from old.unbilled_quantity then
      raise exception 'LEDGER_ENTRY_FROZEN: % quantity is frozen once settlement has begun (id=%)', tg_table_name, old.id;
    end if;
    if tg_table_name = 'unearned_ledger_entries' and new.unearned_quantity is distinct from old.unearned_quantity then
      raise exception 'LEDGER_ENTRY_FROZEN: % quantity is frozen once settlement has begun (id=%)', tg_table_name, old.id;
    end if;
  end if;

  return new;
end;
$function$;

create trigger trg_protect_unbilled_ledger_entry_lifecycle
  before update or delete on unbilled_ledger_entries
  for each row execute function fn_protect_ledger_entry_lifecycle();

create trigger trg_protect_unearned_ledger_entry_lifecycle
  before update or delete on unearned_ledger_entries
  for each row execute function fn_protect_ledger_entry_lifecycle();

alter table unbilled_ledger_entries enable row level security;
alter table unearned_ledger_entries enable row level security;

-- =============================================================================
-- settlement_records: Finance's settlement foundation. Supports partial
-- settlement (more than one record per ledger entry); no monetary
-- calculation, no Accounts Receivable/invoice engine, only a reference
-- and a settled quantity.
-- =============================================================================

create table settlement_records (
  id                uuid primary key default gen_random_uuid(),
  ledger_entry_type text not null check (ledger_entry_type in ('unbilled', 'unearned')),
  ledger_entry_id   uuid not null,
  settlement_reference text not null,
  settled_quantity  numeric not null check (settled_quantity > 0),
  settlement_date   date not null,
  settled_by        uuid references app_users (id) on delete restrict,
  created_at        timestamptz not null default now()
);

comment on table settlement_records is
  'Go Live + Entitlement Ledger, Phase N. Finance''s settlement evidence: for Unbilled, an Invoice reference; for Unearned, a Credit Note reference. Append-only, supports partial settlement. No monetary amount is computed or stored here, only the settled metric quantity and the document reference; the future Invoice/Credit Note document itself is out of scope for this program.';

create index idx_settlement_records_ledger_entry on settlement_records (ledger_entry_type, ledger_entry_id);

revoke all on settlement_records from anon, authenticated;

-- =============================================================================
-- Permission catalog: Entitlement Ledger
-- =============================================================================

insert into permissions (resource, action, description) values
  ('entitlement', 'read', 'View Entitlement Sources, schedules, the Monthly Entitlement Ledger, and Unbilled/Unearned running ledgers.'),
  ('entitlement', 'write', 'Enter Invoice Entitlement sources and generate monthly allocation schedules (Finance).'),
  ('usage', 'read', 'View monthly Usage records.'),
  ('usage', 'write', 'Submit monthly Usage records.'),
  ('usage', 'finalize', 'Finalize a monthly Usage record, closing it to further revision.'),
  ('entitlement_settlement', 'read', 'View Unbilled/Unearned settlement history.'),
  ('entitlement_settlement', 'write', 'Record a settlement against an Unbilled or Unearned ledger entry (Finance).')
on conflict (resource, action) do nothing;

insert into roles (code, name, description) values
  ('finance_admin', 'Finance Admin', 'Can manage Entitlement Sources, Usage, and Settlement for the Entitlement Ledger.')
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'finance_admin'
  and p.resource in ('entitlement', 'usage', 'entitlement_settlement')
  and p.action in ('read', 'write', 'finalize')
on conflict (role_id, permission_id) where revoked_at is null do nothing;

-- =============================================================================
-- RPCs
-- =============================================================================

create function create_entitlement_source(
  p_id uuid,
  p_customer_id uuid,
  p_stable_component_key uuid,
  p_commercial_version_id uuid,
  p_invoice_reference text,
  p_invoice_date date,
  p_invoice_quantity numeric,
  p_metric text,
  p_invoice_duration_months integer,
  p_document_reference text,
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

  insert into entitlement_sources (
    id, customer_id, stable_component_key, commercial_version_id, invoice_reference, invoice_date,
    invoice_quantity, metric, invoice_duration_months, document_reference, created_by, updated_by
  )
  values (
    p_id, p_customer_id, p_stable_component_key, p_commercial_version_id, p_invoice_reference, p_invoice_date,
    p_invoice_quantity, p_metric, p_invoice_duration_months, p_document_reference, p_actor_user_id, p_actor_user_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;

create function cancel_entitlement_source(
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

  delete from entitlement_schedule_months where entitlement_source_id = p_id;

  update entitlement_sources
  set status = 'cancelled', cancelled_reason = p_reason, cancelled_by = p_actor_user_id, cancelled_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

/** Delete-then-reinsert for this one source (idempotent, safe retry), matching save_workflow_version_graph's own whole-graph-replace pattern. p_monthly_quantities is a jsonb array of {month, quantity}, already computed in TypeScript (even division with the remainder placed in the final month); this RPC persists, never derives, the split. */
create function generate_allocation_schedule(
  p_entitlement_source_id uuid,
  p_monthly_quantities jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns setof entitlement_schedule_months
language plpgsql
security invoker
as $function$
declare
  v_source entitlement_sources;
  v_entry jsonb;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_source from entitlement_sources where id = p_entitlement_source_id for update;
  if not found then
    raise exception 'ENTITLEMENT_SOURCE_NOT_FOUND: no entitlement_sources row for id %', p_entitlement_source_id;
  end if;

  if v_source.status <> 'active' then
    raise exception 'ENTITLEMENT_SOURCE_NOT_ACTIVE: source % has status %, only an active source may generate a schedule', p_entitlement_source_id, v_source.status;
  end if;

  delete from entitlement_schedule_months where entitlement_source_id = p_entitlement_source_id;

  for v_entry in select * from jsonb_array_elements(p_monthly_quantities)
  loop
    insert into entitlement_schedule_months (entitlement_source_id, customer_id, stable_component_key, month, monthly_quantity, created_by)
    values (
      p_entitlement_source_id, v_source.customer_id, v_source.stable_component_key,
      (v_entry ->> 'month')::date, (v_entry ->> 'quantity')::numeric, p_actor_user_id
    );
  end loop;

  return query select * from entitlement_schedule_months where entitlement_source_id = p_entitlement_source_id order by month;
end;
$function$;

/** The Go Live gate for recurring line items lives here, server-side, not only in the UI: usage before the line item's own approved Go Live month is rejected outright. On-Demand line items (no go_live_requests row ever exists for them) have no such gate. */
create function submit_monthly_usage(
  p_id uuid,
  p_customer_id uuid,
  p_stable_component_key uuid,
  p_commercial_version_id uuid,
  p_usage_month date,
  p_metric text,
  p_quantity numeric,
  p_source text,
  p_notes text,
  p_is_recurring boolean,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns monthly_usage
language plpgsql
security invoker
as $function$
declare
  v_go_live go_live_requests;
  v_row monthly_usage;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_is_recurring then
    select * into v_go_live
    from go_live_requests
    where stable_component_key = p_stable_component_key and status = 'approved'
    order by approved_at desc
    limit 1;

    if not found then
      raise exception 'USAGE_BEFORE_GO_LIVE: this recurring line item has no approved Go Live yet, usage cannot be entered';
    end if;

    if date_trunc('month', p_usage_month) < date_trunc('month', v_go_live.go_live_date) then
      raise exception 'USAGE_BEFORE_GO_LIVE: usage month % is before this line item''s Go Live month %', p_usage_month, v_go_live.go_live_date;
    end if;
  end if;

  update monthly_usage
  set is_current = false
  where customer_id = p_customer_id and stable_component_key = p_stable_component_key and usage_month = p_usage_month and is_current = true;

  insert into monthly_usage (
    id, customer_id, stable_component_key, commercial_version_id, usage_month, metric, quantity, source, notes, submitted_by
  )
  values (
    p_id, p_customer_id, p_stable_component_key, p_commercial_version_id, p_usage_month, p_metric, p_quantity, p_source, p_notes, p_actor_user_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;

create function finalize_monthly_usage(
  p_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns monthly_usage
language plpgsql
security invoker
as $function$
declare
  v_row monthly_usage;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from monthly_usage where id = p_id for update;
  if not found then
    raise exception 'MONTHLY_USAGE_NOT_FOUND: no monthly_usage row for id %', p_id;
  end if;

  if not v_row.is_current then
    raise exception 'MONTHLY_USAGE_NOT_CURRENT: this usage record has been superseded and cannot be finalized';
  end if;

  update monthly_usage set status = 'final' where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

/** Idempotent upsert of one (customer, component, month) ledger row, with every quantity ALREADY COMPUTED in TypeScript (src/features/entitlement/domain/consumption.ts): this RPC never re-derives MUG/consumption/unbilled/unearned itself. Also maintains the Unbilled/Unearned running ledger entries: creates one the first time a month has a non-zero quantity, and updates its quantity on recompute ONLY while still OPEN (fn_protect_ledger_entry_lifecycle freezes it once settlement has begun). */
create function upsert_monthly_entitlement_ledger(
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

  if p_unbilled_quantity > 0 then
    select id into v_unbilled_entry_id from unbilled_ledger_entries where monthly_ledger_id = v_row.id;
    if v_unbilled_entry_id is null then
      insert into unbilled_ledger_entries (monthly_ledger_id, customer_id, stable_component_key, month, metric, unbilled_quantity)
      values (v_row.id, p_customer_id, p_stable_component_key, p_month, p_metric, p_unbilled_quantity);
    else
      update unbilled_ledger_entries set unbilled_quantity = p_unbilled_quantity, updated_at = now()
      where id = v_unbilled_entry_id and status = 'OPEN';
    end if;
  end if;

  if p_unearned_quantity > 0 then
    select id into v_unearned_entry_id from unearned_ledger_entries where monthly_ledger_id = v_row.id;
    if v_unearned_entry_id is null then
      insert into unearned_ledger_entries (monthly_ledger_id, customer_id, stable_component_key, month, metric, unearned_quantity)
      values (v_row.id, p_customer_id, p_stable_component_key, p_month, p_metric, p_unearned_quantity);
    else
      update unearned_ledger_entries set unearned_quantity = p_unearned_quantity, updated_at = now()
      where id = v_unearned_entry_id and status = 'OPEN';
    end if;
  end if;

  return v_row;
end;
$function$;

/** Partial settlement supported: the entry's status is derived from the sum of every settlement_record against it versus its own quantity, never hand-set. */
create function record_settlement(
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
  returning * into v_record;

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

-- =============================================================================
-- Privilege hardening
-- =============================================================================

revoke execute on function
  create_entitlement_source(uuid, uuid, uuid, uuid, text, date, numeric, text, integer, text, uuid, jsonb),
  cancel_entitlement_source(uuid, text, uuid, jsonb),
  generate_allocation_schedule(uuid, jsonb, uuid, jsonb),
  submit_monthly_usage(uuid, uuid, uuid, uuid, date, text, numeric, text, text, boolean, uuid, jsonb),
  finalize_monthly_usage(uuid, uuid, jsonb),
  upsert_monthly_entitlement_ledger(uuid, uuid, uuid, date, text, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid, uuid, jsonb),
  record_settlement(text, uuid, text, numeric, date, uuid, jsonb)
from public, anon, authenticated;

grant execute on function create_entitlement_source(uuid, uuid, uuid, uuid, text, date, numeric, text, integer, text, uuid, jsonb) to service_role;
grant execute on function cancel_entitlement_source(uuid, text, uuid, jsonb) to service_role;
grant execute on function generate_allocation_schedule(uuid, jsonb, uuid, jsonb) to service_role;
grant execute on function submit_monthly_usage(uuid, uuid, uuid, uuid, date, text, numeric, text, text, boolean, uuid, jsonb) to service_role;
grant execute on function finalize_monthly_usage(uuid, uuid, jsonb) to service_role;
grant execute on function upsert_monthly_entitlement_ledger(uuid, uuid, uuid, date, text, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid, uuid, jsonb) to service_role;
grant execute on function record_settlement(text, uuid, text, numeric, date, uuid, jsonb) to service_role;
