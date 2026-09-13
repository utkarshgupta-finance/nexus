-- Nexus: fix delete_customer_permanently's eligibility bar, caught by
-- direct smoke-testing (never merely assumed correct) before writing
-- any TypeScript against it.
--
-- The original version checked "zero commercial_components", but
-- commercial_changes carries its OWN unconditional append-only trigger
-- (fn_reject_update_delete, added in an earlier round), so even an
-- empty-shell Commercial Configuration's initial_setup Change can never
-- actually be deleted, and commercial_configurations.customer_id is
-- itself a RESTRICT foreign key. A customer that went through the real
-- onboarding-approval lifecycle always has at least one
-- commercial_configurations row (approve_customer_onboarding_case
-- creates it unconditionally, even for zero components), so the
-- original "zero components" bar was actually unreachable for any
-- real, onboarded customer: this function would always have failed at
-- the `delete from commercial_changes` step for such a customer.
--
-- The correct, schema-honest eligibility bar is "zero
-- commercial_configurations rows for this customer at all": once a
-- Commercial Configuration exists, real or empty, it is permanent. A
-- genuinely never-commercialized customer (created directly via
-- insertCustomer, the same path the very first demo customer used,
-- never through onboarding) has zero Commercial Configurations and
-- remains eligible.

create or replace function delete_customer_permanently(
  p_customer_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns customer_deletion_audit
language plpgsql
as $function$
declare
  v_customer customers;
  v_configuration_count integer;
  v_approved_change_request_count integer;
  v_audit customer_deletion_audit;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'CUSTOMER_DELETE_REASON_REQUIRED: a reason is required to permanently delete a customer';
  end if;

  select * into v_customer from customers where id = p_customer_id for update;
  if not found then
    raise exception 'CUSTOMER_DELETE_NOT_FOUND: no customers row for id %', p_customer_id;
  end if;

  select count(*) into v_configuration_count from commercial_configurations where customer_id = p_customer_id;

  if v_configuration_count > 0 then
    raise exception 'CUSTOMER_DELETE_HAS_COMMERCIAL_HISTORY: customer % has % Commercial Configuration(s); permanent deletion is blocked', p_customer_id, v_configuration_count;
  end if;

  select count(*) into v_approved_change_request_count
  from customer_change_requests
  where customer_id = p_customer_id and status = 'approved';

  if v_approved_change_request_count > 0 then
    raise exception 'CUSTOMER_DELETE_HAS_APPROVED_CHANGE_HISTORY: customer % has % approved Customer Change Request(s); permanent deletion is blocked', p_customer_id, v_approved_change_request_count;
  end if;

  insert into customer_deletion_audit (
    customer_id, customer_key, customer_name, segment, business_unit, country, industry, brand_name,
    was_active, reason, deleted_by
  )
  values (
    v_customer.id, v_customer.key, v_customer.name, v_customer.segment, v_customer.business_unit,
    v_customer.country, v_customer.industry, v_customer.brand_name,
    v_customer.is_active, p_reason, p_actor_user_id
  )
  returning * into v_audit;

  delete from customer_change_request_requirements
  where customer_change_request_id in (select request_id from customer_change_requests where customer_id = p_customer_id);

  delete from customer_change_requests where customer_id = p_customer_id;
  delete from customer_field_history where customer_id = p_customer_id;
  delete from customer_onboarding_cases where customer_id = p_customer_id;

  perform set_config('app.permit_customer_delete', 'true', true);
  delete from customers where id = p_customer_id;

  return v_audit;
end;
$function$;
