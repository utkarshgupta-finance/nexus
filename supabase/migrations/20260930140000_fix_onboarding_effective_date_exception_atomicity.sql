-- PD-002 (Product Decision Closure, end-to-end verification): fixes a
-- real defect found by live-exercising the exception workflow for the
-- first time. `approve_customer_onboarding_case` (20260930120000) lazily
-- inserted the `onboarding_effective_date_exceptions` row and then, in
-- the same statement, raised `ONBOARDING_EFFECTIVE_DATE_EXCEPTION_PENDING`
-- to block finalization. A Postgres RPC call is one implicit transaction:
-- raising an exception rolls back everything in it, including that
-- insert. The row never actually persisted, so
-- `approve_onboarding_effective_date_exception` could never find it to
-- approve; the mechanism as originally built could not be exercised at
-- all.
--
-- Fix: split "durably record that this case needs the exception" into
-- its own RPC (`ensure_onboarding_effective_date_exception`), called by
-- the application as its own statement/transaction before attempting the
-- finalizing approve, so the insert survives independently of whether
-- that approve attempt itself then blocks. `approve_customer_onboarding_case`
-- itself no longer inserts; it only reads and blocks, exactly as before
-- from the outside (same error token, same message shape).

create function ensure_onboarding_effective_date_exception(
  p_request_id uuid,
  p_effective_date date,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns onboarding_effective_date_exceptions
language plpgsql
security invoker
as $function$
declare
  v_case customer_onboarding_cases;
  v_exception onboarding_effective_date_exceptions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_case from customer_onboarding_cases where request_id = p_request_id;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  -- Not a backdated case: nothing to record, and this must never raise
  -- for the ordinary (non-backdated) approval path that calls it every
  -- time as a cheap no-op prerequisite.
  if p_effective_date >= v_case.created_at::date then
    return null;
  end if;

  select * into v_exception from onboarding_effective_date_exceptions where case_request_id = p_request_id for update;
  if not found then
    insert into onboarding_effective_date_exceptions (case_request_id, effective_date, onboarding_date, created_by)
    values (p_request_id, p_effective_date, v_case.created_at::date, p_actor_user_id)
    returning * into v_exception;
  end if;

  return v_exception;
end;
$function$;

comment on function ensure_onboarding_effective_date_exception(uuid, date, uuid, jsonb) is
  'PD-002: durably records (own transaction) that a case''s chosen effective_date is before its onboarding date, lazily creating the onboarding_effective_date_exceptions row on first call. Returns null (not an error) when the date is not actually backdated. Must be called by the application before approve_customer_onboarding_case''s finalizing attempt, since that RPC''s own transaction rolls back on the PENDING exception it raises and can no longer create this row itself.';

revoke all on function ensure_onboarding_effective_date_exception(uuid, date, uuid, jsonb) from public, anon, authenticated;
grant execute on function ensure_onboarding_effective_date_exception(uuid, date, uuid, jsonb) to service_role;

-- Re-point approve_customer_onboarding_case at a read-only check: no more
-- insert here, since it could never survive the raise that follows it.
create or replace function approve_customer_onboarding_case(
  p_request_id uuid,
  p_customer_key text,
  p_customer_name text,
  p_commercial_configuration_key text,
  p_commercial_configuration_name text,
  p_components jsonb,
  p_effective_date date,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_customer_fields jsonb default '{}'::jsonb,
  p_expected_current_node_key text default null
)
returns customer_onboarding_cases
language plpgsql
security invoker
as $function$
declare
  v_case customer_onboarding_cases;
  v_latest_revision submission_revisions;
  v_customer_id uuid;
  v_system_request_id uuid;
  v_commercial_configuration_id uuid;
  v_commercial_change_id uuid;
  v_component jsonb;
  v_new_component_id uuid;
  v_mug_threshold numeric;
  v_current_team_id uuid;
  v_next record;
  v_should_finalize boolean;
  v_new_current_node_key text;
  v_exception onboarding_effective_date_exceptions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_case.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_case.status = 'approved' then
    return v_case;
  end if;

  if v_case.status not in ('submitted', 'resubmitted') then
    raise exception 'ONBOARDING_CASE_NOT_APPROVABLE: case % has status %, only submitted or resubmitted may be approved', p_request_id, v_case.status;
  end if;

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_case.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  select * into v_latest_revision
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'ONBOARDING_NO_SUBMITTED_REVISION: case % has no submitted revision to approve', p_request_id;
  end if;

  v_current_team_id := fn_workflow_node_team(v_case.workflow_version_id, v_case.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select * into v_next
  from fn_resolve_workflow_next_approval(v_case.workflow_version_id, v_case.current_workflow_node_key, jsonb_build_object('segment', p_customer_fields ->> 'segment'));

  if v_next.node_type is null then
    if v_case.current_workflow_node_key is null then
      v_should_finalize := true;
      v_new_current_node_key := null;
    else
      raise exception 'WORKFLOW_GRAPH_DEAD_END: this case''s workflow has no reachable Approval or End node after node "%"; ask a Workflow Admin to fix the graph', v_case.current_workflow_node_key;
    end if;
  elsif v_next.node_type = 'approval' then
    v_should_finalize := false;
    v_new_current_node_key := v_next.node_key;
  else
    v_should_finalize := true;
    v_new_current_node_key := v_next.node_key;
  end if;

  if v_case.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('customer_onboarding', p_request_id, v_case.workflow_version_id, v_case.workflow_cycle_number, v_case.current_workflow_node_key, v_new_current_node_key, 'approve', p_actor_user_id, null);
  end if;

  if not v_should_finalize then
    update customer_onboarding_cases
    set current_workflow_node_key = v_new_current_node_key,
        updated_by = p_actor_user_id, updated_at = now()
    where request_id = p_request_id
    returning * into v_case;

    return v_case;
  end if;

  -- PD-002: only checked at the point of actual finalization. No longer
  -- inserts here (that insert could never survive this function's own
  -- rollback on raise); the application must have already called
  -- ensure_onboarding_effective_date_exception as its own prior
  -- statement/transaction for this row to be found here.
  if p_effective_date < v_case.created_at::date then
    select * into v_exception from onboarding_effective_date_exceptions where case_request_id = p_request_id for update;
    if not found or v_exception.bu_head_approved_by is null or v_exception.finance_head_approved_by is null then
      raise exception 'ONBOARDING_EFFECTIVE_DATE_EXCEPTION_PENDING: effective_date % is before this case''s onboarding date %; both a BU Head and a Finance Head must approve via approve_onboarding_effective_date_exception before this case can finalize (bu_head approved: %, finance_head approved: %)',
        p_effective_date, v_case.created_at::date,
        coalesce(v_exception.bu_head_approved_by is not null, false),
        coalesce(v_exception.finance_head_approved_by is not null, false);
    end if;
  end if;

  insert into customers (
    key, name, brand_name, created_by, updated_by,
    address, state, city, postal_code, website,
    primary_contact_name, primary_contact_email, primary_contact_phone_country_code,
    primary_contact_phone_number, primary_contact_designation,
    gst_number, pan, tan, tax_identifier_type, tax_identifier_name, tax_registration_number,
    company_document_type, company_document_type_other, billing_currency
  )
  values (
    p_customer_key, p_customer_name, p_customer_fields ->> 'brand_name', p_actor_user_id, p_actor_user_id,
    p_customer_fields ->> 'address', p_customer_fields ->> 'state', p_customer_fields ->> 'city',
    p_customer_fields ->> 'postal_code', p_customer_fields ->> 'website',
    p_customer_fields ->> 'primary_contact_name', p_customer_fields ->> 'primary_contact_email',
    p_customer_fields ->> 'primary_contact_phone_country_code', p_customer_fields ->> 'primary_contact_phone_number',
    p_customer_fields ->> 'primary_contact_designation',
    p_customer_fields ->> 'gst_number', p_customer_fields ->> 'pan', p_customer_fields ->> 'tan',
    p_customer_fields ->> 'tax_identifier_type', p_customer_fields ->> 'tax_identifier_name', p_customer_fields ->> 'tax_registration_number',
    p_customer_fields ->> 'company_document_type', p_customer_fields ->> 'company_document_type_other',
    p_customer_fields ->> 'billing_currency'
  )
  returning id into v_customer_id;

  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  v_commercial_configuration_id := gen_random_uuid();
  v_commercial_change_id := v_system_request_id;
  perform create_commercial_configuration_with_change(
    v_commercial_configuration_id, v_system_request_id, v_customer_id,
    p_commercial_configuration_key, p_commercial_configuration_name, p_effective_date,
    p_actor_user_id, null, null, null, p_actor_context
  );

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    v_new_component_id := gen_random_uuid();
    perform add_commercial_component(
      v_new_component_id,
      v_commercial_configuration_id,
      v_commercial_change_id,
      (v_component ->> 'is_recurring')::boolean,
      v_component ->> 'pricing_rule_kind',
      v_component -> 'pricing_rule_parameters',
      v_component ->> 'billing_cadence',
      v_component ->> 'billing_timing',
      v_component ->> 'reconciliation_cadence',
      v_component ->> 'transaction_currency',
      nullif(v_component ->> 'fx_snapshot_rate', '')::numeric,
      (v_component ->> 'effective_from')::date,
      p_actor_user_id,
      v_component ->> 'billing_quantity_basis',
      null,
      null,
      p_actor_context,
      null
    );

    v_mug_threshold := nullif(v_component ->> 'mug_threshold_value', '')::numeric;
    if v_mug_threshold is not null then
      perform add_commercial_commitment(
        gen_random_uuid(), v_commercial_change_id, v_new_component_id,
        v_mug_threshold, (v_component ->> 'effective_from')::date, p_actor_user_id, p_actor_context
      );
    end if;
  end loop;

  update customer_onboarding_cases
  set status = 'approved',
      approved_by = p_actor_user_id,
      approved_at = now(),
      customer_id = v_customer_id,
      commercial_configuration_id = v_commercial_configuration_id,
      current_workflow_node_key = v_new_current_node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;

revoke execute on function approve_customer_onboarding_case(uuid, text, text, text, text, jsonb, date, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function approve_customer_onboarding_case(uuid, text, text, text, text, jsonb, date, uuid, jsonb, jsonb, text) to service_role;
