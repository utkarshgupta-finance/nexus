-- Nexus: Submission / Data Contract database foundation.
--
-- Translates the approved, locked design in
-- docs/SUBMISSION_DATA_CONTRACT.md into schema. Adds the structural
-- resource type `request`, the resource-backed `requests` table, the
-- `submission_revisions` table, the request/revision integrity triggers,
-- a narrow (non-payload-duplicating) audit strategy for
-- submission_revisions, and the three atomic persistence RPCs
-- (create_request_with_draft, submit_revision, create_next_revision)
-- that sit behind the repository boundary (docs/PLATFORM_ARCHITECTURE.md
-- §2). This migration is Nexus's own Request/Submission Revision identity
-- and lifecycle layer; it does not implement the Form Data Source
-- Resolver, Commercial Master, Decision Engine, Flowable, approvals, or
-- attachments.
--
-- Out of scope for this migration, deliberately: master-data resolution,
-- server-side calculation engines, approval/workflow tables, attachment
-- tables, and any real Nexus Request or submission data. The only
-- inserted row is the structural `request` resource type.
--
-- This file has not been applied to any database.


-- =============================================================================
-- Structural resource type
-- =============================================================================

-- resource_types is migration-managed structural metadata
-- (docs/DATA_ARCHITECTURE.md §2), not business seed data. No ON CONFLICT
-- guard, matching Migration 4's own reasoning: an incompatible pre-existing
-- 'request' row would mean this migration's assumptions about the current
-- schema state are wrong, and migration failure is preferable to silently
-- accepting that. resource_types carries no audit trigger (confirmed
-- against Migration 1/4: only trg_resources_immutable exists on the
-- Resource Registry tables), so this insert produces no audit_log row;
-- Git/migration history remains the provenance for this structural
-- metadata (docs/FORM_VERSIONING_MODEL.md §14).
insert into resource_types (type_code, description)
values ('request', 'A user-facing Nexus Request: the stable identity across all of its Submission Revisions (docs/SUBMISSION_DATA_CONTRACT.md).');


-- =============================================================================
-- requests: resource-backed Request identity
-- =============================================================================

-- id reuses a Resource Registry identity (docs/DATA_ARCHITECTURE.md §2,
-- docs/SUBMISSION_DATA_CONTRACT.md §3): a Request plausibly needs
-- workflow, tasks, comments, attachments, and notifications, all naturally
-- Request-scoped, the same reasoning already applied to form_versions
-- (docs/FORM_VERSIONING_MODEL.md §14). form_definition_id,
-- current_revision_id, deleted_at, and any process/workflow/approval
-- status are deliberately not columns here; each was challenged and
-- removed in docs/SUBMISSION_DATA_CONTRACT.md §3.
create table requests (
  id                     uuid primary key references resources (resource_id) on delete restrict,
  pinned_form_version_id uuid not null references form_versions (resource_id) on delete restrict,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  created_by             uuid references app_users (id) on delete restrict,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references app_users (id) on delete restrict
);

comment on table requests is
  'The stable, long-lived Nexus identity a user experiences as one Request across every '
  'Submission Revision (docs/SUBMISSION_DATA_CONTRACT.md §3). Primary key is resource_id, '
  'reusing a Resource Registry identity (resource_type = ''request'', enforced by '
  'trg_requests_protect_integrity). pinned_form_version_id is immutable after insert and must '
  'reference a Form Version that was status = ''published'' at Request creation. is_active moves '
  'true -> false only, never reversed, and is not a deletion mechanism: Requests are never '
  'deleted, hard or soft.';

-- pinned_form_version_id and the standard-column FKs are indexed per
-- docs/DATA_ARCHITECTURE.md §5 ("every foreign key is indexed"), matching
-- the precedent already set for form_versions in Migration 4. No index is
-- added purely for a hypothetical future query; each of these mirrors an
-- FK that Migration 4 already indexes identically for form_versions.
create index idx_requests_pinned_form_version_id on requests (pinned_form_version_id);
create index idx_requests_created_by on requests (created_by);
create index idx_requests_updated_by on requests (updated_by);

-- Combined integrity trigger, the same "one function, several branches by
-- tg_op" idiom already used for fn_protect_form_version_lifecycle
-- (docs/FORM_VERSIONING_MODEL.md §10): no DELETE, ever; INSERT requires
-- is_active = true (a Request is never born already permanently ended)
-- and requires the referenced Form Version to be currently published
-- (item A, docs/SUBMISSION_DATA_CONTRACT.md §3), a defense-in-depth
-- backstop beneath create_request_with_draft's own correct-by-construction
-- selection; UPDATE rejects any change to
-- pinned_form_version_id/created_at/created_by (item B) and permits
-- is_active to move only true -> false.
create function fn_protect_request_integrity()
returns trigger
language plpgsql
as $$
declare
  v_version_status text;
begin
  if tg_op = 'DELETE' then
    raise exception 'requests is a permanent record: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    if new.is_active is distinct from true then
      raise exception
        'requests: a new Request must be inserted with is_active = true (id=%)', new.id;
    end if;

    select status into v_version_status
    from public.form_versions
    where resource_id = new.pinned_form_version_id;

    if v_version_status is distinct from 'published' then
      raise exception
        'requests: pinned_form_version_id % must reference a published Form Version at '
        'creation, found status=%', new.pinned_form_version_id, v_version_status;
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE' from here.
  if new.pinned_form_version_id is distinct from old.pinned_form_version_id then
    raise exception
      'requests: pinned_form_version_id is immutable once set (id=%, % -> %)',
      old.id, old.pinned_form_version_id, new.pinned_form_version_id;
  end if;

  if new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by
  then
    raise exception
      'requests: created_at and created_by never change after insert (id=%)', old.id;
  end if;

  if new.is_active is distinct from old.is_active and (old.is_active = false or new.is_active = true) then
    raise exception
      'requests: is_active may only move true -> false, never reversed (id=%, % -> %)',
      old.id, old.is_active, new.is_active;
  end if;

  return new;
end;
$$;

comment on function fn_protect_request_integrity() is
  'Enforces requests integrity: no DELETE; INSERT must have is_active = true and must '
  'reference a currently published Form Version; UPDATE may never change '
  'pinned_form_version_id/created_at/created_by, and may only move is_active true -> false. '
  'See docs/SUBMISSION_DATA_CONTRACT.md §3.';

create trigger trg_requests_protect_integrity
  before insert or update or delete on requests
  for each row
  execute function fn_protect_request_integrity();

-- Generic, already-established functions reused unchanged: fn_set_updated_at
-- (Migration 1) and the generic full-row audit trigger (Migration 1).
-- requests rows are small and writes infrequent (creation, and the single
-- is_active transition); no targeted scoping is needed, the same
-- conclusion already reached for form_definitions
-- (docs/FORM_VERSIONING_MODEL.md §19, docs/SUBMISSION_DATA_CONTRACT.md §14).
create trigger trg_requests_updated_at
  before update on requests
  for each row
  execute function fn_set_updated_at();

create trigger trg_audit_requests
  after insert or update or delete on requests
  for each row execute function fn_audit_row('id');

alter table requests enable row level security;


-- =============================================================================
-- submission_revisions: Submission Revision lifecycle table
-- =============================================================================

-- Not resource-backed (docs/SUBMISSION_DATA_CONTRACT.md §4): no plausible
-- workflow/task/comment/notification capability is naturally
-- Revision-scoped rather than Request-scoped. Ordinary UUID primary key,
-- FK to requests. No operation-id columns (docs/SUBMISSION_DATA_CONTRACT.md
-- §7-8: row_version and revision_number already provide correct,
-- content-addressed idempotency). No deleted_at: never deleted, in any
-- status (docs/SUBMISSION_DATA_CONTRACT.md §4).
create table submission_revisions (
  id                            uuid primary key default gen_random_uuid(),
  request_id                    uuid not null references requests (id) on delete restrict,
  revision_number               integer not null,
  status                        text not null check (status in ('draft', 'submitted')),
  row_version                   integer not null default 1,
  submission_contract_version   integer not null default 1,
  raw_data                      jsonb not null,
  effective_data                jsonb,
  created_at                    timestamptz not null default now(),
  created_by                    uuid references app_users (id) on delete restrict,
  updated_at                    timestamptz not null default now(),
  updated_by                    uuid references app_users (id) on delete restrict,
  submitted_at                  timestamptz,
  submitted_by                  uuid references app_users (id) on delete restrict,

  constraint chk_submission_revisions_revision_number_positive check (revision_number >= 1),
  constraint chk_submission_revisions_row_version_positive check (row_version >= 1),
  constraint chk_submission_revisions_contract_version_positive check (submission_contract_version >= 1),
  constraint chk_submission_revisions_raw_data_is_object check (jsonb_typeof(raw_data) = 'object'),

  -- Lifecycle metadata and shape consistency
  -- (docs/SUBMISSION_DATA_CONTRACT.md §6, §11, §19). For
  -- submission_contract_version = 1, a submitted row's effective_data must
  -- additionally carry the two named sections (§5); this is a shape check
  -- only, not JSON Schema validation and not Commercial Master/Decision
  -- Engine semantics, which stay entirely outside the database.
  constraint chk_submission_revisions_lifecycle check (
    (status = 'draft' and effective_data is null
                       and submitted_at is null and submitted_by is null) or
    (status = 'submitted' and effective_data is not null
                           and submitted_at is not null and submitted_by is not null
                           and jsonb_typeof(effective_data) = 'object'
                           -- The `?` existence operator, not `->`, is deliberate: `->` on a
                           -- missing key returns SQL NULL, and jsonb_typeof(NULL) is also NULL,
                           -- which would make this whole AND-chain evaluate to NULL rather than
                           -- FALSE for a row missing "values"/"applicability" entirely; a NULL
                           -- CHECK result is treated as satisfied (not a violation) by Postgres,
                           -- so that row would silently pass. `?` always returns a real boolean
                           -- (FALSE when the key is absent), so a missing key is a definite,
                           -- provable CHECK failure, not an accidental pass.
                           and (
                             submission_contract_version <> 1
                             or (
                               effective_data ? 'values'
                               and jsonb_typeof(effective_data -> 'values') = 'object'
                               and effective_data ? 'applicability'
                               and jsonb_typeof(effective_data -> 'applicability') = 'object'
                             )
                           ))
  ),

  constraint chk_submission_revisions_chronology check (
    submitted_at is null or submitted_at >= created_at
  ),

  unique (request_id, revision_number)
);

comment on table submission_revisions is
  'One Submission Revision: draft or submitted, never anything else '
  '(docs/SUBMISSION_DATA_CONTRACT.md §4, §6). raw_data is untrusted evidence, always present. '
  'effective_data is null while draft and the immutable authoritative snapshot once submitted; '
  'it has exactly one writer, submit_revision, exactly once per row. Never deleted, in any '
  'status. row_version is the optimistic-concurrency token for draft saves and the submit '
  'binding check, never caller-supplied.';

-- request_id is deliberately not separately indexed: it is already the
-- leading column of both unique (request_id, revision_number) and
-- uq_submission_revisions_one_active_draft below, so both "all Revisions
-- of a Request" and "the current Draft/highest Revision for a Request"
-- are already served by an existing index's own leading-key scan
-- (docs/SUBMISSION_DATA_CONTRACT.md §3's current_revision_id reasoning
-- applies identically to indexing here: no denormalized or duplicate
-- structure for a query an existing index already answers).
create index idx_submission_revisions_created_by on submission_revisions (created_by);
create index idx_submission_revisions_updated_by on submission_revisions (updated_by);
create index idx_submission_revisions_submitted_by on submission_revisions (submitted_by);

-- At most one Draft Revision per Request (docs/SUBMISSION_DATA_CONTRACT.md
-- §11).
create unique index uq_submission_revisions_one_active_draft
  on submission_revisions (request_id) where status = 'draft';

-- Reused unchanged from Migration 4: entirely generic, no table-specific
-- logic (docs/FORM_VERSIONING_MODEL.md §11: "a dedicated function rather
-- than a parameterized generic one because form_versions is currently the
-- only table with this column; it can be generalized later if a second
-- table needs the same behavior" -- submission_revisions is exactly that
-- second table, and the existing implementation already applies as-is).
create trigger trg_submission_revisions_row_version
  before update on submission_revisions
  for each row
  execute function fn_bump_row_version();

create trigger trg_submission_revisions_updated_at
  before update on submission_revisions
  for each row
  execute function fn_set_updated_at();

-- Revision-sequence and lifecycle integrity
-- (docs/SUBMISSION_DATA_CONTRACT.md §6, §9-11, §19): no DELETE, ever;
-- INSERT must be exactly the next monotonic revision_number for its
-- Request, must start as draft with effective_data null, and requires the
-- parent Request to be active; UPDATE permits only two shapes, an
-- ordinary draft content edit (raw_data/updated_by only, effective_data
-- staying null, parent Request still active) or the one draft ->
-- submitted transition (effective_data populated, raw_data unchanged, per
-- docs/SUBMISSION_DATA_CONTRACT.md §9's "the exact Draft being submitted
-- must already be persisted; the submit call does not also change
-- raw_data"). This is a defense-in-depth backstop beneath
-- create_request_with_draft/create_next_revision/submit_revision's own
-- correct-by-construction logic, the same belt-and-braces relationship
-- already established between fn_assert_resource_type and
-- create_form_version (docs/FORM_VERSIONING_MODEL.md §14).
create function fn_protect_submission_revision_lifecycle()
returns trigger
language plpgsql
as $$
declare
  v_expected_number integer;
  v_request_active boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'submission_revisions is a permanent record: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception
        'submission_revisions: a new Revision must be inserted as draft, got status=%',
        new.status;
    end if;
    if new.effective_data is not null then
      raise exception
        'submission_revisions: a new Revision must be inserted with effective_data null '
        '(request_id=%)', new.request_id;
    end if;

    select is_active into v_request_active
    from public.requests
    where id = new.request_id
    for update;

    if not found then
      raise exception
        'submission_revisions: no requests row for request_id %', new.request_id;
    end if;
    if not v_request_active then
      raise exception
        'REQUEST_INACTIVE: request % is no longer active (request_id=%)',
        new.request_id, new.request_id;
    end if;

    select coalesce(max(revision_number), 0) + 1
    into v_expected_number
    from public.submission_revisions
    where request_id = new.request_id;

    if new.revision_number is distinct from v_expected_number then
      raise exception
        'REVISION_SEQUENCE_CONFLICT: submission_revisions for request % expected next '
        'revision_number=%, got %', new.request_id, v_expected_number, new.revision_number;
    end if;

    return new;
  end if;

  -- tg_op = 'UPDATE' from here. These never change after insert, in any
  -- status.
  if new.id is distinct from old.id
     or new.request_id is distinct from old.request_id
     or new.revision_number is distinct from old.revision_number
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by
  then
    raise exception
      'submission_revisions: id, request_id, revision_number, created_at, and created_by '
      'never change after insert (id=%)', old.id;
  end if;

  if old.status = 'draft' and new.status = 'draft' then
    if new.effective_data is not null
       or new.submitted_at is not null or new.submitted_by is not null
       or new.submission_contract_version is distinct from old.submission_contract_version
    then
      raise exception
        'submission_revisions: an ordinary draft edit may not set effective_data/submitted_at/'
        'submitted_by or change submission_contract_version (id=%)', old.id;
    end if;

    select is_active into v_request_active from public.requests where id = old.request_id;
    if not v_request_active then
      raise exception
        'REQUEST_INACTIVE: request % is no longer active (id=%)', old.request_id, old.id;
    end if;

    return new;

  elsif old.status = 'draft' and new.status = 'submitted' then
    if new.raw_data is distinct from old.raw_data then
      raise exception
        'submission_revisions: submitting must not change raw_data; the exact Draft being '
        'submitted must already be persisted (id=%)', old.id;
    end if;
    if new.submission_contract_version is distinct from old.submission_contract_version then
      raise exception
        'submission_revisions: submitting must not change submission_contract_version (id=%)',
        old.id;
    end if;
    if new.submitted_at is null or new.submitted_by is null then
      raise exception
        'submission_revisions: submitting requires submitted_at and submitted_by (id=%)',
        old.id;
    end if;

    -- Defense-in-depth backstop matching the draft-edit branch above: the
    -- RPC (submit_revision) already rejects an inactive Request with
    -- REQUEST_INACTIVE before ever attempting this UPDATE, but a trusted
    -- direct UPDATE bypassing the RPC must not be able to submit a Draft
    -- belonging to an inactive Request either.
    select is_active into v_request_active from public.requests where id = old.request_id;
    if not v_request_active then
      raise exception
        'REQUEST_INACTIVE: request % is no longer active (id=%)', old.request_id, old.id;
    end if;

    return new;

  else
    raise exception
      'submission_revisions: % -> % is not a permitted transition (id=%)',
      old.status, new.status, old.id;
  end if;
end;
$$;

comment on function fn_protect_submission_revision_lifecycle() is
  'Enforces submission_revisions integrity: no DELETE; INSERT must be draft, effective_data '
  'null, exactly the next monotonic revision_number for its request_id, and only against an '
  'active Request; the only permitted UPDATE transitions are an ordinary draft content edit '
  '(request must remain active) and draft -> submitted (raw_data and '
  'submission_contract_version unchanged, effective_data/submitted_at/submitted_by populated). '
  'See docs/SUBMISSION_DATA_CONTRACT.md §6, §9-11.';

create trigger trg_submission_revisions_protect_lifecycle
  before insert or update or delete on submission_revisions
  for each row
  execute function fn_protect_submission_revision_lifecycle();

-- Narrow, dedicated audit trigger (docs/SUBMISSION_DATA_CONTRACT.md §14):
-- deliberately NOT fn_audit_row, because that function always captures the
-- full row via to_jsonb(row), which would duplicate potentially large
-- raw_data/effective_data payloads into audit_log on every Revision
-- creation and submission. This table is the one exception to the generic
-- audit mechanism in this schema, precisely because it is the one table
-- whose payload columns are exceptional in size; the immutable
-- submission_revisions row itself remains the authoritative payload
-- evidence. Reuses the same actor/request/context GUC contract every other
-- audit path already reads (docs/DATA_ARCHITECTURE.md §9), the same
-- audit_log table, and the same audit_sequence/db_role mechanism; it
-- differs only in what before_value/after_value contain.
create function fn_audit_submission_revision_transition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_before jsonb;
  v_after  jsonb;
begin
  v_after := jsonb_build_object(
    'id', new.id,
    'request_id', new.request_id,
    'revision_number', new.revision_number,
    'status', new.status,
    'row_version', new.row_version,
    'submission_contract_version', new.submission_contract_version,
    'submitted_at', new.submitted_at,
    'submitted_by', new.submitted_by
  );

  if tg_op = 'UPDATE' then
    v_before := jsonb_build_object(
      'id', old.id,
      'request_id', old.request_id,
      'revision_number', old.revision_number,
      'status', old.status,
      'row_version', old.row_version,
      'submission_contract_version', old.submission_contract_version,
      'submitted_at', old.submitted_at,
      'submitted_by', old.submitted_by
    );
  else
    v_before := null;
  end if;

  -- resource_id is populated with the owning Request's resource_id, even
  -- though submission_revisions is itself not resource-backed
  -- (docs/SUBMISSION_DATA_CONTRACT.md §4), so this Revision's material
  -- lifecycle events are also queryable as part of its parent Request's
  -- audit trail, the same resource_id-linking convention already used for
  -- workflow_instances/tasks/domain_events (docs/DATA_ARCHITECTURE.md §11).
  -- db_role is left to audit_log's own column default (session_user at
  -- write time), the same as every other audit path.
  insert into public.audit_log (
    resource_id, table_name, row_id, action, before_value, after_value,
    actor_user_id, request_id, actor_context
  ) values (
    new.request_id,
    'submission_revisions',
    new.id,
    tg_op,
    v_before,
    v_after,
    nullif(current_setting('app.current_user_id', true), '')::uuid,
    nullif(current_setting('app.request_id', true), '')::uuid,
    nullif(current_setting('app.actor_context', true), '')::jsonb
  );

  return new;
end;
$$;

comment on function fn_audit_submission_revision_transition() is
  'Narrow, non-generic audit trigger for submission_revisions only. Captures Revision creation '
  'and the draft -> submitted transition with a small, explicitly named metadata object; '
  'raw_data and effective_data are never included, on either INSERT or UPDATE, under any '
  'circumstance. The immutable submission_revisions row remains the payload evidence; '
  'audit_log proves that the transition happened, who did it, and when, not what was '
  'submitted a second time. See docs/SUBMISSION_DATA_CONTRACT.md §14.';

-- Two separate triggers, not one WHEN-combined trigger, because a WHEN
-- clause on a trigger that also fires on INSERT cannot reference OLD at
-- all; splitting by event avoids that entirely rather than working
-- around it, the same reasoning already applied to
-- trg_audit_form_versions_insert/trg_audit_form_versions_lifecycle in
-- Migration 4.
create trigger trg_audit_submission_revisions_insert
  after insert on submission_revisions
  for each row execute function fn_audit_submission_revision_transition();

create trigger trg_audit_submission_revisions_lifecycle
  after update on submission_revisions
  for each row
  when (old.status is distinct from new.status)
  execute function fn_audit_submission_revision_transition();

alter table submission_revisions enable row level security;


-- =============================================================================
-- Atomic persistence primitives (repository-boundary RPCs)
-- =============================================================================

-- All three functions below are persistence primitives behind
-- UI -> application service -> domain -> repository -> RPC/database
-- (docs/PLATFORM_ARCHITECTURE.md §2, docs/SUBMISSION_DATA_CONTRACT.md §9,
-- §11). They are not, and must never become, a browser-facing or business
-- API; EXECUTE is revoked from anon/authenticated/public below.
-- SECURITY INVOKER is used throughout, not DEFINER: the only legitimate
-- caller is the trusted service_role application path, which already
-- holds every privilege each function needs, so there is nothing to
-- elevate and no reason to accept the search-path risk SECURITY DEFINER
-- would add for no benefit (docs/FORM_VERSIONING_MODEL.md §22).
--
-- Parameter naming note (deliberate): Nexus now has a business entity
-- named Request, and the existing generic audit context already uses
-- app.request_id as an unrelated correlation identifier
-- (docs/DATA_ARCHITECTURE.md §9). To avoid exactly that ambiguity, the
-- business Request identity is always named p_new_request_id /
-- p_request_id below (the Nexus Request being acted on), and the
-- audit/correlation identifier is always named p_audit_request_id. The
-- existing audit GUC contract itself (app.current_user_id,
-- app.request_id, app.actor_context) is unchanged.

create function create_request_with_draft(
  p_new_request_id uuid,
  p_form_definition_id uuid,
  p_initial_raw_data jsonb,
  p_actor_user_id uuid,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns table (request public.requests, revision public.submission_revisions)
language plpgsql
security invoker
as $$
declare
  v_published_version public.form_versions;
  v_existing_request   public.requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  -- Lock the parent Form Definition first: the identical row
  -- publish_form_version/create_form_version already lock
  -- (docs/FORM_VERSIONING_MODEL.md §9), so a new Request's Form Version
  -- selection can never interleave with an in-flight publish
  -- (docs/SUBMISSION_DATA_CONTRACT.md §9's concurrency reasoning).
  perform 1 from public.form_definitions
  where id = p_form_definition_id
  for update;

  if not found then
    raise exception
      'FORM_DEFINITION_NOT_FOUND: no form_definitions row for id %', p_form_definition_id;
  end if;

  -- Idempotency: the caller-generated request_id is both the Request's
  -- permanent identity and the natural retry key for this creation
  -- operation (docs/SUBMISSION_DATA_CONTRACT.md §9); no separate
  -- operation-id column is introduced. A retry is only ever the SAME
  -- logical creation attempt if it also carries the same original actor:
  -- created_by is immutable (protected by fn_protect_request_integrity)
  -- and independently verified by the application-service layer before
  -- this function is ever called (the same trust contract already
  -- established for every other Nexus write path, docs/PLATFORM_
  -- ARCHITECTURE.md §7), so it is a genuine identity check, not merely a
  -- second copy of the same information as form_definition_id. Without
  -- this, a different actor supplying the same request_id and the same
  -- form_definition_id would silently receive someone else's existing
  -- Request as if it were their own successful retry. IS NOT DISTINCT
  -- FROM correctly treats two NULL created_by values (both
  -- system-originated) as a legitimate match, matching the audit
  -- contract's own "NULL is a valid, meaningful actor state" rule
  -- (docs/PLATFORM_ARCHITECTURE.md §7). raw_data is deliberately never
  -- compared: Revision 1's raw_data may have legitimately changed through
  -- later autosaves after creation, so equality there would falsely
  -- reject a genuine retry that raced an autosave, not merely fail to
  -- catch a genuine conflict.
  select * into v_existing_request from public.requests where id = p_new_request_id;

  if found then
    if v_existing_request.created_by is distinct from p_actor_user_id
       or not exists (
         select 1 from public.form_versions
         where resource_id = v_existing_request.pinned_form_version_id
           and form_definition_id = p_form_definition_id
       )
    then
      raise exception
        'REQUEST_ID_CONFLICT: request_id % already exists and does not match this creation '
        'attempt (same actor and form_definition required)', p_new_request_id;
    end if;

    return query
      select v_existing_request, rev
      from public.submission_revisions rev
      where rev.request_id = p_new_request_id and rev.revision_number = 1;
    return;
  end if;

  select * into v_published_version
  from public.form_versions
  where form_definition_id = p_form_definition_id and status = 'published'
  limit 1;

  if not found then
    raise exception
      'NO_PUBLISHED_FORM_VERSION: form_definition % has no published Form Version',
      p_form_definition_id;
  end if;

  insert into public.resources (resource_id, resource_type, created_by)
  values (p_new_request_id, 'request', p_actor_user_id);

  insert into public.requests (id, pinned_form_version_id, created_by, updated_by)
  values (p_new_request_id, v_published_version.resource_id, p_actor_user_id, p_actor_user_id);

  insert into public.submission_revisions (
    request_id, revision_number, status, raw_data, created_by, updated_by
  ) values (
    p_new_request_id, 1, 'draft', p_initial_raw_data, p_actor_user_id, p_actor_user_id
  );

  return query
    select req, rev
    from public.requests req
    join public.submission_revisions rev
      on rev.request_id = req.id and rev.revision_number = 1
    where req.id = p_new_request_id;
end;
$$;

comment on function create_request_with_draft(uuid, uuid, jsonb, uuid, uuid, jsonb) is
  'Atomically creates a new Request pinned to the currently published Form Version of the '
  'given Form Definition, together with its Revision 1 draft. Locks the same form_definitions '
  'row publish_form_version/create_form_version already lock, so Request creation can never '
  'interleave with an in-flight publish. The caller-generated p_new_request_id is both the '
  'Request''s permanent identity and the natural idempotency key: a retry with the same id '
  'returns the existing Request + Revision 1 (REQUEST_ID_CONFLICT if it resolves to a '
  'different form_definition_id). Persistence primitive behind the repository boundary; not a '
  'business API. See docs/SUBMISSION_DATA_CONTRACT.md §9.';

create function submit_revision(
  p_revision_id uuid,
  p_expected_row_version integer,
  p_effective_data jsonb,
  p_actor_user_id uuid,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.submission_revisions
language plpgsql
security invoker
as $$
declare
  v_request_id uuid;
  v_candidate  public.submission_revisions;
  v_result     public.submission_revisions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select request_id into v_request_id
  from public.submission_revisions
  where id = p_revision_id;

  if not found then
    raise exception 'REVISION_NOT_FOUND: no submission_revisions row for id %', p_revision_id;
  end if;

  -- Same single serialization point create_next_revision uses: locking the
  -- parent Request row means this submit can never interleave with a
  -- concurrent create-next-revision or is_active transition for the same
  -- Request.
  perform 1 from public.requests where id = v_request_id for update;

  select * into v_candidate
  from public.submission_revisions
  where id = p_revision_id
  for update;

  if v_candidate.status = 'submitted' then
    -- Content-addressed replay check (docs/SUBMISSION_DATA_CONTRACT.md
    -- §7): row_version is what it would be had this exact caller's
    -- validated content been the one submitted, submitted_by matches this
    -- actor, and the frozen effective_data matches what this caller is
    -- asking to submit. All three together mean this call is, at most, a
    -- retry of an already-successful submission of the identical content,
    -- never a different submitter or different data being waved through.
    if v_candidate.row_version = p_expected_row_version + 1
       and v_candidate.submitted_by = p_actor_user_id
       and v_candidate.effective_data = p_effective_data
    then
      return v_candidate;
    end if;

    raise exception
      'REVISION_NOT_DRAFT: submission_revisions % is not a draft (status=submitted)',
      p_revision_id;
  end if;

  if v_candidate.row_version is distinct from p_expected_row_version then
    raise exception
      'DRAFT_CHANGED: submission_revisions % row_version is % but % was expected; '
      'reload and resubmit', p_revision_id, v_candidate.row_version, p_expected_row_version;
  end if;

  if not exists (select 1 from public.requests where id = v_request_id and is_active) then
    raise exception 'REQUEST_INACTIVE: request % is no longer active', v_request_id;
  end if;

  update public.submission_revisions
  set status = 'submitted',
      effective_data = p_effective_data,
      submitted_at = now(),
      submitted_by = p_actor_user_id,
      updated_by = p_actor_user_id
  where id = p_revision_id
  returning * into v_result;

  return v_result;
end;
$$;

comment on function submit_revision(uuid, integer, jsonb, uuid, uuid, jsonb) is
  'Atomically freezes a draft Submission Revision: locks the parent requests row, rejects if '
  'the parent Request is no longer active (REQUEST_INACTIVE), rejects if row_version does not '
  'match the caller''s expected_row_version (DRAFT_CHANGED), and otherwise persists the '
  'caller-supplied, already-server-computed effective_data and transitions draft -> submitted. '
  'Does not accept new raw_data; the exact draft being submitted must already be persisted. '
  'If the target is already submitted, returns the existing row when row_version/submitted_by/'
  'effective_data all match what this exact caller would have produced (a content-addressed '
  'replay), otherwise raises REVISION_NOT_DRAFT. No submit_operation_id column exists; '
  'row_version alone, being content-addressed, already provides correct replay semantics. See '
  'docs/SUBMISSION_DATA_CONTRACT.md §7.';

create function create_next_revision(
  p_request_id uuid,
  p_source_revision_id uuid,
  p_actor_user_id uuid,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns public.submission_revisions
language plpgsql
security invoker
as $$
declare
  v_request      public.requests;
  v_source       public.submission_revisions;
  v_next_number  integer;
  v_existing     public.submission_revisions;
  v_new          public.submission_revisions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_request from public.requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND: no requests row for id %', p_request_id;
  end if;

  select * into v_source
  from public.submission_revisions
  where id = p_source_revision_id and request_id = p_request_id;

  if not found then
    raise exception
      'SOURCE_REVISION_INVALID: submission_revisions % does not belong to request %',
      p_source_revision_id, p_request_id;
  end if;

  v_next_number := v_source.revision_number + 1;

  -- Idempotency (docs/SUBMISSION_DATA_CONTRACT.md §8): existence of
  -- revision_number = source + 1 is itself the complete, unambiguous
  -- signal that this exact source-to-next transition already happened, no
  -- operation-id column needed. Checked before any business validation
  -- below, and returned regardless of the existing row's current status,
  -- because a delayed retry may arrive after N+1 was already resubmitted.
  select * into v_existing
  from public.submission_revisions
  where request_id = p_request_id and revision_number = v_next_number;

  if found then
    return v_existing;
  end if;

  if v_source.status <> 'submitted' then
    raise exception
      'SOURCE_REVISION_INVALID: submission_revisions % is not submitted (status=%)',
      p_source_revision_id, v_source.status;
  end if;

  if exists (
    select 1 from public.submission_revisions
    where request_id = p_request_id and revision_number > v_source.revision_number
  ) then
    raise exception
      'SOURCE_REVISION_NOT_CURRENT: request % already has a Revision later than %',
      p_request_id, v_source.revision_number;
  end if;

  if not v_request.is_active then
    raise exception 'REQUEST_INACTIVE: request % is no longer active', p_request_id;
  end if;

  insert into public.submission_revisions (
    request_id, revision_number, status, submission_contract_version,
    raw_data, created_by, updated_by
  ) values (
    p_request_id, v_next_number, 'draft', v_source.submission_contract_version,
    v_source.raw_data, p_actor_user_id, p_actor_user_id
  )
  returning * into v_new;

  return v_new;
end;
$$;

comment on function create_next_revision(uuid, uuid, uuid, uuid, jsonb) is
  'Atomically creates the next Submission Revision from a submitted source Revision (the Send '
  'Back path): locks the parent requests row, and treats existence of revision_number = '
  'source + 1 as the complete idempotency signal, returning that row regardless of its current '
  'status rather than creating a second next revision. If it does not yet exist, requires the '
  'source Revision to be submitted and to be the Request''s current latest Revision '
  '(SOURCE_REVISION_NOT_CURRENT otherwise) and the Request to be active (REQUEST_INACTIVE '
  'otherwise), then inserts the new draft with raw_data copied forward and effective_data '
  'null. No created_via_operation_id column exists; deterministic revision numbering already '
  'provides correct replay semantics. See docs/SUBMISSION_DATA_CONTRACT.md §8, §10.';


-- =============================================================================
-- Privilege hardening
-- =============================================================================

-- Migration 2's `alter default privileges ... revoke all ... from anon,
-- authenticated` already applies to every object created above by
-- default; the explicit REVOKEs below are defense-in-depth, not a
-- correction, the same posture already explained in Migration 4.
revoke all on table requests, submission_revisions from anon, authenticated;

revoke execute on function
  fn_protect_request_integrity(),
  fn_protect_submission_revision_lifecycle(),
  fn_audit_submission_revision_transition()
from public, anon, authenticated;

revoke execute on function
  create_request_with_draft(uuid, uuid, jsonb, uuid, uuid, jsonb),
  submit_revision(uuid, integer, jsonb, uuid, uuid, jsonb),
  create_next_revision(uuid, uuid, uuid, uuid, jsonb)
from public, anon, authenticated;


-- =============================================================================
-- Row Level Security: deny-by-default
-- =============================================================================

-- Same posture as every existing Platform Core / Form Versioning table
-- (docs/DATA_ARCHITECTURE.md §12): ENABLE, not FORCE, RLS; zero policies.
-- anon/authenticated are denied all direct access to requests and
-- submission_revisions by RLS itself, beneath the privilege hardening
-- above. The application-service layer, connecting as service_role,
-- remains the trusted data-access path.
