-- Nexus: Commercial Billing, Invoice, and Reconciliation Foundation
-- (Migration 10 of the locked Commercial Foundation Migration Design).
--
-- Translates the LOCKED
-- docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md
-- (commit 31b3874) into real PostgreSQL. Exactly five tables:
-- billing_calculations, invoice_eligibility_events, invoice_evidence,
-- invoice_evidence_items, reconciliation_adjustments. Nothing in Migration 8
-- (commercial_configurations, commercial_changes, commercial_components,
-- commercial_component_capabilities, measurement_definitions,
-- commercial_commitments, commercial_commitment_components) or Migration 9
-- (usage_facts, earned_results, earned_result_usage_facts) is altered.
--
-- M10 establishes Billed and Reconciled truth: what was actually calculated
-- for billing, when it became eligible to invoice, what external invoice
-- documents exist, how they allocate against Billing Calculations and
-- Reconciliation Adjustments, and how a difference between Earned and
-- Billed truth is recorded. Earned truth itself (M9) is never rewritten by
-- anything in this file.
--
-- Reused unmodified from prior migrations: fn_reject_update_delete()
-- (Migration 8), fn_set_updated_at() (Migration 1), fn_audit_row()
-- (Migration 1), fn_assert_resource_type() (Migration 4, generalized
-- Migration "request resource type integrity"), fn_reject_truncate()
-- (Migration "platform core integrity hardening"). None are redefined here.
--
-- New this migration, following the exact conventions already proven in
-- Migrations 1-9:
--   - fn_protect_billing_calculation_scope(): BEFORE INSERT on
--     billing_calculations. Validates transaction_currency against the
--     referenced Component's own transaction_currency; when
--     source_earned_result_id is populated, validates it belongs to the
--     same Component, shares the same transaction_currency, and its own
--     period is compatible with billing_quantity_basis_used
--     ('period_actual' requires an exact period match, 'previous_period_actual'
--     requires the Earned period to precede the billing period); when
--     source_commercial_commitment_id is populated, validates it is the
--     quantity Commitment for the same Component. Relationship integrity
--     only, no Pricing Kernel arithmetic, the same posture already proven by
--     fn_protect_earned_result_scope() in Migration 9.
--   - fn_protect_invoice_evidence_item_scope(): BEFORE INSERT on
--     invoice_evidence_items. Validates the allocation target's own
--     transaction_currency matches the invoice_evidence header's currency.
--   - fn_protect_reconciliation_adjustment_lifecycle(): BEFORE UPDATE OR
--     DELETE on reconciliation_adjustments. Rejects DELETE unconditionally;
--     permits only status (open -> final, once), finalized_at, finalized_by,
--     updated_at, updated_by to change, the same shape already proven by
--     fn_protect_earned_result_lifecycle() in Migration 9.
--   - record_billing_calculation(), record_invoice_eligibility_event(),
--     record_invoice_evidence(), record_invoice_evidence_item(),
--     create_reconciliation_adjustment(), finalize_reconciliation_adjustment():
--     the six locked write-path RPCs. All SECURITY INVOKER, EXECUTE revoked
--     from public/anon/authenticated, EXECUTE granted to service_role,
--     matching every prior migration's established shape.
--
-- Grain and immutability model, exactly as locked (design doc §0a, §0b, §3,
-- §7, §9):
--   - billing_calculations is immutable, insert-only, permanent. No version
--     column, no supersession column, no "current" concept, no correction
--     chain of any kind. A plain, unconditional UNIQUE
--     (commercial_component_id, billing_period_start, billing_period_end)
--     enforces exactly one calculation per grain. A wrong calculation is
--     never replaced; the correction is recorded as a
--     reconciliation_adjustments row instead.
--   - invoice_eligibility_events is append-only; current eligibility is
--     always the latest event, a derived read, never a stored flag.
--   - invoice_evidence is a pure external-document header, immutable,
--     insert-only, deduplicated per (source_system, evidence_kind,
--     external_reference) when both are populated.
--   - invoice_evidence_items is immutable, insert-only; each row allocates
--     against exactly one of billing_calculation_id or
--     reconciliation_adjustment_id, never both, never neither. No
--     sum-equality enforcement against the invoice_evidence header total.
--   - reconciliation_adjustments carries the comparison itself
--     (earned_amount, billed_amount, monetary_difference), not a singular
--     triggering-row FK: a reconciliation window may span more than one
--     Billing Calculation or Earned Result, so no source_earned_result_id or
--     source_billing_calculation_id column exists. No unconditional UNIQUE
--     on (commercial_component_id, window_start, window_end): multiple
--     independent adjustment candidates may coexist. Correction uses the
--     already-locked supersedes_adjustment_id chain (self-supersession
--     prohibited, forks prohibited, neither Component, window, nor
--     direction is database-enforced to match between a correction and what
--     it supersedes, since a correction may itself be fixing one of those).
--     Resource-backed: the one Commercial output genuinely needing its own
--     approval workflow, tasks, attachments, and comments.
--
-- This file has not been applied to any database.


-- =============================================================================
-- Resource Registry seed
-- =============================================================================

-- resource_types is migration-managed structural metadata, not business
-- seed data, matching Migration 8's own precedent. No ON CONFLICT guard: an
-- incompatible pre-existing 'reconciliation_adjustment' row would mean this
-- migration's assumptions about the current schema state are wrong, and
-- migration failure is preferable to silently accepting that.
insert into resource_types (type_code, description)
values ('reconciliation_adjustment', 'A single comparison candidate between Earned and Billed truth for one Commercial Component and reconciliation window (docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md).');


-- =============================================================================
-- billing_calculations: scope validation function
-- =============================================================================

-- BEFORE INSERT on billing_calculations. Validates that this specific row's
-- captured snapshot is actually true and internally consistent at the
-- moment of insert: the transaction_currency matches the referenced
-- Component's own transaction_currency; when populated,
-- source_earned_result_id belongs to the same Component, shares the same
-- transaction_currency, and its own period is compatible with
-- billing_quantity_basis_used; when populated,
-- source_commercial_commitment_id is the correct quantity Commitment for
-- the same Component. Relationship integrity only: no Pricing Kernel
-- arithmetic, no rate or rounding logic.
--
-- Every table this function reads (commercial_components, earned_results,
-- commercial_commitments) is immutable on every column read here (M8/M9
-- lifecycle triggers permit no change to any of them), so ordinary,
-- unlocked SELECTs are sufficient; there is no concurrent-mutation race to
-- guard against here, the same reasoning already proven by
-- fn_protect_earned_result_scope() in Migration 9.
create function fn_protect_billing_calculation_scope()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_component_currency      text;
  v_earned_component_id     uuid;
  v_earned_currency         text;
  v_earned_period_start     date;
  v_earned_period_end       date;
  v_commitment_kind         text;
  v_commitment_component_id uuid;
begin
  select transaction_currency into v_component_currency
  from public.commercial_components
  where id = new.commercial_component_id;

  -- A missing Component is a genuinely invalid foreign key reference, not
  -- this function's concern: fall through and let the ordinary
  -- commercial_component_id foreign key raise it.
  if not found then
    return new;
  end if;

  if new.transaction_currency is distinct from v_component_currency then
    raise exception
      'billing_calculations: transaction_currency % does not match component %''s own '
      'transaction_currency %', new.transaction_currency, new.commercial_component_id, v_component_currency;
  end if;

  if new.source_earned_result_id is not null then
    select commercial_component_id, transaction_currency, period_start, period_end
      into v_earned_component_id, v_earned_currency, v_earned_period_start, v_earned_period_end
    from public.earned_results
    where id = new.source_earned_result_id;

    -- A missing Earned Result is likewise a genuinely invalid foreign key
    -- reference; fall through and let source_earned_result_id's own
    -- foreign key raise it.
    if not found then
      return new;
    end if;

    if v_earned_component_id is distinct from new.commercial_component_id then
      raise exception
        'billing_calculations: source_earned_result_id % belongs to component %, not this '
        'row''s component %', new.source_earned_result_id, v_earned_component_id, new.commercial_component_id;
    end if;

    if v_earned_currency is distinct from new.transaction_currency then
      raise exception
        'billing_calculations: source_earned_result_id %''s transaction_currency % does not '
        'match this row''s transaction_currency %',
        new.source_earned_result_id, v_earned_currency, new.transaction_currency;
    end if;

    if new.billing_quantity_basis_used = 'period_actual'
      and (v_earned_period_start is distinct from new.billing_period_start
           or v_earned_period_end is distinct from new.billing_period_end)
    then
      raise exception
        'billing_calculations: period_actual requires source_earned_result_id %''s own '
        'period (%, %) to equal this row''s billing period (%, %)',
        new.source_earned_result_id, v_earned_period_start, v_earned_period_end,
        new.billing_period_start, new.billing_period_end;
    end if;

    if new.billing_quantity_basis_used = 'previous_period_actual'
      and v_earned_period_end >= new.billing_period_start
    then
      raise exception
        'billing_calculations: previous_period_actual requires source_earned_result_id %''s '
        'own period_end (%) to precede this row''s billing_period_start (%)',
        new.source_earned_result_id, v_earned_period_end, new.billing_period_start;
    end if;
  end if;

  if new.source_commercial_commitment_id is not null then
    select kind, commercial_component_id into v_commitment_kind, v_commitment_component_id
    from public.commercial_commitments
    where id = new.source_commercial_commitment_id;

    -- A missing Commitment is likewise a genuinely invalid foreign key
    -- reference; fall through and let source_commercial_commitment_id's own
    -- foreign key raise it.
    if not found then
      return new;
    end if;

    if v_commitment_kind is distinct from 'quantity' or v_commitment_component_id is distinct from new.commercial_component_id then
      raise exception
        'billing_calculations: source_commercial_commitment_id % is not the quantity '
        'commitment for component % (commitment kind=%, commitment''s own component=%)',
        new.source_commercial_commitment_id, new.commercial_component_id, v_commitment_kind, v_commitment_component_id;
    end if;
  end if;

  return new;
end;
$$;

comment on function fn_protect_billing_calculation_scope() is
  'BEFORE INSERT on billing_calculations. Validates transaction_currency against the '
  'referenced Component, and, when populated, that source_earned_result_id belongs to the '
  'same Component with a compatible period and that source_commercial_commitment_id is the '
  'correct quantity Commitment for that same Component. Relationship integrity only, no '
  'Pricing Kernel arithmetic. See '
  'docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §3.';


-- =============================================================================
-- billing_calculations
-- =============================================================================

-- Immutable, insert-only, permanent once created. No calculation_version,
-- no supersedes_billing_calculation_id, no "current" concept, no correction
-- chain of any kind: a wrong calculation is never replaced, only explained
-- by a reconciliation_adjustments row. Not Resource-backed: a computed
-- fact, not independently actioned.
--
-- id is caller-supplied (no DEFAULT), for retry safety only, never for
-- version identity: the same technical retry after a timeout is recognized
-- and answered idempotently by record_billing_calculation() below, the same
-- caller-pre-generates-the-row's-own-id convention already proven by
-- earned_results.id in Migration 9.
create table billing_calculations (
  id                              uuid primary key,

  commercial_component_id         uuid not null references commercial_components (id) on delete restrict,
  billing_period_start            date not null,
  billing_period_end              date not null,

  billing_quantity_basis_used     text not null check (billing_quantity_basis_used in ('mug', 'previous_period_actual', 'period_actual', 'fixed')),
  basis_quantity                  numeric,
  source_earned_result_id         uuid references earned_results (id) on delete restrict,
  source_commercial_commitment_id uuid references commercial_commitments (id) on delete restrict,

  pricing_calculation_version     text not null,
  rounding_policy_version         text not null,
  calculated_amount               numeric not null check (calculated_amount >= 0),
  transaction_currency            text not null,

  created_at                      timestamptz not null default now(),
  created_by                      uuid not null references app_users (id) on delete restrict,

  constraint chk_billing_calculations_period_valid check (billing_period_end >= billing_period_start),
  -- Shape rule (design §3): source_earned_result_id populated only for
  -- previous_period_actual/period_actual; source_commercial_commitment_id
  -- populated only for mug; neither populated for fixed; basis_quantity
  -- populated together with whichever source is used, null for fixed.
  constraint chk_billing_calculations_basis_shape check (
    (billing_quantity_basis_used in ('previous_period_actual', 'period_actual')
      and source_earned_result_id is not null
      and source_commercial_commitment_id is null
      and basis_quantity is not null)
    or (billing_quantity_basis_used = 'mug'
      and source_commercial_commitment_id is not null
      and source_earned_result_id is null
      and basis_quantity is not null)
    or (billing_quantity_basis_used = 'fixed'
      and source_earned_result_id is null
      and source_commercial_commitment_id is null
      and basis_quantity is null)
  ),

  -- Database-enforced grain: exactly one calculation per (Component,
  -- billing period). Not versioning: no self-FK, no chain, no "current"
  -- concept. See design §3, §0a for why this is the strongest
  -- interpretation the locked design supports, not an invention.
  constraint uq_billing_calculations_grain unique (commercial_component_id, billing_period_start, billing_period_end)
);

comment on table billing_calculations is
  'Immutable, insert-only, permanent historical Billing calculation evidence. One row per '
  '(commercial_component_id, billing_period_start, billing_period_end), database-enforced. No '
  'version column, no supersession column, no correction chain: a wrong calculation is never '
  'replaced, only explained by a reconciliation_adjustments row. Not Resource-backed. See '
  'docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §0a, §3.';

comment on column billing_calculations.id is
  'Caller-supplied retry identity (no DEFAULT), never version identity: this table has no '
  'versions. record_billing_calculation() treats a repeat insert with the same id and '
  'identical inputs as an idempotent replay.';

create index idx_billing_calculations_source_earned_result_id on billing_calculations (source_earned_result_id);
create index idx_billing_calculations_source_commercial_commitment_id on billing_calculations (source_commercial_commitment_id);

create trigger trg_billing_calculations_protect_scope
  before insert on billing_calculations
  for each row
  execute function fn_protect_billing_calculation_scope();

create trigger trg_billing_calculations_reject_update_delete
  before update or delete on billing_calculations
  for each row
  execute function fn_reject_update_delete();

create trigger trg_audit_billing_calculations
  after insert or update or delete on billing_calculations
  for each row execute function fn_audit_row('id');


-- =============================================================================
-- RPC: record_billing_calculation
-- =============================================================================

-- The atomic Billing-calculation write path. Caller-supplied p_id is the
-- calculation attempt identity, never version identity (this table has no
-- versions): a retry with the same id and identical substantive inputs is
-- an idempotent no-op that returns the existing row and writes no new row,
-- no duplicate audit_log entry. The same id reused with any differing
-- substantive input raises BILLING_CALCULATION_ID_CONFLICT.
--
-- On a genuinely new attempt, the serialization anchor is the stable
-- commercial_components row for p_commercial_component_id, locked FOR
-- UPDATE first, the same outer-parent-lock-first technique already proven
-- by record_earned_result() in Migration 9. Only after that lock is held
-- does this function probe the exact grain (commercial_component_id,
-- billing_period_start, billing_period_end) as a separate, fresh
-- statement: because that probe runs strictly after the component lock is
-- acquired, it always observes every billing_calculations row any other
-- transaction has already committed for this Component, so two concurrent
-- attempts for the same grain cannot both pass the probe. A genuine
-- duplicate attempt (a different id, an already-occupied grain) raises
-- BILLING_CALCULATION_GRAIN_CONFLICT, a named conflict, rather than
-- surfacing a raw unique violation; the plain unique constraint on the
-- grain remains the final, authoritative guard regardless of what this
-- function computes. The grain probe's found row is additionally checked
-- against p_id: since the earlier id-probe ran unlocked, two genuinely
-- concurrent calls sharing the same p_id can both miss it and both reach
-- the grain probe, so an occupant sharing this call's own id is resolved
-- as an idempotent replay (or BILLING_CALCULATION_ID_CONFLICT on a
-- genuine payload mismatch), never misreported as a grain conflict.
--
-- fn_protect_billing_calculation_scope() remains the authoritative safety
-- defense for snapshot integrity; this function does not duplicate it.
create function record_billing_calculation(
  p_id uuid,
  p_commercial_component_id uuid,
  p_billing_period_start date,
  p_billing_period_end date,
  p_billing_quantity_basis_used text,
  p_calculated_amount numeric,
  p_transaction_currency text,
  p_pricing_calculation_version text,
  p_rounding_policy_version text,
  p_actor_user_id uuid,
  p_basis_quantity numeric default null,
  p_source_earned_result_id uuid default null,
  p_source_commercial_commitment_id uuid default null,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.billing_calculations
language plpgsql
security invoker
as $$
declare
  v_existing      public.billing_calculations;
  v_grain_existing public.billing_calculations;
  v_new           public.billing_calculations;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  -- Idempotency probe, before any business logic: a delayed retry of an
  -- attempt that already completed must return the completed result rather
  -- than attempt a second insert.
  select * into v_existing
  from public.billing_calculations
  where id = p_id;

  if found then
    if v_existing.commercial_component_id is distinct from p_commercial_component_id
      or v_existing.billing_period_start is distinct from p_billing_period_start
      or v_existing.billing_period_end is distinct from p_billing_period_end
      or v_existing.billing_quantity_basis_used is distinct from p_billing_quantity_basis_used
      or v_existing.basis_quantity is distinct from p_basis_quantity
      or v_existing.source_earned_result_id is distinct from p_source_earned_result_id
      or v_existing.source_commercial_commitment_id is distinct from p_source_commercial_commitment_id
      or v_existing.calculated_amount is distinct from p_calculated_amount
      or v_existing.transaction_currency is distinct from p_transaction_currency
      or v_existing.pricing_calculation_version is distinct from p_pricing_calculation_version
      or v_existing.rounding_policy_version is distinct from p_rounding_policy_version
    then
      raise exception
        'BILLING_CALCULATION_ID_CONFLICT: id % already exists with substantive inputs that '
        'differ from this call', p_id;
    end if;

    -- Idempotent replay: return the existing row unchanged. No DML runs on
    -- this path, so no new audit_log row is written.
    return v_existing;
  end if;

  -- New attempt: lock the stable parent Component row first (serialization
  -- anchor, see header comment above). This also confirms the Component
  -- exists, so BILLING_COMPONENT_NOT_FOUND is still raised by name.
  perform 1
  from public.commercial_components
  where id = p_commercial_component_id
  for update;

  if not found then
    raise exception 'BILLING_COMPONENT_NOT_FOUND: no commercial_components row for id %', p_commercial_component_id;
  end if;

  -- Only now, with the Component lock held, probe the exact grain as a
  -- fresh statement, so it correctly observes every row any other,
  -- previously-blocked transaction has since committed for this Component.
  select * into v_grain_existing
  from public.billing_calculations
  where commercial_component_id = p_commercial_component_id
    and billing_period_start = p_billing_period_start
    and billing_period_end = p_billing_period_end;

  if found then
    -- The unlocked id-probe above ran before the Component lock was
    -- acquired, so two genuinely concurrent calls sharing the same p_id
    -- can both miss it (neither has committed yet) and both reach this
    -- point; the second one only observes the first's row here, after
    -- blocking on the lock. If the grain occupant IS this call's own id,
    -- this is that same race, not a distinct id colliding on the grain:
    -- resolve it exactly like the id-probe branch above (idempotent
    -- replay, or a named conflict if the payload genuinely differs)
    -- rather than misreporting it as BILLING_CALCULATION_GRAIN_CONFLICT.
    if v_grain_existing.id = p_id then
      if v_grain_existing.billing_quantity_basis_used is distinct from p_billing_quantity_basis_used
        or v_grain_existing.basis_quantity is distinct from p_basis_quantity
        or v_grain_existing.source_earned_result_id is distinct from p_source_earned_result_id
        or v_grain_existing.source_commercial_commitment_id is distinct from p_source_commercial_commitment_id
        or v_grain_existing.calculated_amount is distinct from p_calculated_amount
        or v_grain_existing.transaction_currency is distinct from p_transaction_currency
        or v_grain_existing.pricing_calculation_version is distinct from p_pricing_calculation_version
        or v_grain_existing.rounding_policy_version is distinct from p_rounding_policy_version
      then
        raise exception
          'BILLING_CALCULATION_ID_CONFLICT: id % already exists with substantive inputs that '
          'differ from this call', p_id;
      end if;

      return v_grain_existing;
    end if;

    raise exception
      'BILLING_CALCULATION_GRAIN_CONFLICT: a billing_calculations row already exists for '
      'component %, period % to % (existing id=%, attempted id=%)',
      p_commercial_component_id, p_billing_period_start, p_billing_period_end, v_grain_existing.id, p_id;
  end if;

  insert into public.billing_calculations (
    id, commercial_component_id, billing_period_start, billing_period_end,
    billing_quantity_basis_used, basis_quantity,
    source_earned_result_id, source_commercial_commitment_id,
    pricing_calculation_version, rounding_policy_version,
    calculated_amount, transaction_currency, created_by
  )
  values (
    p_id, p_commercial_component_id, p_billing_period_start, p_billing_period_end,
    p_billing_quantity_basis_used, p_basis_quantity,
    p_source_earned_result_id, p_source_commercial_commitment_id,
    p_pricing_calculation_version, p_rounding_policy_version,
    p_calculated_amount, p_transaction_currency, p_actor_user_id
  )
  returning * into v_new;

  return v_new;
end;
$$;

comment on function record_billing_calculation(uuid, uuid, date, date, text, numeric, text, text, text, uuid, numeric, uuid, uuid, uuid, jsonb) is
  'Atomic Billing-calculation write path. Idempotent on p_id: a retry with identical '
  'substantive inputs returns the existing row with no new DML; a retry with any differing '
  'input raises BILLING_CALCULATION_ID_CONFLICT. On a genuinely new attempt, locks the parent '
  'commercial_components row first, then probes the exact grain in a fresh query issued after '
  'that lock is held; an occupied grain under a different id raises '
  'BILLING_CALCULATION_GRAIN_CONFLICT. Also raises BILLING_COMPONENT_NOT_FOUND as named. '
  'fn_protect_billing_calculation_scope() remains the authoritative, database-enforced '
  'snapshot-integrity guard. No Billing versioning. See '
  'docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §3, §10, §14.';


-- =============================================================================
-- invoice_eligibility_events
-- =============================================================================

-- Append-only evidence: answers "when did this become eligible or
-- ineligible, and why," never "has this been invoiced." Current eligibility
-- is always the latest event per Billing Calculation, a derived query,
-- never a stored flag on billing_calculations. No idempotency key: each
-- eligibility decision is a genuine, discrete Finance or system action, not
-- an externally-keyed event subject to redelivery.
create table invoice_eligibility_events (
  id                      uuid primary key default gen_random_uuid(),
  billing_calculation_id  uuid not null references billing_calculations (id) on delete restrict,
  eligible                boolean not null,
  reason                  text not null,
  decided_by              uuid references app_users (id) on delete restrict,
  created_at              timestamptz not null default now(),
  created_by              uuid not null references app_users (id) on delete restrict
);

comment on table invoice_eligibility_events is
  'Append-only eligibility decision log for one billing_calculations row. Current eligibility '
  'is always the latest event, a derived read, never a stored flag. No UPDATE path exists. '
  'decided_by is nullable: some decisions are system-driven (for example a billing date being '
  'reached), not a human action. See '
  'docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §4.';

-- Supports the "current eligibility = latest event" derived read
-- deterministically: created_at desc, id desc breaks any same-timestamp
-- tie without adding a new business column, matching billing_calculation_id
-- as the leading column every lookup filters on.
create index idx_invoice_eligibility_events_billing_calculation_id
  on invoice_eligibility_events (billing_calculation_id, created_at desc, id desc);

create trigger trg_invoice_eligibility_events_reject_update_delete
  before update or delete on invoice_eligibility_events
  for each row
  execute function fn_reject_update_delete();

-- No audit trigger: already an append-only decision log; auditing an
-- audit-shaped table duplicates evidence for no benefit, matching the
-- already-locked reasoning (design §13).


-- =============================================================================
-- RPC: record_invoice_eligibility_event
-- =============================================================================

-- Inserts one immutable eligibility event. Plain insert, no dedup key
-- (design §10): each call is a genuine, discrete new decision, never
-- deduplicated.
create function record_invoice_eligibility_event(
  p_billing_calculation_id uuid,
  p_eligible boolean,
  p_reason text,
  p_actor_user_id uuid,
  p_decided_by uuid default null,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.invoice_eligibility_events
language plpgsql
security invoker
as $$
declare
  v_found boolean;
  v_new   public.invoice_eligibility_events;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select exists (
    select 1 from public.billing_calculations where id = p_billing_calculation_id
  ) into v_found;

  if not v_found then
    raise exception 'BILLING_CALCULATION_NOT_FOUND: no billing_calculations row for id %', p_billing_calculation_id;
  end if;

  insert into public.invoice_eligibility_events (
    billing_calculation_id, eligible, reason, decided_by, created_by
  )
  values (
    p_billing_calculation_id, p_eligible, p_reason, p_decided_by, p_actor_user_id
  )
  returning * into v_new;

  return v_new;
end;
$$;

comment on function record_invoice_eligibility_event(uuid, boolean, text, uuid, uuid, uuid, jsonb) is
  'Inserts one immutable invoice_eligibility_events row. Plain insert, no dedup key: every '
  'call is a genuine, discrete new decision. Raises BILLING_CALCULATION_NOT_FOUND as named. '
  'See docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §4, §10.';


-- =============================================================================
-- invoice_evidence
-- =============================================================================

-- A pure external-document header. No FK to any Nexus financial item:
-- allocation lives entirely in invoice_evidence_items. Not Resource-backed
-- for this migration (design §5, §12): a plausible future candidate, not
-- required for this migration's actual capability.
create table invoice_evidence (
  id                  uuid primary key default gen_random_uuid(),
  evidence_kind       text not null check (evidence_kind in ('invoice', 'credit_note')),
  external_reference  text,
  external_date       date,
  amount              numeric not null check (amount >= 0),
  currency            text not null,
  source_system       text,
  created_at          timestamptz not null default now(),
  created_by          uuid not null references app_users (id) on delete restrict
);

comment on table invoice_evidence is
  'Pure external-document header (invoice or credit note). No FK to any Nexus financial item; '
  'allocation lives entirely in invoice_evidence_items. Not Resource-backed. Immutable, '
  'insert-only: a correction is a new row, never an edit. Deduplicated per (source_system, '
  'evidence_kind, external_reference) when both are populated, via '
  'uq_invoice_evidence_source_identity below. See '
  'docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §5, §12.';

-- Ingestion idempotency: a partial unique index, not a table CONSTRAINT
-- (PostgreSQL's ADD CONSTRAINT ... UNIQUE does not support a WHERE clause).
-- Manually entered evidence (no source_system or no external_reference) is
-- never deduplicated: there is no reliable natural key to derive one from.
create unique index uq_invoice_evidence_source_identity
  on invoice_evidence (source_system, evidence_kind, external_reference)
  where source_system is not null and external_reference is not null;

comment on index uq_invoice_evidence_source_identity is
  'Ingestion deduplication namespace, evaluated against Configuration/customer/legal-entity '
  'scope and deliberately not widened: invoice_evidence is a pure header with no such FK. See '
  'docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §5.';

create trigger trg_invoice_evidence_reject_update_delete
  before update or delete on invoice_evidence
  for each row
  execute function fn_reject_update_delete();

create trigger trg_audit_invoice_evidence
  after insert or update or delete on invoice_evidence
  for each row execute function fn_audit_row('id');


-- =============================================================================
-- RPC: record_invoice_evidence
-- =============================================================================

-- Inserts one invoice_evidence header. When both p_source_system and
-- p_external_reference are supplied, deduplicates against
-- uq_invoice_evidence_source_identity: an insert colliding with an existing
-- row's identity blocks (standard PostgreSQL unique-index behavior for a
-- concurrent conflicting insert) until the first transaction resolves, then
-- either proceeds (the first rolled back) or raises unique_violation (the
-- first committed), which this function catches and translates. This is
-- inherently concurrency-safe without a separate serialization-anchor lock,
-- unlike record_usage_fact()/record_billing_calculation(): there is no
-- stable parent row to lock here (invoice_evidence has no FK to any other
-- Nexus table), so the unique index itself is the serialization point.
-- Manual entry (either field null) is never deduplicated: every call
-- inserts a new row.
--
-- The EXCEPTION handler unambiguously means the source-identity partial
-- index, never a primary key collision on id: id has no caller-supplied
-- parameter on this function at all (always gen_random_uuid()), and
-- invoice_evidence declares exactly one other unique constraint
-- (uq_invoice_evidence_source_identity), so unique_violation on this
-- table cannot originate from anywhere else. The re-probe below still
-- filters explicitly on (source_system, evidence_kind, external_reference)
-- rather than assuming which row it is, so the reasoning holds even if a
-- future migration ever adds another unique constraint to this table.
create function record_invoice_evidence(
  p_evidence_kind text,
  p_amount numeric,
  p_currency text,
  p_actor_user_id uuid,
  p_external_reference text default null,
  p_external_date date default null,
  p_source_system text default null,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.invoice_evidence
language plpgsql
security invoker
as $$
declare
  v_existing public.invoice_evidence;
  v_new      public.invoice_evidence;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  begin
    insert into public.invoice_evidence (
      evidence_kind, external_reference, external_date, amount, currency, source_system, created_by
    )
    values (
      p_evidence_kind, p_external_reference, p_external_date, p_amount, p_currency, p_source_system, p_actor_user_id
    )
    returning * into v_new;

    return v_new;
  exception
    when unique_violation then
      select * into v_existing
      from public.invoice_evidence
      where source_system is not distinct from p_source_system
        and evidence_kind = p_evidence_kind
        and external_reference is not distinct from p_external_reference;

      if not found
        or v_existing.external_date is distinct from p_external_date
        or v_existing.amount is distinct from p_amount
        or v_existing.currency is distinct from p_currency
      then
        raise exception
          'INVOICE_EVIDENCE_IDENTITY_CONFLICT: source_system=%, evidence_kind=%, '
          'external_reference=% already recorded with different external_date, amount, or '
          'currency', p_source_system, p_evidence_kind, p_external_reference;
      end if;

      -- Idempotent replay: return the existing row unchanged.
      return v_existing;
  end;
end;
$$;

comment on function record_invoice_evidence(text, numeric, text, uuid, text, date, text, uuid, jsonb) is
  'Inserts one invoice_evidence header. When source_system and external_reference are both '
  'supplied, deduplicates against uq_invoice_evidence_source_identity: a matching existing row '
  'with identical substantive inputs is returned unchanged; a matching row with any differing '
  'input raises INVOICE_EVIDENCE_IDENTITY_CONFLICT. Manual entry is never deduplicated. '
  'Concurrency-safe via catching unique_violation, since PostgreSQL blocks a concurrent '
  'conflicting insert until the first transaction resolves. See '
  'docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §5, §10.';


-- =============================================================================
-- reconciliation_adjustments: lifecycle validation function
-- =============================================================================

-- BEFORE UPDATE OR DELETE on reconciliation_adjustments (not INSERT:
-- insert-time shape is fully covered by this table's own declarative
-- constraints; see the table definition below). Rejects DELETE
-- unconditionally. Permits exactly one UPDATE transition: status (open ->
-- final, once), together with finalized_at, finalized_by, updated_at, and
-- updated_by. final -> open is rejected. Supersession is an INSERT of a
-- different row, never an UPDATE of this one, so it is untouched by this
-- function, the same independent-axes posture already proven by
-- fn_protect_earned_result_lifecycle() in Migration 9.
create function fn_protect_reconciliation_adjustment_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'reconciliation_adjustments is an immutable Finance record: DELETE is not permitted (resource_id=%)', old.resource_id;
  end if;

  -- tg_op = 'UPDATE'. status, finalized_at, finalized_by, updated_at, and
  -- updated_by are the only columns ever permitted to change.
  v_old_core := to_jsonb(old) - 'status' - 'finalized_at' - 'finalized_by' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new) - 'status' - 'finalized_at' - 'finalized_by' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'reconciliation_adjustments: only status (open -> final, once), finalized_at, '
      'finalized_by, updated_at, and updated_by may change (resource_id=%)', old.resource_id;
  end if;

  if old.status = 'final' and new.status is distinct from 'final' then
    raise exception
      'reconciliation_adjustments: status is already final and cannot change again (resource_id=%)',
      old.resource_id;
  end if;

  if old.status = 'open' and new.status = 'final' then
    if new.finalized_at is null or new.finalized_by is null then
      raise exception
        'reconciliation_adjustments: finalizing (open -> final) requires both finalized_at '
        'and finalized_by to be set (resource_id=%)', old.resource_id;
    end if;
  end if;

  if new.status = 'open' and (new.finalized_at is not null or new.finalized_by is not null) then
    raise exception
      'reconciliation_adjustments: finalized_at/finalized_by must remain null while status is '
      'open (resource_id=%)', old.resource_id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_reconciliation_adjustment_lifecycle() is
  'BEFORE UPDATE OR DELETE on reconciliation_adjustments. Rejects DELETE unconditionally. '
  'Permits only status (open -> final, once), finalized_at, finalized_by, updated_at, and '
  'updated_by to change; every other column, including every comparison and provenance field, '
  'is immutable. Independent of supersession: a final row may still be superseded by a later '
  'correction. See docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §7.';


-- =============================================================================
-- reconciliation_adjustments
-- =============================================================================

-- Resource-backed: resource_id reuses resources.resource_id, exactly as
-- locked. Aggregate comparison result, not a singular triggering-row FK
-- (design §0b, §7): earned_amount/billed_amount, both nullable, populated
-- together whenever a genuine two-sided comparison applies; left null
-- together otherwise (a rounding correction, a manual Finance adjustment).
-- No source_earned_result_id or source_billing_calculation_id column: a
-- reconciliation window may span more than one Billing Calculation or
-- Earned Result, so no singular source FK is added. A specific triggering
-- row, when one exists, is named descriptively in reason.
--
-- window_start/window_end, not period_start/period_end: a reconciliation
-- window is a distinct concept from a billing_calculations.billing_period_*
-- or an earned_results earning period, and may span several of either.
--
-- No unconditional UNIQUE (commercial_component_id, window_start,
-- window_end): multiple independent adjustment candidates may coexist by
-- design (no netting).
create table reconciliation_adjustments (
  resource_id               uuid primary key references resources (resource_id) on delete restrict,
  commercial_component_id   uuid not null references commercial_components (id) on delete restrict,

  window_start              date not null,
  window_end                date not null,

  earned_amount             numeric,
  billed_amount             numeric,
  direction                 text not null check (direction in ('additional_billing', 'credit_note')),
  monetary_difference       numeric not null check (monetary_difference > 0),
  transaction_currency      text not null,
  reason                    text not null,
  quantity_explanation      jsonb,
  rate_provenance           jsonb not null,

  supersedes_adjustment_id  uuid references reconciliation_adjustments (resource_id) on delete restrict,

  status                    text not null default 'open' check (status in ('open', 'final')),
  finalized_at              timestamptz,
  finalized_by              uuid references app_users (id) on delete restrict,

  created_at                timestamptz not null default now(),
  created_by                uuid not null references app_users (id) on delete restrict,
  updated_at                timestamptz not null default now(),
  updated_by                uuid not null references app_users (id) on delete restrict,

  constraint chk_reconciliation_adjustments_window_valid check (window_end >= window_start),
  constraint chk_reconciliation_adjustments_no_self_supersession check (supersedes_adjustment_id is distinct from resource_id),
  -- Both null (no two-sided comparison shape, e.g. a rounding correction)
  -- or both populated (the common case); never one without the other.
  constraint chk_reconciliation_adjustments_earned_billed_shape check ((earned_amount is null) = (billed_amount is null)),
  -- finalized_at/finalized_by are set together exactly when status =
  -- 'final', and both null while status = 'open'.
  constraint chk_reconciliation_adjustments_finalized_shape check (
    (status = 'final' and finalized_at is not null and finalized_by is not null)
    or (status = 'open' and finalized_at is null and finalized_by is null)
  ),

  -- No forking: a given adjustment can be corrected by at most one
  -- successor. Multiple NULLs (every non-corrected adjustment) are
  -- non-conflicting.
  constraint uq_reconciliation_adjustments_supersedes unique (supersedes_adjustment_id)
);

comment on table reconciliation_adjustments is
  'Resource-backed explicit correction layer between Earned, Billing, and Invoice truth. '
  'Aggregate comparison result (earned_amount, billed_amount, monetary_difference) for one '
  'Commercial Component and reconciliation window, not a singular triggering-row FK: a window '
  'may span more than one Billing Calculation or Earned Result. Multiple independent '
  'candidates may coexist for the same Component/window; nothing sums or merges them '
  '(no-netting). Immutable except the single open -> final transition. Correction is a new '
  'row via supersedes_adjustment_id (no-fork, self-supersession prohibited); neither Component, '
  'window, nor direction is database-enforced to match between a correction and what it '
  'supersedes, since the correction may itself be fixing one of those. See '
  'docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §0b, §7, §9.';

comment on column reconciliation_adjustments.reason is
  'Free text, not null. May name a specific triggering Billing Calculation or Earned Result '
  'descriptively (for example ''billing calculation error, B1 undercalculated''); no '
  'structural FK to either exists.';

comment on column reconciliation_adjustments.quantity_explanation is
  'Nullable jsonb. Populated only when a quantity or billing-basis comparison is genuinely '
  'meaningful for this adjustment; never a fabricated quantity. See '
  'docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §10 part A, docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §0c.';

comment on column reconciliation_adjustments.rate_provenance is
  'Not null jsonb. Sufficient effective-rate and commercial-period provenance to explain the '
  'monetary amount, always populated regardless of whether quantity_explanation applies. See '
  'docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §10 part A, docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §0c.';

create index idx_reconciliation_adjustments_component_window
  on reconciliation_adjustments (commercial_component_id, window_start, window_end);

create trigger trg_reconciliation_adjustments_assert_resource_type
  before insert or update of resource_id on reconciliation_adjustments
  for each row
  execute function fn_assert_resource_type('reconciliation_adjustment');

create trigger trg_reconciliation_adjustments_protect_lifecycle
  before update or delete on reconciliation_adjustments
  for each row
  execute function fn_protect_reconciliation_adjustment_lifecycle();

create trigger trg_reconciliation_adjustments_updated_at
  before update on reconciliation_adjustments
  for each row
  execute function fn_set_updated_at();

create trigger trg_audit_reconciliation_adjustments
  after insert or update or delete on reconciliation_adjustments
  for each row execute function fn_audit_row('resource_id');


-- =============================================================================
-- RPC: create_reconciliation_adjustment
-- =============================================================================

-- Atomic Resource-plus-row creation, mirroring
-- create_commercial_configuration_with_change() (Migration 8) exactly: a
-- resources row minted with a literal resource_type before the feature row,
-- in the same transaction; any failure (a CHECK violation, a bad FK) rolls
-- back both, leaving neither half created. p_resource_id is caller-supplied
-- (no DEFAULT), the same reason commercial_configurations.id is
-- caller-supplied: the RPC must know the id before it exists to insert both
-- the resources row and the reconciliation_adjustments row referencing it
-- inside one transaction. No idempotency probe on p_resource_id: matching
-- create_commercial_configuration_with_change's own shape exactly, this is
-- a plain insert, no dedup key (design §10), not a new mechanism.
--
-- When p_supersedes_adjustment_id is supplied, the predecessor row is
-- locked FOR UPDATE first (the same serialization-anchor technique already
-- proven by correct_usage_fact() in Migration 9), then probed for an
-- existing successor: two concurrent attempts to correct the same
-- predecessor serialize against this lock, so the second sees the first's
-- just-committed successor and raises RECONCILIATION_ALREADY_SUPERSEDED
-- instead of racing the database's own uq_reconciliation_adjustments_supersedes
-- constraint (which remains the final integrity guard regardless).
create function create_reconciliation_adjustment(
  p_resource_id uuid,
  p_commercial_component_id uuid,
  p_window_start date,
  p_window_end date,
  p_direction text,
  p_monetary_difference numeric,
  p_transaction_currency text,
  p_reason text,
  p_actor_user_id uuid,
  p_rate_provenance jsonb,
  p_earned_amount numeric default null,
  p_billed_amount numeric default null,
  p_quantity_explanation jsonb default null,
  p_supersedes_adjustment_id uuid default null,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.reconciliation_adjustments
language plpgsql
security invoker
as $$
declare
  v_already_superseded  boolean;
  v_new                 public.reconciliation_adjustments;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_supersedes_adjustment_id is not null then
    perform 1
    from public.reconciliation_adjustments
    where resource_id = p_supersedes_adjustment_id
    for update;

    if not found then
      raise exception 'RECONCILIATION_ADJUSTMENT_NOT_FOUND: no reconciliation_adjustments row for id %', p_supersedes_adjustment_id;
    end if;

    select exists (
      select 1 from public.reconciliation_adjustments where supersedes_adjustment_id = p_supersedes_adjustment_id
    ) into v_already_superseded;

    if v_already_superseded then
      raise exception
        'RECONCILIATION_ALREADY_SUPERSEDED: reconciliation_adjustments % already has a successor',
        p_supersedes_adjustment_id;
    end if;
  end if;

  insert into public.resources (resource_id, resource_type, created_by)
  values (p_resource_id, 'reconciliation_adjustment', p_actor_user_id);

  insert into public.reconciliation_adjustments (
    resource_id, commercial_component_id, window_start, window_end,
    earned_amount, billed_amount, direction, monetary_difference, transaction_currency, reason,
    quantity_explanation, rate_provenance,
    supersedes_adjustment_id, created_by, updated_by
  )
  values (
    p_resource_id, p_commercial_component_id, p_window_start, p_window_end,
    p_earned_amount, p_billed_amount, p_direction, p_monetary_difference, p_transaction_currency, p_reason,
    p_quantity_explanation, p_rate_provenance,
    p_supersedes_adjustment_id, p_actor_user_id, p_actor_user_id
  )
  returning * into v_new;

  return v_new;
end;
$$;

comment on function create_reconciliation_adjustment(uuid, uuid, date, date, text, numeric, text, text, uuid, jsonb, numeric, numeric, jsonb, uuid, uuid, jsonb) is
  'Atomically creates the resources row (resource_type = reconciliation_adjustment) together '
  'with its reconciliation_adjustments row; any failure leaves neither half created. '
  'p_resource_id is caller-supplied. p_rate_provenance is required (not null column). '
  'p_quantity_explanation is supplied only when a quantity/billing-basis comparison is '
  'meaningful. When p_supersedes_adjustment_id is supplied, locks that predecessor FOR UPDATE '
  'and raises RECONCILIATION_ALREADY_SUPERSEDED if it already has a successor, or '
  'RECONCILIATION_ADJUSTMENT_NOT_FOUND if it does not exist. Sole sanctioned creation path; '
  'application code must not INSERT into either table directly. See '
  'docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §0c, §7, §10.';


-- =============================================================================
-- RPC: finalize_reconciliation_adjustment
-- =============================================================================

-- Transitions one Reconciliation Adjustment from open to final. Idempotent:
-- a repeat call against an already-final row returns that row unchanged (no
-- new UPDATE, no new audit_log row), the same no-op-retry posture already
-- proven by finalize_earned_result() in Migration 9. Does not, and must
-- not, check whether the row has since been superseded: finalization and
-- supersession are independent axes, and a later correction may supersede
-- this one, final or not, at any time.
create function finalize_reconciliation_adjustment(
  p_resource_id uuid,
  p_actor_user_id uuid,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.reconciliation_adjustments
language plpgsql
security invoker
as $$
declare
  v_current public.reconciliation_adjustments;
  v_result  public.reconciliation_adjustments;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_current
  from public.reconciliation_adjustments
  where resource_id = p_resource_id
  for update;

  if not found then
    raise exception 'RECONCILIATION_ADJUSTMENT_NOT_FOUND: no reconciliation_adjustments row for id %', p_resource_id;
  end if;

  if v_current.status = 'final' then
    -- Idempotent replay: return the already-final row unchanged. No DML
    -- runs on this path, so no new audit_log row is written.
    return v_current;
  end if;

  update public.reconciliation_adjustments
  set status = 'final',
      finalized_at = now(),
      finalized_by = p_actor_user_id,
      updated_by = p_actor_user_id
  where resource_id = p_resource_id
    and status = 'open'
  returning * into v_result;

  return v_result;
end;
$$;

comment on function finalize_reconciliation_adjustment(uuid, uuid, uuid, jsonb) is
  'Transitions one Reconciliation Adjustment from open to final. Idempotent: a repeat call '
  'against an already-final row returns it unchanged with no new DML. Never checks '
  'supersession: a final row may still be superseded by a later correction at any time. '
  'Raises RECONCILIATION_ADJUSTMENT_NOT_FOUND as named. See '
  'docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §7.';


-- =============================================================================
-- invoice_evidence_items: scope validation function
-- =============================================================================

-- BEFORE INSERT on invoice_evidence_items. Validates that the allocation
-- target's own transaction_currency matches the invoice_evidence header's
-- currency, so far as it can be proven from the referenced financial item.
-- Every table this function reads (invoice_evidence, billing_calculations,
-- reconciliation_adjustments) is immutable on the columns read here, so an
-- ordinary, unlocked SELECT is sufficient, the same reasoning already
-- proven by fn_protect_earned_result_usage_fact_scope() in Migration 9.
create function fn_protect_invoice_evidence_item_scope()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_header_currency text;
  v_target_currency text;
begin
  select currency into v_header_currency
  from public.invoice_evidence
  where id = new.invoice_evidence_id;

  -- A missing invoice_evidence header is a genuinely invalid foreign key
  -- reference; fall through and let invoice_evidence_id's own foreign key
  -- raise it.
  if not found then
    return new;
  end if;

  if new.billing_calculation_id is not null then
    select transaction_currency into v_target_currency
    from public.billing_calculations
    where id = new.billing_calculation_id;
  else
    select transaction_currency into v_target_currency
    from public.reconciliation_adjustments
    where resource_id = new.reconciliation_adjustment_id;
  end if;

  -- A missing target is likewise a genuinely invalid foreign key reference;
  -- fall through and let the populated target column's own foreign key
  -- raise it.
  if not found then
    return new;
  end if;

  if v_target_currency is distinct from v_header_currency then
    raise exception
      'invoice_evidence_items: allocation target currency % does not match invoice_evidence '
      '%''s own currency %', v_target_currency, new.invoice_evidence_id, v_header_currency;
  end if;

  return new;
end;
$$;

comment on function fn_protect_invoice_evidence_item_scope() is
  'BEFORE INSERT on invoice_evidence_items. Rejects an allocation whose target (Billing '
  'Calculation or Reconciliation Adjustment) currency does not match its invoice_evidence '
  'header currency. See docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §6.';


-- =============================================================================
-- invoice_evidence_items
-- =============================================================================

-- Immutable allocation row. Each row belongs to one invoice_evidence header
-- and references exactly one of billing_calculation_id or
-- reconciliation_adjustment_id, never both, never neither. Deliberately no
-- uniqueness on either target FK: one invoice may allocate against many
-- Billing Calculations, one Billing Calculation may be allocated against by
-- many invoices, and partial invoicing (several items against the same
-- target over time) is fully supported. No sum-equality enforcement
-- against the invoice_evidence header's own amount.
create table invoice_evidence_items (
  id                            uuid primary key default gen_random_uuid(),
  invoice_evidence_id           uuid not null references invoice_evidence (id) on delete restrict,
  billing_calculation_id        uuid references billing_calculations (id) on delete restrict,
  reconciliation_adjustment_id  uuid references reconciliation_adjustments (resource_id) on delete restrict,
  allocated_amount              numeric not null check (allocated_amount >= 0),
  created_at                    timestamptz not null default now(),
  created_by                    uuid not null references app_users (id) on delete restrict,

  constraint chk_invoice_evidence_items_exactly_one_target check (
    (billing_calculation_id is not null and reconciliation_adjustment_id is null)
    or (billing_calculation_id is null and reconciliation_adjustment_id is not null)
  )
);

comment on table invoice_evidence_items is
  'Immutable allocation row: one invoice_evidence header to exactly one of a Billing '
  'Calculation or a Reconciliation Adjustment, never both, never neither. No uniqueness on '
  'either target: many-to-many allocation and partial invoicing are both fully supported. No '
  'sum-equality enforcement against the header amount. See '
  'docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §6.';

create index idx_invoice_evidence_items_invoice_evidence_id on invoice_evidence_items (invoice_evidence_id);
create index idx_invoice_evidence_items_billing_calculation_id on invoice_evidence_items (billing_calculation_id) where billing_calculation_id is not null;
create index idx_invoice_evidence_items_reconciliation_adjustment_id on invoice_evidence_items (reconciliation_adjustment_id) where reconciliation_adjustment_id is not null;

create trigger trg_invoice_evidence_items_protect_scope
  before insert on invoice_evidence_items
  for each row
  execute function fn_protect_invoice_evidence_item_scope();

create trigger trg_invoice_evidence_items_reject_update_delete
  before update or delete on invoice_evidence_items
  for each row
  execute function fn_reject_update_delete();

create trigger trg_audit_invoice_evidence_items
  after insert or update or delete on invoice_evidence_items
  for each row execute function fn_audit_row('id');


-- =============================================================================
-- RPC: record_invoice_evidence_item
-- =============================================================================

-- Inserts one immutable allocation row. Plain insert, no dedup key (design
-- §10): each allocation is a genuine, discrete new fact. Named validation
-- of the exactly-one-target shape ahead of the raw CHECK constraint, the
-- same friendly-error-before-raw-constraint posture used throughout M8/M9.
create function record_invoice_evidence_item(
  p_invoice_evidence_id uuid,
  p_allocated_amount numeric,
  p_actor_user_id uuid,
  p_billing_calculation_id uuid default null,
  p_reconciliation_adjustment_id uuid default null,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.invoice_evidence_items
language plpgsql
security invoker
as $$
declare
  v_new public.invoice_evidence_items;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if (p_billing_calculation_id is not null) = (p_reconciliation_adjustment_id is not null) then
    raise exception
      'INVOICE_EVIDENCE_ITEM_TARGET_INVALID: exactly one of p_billing_calculation_id or '
      'p_reconciliation_adjustment_id must be supplied (got billing_calculation_id=%, '
      'reconciliation_adjustment_id=%)', p_billing_calculation_id, p_reconciliation_adjustment_id;
  end if;

  insert into public.invoice_evidence_items (
    invoice_evidence_id, billing_calculation_id, reconciliation_adjustment_id,
    allocated_amount, created_by
  )
  values (
    p_invoice_evidence_id, p_billing_calculation_id, p_reconciliation_adjustment_id,
    p_allocated_amount, p_actor_user_id
  )
  returning * into v_new;

  return v_new;
end;
$$;

comment on function record_invoice_evidence_item(uuid, numeric, uuid, uuid, uuid, uuid, jsonb) is
  'Inserts one immutable invoice_evidence_items row. Plain insert, no dedup key. Raises '
  'INVOICE_EVIDENCE_ITEM_TARGET_INVALID by name ahead of the raw '
  'chk_invoice_evidence_items_exactly_one_target constraint. '
  'fn_protect_invoice_evidence_item_scope() remains the authoritative currency-integrity '
  'guard. See docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md §6, §10.';


-- =============================================================================
-- Privilege hardening
-- =============================================================================

-- Migration 2's default-privilege baseline already denies anon/
-- authenticated on every new table and function the moment they are
-- created; the explicit REVOKEs below are defense-in-depth, not a
-- correction, matching every prior migration's own stated reasoning.
revoke all on table
  billing_calculations, invoice_eligibility_events, invoice_evidence,
  invoice_evidence_items, reconciliation_adjustments
from anon, authenticated;

-- Trigger-only functions: REVOKE only, no service_role GRANT, matching the
-- fn_reject_truncate()/fn_protect_earned_result_scope() convention.
-- Trigger firing does not check the invoking role's EXECUTE privilege on
-- the trigger function.
revoke execute on function
  fn_protect_billing_calculation_scope(),
  fn_protect_reconciliation_adjustment_lifecycle(),
  fn_protect_invoice_evidence_item_scope()
from public, anon, authenticated;

-- Callable application RPCs: EXECUTE revoked from public/anon/authenticated
-- and explicitly granted to service_role, matching every prior migration's
-- established shape.
revoke execute on function
  record_billing_calculation(uuid, uuid, date, date, text, numeric, text, text, text, uuid, numeric, uuid, uuid, uuid, jsonb),
  record_invoice_eligibility_event(uuid, boolean, text, uuid, uuid, uuid, jsonb),
  record_invoice_evidence(text, numeric, text, uuid, text, date, text, uuid, jsonb),
  record_invoice_evidence_item(uuid, numeric, uuid, uuid, uuid, uuid, jsonb),
  create_reconciliation_adjustment(uuid, uuid, date, date, text, numeric, text, text, uuid, jsonb, numeric, numeric, jsonb, uuid, uuid, jsonb),
  finalize_reconciliation_adjustment(uuid, uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function
  record_billing_calculation(uuid, uuid, date, date, text, numeric, text, text, text, uuid, numeric, uuid, uuid, uuid, jsonb),
  record_invoice_eligibility_event(uuid, boolean, text, uuid, uuid, uuid, jsonb),
  record_invoice_evidence(text, numeric, text, uuid, text, date, text, uuid, jsonb),
  record_invoice_evidence_item(uuid, numeric, uuid, uuid, uuid, uuid, jsonb),
  create_reconciliation_adjustment(uuid, uuid, date, date, text, numeric, text, text, uuid, jsonb, numeric, numeric, jsonb, uuid, uuid, jsonb),
  finalize_reconciliation_adjustment(uuid, uuid, uuid, jsonb)
to service_role;


-- =============================================================================
-- TRUNCATE protection
-- =============================================================================

-- Same statement-level BEFORE TRUNCATE guard already proven across every
-- M4-M9 table, reusing fn_reject_truncate() unmodified.
create trigger trg_billing_calculations_reject_truncate
  before truncate on billing_calculations
  for each statement
  execute function fn_reject_truncate();

create trigger trg_invoice_eligibility_events_reject_truncate
  before truncate on invoice_eligibility_events
  for each statement
  execute function fn_reject_truncate();

create trigger trg_invoice_evidence_reject_truncate
  before truncate on invoice_evidence
  for each statement
  execute function fn_reject_truncate();

create trigger trg_invoice_evidence_items_reject_truncate
  before truncate on invoice_evidence_items
  for each statement
  execute function fn_reject_truncate();

create trigger trg_reconciliation_adjustments_reject_truncate
  before truncate on reconciliation_adjustments
  for each statement
  execute function fn_reject_truncate();

-- service_role is the trusted application data path and has no legitimate
-- reason to truncate any of these five tables; the row-level triggers above
-- are the primary guard, this is belt-and-suspenders against the owner's
-- own TRUNCATE privilege, matching every M4-M9 table.
revoke truncate on table
  billing_calculations, invoice_eligibility_events, invoice_evidence,
  invoice_evidence_items, reconciliation_adjustments
from service_role;


-- =============================================================================
-- Row Level Security: deny-by-default
-- =============================================================================

-- Same posture as every M4-M9 table: ENABLE, not FORCE, RLS; zero policies.
-- anon/authenticated are denied all direct access by RLS itself, beneath
-- the privilege hardening above. The application-service layer, connecting
-- as service_role, remains the trusted data-access path.
alter table billing_calculations enable row level security;
alter table invoice_eligibility_events enable row level security;
alter table invoice_evidence enable row level security;
alter table invoice_evidence_items enable row level security;
alter table reconciliation_adjustments enable row level security;
