-- Nexus: Customer Onboarding draft Save/Submit creator-only enforcement.
--
-- Found live during NEXUS END-TO-END BUSINESS JOURNEY VALIDATION BATCH 7
-- while executing A-002's own explicitly scheduled "Authorization
-- Variant" ("Another user, non-creator, non-admin, attempts to save the
-- draft, expect denial") and A-003's own explicitly scheduled
-- Authorization Variant note ("confirm only the creator or an assigned
-- collaborator can submit, per product's actual model, verify against
-- code"). Both saveOnboardingDraftAction and submitOnboardingCaseAction
-- (src/features/customer-onboarding/actions.ts) only ever checked the
-- blanket customer.create permission, never that the caller is the
-- case's own created_by. Reproduced live: a second maker, holding only
-- customer.create and not the creator of a given draft, could open,
-- edit, and submit another maker's in-progress onboarding case merely
-- by knowing its request_id.
--
-- cancel_customer_onboarding_case already enforces exactly this
-- ownership rule (ONBOARDING_CASE_CANCEL_NOT_OWNER, migration
-- 20260916010000_draft_cancel_discard.sql). This migration brings Save
-- and Submit in line with that same, already-established pattern:
-- ownership is checked in the RPC itself, the authoritative boundary,
-- not only in the TypeScript service/action layer, so a raw RPC caller
-- with a stolen p_actor_user_id still cannot bypass it any more than a
-- browser client could.
--
-- Read (viewing another maker's draft by request_id) is not addressed
-- here: neither A-002 nor A-003's Authorization Variant names a read
-- restriction, only a write/mutation one, and narrowing read access
-- would require a product decision about whether same-team visibility
-- into in-progress drafts is intentional. Recorded separately as a new
-- journey (A-036) for a future batch rather than folded into this fix.

drop function if exists save_customer_onboarding_draft(uuid, jsonb, text, integer, uuid, jsonb);

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
  v_created_by uuid;
  v_case customer_onboarding_cases;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select created_by into v_created_by from customer_onboarding_cases where request_id = p_request_id;
  if v_created_by is null then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_created_by is distinct from p_actor_user_id then
    raise exception 'ONBOARDING_DRAFT_SAVE_NOT_OWNER: only the creator of case % may edit this draft', p_request_id;
  end if;

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
  'Saves draft field edits and current stage. Rejects with ONBOARDING_DRAFT_SAVE_NOT_OWNER if the caller is not the case creator, and with ONBOARDING_DRAFT_STALE if submission_revisions.row_version no longer matches p_expected_row_version.';

revoke all on function save_customer_onboarding_draft(uuid, jsonb, text, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function save_customer_onboarding_draft(uuid, jsonb, text, integer, uuid, jsonb) to service_role;

drop function if exists submit_customer_onboarding_case(uuid, uuid, jsonb);

create function submit_customer_onboarding_case(
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
  v_next record;
  v_new_status text;
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

  if v_case.created_by is distinct from p_actor_user_id then
    raise exception 'ONBOARDING_CASE_SUBMIT_NOT_OWNER: only the creator of case % may submit it', p_request_id;
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

  insert into customer_onboarding_revision_documents (request_id, revision_number, document_type, document_id)
  select request_id, v_revision.revision_number, document_type, document_id
  from customer_onboarding_documents
  where request_id = p_request_id and is_current = true
  on conflict (request_id, revision_number, document_type) do nothing;

  select * into v_next
  from fn_resolve_workflow_next_approval(v_case.workflow_version_id, null, jsonb_build_object('segment', v_revision.raw_data ->> 'segment'));

  v_new_status := case when v_case.status = 'sent_back' then 'resubmitted' else 'submitted' end;

  update customer_onboarding_cases
  set status = v_new_status,
      current_workflow_node_key = v_next.node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  if v_case.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('customer_onboarding', p_request_id, v_case.workflow_version_id, v_case.workflow_cycle_number, null, v_next.node_key, 'submit', p_actor_user_id, null);
  end if;

  return v_case;
end;
$function$;

comment on function submit_customer_onboarding_case(uuid, uuid, jsonb) is
  'Submits (or resubmits) a draft/sent_back case. Rejects with ONBOARDING_CASE_SUBMIT_NOT_OWNER if the caller is not the case creator, and with ONBOARDING_CASE_NOT_SUBMITTABLE if the case status does not allow it.';

revoke all on function submit_customer_onboarding_case(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function submit_customer_onboarding_case(uuid, uuid, jsonb) to service_role;
