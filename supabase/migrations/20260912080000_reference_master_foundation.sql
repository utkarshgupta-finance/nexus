-- Nexus: Reference Master Foundation.
--
-- Translates docs/DATA_ARCHITECTURE.md §6 and docs/SETTINGS_ARCHITECTURE.md
-- into schema: one generic, persistent Reference List/Option model for
-- every governed selectable value Customer Onboarding and Commercial Rate
-- depend on, replacing the fixture/local-session stand-in
-- (src/features/reference-data/domain/fixtures.ts) with a real table.
--
-- Scope: exactly two tables, reference_lists and reference_options, plus
-- the lifecycle/audit triggers the locked design requires, plus seed rows
-- for the twelve lists this repository's fixture already defines
-- (industry, segment, business_unit, tax_identifier_type, currency,
-- pricing_unit, invoice_frequency, invoice_timing, commercial_nature,
-- pricing_model, slab_method, revenue_recognition_method).
--
-- Out of scope, deliberately: country and phone_country_code. Both stay
-- governed by the real countries-list catalogue
-- (src/features/reference-data/domain/countries.ts), not this table
-- (docs/SETTINGS_ARCHITECTURE.md §2, "Country and Phone Country Code are
-- deliberately excluded"). Also out of scope: Commercial Configuration
-- persistence (unrelated table, unrelated migration) and any table per
-- individual dropdown, which this generic model exists specifically to
-- avoid.
--
-- Neither table participates in the Resource Registry: same reasoning as
-- capabilities (20260908013210_master_data_foundation.sql) and
-- measurement_definitions, pure reference/catalog data, never
-- independently actioned by workflow, tasks, or approvals.
--
-- This file has not been applied to any database as of authoring.


-- =============================================================================
-- reference_lists: structural catalog of which lists exist
-- =============================================================================

-- Same role as resource_types (docs/DATA_ARCHITECTURE.md §2): a small,
-- migration-managed catalog that gates reference_options.list_key, so a
-- new list category is a structural/code change, never a Settings-screen
-- action. This is what keeps "one generic table" from silently becoming
-- an ungoverned key-value dumping ground.
create table reference_lists (
  list_key    text primary key,
  description text not null,
  created_at  timestamptz not null default now()
);

comment on table reference_lists is
  'Catalog of Reference Master list categories (industry, currency, pricing_unit, '
  'and similar). Migration-managed structural metadata, not user-editable '
  'configuration; a new list category is added here only by a future migration, '
  'never by the Settings UI. See docs/DATA_ARCHITECTURE.md §6 and '
  'docs/SETTINGS_ARCHITECTURE.md.';

alter table reference_lists enable row level security;


-- =============================================================================
-- reference_options: the generic, persistent option model
-- =============================================================================

-- One table for every governed selectable value, per docs/DATA_ARCHITECTURE.md
-- §6 ("a stable code, a display label, an active flag, a sort order") and
-- the Settings task correction's explicit instruction not to create a
-- table per dropdown. `code` is the stable, immutable identity a business
-- record actually stores (never the mutable `label`); `list_key` scopes a
-- code to its own list, so "other" can mean something different in
-- tax_identifier_type than it might in a future list without collision.
--
-- Governed metadata is two typed, nullable columns, not a JSON blob and
-- not one column per hypothetical future list (task correction §4): only
-- `currency` ever populates inr_conversion_rate, only `invoice_frequency`
-- ever populates cadence_months, enforced below by CHECK constraints
-- scoped to list_key, so a future list that turns out to need its own
-- governed number is a considered schema change, not silent reuse of a
-- column that means something else for it.
create table reference_options (
  id                   uuid primary key default gen_random_uuid(),
  list_key             text not null references reference_lists (list_key) on delete restrict,
  code                 text not null,
  label                text not null,
  is_active            boolean not null default true,
  sort_order           integer not null default 0,
  inr_conversion_rate  numeric,
  cadence_months       integer,
  created_at           timestamptz not null default now(),
  created_by           uuid references app_users (id) on delete restrict,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references app_users (id) on delete restrict,

  constraint uq_reference_options_list_code unique (list_key, code),
  constraint chk_reference_options_inr_rate_scope check (
    list_key = 'currency' or inr_conversion_rate is null
  ),
  constraint chk_reference_options_cadence_scope check (
    list_key = 'invoice_frequency' or cadence_months is null
  ),
  constraint chk_reference_options_inr_rate_positive check (
    inr_conversion_rate is null or inr_conversion_rate > 0
  ),
  constraint chk_reference_options_cadence_positive check (
    cadence_months is null or cadence_months > 0
  )
);

comment on table reference_options is
  'Generic, persistent Reference Master option: one row per selectable value '
  'across every governed list (industry, currency, pricing_unit, and similar). '
  'code is stable and immutable once set (docs/SETTINGS_ARCHITECTURE.md, "stable '
  'key principle"); label is an editable display string. is_active is reversible '
  'in both directions (Activate/Deactivate), matching customers.is_active, not a '
  'one-way churn marker. No hard delete, no deleted_at: a record that already '
  'stored this code must remain resolvable forever. See docs/DATA_ARCHITECTURE.md '
  '§6 and docs/SETTINGS_ARCHITECTURE.md.';

comment on column reference_options.code is
  'Stable, immutable identity. Never mutated once a row exists; a semantic change '
  'is a new option, not an edited code. See fn_protect_reference_option_lifecycle().';

comment on column reference_options.is_active is
  'Reversible selectability flag: true -> false and false -> true are both '
  'permitted. Deactivating never removes historical meaning; resolveOption-style '
  'reads must still succeed regardless of this flag.';

comment on column reference_options.inr_conversion_rate is
  'Governed "1 unit of this currency = X INR" rate. Only populated for '
  'list_key = ''currency'' (see chk_reference_options_inr_rate_scope). INR''s own '
  'row always carries exactly 1. null means not yet configured, never a guessed '
  'value; docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22 and '
  'src/features/customer-onboarding/domain/commercial-rate-fx.ts both treat null '
  'as "missing", never as "assume 1".';

comment on column reference_options.cadence_months is
  'Governed invoicing cadence in months. Only populated for '
  'list_key = ''invoice_frequency'' (see chk_reference_options_cadence_scope). '
  'null is reserved for the one true "one_time" row; any Settings-added recurring '
  'frequency always requires a positive value, which is what stops a new row from '
  'impersonating the reserved one_time semantics.';

create index idx_reference_options_list_key on reference_options (list_key);

alter table reference_options enable row level security;


-- =============================================================================
-- Lifecycle protection
-- =============================================================================

-- Same combined identity-immutability and DELETE guard shape as
-- fn_protect_customer_lifecycle() (20260908013210_master_data_foundation.sql):
-- SECURITY INVOKER, no privilege elevation needed. is_active is excluded
-- from the core comparison since it is reversible in both directions, the
-- same rule as customers.is_active, not capabilities.status.
create function fn_protect_reference_option_lifecycle()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'reference_options is a permanent master identity: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  -- tg_op = 'UPDATE'. label, is_active, sort_order, inr_conversion_rate,
  -- cadence_months, updated_at, and updated_by are the only columns ever
  -- permitted to change; list_key/code/created_at/created_by are immutable.
  v_old_core := to_jsonb(old) - 'label' - 'is_active' - 'sort_order' - 'inr_conversion_rate'
    - 'cadence_months' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new) - 'label' - 'is_active' - 'sort_order' - 'inr_conversion_rate'
    - 'cadence_months' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'reference_options is a permanent master identity: only label/is_active/ '
      'sort_order/inr_conversion_rate/cadence_months/updated_at/updated_by may '
      'change (id=%)', old.id;
  end if;

  return new;
end;
$$;

comment on function fn_protect_reference_option_lifecycle() is
  'Enforces reference_options lifecycle: no DELETE; UPDATE may change only label/ '
  'is_active/sort_order/inr_conversion_rate/cadence_months/updated_at/updated_by; '
  'list_key/code/created_at/created_by are immutable once set.';

create trigger trg_reference_options_protect_lifecycle
  before insert or update or delete on reference_options
  for each row
  execute function fn_protect_reference_option_lifecycle();

create trigger trg_reference_options_updated_at
  before update on reference_options
  for each row
  execute function fn_set_updated_at();


-- =============================================================================
-- Audit
-- =============================================================================

-- reference_lists is intentionally not audited here, matching the exact
-- precedent already set for resource_types
-- (20260906084244_platform_core_foundation.sql): migration-only
-- structural metadata with a text primary key, not fn_audit_row-shaped
-- (that function casts the primary key to uuid for audit_log.row_id).
--
-- reference_options gets the generic full-row audit, reusing
-- fn_audit_row('id') unmodified, same conclusion already reached for
-- customers/capabilities: small rows, infrequent writes, no
-- payload-size concern. Attached to fire on DELETE too, matching the
-- existing convention, even though the lifecycle trigger above always
-- rejects DELETE first.
create trigger trg_audit_reference_options
  after insert or update or delete on reference_options
  for each row execute function fn_audit_row('id');


-- =============================================================================
-- Privilege hardening
-- =============================================================================

-- Same defense-in-depth reasoning as every prior migration: the default
-- privilege rule already installed revokes these from anon/authenticated
-- the moment the objects are created; the explicit REVOKE below is not a
-- correction, it makes that fact readable in this migration on its own.
revoke all on table reference_lists, reference_options from anon, authenticated;

revoke execute on function fn_protect_reference_option_lifecycle()
from public, anon, authenticated;


-- =============================================================================
-- Row Level Security: deny-by-default
-- =============================================================================

-- Same posture as every existing Platform Core table: ENABLE, not FORCE,
-- RLS; zero policies. anon/authenticated are denied all direct access by
-- RLS itself, beneath the privilege hardening above. service_role (the
-- application-service layer's trusted path) is untouched by any of this.
-- (RLS already enabled above, immediately after each CREATE TABLE.)


-- =============================================================================
-- Seed data: reference_lists catalog
-- =============================================================================

-- The twelve list categories this repository's fixture
-- (src/features/reference-data/domain/fixtures.ts) already defines,
-- excluding country and phone_country_code (docs/SETTINGS_ARCHITECTURE.md
-- §2). Idempotent: safe to re-run, never duplicates a row.
insert into reference_lists (list_key, description) values
  ('industry', 'Customer industry / category classification.'),
  ('segment', 'Customer segment classification.'),
  ('business_unit', 'Owning Nexus business unit for a customer.'),
  ('tax_identifier_type', 'Local tax/registration identifier type for a non-India customer.'),
  ('currency', 'Billing/transaction currency, with a governed INR conversion rate.'),
  ('pricing_unit', 'Unit a Commercial Rate Pricing Model bills against.'),
  ('invoice_frequency', 'Invoicing cadence, with a governed cadence in months.'),
  ('invoice_timing', 'Whether an invoice is raised in advance of or after the period.'),
  ('commercial_nature', 'System-supported Commercial Component nature.'),
  ('pricing_model', 'System-supported Commercial Component pricing calculation model.'),
  ('slab_method', 'System-supported Slab pricing calculation method.'),
  ('revenue_recognition_method', 'System-supported Non-Recurring revenue recognition method.')
on conflict (list_key) do nothing;


-- =============================================================================
-- Seed data: reference_options
-- =============================================================================

-- Migrates the exact current fixture values (no invented values, task
-- correction §13: "Do not invent new values"), preserving every stable
-- code. created_by/updated_by are left null throughout: Nexus has no
-- authenticated actor identity yet (docs/AUTHORIZATION_MODEL.md, locked
-- design), so this seed does not fabricate one, matching the same
-- honesty already established for customers/capabilities seed rows.
-- Idempotent via ON CONFLICT (list_key, code) DO NOTHING.

insert into reference_options (list_key, code, label, is_active, sort_order) values
  -- industry
  ('industry', 'fmcg', 'FMCG', true, 1),
  ('industry', 'consumer_durables', 'Consumer Durables', true, 2),
  ('industry', 'retail', 'Retail', true, 3),
  ('industry', 'healthcare', 'Healthcare', true, 4),
  ('industry', 'automotive', 'Automotive', true, 5),
  ('industry', 'other', 'Other', true, 6),

  -- segment (one inactive on purpose, matching the existing fixture, so
  -- historical-resolution behavior has a real seeded example)
  ('segment', 'enterprise', 'Enterprise', true, 1),
  ('segment', 'mid_market', 'Mid Market', true, 2),
  ('segment', 'sme', 'SME', true, 3),
  ('segment', 'global_key_accounts', 'Global Key Accounts (Legacy)', false, 4),

  -- business_unit
  ('business_unit', 'india_enterprise', 'India Enterprise', true, 1),
  ('business_unit', 'india_mid_market', 'India Mid Market', true, 2),
  ('business_unit', 'sme', 'SME', true, 3),
  ('business_unit', 'mea', 'MEA', true, 4),
  ('business_unit', 'sea', 'SEA', true, 5),
  ('business_unit', 'kam', 'KAM', true, 6),
  ('business_unit', 'bat', 'BAT', true, 7),

  -- tax_identifier_type
  ('tax_identifier_type', 'vat_number', 'VAT Number', true, 1),
  ('tax_identifier_type', 'tax_identification_number', 'Tax Identification Number', true, 2),
  ('tax_identifier_type', 'business_registration_number', 'Business Registration Number', true, 3),
  ('tax_identifier_type', 'other', 'Other', true, 4),

  -- pricing_unit
  ('pricing_unit', 'USER', 'User', true, 1),
  ('pricing_unit', 'PERSON', 'Person', true, 2),
  ('pricing_unit', 'MESSAGE', 'Message', true, 3),
  ('pricing_unit', 'OUTLET', 'Outlet', true, 4),
  ('pricing_unit', 'DISTRIBUTOR', 'Distributor', true, 5),
  ('pricing_unit', 'SESSION', 'Session', true, 6),
  ('pricing_unit', 'REQUEST', 'Request', true, 7),
  ('pricing_unit', 'MAN_DAY', 'Man-day', true, 8),
  ('pricing_unit', 'DAY', 'Day', true, 9),
  ('pricing_unit', 'IMAGE', 'Image', true, 10),
  ('pricing_unit', 'REPORT', 'Report', true, 11),
  ('pricing_unit', 'DASHBOARD', 'Dashboard', true, 12),

  -- invoice_timing
  ('invoice_timing', 'advance', 'Advance', true, 1),
  ('invoice_timing', 'postpaid', 'Postpaid', true, 2),

  -- commercial_nature
  ('commercial_nature', 'recurring', 'Recurring', true, 1),
  ('commercial_nature', 'non_recurring', 'Non-Recurring', true, 2),
  ('commercial_nature', 'on_demand', 'On-Demand', true, 3),

  -- pricing_model
  ('pricing_model', 'per_unit', 'Per Unit', true, 1),
  ('pricing_model', 'flat_fee', 'Flat Fee', true, 2),
  ('pricing_model', 'slab', 'Slab', true, 3),
  ('pricing_model', 'designation_based', 'Designation Based', true, 4),

  -- slab_method
  ('slab_method', 'whole_quantity', 'Whole Quantity', true, 1),
  ('slab_method', 'progressive', 'Progressive', true, 2),

  -- revenue_recognition_method
  ('revenue_recognition_method', 'full_recognition', 'Full Recognition', true, 1),
  ('revenue_recognition_method', 'milestone_based', 'Milestone Based', true, 2)
on conflict (list_key, code) do nothing;

-- currency: seeded separately, since it is the only list whose seed rows
-- populate the governed inr_conversion_rate column. IDR is deliberately
-- left null (not configured), matching the existing fixture, so the
-- missing-rate validation path has a real seeded example, never an
-- invented number.
insert into reference_options (list_key, code, label, is_active, sort_order, inr_conversion_rate) values
  ('currency', 'INR', 'INR - Indian Rupee', true, 1, 1),
  ('currency', 'USD', 'USD - US Dollar', true, 2, 91),
  ('currency', 'GBP', 'GBP - British Pound Sterling', true, 3, 121),
  ('currency', 'SGD', 'SGD - Singapore Dollar', true, 4, 68),
  ('currency', 'IDR', 'IDR - Indonesian Rupiah', true, 5, null)
on conflict (list_key, code) do nothing;

-- invoice_frequency: seeded separately for the same reason, populating
-- cadence_months. one_time is the sole reserved null-cadence row.
insert into reference_options (list_key, code, label, is_active, sort_order, cadence_months) values
  ('invoice_frequency', 'monthly', 'Monthly', true, 1, 1),
  ('invoice_frequency', 'quarterly', 'Quarterly', true, 2, 3),
  ('invoice_frequency', 'half_yearly', 'Half-Yearly', true, 3, 6),
  ('invoice_frequency', 'annual', 'Annual', true, 4, 12),
  ('invoice_frequency', 'one_time', 'One-Time', true, 5, null)
on conflict (list_key, code) do nothing;
