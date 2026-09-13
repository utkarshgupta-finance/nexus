-- Nexus: Customer Lifecycle V1, Commercial Version 2+ draft/submit/approve
-- lifecycle.
--
-- `create_commercial_change_for_configuration` (Migration
-- 20260912210000) closes the prior version's Components and creates the
-- next Commercial Change unconditionally, synchronously, with no draft
-- phase: exactly the "immediately live" gap
-- docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22a already names as deferred.
-- It is left fully intact here (still used by the existing interactive
-- promotion panel); this migration adds a NEW, parallel, governed path
-- alongside it.
--
-- Following the exact same "1:1 extension of requests, real payload in
-- submission_revisions" precedent already established twice this
-- session (customer_onboarding_cases, customer_change_requests):
-- commercial_configuration_versions extends requests 1:1. Its draft
-- payload is `{"commercial_rate": <CommercialRateDraft>}`, the exact
-- same JSON shape the onboarding Commercial Rate stage and its existing
-- promotion mapper (mapOnboardingComponentToCommercialComponentInsert,
-- src/features/customer-onboarding/domain/commercial-configuration-promotion.ts)
-- already produce and consume, so this migration deliberately reuses
-- that mapper rather than inventing a second one. approve_commercial_configuration_version
-- accepts already-mapped p_components (computed in TypeScript, same as
-- approve_customer_onboarding_case already does), never raw draft JSON,
-- so this RPC contains no pricing-shape logic of its own.
--
-- This file has not been applied to any database as of authoring.

create table commercial_configuration_versions (
  request_id uuid primary key references requests (id),
  commercial_configuration_id uuid not null references commercial_configurations (id),
  change_category text not null check (change_category in ('renewal', 'amendment', 'correction', 'other')),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  reason text,
  effective_date date,
  /** Populated only once approved: the real commercial_changes row this version materialized into. */
  commercial_change_id uuid references commercial_changes (request_id),
  decided_by uuid references app_users (id),
  decided_at timestamptz,
  decision_reason text,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app_users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users (id)
);

comment on table commercial_configuration_versions is
  'Case-level lifecycle state for a governed Commercial Configuration Version (Customer Lifecycle V1, docs/CUSTOMER_LIFECYCLE.md). The proposed Commercial Rate draft lives in submission_revisions, which this table extends 1:1 via request_id, never duplicates.';

create trigger trg_commercial_configuration_versions_set_updated_at
  before update on commercial_configuration_versions
  for each row execute function fn_set_updated_at();

create trigger trg_audit_commercial_configuration_versions
  after insert or update on commercial_configuration_versions
  for each row execute function fn_audit_row('request_id');

revoke all on commercial_configuration_versions from anon, authenticated;

-- =============================================================================
-- create_commercial_configuration_version
-- =============================================================================

create or replace function create_commercial_configuration_version(
  p_new_request_id uuid,
  p_commercial_configuration_id uuid,
  p_change_category text,
  p_initial_raw_data jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
as $function$
declare
  v_form_definition_id uuid;
  v_form_version_id uuid;
  v_version commercial_configuration_versions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_change_category = 'initial_setup' then
    raise exception 'COMMERCIAL_VERSION_INVALID_CATEGORY: initial_setup is only valid for the first Commercial Change, created atomically with the Configuration itself';
  end if;

  if not exists (select 1 from commercial_configurations where id = p_commercial_configuration_id) then
    raise exception 'COMMERCIAL_VERSION_CONFIGURATION_NOT_FOUND: no commercial_configurations row for id %', p_commercial_configuration_id;
  end if;

  insert into public.form_definitions (key, name, description, created_by, updated_by)
  values (
    'commercial_configuration_version',
    'System: Commercial Configuration Version (internal)',
    'System-internal Form Definition standing in for a dedicated Commercial Configuration Version business form, which does not exist yet.',
    p_actor_user_id, p_actor_user_id
  )
  on conflict (key) do nothing;

  select id into v_form_definition_id from public.form_definitions where key = 'commercial_configuration_version';

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
      definition_json, survey_js_version, created_by, updated_by
    )
    values (
      v_form_version_id, v_form_definition_id, 1, 'draft', 'Commercial Configuration Version v1',
      '{}'::jsonb, 'n/a', p_actor_user_id, p_actor_user_id
    );

    update public.form_versions
    set status = 'published', published_at = now(), published_by = p_actor_user_id
    where resource_id = v_form_version_id;
  end if;

  perform create_request_with_draft(p_new_request_id, v_form_definition_id, p_initial_raw_data, p_actor_user_id, null, p_actor_context);

  insert into commercial_configuration_versions (request_id, commercial_configuration_id, change_category, created_by, updated_by)
  values (p_new_request_id, p_commercial_configuration_id, p_change_category, p_actor_user_id, p_actor_user_id)
  returning * into v_version;

  return v_version;
end;
$function$;

-- =============================================================================
-- save_commercial_configuration_version_draft
-- =============================================================================

create or replace function save_commercial_configuration_version_draft(
  p_request_id uuid,
  p_raw_data jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
as $function$
declare
  v_revision_id uuid;
  v_version commercial_configuration_versions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select id into v_revision_id
  from submission_revisions
  where request_id = p_request_id and status = 'draft'
  order by revision_number desc
  limit 1;

  if v_revision_id is null then
    raise exception 'COMMERCIAL_VERSION_NO_DRAFT_REVISION: request % has no draft revision to save', p_request_id;
  end if;

  update submission_revisions
  set raw_data = p_raw_data, updated_by = p_actor_user_id, updated_at = now()
  where id = v_revision_id;

  update commercial_configuration_versions
  set updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;

-- =============================================================================
-- submit_commercial_configuration_version
-- =============================================================================

create or replace function submit_commercial_configuration_version(
  p_request_id uuid,
  p_reason text,
  p_effective_date date,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
as $function$
declare
  v_version commercial_configuration_versions;
  v_revision submission_revisions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from commercial_configuration_versions where request_id = p_request_id for update;
  if not found then
    raise exception 'COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for request %', p_request_id;
  end if;

  if v_version.status <> 'draft' then
    raise exception 'COMMERCIAL_VERSION_NOT_SUBMITTABLE: version % has status %, only draft may be submitted', p_request_id, v_version.status;
  end if;

  select * into v_revision
  from submission_revisions
  where request_id = p_request_id and status = 'draft'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'COMMERCIAL_VERSION_NO_DRAFT_REVISION: request % has no draft revision to submit', p_request_id;
  end if;

  perform submit_revision(
    v_revision.id, v_revision.row_version,
    jsonb_build_object('values', v_revision.raw_data, 'applicability', '{}'::jsonb),
    p_actor_user_id, null, p_actor_context
  );

  update commercial_configuration_versions
  set status = 'submitted', reason = p_reason, effective_date = p_effective_date,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;

-- =============================================================================
-- reject_commercial_configuration_version
-- =============================================================================

create or replace function reject_commercial_configuration_version(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
as $function$
declare
  v_version commercial_configuration_versions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'COMMERCIAL_VERSION_REJECT_REASON_REQUIRED: a reason is required to reject this Commercial Configuration Version';
  end if;

  select * into v_version from commercial_configuration_versions where request_id = p_request_id for update;
  if not found then
    raise exception 'COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for request %', p_request_id;
  end if;

  if v_version.status = 'rejected' then
    return v_version;
  end if;

  if v_version.status <> 'submitted' then
    raise exception 'COMMERCIAL_VERSION_NOT_REJECTABLE: version % has status %, only submitted may be rejected', p_request_id, v_version.status;
  end if;

  update commercial_configuration_versions
  set status = 'rejected', decided_by = p_actor_user_id, decided_at = now(), decision_reason = p_reason,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;

-- =============================================================================
-- approve_commercial_configuration_version: the atomic apply/activate
-- =============================================================================

/**
 * p_components is the SAME already-mapped shape approve_customer_onboarding_case's
 * TypeScript service already produces (is_recurring/pricing_rule_kind/
 * pricing_rule_parameters/billing_cadence/billing_timing/reconciliation_cadence/
 * transaction_currency/fx_snapshot_rate/effective_from/billing_quantity_basis/
 * mug_threshold_value), computed via
 * mapOnboardingComponentToCommercialComponentInsert so the FX snapshot
 * frozen at draft time is preserved verbatim, never recomputed here.
 */
create or replace function approve_commercial_configuration_version(
  p_request_id uuid,
  p_components jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
as $function$
declare
  v_version commercial_configuration_versions;
  v_system_request_id uuid;
  v_commercial_change commercial_changes;
  v_component jsonb;
  v_new_component_id uuid;
  v_mug_threshold numeric;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from commercial_configuration_versions where request_id = p_request_id for update;
  if not found then
    raise exception 'COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for request %', p_request_id;
  end if;

  if v_version.status = 'approved' then
    return v_version;
  end if;

  if v_version.status <> 'submitted' then
    raise exception 'COMMERCIAL_VERSION_NOT_APPROVABLE: version % has status %, only submitted may be approved', p_request_id, v_version.status;
  end if;

  -- A real Request identity for the resulting Commercial Change, exactly
  -- how approve_customer_onboarding_case already mints one (this
  -- version's own p_request_id is already claimed as
  -- commercial_configuration_versions' own identity).
  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  -- Close the prior active version's Components (same closure logic
  -- create_commercial_change_for_configuration already uses), now gated
  -- on approval rather than firing unconditionally at draft creation.
  update commercial_components
  set effective_to = v_version.effective_date - 1, updated_by = p_actor_user_id, updated_at = now()
  where commercial_configuration_id = v_version.commercial_configuration_id and effective_to is null;

  insert into commercial_changes (request_id, commercial_configuration_id, change_category, effective_date, reason, created_by)
  values (v_system_request_id, v_version.commercial_configuration_id, v_version.change_category, v_version.effective_date, v_version.reason, p_actor_user_id)
  returning * into v_commercial_change;

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    v_new_component_id := gen_random_uuid();
    perform add_commercial_component(
      v_new_component_id,
      v_version.commercial_configuration_id,
      v_commercial_change.request_id,
      (v_component ->> 'is_recurring')::boolean,
      v_component ->> 'pricing_rule_kind',
      v_component -> 'pricing_rule_parameters',
      v_component ->> 'billing_cadence',
      v_component ->> 'billing_timing',
      v_component ->> 'reconciliation_cadence',
      v_component ->> 'transaction_currency',
      nullif(v_component ->> 'fx_snapshot_rate', '')::numeric,
      (v_component ->> 'effective_from')::date,
      p_actor_user_id,
      v_component ->> 'billing_quantity_basis',
      null,
      null,
      p_actor_context
    );

    v_mug_threshold := nullif(v_component ->> 'mug_threshold_value', '')::numeric;
    if v_mug_threshold is not null then
      perform add_commercial_commitment(
        gen_random_uuid(), v_commercial_change.request_id, v_new_component_id,
        v_mug_threshold, (v_component ->> 'effective_from')::date, p_actor_user_id, p_actor_context
      );
    end if;
  end loop;

  update commercial_configuration_versions
  set status = 'approved', commercial_change_id = v_commercial_change.request_id,
      decided_by = p_actor_user_id, decided_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;

grant execute on function create_commercial_configuration_version(uuid, uuid, text, jsonb, uuid, jsonb) to service_role;
grant execute on function save_commercial_configuration_version_draft(uuid, jsonb, uuid, jsonb) to service_role;
grant execute on function submit_commercial_configuration_version(uuid, text, date, uuid, jsonb) to service_role;
grant execute on function reject_commercial_configuration_version(uuid, text, uuid, jsonb) to service_role;
grant execute on function approve_commercial_configuration_version(uuid, jsonb, uuid, jsonb) to service_role;

revoke execute on function create_commercial_configuration_version(uuid, uuid, text, jsonb, uuid, jsonb) from anon, authenticated;
revoke execute on function save_commercial_configuration_version_draft(uuid, jsonb, uuid, jsonb) from anon, authenticated;
revoke execute on function submit_commercial_configuration_version(uuid, text, date, uuid, jsonb) from anon, authenticated;
revoke execute on function reject_commercial_configuration_version(uuid, text, uuid, jsonb) from anon, authenticated;
revoke execute on function approve_commercial_configuration_version(uuid, jsonb, uuid, jsonb) from anon, authenticated;

-- =============================================================================
-- Permissions: reuse commercial_configuration.write for draft authoring,
-- add commercial_configuration.approve for the reviewer-side decision.
-- =============================================================================

insert into permissions (resource, action, description) values
  ('commercial_configuration', 'approve', 'Approve and activate a governed Commercial Configuration Version.')
on conflict (resource, action) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
join permissions p on p.resource = 'commercial_configuration' and p.action = 'approve'
where r.code = 'commercial_configuration_admin'
on conflict (role_id, permission_id) where revoked_at is null do nothing;
