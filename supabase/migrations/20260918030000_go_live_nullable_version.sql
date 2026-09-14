-- Nexus: Go Live + Entitlement Ledger, Phase B fix. A commercial
-- configuration whose terms have never been through a Version 2+
-- approval cycle (still on its original onboarding-created setup) has
-- no commercial_configuration_versions row at all: confirmed against
-- the live database, 5 of the current commercial_configurations rows
-- are in exactly this state. go_live_requests.commercial_version_id's
-- NOT NULL foreign key would make Go Live impossible to create for any
-- of them, the most common case, not an edge case. commercial_version_id
-- becomes nullable: null means "the original, never-versioned setup,"
-- which is inherently the current terms and needs no separate
-- approved-status check (there is no version row to check status on).
--
-- This file has not been applied to any database as of authoring.

alter table go_live_requests alter column commercial_version_id drop not null;

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
