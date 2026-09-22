-- Nexus: go_live_requests defense-in-depth protect trigger.
--
-- Found live during NEXUS Batch 16 while executing H-043 (Direct
-- mutation bypass attempt against go_live_requests.status is blocked).
-- Confirmed via direct migration inspection (this file's own history):
-- go_live_requests had trg_go_live_requests_updated_at,
-- trg_audit_go_live_requests, and trg_go_live_requests_row_version, but
-- no fn_protect_go_live_requests_lifecycle-style BEFORE-UPDATE guard
-- trigger analogous to fn_protect_customer_lifecycle (customers) or
-- fn_protect_commercial_component_lifecycle (commercial_components).
-- RLS-with-no-policy already blocks the anon/authenticated client
-- roles the same as everywhere else in this schema; the exposure this
-- closes is specifically a service_role or superuser connection
-- crafting a direct UPDATE that sets status = 'approved' (or any other
-- governed field) without ever calling approve_go_live_request, which
-- would silently skip every guard that RPC enforces: self-approval,
-- workflow-node resolution, customer-confirmation, and team
-- membership, and would leave no workflow_node_transitions row behind.
--
-- Mirrors the session-local-bypass pattern
-- fn_protect_customer_lifecycle already established for DELETE
-- (app.permit_customer_delete): a governed table blocks DELETE and any
-- UPDATE outright by default; only a sanctioned writer RPC may proceed,
-- by setting a session-local flag for the duration of its own
-- transaction immediately before its own UPDATE. go_live_requests has
-- no equivalent split between "structural" and "governed" columns the
-- way customers does (every column here is workflow state, not
-- free-form business data), so the simpler form applies: block ALL
-- UPDATE and DELETE unless the flag is set. INSERT is not gated:
-- create_go_live_request's own single INSERT never touches an existing
-- governed row, so there is nothing to protect there.

create function fn_protect_go_live_requests_lifecycle()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'go_live_requests is a permanent governed history: DELETE is not permitted';
  end if;

  -- tg_op = 'UPDATE'
  if coalesce(current_setting('app.permit_go_live_write', true), '') <> 'true' then
    raise exception 'go_live_requests may only be updated through save_go_live_request_draft, submit_go_live_request, send_back_go_live_request, approve_go_live_request, or cancel_go_live_request (id=%)', old.id;
  end if;

  return new;
end;
$function$;

comment on function fn_protect_go_live_requests_lifecycle() is
  'Defense-in-depth guard (Batch 16 H-043): blocks DELETE unconditionally and blocks UPDATE unless app.permit_go_live_write was set by one of the five sanctioned Go Live write RPCs for the duration of their own transaction, immediately before their own UPDATE. RLS already blocks anon/authenticated; this additionally blocks a direct service_role/superuser write from bypassing the RPC guard chain (self-approval, workflow-node resolution, confirmation, team membership) and the audit trail it produces.';

create trigger trg_protect_go_live_requests_lifecycle
  before update or delete on go_live_requests
  for each row
  execute function fn_protect_go_live_requests_lifecycle();

revoke all on function fn_protect_go_live_requests_lifecycle() from public, anon, authenticated;

-- =============================================================================
-- Thread app.permit_go_live_write through the five sanctioned write RPCs.
-- Bodies below are copied from their current authoritative source
-- (save_go_live_request_draft: 20260922000000_optimistic_locking_extension.sql;
-- submit_go_live_request, approve_go_live_request, send_back_go_live_request:
-- 20260925000000_workflow_runtime_v1_sequential_execution.sql;
-- cancel_go_live_request: 20260918010000_go_live_domain.sql, never since
-- redefined), unchanged except for the one added
-- `perform set_config('app.permit_go_live_write', 'true', true);` line
-- immediately before each function's own UPDATE statement(s).
-- =============================================================================

drop function if exists save_go_live_request_draft(uuid, date, boolean, text, integer, uuid, jsonb);

create function save_go_live_request_draft(
  p_id uuid,
  p_go_live_date date,
  p_prorate_first_month boolean,
  p_comment text,
  p_expected_row_version integer,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.status not in ('draft', 'sent_back') then
    raise exception 'GO_LIVE_REQUEST_NOT_EDITABLE: request % has status %, only a draft or sent-back request may be edited', p_id, v_row.status;
  end if;

  if v_row.created_by is distinct from p_actor_user_id then
    raise exception 'GO_LIVE_DRAFT_SAVE_NOT_OWNER: only the creator of request % may edit this draft', p_id;
  end if;

  if v_row.row_version <> p_expected_row_version then
    raise exception 'GO_LIVE_DRAFT_STALE: This draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.';
  end if;

  perform set_config('app.permit_go_live_write', 'true', true);

  update go_live_requests
  set go_live_date = p_go_live_date,
      prorate_first_month = p_prorate_first_month,
      comment = p_comment,
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

comment on function save_go_live_request_draft(uuid, date, boolean, text, integer, uuid, jsonb) is
  'Saves draft field edits. Rejects with GO_LIVE_DRAFT_SAVE_NOT_OWNER if the caller is not the request creator, and with GO_LIVE_DRAFT_STALE if row_version no longer matches p_expected_row_version.';

revoke all on function save_go_live_request_draft(uuid, date, boolean, text, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function save_go_live_request_draft(uuid, date, boolean, text, integer, uuid, jsonb) to service_role;

drop function if exists submit_go_live_request(uuid, uuid, jsonb);

create function submit_go_live_request(
  p_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
  v_next_status text;
  v_next record;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.status not in ('draft', 'sent_back') then
    raise exception 'GO_LIVE_REQUEST_NOT_SUBMITTABLE: request % has status %, only a draft or sent-back request may be submitted', p_id, v_row.status;
  end if;

  if v_row.created_by is distinct from p_actor_user_id then
    raise exception 'GO_LIVE_REQUEST_SUBMIT_NOT_OWNER: only the creator of request % may submit it', p_id;
  end if;

  v_next_status := case when v_row.status = 'sent_back' then 'resubmitted' else 'submitted' end;

  select * into v_next from fn_resolve_workflow_next_approval(v_row.workflow_version_id, null, '{}'::jsonb);

  perform set_config('app.permit_go_live_write', 'true', true);

  update go_live_requests
  set status = v_next_status, submitted_by = p_actor_user_id, submitted_at = now(),
      current_workflow_node_key = v_next.node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  if v_row.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('go_live', p_id, v_row.workflow_version_id, v_row.workflow_cycle_number, null, v_next.node_key, 'submit', p_actor_user_id, null);
  end if;

  return v_row;
end;
$function$;

comment on function submit_go_live_request(uuid, uuid, jsonb) is
  'Submits (or resubmits) a draft/sent_back request. Rejects with GO_LIVE_REQUEST_SUBMIT_NOT_OWNER if the caller is not the request creator, and with GO_LIVE_REQUEST_NOT_SUBMITTABLE if the status does not allow it.';

revoke all on function submit_go_live_request(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function submit_go_live_request(uuid, uuid, jsonb) to service_role;

drop function if exists send_back_go_live_request(uuid, text, uuid, jsonb);

create function send_back_go_live_request(
  p_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
  v_current_team_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'GO_LIVE_SEND_BACK_REASON_REQUIRED: a reason is required to send a Go Live request back';
  end if;

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot send back your own request. Another authorized checker must review it.';
  end if;

  if v_row.status not in ('submitted', 'resubmitted') then
    raise exception 'GO_LIVE_REQUEST_NOT_SENDBACKABLE: request % has status %, only submitted or resubmitted may be sent back', p_id, v_row.status;
  end if;

  v_current_team_id := fn_workflow_node_team(v_row.workflow_version_id, v_row.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  if v_row.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('go_live', p_id, v_row.workflow_version_id, v_row.workflow_cycle_number, v_row.current_workflow_node_key, null, 'send_back', p_actor_user_id, p_reason);
  end if;

  perform set_config('app.permit_go_live_write', 'true', true);

  update go_live_requests
  set status = 'sent_back', sent_back_reason = p_reason, sent_back_by = p_actor_user_id, sent_back_at = now(),
      current_workflow_node_key = null, workflow_cycle_number = workflow_cycle_number + 1,
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  insert into go_live_send_backs (go_live_request_id, reason, sent_back_by)
  values (p_id, p_reason, p_actor_user_id);

  return v_row;
end;
$function$;

revoke all on function send_back_go_live_request(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function send_back_go_live_request(uuid, text, uuid, jsonb) to service_role;

drop function if exists approve_go_live_request(uuid, uuid, jsonb, text);

create function approve_go_live_request(
  p_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_expected_current_node_key text default null
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
  v_current_team_id uuid;
  v_next record;
  v_should_finalize boolean;
  v_new_current_node_key text;
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
    return v_row;
  end if;

  if v_row.status not in ('submitted', 'resubmitted') then
    raise exception 'GO_LIVE_REQUEST_NOT_APPROVABLE: request % has status %, only submitted or resubmitted may be approved', p_id, v_row.status;
  end if;

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_row.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  if v_row.customer_confirmation_status <> 'confirmed' then
    raise exception 'GO_LIVE_CONFIRMATION_REQUIRED: customer confirmation is required before a Go Live request can be approved';
  end if;

  v_current_team_id := fn_workflow_node_team(v_row.workflow_version_id, v_row.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select * into v_next from fn_resolve_workflow_next_approval(v_row.workflow_version_id, v_row.current_workflow_node_key, '{}'::jsonb);

  if v_next.node_type is null then
    if v_row.current_workflow_node_key is null then
      v_should_finalize := true;
      v_new_current_node_key := null;
    else
      raise exception 'WORKFLOW_GRAPH_DEAD_END: this request''s workflow has no reachable Approval or End node after node "%"; ask a Workflow Admin to fix the graph', v_row.current_workflow_node_key;
    end if;
  elsif v_next.node_type = 'approval' then
    v_should_finalize := false;
    v_new_current_node_key := v_next.node_key;
  else
    v_should_finalize := true;
    v_new_current_node_key := v_next.node_key;
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

revoke all on function approve_go_live_request(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function approve_go_live_request(uuid, uuid, jsonb, text) to service_role;

drop function if exists cancel_go_live_request(uuid, text, uuid, jsonb);

create function cancel_go_live_request(
  p_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.status not in ('draft', 'sent_back') then
    raise exception 'GO_LIVE_REQUEST_NOT_CANCELLABLE: request % has status %, only a draft or sent-back request may be cancelled', p_id, v_row.status;
  end if;

  if v_row.created_by is distinct from p_actor_user_id then
    raise exception 'GO_LIVE_REQUEST_CANCEL_NOT_OWNER: only the creator of request % may cancel it', p_id;
  end if;

  perform set_config('app.permit_go_live_write', 'true', true);

  update go_live_requests
  set status = 'cancelled', cancelled_by = p_actor_user_id, cancelled_at = now(), cancelled_reason = p_reason,
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

revoke all on function cancel_go_live_request(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function cancel_go_live_request(uuid, text, uuid, jsonb) to service_role;

-- =============================================================================
-- set_go_live_customer_confirmation also writes this table (a sixth
-- sanctioned writer, distinct from the five governed lifecycle
-- transitions above) and needs the same bypass.
-- =============================================================================

drop function if exists set_go_live_customer_confirmation(uuid, boolean, uuid, jsonb);

create function set_go_live_customer_confirmation(
  p_id uuid,
  p_confirmed boolean,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.status = 'cancelled' then
    raise exception 'GO_LIVE_REQUEST_NOT_EDITABLE: request % is cancelled, customer confirmation can no longer change', p_id;
  end if;

  perform set_config('app.permit_go_live_write', 'true', true);

  update go_live_requests
  set customer_confirmation_status = case when p_confirmed then 'confirmed' else 'pending' end,
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

revoke all on function set_go_live_customer_confirmation(uuid, boolean, uuid, jsonb) from public, anon, authenticated;
grant execute on function set_go_live_customer_confirmation(uuid, boolean, uuid, jsonb) to service_role;
