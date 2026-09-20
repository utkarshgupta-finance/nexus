-- Nexus: close a latent PUBLIC-execute gap on 4 Customer Onboarding RPCs.
--
-- Found live during NEXUS BATCH 7's mandatory re-verification of
-- DEFECT-B7-001's closure (the user explicitly asked whether
-- submit_customer_onboarding_case could still be reached by an
-- "untrusted caller" independent of the TypeScript service layer).
--
-- Empirical check: `select proacl from pg_proc where proname = ...`
-- showed save_customer_onboarding_draft and submit_customer_onboarding_case
-- (both touched by this batch's own migration
-- 20260930050000_onboarding_draft_save_submit_creator_only.sql, which
-- happened to `revoke all ... from public, anon, authenticated`) have NO
-- PUBLIC entry in their ACL. But create_customer_onboarding_case,
-- cancel_customer_onboarding_case, send_back_customer_onboarding_case,
-- and approve_customer_onboarding_case all still carry the Postgres
-- default `=X/postgres` (PUBLIC execute) entry, because their original
-- `revoke execute ... from anon, authenticated` (foundation migration
-- 20260913040000, and cancel's own migration 20260916010000) never
-- named `public` specifically. Revoking from a named role does not
-- revoke the separate PUBLIC grant every role implicitly inherits, so
-- anon and authenticated have had EXECUTE on these 4 functions via
-- PUBLIC the entire time.
--
-- Confirmed via a raw HTTP POST to the PostgREST RPC endpoint using
-- only the public anon key (no login): calling
-- create_customer_onboarding_case returned 401 `permission denied for
-- table form_definitions`, not `permission denied for function
-- create_customer_onboarding_case`. The function itself executed far
-- enough to reach an internal table read before failing, purely
-- because form_definitions happens to lack its own anon/authenticated
-- grant. That is accidental protection, not intentional: if
-- form_definitions' grants are ever widened for an unrelated feature,
-- any authenticated user (with no `customer.create` permission at all)
-- would be able to create onboarding cases directly, bypassing the
-- entire Next.js authorization layer. approve_customer_onboarding_case
-- is worse: its live signature has grown two extra parameters since the
-- original revoke was written (p_customer_fields, p_expected_current_node_key),
-- so that revoke silently targets an overload that no longer exists;
-- the current live function was never revoked from anon/authenticated
-- OR public at all.
--
-- Fix: revoke PUBLIC's default execute grant on all 4 functions,
-- matching the working pattern already used for save/submit. No
-- business logic changes; this is purely a database privilege
-- correction. Re-grants to service_role are included for clarity, even
-- though they are already present, since a plain REVOKE never touches
-- another role's separate grant.

revoke all on function create_customer_onboarding_case(uuid, jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function create_customer_onboarding_case(uuid, jsonb, uuid, jsonb) to service_role;

revoke all on function cancel_customer_onboarding_case(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function cancel_customer_onboarding_case(uuid, text, uuid, jsonb) to service_role;

revoke all on function send_back_customer_onboarding_case(uuid, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function send_back_customer_onboarding_case(uuid, text, text, uuid, jsonb, jsonb) to service_role;

revoke all on function approve_customer_onboarding_case(uuid, text, text, text, text, jsonb, date, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function approve_customer_onboarding_case(uuid, text, text, text, text, jsonb, date, uuid, jsonb, jsonb, text) to service_role;
