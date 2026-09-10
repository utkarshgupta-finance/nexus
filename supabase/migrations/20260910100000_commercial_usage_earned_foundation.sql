-- Nexus: Commercial Usage and Earned Foundation (Migration 9 of the locked
-- Commercial Foundation Migration Design).
--
-- Translates the LOCKED docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md
-- (commit 0d3eed2) into real PostgreSQL. Exactly three tables: usage_facts,
-- earned_results, earned_result_usage_facts. Nothing from Migration 10
-- (billing_calculations, invoice_eligibility_events, invoice_evidence,
-- invoice_evidence_items, reconciliation_adjustments) appears in this file.
-- Nothing in Migration 8 (commercial_configurations, commercial_changes,
-- commercial_components, commercial_component_capabilities,
-- measurement_definitions, commercial_commitments,
-- commercial_commitment_components) is altered.
--
-- M9 establishes Earned truth: what usage happened, what it relates to, and
-- what value has been earned because of it. It does not establish Billed
-- truth: when to invoice, invoice eligibility, invoice numbers, invoice
-- evidence, collection status, or reconciliation adjustments. Those remain
-- Migration 10, not designed and not built here.
--
-- Reused unmodified from prior migrations: fn_reject_update_delete()
-- (Migration 8), fn_set_updated_at() (Migration 1), fn_audit_row()
-- (Migration 1, generalized Migration "audit traceability and commercial
-- RPC hardening"), fn_reject_truncate() (Migration "platform core integrity
-- hardening"). None are redefined here.
--
-- New this migration, following the exact conventions already proven in
-- Migrations 1-8 and the M4-M8 hardening migrations:
--   - fn_protect_earned_result_scope(): BEFORE INSERT on earned_results.
--     Validates that measurement_definition_id is compatible with the
--     referenced Component, and that a populated commercial_commitment_id
--     is the correct quantity Commitment for that same Component. Cross-
--     parent integrity only; no Pricing Kernel arithmetic.
--   - fn_protect_earned_result_versioning(): BEFORE INSERT on
--     earned_results. Enforces result_version continuity (1 for a root
--     row, predecessor.result_version + 1 for a successor), locking the
--     predecessor row FOR UPDATE when one is referenced. Logical-grain
--     identity, no-forking, and cross-grain supersession are all enforced
--     declaratively by table constraints, not duplicated here.
--   - fn_protect_earned_result_lifecycle(): BEFORE UPDATE OR DELETE on
--     earned_results. Rejects DELETE unconditionally; permits only
--     status (open -> final, once), finalized_at, finalized_by,
--     updated_at, updated_by to change on UPDATE.
--   - fn_protect_earned_result_usage_fact_scope(): BEFORE INSERT on
--     earned_result_usage_facts. Rejects a lineage link whose Earned
--     Result and Usage Fact resolve to different Commercial
--     Configurations, whose Earned Result is non-usage
--     (measurement_definition_id is null), or whose Measurement
--     Definitions do not match.
--   - record_usage_fact(), correct_usage_fact(), record_earned_result(),
--     finalize_earned_result(): the four locked write-path RPCs. All
--     SECURITY INVOKER, EXECUTE revoked from public/anon/authenticated,
--     EXECUTE granted to service_role, matching
--     create_commercial_configuration_with_change()'s established shape.
--
-- Immutability model: usage_facts is fully immutable from creation (no
-- UPDATE path at all; a correction is always a new row). earned_results is
-- immutable per version (every column except status/finalized_at/
-- finalized_by/updated_at/updated_by; a recalculation is always a new
-- version, never an edit of a prior one). earned_result_usage_facts is
-- insert-only. "Currentness" for a logical Earned grain (Component +
-- period) is never a stored flag: it is derived by finding the one row
-- nothing supersedes, guaranteed unique by three constraints working
-- together (partial root-uniqueness, no-fork uniqueness on
-- supersedes_earned_result_id, and a composite self-FK that keeps
-- supersession within one logical grain). See the design doc §5 for the
-- full induction argument.
--
-- No Resource Registry participation: none of the three tables mint a
-- resources row (high-volume, granular, parent Configuration/Component
-- already anchors independent action, per the locked design §11).
--
-- This file has not been applied to any database.


-- =============================================================================
-- usage_facts
-- =============================================================================

-- Append-only Finance-relied-upon quantity, scoped to the Commercial
-- Configuration it was captured for (never the customer directly, since one
-- customer may have more than one Configuration). No Resource Registry
-- participation, no updated_at/updated_by: there is no update path at all,
-- see fn_reject_update_delete() below. A correction is always a new row
-- linked via supersedes_usage_fact_id, never an edit of the original; the
-- original remains permanent historical evidence regardless of any later
-- correction, per docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §11.
create table usage_facts (
  id                         uuid primary key default gen_random_uuid(),

  commercial_configuration_id uuid not null references commercial_configurations (id) on delete restrict,
  measurement_definition_id  uuid not null references measurement_definitions (id) on delete restrict,

  period_start               date not null,
  period_end                 date not null,
  quantity                   numeric not null check (quantity >= 0),
  dimensions                 jsonb,

  source_type                text not null check (source_type in ('manual_entry', 'file_import', 'internal_tool', 'external_feed')),
  source_system              text,
  source_reference           text,
  source_event_key           text,
  evidence_reference          text,

  origin                     text not null check (origin in ('source', 'correction', 'finance_override')),
  supersedes_usage_fact_id   uuid references usage_facts (id) on delete restrict,
  override_reason            text,
  override_approved_by       uuid references app_users (id) on delete restrict,

  created_at                 timestamptz not null default now(),
  created_by                 uuid not null references app_users (id) on delete restrict,

  constraint chk_usage_facts_period_valid check (period_end >= period_start),
  constraint chk_usage_facts_no_self_supersession check (supersedes_usage_fact_id is distinct from id),
  -- Finance override shape rule: override_reason and override_approved_by
  -- are required together exactly when origin = 'finance_override', and
  -- must both be null otherwise (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md
  -- §11).
  constraint chk_usage_facts_override_shape check (
    (origin = 'finance_override' and override_reason is not null and override_approved_by is not null)
    or (origin <> 'finance_override' and override_reason is null and override_approved_by is null)
  ),
  -- An event key is only ever meaningful within a named source system's
  -- namespace: two different upstream systems can independently produce
  -- identical event keys, so a key can never be recorded without its
  -- namespace. source_system may be populated alone (a source with no
  -- natural per-event key, still worth recording provenance for); no
  -- artificial per-row key is invented for manual entry or that case.
  constraint chk_usage_facts_source_event_key_namespace check (source_event_key is null or source_system is not null),

  -- Usage supersession identity (design §0a): a supersession chain
  -- represents replacement versions of the SAME measured fact, not a way
  -- to reassign a fact to a different scope. This supporting UNIQUE is a
  -- non-restrictive superset of the plain PRIMARY KEY (id already
  -- guarantees uniqueness on its own); it exists solely to serve as the
  -- composite self-FK's target below.
  constraint uq_usage_facts_scope_id unique (commercial_configuration_id, measurement_definition_id, period_start, period_end, id),

  -- No forking: a given predecessor fact can be superseded by at most one
  -- successor, giving one linear correction chain and a single latest fact
  -- per measured fact. PostgreSQL treats multiple NULLs in a UNIQUE
  -- constraint as non-conflicting, so this restricts only actual
  -- corrections, never root ('source') facts.
  constraint uq_usage_facts_supersedes unique (supersedes_usage_fact_id)
);

-- Composite self-referencing foreign key, declared after the table's own
-- columns and the two constraints above so both referenced constraints
-- already exist: forces a successor to share its predecessor's exact
-- (commercial_configuration_id, measurement_definition_id, period_start,
-- period_end). MATCH SIMPLE (the PostgreSQL default for multi-column FKs)
-- lets a null supersedes_usage_fact_id through unchecked, so root facts are
-- unaffected. dimensions is deliberately excluded from this identity: a
-- dimension change is modeled as void plus independent recapture (a new
-- root fact), never as an in-chain correction, so no composite FK or
-- uniqueness mechanism is built around a jsonb column.
alter table usage_facts add constraint fk_usage_facts_supersedes_within_scope
  foreign key (commercial_configuration_id, measurement_definition_id, period_start, period_end, supersedes_usage_fact_id)
  references usage_facts (commercial_configuration_id, measurement_definition_id, period_start, period_end, id)
  on delete restrict;

comment on table usage_facts is
  'Append-only, immutable Finance-relied-upon quantity, scoped per Commercial Configuration. '
  'No UPDATE path exists at all (see trg_usage_facts_reject_update_delete): a correction is '
  'always a new row linked via supersedes_usage_fact_id, never an edit. Supersession is '
  'structurally confined to the same Configuration, Measurement Definition, and period '
  '(fk_usage_facts_supersedes_within_scope) and is non-forking (uq_usage_facts_supersedes): '
  'one linear correction chain per measured fact. A wrong Configuration, Measurement '
  'Definition, or dimensions value is never corrected in-chain; it is voided (a same-scope, '
  'zero-quantity correction) and independently recaptured as a new root fact. See '
  'docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §3, §4, §0a.';

comment on column usage_facts.source_event_key is
  'Stable event identity inside the source_system namespace named alongside it. Nullable: '
  'manual entry has no natural key and none is invented. Deduplicated per Configuration via '
  'the partial unique index uq_usage_facts_source_event_key below, never on this column '
  'alone, since two different source systems can independently produce identical event keys.';

comment on column usage_facts.supersedes_usage_fact_id is
  'Links a correction to the exact fact it replaces. The original row is never deleted or '
  'edited: it remains permanent historical evidence. A chain may repeat (a correction of a '
  'correction); it can never fork (uq_usage_facts_supersedes) and can never cross scope '
  '(fk_usage_facts_supersedes_within_scope).';

-- Composite-FK-supporting unique constraint and the no-fork unique
-- constraint each already create their own backing index; a separate
-- ordinary index on (commercial_configuration_id, measurement_definition_id,
-- period_start) would be redundant, since uq_usage_facts_scope_id already
-- begins with exactly those three columns as a leftmost prefix. Only one
-- additional index is genuinely needed: reverse lookup by predecessor is
-- already covered by uq_usage_facts_supersedes's own backing index, so no
-- further index is added here either.

-- Ingestion deduplication: a partial unique index, not a table CONSTRAINT
-- (PostgreSQL's ADD CONSTRAINT ... UNIQUE does not support a WHERE clause).
-- Scoped to (commercial_configuration_id, source_system, source_event_key)
-- so two different upstream systems can never collide on the same event
-- key. source_type (how the fact entered Nexus) is deliberately not part of
-- this scope: the same real-world external event should be recognized as
-- the same event even if the transport mechanism that carried it into
-- Nexus later changes.
create unique index uq_usage_facts_source_event_key
  on usage_facts (commercial_configuration_id, source_system, source_event_key)
  where source_event_key is not null;

comment on index uq_usage_facts_source_event_key is
  'Ingestion deduplication, scoped per Configuration and source system namespace. Only '
  'covers rows where source_event_key is populated; manual entry (no natural key) is '
  'unaffected. See docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §7.1, §0a.';

-- Immutable from creation: no UPDATE path at all, matching
-- commercial_changes and both M8 join tables.
create trigger trg_usage_facts_reject_update_delete
  before update or delete on usage_facts
  for each row
  execute function fn_reject_update_delete();

create trigger trg_audit_usage_facts
  after insert or update or delete on usage_facts
  for each row execute function fn_audit_row('id');


-- =============================================================================
-- earned_results: cross-parent scope validation function
-- =============================================================================

-- BEFORE INSERT on earned_results. Validates that this specific row's
-- captured snapshot (measurement_definition_id, commercial_commitment_id)
-- is actually true for the Component it claims to describe, at the moment
-- of insert. Relationship integrity only: no Pricing Kernel arithmetic, no
-- MUG calculation, no rates, no slabs.
--
-- Neither check is a composite FK: M8 does not already carry a supporting
-- unique key on commercial_components(id, measurement_definition_id) or on
-- commercial_commitments(commercial_component_id, id), and adding one here
-- would mean altering an M8 table's own schema, which this migration does
-- not do. Both commercial_components and commercial_commitments are
-- immutable on every column this function reads (their own lifecycle
-- triggers permit only effective_to/updated_at/updated_by to change), so
-- ordinary, unlocked SELECTs are sufficient; there is no concurrent-
-- mutation race to guard against here.
--
-- SECURITY INVOKER, search_path pinned to pg_catalog, matching
-- fn_protect_commercial_commitment_scope()'s established shape; every
-- table this function touches is therefore referenced with its full
-- schema-qualified name (public.commercial_components,
-- public.commercial_commitments).
create function fn_protect_earned_result_scope()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_component_measurement_definition_id uuid;
  v_commitment_kind                     text;
  v_commitment_component_id             uuid;
begin
  select measurement_definition_id into v_component_measurement_definition_id
  from public.commercial_components
  where id = new.commercial_component_id;

  -- A missing Component is a genuinely invalid foreign key reference, not
  -- this function's concern: fall through and let the ordinary
  -- commercial_component_id foreign key raise it.
  if not found then
    return new;
  end if;

  -- Compatibility, either direction: a usage-driven Component must be
  -- described by that same Measurement Definition; a non-usage (flat)
  -- Component must not have an unrelated Measurement Definition invented
  -- for it. IS NOT DISTINCT FROM covers both the both-null and the
  -- both-equal case in one comparison.
  if new.measurement_definition_id is distinct from v_component_measurement_definition_id then
    raise exception
      'earned_results: measurement_definition_id % is not compatible with component % '
      '(component''s own measurement_definition_id is %)',
      new.measurement_definition_id, new.commercial_component_id, v_component_measurement_definition_id;
  end if;

  if new.commercial_commitment_id is null then
    return new;
  end if;

  select kind, commercial_component_id into v_commitment_kind, v_commitment_component_id
  from public.commercial_commitments
  where id = new.commercial_commitment_id;

  -- A missing Commitment is likewise a genuinely invalid foreign key
  -- reference; fall through and let commercial_commitment_id's own
  -- foreign key raise it.
  if not found then
    return new;
  end if;

  if v_commitment_kind is distinct from 'quantity' or v_commitment_component_id is distinct from new.commercial_component_id then
    raise exception
      'earned_results: commercial_commitment_id % is not the quantity commitment for '
      'component % (commitment kind=%, commitment''s own component=%)',
      new.commercial_commitment_id, new.commercial_component_id, v_commitment_kind, v_commitment_component_id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_earned_result_scope() is
  'BEFORE INSERT on earned_results. Validates measurement_definition_id against the '
  'referenced Component and, when populated, that commercial_commitment_id is the correct '
  'quantity Commitment for that same Component. Relationship integrity only, no Pricing '
  'Kernel arithmetic. See docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §5, §0a.';


-- =============================================================================
-- earned_results: versioning validation function
-- =============================================================================

-- BEFORE INSERT on earned_results. Enforces the one property the table's
-- own declarative constraints cannot express: that result_version is
-- exactly the predecessor's result_version + 1 (or 1 when
-- supersedes_earned_result_id is null). Logical-grain identity (the
-- composite self-FK), no-forking (the unique constraint on
-- supersedes_earned_result_id), and no-duplicate-root (the partial unique
-- index) are all enforced declaratively by table constraints and are not
-- duplicated here.
--
-- Locks the predecessor row FOR UPDATE when one is referenced, the same
-- serialization-anchor technique already proven by
-- fn_protect_commitment_component_membership(), so two concurrent
-- recalculation attempts for the same logical grain cannot both compute
-- the same next result_version.
create function fn_protect_earned_result_versioning()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_predecessor_version integer;
begin
  if new.supersedes_earned_result_id is null then
    if new.result_version <> 1 then
      raise exception
        'earned_results: a root version (supersedes_earned_result_id is null) must have '
        'result_version = 1, got % (id=%)', new.result_version, new.id;
    end if;
    return new;
  end if;

  select result_version into v_predecessor_version
  from public.earned_results
  where id = new.supersedes_earned_result_id
  for update;

  -- A missing predecessor is a genuinely invalid foreign key reference;
  -- fall through and let supersedes_earned_result_id's own foreign key
  -- raise it.
  if not found then
    return new;
  end if;

  if new.result_version <> v_predecessor_version + 1 then
    raise exception
      'earned_results: successor % must have result_version = predecessor %''s '
      'result_version + 1 = %, got %',
      new.id, new.supersedes_earned_result_id, v_predecessor_version + 1, new.result_version;
  end if;

  return new;
end;
$$;

comment on function fn_protect_earned_result_versioning() is
  'BEFORE INSERT on earned_results. Enforces result_version continuity (1 for a root row, '
  'predecessor.result_version + 1 for a successor), locking the predecessor row FOR UPDATE '
  'when one is referenced. Logical-grain identity, no-forking, and no-duplicate-root are '
  'enforced by table constraints, not here. See '
  'docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §5, §0a.';


-- =============================================================================
-- earned_results: lifecycle validation function
-- =============================================================================

-- BEFORE UPDATE OR DELETE on earned_results (not INSERT: insert-time
-- validation belongs to fn_protect_earned_result_scope() and
-- fn_protect_earned_result_versioning() above). Rejects DELETE
-- unconditionally. Permits exactly one UPDATE transition: status (open ->
-- final, once), together with finalized_at, finalized_by, updated_at, and
-- updated_by. final -> open is rejected. Superseding a row is an INSERT of
-- a different row, never an UPDATE of this one, so it is untouched by this
-- function: finalization and supersession are two independent axes, never
-- conflated (design §9). A previously final result may still be
-- superseded by a later version; nothing here or elsewhere blocks that.
create function fn_protect_earned_result_lifecycle()
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
    raise exception 'earned_results is an immutable Finance record: DELETE is not permitted (id=%)', old.id;
  end if;

  -- tg_op = 'UPDATE'. status, finalized_at, finalized_by, updated_at, and
  -- updated_by are the only columns ever permitted to change.
  v_old_core := to_jsonb(old) - 'status' - 'finalized_at' - 'finalized_by' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new) - 'status' - 'finalized_at' - 'finalized_by' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'earned_results: only status (open -> final, once), finalized_at, finalized_by, '
      'updated_at, and updated_by may change (id=%)', old.id;
  end if;

  if old.status = 'final' and new.status is distinct from 'final' then
    raise exception 'earned_results: status is already final and cannot change again (id=%)', old.id;
  end if;

  if old.status = 'open' and new.status = 'final' then
    if new.finalized_at is null or new.finalized_by is null then
      raise exception
        'earned_results: finalizing (open -> final) requires both finalized_at and '
        'finalized_by to be set (id=%)', old.id;
    end if;
  end if;

  if new.status = 'open' and (new.finalized_at is not null or new.finalized_by is not null) then
    raise exception
      'earned_results: finalized_at/finalized_by must remain null while status is open (id=%)',
      old.id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_earned_result_lifecycle() is
  'BEFORE UPDATE OR DELETE on earned_results. Rejects DELETE unconditionally. Permits only '
  'status (open -> final, once), finalized_at, finalized_by, updated_at, and updated_by to '
  'change; every other column, including every calculated field, is immutable. Independent '
  'of supersession: a final row may still be superseded by a later version. See '
  'docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §9.';


-- =============================================================================
-- earned_results
-- =============================================================================

-- Immutable, versioned Earned calculation result. Logical grain
-- (commercial_component_id, period_start, period_end) is stable for the
-- life of the Component, but may now have more than one immutable
-- calculation version over time: a correction never rewrites a prior
-- version, it inserts a new one, chained by result_version /
-- supersedes_earned_result_id. "Current" is never a stored column: it is
-- the one version per logical grain that nothing else supersedes, derived
-- by query (see the design doc §5 for the exact query and the induction
-- argument that exactly zero or one such row can ever exist per grain).
--
-- id is caller-supplied (no DEFAULT): it is the calculation attempt
-- identity a Pricing Kernel orchestration job generates once per attempt
-- and reuses on retry, mirroring the same caller-pre-generates-the-row's-
-- own-id convention already proven by
-- create_commercial_configuration_with_change's p_new_commercial_configuration_id.
create table earned_results (
  id                         uuid primary key,

  commercial_component_id    uuid not null references commercial_components (id) on delete restrict,
  period_start               date not null,
  period_end                 date not null,

  measurement_definition_id  uuid references measurement_definitions (id) on delete restrict,
  commercial_commitment_id   uuid references commercial_commitments (id) on delete restrict,

  result_version             integer not null check (result_version >= 1),
  supersedes_earned_result_id uuid references earned_results (id) on delete restrict,

  raw_quantity               numeric,
  calculated_quantity        numeric,
  calculated_amount          numeric not null check (calculated_amount >= 0),
  transaction_currency       text not null,

  pricing_calculation_version text not null,
  rounding_policy_version     text not null,

  status                     text not null default 'open' check (status in ('open', 'final')),
  finalized_at               timestamptz,
  finalized_by               uuid references app_users (id) on delete restrict,

  created_at                 timestamptz not null default now(),
  created_by                 uuid not null references app_users (id) on delete restrict,
  updated_at                 timestamptz not null default now(),
  updated_by                 uuid not null references app_users (id) on delete restrict,

  constraint chk_earned_results_period_valid check (period_end >= period_start),
  constraint chk_earned_results_no_self_supersession check (supersedes_earned_result_id is distinct from id),
  -- Both null (a non-usage, flat Component) or both populated (a
  -- usage-driven Component); never one without the other.
  constraint chk_earned_results_quantity_shape check ((raw_quantity is null) = (calculated_quantity is null)),
  constraint chk_earned_results_calculated_quantity_non_negative check (calculated_quantity is null or calculated_quantity >= 0),
  -- finalized_at/finalized_by are set together exactly when status =
  -- 'final', and both null while status = 'open'.
  constraint chk_earned_results_finalized_shape check (
    (status = 'final' and finalized_at is not null and finalized_by is not null)
    or (status = 'open' and finalized_at is null and finalized_by is null)
  ),

  -- Supporting UNIQUE for the composite self-FK below: a non-restrictive
  -- superset of the plain PRIMARY KEY.
  constraint uq_earned_results_grain_id unique (commercial_component_id, period_start, period_end, id),

  -- No forking: a given version can be superseded by at most one
  -- successor. Multiple NULLs (every root version) are non-conflicting.
  constraint uq_earned_results_supersedes unique (supersedes_earned_result_id)
);

-- Composite self-referencing foreign key: a superseding row must share its
-- predecessor's exact logical grain (commercial_component_id, period_start,
-- period_end). MATCH SIMPLE lets a null supersedes_earned_result_id through
-- unchecked, so root versions are unaffected.
alter table earned_results add constraint fk_earned_results_supersedes_within_grain
  foreign key (commercial_component_id, period_start, period_end, supersedes_earned_result_id)
  references earned_results (commercial_component_id, period_start, period_end, id)
  on delete restrict;

-- At most one root (version 1, supersedes_earned_result_id is null) per
-- logical grain. A partial unique index, not a table CONSTRAINT
-- (PostgreSQL's ADD CONSTRAINT ... UNIQUE does not support a WHERE
-- clause). Together with uq_earned_results_supersedes and
-- fk_earned_results_supersedes_within_grain, this guarantees every logical
-- grain forms exactly one linear chain with exactly zero or one leaf (the
-- current, authoritative version): see the design doc §5 for the full
-- argument.
create unique index uq_earned_results_root_per_grain
  on earned_results (commercial_component_id, period_start, period_end)
  where supersedes_earned_result_id is null;

comment on table earned_results is
  'Immutable, versioned Earned calculation result. One logical grain (commercial_component_id, '
  'period_start, period_end) may accumulate more than one immutable calculation version over '
  'time; a correction always inserts a new version (result_version = predecessor + 1, '
  'supersedes_earned_result_id = predecessor.id), never edits a prior one. Currentness is '
  'derived, never stored: the one version per logical grain that nothing else supersedes '
  '(uq_earned_results_root_per_grain, uq_earned_results_supersedes, and '
  'fk_earned_results_supersedes_within_grain together guarantee exactly zero or one such '
  'version exists at any time). status (open/final) is a separate axis from supersession: a '
  'final version may still be superseded by a later, corrected version. Not Resource-backed. '
  'This table is Earned truth, not Billed truth: it does not determine invoice timing, '
  'eligibility, or evidence. See docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §1, §5, '
  '§8, §9.';

comment on column earned_results.id is
  'Caller-supplied calculation attempt identity (no DEFAULT). Reused by the calling Pricing '
  'Kernel orchestration on retry of the same attempt; record_earned_result() treats a repeat '
  'insert with the same id and identical inputs as an idempotent replay.';

comment on column earned_results.supersedes_earned_result_id is
  'Links a recalculated version to the exact prior version it replaces. Never updated in '
  'place: the predecessor remains permanently readable, final or not. See '
  'uq_earned_results_supersedes (no forking) and '
  'fk_earned_results_supersedes_within_grain (same logical grain only).';

create trigger trg_earned_results_protect_scope
  before insert on earned_results
  for each row
  execute function fn_protect_earned_result_scope();

create trigger trg_earned_results_protect_versioning
  before insert on earned_results
  for each row
  execute function fn_protect_earned_result_versioning();

create trigger trg_earned_results_protect_lifecycle
  before update or delete on earned_results
  for each row
  execute function fn_protect_earned_result_lifecycle();

create trigger trg_earned_results_updated_at
  before update on earned_results
  for each row
  execute function fn_set_updated_at();

create trigger trg_audit_earned_results
  after insert or update or delete on earned_results
  for each row execute function fn_audit_row('id');


-- =============================================================================
-- earned_result_usage_facts: cross-scope validation function
-- =============================================================================

-- BEFORE INSERT on earned_result_usage_facts. This bridge is financially
-- material evidence, so the database must not permit a link between an
-- Earned Result and a Usage Fact that do not genuinely belong together.
-- Neither table stores the other's Commercial Configuration directly
-- (earned_results reaches one only by joining through
-- commercial_components; usage_facts stores it directly), so no
-- declarative composite FK can compare them without denormalizing
-- Configuration onto one of the two tables purely to support the
-- constraint, which this migration declines exactly as the design doc
-- declines it elsewhere.
--
-- All three tables this function reads (earned_results,
-- commercial_components, usage_facts) are immutable on every column read
-- here, so ordinary, unlocked SELECTs are sufficient: there is no
-- concurrent-mutation race to guard against.
create function fn_protect_earned_result_usage_fact_scope()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_earned_component_id                uuid;
  v_earned_measurement_definition_id   uuid;
  v_earned_configuration_id            uuid;
  v_usage_configuration_id             uuid;
  v_usage_measurement_definition_id    uuid;
begin
  select commercial_component_id, measurement_definition_id
    into v_earned_component_id, v_earned_measurement_definition_id
  from public.earned_results
  where id = new.earned_result_id;

  -- A missing Earned Result is a genuinely invalid foreign key reference;
  -- fall through and let earned_result_id's own foreign key raise it.
  if not found then
    return new;
  end if;

  select commercial_configuration_id into v_earned_configuration_id
  from public.commercial_components
  where id = v_earned_component_id;

  -- An earned_results row with no resolvable Component's Configuration
  -- would mean fn_protect_earned_result_scope() already failed to prevent
  -- an inconsistent row at earned_results' own insert time; fall through
  -- defensively rather than raise a new, surprising error class here.
  if not found then
    return new;
  end if;

  select commercial_configuration_id, measurement_definition_id
    into v_usage_configuration_id, v_usage_measurement_definition_id
  from public.usage_facts
  where id = new.usage_fact_id;

  -- A missing Usage Fact is likewise a genuinely invalid foreign key
  -- reference; fall through and let usage_fact_id's own foreign key raise
  -- it.
  if not found then
    return new;
  end if;

  if v_earned_configuration_id is distinct from v_usage_configuration_id then
    raise exception
      'earned_result_usage_facts: earned_result % belongs to commercial_configuration %, '
      'but usage_fact % belongs to commercial_configuration % (earned_result_id=%, usage_fact_id=%)',
      new.earned_result_id, v_earned_configuration_id, new.usage_fact_id, v_usage_configuration_id,
      new.earned_result_id, new.usage_fact_id;
  end if;

  if v_earned_measurement_definition_id is null then
    raise exception
      'earned_result_usage_facts: earned_result % is a non-usage result '
      '(measurement_definition_id is null) and must not link any usage_fact '
      '(attempted usage_fact=%)', new.earned_result_id, new.usage_fact_id;
  end if;

  if v_earned_measurement_definition_id is distinct from v_usage_measurement_definition_id then
    raise exception
      'earned_result_usage_facts: earned_result % requires measurement_definition %, but '
      'usage_fact % has measurement_definition % (earned_result_id=%, usage_fact_id=%)',
      new.earned_result_id, v_earned_measurement_definition_id, new.usage_fact_id, v_usage_measurement_definition_id,
      new.earned_result_id, new.usage_fact_id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_earned_result_usage_fact_scope() is
  'BEFORE INSERT on earned_result_usage_facts. Rejects a link across Commercial '
  'Configurations, a link to a non-usage (measurement_definition_id is null) Earned Result, '
  'or a Measurement Definition mismatch. Ordinary unlocked reads only: every column read is '
  'immutable on its own table. See docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §6, §0a.';


-- =============================================================================
-- earned_result_usage_facts
-- =============================================================================

-- Many-to-many bridge: one Earned Result version to the Usage Fact(s) that
-- fed it. Insert-only, intrinsic created_at/created_by is the complete
-- history, matching the exact reasoning already applied to
-- commercial_component_capabilities and commercial_commitment_components.
-- No contribution_quantity column: each linked Usage Fact's own quantity
-- is already visible with a plain join, and Usage Facts are immutable, so
-- nothing here can drift.
--
-- Each Earned Result version has its own independent lineage: since
-- earned_result_id is part of the composite primary key and each version
-- is a distinct row with its own id, a recalculated version's lineage
-- rows are naturally separate from its predecessor's, never rewritten.
create table earned_result_usage_facts (
  earned_result_id uuid not null references earned_results (id) on delete restrict,
  usage_fact_id    uuid not null references usage_facts (id) on delete restrict,
  created_at       timestamptz not null default now(),
  created_by       uuid not null references app_users (id) on delete restrict,

  primary key (earned_result_id, usage_fact_id)
);

comment on table earned_result_usage_facts is
  'Many-to-many lineage bridge: one Earned Result version to the Usage Fact(s) that fed it. '
  'Insert-only; intrinsic created_at/created_by provenance is the complete history, no '
  'independent audit trigger (matching commercial_component_capabilities and '
  'commercial_commitment_components). Permanent: a corrected Earned Result version gets its '
  'own new lineage rows, never rewriting a prior version''s lineage. A flat or otherwise '
  'non-usage Earned Result legitimately has zero rows here; see '
  'fn_protect_earned_result_usage_fact_scope(). See '
  'docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §6, §10.';

-- The composite primary key (earned_result_id, usage_fact_id) already
-- covers "which usage facts fed this earned result" lookups. The reverse
-- direction, "which earned results this usage fact fed," needs
-- usage_fact_id as a leading column, which the primary key's own index
-- does not provide.
create index idx_earned_result_usage_facts_usage_fact_id on earned_result_usage_facts (usage_fact_id);

create trigger trg_earned_result_usage_facts_protect_scope
  before insert on earned_result_usage_facts
  for each row
  execute function fn_protect_earned_result_usage_fact_scope();

create trigger trg_earned_result_usage_facts_reject_update_delete
  before update or delete on earned_result_usage_facts
  for each row
  execute function fn_reject_update_delete();

-- No audit trigger: matching the already-locked reasoning for
-- commercial_component_capabilities and commercial_commitment_components,
-- a row that is never updated or deleted has intrinsic created_at/
-- created_by as its complete history; a full audit trigger would compare a
-- row against itself.


-- =============================================================================
-- RPC: record_usage_fact
-- =============================================================================

-- Inserts one Usage Fact with origin = 'source' (an ordinary capture, no
-- predecessor); supersedes_usage_fact_id is always null on this path.
-- Corrections and Finance overrides are correct_usage_fact()'s
-- responsibility, never this one's.
--
-- Ingestion deduplication: when p_source_event_key is supplied, this
-- function probes for an existing row sharing
-- (commercial_configuration_id, source_system, source_event_key) before
-- inserting. A found row with identical substantive inputs is returned
-- unchanged (idempotent replay, no new row, no destructive overwrite); a
-- found row with any differing substantive input raises
-- USAGE_FACT_EVENT_CONFLICT. Manual entry (p_source_event_key null) is
-- never deduplicated at the database level; every call inserts a new
-- root fact, matching the locked design's own posture that no artificial
-- key is invented for a human capturing a number by hand.
--
-- Serialization anchor: the public.commercial_configurations row for
-- p_commercial_configuration_id, locked FOR UPDATE before the dedup probe
-- below, the same outer-parent-lock-first technique already proven by
-- create_commercial_configuration_with_change. Two concurrent submissions
-- carrying the same (commercial_configuration_id, source_system,
-- source_event_key) now serialize on this lock: the second call blocks
-- until the first commits, then its probe correctly observes the first's
-- committed row instead of racing it.
create function record_usage_fact(
  p_commercial_configuration_id uuid,
  p_measurement_definition_id uuid,
  p_period_start date,
  p_period_end date,
  p_quantity numeric,
  p_source_type text,
  p_actor_user_id uuid,
  p_dimensions jsonb default null,
  p_source_system text default null,
  p_source_reference text default null,
  p_source_event_key text default null,
  p_evidence_reference text default null,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.usage_facts
language plpgsql
security invoker
as $$
declare
  v_measurement_found   boolean;
  v_existing            public.usage_facts;
  v_new                 public.usage_facts;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  -- Lock the stable parent Configuration row first (serialization anchor,
  -- see header comment above). This also confirms the Configuration
  -- exists, so USAGE_CONFIGURATION_NOT_FOUND is still raised by name.
  perform 1
  from public.commercial_configurations
  where id = p_commercial_configuration_id
  for update;

  if not found then
    raise exception 'USAGE_CONFIGURATION_NOT_FOUND: no commercial_configurations row for id %', p_commercial_configuration_id;
  end if;

  select exists (
    select 1 from public.measurement_definitions where id = p_measurement_definition_id
  ) into v_measurement_found;

  if not v_measurement_found then
    raise exception 'MEASUREMENT_DEFINITION_NOT_FOUND: no measurement_definitions row for id %', p_measurement_definition_id;
  end if;

  if p_source_event_key is not null then
    select * into v_existing
    from public.usage_facts
    where commercial_configuration_id = p_commercial_configuration_id
      and source_system is not distinct from p_source_system
      and source_event_key = p_source_event_key;

    if found then
      if v_existing.measurement_definition_id is distinct from p_measurement_definition_id
        or v_existing.period_start is distinct from p_period_start
        or v_existing.period_end is distinct from p_period_end
        or v_existing.quantity is distinct from p_quantity
        or v_existing.dimensions is distinct from p_dimensions
      then
        raise exception
          'USAGE_FACT_EVENT_CONFLICT: source_system=%, source_event_key=% already recorded '
          'under commercial_configuration % with different measurement_definition_id, period, '
          'quantity, or dimensions', p_source_system, p_source_event_key, p_commercial_configuration_id;
      end if;

      -- Idempotent replay: return the existing row unchanged. No DML runs
      -- on this path, so no audit_log row is written.
      return v_existing;
    end if;
  end if;

  insert into public.usage_facts (
    commercial_configuration_id, measurement_definition_id,
    period_start, period_end, quantity, dimensions,
    source_type, source_system, source_reference, source_event_key, evidence_reference,
    origin, created_by
  )
  values (
    p_commercial_configuration_id, p_measurement_definition_id,
    p_period_start, p_period_end, p_quantity, p_dimensions,
    p_source_type, p_source_system, p_source_reference, p_source_event_key, p_evidence_reference,
    'source', p_actor_user_id
  )
  returning * into v_new;

  return v_new;
end;
$$;

comment on function record_usage_fact(uuid, uuid, date, date, numeric, text, uuid, jsonb, text, text, text, text, uuid, jsonb) is
  'Inserts one origin = source Usage Fact (no predecessor). When p_source_event_key is '
  'supplied, deduplicates per (commercial_configuration_id, source_system, source_event_key): '
  'a matching existing row with identical substantive inputs is returned unchanged; a '
  'matching row with any differing input raises USAGE_FACT_EVENT_CONFLICT. Manual entry '
  '(p_source_event_key null) is never deduplicated. Also raises USAGE_CONFIGURATION_NOT_FOUND '
  'or MEASUREMENT_DEFINITION_NOT_FOUND as named. See '
  'docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §7.1.';


-- =============================================================================
-- RPC: correct_usage_fact
-- =============================================================================

-- Creates a NEW Usage Fact that supersedes an existing one; never updates
-- the predecessor (usage_facts has no update path at all). Always inherits
-- the predecessor's own commercial_configuration_id, measurement_definition_id,
-- period_start, period_end, and dimensions: this function has no
-- parameters for any of them, so it is structurally impossible, not merely
-- constraint-checked, for a call to this RPC to move a correction to
-- another Configuration, Measurement Definition, period, or dimensions
-- value. Those cases are void (a zero-quantity call to this same function)
-- plus an independent new root fact via record_usage_fact(), exactly as
-- locked.
--
-- p_origin must be 'correction' or 'finance_override'; 'source' facts have
-- no predecessor and belong to record_usage_fact() instead.
--
-- Locks the predecessor row FOR UPDATE, the same serialization-anchor
-- technique already proven by fn_protect_commitment_component_membership():
-- two concurrent attempts to correct the same predecessor serialize
-- against this lock, so the second sees the first's just-committed
-- successor and raises USAGE_FACT_ALREADY_CORRECTED instead of racing the
-- database's own uq_usage_facts_supersedes constraint (which remains the
-- final integrity guard regardless).
create function correct_usage_fact(
  p_predecessor_usage_fact_id uuid,
  p_quantity numeric,
  p_origin text,
  p_actor_user_id uuid,
  p_evidence_reference text default null,
  p_override_reason text default null,
  p_override_approved_by uuid default null,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.usage_facts
language plpgsql
security invoker
as $$
declare
  v_predecessor      public.usage_facts;
  v_already_corrected boolean;
  v_new               public.usage_facts;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_origin not in ('correction', 'finance_override') then
    raise exception
      'USAGE_FACT_INVALID_ORIGIN: correct_usage_fact only accepts correction or '
      'finance_override, got %', p_origin;
  end if;

  if p_origin = 'finance_override' and (p_override_reason is null or p_override_approved_by is null) then
    raise exception
      'USAGE_FACT_OVERRIDE_INCOMPLETE: finance_override requires both p_override_reason and '
      'p_override_approved_by';
  end if;

  select * into v_predecessor
  from public.usage_facts
  where id = p_predecessor_usage_fact_id
  for update;

  if not found then
    raise exception 'USAGE_FACT_NOT_FOUND: no usage_facts row for id %', p_predecessor_usage_fact_id;
  end if;

  select exists (
    select 1 from public.usage_facts where supersedes_usage_fact_id = p_predecessor_usage_fact_id
  ) into v_already_corrected;

  if v_already_corrected then
    raise exception
      'USAGE_FACT_ALREADY_CORRECTED: usage_fact % already has a successor', p_predecessor_usage_fact_id;
  end if;

  insert into public.usage_facts (
    commercial_configuration_id, measurement_definition_id,
    period_start, period_end, quantity, dimensions,
    source_type, evidence_reference,
    origin, supersedes_usage_fact_id, override_reason, override_approved_by,
    created_by
  )
  values (
    v_predecessor.commercial_configuration_id, v_predecessor.measurement_definition_id,
    v_predecessor.period_start, v_predecessor.period_end, p_quantity, v_predecessor.dimensions,
    v_predecessor.source_type, p_evidence_reference,
    p_origin, p_predecessor_usage_fact_id, p_override_reason, p_override_approved_by,
    p_actor_user_id
  )
  returning * into v_new;

  return v_new;
end;
$$;

comment on function correct_usage_fact(uuid, numeric, text, uuid, text, text, uuid, uuid, jsonb) is
  'Creates a new Usage Fact superseding p_predecessor_usage_fact_id; never updates the '
  'predecessor. Always inherits the predecessor''s Configuration, Measurement Definition, '
  'period, and dimensions (no parameters exist for any of them), so this RPC cannot move a '
  'correction to another scope. p_quantity = 0 is the void mechanism. p_origin must be '
  'correction or finance_override. Raises USAGE_FACT_NOT_FOUND, '
  'USAGE_FACT_ALREADY_CORRECTED, USAGE_FACT_INVALID_ORIGIN, or '
  'USAGE_FACT_OVERRIDE_INCOMPLETE as named. See '
  'docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §4, §0a.';


-- =============================================================================
-- RPC: record_earned_result
-- =============================================================================

-- The atomic Earned-calculation write path. Caller-supplied p_id is the
-- calculation attempt identity (design §5, §7.2): a retry with the same id
-- and identical substantive inputs, including the exact lineage usage_fact
-- id set, is an idempotent no-op that returns the existing row and writes
-- no new row, no duplicate lineage, and no extra audit_log entry. The same
-- id reused with any differing substantive input raises
-- EARNED_RESULT_ID_CONFLICT.
--
-- On a genuinely new attempt, the serialization anchor is the stable
-- public.commercial_components row for p_commercial_component_id, locked
-- FOR UPDATE first (the same outer-parent-lock-first technique already
-- proven by fn_protect_commitment_component_membership()). Only after that
-- lock is held does this function issue a separate, fresh lookup for the
-- current (non-superseded) row of the logical grain (commercial_component_id,
-- period_start, period_end): because that lookup runs strictly after the
-- component lock is acquired, it always observes every earned_results
-- version any other transaction has already committed for this Component,
-- so two concurrent recalculation attempts for the same grain cannot both
-- resolve the same row as current. fn_protect_earned_result_versioning()
-- independently re-validates result_version continuity at insert time, and
-- the database's own no-fork unique constraint (uq_earned_results_supersedes)
-- remains the final integrity guard regardless of what this function
-- computes.
--
-- fn_protect_earned_result_scope() and fn_protect_earned_result_usage_fact_scope()
-- remain the authoritative safety defense for snapshot and lineage
-- integrity; this function does not duplicate either check.
--
-- No billing logic of any kind: this function only ever writes to
-- earned_results and earned_result_usage_facts.
create function record_earned_result(
  p_id uuid,
  p_commercial_component_id uuid,
  p_period_start date,
  p_period_end date,
  p_calculated_amount numeric,
  p_transaction_currency text,
  p_pricing_calculation_version text,
  p_rounding_policy_version text,
  p_actor_user_id uuid,
  p_measurement_definition_id uuid default null,
  p_commercial_commitment_id uuid default null,
  p_raw_quantity numeric default null,
  p_calculated_quantity numeric default null,
  p_usage_fact_ids uuid[] default '{}'::uuid[],
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.earned_results
language plpgsql
security invoker
as $$
declare
  v_existing          public.earned_results;
  v_existing_lineage  uuid[];
  v_requested_lineage uuid[];
  v_current           public.earned_results;
  v_result_version    integer;
  v_supersedes_id     uuid;
  v_new               public.earned_results;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  v_requested_lineage := (select coalesce(array_agg(x order by x), '{}'::uuid[]) from unnest(p_usage_fact_ids) as x);

  -- Idempotency probe, before any business logic: a delayed retry of an
  -- attempt that already completed must return the completed result
  -- rather than attempt a second insert.
  select * into v_existing
  from public.earned_results
  where id = p_id;

  if found then
    select coalesce(array_agg(usage_fact_id order by usage_fact_id), '{}'::uuid[]) into v_existing_lineage
    from public.earned_result_usage_facts
    where earned_result_id = p_id;

    if v_existing.commercial_component_id is distinct from p_commercial_component_id
      or v_existing.period_start is distinct from p_period_start
      or v_existing.period_end is distinct from p_period_end
      or v_existing.measurement_definition_id is distinct from p_measurement_definition_id
      or v_existing.commercial_commitment_id is distinct from p_commercial_commitment_id
      or v_existing.raw_quantity is distinct from p_raw_quantity
      or v_existing.calculated_quantity is distinct from p_calculated_quantity
      or v_existing.calculated_amount is distinct from p_calculated_amount
      or v_existing.transaction_currency is distinct from p_transaction_currency
      or v_existing.pricing_calculation_version is distinct from p_pricing_calculation_version
      or v_existing.rounding_policy_version is distinct from p_rounding_policy_version
      or v_existing_lineage is distinct from v_requested_lineage
    then
      raise exception
        'EARNED_RESULT_ID_CONFLICT: id % already exists with substantive inputs, lineage, or '
        'both that differ from this call', p_id;
    end if;

    -- Idempotent replay: return the existing row unchanged. No DML runs on
    -- this path, so no new lineage row and no new audit_log row are
    -- written.
    return v_existing;
  end if;

  -- New attempt: lock the stable parent Component row first (serialization
  -- anchor, see header comment above). This must complete, and this
  -- transaction must hold the lock, before the leaf lookup below runs, so
  -- a concurrent transaction's already-committed recalculation for this
  -- same Component is guaranteed visible to the fresh query that follows.
  perform 1
  from public.commercial_components
  where id = p_commercial_component_id
  for update;

  -- Only now, with the Component lock held, locate the current
  -- (non-superseded) row for this logical grain, per the design doc's own
  -- current-result query. Issued as its own fresh statement after the
  -- lock above, so it correctly observes every version any other,
  -- previously-blocked transaction has since committed for this Component.
  select er.* into v_current
  from public.earned_results er
  where er.commercial_component_id = p_commercial_component_id
    and er.period_start = p_period_start
    and er.period_end = p_period_end
    and not exists (
      select 1 from public.earned_results nr
      where nr.supersedes_earned_result_id = er.id
    )
  for update;

  if found then
    v_result_version := v_current.result_version + 1;
    v_supersedes_id := v_current.id;
  else
    v_result_version := 1;
    v_supersedes_id := null;
  end if;

  insert into public.earned_results (
    id, commercial_component_id, period_start, period_end,
    measurement_definition_id, commercial_commitment_id,
    result_version, supersedes_earned_result_id,
    raw_quantity, calculated_quantity, calculated_amount, transaction_currency,
    pricing_calculation_version, rounding_policy_version,
    status, created_by, updated_by
  )
  values (
    p_id, p_commercial_component_id, p_period_start, p_period_end,
    p_measurement_definition_id, p_commercial_commitment_id,
    v_result_version, v_supersedes_id,
    p_raw_quantity, p_calculated_quantity, p_calculated_amount, p_transaction_currency,
    p_pricing_calculation_version, p_rounding_policy_version,
    'open', p_actor_user_id, p_actor_user_id
  )
  returning * into v_new;

  insert into public.earned_result_usage_facts (earned_result_id, usage_fact_id, created_by)
  select p_id, x, p_actor_user_id
  from unnest(p_usage_fact_ids) as x;

  return v_new;
end;
$$;

comment on function record_earned_result(uuid, uuid, date, date, numeric, text, text, text, uuid, uuid, uuid, numeric, numeric, uuid[], uuid, jsonb) is
  'Atomic Earned-calculation write path. Idempotent on p_id: a retry with identical '
  'substantive inputs and lineage returns the existing row with no new DML; a retry with any '
  'differing input raises EARNED_RESULT_ID_CONFLICT. On a genuinely new attempt, locks the '
  'parent commercial_components row first, then locates the current row for '
  '(p_commercial_component_id, p_period_start, p_period_end) in a fresh query issued after '
  'that lock is held, sets result_version and supersedes_earned_result_id accordingly, '
  'inserts the new version, and '
  'inserts one earned_result_usage_facts row per supplied usage fact id (zero rows for a '
  'non-usage result). fn_protect_earned_result_scope(), '
  'fn_protect_earned_result_versioning(), and fn_protect_earned_result_usage_fact_scope() '
  'remain the authoritative, database-enforced integrity guards. No billing logic. See '
  'docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §5, §7.2, §8.';


-- =============================================================================
-- RPC: finalize_earned_result
-- =============================================================================

-- Transitions one Earned Result version from open to final. Idempotent: a
-- repeat call against an already-final row returns that row unchanged (no
-- new UPDATE, no new audit_log row), the same no-op-retry posture already
-- used by record_earned_result()'s own idempotent replay. Does not, and
-- must not, check whether the row has since been superseded: finalization
-- and supersession are independent axes (design §9), and a later version
-- may supersede this one, final or not, at any time.
create function finalize_earned_result(
  p_earned_result_id uuid,
  p_actor_user_id uuid,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.earned_results
language plpgsql
security invoker
as $$
declare
  v_current public.earned_results;
  v_result  public.earned_results;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_current
  from public.earned_results
  where id = p_earned_result_id
  for update;

  if not found then
    raise exception 'EARNED_RESULT_NOT_FOUND: no earned_results row for id %', p_earned_result_id;
  end if;

  if v_current.status = 'final' then
    -- Idempotent replay: return the already-final row unchanged. No DML
    -- runs on this path, so no new audit_log row is written.
    return v_current;
  end if;

  update public.earned_results
  set status = 'final',
      finalized_at = now(),
      finalized_by = p_actor_user_id,
      updated_by = p_actor_user_id
  where id = p_earned_result_id
    and status = 'open'
  returning * into v_result;

  return v_result;
end;
$$;

comment on function finalize_earned_result(uuid, uuid, uuid, jsonb) is
  'Transitions one Earned Result version from open to final. Idempotent: a repeat call '
  'against an already-final row returns it unchanged with no new DML. Never checks '
  'supersession: a final row may still be superseded by a later version at any time. Raises '
  'EARNED_RESULT_NOT_FOUND as named. See '
  'docs/COMMERCIAL_MIGRATION_9_USAGE_EARNED_DESIGN.md §9.';


-- =============================================================================
-- Privilege hardening
-- =============================================================================

-- Migration 2's default-privilege baseline already denies anon/
-- authenticated on every new table and function the moment they are
-- created; the explicit REVOKEs below are defense-in-depth, not a
-- correction, matching every prior migration's own stated reasoning.
revoke all on table
  usage_facts, earned_results, earned_result_usage_facts
from anon, authenticated;

-- Trigger-only functions: REVOKE only, no service_role GRANT, matching the
-- fn_reject_truncate()/fn_protect_commercial_commitment_scope() convention.
-- Trigger firing does not check the invoking role's EXECUTE privilege on
-- the trigger function.
revoke execute on function
  fn_protect_earned_result_scope(),
  fn_protect_earned_result_versioning(),
  fn_protect_earned_result_lifecycle(),
  fn_protect_earned_result_usage_fact_scope()
from public, anon, authenticated;

-- Callable application RPCs: EXECUTE revoked from public/anon/authenticated
-- and explicitly granted to service_role, matching
-- create_commercial_configuration_with_change's established shape.
revoke execute on function
  record_usage_fact(uuid, uuid, date, date, numeric, text, uuid, jsonb, text, text, text, text, uuid, jsonb),
  correct_usage_fact(uuid, numeric, text, uuid, text, text, uuid, uuid, jsonb),
  record_earned_result(uuid, uuid, date, date, numeric, text, text, text, uuid, uuid, uuid, numeric, numeric, uuid[], uuid, jsonb),
  finalize_earned_result(uuid, uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function
  record_usage_fact(uuid, uuid, date, date, numeric, text, uuid, jsonb, text, text, text, text, uuid, jsonb),
  correct_usage_fact(uuid, numeric, text, uuid, text, text, uuid, uuid, jsonb),
  record_earned_result(uuid, uuid, date, date, numeric, text, text, text, uuid, uuid, uuid, numeric, numeric, uuid[], uuid, jsonb),
  finalize_earned_result(uuid, uuid, uuid, jsonb)
to service_role;


-- =============================================================================
-- TRUNCATE protection
-- =============================================================================

-- Same statement-level BEFORE TRUNCATE guard already proven across every
-- M4-M8 table, reusing fn_reject_truncate() unmodified.
create trigger trg_usage_facts_reject_truncate
  before truncate on usage_facts
  for each statement
  execute function fn_reject_truncate();

create trigger trg_earned_results_reject_truncate
  before truncate on earned_results
  for each statement
  execute function fn_reject_truncate();

create trigger trg_earned_result_usage_facts_reject_truncate
  before truncate on earned_result_usage_facts
  for each statement
  execute function fn_reject_truncate();

-- service_role is the trusted application data path and has no legitimate
-- reason to truncate any of these three tables; the row-level triggers
-- above are the primary guard, this is belt-and-suspenders against the
-- owner's own TRUNCATE privilege, matching every M4-M8 table.
revoke truncate on table
  usage_facts, earned_results, earned_result_usage_facts
from service_role;


-- =============================================================================
-- Row Level Security: deny-by-default
-- =============================================================================

-- Same posture as every M4-M8 table: ENABLE, not FORCE, RLS; zero
-- policies. anon/authenticated are denied all direct access by RLS itself,
-- beneath the privilege hardening above. The application-service layer,
-- connecting as service_role, remains the trusted data-access path.
alter table usage_facts enable row level security;
alter table earned_results enable row level security;
alter table earned_result_usage_facts enable row level security;
