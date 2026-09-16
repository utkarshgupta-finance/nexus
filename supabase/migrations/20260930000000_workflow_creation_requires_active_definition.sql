-- Nexus: Batch 2 Journey Validation (Workflow Versioning), L-021.
--
-- Defect found while executing L-021 via a direct RPC call: deactivating
-- the sole active workflow definition for a context, with no replacement
-- activated, does not block new request creation for that context. Each
-- of the four create_* RPCs resolves the active published version with a
-- plain SELECT ... LIMIT 1 and inserts whatever it finds, including NULL
-- when no active/published version exists, silently creating a request
-- with workflow_version_id = null and no way to ever resolve which
-- workflow it should be routed through. This is the same systemic gap in
-- all four domains (customer_onboarding, customer_change,
-- commercial_configuration, go_live), since they all share the identical
-- resolve-and-insert pattern.
--
-- Fix: each RPC now raises a clear WORKFLOW_NO_ACTIVE_DEFINITION
-- exception immediately after resolving v_workflow_version_id, before
-- ever inserting the request row, if no active definition/published
-- version could be resolved for its applies_to context. No other logic
-- in these functions changes.

create or replace function create_customer_onboarding_case(
  p_new_request_id uuid,
  p_initial_raw_data jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_onboarding_cases
language plpgsql
as $function$
declare
  v_form_definition_id uuid;
  v_form_version_id uuid;
  v_workflow_version_id uuid;
  v_case customer_onboarding_cases;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  insert into public.form_definitions (key, name, description, created_by, updated_by)
  values (
    'customer_onboarding',
    'System: Customer Onboarding (internal)',
    'System-internal Form Definition standing in for a dedicated Customer Onboarding business form, which does not exist yet. Every requests row created through create_customer_onboarding_case() pins to a published Form Version of this definition.',
    p_actor_user_id, p_actor_user_id
  )
  on conflict (key) do nothing;

  select id into v_form_definition_id from public.form_definitions where key = 'customer_onboarding';

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
      v_form_version_id, v_form_definition_id, 1, 'draft', 'Customer Onboarding v1',
      '{}'::jsonb, 'n/a', p_actor_user_id, p_actor_user_id
    );

    update public.form_versions
    set status = 'published', published_at = now(), published_by = p_actor_user_id
    where resource_id = v_form_version_id;
  end if;

  select wdv.id into v_workflow_version_id
  from workflow_definition_versions wdv
  join workflow_definitions wd on wd.id = wdv.workflow_definition_id
  where wd.applies_to = 'customer_onboarding' and wd.is_active and wdv.status = 'published'
  order by wdv.version_number desc
  limit 1;

  if v_workflow_version_id is null then
    raise exception 'WORKFLOW_NO_ACTIVE_DEFINITION: no active workflow definition with a published version exists for customer_onboarding; a new case cannot be created until one is activated';
  end if;

  perform create_request_with_draft(p_new_request_id, v_form_definition_id, p_initial_raw_data, p_actor_user_id, null, p_actor_context);

  insert into customer_onboarding_cases (request_id, workflow_version_id, created_by, updated_by)
  values (p_new_request_id, v_workflow_version_id, p_actor_user_id, p_actor_user_id)
  returning * into v_case;

  return v_case;
end;
$function$;

create or replace function create_customer_change_request(
  p_new_request_id uuid,
  p_customer_id uuid,
  p_initial_raw_data jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_form_definition_id uuid;
  v_form_version_id uuid;
  v_workflow_version_id uuid;
  v_customer customers;
  v_change_request customer_change_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_customer from customers where id = p_customer_id;
  if not found then
    raise exception 'CUSTOMER_CHANGE_CUSTOMER_NOT_FOUND: no customers row for id %', p_customer_id;
  end if;

  insert into public.form_definitions (key, name, description, created_by, updated_by)
  values (
    'customer_change_request',
    'System: Customer Change Request (internal)',
    'System-internal Form Definition standing in for a dedicated Customer Change Request business form, which does not exist yet.',
    p_actor_user_id, p_actor_user_id
  )
  on conflict (key) do nothing;

  select id into v_form_definition_id from public.form_definitions where key = 'customer_change_request';

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
      v_form_version_id, v_form_definition_id, 1, 'draft', 'Customer Change Request v1',
      '{}'::jsonb, 'n/a', p_actor_user_id, p_actor_user_id
    );

    update public.form_versions
    set status = 'published', published_at = now(), published_by = p_actor_user_id
    where resource_id = v_form_version_id;
  end if;

  select wdv.id into v_workflow_version_id
  from workflow_definition_versions wdv
  join workflow_definitions wd on wd.id = wdv.workflow_definition_id
  where wd.applies_to = 'customer_change' and wd.is_active and wdv.status = 'published'
  order by wdv.version_number desc
  limit 1;

  if v_workflow_version_id is null then
    raise exception 'WORKFLOW_NO_ACTIVE_DEFINITION: no active workflow definition with a published version exists for customer_change; a new change request cannot be created until one is activated';
  end if;

  perform create_request_with_draft(p_new_request_id, v_form_definition_id, p_initial_raw_data, p_actor_user_id, null, p_actor_context);

  insert into customer_change_requests (request_id, customer_id, base_customer_row_version, workflow_version_id, created_by, updated_by)
  values (p_new_request_id, p_customer_id, v_customer.row_version, v_workflow_version_id, p_actor_user_id, p_actor_user_id)
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

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
  v_workflow_version_id uuid;
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

  select wdv.id into v_workflow_version_id
  from workflow_definition_versions wdv
  join workflow_definitions wd on wd.id = wdv.workflow_definition_id
  where wd.applies_to = 'commercial_configuration' and wd.is_active and wdv.status = 'published'
  order by wdv.version_number desc
  limit 1;

  if v_workflow_version_id is null then
    raise exception 'WORKFLOW_NO_ACTIVE_DEFINITION: no active workflow definition with a published version exists for commercial_configuration; a new version cannot be created until one is activated';
  end if;

  perform create_request_with_draft(p_new_request_id, v_form_definition_id, p_initial_raw_data, p_actor_user_id, null, p_actor_context);

  insert into commercial_configuration_versions (request_id, commercial_configuration_id, change_category, workflow_version_id, created_by, updated_by)
  values (p_new_request_id, p_commercial_configuration_id, p_change_category, v_workflow_version_id, p_actor_user_id, p_actor_user_id)
  returning * into v_version;

  return v_version;
end;
$function$;

create or replace function create_go_live_request(
  p_id uuid,
  p_customer_id uuid,
  p_commercial_configuration_id uuid,
  p_commercial_version_id uuid,
  p_stable_component_key uuid,
  p_go_live_date date,
  p_prorate_first_month boolean,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_version commercial_configuration_versions;
  v_workflow_version_id uuid;
  v_row go_live_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_commercial_version_id is not null then
    select * into v_version from commercial_configuration_versions where request_id = p_commercial_version_id;
    if not found then
      raise exception 'GO_LIVE_COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for %', p_commercial_version_id;
    end if;

    if v_version.status <> 'approved' then
      raise exception 'GO_LIVE_COMMERCIAL_VERSION_NOT_APPROVED: version % has status %, a Go Live request may only reference an approved version', p_commercial_version_id, v_version.status;
    end if;
  end if;

  select wdv.id into v_workflow_version_id
  from workflow_definition_versions wdv
  join workflow_definitions wd on wd.id = wdv.workflow_definition_id
  where wd.applies_to = 'go_live' and wd.is_active and wdv.status = 'published'
  order by wdv.version_number desc
  limit 1;

  if v_workflow_version_id is null then
    raise exception 'WORKFLOW_NO_ACTIVE_DEFINITION: no active workflow definition with a published version exists for go_live; a new request cannot be created until one is activated';
  end if;

  insert into resources (resource_id, resource_type, created_by)
  values (p_id, 'go_live_request', p_actor_user_id);

  insert into go_live_requests (
    id, customer_id, commercial_configuration_id, commercial_version_id, stable_component_key,
    go_live_date, prorate_first_month, workflow_version_id, created_by, updated_by
  )
  values (
    p_id, p_customer_id, p_commercial_configuration_id, p_commercial_version_id, p_stable_component_key,
    p_go_live_date, p_prorate_first_month, v_workflow_version_id, p_actor_user_id, p_actor_user_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;

comment on function create_customer_onboarding_case(uuid, jsonb, uuid, jsonb) is
  'Creates a new Customer Onboarding case, resolving and stamping workflow_version_id from the currently active published workflow definition for customer_onboarding. Raises WORKFLOW_NO_ACTIVE_DEFINITION if none exists, rather than silently inserting a null workflow_version_id.';
comment on function create_customer_change_request(uuid, uuid, jsonb, uuid, jsonb) is
  'Creates a new Customer Change request, resolving and stamping workflow_version_id from the currently active published workflow definition for customer_change. Raises WORKFLOW_NO_ACTIVE_DEFINITION if none exists, rather than silently inserting a null workflow_version_id.';
comment on function create_commercial_configuration_version(uuid, uuid, text, jsonb, uuid, jsonb) is
  'Creates a new Commercial Configuration version, resolving and stamping workflow_version_id from the currently active published workflow definition for commercial_configuration. Raises WORKFLOW_NO_ACTIVE_DEFINITION if none exists, rather than silently inserting a null workflow_version_id.';
comment on function create_go_live_request(uuid, uuid, uuid, uuid, uuid, date, boolean, uuid, jsonb) is
  'Creates a new Go Live request, resolving and stamping workflow_version_id from the currently active published workflow definition for go_live. Raises WORKFLOW_NO_ACTIVE_DEFINITION if none exists, rather than silently inserting a null workflow_version_id.';
