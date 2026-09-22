-- Batch 19 (J-014): every approve_* RPC already raises WORKFLOW_GRAPH_DEAD_END
-- when fn_resolve_workflow_next_approval cannot resolve to an Approval or End
-- node (see approve_customer_onboarding_case, approve_customer_change_request,
-- approve_commercial_configuration_version, approve_go_live_request in
-- 20260925000000_workflow_runtime_v1_sequential_execution.sql). The four
-- submit_* RPCs call the same resolver but never checked its result: a
-- structurally over-deep or otherwise dead-ending graph (see the bounded
-- 10-hop walk in fn_resolve_workflow_next_approval) let a submit silently
-- succeed with status changed to submitted/resubmitted and
-- current_workflow_node_key left null, permanently and silently orphaning
-- the request with no approver ever able to act on it. This migration adds
-- the same guard submit-side, before the request's status is changed.

create or replace function submit_customer_onboarding_case(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_onboarding_cases
language plpgsql
as $function$
declare
  v_revision submission_revisions;
  v_case customer_onboarding_cases;
  v_next record;
  v_new_status text;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_case.status not in ('draft', 'sent_back') then
    raise exception 'ONBOARDING_CASE_NOT_SUBMITTABLE: case % has status %, only draft or sent_back may be submitted', p_request_id, v_case.status;
  end if;

  select * into v_revision
  from submission_revisions
  where request_id = p_request_id and status = 'draft'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'ONBOARDING_NO_DRAFT_REVISION: request % has no draft revision to submit', p_request_id;
  end if;

  perform submit_revision(
    v_revision.id, v_revision.row_version,
    jsonb_build_object('values', v_revision.raw_data, 'applicability', '{}'::jsonb),
    p_actor_user_id, null, p_actor_context
  );

  insert into customer_onboarding_revision_documents (request_id, revision_number, document_type, document_id)
  select request_id, v_revision.revision_number, document_type, document_id
  from customer_onboarding_documents
  where request_id = p_request_id and is_current = true
  on conflict (request_id, revision_number, document_type) do nothing;

  select * into v_next
  from fn_resolve_workflow_next_approval(v_case.workflow_version_id, null, jsonb_build_object('segment', v_revision.raw_data ->> 'segment'));

  if v_case.workflow_version_id is not null and v_next.node_type is null then
    raise exception 'WORKFLOW_GRAPH_DEAD_END: this case''s workflow could not resolve to any reachable Approval or End node; ask a Workflow Admin to fix the graph';
  end if;

  v_new_status := case when v_case.status = 'sent_back' then 'resubmitted' else 'submitted' end;

  update customer_onboarding_cases
  set status = v_new_status,
      current_workflow_node_key = v_next.node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  if v_case.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('customer_onboarding', p_request_id, v_case.workflow_version_id, v_case.workflow_cycle_number, null, v_next.node_key, 'submit', p_actor_user_id, null);
  end if;

  return v_case;
end;
$function$;

create or replace function submit_customer_change_request(
  p_request_id uuid,
  p_reason text,
  p_effective_date date,
  p_requirements jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_change_request customer_change_requests;
  v_revision submission_revisions;
  v_requirement jsonb;
  v_customer customers;
  v_next record;
  v_new_status text;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_change_request.status not in ('draft', 'sent_back') then
    raise exception 'CUSTOMER_CHANGE_NOT_SUBMITTABLE: request % has status %, only draft or sent_back may be submitted', p_request_id, v_change_request.status;
  end if;

  select * into v_revision
  from submission_revisions
  where request_id = p_request_id and status = 'draft'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'CUSTOMER_CHANGE_NO_DRAFT_REVISION: request % has no draft revision to submit', p_request_id;
  end if;

  perform submit_revision(
    v_revision.id, v_revision.row_version,
    jsonb_build_object('values', v_revision.raw_data, 'applicability', '{}'::jsonb),
    p_actor_user_id, null, p_actor_context
  );

  delete from customer_change_request_requirements where customer_change_request_id = p_request_id;

  for v_requirement in select * from jsonb_array_elements(p_requirements)
  loop
    insert into customer_change_request_requirements (customer_change_request_id, kind, role_code, scope_label, evidence_type, reason, matched_rule_keys)
    values (
      p_request_id,
      v_requirement ->> 'kind',
      v_requirement ->> 'role_code',
      v_requirement ->> 'scope_label',
      v_requirement ->> 'evidence_type',
      v_requirement ->> 'reason',
      coalesce((select array_agg(value #>> '{}') from jsonb_array_elements(v_requirement -> 'matched_rule_keys')), '{}')
    );
  end loop;

  select * into v_customer from customers where id = v_change_request.customer_id;

  select * into v_next
  from fn_resolve_workflow_next_approval(
    v_change_request.workflow_version_id,
    null,
    jsonb_build_object('segment', coalesce(v_revision.raw_data ->> 'segment', v_customer.segment))
  );

  if v_change_request.workflow_version_id is not null and v_next.node_type is null then
    raise exception 'WORKFLOW_GRAPH_DEAD_END: this request''s workflow could not resolve to any reachable Approval or End node; ask a Workflow Admin to fix the graph';
  end if;

  v_new_status := case when v_change_request.status = 'sent_back' then 'resubmitted' else 'submitted' end;

  update customer_change_requests
  set status = v_new_status,
      reason = p_reason,
      effective_date = p_effective_date,
      current_workflow_node_key = v_next.node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  if v_change_request.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('customer_change', p_request_id, v_change_request.workflow_version_id, v_change_request.workflow_cycle_number, null, v_next.node_key, 'submit', p_actor_user_id, null);
  end if;

  return v_change_request;
end;
$function$;

create or replace function submit_commercial_configuration_version(
  p_request_id uuid,
  p_reason text,
  p_effective_date date,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
as $function$
declare
  v_version commercial_configuration_versions;
  v_revision submission_revisions;
  v_segment text;
  v_next record;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from commercial_configuration_versions where request_id = p_request_id for update;
  if not found then
    raise exception 'COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for request %', p_request_id;
  end if;

  if v_version.status <> 'draft' then
    raise exception 'COMMERCIAL_VERSION_NOT_SUBMITTABLE: version % has status %, only draft may be submitted', p_request_id, v_version.status;
  end if;

  select * into v_revision
  from submission_revisions
  where request_id = p_request_id and status = 'draft'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'COMMERCIAL_VERSION_NO_DRAFT_REVISION: request % has no draft revision to submit', p_request_id;
  end if;

  perform submit_revision(
    v_revision.id, v_revision.row_version,
    jsonb_build_object('values', v_revision.raw_data, 'applicability', '{}'::jsonb),
    p_actor_user_id, null, p_actor_context
  );

  select c.segment into v_segment
  from commercial_configurations cc
  join customers c on c.id = cc.customer_id
  where cc.id = v_version.commercial_configuration_id;

  select * into v_next
  from fn_resolve_workflow_next_approval(v_version.workflow_version_id, null, jsonb_build_object('segment', v_segment));

  if v_version.workflow_version_id is not null and v_next.node_type is null then
    raise exception 'WORKFLOW_GRAPH_DEAD_END: this version''s workflow could not resolve to any reachable Approval or End node; ask a Workflow Admin to fix the graph';
  end if;

  update commercial_configuration_versions
  set status = 'submitted', reason = p_reason, effective_date = p_effective_date,
      current_workflow_node_key = v_next.node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  if v_version.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('commercial_configuration', p_request_id, v_version.workflow_version_id, v_version.workflow_cycle_number, null, v_next.node_key, 'submit', p_actor_user_id, null);
  end if;

  return v_version;
end;
$function$;

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

  v_next_status := case when v_row.status = 'sent_back' then 'resubmitted' else 'submitted' end;

  select * into v_next from fn_resolve_workflow_next_approval(v_row.workflow_version_id, null, '{}'::jsonb);

  if v_row.workflow_version_id is not null and v_next.node_type is null then
    raise exception 'WORKFLOW_GRAPH_DEAD_END: this request''s workflow could not resolve to any reachable Approval or End node; ask a Workflow Admin to fix the graph';
  end if;

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
