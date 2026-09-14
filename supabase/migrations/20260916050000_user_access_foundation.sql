-- Nexus: Platform Operating Expansion, Phase J. User Access module
-- foundation.
--
-- app_users/roles/permissions/role_permissions/user_roles already exist
-- (Migration 1) and are already the sole RBAC mechanism this app
-- enforces (src/platform/permissions/server.ts); this migration adds no
-- competing authorization system, only the write RPCs a real admin UI
-- needs on top of tables that, until now, had no application code
-- writing to them at all (every existing grant is a manual/Preview-only
-- provisioning step, matching the established
-- 20260912150000_auth_authorization_foundation.sql precedent: "no real
-- Nexus user, any auth.users row, any user_roles grant to a specific
-- person" is out of scope for a migration file).
--
-- A real, pre-existing gap this closes: nothing in this codebase ever
-- inserts into app_users. A brand-new Supabase Auth signup has no
-- app_users row, and therefore no possible permission grant, until
-- someone manually provisions one; `provision_app_user` is the first
-- real, application-reachable way to do that, gated behind
-- `user_access.write` like every other mutation here.
--
-- This file has not been applied to any database as of authoring.

-- =============================================================================
-- Permission catalog: User Access (Settings/Administration)
-- =============================================================================

insert into permissions (resource, action, description) values
  ('user_access', 'read', 'View the User Access list in Settings/Administration.'),
  ('user_access', 'write', 'Provision, activate/deactivate, set display name, and assign/remove roles for a Nexus user.')
on conflict (resource, action) do nothing;

insert into roles (code, name, description) values
  ('user_access_admin', 'User Access Admin', 'Can view and manage the User Access list in Settings/Administration.')
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'user_access_admin'
  and p.resource = 'user_access'
  and (p.action = 'read' or p.action = 'write')
on conflict (role_id, permission_id) where revoked_at is null do nothing;

-- =============================================================================
-- provision_app_user: the first real, application-reachable app_users insert
-- =============================================================================

create function provision_app_user(
  p_auth_user_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns app_users
language plpgsql
security invoker
as $function$
declare
  v_row app_users;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  insert into app_users (id)
  values (p_auth_user_id)
  on conflict (id) do nothing;

  select * into v_row from app_users where id = p_auth_user_id;
  return v_row;
end;
$function$;

comment on function provision_app_user(uuid, uuid, jsonb) is
  'Creates the app_users row for a Supabase Auth user who does not have one yet, idempotently. '
  'Called only by service_role, only after application-layer permission enforcement.';

-- =============================================================================
-- set_app_user_active / set_app_user_display_name
-- =============================================================================

create function set_app_user_active(
  p_app_user_id uuid,
  p_is_active boolean,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns app_users
language plpgsql
security invoker
as $function$
declare
  v_row app_users;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  update app_users set is_active = p_is_active where id = p_app_user_id
  returning * into v_row;

  if not found then
    raise exception 'USER_ACCESS_APP_USER_NOT_FOUND: no app_users row for id %', p_app_user_id;
  end if;

  return v_row;
end;
$function$;

create function set_app_user_display_name(
  p_app_user_id uuid,
  p_display_name text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns app_users
language plpgsql
security invoker
as $function$
declare
  v_row app_users;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  update app_users set display_name = nullif(btrim(p_display_name), '') where id = p_app_user_id
  returning * into v_row;

  if not found then
    raise exception 'USER_ACCESS_APP_USER_NOT_FOUND: no app_users row for id %', p_app_user_id;
  end if;

  return v_row;
end;
$function$;

-- =============================================================================
-- grant_user_role / revoke_user_role: global assignments only (task spec),
-- reusing user_roles/fn_protect_access_grant exactly as they already are.
-- =============================================================================

create function grant_user_role(
  p_user_id uuid,
  p_role_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns user_roles
language plpgsql
security invoker
as $function$
declare
  v_row user_roles;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  insert into user_roles (user_id, role_id, created_by)
  values (p_user_id, p_role_id, p_actor_user_id)
  on conflict (user_id, role_id) where scope_resource_id is null and revoked_at is null do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from user_roles
    where user_id = p_user_id and role_id = p_role_id and scope_resource_id is null and revoked_at is null;
  end if;

  return v_row;
end;
$function$;

comment on function grant_user_role(uuid, uuid, uuid, jsonb) is
  'Grants one global role to one user. Idempotent: if this exact grant is already active, '
  'returns the existing row rather than raising a conflict or creating a duplicate.';

create function revoke_user_role(
  p_user_role_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns user_roles
language plpgsql
security invoker
as $function$
declare
  v_row user_roles;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from user_roles where id = p_user_role_id for update;
  if not found then
    raise exception 'USER_ACCESS_GRANT_NOT_FOUND: no user_roles row for id %', p_user_role_id;
  end if;

  if v_row.revoked_at is not null then
    return v_row;
  end if;

  update user_roles
  set revoked_at = now(), revoked_by = p_actor_user_id
  where id = p_user_role_id
  returning * into v_row;

  return v_row;
end;
$function$;

comment on function revoke_user_role(uuid, uuid, jsonb) is
  'Revokes one active role grant. Idempotent: revoking an already-revoked grant is a no-op '
  'returning the existing row, never a second revocation (fn_protect_access_grant forbids it).';

-- =============================================================================
-- Privilege hardening: EXECUTE granted only to service_role
-- =============================================================================

revoke execute on function
  provision_app_user(uuid, uuid, jsonb),
  set_app_user_active(uuid, boolean, uuid, jsonb),
  set_app_user_display_name(uuid, text, uuid, jsonb),
  grant_user_role(uuid, uuid, uuid, jsonb),
  revoke_user_role(uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function provision_app_user(uuid, uuid, jsonb) to service_role;
grant execute on function set_app_user_active(uuid, boolean, uuid, jsonb) to service_role;
grant execute on function set_app_user_display_name(uuid, text, uuid, jsonb) to service_role;
grant execute on function grant_user_role(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function revoke_user_role(uuid, uuid, jsonb) to service_role;
