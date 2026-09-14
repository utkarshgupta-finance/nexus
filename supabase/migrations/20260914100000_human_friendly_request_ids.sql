-- Nexus: Human-Friendly IDs (task Phase L).
--
-- Users should not primarily see UUID slices as their reference for a
-- request. Adds one database-backed, concurrency-safe sequence per
-- governed request type, so every existing and future row gets a
-- stable, never-reassigned display number: CO-000123 (Customer
-- Onboarding), CCR-000045 (Customer Change Request), CC-000078
-- (Commercial Configuration Version, Nexus's own "Commercial Change"
-- vocabulary). The underlying UUID (`request_id`) remains the real,
-- internal stable identity everywhere; these are purely a display/
-- search convenience layered on top, never a replacement for it.
--
-- A `sequence`-backed `not null default nextval(...)` column, added via
-- `alter table`, is evaluated once per already-existing row at
-- migration time (in whatever physical order Postgres reads them),
-- assigning every historical record a real number too, never NULL and
-- never renumbered later: a sequence only ever advances, it does not
-- reorder past assignments.
--
-- This file has not been applied to any database as of authoring.

create sequence customer_onboarding_case_number_seq;
alter table customer_onboarding_cases
  add column case_number integer not null default nextval('customer_onboarding_case_number_seq');
alter sequence customer_onboarding_case_number_seq owned by customer_onboarding_cases.case_number;
create unique index idx_customer_onboarding_cases_case_number on customer_onboarding_cases (case_number);

create sequence customer_change_request_number_seq;
alter table customer_change_requests
  add column request_number integer not null default nextval('customer_change_request_number_seq');
alter sequence customer_change_request_number_seq owned by customer_change_requests.request_number;
create unique index idx_customer_change_requests_request_number on customer_change_requests (request_number);

create sequence commercial_configuration_version_number_seq;
alter table commercial_configuration_versions
  add column version_number integer not null default nextval('commercial_configuration_version_number_seq');
alter sequence commercial_configuration_version_number_seq owned by commercial_configuration_versions.version_number;
create unique index idx_commercial_configuration_versions_version_number on commercial_configuration_versions (version_number);

comment on column customer_onboarding_cases.case_number is
  'Human-friendly display id (rendered "CO-######"), immutable once assigned. Never used as a join key; request_id remains the real identity.';
comment on column customer_change_requests.request_number is
  'Human-friendly display id (rendered "CCR-######"), immutable once assigned. Never used as a join key; request_id remains the real identity.';
comment on column commercial_configuration_versions.version_number is
  'Human-friendly display id (rendered "CC-######"), immutable once assigned, distinct from this row''s own business-facing "Version N" ordinal (per-configuration, computed elsewhere). Never used as a join key; request_id remains the real identity.';
