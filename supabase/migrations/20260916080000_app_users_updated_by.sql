-- Nexus: Platform Operating Expansion, Phase M. app_users.updated_by.
--
-- The User Access list's own "Last Updated" column
-- (src/platform/user-access/ui/user-access-page.tsx) showed a timestamp
-- with no actor: every mutation RPC already receives a real
-- p_actor_user_id, but app_users itself never had a column to persist
-- it into. Adds updated_by (self-referential, matching every other
-- governed table's actor-column shape) and updates the three existing
-- mutation RPCs to set it, same exact signatures (no new parameters, no
-- overload risk).
--
-- This file has not been applied to any database as of authoring.

alter table app_users add column updated_by uuid references app_users (id) on delete restrict;

comment on column app_users.updated_by is
  'The actor who last mutated this row via provision_app_user/set_app_user_active/ '
  'set_app_user_display_name. Null until the first mutation after this column existed.';

create or replace function provision_app_user(
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

  insert into app_users (id, updated_by)
  values (p_auth_user_id, p_actor_user_id)
  on conflict (id) do nothing;

  select * into v_row from app_users where id = p_auth_user_id;
  return v_row;
end;
$function$;

create or replace function set_app_user_active(
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

  update app_users set is_active = p_is_active, updated_by = p_actor_user_id where id = p_app_user_id
  returning * into v_row;

  if not found then
    raise exception 'USER_ACCESS_APP_USER_NOT_FOUND: no app_users row for id %', p_app_user_id;
  end if;

  return v_row;
end;
$function$;

create or replace function set_app_user_display_name(
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

  update app_users set display_name = nullif(btrim(p_display_name), ''), updated_by = p_actor_user_id where id = p_app_user_id
  returning * into v_row;

  if not found then
    raise exception 'USER_ACCESS_APP_USER_NOT_FOUND: no app_users row for id %', p_app_user_id;
  end if;

  return v_row;
end;
$function$;
