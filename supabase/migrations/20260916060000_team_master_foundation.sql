-- Nexus: Platform Operating Expansion, Phase K. Team Master foundation.
--
-- A governed teams catalog, mirroring the exact shape `roles` already
-- established (Migration 1): code/name/description/is_active, no
-- hardcoded example teams seeded. `user_teams` is a many-to-many
-- assignment table (a user may belong to more than one team; V1 tracks
-- which one is primary with a boolean, task spec: "prefer many-to-many
-- if it stays simple"), following the exact same historical-grant-record
-- shape `user_roles` already established
-- (20260906152735_audit_and_control_hardening.sql): an assignment is
-- never deleted, only revoked, so "who was on which team, and when" stays
-- permanently reconstructible (task Phase M's own test scenario:
-- "Teams: assignment/history"). Org hierarchy (a team belonging to
-- another team, a manager relationship) is explicitly out of scope for
-- V1 (task spec).
--
-- This file has not been applied to any database as of authoring.

-- =============================================================================
-- teams: governed catalog
-- =============================================================================

create table teams (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references app_users (id) on delete restrict,
  updated_by  uuid references app_users (id) on delete restrict
);

comment on table teams is
  'Configurable team catalog (task Phase K). No real Nexus team names are seeded by this migration.';

create index idx_teams_created_by on teams (created_by);
create index idx_teams_updated_by on teams (updated_by);

create trigger trg_teams_updated_at
  before update on teams
  for each row
  execute function fn_set_updated_at();

alter table teams enable row level security;

-- =============================================================================
-- user_teams: many-to-many assignment, historical grant record
-- =============================================================================

create table user_teams (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_users (id) on delete cascade,
  team_id       uuid not null references teams (id) on delete restrict,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid references app_users (id) on delete restrict,
  revoked_at    timestamptz,
  revoked_by    uuid references app_users (id) on delete restrict,

  constraint chk_user_teams_revocation_chronology check (revoked_at is null or revoked_at >= created_at)
);

comment on table user_teams is
  'Team assignments (task Phase K), same historical-grant-record shape as user_roles: an '
  'active assignment has revoked_at IS NULL; a revoked one is preserved exactly as it was, '
  'never deleted. is_primary marks at most one active team per user as primary '
  '(uq_user_teams_one_active_primary below); a user may still hold more than one active, '
  'non-primary team.';

create index idx_user_teams_user_id on user_teams (user_id);
create index idx_user_teams_team_id on user_teams (team_id);
create index idx_user_teams_revoked_at on user_teams (revoked_at);

-- One active assignment per (user, team); a revoked one never blocks a later, new
-- assignment of the same team to the same user (mirrors uq_user_roles_global exactly).
create unique index uq_user_teams_active
  on user_teams (user_id, team_id)
  where revoked_at is null;

-- At most one PRIMARY active team per user (partial unique index on user_id alone,
-- filtered to is_primary and active rows).
create unique index uq_user_teams_one_active_primary
  on user_teams (user_id)
  where is_primary and revoked_at is null;

alter table user_teams enable row level security;

-- Same immutability shape as fn_protect_access_grant (user_roles/role_permissions,
-- 20260906152735_audit_and_control_hardening.sql): a grant must begin active, revoked_at
-- can only move from NULL to a value, never back, and no other column may change once set.
create function fn_protect_team_grant()
returns trigger
language plpgsql
as $$
declare
  v_old_identity jsonb;
  v_new_identity jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'user_teams is a historical grant record: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    if new.revoked_at is not null or new.revoked_by is not null then
      raise exception 'user_teams is a historical grant record: a new assignment must begin active (revoked_at/revoked_by must be NULL on insert)';
    end if;
    return new;
  end if;

  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'user_teams is a historical grant record: revoked_at cannot change once set (no reactivation, no re-revocation)';
  end if;

  if old.revoked_at is not null and new.revoked_by is distinct from old.revoked_by then
    raise exception 'user_teams is a historical grant record: revoked_by cannot change once revoked_at is set';
  end if;

  v_old_identity := to_jsonb(old) - 'revoked_at' - 'revoked_by';
  v_new_identity := to_jsonb(new) - 'revoked_at' - 'revoked_by';
  if v_old_identity is distinct from v_new_identity then
    raise exception 'user_teams is a historical grant record: only revoked_at/revoked_by may ever change, and only from NULL to a value';
  end if;

  return new;
end;
$$;

create trigger trg_user_teams_protect_grant
  before insert or update or delete on user_teams
  for each row
  execute function fn_protect_team_grant();

-- =============================================================================
-- Permission catalog: Team (Settings/Administration)
-- =============================================================================

insert into permissions (resource, action, description) values
  ('team', 'read', 'View the Team Master catalog and team assignments.'),
  ('team', 'write', 'Add, activate, deactivate, or edit teams, and assign/remove team members.')
on conflict (resource, action) do nothing;

insert into roles (code, name, description) values
  ('team_admin', 'Team Admin', 'Can view and govern the Team Master catalog and team assignments.')
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'team_admin'
  and p.resource = 'team'
  and (p.action = 'read' or p.action = 'write')
on conflict (role_id, permission_id) where revoked_at is null do nothing;

-- =============================================================================
-- RPCs
-- =============================================================================

create function create_team(
  p_code text,
  p_name text,
  p_description text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns teams
language plpgsql
security invoker
as $function$
declare
  v_row teams;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  insert into teams (code, name, description, created_by, updated_by)
  values (p_code, p_name, nullif(btrim(p_description), ''), p_actor_user_id, p_actor_user_id)
  returning * into v_row;

  return v_row;
end;
$function$;

create function set_team_active(
  p_team_id uuid,
  p_is_active boolean,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns teams
language plpgsql
security invoker
as $function$
declare
  v_row teams;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  update teams set is_active = p_is_active, updated_by = p_actor_user_id where id = p_team_id
  returning * into v_row;

  if not found then
    raise exception 'TEAM_NOT_FOUND: no teams row for id %', p_team_id;
  end if;

  return v_row;
end;
$function$;

/** Idempotent: assigning a team the user is already actively on returns the existing row rather than raising a conflict. Setting p_is_primary true on a second team requires the caller to unassign or demote the current primary first (uq_user_teams_one_active_primary enforces this at the database level; the caller sees that constraint violation directly). */
create function assign_user_to_team(
  p_user_id uuid,
  p_team_id uuid,
  p_is_primary boolean,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns user_teams
language plpgsql
security invoker
as $function$
declare
  v_row user_teams;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from user_teams where user_id = p_user_id and team_id = p_team_id and revoked_at is null;
  if found then
    return v_row;
  end if;

  insert into user_teams (user_id, team_id, is_primary, created_by)
  values (p_user_id, p_team_id, coalesce(p_is_primary, false), p_actor_user_id)
  returning * into v_row;

  return v_row;
end;
$function$;

create function remove_user_from_team(
  p_user_team_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns user_teams
language plpgsql
security invoker
as $function$
declare
  v_row user_teams;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from user_teams where id = p_user_team_id for update;
  if not found then
    raise exception 'TEAM_GRANT_NOT_FOUND: no user_teams row for id %', p_user_team_id;
  end if;

  if v_row.revoked_at is not null then
    return v_row;
  end if;

  update user_teams set revoked_at = now(), revoked_by = p_actor_user_id where id = p_user_team_id
  returning * into v_row;

  return v_row;
end;
$function$;

-- =============================================================================
-- Privilege hardening
-- =============================================================================

revoke execute on function
  create_team(text, text, text, uuid, jsonb),
  set_team_active(uuid, boolean, uuid, jsonb),
  assign_user_to_team(uuid, uuid, boolean, uuid, jsonb),
  remove_user_from_team(uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function create_team(text, text, text, uuid, jsonb) to service_role;
grant execute on function set_team_active(uuid, boolean, uuid, jsonb) to service_role;
grant execute on function assign_user_to_team(uuid, uuid, boolean, uuid, jsonb) to service_role;
grant execute on function remove_user_from_team(uuid, uuid, jsonb) to service_role;
