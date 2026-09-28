-- Bounded fix (Batch 26 V-003 reconciliation, 2026-09-28): a single
-- successful approve_customer_change_request call issued one UPDATE per
-- changed governed field (from the field-application loop) PLUS a
-- separate trailing UPDATE to stamp updated_by/updated_at, and every one
-- of those UPDATE statements independently triggers the customers
-- table's own generic trg_customers_row_version (fn_bump_row_version:
-- "new.row_version := old.row_version + 1" on every UPDATE, unconditional
-- by design). A one-field change therefore bumped row_version by 2, not
-- 1; an N-field change would have bumped it by N+1. This breaks the
-- canonical, intended optimistic-locking contract ("row_version
-- increments by exactly 1 per approval", relied on by every *_STALE_BASE
-- check in this codebase). Root-caused via real audit_log evidence
-- (audit_sequence-ordered rows for the exact winning approval), not
-- source inspection alone.
--
-- Fix: consolidate all changed-field writes plus the actor/timestamp
-- stamp into exactly one UPDATE statement (dynamic SET list, since the
-- set of changed fields varies per approval), so the row is written
-- at most once regardless of how many governed fields changed. Falls
-- back to a single plain stamp-only UPDATE when no field actually
-- changed (preserves the existing behavior that even a no-op field
-- diff still touches updated_by/updated_at/row_version once).

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
  v_set_clauses text[] := array[]::text[];
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
  -- immediately before the UPDATE below (the same pattern
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

    v_set_clauses := v_set_clauses || format('%I = %L', v_field, v_new_value);
  end loop;

  -- Exactly one UPDATE against this customers row for the whole
  -- approval, regardless of how many governed fields changed: the
  -- table's own trg_customers_row_version trigger bumps row_version
  -- unconditionally on every UPDATE, so issuing more than one UPDATE
  -- here would bump it more than once per approval.
  if array_length(v_set_clauses, 1) > 0 then
    execute format(
      'update customers set %s, updated_by = %L, updated_at = now() where id = %L',
      array_to_string(v_set_clauses, ', '), p_actor_user_id, v_customer.id
    );
  else
    update customers set updated_by = p_actor_user_id, updated_at = now() where id = v_customer.id;
  end if;

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
