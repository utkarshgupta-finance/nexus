-- Nexus: Optimistic Locking Extension (Nexus Foundational Hardening,
-- Phase 4).
--
-- Customer Change already has a real stale-draft check
-- (save_customer_change_draft, supabase/migrations/
-- 20260920070000_customer_change_draft_stale_check.sql): it compares
-- the caller's last-known submission_revisions.row_version against the
-- current one and rejects the write with a human-readable
-- CUSTOMER_CHANGE_DRAFT_STALE error instead of silently overwriting.
--
-- Every other governed draft with a save/edit path was audited for the
-- same silent last-write-wins gap:
--
-- 1. Customer Onboarding (save_customer_onboarding_draft) and Commercial
--    Configuration Version (save_commercial_configuration_version_draft)
--    both edit submission_revisions.raw_data exactly like Customer
--    Change did before its own fix, and had exactly the same gap: no
--    p_expected_row_version parameter, no check. Fixed the same way,
--    against the same submission_revisions.row_version column (already
--    bumped by the pre-existing trg_submission_revisions_row_version
--    trigger; nothing new needed there).
--
-- 2. Go Live (save_go_live_request_draft) has no submission_revisions
--    row at all (it is a direct-fields draft, not a survey/forms-backed
--    one) and go_live_requests itself had no row_version column of its
--    own: a completely unprotected draft. Added the column (bumped by
--    the existing, reusable fn_bump_row_version() trigger, exactly like
--    every other row_version column in this schema) and the same
--    expected-version check.
--
-- 3. Workflow Draft (save_workflow_version_graph) had the identical gap:
--    workflow_definition_versions had no row_version column, so two
--    Workflow Admins editing the same draft graph silently overwrote
--    each other (the last Save Draft's whole-graph-replace simply won).
--    Added the column and the same check.
--
-- commercial_configuration_versions.row_version and
-- customer_onboarding_cases.row_version themselves (the CASE-level
-- columns, distinct from submission_revisions.row_version) remain
-- exactly as supabase/migrations/20260914180000_document_unused_row_version_columns.sql
-- already documented: decorative, protected instead by SELECT ... FOR
-- UPDATE plus a status-text guard in every decision RPC. This migration
-- does not change that; it closes a different, real gap (draft CONTENT
-- edits), not the case-level status machine.
--
-- This file has been written but NOT applied to any database: it is
-- staged for explicit user review/approval before `supabase db push`
-- (Nexus Foundational Hardening Phase 4 checkpoint).

-- =============================================================================
-- 1. Customer Onboarding: save_customer_onboarding_draft gains the check
-- =============================================================================

drop function if exists save_customer_onboarding_draft(uuid, jsonb, text, uuid, jsonb);

create function save_customer_onboarding_draft(
  p_request_id uuid,
  p_raw_data jsonb,
  p_current_stage_key text,
  p_expected_row_version integer,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_onboarding_cases
language plpgsql
as $function$
declare
  v_revision_id uuid;
  v_current_row_version integer;
  v_case customer_onboarding_cases;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select id, row_version into v_revision_id, v_current_row_version
  from submission_revisions
  where request_id = p_request_id and status = 'draft'
  order by revision_number desc
  limit 1
  for update;

  if v_revision_id is null then
    raise exception 'ONBOARDING_NO_DRAFT_REVISION: request % has no draft revision to save', p_request_id;
  end if;

  if v_current_row_version is distinct from p_expected_row_version then
    raise exception 'ONBOARDING_DRAFT_STALE: This draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.';
  end if;

  update submission_revisions
  set raw_data = p_raw_data, updated_by = p_actor_user_id, updated_at = now()
  where id = v_revision_id;

  update customer_onboarding_cases
  set current_stage_key = p_current_stage_key, updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;

comment on function save_customer_onboarding_draft(uuid, jsonb, text, integer, uuid, jsonb) is
  'Saves draft field edits and current stage, rejecting the write with ONBOARDING_DRAFT_STALE if submission_revisions.row_version no longer matches p_expected_row_version, instead of silently overwriting it. Mirrors save_customer_change_draft exactly.';

revoke all on function save_customer_onboarding_draft(uuid, jsonb, text, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function save_customer_onboarding_draft(uuid, jsonb, text, integer, uuid, jsonb) to service_role;

-- =============================================================================
-- 2. Commercial Configuration Version: same fix
-- =============================================================================

drop function if exists save_commercial_configuration_version_draft(uuid, jsonb, uuid, jsonb);

create function save_commercial_configuration_version_draft(
  p_request_id uuid,
  p_raw_data jsonb,
  p_expected_row_version integer,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
as $function$
declare
  v_revision_id uuid;
  v_current_row_version integer;
  v_version commercial_configuration_versions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select id, row_version into v_revision_id, v_current_row_version
  from submission_revisions
  where request_id = p_request_id and status = 'draft'
  order by revision_number desc
  limit 1
  for update;

  if v_revision_id is null then
    raise exception 'COMMERCIAL_VERSION_NO_DRAFT_REVISION: request % has no draft revision to save', p_request_id;
  end if;

  if v_current_row_version is distinct from p_expected_row_version then
    raise exception 'COMMERCIAL_VERSION_DRAFT_STALE: This draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.';
  end if;

  update submission_revisions
  set raw_data = p_raw_data, updated_by = p_actor_user_id, updated_at = now()
  where id = v_revision_id;

  update commercial_configuration_versions
  set updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;

comment on function save_commercial_configuration_version_draft(uuid, jsonb, integer, uuid, jsonb) is
  'Saves draft Commercial Rate edits, rejecting the write with COMMERCIAL_VERSION_DRAFT_STALE if submission_revisions.row_version no longer matches p_expected_row_version. Mirrors save_customer_change_draft exactly.';

revoke all on function save_commercial_configuration_version_draft(uuid, jsonb, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function save_commercial_configuration_version_draft(uuid, jsonb, integer, uuid, jsonb) to service_role;

-- =============================================================================
-- 3. Go Live: add row_version, wire the same check
-- =============================================================================

alter table go_live_requests add column row_version integer not null default 1;

comment on column go_live_requests.row_version is
  'Real, actively-checked optimistic lock: bumped by trg_go_live_requests_row_version on every UPDATE, compared against p_expected_row_version in save_go_live_request_draft. Unlike commercial_configuration_versions.row_version/customer_onboarding_cases.row_version (see 20260914180000_document_unused_row_version_columns.sql), this one is wired.';

create trigger trg_go_live_requests_row_version
  before update on go_live_requests
  for each row
  execute function fn_bump_row_version();

drop function if exists save_go_live_request_draft(uuid, date, boolean, text, uuid, jsonb);

create function save_go_live_request_draft(
  p_id uuid,
  p_go_live_date date,
  p_prorate_first_month boolean,
  p_comment text,
  p_expected_row_version integer,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.status not in ('draft', 'sent_back') then
    raise exception 'GO_LIVE_REQUEST_NOT_EDITABLE: request % has status %, only a draft or sent-back request may be edited', p_id, v_row.status;
  end if;

  if v_row.row_version <> p_expected_row_version then
    raise exception 'GO_LIVE_DRAFT_STALE: This draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.';
  end if;

  update go_live_requests
  set go_live_date = p_go_live_date,
      prorate_first_month = p_prorate_first_month,
      comment = p_comment,
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

comment on function save_go_live_request_draft(uuid, date, boolean, text, integer, uuid, jsonb) is
  'Saves a draft/sent-back Go Live request''s editable fields, rejecting the write with GO_LIVE_DRAFT_STALE if row_version no longer matches p_expected_row_version.';

revoke all on function save_go_live_request_draft(uuid, date, boolean, text, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function save_go_live_request_draft(uuid, date, boolean, text, integer, uuid, jsonb) to service_role;

-- =============================================================================
-- 4. Workflow Draft: two Workflow Admins editing the same draft graph
-- =============================================================================

alter table workflow_definition_versions add column row_version integer not null default 1;

comment on column workflow_definition_versions.row_version is
  'Optimistic lock for the draft graph itself: bumped on every UPDATE (including every save_workflow_version_graph whole-graph replace), compared against p_expected_row_version. Two Workflow Admins editing the same draft no longer silently overwrite each other.';

create trigger trg_workflow_definition_versions_row_version
  before update on workflow_definition_versions
  for each row
  execute function fn_bump_row_version();

drop function if exists save_workflow_version_graph(uuid, jsonb, jsonb, uuid, jsonb);

create function save_workflow_version_graph(
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
    values (p_version_id, v_edge ->> 'from_node_key', v_edge ->> 'to_node_key', nullif(v_edge ->> 'label', ''), v_edge -> 'condition');
  end loop;

  update workflow_definition_versions set updated_by = p_actor_user_id, updated_at = now() where id = p_version_id
  returning * into v_version;

  return v_version;
end;
$function$;

comment on function save_workflow_version_graph(uuid, jsonb, jsonb, integer, uuid, jsonb) is
  'Whole-graph replace for a draft Workflow Version, rejecting the write with WORKFLOW_VERSION_DRAFT_STALE if row_version no longer matches p_expected_row_version (another Workflow Admin''s save landed first).';

revoke all on function save_workflow_version_graph(uuid, jsonb, jsonb, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function save_workflow_version_graph(uuid, jsonb, jsonb, integer, uuid, jsonb) to service_role;
