-- =============================================================================
-- customer_change_send_backs: permanent, append-only send-back history
-- =============================================================================
-- customer_change_requests only ever stores the LATEST send-back
-- (sent_back_reason/sent_back_by/sent_back_at), overwritten on every
-- send-back, exactly the same gap customer_onboarding_cases had before
-- 20260914130000_customer_onboarding_send_back_history.sql fixed it.
-- Mirrors that table's shape, and customer_field_history's own
-- append-only precedent, so a Customer Change Request's Send Back count
-- and Timeline (Platform Scale Program, Phase I / CFO lens: "explain six
-- months later who sent this back, when, and why") are both derivable
-- from real history, not a single overwritten row.

create table customer_change_send_backs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references customer_change_requests (request_id),
  revision_number int not null,
  reason text not null,
  sent_back_by uuid references app_users (id),
  sent_back_at timestamptz not null default now()
);

comment on table customer_change_send_backs is
  'Permanent, one-row-per-send-back history for a Customer Change Request, mirroring customer_onboarding_send_backs. The Send Back count is count(*) over this table, never a manually incremented counter.';

create index idx_customer_change_send_backs_request_id on customer_change_send_backs (request_id, sent_back_at);

alter table customer_change_send_backs enable row level security;
revoke all on customer_change_send_backs from anon, authenticated;
grant select, insert on customer_change_send_backs to service_role;

-- =============================================================================
-- send_back_customer_change_request: extended to log history, same signature
-- =============================================================================
-- Unlike the earlier onboarding fix, this keeps the EXACT same parameter
-- list (no new parameter added), so `create or replace function` safely
-- replaces the existing function in place: no second overload is
-- created, the exact bug class 20260914140000 had to correct for.

create or replace function send_back_customer_change_request(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_change_request customer_change_requests;
  v_latest_submitted submission_revisions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'CUSTOMER_CHANGE_SEND_BACK_REASON_REQUIRED: a reason is required to send this Change Request back';
  end if;

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_change_request.status not in ('submitted', 'resubmitted') then
    raise exception 'CUSTOMER_CHANGE_NOT_SENDBACKABLE: request % has status %, only submitted or resubmitted may be sent back', p_request_id, v_change_request.status;
  end if;

  select * into v_latest_submitted
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  perform create_next_revision(p_request_id, v_latest_submitted.id, p_actor_user_id, null, p_actor_context);

  update customer_change_requests
  set status = 'sent_back', sent_back_reason = p_reason, sent_back_by = p_actor_user_id, sent_back_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  insert into customer_change_send_backs (request_id, revision_number, reason, sent_back_by)
  values (p_request_id, v_latest_submitted.revision_number, p_reason, p_actor_user_id);

  return v_change_request;
end;
$function$;
