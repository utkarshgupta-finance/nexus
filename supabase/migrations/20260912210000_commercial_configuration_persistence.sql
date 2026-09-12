-- Nexus: Commercial Configuration persistence, versioning, and FX snapshot.
--
-- Closes the gap docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22 always
-- described as future work: Customer Onboarding's Commercial Rate draft
-- had no write path into the real, locked Commercial schema (Migration 8,
-- 20260908210000_commercial_configuration_foundation.sql). This migration
-- adds exactly what that gap needs, reusing the existing schema rather
-- than duplicating it:
--
--   1. commercial_components.fx_snapshot_rate: the one column the locked
--      M8 schema never needed until a real write path existed. Freezes
--      the Reference Master INR conversion rate in effect at the moment
--      a component is created, so a later Settings FX change can never
--      silently revalue an already-created component (docs/
--      COMMERCIAL_DOMAIN_ARCHITECTURE.md §22, "FX snapshot principle").
--   2. Two new permissions (commercial_configuration/read, /write) and
--      two new roles, seeded the same way reference_master's permission
--      catalog was seeded (20260912150000_auth_authorization_foundation.sql).
--   3. Three new RPCs, all following the exact set_config +
--      mutation-in-one-transaction actor-audit pattern every Commercial
--      RPC already uses:
--        - create_system_commercial_request(): mints a real requests row
--          for a Commercial Change to extend, self-bootstrapping a
--          system-internal, published Form Version the first time it
--          runs. See its own comment for why this exists instead of a
--          dedicated Commercial Change Request business form, which does
--          not exist yet.
--        - create_commercial_change_for_configuration(): the renewal/
--          amendment/correction/other sibling of the existing M8
--          create_commercial_configuration_with_change() (which only ever
--          creates the FIRST, initial_setup change). Closes every
--          currently-open component under the configuration so a new
--          "version" cleanly supersedes the prior one.
--        - add_commercial_component(): the one RPC the existing schema
--          never had at all: an actual INSERT into commercial_components.
--          Nothing before this migration could create a component.
--
-- No new table duplicates commercial_configurations/commercial_changes/
-- commercial_components; this migration only adds one column and RPCs
-- that write through the existing tables.
--
-- This file has not been applied to any database as of authoring.


-- =============================================================================
-- 1. FX snapshot column on commercial_components
-- =============================================================================

alter table commercial_components add column fx_snapshot_rate numeric;

alter table commercial_components add constraint chk_commercial_components_fx_snapshot_shape check (
  (transaction_currency = 'INR' and fx_snapshot_rate is null)
  or (transaction_currency <> 'INR' and fx_snapshot_rate is not null and fx_snapshot_rate > 0)
);

comment on column commercial_components.fx_snapshot_rate is
  'The Reference Master INR conversion rate for transaction_currency, frozen at the moment '
  'this component was created. Null only when transaction_currency = INR itself (nothing to '
  'convert). A later Settings change to the governed rate never touches this column: '
  'historical components always render with the rate that was actually in effect when they '
  'were agreed. See docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md, FX snapshot principle.';


-- =============================================================================
-- 2. Permission catalog: Commercial Configuration
-- =============================================================================

insert into permissions (resource, action, description) values
  ('commercial_configuration', 'read', 'View Commercial Configuration current version and version history.'),
  ('commercial_configuration', 'write', 'Create or promote Commercial Configuration versions and components.')
on conflict (resource, action) do nothing;

insert into roles (code, name, description) values
  ('commercial_configuration_viewer', 'Commercial Configuration Viewer', 'Can view Commercial Configuration current version and version history.'),
  ('commercial_configuration_admin', 'Commercial Configuration Admin', 'Can view and create Commercial Configuration versions.')
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.code = 'commercial_configuration_viewer' and p.resource = 'commercial_configuration' and p.action = 'read'
on conflict (role_id, permission_id) where revoked_at is null do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r, permissions p
where r.code = 'commercial_configuration_admin' and p.resource = 'commercial_configuration' and p.action in ('read', 'write')
on conflict (role_id, permission_id) where revoked_at is null do nothing;


-- =============================================================================
-- 3. System-internal Form Definition/Version for Commercial Change requests
-- =============================================================================

-- commercial_changes.request_id is a hard, locked foreign key to
-- requests(id) (M8: "the Request it extends already provides the
-- approval trail"), and requests requires a currently-published Form
-- Version (trg_requests_protect_integrity,
-- 20260907044335_submission_data_foundation.sql). A dedicated,
-- purpose-built "Commercial Change Request" business form (with its own
-- task/comment/approval workflow UI) does not exist yet; building one is
-- explicitly out of this task's scope ("do not invent an overly complex
-- approval workflow yet"). create_system_commercial_request() below
-- self-bootstraps one minimal, honestly-labeled system Form Definition
-- and published Form Version the first time it is ever called (not
-- seeded directly here as static rows), because form_versions.published_by
-- is NOT NULL and must reference a real app_users row, which does not
-- exist at migration-apply time in a fresh environment: bootstrapping at
-- first real call time, using that call's own actor, is the only
-- approach that stays valid in every environment.
create function create_system_commercial_request(
  p_new_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null
)
returns public.requests
language plpgsql
security invoker
as $$
declare
  v_form_definition_id uuid;
  v_form_version_id uuid;
  v_request public.requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  insert into public.form_definitions (key, name, description, created_by, updated_by)
  values (
    'system_commercial_change',
    'System: Commercial Change (internal)',
    'System-internal Form Definition standing in for a dedicated Commercial Change Request '
    'business form, which does not exist yet. Every requests row created through '
    'create_system_commercial_request() pins to a published Form Version of this definition. '
    'Not user-facing; never shown as a real onboarding/business form.',
    p_actor_user_id, p_actor_user_id
  )
  on conflict (key) do nothing;

  select id into v_form_definition_id from public.form_definitions where key = 'system_commercial_change';

  select fv.resource_id into v_form_version_id
  from public.form_versions fv
  where fv.form_definition_id = v_form_definition_id and fv.status = 'published'
  order by fv.version_number desc
  limit 1;

  if v_form_version_id is null then
    v_form_version_id := gen_random_uuid();
    insert into public.resources (resource_id, resource_type, created_by)
    values (v_form_version_id, 'form_version', p_actor_user_id);

    insert into public.form_versions (
      resource_id, form_definition_id, version_number, status, display_name,
      definition_json, survey_js_version, created_by, updated_by, published_at, published_by
    )
    values (
      v_form_version_id, v_form_definition_id, 1, 'published', 'System Commercial Change v1',
      '{}'::jsonb, 'n/a', p_actor_user_id, p_actor_user_id, now(), p_actor_user_id
    );
  end if;

  insert into public.resources (resource_id, resource_type, created_by)
  values (p_new_request_id, 'request', p_actor_user_id);

  insert into public.requests (id, pinned_form_version_id, created_by, updated_by)
  values (p_new_request_id, v_form_version_id, p_actor_user_id, p_actor_user_id)
  returning * into v_request;

  return v_request;
end;
$$;

comment on function create_system_commercial_request(uuid, uuid, jsonb) is
  'Mints a real requests row for a Commercial Change to extend, self-bootstrapping a minimal '
  'published system Form Version the first time it runs (form_versions.published_by requires a '
  'real app_users row, which cannot be seeded at migration-apply time). Honest, controlled '
  'stand-in for a dedicated Commercial Change Request business form, not a bypass of the '
  'generic Request identity model: the resulting requests/resources rows are real, permanent, '
  'and audited exactly like any other Request. See this migration''s header comment.';


-- =============================================================================
-- 4. create_commercial_change_for_configuration: renewal/amendment/
--    correction/other sibling of M8's create_commercial_configuration_with_change
-- =============================================================================

-- create_commercial_configuration_with_change() (M8) only ever creates
-- the FIRST commercial_changes row (change_category = 'initial_setup'),
-- paired with a brand new commercial_configurations row. This function is
-- its sibling for every later Commercial Change against an EXISTING
-- Commercial Configuration: it creates the commercial_changes row only
-- (never a new commercial_configurations row), and closes every
-- currently-open component under that configuration (effective_to := new
-- effective_date - 1 day) so the new Change's components cleanly
-- supersede the prior complete set, avoiding overlapping active periods
-- for the same configuration (this task's own versioning principle). The
-- locked domain's own general allowance for simultaneous components
-- (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §4) is a permission, not a
-- requirement; closing out the full prior set on a new whole-configuration
-- version is a deliberate, documented domain-service policy on top of it,
-- not a schema-level restriction.
create function create_commercial_change_for_configuration(
  p_commercial_configuration_id uuid,
  p_request_id uuid,
  p_change_category text,
  p_effective_date date,
  p_actor_user_id uuid,
  p_reason text default null,
  p_actor_context jsonb default null
)
returns public.commercial_changes
language plpgsql
security invoker
as $$
declare
  v_change public.commercial_changes;
begin
  if p_change_category = 'initial_setup' then
    raise exception
      'create_commercial_change_for_configuration: initial_setup is only ever created by '
      'create_commercial_configuration_with_change(), never this function (configuration_id=%)',
      p_commercial_configuration_id;
  end if;

  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  update public.commercial_components
  set effective_to = p_effective_date - 1
  where commercial_configuration_id = p_commercial_configuration_id
    and effective_to is null;

  insert into public.commercial_changes (
    request_id, commercial_configuration_id, change_category, effective_date, reason, created_by
  )
  values (
    p_request_id, p_commercial_configuration_id, p_change_category, p_effective_date, p_reason, p_actor_user_id
  )
  returning * into v_change;

  return v_change;
end;
$$;

comment on function create_commercial_change_for_configuration(uuid, uuid, text, date, uuid, text, jsonb) is
  'Renewal/amendment/correction/other sibling of create_commercial_configuration_with_change(): '
  'creates a commercial_changes row against an EXISTING commercial_configurations row (never a '
  'new one), and closes every currently-open commercial_components row under that '
  'configuration so the new version cleanly supersedes the prior complete set. Rejects '
  'change_category = initial_setup outright.';


-- =============================================================================
-- 5. add_commercial_component: the RPC the existing schema never had
-- =============================================================================

-- Nothing before this migration could ever INSERT into
-- commercial_components at all (data/configuration.data.ts had reads
-- only). This RPC is deliberately generic: pricing_rule_kind and
-- pricing_rule_parameters arrive already correctly shaped by the
-- application layer (src/features/commercial/domain/promotion.ts), which
-- is where the Customer-Onboarding-specific mapping (Slab rows,
-- Designation rows, Milestones, MUG) belongs, not inside SQL. The
-- existing chk_commercial_components_pricing_rule_shape and the new
-- chk_commercial_components_fx_snapshot_shape (§1 above) remain the
-- actual structural guarantees.
create function add_commercial_component(
  p_new_commercial_component_id uuid,
  p_commercial_configuration_id uuid,
  p_commercial_change_id uuid,
  p_is_recurring boolean,
  p_pricing_rule_kind text,
  p_pricing_rule_parameters jsonb,
  p_billing_cadence text,
  p_billing_timing text,
  p_reconciliation_cadence text,
  p_transaction_currency text,
  p_fx_snapshot_rate numeric,
  p_effective_from date,
  p_actor_user_id uuid,
  p_billing_quantity_basis text default null,
  p_measurement_definition_id uuid default null,
  p_supersedes_component_id uuid default null,
  p_actor_context jsonb default null
)
returns public.commercial_components
language plpgsql
security invoker
as $$
declare
  v_component public.commercial_components;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  insert into public.commercial_components (
    id, commercial_configuration_id, commercial_change_id, supersedes_component_id,
    measurement_definition_id, is_recurring, pricing_rule_kind, pricing_rule_parameters,
    billing_cadence, billing_timing, billing_quantity_basis, reconciliation_cadence,
    transaction_currency, fx_snapshot_rate, effective_from, created_by, updated_by
  )
  values (
    p_new_commercial_component_id, p_commercial_configuration_id, p_commercial_change_id, p_supersedes_component_id,
    p_measurement_definition_id, p_is_recurring, p_pricing_rule_kind, p_pricing_rule_parameters,
    p_billing_cadence, p_billing_timing, p_billing_quantity_basis, p_reconciliation_cadence,
    p_transaction_currency, p_fx_snapshot_rate, p_effective_from, p_actor_user_id, p_actor_user_id
  )
  returning * into v_component;

  return v_component;
end;
$$;

comment on function add_commercial_component(uuid, uuid, uuid, boolean, text, jsonb, text, text, text, text, numeric, date, uuid, text, uuid, uuid, jsonb) is
  'The first and only INSERT path into commercial_components. pricing_rule_kind/parameters '
  'arrive pre-shaped by src/features/commercial/domain/promotion.ts; this RPC only performs '
  'the actor-audited write. See this migration''s header comment.';


-- =============================================================================
-- 6. add_commercial_commitment: quantity (MUG) commitments only
-- =============================================================================

-- Onboarding's Commercial Rate stage only ever captures a quantity (MUG)
-- commitment, always scoped to exactly one component (docs/
-- COMMERCIAL_DOMAIN_ARCHITECTURE.md §8, corrected). Spend commitments
-- (kind = 'spend') have no onboarding UI yet and are out of this task's
-- scope; this RPC deliberately only supports 'quantity'. Designation
-- Based MUG's per-designation minimums are summed into one
-- threshold_value here (the component's own combined monthly floor,
-- which is what a quantity commitment actually is), while the full
-- per-designation breakdown remains available in the component's own
-- pricing_rule_parameters.mug.designationMinimums for display; this is
-- not the commitment inventing a second kind, only its one true
-- aggregate threshold.
create function add_commercial_commitment(
  p_new_commercial_commitment_id uuid,
  p_commercial_change_id uuid,
  p_commercial_component_id uuid,
  p_threshold_value numeric,
  p_effective_from date,
  p_actor_user_id uuid,
  p_actor_context jsonb default null
)
returns public.commercial_commitments
language plpgsql
security invoker
as $$
declare
  v_commitment public.commercial_commitments;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  insert into public.commercial_commitments (
    id, commercial_change_id, commercial_component_id, kind, threshold_value, currency, period,
    effective_from, created_by, updated_by
  )
  values (
    p_new_commercial_commitment_id, p_commercial_change_id, p_commercial_component_id, 'quantity',
    p_threshold_value, null, 'monthly', p_effective_from, p_actor_user_id, p_actor_user_id
  )
  returning * into v_commitment;

  return v_commitment;
end;
$$;

comment on function add_commercial_commitment(uuid, uuid, uuid, numeric, date, uuid, jsonb) is
  'Quantity (MUG) commitments only, always monthly, always scoped to exactly one component. '
  'Onboarding has no spend-commitment UI yet; that kind is out of scope here.';


-- =============================================================================
-- Privilege hardening
-- =============================================================================

revoke execute on function
  create_system_commercial_request(uuid, uuid, jsonb),
  create_commercial_change_for_configuration(uuid, uuid, text, date, uuid, text, jsonb),
  add_commercial_component(uuid, uuid, uuid, boolean, text, jsonb, text, text, text, text, numeric, date, uuid, text, uuid, uuid, jsonb),
  add_commercial_commitment(uuid, uuid, uuid, numeric, date, uuid, jsonb)
from public, anon, authenticated;

grant execute on function
  create_system_commercial_request(uuid, uuid, jsonb),
  create_commercial_change_for_configuration(uuid, uuid, text, date, uuid, text, jsonb),
  add_commercial_component(uuid, uuid, uuid, boolean, text, jsonb, text, text, text, text, numeric, date, uuid, text, uuid, uuid, jsonb),
  add_commercial_commitment(uuid, uuid, uuid, numeric, date, uuid, jsonb)
to service_role;
