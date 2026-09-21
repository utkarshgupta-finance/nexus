-- PD-003 (B-011, Batches 1-13 Ledger Audit product decision closure):
-- a new Commercial Configuration Version must not be created for a
-- customer that is currently inactive, matching the existing principle
-- that new Customer Change activity is blocked for inactive customers
-- (src/features/customer-change/actions.ts's createChangeRequestAction).
-- Customer Change's own equivalent check lives only in its TypeScript
-- Server Action, not in its RPC; this fix goes one step further and
-- enforces at the RPC layer too, so a direct/RPC bypass of the
-- TypeScript action layer (added separately in the same task) is also
-- blocked, closing the gap PD-003 raised more completely than the
-- Customer Change precedent it aligns with.
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
  v_customer_id uuid;
  v_customer_is_active boolean;
  v_version commercial_configuration_versions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_change_category = 'initial_setup' then
    raise exception 'COMMERCIAL_VERSION_INVALID_CATEGORY: initial_setup is only valid for the first Commercial Change, created atomically with the Configuration itself';
  end if;

  select cc.customer_id into v_customer_id
  from commercial_configurations cc
  where cc.id = p_commercial_configuration_id;

  if v_customer_id is null then
    raise exception 'COMMERCIAL_VERSION_CONFIGURATION_NOT_FOUND: no commercial_configurations row for id %', p_commercial_configuration_id;
  end if;

  select c.is_active into v_customer_is_active from customers c where c.id = v_customer_id;

  if not coalesce(v_customer_is_active, false) then
    raise exception 'COMMERCIAL_VERSION_CUSTOMER_INACTIVE: customer % is inactive; reactivate the customer before creating a new Commercial Configuration Version', v_customer_id;
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
