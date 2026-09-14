-- Nexus: Platform Operating Expansion, Phase C/G. Draft cancel/discard for
-- Customer Onboarding, Customer Change Request, and Commercial
-- Configuration Version.
--
-- All three lifecycles could previously only progress forward (draft ->
-- submitted -> ...); a requester who opened one by mistake, or no longer
-- needs it, had no way to close it out. This adds one new terminal status,
-- 'cancelled', to each table, plus cancelled_by/cancelled_at/cancelled_reason
-- columns following the exact same shape sent_back_by/sent_back_at/
-- sent_back_reason already established. A draft->cancelled transition is
-- used (never a physical delete), so a cancelled item remains historically
-- visible, matching every other governed lifecycle's audit posture in this
-- codebase.
--
-- Scoped to status = 'draft' only, deliberately: a case/request/version
-- that has ever been submitted has real reviewer-facing history (comments,
-- a submitted revision, in Commercial Version's case a live approval
-- queue entry), so withdrawing something already in flight is a bigger,
-- separate decision left to a future phase (see docs/CUSTOMER_LIFECYCLE.md,
-- system-wide cancel/withdraw audit). Only the creator may cancel their
-- own draft; this is checked here, in the RPC itself, not only in the
-- calling Server Action, so the rule holds even if a future caller reaches
-- this RPC directly.
--
-- This file has not been applied to any database as of authoring.

-- =============================================================================
-- customer_onboarding_cases
-- =============================================================================

alter table customer_onboarding_cases drop constraint if exists customer_onboarding_cases_status_check;
alter table customer_onboarding_cases add constraint customer_onboarding_cases_status_check
  check (status in ('draft', 'submitted', 'sent_back', 'resubmitted', 'approved', 'cancelled'));

alter table customer_onboarding_cases add column cancelled_by uuid references app_users (id);
alter table customer_onboarding_cases add column cancelled_at timestamptz;
alter table customer_onboarding_cases add column cancelled_reason text;

create or replace function cancel_customer_onboarding_case(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_onboarding_cases
language plpgsql
as $function$
declare
  v_case customer_onboarding_cases;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_case.status <> 'draft' then
    raise exception 'ONBOARDING_CASE_NOT_CANCELLABLE: case % has status %, only a draft may be cancelled', p_request_id, v_case.status;
  end if;

  if v_case.created_by is distinct from p_actor_user_id then
    raise exception 'ONBOARDING_CASE_CANCEL_NOT_OWNER: only the creator of case % may cancel it', p_request_id;
  end if;

  update customer_onboarding_cases
  set status = 'cancelled',
      cancelled_by = p_actor_user_id,
      cancelled_at = now(),
      cancelled_reason = p_reason,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;

-- =============================================================================
-- customer_change_requests
-- =============================================================================

alter table customer_change_requests drop constraint if exists customer_change_requests_status_check;
alter table customer_change_requests add constraint customer_change_requests_status_check
  check (status in ('draft', 'submitted', 'sent_back', 'resubmitted', 'approved', 'rejected', 'cancelled'));

alter table customer_change_requests add column cancelled_by uuid references app_users (id);
alter table customer_change_requests add column cancelled_at timestamptz;
alter table customer_change_requests add column cancelled_reason text;

create or replace function cancel_customer_change_request(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_request customer_change_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_request.status <> 'draft' then
    raise exception 'CUSTOMER_CHANGE_NOT_CANCELLABLE: request % has status %, only a draft may be cancelled', p_request_id, v_request.status;
  end if;

  if v_request.created_by is distinct from p_actor_user_id then
    raise exception 'CUSTOMER_CHANGE_CANCEL_NOT_OWNER: only the creator of request % may cancel it', p_request_id;
  end if;

  update customer_change_requests
  set status = 'cancelled',
      cancelled_by = p_actor_user_id,
      cancelled_at = now(),
      cancelled_reason = p_reason,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_request;

  return v_request;
end;
$function$;

-- =============================================================================
-- commercial_configuration_versions
-- =============================================================================

alter table commercial_configuration_versions drop constraint if exists commercial_configuration_versions_status_check;
alter table commercial_configuration_versions add constraint commercial_configuration_versions_status_check
  check (status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled'));

alter table commercial_configuration_versions add column cancelled_by uuid references app_users (id);
alter table commercial_configuration_versions add column cancelled_at timestamptz;
alter table commercial_configuration_versions add column cancelled_reason text;

create or replace function cancel_commercial_configuration_version(
  p_request_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
as $function$
declare
  v_version commercial_configuration_versions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from commercial_configuration_versions where request_id = p_request_id for update;
  if not found then
    raise exception 'COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for request %', p_request_id;
  end if;

  if v_version.status <> 'draft' then
    raise exception 'COMMERCIAL_VERSION_NOT_CANCELLABLE: version % has status %, only a draft may be cancelled', p_request_id, v_version.status;
  end if;

  if v_version.created_by is distinct from p_actor_user_id then
    raise exception 'COMMERCIAL_VERSION_CANCEL_NOT_OWNER: only the creator of version % may cancel it', p_request_id;
  end if;

  update commercial_configuration_versions
  set status = 'cancelled',
      cancelled_by = p_actor_user_id,
      cancelled_at = now(),
      cancelled_reason = p_reason,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;
