-- Nexus Operating Platform Expansion, Phase A: attachment continuity
-- across revisions.
--
-- customer_onboarding_documents is request-scoped, not revision-scoped
-- (by design: re-uploading the same document_type supersedes the prior
-- row, it never duplicates bytes). That is correct for "what evidence is
-- current right now," but it cannot answer "what evidence supported
-- revision 2's specific submission" once a later revision replaces one
-- attachment: the old row's `is_current` flips to false and there was
-- previously no way to reconstruct which document was current at the
-- moment a given revision was submitted.
--
-- This table is a thin, append-only snapshot: one row per
-- (request, revision, document_type), pointing at the exact document
-- row that was current at submit time. It stores a reference only,
-- never a copy of file bytes or metadata, so a replaced attachment's
-- historical submission is still reconstructible without any
-- duplication.

create table customer_onboarding_revision_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests (id),
  revision_number integer not null,
  document_type text not null,
  document_id uuid not null references customer_onboarding_documents (document_id),
  created_at timestamptz not null default now(),
  unique (request_id, revision_number, document_type)
);

alter table customer_onboarding_revision_documents enable row level security;

create index idx_customer_onboarding_revision_documents_request
  on customer_onboarding_revision_documents (request_id, revision_number);

grant select, insert on customer_onboarding_revision_documents to service_role;
revoke all on customer_onboarding_revision_documents from anon, authenticated;

-- Same exact 3-parameter signature as the prior version (no added
-- parameter), so this replaces in place with zero overload-ambiguity
-- risk, per the lesson from the earlier onboarding send-back incident.
create or replace function submit_customer_onboarding_case(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_onboarding_cases
language plpgsql
as $function$
declare
  v_revision submission_revisions;
  v_case customer_onboarding_cases;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_case.status not in ('draft', 'sent_back') then
    raise exception 'ONBOARDING_CASE_NOT_SUBMITTABLE: case % has status %, only draft or sent_back may be submitted', p_request_id, v_case.status;
  end if;

  select * into v_revision
  from submission_revisions
  where request_id = p_request_id and status = 'draft'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'ONBOARDING_NO_DRAFT_REVISION: request % has no draft revision to submit', p_request_id;
  end if;

  perform submit_revision(
    v_revision.id, v_revision.row_version,
    jsonb_build_object('values', v_revision.raw_data, 'applicability', '{}'::jsonb),
    p_actor_user_id, null, p_actor_context
  );

  -- Snapshot exactly which document backed each attachment type at the
  -- moment of this submission, so a later replacement never erases the
  -- historical record of what evidence this specific revision had.
  insert into customer_onboarding_revision_documents (request_id, revision_number, document_type, document_id)
  select request_id, v_revision.revision_number, document_type, document_id
  from customer_onboarding_documents
  where request_id = p_request_id and is_current = true
  on conflict (request_id, revision_number, document_type) do nothing;

  update customer_onboarding_cases
  set status = case when v_case.status = 'sent_back' then 'resubmitted' else 'submitted' end,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;
