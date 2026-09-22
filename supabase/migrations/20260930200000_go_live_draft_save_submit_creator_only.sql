-- Nexus: Go Live draft Save/Submit creator-only enforcement.
--
-- Found live during NEXUS Batch 16 while executing H-027 (Cancel
-- Rejected, Non-Creator Attempt). cancel_go_live_request already
-- enforces GO_LIVE_REQUEST_CANCEL_NOT_OWNER, and the UI hides its own
-- edit controls correctly for status guards, but save_go_live_request_draft
-- and submit_go_live_request never checked created_by at all, only the
-- blanket go_live.create/go_live.submit permission. Reproduced live: a
-- second checker persona, holding go_live.* but not the creator of a
-- given draft, could load the draft's page and would see fully enabled
-- Save Draft, Submit, and Cancel Draft controls for another maker's
-- in-progress request merely by knowing its id.
--
-- This is the exact same gap the platform already found and fixed for
-- Customer Onboarding (20260930050000_onboarding_draft_save_submit_creator_only.sql,
-- PD-001), and this migration brings Go Live's draft Save/Submit RPCs
-- in line with that same, already-established pattern: ownership is
-- checked in the RPC itself, the authoritative boundary, not only in
-- the TypeScript service/action layer or the UI's own isEditable flag.
--
-- Rebuilt from the current authoritative bodies: save_go_live_request_draft
-- as last redefined by 20260922000000_optimistic_locking_extension.sql
-- (adds p_expected_row_version, GO_LIVE_DRAFT_STALE), and
-- submit_go_live_request as last redefined by
-- 20260925000000_workflow_runtime_v1_sequential_execution.sql (adds
-- workflow graph resolution and the transition audit insert). Both
-- behaviors are preserved unchanged; only the new ownership check is
-- added, ordered immediately after the status guard, before the row-
-- version/workflow-graph logic, matching cancel_go_live_request's own
-- guard order (status, then ownership).
--
-- Read (viewing another maker's draft by request id) is not addressed
-- here, matching the onboarding precedent's own scope decision: no
-- Batch 16 journey names a read restriction, only the write/mutation
-- one H-027 explicitly scheduled.

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
