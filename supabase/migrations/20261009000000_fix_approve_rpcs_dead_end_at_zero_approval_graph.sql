-- Batch 9 (B-014): live retest surfaced a real defect. All four approve_*
-- RPCs (approve_customer_change_request here, and the same pattern in
-- approve_customer_onboarding_case, approve_commercial_configuration_version,
-- approve_go_live_request below) authorize against the node the request is
-- CURRENTLY sitting at, then ask fn_resolve_workflow_next_approval to step
-- PAST that node to find what comes next. That call's contract is "step
-- past its argument", which is correct when current_workflow_node_key is
-- an Approval node with a further node downstream, but wrong when
-- current_workflow_node_key is already the graph's own End node: a
-- workflow_version with zero Approval nodes between Start and End (a
-- published, selectable shape, not merely a discarded draft) has
-- submit_* land current_workflow_node_key on End directly (submit calls
-- the same resolver with p_from_node_key = null, which walks FROM Start
-- and correctly returns End). The End node has no outgoing edge to step
-- to, so the approve RPC's step-past call found nothing and raised
-- WORKFLOW_GRAPH_DEAD_END, which is not one of change-errors.ts's
-- (or the sibling domains' own) NAMED_TOKEN_KINDS, so the checker saw a
-- generic "An unexpected error occurred" instead of ever finalizing the
-- approval. Fix: check the CURRENT node's own type first; if it is
-- already 'end', finalize directly instead of asking the resolver to
-- step past it. Purely additive: every existing case where
-- current_workflow_node_key is an Approval node is untouched.

create or replace function approve_customer_change_request(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_expected_current_node_key text default null::text
)
returns customer_change_requests
language plpgsql
as $function$
declare
  v_change_request customer_change_requests;
  v_customer customers;
  v_latest_revision submission_revisions;
  v_proposed jsonb;
  v_field text;
  v_old_value text;
  v_new_value text;
  v_current_team_id uuid;
  v_current_node_type text;
  v_next record;
  v_should_finalize boolean;
  v_new_current_node_key text;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_change_request.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_change_request.status = 'approved' then
    return v_change_request;
  end if;

  if v_change_request.status not in ('submitted', 'resubmitted') then
    raise exception 'CUSTOMER_CHANGE_NOT_APPROVABLE: request % has status %, only submitted or resubmitted may be approved', p_request_id, v_change_request.status;
  end if;

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_change_request.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  select * into v_customer from customers where id = v_change_request.customer_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_CUSTOMER_NOT_FOUND: no customers row for id %', v_change_request.customer_id;
  end if;

  if v_customer.row_version <> v_change_request.base_customer_row_version then
    raise exception 'CUSTOMER_CHANGE_STALE_BASE: customers row % changed (row_version % vs expected %) since this Change Request was created; rebase before approving',
      v_customer.id, v_customer.row_version, v_change_request.base_customer_row_version;
  end if;

  select * into v_latest_revision
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'CUSTOMER_CHANGE_NO_SUBMITTED_REVISION: request % has no submitted revision to approve', p_request_id;
  end if;

  -- Authorize against the node this request is CURRENTLY sitting at, not
  -- always the first Approval node: Finance is not automatically
  -- entitled to decide a Legal or Leadership step.
  v_current_team_id := fn_workflow_node_team(v_change_request.workflow_version_id, v_change_request.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select wn.node_type into v_current_node_type
  from workflow_nodes wn
  where wn.workflow_version_id = v_change_request.workflow_version_id
    and wn.node_key = v_change_request.current_workflow_node_key;

  if v_current_node_type = 'end' then
    v_should_finalize := true;
    v_new_current_node_key := v_change_request.current_workflow_node_key;
  else
    select * into v_next
    from fn_resolve_workflow_next_approval(
      v_change_request.workflow_version_id,
      v_change_request.current_workflow_node_key,
      jsonb_build_object('segment', coalesce(v_latest_revision.effective_data -> 'values' ->> 'segment', v_customer.segment))
    );

    if v_next.node_type is null then
      if v_change_request.current_workflow_node_key is null then
        v_should_finalize := true;
        v_new_current_node_key := null;
      else
        raise exception 'WORKFLOW_GRAPH_DEAD_END: this request''s workflow has no reachable Approval or End node after node "%"; ask a Workflow Admin to fix the graph', v_change_request.current_workflow_node_key;
      end if;
    elsif v_next.node_type = 'approval' then
      v_should_finalize := false;
      v_new_current_node_key := v_next.node_key;
    else
      v_should_finalize := true;
      v_new_current_node_key := v_next.node_key;
    end if;
  end if;

  if v_change_request.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('customer_change', p_request_id, v_change_request.workflow_version_id, v_change_request.workflow_cycle_number, v_change_request.current_workflow_node_key, v_new_current_node_key, 'approve', p_actor_user_id, null);
  end if;

  if not v_should_finalize then
    update customer_change_requests
    set current_workflow_node_key = v_new_current_node_key,
        updated_by = p_actor_user_id, updated_at = now()
    where request_id = p_request_id
    returning * into v_change_request;

    return v_change_request;
  end if;

  -- Final approval (this request reached the End node): apply the full
  -- governed business mutation exactly once, then finalize.
  v_proposed := v_latest_revision.effective_data -> 'values';

  -- Sanctioned write to the governed Customer Master fields: set the
  -- session-local permit flag for the duration of this transaction,
  -- immediately before the UPDATE loop below (the same pattern
  -- delete_customer_permanently already established for DELETE with
  -- app.permit_customer_delete).
  perform set_config('app.permit_customer_field_write', 'true', true);

  for v_field in select unnest(array[
    'name', 'brand_name', 'segment', 'business_unit', 'country', 'industry',
    'address', 'state', 'city', 'postal_code', 'website',
    'primary_contact_name', 'primary_contact_email', 'primary_contact_phone_country_code',
    'primary_contact_phone_number', 'primary_contact_designation',
    'gst_number', 'pan', 'tan', 'tax_identifier_type', 'tax_identifier_name', 'tax_registration_number',
    'company_document_type', 'company_document_type_other', 'billing_currency'
  ])
  loop
    continue when not (v_proposed ? v_field);

    v_new_value := v_proposed ->> v_field;
    v_old_value := case v_field
      when 'name' then v_customer.name
      when 'brand_name' then v_customer.brand_name
      when 'segment' then v_customer.segment
      when 'business_unit' then v_customer.business_unit
      when 'country' then v_customer.country
      when 'industry' then v_customer.industry
      when 'address' then v_customer.address
      when 'state' then v_customer.state
      when 'city' then v_customer.city
      when 'postal_code' then v_customer.postal_code
      when 'website' then v_customer.website
      when 'primary_contact_name' then v_customer.primary_contact_name
      when 'primary_contact_email' then v_customer.primary_contact_email
      when 'primary_contact_phone_country_code' then v_customer.primary_contact_phone_country_code
      when 'primary_contact_phone_number' then v_customer.primary_contact_phone_number
      when 'primary_contact_designation' then v_customer.primary_contact_designation
      when 'gst_number' then v_customer.gst_number
      when 'pan' then v_customer.pan
      when 'tan' then v_customer.tan
      when 'tax_identifier_type' then v_customer.tax_identifier_type
      when 'tax_identifier_name' then v_customer.tax_identifier_name
      when 'tax_registration_number' then v_customer.tax_registration_number
      when 'company_document_type' then v_customer.company_document_type
      when 'company_document_type_other' then v_customer.company_document_type_other
      when 'billing_currency' then v_customer.billing_currency
    end;

    continue when v_old_value is not distinct from v_new_value;

    insert into customer_field_history (customer_id, field_key, old_value, new_value, effective_date, customer_change_request_id, requested_by, approved_by)
    values (v_customer.id, v_field, v_old_value, v_new_value, v_change_request.effective_date, p_request_id, v_change_request.created_by, p_actor_user_id);

    if v_field = 'name' then
      update customers set name = v_new_value where id = v_customer.id;
    elsif v_field = 'brand_name' then
      update customers set brand_name = v_new_value where id = v_customer.id;
    elsif v_field = 'segment' then
      update customers set segment = v_new_value where id = v_customer.id;
    elsif v_field = 'business_unit' then
      update customers set business_unit = v_new_value where id = v_customer.id;
    elsif v_field = 'country' then
      update customers set country = v_new_value where id = v_customer.id;
    elsif v_field = 'industry' then
      update customers set industry = v_new_value where id = v_customer.id;
    elsif v_field = 'address' then
      update customers set address = v_new_value where id = v_customer.id;
    elsif v_field = 'state' then
      update customers set state = v_new_value where id = v_customer.id;
    elsif v_field = 'city' then
      update customers set city = v_new_value where id = v_customer.id;
    elsif v_field = 'postal_code' then
      update customers set postal_code = v_new_value where id = v_customer.id;
    elsif v_field = 'website' then
      update customers set website = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_name' then
      update customers set primary_contact_name = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_email' then
      update customers set primary_contact_email = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_phone_country_code' then
      update customers set primary_contact_phone_country_code = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_phone_number' then
      update customers set primary_contact_phone_number = v_new_value where id = v_customer.id;
    elsif v_field = 'primary_contact_designation' then
      update customers set primary_contact_designation = v_new_value where id = v_customer.id;
    elsif v_field = 'gst_number' then
      update customers set gst_number = v_new_value where id = v_customer.id;
    elsif v_field = 'pan' then
      update customers set pan = v_new_value where id = v_customer.id;
    elsif v_field = 'tan' then
      update customers set tan = v_new_value where id = v_customer.id;
    elsif v_field = 'tax_identifier_type' then
      update customers set tax_identifier_type = v_new_value where id = v_customer.id;
    elsif v_field = 'tax_identifier_name' then
      update customers set tax_identifier_name = v_new_value where id = v_customer.id;
    elsif v_field = 'tax_registration_number' then
      update customers set tax_registration_number = v_new_value where id = v_customer.id;
    elsif v_field = 'company_document_type' then
      update customers set company_document_type = v_new_value where id = v_customer.id;
    elsif v_field = 'company_document_type_other' then
      update customers set company_document_type_other = v_new_value where id = v_customer.id;
    elsif v_field = 'billing_currency' then
      update customers set billing_currency = v_new_value where id = v_customer.id;
    end if;
  end loop;

  update customers set row_version = row_version + 1, updated_by = p_actor_user_id, updated_at = now() where id = v_customer.id;

  update customer_change_requests
  set status = 'approved',
      decided_by = p_actor_user_id,
      decided_at = now(),
      current_workflow_node_key = v_new_current_node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  return v_change_request;
end;
$function$;

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
  p_expected_current_node_key text default null::text
)
returns customer_onboarding_cases
language plpgsql
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
  v_current_node_type text;
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

create or replace function approve_commercial_configuration_version(
  p_request_id uuid,
  p_components jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_expected_current_node_key text default null::text
)
returns commercial_configuration_versions
language plpgsql
as $function$
declare
  v_version commercial_configuration_versions;
  v_system_request_id uuid;
  v_commercial_change commercial_changes;
  v_component jsonb;
  v_new_component_id uuid;
  v_mug_threshold numeric;
  v_stable_key uuid;
  v_current_team_id uuid;
  v_current_node_type text;
  v_segment text;
  v_next record;
  v_should_finalize boolean;
  v_new_current_node_key text;
  v_backfill_until date;
  v_earliest_effective_from date;
  v_current_open_effective_from date;
  v_conflicting_effective_from date;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from commercial_configuration_versions where request_id = p_request_id for update;
  if not found then
    raise exception 'COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for request %', p_request_id;
  end if;

  if v_version.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_version.status = 'approved' then
    return v_version;
  end if;

  if v_version.status <> 'submitted' then
    raise exception 'COMMERCIAL_VERSION_NOT_APPROVABLE: version % has status %, only submitted may be approved', p_request_id, v_version.status;
  end if;

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_version.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  if v_version.change_category <> 'correction' and exists (
    select 1 from commercial_components
    where commercial_configuration_id = v_version.commercial_configuration_id
      and effective_to is null
      and effective_from >= v_version.effective_date
  ) then
    raise exception 'COMMERCIAL_VERSION_EFFECTIVE_DATE_OUT_OF_ORDER: version % has effective_date % which must be strictly after the currently active period''s own start date', p_request_id, v_version.effective_date;
  end if;

  -- Real defect found via live retest: a currently open component whose own
  -- effective_from is exactly one day before this version's effective_date
  -- would be closed by the bulk-close step below to effective_to equal to
  -- its own effective_from, which chk_commercial_components_effective_dating
  -- rejects. Caught here, before any mutation, with a clear named error.
  select effective_from into v_conflicting_effective_from
  from commercial_components
  where commercial_configuration_id = v_version.commercial_configuration_id
    and effective_to is null
    and effective_from = v_version.effective_date - 1
  limit 1;

  if v_conflicting_effective_from is not null then
    raise exception 'COMMERCIAL_VERSION_EFFECTIVE_DATE_ADJACENT_TO_OPEN_COMPONENT_START: version % has effective_date % which is exactly one day after an existing open component''s own start date (%); that component would need to be closed on the same day it started, which is not a valid historical period. Choose an effective date on or after %, or on or before % if you intend to correct that period''s own start',
      p_request_id, v_version.effective_date, v_conflicting_effective_from, v_conflicting_effective_from + 2, v_conflicting_effective_from;
  end if;

  select c.segment into v_segment
  from commercial_configurations cc
  join customers c on c.id = cc.customer_id
  where cc.id = v_version.commercial_configuration_id;

  v_current_team_id := fn_workflow_node_team(v_version.workflow_version_id, v_version.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select wn.node_type into v_current_node_type
  from workflow_nodes wn
  where wn.workflow_version_id = v_version.workflow_version_id
    and wn.node_key = v_version.current_workflow_node_key;

  if v_current_node_type = 'end' then
    v_should_finalize := true;
    v_new_current_node_key := v_version.current_workflow_node_key;
  else
    select * into v_next
    from fn_resolve_workflow_next_approval(v_version.workflow_version_id, v_version.current_workflow_node_key, jsonb_build_object('segment', v_segment));

    if v_next.node_type is null then
      if v_version.current_workflow_node_key is null then
        v_should_finalize := true;
        v_new_current_node_key := null;
      else
        raise exception 'WORKFLOW_GRAPH_DEAD_END: this version''s workflow has no reachable Approval or End node after node "%"; ask a Workflow Admin to fix the graph', v_version.current_workflow_node_key;
      end if;
    elsif v_next.node_type = 'approval' then
      v_should_finalize := false;
      v_new_current_node_key := v_next.node_key;
    else
      v_should_finalize := true;
      v_new_current_node_key := v_next.node_key;
    end if;
  end if;

  if v_version.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('commercial_configuration', p_request_id, v_version.workflow_version_id, v_version.workflow_cycle_number, v_version.current_workflow_node_key, v_new_current_node_key, 'approve', p_actor_user_id, null);
  end if;

  if not v_should_finalize then
    update commercial_configuration_versions
    set current_workflow_node_key = v_new_current_node_key,
        updated_by = p_actor_user_id, updated_at = now()
    where request_id = p_request_id
    returning * into v_version;

    return v_version;
  end if;

  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  -- Resolve every submitted component's stable-key history BEFORE the
  -- bulk-close UPDATE below mutates it: reading this after the close
  -- would see the just-closed row as no longer "currently open" (see
  -- 20260930170000's own header). Only meaningful for
  -- change_category = 'correction'; every other category is already
  -- fully governed by the ordering guard above and never consults this
  -- table.
  create temporary table if not exists tmp_component_history (
    stable_component_key uuid primary key,
    earliest_effective_from date,
    current_open_effective_from date
  ) on commit drop;
  delete from tmp_component_history where true;

  if v_version.change_category = 'correction' then
    insert into tmp_component_history (stable_component_key, earliest_effective_from, current_open_effective_from)
    select keys.sk, min(cc.effective_from), max(cc.effective_from) filter (where cc.effective_to is null)
    from (
      select distinct nullif(elem ->> 'stable_component_key', '')::uuid as sk
      from jsonb_array_elements(p_components) elem
    ) keys
    join commercial_components cc
      on cc.commercial_configuration_id = v_version.commercial_configuration_id
      and cc.stable_component_key = keys.sk
    where keys.sk is not null
    group by keys.sk;
  end if;

  -- Retroactive-start correction (PD-006 final decision): only close a
  -- currently-open component whose own effective_from is not later than
  -- this version's effective_date. A component whose effective_from is
  -- LATER (only possible for change_category = 'correction', since the
  -- ordering guard above already blocks this for every other category)
  -- is left untouched here on purpose; the loop below inserts its
  -- retroactive predecessor row instead of closing it.
  update commercial_components
  set effective_to = v_version.effective_date - 1, updated_by = p_actor_user_id, updated_at = now()
  where commercial_configuration_id = v_version.commercial_configuration_id
    and effective_to is null
    and effective_from <= v_version.effective_date;

  insert into commercial_changes (request_id, commercial_configuration_id, change_category, effective_date, reason, created_by)
  values (v_system_request_id, v_version.commercial_configuration_id, v_version.change_category, v_version.effective_date, v_version.reason, p_actor_user_id)
  returning * into v_commercial_change;

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    v_new_component_id := gen_random_uuid();
    v_stable_key := nullif(v_component ->> 'stable_component_key', '')::uuid;
    v_backfill_until := null;

    if v_stable_key is not null and v_version.change_category = 'correction' then
      select h.earliest_effective_from, h.current_open_effective_from
      into v_earliest_effective_from, v_current_open_effective_from
      from tmp_component_history h
      where h.stable_component_key = v_stable_key;

      if v_earliest_effective_from is not null then
        if v_version.effective_date < v_earliest_effective_from then
          -- Genuine backward extension of the whole known history for
          -- this component: safe by construction, since it starts
          -- before every row that currently exists. Close the new row
          -- exactly where the earliest existing row already begins.
          v_backfill_until := v_earliest_effective_from;
        elsif v_current_open_effective_from is not null and v_version.effective_date >= v_current_open_effective_from then
          -- Ordinary forward supersession of the currently active
          -- period; already handled by the bulk close above. No
          -- backfill closure needed on the new row.
          v_backfill_until := null;
        else
          -- The target date falls inside territory an existing,
          -- already-closed row for this component already covers.
          -- Accepting this would create a second overlapping row for
          -- the same stable_component_key (the exact defect
          -- 20260930160000 fixed); reject explicitly instead.
          raise exception 'COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY: version % has effective_date % which falls within this component''s already-recorded history; a correction may only move the start date earlier than % (extending the known history further back) or on/after % (the currently active period''s own start)',
            p_request_id, v_version.effective_date, v_earliest_effective_from, v_current_open_effective_from;
        end if;
      end if;
    end if;

    perform add_commercial_component(
      v_new_component_id,
      v_version.commercial_configuration_id,
      v_commercial_change.request_id,
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
      v_stable_key
    );

    if v_backfill_until is not null then
      update commercial_components
      set effective_to = v_backfill_until - 1, updated_by = p_actor_user_id, updated_at = now()
      where id = v_new_component_id;
    end if;

    v_mug_threshold := nullif(v_component ->> 'mug_threshold_value', '')::numeric;
    if v_mug_threshold is not null then
      perform add_commercial_commitment(
        gen_random_uuid(), v_commercial_change.request_id, v_new_component_id,
        v_mug_threshold, (v_component ->> 'effective_from')::date, p_actor_user_id, p_actor_context
      );
    end if;
  end loop;

  update commercial_configuration_versions
  set status = 'approved', commercial_change_id = v_commercial_change.request_id,
      decided_by = p_actor_user_id, decided_at = now(),
      current_workflow_node_key = v_new_current_node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;

create or replace function approve_go_live_request(
  p_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_expected_current_node_key text default null::text
)
returns go_live_requests
language plpgsql
as $function$
declare
  v_row go_live_requests;
  v_current_team_id uuid;
  v_current_node_type text;
  v_next record;
  v_should_finalize boolean;
  v_new_current_node_key text;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_row.status = 'approved' then
    return v_row;
  end if;

  if v_row.status not in ('submitted', 'resubmitted') then
    raise exception 'GO_LIVE_REQUEST_NOT_APPROVABLE: request % has status %, only submitted or resubmitted may be approved', p_id, v_row.status;
  end if;

  if p_expected_current_node_key is not null and p_expected_current_node_key is distinct from v_row.current_workflow_node_key then
    raise exception 'WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.';
  end if;

  if v_row.customer_confirmation_status <> 'confirmed' then
    raise exception 'GO_LIVE_CONFIRMATION_REQUIRED: customer confirmation is required before a Go Live request can be approved';
  end if;

  v_current_team_id := fn_workflow_node_team(v_row.workflow_version_id, v_row.current_workflow_node_key);
  perform fn_require_workflow_team_membership(v_current_team_id, p_actor_user_id);

  select wn.node_type into v_current_node_type
  from workflow_nodes wn
  where wn.workflow_version_id = v_row.workflow_version_id
    and wn.node_key = v_row.current_workflow_node_key;

  if v_current_node_type = 'end' then
    v_should_finalize := true;
    v_new_current_node_key := v_row.current_workflow_node_key;
  else
    select * into v_next from fn_resolve_workflow_next_approval(v_row.workflow_version_id, v_row.current_workflow_node_key, '{}'::jsonb);

    if v_next.node_type is null then
      if v_row.current_workflow_node_key is null then
        v_should_finalize := true;
        v_new_current_node_key := null;
      else
        raise exception 'WORKFLOW_GRAPH_DEAD_END: this request''s workflow has no reachable Approval or End node after node "%"; ask a Workflow Admin to fix the graph', v_row.current_workflow_node_key;
      end if;
    elsif v_next.node_type = 'approval' then
      v_should_finalize := false;
      v_new_current_node_key := v_next.node_key;
    else
      v_should_finalize := true;
      v_new_current_node_key := v_next.node_key;
    end if;
  end if;

  if v_row.workflow_version_id is not null then
    insert into workflow_node_transitions (domain, resource_id, workflow_version_id, cycle_number, from_node_key, to_node_key, action, actor_user_id, comment)
    values ('go_live', p_id, v_row.workflow_version_id, v_row.workflow_cycle_number, v_row.current_workflow_node_key, v_new_current_node_key, 'approve', p_actor_user_id, null);
  end if;

  perform set_config('app.permit_go_live_write', 'true', true);

  if not v_should_finalize then
    update go_live_requests
    set current_workflow_node_key = v_new_current_node_key,
        updated_by = p_actor_user_id, updated_at = now()
    where id = p_id
    returning * into v_row;

    return v_row;
  end if;

  update go_live_requests
  set status = 'approved', approved_by = p_actor_user_id, approved_at = now(),
      current_workflow_node_key = v_new_current_node_key,
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;
