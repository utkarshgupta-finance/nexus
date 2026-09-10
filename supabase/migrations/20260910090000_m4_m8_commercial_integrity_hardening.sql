-- Nexus: M4-M8 Commercial Integrity Hardening.
--
-- Forward migration implementing Part B2 of the locked design in
-- docs/M4_M8_FOUNDATION_HARDENING_DESIGN.md (design section 7.1 Part B2
-- operations, section 13). Part B1 (audit resource linkage plus the
-- commercial RPC hardening) already applied and independently verified in
-- 20260910080000_m4_m8_audit_traceability_and_commercial_rpc_hardening.sql.
-- This file is Part B2 only: the six commercial cross-parent integrity
-- rules. Referred to by its descriptive name only, per the same naming
-- convention as every other migration in this retrospective: it carries
-- no migration number and is specifically not "Migration 9", which stays
-- reserved by docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md for the
-- Commercial Usage and Earned stage (design section 5.3, section 19).
--
-- Pre-apply data gates (design section 14.1, D1 through D7), executed
-- read-only against this project immediately before authoring this file:
-- all seven returned 0. public.commercial_configurations,
-- public.commercial_changes, public.commercial_components,
-- public.commercial_commitments, and public.commercial_commitment_components
-- are all empty (0 rows each). No existing row can violate any rule this
-- migration adds, and every constraint below is added without NOT VALID,
-- because there is no data to invalidate.
--
-- What this migration does, in the design section 7.1 Part B2 order:
--
--   5. ALTER TABLE public.commercial_changes ADD CONSTRAINT
--      uq_commercial_changes_configuration_request UNIQUE
--      (commercial_configuration_id, request_id). Supporting constraint for
--      operations 7 and 8 below; request_id is already the primary key, so
--      this restricts nothing (design section 13.1).
--   6. ALTER TABLE public.commercial_components ADD CONSTRAINT
--      uq_commercial_components_configuration_id UNIQUE
--      (commercial_configuration_id, id). Supporting constraint for
--      operation 9 below; id is already the primary key, so this
--      restricts nothing (design section 13.1).
--   7. ALTER TABLE public.commercial_components ADD CONSTRAINT
--      fk_commercial_components_change_within_configuration, a composite
--      foreign key enforcing Rule 1 (design section 13.2): a Component's
--      Change must belong to the Component's own Configuration.
--   8. ALTER TABLE public.commercial_configurations ADD CONSTRAINT
--      fk_commercial_configurations_change_backlink, a composite foreign
--      key enforcing Rule 4 (design section 13.5): a Configuration's
--      Change must backlink to that exact Configuration.
--   9. ALTER TABLE public.commercial_components ADD CONSTRAINT
--      fk_commercial_components_supersedes_within_configuration, a
--      self-referencing composite foreign key enforcing Rule 5 (design
--      section 13.6): a superseding Component must share its
--      predecessor's Configuration. This constrains only what a row may
--      point at, never how many rows may point at the same predecessor,
--      so supersession forks remain entirely unconstrained (design
--      section 3.3, section 13.6).
--  10. ALTER TABLE public.commercial_components ADD CONSTRAINT
--      chk_commercial_components_no_self_supersession CHECK
--      (supersedes_component_id IS DISTINCT FROM id), enforcing Rule 6
--      (design section 13.7): a Component may not supersede itself. A
--      single-row predicate; it cannot observe or restrict fork
--      cardinality in any way.
--  11. CREATE FUNCTION public.fn_protect_commercial_commitment_scope() and
--      CREATE TRIGGER trg_commercial_commitments_protect_scope, enforcing
--      Rule 2 (design section 13.3): a quantity Commitment's Component
--      must share its Change's Configuration.
--  12. CREATE OR REPLACE FUNCTION
--      public.fn_protect_commitment_component_membership() with the Rule 3
--      check added (design section 13.4): every spend-Commitment member
--      Component must share the Commitment's Configuration. search_path
--      is pinned in the same statement (design section 8.3): this is the
--      one function, of the 20 SECURITY INVOKER M4-M8 functions with an
--      unset search_path, promoted in B2, and only because the rewrite is
--      already mandatory for the Rule 3 check. No other function's
--      search_path is touched here.
--  13. REVOKE EXECUTE ON FUNCTION
--      public.fn_protect_commercial_commitment_scope() FROM public, anon,
--      authenticated. Trigger-only function, so no service_role grant,
--      matching the fn_reject_truncate()/fn_assert_resource_type()
--      convention.
--  14. Comment updates on the two functions touched above and on
--      public.commercial_components, recording the same-Configuration
--      supersession rule and the self-supersession prohibition together.
--
-- Order matters at exactly two points, both locked in design section 7.1:
-- operation 5 precedes operations 7 and 8, because both reference the
-- unique constraint operation 5 creates; operation 6 precedes operation 9,
-- for the same reason. Nothing else is order-dependent.
--
-- Fail-loud. No constraint is added NOT VALID: every invariant this
-- migration declares must hold from the moment it is declared, and the
-- D1 through D7 gates already confirm there is no existing row to
-- invalidate. No EXCEPTION block is added to either function; both
-- propagate every error, matching the established Nexus convention.
--
-- Deliberately out of scope, per the design section 5.2 split and section
-- 7.4: no TRUNCATE-related change (Migrations A and B1 already applied
-- and are not touched here), no RLS change, no privilege change to any
-- table, no new column anywhere, no drop of any existing single-column
-- foreign key (each new composite is additive alongside the one it
-- subsumes, design section 13.1), no NOT VALID constraint, no uniqueness
-- of any kind on supersedes_component_id (design section 3.3, section
-- 13.6, section 13.9), no change to fn_audit_row(), to the three audit
-- triggers, or to create_commercial_configuration_with_change() (all Part
-- B1, already applied and verified), no supabase_admin change, no default
-- ACL change, no historical migration edit, and no Commercial Migration 9
-- object of any kind. This migration closes P2-4 and P2-5; it does not by
-- itself unblock Commercial Migration 9, which additionally requires the
-- full design section 16 runtime proof and the M4-M8 closeout document
-- (design section 19).
--
-- Historical migrations are never edited. Migrations 1 through 8, the
-- Foundation RPC Privilege Hardening migration, the Platform Core
-- Integrity Hardening migration, the M4-M8 Destructive Privilege and
-- Permanence Hardening migration, and the M4-M8 Audit Traceability and
-- Commercial RPC Hardening migration remain immutable history.
--
-- This file has not been applied to any database.


-- =============================================================================
-- Section A: supporting UNIQUE constraints (operations 5 and 6)
-- =============================================================================

-- request_id is already commercial_changes' primary key, so this pair can
-- never collide unless the primary key already would. It does not mean
-- one Change per Configuration: many Changes may share a Configuration.
-- Its only purpose is to give PostgreSQL a valid composite reference
-- target for operations 7 and 8 below (design section 13.1).
alter table public.commercial_changes
  add constraint uq_commercial_changes_configuration_request
  unique (commercial_configuration_id, request_id);

-- id is already commercial_components' primary key, so this pair can never
-- collide unless the primary key already would. Its only purpose is to
-- give PostgreSQL a valid composite reference target for operation 9
-- below (design section 13.1).
alter table public.commercial_components
  add constraint uq_commercial_components_configuration_id
  unique (commercial_configuration_id, id);


-- =============================================================================
-- Section B: composite foreign keys (Rules 1, 4, 5 -- operations 7, 8, 9)
-- =============================================================================

-- Rule 1 (design section 13.2). A Component whose commercial_change_id
-- identifies a Change belonging to a different Configuration fails 23503.
-- Ordinary and immediate, not deferrable: a Component is always inserted
-- after both its Configuration and its Change exist (enforced today by
-- the existing single-column foreign keys, which are kept, not
-- replaced). ON DELETE RESTRICT matches every other foreign key on the
-- commercial tables; no ON UPDATE action, matching repository convention.
alter table public.commercial_components
  add constraint fk_commercial_components_change_within_configuration
  foreign key (commercial_configuration_id, commercial_change_id)
  references public.commercial_changes (commercial_configuration_id, request_id)
  on delete restrict;

-- Rule 4 (design section 13.5). A Configuration whose commercial_change_id
-- identifies a Change whose own commercial_configuration_id is not this
-- Configuration fails 23503. Reuses the constraint from Section A. This
-- does not disturb create_commercial_configuration_with_change()'s
-- circular creation: that function's own insert order (commercial_changes,
-- then resources, then commercial_configurations) already makes the
-- referenced index entry (p_new_commercial_configuration_id, p_request_id)
-- exist before this immediate check runs (design section 13.5).
alter table public.commercial_configurations
  add constraint fk_commercial_configurations_change_backlink
  foreign key (id, commercial_change_id)
  references public.commercial_changes (commercial_configuration_id, request_id)
  on delete restrict;

-- Rule 5 (design section 13.6). A Component whose supersedes_component_id
-- is in a different Configuration than its own fails 23503. Reuses the
-- constraint from Section A. supersedes_component_id stays nullable, and
-- under MATCH SIMPLE (PostgreSQL's default for a composite foreign key)
-- a NULL predecessor satisfies this constraint trivially, so a Component
-- with no predecessor is unaffected. This constrains only what one row
-- may point at, never how many rows may point at the same predecessor:
-- supersession forks (Decision 3, design section 3.3) remain entirely
-- unconstrained. Rule 6 below, not this constraint, is what prohibits a
-- self-edge; the two are complementary and neither substitutes for the
-- other (design section 13.6).
alter table public.commercial_components
  add constraint fk_commercial_components_supersedes_within_configuration
  foreign key (commercial_configuration_id, supersedes_component_id)
  references public.commercial_components (commercial_configuration_id, id)
  on delete restrict;


-- =============================================================================
-- Section C: self-supersession CHECK (Rule 6 -- operation 10)
-- =============================================================================

-- Rule 6 (design section 13.7). IS DISTINCT FROM, not <>: the latter
-- evaluates to NULL (and a CHECK passes on NULL) for the common
-- no-predecessor row, which would make the constraint's behavior on the
-- most frequent row shape in the table depend on a three-valued-logic
-- side effect rather than on the predicate itself. IS DISTINCT FROM is
-- total: NULL vs a NOT NULL id is genuinely distinct, so the row is
-- accepted because the predicate says so, not by accident. This is a
-- single-row predicate: it cannot observe, count, or restrict how many
-- Components reference the same predecessor, so forks are entirely
-- unaffected. Validates every existing row at ALTER TABLE time -- the D4
-- gate already confirmed zero existing self-supersession rows, so this
-- cannot fail on current data. supersedes_component_id stays nullable; no
-- NOT NULL, no default, and no uniqueness is added anywhere by this rule
-- (design section 3.5, section 13.7).
alter table public.commercial_components
  add constraint chk_commercial_components_no_self_supersession
  check (supersedes_component_id is distinct from id);


-- =============================================================================
-- Section D: Rule 2 -- quantity Commitment scope trigger (operation 11)
-- =============================================================================

-- Rule 2 (design section 13.3). commercial_commitments has no
-- commercial_configuration_id column of its own, so there is no column
-- pair to key a composite foreign key on; adding one would be a
-- denormalized duplicate of a fact already reachable in one join
-- (rejected as overengineering, design section 13.3). Enforced instead by
-- a new BEFORE INSERT FOR EACH ROW trigger. UPDATE is not covered:
-- fn_protect_commercial_commitment_lifecycle already makes
-- commercial_change_id and commercial_component_id immutable after
-- insert, so there is no UPDATE path that could later violate this
-- invariant, and covering one would add an unreachable branch.
--
-- Exact behavior, in the locked order (design section 13.3): resolve the
-- Change's Configuration first, falling through (not raising) if the
-- Change does not exist, so the existing single-column foreign key on
-- commercial_change_id owns that failure; only quantity Commitments are
-- in scope, since spend Commitments have no direct Component and are
-- covered by Rule 3 instead; a NULL commercial_component_id falls through
-- to let chk_commercial_commitments_kind_shape raise, since row-level
-- BEFORE triggers fire before CHECK constraints are evaluated; the
-- Component's Configuration is then resolved, again falling through if it
-- does not exist, so the existing single-column foreign key on
-- commercial_component_id owns that failure. Only once both Configuration
-- values are known and differ does this function raise; it never
-- duplicates a referential check a foreign key already owns.
create function public.fn_protect_commercial_commitment_scope()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_change_configuration_id    uuid;
  v_component_configuration_id uuid;
begin
  select commercial_configuration_id into v_change_configuration_id
  from public.commercial_changes
  where request_id = new.commercial_change_id;

  if not found then
    return new;
  end if;

  if new.kind is distinct from 'quantity' then
    return new;
  end if;

  if new.commercial_component_id is null then
    return new;
  end if;

  select commercial_configuration_id into v_component_configuration_id
  from public.commercial_components
  where id = new.commercial_component_id;

  if not found then
    return new;
  end if;

  if v_change_configuration_id is distinct from v_component_configuration_id then
    raise exception
      'commercial_commitments: quantity commitment % has component % in '
      'commercial_configuration %, but its change % belongs to commercial_configuration %',
      new.id, new.commercial_component_id, v_component_configuration_id,
      new.commercial_change_id, v_change_configuration_id;
  end if;

  return new;
end;
$$;

create trigger trg_commercial_commitments_protect_scope
  before insert on public.commercial_commitments
  for each row execute function public.fn_protect_commercial_commitment_scope();


-- =============================================================================
-- Section E: Rule 3 -- spend Commitment membership rewrite (operation 12)
-- =============================================================================

-- Rule 3 (design section 13.4). Extends the existing trigger function
-- rather than adding a second trigger: fn_protect_commitment_component_membership()
-- already owns commercial_commitment_components' membership integrity,
-- already locks the parent commercial_commitments row FOR UPDATE, and
-- already reads both the parent Commitment and the new Component, so
-- adding the Configuration check here reuses all three instead of
-- creating a second function to own the same table's rules.
--
-- Exact behavior, with the new step in its locked position (design
-- section 13.4): the parent-lock and non-spend rejection are unchanged,
-- first as before. The new Configuration check comes second, resolving
-- the Commitment's Configuration by joining to commercial_changes and the
-- new Component's Configuration from commercial_components; if either
-- resolves to no row, it falls through without raising and lets the
-- existing single-column foreign keys own it; if both resolve and
-- differ, it raises, naming the Commitment, the Component, and both
-- Configuration values. The existing member-to-member transaction_currency
-- comparison is unchanged and stays third, after the new check: a
-- Configuration mismatch is the more fundamental violation, and
-- reporting currency first would frequently mask the real cause. This
-- ordering is locked and proven by a same-fixture test in the design's
-- runtime proof, not merely stated.
--
-- CREATE OR REPLACE with an unchanged signature (no arguments, returns
-- trigger), so the function's OID and every privilege already revoked
-- from it are preserved automatically (design section 7.3): still
-- SECURITY INVOKER, EXECUTE still revoked from public, anon, authenticated,
-- owner unchanged. search_path = pg_catalog is pinned in this same
-- statement, the one coupled exception named in design section 8.3: the
-- body already schema-qualifies every table it touches, so name
-- resolution is unaffected, and no other function's search_path is
-- touched by this migration.
create or replace function public.fn_protect_commitment_component_membership()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_kind                        text;
  v_new_currency                text;
  v_existing_currency           text;
  v_commitment_configuration_id uuid;
  v_component_configuration_id  uuid;
begin
  select kind into v_kind
  from public.commercial_commitments
  where id = new.commitment_id
  for update;

  if v_kind is distinct from 'spend' then
    raise exception
      'commercial_commitment_components: only minimum-spend commitments may use this '
      'membership table (commitment_id=% has kind=%)', new.commitment_id, v_kind;
  end if;

  select ch.commercial_configuration_id into v_commitment_configuration_id
  from public.commercial_commitments cm
  join public.commercial_changes ch on ch.request_id = cm.commercial_change_id
  where cm.id = new.commitment_id;

  select commercial_configuration_id into v_component_configuration_id
  from public.commercial_components
  where id = new.component_id;

  if v_commitment_configuration_id is not null
     and v_component_configuration_id is not null
     and v_commitment_configuration_id is distinct from v_component_configuration_id
  then
    raise exception
      'commercial_commitment_components: component % belongs to commercial_configuration %, '
      'but commitment % belongs to commercial_configuration %',
      new.component_id, v_component_configuration_id, new.commitment_id, v_commitment_configuration_id;
  end if;

  select transaction_currency into v_new_currency
  from public.commercial_components
  where id = new.component_id;

  select cc.transaction_currency into v_existing_currency
  from public.commercial_commitment_components ccc
  join public.commercial_components cc on cc.id = ccc.component_id
  where ccc.commitment_id = new.commitment_id
  limit 1;

  if v_existing_currency is not null and v_existing_currency is distinct from v_new_currency then
    raise exception
      'commercial_commitment_components: member component currency % does not match '
      'existing member currency % for commitment %',
      v_new_currency, v_existing_currency, new.commitment_id;
  end if;

  return new;
end;
$$;


-- =============================================================================
-- Section F: privilege posture for the new function (operation 13)
-- =============================================================================

-- Trigger-only convention: no positive service_role grant, matching
-- fn_reject_truncate() and every other trigger-only function in this
-- repository. fn_protect_commitment_component_membership() needs no
-- re-grant: CREATE OR REPLACE with an unchanged signature preserved its
-- OID and every privilege already on it.
revoke execute on function public.fn_protect_commercial_commitment_scope()
  from public, anon, authenticated;


-- =============================================================================
-- Section G: comment updates (operation 14)
-- =============================================================================

comment on function public.fn_protect_commercial_commitment_scope() is
  'BEFORE INSERT guard on commercial_commitments enforcing design section 13.3, '
  'Rule 2: a quantity Commitment''s directly referenced Component must belong to '
  'the same commercial_configuration as the Commitment''s own commercial_changes '
  'row. Falls through, deliberately not raising, whenever the Change or the '
  'Component cannot be resolved, or the Commitment is not a quantity kind, so it '
  'never duplicates a referential or shape check already owned by an existing '
  'foreign key or CHECK constraint. See docs/M4_M8_FOUNDATION_HARDENING_DESIGN.md §13.3.';

comment on function public.fn_protect_commitment_component_membership() is
  'BEFORE INSERT guard on commercial_commitment_components. Locks the parent '
  'commercial_commitments row, rejects membership on any non-minimum-spend '
  'Commitment, then enforces design section 13.4, Rule 3: every member Component '
  'must belong to the same commercial_configuration as the Commitment''s own '
  'commercial_changes row, checked before the pre-existing member-to-member '
  'transaction_currency comparison so a Configuration mismatch is never masked by '
  'a currency message. See docs/M4_M8_FOUNDATION_HARDENING_DESIGN.md §13.4.';

comment on table public.commercial_components is
  'Individually priced/billed unit within a Commercial Configuration. '
  'commercial_configuration_id and commercial_change_id are frozen after insert '
  '(fn_protect_commercial_component_lifecycle permits only effective_to, '
  'updated_at, and updated_by to change). A Component''s Change must belong to '
  'the Component''s own Configuration (fk_commercial_components_change_within_configuration, '
  'Rule 1). supersedes_component_id is nullable and may be shared by any number of '
  'successor Components: supersession forks are an accepted business capability '
  'and no uniqueness of any kind is added on this column (Decision 3). A '
  'superseding Component must share its predecessor''s Configuration '
  '(fk_commercial_components_supersedes_within_configuration, Rule 5), and a '
  'Component may not supersede itself '
  '(chk_commercial_components_no_self_supersession, Rule 6); the two constraints '
  'are complementary and neither substitutes for the other. See '
  'docs/M4_M8_FOUNDATION_HARDENING_DESIGN.md §3.3, §3.5, §13.2, §13.6, §13.7.';
