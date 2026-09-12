-- Nexus: fix create_system_commercial_request's first-ever call.
--
-- fn_protect_form_version_lifecycle (20260907014500_form_versioning_foundation.sql)
-- requires every form_versions row to be INSERTed with status = 'draft';
-- 'published' is only reachable via a later UPDATE from an existing draft
-- row. create_system_commercial_request (20260912210000_commercial_configuration_persistence.sql)
-- violated this on the very first call for a fresh 'system_commercial_change'
-- form_definition: it inserted the v1 form_versions row directly with
-- status = 'published', which the trigger correctly rejects. This has
-- never succeeded against a database with no pre-existing form_versions
-- row for that definition.
--
-- Fix: insert the v1 row as 'draft', then UPDATE it to 'published' in the
-- same transaction, matching every other form_versions writer's lifecycle
-- (draft -> published, never published-on-insert). No behavior changes
-- for the row's final, visible state; only the insert path changes.
--
-- This file has not been applied to any database as of authoring.

create or replace function public.create_system_commercial_request(
  p_new_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns requests
language plpgsql
as $function$
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
      definition_json, survey_js_version, created_by, updated_by
    )
    values (
      v_form_version_id, v_form_definition_id, 1, 'draft', 'System Commercial Change v1',
      '{}'::jsonb, 'n/a', p_actor_user_id, p_actor_user_id
    );

    update public.form_versions
    set status = 'published', published_at = now(), published_by = p_actor_user_id
    where resource_id = v_form_version_id;
  end if;

  insert into public.resources (resource_id, resource_type, created_by)
  values (p_new_request_id, 'request', p_actor_user_id);

  insert into public.requests (id, pinned_form_version_id, created_by, updated_by)
  values (p_new_request_id, v_form_version_id, p_actor_user_id, p_actor_user_id)
  returning * into v_request;

  return v_request;
end;
$function$;
