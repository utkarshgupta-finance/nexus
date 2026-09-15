-- =============================================================================
-- Index/query mismatch found during NEXUS FULL PRODUCT READINESS
-- performance audit: idx_unbilled_ledger_entries_component and
-- idx_unearned_ledger_entries_component were built as
-- (stable_component_key, status), but the only query keyed by
-- stable_component_key (listUnbilledEntriesForComponent/
-- listUnearnedEntriesForComponent in entitlement.data.ts) filters by
-- stable_component_key alone and orders by month; it never filters by
-- status. The status-filtered query (listOpenUnbilledEntriesForCustomer/
-- listOpenUnearnedEntriesForCustomer) filters by customer_id instead,
-- already correctly served by idx_unbilled_ledger_entries_open /
-- idx_unearned_ledger_entries_open. Replacing the second column with
-- month makes the index actually cover the real filter+sort.
-- =============================================================================

drop index if exists idx_unbilled_ledger_entries_component;
create index idx_unbilled_ledger_entries_component on unbilled_ledger_entries (stable_component_key, month);

drop index if exists idx_unearned_ledger_entries_component;
create index idx_unearned_ledger_entries_component on unearned_ledger_entries (stable_component_key, month);
