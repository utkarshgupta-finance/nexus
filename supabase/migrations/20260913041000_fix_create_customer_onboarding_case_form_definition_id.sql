-- Nexus: fix create_customer_onboarding_case calling create_request_with_draft
-- with the wrong id.
--
-- create_request_with_draft's second parameter is p_form_definition_id (it
-- resolves the currently published Form Version itself); the previous
-- version of this function passed the Form Version's own resource id
-- instead, which fails immediately with FORM_DEFINITION_NOT_FOUND on the
-- very first call, caught during smoke testing before any real onboarding
-- case was created.
--
-- This file has not been applied to any database as of authoring.

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

  perform create_request_with_draft(p_new_request_id, v_form_definition_id, p_initial_raw_data, p_actor_user_id, null, p_actor_context);

  insert into customer_onboarding_cases (request_id, created_by, updated_by)
  values (p_new_request_id, p_actor_user_id, p_actor_user_id)
  returning * into v_case;

  return v_case;
end;
$function$;
