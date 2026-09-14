-- Nexus: Go Live + Entitlement Ledger, Phase R fix. Phase R names
-- "Settlement Recorded" explicitly as a governed action needing actor
-- identity, but settlement_records was not wired to fn_audit_row in
-- the foundation migration (unlike entitlement_sources and
-- monthly_usage, both of which already were). The other new tables
-- (entitlement_schedule_months, monthly_entitlement_ledger,
-- unbilled/unearned_ledger_entries) are deliberately left unaudited:
-- they are computed/derived facts recomputed automatically, not a
-- discrete human action, matching the Resource Registry's own
-- "do not register every ledger row" principle applied to the audit
-- trail as well.
--
-- This file has not been applied to any database as of authoring.

create trigger trg_audit_settlement_records
  after insert or update or delete on settlement_records
  for each row execute function fn_audit_row('id');
