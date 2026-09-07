# Nexus: Form Versioning Model

This document designs what Nexus means by Form Definition, Form Version,
and the version lifecycle, before any database table for it exists. It
extends `docs/PLATFORM_ARCHITECTURE.md`, `docs/DATA_ARCHITECTURE.md`, and
`docs/AUTHORIZATION_MODEL.md`; nothing here overrides those documents.

**Status: revised proposed design, not yet locked.** This is Stage
5B1B1: an architecture/design step only. No migration, no Supabase
change, no submission persistence, no Commercial Master, no Form Data
Source Resolver, and no application code exist because of this document.
Every example is generic and fictional; no real Nexus form, field, or
business rule is named here.

This is the third revision. The first draft established the core model.
The second resolved how the required atomic operations actually fit
Nexus's current database-access architecture, recommending single
database functions (RPCs) over a held-open application-service
transaction, since Nexus has no database client library installed at all
today. This third revision closes the remaining hardening gaps that
recommendation exposed: binding publication to the exact draft state that
was validated, ordinary draft-edit concurrency, a right-sized audit
strategy for draft-stage edits, resource-creation atomicity, resource-type
structural metadata, the RPC security boundary, and controlled error
semantics.

## 1. Where this sits in the accepted architecture

SurveyJS (Stage 5B1A) remains the form rendering and interaction engine
only. Nexus owns form identity, form lifecycle, form versions,
publication, historical linkage, authorization, submission lifecycle, and
canonical Finance data. SurveyJS must never become the system of record
for business-process state or canonical Finance facts.

A SurveyJS form definition is a JSON document because it is
**configuration**: its shape legitimately varies by form and is consumed
by a renderer and a rules engine, not joined on field by field. That is
exactly the exception `docs/DATA_ARCHITECTURE.md` §1 describes for using
JSON at all. It is not a precedent for storing actual Finance business
data (amounts, entities, decisions) as JSONB; that data remains
relationally modeled, per the same principle, regardless of which form
collected it. This document designs how Nexus stores and governs the
*configuration*; it does not touch how Finance facts collected through a
form get stored, which is Stage 5B1C's Form Data Contract.

## 2. Terminology

| Term | Meaning |
|---|---|
| Form Definition | The stable, long-lived Nexus identity for a *type* of form (e.g. "a Revenue Addition Request form exists"). Survives across every version. |
| Form Version | One exact, eventually-immutable definition of how that form behaved: its SurveyJS JSON plus lifecycle metadata. |
| Draft version | A Form Version being authored or edited. Not selectable for new business submissions. |
| Published version | The one Form Version currently offered for new submissions of that Form Definition. |
| Retired version | A Form Version no longer offered for new submissions, permanently retained for historical rendering. |
| Abandoned version | A draft that was deliberately ended without ever publishing, permanently retained as a terminal, frozen record. |
| Logical data source | A named reference (e.g. `commercial_master.modules`) a form field points at, resolved later by a Form Data Source Resolver, never a physical query embedded in the form. |
| Row version | A per-row optimistic-concurrency counter (§9) used to detect a stale read before a write, distinct from `version_number`, which is the human-facing Form Version number. |

A Form Definition is **not** one submitted request, SurveyJS response
data, workflow state, or approval state. Those are Stage 5B1C and later
concerns.

## 3. Form Definition

Minimum structural metadata, kept deliberately thin, the same discipline
already applied to the Resource Registry itself
(`docs/PLATFORM_ARCHITECTURE.md` §3):

- `id` - stable UUID identity.
- `key` - a stable, machine-readable code (e.g.
  `revenue_addition_request`), used where code or configuration needs to
  name a form type without a UUID literal. Set once, database-enforced
  immutable (§10); a form's user-facing name can change without changing
  what it *is*.
- `name` - the current display name. Editable; it is a catalog label, not
  a captured Finance fact. See §5 for why an old submission does not use
  this column.
- `description` - optional, editable.
- `created_at` / `created_by`, `updated_at` / `updated_by` - standard
  columns (`docs/DATA_ARCHITECTURE.md` §3).

No lifecycle status is added to Form Definition itself. Whether a form
*type* is currently offered is already fully derived from whether it has
a currently published version (§7); a Form Definition with zero published
versions is implicitly unavailable for new submissions without needing a
second, independently-maintained flag that could drift out of sync with
version state. Retiring an entire form *type* (not just a version) is
recorded as a deferred decision (§26), not solved here.

Rejected additions: a lifecycle/status column (redundant with version
state, above); a category/grouping column (no real consumer yet); an
owning-team column (an authorization concern, `docs/AUTHORIZATION_MODEL.md`,
not a forms-registry concern).

**Deletion, decided at Stage 5B1B2 final review (previously
unresolved).** A Form Definition that already has any Form Version can
never be hard-deleted: `form_versions.form_definition_id` references it
`ON DELETE RESTRICT`, so the database rejects the delete outright the
moment a version exists, with no separate trigger needed to express
that. A brand-new Form Definition with zero versions may be hard-deleted;
nothing has been built on it yet, so there is no history to protect. This
is the simplest defensible rule: it needs no new lifecycle concept, no
soft-delete column, and falls directly out of the foreign key already
required for a different reason (§13).

## 4. Form Version

- `id` - stable UUID identity. See §14 for the recommendation that this
  table be resource-backed.
- `form_definition_id` - which Form Definition this is a version of.
  Never changes after insert (§10).
- `version_number` - integer, monotonic per `form_definition_id`, human
  readable (1, 2, 3...). Never renamed or renumbered, never changes
  after insert. See §8 for concurrency-safe assignment.
- `status` - `draft` / `published` / `retired` / `abandoned`. See §6.
- `row_version` - integer, starting at 1, incremented on every write to
  the row, entirely database-maintained. This is the optimistic-
  concurrency token used to bind a draft-save or a publish to the exact
  row state that was read (§9, §11). Never set directly by a caller; a
  caller only ever supplies back a value it previously read.
- `display_name` - the historical, version-specific display name, seeded
  from `form_definitions.name` at draft creation and freely editable
  until publication. See §5.
- `definition_json` - the SurveyJS form schema. JSONB, for the reason
  given in §1.
- `survey_js_version` - the SurveyJS Form Library/runtime version this
  Form Version was authored/published against, e.g. `3.0.3`. Recorded
  purely as diagnostic/compatibility context: it does not obligate Nexus
  to keep executing that exact historical npm package version forever,
  it only lets someone later recognize *why* an old schema might render
  or behave differently under whatever runtime is current at that time,
  rather than that difference going unexplained. See §24 (Case D).
- `change_summary` - human-authored note on why this version was
  created. Required before publication once `version_number > 1` (§15);
  optional otherwise. Narrative context alongside the audit strategy
  (§19), not a replacement for it.
- `created_at` / `created_by` - when the draft was started. Never
  changes after insert.
- `updated_at` / `updated_by` - bumped only by a legitimately allowed
  mutation for the row's current lifecycle state (§9); mirrors
  `row_version` exactly (both change together, on the same writes).
- `published_at` / `published_by` - null until published, populated
  exactly once, in the same transaction that sets `status = 'published'`.
- `retired_at` / `retired_by` - null unless retired, populated exactly
  once, in the same transaction that sets `status = 'retired'`.
- `abandoned_at` / `abandoned_by` - null unless abandoned, populated
  exactly once, in the same transaction that sets `status = 'abandoned'`.

**Removed from this schema: `definition_hash`.** See §12 for the
reassessment; it is not carried into the candidate shape (§27). `row_version`
is not a substitute for it and is not being reintroduced as one: it exists
purely to detect a stale read before a write, not to fingerprint content
for an external consumer, which is what `definition_hash` would have been
for.

**Rejected: `supersedes_version_id`.** Which version a given version
replaced is already fully derivable from `(form_definition_id,
version_number)` ordering combined with `retired_at`; storing it again as
a separate foreign key would duplicate state that can drift from the
truth it is supposed to describe, for no query benefit worth the risk.

## 5. Historical display name

`form_definitions.name` is a current catalog label, editable at any
time, because a form's *type* legitimately gets renamed as the business
vocabulary evolves. But an old submission must never silently start
displaying today's renamed label; the user who completed it saw a
specific title, and that is part of what "reconstruct exactly what an old
approver saw" means.

This is why `form_versions.display_name` exists as its own column,
separate from `form_definitions.name`, and why it is not derived by
parsing `definition_json`: Nexus's historical form title is Nexus's own
metadata about the version, not something that should depend on how
SurveyJS happens to structure its own internal `title` property (which
may or may not exist, and which exists for SurveyJS's own rendering
purposes, not Nexus's historical-record purposes).

Naming choice: `display_name`, not `title`. `title` risks being confused
with `definition_json`'s own internal SurveyJS `title` field (the
in-form heading SurveyJS renders); `display_name` is unambiguous as "the
Nexus-level historical label for this version," independent of anything
SurveyJS itself contains.

Behavior: a new draft's `display_name` starts as a copy of the current
`form_definitions.name` at draft-creation time (§16), then can be edited
freely as part of authoring that draft, independent of whether
`form_definitions.name` changes again in the meantime. Once published,
`display_name` is frozen with the rest of the version (§9).

Worked example: `form_definitions.name` is "Revenue Addition Request"
when v1 is published, so v1's `display_name` is "Revenue Addition
Request." Two years later, `form_definitions.name` is renamed to
"Revenue Change Request." A submission created under v1 still renders
using v1's frozen `display_name`, "Revenue Addition Request," regardless
of what `form_definitions.name` says today (Case J, §24).

## 6. Lifecycle

```
DRAFT -----------> PUBLISHED -----------> RETIRED
  |
  +---------------> ABANDONED
```

Four real lifecycle statuses, each a terminus or a step, with the
invariants below. No transition out of `RETIRED` or `ABANDONED`. No
transition from `PUBLISHED` back to `DRAFT`. No transition from
`ABANDONED` to `DRAFT`. No hard delete of a Form Version, ever, in any
status.

| Status | Lifecycle metadata | Content | Notes |
|---|---|---|---|
| `DRAFT` | `published_at/by`, `retired_at/by`, `abandoned_at/by` all null | Editable | Previewable/testable; never selectable for a real business submission. |
| `PUBLISHED` | `published_at/by` populated; `retired_at/by`, `abandoned_at/by` null | Immutable | Usable for new submissions; exactly one per Form Definition (§7). |
| `RETIRED` | `published_at/by` populated; `retired_at/by` populated; `abandoned_at/by` null | Immutable | No longer offered for new submissions; permanently retained for historical rendering. |
| `ABANDONED` | `abandoned_at/by` populated; `published_at/by`, `retired_at/by` null | Immutable | Never published; permanently retained as a frozen record of what was abandoned. |

This directly revises the first draft of this document, which used
`abandoned_at` as a marker on a row that still reported `status =
'draft'`. That created two sources of lifecycle truth: the `status`
column said one thing, an ignorable-looking timestamp said another.
`status` should answer the lifecycle question by itself, in one place,
so `ABANDONED` is a real status.

## 7. Exactly one active published version

Nexus should enforce: for one Form Definition, at most one version may
have `status = 'published'` at a time. This should ultimately be
database-enforced, not merely checked in the application service, the
same preference for database-level guarantees already established for
audit (`docs/DATA_ARCHITECTURE.md` §9) and for grant uniqueness
(`docs/DATA_ARCHITECTURE.md` §13). A partial unique index scoped to
`WHERE status = 'published'` enforces "at most one," while allowing
zero: a Form Definition may legitimately exist with only a draft and no
published version yet, while it is still being configured.

Likewise, at most one version may have `status = 'draft'` at a time per
Form Definition (§16); a partial unique index scoped to `WHERE status =
'draft'` enforces this. Because `ABANDONED` is its own status (§6), this
index does not need an `AND abandoned_at IS NULL` clause: an abandoned
draft is no longer `status = 'draft'` at all, so it simply falls outside
the index's scope the moment it is abandoned, the same as it falls
outside by being published.

## 8. Version-number assignment

`version_number` is a plain integer, monotonic per `form_definition_id`,
assigned once at draft creation and never changed again. Version numbers
are never renamed or renumbered, including around an abandoned draft: if
version 4 is abandoned, the next new draft becomes version 5, not a
reused 4 (Case H, §24). The first draft of this document under-specified
assignment as a bare `max(version_number) + 1`, which is unsafe under
concurrency: two concurrent draft-creation attempts for the same Form
Definition could both read the same current maximum and both compute the
same "next" number, racing to insert it. How this is actually made safe
is §9's subject; no per-form sequence or `next_version_number` counter
column is introduced regardless of mechanism, since recomputing the
maximum under a lock is simple enough and avoids a second piece of state
that could itself drift from the truth.

## 9. Transaction boundary: how Nexus can actually make this atomic

**What Nexus currently has, established by inspecting the actual
repository.** No database access library is installed or used anywhere
in `src/` today: no `supabase-js`/`@supabase/supabase-js`, no direct
PostgreSQL driver (`pg`, `postgres.js`), no ORM/query builder (Prisma,
Drizzle, Kysely). `docs/PLATFORM_ARCHITECTURE.md` §2 describes a
"repositories / data access" layer conceptually ("the only code that
talks to the database for a given entity"), but no concrete repository
implementation exists yet, and no document commits that layer to a
specific client library. `docs/DATA_ARCHITECTURE.md` §12 confirms only
that a trusted server-side path (`service_role`) exists and bypasses RLS;
it does not say how the application server reaches Postgres through that
path. This is a genuinely open question, not a settled one this document
can quietly assume an answer to.

**Why this matters.** Creating a new draft and publishing a draft each
need several statements (a row lock, one or more reads, one or more
writes) to execute as a single real PostgreSQL transaction. If Nexus's
eventual repository layer talks to Supabase the way Supabase's own client
libraries are designed to be used, `supabase-js` calling PostgREST, each
call is its own independent HTTP request, and PostgREST executes each
request as its own transaction. There is no supported way to `BEGIN` on
one `supabase-js` call, do a `SELECT ... FOR UPDATE`, and `COMMIT` on a
later, separate call: nothing guarantees the calls even reach the same
database session, and PostgREST does not expose multi-request transaction
control at all. **This document does not assume a multi-statement
application-service transaction can be held open across ordinary
`supabase-js`/PostgREST calls, because it cannot.** Concretely believing
otherwise would produce exactly the unsafe `max() + 1` race §8 describes.

**Recommended approach: Option B, a single database function (RPC) per
atomic operation.** `create_form_version(...)` and
`publish_form_version(...)` should each be one `plpgsql` function,
invoked through a single call (`supabase.rpc(...)` or whatever the
eventual repository mechanism turns out to be). A single function
invocation runs as one implicit PostgreSQL transaction by default: the
row lock, the reads, and the writes all happen inside that one call, with
no multi-request boundary to fail across, and no new client library
required to get it. `UNIQUE (form_definition_id, version_number)` and the
partial unique indexes (§7) remain in the schema regardless, as the final
integrity backstop if a function's own logic ever had a bug.

The application service still owns everything upstream of that one call:
authorization, publication validation (§15), business intent, audit
context, and deciding *when* the operation is even attempted. The
database function owns only the atomic persistence transition itself,
nothing more; it is not where business rules live, and it is not
reachable by anything except the repository. This preserves the layering
in `docs/PLATFORM_ARCHITECTURE.md` §2 exactly: `UI -> application service
-> domain -> repository -> database`. A browser never calls the function
directly; the repository is the only code that does. **A database
function must never become the business API**; it is an implementation
detail one layer below the repository boundary, swappable later without
anything above it noticing, exactly like any other repository internal.

**Why not Option A (a direct PostgreSQL driver/connection).** This would
also provide a genuine multi-statement transaction, but it introduces a
second database-access pathway alongside whatever the eventual
Supabase-based repository mechanism turns out to be, a real architectural
addition this document is not the place to decide, and it requires
installing a new dependency. If Nexus's repository layer is later built
around a direct driver connection project-wide, for reasons unrelated to
Form Versions, Option A would then naturally supersede this
recommendation for these two operations as well; that is not a decision
to make now.

**Why not Option C.** No other repository mechanism currently exists
beyond the conceptual layering description in
`docs/PLATFORM_ARCHITECTURE.md` §2, so there is no third concrete
alternative to evaluate today; Option C is not presently available, not
rejected on its merits.

**`create_form_version(form_definition_id, ...)` function body,
conceptually:**

1. Lock the relevant `form_definitions` row (`SELECT ... FOR UPDATE`).
2. Confirm no active (`status = 'draft'`) version already exists for it;
   if one does, return a controlled `ACTIVE_DRAFT_EXISTS` conflict (§22).
3. Compute `next = MAX(version_number) + 1` (or `1` if none exist) for
   this `form_definition_id`.
4. Insert a new `resources` row (`resource_type = 'form_version'`, §14)
   and, using that same `id`, insert the new `form_versions` row with
   `status = 'draft'`, the computed `version_number`, `row_version = 1`,
   and content copied forward (§16) from the currently published (or
   latest) version.
5. Return the new draft.

Steps 4's two inserts happen inside the same function call, hence the
same transaction, as everything else; see §14 for why this specifically
matters for resource-registry integrity.

## 10. Published immutability, state by state

Once a Form Version leaves `DRAFT`, its content is frozen, permanently.
This is stated per-transition, not as a blanket rule, because the first
draft of this document was too coarse ("published/retired rows can
modify status/retired fields") to actually specify what happens on each
transition:

- **`DRAFT` may:** change any editable definition field
  (`display_name`, `definition_json`, `survey_js_version`,
  `change_summary`), incrementing `row_version` and `updated_at` on every
  such write (§11); transition to `PUBLISHED`; transition to
  `ABANDONED`.
- **`PUBLISHED` may only:** transition to `RETIRED`, populating
  `retired_at`/`retired_by` as part of that same transition. Nothing
  else about the row changes.
- **`RETIRED`:** no further transitions, no business-field updates, ever.
- **`ABANDONED`:** no further transitions, no business-field updates,
  ever. The abandoned artifact's content is frozen exactly like a
  published one's, so it faithfully preserves what was actually
  abandoned, not a moving target.

**These columns never change after insert, regardless of lifecycle
status:** `id` (`= resource_id`, §14), `form_definition_id`,
`version_number`, `created_at`, `created_by`.

**`updated_at` only ever reflects a legitimately allowed mutation** for
the row's current status (a draft edit, or the one permitted transition
out of that status); it is never bumped as a side effect of an
otherwise-rejected write, because the trigger described below rejects
the write outright before any column, including `updated_at` and
`row_version`, is touched.

Recommend enforcing all of the above at both layers: the
application-service layer refuses to offer an "edit" action against
anything but a `draft`, as the first line of defense; a database trigger
is the layer that actually holds even if that application-level check is
ever missed or bypassed, the same generic diff-and-reject pattern already
used for `fn_protect_access_grant()` on `user_roles`/`role_permissions`
(`docs/DATA_ARCHITECTURE.md` §12): it diffs `OLD` against `NEW` and
raises unless the change matches one of the explicitly permitted
transitions above.

**Form Definition key immutability.** The same style of protection
applies to `form_definitions.key` (§3): once set, it must never change,
at the database level, not merely by convention. `name` and
`description` remain freely editable; only `key`, the machine identifier
other code and configuration may come to depend on, is protected. **The
migration that creates `form_definitions` should include a `BEFORE
UPDATE` trigger that rejects any write changing `key`.** No SQL is
written in this document; this is a requirement for that future migration
to satisfy, not an implementation of it.

## 11. Binding a write to the exact row state that was read

Two related races both need the same fix, an optimistic-concurrency
precondition using `row_version` (§4):

**Publication validation binding.** Consider: Admin A reads draft v6 and
Nexus validates its SurveyJS definition (§15). Admin B then edits draft
v6. Admin A then publishes. A `publish_form_version` that simply locks
the Form Definition row and publishes v6's *current* contents would
publish a definition different from the one that was actually validated,
silently. **That must never be possible; Nexus may publish only the
exact draft state that successfully passed publication validation.**

**Draft-edit concurrency.** Separately, two admins can simply both open
the same active draft. This document does not build collaborative
editing; it uses the same optimistic-concurrency model to prevent a
silent last-write-wins on a Form Definition's JSON document: Admin A
loads the draft at `row_version = 3`, Admin B loads it at `row_version =
3` too. Admin A saves; it succeeds, `row_version` becomes `4`. Admin B
then attempts to save using `expected_row_version = 3`; because the row
is now at `4`, this must be rejected as a controlled conflict ("this
draft changed since you loaded it; reload and reconcile"), not silently
applied over Admin A's change.

**Recommended mechanism, covering both.** The application service always
carries forward the `row_version` it most recently read for a given Form
Version, and every write it asks the repository to make against that row
supplies that value back as an `expected_row_version` precondition:

- **Ordinary draft-content saves** do not need a database function at
  all, unlike the two lifecycle operations (§9): a single conditional
  statement, `UPDATE form_versions SET definition_json = ..., row_version
  = row_version + 1, updated_at = now(), updated_by = ... WHERE id = ?
  AND status = 'draft' AND row_version = ? RETURNING *`, is already one
  atomic statement, and a single statement is exactly what an ordinary
  `supabase-js` call already executes atomically; no multi-request
  transaction problem exists here because there is only one request. If
  zero rows come back, the repository cannot yet tell, from the row count
  alone, whether that was because `row_version` did not match (someone
  else edited it) or because `status` was no longer `'draft'` (someone
  published, retired, or abandoned it); a follow-up read disambiguates
  which controlled error to surface (`DRAFT_CHANGED` vs
  `VERSION_NOT_DRAFT`, §22). Exact query and disambiguation logic is not
  designed further here.
- **`publish_form_version(form_version_id, expected_row_version, ...)`**
  extends the steps in §9 with the binding check:
  1. Lock the relevant `form_definitions` row.
  2. Lock/read the candidate `form_versions` row.
  3. Verify `candidate.status = 'draft'`; if not, return
     `VERSION_NOT_DRAFT`.
  4. Verify `candidate.row_version = expected_row_version` exactly; if
     not, return `DRAFT_CHANGED` ("this draft changed since it was
     validated; reload and validate again").
  5. Retire the currently `published` version, if one exists.
  6. Publish the candidate.
  7. Return.

**Is `updated_at` a safe-enough token instead of a dedicated
`row_version`?** No, and this document does not use it as one, for two
reasons. First, `docs/DATA_ARCHITECTURE.md` §5 already establishes
Nexus's concurrency-token convention: "tables that participate in a
workflow carry an integer `version` column, incremented on every write...
rather than silently overwriting a newer change." A `timestamptz` column
does not carry the same guarantee: nothing about `updated_at`'s semantics
mechanically prevents two different writes to the same row from
producing the same value (`now()` is wall-clock time, not a
database-enforced strictly-increasing sequence for that row), whereas an
explicitly incremented integer counter cannot repeat a value for the same
row by construction. Second, reusing the established `version`-style
integer pattern here is the minimum addition genuinely necessary to close
this gap; it is one small integer column plus the same kind of trigger
this document already recommends elsewhere, not a reason to bring back
`definition_hash` (§12), which would solve a different problem
(content fingerprinting for an external consumer) that is not the one
this section has.

## 12. Reassessing `definition_hash`

The first draft of this document included a `definition_hash` column
(a content hash of `definition_json`) on the reasoning that hashes
"sound audit-friendly." Challenged here: published and retired Form
Versions are already immutable (§10, database-enforced) and already
covered by the audit strategy (§19). Given that, a hash adds nothing an
auditor cannot already get by reading the immutable row itself; its only
genuine value would be binding an *external* record (an approval system,
a compliance seal, an integration) to an exact content digest independent
of reading Nexus's own database, and no such concrete external consumer
exists yet.

**Recommendation: remove `definition_hash` from the first schema.** An
immutable definition can have a hash derived from it later, at zero
migration cost and with full retroactive coverage for every version
already stored, exactly when a real external consumer needs one. Keeping
a column now, before anything reads it, is exactly the kind of "might be
useful someday" addition this design has otherwise avoided.

## 13. The mandatory submission relationship

Although the submission table itself belongs to Stage 5B1C, one
relationship is mandatory and is recorded here because it is what makes
everything above possible:

> Every real Nexus form submission or draft must reference the exact
> `form_version_id` it was created against, never merely a
> `form_definition_id`.

Without this, "which exact rules produced this data" becomes
unreconstructable the moment a second version is ever published.

## 14. Should Form Definition or Form Version be resource-backed?

**Recommendation: `form_versions` should be resource-backed (its `id`
reuses `resource_id`, registering `resource_type = 'form_version'` in
`resource_types` when this is implemented). `form_definitions` should
not be.**

A Form Version, once published, is the exact controlled artifact users
actually completed a real business submission against. It is precisely
the kind of record the Resource Registry exists for
(`docs/PLATFORM_ARCHITECTURE.md` §3): it plausibly needs a publication
approval trail later (`docs/PLATFORM_ARCHITECTURE.md` §6, segregation of
duties), plausibly needs a reviewer to comment on or attach a spec
document to a specific version, plausibly needs to be referenced from a
future workflow or task, plausibly needs a uniform API shape, and
plausibly needs its own scoped authorization context. All of those are
naturally version-scoped, not definition-scoped. Minting the resource ID
now costs nothing structurally (it is only the choice of primary key at
table-creation time) and avoids a much more painful retrofit later, the
same "evidence anchor" reasoning `docs/PLATFORM_ARCHITECTURE.md` §3
already applies elsewhere.

`form_definitions`, by contrast, is closer to a stable catalog/registry
row: it changes rarely, is edited by admins, and none of the plausible
future capabilities above are naturally definition-scoped rather than
version-scoped. It does not join the Resource Registry, and relies on the
same generic row-level `audit_log` coverage every table gets regardless
of Resource Registry membership.

**Deferred note:** if Nexus later requires authorization explicitly
scoped to individual Form Definitions (not just individual versions),
reconsider whether Form Definition should become resource-backed at that
point. That hypothetical requirement is not solved now; nothing about
today's design blocks making that change later; `form_definitions` would
simply need to add a `resource_id` reference of its own if that day
comes, without disturbing `form_versions`.

This remains a recommendation for review, not a foregone conclusion.

### Resource type integrity

`form_versions` will be the first real feature table to reuse a Resource
Registry ID as its own primary key. That raises a question the Resource
Registry pattern itself does not automatically answer: a plain foreign
key from `form_versions.id` to `resources(resource_id)` only proves the
referenced `resources` row exists, not that its `resource_type` column
actually equals `'form_version'`. Nothing stops a bug (or a future
resource-backed table's insert path) from minting a resource row typed
`'work_item'` and a `form_versions` row that reuses that same UUID; the
foreign key alone is satisfied either way. A plain `CHECK` constraint
cannot close this gap either: PostgreSQL `CHECK` constraints cannot
contain a subquery against another table, so the type match cannot be
expressed there at all. A trigger is the only mechanism that can actually
assert it.

**Recommendation: a reusable, generic trigger, not a Form-Version-specific
one**, following the exact idiom this codebase already uses for
`fn_audit_row(pk_column_name)` (a generic trigger parameterized by a
trigger argument so one function serves every table). A single
`fn_assert_resource_type(expected_type)`-style function, attached
`BEFORE INSERT OR UPDATE OF id` (or `resource_id`, whatever the column is
named) on any resource-backed table, would look up `resources.resource_type
FOR (NEW.id)` and raise unless it equals the `expected_type` argument the
table's own migration supplied (e.g. `fn_assert_resource_type('form_version')`
on `form_versions`). This is designed once, generically, and every future
resource-backed table reuses it by supplying its own expected type as a
trigger argument, the same way every audited table already reuses
`fn_audit_row` by supplying its own primary-key column name. It is not
implemented in this document; it is recorded here as the pattern the
implementing migration should follow, because `form_versions` is the
first table this pattern needs to exist for, but is very much not
expected to be the last. This trigger is a defense-in-depth backstop
beneath the correct-by-construction insert order described next; it
catches a bug, it is not the thing relied on to prevent one.

### Resource creation atomicity

Because `form_versions.id` must reuse a `resources.resource_id`,
`create_form_version` (§9) must create both rows atomically: there must
never be a `form_versions` row without a matching `resources` row (the
foreign key already prevents this structurally), and, just as important,
there must never be an orphan `resources` row typed `'form_version'`
left behind by a version-creation attempt that inserted the resource but
then failed before inserting the `form_versions` row. Because the entire
operation is one function call, and therefore one PostgreSQL transaction
(§9), this is guaranteed by construction: the `resources` insert and the
`form_versions` insert either both commit or both roll back together;
there is no intermediate state a concurrent reader could observe. The
function's own insert order (`resources` first, capturing the new `id`,
then `form_versions` using that same `id`) combined with the
resource-type-integrity trigger above is the complete guarantee: correct
order for the common case, a trigger backstop for the buggy one.

### Resource type structural metadata

`resource_types` is structural application metadata managed by
migrations (`docs/DATA_ARCHITECTURE.md` §2: "added through a migration...
never through a Settings screen"), the same category the original
Platform Core resource types already belong to. **Migration 4, or
whichever migration first creates `form_versions`, should itself insert
the `('form_version', ...)` row into `resource_types`** as part of that
same migration; this is structural configuration describing what the
platform itself understands, not business seed/reference data, and does
not belong behind any later "configure reference data" workflow.

**Correction from Stage 5B1B2 preflight, replacing an earlier, incorrect
statement in this section:** `resource_types` does **not** carry the
generic row-level `audit_log` trigger. Confirmed against Migration 1
directly (both the migration source and the live remote schema):
`resource_types` and `resources` are the two Resource Registry tables
deliberately left unaudited, `resources` because it is identity-only
(insert-once, no update path), and `resource_types` because it is
migration-only structural metadata, not business or configuration state a
reviewer needs a mutation trail for. `resource_types` changes only ever
happen through a reviewed migration, never through a runtime write path;
migration history (the migration file itself, its PR review, and Git
history) is the durable provenance for this structural metadata, and is
adequate for it under the same CFO-control proportionality principle
that says controls should match actual risk, not exist merely because a
mechanism is available. Inserting the new `form_version` row therefore
produces **no** `audit_log` entry at all. This is expected and correct
as-is; nothing needs to be added, such as a new `resource_types` audit
trigger, merely to satisfy the earlier incorrect assumption that one
already existed.

## 15. Change summary and publication validation

**Change summary.** `change_summary` is optional while a version is
`v1` (the first version of a Form Definition has nothing to summarize a
change against), and optional for an `ABANDONED` draft of any version
number (it was never published, so there is nothing a reviewer needs
explained about a controlled change; requiring one would only pressure
someone to invent a summary for a row that never became a controlled
artifact). For `version_number > 1`, a non-null, non-blank
`change_summary` is required before that version may become or remain
`PUBLISHED` or `RETIRED`: a reviewer or auditor should always be able to
understand, in the version's own metadata, why a new controlled Form
Version was created, without having to reconstruct it from a JSON diff.
**What the database can and cannot actually guarantee here matters:** a
`CHECK` constraint can enforce that the column is non-null and
non-blank; it cannot, and is not asked to, judge whether the text is a
*meaningful* description of the change. Whether a `change_summary` is
substantively true and useful is an application-validation, reviewer, and
future publication-workflow concern, not something a database constraint
can express. Because presence/non-blankness only ever needs the row's own
columns (`version_number`, `status`, `change_summary`), that narrower
guarantee is expressible, and recommended, as a database `CHECK`
constraint rather than deferred to an application-level rule:
`(version_number = 1) OR (status IN ('draft', 'abandoned')) OR
(change_summary IS NOT NULL AND btrim(change_summary) <> '')`. A draft
may still be saved without one while being authored, and an abandoned
draft is exempt permanently, regardless of its version number; the
constraint only bites at the moment a `v2+` row is `published` or
`retired`. Because `RETIRED` always implies "was previously
`PUBLISHED`," and content is frozen the moment a version leaves `DRAFT`
(§10), a retired `v2+` version's `change_summary` is guaranteed to have
already been present at publish time and is guaranteed to remain so
forever, by the same immutability guarantee that protects everything
else about the row.

**Publication validation.** A Form Version must not become `PUBLISHED`
merely because `definition_json` is syntactically valid JSON. Before
that stage exists, Nexus should validate, in the future
application-service publication path (not built now), that the
definition: can actually be instantiated by the supported SurveyJS
runtime; uses only Nexus-supported form capabilities; contains valid
field keys; references only valid logical data sources (§20); contains
valid conditional expressions; does not depend on unsupported or custom
runtime behavior; and satisfies whatever structural requirements Nexus
defines. This validation is a fixed, closed set of Nexus-defined checks,
never a generic arbitrary-script execution mechanism; nothing about
"validate the definition" should ever mean "run whatever code the
definition happens to contain." This validation must run against the
exact `row_version` the publish call then binds to (§11); a validation
result computed against a draft that has since changed is not evidence
about the draft actually being published.

## 16. Copy-forward authoring pattern and the bootstrap contract

**Tightened at Stage 5B1B2 final review, superseding the first draft's
looser "or the highest-numbered version's" fallback.** Creating a new
draft has exactly two mutually exclusive cases, never a silent choice
between them:

- **A currently published version exists.** The new draft copies that
  version's `definition_json` and `display_name` as its starting
  content. The source version is never mutated by this. Concretely:
  `published v3 -> create new draft -> Nexus copies v3's definition_json
  and display_name into a new row -> that row is candidate v4 -> an
  admin edits v4 -> v4 is published`, at which point v3 retires per §9.
- **No currently published version exists** (a brand-new Form
  Definition with zero versions, or one whose entire history is
  abandoned drafts). There is no automatic copy-forward source; the
  caller must supply the initial `definition_json`, `display_name`, and
  `survey_js_version` explicitly. This is the same requirement whether
  it is literally the first version ever, or a later version being
  authored after every prior attempt was abandoned; both are, from this
  rule's point of view, "no controlled content exists to build on."

**A retired version is never an automatic source either, but not
because it is untrusted; because it cannot occur here.** Publication
(§9, §10) always retires the previously published version in the same
call that publishes its replacement, so "a retired version exists but
nothing is currently published" cannot arise through normal use of
these two operations. If a Form Definition's history contains only
retired and abandoned versions with nothing currently published, it is
treated the same as having no controlled source at all: bootstrap
content is required. This keeps the rule simple, one case
("published version exists" or it doesn't) instead of an additional,
harder-to-justify rule for an edge case the design does not expect to
occur.

**An abandoned version is never an automatic source, deliberately, in
every case.** Silently resurrecting a draft's content after it was
deliberately abandoned would defeat the point of abandoning it. If an
admin genuinely wants to reuse an abandoned draft's content, they do so
by explicitly supplying it as bootstrap content, an explicit, deliberate
act, not an automatic one.

**Because this is mutually exclusive, not a silent fallback:** supplying
bootstrap content when a published version already exists is rejected as
an error, not silently ignored or allowed to override the real source;
omitting or incompletely supplying it when no published version exists
is rejected the same way. There is no ambiguous state where it is
unclear which content a new draft actually started from.

This is the normal, and only, version-creation pattern; there is no admin
UI for it yet.

## 17. Draft mutability, deletion, and concurrency

- Draft versions are freely editable in place; nothing about §10's
  immutability rule applies until the row leaves `DRAFT`. Every such edit
  is bound by the `row_version` optimistic-concurrency check (§11).
- Form Versions are never hard-deleted, in any status. A draft that is
  deliberately ended without publishing transitions to `ABANDONED`
  (§6) and is permanently retained, frozen, because "an experimental
  configuration someone tried and discarded" is itself part of the
  honest history of how a published version came to look the way it
  does. It does not need the same operational significance as a
  published version (it was never used for a real business action), but
  it is cheap to keep and answers "what happened to version 4" honestly
  rather than silently.
- **Only one active draft per Form Definition at a time** (§7). Nexus
  does not need a form-authoring branching system; nothing in the
  requirements calls for concurrent competing drafts, and supporting them
  would require solving "which draft eventually gets published, and what
  happens to the others" for no known real need. The partial unique
  index scoped to `WHERE status = 'draft'` enforces this and is
  naturally released the moment the active draft is abandoned or
  published.
- An abandoned draft can never become active again (§6): there is no
  `ABANDONED -> DRAFT` transition. "Reactivating" an abandoned draft is
  not a status change; it is authoring a *new* draft that happens to
  start from the abandoned one's content, which is already exactly what
  the copy-forward pattern (§16) supports, using the abandoned row as a
  reference the same way any other prior version could be (Case K,
  §24).

## 18. Field identity across versions

A. A field's key (its SurveyJS question `name`) can only change in a new
version, never in place on a published one; this is not a special
rule, it is simply an instance of §10. Within one Form Version, field
keys are the machine identifiers everything else (submission data
mappings, a future Decision Engine, integrations, diffing) will key off
of; once that version leaves `DRAFT`, those keys are immutable with the
rest of the definition.

B. Whether `amount` in v1 and `request_amount` in v2 are "the same
conceptual field" is not a question the Form Version model can or should
answer, and it must not be guessed at from labels. If a later version
renames a field, **Nexus must treat cross-version equivalence as
UNKNOWN** unless a future, explicit mapping mechanism states otherwise.
Each version's `definition_json` is complete and self-describing for its
own rendering and validation; deciding cross-version equivalence is a
harder, separate problem belonging to whatever actually needs to compare
across versions.

C, D. Recommend **not** introducing a separate stable Nexus field
identity now, and recording this as a deferred decision rather than
guessing at a scheme. No real consumer exists yet: the Decision Engine,
Approval Matrix, and Form Data Contract that would actually need
cross-version field equivalence are all explicitly not built in this
stage. A future `form_field_identities`-style mapping (stable Nexus field
ID <-> per-version SurveyJS question name) can be added additively,
alongside `form_versions`, whenever a real consumer defines what it
actually needs; inventing it now risks guessing wrong and would not be
validated against any real requirement.

## 19. Audit strategy

**`form_definitions`.** Rows are small and changes are infrequent
(an admin occasionally edits `name`/`description`). Recommend the
standard, unmodified generic full-row `audit_log` trigger, exactly like
any other configuration table: nothing about this table's write volume or
sensitivity differs from what that mechanism already handles well.
`key` immutability is separately, additionally enforced by its own
dedicated trigger (§10) regardless of the audit question.

**`form_versions`.** This is the harder case. Reassessing the earlier
assumption that the generic full-row audit trigger should simply capture
every write: a `DRAFT` row's `definition_json` can be a substantial JSON
document, and a future authoring experience may autosave it frequently.
Capturing full `before_value`/`after_value` JSON for every intermediate
draft keystroke-level save would produce large audit volume, noisy
evidence, and misleading importance for a configuration state that was
never published, an explicit conflict with the Nexus audit-readiness
principle that evidence should preserve material controlled actions, not
merely maximize log volume. A draft that has never been published is not
yet an operative Finance control.

**Recommendation: option C, a targeted scope, using the exact same
generic `fn_audit_row('id')` function already used everywhere else,
unmodified.** Nothing new is built; only the trigger's attachment
differs, using a standard PostgreSQL trigger `WHEN` clause, a native,
zero-new-code mechanism:

```
create trigger trg_audit_form_versions
  after insert or update on form_versions
  for each row
  when (
    tg_op = 'INSERT'
    or old.status is distinct from new.status
  )
  execute function fn_audit_row('id')
```

This captures, in full, exactly the material events: version creation,
and every lifecycle transition (`draft -> published`, `published ->
retired`, `draft -> abandoned`), each a rare, one-time-per-row event, not
a source of volume. It does **not** individually capture ordinary
in-place `DRAFT`-content edits (updates that only change
`definition_json`, `display_name`, `survey_js_version`, `change_summary`,
`row_version`, `updated_at`, `updated_by`, while `status` stays
`draft`), because those are not yet controlled Finance events and their
volume is exactly the concern being guarded against.

This is not a loss of evidence for what actually matters, because:

1. **Row creation is captured** (`created_at`/`created_by`, reinforced by
   the `INSERT` audit row above): who started a version, and when.
2. **Every lifecycle transition is captured in full**, mechanically, by
   the same `WHEN`-scoped trigger: who published, retired, or abandoned
   a version, and the complete before/after row state at that moment.
3. **What exact definition became published is the row itself**: once a
   version leaves `DRAFT`, `definition_json` is frozen forever (§10).
   The immutable row is stronger evidence of "what was published" than
   a reconstructed diff trail of the drafting process ever needs to be;
   an auditor reads the row, not a chain of edits that led to it.
4. Dedicated columns (`created_by/at`, `published_by/at`,
   `retired_by/at`, `abandoned_by/at`, `change_summary`) remain the
   primary, directly-queryable evidence for "who did what materially, and
   when" (§4); `audit_log` remains available underneath them as the
   exhaustive mechanical trail for the events it does capture, not the
   primary audit narrative for either table.

Nothing here weakens `audit_log`'s "regardless of which path produced it"
guarantee for the events it is scoped to capture; the `WHEN` clause
narrows *which writes* are in scope for this one table, using ordinary,
native trigger syntax, not a parallel or reduced audit mechanism. If a
real future need for full draft-edit history ever appears (a
domain-events/activity-style requirement), it can be introduced
additively then, against an actual requirement, rather than paid for
now, generically, against a hypothetical one.

## 20. Branch-rule and master-data interaction boundary

Stage 5B1A discovered that SurveyJS retains values from pages/fields that
later become hidden by a branch change. This document does not choose
whether hidden values are eventually cleared, retained, excluded from
submission, or retained-but-marked-inactive; that choice belongs
primarily to Stage 5B1C's Form Data Contract.

What Form Versioning must guarantee, and does guarantee by construction:
the exact conditional rules (`visibleIf`, `requiredIf`, `enableIf`, and
any branch logic) that decided applicability for a given submission are
preserved unchanged inside that submission's `form_version_id`, forever
(§10, §24 Case F). Whatever policy Stage 5B1C adopts for hidden data can
therefore always be evaluated against the *actual rules that were live at
submission time*, not today's rules.

The same boundary applies to master-data-backed fields (a logical data
source such as `commercial_master.modules`,
`docs/FORM_CAPABILITY_REGISTER.md` "Master-data-backed form fields"): a
Form Version stores only the logical reference, never a physical query
and never a direct coupling to a Supabase table. That reference, too, is
frozen forever inside the version. But **a Form Version does not, and is
not meant to, preserve what a specific submission actually resolved and
displayed** for that reference (Case E, §24); that is a Submission
Snapshot / Data Contract concern, deliberately deferred to Stage 5B1C,
and this document should not be read as having solved it.

## 21. Historical rendering principle

To render an old submission, Nexus will eventually resolve, in this
exact order:

```
submission.form_version_id
  -> the immutable Form Version row
    -> its version-specific display_name
    -> its exact, frozen definition_json
    -> its version-specific survey_js_version compatibility metadata
  -> plus the submission-side data/snapshots designed in Stage 5B1C
```

It must **not** use: the currently published Form Version for that Form
Definition (a different row entirely, unless it happens to be the same
one); the current `form_definitions.name` (superseded by `display_name`,
§5); or today's Commercial Master label as a substitute for whatever
master-data context the submission itself actually captured (§20). Each
of these substitutions would silently change what a historical record
appears to say, which is exactly what this entire model exists to
prevent.

## 22. RPC security boundary and controlled error semantics

**Security boundary.** `create_form_version` and `publish_form_version`
are persistence primitives behind `UI -> application service -> domain ->
repository -> RPC/database`; they are not, and must never become, a
browser-facing or business API. Recommend: `anon` cannot `EXECUTE`;
`authenticated` cannot `EXECUTE` directly; `PUBLIC` cannot `EXECUTE`
either, explicitly revoked by name rather than relied on to be absent,
the same lesson already applied to the existing trigger functions
(`docs/DATA_ARCHITECTURE.md` §12); the trusted server path (`service_role`)
retains the ability to call them, since it already holds the ordinary
privileges it needs; `postgres`/the owning role retains whatever access
is structurally required.

**`SECURITY INVOKER` is recommended, not `SECURITY DEFINER`.** The only
legitimate caller of these functions is the trusted application-service
layer, already running with whatever privileges it needs to perform the
underlying writes directly; the function does not need to elevate beyond
its caller's own privileges, so there is no genuine need to run it as a
different, more-privileged role. `SECURITY DEFINER` would add a real
privilege-escalation risk for no corresponding benefit here, particularly
the well-known search-path-hijacking risk that pattern carries if ever
combined with a mutable `search_path`. If a concrete future need for
`SECURITY DEFINER` appears (for example, if a narrower version of one of
these operations should ever be callable by a role that does not itself
hold the underlying table privileges), it must set `search_path`
explicitly and locked, the same requirement already established for this
codebase's other `SECURITY DEFINER` functions.

**Controlled error semantics.** The repository must be able to
distinguish a controlled conflict from an unexpected database failure,
so the application service can tell a user "someone changed this form
while you were editing it" rather than a generic error. A small, closed
set of named conditions, not a large error framework:

| Condition | Raised by | Meaning |
|---|---|---|
| `ACTIVE_DRAFT_EXISTS` | `create_form_version` | An active draft already exists for this Form Definition (§9, Case I). |
| `DRAFT_CHANGED` | draft save, `publish_form_version` | The row's `row_version` no longer matches the caller's `expected_row_version` (§11). |
| `VERSION_NOT_DRAFT` | draft save, `publish_form_version` | The target row is no longer `status = 'draft'` (already published, retired, or abandoned). |
| `FORM_DEFINITION_NOT_FOUND` | either RPC | The given `form_definition_id`/`form_version_id` does not resolve. |
| `BOOTSTRAP_MISMATCH` | `create_form_version` | Bootstrap content was supplied when a published version already exists to copy forward from, or was missing/incomplete when none exists (§16). |

**Decided at Stage 5B1B2 final review: `PUBLISHED_VERSION_CONFLICT` is
removed from this set, not merely deferred.** With the Form Definition
row lock, at most one active draft, at most one published version, and
publication itself serialized on that same parent lock, a different
version becoming published while a caller was mid-publish is not a
reachable normal business state; `VERSION_NOT_DRAFT` and `DRAFT_CHANGED`
already cover every way the caller's own candidate could have changed
out from under it. If the published partial unique index were ever
violated despite all of that, that is an unexpected database integrity
failure to investigate, not a named business conflict to manufacture a
user-facing message for.

Exact SQLSTATE/error-code conventions are not decided here; only that
these are the distinguishable conditions the repository needs to map to
a specific, honest message, rather than an opaque success/failure result.

## 23. What must still be settled before Migration 4

Reviewing every open question this Stage 5B1B1 design pass has raised:

**Settled by this document:** form identity (§3); form version lifecycle
(§6); published immutability, state by state (§10); abandonment as a real
status (§6); version numbering (§8); concurrent draft creation (§9, Case
I, §24); concurrent draft editing (§11); publication concurrency (§9,
Cases M/N, §24); publication validation binding (§11); historical title
(§5); Resource Registry use (§14); resource type integrity (§14); resource
creation atomicity (§14); change summary (§15); SurveyJS compatibility
metadata (§4); audit semantics (§19); RPC security boundary (§22).

**Not settled, and explicitly not blocking Migration 4 because they are
recorded as deferred, out-of-scope-for-this-stage decisions rather than
unresolved gaps in this stage's own scope** (§26): whole-Form-Definition
retirement; the hidden/inapplicable-data policy and master-data snapshot
mechanism (Stage 5B1C's); a stable cross-version field identity;
scheduled/effective-dated publication; whether `form_definitions` should
ever become resource-backed; whether a content hash is worth adding
later. None of these block writing Migration 4 against the model this
document does settle.

**Genuinely still implementation detail, not a design gap:** the exact
SQL for every trigger and function named above. This document has
settled *what* each must guarantee and *why*; Stage 5B1B2 writes the SQL
against that settled shape.

## 24. Failure-scenario walkthrough

| Case | Scenario | Behavior |
|---|---|---|
| A | v1 published, v2 draft | Exactly one `published` row (v1), enforced by the partial unique index (§7). v2 is being freely edited and is not offered for new submissions. |
| B | v2 published while a v1 request is in progress | The publish call (§9) retires v1 and publishes v2. The in-progress request already carries `form_version_id = v1.id` (§13), which never changes, so it keeps rendering and validating against v1's frozen definition regardless of v2 existing. |
| C | v2 retired after v3 published | v2 was already `retired` the moment v3 was published (only the currently `published` row is retired at each publish). v2's row is never deleted; any submission referencing it keeps working forever. |
| D | Auditor opens a v1 submission two years later | Nexus resolves the submission's `form_version_id`, loads that exact, still-present, immutable `form_versions` row, and renders it read-only using its own `display_name` and `definition_json`. `survey_js_version` lets Nexus recognize, rather than silently mask, a runtime-compatibility gap if the installed SurveyJS has since changed materially. |
| E | Commercial Master module label changed after an old submission | `form_versions.definition_json` never stored the resolved label, only the logical reference (`commercial_master.modules`, §20); it is therefore unaffected by the later label change. Whether the *old submission* still shows the label the user actually saw depends entirely on Stage 5B1C's Submission Snapshot capturing `{value, display}` at submission time. That is explicitly outside this document's guarantee; Stage 5B1C must not assume Form Version solved it. |
| F | A branch rule changes between v1 and v2 | Each version's `definition_json` independently and completely contains its own conditional rules. v1's frozen JSON keeps v1's exact rules forever; a submission tied to v1 is always interpreted against v1's rules, live or years later, never v2's. |
| G | Admin discovers a typo in published v2 | v2 cannot be edited in place (§10, enforced at both application and database level). Correct path: copy-forward a new draft from v2 (§16), fix the typo, publish as v3 (`change_summary` required, §15, e.g. "fixes typo in field X label"), which retires v2. Submissions already on v2 keep the typo forever; this is the accepted cost of publish-immutability, not a defect. |
| H | Draft v4 is abandoned | `status` becomes `abandoned`, `abandoned_at`/`abandoned_by` populated; the row's content is frozen from that moment (§10) and never deleted, and its version number is never reused. The one-active-draft constraint (§7, §17) is released, allowing a new draft (v5) to be started. |
| I | Two admins simultaneously create a new draft version | Both calls to `create_form_version` race for the same per-Form-Definition row lock (§9). The first to acquire it finds no active draft, allocates the next `version_number`, inserts, and returns; the second, unblocked only after the first finishes, re-checks "does an active draft exist" and now finds one, returning `ACTIVE_DRAFT_EXISTS` (§22) rather than a second draft. `UNIQUE (form_definition_id, version_number)` remains the backstop if that lock discipline were ever bypassed. |
| J | Form Definition name changes after an old submission exists | `form_definitions.name` changing does not touch any existing `form_versions` row. The old submission's Form Version already has its own frozen `display_name` (§5), so historical rendering is entirely unaffected by the rename. |
| K | Someone attempts to reactivate an abandoned draft | There is no `ABANDONED -> DRAFT` transition (§6); the database trigger (§10) rejects any status change out of `abandoned`. The correct action is to author a *new* draft, optionally copying the abandoned version's content the same way copy-forward already works from any prior version (§16, §17). |
| L | Someone attempts to edit a retired version | Rejected identically to attempting to edit a published version: `RETIRED` permits no business-field updates (§10), enforced by the same database trigger regardless of which application code path attempted the write. |
| M | Two admins simultaneously attempt to publish | Both calls to `publish_form_version` race for the same row lock (§9, §11). The first publishes; the second's own precondition re-check (candidate still `draft`, and `row_version` still matches) fails once unblocked, returning `VERSION_NOT_DRAFT` or `DRAFT_CHANGED` as appropriate, never a second publish. There is never a moment with two `published` versions, both by this serialization and by the partial unique index (§7). |
| N | One admin creates a new version while another publishes, for the same Form Definition | Both operations lock the identical `form_definitions` row (§9), so they never interleave: whichever starts first (creating a draft, or retiring-and-publishing) runs to completion before the other begins, regardless of which specific operation each side is performing. |
| O | Admin A validates draft v6, Admin B edits v6, Admin A then publishes | Admin A's publish call supplies the `row_version` it read *before* validation as `expected_row_version` (§11). Because Admin B's edit already incremented `row_version`, the publish call's precondition check fails, returning `DRAFT_CHANGED`; Nexus never publishes a definition different from the one that was actually validated. |
| P | Two admins simultaneously save edits to the same active draft | Both reads observed the same `row_version`. The first save's conditional update matches and succeeds, incrementing `row_version`. The second save's conditional update, using the now-stale `row_version` it read, matches zero rows and returns `DRAFT_CHANGED`; the second admin must reload and reconcile, never silently overwriting the first admin's change. |

## 25. Change log

- **Draft 1:** established Form Definition and Form Version, the
  draft/published/retired lifecycle with `abandoned_at` as a marker,
  `definition_hash`, and the core invariants.
- **Draft 2:** made abandoned a real lifecycle status; made version-number
  assignment concurrency-safe in principle; added `display_name`;
  removed `definition_hash` (later reassessed again in Draft 3, same
  conclusion).
- **Draft 3 (this revision):** resolved the actual database-access
  mechanism (RPC functions, not a held-open application-service
  transaction, §9); added `row_version` and bound publication to the
  exact validated draft state (§11); added the draft-edit concurrency
  model (§11); replaced "capture every draft edit" with a targeted,
  `WHEN`-scoped audit strategy (§19); made resource-creation atomicity
  and resource-type structural metadata explicit (§14); added the RPC
  security boundary and controlled error semantics (§22); added a
  settled/unsettled review (§23) and two new failure scenarios, O and P
  (§24).

## 26. Deferred decisions

Explicitly not decided in this document:

- Whether an entire Form Definition (not just a version) can be retired
  or discontinued as a type (§3).
- Whether hidden/inapplicable field values are cleared, retained,
  excluded, or retained-but-marked-inactive at submission time (§20;
  Stage 5B1C).
- How a submission's resolved master-data selection (`{value, display}`)
  is captured and preserved (§20; Stage 5B1C).
- A stable, version-independent Nexus field identity (§18).
- Scheduled/effective-dated publication ("publish automatically from a
  future date"). Not added now; if a real need appears, Temporal can
  execute a scheduled publish through the same application-service
  command already described in §9, without changing this schema.
- The exact database-level immutability trigger implementation (§10),
  the exact `create_form_version`/`publish_form_version`/draft-save
  function or statement bodies (§9, §11), the exact
  `fn_assert_resource_type`-style generic resource-type-integrity trigger
  (§14), and the exact `row_version`-incrementing trigger (§4); all
  implementation detail for Stage 5B1B2, not schema decisions this
  document needs to finalize. The *mechanism* for each (database
  functions/RPCs, not a held-open application-service transaction;
  optimistic concurrency via `row_version`, not `updated_at`) is decided;
  the SQL is not written.
- Whether Nexus's eventual repository layer talks to Supabase entirely
  through `supabase-js`/PostgREST for everything else, or adopts a direct
  driver for some other, unrelated reason; if the latter ever happens
  project-wide, revisit whether these operations should move to Option A
  (§9) instead of remaining RPCs. Not a decision to make now, and not
  blocked by anything in this document either way.
- Reconsidering whether `form_definitions` should become resource-backed
  if Form-Definition-scoped authorization becomes a real requirement
  (§14).
- Whether a content hash is worth adding once a concrete external
  consumer for one exists (§12).
- Exact SQLSTATE/error-code conventions for the named controlled errors
  (§22); only the distinguishable conditions themselves are decided.

## 27. Candidate database shape (for review, not a migration)

```
form_definitions
  id            uuid            primary key
  key           text            not null, unique   -- immutable after insert (§10)
  name          text            not null
  description   text
  created_at    timestamptz     not null
  created_by    uuid            not null references app_users
  updated_at    timestamptz     not null
  updated_by    uuid            not null references app_users

form_versions                                       -- id = resource_id (see §14)
  id                 uuid         primary key references resources(resource_id)
  form_definition_id uuid         not null references form_definitions(id)
  version_number     integer      not null           -- concurrency-safe assignment, §8, §9
  status             text         not null
                                  check (status in ('draft','published','retired','abandoned'))
  row_version        integer      not null default 1  -- optimistic concurrency token, §11
  display_name       text         not null            -- historical, version-specific (§5)
  definition_json    jsonb        not null
  survey_js_version  text         not null
  change_summary     text
  created_at         timestamptz  not null
  created_by         uuid         not null references app_users
  updated_at         timestamptz  not null
  updated_by         uuid         not null references app_users
  published_at       timestamptz                     -- null until published
  published_by       uuid         references app_users
  retired_at         timestamptz                      -- null unless retired
  retired_by         uuid         references app_users
  abandoned_at       timestamptz                      -- null unless abandoned
  abandoned_by       uuid         references app_users

  constraint chk_form_versions_lifecycle_dates check (
    (status = 'draft'     and published_at is null and retired_at is null
                          and abandoned_at is null) or
    (status = 'published' and published_at is not null and retired_at is null
                          and abandoned_at is null) or
    (status = 'retired'   and published_at is not null and retired_at is not null
                          and abandoned_at is null) or
    (status = 'abandoned' and published_at is null and retired_at is null
                          and abandoned_at is not null)
  )
  constraint chk_form_versions_change_summary_required check (
    version_number = 1
    or status in ('draft', 'abandoned')
    or (change_summary is not null and btrim(change_summary) <> '')
  )
  unique (form_definition_id, version_number)
  unique index uq_form_versions_one_published
    on form_versions (form_definition_id) where status = 'published'
  unique index uq_form_versions_one_active_draft
    on form_versions (form_definition_id) where status = 'draft'
```

Not shown, and explicitly not decided by this candidate shape: the
`create_form_version`/`publish_form_version` database-function bodies and
their conceptual signatures (`publish_form_version(form_version_id,
expected_row_version, ...)`, §9, §11); the generic
`fn_assert_resource_type`-style trigger and its attachment to
`form_versions` (§14); the `key` immutability guard on `form_definitions`
(§10); the lifecycle/content immutability guard on `form_versions` (§10);
the `row_version`-incrementing trigger; the `WHEN`-scoped audit trigger
attachment (§19); the `resource_types` seed insert for `'form_version'`
(§14); execute-privilege revocations for the two RPCs (§22); and RLS
policies, which follow the same default-deny posture already established
(`docs/DATA_ARCHITECTURE.md` §12) whenever this is actually migrated.

## 28. What this document is not

Not a migration. Not an implementation. Not a decision on submission
persistence, the Form Data Source Resolver, Commercial Master, or the
Decision Engine. Every "recommendation" above is exactly that, a
recommendation for review before Stage 5B1B2 turns any of it into SQL.
