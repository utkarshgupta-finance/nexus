-- Nexus: NEXUS ACCEPTANCE CLOSURE. Fixes a real defect found while
-- testing the Go Live maker/checker flow end to end: submitting
-- GLR-000003 changed its status from Draft to Submitted, but the
-- request's own Timeline never gained a "Submitted" event, only ever
-- showing the original "Go Live request created" entry.
--
-- Root cause: unlike Customer Onboarding (which tracks every submission
-- via a real `submission_revisions` table with `submitted_at`/
-- `submitted_by`), `go_live_requests` never gained the equivalent
-- columns when this domain was built, even though it already carries
-- the identical "single latest actor snapshot" shape for every other
-- lifecycle event on this same table (`approved_by`/`approved_at`,
-- `cancelled_by`/`cancelled_at`, `sent_back_by`/`sent_back_at`).
--
-- Fix mirrors that exact, already-established shape: one snapshot pair
-- of columns, set on every submit (including a resubmission after
-- send-back, since Go Live has no separate revisions history table and
-- was never designed to need one). No new history table invented here;
-- send-backs already have their own permanent history
-- (`go_live_send_backs`) for exactly the case that needs more than one
-- remembered instance.
--
-- This file has not been applied to any database as of authoring.

alter table go_live_requests add column submitted_by uuid references app_users (id) on delete restrict;
alter table go_live_requests add column submitted_at timestamptz;

create or replace function submit_go_live_request(
  p_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
  v_next_status text;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.status not in ('draft', 'sent_back') then
    raise exception 'GO_LIVE_REQUEST_NOT_SUBMITTABLE: request % has status %, only a draft or sent-back request may be submitted', p_id, v_row.status;
  end if;

  -- Submission is allowed before final customer confirmation ("Go Live
  -- workflow may be submitted before final confirmation if business
  -- workflow allows"); only the final approval below enforces it.
  v_next_status := case when v_row.status = 'sent_back' then 'resubmitted' else 'submitted' end;

  update go_live_requests
  set status = v_next_status, submitted_by = p_actor_user_id, submitted_at = now(), updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;
