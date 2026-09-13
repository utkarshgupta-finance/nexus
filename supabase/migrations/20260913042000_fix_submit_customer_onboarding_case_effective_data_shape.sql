-- Nexus: fix submit_customer_onboarding_case's effective_data shape.
--
-- submission_revisions' own chk_submission_revisions_lifecycle constraint
-- (20260907044335_submission_data_foundation.sql) requires effective_data,
-- once submission_contract_version = 1 (the default, and the one real
-- contract this platform has today), to be an object with both a "values"
-- key and an "applicability" key. The previous version of this function
-- passed the raw onboarding data straight through as effective_data, which
-- violates that shape and was caught during smoke testing before any real
-- onboarding case reached Submit.
--
-- "applicability" is intentionally an empty object here, not a fabricated
-- per-question visibility map: Customer Onboarding has no conditional
-- question logic implemented yet, and an honest empty object is correct
-- for that state (do not fake a value that has no real meaning yet).
--
-- This file has not been applied to any database as of authoring.

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

  update customer_onboarding_cases
  set status = case when v_case.status = 'sent_back' then 'resubmitted' else 'submitted' end,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;
