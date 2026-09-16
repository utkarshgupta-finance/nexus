-- Nexus: Batch 1 Journey Validation (Workflow Builder authoring mechanics),
-- K-019 and K-025.
--
-- Two real defects found while executing K-019 and K-025 against the live
-- Builder via a direct RPC call (bypassing the client canvas and the
-- TypeScript service-layer validation that normally runs ahead of this RPC
-- from a Server Action):
--
-- K-025: An edge whose FROM node is an End node published successfully.
-- publish_workflow_definition_version's "exactly one outgoing edge" loop
-- only walks start/form_step/approval nodes; End is deliberately excluded
-- from it (an End node correctly may have zero outgoing edges), but nothing
-- anywhere rejects an End node that has one anyway. This is silent, since
-- the sequential runtime engine (fn_resolve_workflow_next_approval) never
-- advances past a reached End node, so it does not break an in-flight
-- request today; but it lets a Workflow Admin author and publish a
-- confusing, non-terminal-looking End node, and it lets a spurious
-- End -> X edge make an otherwise-genuinely-unreachable node X look
-- reachable to a simple "walk every edge" reachability check (see K-019
-- below), silently hiding real dead nodes.
--
-- K-019: A structurally valid but disjoint subgraph (a second, disconnected
-- start-less island of nodes with no edge path from the version's single
-- real Start node) published successfully. The client-side TypeScript
-- validator (src/platform/workflow-builder/domain/validation.ts) already
-- does a BFS from Start and rejects this, and the service layer
-- (publishVersion in workflow-builder.service.ts) already re-runs that
-- same TypeScript validator server-side before ever calling this RPC. But
-- the RPC itself, the one actually reachable by anything that bypasses the
-- Server Action layer, never independently re-derives reachability. Every
-- other structural rule in this RPC (start count, end count, single-branch
-- decision, fallback count, operator/field) is independently re-verified
-- here specifically so the RPC is never solely dependent on a caller
-- having gone through the TypeScript layer first; reachability was the one
-- rule that had not been carried over.
--
-- Fix: add two checks to publish_workflow_definition_version, in the same
-- place and style as its existing structural checks.
--   1. Reject any edge whose from_node_key belongs to an End node.
--   2. Recursive-CTE walk from the single Start node over workflow_edges;
--      reject if any node_key for this version is not reached.
-- Both run before the update to status = 'published', so a graph that
-- fails either check is never marked published, exactly like every
-- existing structural check in this function.

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
  v_start_node_key text;
  v_unreachable_count integer;
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

  -- K-025 fix: an End node is terminal by definition and must never have an
  -- outgoing transition.
  select count(*) into v_end_outgoing_count
  from workflow_edges e
  join workflow_nodes n on n.workflow_version_id = e.workflow_version_id and n.node_key = e.from_node_key
  where e.workflow_version_id = p_version_id and n.node_type = 'end';
  if v_end_outgoing_count > 0 then
    raise exception 'WORKFLOW_INVALID_GRAPH: version % has an outgoing transition from an End node; an End node is terminal and must have no outgoing transitions', p_version_id;
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

  -- K-019 fix: every node must be reachable from the single Start node.
  -- Mirrors the client-side validator's BFS (src/platform/workflow-builder/
  -- domain/validation.ts), re-derived here so the RPC itself never depends
  -- on a caller having gone through that TypeScript layer first.
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
  'Publishes a draft Workflow Builder version, making it immutable, after independently re-verifying every structural graph rule server-side (start/end counts, single-outgoing-edge for non-branching nodes, End nodes have no outgoing edges, every node reachable from Start, Decision branch/fallback/operator rules). Never depends on the TypeScript client or service layer having validated first.';
