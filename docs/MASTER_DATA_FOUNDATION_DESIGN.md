# NEXUS MASTER DATA FOUNDATION

## CUSTOMER + CAPABILITY

**STATUS: COMPLETE.** Migration 7
(`supabase/migrations/20260908013210_master_data_foundation.sql`) has
been applied to the linked remote Nexus database and its full runtime
break-test suite has passed (40/40). Full execution evidence lives in
`docs/MASTER_DATA_FOUNDATION_MIGRATION_DESIGN.md`, not duplicated here;
this document remains the authoritative record of the business/database
design decisions themselves, which are unchanged by that execution.

**CORRECTION NOTICE**: Finance has corrected the Customer lifecycle
rule. `customers.is_active` is not a one-way switch: it may move
`true -> false` and `false -> true`, since a returning customer may be
the same canonical Customer identity reactivated, or a genuinely
different one represented by a new row, a business decision this
document does not automate (§5.2, §5.2a). Capability lifecycle is
unaffected and remains one-way (`active -> deprecated`, §6.3).

This document designs the smallest possible canonical Customer and
Capability/Workflow identities Nexus needs so the locked
`docs/COMMERCIAL_DATABASE_DESIGN.md` can eventually be migrated with real
foreign keys for `commercial_configurations.customer_id` and
`commercial_component_capabilities.capability_id`, instead of unenforced
UUID references. It does not create a migration, execute SQL against
Supabase, write application code, or build Commercial, Pricing, Usage,
Entitlement, Customer 360, CRM, a Product Catalog, or workflow
configuration. Every example is generic and fictional; no real Nexus
customer, contract, or negotiated price appears anywhere in this
document.

## 1. Purpose

Give Nexus exactly two things it does not yet have: a stable Customer
identity, and a stable Capability/Workflow identity. Nothing else. Both
exist so a Nexus record can answer "which customer" and "which
capability" with a real, database-enforced foreign key, not a bare UUID
with no backing row, the exact class of gap `docs/COMMERCIAL_DATABASE_DESIGN.md`
§23 flagged and Migration 6 already had to correct once for `requests`.

## 2. Scope

- A canonical `customers` identity: the smallest fields that let Nexus
  answer "what customer does this record belong to."
- A canonical `capabilities` identity: the smallest fields that let
  Nexus answer "what Nexus capability is this."
- The lifecycle, mutability, audit, concurrency, authorization boundary,
  and retention rules for both.
- How a future Form Data Source Resolver and future Customer 360 domains
  attach to these identities without redesigning them.

## 3. Explicit non-scope

**Customer Master is not**: a CRM. It does not hold contacts,
opportunities, leads, sales pipeline, contracts, pricing, legal
documents, AR, invoices, a geography hierarchy (unless a future,
concrete identity need requires it, which none does today), account
management activity, customer health, NPS, tickets, entitlements, usage,
collections, ownership teams, implementation projects, or subsidiary/
entity hierarchy.

**Capability Master is not**: pricing, entitlements, feature flags,
technical service topology, deployment configuration, workflow
execution, process definitions, SurveyJS forms, permissions, usage
measurement rules, or package/plan definitions.

This document does not build a migration, Customer Master UI, Capability
Master UI, the Form Data Source Resolver itself, Customer 360, or
Commercial. It does not decide Commercial pricing, usage, or entitlement
logic. Every field proposed below is justified by an already-locked need
(a real Commercial foreign key target); nothing is added because a CRM
or catalog product would normally have it.

## 4. Terminology

**Capability**, not **Workflow**, and not two separate masters. Nexus
documents have used "Capability," "Workflow," and "Capability/Workflow
Master" somewhat interchangeably; this document resolves that.
`docs/PLATFORM_ARCHITECTURE.md` §6 and §13 already define **Workflow** as
a specific, narrower technical concept: a Flowable process definition,
states, and transitions, a maker-checker orchestration artifact. That is
not the same concept `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` means when
it says a Commercial Scope references "SFA," "DMS," or "Attendance."
Those are business-facing, commercially referenceable capabilities, a
different, higher-level concept that happens to share a casual English
word with Flowable's technical workflow definitions. Colloquially,
someone may still say "the SFA workflow" in conversation; this document's
canonical database identity for that concept is named **Capability**, to
avoid that name collision with Flowable's own, unrelated workflow
definitions.

One canonical concept, not two masters: nothing in the locked Commercial
architecture, or in any other current Nexus requirement, distinguishes
"a capability" from "a workflow" as two independently identified things
needing separate registries. A single `capabilities` table, broad enough
to classify whatever Nexus commercially scopes today (SFA, DMS,
Attendance, Image Recognition, Messaging) and whatever else it adds
later, is the smallest correct model. If a genuinely distinct concept
later needs its own identity (for example, a technical
integration/service topology entry, explicitly out of scope here, §3),
that is a new, additive table when a real requirement for it exists, not
a reason to split Capability into two registries now.

## 5. Customer Master

### 5.1 Business purpose

Answers exactly one question: "what customer does this Nexus record
belong to." A Commercial Configuration represents one commercial
relationship for a Customer; a Customer may have more than one
Commercial Configuration. Customer and Commercial Configuration are
deliberately not collapsed: Customer ABC may have a Commercial
Configuration for an India relationship and a separate one for a
Singapore relationship, both referencing the same canonical Customer.

### 5.2 Fields, challenged one at a time

- **`id`**: uuid, primary key, generated at write time, matching
  `docs/DATA_ARCHITECTURE.md` §3's standard primary-key shape.
- **`key`**: stable, human-readable code, unique, **immutable after
  insert**. This is the only hard uniqueness this table enforces. Why
  not unique `name`: two customers can legitimately share, or nearly
  share, a display name (a common legal-entity naming pattern, a
  franchise, a renamed successor entity); inventing a uniqueness rule
  the business fact does not actually support would only produce false
  collisions or force an artificial disambiguation suffix into a
  display field. `key` gives every Customer a collision-free reference
  without pretending name uniqueness exists.
- **`name`**: current display label. **Editable.** A catalog label,
  not a captured Finance fact, the same distinction already established
  for `form_definitions.name` (`docs/FORM_VERSIONING_MODEL.md` §5):
  renaming a customer does not retroactively change what a historical
  Commercial Configuration or a past submission actually said, because
  those consumers snapshot what they saw at the time (§13), never a live
  join to today's `name`.
- **`is_active`**: boolean, `not null default true`. **Corrected by
  Finance**: unlike `requests.is_active`, this is not a one-way switch.
  Both `true -> false` and `false -> true` are permitted. `is_active` is
  a selectability/current-activity flag, not a lifecycle terminus: a
  Customer that stops being selectable for new transactions can later
  become selectable again, with the same `id`/`key` and every historical
  domain record still attached to that same Customer identity (§5.2a). A
  single boolean, not a larger status enum, remains correct: there is
  still exactly one real question this column answers ("is this Customer
  currently selectable for a new transaction"), it now simply has two
  legitimate directions instead of one. No new lifecycle state is
  introduced.
- **`row_version`**: integer, starting at 1, database-maintained,
  identical mechanism to `form_versions.row_version` /
  `commercial_configurations.row_version`. Justified, not habitual: see
  §10.
- `created_at`/`created_by`, `updated_at`/`updated_by`: standard columns
  (`docs/DATA_ARCHITECTURE.md` §3).

**Rejected**: `deleted_at` (no hard delete is ever designed for this
table, §12; `is_active` already answers the one lifecycle question that
exists); a status enum in place of `is_active` (no second state exists
to justify one); a legal-entity/geography/subsidiary hierarchy (no
current identity need requires it; a future need would be evaluated on
its own merits, not built speculatively); any contact, address, or
account-management field (§3).

### 5.2a New versus returning customer: an identity decision, not a
database rule

**Locked by Finance.** When a former customer returns, Nexus must
support two different outcomes, and the database does not choose
between them:

- **A. Reactivate the existing Customer identity** (`is_active: false ->
  true` on the same row). Appropriate when the business considers the
  returning relationship the same canonical Customer as before: the same
  `id`, the same `key`, and every historical Commercial Configuration,
  Commercial Component, and any other domain record already attached to
  that Customer remain attached to that same identity, unchanged and
  unbroken.
- **B. Create a new Customer identity** (a new row, a new `id`, a new
  `key`). Appropriate when the business genuinely considers the
  returning relationship a different canonical Customer (for example, a
  materially different legal entity or relationship despite superficial
  similarity to a former one), even if a person might casually recognize
  it as "the same company coming back."

**Nexus must not force either outcome merely because a Customer was
previously inactive.** The deciding question is canonical business
identity, a business judgment, never a mechanical consequence of
`is_active` having been `false`. This document does not decide, and does
not build, the resolution logic for which of the two applies in a given
case; that is exactly the deferred duplicate/merge/customer-identity
resolution capability named in §5.3, left for a future stage when a real
case needs it.

**Customer Master is not responsible for churn.** `is_active` is a
master-data availability/current-use flag only: whether this Customer is
normally selectable for a new transaction right now. It does not delete
history, does not hide historical records, does not itself create or
imply a new identity, and does not, by itself, mean the customer has
churned. Churn is a future domain/business lifecycle fact that some
later Customer 360 capability may track (§21); `customers.is_active`
neither implements nor substitutes for it.

### 5.3 Duplicate prevention

`key` uniqueness is the only hard uniqueness this table enforces, and it
is deliberately not a proxy for "these are definitely two different
real-world customers": a `key` is assigned by whoever creates the
Customer row, not derived from a trustworthy external identifier Nexus
does not have today (no GSTIN/legal-entity-registry integration exists).
Two rows can still, in practice, end up representing the same real
customer if created independently by mistake. This document does not
build duplicate detection or a merge mechanism: no `customer_merges`
table, no fuzzy-name matching, no legal-entity matching. A future
duplicate-detection or merge capability can be added additively,
referencing `customers.id` the same way any other future domain would
(§21), most plausibly as a `superseded_by_customer_id` self-reference or
a dedicated merge-event table decided when a real duplicate is actually
found and needs a resolution path, not guessed at now.

### 5.4 Resource Registry decision

**CUSTOMER RESOURCE-BACKED: NO.**

Considered: attachments, comments, API identity, scoped authorization,
tasks, Customer-level activity, and a future Customer 360 could all
plausibly want to attach to something Customer-shaped. Weighed against:
the Resource Registry should not contain every reference row
(`docs/PLATFORM_ARCHITECTURE.md` §3), and a Customer row itself, today,
is not an actionable Finance request; nothing currently approves,
comments on, or assigns a task against a Customer row directly. This is
the same distinction already drawn between `form_definitions` (not
resource-backed, a stable catalog identity) and `form_versions`
(resource-backed, the actionable, approvable artifact,
`docs/FORM_VERSIONING_MODEL.md` §14), and between Commercial
Configuration (resource-backed, §5.1 of the locked database design) and
Commercial Component (deliberately made *not* resource-backed in that
same design's correction pass, because the actionable boundary is the
Commercial Change/Request, not the fact row it produces). Customer plays
the stable-catalog-identity role here, not the actionable-artifact role.

Future Customer 360 domains (Commercial, Legal, Collections, Usage,
Entitlements, Suspension/Disconnection, Churn) are exactly the kind of
capability that plausibly does need workflow, tasks, comments, or
attachments, but each of those needs is naturally scoped to its own
domain-owned record (a Commercial Configuration, a Collections case, a
Legal matter), which can be resource-backed on its own merits when it is
built, exactly as Commercial Configuration already is. None of them
requires the shared Customer identity itself to be resource-backed
merely because something that references it eventually will be. If a
genuine Customer-level actionable request appears later (for example, a
"Customer Onboarding Request"), that need resource-backs *that* new
table, the same way Request itself is resource-backed rather than
`app_users`; it would not retrofit `customers`.

### 5.5 Deletion / retention

No hard delete, ever, after creation. No `deleted_at` column. `is_active`
is the only lifecycle switch, **corrected by Finance to be reversible in
both directions** (§5.2): it is not a deletion, visibility, or retention
mechanism in either direction. Moving `true -> false` never hides a
Customer from history, and moving `false -> true` never creates a new
identity or breaks any historical reference; both are ordinary updates
to the same permanent row. Historical references (from
`commercial_configurations.customer_id`, once real, and from any future
Customer 360 record) remain valid regardless of the current value of
`is_active`. This follows `docs/DATA_ARCHITECTURE.md` §10's default (soft
deletion, never hard, for any record that has ever been referenced by a
business transaction) and is stricter still: not even a soft-delete
timestamp exists, because Commercial and future Customer 360 domains must
be able to reference a Customer forever, regardless of how many times its
availability flag has moved in either direction.

## 6. Capability Master

### 6.1 Business purpose

Answers exactly one question: "what Nexus capability/workflow is this."
Commercial Scope (`commercial_component_capabilities.capability_id`)
references this identity; a Commercial Component may reference one or
several Capability IDs (`docs/COMMERCIAL_DATABASE_DESIGN.md` §5.3).
Capability identity must remain stable even if its display label
changes later, the same historical-stability requirement already proven
for `form_definitions.key`/`measurement_definitions.key`.

### 6.2 Fields, challenged one at a time

- **`id`**: uuid, primary key.
- **`key`**: stable, machine-readable code, unique, **immutable after
  insert**, the same role `form_definitions.key` and
  `measurement_definitions.key` already play.
- **`name`**: current display label. **Editable**, cosmetic only.
- **`status`**: check (`active`, `deprecated`), **deprecate-only,
  one-way**, mirroring `measurement_definitions.status`
  (`docs/COMMERCIAL_DATABASE_DESIGN.md` §5.4): a Capability retired from
  future commercial use moves `active -> deprecated` and never back. A
  retired Capability remains fully valid on every historical
  `commercial_component_capabilities` row that already referenced it;
  deprecation blocks *future* selection, never past reference.
- **`row_version`**: integer, database-maintained. Justified in §10.
- `created_at`/`created_by`, `updated_at`/`updated_by`: standard columns.

**Considered and rejected**: `description` and `category`/`type` are not
added. Neither solves a concrete current need: no locked Commercial
requirement reads a Capability's description or category today, and
adding either now would be exactly the "might be useful someday" pattern
`docs/FORM_VERSIONING_MODEL.md` §12 already rejected for
`definition_hash`. Either can be added later, additively, with full
retroactive coverage, the moment a real consumer needs it. Also
rejected, per §3: pricing, SKU, package, entitlement rules, usage rules,
technical integration config, and process definitions; none of these is
required by the locked Commercial architecture, which references
Capability only as a scope member, never as a pricing or configuration
object in its own right.

### 6.3 Immutability

`id` and `key` are immutable from creation, unconditionally, the same
rule already applied to `measurement_definitions`' semantic fields
(`docs/COMMERCIAL_DATABASE_DESIGN.md` §5.4): a historical
`commercial_component_capabilities` row must continue to mean exactly
what it meant when it was created. `name` is cosmetic and freely
editable. `status` may only move `active -> deprecated`.

**If a Capability's actual business meaning materially changes** (not a
label rename, but what the capability itself fundamentally is or does),
the rule is: **create a new canonical Capability identity** (a new `key`,
a new `id`) and deprecate the old one, never edit the existing row's
semantic identity in place. This is the identical rule
`docs/COMMERCIAL_DATABASE_DESIGN.md` §5.4 already established for
Measurement Definition, applied here for the same reason: it protects
every historical Commercial Scope's interpretation from silently
drifting underneath it.

### 6.4 Resource Registry decision

**CAPABILITY RESOURCE-BACKED: NO.**

A Capability may be referenced heavily (by many
`commercial_component_capabilities` rows, and later by Entitlement,
Usage/Measurement mapping, forms, and reporting) but it never
independently needs workflow, tasks, comments, attachments, or scoped
authorization of its own; nothing approves or actions a Capability row
directly. This is pure reference/catalog data, the same category as
`measurement_definitions` and `form_definitions`, both also not
resource-backed. Being heavily referenced is not, by itself, a reason to
resource-back something; the Resource Registry test is whether the row
itself is ever independently actioned, and a Capability row never is.

### 6.5 Deletion / retention

No hard delete, ever, after creation. No `deleted_at`. `status =
'deprecated'` is the only retirement mechanism, matching
`measurement_definitions` exactly.

## 7. Resource Registry relationship

Neither `customers` nor `capabilities` registers in the Resource
Registry (§5.4, §6.4). Both use a plain `uuid` primary key, generated at
write time, with no dependency on `resources`/`resource_types`. This is
sufficient because neither table needs workflow, tasks, audit-as-a-
resource, comments, or attachments attached to it independently
(`docs/PLATFORM_ARCHITECTURE.md` §3: "reference and master data tables
that carry no workflow, audit, task, or event relationship do not
register in the Resource Registry"); both already get full row-level
`audit_log` coverage regardless, since Resource Registry participation
and audit coverage are two independent mechanisms
(`docs/DATA_ARCHITECTURE.md` §9: "`row_id` is always populated, so a
table that has not (yet) registered as a resource is still fully
audited"). No `resource_types` seed row is needed for either table.

## 8. Lifecycle and mutability

| Table | Immutable | Editable | Permitted transitions |
|---|---|---|---|
| `customers` | `id`, `key`, `created_at`, `created_by` | `name` | `is_active`: `true -> false` **and** `false -> true` (corrected by Finance, §5.2, §5.2a) |
| `capabilities` | `id`, `key`, `created_at`, `created_by` | `name` | `status`: `active -> deprecated`, one-way only |

Both tables need a lifecycle-protection trigger, the same generic
diff-and-reject idiom already used for `fn_protect_form_version_lifecycle`
and `fn_protect_access_grant` (`docs/DATA_ARCHITECTURE.md` §12,
`docs/FORM_VERSIONING_MODEL.md` §10): reject any `UPDATE` that changes an
immutable column, and reject any transition other than a permitted one.
For `customers`, both directions of `is_active` are permitted, so the
trigger's job is narrower than a one-way guard: it still rejects any
change to `id`/`key`/`created_at`/`created_by`, but does not restrict
`is_active` to one direction. For `capabilities`, `status` remains
strictly one-way (`active -> deprecated`), unchanged and deliberately
different from Customer (§6.3, §5.2a: Customer and Capability
intentionally have different lifecycle semantics). Historical
foreign-key references (from `commercial_configurations.customer_id` and
`commercial_component_capabilities.capability_id`, once those become real
FKs) continue to work forever regardless of the current value of
`is_active`/`status`, because neither table is ever hard-deleted and
neither lifecycle flag removes or hides the row, in either direction
(§5.5, §6.5).

## 9. Audit

Both tables use the standard, unmodified generic `fn_audit_row('id')`
trigger, the same conclusion already reached for
`form_definitions`, `commercial_configurations`, and
`measurement_definitions`: rows are small, writes are infrequent (a name
edit, or the single lifecycle transition), and there is no payload-size
concern that would justify a targeted, narrower audit trigger the way
`submission_revisions` needed one (`docs/SUBMISSION_DATA_CONTRACT.md`
§14). Semantic identity fields (`key`) are additionally protected by
their own dedicated immutability trigger (§8), independent of the audit
question; a rejected write produces no row mutation and therefore no
audit row, exactly as already established for `form_definitions.key`.

## 10. Concurrency

**`row_version` is used on both `customers` and `capabilities`, kept
unchanged from the prior pass and reinforced by this correction.** This
is decided from actual mutable editing, not habit: both tables have a
genuinely editable field (`customers.name`, `customers.is_active`;
`capabilities.name`) with more than one legitimate outcome if two admins
edit concurrently, and neither has a single conditional-WHERE transition
that could substitute for a version counter the way, for example,
`commercial_components`' one-time closure transition does. Reactivation
(`is_active: false -> true`) is now a second legitimate mutable state
transition on `customers`, not merely the single reversal
`docs/COMMERCIAL_DATABASE_DESIGN.md`'s comparable tables have; this
strengthens, rather than weakens, the case for `row_version` on
`customers`, since there are now two directions of a genuine
concurrent-edit race (two admins simultaneously toggling `is_active` in
either direction, or one toggling it while another edits `name`) instead
of one. This is the identical mechanism, and identical underlying
reasoning, already established for `commercial_configurations` and
`measurement_definitions` (`docs/COMMERCIAL_DATABASE_DESIGN.md` §9): a
small, low-frequency, admin-edited table can still have a real, if
infrequent, concurrent-edit risk, and `row_version` plus the existing
`fn_bump_row_version` infrastructure is the smallest correct,
already-proven mechanism to close it. No new concurrency mechanism is
invented.

## 11. Authorization / RLS boundary

No policies are designed or written here. Both tables follow the
existing Nexus foundation exactly (`docs/DATA_ARCHITECTURE.md` §12):
Row Level Security **enabled**, not forced, with **zero permissive
policies** at migration time; ordinary `anon`/`authenticated` default
privileges on the tables (and on any new trigger functions this stage's
eventual migration adds) are revoked, the same direct-privilege
hardening already applied to every current Platform Core object; the
trusted application-service/`service_role` path remains the only route
to these tables. No reason exists to differ from this default for
either table.

## 12. Retention

Both tables: no hard delete, ever, after creation; no `deleted_at`
column; the availability/lifecycle flag (`is_active` on `customers`,
reversible in both directions; `status` on `capabilities`, one-way) is
the only retirement mechanism (§5.5, §6.5). This is a stronger guarantee
than
`docs/DATA_ARCHITECTURE.md` §10's general soft-deletion default
(which still permits a `deleted_at` marker): neither master ever needs
even a soft-delete concept, because Finance and future Customer 360/
Commercial history must be able to reference either forever, and Finance
history already referencing these rows (once the Commercial migration
adds real FKs) is exactly the reason retention must be unconditional.

## 13. Form Data Source Resolver future boundary

**Not built here.** This document shows only the shape the future
resolver must support, without redesigning the already-locked
`docs/SUBMISSION_DATA_CONTRACT.md`.

```
SurveyJS field (master-data-backed, a logical data source such as
  "customer_master.customers" or "capability_master.capabilities")
    |
    v
Nexus Form Data Source Resolver (future, Stage 5B1C2, not built here)
    |
    v
Customer Master (customers) / Capability Master (capabilities)
    |
    v
stable canonical id + display label, as they exist at resolution time
```

At minimum, the future resolver must be able to return, for a given
logical reference and a given raw user selection, exactly the shape
`docs/SUBMISSION_DATA_CONTRACT.md` §5 already defined for `master_ref`:
a `canonical_id` (`customers.id` or `capabilities.id`) and a `snapshot`
(the display label(s) relevant at resolution time, for example `{ "name":
"..." }`), so a Submission Revision persists the canonical ID plus a
frozen display snapshot, never an arbitrary user-entered name and never a
live join to today's `customers.name`/`capabilities.name`. This is
exactly why `name` is editable on both masters (§5.2, §6.2) without
threatening historical evidence: historical submitted evidence reads its
own frozen `master_ref.snapshot`, never today's row, the same guarantee
`docs/FORM_VERSIONING_MODEL.md` §21 already established for
`form_versions.display_name` relative to `form_definitions.name`. This
document does not change, extend, or reopen the Submission Data Contract
itself; it only confirms that Customer Master and Capability Master are
the two concrete resolver targets that Contract's `master_ref` already
anticipated without yet having a real table to resolve against.

## 14. Relationship map

```
Customer (customers)
   |
   v
Commercial Configuration (commercial_configurations.customer_id,
  future real FK)

Commercial Configuration
   |
   v
Commercial Component (commercial_components.commercial_configuration_id)
   |
   v
Commercial Component Capability membership
  (commercial_component_capabilities: component_id, capability_id,
  future real FK on capability_id)
   |
   v
Capability (capabilities)

Future, conceptual only, not built here:
SurveyJS master-data-backed field
   |
   v
Form Data Source Resolver
   |
   v
Customer / Capability (canonical id + display snapshot, §13)
```

## 15. Proposed schema

**`customers`**

- Purpose: canonical Nexus Customer identity.
- PK: `id` (uuid).
- Important fields: `key` (unique, immutable), `name` (editable),
  `is_active` (reversible in both directions, corrected by Finance,
  §5.2), `row_version`.
- Resource-backed: No.
- Mutable: `name`, `is_active` (`true <-> false`, both directions),
  `row_version`, `updated_at`/`updated_by`.
- Immutable: `id`, `key`, `created_at`, `created_by`.
- Lifecycle: active, inactive, and back to active again, any number of
  times; never deleted; reactivation reuses the same `id`/`key` and
  every historical record already attached to it (§5.2a). Alternatively,
  a genuinely different canonical customer returning is represented by a
  new `customers` row, a business decision, not a database rule (§5.2a).
- Audit: generic `fn_audit_row('id')`; every activation, deactivation,
  and reactivation is captured by this same standard trigger, no special
  Customer lifecycle event table.
- Concurrency: `row_version` + `fn_bump_row_version`.
- Retention: no hard delete, no `deleted_at`; historical references
  remain valid regardless of the current `is_active` value.
- Constraints: `unique (key)`; `check` (none needed beyond NOT NULL/
  uniqueness; `is_active` is a plain boolean); lifecycle-protection
  trigger (key/id/created_at/created_by immutable; `is_active` may move
  in either direction, unlike `capabilities.status`).
- Indexes: `key` (unique index, already required for the constraint);
  `is_active` if a future "selectable customers" query pattern needs it
  (not added speculatively now).

**`capabilities`**

- Purpose: canonical Nexus Capability/Workflow identity.
- PK: `id` (uuid).
- Important fields: `key` (unique, immutable), `name` (editable),
  `status` (check `active`/`deprecated`, deprecate-only), `row_version`.
- Resource-backed: No.
- Mutable: `name`, `status` (one-way), `row_version`, `updated_at`/
  `updated_by`.
- Immutable: `id`, `key`, `created_at`, `created_by`.
- Lifecycle: active, then deprecated; never deleted.
- Audit: generic `fn_audit_row('id')`.
- Concurrency: `row_version` + `fn_bump_row_version`.
- Retention: no hard delete, no `deleted_at`.
- Constraints: `unique (key)`; `check (status in ('active','deprecated'))`;
  lifecycle-protection trigger (key immutable, `status` one-way).
- Indexes: `key` (unique index); `status` if a future "active
  capabilities only" selection list query pattern needs it (not added
  speculatively now).

Two tables. No third table is genuinely required: the many-to-many
membership between a Commercial Component and a Capability already
exists as `commercial_component_capabilities` in the locked Commercial
Database Design and needs no change here beyond its `capability_id`
becoming a real foreign key once `capabilities` exists.

## 16. Constraints

Later belongs in PostgreSQL, not written here:

- Foreign keys: `commercial_configurations.customer_id ->
  customers(id)` and `commercial_component_capabilities.capability_id ->
  capabilities(id)` become real, enforced foreign keys once these tables
  exist (the Commercial migration's own job, not this document's).
- `UNIQUE (key)` on both `customers` and `capabilities`.
- `CHECK (status in ('active','deprecated'))` on `capabilities`.
- A lifecycle-protection trigger per table, rejecting any change to
  `key`/`id`/`created_at`/`created_by` on both tables; on `capabilities`,
  additionally rejecting any `status` transition other than the one
  permitted one-way move (`active -> deprecated`); on `customers`,
  `is_active` is permitted to move in either direction (corrected by
  Finance, §5.2), so the trigger does not restrict its direction, only
  the identity columns.
- A `row_version`-bump trigger (`fn_bump_row_version`, reused unchanged)
  on both tables.
- No resource-type-integrity trigger on either table (neither is
  resource-backed, §7).

Application-layer, kept separate: whether a proposed `name` value is
sensible (no database concern); any future duplicate-detection heuristic
(§5.3, explicitly deferred); any future admin-screen validation for
`key` formatting conventions.

## 17. Indexes

`customers`: unique index on `key` (required by the constraint); no
other index added speculatively. `capabilities`: unique index on `key`;
no other index added speculatively. Every foreign key referencing either
table (added later, by the Commercial migration) is indexed by that
migration's own standard, per `docs/DATA_ARCHITECTURE.md` §5.

## 18. Break-test results

1. **Two customers can have the same display name without identity
   collision.** Confirmed: only `key` is unique; `name` carries no
   uniqueness constraint (§5.2, §5.3).
2. **One customer can have several Commercial Configurations.**
   Confirmed: `customers.id` has no cardinality constraint against
   `commercial_configurations.customer_id`; nothing here changes the
   already-locked one-to-many relationship (§5.1, §14).
3. **Customer display name changes without breaking historical
   references.** Confirmed: `name` is a live catalog label; a Submission
   Revision's `master_ref.snapshot` (§13) or a Commercial Configuration's
   own row already captures what was true at the relevant time,
   independent of today's `customers.name`.
4. **Customer can move `active -> inactive -> active` without a new ID,
   without a broken historical FK, and without a changed `key`.**
   Confirmed, corrected this pass: `is_active` may move `true -> false`
   and `false -> true` on the same row (§5.2); `id` and `key` are
   immutable regardless of how many times `is_active` moves in either
   direction (§8); every historical reference (a Commercial
   Configuration, a future domain record) that already pointed at this
   Customer's `id` continues to resolve correctly through reactivation,
   since the row is never deleted and never recreated (§5.5). A returning
   customer may alternatively be represented as a **new** `customers` row
   instead of a reactivation, when the business genuinely considers it a
   different canonical customer; that choice is a business decision, not
   a database rule, and this document does not automate it (§5.2a).
5. **One Capability can be referenced by many Commercial Components.**
   Confirmed: `commercial_component_capabilities` is already a
   many-to-many join in the locked Commercial Database Design; nothing
   here constrains how many components may reference one Capability.
6. **One Commercial Component can reference several Capabilities.**
   Confirmed: the same join table already supports this (`Scope = {SFA,
   DMS}` is the exact worked example already locked,
   `docs/COMMERCIAL_DATABASE_DESIGN.md` §5.2, §18).
7. **Capability display name changes without breaking history.**
   Confirmed: `name` is cosmetic and editable; `key`/`id` (what
   `commercial_component_capabilities` actually references) never change
   (§6.2, §6.3).
8. **Retired Capability remains valid on historical Commercial
   Components.** Confirmed: `status = 'deprecated'` blocks future
   selection only; the row is never deleted, and no foreign key
   constraint depends on `status` (§6.5).
9. **Semantic Capability change cannot silently redefine historical
   scope.** Confirmed: semantic fields are immutable by trigger; a
   genuine meaning change requires a new Capability identity, mirroring
   Measurement Definition's identical rule (§6.3).
10. **Future Form Resolver can return canonical IDs and labels.**
    Confirmed: both tables expose exactly `id`/`key` (stable) and
    `name` (current label), the two inputs `master_ref.canonical_id`/
    `snapshot` already needs (§13).
11. **Future Customer 360 can grow around Customer without altering
    Customer core.** Confirmed: no Customer 360 field is added to
    `customers`; every future domain (Legal, Collections, Usage,
    Entitlements, Suspension/Disconnection, Churn) is its own
    domain-owned record referencing `customers.id`, never a column added
    to this table (§5.4, §21).
12. **Commercial migration can add real FKs without placeholder UUID
    references.** Confirmed: once `customers` and `capabilities` exist,
    `commercial_configurations.customer_id` and
    `commercial_component_capabilities.capability_id` become ordinary,
    database-enforced foreign keys, closing the exact gap
    `docs/COMMERCIAL_DATABASE_DESIGN.md` §23 identified.

No break attempt succeeded; no revision to this design was required.

## 19. Dependencies on Commercial

The locked Commercial Database Design is not modified by this document.
Once `customers` and `capabilities` exist, the Commercial migration (a
separate, later, not-yet-started stage) is expected to add two ordinary
foreign-key constraints, `commercial_configurations.customer_id ->
customers(id)` and `commercial_component_capabilities.capability_id ->
capabilities(id)`, replacing the currently-unenforced references. No
other change to the Commercial Database Design is implied or required by
this document.

## 20. Remaining questions

None require Finance business input. The one open question this pass
was asked to resolve, Customer lifecycle reversibility, is now resolved
by Finance's correction (§5.2, §5.2a): `is_active` is reversible, and
the new-versus-returning-customer identity choice is explicitly left to
future business judgment, not invented as a database rule. Every other
field, lifecycle rule, and boundary decision above follows directly from
an already-locked Commercial need or an already-established Nexus
platform pattern, per §28's instruction to default to keeping optional
future metadata out rather than asking Finance to define it now. No new
business question is invented merely because a future Customer 360 might
need more data (§21). Genuinely deferred, non-blocking implementation
detail (not a design gap): the exact PL/pgSQL bodies for both
lifecycle-protection triggers, the exact `fn_bump_row_version`
attachment, RLS policy authoring itself (§11, deliberately zero policies
at this stage), and the future duplicate/merge/customer-identity
resolution capability (§5.3, §5.2a, explicitly deferred) all follow
already-proven patterns or are named only so a later stage does not have
to rediscover them; none blocks locking this document.

## 21. Preserving future Customer 360 and Capability expansion

**Customer 360.** The correct architecture is `Customer identity ->
domain-owned records elsewhere`, never one growing `customers` table
holding every future business fact. Commercial, Legal, Go Live,
Collections, Usage, Entitlements, Suspension/Disconnection, and Churn
each anchor to `customers.id` from their own future table, the same
pattern Commercial Configuration already uses today. No field for any of
these domains is added to `customers` now (§3, §5.2); adding one later
never requires altering this table's core shape, only adding a new
foreign key elsewhere pointing back at it.

**Capability expansion.** `capabilities.id` is already exactly what
Commercial Scope, a future Entitlement grant, a future Usage/Measurement
mapping, a form's master-data-backed field, and future reporting can all
reference, without turning the `capabilities` row itself into
configuration storage: each of those consumers stores its own reference
to `capabilities.id` in its own table, never a new column on
`capabilities` describing that consumer's own concern (§6.2's rejected
list: pricing, entitlement rules, usage rules, technical integration
config, and process definitions all stay out of this table for exactly
this reason).

## What this document is not

Not a migration file itself, not a decision on Commercial pricing,
usage, entitlement, Customer 360, CRM, a Product Catalog, or workflow
configuration. Not a redesign of `docs/SUBMISSION_DATA_CONTRACT.md`,
`docs/FORM_VERSIONING_MODEL.md`, or `docs/COMMERCIAL_DATABASE_DESIGN.md`;
none of those documents is modified. Every schema shape above has since
been translated into SQL and applied
(`supabase/migrations/20260908013210_master_data_foundation.sql`,
execution evidence in `docs/MASTER_DATA_FOUNDATION_MIGRATION_DESIGN.md`);
this document remains the design-level record of *why* each decision was
made, not a log of that execution.
