-- =============================================================================
-- Fix: send_back_customer_onboarding_case overload ambiguity
-- =============================================================================
-- 20260914130000_customer_onboarding_send_back_history.sql added a new
-- trailing p_field_comments parameter via `create or replace function`,
-- intending to extend the existing function in place. Postgres instead
-- created a SECOND overload alongside the original 5-parameter one,
-- since a `create or replace` only replaces a function whose parameter
-- list (types AND count) matches exactly; adding a parameter changes the
-- count, so it is a distinct overload, not a replacement. With both
-- overloads present, any call omitting p_field_comments (every existing
-- caller, since it did not exist before) became ambiguous:
-- "function send_back_customer_onboarding_case(uuid, text, text, uuid)
-- is not unique", discovered during end-to-end verification
-- (docs/CUSTOMER_LIFECYCLE.md §18). This drops the stale overload,
-- leaving only the 6-parameter version every caller (TypeScript RPC
-- wrapper included) actually targets.

drop function if exists send_back_customer_onboarding_case(uuid, text, text, uuid, jsonb);
