-- Nexus Foundational Hardening, Phase 3 (Adversarial Workflow Journey Program):
-- fixes a real defect found while publishing a live Decision-node workflow
-- through the actual Builder UI, not a hypothetical.
--
-- save_workflow_version_graph inserted an edge's condition as
-- `v_edge -> 'condition'`, the jsonb object accessor. When the incoming
-- edge draft has an explicit `"condition": null` key (every unconditioned
-- "default" branch drawn in the canvas), `v_edge -> 'condition'` evaluates
-- to the jsonb scalar `null` (jsonb_typeof = 'null'), not a SQL NULL. The
-- workflow_edges.condition column then stores that jsonb null literal
-- instead of a true NULL.
--
-- publish_workflow_definition_version's Decision-branch validation checks
-- `condition is not null` to distinguish "has a condition" from "no
-- condition" (the default branch). A SQL NULL check is false against a
-- stored jsonb null, so it is not false: `condition is not null` is TRUE
-- for a jsonb null value, since the column itself is populated (just with
-- the JSON literal null). This routes every default/unconditioned Decision
-- branch into the "has a condition" validation path, where
-- `condition ->> 'field'` on a jsonb scalar null returns SQL NULL, tripping
-- the empty-field check and raising WORKFLOW_INVALID_GRAPH. In effect: no
-- Decision node with a default (unconditioned) branch could ever be
-- published, defeating the "at most one default/unconditioned edge is
-- allowed" rule Phase 2 (20260921000000_workflow_runtime_v1.sql) itself
-- documents as supported.
--
-- Fix: wrap the insert with nullif(..., 'null'::jsonb) so a jsonb null
-- literal collapses to a true SQL NULL before it reaches the column,
-- matching the same defensive pattern the function already uses for
-- label (nullif(v_edge ->> 'label', '')) one line above.
--
-- Rebased on top of 20260922000000_optimistic_locking_extension.sql's
-- own redefinition of this same function (which adds the
-- p_expected_row_version stale-draft check): that migration is applied
-- first in filename order, so by the time this one runs,
-- save_workflow_version_graph already has the 6-parameter, row-version-
-- checked signature. This file must `create or replace` that exact
-- signature, not the older 5-parameter one, or Postgres creates a second,
-- dead overload instead of actually fixing the function the app calls.
--
-- STAGED, NOT APPLIED. Per this session's working agreement, no
-- `supabase db push` is run without a specific go-ahead; apply with
-- `npx supabase db push --linked` once reviewed.

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
    insert into workflow_nodes (
      workflow_version_id, node_key, node_type, name, responsible_team_id, required_resource, required_action, config, position_x, position_y
    )
    values (
      p_version_id,
      v_node ->> 'node_key',
      v_node ->> 'node_type',
      v_node ->> 'name',
      nullif(v_node ->> 'responsible_team_id', '')::uuid,
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

-- One-off repair of rows already written by the buggy version of this
-- function (this exact session's WF-TEST fixture data): collapse any
-- stored jsonb null literal back to a true SQL NULL so existing draft
-- graphs do not stay permanently unpublishable after this fix is applied.
update workflow_edges
set condition = null
where jsonb_typeof(condition) = 'null';
