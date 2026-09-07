-- Nexus: Form Definition and Form Version database foundation.
--
-- Translates the approved design in docs/FORM_VERSIONING_MODEL.md into
-- schema. Adds the structural resource type `form_version`, the thin
-- `form_definitions` catalog, the resource-backed `form_versions` lifecycle
-- table, the reusable resource-type-integrity trigger, the row-version
-- optimistic-concurrency mechanism, database-enforced lifecycle
-- immutability, a right-sized audit strategy for draft-stage edits, and
-- the two atomic persistence RPCs (create_form_version,
-- publish_form_version) that sit behind the repository boundary
-- (docs/PLATFORM_ARCHITECTURE.md §2). SurveyJS (Stage 5B1A) remains the
-- form rendering/interaction engine only; this migration is Nexus's own
-- identity, lifecycle, and control layer around it.
--
-- Out of scope for this migration, deliberately: submissions, responses,
-- answer tables, the Form Data Source Resolver, Commercial Master, the
-- Decision Engine, Approval Matrix, Flowable, tasks, notifications, any
-- form-authoring/admin UI table, and any real Nexus form definition or
-- other business seed data. The only inserted row is the structural
-- `form_version` resource type.
--
-- This file has not been applied to any database.


-- =============================================================================
-- Structural resource type
-- =============================================================================

-- resource_types is migration-managed structural metadata
-- (docs/DATA_ARCHITECTURE.md §2), not business seed data. No ON CONFLICT
-- guard: an incompatible pre-existing 'form_version' row would mean this
-- migration's assumptions about the current schema state are wrong, and
-- migration failure is preferable to silently accepting that. resource_types
-- carries no audit trigger (confirmed against Migration 1: only
-- trg_resources_immutable exists on the Resource Registry tables), so this
-- insert produces no audit_log row; see docs/FORM_VERSIONING_MODEL.md §14 for
-- the corrected statement of this (an earlier draft of that document
-- incorrectly assumed resource_types was audited).
insert into resource_types (type_code, description)
values ('form_version', 'A specific, immutable, versioned definition of a Nexus form (docs/FORM_VERSIONING_MODEL.md).');


-- =============================================================================
-- form_definitions: thin catalog identity
-- =============================================================================

create table form_definitions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  created_by  uuid references app_users (id) on delete restrict,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users (id) on delete restrict,
  constraint chk_form_definitions_key_nonblank check (btrim(key) <> ''),
  constraint chk_form_definitions_name_nonblank check (btrim(name) <> '')
);

comment on table form_definitions is
  'Stable, long-lived identity for a type of form (docs/FORM_VERSIONING_MODEL.md §3). '
  'Not a submission, not workflow state. key is database-immutable once set '
  '(trg_form_definitions_protect_key); name/description remain editable catalog labels. '
  'Holds no lifecycle status: whether a form type is offered is derived from whether it '
  'has a currently published form_versions row (§7), never a second flag here.';

create index idx_form_definitions_created_by on form_definitions (created_by);
create index idx_form_definitions_updated_by on form_definitions (updated_by);

-- key is the machine identifier other code/configuration may come to
-- depend on; name/description are ordinary editable labels and are
-- deliberately not protected by this trigger.
create function fn_form_definitions_protect_key()
returns trigger
language plpgsql
as $$
begin
  if new.key is distinct from old.key then
    raise exception
      'form_definitions.key is immutable once set (id=%, % -> %)',
      old.id, old.key, new.key;
  end if;
  return new;
end;
$$;

comment on function fn_form_definitions_protect_key() is
  'Rejects any UPDATE that changes form_definitions.key. name/description remain editable.';

create trigger trg_form_definitions_protect_key
  before update on form_definitions
  for each row
  execute function fn_form_definitions_protect_key();

create trigger trg_form_definitions_updated_at
  before update on form_definitions
  for each row
  execute function fn_set_updated_at();

-- Ordinary generic audit coverage, same mechanism as every other
-- configuration table (docs/DATA_ARCHITECTURE.md §9). form_definitions rows
-- are small and edits infrequent; no volume/noise concern applies here, so
-- no targeted scoping is used, unlike form_versions below. Primary key is
-- `id`, so this attaches with fn_audit_row('id'), matching every other
-- non-resource-backed table.
create trigger trg_audit_form_definitions
  after insert or update or delete on form_definitions
  for each row execute function fn_audit_row('id');

alter table form_definitions enable row level security;


-- =============================================================================
-- Reusable resource-type integrity
-- =============================================================================

-- Generic, reusable trigger for any resource-backed table (the first being
-- form_versions below): a foreign key to resources(resource_id) alone only
-- proves the referenced row exists, not that its resource_type matches what
-- the table expects, and a plain CHECK constraint cannot express a
-- cross-table condition at all. Takes exactly one trigger argument, the
-- expected resource_type, the same parameterization style as
-- fn_audit_row(pk_column_name). This is a defense-in-depth backstop beneath
-- the correct-by-construction insert order in create_form_version below,
-- which creates the resources row with the correct resource_type before
-- creating the form_versions row that references it.
create function fn_assert_resource_type()
returns trigger
language plpgsql
as $$
declare
  v_actual_type text;
begin
  if tg_nargs <> 1 or tg_argv[0] is null or tg_argv[0] = '' then
    raise exception
      'fn_assert_resource_type requires exactly one trigger argument: the expected '
      'resource_type, got % argument(s) on table %', tg_nargs, tg_table_name;
  end if;

  select resource_type into v_actual_type
  from public.resources
  where resource_id = new.resource_id;

  if not found then
    raise exception
      'fn_assert_resource_type: no resources row for resource_id % (table %)',
      new.resource_id, tg_table_name;
  end if;

  if v_actual_type is distinct from tg_argv[0] then
    raise exception
      'fn_assert_resource_type: resource_id % has resource_type % but table % expects %',
      new.resource_id, v_actual_type, tg_table_name, tg_argv[0];
  end if;

  return new;
end;
$$;

comment on function fn_assert_resource_type() is
  'Reusable resource-type-integrity guard for any resource-backed table. Requires exactly '
  'one trigger argument: the expected resource_type, e.g. fn_assert_resource_type(''form_version''). '
  'Attach BEFORE INSERT OR UPDATE OF resource_id on the resource-backed table itself.';


-- =============================================================================
-- form_versions: resource-backed lifecycle table
-- =============================================================================

-- resource_id is the primary key: this table reuses a Resource Registry
-- identity rather than minting a second one (docs/DATA_ARCHITECTURE.md §2,
-- docs/FORM_VERSIONING_MODEL.md §14). row_version is the optimistic-
-- concurrency token (§11 of the design doc): database-maintained only
-- (trg_form_versions_row_version below), never caller-supplied.
-- definition_hash is deliberately not a column here; see §12 of the design
-- doc for the reassessment.
create table form_versions (
  resource_id        uuid primary key references resources (resource_id) on delete restrict,
  form_definition_id uuid not null references form_definitions (id) on delete restrict,
  version_number     integer not null,
  status             text not null check (status in ('draft', 'published', 'retired', 'abandoned')),
  row_version        integer not null default 1,
  display_name       text not null,
  definition_json    jsonb not null,
  survey_js_version  text not null,
  change_summary     text,
  created_at         timestamptz not null default now(),
  created_by         uuid references app_users (id) on delete restrict,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references app_users (id) on delete restrict,
  published_at       timestamptz,
  published_by       uuid references app_users (id) on delete restrict,
  retired_at         timestamptz,
  retired_by         uuid references app_users (id) on delete restrict,
  abandoned_at       timestamptz,
  abandoned_by       uuid references app_users (id) on delete restrict,

  constraint chk_form_versions_version_number_positive check (version_number >= 1),
  constraint chk_form_versions_row_version_positive check (row_version >= 1),
  constraint chk_form_versions_display_name_nonblank check (btrim(display_name) <> ''),
  constraint chk_form_versions_survey_js_version_nonblank check (btrim(survey_js_version) <> ''),
  constraint chk_form_versions_definition_json_is_object check (jsonb_typeof(definition_json) = 'object'),

  -- Lifecycle metadata consistency (docs/FORM_VERSIONING_MODEL.md §6).
  constraint chk_form_versions_lifecycle_dates check (
    (status = 'draft'     and published_at is null and retired_at is null
                          and abandoned_at is null
                          and published_by is null and retired_by is null
                          and abandoned_by is null) or
    (status = 'published' and published_at is not null and retired_at is null
                          and abandoned_at is null
                          and published_by is not null
                          and retired_by is null and abandoned_by is null) or
    (status = 'retired'   and published_at is not null and retired_at is not null
                          and abandoned_at is null
                          and published_by is not null and retired_by is not null
                          and abandoned_by is null) or
    (status = 'abandoned' and published_at is null and retired_at is null
                          and abandoned_at is not null
                          and published_by is null and retired_by is null
                          and abandoned_by is not null)
  ),

  -- Chronology: a lifecycle timestamp can never precede the event it
  -- logically follows.
  constraint chk_form_versions_chronology check (
    (published_at is null or published_at >= created_at)
    and (retired_at is null or published_at is null or retired_at >= published_at)
    and (abandoned_at is null or abandoned_at >= created_at)
  ),

  -- change_summary (docs/FORM_VERSIONING_MODEL.md §15): optional for v1 and
  -- for any ABANDONED row; required, non-blank, once a v2+ row is PUBLISHED
  -- or RETIRED.
  constraint chk_form_versions_change_summary_required check (
    version_number = 1
    or status in ('draft', 'abandoned')
    or (change_summary is not null and btrim(change_summary) <> '')
  ),

  unique (form_definition_id, version_number)
);

comment on table form_versions is
  'One exact, eventually-immutable Form Version (docs/FORM_VERSIONING_MODEL.md §4, §6). '
  'Primary key is resource_id, reusing a Resource Registry identity '
  '(resource_type = ''form_version'', enforced by trg_form_versions_assert_resource_type). '
  'Content is frozen the moment status leaves ''draft'' '
  '(trg_form_versions_protect_lifecycle). row_version is the optimistic-concurrency '
  'token for draft saves and publication binding, never caller-supplied.';

create index idx_form_versions_form_definition_id on form_versions (form_definition_id);
create index idx_form_versions_created_by on form_versions (created_by);
create index idx_form_versions_updated_by on form_versions (updated_by);
create index idx_form_versions_published_by on form_versions (published_by);
create index idx_form_versions_retired_by on form_versions (retired_by);
create index idx_form_versions_abandoned_by on form_versions (abandoned_by);

-- At most one draft, and at most one published version, per Form
-- Definition (docs/FORM_VERSIONING_MODEL.md §7). Because ABANDONED is its
-- own status, the draft index needs no extra exclusion clause: an
-- abandoned row is no longer status = 'draft' at all.
create unique index uq_form_versions_one_active_draft
  on form_versions (form_definition_id) where status = 'draft';

create unique index uq_form_versions_one_published
  on form_versions (form_definition_id) where status = 'published';

create trigger trg_form_versions_assert_resource_type
  before insert or update of resource_id on form_versions
  for each row
  execute function fn_assert_resource_type('form_version');

-- row_version is entirely database-maintained: whatever value a caller's
-- UPDATE statement supplies for this column is overwritten with
-- old.row_version + 1 unconditionally. This is a dedicated function rather
-- than a parameterized generic one because form_versions is currently the
-- only table with this column; it can be generalized later if a second
-- table needs the same behavior.
create function fn_bump_row_version()
returns trigger
language plpgsql
as $$
begin
  new.row_version := old.row_version + 1;
  return new;
end;
$$;

comment on function fn_bump_row_version() is
  'Forces row_version := old row_version + 1 on every UPDATE. Callers cannot choose '
  'an arbitrary persisted row_version; only the WHERE-clause precondition they supply '
  '(row_version = expected) is theirs to control.';

create trigger trg_form_versions_row_version
  before update on form_versions
  for each row
  execute function fn_bump_row_version();

create trigger trg_form_versions_updated_at
  before update on form_versions
  for each row
  execute function fn_set_updated_at();

-- State-aware lifecycle enforcement (docs/FORM_VERSIONING_MODEL.md §10).
-- Uses the same JSONB-diff-minus-permitted-columns technique already
-- established for fn_protect_access_grant(), generalized here to four
-- explicit transition shapes instead of one. Deliberately does not depend
-- on trigger firing order relative to trg_form_versions_row_version /
-- trg_form_versions_updated_at: row_version and updated_at are excluded
-- from every content comparison below, and this function never inspects
-- their values, so it produces the same verdict regardless of whether it
-- runs before or after those two triggers.
create function fn_protect_form_version_lifecycle()
returns trigger
language plpgsql
as $$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'form_versions is a permanent lifecycle record: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception
        'form_versions: a new version must be inserted as draft, got status=%',
        new.status;
    end if;
    return new;
  end if;

  -- From here, tg_op = 'UPDATE'. These never change after insert, in any
  -- lifecycle state.
  if new.resource_id is distinct from old.resource_id
     or new.form_definition_id is distinct from old.form_definition_id
     or new.version_number is distinct from old.version_number
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by
  then
    raise exception
      'form_versions: resource_id, form_definition_id, version_number, created_at, '
      'and created_by never change after insert (resource_id=%)', old.resource_id;
  end if;

  if old.status = 'draft' and new.status = 'draft' then
    -- Ordinary content edit: display_name, definition_json,
    -- survey_js_version, and change_summary are free to change. This
    -- function does not separately re-check that lifecycle metadata stays
    -- null here; chk_form_versions_lifecycle_dates already makes that
    -- impossible at the column level for any row with status = 'draft'.
    return new;

  elsif old.status = 'draft' and new.status = 'published' then
    if new.published_at is null or new.published_by is null then
      raise exception
        'form_versions: publishing requires published_at and published_by (resource_id=%)',
        old.resource_id;
    end if;
    v_old_core := to_jsonb(old) - 'status' - 'published_at' - 'published_by'
                    - 'row_version' - 'updated_at' - 'updated_by';
    v_new_core := to_jsonb(new) - 'status' - 'published_at' - 'published_by'
                    - 'row_version' - 'updated_at' - 'updated_by';
    if v_old_core is distinct from v_new_core then
      raise exception
        'form_versions: publishing must not change any content field; publish the '
        'exact draft that was validated (resource_id=%)', old.resource_id;
    end if;
    return new;

  elsif old.status = 'draft' and new.status = 'abandoned' then
    if new.abandoned_at is null or new.abandoned_by is null then
      raise exception
        'form_versions: abandoning requires abandoned_at and abandoned_by (resource_id=%)',
        old.resource_id;
    end if;
    v_old_core := to_jsonb(old) - 'status' - 'abandoned_at' - 'abandoned_by'
                    - 'row_version' - 'updated_at' - 'updated_by';
    v_new_core := to_jsonb(new) - 'status' - 'abandoned_at' - 'abandoned_by'
                    - 'row_version' - 'updated_at' - 'updated_by';
    if v_old_core is distinct from v_new_core then
      raise exception
        'form_versions: abandoning must not change any content field; the abandoned '
        'artifact preserves what was actually abandoned (resource_id=%)', old.resource_id;
    end if;
    return new;

  elsif old.status = 'published' and new.status = 'retired' then
    if new.retired_at is null or new.retired_by is null then
      raise exception
        'form_versions: retiring requires retired_at and retired_by (resource_id=%)',
        old.resource_id;
    end if;
    v_old_core := to_jsonb(old) - 'status' - 'retired_at' - 'retired_by'
                    - 'row_version' - 'updated_at' - 'updated_by';
    v_new_core := to_jsonb(new) - 'status' - 'retired_at' - 'retired_by'
                    - 'row_version' - 'updated_at' - 'updated_by';
    if v_old_core is distinct from v_new_core then
      raise exception
        'form_versions: retiring must not change any content field (resource_id=%)',
        old.resource_id;
    end if;
    return new;

  else
    raise exception
      'form_versions: % -> % is not a permitted lifecycle transition (resource_id=%)',
      old.status, new.status, old.resource_id;
  end if;
end;
$$;

comment on function fn_protect_form_version_lifecycle() is
  'Enforces the four-state form_versions lifecycle: no DELETE; INSERT must begin '
  'draft; only draft->draft (content edit), draft->published, draft->abandoned, and '
  'published->retired are permitted UPDATEs; every transition other than an ordinary '
  'draft content edit must leave all content fields unchanged. See '
  'docs/FORM_VERSIONING_MODEL.md §10.';

create trigger trg_form_versions_protect_lifecycle
  before insert or update or delete on form_versions
  for each row
  execute function fn_protect_form_version_lifecycle();

-- Targeted audit strategy (docs/FORM_VERSIONING_MODEL.md §19): capture
-- creation and every lifecycle transition in full; do not individually
-- capture ordinary in-place draft-content edits, which would otherwise be
-- high-volume and low-materiality for a row that is not yet an operative
-- Finance control. Two separate triggers, not one WHEN-combined trigger,
-- because a WHEN clause on a trigger that also fires on INSERT cannot
-- reference OLD at all; splitting by event avoids that entirely rather
-- than working around it. Resource-backed table, so this attaches with
-- fn_audit_row('resource_id'), not fn_audit_row('id'); form_versions has no
-- `id` column at all.
create trigger trg_audit_form_versions_insert
  after insert on form_versions
  for each row execute function fn_audit_row('resource_id');

create trigger trg_audit_form_versions_lifecycle
  after update on form_versions
  for each row
  when (old.status is distinct from new.status)
  execute function fn_audit_row('resource_id');

alter table form_versions enable row level security;


-- =============================================================================
-- Atomic persistence primitives (repository-boundary RPCs)
-- =============================================================================

-- Both functions below are persistence primitives behind
-- UI -> application service -> domain -> repository -> RPC/database
-- (docs/PLATFORM_ARCHITECTURE.md §2, docs/FORM_VERSIONING_MODEL.md §9).
-- They are not, and must never become, a browser-facing or business API;
-- EXECUTE is revoked from anon/authenticated/public below. SECURITY INVOKER
-- is used, not DEFINER: the only legitimate caller is the trusted
-- service_role application path, which already holds every privilege
-- either function needs, so there is nothing to elevate and no reason to
-- accept the search-path risk SECURITY DEFINER would add for no benefit.
--
-- Actor/audit context: both functions accept the acting user explicitly
-- (p_actor_user_id) and set the exact existing session GUCs fn_audit_row()
-- already reads (app.current_user_id, app.request_id, app.actor_context;
-- docs/DATA_ARCHITECTURE.md §9) at the very start of the function body, so
-- every nested audit write inside the same transaction is correctly
-- attributed without any change to fn_audit_row() itself. Only trusted
-- server-side code can call these functions at all (EXECUTE is not granted
-- to anon/authenticated), and that code is responsible for supplying an
-- actor_user_id it has already independently verified from a trusted,
-- authenticated session, the same trust contract already established for
-- every other Nexus write path; a browser can never supply this value
-- directly, because it can never call the function directly.
--
-- Bootstrap contract (docs/FORM_VERSIONING_MODEL.md §16, tightened and
-- approved at Stage 5B1B2 final review): a brand-new Form Definition, or
-- one whose history contains no currently published version, has no
-- automatic copy-forward source, so create_form_version requires the
-- caller to supply initial content explicitly
-- (p_bootstrap_definition_json/display_name/survey_js_version). This is
-- mutually exclusive with normal copy-forward, never a silent fallback:
-- if a published version exists, supplying any bootstrap parameter is
-- rejected outright (BOOTSTRAP_MISMATCH); if none exists, omitting or
-- incompletely supplying them is rejected the same way. See the function
-- body below for the exact source-determination rule, including why an
-- abandoned draft is deliberately never an automatic source.

create function create_form_version(
  p_form_definition_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid default null,
  p_actor_context jsonb default null,
  p_bootstrap_definition_json jsonb default null,
  p_bootstrap_display_name text default null,
  p_bootstrap_survey_js_version text default null
)
returns form_versions
language plpgsql
security invoker
as $$
declare
  v_form_definition public.form_definitions;
  v_source          public.form_versions;
  v_next_version    integer;
  v_resource_id     uuid;
  v_new_row         public.form_versions;
begin
  -- coalesce to '' rather than passing a possible SQL NULL into set_config:
  -- fn_audit_row() already reads these back with
  -- nullif(current_setting(...), '')::uuid/jsonb, which treats '' as NULL,
  -- so this round-trips correctly either way without depending on exactly
  -- how set_config(..., NULL, ...) behaves for a custom GUC.
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  -- Lock the parent Form Definition first: this is the single
  -- serialization point every lifecycle-mutating operation for this Form
  -- Definition takes, so concurrent create/publish attempts against it
  -- never interleave (docs/FORM_VERSIONING_MODEL.md §9).
  select * into v_form_definition
  from public.form_definitions
  where id = p_form_definition_id
  for update;

  if not found then
    raise exception
      'FORM_DEFINITION_NOT_FOUND: no form_definitions row for id %', p_form_definition_id;
  end if;

  if exists (
    select 1 from public.form_versions
    where form_definition_id = p_form_definition_id and status = 'draft'
  ) then
    raise exception
      'ACTIVE_DRAFT_EXISTS: form_definition % already has an active draft', p_form_definition_id;
  end if;

  select coalesce(max(version_number), 0) + 1
  into v_next_version
  from public.form_versions
  where form_definition_id = p_form_definition_id;

  -- Copy-forward source (docs/FORM_VERSIONING_MODEL.md §16, tightened):
  -- only the CURRENTLY PUBLISHED version is an automatic copy-forward
  -- source. A retired version is never reachable here without an
  -- intervening published sibling, publish_form_version always retires
  -- and publishes together in one call, so "retired but nothing currently
  -- published" cannot occur through these RPCs, and an abandoned version
  -- is deliberately never an automatic source at all, published or not:
  -- reusing a deliberately discarded draft's content without a new,
  -- deliberate decision would defeat the point of abandoning it. If no
  -- published version exists (a brand-new Form Definition, or one whose
  -- only history is abandoned drafts), there is no automatic source; the
  -- caller must supply bootstrap content explicitly, the same as a true
  -- first version.
  --
  -- Exactly one of the two branches below applies; this is never a silent
  -- fallback. Supplying bootstrap parameters when a published source
  -- exists, or omitting them when none exists, is rejected outright
  -- (BOOTSTRAP_MISMATCH) rather than silently ignored or silently
  -- overriding the real source.
  select * into v_source
  from public.form_versions
  where form_definition_id = p_form_definition_id and status = 'published'
  limit 1;

  if found then
    if p_bootstrap_definition_json is not null
       or p_bootstrap_display_name is not null
       or p_bootstrap_survey_js_version is not null
    then
      raise exception
        'BOOTSTRAP_MISMATCH: form_definition % has a published version to copy '
        'forward from; bootstrap parameters must not be supplied', p_form_definition_id;
    end if;
  else
    if p_bootstrap_definition_json is null
       or p_bootstrap_display_name is null or btrim(p_bootstrap_display_name) = ''
       or p_bootstrap_survey_js_version is null or btrim(p_bootstrap_survey_js_version) = ''
    then
      raise exception
        'BOOTSTRAP_MISMATCH: form_definition % has no published version to copy '
        'forward from; p_bootstrap_definition_json, p_bootstrap_display_name, and '
        'p_bootstrap_survey_js_version are all required', p_form_definition_id;
    end if;
  end if;

  insert into public.resources (resource_type, created_by)
  values ('form_version', p_actor_user_id)
  returning resource_id into v_resource_id;

  insert into public.form_versions (
    resource_id, form_definition_id, version_number, status,
    display_name, definition_json, survey_js_version,
    created_by, updated_by
  )
  values (
    v_resource_id,
    p_form_definition_id,
    v_next_version,
    'draft',
    coalesce(v_source.display_name, p_bootstrap_display_name),
    coalesce(v_source.definition_json, p_bootstrap_definition_json),
    coalesce(v_source.survey_js_version, p_bootstrap_survey_js_version),
    p_actor_user_id,
    p_actor_user_id
  )
  returning * into v_new_row;

  return v_new_row;
end;
$$;

comment on function create_form_version(uuid, uuid, uuid, jsonb, jsonb, text, text) is
  'Atomically creates a new draft Form Version: locks the parent form_definitions row, '
  'rejects if an active draft already exists (ACTIVE_DRAFT_EXISTS) or the Form Definition '
  'does not exist (FORM_DEFINITION_NOT_FOUND), allocates the next monotonic version_number '
  'under that lock, mints the resources row and the form_versions row in the same '
  'transaction, and either copies forward the currently published version or requires '
  'explicit bootstrap content if none exists, rejecting (BOOTSTRAP_MISMATCH) any call that '
  'supplies bootstrap parameters alongside a real published source or omits them without '
  'one. An abandoned version is never an automatic copy-forward source. Persistence '
  'primitive behind the repository boundary; not a business API. '
  'See docs/FORM_VERSIONING_MODEL.md §9, §16.';

create function publish_form_version(
  p_form_version_id uuid,
  p_expected_row_version integer,
  p_actor_user_id uuid,
  p_request_id uuid default null,
  p_actor_context jsonb default null
)
returns form_versions
language plpgsql
security invoker
as $$
declare
  v_form_definition_id uuid;
  v_candidate          public.form_versions;
  v_current_published  public.form_versions;
  v_published_row      public.form_versions;
begin
  -- coalesce to '' rather than passing a possible SQL NULL into set_config:
  -- fn_audit_row() already reads these back with
  -- nullif(current_setting(...), '')::uuid/jsonb, which treats '' as NULL,
  -- so this round-trips correctly either way without depending on exactly
  -- how set_config(..., NULL, ...) behaves for a custom GUC.
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select form_definition_id into v_form_definition_id
  from public.form_versions
  where resource_id = p_form_version_id;

  if not found then
    raise exception
      'FORM_DEFINITION_NOT_FOUND: no form_versions row for id %', p_form_version_id;
  end if;

  -- Same single serialization point as create_form_version: locking the
  -- parent Form Definition row here means this publish can never interleave
  -- with a concurrent create or a concurrent publish for the same Form
  -- Definition (docs/FORM_VERSIONING_MODEL.md §9, §10).
  perform 1 from public.form_definitions
  where id = v_form_definition_id
  for update;

  select * into v_candidate
  from public.form_versions
  where resource_id = p_form_version_id
  for update;

  if v_candidate.status is distinct from 'draft' then
    raise exception
      'VERSION_NOT_DRAFT: form_version % is not a draft (status=%)',
      p_form_version_id, v_candidate.status;
  end if;

  if v_candidate.row_version is distinct from p_expected_row_version then
    raise exception
      'DRAFT_CHANGED: form_version % row_version is % but % was expected; '
      'reload and validate again', p_form_version_id, v_candidate.row_version,
      p_expected_row_version;
  end if;

  select * into v_current_published
  from public.form_versions
  where form_definition_id = v_form_definition_id and status = 'published'
  limit 1;

  if found then
    update public.form_versions
    set status = 'retired', retired_at = now(), retired_by = p_actor_user_id
    where resource_id = v_current_published.resource_id;
  end if;

  update public.form_versions
  set status = 'published', published_at = now(), published_by = p_actor_user_id
  where resource_id = p_form_version_id
  returning * into v_published_row;

  return v_published_row;
end;
$$;

comment on function publish_form_version(uuid, integer, uuid, uuid, jsonb) is
  'Atomically publishes a draft Form Version: locks the parent form_definitions row, '
  'rejects if the candidate is not a draft (VERSION_NOT_DRAFT), rejects if row_version '
  'does not match the caller''s expected_row_version (DRAFT_CHANGED, binding publication '
  'to the exact draft state that was validated), retires the currently published version '
  'if one exists, and publishes the candidate, all in one transaction. Persistence '
  'primitive behind the repository boundary; not a business API. A distinct '
  'PUBLISHED_VERSION_CONFLICT error is deliberately not implemented: the Form Definition '
  'row lock plus the one-active-draft and one-published partial unique indexes make that '
  'condition unreachable as a normal business state; if the published partial unique '
  'index were ever violated regardless, that is an unexpected integrity failure, not a '
  'business conflict to name. See docs/FORM_VERSIONING_MODEL.md §9, §11.';


-- =============================================================================
-- Privilege hardening
-- =============================================================================

-- Migration 2 already sets `alter default privileges for role postgres in
-- schema public revoke all on tables/sequences from anon, authenticated`
-- and `revoke execute on functions from anon, authenticated`, confirmed
-- read-only before drafting this migration, so every object created above
-- already has zero anon/authenticated privileges by default. The explicit
-- REVOKEs below are defense-in-depth, not a correction: Stage 5A proved
-- Supabase can carry separate explicit role grants that a default-privilege
-- rule alone would not remove, so this migration does not rely solely on
-- that default holding. service_role and postgres are left untouched
-- throughout; service_role is the trusted application path this entire
-- feature is built for.
revoke all on table form_definitions, form_versions from anon, authenticated;

revoke execute on function
  fn_form_definitions_protect_key(),
  fn_assert_resource_type(),
  fn_bump_row_version(),
  fn_protect_form_version_lifecycle()
from public, anon, authenticated;

revoke execute on function
  create_form_version(uuid, uuid, uuid, jsonb, jsonb, text, text),
  publish_form_version(uuid, integer, uuid, uuid, jsonb)
from public, anon, authenticated;


-- =============================================================================
-- Row Level Security: deny-by-default
-- =============================================================================

-- Same posture as every existing Platform Core table
-- (docs/DATA_ARCHITECTURE.md §12): ENABLE, not FORCE, RLS; zero policies.
-- anon/authenticated are denied all direct access to form_definitions and
-- form_versions by RLS itself, beneath the privilege hardening above. The
-- application-service layer, connecting as service_role, remains the
-- trusted data-access path.
