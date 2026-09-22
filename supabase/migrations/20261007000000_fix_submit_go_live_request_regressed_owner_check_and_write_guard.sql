-- Real defect found live during the overnight Batch 18-21 evidence-integrity
-- audit (I-031's acceleration-direction stress variant re-verification):
-- 20261005000000_fix_submit_rpcs_missing_dead_end_guard.sql redefined
-- submit_go_live_request from an older function-body snapshot that predates
-- 20260930210000_go_live_requests_protect_trigger.sql (Batch 16 H-043's
-- defense-in-depth write guard). Redefining from the stale snapshot silently
-- dropped TWO things that snapshot never had, neither of which the J-014 fix
-- intended to touch:
--
-- 1. `perform set_config('app.permit_go_live_write', 'true', true);`
--    immediately before the UPDATE. Without it, fn_protect_go_live_requests_lifecycle
--    (the trigger the same H-043 migration installed) rejects EVERY submit
--    attempt outright: "go_live_requests may only be updated through
--    save_go_live_request_draft, submit_go_live_request, ..." even though the
--    call genuinely is submit_go_live_request. Reproduced live tonight: a
--    real submit against a real draft request failed with exactly this
--    error. This made every go_live submission in the product impossible
--    since 20261005000000 was applied, through Batches 20 and 21, neither of
--    which happened to call submit_go_live_request fresh (both reused
--    already-submitted historical fixtures), so the regression went
--    undetected until this audit specifically re-exercised the Regular Path
--    live.
--
-- 2. The `GO_LIVE_REQUEST_SUBMIT_NOT_OWNER: only the creator of request %
--    may submit it` ownership check. This is a real authorization gap, not
--    merely an availability bug: had (1) been fixed in isolation, any actor
--    with any user id could have submitted any OTHER user's draft go_live
--    request. The two defects together happened to mask each other (nothing
--    could submit at all, so the missing ownership check had no live impact
--    yet), but fixing only the write-guard without also restoring the
--    ownership check would have unmasked a real cross-user authorization
--    hole. Both are restored together here.
--
-- Fix: byte-for-byte the 20260930210000 body (ownership check restored in
-- its original position, permit flag restored immediately before the
-- UPDATE) with 20261005000000's WORKFLOW_GRAPH_DEAD_END guard kept, since
-- that fix remains correct and wanted.
--
-- Confirmed via a full migration-file search that no other submit_* RPC
-- (customer_onboarding, customer_change, commercial_configuration) has an
-- equivalent "permit write" defense-in-depth trigger to have been similarly
-- affected: the only such trigger in the schema is
-- fn_protect_go_live_requests_lifecycle, scoped to go_live_requests alone.
-- approve_go_live_request, send_back_go_live_request, cancel_go_live_request,
-- and save_go_live_request_draft were not touched by 20261005000000 and were
-- independently live-reconfirmed working tonight (H-044 happy-path retest,
-- M-011 fixture), so this fix is scoped to submit_go_live_request only.

create or replace function submit_go_live_request(
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

  if v_row.workflow_version_id is not null and v_next.node_type is null then
    raise exception 'WORKFLOW_GRAPH_DEAD_END: this request''s workflow could not resolve to any reachable Approval or End node; ask a Workflow Admin to fix the graph';
  end if;

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
