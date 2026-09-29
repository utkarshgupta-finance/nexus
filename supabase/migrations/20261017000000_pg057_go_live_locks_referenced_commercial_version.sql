-- PG-057 (Product Decision, 2026-09-29): a Go Live request must remain
-- permanently bound to the Commercial Version referenced when it was
-- created. Found via Batch 28 journey V-033: the Go Live review page was
-- labeled "COMMERCIAL CONTEXT (LOCKED)" but actually always displayed the
-- customer's CURRENT commercial terms for the stable component, silently
-- tracking whatever version was active at view/approval time rather than
-- the version the request was actually raised against. This migration
-- adds the server-side half of the fix: approve_go_live_request now
-- blocks if the referenced version has been superseded, and a new
-- explicit, governed refresh_go_live_request_commercial_version RPC lets
-- the request's own creator rebind it to the current active version,
-- preserving the prior reference for audit rather than silently
-- overwriting it.

alter table go_live_requests
  add column if not exists previous_commercial_version_id uuid references commercial_configuration_versions (request_id),
  add column if not exists commercial_version_refreshed_by uuid references app_users (id),
  add column if not exists commercial_version_refreshed_at timestamptz;

create or replace function public.approve_go_live_request(p_id uuid, p_actor_user_id uuid, p_actor_context jsonb DEFAULT NULL::jsonb, p_expected_current_node_key text DEFAULT NULL::text)
 returns go_live_requests
 language plpgsql
as $function$
declare
  v_row go_live_requests;
  v_current_team_id uuid;
  v_current_node_type text;
  v_next record;
  v_next_team_active boolean;
  v_should_finalize boolean;
  v_new_current_node_key text;
  v_referenced_component record;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_row.status = 'approved' then
    if v_row.approved_by is not distinct from p_actor_user_id then
      return v_row;
    end if;
    raise exception 'WORKFLOW_REQUEST_ALREADY_DECIDED: this request was already approved by someone else. Refresh to see the current status.';
  end if;

  if v_row.status not in ('submitted', 'resubmitted') then
    raise exception 'GO_LIVE_REQUEST_NOT_APPROVABLE: request % has status %, only submitted or resubmitted may be approved', p_id, v_row.status;
  end if;

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_row.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  if exists (
    select 1 from workflow_node_transitions
    where domain = 'go_live'
      and resource_id = p_id
      and action = 'approve'
      and actor_user_id = p_actor_user_id
      and from_node_key is distinct from v_row.current_workflow_node_key
  ) then
    raise exception 'WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION: you already approved an earlier step of this request. A different approver must decide this step.';
  end if;

  if v_row.customer_confirmation_status <> 'confirmed' then
    raise exception 'GO_LIVE_CONFIRMATION_REQUIRED: customer confirmation is required before a Go Live request can be approved';
  end if;

  -- PG-057: the commercial version this request was created against is
  -- permanently locked; if a later commercial version has since closed
  -- out that component's open period, this request must be refreshed
  -- (refresh_go_live_request_commercial_version, by its own creator)
  -- before it can proceed. Only blocks when the referenced component is
  -- definitively found and definitively closed; an unresolvable
  -- reference never blocks (avoids a false positive on old data).
  if v_row.commercial_version_id is not null then
    select cc.effective_to into v_referenced_component
    from commercial_configuration_versions ccv
    join commercial_components cc
      on cc.commercial_change_id = ccv.commercial_change_id
     and cc.stable_component_key = v_row.stable_component_key
    where ccv.request_id = v_row.commercial_version_id;

    if found and v_referenced_component.effective_to is not null then
      raise exception 'GO_LIVE_COMMERCIAL_VERSION_SUPERSEDED: the commercial version referenced by this Go Live request has been superseded by a newer approved commercial version for this component; the request''s creator must refresh it against the current version before it can be approved';
    end if;
  end if;

  v_current_team_id := fn_workflow_node_team(v_row.workflow_version_id, v_row.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select wn.node_type into v_current_node_type
  from workflow_nodes wn
  where wn.workflow_version_id = v_row.workflow_version_id
    and wn.node_key = v_row.current_workflow_node_key;

  if v_current_node_type = 'end' then
    v_should_finalize := true;
    v_new_current_node_key := v_row.current_workflow_node_key;
  else
    select * into v_next from fn_resolve_workflow_next_approval(v_row.workflow_version_id, v_row.current_workflow_node_key, '{}'::jsonb);

    if v_next.node_type is null then
      if v_row.current_workflow_node_key is null then
        v_should_finalize := true;
        v_new_current_node_key := null;
      else
        raise exception 'WORKFLOW_GRAPH_DEAD_END: this request''s workflow has no reachable Approval or End node after node "%"; ask a Workflow Admin to fix the graph', v_row.current_workflow_node_key;
      end if;
    elsif v_next.node_type = 'approval' then
      if v_next.team_id is not null then
        select is_active into v_next_team_active from teams where id = v_next.team_id;
        if v_next_team_active is not null and not v_next_team_active then
          raise exception 'WORKFLOW_TEAM_INACTIVE: this request cannot be routed to its next step ("%"), whose responsible team has been deactivated. Ask a Workflow Admin to reassign that node to an active team before this request can advance.', v_next.node_key;
        end if;
      end if;
      v_should_finalize := false;
      v_new_current_node_key := v_next.node_key;
    else
      v_should_finalize := true;
      v_new_current_node_key := v_next.node_key;
    end if;
  end if;

  if v_row.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('go_live', p_id, v_row.workflow_version_id, v_row.workflow_cycle_number, v_row.current_workflow_node_key, v_new_current_node_key, 'approve', p_actor_user_id, null);
  end if;

  perform set_config('app.permit_go_live_write', 'true', true);

  if not v_should_finalize then
    update go_live_requests
    set current_workflow_node_key = v_new_current_node_key,
        updated_by = p_actor_user_id, updated_at = now()
    where id = p_id
    returning * into v_row;

    return v_row;
  end if;

  update go_live_requests
  set status = 'approved', approved_by = p_actor_user_id, approved_at = now(),
      current_workflow_node_key = v_new_current_node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

-- PG-057: explicit, governed action for a Go Live request's own creator
-- to rebind it to the customer's current active commercial version for
-- the same stable component, once the version it was created against has
-- been superseded. Never called implicitly by approve/submit; the old
-- reference is preserved on previous_commercial_version_id, never
-- silently discarded.
create or replace function public.refresh_go_live_request_commercial_version(p_id uuid, p_actor_user_id uuid, p_actor_context jsonb DEFAULT NULL::jsonb)
 returns go_live_requests
 language plpgsql
as $function$
declare
  v_row go_live_requests;
  v_current_component record;
  v_new_version_request_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.created_by is distinct from p_actor_user_id then
    raise exception 'GO_LIVE_REQUEST_REFRESH_NOT_OWNER: only the creator of request % may refresh its referenced commercial version', p_id;
  end if;

  if v_row.status not in ('submitted', 'resubmitted') then
    raise exception 'GO_LIVE_REQUEST_NOT_REFRESHABLE: request % has status %, only a submitted or resubmitted request may be refreshed', p_id, v_row.status;
  end if;

  select cc.id, cc.commercial_change_id into v_current_component
  from commercial_components cc
  where cc.commercial_configuration_id = v_row.commercial_configuration_id
    and cc.stable_component_key = v_row.stable_component_key
    and cc.effective_to is null;

  if not found then
    raise exception 'GO_LIVE_NO_CURRENT_COMMERCIAL_VERSION: no current active commercial component exists for this Go Live request''s stable component';
  end if;

  select ccv.request_id into v_new_version_request_id
  from commercial_configuration_versions ccv
  where ccv.commercial_change_id = v_current_component.commercial_change_id;

  if v_new_version_request_id is null then
    raise exception 'GO_LIVE_NO_CURRENT_COMMERCIAL_VERSION: could not resolve a commercial_configuration_versions row for the current active component';
  end if;

  if v_new_version_request_id = v_row.commercial_version_id then
    raise exception 'GO_LIVE_COMMERCIAL_VERSION_NOT_STALE: this request already references the current active commercial version; there is nothing to refresh';
  end if;

  perform set_config('app.permit_go_live_write', 'true', true);

  update go_live_requests
  set previous_commercial_version_id = v_row.commercial_version_id,
      commercial_version_id = v_new_version_request_id,
      commercial_version_refreshed_by = p_actor_user_id,
      commercial_version_refreshed_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

grant execute on function public.refresh_go_live_request_commercial_version(uuid, uuid, jsonb) to service_role;

create or replace function public.fn_protect_go_live_requests_lifecycle()
 returns trigger
 language plpgsql
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'go_live_requests is a permanent governed history: DELETE is not permitted';
  end if;

  -- tg_op = 'UPDATE'
  if coalesce(current_setting('app.permit_go_live_write', true), '') <> 'true' then
    raise exception 'go_live_requests may only be updated through save_go_live_request_draft, submit_go_live_request, send_back_go_live_request, approve_go_live_request, cancel_go_live_request, or refresh_go_live_request_commercial_version (id=%)', old.id;
  end if;

  return new;
end;
$function$;
