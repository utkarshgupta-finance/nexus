-- Nexus: fixes a defect found while testing journey B-017 ("direct field
-- edit attempt blocked by fn_protect_customer_lifecycle trigger").
--
-- fn_protect_customer_lifecycle's UPDATE branch (most recently redefined
-- in 20260924000000_fix_customer_lifecycle_guard_stale_allowlist.sql)
-- only rejects an UPDATE when a non-governed structural column (id, key,
-- created_at, created_by) changes. It does not independently verify that
-- a change to a governed Customer Master field or is_active came from a
-- sanctioned writer RPC, so the trigger does not by itself distinguish a
-- sanctioned write from an arbitrary one at the database layer. This is
-- inconsistent with the trigger's own stated purpose and with the
-- standing invariant that approved business truth is never edited
-- directly outside the two sanctioned RPCs (CLAUDE.md, "Approved
-- business truth is never edited directly"; docs/CUSTOMER_LIFECYCLE.md's
-- current truth -> proposed change -> review -> approval -> apply
-- model). Confirmed empirically against a disposable test customer,
-- full detail in docs/journey-runs/BATCH_09_RESULTS.md (B-017). The
-- DELETE branch already has the equivalent protection
-- (app.permit_customer_delete, established in
-- 20260913080000_permanent_customer_deletion.sql) and was confirmed
-- still working correctly; only the UPDATE branch lacked it.
--
-- Fix: give the governed business fields and is_active the exact same
-- protection DELETE already has. A new session-local flag,
-- app.permit_customer_field_write, must be set true (via
-- `perform set_config('app.permit_customer_field_write', 'true', true)`)
-- inside a sanctioned writer RPC's own transaction, immediately before
-- that RPC's own UPDATE, or any change to a governed field or is_active
-- is rejected. The two RPCs that legitimately write governed fields or
-- is_active to `customers` today are approve_customer_change_request
-- (final-approval branch, writes the governed fields proposed by an
-- approved Customer Change Request) and set_customer_active (writes
-- is_active). approve_customer_onboarding_case only ever INSERTs the
-- initial customers row (the trigger's INSERT branch returns new
-- unconditionally, unguarded by design), so it needs no change.
-- delete_customer_permanently only ever DELETEs, never UPDATEs
-- `customers`, so it also needs no change. The structural-immutability
-- check (id, key, created_at, created_by, and any future non-governed
-- column) is unchanged and remains unconditional: no flag can bypass it.
--
-- STAGED, NOT APPLIED. Needs explicit user go-ahead before
-- `supabase db push`, per this repo's established working agreement for
-- changes to this trigger (see 20260924000000_fix_customer_lifecycle_guard_stale_allowlist.sql's
-- own header: "no `supabase db push` without a specific go-ahead from the
-- user, given this redefines a data-integrity guard on the `customers`
-- master table"). Do not run `supabase db push`, do not call the
-- Supabase MCP `apply_migration` tool, and do not modify the live
-- database in any way based on this file alone.

-- =============================================================================
-- fn_protect_customer_lifecycle: protect the governed fields and
-- is_active themselves, not only the structural columns around them.
-- =============================================================================

create or replace function fn_protect_customer_lifecycle()
returns trigger
language plpgsql
as $function$
declare
  v_old_core jsonb;
  v_new_core jsonb;
  v_old_governed jsonb;
  v_new_governed jsonb;
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.permit_customer_delete', true), '') = 'true' then
      return old;
    end if;
    raise exception 'customers is a permanent master identity: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  -- tg_op = 'UPDATE'. Structural/system columns (id, key, created_at,
  -- created_by, and any future column not named below) must never change,
  -- under any circumstance, no flag bypasses this. Only the governed
  -- Customer Master fields, is_active, row_version, updated_at, and
  -- updated_by are ever permitted to differ between old and new.
  v_old_core := to_jsonb(old)
    - 'name' - 'brand_name' - 'segment' - 'business_unit' - 'country' - 'industry'
    - 'address' - 'state' - 'city' - 'postal_code' - 'website'
    - 'primary_contact_name' - 'primary_contact_email' - 'primary_contact_phone_country_code'
    - 'primary_contact_phone_number' - 'primary_contact_designation'
    - 'gst_number' - 'pan' - 'tan' - 'tax_identifier_type' - 'tax_identifier_name' - 'tax_registration_number'
    - 'company_document_type' - 'company_document_type_other' - 'billing_currency'
    - 'is_active' - 'row_version' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new)
    - 'name' - 'brand_name' - 'segment' - 'business_unit' - 'country' - 'industry'
    - 'address' - 'state' - 'city' - 'postal_code' - 'website'
    - 'primary_contact_name' - 'primary_contact_email' - 'primary_contact_phone_country_code'
    - 'primary_contact_phone_number' - 'primary_contact_designation'
    - 'gst_number' - 'pan' - 'tan' - 'tax_identifier_type' - 'tax_identifier_name' - 'tax_registration_number'
    - 'company_document_type' - 'company_document_type_other' - 'billing_currency'
    - 'is_active' - 'row_version' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'customers is a permanent master identity: only the governed Customer Master fields, is_active, row_version, '
      'updated_at, and updated_by may change (id=%)', old.id;
  end if;

  -- The governed Customer Master fields and is_active are approved
  -- business truth (CLAUDE.md, "Approved business truth is never edited
  -- directly"): once set, they may change ONLY through a sanctioned
  -- writer RPC that has set app.permit_customer_field_write for the
  -- duration of its own transaction, immediately before its own UPDATE,
  -- the exact same session-local-bypass pattern the DELETE branch above
  -- already established with app.permit_customer_delete.
  v_old_governed := jsonb_build_object(
    'name', old.name, 'brand_name', old.brand_name, 'segment', old.segment,
    'business_unit', old.business_unit, 'country', old.country, 'industry', old.industry,
    'address', old.address, 'state', old.state, 'city', old.city,
    'postal_code', old.postal_code, 'website', old.website,
    'primary_contact_name', old.primary_contact_name, 'primary_contact_email', old.primary_contact_email,
    'primary_contact_phone_country_code', old.primary_contact_phone_country_code,
    'primary_contact_phone_number', old.primary_contact_phone_number,
    'primary_contact_designation', old.primary_contact_designation,
    'gst_number', old.gst_number, 'pan', old.pan, 'tan', old.tan,
    'tax_identifier_type', old.tax_identifier_type, 'tax_identifier_name', old.tax_identifier_name,
    'tax_registration_number', old.tax_registration_number,
    'company_document_type', old.company_document_type, 'company_document_type_other', old.company_document_type_other,
    'billing_currency', old.billing_currency, 'is_active', old.is_active
  );
  v_new_governed := jsonb_build_object(
    'name', new.name, 'brand_name', new.brand_name, 'segment', new.segment,
    'business_unit', new.business_unit, 'country', new.country, 'industry', new.industry,
    'address', new.address, 'state', new.state, 'city', new.city,
    'postal_code', new.postal_code, 'website', new.website,
    'primary_contact_name', new.primary_contact_name, 'primary_contact_email', new.primary_contact_email,
    'primary_contact_phone_country_code', new.primary_contact_phone_country_code,
    'primary_contact_phone_number', new.primary_contact_phone_number,
    'primary_contact_designation', new.primary_contact_designation,
    'gst_number', new.gst_number, 'pan', new.pan, 'tan', new.tan,
    'tax_identifier_type', new.tax_identifier_type, 'tax_identifier_name', new.tax_identifier_name,
    'tax_registration_number', new.tax_registration_number,
    'company_document_type', new.company_document_type, 'company_document_type_other', new.company_document_type_other,
    'billing_currency', new.billing_currency, 'is_active', new.is_active
  );

  if v_old_governed is distinct from v_new_governed
     and coalesce(current_setting('app.permit_customer_field_write', true), '') <> 'true' then
    raise exception
      'customers is a permanent master identity: the governed Customer Master fields and is_active may only be '
      'changed by a sanctioned writer RPC (approve_customer_change_request, set_customer_active), never by a '
      'direct UPDATE (id=%)', old.id;
  end if;

  return new;
end;
$function$;

-- =============================================================================
-- approve_customer_change_request: the sanctioned writer for the governed
-- business fields. Body copied unchanged from
-- 20260925000000_workflow_runtime_v1_sequential_execution.sql's
-- definition, plus one new line setting the permit flag immediately
-- before the per-field UPDATE loop it already runs on final approval.
-- =============================================================================

create or replace function approve_customer_change_request(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_expected_current_node_key text default null
)
returns customer_change_requests
language plpgsql
security invoker
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

-- =============================================================================
-- set_customer_active: the sanctioned writer for is_active. Body copied
-- unchanged from 20260914170000_fix_set_customer_active_idempotency.sql's
-- definition, plus one new line setting the permit flag immediately
-- before its own UPDATE.
-- =============================================================================

create or replace function set_customer_active(
  p_customer_id uuid,
  p_is_active boolean,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customers
language plpgsql
as $function$
declare
  v_customer customers;
  v_context jsonb;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'CUSTOMER_STATUS_REASON_REQUIRED: a reason is required to deactivate or reactivate a customer';
  end if;

  select * into v_customer from customers where id = p_customer_id for update;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND: no customers row for id %', p_customer_id;
  end if;

  -- Idempotent replay: a customer already at the requested status returns
  -- unchanged, no DML runs, matching every other decision RPC's pattern.
  if v_customer.is_active = p_is_active then
    return v_customer;
  end if;

  v_context := coalesce(p_actor_context, '{}'::jsonb) || jsonb_build_object('reason', p_reason);

  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', v_context::text, true);

  -- Sanctioned write to is_active: set the session-local permit flag for
  -- the duration of this transaction, immediately before the UPDATE
  -- below.
  perform set_config('app.permit_customer_field_write', 'true', true);

  update customers
  set is_active = p_is_active, updated_by = p_actor_user_id
  where id = p_customer_id
  returning * into v_customer;

  return v_customer;
end;
$function$;
