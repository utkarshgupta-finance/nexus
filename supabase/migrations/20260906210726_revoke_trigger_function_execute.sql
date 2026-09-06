-- Nexus: revoke residual EXECUTE privilege on trigger functions.
--
-- Migration 2 revoked EXECUTE on these five functions from PUBLIC, but
-- verification proved anon and authenticated each hold a separate explicit
-- grant that REVOKE ... FROM PUBLIC does not remove. Trigger functions are
-- invoked by the trigger mechanism itself, not by the calling role, so no
-- role needs direct EXECUTE on them. This migration closes that residual
-- privilege explicitly, by name, for anon and authenticated only.
--
-- service_role and postgres privileges are intentionally left unchanged.
-- The functions themselves are not modified.

revoke execute on function fn_set_updated_at() from anon, authenticated;
revoke execute on function fn_resources_immutable() from anon, authenticated;
revoke execute on function fn_audit_row() from anon, authenticated;
revoke execute on function fn_audit_log_immutable() from anon, authenticated;
revoke execute on function fn_protect_access_grant() from anon, authenticated;
