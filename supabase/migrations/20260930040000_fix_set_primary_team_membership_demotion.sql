-- Nexus: Product Gap Closure (Batches 3-6, O-011 bug fix).
--
-- Found live during this same task's own regression verification:
-- set_primary_team_membership's first version revoked the user's
-- previous primary team membership ENTIRELY rather than demoting it to
-- a non-primary active membership, silently removing the user from
-- their old primary team as an unintended side effect of promoting a
-- different team to primary. The correct semantics: promoting Team B to
-- primary while the user already actively holds Team A as primary must
-- leave the user an active, non-primary member of Team A, not remove
-- them from it. Since fn_protect_team_grant forbids mutating is_primary
-- on an existing row in place, demoting the old primary requires the
-- same revoke-then-reinsert pattern already used for the promotion
-- itself, applied to the OLD team as well (reinserted with
-- is_primary = false), not just a revoke with nothing to replace it.

create or replace function set_primary_team_membership(
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
    insert into user_teams (user_id, team_id, is_primary, created_by)
    values (p_user_id, v_old_primary.team_id, false, p_actor_user_id);
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
  'previous active primary (if any) to a non-primary active membership on that same team '
  '(never removing it), since fn_protect_team_grant forbids changing is_primary on an '
  'existing row in place. Idempotent: promoting an already-primary membership is a no-op. '
  'Raises TEAM_GRANT_NOT_FOUND if the user has no active membership on the target team; the '
  'caller must assign the team first (assign_user_to_team).';
