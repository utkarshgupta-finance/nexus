-- Nexus: corrective migration closing the proven Request resource-type-
-- integrity gap.
--
-- Migration 5 (submission_data_foundation) made `requests` resource-backed
-- (id = resources.resource_id) but never attached a resource-type-
-- integrity trigger to it. Confirmed by direct inspection of
-- fn_protect_request_integrity's actual body and by a rollback-only probe
-- against the live database: a `requests` row reusing a `resources` row
-- typed anything other than 'request' (for example 'form_version') was
-- accepted with no error. This is exactly the Resource Registry integrity
-- gap docs/FORM_VERSIONING_MODEL.md §14 already identified and closed for
-- form_versions via fn_assert_resource_type; it was left unclosed here.
--
-- fn_assert_resource_type() (Migration 4) cannot be reused unmodified: its
-- body hardcodes `new.resource_id`, but `requests`' resource-backed
-- primary key column is named `id`, not `resource_id`. Attaching the
-- function as-is to `requests` would fail at trigger-fire time with
-- "record NEW has no field resource_id", not silently succeed and not
-- validate anything.
--
-- Corrective approach: generalize fn_assert_resource_type to accept an
-- optional second trigger argument naming the resource-id column,
-- defaulting to 'resource_id' so form_versions' existing single-argument
-- call (`fn_assert_resource_type('form_version')`) keeps behaving
-- identically, unchanged. This mirrors the parameterization idiom already
-- established by fn_audit_row(pk_column_name) (Migration 1), which this
-- codebase already uses exactly to let one generic function serve tables
-- with different primary-key column names. This is the smallest fix that
-- is both correct and not fragile: a table-specific duplicate assertion
-- function would re-implement logic that already exists and is proven
-- correct for form_versions.
--
-- Nothing else changes: no new table, no new column, no index, no RLS
-- change, no privilege change, no policy. fn_protect_request_integrity is
-- not modified; it continues to own exactly what it already owns
-- (is_active/pin-immutability/published-at-creation), never resource-type
-- identity, which is this trigger's sole concern, mirroring the existing
-- form_versions split between trg_form_versions_assert_resource_type and
-- trg_form_versions_protect_lifecycle.
--
-- This file has not been applied to any database.


-- =============================================================================
-- Generalize fn_assert_resource_type to accept a configurable PK column
-- =============================================================================

-- CREATE OR REPLACE, not a new function: the SQL-level signature
-- (fn_assert_resource_type(), zero declared arguments; the "arguments"
-- referred to throughout are TG_ARGV values supplied at CREATE TRIGGER
-- time, not part of the function's own signature) is unchanged, so the
-- function's OID, and therefore every privilege already revoked from it
-- in Migration 4 (`revoke execute on function fn_assert_resource_type()
-- from public, anon, authenticated`), is preserved automatically; no
-- privilege statement needs to be repeated here. Every existing trigger
-- that calls this function (trg_form_versions_assert_resource_type,
-- supplying only the expected-type argument) continues to behave
-- identically, because the second argument defaults to 'resource_id' when
-- omitted, exactly reproducing the previous hardcoded behavior.
create or replace function fn_assert_resource_type()
returns trigger
language plpgsql
as $$
declare
  v_actual_type text;
  v_pk_column   text;
  v_pk_value    uuid;
begin
  if tg_nargs < 1 or tg_nargs > 2 or tg_argv[0] is null or tg_argv[0] = '' then
    raise exception
      'fn_assert_resource_type requires one or two trigger arguments: the expected '
      'resource_type, and optionally the resource-id column name (defaults to '
      '''resource_id'' when omitted, e.g. fn_assert_resource_type(''request'', ''id'')), '
      'got % argument(s) on table %', tg_nargs, tg_table_name;
  end if;

  v_pk_column := coalesce(nullif(tg_argv[1], ''), 'resource_id');

  -- Dynamic column extraction via to_jsonb(new), the same technique
  -- fn_audit_row already uses for its own configurable primary-key column
  -- (docs/DATA_ARCHITECTURE.md §9), rather than a hardcoded `new.<column>`
  -- attribute reference, which would only ever compile against one fixed
  -- column name and is exactly what made the original implementation
  -- unable to serve a table using a different resource-id column name.
  v_pk_value := (to_jsonb(new) ->> v_pk_column)::uuid;

  select resource_type into v_actual_type
  from public.resources
  where resource_id = v_pk_value;

  if not found then
    raise exception
      'fn_assert_resource_type: no resources row for %=% (table %)',
      v_pk_column, v_pk_value, tg_table_name;
  end if;

  if v_actual_type is distinct from tg_argv[0] then
    raise exception
      'fn_assert_resource_type: %=% has resource_type % but table % expects %',
      v_pk_column, v_pk_value, v_actual_type, tg_table_name, tg_argv[0];
  end if;

  return new;
end;
$$;

comment on function fn_assert_resource_type() is
  'Reusable resource-type-integrity guard for any resource-backed table. Requires one or two '
  'trigger arguments: the expected resource_type, and optionally the resource-id column name '
  '(defaults to ''resource_id'' when omitted), e.g. fn_assert_resource_type(''form_version'') '
  'for a table whose column is literally named resource_id, or '
  'fn_assert_resource_type(''request'', ''id'') for a table (such as requests) that reuses the '
  'Resource Registry identity under a differently named column. Attach BEFORE INSERT OR UPDATE '
  'OF <that column> on the resource-backed table itself.';


-- =============================================================================
-- Attach the assertion to requests
-- =============================================================================

-- Mirrors trg_form_versions_assert_resource_type exactly
-- (docs/FORM_VERSIONING_MODEL.md §14): fires only on INSERT or on an
-- UPDATE that touches the resource-backed identity column itself (`id`
-- here, `resource_id` there), a defense-in-depth backstop beneath
-- create_request_with_draft's own correct-by-construction insert order
-- (resources row minted with resource_type = 'request' before the
-- requests row is inserted using that same id).
--
-- Trigger-ordering check: after this migration, requests carries three
-- BEFORE triggers, firing in alphabetical order:
--   trg_requests_assert_resource_type  (this trigger; checks resources
--                                        .resource_type only)
--   trg_requests_protect_integrity     (is_active / pin immutability /
--                                        published-at-creation; never
--                                        inspects resource_type)
--   trg_requests_updated_at            (sets NEW.updated_at only)
-- None of the three inspects another's output or mutates a column another
-- depends on; each independently either raises or passes NEW through
-- unchanged (updated_at trigger aside, which only ever writes
-- NEW.updated_at, a column none of the other two ever reads). Correctness
-- here does not depend on this alphabetical firing order, the same
-- property already relied on for form_versions' own multi-trigger set.
create trigger trg_requests_assert_resource_type
  before insert or update of id on requests
  for each row
  execute function fn_assert_resource_type('request', 'id');
