-- Nexus: Platform Operating Expansion, Phase N/O. Workflow Builder
-- domain foundation.
--
-- A distinct concept from the existing `platform/workflow` rule
-- evaluator (src/platform/workflow/domain/types.ts's `WorkflowDefinition`/
-- `WorkflowRule`, still DESIGN/PARTIALLY IMPLEMENTED, still the only
-- workflow mechanism Customer Change actually runs today): that module
-- is a flat, condition-triggered requirement generator ("when this
-- field changes, require this approval"), unchanged by this migration.
-- This migration is a real, persisted, node-GRAPH process model (Start
-- -> Form Step -> Approval -> Decision -> End), the kind an admin draws
-- on a canvas. The two are related in spirit, not merged: forcing them
-- into one schema now would either weaken the graph model to fit the
-- flat-rule shape, or vice versa, neither of which either consumer
-- actually needs today (task Phase P: existing hardcoded lifecycles
-- stay exactly as they are; this is new, additive infrastructure with
-- no live consumer yet).
--
-- Node/Edge are real relational tables, not a persisted blob of
-- whatever the canvas library's own UI JSON happens to look like (task
-- spec: "do NOT persist React Flow's UI JSON as the authoritative
-- business contract"). `position_x`/`position_y` are the only columns
-- that exist purely for canvas layout; every other column is real
-- business semantics Nexus validates.
--
-- Versioning mirrors the same Form Version / Commercial Version
-- precedent already established twice in this schema: a Draft version
-- is freely editable, a Published version is immutable, and editing a
-- published workflow again always creates a new Draft version, never
-- rewrites history. Edges reference nodes by `node_key` (stable within
-- one version), not by generated row id, so the whole-graph "replace on
-- save" RPC below never needs a two-phase insert-then-relink dance.
--
-- This file has not been applied to any database as of authoring.

-- =============================================================================
-- workflow_definitions: the stable identity ("Customer Onboarding
-- Approval Flow"), independent of any specific version's graph content.
-- =============================================================================

create table workflow_definitions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  applies_to  text not null check (applies_to in ('customer_onboarding', 'customer_change', 'commercial_configuration', 'go_live', 'agreement')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references app_users (id) on delete restrict,
  updated_by  uuid references app_users (id) on delete restrict
);

comment on table workflow_definitions is
  'Task Phase N/O. Stable Workflow Builder identity. applies_to is a closed set of the domains this program has actually built (or is building); a future domain is added here explicitly, never inferred from free text.';

create trigger trg_workflow_definitions_updated_at
  before update on workflow_definitions
  for each row execute function fn_set_updated_at();

alter table workflow_definitions enable row level security;

-- =============================================================================
-- workflow_definition_versions: Draft editable, Published immutable.
-- =============================================================================

create table workflow_definition_versions (
  id                      uuid primary key default gen_random_uuid(),
  workflow_definition_id  uuid not null references workflow_definitions (id) on delete restrict,
  version_number          integer not null,
  status                  text not null default 'draft' check (status in ('draft', 'published')),
  published_at            timestamptz,
  published_by            uuid references app_users (id) on delete restrict,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references app_users (id) on delete restrict,
  updated_by              uuid references app_users (id) on delete restrict,

  unique (workflow_definition_id, version_number)
);

comment on table workflow_definition_versions is
  'Task Phase N/O. One version''s graph. A published version is never edited again; a new change always creates a new draft version (create_workflow_definition_version), matching the Form Version / Commercial Version precedent exactly.';

-- At most one draft per definition at a time (task spec: admin edits one
-- draft, publishes it, then starts the next).
create unique index uq_workflow_version_one_draft
  on workflow_definition_versions (workflow_definition_id)
  where status = 'draft';

create index idx_workflow_versions_definition_id on workflow_definition_versions (workflow_definition_id);

create trigger trg_workflow_versions_updated_at
  before update on workflow_definition_versions
  for each row execute function fn_set_updated_at();

alter table workflow_definition_versions enable row level security;

-- =============================================================================
-- workflow_nodes: Start/Form Step/Approval/Decision/End.
-- =============================================================================

create table workflow_nodes (
  id                    uuid primary key default gen_random_uuid(),
  workflow_version_id   uuid not null references workflow_definition_versions (id) on delete cascade,
  node_key              text not null,
  node_type             text not null check (node_type in ('start', 'form_step', 'approval', 'decision', 'end')),
  name                  text not null,
  /** Which team this node's work belongs to (task Phase K); null for a node with no team-specific ownership (for example Start/End). */
  responsible_team_id   uuid references teams (id) on delete restrict,
  /** The permission (resource+action, docs/AUTHORIZATION_MODEL.md's own vocabulary) required to act on this node, for an Approval node; null where not applicable. Never a role name or a client boolean: this is looked up against the real `permissions` catalog at validation time. */
  required_resource     text,
  required_action       text,
  /** Conditions/required fields/required attachments (task spec), a small, closed shape validated in TypeScript before this RPC is ever called (src/platform/workflow-builder/domain/graph.ts), never arbitrary code. */
  config                jsonb not null default '{}'::jsonb,
  position_x            numeric not null default 0,
  position_y            numeric not null default 0,

  unique (workflow_version_id, node_key)
);

comment on table workflow_nodes is
  'Task Phase N/O. Real business semantics per node; position_x/position_y are the only columns that exist purely for canvas layout, never the canvas UI''s own opaque state.';

create index idx_workflow_nodes_version_id on workflow_nodes (workflow_version_id);

alter table workflow_nodes enable row level security;

-- =============================================================================
-- workflow_edges: transitions between nodes (Approve/Send Back/Reject
-- and similar), referencing nodes by their stable node_key within the
-- same version, never a generated row id.
-- =============================================================================

create table workflow_edges (
  id                    uuid primary key default gen_random_uuid(),
  workflow_version_id   uuid not null references workflow_definition_versions (id) on delete cascade,
  from_node_key         text not null,
  to_node_key           text not null,
  /** For example "Approve", "Send Back", "Reject": which outgoing transition this is from an Approval/Decision node. Null for a node type with only one way forward (Start, Form Step). */
  label                 text,
  /** A single WorkflowCondition-shaped object (src/platform/workflow/domain/types.ts's existing vocabulary, reused rather than redeclared) gating this transition for a Decision node; null for an unconditional transition. */
  condition             jsonb,

  foreign key (workflow_version_id, from_node_key) references workflow_nodes (workflow_version_id, node_key) on delete cascade,
  foreign key (workflow_version_id, to_node_key) references workflow_nodes (workflow_version_id, node_key) on delete cascade
);

comment on table workflow_edges is
  'Task Phase N/O. References nodes by (workflow_version_id, node_key), a composite foreign key against workflow_nodes'' own unique constraint, so the whole-graph replace-on-save RPC never needs to know generated node ids up front.';

create index idx_workflow_edges_version_id on workflow_edges (workflow_version_id);

alter table workflow_edges enable row level security;

-- =============================================================================
-- Permission catalog: Workflow Definition (Settings/Administration)
-- =============================================================================

insert into permissions (resource, action, description) values
  ('workflow_definition', 'read', 'View Workflow Builder definitions and versions.'),
  ('workflow_definition', 'write', 'Create and edit Workflow Builder definitions and draft versions.'),
  ('workflow_definition', 'publish', 'Publish a Workflow Builder draft version, making it immutable.')
on conflict (resource, action) do nothing;

insert into roles (code, name, description) values
  ('workflow_admin', 'Workflow Admin', 'Can view, edit, and publish Workflow Builder definitions.')
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'workflow_admin'
  and p.resource = 'workflow_definition'
  and p.action in ('read', 'write', 'publish')
on conflict (role_id, permission_id) where revoked_at is null do nothing;

-- =============================================================================
-- RPCs
-- =============================================================================

create function create_workflow_definition(
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
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  insert into workflow_definitions (code, name, applies_to, created_by, updated_by)
  values (p_code, p_name, p_applies_to, p_actor_user_id, p_actor_user_id)
  returning * into v_row;

  return v_row;
end;
$function$;

/** Creates a new draft version, seeded from the current published version's graph if one exists, else empty. Raises if a draft already exists for this definition (uq_workflow_version_one_draft), so an admin finishes or discards the current draft before starting another. */
create function create_workflow_definition_version(
  p_workflow_definition_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns workflow_definition_versions
language plpgsql
security invoker
as $function$
declare
  v_next_version integer;
  v_new_version workflow_definition_versions;
  v_source_version_id uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select coalesce(max(version_number), 0) + 1 into v_next_version
  from workflow_definition_versions
  where workflow_definition_id = p_workflow_definition_id;

  insert into workflow_definition_versions (workflow_definition_id, version_number, created_by, updated_by)
  values (p_workflow_definition_id, v_next_version, p_actor_user_id, p_actor_user_id)
  returning * into v_new_version;

  select id into v_source_version_id
  from workflow_definition_versions
  where workflow_definition_id = p_workflow_definition_id and status = 'published'
  order by version_number desc
  limit 1;

  if v_source_version_id is not null then
    insert into workflow_nodes (workflow_version_id, node_key, node_type, name, responsible_team_id, required_resource, required_action, config, position_x, position_y)
    select v_new_version.id, node_key, node_type, name, responsible_team_id, required_resource, required_action, config, position_x, position_y
    from workflow_nodes
    where workflow_version_id = v_source_version_id;

    insert into workflow_edges (workflow_version_id, from_node_key, to_node_key, label, condition)
    select v_new_version.id, from_node_key, to_node_key, label, condition
    from workflow_edges
    where workflow_version_id = v_source_version_id;
  end if;

  return v_new_version;
end;
$function$;

/** Replaces this draft version's entire graph in one transaction: deletes every existing node/edge for it, then inserts the given set. Only ever callable on a draft (never a published version). */
create function save_workflow_version_graph(
  p_version_id uuid,
  p_nodes jsonb,
  p_edges jsonb,
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
    values (p_version_id, v_edge ->> 'from_node_key', v_edge ->> 'to_node_key', nullif(v_edge ->> 'label', ''), v_edge -> 'condition');
  end loop;

  update workflow_definition_versions set updated_by = p_actor_user_id, updated_at = now() where id = p_version_id
  returning * into v_version;

  return v_version;
end;
$function$;

/** Publishing itself trusts the caller to have already run the full graph validator (src/platform/workflow-builder/domain/validation.ts) client-side; this RPC re-checks only the cheapest, most load-bearing invariants server-side (defense in depth, never trusting a client-side-only check for something this consequential): at least one start node, at least one end node, and every edge's endpoints exist in this same version. */
create function publish_workflow_definition_version(
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

  update workflow_definition_versions
  set status = 'published', published_at = now(), published_by = p_actor_user_id, updated_by = p_actor_user_id, updated_at = now()
  where id = p_version_id
  returning * into v_version;

  return v_version;
end;
$function$;

-- =============================================================================
-- Privilege hardening
-- =============================================================================

revoke execute on function
  create_workflow_definition(text, text, text, uuid, jsonb),
  create_workflow_definition_version(uuid, uuid, jsonb),
  save_workflow_version_graph(uuid, jsonb, jsonb, uuid, jsonb),
  publish_workflow_definition_version(uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function create_workflow_definition(text, text, text, uuid, jsonb) to service_role;
grant execute on function create_workflow_definition_version(uuid, uuid, jsonb) to service_role;
grant execute on function save_workflow_version_graph(uuid, jsonb, jsonb, uuid, jsonb) to service_role;
grant execute on function publish_workflow_definition_version(uuid, uuid, jsonb) to service_role;
