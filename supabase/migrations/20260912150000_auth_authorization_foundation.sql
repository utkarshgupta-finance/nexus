-- Nexus: Authentication + Authorization Foundation.
--
-- Closes the gap docs/AUTHORIZATION_MODEL.md always described as "locked
-- design, nothing implemented": roles/permissions/role_permissions/
-- user_roles already exist (Migration 1,
-- 20260906084244_platform_core_foundation.sql), but nothing had ever been
-- seeded into them and no application code enforced them. This migration
-- seeds the first real permission catalog (Reference Master) and converts
-- reference_options writes from plain PostgREST calls into RPC functions,
-- which is what lets a real actor identity reach audit_log.actor_user_id
-- (docs/DATA_ARCHITECTURE.md §9: populated only from
-- app.current_user_id, a transaction-local Postgres setting, never a
-- client-supplied column).
--
-- Scope: permission/role seed data, two RPC functions
-- (add_reference_option, set_reference_option_active) plus two narrower
-- governed-value update RPCs, matching the exact set_config +
-- mutation-in-one-transaction pattern every Commercial RPC already uses
-- (supabase/migrations/20260908210000_commercial_configuration_foundation.sql
-- and later). No new table, no auth_user_id column: app_users.id already
-- reuses auth.users.id 1:1 (Migration 1), so no user-mapping migration is
-- needed.
--
-- Out of scope: any real Nexus user, any auth.users row, any user_roles
-- grant to a specific person. Those are Preview-only test-provisioning
-- data, inserted separately outside this migration, exactly like the
-- Northstar demo customer precedent (never checked into a migration file).
--
-- This file has not been applied to any database as of authoring.


-- =============================================================================
-- Permission catalog: Reference Master (Settings)
-- =============================================================================

-- "reference_master" is the permission-model resource (docs/
-- AUTHORIZATION_MODEL.md §3: a type-level concept, distinct from a
-- specific reference_options row). read/write are the only two actions
-- Settings needs today; a finer split (e.g. one action per list) is not
-- introduced until a real business need asks for it.
insert into permissions (resource, action, description) values
  ('reference_master', 'read', 'View Reference Master values in Customer Onboarding Settings.'),
  ('reference_master', 'write', 'Add, activate, deactivate, or edit governed Reference Master values.')
on conflict (resource, action) do nothing;

-- Two illustrative roles, not real Nexus organizational titles (docs/
-- AUTHORIZATION_MODEL.md: "no real Nexus role names are seeded"):
-- reference_master_viewer (read only) and reference_master_admin (read
-- and write). Naming describes the permission bundle granted, not a
-- person's job title.
insert into roles (code, name, description) values
  ('reference_master_viewer', 'Reference Master Viewer', 'Can view Customer Onboarding Settings Reference Master values.'),
  ('reference_master_admin', 'Reference Master Admin', 'Can view and govern Customer Onboarding Settings Reference Master values.')
on conflict (code) do nothing;

-- role_permissions is a historical-grant-record table (Migration 2,
-- 20260906152735_audit_and_control_hardening.sql): its uniqueness is the
-- partial index uq_role_permissions_active (role_id, permission_id)
-- WHERE revoked_at IS NULL, not a plain constraint, so ON CONFLICT must
-- name that same predicate to match it.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'reference_master_viewer'
  and p.resource = 'reference_master'
  and p.action = 'read'
on conflict (role_id, permission_id) where revoked_at is null do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'reference_master_admin'
  and p.resource = 'reference_master'
  and (p.action = 'read' or p.action = 'write')
on conflict (role_id, permission_id) where revoked_at is null do nothing;


-- =============================================================================
-- reference_options writes: RPC functions, so actor identity reaches audit
-- =============================================================================

-- Every Commercial RPC sets these three transaction-local settings as its
-- first statement, in the same transaction as the mutation itself, so
-- fn_audit_row's AFTER trigger can read app.current_user_id
-- (docs/DATA_ARCHITECTURE.md §9). Plain PostgREST insert/update calls
-- (the shape reference-master.data.ts used until now) cannot do this:
-- PostgREST wraps each HTTP request in its own transaction, so there is
-- no way to "set_config, then separately call .update()" across two
-- supabase-js calls and have the setting still apply. Wrapping the
-- mutation and the set_config together in one RPC is not a stylistic
-- choice, it is the only way this codebase's existing audit design can
-- attribute a reference_options write to a real actor.
--
-- security invoker (matching create_commercial_configuration_with_change):
-- these functions are only ever called by the service_role client
-- (src/lib/supabase/server-client.ts), which already holds full
-- privileges; invoker rights, not definer, keeps that privilege
-- explicit rather than implicit.
create function add_reference_option(
  p_list_key text,
  p_code text,
  p_label text,
  p_sort_order integer,
  p_inr_conversion_rate numeric,
  p_cadence_months integer,
  p_actor_user_id uuid
)
returns reference_options
language plpgsql
security invoker
as $$
declare
  v_row reference_options;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', '', true);

  insert into reference_options (
    list_key, code, label, sort_order, inr_conversion_rate, cadence_months, created_by, updated_by
  )
  values (
    p_list_key, p_code, p_label, coalesce(p_sort_order, 0), p_inr_conversion_rate, p_cadence_months,
    p_actor_user_id, p_actor_user_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

comment on function add_reference_option(text, text, text, integer, numeric, integer, uuid) is
  'Adds one reference_options row and records p_actor_user_id as the real audit actor. '
  'Called only by service_role, only after application-layer permission enforcement '
  '(src/platform/permissions/server.ts).';

create function set_reference_option_active(
  p_list_key text,
  p_code text,
  p_is_active boolean,
  p_actor_user_id uuid
)
returns reference_options
language plpgsql
security invoker
as $$
declare
  v_row reference_options;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', '', true);

  update reference_options
  set is_active = p_is_active,
      updated_by = p_actor_user_id
  where list_key = p_list_key and code = p_code
  returning * into v_row;

  return v_row;
end;
$$;

comment on function set_reference_option_active(text, text, boolean, uuid) is
  'Activates or deactivates one reference_options row and records p_actor_user_id as the '
  'real audit actor.';

create function update_currency_inr_conversion_rate(
  p_code text,
  p_inr_conversion_rate numeric,
  p_actor_user_id uuid
)
returns reference_options
language plpgsql
security invoker
as $$
declare
  v_row reference_options;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', '', true);

  update reference_options
  set inr_conversion_rate = p_inr_conversion_rate,
      updated_by = p_actor_user_id
  where list_key = 'currency' and code = p_code
  returning * into v_row;

  return v_row;
end;
$$;

comment on function update_currency_inr_conversion_rate(text, numeric, uuid) is
  'Updates a currency option''s governed INR Conversion Rate and records p_actor_user_id as '
  'the real audit actor. Scoped to list_key = ''currency'' only.';

create function update_invoice_frequency_cadence(
  p_code text,
  p_cadence_months integer,
  p_actor_user_id uuid
)
returns reference_options
language plpgsql
security invoker
as $$
declare
  v_row reference_options;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', '', true);

  update reference_options
  set cadence_months = p_cadence_months,
      updated_by = p_actor_user_id
  where list_key = 'invoice_frequency' and code = p_code
  returning * into v_row;

  return v_row;
end;
$$;

comment on function update_invoice_frequency_cadence(text, integer, uuid) is
  'Updates an invoice_frequency option''s governed cadence and records p_actor_user_id as '
  'the real audit actor. Scoped to list_key = ''invoice_frequency'' only.';


-- =============================================================================
-- Privilege hardening: EXECUTE granted only to service_role
-- =============================================================================

-- Matching every Commercial RPC exactly: anon/authenticated already have
-- no EXECUTE on any new function by default (Migration 2's default
-- privilege rule), this is defense-in-depth, not a correction.
revoke execute on function
  add_reference_option(text, text, text, integer, numeric, integer, uuid),
  set_reference_option_active(text, text, boolean, uuid),
  update_currency_inr_conversion_rate(text, numeric, uuid),
  update_invoice_frequency_cadence(text, integer, uuid)
from public, anon, authenticated;

grant execute on function add_reference_option(text, text, text, integer, numeric, integer, uuid) to service_role;
grant execute on function set_reference_option_active(text, text, boolean, uuid) to service_role;
grant execute on function update_currency_inr_conversion_rate(text, numeric, uuid) to service_role;
grant execute on function update_invoice_frequency_cadence(text, integer, uuid) to service_role;
