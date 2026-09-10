-- Nexus: M4-M8 Audit Traceability and Commercial RPC Hardening.
--
-- Forward migration implementing Part B1 of the locked design in
-- docs/M4_M8_FOUNDATION_HARDENING_DESIGN.md (design section 7, section
-- 11, section 12). This is Part B1 only, per the conditional split rule
-- in design section 5.2: Part B2 (the six commercial cross-parent
-- integrity rules of design section 13) is not authored here and remains
-- blocked pending the D1 through D7 data gates. Referred to by its
-- descriptive name only: it carries no migration number and is
-- specifically not "Migration 9", which stays reserved by
-- docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md for the Commercial Usage
-- and Earned stage (design section 5.3, section 19).
--
-- Pre-apply captures taken live against this project before authoring
-- (design section 14.2, both required for Part B1 and neither a blocking
-- gate):
--
--   G2 (audit_log NULL resource_id counts for the three affected
--   table_name values): zero rows currently exist in audit_log for
--   table_name in (requests, commercial_configurations,
--   commercial_changes). The no-backfill gap this design accepts (section
--   11.10) is therefore zero rows wide today.
--
--   G3 (current definitions of the three triggers this migration drops
--   and recreates): trg_audit_requests and trg_audit_commercial_configurations
--   both call fn_audit_row('id'); trg_audit_commercial_changes calls
--   fn_audit_row('request_id'). All three are AFTER INSERT OR UPDATE OR
--   DELETE FOR EACH ROW, tgenabled 'O', no WHEN clause, tgnargs 1, no
--   constraint-trigger properties. This matches the design's assumed
--   current state exactly (design section 11.8); no drift was found, so
--   nothing halts authoring (design section 14.2's one case in which a G
--   capture itself would stop the migration does not apply here).
--
-- What this migration does, in the design section 7.1 Part B1 order:
--
--   A. CREATE OR REPLACE public.fn_audit_row() with the two-argument
--      contract of design section 11.3: an optional second argument names
--      the resource-id column, defaulting to the literal 'resource_id'
--      when omitted, exactly reproducing every existing one-argument
--      caller's behavior (design section 11.4).
--   B. DROP TRIGGER then CREATE TRIGGER for exactly three triggers:
--      trg_audit_requests, trg_audit_commercial_configurations,
--      trg_audit_commercial_changes. Only the argument list changes; every
--      other property (name, table, timing, level, event set, function,
--      enabled posture, absence of a WHEN clause) is reproduced identically
--      to the G3 capture above (design section 11.8).
--   C. CREATE OR REPLACE public.create_commercial_configuration_with_change(...)
--      with the design section 12 contract: a customers-then-requests
--      SELECT ... FOR UPDATE serialization anchor, Customer/Request
--      existence and activity validation on the create path, an
--      idempotency probe keyed on p_request_id that either replays the
--      existing pair or fails loudly with a named conflict, and the
--      existing correct-by-construction insert order (commercial_changes,
--      then resources, then commercial_configurations). Signature
--      unchanged, so CREATE OR REPLACE preserves the function's OID and
--      every privilege already granted or revoked on it (design section
--      7.3, section 12.10, section 17.1).
--   D. Comment updates on fn_audit_row(), on audit_log (recording the
--      cutover semantics of design section 11.10), and on the RPC.
--
-- Reuse, not redefinition, of everything not named above. fn_reject_truncate()
-- is untouched. fn_assert_resource_type(), fn_protect_commercial_commitment_lifecycle(),
-- fn_protect_commitment_component_membership(), and fn_reject_update_delete()
-- are untouched; none is in Part B1 scope (design section 17.2).
--
-- Both CREATE OR REPLACE statements below preserve their function's OID:
-- neither the parameter list nor the return type of either function
-- changes. fn_audit_row() keeps its existing SECURITY DEFINER posture and
-- its existing search_path = pg_catalog pin, and keeps the EXECUTE revoke
-- from anon and authenticated that
-- 20260906210726_revoke_trigger_function_execute.sql already applied to
-- it. create_commercial_configuration_with_change(...) keeps its existing
-- SECURITY INVOKER posture and its existing privilege grants; its
-- search_path stays unset, exactly as it is today. It is one of the 19
-- SECURITY INVOKER M4-M8 functions the design defers to the optional,
-- non-blocking Migration C (design section 8.4, section 18); this
-- migration does not promote it.
--
-- Fail-loud. Every trigger this migration drops is named exactly, with a
-- plain DROP TRIGGER, never DROP TRIGGER IF EXISTS, so a missing or
-- already-renamed trigger fails the migration rather than silently
-- producing a partially hardened state. No EXCEPTION block is added to
-- either function; both preserve their existing all-errors-propagate
-- posture (design section 11.5, section 12.12).
--
-- Deliberately out of scope, per the design section 5.2 split and section
-- 7.4: no new UNIQUE constraint, no new composite foreign key, no new
-- CHECK constraint, no new trigger on commercial_commitments or
-- commercial_commitment_components, no change to
-- fn_protect_commitment_component_membership(), no historical audit_log
-- backfill, no TRUNCATE-related change (Migration A already applied and
-- is not touched here), no RLS change, no privilege change to any table,
-- no new column anywhere, no drop of any existing single-column foreign
-- key, no NOT VALID constraint. This migration does not close P2-4 or
-- P2-5, and does not by itself unblock Commercial Migration 9 (design
-- section 5.2, section 19); Part B2 remains required or must be formally
-- dispositioned first.
--
-- Historical migrations are never edited. Migrations 1 through 8, the
-- Foundation RPC Privilege Hardening migration, the Platform Core
-- Integrity Hardening migration, and the M4-M8 Destructive Privilege and
-- Permanence Hardening migration remain immutable history.
--
-- This file has not been applied to any database.


-- =============================================================================
-- Section A: fn_audit_row() two-argument resource-id contract
-- =============================================================================

-- Generalizes the one-argument audit trigger function to accept an
-- optional second argument naming the resource-id column, mirroring the
-- exact idiom fn_assert_resource_type() already established for the
-- byte-for-byte identical problem (design section 11.2,
-- 20260907054608_request_resource_type_integrity.sql). CREATE OR REPLACE,
-- not a new function: the SQL-level signature (fn_audit_row(), zero
-- declared arguments; "arguments" below means TG_ARGV values supplied at
-- CREATE TRIGGER time) is unchanged, so the function's OID and every
-- privilege already revoked from it are preserved automatically.
--
-- Argument-count and row-id-column validation is combined into one check,
-- matching fn_assert_resource_type()'s shape exactly: 0 arguments, more
-- than 2 arguments, or a null/empty first argument all raise the same
-- argument-count-and-shape error. This reproduces every row of the
-- locked contract table (design section 11.3): 0 arguments raises; 1
-- valid argument proceeds on the one-argument path; 1 argument with a
-- null or empty value raises, unchanged from today; 2 valid arguments
-- proceed on the two-argument path regardless of whether the second is
-- itself empty; 3 or more arguments raise.
--
-- One-argument path: byte-for-byte identical to the current
-- implementation. The resource column is the literal string
-- 'resource_id', looked up by JSONB key with no existence check, so a
-- table with no such column silently and correctly records NULL, exactly
-- as it does today for the 11 non-Resource-backed one-argument callers
-- (design section 11.4).
--
-- Two-argument path: the resource column resolves via
-- coalesce(nullif(tg_argv[1], ''), 'resource_id'), the exact expression
-- fn_assert_resource_type() uses, so an empty or null second argument is
-- treated as omitted. Unlike the one-argument path, presence is checked
-- with the JSONB existence operator ? before extraction, because ->>
-- cannot distinguish an absent key from a present key holding SQL NULL,
-- and the two must be distinguished (design section 11.5): a missing
-- named column is a migration-authoring error and must fail loudly with
-- P0001, while a present column holding NULL is a legitimate data state
-- and must record NULL silently. Neither branch adds an EXCEPTION block:
-- an invalid UUID fails naturally at the ::uuid cast with 22P02, and a
-- UUID with no matching resources row fails naturally at the
-- audit_log.resource_id foreign key with 23503 (design section 11.6).
-- Both failures are deliberately not caught.
--
-- The ? operator, like every other bare identifier this function uses,
-- resolves from pg_catalog regardless of the function's own pinned
-- search_path, so pinning is unaffected (design section 11.5).
create or replace function public.fn_audit_row()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_row        jsonb;
  v_pk_column  text;
  v_res_column text;
  v_row_id     uuid;
  v_res_id     uuid;
begin
  if tg_nargs < 1 or tg_nargs > 2 or tg_argv[0] is null or tg_argv[0] = '' then
    raise exception
      'fn_audit_row requires one or two trigger arguments: the primary key '
      'column name (e.g. ''id'' or ''resource_id''), and optionally the '
      'resource-id column name (defaults to ''resource_id'' when omitted, '
      'e.g. fn_audit_row(''id'', ''id'')), got % argument(s) on table %',
      tg_nargs, tg_table_name;
  end if;
  v_pk_column := tg_argv[0];

  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_row_id := (v_row ->> v_pk_column)::uuid;

  if tg_nargs = 2 then
    v_res_column := coalesce(nullif(tg_argv[1], ''), 'resource_id');

    if not (v_row ? v_res_column) then
      raise exception
        'fn_audit_row: resource-id column % does not exist on table % (row-id column %)',
        v_res_column, tg_table_name, v_pk_column;
    end if;

    v_res_id := nullif(v_row ->> v_res_column, '')::uuid;
  else
    v_res_id := nullif(v_row ->> 'resource_id', '')::uuid;
  end if;

  insert into public.audit_log (
    resource_id, table_name, row_id, action,
    before_value, after_value,
    actor_user_id, request_id, actor_context
  )
  values (
    v_res_id,
    tg_table_name,
    v_row_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    nullif(current_setting('app.current_user_id', true), '')::uuid,
    nullif(current_setting('app.request_id', true), '')::uuid,
    nullif(current_setting('app.actor_context', true), '')::jsonb
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


-- =============================================================================
-- Section B: recreate exactly three audit triggers with the resource-id argument
-- =============================================================================

-- Trigger arguments are fixed at CREATE TRIGGER time and Postgres provides
-- no ALTER for them, so recreation is required. Plain DROP TRIGGER, never
-- IF EXISTS: a missing trigger fails this migration loudly rather than
-- silently doing nothing. Every property below reproduces the G3 pre-apply
-- capture exactly except the argument list, which is the one locked
-- difference (design section 11.8): requests and commercial_configurations
-- are both Resource-backed with their Resource identity under the primary
-- key column id, so both become fn_audit_row('id', 'id'); commercial_changes
-- is a 1:1 extension of requests whose request_id column both is its own
-- primary key and is the Request's Resource identity, so it becomes
-- fn_audit_row('request_id', 'request_id'). No fourth table is touched:
-- form_versions' two split triggers keep their existing single-argument
-- calls unchanged (design section 11.4, section 17.1), and no other
-- one-argument caller is Resource-backed.

drop trigger trg_audit_requests on public.requests;
create trigger trg_audit_requests
  after insert or update or delete on public.requests
  for each row execute function public.fn_audit_row('id', 'id');

drop trigger trg_audit_commercial_configurations on public.commercial_configurations;
create trigger trg_audit_commercial_configurations
  after insert or update or delete on public.commercial_configurations
  for each row execute function public.fn_audit_row('id', 'id');

drop trigger trg_audit_commercial_changes on public.commercial_changes;
create trigger trg_audit_commercial_changes
  after insert or update or delete on public.commercial_changes
  for each row execute function public.fn_audit_row('request_id', 'request_id');


-- =============================================================================
-- Section C: create_commercial_configuration_with_change() hardening
-- =============================================================================

-- CREATE OR REPLACE with the exact same parameter list and return type as
-- today, so the function's OID and every privilege already granted or
-- revoked on it (SECURITY INVOKER, EXECUTE revoked from public/anon/
-- authenticated, EXECUTE granted to service_role) are preserved
-- automatically (design section 7.3, section 12.10, section 17.2).
--
-- Serialization anchor and lock order (design section 12.2, section
-- 12.3): the public.customers row for p_customer_id, then the
-- public.requests row for p_request_id, both SELECT ... FOR UPDATE,
-- always in that order. The Customer is the only pre-existing row
-- concurrent creation attempts genuinely share; the Request lock makes
-- the idempotency probe below non-racy, so two concurrent identical
-- retries cannot both observe no existing commercial_changes row.
--
-- Execution order (design section 12.4): lock Customer, lock Request,
-- probe for an existing commercial_changes row keyed on p_request_id
-- before any business validation, then on the create path validate
-- Customer/Request activity and key/id availability, then insert in the
-- existing correct-by-construction order (commercial_changes, resources,
-- commercial_configurations).
--
-- Retry identity (design section 12.5): request_id is the structural
-- operation identity, since commercial_changes.request_id is both its
-- primary key and 1:1 with the Request. Given a found Change, the
-- compared fields are the new configuration id, the customer id, the key,
-- the effective date, and the actor (actor compared with IS DISTINCT FROM
-- so two NULLs are a legitimate match, matching the audit contract's rule
-- that NULL is a valid system-originated actor state). p_name,
-- p_relationship_note, p_reason, p_audit_request_id, and p_actor_context
-- are deliberately not compared: the first two are explicitly editable
-- after creation, and the rest are per-attempt audit annotations carrying
-- no business identity. A found Change whose change_category is not
-- initial_setup means this request_id was already consumed by a
-- different kind of Change, which is also a conflict, not a retry.
--
-- Idempotent replay (design section 12.6): returns the existing pair
-- verbatim, performs no DML, so no audit_log row is written by a replay.
-- The three audit GUCs are still set unconditionally at the top of the
-- function on every path, including replay, where they are harmless
-- because no DML follows (design section 12.13).
--
-- Named conflicts (design section 12.7), each RAISE EXCEPTION with
-- SQLSTATE P0001 and a leading uppercase token, matching the established
-- RPC convention: CUSTOMER_NOT_FOUND, CUSTOMER_INACTIVE, REQUEST_NOT_FOUND,
-- REQUEST_INACTIVE, CONFIGURATION_CHANGE_CONFLICT,
-- CONFIGURATION_KEY_CONFLICT, CONFIGURATION_ID_CONFLICT. No EXCEPTION
-- block is added anywhere in this function; every raise propagates and
-- aborts the whole transaction, leaving no partial state, matching the
-- function's existing no-compensating-cleanup posture (design section
-- 12.12).
create or replace function public.create_commercial_configuration_with_change(
  p_new_commercial_configuration_id uuid,
  p_request_id uuid,
  p_customer_id uuid,
  p_key text,
  p_name text,
  p_effective_date date,
  p_actor_user_id uuid,
  p_relationship_note text default null,
  p_reason text default null,
  p_audit_request_id uuid default null,
  p_actor_context jsonb default null
)
returns table (commercial_change public.commercial_changes, commercial_configuration public.commercial_configurations)
language plpgsql
security invoker
as $$
declare
  v_customer        public.customers;
  v_request         public.requests;
  v_existing_change public.commercial_changes;
  v_existing_config public.commercial_configurations;
  v_change          public.commercial_changes;
  v_config          public.commercial_configurations;
  v_key_taken       boolean;
  v_id_taken        boolean;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', coalesce(p_audit_request_id::text, ''), true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  -- Serialization anchor first: the outer business parent, then the
  -- operation-identity row, matching create_request_with_draft's
  -- outer-parent-then-row shape (design section 12.3).
  select * into v_customer
  from public.customers
  where id = p_customer_id
  for update;

  if not found then
    raise exception 'CUSTOMER_NOT_FOUND: no customers row for id %', p_customer_id;
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND: no requests row for id %', p_request_id;
  end if;

  -- Idempotency probe, before any business validation (design section
  -- 12.4): a delayed retry of an operation that already completed must
  -- return the completed result rather than fail on state that changed
  -- afterwards.
  select * into v_existing_change
  from public.commercial_changes
  where request_id = p_request_id;

  if found then
    if v_existing_change.change_category is distinct from 'initial_setup' then
      raise exception
        'CONFIGURATION_CHANGE_CONFLICT: request % was already consumed by a % '
        'commercial change, not initial_setup',
        p_request_id, v_existing_change.change_category;
    end if;

    select * into v_existing_config
    from public.commercial_configurations
    where id = v_existing_change.commercial_configuration_id;

    if p_new_commercial_configuration_id is distinct from v_existing_change.commercial_configuration_id
      or p_customer_id is distinct from v_existing_config.customer_id
      or p_key is distinct from v_existing_config.key
      or p_effective_date is distinct from v_existing_change.effective_date
      or p_actor_user_id is distinct from v_existing_change.created_by
    then
      raise exception
        'CONFIGURATION_CHANGE_CONFLICT: request % already has a commercial change whose '
        'configuration id, customer, key, effective date, or actor differs from this call',
        p_request_id;
    end if;

    -- Idempotent replay: return the existing pair unchanged. No DML runs
    -- on this path, so no audit_log row is written (design section 12.6).
    return query select v_existing_change, v_existing_config;
    return;
  end if;

  -- Business validation, create path only (design section 12.8, section
  -- 12.9). Neither activity flag is checked on the replay path above,
  -- because a legitimate post-success deactivation must not fail a
  -- delayed retry of a call that already succeeded.
  if not v_customer.is_active then
    raise exception 'CUSTOMER_INACTIVE: customers row % is not active', p_customer_id;
  end if;

  if not v_request.is_active then
    raise exception 'REQUEST_INACTIVE: requests row % is not active', p_request_id;
  end if;

  select exists (
    select 1 from public.commercial_configurations where key = p_key
  ) into v_key_taken;

  if v_key_taken then
    raise exception 'CONFIGURATION_KEY_CONFLICT: key % is already in use', p_key;
  end if;

  select exists (
    select 1 from public.resources where resource_id = p_new_commercial_configuration_id
    union all
    select 1 from public.commercial_configurations where id = p_new_commercial_configuration_id
  ) into v_id_taken;

  if v_id_taken then
    raise exception
      'CONFIGURATION_ID_CONFLICT: id % already exists with no commercial change for request %',
      p_new_commercial_configuration_id, p_request_id;
  end if;

  -- commercial_changes first: its foreign key to the not-yet-existing
  -- commercial_configurations row is DEFERRABLE INITIALLY DEFERRED, so
  -- Postgres does not check it until this transaction commits.
  insert into public.commercial_changes (
    request_id, commercial_configuration_id, change_category,
    effective_date, reason, created_by
  )
  values (
    p_request_id, p_new_commercial_configuration_id, 'initial_setup',
    p_effective_date, p_reason, p_actor_user_id
  )
  returning * into v_change;

  insert into public.resources (resource_id, resource_type, created_by)
  values (p_new_commercial_configuration_id, 'commercial_configuration', p_actor_user_id);

  -- commercial_configurations.commercial_change_id's foreign key is
  -- ordinary and immediate; it succeeds because the commercial_changes
  -- row was already inserted above, in this same transaction.
  insert into public.commercial_configurations (
    id, customer_id, key, name, relationship_note, commercial_change_id,
    created_by, updated_by
  )
  values (
    p_new_commercial_configuration_id, p_customer_id, p_key, p_name, p_relationship_note,
    p_request_id, p_actor_user_id, p_actor_user_id
  )
  returning * into v_config;

  return query select v_change, v_config;
end;
$$;


-- =============================================================================
-- Section D: comment updates
-- =============================================================================

comment on function public.fn_audit_row() is
  'Generic AFTER INSERT/UPDATE/DELETE audit trigger. Requires one or two trigger '
  'arguments: the primary key column name, e.g. fn_audit_row(''id'') for current '
  'tables, and optionally a second argument naming the resource-id column when it '
  'differs from the literal resource_id, e.g. fn_audit_row(''id'', ''id'') for '
  'requests and commercial_configurations, or fn_audit_row(''request_id'', '
  '''request_id'') for commercial_changes. The second argument defaults to '
  '''resource_id'' when omitted, so every existing one-argument caller is unchanged. '
  'A named resource-id column that does not exist on the audited row raises; a '
  'present column holding SQL NULL records NULL silently. See '
  'docs/M4_M8_FOUNDATION_HARDENING_DESIGN.md §11.';

comment on table public.audit_log is
  'Database-enforced, append-only record of row mutation for audited tables. '
  'Distinct from domain events, which represent business meaning rather than '
  'row mutation (see docs/PLATFORM_ARCHITECTURE.md §7). No row in this table '
  'is ever updated or deleted; see trg_audit_log_immutable below. resource_id is '
  'NULL for every row written for table_name in (requests, '
  'commercial_configurations, commercial_changes) before this migration, because '
  'fn_audit_row() only began linking those three tables to the Resource Registry '
  'here; it is populated correctly for every row written afterward. No historical '
  'backfill is performed. A consumer must resolve the Resource for a pre-cutover '
  'row via table_name and row_id, and must not read NULL resource_id as meaning no '
  'Resource is involved. See docs/M4_M8_FOUNDATION_HARDENING_DESIGN.md §11.10.';

comment on function public.create_commercial_configuration_with_change(uuid, uuid, uuid, text, text, date, uuid, text, text, uuid, jsonb) is
  'Atomically creates the first commercial_changes row (change_category = initial_setup) '
  'together with its commercial_configurations row and the backing resources row, resolving '
  'the circular foreign-key dependency between the two tables via the deferred constraint on '
  'commercial_changes.commercial_configuration_id. Locks public.customers then public.requests, '
  'in that order, both SELECT ... FOR UPDATE, before any validation. Idempotent on p_request_id: '
  'a retry matching the original call''s configuration id, customer, key, effective date, and '
  'actor returns the existing (commercial_change, commercial_configuration) pair with no new '
  'DML and no new audit_log row; a retry that does not match, or that names a request already '
  'consumed by a non-initial_setup change, raises CONFIGURATION_CHANGE_CONFLICT. Also raises '
  'CUSTOMER_NOT_FOUND, CUSTOMER_INACTIVE, REQUEST_NOT_FOUND, REQUEST_INACTIVE, '
  'CONFIGURATION_KEY_CONFLICT, or CONFIGURATION_ID_CONFLICT as named. Persistence primitive '
  'behind the repository boundary; not a business API. See '
  'docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md §3a and '
  'docs/M4_M8_FOUNDATION_HARDENING_DESIGN.md §12.';
