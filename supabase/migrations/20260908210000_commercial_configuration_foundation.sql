-- Nexus: Commercial Configuration Foundation (Migration 8 of the locked
-- Commercial Foundation Migration Design).
--
-- Translates the locked docs/COMMERCIAL_DATABASE_DESIGN.md (built on the
-- locked docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md and
-- docs/COMMERCIAL_TECH_EVALUATION.md) and the locked
-- docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md into real PostgreSQL, for
-- exactly the "what commercial terms currently apply" layer: seven tables
-- (commercial_changes, commercial_configurations, commercial_components,
-- commercial_component_capabilities, measurement_definitions,
-- commercial_commitments, commercial_commitment_components). Migration 9
-- (Usage and Earned) and Migration 10 (Billing, Invoice, Reconciliation)
-- are separate, later, not-yet-authored migrations; nothing in this file
-- references usage_facts, earned_results, earned_result_usage_facts,
-- billing_calculations, invoice_eligibility_events, invoice_evidence,
-- invoice_evidence_items, or reconciliation_adjustments.
--
-- Reused unmodified from prior migrations: fn_bump_row_version()
-- (Migration 4), fn_set_updated_at() (Migration 1), fn_audit_row()
-- (Migration 1), fn_assert_resource_type() (Migration 4, generalized
-- Migration 6). None are redefined here.
--
-- New this migration, all following the exact conventions already proven
-- in Migrations 1-7:
--   - fn_reject_update_delete(): one shared, zero-table-specific-logic
--     function for the nine pure insert-only tables across all three
--     Commercial Foundation migrations, the same reuse discipline already
--     applied to fn_bump_row_version/fn_audit_row/fn_set_updated_at. Used
--     in this migration on commercial_changes, commercial_component_
--     capabilities, and commercial_commitment_components.
--   - fn_protect_measurement_definition_lifecycle(),
--     fn_protect_commercial_configuration_lifecycle(),
--     fn_protect_commercial_component_lifecycle(),
--     fn_protect_commercial_commitment_lifecycle(): dedicated
--     lifecycle-protection functions, one per table whose mutable-column
--     shape is genuinely table-specific, using the same
--     JSONB-diff-minus-permitted-columns technique already proven by
--     fn_protect_capability_lifecycle()/fn_protect_customer_lifecycle()
--     (Migration 7).
--   - fn_protect_commitment_component_membership(): rejects a quantity
--     commitment attaching through commercial_commitment_components at
--     all (the locked correction's own requirement, since a quantity
--     commitment resolves to exactly one Component via a direct foreign
--     key instead), and enforces currency-only compatibility across a
--     minimum-spend commitment's member components.
--   - create_commercial_configuration_with_change(): the atomic creation
--     RPC locked in docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §3a,
--     mirroring create_request_with_draft()/create_form_version() exactly
--     (SECURITY INVOKER, resources row minted with a literal
--     resource_type, feature rows inserted in the same transaction,
--     EXECUTE revoked from public/anon/authenticated). Resolves the
--     locked circular foreign-key dependency between commercial_changes
--     and commercial_configurations via a single DEFERRABLE INITIALLY
--     DEFERRED constraint on commercial_changes.commercial_configuration_id
--     only; commercial_configurations.commercial_change_id's own foreign
--     key is ordinary and immediate, added via ALTER TABLE after
--     commercial_changes exists (a DDL-time necessity: a CREATE TABLE
--     statement cannot declare a foreign key against a table that does
--     not exist yet), not because it needs deferral.
--
-- Exactly one new Resource Registry type is seeded: 'commercial_configuration'.
-- commercial_configurations is the only Resource-backed table in this
-- migration; reconciliation_adjustments (the locked design's other
-- Resource-backed Commercial entity) belongs to Migration 10.
-- commercial_changes, commercial_components, measurement_definitions,
-- commercial_commitments, and both join tables are not Resource-backed,
-- exactly as locked.
--
-- This file has not been applied to any database.


-- =============================================================================
-- Resource Registry seed
-- =============================================================================

-- resource_types is migration-managed structural metadata, not business
-- seed data (docs/DATA_ARCHITECTURE.md §2, Migration 4's own precedent).
-- No ON CONFLICT guard: an incompatible pre-existing
-- 'commercial_configuration' row would mean this migration's assumptions
-- about the current schema state are wrong, and migration failure is
-- preferable to silently accepting that.
insert into resource_types (type_code, description)
values ('commercial_configuration', 'A stable anchor for one coherent Commercial relationship (docs/COMMERCIAL_DATABASE_DESIGN.md).');


-- =============================================================================
-- Shared pure-insert-only immutability function
-- =============================================================================

-- Zero table-specific logic, unlike every lifecycle-protection function
-- below; reused across every table in the Commercial Foundation with no
-- legitimate UPDATE path at all, the same reuse discipline already
-- applied to fn_bump_row_version()/fn_audit_row()/fn_set_updated_at().
-- Tables with exactly one permitted lifecycle transition (commercial_
-- configurations, commercial_components, commercial_commitments,
-- measurement_definitions) use a dedicated lifecycle function instead,
-- never this one.
create function fn_reject_update_delete()
returns trigger
language plpgsql
security invoker
as $$
begin
  raise exception '% is append-only: % is not permitted', tg_table_name, tg_op;
end;
$$;

comment on function fn_reject_update_delete() is
  'Generic BEFORE UPDATE OR DELETE guard for pure insert-only tables. Zero table-specific '
  'logic; rejects both operations unconditionally. Attach only to tables with no legitimate '
  'UPDATE path at all. See docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §7.';


-- =============================================================================
-- measurement_definitions
-- =============================================================================

-- No dependency on any other new table in this migration; created first.
-- Semantic fields (key, unit, business_definition, counting_rule,
-- period_basis, dimension_keys) are immutable from creation; only name
-- and expected_source are cosmetically editable; status is
-- deprecate-only (docs/COMMERCIAL_DATABASE_DESIGN.md §5.4).
create table measurement_definitions (
  id                  uuid primary key default gen_random_uuid(),
  key                 text not null unique,
  name                text not null,
  unit                text not null,
  business_definition text not null,
  counting_rule       text not null,
  period_basis        text not null,
  dimension_keys      text[] not null default '{}'::text[],
  expected_source     text,
  status              text not null default 'active' check (status in ('active', 'deprecated')),
  row_version         integer not null default 1,
  created_at          timestamptz not null default now(),
  created_by          uuid references app_users (id) on delete restrict,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references app_users (id) on delete restrict,

  constraint chk_measurement_definitions_row_version_positive check (row_version >= 1)
);

comment on table measurement_definitions is
  'Canonical business meaning of a countable quantity. Semantic fields are immutable from '
  'creation; a genuine change in meaning is a new Measurement Definition, never an edit. '
  'See docs/COMMERCIAL_DATABASE_DESIGN.md §5.4.';

-- Lifecycle protection: rejects DELETE unconditionally; requires a new
-- row to be created active; rejects any UPDATE touching a semantic
-- column; rejects deprecated -> active. Same shape as
-- fn_protect_capability_lifecycle() (Migration 7), which enforces the
-- identical must-start-active rule for the same kind of deprecate-only
-- status field; this function was missing that INSERT-time guard and is
-- corrected here to match its own stated precedent
-- (docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §6).
create function fn_protect_measurement_definition_lifecycle()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'measurement_definitions is a permanent identity: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'active' then
      raise exception
        'measurement_definitions: a new Measurement Definition must be created active (got status=%)', new.status;
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE'. name, expected_source, status, row_version,
  -- updated_at, and updated_by are the only columns ever permitted to
  -- change; every semantic field remains compared and therefore
  -- immutable.
  v_old_core := to_jsonb(old) - 'name' - 'expected_source' - 'status' - 'row_version' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new) - 'name' - 'expected_source' - 'status' - 'row_version' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'measurement_definitions: semantic fields are immutable; only name, expected_source, '
      'status, row_version, updated_at, and updated_by may change (id=%)', old.id;
  end if;

  if old.status = 'deprecated' and new.status = 'active' then
    raise exception
      'measurement_definitions: deprecated -> active is not permitted (id=%); a semantic '
      'change is a new Measurement Definition, never a reactivation', old.id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_measurement_definition_lifecycle() is
  'Enforces measurement_definitions lifecycle: no DELETE; UPDATE may change only name, '
  'expected_source, status, row_version, updated_at, and updated_by; every semantic field '
  '(key, unit, business_definition, counting_rule, period_basis, dimension_keys) is '
  'immutable; status is one-way (active -> deprecated only). See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.4.';

-- Trigger names chosen so the alphabetical BEFORE trigger firing order is
-- protect_lifecycle, then row_version, then updated_at, matching the
-- convention established in Migration 7.
create trigger trg_measurement_definitions_protect_lifecycle
  before insert or update or delete on measurement_definitions
  for each row
  execute function fn_protect_measurement_definition_lifecycle();

create trigger trg_measurement_definitions_row_version
  before update on measurement_definitions
  for each row
  execute function fn_bump_row_version();

create trigger trg_measurement_definitions_updated_at
  before update on measurement_definitions
  for each row
  execute function fn_set_updated_at();

create trigger trg_audit_measurement_definitions
  after insert or update or delete on measurement_definitions
  for each row execute function fn_audit_row('id');


-- =============================================================================
-- commercial_configurations
-- =============================================================================

-- Resource-backed: id reuses resources.resource_id, exactly as locked
-- (docs/COMMERCIAL_DATABASE_DESIGN.md §5.1). commercial_change_id is
-- declared NOT NULL here (no dependency on the referenced table existing
-- yet), but its foreign key constraint is added later via ALTER TABLE,
-- after commercial_changes is created below: a CREATE TABLE statement
-- cannot declare a foreign key against a table that does not exist yet,
-- and commercial_changes.commercial_configuration_id already needs to
-- reference this table, so one of the two tables has to be created
-- first without its half of the mutual foreign key. Only the OTHER
-- direction (commercial_changes.commercial_configuration_id) is
-- DEFERRABLE INITIALLY DEFERRED; this one is ordinary and immediate,
-- exactly as locked (docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §3a,
-- §19).
create table commercial_configurations (
  id                    uuid primary key references resources (resource_id) on delete restrict,
  customer_id           uuid not null references customers (id) on delete restrict,
  key                   text not null unique,
  name                  text not null,
  relationship_note     text,
  is_active             boolean not null default true,
  commercial_change_id  uuid not null,
  row_version           integer not null default 1,
  created_at            timestamptz not null default now(),
  created_by            uuid references app_users (id) on delete restrict,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references app_users (id) on delete restrict,

  constraint chk_commercial_configurations_row_version_positive check (row_version >= 1)
);

comment on table commercial_configurations is
  'Stable anchor for one coherent Commercial relationship. Resource-backed; is_active is '
  'one-way (true -> false only), not the same as customers.is_active (reversible). See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.1.';

create index idx_commercial_configurations_customer_id on commercial_configurations (customer_id);

-- Lifecycle protection: rejects DELETE unconditionally; rejects any
-- UPDATE touching an identity field; rejects is_active reactivation
-- (false -> true), deliberately not the same rule as
-- fn_protect_customer_lifecycle's reversible is_active.
create function fn_protect_commercial_configuration_lifecycle()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'commercial_configurations is a permanent identity: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  -- tg_op = 'UPDATE'. name, relationship_note, is_active, row_version,
  -- updated_at, and updated_by are the only columns ever permitted to
  -- change.
  v_old_core := to_jsonb(old) - 'name' - 'relationship_note' - 'is_active' - 'row_version' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new) - 'name' - 'relationship_note' - 'is_active' - 'row_version' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'commercial_configurations: identity fields are immutable; only name, '
      'relationship_note, is_active, row_version, updated_at, and updated_by may change '
      '(id=%)', old.id;
  end if;

  if old.is_active = false and new.is_active = true then
    raise exception
      'commercial_configurations: is_active is one-way (true -> false only); reactivation '
      'is not permitted (id=%)', old.id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_commercial_configuration_lifecycle() is
  'Enforces commercial_configurations lifecycle: no DELETE; UPDATE may change only name, '
  'relationship_note, is_active, row_version, updated_at, and updated_by; id, key, '
  'customer_id, commercial_change_id, created_at, and created_by are immutable; is_active '
  'is one-way (true -> false only), unlike customers.is_active. See '
  'docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §4.';

create trigger trg_commercial_configurations_protect_lifecycle
  before insert or update or delete on commercial_configurations
  for each row
  execute function fn_protect_commercial_configuration_lifecycle();

create trigger trg_commercial_configurations_row_version
  before update on commercial_configurations
  for each row
  execute function fn_bump_row_version();

create trigger trg_commercial_configurations_updated_at
  before update on commercial_configurations
  for each row
  execute function fn_set_updated_at();

-- Resource-type-integrity backstop beneath
-- create_commercial_configuration_with_change()'s own
-- correct-by-construction insert order (a resources row minted with
-- resource_type = 'commercial_configuration' before this table is ever
-- inserted into), mirroring trg_requests_assert_resource_type exactly.
create trigger trg_commercial_configurations_assert_resource_type
  before insert or update of id on commercial_configurations
  for each row
  execute function fn_assert_resource_type('commercial_configuration', 'id');

create trigger trg_audit_commercial_configurations
  after insert or update or delete on commercial_configurations
  for each row execute function fn_audit_row('id');


-- =============================================================================
-- commercial_changes
-- =============================================================================

-- 1:1 extension of requests: request_id IS requests.id, not a separate
-- identity; commercial_changes is not itself Resource-backed, since the
-- Request it extends already provides Resource Registry identity, the
-- same precedent already established for submission_revisions relative
-- to requests. Pure insert-only: every column is populated once, at
-- approval, and never changes again (docs/COMMERCIAL_DATABASE_DESIGN.md
-- §5.14); no updated_at/updated_by columns exist, since no UPDATE path
-- exists to populate them (docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md
-- §4's standard-columns exception for pure insert-only tables).
--
-- commercial_configuration_id is DEFERRABLE INITIALLY DEFERRED: for
-- change_category = 'initial_setup', this column must reference a
-- commercial_configurations row that does not exist yet at the moment
-- this INSERT runs (create_commercial_configuration_with_change() below
-- inserts this row first). Deferring this single constraint moves its
-- check to transaction commit, by which point the referenced
-- commercial_configurations row already exists in the same transaction.
-- Every other (non-initial_setup) commercial_changes insert is
-- unaffected: deferring this constraint only changes when it is
-- checked, never what it requires, so an ordinary renewal/amendment
-- Change's reference to an already-existing Configuration is still
-- required to resolve correctly, just at commit instead of
-- statement-end. commercial_configurations.commercial_change_id's own
-- foreign key (added below via ALTER TABLE) is deliberately NOT
-- deferred: only one direction of this mutual reference needs it.
create table commercial_changes (
  request_id                   uuid primary key references requests (id) on delete restrict,
  commercial_configuration_id  uuid not null references commercial_configurations (id) deferrable initially deferred,
  change_category              text not null check (change_category in ('initial_setup', 'renewal', 'amendment', 'correction', 'other')),
  effective_date               date not null,
  reason                       text,
  created_at                   timestamptz not null default now(),
  created_by                   uuid references app_users (id) on delete restrict
);

comment on table commercial_changes is
  'Commercial-specific meaning of one approved Commercial Change: which Commercial '
  'Configuration it belongs to, its business event category, and its effective date. 1:1 '
  'extension of requests; insert-only, populated once at approval. See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.14.';

create index idx_commercial_changes_commercial_configuration_id on commercial_changes (commercial_configuration_id);

create trigger trg_commercial_changes_reject_update_delete
  before update or delete on commercial_changes
  for each row
  execute function fn_reject_update_delete();

create trigger trg_audit_commercial_changes
  after insert or update or delete on commercial_changes
  for each row execute function fn_audit_row('request_id');

-- Added now that commercial_changes exists: an ordinary, immediately-
-- checked foreign key, not deferred. Succeeds at INSERT time inside
-- create_commercial_configuration_with_change() because that function
-- always inserts commercial_changes first.
alter table commercial_configurations
  add constraint fk_commercial_configurations_commercial_change
  foreign key (commercial_change_id) references commercial_changes (request_id) on delete restrict;


-- =============================================================================
-- Atomic Commercial Configuration + initial Commercial Change creation
-- =============================================================================

-- Mirrors create_request_with_draft()/create_form_version() exactly:
-- SECURITY INVOKER (only the trusted service_role application path calls
-- this; DEFINER would elevate privilege for no benefit and add
-- search_path risk), resources row minted with a literal resource_type
-- before the feature row, no compensating cleanup logic (a raised
-- exception aborts the whole transaction, leaving no resources,
-- commercial_changes, or commercial_configurations row committed).
-- Ordinary application code never directly INSERTs into
-- commercial_changes or commercial_configurations; only this function
-- does. See docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §3a.
create function create_commercial_configuration_with_change(
  p_new_commercial_configuration_id uuid,
  p_request_id uuid,
  p_customer_id uuid,
  p_key text,
  p_name text,
  p_effective_date date,
  p_actor_user_id uuid,
  p_relationship_note text default null,
  p_reason text default null,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns table (commercial_change public.commercial_changes, commercial_configuration public.commercial_configurations)
language plpgsql
security invoker
as $$
declare
  v_change public.commercial_changes;
  v_config public.commercial_configurations;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  -- commercial_changes first: its foreign key to the not-yet-existing
  -- commercial_configurations row is DEFERRABLE INITIALLY DEFERRED, so
  -- Postgres does not check it until this transaction commits.
  insert into public.commercial_changes (
    request_id, commercial_configuration_id, change_category,
    effective_date, reason, created_by
  )
  values (
    p_request_id, p_new_commercial_configuration_id, 'initial_setup',
    p_effective_date, p_reason, p_actor_user_id
  )
  returning * into v_change;

  insert into public.resources (resource_id, resource_type, created_by)
  values (p_new_commercial_configuration_id, 'commercial_configuration', p_actor_user_id);

  -- commercial_configurations.commercial_change_id's foreign key is
  -- ordinary and immediate; it succeeds because the commercial_changes
  -- row was already inserted above, in this same transaction.
  insert into public.commercial_configurations (
    id, customer_id, key, name, relationship_note, commercial_change_id,
    created_by, updated_by
  )
  values (
    p_new_commercial_configuration_id, p_customer_id, p_key, p_name, p_relationship_note,
    p_request_id, p_actor_user_id, p_actor_user_id
  )
  returning * into v_config;

  return query select v_change, v_config;
end;
$$;

comment on function create_commercial_configuration_with_change(uuid, uuid, uuid, text, text, date, uuid, text, text, uuid, jsonb) is
  'Atomically creates the first commercial_changes row (change_category = initial_setup) '
  'together with its commercial_configurations row and the backing resources row, resolving '
  'the circular foreign-key dependency between the two tables via the deferred constraint on '
  'commercial_changes.commercial_configuration_id. Persistence primitive behind the '
  'repository boundary; not a business API. See '
  'docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §3a.';


-- =============================================================================
-- commercial_components
-- =============================================================================

-- One component = one commercial line item; never Resource-backed (the
-- Commercial Change/Request already provides the approval trail).
-- Immutable except effective_to, settable exactly once (null -> date).
-- No automatic overlap-prevention exclusion constraint: the locked
-- design deliberately allows multiple simultaneous Components for the
-- same capability scope, and "overlap" is a domain-service judgment, not
-- a database constraint (docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md
-- §5).
create table commercial_components (
  id                         uuid primary key default gen_random_uuid(),
  commercial_configuration_id uuid not null references commercial_configurations (id) on delete restrict,
  commercial_change_id       uuid not null references commercial_changes (request_id) on delete restrict,
  supersedes_component_id    uuid references commercial_components (id) on delete restrict,
  measurement_definition_id  uuid references measurement_definitions (id) on delete restrict,
  is_recurring               boolean not null,
  pricing_rule_kind          text not null check (pricing_rule_kind in ('linear', 'graduated', 'volume', 'dimension', 'flat')),
  pricing_rule_parameters    jsonb not null,
  billing_cadence            text not null check (billing_cadence in ('monthly', 'quarterly', 'half_yearly', 'annual')),
  billing_timing             text not null check (billing_timing in ('advance', 'arrears')),
  billing_quantity_basis     text check (billing_quantity_basis in ('mug', 'previous_period_actual', 'fixed')),
  reconciliation_cadence     text not null check (reconciliation_cadence in ('monthly', 'quarterly', 'half_yearly', 'annual')),
  transaction_currency       text not null,
  effective_from             date not null,
  effective_to               date,
  created_at                 timestamptz not null default now(),
  created_by                 uuid references app_users (id) on delete restrict,
  updated_at                 timestamptz not null default now(),
  updated_by                 uuid references app_users (id) on delete restrict,

  constraint chk_commercial_components_effective_dating check (effective_to is null or effective_to > effective_from),
  constraint chk_commercial_components_billing_quantity_basis_shape check (
    (billing_timing = 'advance' and billing_quantity_basis is not null)
    or (billing_timing = 'arrears' and billing_quantity_basis is null)
  ),
  -- Minimal structural shape check per pricing rule kind (the required
  -- jsonb keys exist), not a full JSON Schema validation framework;
  -- deeper pricing-parameter semantics (tier ordering, non-negative
  -- rates) belong to the domain service / Pricing Kernel, per
  -- docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §22.
  constraint chk_commercial_components_pricing_rule_shape check (
    (pricing_rule_kind in ('linear', 'volume') and pricing_rule_parameters ? 'rate')
    or (pricing_rule_kind = 'graduated' and pricing_rule_parameters ? 'tiers')
    or (pricing_rule_kind = 'dimension' and pricing_rule_parameters ? 'rates')
    or (pricing_rule_kind = 'flat' and pricing_rule_parameters ? 'amount')
  )
);

comment on table commercial_components is
  'The effective-dated unit carrying commercial terms; one component = one charge line. Not '
  'Resource-backed. Immutable except a single effective_to closure transition. See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.2.';

create index idx_commercial_components_commercial_configuration_id on commercial_components (commercial_configuration_id);
create index idx_commercial_components_commercial_change_id on commercial_components (commercial_change_id);
create index idx_commercial_components_measurement_definition_id on commercial_components (measurement_definition_id);

-- Lifecycle protection: rejects DELETE unconditionally; rejects any
-- UPDATE except the single effective_to closure transition (null ->
-- date, exactly once).
create function fn_protect_commercial_component_lifecycle()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'commercial_components is an immutable Finance record: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  -- tg_op = 'UPDATE'. effective_to, updated_at, and updated_by are the
  -- only columns ever permitted to change.
  v_old_core := to_jsonb(old) - 'effective_to' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new) - 'effective_to' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'commercial_components: only effective_to (once, from null), updated_at, and '
      'updated_by may change (id=%)', old.id;
  end if;

  if old.effective_to is not null and new.effective_to is distinct from old.effective_to then
    raise exception
      'commercial_components: effective_to is already set and cannot change again (id=%)',
      old.id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_commercial_component_lifecycle() is
  'Enforces commercial_components lifecycle: no DELETE; UPDATE may change only effective_to '
  '(settable exactly once, from null), updated_at, and updated_by; every other column is '
  'immutable. See docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §4.';

create trigger trg_commercial_components_protect_lifecycle
  before insert or update or delete on commercial_components
  for each row
  execute function fn_protect_commercial_component_lifecycle();

create trigger trg_commercial_components_updated_at
  before update on commercial_components
  for each row
  execute function fn_set_updated_at();

create trigger trg_audit_commercial_components
  after insert or update or delete on commercial_components
  for each row execute function fn_audit_row('id');


-- =============================================================================
-- commercial_component_capabilities
-- =============================================================================

-- Many-to-many join: component to canonical Capability. Insert-only;
-- intrinsic created_at/created_by is the complete history, matching the
-- locked reasoning exactly (docs/COMMERCIAL_DATABASE_DESIGN.md §5.3): no
-- audit trigger, no updated_at/updated_by (no update path exists to
-- populate them).
create table commercial_component_capabilities (
  component_id  uuid not null references commercial_components (id) on delete restrict,
  capability_id uuid not null references capabilities (id) on delete restrict,
  created_at    timestamptz not null default now(),
  created_by    uuid references app_users (id) on delete restrict,

  primary key (component_id, capability_id)
);

comment on table commercial_component_capabilities is
  'Many-to-many join: Commercial Component to canonical Capability. Insert-only, intrinsic '
  'created_at/created_by provenance is the complete history. See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.3.';

create index idx_commercial_component_capabilities_capability_id on commercial_component_capabilities (capability_id);

create trigger trg_commercial_component_capabilities_reject_update_delete
  before update or delete on commercial_component_capabilities
  for each row
  execute function fn_reject_update_delete();


-- =============================================================================
-- commercial_commitments
-- =============================================================================

-- A minimum quantity commitment (kind = 'quantity') resolves to exactly
-- one Component via a direct foreign key; a minimum spend commitment
-- (kind = 'spend') has no direct Component reference at all and instead
-- uses commercial_commitment_components membership below. The shape
-- CHECK constraint enforces this independently of whether any
-- membership row is ever inserted, so an invalid quantity/spend shape
-- cannot be created without ever touching the join table
-- (docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §8).
create table commercial_commitments (
  id                     uuid primary key default gen_random_uuid(),
  commercial_change_id   uuid not null references commercial_changes (request_id) on delete restrict,
  commercial_component_id uuid references commercial_components (id) on delete restrict,
  kind                   text not null check (kind in ('quantity', 'spend')),
  threshold_value        numeric not null check (threshold_value > 0),
  currency               text,
  period                 text not null check (period in ('monthly', 'quarterly', 'half_yearly', 'annual')),
  effective_from         date not null,
  effective_to           date,
  created_at             timestamptz not null default now(),
  created_by             uuid references app_users (id) on delete restrict,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references app_users (id) on delete restrict,

  constraint chk_commercial_commitments_effective_dating check (effective_to is null or effective_to > effective_from),
  constraint chk_commercial_commitments_kind_shape check (
    (kind = 'quantity' and commercial_component_id is not null and period = 'monthly' and currency is null)
    or (kind = 'spend' and commercial_component_id is null and currency is not null)
  )
);

comment on table commercial_commitments is
  'A minimum quantity commitment (exactly one Component, direct FK, always monthly) or '
  'minimum spend commitment (one or many Components via commercial_commitment_components, '
  'any standard cadence). No allocation mechanism of any kind exists or is needed. See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.5.';

create index idx_commercial_commitments_commercial_change_id on commercial_commitments (commercial_change_id);
create index idx_commercial_commitments_commercial_component_id on commercial_commitments (commercial_component_id);

-- Lifecycle protection: identical shape to
-- fn_protect_commercial_component_lifecycle, kept as its own dedicated
-- function rather than generalized across the two tables, since a
-- shared function would be harder to audit than two short, obvious
-- ones, matching the same reasoning already applied to keeping Customer
-- and Capability lifecycle functions separate in Migration 7.
create function fn_protect_commercial_commitment_lifecycle()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'commercial_commitments is an immutable Finance record: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  -- tg_op = 'UPDATE'. effective_to, updated_at, and updated_by are the
  -- only columns ever permitted to change.
  v_old_core := to_jsonb(old) - 'effective_to' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new) - 'effective_to' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'commercial_commitments: only effective_to (once, from null), updated_at, and '
      'updated_by may change (id=%)', old.id;
  end if;

  if old.effective_to is not null and new.effective_to is distinct from old.effective_to then
    raise exception
      'commercial_commitments: effective_to is already set and cannot change again (id=%)',
      old.id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_commercial_commitment_lifecycle() is
  'Enforces commercial_commitments lifecycle: no DELETE; UPDATE may change only effective_to '
  '(settable exactly once, from null), updated_at, and updated_by; every other column, '
  'including commercial_component_id, kind, and currency, is immutable. See '
  'docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §4.';

create trigger trg_commercial_commitments_protect_lifecycle
  before insert or update or delete on commercial_commitments
  for each row
  execute function fn_protect_commercial_commitment_lifecycle();

create trigger trg_commercial_commitments_updated_at
  before update on commercial_commitments
  for each row
  execute function fn_set_updated_at();

create trigger trg_audit_commercial_commitments
  after insert or update or delete on commercial_commitments
  for each row execute function fn_audit_row('id');


-- =============================================================================
-- commercial_commitment_components
-- =============================================================================

-- Many-to-many join, minimum-spend commitments only. A quantity
-- commitment never attaches through this table at all (it uses
-- commercial_commitments.commercial_component_id, a direct foreign key,
-- instead); the BEFORE INSERT trigger below rejects any attempt to
-- attach a quantity commitment through this side door, and enforces
-- currency-only compatibility across a spend commitment's member
-- components, exactly as locked
-- (docs/COMMERCIAL_DATABASE_DESIGN.md §5.6).
create table commercial_commitment_components (
  commitment_id uuid not null references commercial_commitments (id) on delete restrict,
  component_id  uuid not null references commercial_components (id) on delete restrict,
  created_at    timestamptz not null default now(),
  created_by    uuid references app_users (id) on delete restrict,

  primary key (commitment_id, component_id)
);

comment on table commercial_commitment_components is
  'Many-to-many join, minimum-spend commitments only: commitment to the component(s) it '
  'applies to. Insert-only, intrinsic created_at/created_by provenance is the complete '
  'history. See docs/COMMERCIAL_DATABASE_DESIGN.md §5.6.';

create index idx_commercial_commitment_components_component_id on commercial_commitment_components (component_id);

-- Membership integrity: (a) rejects the insert outright if the
-- referenced commercial_commitments.kind is not 'spend'; (b) for the
-- accepted spend case, verifies every existing member component of that
-- commitment shares the same transaction_currency as the newly inserted
-- one. No measurement-definition-compatibility branch exists, since a
-- quantity commitment no longer has more than one member to compare
-- (docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §8).
--
-- The locked compatibility rule is member-to-member ("every existing
-- member component... shares the same transaction_currency", not a
-- comparison against the parent commitment's own currency, which is the
-- spend threshold's currency, a different fact). A member-to-member
-- check alone is a race under concurrent first-member inserts: two
-- concurrent transactions attaching the first two members to the same
-- empty commitment would each see zero existing members and both pass.
-- Locking the parent commercial_commitments row with FOR UPDATE (the
-- same technique already proven by create_request_with_draft's
-- form_definitions lock) serializes concurrent inserts against the same
-- commitment_id: the second transaction blocks until the first commits,
-- then re-reads existing membership and correctly sees the just-committed
-- row.
create function fn_protect_commitment_component_membership()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_kind              text;
  v_new_currency      text;
  v_existing_currency text;
begin
  select kind into v_kind
  from public.commercial_commitments
  where id = new.commitment_id
  for update;

  if v_kind is distinct from 'spend' then
    raise exception
      'commercial_commitment_components: only minimum-spend commitments may use this '
      'membership table (commitment_id=% has kind=%)', new.commitment_id, v_kind;
  end if;

  select transaction_currency into v_new_currency
  from public.commercial_components
  where id = new.component_id;

  select cc.transaction_currency into v_existing_currency
  from public.commercial_commitment_components ccc
  join public.commercial_components cc on cc.id = ccc.component_id
  where ccc.commitment_id = new.commitment_id
  limit 1;

  if v_existing_currency is not null and v_existing_currency is distinct from v_new_currency then
    raise exception
      'commercial_commitment_components: member component currency % does not match '
      'existing member currency % for commitment %',
      v_new_currency, v_existing_currency, new.commitment_id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_commitment_component_membership() is
  'Rejects any insert attaching a non-spend (quantity) commitment through this join table, '
  'and enforces that every member component of a spend commitment shares the same '
  'transaction_currency. See docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §8.';

create trigger trg_commercial_commitment_components_protect_membership
  before insert on commercial_commitment_components
  for each row
  execute function fn_protect_commitment_component_membership();

create trigger trg_commercial_commitment_components_reject_update_delete
  before update or delete on commercial_commitment_components
  for each row
  execute function fn_reject_update_delete();


-- =============================================================================
-- Privilege hardening
-- =============================================================================

-- Migration 2's default-privilege baseline already denies anon/
-- authenticated on every new table and function the moment they are
-- created; the explicit REVOKEs below are defense-in-depth, not a
-- correction, matching every prior migration's own stated reasoning.
revoke all on table
  measurement_definitions, commercial_configurations, commercial_changes,
  commercial_components, commercial_component_capabilities,
  commercial_commitments, commercial_commitment_components
from anon, authenticated;

revoke execute on function
  fn_reject_update_delete(),
  fn_protect_measurement_definition_lifecycle(),
  fn_protect_commercial_configuration_lifecycle(),
  fn_protect_commercial_component_lifecycle(),
  fn_protect_commercial_commitment_lifecycle(),
  fn_protect_commitment_component_membership(),
  create_commercial_configuration_with_change(uuid, uuid, uuid, text, text, date, uuid, text, text, uuid, jsonb)
from public, anon, authenticated;

-- Explicit, narrow GRANT for the trusted application path: revoking
-- EXECUTE from public above removes the implicit PUBLIC-channel grant
-- every role otherwise receives by default at CREATE FUNCTION time.
-- Nothing in this repository establishes a separate, repository-
-- controlled privilege path for service_role on this function (no
-- ALTER DEFAULT PRIVILEGES entry, no prior GRANT, no role membership);
-- whether service_role would still have EXECUTE afterward is otherwise
-- environment-provisioning-dependent, not a deterministic migration-level
-- contract. This GRANT makes the trusted-path contract explicit and
-- self-contained within this migration, matching the same trusted-path
-- reasoning already stated for this function's own SECURITY INVOKER
-- posture. Only the one callable application RPC receives it; the six
-- trigger-only functions above do not, since trigger firing never checks
-- the invoking role's EXECUTE privilege on the trigger function.
grant execute on function
  create_commercial_configuration_with_change(uuid, uuid, uuid, text, text, date, uuid, text, text, uuid, jsonb)
to service_role;


-- =============================================================================
-- Row Level Security: deny-by-default
-- =============================================================================

-- Same posture as every existing Commercial-adjacent table: ENABLE, not
-- FORCE, RLS; zero policies. anon/authenticated are denied all direct
-- access by RLS itself, beneath the privilege hardening above. The
-- application-service layer, connecting as service_role, remains the
-- trusted data-access path.
alter table measurement_definitions enable row level security;
alter table commercial_configurations enable row level security;
alter table commercial_changes enable row level security;
alter table commercial_components enable row level security;
alter table commercial_component_capabilities enable row level security;
alter table commercial_commitments enable row level security;
alter table commercial_commitment_components enable row level security;
