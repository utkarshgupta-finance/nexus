-- PG-040 (O-005/T-019, Batch 5/25): Product Decision (2026-09-28), part 1 of
-- the four-part decision on deactivated teams and workflow routing.
--
-- "A deactivated team must not receive NEW workflow assignments." The
-- Canvas Editor's own team picker already only offers active teams
-- (`listActiveTeams()`, confirmed via source), and the TypeScript
-- pre-publish validator already checks this
-- (`src/platform/workflow-builder/domain/validation.ts`), but neither RPC
-- itself checked it, so a direct RPC call bypassing the TS layer could
-- still save or publish a graph with an inactive team assigned to a node.
--
-- This is safe to enforce unconditionally on both save and publish,
-- with no grandfathering needed: both RPCs only ever operate on a DRAFT
-- version (`WORKFLOW_VERSION_NOT_DRAFT` guards both already), and a draft
-- is never bound to any real in-flight request (only a PUBLISHED,
-- immutable version's workflow_version_id is ever stamped onto a real
-- request). So there is no "existing in-flight" assignment this check
-- could ever retroactively break; part 2 of the decision ("existing
-- in-flight requests already assigned to the team may still be actioned
-- by currently eligible members") requires no code change here, since
-- `fn_require_workflow_team_membership` (unchanged) already only checks
-- `user_teams.revoked_at`, never `teams.is_active`.

create or replace function save_workflow_version_graph(
  p_version_id uuid,
  p_nodes jsonb,
  p_edges jsonb,
  p_expected_row_version integer,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns workflow_definition_versions
language plpgsql
security invoker
as $function$
declare
  v_version workflow_definition_versions;
  v_node jsonb;
  v_edge jsonb;
  v_responsible_team_id uuid;
  v_team_name text;
  v_team_is_active boolean;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from workflow_definition_versions where id = p_version_id for update;
  if not found then
    raise exception 'WORKFLOW_VERSION_NOT_FOUND: no workflow_definition_versions row for id %', p_version_id;
  end if;

  if v_version.status <> 'draft' then
    raise exception 'WORKFLOW_VERSION_NOT_DRAFT: version % has status %, only a draft may be edited', p_version_id, v_version.status;
  end if;

  if v_version.row_version <> p_expected_row_version then
    raise exception 'WORKFLOW_VERSION_DRAFT_STALE: This workflow draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.';
  end if;

  delete from workflow_edges where workflow_version_id = p_version_id;
  delete from workflow_nodes where workflow_version_id = p_version_id;

  for v_node in select * from jsonb_array_elements(p_nodes)
  loop
    v_responsible_team_id := nullif(v_node ->> 'responsible_team_id', '')::uuid;

    if v_responsible_team_id is not null then
      select name, is_active into v_team_name, v_team_is_active from teams where id = v_responsible_team_id;
      if not found then
        raise exception 'WORKFLOW_TEAM_NOT_FOUND: node "%" references team % which does not exist', v_node ->> 'name', v_responsible_team_id;
      end if;
      if not v_team_is_active then
        raise exception 'WORKFLOW_TEAM_INACTIVE: node "%" cannot be assigned to "%", which is an inactive team. Choose an active team, or leave this node unassigned.', v_node ->> 'name', v_team_name;
      end if;
    end if;

    insert into workflow_nodes (
      workflow_version_id, node_key, node_type, name, responsible_team_id, required_resource, required_action, config, position_x, position_y
    )
    values (
      p_version_id,
      v_node ->> 'node_key',
      v_node ->> 'node_type',
      v_node ->> 'name',
      v_responsible_team_id,
      nullif(v_node ->> 'required_resource', ''),
      nullif(v_node ->> 'required_action', ''),
      coalesce(v_node -> 'config', '{}'::jsonb),
      coalesce((v_node ->> 'position_x')::numeric, 0),
      coalesce((v_node ->> 'position_y')::numeric, 0)
    );
  end loop;

  for v_edge in select * from jsonb_array_elements(p_edges)
  loop
    insert into workflow_edges (workflow_version_id, from_node_key, to_node_key, label, condition)
    values (p_version_id, v_edge ->> 'from_node_key', v_edge ->> 'to_node_key', nullif(v_edge ->> 'label', ''), nullif(v_edge -> 'condition', 'null'::jsonb));
  end loop;

  update workflow_definition_versions set updated_by = p_actor_user_id, updated_at = now() where id = p_version_id
  returning * into v_version;

  return v_version;
end;
$function$;

comment on function save_workflow_version_graph(uuid, jsonb, jsonb, integer, uuid, jsonb) is
  'Blind whole-graph replace for a draft Workflow Builder version, gated on draft status and optimistic-lock row_version match. PG-040 (2026-09-28): independently re-verifies every assigned responsible_team_id references an ACTIVE team, never solely dependent on the Canvas Editor picker or the TypeScript pre-save validator having done so first.';

-- Publish-time defense-in-depth: independently re-verify every node's
-- responsible team is still active at the moment of publishing too (a
-- team could theoretically be deactivated in the window between save and
-- publish), mirroring the same "never solely dependent on the TS layer"
-- principle every other publish-time structural check in this function
-- already follows.
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
  v_end_outgoing_count integer;
  v_start_incoming_count integer;
  v_start_node_key text;
  v_unreachable_count integer;
  v_inactive_team_node record;
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

  select n.name as node_name, t.name as team_name into v_inactive_team_node
  from workflow_nodes n
  join teams t on t.id = n.responsible_team_id
  where n.workflow_version_id = p_version_id and not t.is_active
  limit 1;
  if found then
    raise exception 'WORKFLOW_TEAM_INACTIVE: node "%" is assigned to "%", which is an inactive team. Choose an active team, or leave this node unassigned, before publishing.', v_inactive_team_node.node_name, v_inactive_team_node.team_name;
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

  -- K-025 fix (Batch 1): an End node is terminal by definition and must
  -- never have an outgoing transition.
  select count(*) into v_end_outgoing_count
  from workflow_edges e
  join workflow_nodes n on n.workflow_version_id = e.workflow_version_id and n.node_key = e.from_node_key
  where e.workflow_version_id = p_version_id and n.node_type = 'end';
  if v_end_outgoing_count > 0 then
    raise exception 'WORKFLOW_INVALID_GRAPH: version % has an outgoing transition from an End node; an End node is terminal and must have no outgoing transitions', p_version_id;
  end if;

  -- K-026 fix (Batch 2): a Start node is an entry point by definition and
  -- must never have an incoming transition.
  select count(*) into v_start_incoming_count
  from workflow_edges e
  join workflow_nodes n on n.workflow_version_id = e.workflow_version_id and n.node_key = e.to_node_key
  where e.workflow_version_id = p_version_id and n.node_type = 'start';
  if v_start_incoming_count > 0 then
    raise exception 'WORKFLOW_INVALID_GRAPH: version % has an incoming transition into a Start node; a Start node is an entry point and must have no incoming transitions', p_version_id;
  end if;

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

  -- K-019 fix (Batch 1): every node must be reachable from the single
  -- Start node.
  select node_key into v_start_node_key from workflow_nodes where workflow_version_id = p_version_id and node_type = 'start';

  with recursive reachable(node_key) as (
    select v_start_node_key
    union
    select e.to_node_key
    from workflow_edges e
    join reachable r on r.node_key = e.from_node_key
    where e.workflow_version_id = p_version_id
  )
  select count(*) into v_unreachable_count
  from workflow_nodes n
  where n.workflow_version_id = p_version_id
    and n.node_key not in (select node_key from reachable);

  if v_unreachable_count > 0 then
    raise exception 'WORKFLOW_INVALID_GRAPH: version % has % node(s) unreachable from the Start node', p_version_id, v_unreachable_count;
  end if;

  update workflow_definition_versions
  set status = 'published', published_at = now(), published_by = p_actor_user_id, updated_by = p_actor_user_id, updated_at = now()
  where id = p_version_id
  returning * into v_version;

  return v_version;
end;
$function$;

comment on function publish_workflow_definition_version(uuid, uuid, jsonb) is
  'Publishes a draft Workflow Builder version, making it immutable, after independently re-verifying every structural graph rule server-side (responsible teams are active (PG-040), start/end counts, single-outgoing-edge for non-branching nodes, End nodes have no outgoing edges, Start nodes have no incoming edges, every node reachable from Start, Decision branch/fallback/operator rules). Never depends on the TypeScript client or service layer having validated first.';
