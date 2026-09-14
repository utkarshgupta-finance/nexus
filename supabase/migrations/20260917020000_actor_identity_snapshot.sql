-- Nexus: Program 4 Hardening. Historical actor identity snapshot.
--
-- Program 4's permanent Actor Identity rule (docs/CUSTOMER_LIFECYCLE.md
-- §31) resolves an actor's CURRENT display_name (falling back to a live
-- Supabase Auth email lookup) every time a historical event is
-- rendered. That is correct for "who is this today," but not for
-- CFO-grade immutable history: if a user's name or email later changes,
-- every past event they ever acted on would retroactively appear to
-- have been performed by their new identity, which never actually
-- happened at that point in time.
--
-- Rather than adding actor_display_name_snapshot/actor_email_snapshot
-- columns to every governed table this program has already built
-- (customer_onboarding_cases, customer_change_requests,
-- commercial_configuration_versions, teams, user_teams,
-- workflow_definition_versions, and any future one), this migration
-- extends the ONE existing, generic, database-enforced mutation log,
-- `audit_log` (20260906084244_platform_core_foundation.sql), and its
-- single shared trigger function, `fn_audit_row()`, already attached to
-- every audited table. A snapshot is captured once, centrally, at the
-- moment of every audited mutation, for every table that ever attaches
-- this trigger, present or future: zero per-table schema change needed
-- anywhere else.
--
-- Scope, honestly stated: this migration builds the canonical
-- mechanism and closes it for every table already wired to
-- `fn_audit_row` (customer_onboarding_cases, customer_change_requests,
-- commercial_configuration_versions, customers, app_users, and more:
-- see the trigger list this file adds to). It also attaches the same
-- trigger to four tables built this program that were never wired to
-- it at all (teams, user_teams, workflow_definitions,
-- workflow_definition_versions), closing a real, separate audit-
-- coverage gap for Activated/Deactivated and Workflow Published events.
-- `workflow_nodes`/`workflow_edges` are deliberately NOT attached: they
-- are graph content rewritten wholesale on every draft save
-- (delete-all-then-reinsert, 20260916090000_workflow_builder_foundation.sql),
-- not a meaningful governed lifecycle event in their own right.
--
-- This migration does NOT yet change which UI surfaces read a snapshot
-- instead of live-resolving. Only the Customer Activity timeline
-- (src/features/customers/server/activity.ts) reads `audit_log` today;
-- it is updated in the same program to prefer the snapshot. Every other
-- surface (Onboarding/Change Request Timelines, the Approvals inbox,
-- User Access "Last Updated by") reads a domain table's own `*_by`
-- column directly (approved_by, sent_back_by, decided_by, updated_by),
-- not `audit_log`, and continues to live-resolve the actor's current
-- name for now. Migrating those to their own snapshot is a distinct,
-- larger follow-up (correlating each `*_by` column to the specific
-- audit_log row for that exact transition), named here rather than
-- silently left undiscovered, not undertaken in this pass.
--
-- Backfill discipline: existing audit_log rows get NULL snapshots (the
-- lookup did not exist when they were written); no historical name is
-- invented for them. A NULL snapshot falls back to the actor's current
-- display name, then to email, per the same fallback chain already
-- established (docs/CUSTOMER_LIFECYCLE.md §31), never a raw UUID.
--
-- This file has not been applied to any database as of authoring.

alter table audit_log add column actor_display_name_snapshot text;
alter table audit_log add column actor_email_snapshot text;

comment on column audit_log.actor_display_name_snapshot is
  'app_users.display_name as it was AT THE MOMENT of this event, captured by fn_audit_row(). NULL for rows written before this column existed; never backfilled with an invented historical value.';
comment on column audit_log.actor_email_snapshot is
  'auth.users.email as it was AT THE MOMENT of this event, captured by fn_audit_row(). NULL for rows written before this column existed; never backfilled with an invented historical value.';

create or replace function fn_audit_row()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_row                 jsonb;
  v_pk_column           text;
  v_res_column          text;
  v_row_id              uuid;
  v_res_id              uuid;
  v_actor_id            uuid;
  v_actor_display_name  text;
  v_actor_email         text;
begin
  if tg_nargs < 1 or tg_nargs > 2 or tg_argv[0] is null or tg_argv[0] = '' then
    raise exception
      'fn_audit_row requires one or two trigger arguments: the primary key '
      'column name (e.g. ''id'' or ''resource_id''), and optionally the '
      'resource-id column name (defaults to ''resource_id'' when omitted, '
      'e.g. fn_audit_row(''id'', ''id'')), got % argument(s) on table %',
      tg_nargs, tg_table_name;
  end if;
  v_pk_column := tg_argv[0];

  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_row_id := (v_row ->> v_pk_column)::uuid;

  if tg_nargs = 2 then
    v_res_column := coalesce(nullif(tg_argv[1], ''), 'resource_id');

    if not (v_row ? v_res_column) then
      raise exception
        'fn_audit_row: resource-id column % does not exist on table % (row-id column %)',
        v_res_column, tg_table_name, v_pk_column;
    end if;

    v_res_id := nullif(v_row ->> v_res_column, '')::uuid;
  else
    v_res_id := nullif(v_row ->> 'resource_id', '')::uuid;
  end if;

  v_actor_id := nullif(current_setting('app.current_user_id', true), '')::uuid;

  if v_actor_id is not null then
    select display_name into v_actor_display_name from public.app_users where id = v_actor_id;
    select email into v_actor_email from auth.users where id = v_actor_id;
  end if;

  insert into public.audit_log (
    resource_id, table_name, row_id, action,
    before_value, after_value,
    actor_user_id, request_id, actor_context,
    actor_display_name_snapshot, actor_email_snapshot
  )
  values (
    v_res_id,
    tg_table_name,
    v_row_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    v_actor_id,
    nullif(current_setting('app.request_id', true), '')::uuid,
    nullif(current_setting('app.actor_context', true), '')::jsonb,
    v_actor_display_name,
    v_actor_email
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

-- =============================================================================
-- Close the audit-coverage gap for Team Master and Workflow Builder
-- (built this program, never wired to fn_audit_row at all).
-- =============================================================================

create trigger trg_audit_teams
  after insert or update or delete on teams
  for each row execute function fn_audit_row('id');

create trigger trg_audit_user_teams
  after insert or update or delete on user_teams
  for each row execute function fn_audit_row('id');

create trigger trg_audit_workflow_definitions
  after insert or update or delete on workflow_definitions
  for each row execute function fn_audit_row('id');

create trigger trg_audit_workflow_definition_versions
  after insert or update or delete on workflow_definition_versions
  for each row execute function fn_audit_row('id');
