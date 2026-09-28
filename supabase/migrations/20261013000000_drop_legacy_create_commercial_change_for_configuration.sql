-- PG-038 (D-017, Batch 11; E-020, Batch 12): a legacy, ungoverned RPC
-- performed a synchronous, unconditional live mutation (closed every open
-- component, inserted a commercial_changes row) with no draft, submit,
-- approver, self-approval check, or workflow routing. service_role-only
-- grants, zero application-layer caller (confirmed via source-wide grep
-- before this migration was written). Racing it against a real governed
-- draft was reproduced (E-020) to leave the governed draft's own snapshot
-- stale, producing a real business-data gap once the governed change
-- later approved.
--
-- DECIDED (2026-09-28): delete outright. Zero current callers, zero
-- current value; every real later-change path already goes through the
-- governed `approve_commercial_configuration_version` workflow instead.

drop function if exists create_commercial_change_for_configuration(
  uuid, uuid, text, date, uuid, text, jsonb
);
