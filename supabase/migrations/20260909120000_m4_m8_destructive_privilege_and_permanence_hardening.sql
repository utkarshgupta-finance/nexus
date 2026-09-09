-- Nexus: M4-M8 Destructive Privilege and Permanence Hardening.
--
-- Forward migration implementing Migration A of the locked design in
-- docs/M4_M8_FOUNDATION_HARDENING_DESIGN.md (§6). Referred to by its
-- descriptive name only: it carries no migration number and is
-- specifically not "Migration 9", which stays reserved by
-- docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md for the Commercial Usage
-- and Earned stage (design §5.3, §19).
--
-- The defect it closes (design §1, §4, §9). The 13 tables created by
-- Migrations 4, 5, 7, and 8 protect their permanence and history contracts
-- with row-level triggers backed by privilege revocation. PostgreSQL does
-- not fire row-level triggers on TRUNCATE, and Row Level Security does not
-- apply to TRUNCATE at all, so for TRUNCATE those tables had zero layers
-- while claiming an unconditional contract for row-level DELETE. Migrations
-- 4, 5, 7, and 8 each revoked ALL from anon and authenticated, but none
-- named TRUNCATE against service_role, so the trusted application path kept
-- it on all 13. This migration restores both layers, closing P1-1, P1-2,
-- P1-3, and P2-1.
--
-- Three conceptual operations, in the locked order (design §6.1):
--   A. attach public.fn_reject_truncate() as a BEFORE TRUNCATE FOR EACH
--      STATEMENT guard to all 13 M4-M8 tables, in the design §2.1 order
--   B. revoke TRUNCATE from service_role on the same 13 tables, in one
--      statement
--   C. update the guard function comment to record the widened attachment
--      set, and the 13 table comments so the documented contract matches
--      the enforced one
--
-- Triggers precede the revoke, matching the operation order of
-- 20260909090000_platform_core_integrity_hardening.sql. Nothing depends on
-- the order within one transaction, but the order is locked so the
-- migration text and the runtime gate describe the same sequence.
--
-- Reuse, not redefinition (design §6.2). public.fn_reject_truncate() was
-- created by 20260909090000_platform_core_integrity_hardening.sql and is
-- reused byte for byte. This migration does not redefine it, does not
-- alter it, does not change its search_path, and does not change its
-- privilege posture: it only attaches new triggers to it. Its body is a
-- canonical gated contract and the premise of the composite proof that
-- transfers the behavioral TRUNCATE proof to the 10 foreign-key-referenced
-- tables (design §9.3). No second rejection function is created.
--
-- Fail-loud (design §5.1, §6.1). Every object this migration depends on is
-- named exactly: the 13 trigger target tables, the 13 revoke targets, and
-- the guard function. No existence-guarded form of any statement appears
-- anywhere in this file, so a missing or renamed table, a colliding
-- trigger name, or an absent or redefined guard function fails the
-- migration rather than silently producing a partially hardened state.
--
-- form_definitions semantics, stated because it is the one table where the
-- two protections deliberately differ (design §9.2, §17.1): deleting a
-- genuinely unused Form Definition with zero Form Versions stays
-- permitted. A BEFORE TRUNCATE FOR EACH STATEMENT trigger fires only on
-- TRUNCATE and is invisible to a row-level DELETE, so the locked
-- selective-DELETE rule is preserved exactly and at zero cost. No DELETE
-- guard is added to form_definitions, and fn_form_definitions_protect_key()
-- is not touched.
--
-- Deliberately out of scope (design §6.4, §6.5, §17): no RLS change, no
-- policy, no ownership change, no owner privilege revoke, no default
-- privilege change (the postgres/public service_role TRUNCATE default was
-- already removed by 20260909090000_platform_core_integrity_hardening.sql,
-- so the recurrence path for future postgres-created tables in schema
-- public is closed and re-issuing it would falsely imply it was still
-- open), no supabase_admin change of any kind, no anon or authenticated
-- revoke (Migrations 4, 5, 7, and 8 each already revoked ALL from both and
-- TRUNCATE is inside ALL), no foreign-key change, no column change, no
-- audit-trigger change, no function body change, no seed or business data,
-- and no truncation of any table by this migration.
--
-- Also out of scope, and deliberately so: this migration does not close
-- P2-2, P2-3, P2-4, or P2-5. Those belong to Migration B, and both the
-- M4-M8 retrospective and Commercial Migration 9 stay blocked until
-- Migration B is complete in both its parts (design §5.2, §19).
--
-- Historical migrations are never edited. Migrations 1 through 8, the
-- Foundation RPC Privilege Hardening migration, and the Platform Core
-- Integrity Hardening migration remain immutable history.
--
-- This file has not been applied to any database.


-- =============================================================================
-- Section A: statement-level TRUNCATE guards on all 13 M4-M8 tables
-- =============================================================================

-- The derived attachment rule (design §9.2), identical to the one
-- 20260909090000_platform_core_integrity_hardening.sql applied to Platform
-- Core: a statement-level TRUNCATE guard is attached exactly where the
-- table already claims a permanence or history contract. Here that
-- produces 13 of 13 rather than 4 of 8, because the M4-M8 tables are
-- overwhelmingly permanence-guarded. Twelve of the 13 already reject
-- row-level DELETE unconditionally through their own lifecycle or
-- insert-only guard, so attaching this trigger closes a hole in a
-- protection each of them already claimed to have. No table gains a new
-- class of protection.
--
-- form_definitions is the thirteenth and the only contested one. It
-- receives the guard because DELETE-one and TRUNCATE-all are not
-- semantically equivalent, because a statement-level guard cannot reach
-- the permitted selective DELETE, and because form_definitions is the root
-- of the form, version, request, submission graph whose referencing tables
-- a cascading truncation would follow regardless of every declared
-- ON DELETE RESTRICT action (design §9.2).
--
-- BEFORE TRUNCATE and FOR EACH STATEMENT are not a preference: PostgreSQL
-- requires TRUNCATE triggers to be statement-level. Ordinary CREATE
-- TRIGGER, so tgenabled is 'O', matching the 4 Platform Core guards;
-- ENABLE ALWAYS is deliberately not used, since it is different behavior
-- with respect to session_replication_role rather than merely a stronger
-- form, and adopting it would be a separate architecture decision this
-- design has not made. No trigger arguments, so tgnargs is 0 for all 13.
-- No condition: PostgreSQL does not permit one on a TRUNCATE trigger, and
-- the guard is unconditional by design (design §6.3).

create trigger trg_form_definitions_reject_truncate
  before truncate on public.form_definitions
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_form_versions_reject_truncate
  before truncate on public.form_versions
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_requests_reject_truncate
  before truncate on public.requests
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_submission_revisions_reject_truncate
  before truncate on public.submission_revisions
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_customers_reject_truncate
  before truncate on public.customers
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_capabilities_reject_truncate
  before truncate on public.capabilities
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_measurement_definitions_reject_truncate
  before truncate on public.measurement_definitions
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_commercial_configurations_reject_truncate
  before truncate on public.commercial_configurations
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_commercial_changes_reject_truncate
  before truncate on public.commercial_changes
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_commercial_components_reject_truncate
  before truncate on public.commercial_components
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_commercial_component_capabilities_reject_truncate
  before truncate on public.commercial_component_capabilities
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_commercial_commitments_reject_truncate
  before truncate on public.commercial_commitments
  for each statement
  execute function public.fn_reject_truncate();

create trigger trg_commercial_commitment_components_reject_truncate
  before truncate on public.commercial_commitment_components
  for each statement
  execute function public.fn_reject_truncate();


-- =============================================================================
-- Section B: TRUNCATE privilege revocation
-- =============================================================================

-- One privilege and one grantee, so it cannot affect any other privilege
-- or any other role (design §6.4). Uniform across all 13 M4-M8 tables:
-- service_role is the trusted application data path and has no legitimate
-- reason to truncate any of them, and a partial revoke would be harder to
-- state, test, and remember correctly in a future migration.
--
-- Deliberately not REVOKE ALL. service_role keeps SELECT, INSERT, UPDATE,
-- DELETE, REFERENCES, TRIGGER, and MAINTAIN wherever it currently holds
-- them, and the lifecycle or insert-only trigger on each table constrains
-- what those privileges can actually accomplish. anon and authenticated
-- are not named: Migrations 4, 5, 7, and 8 each already executed
-- REVOKE ALL on their own tables and TRUNCATE is inside ALL, so naming
-- them again would imply a doubt the schema does not support. PUBLIC was
-- never granted TRUNCATE on any M4-M8 table.
--
-- No owner privilege revoke. The owner keeps TRUNCATE by virtue of
-- ownership and is stopped by the Section A trigger instead. That is the
-- entire point of the two-layer control, and the fix is deliberately not
-- implemented by stripping the owner (design §6.4, §17.2).
--
-- No Platform Core table appears here. All eight already had TRUNCATE
-- revoked from service_role by
-- 20260909090000_platform_core_integrity_hardening.sql, and re-issuing it
-- would be a no-op implying that revoke had not held.
revoke truncate on table
  public.form_definitions, public.form_versions, public.requests,
  public.submission_revisions, public.customers, public.capabilities,
  public.measurement_definitions, public.commercial_configurations,
  public.commercial_changes, public.commercial_components,
  public.commercial_component_capabilities, public.commercial_commitments,
  public.commercial_commitment_components
from service_role;


-- =============================================================================
-- Section C: comments and schema-contract documentation
-- =============================================================================

-- This section is not an afterthought. The premise of the whole migration
-- is that a declared contract and an enforced contract had drifted apart,
-- so leaving the comments outside the described structure would repeat
-- that error in miniature. Each comment below preserves the meaning of the
-- comment it replaces and adds only the hardening clarification, and each
-- distinguishes row-level UPDATE/DELETE protection from statement-level
-- TRUNCATE protection, because conflating the two is what produced the
-- defect (design §6.1 operations 3 and 4).

-- The guard function itself is not redefined, altered, or reprivileged
-- here (design §6.2). Only its comment changes, to record the widened
-- attachment set: the 4 Platform Core tables plus the 13 M4-M8 tables of
-- Section A, so 17 in total (design §10).
comment on function public.fn_reject_truncate() is
  'Generic BEFORE TRUNCATE FOR EACH STATEMENT guard. Zero table-specific logic: '
  'raises unconditionally on every table it is attached to, with no branching, no '
  'table access, no dynamic SQL, and no success path. TG_TABLE_NAME is used only to '
  'compose the diagnostic message. Row-level UPDATE/DELETE triggers do not fire on '
  'TRUNCATE and RLS does not apply to it, so this is the statement-level twin of the '
  'row-level permanence and history guards across Platform Core and the M4-M8 '
  'Foundation. Attached to 17 tables: audit_log, resources, user_roles, and '
  'role_permissions (Platform Core), plus form_definitions, form_versions, requests, '
  'submission_revisions, customers, capabilities, measurement_definitions, '
  'commercial_configurations, commercial_changes, commercial_components, '
  'commercial_component_capabilities, commercial_commitments, and '
  'commercial_commitment_components (M4-M8). The body is a canonical contract, '
  'unchanged since it was created, and the premise of the composite TRUNCATE proof '
  'for every referenced table it guards: see '
  'docs/PLATFORM_CORE_HARDENING_DESIGN.md §9 and §16.8.0, and '
  'docs/M4_M8_FOUNDATION_HARDENING_DESIGN.md §6.2 and §9.3, before changing it.';

-- form_definitions is the one table in the set where row-level and
-- statement-level protection deliberately differ, so its comment states
-- the split explicitly rather than leaving a reader to infer it (design
-- §6.1 operation 4, §9.2).
comment on table public.form_definitions is
  'Stable, long-lived identity for a type of form (docs/FORM_VERSIONING_MODEL.md §3). '
  'Not a submission, not workflow state. key is database-immutable once set '
  '(trg_form_definitions_protect_key); name/description remain editable catalog labels. '
  'Holds no lifecycle status: whether a form type is offered is derived from whether it '
  'has a currently published form_versions row (§7), never a second flag here. '
  'Row-level and statement-level destruction are treated differently here, and that is '
  'deliberate: deleting a genuinely unused Form Definition with zero form_versions rows '
  'stays permitted, while emptying the table does not. '
  'trg_form_definitions_reject_truncate blocks statement-level TRUNCATE, which '
  'row-level triggers do not fire on and RLS does not apply to. TRUNCATE is not a bulk '
  'form of the permitted selective DELETE: it would remove every Form Definition, '
  'including those anchoring published Form Versions, live Requests, and Submission '
  'Revisions, which no locked rule has ever authorized.';

comment on table public.form_versions is
  'One exact, eventually-immutable Form Version (docs/FORM_VERSIONING_MODEL.md §4, §6). '
  'Primary key is resource_id, reusing a Resource Registry identity '
  '(resource_type = ''form_version'', enforced by trg_form_versions_assert_resource_type). '
  'Content is frozen the moment status leaves ''draft'' '
  '(trg_form_versions_protect_lifecycle). row_version is the optimistic-concurrency '
  'token for draft saves and publication binding, never caller-supplied. Rows are never '
  'removed, in two layers per operation class: trg_form_versions_protect_lifecycle '
  'rejects row-level DELETE unconditionally, and trg_form_versions_reject_truncate '
  'blocks statement-level TRUNCATE, which row-level triggers do not fire on.';

comment on table public.requests is
  'The stable, long-lived Nexus identity a user experiences as one Request across every '
  'Submission Revision (docs/SUBMISSION_DATA_CONTRACT.md §3). Primary key is resource_id, '
  'reusing a Resource Registry identity (resource_type = ''request'', enforced by '
  'trg_requests_protect_integrity). pinned_form_version_id is immutable after insert and must '
  'reference a Form Version that was status = ''published'' at Request creation. is_active moves '
  'true -> false only, never reversed, and is not a deletion mechanism: Requests are never '
  'deleted, hard or soft. That permanence holds in two layers per operation class: '
  'trg_requests_protect_integrity rejects row-level DELETE unconditionally, and '
  'trg_requests_reject_truncate blocks statement-level TRUNCATE, which row-level '
  'triggers do not fire on.';

comment on table public.submission_revisions is
  'One Submission Revision: draft or submitted, never anything else '
  '(docs/SUBMISSION_DATA_CONTRACT.md §4, §6). raw_data is untrusted evidence, always present. '
  'effective_data is null while draft and the immutable authoritative snapshot once submitted; '
  'it has exactly one writer, submit_revision, exactly once per row. Never deleted, in any '
  'status. row_version is the optimistic-concurrency token for draft saves and the submit '
  'binding check, never caller-supplied. This table is the sole record of submitted '
  'evidence and cannot be reconstructed from any other table, so its permanence is '
  'enforced in two layers per operation class: '
  'trg_submission_revisions_protect_lifecycle rejects row-level DELETE '
  'unconditionally, and trg_submission_revisions_reject_truncate blocks '
  'statement-level TRUNCATE, which row-level triggers do not fire on.';

comment on table public.customers is
  'Canonical Nexus Customer identity. key is stable and immutable once set; '
  'name is an editable display label. is_active is a reversible current-activity/ '
  'selectability flag, not a churn marker and not one-way: a returning customer may '
  'be represented either by reactivating this same row (is_active false -> true) or '
  'by a new customers row, a business decision this table does not encode. No hard '
  'delete, no deleted_at: history that already references a customers row must '
  'remain resolvable forever. Enforced in two layers per operation class: '
  'trg_customers_protect_lifecycle rejects row-level DELETE unconditionally, and '
  'trg_customers_reject_truncate blocks statement-level TRUNCATE, which row-level '
  'triggers do not fire on. See docs/MASTER_DATA_FOUNDATION_DESIGN.md §5.';

comment on table public.capabilities is
  'Canonical Nexus Capability/Workflow identity (for example, a fictional SFA or '
  'DMS capability reference). key is stable and immutable once set; name is an '
  'editable display label. status is one-way (active -> deprecated only): unlike '
  'customers.is_active, a deprecated Capability is never reactivated, since a '
  'genuine semantic change is represented by a new Capability identity, not an '
  'edited or reactivated old one. No hard delete, no deleted_at. Enforced in two '
  'layers per operation class: trg_capabilities_protect_lifecycle rejects row-level '
  'DELETE unconditionally, and trg_capabilities_reject_truncate blocks '
  'statement-level TRUNCATE, which row-level triggers do not fire on. See '
  'docs/MASTER_DATA_FOUNDATION_DESIGN.md §6.';

comment on table public.measurement_definitions is
  'Canonical business meaning of a countable quantity. Semantic fields are immutable from '
  'creation; a genuine change in meaning is a new Measurement Definition, never an edit. '
  'Rows are never removed, in two layers per operation class: '
  'trg_measurement_definitions_protect_lifecycle rejects row-level DELETE '
  'unconditionally, and trg_measurement_definitions_reject_truncate blocks '
  'statement-level TRUNCATE, which row-level triggers do not fire on. '
  'See docs/COMMERCIAL_DATABASE_DESIGN.md §5.4.';

comment on table public.commercial_configurations is
  'Stable anchor for one coherent Commercial relationship. Resource-backed; is_active is '
  'one-way (true -> false only), not the same as customers.is_active (reversible). Rows '
  'are never removed, in two layers per operation class: '
  'trg_commercial_configurations_protect_lifecycle rejects row-level DELETE '
  'unconditionally, and trg_commercial_configurations_reject_truncate blocks '
  'statement-level TRUNCATE, which row-level triggers do not fire on. See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.1.';

comment on table public.commercial_changes is
  'Commercial-specific meaning of one approved Commercial Change: which Commercial '
  'Configuration it belongs to, its business event category, and its effective date. 1:1 '
  'extension of requests; insert-only, populated once at approval. Insert-only means both '
  'layers: trg_commercial_changes_reject_update_delete rejects every row-level UPDATE '
  'and DELETE, and trg_commercial_changes_reject_truncate blocks statement-level '
  'TRUNCATE, which row-level triggers do not fire on. See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.14.';

comment on table public.commercial_components is
  'The effective-dated unit carrying commercial terms; one component = one charge line. Not '
  'Resource-backed. Immutable except a single effective_to closure transition. Rows are '
  'never removed, in two layers per operation class: '
  'trg_commercial_components_protect_lifecycle rejects row-level DELETE '
  'unconditionally, and trg_commercial_components_reject_truncate blocks '
  'statement-level TRUNCATE, which row-level triggers do not fire on. See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.2.';

comment on table public.commercial_component_capabilities is
  'Many-to-many join: Commercial Component to canonical Capability. Insert-only, intrinsic '
  'created_at/created_by provenance is the complete history. Because this table is the '
  'sole record of that membership, insert-only means both layers: '
  'trg_commercial_component_capabilities_reject_update_delete rejects every row-level '
  'UPDATE and DELETE, and trg_commercial_component_capabilities_reject_truncate blocks '
  'statement-level TRUNCATE, which row-level triggers do not fire on. See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.3.';

comment on table public.commercial_commitments is
  'A minimum quantity commitment (exactly one Component, direct FK, always monthly) or '
  'minimum spend commitment (one or many Components via commercial_commitment_components, '
  'any standard cadence). No allocation mechanism of any kind exists or is needed. Rows '
  'are never removed, in two layers per operation class: '
  'trg_commercial_commitments_protect_lifecycle rejects row-level DELETE '
  'unconditionally, and trg_commercial_commitments_reject_truncate blocks '
  'statement-level TRUNCATE, which row-level triggers do not fire on. See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.5.';

comment on table public.commercial_commitment_components is
  'Many-to-many join, minimum-spend commitments only: commitment to the component(s) it '
  'applies to. Insert-only, intrinsic created_at/created_by provenance is the complete '
  'history. Because this table is the sole record of financially material membership, '
  'insert-only means both layers: '
  'trg_commercial_commitment_components_reject_update_delete rejects every row-level '
  'UPDATE and DELETE, and trg_commercial_commitment_components_reject_truncate blocks '
  'statement-level TRUNCATE, which row-level triggers do not fire on. See '
  'docs/COMMERCIAL_DATABASE_DESIGN.md §5.6.';
