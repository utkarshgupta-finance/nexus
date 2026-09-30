-- Nexus: approve_customer_onboarding_case's customers insert dropped
-- segment, business_unit, country, and industry when p_customer_fields
-- was introduced (20260913063000 originally mapped these 4 correctly
-- from the submitted revision; a later redefinition switched every other
-- field to read from p_customer_fields but never carried these 4 over,
-- silently leaving them permanently null on every newly-onboarded
-- customer even though the onboarding form always collects them and
-- Customer Change's governed-field registry treats all 4 as real,
-- editable customers columns). p_customer_fields ->> 'segment' is
-- already read elsewhere in this same function (workflow routing), so
-- the caller already supplies it; only the customers insert needed
-- fixing. Restores parity with the governed-field registry
-- (src/features/customers/domain/governed-field-registry.ts).

create or replace function public.approve_customer_onboarding_case(p_request_id uuid, p_customer_key text, p_customer_name text, p_commercial_configuration_key text, p_commercial_configuration_name text, p_components jsonb, p_effective_date date, p_actor_user_id uuid, p_actor_context jsonb DEFAULT NULL::jsonb, p_customer_fields jsonb DEFAULT '{}'::jsonb, p_expected_current_node_key text DEFAULT NULL::text)
 RETURNS customer_onboarding_cases
 LANGUAGE plpgsql
AS $function$
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
  v_current_node_type text;
  v_next record;
  v_next_team_active boolean;
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
    if v_case.approved_by is not distinct from p_actor_user_id then
      return v_case;
    end if;
    raise exception 'WORKFLOW_REQUEST_ALREADY_DECIDED: this request was already approved by someone else. Refresh to see the current status.';
  end if;

  if v_case.status not in ('submitted', 'resubmitted') then
    raise exception 'ONBOARDING_CASE_NOT_APPROVABLE: case % has status %, only submitted or resubmitted may be approved', p_request_id, v_case.status;
  end if;

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_case.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  if exists (
    select 1 from workflow_node_transitions
    where domain = 'customer_onboarding'
      and resource_id = p_request_id
      and action = 'approve'
      and actor_user_id = p_actor_user_id
      and from_node_key is distinct from v_case.current_workflow_node_key
  ) then
    raise exception 'WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION: you already approved an earlier step of this request. A different approver must decide this step.';
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

  select wn.node_type into v_current_node_type
  from workflow_nodes wn
  where wn.workflow_version_id = v_case.workflow_version_id
    and wn.node_key = v_case.current_workflow_node_key;

  if v_current_node_type = 'end' then
    v_should_finalize := true;
    v_new_current_node_key := v_case.current_workflow_node_key;
  else
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
      if v_next.team_id is not null then
        select is_active into v_next_team_active from teams where id = v_next.team_id;
        if v_next_team_active is not null and not v_next_team_active then
          raise exception 'WORKFLOW_TEAM_INACTIVE: this request cannot be routed to its next step ("%"), whose responsible team has been deactivated. Ask a Workflow Admin to reassign that node to an active team before this request can advance.', v_next.node_key;
        end if;
      end if;
      v_should_finalize := false;
      v_new_current_node_key := v_next.node_key;
    else
      v_should_finalize := true;
      v_new_current_node_key := v_next.node_key;
    end if;
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
    key, name, brand_name, segment, business_unit, country, industry, created_by, updated_by,
    address, state, city, postal_code, website,
    primary_contact_name, primary_contact_email, primary_contact_phone_country_code,
    primary_contact_phone_number, primary_contact_designation,
    gst_number, pan, tan, tax_identifier_type, tax_identifier_name, tax_registration_number,
    company_document_type, company_document_type_other, billing_currency
  )
  values (
    p_customer_key, p_customer_name, p_customer_fields ->> 'brand_name',
    p_customer_fields ->> 'segment', p_customer_fields ->> 'business_unit',
    p_customer_fields ->> 'country', p_customer_fields ->> 'industry',
    p_actor_user_id, p_actor_user_id,
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
