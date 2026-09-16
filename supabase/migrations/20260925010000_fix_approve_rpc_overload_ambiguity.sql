-- Nexus: fixes a real defect in 20260925000000_workflow_runtime_v1_sequential_execution.sql,
-- found immediately while running that migration's own regression
-- suite.
--
-- `create or replace function` only replaces a function with the exact
-- same parameter signature. Adding the new, optional
-- `p_expected_current_node_key` parameter to all four `approve_*` RPCs
-- did not replace the prior 3/9-parameter versions from
-- 20260921000000_workflow_runtime_v1.sql; it created a second overload
-- alongside them. Every `approve_*` call omitting the new parameter
-- (every existing Server Action call site, since none has been updated
-- to pass it) became genuinely ambiguous between the two overloads and
-- failed with "Could not choose the best candidate function," breaking
-- every approval in every one of the four domains.
--
-- Fix: drop the four stale, shorter-signature overloads by their exact
-- original argument list, leaving only the new signature (already
-- correct, already includes the optional parameter with a default) in
-- place.

drop function approve_customer_change_request(uuid, uuid, jsonb);
drop function approve_customer_onboarding_case(uuid, text, text, text, text, jsonb, date, uuid, jsonb, jsonb);
drop function approve_commercial_configuration_version(uuid, jsonb, uuid, jsonb);
drop function approve_go_live_request(uuid, uuid, jsonb);
