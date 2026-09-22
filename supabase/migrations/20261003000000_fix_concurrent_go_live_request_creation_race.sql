-- Batch 18 H-044: create_go_live_request had no database-level check
-- against an existing active request for the same stable_component_key,
-- only a UI-route-layer guard (the create-new route 404s if
-- currentGoLiveRequestForLineItem already resolves one). Live-confirmed
-- that two calls against the same stable_component_key both succeeded,
-- producing two simultaneously active go_live_requests rows racing each
-- other through independent approval chains, exactly the TOCTOU risk
-- this journey's own premise anticipated ("Recovery/Resilience Variant:
-- if both succeed today, this journey's finding becomes the basis for
-- adding a database-level uniqueness constraint").
--
-- Fix: a partial unique index is the true source of truth (matching
-- this codebase's own established D-005 principle that a DB-level
-- UNIQUE constraint, not application-level checking alone, is what
-- actually prevents a duplicate identity), enforcing at most one
-- non-cancelled go_live_requests row per stable_component_key, matching
-- the exact definition of "active" the application layer's own
-- currentGoLiveRequestForLineItem already uses (status <> 'cancelled').
-- create_go_live_request is updated to translate the resulting unique
-- violation into a named, friendly error instead of a raw constraint
-- violation reaching the user.

create unique index uq_go_live_requests_active_component
  on go_live_requests (stable_component_key)
  where status <> 'cancelled';

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

  begin
    insert into go_live_requests (
      id, customer_id, commercial_configuration_id, commercial_version_id, stable_component_key,
      go_live_date, prorate_first_month, workflow_version_id, created_by, updated_by
    )
    values (
      p_id, p_customer_id, p_commercial_configuration_id, p_commercial_version_id, p_stable_component_key,
      p_go_live_date, p_prorate_first_month, v_workflow_version_id, p_actor_user_id, p_actor_user_id
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'GO_LIVE_ACTIVE_REQUEST_ALREADY_EXISTS: an active Go Live request already exists for this commercial line item; cancel it first or continue with the existing one';
  end;

  return v_row;
end;
$function$;
