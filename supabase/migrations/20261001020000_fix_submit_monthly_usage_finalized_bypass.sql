-- Batch 17 I-012: submit_monthly_usage superseded an already-finalized
-- monthly_usage row with a brand-new draft row with no check at all,
-- silently defeating finalize_monthly_usage's own lock (found live: a
-- finalized Sep 2026 row for quantity 25 was immediately superseded by a
-- fresh draft row for quantity 999, with no error, and the ledger began
-- reading the new unfinalized row as current). The row itself stayed
-- correctly immutable (fn_protect_monthly_usage_lifecycle), but the
-- supersede-with-a-new-row path was never guarded, so finalization
-- provided no real protection once a caller simply resubmitted for the
-- same month. This closes that gap: resubmitting for a month whose
-- current row is already final is rejected, matching the same
-- "no correction mechanism exists yet, so ordinary resubmission does not
-- silently substitute for one" reasoning already applied to settlement
-- and ledger-entry protections elsewhere in this domain.

create or replace function submit_monthly_usage(
  p_id uuid,
  p_customer_id uuid,
  p_stable_component_key uuid,
  p_commercial_version_id uuid,
  p_usage_month date,
  p_metric text,
  p_quantity numeric,
  p_source text,
  p_notes text,
  p_is_recurring boolean,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns monthly_usage
language plpgsql
security invoker
as $function$
declare
  v_go_live go_live_requests;
  v_current monthly_usage;
  v_row monthly_usage;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_is_recurring then
    select * into v_go_live
    from go_live_requests
    where stable_component_key = p_stable_component_key and status = 'approved'
    order by approved_at desc
    limit 1;

    if not found then
      raise exception 'USAGE_BEFORE_GO_LIVE: this recurring line item has no approved Go Live yet, usage cannot be entered';
    end if;

    if date_trunc('month', p_usage_month) < date_trunc('month', v_go_live.go_live_date) then
      raise exception 'USAGE_BEFORE_GO_LIVE: usage month % is before this line item''s Go Live month %', p_usage_month, v_go_live.go_live_date;
    end if;
  end if;

  select * into v_current
  from monthly_usage
  where customer_id = p_customer_id and stable_component_key = p_stable_component_key and usage_month = p_usage_month and is_current = true;

  if found and v_current.status = 'final' then
    raise exception 'MONTHLY_USAGE_ALREADY_FINALIZED: usage for % has already been finalized and cannot be resubmitted', p_usage_month;
  end if;

  update monthly_usage
  set is_current = false
  where customer_id = p_customer_id and stable_component_key = p_stable_component_key and usage_month = p_usage_month and is_current = true;

  insert into monthly_usage (
    id, customer_id, stable_component_key, commercial_version_id, usage_month, metric, quantity, source, notes, submitted_by
  )
  values (
    p_id, p_customer_id, p_stable_component_key, p_commercial_version_id, p_usage_month, p_metric, p_quantity, p_source, p_notes, p_actor_user_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;
