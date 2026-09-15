-- Nexus: NEXUS ACCEPTANCE CLOSURE. Fixes a real, reproduced concurrency
-- defect: two browser tabs opened the same Customer Change Request
-- draft, each edited a different field, tab A saved first, then tab B
-- (still holding A's now-stale in-memory copy) saved second. Tab B's
-- save silently discarded tab A's already-persisted field change: no
-- error, no conflict message, nothing. Verified by reloading fresh from
-- the server afterward. This directly contradicts the documented
-- optimistic-locking principle this codebase otherwise follows (see
-- `submit_revision`'s own DRAFT_CHANGED check,
-- 20260907044335_submission_data_foundation.sql).
--
-- `docs/DATA_ARCHITECTURE.md` previously accepted this as intentional
-- ("a draft on these three request types has exactly one editor... so
-- last-write-wins is the correct, simplest semantics, not a gap"). That
-- premise is false: the same person in two tabs, or two different
-- people both holding edit access to one governed draft, is a real,
-- reachable case, and Send Back explicitly hands edit access back to
-- the requester while a checker may still have the record open.
--
-- Fix mirrors the exact pattern already established by `submit_revision`
-- for the identical `submission_revisions.row_version` column: accept
-- the caller's last-known row_version, lock the row, compare, and raise
-- a named, human-readable error on mismatch rather than silently
-- overwriting. `submission_revisions.row_version` already exists and is
-- already bumped by the pre-existing `trg_submission_revisions_row_version`
-- trigger on every UPDATE; this only adds the missing CHECK before the
-- write that `submit_revision` already had but
-- `save_customer_change_draft` never gained.
--
-- This file has not been applied to any database as of authoring.

-- CREATE OR REPLACE cannot change this function's signature (a new
-- required parameter was inserted); the old 4-argument overload must be
-- dropped explicitly, or it would keep existing alongside the new one.
drop function if exists save_customer_change_draft(uuid, jsonb, uuid, jsonb);

create function save_customer_change_draft(
  p_request_id uuid,
  p_raw_data jsonb,
  p_expected_row_version integer,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_revision_id uuid;
  v_current_row_version integer;
  v_change_request customer_change_requests;
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
    raise exception 'CUSTOMER_CHANGE_NO_DRAFT_REVISION: request % has no draft revision to save', p_request_id;
  end if;

  if v_current_row_version is distinct from p_expected_row_version then
    raise exception 'CUSTOMER_CHANGE_DRAFT_STALE: This draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.';
  end if;

  update submission_revisions
  set raw_data = p_raw_data, updated_by = p_actor_user_id, updated_at = now()
  where id = v_revision_id;

  update customer_change_requests
  set updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

comment on function save_customer_change_draft(uuid, jsonb, integer, uuid, jsonb) is
  'Saves draft field edits, rejecting the write with CUSTOMER_CHANGE_DRAFT_STALE if submission_revisions.row_version no longer matches p_expected_row_version (another save landed first since the caller last loaded this draft), instead of silently overwriting it.';

revoke execute on function save_customer_change_draft(uuid, jsonb, integer, uuid, jsonb) from anon, authenticated;
grant execute on function save_customer_change_draft(uuid, jsonb, integer, uuid, jsonb) to service_role;
