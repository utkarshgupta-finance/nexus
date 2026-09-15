-- =============================================================================
-- Privilege hardening: close a gap the Supabase security advisor surfaced
-- during the NEXUS FULL PRODUCT READINESS review.
--
-- Every trigger-only function in this codebase gets an explicit
-- `revoke execute ... from public, anon, authenticated` in its own
-- migration (see supabase/migrations/20260906210726_revoke_trigger_function_execute.sql,
-- and the per-migration "Privilege hardening" sections for
-- fn_protect_reference_option_lifecycle, fn_protect_commercial_commitment_scope,
-- fn_reject_truncate, and others). The Go Live and Entitlement Ledger
-- migrations (20260918010000_go_live_domain.sql,
-- 20260919010000_entitlement_ledger_foundation.sql) revoked EXECUTE on
-- every callable RPC they added, but omitted their three new
-- SECURITY DEFINER trigger functions from that revoke, breaking this
-- otherwise universal convention.
--
-- PostgreSQL itself refuses to invoke a function whose return type is
-- `trigger` outside of trigger context (the same reasoning
-- fn_reject_truncate's own migration comment already documents), so
-- this was not an exploitable path: the Supabase advisor's
-- anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable findings for these
-- three functions were a real but non-exercisable gap. Revoking anyway
-- for consistency with the rest of the schema and to keep the advisor
-- clean, exactly as every other trigger function in this project already
-- does. No GRANT is added to any role, matching the locked convention in
-- docs/FOUNDATION_RPC_PRIVILEGE_HARDENING_DESIGN.md §12: trigger-only
-- functions are REVOKE-only.
-- =============================================================================

revoke execute on function fn_protect_go_live_document_lifecycle() from public, anon, authenticated;
revoke execute on function fn_protect_ledger_entry_lifecycle() from public, anon, authenticated;
revoke execute on function fn_protect_monthly_usage_lifecycle() from public, anon, authenticated;
