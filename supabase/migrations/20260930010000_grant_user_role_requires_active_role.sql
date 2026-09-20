-- Nexus: Product Gap Closure (Batches 3-6, N-030).
--
-- grant_user_role never checked roles.is_active before inserting a new
-- grant: the User Access UI already hides deactivated roles from its
-- selector (listActiveRoles filters is_active = true), but a direct RPC
-- call for a deactivated role's id succeeded with no rejection,
-- confirmed live during Batch 5's N-030 journey. The read-side
-- permission resolver already treats roles.is_active as authoritative
-- (getActiveGlobalRolesForUser, proven in N-023): this closes the one
-- remaining place that did not. No business decision required: nobody
-- would design a system where knowingly granting a deactivated role is
-- desirable (matching the mission's own "inactive configuration must
-- not silently create invalid active truth" invariant).
--
-- Preserves every existing history/idempotency guarantee: an already-
-- active grant is still returned as-is (no new check runs on the
-- idempotent-return path, since nothing is being inserted); a
-- previously-granted, now-revoked historical row is completely
-- untouched by this change; fn_protect_access_grant's own immutability
-- rules are unaffected.

create or replace function grant_user_role(
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
  v_role_is_active boolean;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from user_roles
  where user_id = p_user_id and role_id = p_role_id and scope_resource_id is null and revoked_at is null;
  if found then
    return v_row;
  end if;

  select is_active into v_role_is_active from roles where id = p_role_id;
  if not found then
    raise exception 'ROLE_NOT_FOUND: no roles row for id %', p_role_id;
  end if;
  if not v_role_is_active then
    raise exception 'ROLE_INACTIVE: this role is deactivated and cannot be granted. Reactivate it first, or choose an active role.';
  end if;

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
  'returns the existing row rather than raising a conflict or creating a duplicate. Rejects '
  'granting a role whose roles.is_active is false (ROLE_INACTIVE), matching the same '
  'invariant already enforced on the read side (getActiveGlobalRolesForUser).';
