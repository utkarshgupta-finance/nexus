-- Nexus: Workflow Runtime V1, Sequential Approval Execution.
--
-- 20260921000000_workflow_runtime_v1.sql made a published graph's team
-- routing real, but only for the FIRST Approval node ever reached:
-- fn_resolve_workflow_responsible_team always walks Start -> ... -> the
-- first Approval node and stops there, and every approve_* RPC calls it
-- exactly once per approval, from Start, every time. A graph like
-- Start -> Finance Approval -> Legal Approval -> Leadership Approval ->
-- End is fully buildable and publishable in the Builder today, but at
-- runtime a single Finance approval immediately finalizes the
-- underlying business transition; Legal and Leadership are never
-- consulted. Confirmed live in Phase 3B adversarial testing.
--
-- This migration makes Workflow Runtime V1 actually execute a graph
-- sequentially: each governed request now carries a durable
-- current_workflow_node_key (which Approval node it is sitting at right
-- now) and a workflow_cycle_number (which approval attempt this is,
-- incremented on Send Back), a shared fn_resolve_workflow_next_approval
-- function that can resume the same bounded graph walk from any node
-- (not only from Start), and a shared workflow_node_transitions audit
-- table recording every submit/approve/send_back/reject transition.
--
-- Deliberately NOT a general BPM engine: still the same bounded,
-- deterministic Start -> [Decision branches] -> Approval walk as
-- before, just resumable instead of always restarting from Start, and
-- the same fixed, Nexus-owned required-permission boundary from the
-- prior migration is untouched (only team routing and node position are
-- graph-controlled).
--
-- Send Back rule (Workflow Runtime V1 default, chosen because no
-- existing Nexus rule already defines this): sending a request back
-- clears its current node and returns it to the Maker; prior approvals
-- remain historically visible in workflow_node_transitions, but are not
-- authoritative any more, because the underlying proposed business
-- truth may have changed since they were given. On resubmit, execution
-- restarts from the first Approval node, exactly like an initial
-- submission. Reject is terminal at whichever node it happens; no
-- partial business truth is ever applied.

-- =============================================================================
-- 1. Durable execution position on all four governed domain tables
-- =============================================================================

alter table customer_change_requests
  add column current_workflow_node_key text,
  add column workflow_cycle_number integer not null default 1;

alter table customer_onboarding_cases
  add column current_workflow_node_key text,
  add column workflow_cycle_number integer not null default 1;

alter table commercial_configuration_versions
  add column current_workflow_node_key text,
  add column workflow_cycle_number integer not null default 1;

alter table go_live_requests
  add column current_workflow_node_key text,
  add column workflow_cycle_number integer not null default 1;

comment on column customer_change_requests.current_workflow_node_key is
  'The Approval node this request is currently sitting at (null if no workflow is bound, no Approval node exists in the graph, or the request is between Send Back and resubmit). Terminal state is read from status, not from this column: an approved request''s current_workflow_node_key is the End node it finalized at; a rejected request''s is the Approval node it was rejected at.';
comment on column customer_change_requests.workflow_cycle_number is
  'Which approval attempt this is. Starts at 1, incremented every time this request is sent back: prior transitions stay in workflow_node_transitions tagged with the cycle_number they happened under, so a full send-back history remains reconstructible even though execution restarts from the first Approval node each new cycle.';

comment on column customer_onboarding_cases.current_workflow_node_key is 'See customer_change_requests.current_workflow_node_key for the full contract; identical semantics.';
comment on column customer_onboarding_cases.workflow_cycle_number is 'See customer_change_requests.workflow_cycle_number for the full contract; identical semantics.';
comment on column commercial_configuration_versions.current_workflow_node_key is 'See customer_change_requests.current_workflow_node_key for the full contract. This domain has no Send Back today, so workflow_cycle_number never advances past 1.';
comment on column commercial_configuration_versions.workflow_cycle_number is 'See customer_change_requests.workflow_cycle_number for the full contract. This domain has no Send Back today, so this never advances past 1.';
comment on column go_live_requests.current_workflow_node_key is 'See customer_change_requests.current_workflow_node_key for the full contract; identical semantics.';
comment on column go_live_requests.workflow_cycle_number is 'See customer_change_requests.workflow_cycle_number for the full contract; identical semantics.';

-- =============================================================================
-- 2. workflow_node_transitions: the one shared per-node audit trail
-- =============================================================================

/**
 * Every submit/approve/send_back/reject transition, for all four
 * governed domains, in one shared, append-only table (never a fourth
 * copy of the same bespoke history table each domain otherwise
 * maintains for send-backs alone). Not tied to the generic `resources`
 * registry: `domain` + `resource_id` name the owning row directly
 * (request_id for the three requests-backed domains, id for
 * go_live_requests, which is not routed through `requests` at all),
 * exactly the same discriminated-union shape Workflow Builder already
 * uses for `applies_to`.
 */
create table workflow_node_transitions (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('customer_onboarding', 'customer_change', 'commercial_configuration', 'go_live')),
  resource_id uuid not null,
  workflow_version_id uuid not null references workflow_definition_versions (id) on delete restrict,
  cycle_number integer not null default 1,
  from_node_key text,
  to_node_key text,
  action text not null check (action in ('submit', 'approve', 'send_back', 'reject')),
  actor_user_id uuid not null references app_users (id) on delete restrict,
  comment text,
  occurred_at timestamptz not null default now()
);

comment on table workflow_node_transitions is
  'Append-only audit of every node transition across all four Workflow Runtime V1 domains. from_node_key/to_node_key are raw node keys (internal identifiers); resolve to human node/team names by joining workflow_nodes on (workflow_version_id, node_key) for display. Never updated or deleted.';

alter table workflow_node_transitions enable row level security;

create index idx_workflow_node_transitions_resource on workflow_node_transitions (domain, resource_id, occurred_at);

grant select, insert on workflow_node_transitions to service_role;
revoke all on workflow_node_transitions from anon, authenticated;

-- =============================================================================
-- 3. fn_resolve_workflow_next_approval: the resumable graph walk
-- =============================================================================

/**
 * Generalizes fn_resolve_workflow_responsible_team (kept, unused by any
 * approve_* RPC as of this migration, left in place rather than dropped
 * since nothing about it is wrong, only superseded) to resume the same
 * bounded Start -> [Decision branches] -> Approval walk from an
 * arbitrary node instead of always restarting at Start.
 *
 * p_from_node_key null means "resolve the first Approval node reached
 * from Start" (used at submit/resubmit time). A non-null value means
 * "this node was just completed (an Approval node the caller already
 * has an authoritative decision for); resolve the NEXT Approval node
 * reached by walking forward past it" (used at approve time). Either
 * way, returns at most one row: the next Approval node reached
 * (node_type = 'approval', team_id populated or null for "no team
 * restriction"), or the End node reached (node_type = 'end', team_id
 * always null), or zero rows if no workflow is bound, the graph has no
 * Start node, p_from_node_key names a node with no outgoing edge, or the
 * 10-hop bound is exceeded (a validation gap, never a valid published
 * graph; publish-time validation is the real cycle/dead-end guard).
 *
 * Same bounded 10-hop walk, same Decision branch resolution
 * (equals/not_equals against p_context, first matching edge by
 * to_node_key, else the single unconditioned fallback edge, else
 * WORKFLOW_DECISION_NO_MATCH) as fn_resolve_workflow_responsible_team;
 * this is the same algorithm, generalized, not a different one.
 */
create function fn_resolve_workflow_next_approval(
  p_workflow_version_id uuid,
  p_from_node_key text,
  p_context jsonb default '{}'::jsonb
)
returns table(node_key text, node_type text, team_id uuid)
language plpgsql
security invoker
as $function$
declare
  v_current_key text;
  v_node_type text;
  v_team_id uuid;
  v_hops integer := 0;
  v_edge record;
  v_chosen_key text;
  v_fallback_key text;
  v_field text;
  v_operator text;
  v_value text;
  v_actual text;
begin
  if p_workflow_version_id is null then
    return;
  end if;

  if p_from_node_key is null then
    select wn.node_key into v_current_key
    from workflow_nodes wn
    where wn.workflow_version_id = p_workflow_version_id and wn.node_type = 'start'
    limit 1;

    if v_current_key is null then
      return;
    end if;
  else
    -- Step past the node the caller already completed, via its single
    -- outgoing edge (publish-time validation as of this migration
    -- requires exactly one for start/form_step/approval nodes), before
    -- entering the generic walk below.
    select we.to_node_key into v_current_key
    from workflow_edges we
    where we.workflow_version_id = p_workflow_version_id and we.from_node_key = p_from_node_key
    order by we.to_node_key
    limit 1;

    if v_current_key is null then
      return;
    end if;
  end if;

  loop
    v_hops := v_hops + 1;
    if v_hops > 10 then
      return;
    end if;

    select wn.node_type, wn.responsible_team_id into v_node_type, v_team_id
    from workflow_nodes wn
    where wn.workflow_version_id = p_workflow_version_id and wn.node_key = v_current_key;

    if v_node_type = 'approval' then
      node_key := v_current_key;
      node_type := v_node_type;
      team_id := v_team_id;
      return next;
      return;
    end if;

    if v_node_type = 'end' then
      node_key := v_current_key;
      node_type := 'end';
      team_id := null;
      return next;
      return;
    end if;

    if v_node_type is null then
      return;
    end if;

    if v_node_type = 'decision' then
      v_chosen_key := null;
      v_fallback_key := null;

      for v_edge in
        select we.to_node_key, we.condition
        from workflow_edges we
        where we.workflow_version_id = p_workflow_version_id and we.from_node_key = v_current_key
        order by we.to_node_key
      loop
        if v_edge.condition is null then
          if v_fallback_key is null then
            v_fallback_key := v_edge.to_node_key;
          end if;
          continue;
        end if;

        v_field := v_edge.condition ->> 'field';
        v_operator := v_edge.condition ->> 'operator';
        v_value := v_edge.condition ->> 'value';
        v_actual := p_context ->> v_field;

        if v_operator = 'equals' and v_actual = v_value then
          v_chosen_key := v_edge.to_node_key;
          exit;
        elsif v_operator = 'not_equals' and v_actual is distinct from v_value then
          v_chosen_key := v_edge.to_node_key;
          exit;
        end if;
      end loop;

      if v_chosen_key is null then
        v_chosen_key := v_fallback_key;
      end if;

      if v_chosen_key is null then
        raise exception 'WORKFLOW_DECISION_NO_MATCH: this request did not match any branch of its workflow''s Decision step, and the Decision step has no default (unconditioned) branch. Ask a Workflow Admin to add a default branch.';
      end if;

      v_current_key := v_chosen_key;
    else
      -- start / form_step: single outgoing edge (decision and approval
      -- are both handled above; end and null already returned).
      select we.to_node_key into v_chosen_key
      from workflow_edges we
      where we.workflow_version_id = p_workflow_version_id and we.from_node_key = v_current_key
      order by we.to_node_key
      limit 1;

      if v_chosen_key is null then
        return;
      end if;

      v_current_key := v_chosen_key;
    end if;
  end loop;
end;
$function$;

comment on function fn_resolve_workflow_next_approval(uuid, text, jsonb) is
  'Resumable Workflow Runtime V1 graph walk: from Start (p_from_node_key null) or forward from a completed node, to the next Approval node or the End node reached. See this migration''s header for the full contract.';

revoke all on function fn_resolve_workflow_next_approval(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function fn_resolve_workflow_next_approval(uuid, text, jsonb) to service_role;

/** Small shared lookup: the responsible_team_id of a specific node, used to authorize an action against the request's CURRENT node rather than recomputing from Start. Returns null (no restriction) if p_node_key is null (no workflow-tracked position: pre-Runtime-V1 graceful-degradation flat mode) or the node names no team. */
create function fn_workflow_node_team(p_workflow_version_id uuid, p_node_key text)
returns uuid
language sql
security invoker
stable
as $function$
  select responsible_team_id
  from workflow_nodes
  where workflow_version_id = p_workflow_version_id and node_key = p_node_key;
$function$;

comment on function fn_workflow_node_team(uuid, text) is
  'The responsible_team_id of workflow_nodes(workflow_version_id, node_key), or null if p_node_key is null or names no team. Used to authorize approve/send_back/reject against a request''s CURRENT node.';

revoke all on function fn_workflow_node_team(uuid, text) from public, anon, authenticated;
grant execute on function fn_workflow_node_team(uuid, text) to service_role;

-- =============================================================================
-- 4. Publish-time validation: exactly one outgoing edge for non-branching nodes
-- =============================================================================

/**
 * Prior validation only required "at least one outgoing transition" for
 * a non-end, non-start node. That was enough for a display-only,
 * stops-at-first-Approval walk, but a resumable engine that steps PAST
 * an Approval node via "the" outgoing edge needs that edge to be
 * unambiguous: two outgoing edges from a start/form_step/approval node
 * previously fell back to an arbitrary alphabetical-by-to_node_key
 * tie-break, which would silently pick a different path in an execution
 * engine than a human reading the same graph would expect. Decision
 * nodes are unaffected (they still require >= 2 branches, resolved by
 * condition, not by edge count).
 */
create or replace function publish_workflow_definition_version(
  p_version_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns workflow_definition_versions
language plpgsql
security invoker
as $function$
declare
  v_version workflow_definition_versions;
  v_start_count integer;
  v_end_count integer;
  v_decision_node record;
  v_branch_count integer;
  v_fallback_count integer;
  v_bad_condition_count integer;
  v_single_edge_node record;
  v_outgoing_count integer;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from workflow_definition_versions where id = p_version_id for update;
  if not found then
    raise exception 'WORKFLOW_VERSION_NOT_FOUND: no workflow_definition_versions row for id %', p_version_id;
  end if;

  if v_version.status <> 'draft' then
    raise exception 'WORKFLOW_VERSION_NOT_DRAFT: version % has status %, only a draft may be published', p_version_id, v_version.status;
  end if;

  select count(*) into v_start_count from workflow_nodes where workflow_version_id = p_version_id and node_type = 'start';
  select count(*) into v_end_count from workflow_nodes where workflow_version_id = p_version_id and node_type = 'end';

  if v_start_count <> 1 then
    raise exception 'WORKFLOW_INVALID_GRAPH: version % must have exactly one start node, found %', p_version_id, v_start_count;
  end if;
  if v_end_count < 1 then
    raise exception 'WORKFLOW_INVALID_GRAPH: version % must have at least one end node', p_version_id;
  end if;

  for v_single_edge_node in
    select node_key, name from workflow_nodes where workflow_version_id = p_version_id and node_type in ('start', 'form_step', 'approval')
  loop
    select count(*) into v_outgoing_count from workflow_edges where workflow_version_id = p_version_id and from_node_key = v_single_edge_node.node_key;
    if v_outgoing_count = 0 then
      raise exception 'WORKFLOW_INVALID_GRAPH: Node "%" is a dead end: it has no outgoing transition and is not an End node.', v_single_edge_node.name;
    end if;
    if v_outgoing_count > 1 then
      raise exception 'WORKFLOW_INVALID_GRAPH: Node "%" has % outgoing transitions; only a Decision node may branch. Remove the extra transition.', v_single_edge_node.name, v_outgoing_count;
    end if;
  end loop;

  for v_decision_node in select node_key from workflow_nodes where workflow_version_id = p_version_id and node_type = 'decision'
  loop
    select count(*) into v_branch_count from workflow_edges where workflow_version_id = p_version_id and from_node_key = v_decision_node.node_key;
    if v_branch_count < 2 then
      raise exception 'WORKFLOW_INVALID_GRAPH: Decision node "%" must have at least two outgoing branches to be a real decision', v_decision_node.node_key;
    end if;

    select count(*) into v_fallback_count from workflow_edges where workflow_version_id = p_version_id and from_node_key = v_decision_node.node_key and condition is null;
    if v_fallback_count > 1 then
      raise exception 'WORKFLOW_INVALID_GRAPH: Decision node "%" has more than one default (unconditioned) branch; routing would be ambiguous', v_decision_node.node_key;
    end if;

    select count(*) into v_bad_condition_count
    from workflow_edges
    where workflow_version_id = p_version_id
      and from_node_key = v_decision_node.node_key
      and condition is not null
      and (
        (condition ->> 'operator') not in ('equals', 'not_equals')
        or coalesce(condition ->> 'field', '') = ''
      );
    if v_bad_condition_count > 0 then
      raise exception 'WORKFLOW_INVALID_GRAPH: Decision node "%" has a branch condition with an unsupported operator or empty field; only equals/not_equals with a non-empty field are supported in Workflow Runtime V1', v_decision_node.node_key;
    end if;
  end loop;

  update workflow_definition_versions
  set status = 'published', published_at = now(), published_by = p_actor_user_id, updated_by = p_actor_user_id, updated_at = now()
  where id = p_version_id
  returning * into v_version;

  return v_version;
end;
$function$;

-- =============================================================================
-- 5. Customer Change: submit / approve / send_back / reject
-- =============================================================================

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

  -- Workflow Runtime V1: resolve and stamp the first Approval node this
  -- (re)submission enters, using the same segment fact the rest of this
  -- domain treats as authoritative (the proposed value if this change
  -- touches segment, else the customer's current segment).
  select * into v_next
  from fn_resolve_workflow_next_approval(
    v_change_request.workflow_version_id,
    null,
    jsonb_build_object('segment', coalesce(v_revision.raw_data ->> 'segment', v_customer.segment))
  );

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

create or replace function approve_customer_change_request(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_expected_current_node_key text default null
)
returns customer_change_requests
language plpgsql
security invoker
as $function$
declare
  v_change_request customer_change_requests;
  v_customer customers;
  v_latest_revision submission_revisions;
  v_proposed jsonb;
  v_field text;
  v_old_value text;
  v_new_value text;
  v_current_team_id uuid;
  v_next record;
  v_should_finalize boolean;
  v_new_current_node_key text;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_change_request.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_change_request.status = 'approved' then
    return v_change_request;
  end if;

  if v_change_request.status not in ('submitted', 'resubmitted') then
    raise exception 'CUSTOMER_CHANGE_NOT_APPROVABLE: request % has status %, only submitted or resubmitted may be approved', p_request_id, v_change_request.status;
  end if;

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_change_request.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  select * into v_customer from customers where id = v_change_request.customer_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_CUSTOMER_NOT_FOUND: no customers row for id %', v_change_request.customer_id;
  end if;

  if v_customer.row_version <> v_change_request.base_customer_row_version then
    raise exception 'CUSTOMER_CHANGE_STALE_BASE: customers row % changed (row_version % vs expected %) since this Change Request was created; rebase before approving',
      v_customer.id, v_customer.row_version, v_change_request.base_customer_row_version;
  end if;

  select * into v_latest_revision
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'CUSTOMER_CHANGE_NO_SUBMITTED_REVISION: request % has no submitted revision to approve', p_request_id;
  end if;

  -- Authorize against the node this request is CURRENTLY sitting at, not
  -- always the first Approval node: Finance is not automatically
  -- entitled to decide a Legal or Leadership step.
  v_current_team_id := fn_workflow_node_team(v_change_request.workflow_version_id, v_change_request.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select * into v_next
  from fn_resolve_workflow_next_approval(
    v_change_request.workflow_version_id,
    v_change_request.current_workflow_node_key,
    jsonb_build_object('segment', coalesce(v_latest_revision.effective_data -> 'values' ->> 'segment', v_customer.segment))
  );

  if v_next.node_type is null then
    if v_change_request.current_workflow_node_key is null then
      v_should_finalize := true;
      v_new_current_node_key := null;
    else
      raise exception 'WORKFLOW_GRAPH_DEAD_END: this request''s workflow has no reachable Approval or End node after node "%"; ask a Workflow Admin to fix the graph', v_change_request.current_workflow_node_key;
    end if;
  elsif v_next.node_type = 'approval' then
    v_should_finalize := false;
    v_new_current_node_key := v_next.node_key;
  else
    v_should_finalize := true;
    v_new_current_node_key := v_next.node_key;
  end if;

  if v_change_request.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('customer_change', p_request_id, v_change_request.workflow_version_id, v_change_request.workflow_cycle_number, v_change_request.current_workflow_node_key, v_new_current_node_key, 'approve', p_actor_user_id, null);
  end if;

  if not v_should_finalize then
    update customer_change_requests
    set current_workflow_node_key = v_new_current_node_key,
        updated_by = p_actor_user_id, updated_at = now()
    where request_id = p_request_id
    returning * into v_change_request;

    return v_change_request;
  end if;

  -- Final approval (this request reached the End node): apply the full
  -- governed business mutation exactly once, then finalize.
  v_proposed := v_latest_revision.effective_data -> 'values';

  for v_field in select unnest(array[
    'name', 'brand_name', 'segment', 'business_unit', 'country', 'industry',
    'address', 'state', 'city', 'postal_code', 'website',
    'primary_contact_name', 'primary_contact_email', 'primary_contact_phone_country_code',
    'primary_contact_phone_number', 'primary_contact_designation',
    'gst_number', 'pan', 'tan', 'tax_identifier_type', 'tax_identifier_name', 'tax_registration_number',
    'company_document_type', 'company_document_type_other', 'billing_currency'
  ])
  loop
    continue when not (v_proposed ? v_field);

    v_new_value := v_proposed ->> v_field;
    v_old_value := case v_field
      when 'name' then v_customer.name
      when 'brand_name' then v_customer.brand_name
      when 'segment' then v_customer.segment
      when 'business_unit' then v_customer.business_unit
      when 'country' then v_customer.country
      when 'industry' then v_customer.industry
      when 'address' then v_customer.address
      when 'state' then v_customer.state
      when 'city' then v_customer.city
      when 'postal_code' then v_customer.postal_code
      when 'website' then v_customer.website
      when 'primary_contact_name' then v_customer.primary_contact_name
      when 'primary_contact_email' then v_customer.primary_contact_email
      when 'primary_contact_phone_country_code' then v_customer.primary_contact_phone_country_code
      when 'primary_contact_phone_number' then v_customer.primary_contact_phone_number
      when 'primary_contact_designation' then v_customer.primary_contact_designation
      when 'gst_number' then v_customer.gst_number
      when 'pan' then v_customer.pan
      when 'tan' then v_customer.tan
      when 'tax_identifier_type' then v_customer.tax_identifier_type
      when 'tax_identifier_name' then v_customer.tax_identifier_name
      when 'tax_registration_number' then v_customer.tax_registration_number
      when 'company_document_type' then v_customer.company_document_type
      when 'company_document_type_other' then v_customer.company_document_type_other
      when 'billing_currency' then v_customer.billing_currency
    end;

    continue when v_old_value is not distinct from v_new_value;

    insert into customer_field_history (customer_id, field_key, old_value, new_value, effective_date, customer_change_request_id, requested_by, approved_by)
    values (v_customer.id, v_field, v_old_value, v_new_value, v_change_request.effective_date, p_request_id, v_change_request.created_by, p_actor_user_id);

    if v_field = 'name' then
      update customers set name = v_new_value where id = v_customer.id;
    elsif v_field = 'brand_name' then
      update customers set brand_name = v_new_value where id = v_customer.id;
    elsif v_field = 'segment' then
      update customers set segment = v_new_value where id = v_customer.id;
    elsif v_field = 'business_unit' then
      update customers set business_unit = v_new_value where id = v_customer.id;
    elsif v_field = 'country' then
      update customers set country = v_new_value where id = v_customer.id;
    elsif v_field = 'industry' then
      update customers set industry = v_new_value where id = v_customer.id;
    elsif v_field = 'address' then
      update customers set address = v_new_value where id = v_customer.id;
    elsif v_field = 'state' then
      update customers set state = v_new_value where id = v_customer.id;
    elsif v_field = 'city' then
      update customers set city = v_new_value where id = v_customer.id;
    elsif v_field = 'postal_code' then
      update customers set postal_code = v_new_value where id = v_customer.id;
    elsif v_field = 'website' then
      update customers set website = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_name' then
      update customers set primary_contact_name = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_email' then
      update customers set primary_contact_email = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_phone_country_code' then
      update customers set primary_contact_phone_country_code = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_phone_number' then
      update customers set primary_contact_phone_number = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_designation' then
      update customers set primary_contact_designation = v_new_value where id = v_customer.id;
    elsif v_field = 'gst_number' then
      update customers set gst_number = v_new_value where id = v_customer.id;
    elsif v_field = 'pan' then
      update customers set pan = v_new_value where id = v_customer.id;
    elsif v_field = 'tan' then
      update customers set tan = v_new_value where id = v_customer.id;
    elsif v_field = 'tax_identifier_type' then
      update customers set tax_identifier_type = v_new_value where id = v_customer.id;
    elsif v_field = 'tax_identifier_name' then
      update customers set tax_identifier_name = v_new_value where id = v_customer.id;
    elsif v_field = 'tax_registration_number' then
      update customers set tax_registration_number = v_new_value where id = v_customer.id;
    elsif v_field = 'company_document_type' then
      update customers set company_document_type = v_new_value where id = v_customer.id;
    elsif v_field = 'company_document_type_other' then
      update customers set company_document_type_other = v_new_value where id = v_customer.id;
    elsif v_field = 'billing_currency' then
      update customers set billing_currency = v_new_value where id = v_customer.id;
    end if;
  end loop;

  update customers set row_version = row_version + 1, updated_by = p_actor_user_id, updated_at = now() where id = v_customer.id;

  update customer_change_requests
  set status = 'approved',
      decided_by = p_actor_user_id,
      decided_at = now(),
      current_workflow_node_key = v_new_current_node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

create or replace function send_back_customer_change_request(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_change_request customer_change_requests;
  v_latest_submitted submission_revisions;
  v_current_team_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'CUSTOMER_CHANGE_SEND_BACK_REASON_REQUIRED: a reason is required to send this request back';
  end if;

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_change_request.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot send back your own request. Another authorized checker must review it.';
  end if;

  if v_change_request.status not in ('submitted', 'resubmitted') then
    raise exception 'CUSTOMER_CHANGE_NOT_SENDBACKABLE: request % has status %, only submitted or resubmitted may be sent back', p_request_id, v_change_request.status;
  end if;

  v_current_team_id := fn_workflow_node_team(v_change_request.workflow_version_id, v_change_request.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select * into v_latest_submitted from submission_revisions
    where request_id = p_request_id and status = 'submitted' order by revision_number desc limit 1;

  perform create_next_revision(p_request_id, v_latest_submitted.id, p_actor_user_id, null, p_actor_context);

  if v_change_request.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('customer_change', p_request_id, v_change_request.workflow_version_id, v_change_request.workflow_cycle_number, v_change_request.current_workflow_node_key, null, 'send_back', p_actor_user_id, p_reason);
  end if;

  update customer_change_requests
  set status = 'sent_back', sent_back_reason = p_reason, sent_back_by = p_actor_user_id, sent_back_at = now(),
      current_workflow_node_key = null, workflow_cycle_number = workflow_cycle_number + 1,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  insert into customer_change_send_backs (request_id, revision_number, reason, sent_back_by)
  values (p_request_id, v_latest_submitted.revision_number, p_reason, p_actor_user_id);

  return v_change_request;
end;
$function$;

create or replace function reject_customer_change_request(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_change_request customer_change_requests;
  v_current_team_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'CUSTOMER_CHANGE_REJECT_REASON_REQUIRED: a reason is required to reject this request';
  end if;

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_change_request.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot reject your own request. Another authorized checker must review it.';
  end if;

  if v_change_request.status = 'rejected' then
    return v_change_request;
  end if;

  if v_change_request.status not in ('submitted', 'resubmitted') then
    raise exception 'CUSTOMER_CHANGE_NOT_REJECTABLE: request % has status %, only submitted or resubmitted may be rejected', p_request_id, v_change_request.status;
  end if;

  v_current_team_id := fn_workflow_node_team(v_change_request.workflow_version_id, v_change_request.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  if v_change_request.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('customer_change', p_request_id, v_change_request.workflow_version_id, v_change_request.workflow_cycle_number, v_change_request.current_workflow_node_key, null, 'reject', p_actor_user_id, p_reason);
  end if;

  update customer_change_requests
  set status = 'rejected', decided_by = p_actor_user_id, decided_at = now(), decision_reason = p_reason,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

-- =============================================================================
-- 6. Customer Onboarding: submit / approve / send_back (no reject in this domain)
-- =============================================================================

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

  -- Snapshot exactly which document backed each attachment type at the
  -- moment of this submission, so a later replacement never erases the
  -- historical record of what evidence this specific revision had.
  insert into customer_onboarding_revision_documents (request_id, revision_number, document_type, document_id)
  select request_id, v_revision.revision_number, document_type, document_id
  from customer_onboarding_documents
  where request_id = p_request_id and is_current = true
  on conflict (request_id, revision_number, document_type) do nothing;

  -- Workflow Runtime V1: the customer this case will create does not
  -- exist yet, so segment context comes from the submitted values
  -- themselves, not from a customers row.
  select * into v_next
  from fn_resolve_workflow_next_approval(v_case.workflow_version_id, null, jsonb_build_object('segment', v_revision.raw_data ->> 'segment'));

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

create or replace function approve_customer_onboarding_case(
  p_request_id uuid,
  p_customer_key text,
  p_customer_name text,
  p_commercial_configuration_key text,
  p_commercial_configuration_name text,
  p_components jsonb,
  p_effective_date date,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_customer_fields jsonb default '{}'::jsonb,
  p_expected_current_node_key text default null
)
returns customer_onboarding_cases
language plpgsql
security invoker
as $function$
declare
  v_case customer_onboarding_cases;
  v_latest_revision submission_revisions;
  v_customer_id uuid;
  v_system_request_id uuid;
  v_commercial_configuration_id uuid;
  v_commercial_change_id uuid;
  v_component jsonb;
  v_new_component_id uuid;
  v_mug_threshold numeric;
  v_current_team_id uuid;
  v_next record;
  v_should_finalize boolean;
  v_new_current_node_key text;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_case.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_case.status = 'approved' then
    return v_case;
  end if;

  if v_case.status not in ('submitted', 'resubmitted') then
    raise exception 'ONBOARDING_CASE_NOT_APPROVABLE: case % has status %, only submitted or resubmitted may be approved', p_request_id, v_case.status;
  end if;

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_case.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  select * into v_latest_revision
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'ONBOARDING_NO_SUBMITTED_REVISION: case % has no submitted revision to approve', p_request_id;
  end if;

  v_current_team_id := fn_workflow_node_team(v_case.workflow_version_id, v_case.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select * into v_next
  from fn_resolve_workflow_next_approval(v_case.workflow_version_id, v_case.current_workflow_node_key, jsonb_build_object('segment', p_customer_fields ->> 'segment'));

  if v_next.node_type is null then
    if v_case.current_workflow_node_key is null then
      v_should_finalize := true;
      v_new_current_node_key := null;
    else
      raise exception 'WORKFLOW_GRAPH_DEAD_END: this case''s workflow has no reachable Approval or End node after node "%"; ask a Workflow Admin to fix the graph', v_case.current_workflow_node_key;
    end if;
  elsif v_next.node_type = 'approval' then
    v_should_finalize := false;
    v_new_current_node_key := v_next.node_key;
  else
    v_should_finalize := true;
    v_new_current_node_key := v_next.node_key;
  end if;

  if v_case.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('customer_onboarding', p_request_id, v_case.workflow_version_id, v_case.workflow_cycle_number, v_case.current_workflow_node_key, v_new_current_node_key, 'approve', p_actor_user_id, null);
  end if;

  if not v_should_finalize then
    update customer_onboarding_cases
    set current_workflow_node_key = v_new_current_node_key,
        updated_by = p_actor_user_id, updated_at = now()
    where request_id = p_request_id
    returning * into v_case;

    return v_case;
  end if;

  insert into customers (
    key, name, brand_name, created_by, updated_by,
    address, state, city, postal_code, website,
    primary_contact_name, primary_contact_email, primary_contact_phone_country_code,
    primary_contact_phone_number, primary_contact_designation,
    gst_number, pan, tan, tax_identifier_type, tax_identifier_name, tax_registration_number,
    company_document_type, company_document_type_other, billing_currency
  )
  values (
    p_customer_key, p_customer_name, p_customer_fields ->> 'brand_name', p_actor_user_id, p_actor_user_id,
    p_customer_fields ->> 'address', p_customer_fields ->> 'state', p_customer_fields ->> 'city',
    p_customer_fields ->> 'postal_code', p_customer_fields ->> 'website',
    p_customer_fields ->> 'primary_contact_name', p_customer_fields ->> 'primary_contact_email',
    p_customer_fields ->> 'primary_contact_phone_country_code', p_customer_fields ->> 'primary_contact_phone_number',
    p_customer_fields ->> 'primary_contact_designation',
    p_customer_fields ->> 'gst_number', p_customer_fields ->> 'pan', p_customer_fields ->> 'tan',
    p_customer_fields ->> 'tax_identifier_type', p_customer_fields ->> 'tax_identifier_name', p_customer_fields ->> 'tax_registration_number',
    p_customer_fields ->> 'company_document_type', p_customer_fields ->> 'company_document_type_other',
    p_customer_fields ->> 'billing_currency'
  )
  returning id into v_customer_id;

  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  v_commercial_configuration_id := gen_random_uuid();
  v_commercial_change_id := v_system_request_id;
  perform create_commercial_configuration_with_change(
    v_commercial_configuration_id, v_system_request_id, v_customer_id,
    p_commercial_configuration_key, p_commercial_configuration_name, p_effective_date,
    p_actor_user_id, null, null, null, p_actor_context
  );

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    v_new_component_id := gen_random_uuid();
    perform add_commercial_component(
      v_new_component_id,
      v_commercial_configuration_id,
      v_commercial_change_id,
      (v_component ->> 'is_recurring')::boolean,
      v_component ->> 'pricing_rule_kind',
      v_component -> 'pricing_rule_parameters',
      v_component ->> 'billing_cadence',
      v_component ->> 'billing_timing',
      v_component ->> 'reconciliation_cadence',
      v_component ->> 'transaction_currency',
      nullif(v_component ->> 'fx_snapshot_rate', '')::numeric,
      (v_component ->> 'effective_from')::date,
      p_actor_user_id,
      v_component ->> 'billing_quantity_basis',
      null,
      null,
      p_actor_context,
      null
    );

    v_mug_threshold := nullif(v_component ->> 'mug_threshold_value', '')::numeric;
    if v_mug_threshold is not null then
      perform add_commercial_commitment(
        gen_random_uuid(), v_commercial_change_id, v_new_component_id,
        v_mug_threshold, (v_component ->> 'effective_from')::date, p_actor_user_id, p_actor_context
      );
    end if;
  end loop;

  update customer_onboarding_cases
  set status = 'approved',
      approved_by = p_actor_user_id,
      approved_at = now(),
      customer_id = v_customer_id,
      commercial_configuration_id = v_commercial_configuration_id,
      current_workflow_node_key = v_new_current_node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;

create or replace function send_back_customer_onboarding_case(
  p_request_id uuid,
  p_reason text,
  p_target_stage_key text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_field_comments jsonb default '[]'::jsonb
)
returns customer_onboarding_cases
language plpgsql
security invoker
as $function$
declare
  v_case customer_onboarding_cases;
  v_next_revision submission_revisions;
  v_latest_submitted submission_revisions;
  v_field_comment jsonb;
  v_current_team_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'ONBOARDING_SEND_BACK_REASON_REQUIRED: a reason is required to send a case back';
  end if;

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_case.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot send back your own request. Another authorized checker must review it.';
  end if;

  if v_case.status not in ('submitted', 'resubmitted') then
    raise exception 'ONBOARDING_CASE_NOT_SENDBACKABLE: case % has status %, only submitted or resubmitted may be sent back', p_request_id, v_case.status;
  end if;

  v_current_team_id := fn_workflow_node_team(v_case.workflow_version_id, v_case.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select * into v_latest_submitted
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  -- Opens the next draft revision immediately (case.ts's own startNextRevision
  -- semantics: editing resumes on revision N+1, the submitted revision that
  -- was actually reviewed is never touched), so the requester can start
  -- editing the moment they see the send-back, with no separate "start next
  -- revision" click required.
  select * into v_next_revision from create_next_revision(p_request_id, v_latest_submitted.id, p_actor_user_id, null, p_actor_context);

  if v_case.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('customer_onboarding', p_request_id, v_case.workflow_version_id, v_case.workflow_cycle_number, v_case.current_workflow_node_key, null, 'send_back', p_actor_user_id, p_reason);
  end if;

  update customer_onboarding_cases
  set status = 'sent_back',
      sent_back_reason = p_reason,
      sent_back_by = p_actor_user_id,
      sent_back_at = now(),
      sent_back_target_stage_key = p_target_stage_key,
      current_workflow_node_key = null,
      workflow_cycle_number = workflow_cycle_number + 1,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  insert into customer_onboarding_send_backs (request_id, revision_number, reason, target_stage_key, sent_back_by)
  values (p_request_id, v_latest_submitted.revision_number, p_reason, p_target_stage_key, p_actor_user_id);

  for v_field_comment in select * from jsonb_array_elements(coalesce(p_field_comments, '[]'::jsonb))
  loop
    if btrim(coalesce(v_field_comment ->> 'comment', '')) = '' then
      continue;
    end if;
    insert into customer_onboarding_field_comments (request_id, revision_number, field_key, comment, reviewer_id)
    values (p_request_id, v_latest_submitted.revision_number, v_field_comment ->> 'field_key', v_field_comment ->> 'comment', p_actor_user_id);
  end loop;

  return v_case;
end;
$function$;

-- =============================================================================
-- 7. Commercial Configuration Version: submit / approve / reject (no send_back in this domain)
-- =============================================================================

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

create or replace function approve_commercial_configuration_version(
  p_request_id uuid,
  p_components jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_expected_current_node_key text default null
)
returns commercial_configuration_versions
language plpgsql
security invoker
as $function$
declare
  v_version commercial_configuration_versions;
  v_system_request_id uuid;
  v_commercial_change commercial_changes;
  v_component jsonb;
  v_new_component_id uuid;
  v_mug_threshold numeric;
  v_stable_key uuid;
  v_current_team_id uuid;
  v_segment text;
  v_next record;
  v_should_finalize boolean;
  v_new_current_node_key text;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from commercial_configuration_versions where request_id = p_request_id for update;
  if not found then
    raise exception 'COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for request %', p_request_id;
  end if;

  if v_version.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_version.status = 'approved' then
    return v_version;
  end if;

  if v_version.status <> 'submitted' then
    raise exception 'COMMERCIAL_VERSION_NOT_APPROVABLE: version % has status %, only submitted may be approved', p_request_id, v_version.status;
  end if;

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_version.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  if exists (
    select 1 from commercial_components
    where commercial_configuration_id = v_version.commercial_configuration_id
      and effective_to is null
      and effective_from >= v_version.effective_date
  ) then
    raise exception 'COMMERCIAL_VERSION_EFFECTIVE_DATE_OUT_OF_ORDER: version % has effective_date % which must be strictly after the currently active period''s own start date', p_request_id, v_version.effective_date;
  end if;

  select c.segment into v_segment
  from commercial_configurations cc
  join customers c on c.id = cc.customer_id
  where cc.id = v_version.commercial_configuration_id;

  v_current_team_id := fn_workflow_node_team(v_version.workflow_version_id, v_version.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select * into v_next
  from fn_resolve_workflow_next_approval(v_version.workflow_version_id, v_version.current_workflow_node_key, jsonb_build_object('segment', v_segment));

  if v_next.node_type is null then
    if v_version.current_workflow_node_key is null then
      v_should_finalize := true;
      v_new_current_node_key := null;
    else
      raise exception 'WORKFLOW_GRAPH_DEAD_END: this version''s workflow has no reachable Approval or End node after node "%"; ask a Workflow Admin to fix the graph', v_version.current_workflow_node_key;
    end if;
  elsif v_next.node_type = 'approval' then
    v_should_finalize := false;
    v_new_current_node_key := v_next.node_key;
  else
    v_should_finalize := true;
    v_new_current_node_key := v_next.node_key;
  end if;

  if v_version.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('commercial_configuration', p_request_id, v_version.workflow_version_id, v_version.workflow_cycle_number, v_version.current_workflow_node_key, v_new_current_node_key, 'approve', p_actor_user_id, null);
  end if;

  if not v_should_finalize then
    update commercial_configuration_versions
    set current_workflow_node_key = v_new_current_node_key,
        updated_by = p_actor_user_id, updated_at = now()
    where request_id = p_request_id
    returning * into v_version;

    return v_version;
  end if;

  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  update commercial_components
  set effective_to = v_version.effective_date - 1, updated_by = p_actor_user_id, updated_at = now()
  where commercial_configuration_id = v_version.commercial_configuration_id and effective_to is null;

  insert into commercial_changes (request_id, commercial_configuration_id, change_category, effective_date, reason, created_by)
  values (v_system_request_id, v_version.commercial_configuration_id, v_version.change_category, v_version.effective_date, v_version.reason, p_actor_user_id)
  returning * into v_commercial_change;

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    v_new_component_id := gen_random_uuid();
    v_stable_key := nullif(v_component ->> 'stable_component_key', '')::uuid;

    perform add_commercial_component(
      v_new_component_id,
      v_version.commercial_configuration_id,
      v_commercial_change.request_id,
      (v_component ->> 'is_recurring')::boolean,
      v_component ->> 'pricing_rule_kind',
      v_component -> 'pricing_rule_parameters',
      v_component ->> 'billing_cadence',
      v_component ->> 'billing_timing',
      v_component ->> 'reconciliation_cadence',
      v_component ->> 'transaction_currency',
      nullif(v_component ->> 'fx_snapshot_rate', '')::numeric,
      (v_component ->> 'effective_from')::date,
      p_actor_user_id,
      v_component ->> 'billing_quantity_basis',
      null,
      null,
      p_actor_context,
      v_stable_key
    );

    v_mug_threshold := nullif(v_component ->> 'mug_threshold_value', '')::numeric;
    if v_mug_threshold is not null then
      perform add_commercial_commitment(
        gen_random_uuid(), v_commercial_change.request_id, v_new_component_id,
        v_mug_threshold, (v_component ->> 'effective_from')::date, p_actor_user_id, p_actor_context
      );
    end if;
  end loop;

  update commercial_configuration_versions
  set status = 'approved', commercial_change_id = v_commercial_change.request_id,
      decided_by = p_actor_user_id, decided_at = now(),
      current_workflow_node_key = v_new_current_node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;

create or replace function reject_commercial_configuration_version(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
security invoker
as $function$
declare
  v_version commercial_configuration_versions;
  v_current_team_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'COMMERCIAL_VERSION_REJECT_REASON_REQUIRED: a reason is required to reject this Commercial Configuration Version';
  end if;

  select * into v_version from commercial_configuration_versions where request_id = p_request_id for update;
  if not found then
    raise exception 'COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for request %', p_request_id;
  end if;

  if v_version.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot reject your own request. Another authorized checker must review it.';
  end if;

  if v_version.status = 'rejected' then
    return v_version;
  end if;

  if v_version.status <> 'submitted' then
    raise exception 'COMMERCIAL_VERSION_NOT_REJECTABLE: version % has status %, only submitted may be rejected', p_request_id, v_version.status;
  end if;

  v_current_team_id := fn_workflow_node_team(v_version.workflow_version_id, v_version.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  if v_version.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('commercial_configuration', p_request_id, v_version.workflow_version_id, v_version.workflow_cycle_number, v_version.current_workflow_node_key, null, 'reject', p_actor_user_id, p_reason);
  end if;

  update commercial_configuration_versions
  set status = 'rejected', decided_by = p_actor_user_id, decided_at = now(), decision_reason = p_reason,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;

-- =============================================================================
-- 8. Go Live: submit / approve / send_back (no reject in this domain)
-- =============================================================================

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

create or replace function approve_go_live_request(
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

create or replace function send_back_go_live_request(
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

-- =============================================================================
-- 9. Active workflow uniqueness: at most one active workflow per binding context
-- =============================================================================

-- Phase 3B built multiple test workflows through the real Builder UI,
-- several sharing the same applies_to context; is_active defaults true
-- at creation and nothing has ever deactivated one. Before this
-- invariant can be enforced by a unique index, exactly one active
-- definition per applies_to must be chosen: the one with the most
-- recently published version (a real, in-use workflow), falling back to
-- the most recently created definition if none of that context's
-- definitions has ever been published. Every other definition sharing
-- that applies_to is deactivated; no published version any in-flight
-- request is bound to is touched (workflow_version_id on the business
-- row is a direct foreign key, resolved once at creation, never
-- filtered by is_active).
with ranked as (
  select
    wd.id,
    row_number() over (
      partition by wd.applies_to
      order by
        (select max(wdv.published_at) from workflow_definition_versions wdv where wdv.workflow_definition_id = wd.id and wdv.status = 'published') desc nulls last,
        wd.created_at desc
    ) as rnk
  from workflow_definitions wd
  where wd.is_active
)
update workflow_definitions
set is_active = false, updated_at = now()
where id in (select id from ranked where rnk > 1);

create unique index uq_workflow_definitions_one_active_per_context on workflow_definitions (applies_to) where is_active;

comment on index uq_workflow_definitions_one_active_per_context is
  'At most one active workflow_definitions row per applies_to (Workflow Runtime V1 invariant): multiple active published workflows for the same binding context left runtime selection precedence undefined. Managed going forward through set_workflow_definition_active / replace_active_workflow_definition, never by editing this column directly.';

/**
 * A new workflow is never silently created into "the" active slot for a
 * context that already has one: it is created inactive instead (a
 * governed admin still has to explicitly activate it, via
 * replace_active_workflow_definition once it is ready), so drafting a
 * successor workflow never requires deactivating the current one first.
 * The first workflow ever created for a context is still auto-active,
 * matching every existing workflow created before this migration.
 */
create or replace function create_workflow_definition(
  p_code text,
  p_name text,
  p_applies_to text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns workflow_definitions
language plpgsql
security invoker
as $function$
declare
  v_row workflow_definitions;
  v_has_active boolean;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select exists(select 1 from workflow_definitions where applies_to = p_applies_to and is_active) into v_has_active;

  insert into workflow_definitions (code, name, applies_to, is_active, created_by, updated_by)
  values (p_code, p_name, p_applies_to, not v_has_active, p_actor_user_id, p_actor_user_id)
  returning * into v_row;

  return v_row;
end;
$function$;

/** Plain activate/deactivate. Activating raises a clear, named conflict rather than silently picking one, or a raw unique-constraint violation, if another definition already holds this applies_to's active slot; deactivating is always allowed (the freed context simply has no active workflow until something is activated for it). */
create function set_workflow_definition_active(
  p_definition_id uuid,
  p_is_active boolean,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns workflow_definitions
language plpgsql
security invoker
as $function$
declare
  v_definition workflow_definitions;
  v_conflicting_name text;
  v_published_count integer;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_definition from workflow_definitions where id = p_definition_id for update;
  if not found then
    raise exception 'WORKFLOW_DEFINITION_NOT_FOUND: no workflow_definitions row for id %', p_definition_id;
  end if;

  if v_definition.is_active = p_is_active then
    return v_definition;
  end if;

  if p_is_active then
    select count(*) into v_published_count
    from workflow_definition_versions
    where workflow_definition_id = p_definition_id and status = 'published';
    if v_published_count = 0 then
      raise exception 'WORKFLOW_DEFINITION_NO_PUBLISHED_VERSION: "%" has no published version yet; publish a version before activating it', v_definition.name;
    end if;

    select wd.name into v_conflicting_name
    from workflow_definitions wd
    where wd.applies_to = v_definition.applies_to and wd.is_active and wd.id <> p_definition_id
    limit 1;

    if v_conflicting_name is not null then
      raise exception 'WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE: This process already has an active workflow: %. Deactivate or replace it before activating another workflow.', v_conflicting_name;
    end if;
  end if;

  update workflow_definitions
  set is_active = p_is_active, updated_by = p_actor_user_id, updated_at = now()
  where id = p_definition_id
  returning * into v_definition;

  return v_definition;
end;
$function$;

comment on function set_workflow_definition_active(uuid, boolean, uuid, jsonb) is
  'Activates or deactivates a workflow definition. Activating a definition whose applies_to already has a different active definition raises WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE naming the conflicting workflow, never silently picks one. Activating a definition with no published version raises WORKFLOW_DEFINITION_NO_PUBLISHED_VERSION.';

revoke all on function set_workflow_definition_active(uuid, boolean, uuid, jsonb) from public, anon, authenticated;
grant execute on function set_workflow_definition_active(uuid, boolean, uuid, jsonb) to service_role;

/** The governed replacement path (task spec: "do not require database intervention"): atomically deactivates whichever other definition currently holds this applies_to's active slot (if any) and activates p_new_definition_id, in one transaction. A no-op if p_new_definition_id is already the active one. */
create function replace_active_workflow_definition(
  p_new_definition_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns workflow_definitions
language plpgsql
security invoker
as $function$
declare
  v_new_definition workflow_definitions;
  v_published_count integer;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_new_definition from workflow_definitions where id = p_new_definition_id for update;
  if not found then
    raise exception 'WORKFLOW_DEFINITION_NOT_FOUND: no workflow_definitions row for id %', p_new_definition_id;
  end if;

  select count(*) into v_published_count
  from workflow_definition_versions
  where workflow_definition_id = p_new_definition_id and status = 'published';
  if v_published_count = 0 then
    raise exception 'WORKFLOW_DEFINITION_NO_PUBLISHED_VERSION: "%" has no published version yet; publish a version before activating it', v_new_definition.name;
  end if;

  if v_new_definition.is_active then
    return v_new_definition;
  end if;

  update workflow_definitions
  set is_active = false, updated_by = p_actor_user_id, updated_at = now()
  where applies_to = v_new_definition.applies_to and is_active and id <> p_new_definition_id;

  update workflow_definitions
  set is_active = true, updated_by = p_actor_user_id, updated_at = now()
  where id = p_new_definition_id
  returning * into v_new_definition;

  return v_new_definition;
end;
$function$;

comment on function replace_active_workflow_definition(uuid, uuid, jsonb) is
  'Governed replacement path for the at-most-one-active-workflow-per-context invariant: deactivates whichever other definition currently holds this applies_to''s active slot (if any) and activates p_new_definition_id, atomically. Historical requests already bound to an older published workflow_version_id are unaffected: that binding is a direct foreign key, resolved once at creation, never re-resolved from is_active.';

revoke all on function replace_active_workflow_definition(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function replace_active_workflow_definition(uuid, uuid, jsonb) to service_role;
