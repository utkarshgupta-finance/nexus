-- Nexus Platform Scale Closure, Phase Q: label the three decorative
-- row_version columns truthfully at the schema level, not only in docs.
--
-- Audit finding: customer_onboarding_cases.row_version,
-- customer_change_requests.row_version, and
-- commercial_configuration_versions.row_version are never incremented by
-- any trigger and never read or compared by any RPC. The real
-- concurrency protection for these three tables' decision RPCs
-- (submit_*/send_back_*/reject_*/approve_*) is `select ... for update`
-- (pessimistic locking) plus a status-text guard, not these columns.
-- Not dropped (a one-way schema change not worth the risk for a column
-- that is harmless, only unused); commented so a future reader does not
-- mistake their presence for active protection. See
-- docs/DATA_ARCHITECTURE.md §5a for the full per-table rationale.

comment on column customer_onboarding_cases.row_version is
  'Not wired to any trigger or RPC check. The real concurrency protection for this table is SELECT ... FOR UPDATE plus a status-text guard in every decision RPC. See docs/DATA_ARCHITECTURE.md §5a. Do not add a comparison against this column without first re-reading that section.';

comment on column customer_change_requests.row_version is
  'Not wired to any trigger or RPC check. The real concurrency protection for this table is SELECT ... FOR UPDATE plus a status-text guard in every decision RPC. See docs/DATA_ARCHITECTURE.md §5a. Do not confuse with base_customer_row_version, which is a real, actively checked snapshot of customers.row_version.';

comment on column commercial_configuration_versions.row_version is
  'Not wired to any trigger or RPC check. The real concurrency protection for this table is SELECT ... FOR UPDATE plus a status-text guard in every decision RPC. See docs/DATA_ARCHITECTURE.md §5a.';
