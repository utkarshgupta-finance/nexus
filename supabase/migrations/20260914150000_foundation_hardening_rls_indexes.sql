-- =============================================================================
-- Foundation hardening: restore RLS on every table since Customer Lifecycle,
-- add missing FK/query indexes, and close a concurrent-draft gap
-- =============================================================================
-- Found during a foundation/scale audit (docs/ARCHITECTURE.md-driven review):
-- every table from 20260906084244_platform_core_foundation.sql through
-- 20260912080000_reference_master_foundation.sql enables Row Level Security
-- with zero policies, relying on privilege revocation from anon/authenticated
-- underneath it (docs/DATA_ARCHITECTURE.md §12: "RLS is a defense-in-depth
-- boundary... beneath this... ordinary PostgreSQL table privileges").
-- Every table created from 20260913040000_customer_lifecycle_onboarding_foundation.sql
-- onward (Customer Onboarding, Customer Change Request, Commercial Version,
-- Customer Deletion, Onboarding Documents/Send-Backs/Field-Comments) shipped
-- with the privilege-revocation half of that pattern but never the
-- `ENABLE ROW LEVEL SECURITY` half. This is purely additive: no policy is
-- added (matching the existing zero-policy convention everywhere else), so
-- application behavior is unchanged; it only restores the same
-- defense-in-depth backstop every other table already has, in case a future
-- migration or platform default ever regrants table privilege to
-- anon/authenticated on one of these nine tables.

alter table customer_onboarding_cases enable row level security;
alter table customer_change_requests enable row level security;
alter table customer_change_request_requirements enable row level security;
alter table customer_field_history enable row level security;
alter table commercial_configuration_versions enable row level security;
alter table customer_deletion_audit enable row level security;
alter table customer_onboarding_documents enable row level security;
alter table customer_onboarding_send_backs enable row level security;
alter table customer_onboarding_field_comments enable row level security;

-- =============================================================================
-- Missing indexes: the columns real application queries actually filter or
-- sort by (docs/DATA_ARCHITECTURE.md §5: "added for the columns a feature
-- actually filters or sorts by, decided when that query pattern exists"),
-- plus the foreign keys on the busiest tables that had none at all.
-- =============================================================================

-- customer_onboarding_cases: had zero indexes beyond its primary key.
-- created_by backs "My Requests" (case.data.ts's listCasesCreatedBy);
-- status backs the review queue and Approvals inbox; updated_at backs the
-- default sort on all three list queries.
create index idx_customer_onboarding_cases_created_by on customer_onboarding_cases (created_by, updated_at desc);
create index idx_customer_onboarding_cases_status on customer_onboarding_cases (status, updated_at desc);
create index idx_customer_onboarding_cases_customer_id on customer_onboarding_cases (customer_id) where customer_id is not null;
create index idx_customer_onboarding_cases_sent_back_by on customer_onboarding_cases (sent_back_by) where sent_back_by is not null;
create index idx_customer_onboarding_cases_approved_by on customer_onboarding_cases (approved_by) where approved_by is not null;

-- customer_change_requests: status backs the review queue/Approvals;
-- customer_id backs the Customer workspace's Change Requests tab.
create index idx_customer_change_requests_customer_id on customer_change_requests (customer_id);
create index idx_customer_change_requests_status on customer_change_requests (status, updated_at desc);
create index idx_customer_change_requests_sent_back_by on customer_change_requests (sent_back_by) where sent_back_by is not null;
create index idx_customer_change_requests_decided_by on customer_change_requests (decided_by) where decided_by is not null;

create index idx_customer_change_request_requirements_request_id on customer_change_request_requirements (customer_change_request_id);

create index idx_customer_field_history_change_request_id on customer_field_history (customer_change_request_id) where customer_change_request_id is not null;
create index idx_customer_field_history_requested_by on customer_field_history (requested_by) where requested_by is not null;
create index idx_customer_field_history_approved_by on customer_field_history (approved_by) where approved_by is not null;

-- commercial_configuration_versions: status backs the review queue/Approvals;
-- commercial_configuration_id backs Version History.
create index idx_commercial_configuration_versions_config_id on commercial_configuration_versions (commercial_configuration_id);
create index idx_commercial_configuration_versions_status on commercial_configuration_versions (status, updated_at desc);
create index idx_commercial_configuration_versions_decided_by on commercial_configuration_versions (decided_by) where decided_by is not null;

create index idx_customer_onboarding_documents_uploaded_by on customer_onboarding_documents (uploaded_by) where uploaded_by is not null;
create index idx_customer_onboarding_send_backs_sent_back_by on customer_onboarding_send_backs (sent_back_by) where sent_back_by is not null;
create index idx_customer_onboarding_field_comments_reviewer_id on customer_onboarding_field_comments (reviewer_id) where reviewer_id is not null;
create index idx_customer_deletion_audit_deleted_by on customer_deletion_audit (deleted_by) where deleted_by is not null;

-- customers/capabilities (Migration 7): had zero indexes at all beyond the
-- primary key. created_by is the one column with a plausible near-term
-- query (an "onboarded by me" filter); updated_by is indexed for the same
-- FK-completeness reason the rest of the schema already follows.
create index idx_customers_created_by on customers (created_by) where created_by is not null;
create index idx_customers_updated_by on customers (updated_by) where updated_by is not null;
create index idx_capabilities_created_by on capabilities (created_by) where created_by is not null;
create index idx_capabilities_updated_by on capabilities (updated_by) where updated_by is not null;

-- =============================================================================
-- Concurrent-draft gap: commercial_configuration_versions had no guard
-- against two non-terminal versions existing for the same configuration at
-- once, unlike form_versions' own uq_form_versions_one_active_draft. Two
-- concurrent "next version" drafts could otherwise both be created and
-- separately submitted/approved against the same configuration, with
-- nothing catching it until commercial_components' own closure logic ran
-- as a side effect at approval time.
-- =============================================================================

create unique index uq_commercial_configuration_versions_one_open_per_config
  on commercial_configuration_versions (commercial_configuration_id)
  where status in ('draft', 'submitted');

comment on index uq_commercial_configuration_versions_one_open_per_config is
  'At most one draft or submitted Commercial Configuration Version may exist per configuration at a time, mirroring uq_form_versions_one_active_draft''s own pattern. Approved/rejected versions are terminal and never collide.';
