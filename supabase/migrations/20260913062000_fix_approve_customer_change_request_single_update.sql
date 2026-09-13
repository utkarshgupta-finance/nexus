-- Nexus: customers already carries its own trg_customers_row_version
-- (fn_bump_row_version, unconditionally sets new.row_version :=
-- old.row_version + 1 on every UPDATE), discovered via direct
-- smoke-testing of approve_customer_change_request: the original version
-- issued one UPDATE per changed governed field plus a final manual
-- row_version bump, so a two-field change moved row_version from 1 to 4
-- instead of 1 to 2. Not incorrect (still monotonic, staleness detection
-- still works), but confusing and wasteful. Fixed to issue exactly one
-- combined UPDATE per approval, so exactly one row_version bump happens
-- per approved Change Request, and to drop the now-redundant manual
-- row_version increment (the trigger already owns that).

create or replace function approve_customer_change_request(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
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
  v_any_field_changed boolean := false;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_change_request from customer_change_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'CUSTOMER_CHANGE_NOT_FOUND: no customer_change_requests row for request %', p_request_id;
  end if;

  if v_change_request.status = 'approved' then
    return v_change_request;
  end if;

  if v_change_request.status not in ('submitted', 'resubmitted') then
    raise exception 'CUSTOMER_CHANGE_NOT_APPROVABLE: request % has status %, only submitted or resubmitted may be approved', p_request_id, v_change_request.status;
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

  v_proposed := v_latest_revision.effective_data -> 'values';

  for v_field in select unnest(array['name', 'brand_name', 'segment', 'business_unit', 'country', 'industry'])
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
    end;

    continue when v_old_value is not distinct from v_new_value;

    v_any_field_changed := true;

    insert into customer_field_history (customer_id, field_key, old_value, new_value, effective_date, customer_change_request_id, requested_by, approved_by)
    values (v_customer.id, v_field, v_old_value, v_new_value, v_change_request.effective_date, p_request_id, v_change_request.created_by, p_actor_user_id);
  end loop;

  if v_any_field_changed then
    update customers
    set
      name = case when v_proposed ? 'name' then v_proposed ->> 'name' else name end,
      brand_name = case when v_proposed ? 'brand_name' then v_proposed ->> 'brand_name' else brand_name end,
      segment = case when v_proposed ? 'segment' then v_proposed ->> 'segment' else segment end,
      business_unit = case when v_proposed ? 'business_unit' then v_proposed ->> 'business_unit' else business_unit end,
      country = case when v_proposed ? 'country' then v_proposed ->> 'country' else country end,
      industry = case when v_proposed ? 'industry' then v_proposed ->> 'industry' else industry end,
      updated_by = p_actor_user_id
    where id = v_customer.id;
  end if;

  update customer_change_requests
  set status = 'approved', decided_by = p_actor_user_id, decided_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_change_request;

  return v_change_request;
end;
$function$;
