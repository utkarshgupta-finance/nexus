-- Nexus: Product Gap Closure (Batches 3-6, P-013).
--
-- add_reference_option had no concept of Reference Master's own Level
-- 1/2/3 tiering: the UI (reference-master-settings.tsx's LIST_CONFIGS)
-- correctly hides the Add control for the five Level 3, system-supported
-- lists ("A new value needs new application or calculation code before
-- it means anything at all, so Settings never allows adding one for any
-- of these five", docs/SETTINGS_ARCHITECTURE.md §3), but a direct RPC
-- call for one of those five list_keys succeeded with no rejection,
-- confirmed live during Batch 6's P-013 journey. This mirrors the exact
-- principle already applied correctly to permission gating elsewhere in
-- this codebase (docs/AUTHORIZATION_MODEL.md §14: "this is a rendering
-- convenience only, the Server Action's own check is what actually
-- enforces this"), applied here to list-tier gating instead.
--
-- The five Level 3 list_key values are read directly from
-- docs/SETTINGS_ARCHITECTURE.md §3 (Commercial Nature, Pricing Models,
-- Invoice Timing, Slab Methods, Revenue Recognition Methods) and from
-- reference-master-settings.tsx's own LIST_CONFIGS (level: "system"):
-- commercial_nature, pricing_model, invoice_timing, slab_method,
-- revenue_recognition_method. No business decision is required: which
-- five lists are Level 3, and that Settings should never allow adding to
-- them, is already fully decided and documented; only the enforcement
-- layer was missing.
--
-- Read access, existing options, and existing references are entirely
-- unaffected: this only blocks a new INSERT via add_reference_option for
-- one of the five list_keys. set_reference_option_active (Activate/
-- Deactivate) is deliberately untouched, since Level 3 values may still
-- be deactivated/reactivated (docs/SETTINGS_ARCHITECTURE.md §3: "Activate/
-- Deactivate remains available since it costs nothing extra"), only
-- adding a brand new one is disallowed.

create or replace function add_reference_option(
  p_list_key text,
  p_code text,
  p_label text,
  p_sort_order integer,
  p_inr_conversion_rate numeric,
  p_cadence_months integer,
  p_actor_user_id uuid
)
returns reference_options
language plpgsql
security invoker
as $$
declare
  v_row reference_options;
begin
  if p_list_key in ('commercial_nature', 'pricing_model', 'invoice_timing', 'slab_method', 'revenue_recognition_method') then
    raise exception 'REFERENCE_LIST_SYSTEM_SUPPORTED: % is a Level 3, system-supported list. A new value needs new application or calculation code before it means anything, so new values cannot be added to it.', p_list_key
      using errcode = '23514';
  end if;

  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', '', true);

  insert into reference_options (
    list_key, code, label, sort_order, inr_conversion_rate, cadence_months, created_by, updated_by
  )
  values (
    p_list_key, p_code, p_label, coalesce(p_sort_order, 0), p_inr_conversion_rate, p_cadence_months,
    p_actor_user_id, p_actor_user_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

comment on function add_reference_option(text, text, text, integer, numeric, integer, uuid) is
  'Adds one reference_options row and records p_actor_user_id as the real audit actor. '
  'Called only by service_role, only after application-layer permission enforcement '
  '(src/platform/permissions/server.ts). Rejects list_key values in the fixed Level 3, '
  'system-supported set (commercial_nature, pricing_model, invoice_timing, slab_method, '
  'revenue_recognition_method) with REFERENCE_LIST_SYSTEM_SUPPORTED, matching Settings'' '
  'own already-documented invariant that these five never accept a new value.';
