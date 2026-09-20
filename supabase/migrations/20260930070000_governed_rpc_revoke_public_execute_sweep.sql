-- Nexus: Governed RPC Trust-Boundary Closure.
--
-- Extends 20260930060000_onboarding_rpc_revoke_public_execute.sql:
-- several more governed, backend-only mutation RPCs still carried
-- Postgres's default PUBLIC execute grant, because their original
-- migrations revoked execute from `anon, authenticated` by name but
-- never from `public`, which does not remove the separate grant every
-- role implicitly inherits from PUBLIC. Every affected function is
-- confirmed backend-only by architecture: called exclusively via
-- `getSupabaseServiceRoleClient()` from a `*.data.ts` repository file
-- (`src/lib/supabase/server-client.ts`, guarded by `server-only`,
-- never bundled into client code), never from browser/client code.
--
-- Fix: revoke PUBLIC's default execute grant on each function below,
-- using its exact current live signature, matching the already-working
-- pattern from the prior onboarding fix. No business logic changes.
-- Also adds `list_governed_rpc_grant_violations()`, a systemic guard
-- (see below) so a future governed RPC cannot silently accumulate this
-- same gap without a repeatable check surfacing it.
--
-- Full audit detail (which functions, exact severity ranking, and the
-- verification method used) is recorded in
-- docs/journey-runs/BATCH_07_RESULTS.md at an architectural level, per
-- this project's own rule that authorization defects are documented
-- for reproducibility of the invariant, not as a step-by-step guide.

-- === Customer Change ===

revoke all on function create_customer_change_request(uuid, uuid, jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function create_customer_change_request(uuid, uuid, jsonb, uuid, jsonb) to service_role;

revoke all on function save_customer_change_draft(uuid, jsonb, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function save_customer_change_draft(uuid, jsonb, integer, uuid, jsonb) to service_role;

revoke all on function submit_customer_change_request(uuid, text, date, jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function submit_customer_change_request(uuid, text, date, jsonb, uuid, jsonb) to service_role;

revoke all on function send_back_customer_change_request(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function send_back_customer_change_request(uuid, text, uuid, jsonb) to service_role;

revoke all on function approve_customer_change_request(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function approve_customer_change_request(uuid, uuid, jsonb, text) to service_role;

revoke all on function cancel_customer_change_request(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function cancel_customer_change_request(uuid, text, uuid, jsonb) to service_role;

-- === Commercial Configuration ===

revoke all on function create_commercial_configuration_version(uuid, uuid, text, jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function create_commercial_configuration_version(uuid, uuid, text, jsonb, uuid, jsonb) to service_role;

revoke all on function submit_commercial_configuration_version(uuid, text, date, uuid, jsonb) from public, anon, authenticated;
grant execute on function submit_commercial_configuration_version(uuid, text, date, uuid, jsonb) to service_role;

revoke all on function approve_commercial_configuration_version(uuid, jsonb, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function approve_commercial_configuration_version(uuid, jsonb, uuid, jsonb, text) to service_role;

revoke all on function cancel_commercial_configuration_version(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function cancel_commercial_configuration_version(uuid, text, uuid, jsonb) to service_role;

revoke all on function add_commercial_component(uuid, uuid, uuid, boolean, text, jsonb, text, text, text, text, numeric, date, uuid, text, uuid, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function add_commercial_component(uuid, uuid, uuid, boolean, text, jsonb, text, text, text, text, numeric, date, uuid, text, uuid, uuid, jsonb, uuid) to service_role;

-- === Customer Master ===

revoke all on function set_customer_active(uuid, boolean, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function set_customer_active(uuid, boolean, text, uuid, jsonb) to service_role;

revoke all on function delete_customer_permanently(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function delete_customer_permanently(uuid, text, uuid, jsonb) to service_role;

-- === Go Live ===

revoke all on function approve_go_live_request(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function approve_go_live_request(uuid, uuid, jsonb, text) to service_role;

-- === Customer Change (additional decision RPC) / Commercial Configuration (additional decision RPC) ===

revoke all on function reject_commercial_configuration_version(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function reject_commercial_configuration_version(uuid, text, uuid, jsonb) to service_role;

revoke all on function reject_customer_change_request(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function reject_customer_change_request(uuid, text, uuid, jsonb) to service_role;

-- === Trigger functions (defensive hardening only; direct invocation was already inert) ===

revoke all on function fn_protect_customer_onboarding_document_lifecycle() from public, anon, authenticated;
revoke all on function fn_protect_team_grant() from public, anon, authenticated;

-- =============================================================================
-- Systemic guard: finds this class of defect by pattern rather than by a
-- maintained name list, so a future governed RPC that forgets the
-- PUBLIC revoke is caught automatically. Restricted to service_role,
-- matching every other maintenance function's trust tier in this
-- schema.
-- =============================================================================

create or replace function list_governed_rpc_grant_violations()
returns table (function_name text, function_args text, anon_can_execute boolean, authenticated_can_execute boolean)
language sql
stable
as $function$
  select
    p.proname::text,
    pg_get_function_identity_arguments(p.oid),
    has_function_privilege('anon', p.oid, 'EXECUTE'),
    has_function_privilege('authenticated', p.oid, 'EXECUTE')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname ~ '^(create|save|submit|approve|reject|send_back|cancel|delete|set|add|update|revoke|grant|publish)_'
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
$function$;

comment on function list_governed_rpc_grant_violations() is
  'Returns every function in the public schema whose name looks like a governed mutation and still grants execute to anon or authenticated. An empty result set is healthy. A non-empty result means a migration introduced or re-introduced the PUBLIC-execute-grant defect this function exists to catch. Run via scripts/verify-governed-rpc-grants.ts before applying any migration that touches a governed mutation RPC.';

revoke all on function list_governed_rpc_grant_violations() from public, anon, authenticated;
grant execute on function list_governed_rpc_grant_violations() to service_role;
