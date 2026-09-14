-- =============================================================================
-- customer_onboarding_send_backs: permanent, append-only send-back history
-- =============================================================================
-- customer_onboarding_cases only ever stores the LATEST send-back
-- (sent_back_reason/sent_back_by/sent_back_at/sent_back_target_stage_key),
-- overwritten on every send-back. A reviewer's decision to return a case is
-- real business history (docs/CUSTOMER_LIFECYCLE.md): the requester's Send
-- Back count and the request Timeline both need every past send-back, not
-- just the most recent, so this table records one permanent row per
-- send-back, mirroring customer_field_history's own append-only shape
-- (20260913060000_customer_change_request_foundation.sql).

create table customer_onboarding_send_backs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references customer_onboarding_cases (request_id),
  revision_number int not null,
  reason text not null,
  target_stage_key text,
  sent_back_by uuid references app_users (id),
  sent_back_at timestamptz not null default now()
);

comment on table customer_onboarding_send_backs is
  'Permanent, one-row-per-send-back history for a Customer Onboarding case. The Send Back count shown to a requester is derived by counting these rows, never a manually incremented UI counter. revision_number is the submitted revision that was reviewed and returned.';

create index idx_customer_onboarding_send_backs_request_id on customer_onboarding_send_backs (request_id, sent_back_at);

revoke all on customer_onboarding_send_backs from anon, authenticated;
grant select, insert on customer_onboarding_send_backs to service_role;

-- =============================================================================
-- customer_onboarding_field_comments: reviewer comments on specific fields
-- =============================================================================
-- A Send Back's overall reason (customer_onboarding_send_backs.reason) is
-- one comment for the whole case. A reviewer separately needs to flag
-- individual fields (task spec: "GST Number", "Registered Address",
-- "Commercial Effective From"). Keyed by the field's stable KEY (matching
-- SurveyJS's own question name, e.g. CUSTOMER_ONBOARDING_FIELD_KEYS.gstNumber),
-- never by the field's display label, so a later label wording change never
-- orphans a historical comment. Comments are never overwritten: resubmitting
-- opens a new revision, but every prior revision's field comments remain
-- historically visible (task spec).

create table customer_onboarding_field_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references customer_onboarding_cases (request_id),
  revision_number int not null,
  field_key text not null,
  comment text not null,
  reviewer_id uuid references app_users (id),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table customer_onboarding_field_comments is
  'Permanent, one-row-per-comment field-level reviewer feedback for a Customer Onboarding case, keyed by the field''s stable key (never its display label). resolved is recorded for a future "mark resolved" action; nothing sets it yet.';

create index idx_customer_onboarding_field_comments_request_id on customer_onboarding_field_comments (request_id, created_at);

revoke all on customer_onboarding_field_comments from anon, authenticated;
grant select, insert on customer_onboarding_field_comments to service_role;

-- =============================================================================
-- send_back_customer_onboarding_case: extended to log history + field comments
-- =============================================================================
-- Adds p_field_comments (jsonb array of {"field_key": "...", "comment": "..."})
-- as a new trailing parameter with a default, so existing callers that omit
-- it keep working unchanged. The overall comment is still p_reason (already
-- required, already stored on customer_onboarding_cases.sent_back_reason);
-- this migration only adds the permanent history rows alongside it.

create or replace function send_back_customer_onboarding_case(
  p_request_id uuid,
  p_reason text,
  p_target_stage_key text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_field_comments jsonb default '[]'::jsonb
)
returns customer_onboarding_cases
language plpgsql
as $function$
declare
  v_case customer_onboarding_cases;
  v_next_revision submission_revisions;
  v_latest_submitted submission_revisions;
  v_field_comment jsonb;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'ONBOARDING_SEND_BACK_REASON_REQUIRED: a reason is required to send a case back';
  end if;

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_case.status not in ('submitted', 'resubmitted') then
    raise exception 'ONBOARDING_CASE_NOT_SENDBACKABLE: case % has status %, only submitted or resubmitted may be sent back', p_request_id, v_case.status;
  end if;

  select * into v_latest_submitted
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  -- Opens the next draft revision immediately (case.ts's own startNextRevision
  -- semantics: editing resumes on revision N+1, the submitted revision that
  -- was actually reviewed is never touched), so the requester can start
  -- editing the moment they see the send-back, with no separate "start next
  -- revision" click required.
  select * into v_next_revision from create_next_revision(p_request_id, v_latest_submitted.id, p_actor_user_id, null, p_actor_context);

  update customer_onboarding_cases
  set status = 'sent_back',
      sent_back_reason = p_reason,
      sent_back_by = p_actor_user_id,
      sent_back_at = now(),
      sent_back_target_stage_key = p_target_stage_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  insert into customer_onboarding_send_backs (request_id, revision_number, reason, target_stage_key, sent_back_by)
  values (p_request_id, v_latest_submitted.revision_number, p_reason, p_target_stage_key, p_actor_user_id);

  for v_field_comment in select * from jsonb_array_elements(coalesce(p_field_comments, '[]'::jsonb))
  loop
    if btrim(coalesce(v_field_comment ->> 'comment', '')) = '' then
      continue;
    end if;
    insert into customer_onboarding_field_comments (request_id, revision_number, field_key, comment, reviewer_id)
    values (p_request_id, v_latest_submitted.revision_number, v_field_comment ->> 'field_key', v_field_comment ->> 'comment', p_actor_user_id);
  end loop;

  return v_case;
end;
$function$;

grant execute on function send_back_customer_onboarding_case(uuid, text, text, uuid, jsonb, jsonb) to service_role;
revoke execute on function send_back_customer_onboarding_case(uuid, text, text, uuid, jsonb, jsonb) from anon, authenticated;
