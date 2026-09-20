-- Nexus: Product Gap Closure (Batches 3-6, O-011).
--
-- assign_user_to_team's idempotent pre-check matches on (user_id,
-- team_id, revoked_at is null) alone, ignoring p_is_primary entirely:
-- re-calling it for an EXISTING membership with a different is_primary
-- value silently returned the old, unchanged row with no error,
-- confirmed live during Batch 5's O-011 journey. fn_protect_team_grant
-- also forbids a direct UPDATE of is_primary on an existing row (only
-- revoked_at/revoked_by may ever change), so there was no path at all,
-- RPC or raw SQL, to promote an existing membership to primary.
--
-- The primary-team invariant itself is already unambiguous and requires
-- no business decision: uq_user_teams_one_active_primary is a partial
-- unique index on (user_id) alone (one active primary per user,
-- GLOBALLY across all teams, not per-domain), and
-- assign_user_to_team's own comment already documented the intended
-- mechanism for switching primary between two different teams ("Setting
-- p_is_primary true on a second team requires the caller to unassign or
-- demote the current primary first"). This RPC automates exactly that
-- mechanism, atomically, and extends it to the one case that comment did
-- not cover: promoting an EXISTING membership on the SAME team from
-- non-primary to primary, which requires the same revoke-then-reinsert
-- pattern since fn_protect_team_grant forbids mutating is_primary on an
-- existing row in place.

create function set_primary_team_membership(
  p_user_id uuid,
  p_team_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns user_teams
language plpgsql
security invoker
as $function$
declare
  v_target user_teams;
  v_old_primary user_teams;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  -- Lock every active row for this user first, so two concurrent calls
  -- for the same user serialize rather than racing each other's
  -- revoke/insert pair.
  perform 1 from user_teams where user_id = p_user_id and revoked_at is null for update;

  select * into v_target from user_teams where user_id = p_user_id and team_id = p_team_id and revoked_at is null;
  if not found then
    raise exception 'TEAM_GRANT_NOT_FOUND: user % has no active membership on team % to promote', p_user_id, p_team_id
      using errcode = '23514';
  end if;

  if v_target.is_primary then
    return v_target;
  end if;

  select * into v_old_primary from user_teams where user_id = p_user_id and is_primary and revoked_at is null;
  if found then
    update user_teams set revoked_at = now(), revoked_by = p_actor_user_id where id = v_old_primary.id;
  end if;

  update user_teams set revoked_at = now(), revoked_by = p_actor_user_id where id = v_target.id;

  insert into user_teams (user_id, team_id, is_primary, created_by)
  values (p_user_id, p_team_id, true, p_actor_user_id)
  returning * into v_target;

  return v_target;
end;
$function$;

comment on function set_primary_team_membership(uuid, uuid, uuid, jsonb) is
  'Promotes an existing active team membership to primary, atomically demoting the user''s '
  'previous active primary (if any) by revoking it, since fn_protect_team_grant forbids '
  'changing is_primary on an existing row in place. Idempotent: promoting an already-primary '
  'membership is a no-op. Raises TEAM_GRANT_NOT_FOUND if the user has no active membership on '
  'the target team; the caller must assign the team first (assign_user_to_team).';

revoke execute on function set_primary_team_membership(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function set_primary_team_membership(uuid, uuid, uuid, jsonb) to service_role;
