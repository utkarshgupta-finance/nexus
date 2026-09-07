# Nexus: Submission / Data Contract Design

**DESIGN ONLY. NOT YET IMPLEMENTED.**

This document designs how Nexus stores a user-facing Request, its mutable
working draft, immutable submitted revisions, raw entered evidence,
authoritative applicable data, master-data snapshots, server-authoritative
calculations, and revision history. It extends
`docs/PLATFORM_ARCHITECTURE.md`, `docs/DATA_ARCHITECTURE.md`,
`docs/AUTHORIZATION_MODEL.md`, and `docs/FORM_VERSIONING_MODEL.md`; nothing
here overrides those documents. No migration, no Supabase change, no
Commercial Master, no Form Data Source Resolver, no Flowable, no approval
engine, no attachments, and no application code exist because of this
document. Every example is generic and fictional; no real Nexus form,
field, or business rule is named here.

This is Stage 5B1C1, following Stage 5B1B (Form Definition and Form
Version, `docs/FORM_VERSIONING_MODEL.md`).

**This is a simplification pass.** The architecture and every business
decision remain exactly as approved. This pass removes redundant persisted
state, makes the future schema safe by construction, and reduces the
idempotency design to only what a genuine ambiguity requires. Nothing in
the locked business-decisions list is reopened.

## 1. Where this sits in the accepted architecture

A Form Version (`docs/FORM_VERSIONING_MODEL.md`) is the controlled
definition of a form. A Request is a specific business use of one Form
Version by one requester over time, potentially across more than one
Submission Revision if Finance sends it back. SurveyJS remains the
rendering and interaction engine only (`docs/PLATFORM_ARCHITECTURE.md`
§13); this document designs what Nexus stores about a Request and its
Revisions, never how SurveyJS itself represents a form on screen.

The layering already established
(`docs/PLATFORM_ARCHITECTURE.md` §2: `UI -> application service -> domain
-> repository -> database`) applies here without change.

## 2. Terminology

| Term | Meaning |
|---|---|
| Request | The stable, long-lived Nexus identity a user experiences as one thing throughout its lifecycle. Pins exactly one Form Version at creation. Permanent: never deleted, hard or soft. |
| Submission Revision | One instance of that Request being filled in and, if submitted, frozen. A Request has one or more Revisions over time. Permanent: never deleted. |
| Draft Revision | A Submission Revision currently being authored. Mutable. At most one per Request. Always the highest `revision_number` for its Request while none has yet been submitted past it. |
| Submitted Revision | A Submission Revision that has been frozen by the submit operation. Immutable forever. |
| Raw evidence (`raw_data`) | Exactly what the user's form session produced, including values SurveyJS retained for now-hidden/inapplicable fields. Never authoritative on its own. |
| Authoritative business values (`effective_data.values`) | The subset of a submission that actually applied when it was submitted: applicable, master-validated, server-calculated where material. Safe for any downstream Finance logic to consume directly. |
| Applicability evidence (`effective_data.applicability`) | The record of which raw fields were evaluated as inapplicable, and therefore excluded from the authoritative values, without duplicating their (inadmissible) value. |
| Master-data snapshot | The submission-time historical display/context captured alongside a canonical master-data ID, distinct from a full copy of the master record. |
| Origin | Per-field record of why a value in the authoritative snapshot is what it is: user entry, master resolution, server calculation, or default. |
| Submission Contract Version | The version of the JSON shape a Submission Revision's snapshot itself is written in, independent of the Form Version. |

A Request is not a submission's business-process state (owned later by
Flowable), not an approval (owned later by an approval capability), and
not the resulting operational record an approved Request may eventually
produce (§13).

## 3. Request

**Resource-backed: yes**, for the reasons already established
(`docs/FORM_VERSIONING_MODEL.md` §14's test: workflow, tasks, comments,
attachments, notifications, API identity, and activity history are all
naturally Request-scoped). `requests.id` reuses `resources.resource_id`
(`resource_type = 'request'`).

### Columns challenged and removed

**`form_definition_id` removed.** It is fully derivable:
`pinned_form_version_id -> form_versions.form_definition_id`. No current
access pattern requires it duplicated on `requests`; a query that needs a
Request's Form Definition joins through its pinned version, exactly the
same one hop `docs/FORM_VERSIONING_MODEL.md` itself requires nowhere to
avoid. Denormalizing it would only exist to save one join, which is not a
justification `docs/DATA_ARCHITECTURE.md` accepts anywhere else in this
schema. The **create-Request operation still accepts a Form Definition ID
as an input parameter** (§9): Nexus needs it to locate and lock the
correct Form Definition and resolve its currently published version, but
the Request row itself stores only the result of that resolution
(`pinned_form_version_id`), which alone fully determines the Form
Definition.

**`current_revision_id` removed.** Under the locked model, revision
numbers are monotonic, never reused, never gap-created, and only one
Draft may exist at a time; the current Revision is, by construction,
always the row with `max(revision_number)` for that `request_id`. Storing
a second pointer to it would be denormalized state requiring
synchronization on every Revision-creating and Revision-submitting
operation, and would introduce a circular reference between `requests`
and `submission_revisions` for no query benefit `unique (request_id,
revision_number)` does not already provide: `select * from
submission_revisions where request_id = ? order by revision_number desc
limit 1` is answered directly by that index's own backward scan, with no
correlated subquery penalty. If a future access pattern at real scale
genuinely needs an avoided join, that is a deliberate future
denormalization decided against real query evidence, not something to
build speculatively now.

**`deleted_at` removed.** No soft-delete machinery exists for Requests at
all. A Request, once created, is permanent: it is never hard-deleted and
never soft-deleted. The only lifecycle switch a Request ever needs is
`is_active` (below), which is not a deletion mechanism, a visibility
filter, or a retention marker; it never hides a Request from history, it
only records that the container's active intent has ended.

### Final columns

- `id` - `= resource_id`, stable identity, never changes.
- `pinned_form_version_id` - the exact Form Version this Request was
  created against (decision 3). Never changes after insert (item B,
  §9).
- `is_active` - boolean, `not null default true`. `true` means the
  container still has live intent behind it (an open Draft, or a
  submitted Revision awaiting whatever happens next); `false` means the
  Request was deliberately, permanently ended (withdrawn, cancelled, or
  its only/current Draft abandoned with nothing submitted past it).
  One-way only: `true -> false`, never reversed. No reactivation is
  designed in v1; "restarting" is authoring a new Request.
- `created_at` / `created_by`, `updated_at` / `updated_by` - standard
  columns (`docs/DATA_ARCHITECTURE.md` §3).

That is the complete column list. Every remaining column earns its place
by a concrete invariant or access pattern already stated in this
document; none exists for hypothetical future convenience.

### Item A: new-Request Form Version eligibility

A Request may only be created against a Form Version whose `status =
'published'` at the moment of creation (never `draft`, `retired`, or
`abandoned`); no scheduled-effective publication is designed here
(`docs/FORM_VERSIONING_MODEL.md` §26 already defers that). Enforced the
same way `docs/FORM_VERSIONING_MODEL.md` §14 already established for
resource-type integrity: a plain foreign key cannot express "and its
status happens to be published," so a `BEFORE INSERT` trigger on
`requests` checks `form_versions.status = 'published'` for the referenced
`pinned_form_version_id` at insert time, as a defense-in-depth backstop
beneath the create-Request RPC's own correct-by-construction selection
logic (§9).

### Item B: Form Version pin immutability

`pinned_form_version_id` never changes after insert, enforced the same
way `docs/FORM_VERSIONING_MODEL.md` §10 already protects
`form_versions.form_definition_id`/`version_number`: a `BEFORE UPDATE`
trigger rejecting any change to this column, regardless of which
application code path attempted the write.

## 4. Submission Revision

**Resource-backed: no**, for the reasons already established (§4 of the
prior revision, unchanged): none of workflow, tasks, comments, or
notifications are naturally Revision-scoped rather than Request-scoped.
Ordinary UUID primary key, foreign key to `requests.id`.

### Columns challenged and removed

**`submit_operation_id` removed** (§7). **`created_via_operation_id`
removed** (§8). Both were introduced in the prior revision to distinguish
"a genuine retry" from "a genuinely different, conflicting attempt." Re-
examining each operation's exact concurrency semantics (§7-8) shows the
existing structural signals, `row_version` for submit and
`revision_number` for create-next-revision, already resolve that
distinction completely, because both are **content-addressed**, not mere
attempt counters: a matching `row_version` means the caller validated
*exactly* the content that ended up frozen, regardless of which physical
HTTP request the database happened to serialize first. No column earns
its place merely to mirror a generic idempotency pattern seen elsewhere;
none is added here.

### Final columns

- `id` - ordinary UUID primary key, generated at write time.
- `request_id` - which Request this is a Revision of. Never changes after
  insert.
- `revision_number` - integer, monotonic per `request_id`, human readable
  (1, 2, 3...), assigned once at creation, never renamed or renumbered,
  never reused.
- `status` - `'draft'` / `'submitted'` only (decision 22). Nothing else.
- `row_version` - integer, starting at 1, database-maintained, identical
  mechanism to `form_versions.row_version`: incremented by exactly one on
  every `UPDATE`, including the submit transition itself
  (`docs/FORM_VERSIONING_MODEL.md` §4, §11).
- `submission_contract_version` - integer, which version of the JSON
  shape in §5 this row's snapshot columns are written in (§12).
- `raw_data` - JSONB. Mutable working form data while `status = 'draft'`;
  frozen, immutable evidence once `status = 'submitted'` (§6).
- `effective_data` - JSONB. **`null` while `status = 'draft'`, always**;
  not-null exactly once `status = 'submitted'` (§5-6). Never a
  continuously-recomputed live view during authoring.
- `created_at` / `created_by` - when this Revision (Draft) was started.
  Never changes after insert.
- `updated_at` / `updated_by` - bumped on every legitimate Draft save,
  mirrors `row_version` exactly.
- `submitted_at` / `submitted_by` - null until submitted, populated
  exactly once, in the same atomic operation that freezes the row.

That is the complete column list; no operation-id column, no
`deleted_at`, no `calculated_summary` (§5).

**Immutable once submitted:** `id`, `request_id`, `revision_number`,
`created_at`, `created_by` never change after insert. Once `status =
'submitted'`, `raw_data`, `effective_data`, `submission_contract_version`,
`submitted_at`, and `submitted_by` are frozen permanently; no transition
exists out of `'submitted'` (decision 14). A Draft that is deliberately
ended without submitting simply never transitions further; the Request's
own `is_active` (§3) is what marks the container permanently closed, so
this table needs no third status.

**Deletion: never, in any status, under any circumstance.** This
tightens the prior revision, which allowed a never-submitted Draft to be
hard-deleted "in principle." Under the simplified model, a Submission
Revision, once created, is exactly as permanent as its parent Request: no
`DELETE` privilege ever reaches this table, and no soft-delete column
exists either. An abandoned Draft simply remains a `status = 'draft'` row
forever, distinguished from "still being worked on" purely by its
parent Request's `is_active = false` (§3). This is simpler than the prior
two-tier answer (soft-deletable Draft, permanent Submitted) and matches
decision 20's spirit applied consistently: cancellation, withdrawal, or
abandonment never erases anything, at any stage.

## 5. Correction, revisited: `effective_data` shape (further simplified)

The safe-by-construction correction from the prior pass (`values` never
contains an inapplicable value; `applicability` records only the
exclusion fact) is retained unchanged. **`calculated_summary` is removed**
as a separate section.

**Reasoning.** `calculated_summary` existed to hold "material,
whole-submission calculated values that are not naturally one field's
value." Re-examined: a server-calculated authoritative value, whether it
corresponds to one form field or is a computed aggregate with no single
form-field counterpart, is still exactly one thing: an authoritative
value with `origin: "system_calculated"` and calculation provenance. There
is no genuine second category of fact here, only two possible *sources*
of the key it is stored under (an existing field's key, or a
Nexus-introduced key for a value the form itself never asked the user to
enter). Storing the same kind of fact in two different sections would
create exactly the multi-location drift risk this document has already
rejected twice (§12; `docs/FORM_VERSIONING_MODEL.md` §12's
`definition_hash` reasoning): a future reader would have to check both
`values` and `calculated_summary` to be sure they had every authoritative
calculated fact, and the two could disagree about which section a given
calculated key belongs in.

**Final v1 contract:**

```
effective_data:
{
  "values": {
    "<field_key>": {
      "value": <the effective value>,
      "origin": "user_entered" | "master_resolved"
                | "system_calculated" | "system_default",
      "master_ref": { "canonical_id": "...", "snapshot": { ... } } | null,
      "calculation": { "rule_ref": "...", "rule_version": "..." } | null
    }
  },
  "applicability": {
    "<field_key>": {
      "applicable": false
    }
  }
}
```

All authoritative user-entered, master-resolved, defaulted, and
calculated values, whether they map to a form field or are a
Nexus-introduced computed key, live in exactly one place: `values`. A
downstream consumer needs to read exactly one section to obtain every
authoritative fact about a submission, with no second location to
cross-check.

**Boxed rule, unchanged:**

> `raw_data` is evidence. It is never trusted business input. No
> downstream Finance capability may read `raw_data` directly as
> authoritative data, under any circumstance. Application and domain logic
> consume only `effective_data.values`, or a proper resulting domain
> record built from it (§13). `raw_data` exists for a human reviewer, an
> auditor, or a future diff view, never as an input to a rule, a
> calculation, an approval, or any other authoritative Finance logic.

### Fictional example (unchanged in substance, `calculated_summary` folded in)

```json
{
  "raw_data": {
    "requestType": "standard",
    "region": "west",
    "moduleSelection": "MOD-003",
    "exceptionReason": "budget approved verbally",
    "monthlyAmount": 500
  },
  "effective_data": {
    "values": {
      "requestType": {
        "value": "standard",
        "origin": "user_entered",
        "master_ref": null,
        "calculation": null
      },
      "moduleSelection": {
        "value": "MOD-003",
        "origin": "master_resolved",
        "master_ref": {
          "canonical_id": "MOD-003",
          "snapshot": { "code": "SFA", "label": "SFA" }
        },
        "calculation": null
      },
      "monthlyAmount": {
        "value": 500,
        "origin": "system_calculated",
        "master_ref": null,
        "calculation": {
          "rule_ref": "monthly_amount_v1",
          "rule_version": "1"
        }
      },
      "annualizedAmount": {
        "value": 6000,
        "origin": "system_calculated",
        "master_ref": null,
        "calculation": {
          "rule_ref": "annualized_amount_v1",
          "rule_version": "1"
        }
      }
    },
    "applicability": {
      "exceptionReason": {
        "applicable": false
      }
    }
  }
}
```

`annualizedAmount` demonstrates a Nexus-introduced computed key that never
existed as a form field at all, stored in `values` exactly like
`monthlyAmount`, distinguished only by `origin`/`calculation`, not by
which section of the document it lives in. `exceptionReason` still never
appears in `values`; `applicability` still records only the exclusion
fact, never the excluded value, which remains solely in `raw_data`.

## 6. Draft vs. submitted `effective_data`: an explicit contract

```
DRAFT
  raw_data       = mutable, editable working form data
  effective_data = null                                  -- always, no exception

SUBMIT (server-controlled, one atomic operation, §12)
  server:
    - evaluates applicability
    - validates master references
    - recomputes material calculations
    - builds effective_data from the above
    - freezes raw_data (no further edits possible)
    - sets status = 'submitted'

SUBMITTED
  raw_data       = immutable evidence
  effective_data = immutable authoritative snapshot
```

No pseudo-authoritative `effective_data` is ever persisted during
autosave. `effective_data` has exactly one writer in the entire system:
the submit operation, exactly once, per Revision. This is a stronger and
simpler contract than "compute effective_data continuously and mark parts
of it draft-quality": there is no such thing as a draft-quality
`effective_data` row at all; the column is either `null` or it is
finished, submitted, authoritative fact.

## 7. Submit idempotency: reasoned from `row_version` semantics alone

**Re-examining whether `submit_operation_id` is actually necessary.** The
prior revision assumed row state alone could not distinguish "the same
caller retrying" from "a different caller whose stale precondition
happens to coincidentally match." Working through the exact `row_version`
semantics shows this assumption was wrong, because `row_version` is
**content-addressed**: it changes if and only if the row's content
changes, and it never repeats a value for a given row (`docs/DATA_
ARCHITECTURE.md` §5). Two callers who both supply the same
`expected_row_version` are, by definition, both asserting "I validated
exactly this content," and if that exact content is what the database
actually froze, submitting it is correct **regardless of which physical
HTTP request the database happened to serialize first**, because the
frozen result is identical either way; there is no second, different
"version" of that submission a second caller could be mistaken for having
caused.

**Design: `submit_revision(revision_id, expected_row_version, actor
context)`. No operation ID.**

1. Lock/read the target Revision row.
2. **If `status = 'submitted'` already:**
   - If `row_version = expected_row_version + 1` (the row_version
     the row would have reached had *this exact caller's* validated
     content been the one submitted): return the existing frozen row as
     success. This is safe whether it is a literal retry of the same
     physical call or a second, independent submitter who validated the
     identical content, because both cases submit the identical result;
     `submitted_by` on the returned row is the true, honest record of
     whichever attempt the database actually serialized first, never
     misattributed to the caller who happens to be asking now.
   - Otherwise (`row_version` does not match `expected_row_version + 1`):
     a **different** content state was what actually got submitted, not
     the one this caller validated. Raise a controlled
     `REVISION_NOT_DRAFT`-equivalent conflict
     (`docs/FORM_VERSIONING_MODEL.md` §22's pattern), never silently
     returned as success.
3. **If `status = 'draft'`:** verify `row_version = expected_row_version`
   exactly; if not, raise `DRAFT_CHANGED`
   (`docs/FORM_VERSIONING_MODEL.md` §11, §22). **This is completely
   untouched by step 2's reasoning:** a genuinely stale editor whose
   content was never the one submitted still finds the row in `draft`
   with a `row_version` that does not match what they expected, or (per
   step 2) finds it `submitted` at a `row_version` that does not match
   `expected_row_version + 1`. Either way, they receive a real conflict,
   never a false success. Optimistic concurrency is not weakened.
4. Otherwise: perform the real submission procedure (decision 48), in the
   same transaction.

**No `submit_operation_id` column is added.** `row_version` alone,
correctly reasoned through, already provides both guarantees: no
duplicate submitted state (structural, from the single `draft ->
submitted` transition), and correct retry/replay behavior (from
`row_version` being content-addressed, not merely a request counter).

## 8. Create-next-revision idempotency: reasoned from deterministic numbering

**Re-examining whether `created_via_operation_id` is actually necessary.**
Given source Revision N (submitted), the target Revision number is
deterministic: `N.revision_number + 1`. Under the locked model, a Revision
is only ever created by this one path (send-back from a submitted
Revision); there is no other way `N + 1` could come to exist for that
Request. This means **existence of `N + 1` is itself the complete,
unambiguous idempotency signal**, with no separate key required.

**Design: `create_next_revision(request_id, source_revision_id, actor
context)`. No operation ID.**

1. Lock the parent `requests` row (the same single serialization point
   `create_form_version` already uses).
2. Check whether a Revision with `revision_number = source_revision
   .revision_number + 1` already exists for this `request_id`.
   - **If it exists:** this is, unconditionally, the already-created
     result of sending back this exact source Revision, because no other
     creation path could have produced a Revision at exactly that number.
     Return it as success, **regardless of its current status** (draft or
     already submitted by the time a delayed retry arrives): never create
     `N + 2`, and never treat a resubmitted `N + 1` as if it needed to be
     created again.
   - **If it does not exist:** verify `source_revision_id` actually
     identifies the Request's current most-recently-submitted Revision
     (`status = 'submitted'` and no Revision with a higher number already
     exists). If it does not (the caller's idea of "current" is stale,
     because a later Revision was already submitted through some other
     path), reject with a controlled `SOURCE_REVISION_NOT_CURRENT`-style
     error; this is a genuine business conflict, not a retry.
3. Allocate `revision_number = source_revision.revision_number + 1` under
   the lock already held, insert the new Draft seeded from
   `source_revision_id` (§10).

`unique (request_id, revision_number)` remains the database-level
backstop regardless of whether this function's own logic ever has a bug,
the same belt-and-braces pattern Form Versioning already established.

**No `created_via_operation_id` column is added.** Deterministic
numbering plus the existence check already gives exactly the retry
behavior required: return the existing `N + 1` on any retry, never create
`N + 2`, never silently treat a different, later operation as the same
transition.

## 9. Request creation: atomicity, concurrency, and its own idempotency

**Design: `create_request_with_draft(request_id, form_definition_id,
initial_raw_data, actor context)`.**

`request_id` is caller-generated (the browser or a future API mints a
UUID once, before the first attempt) and becomes, in one step, both the
Request's permanent Nexus identity **and** the natural idempotency key for
this creation operation; no separate `create_operation_id` is introduced,
because the identity the operation is creating already *is* the only key
this operation could ever need to check for a retry.

Inside one database transaction:

1. Lock the `form_definitions` row identified by `form_definition_id` (the
   same row `create_form_version`/`publish_form_version` already lock for
   their own operations, `docs/FORM_VERSIONING_MODEL.md` §9). If it does
   not exist, raise `FORM_DEFINITION_NOT_FOUND`.
2. **Idempotency check:** if a `requests` row already exists with `id =
   request_id`:
   - If its `pinned_form_version_id` resolves to the same
     `form_definition_id` supplied here: this is a retry of an already-
     successful creation. Return the existing Request together with its
     Revision 1 (`select ... where request_id = ? and revision_number =
     1`). Nothing is re-created.
   - Otherwise: `request_id` collided with an unrelated Request (an
     essentially impossible but structurally checked case, a
     client-generated UUID reused for a genuinely different creation
     attempt). Reject with a controlled conflict; never silently proceed.
3. Locate the currently `published` Form Version for this Form
   Definition (item A). If none exists, reject (no scheduled-effective
   fallback, per item A).
4. Insert the `resources` row (`resource_type = 'request'`, `resource_id
   = request_id`).
5. Insert the `requests` row, `id = request_id`, pinned to the exact Form
   Version found in step 3.
6. Insert Revision 1: `status = 'draft'`, `revision_number = 1`,
   `row_version = 1`, `raw_data = initial_raw_data`, `effective_data =
   null`.
7. Return the Request and Revision 1.

If any step fails, nothing persists (one transaction, one RPC, the same
established pattern). No SQL is written here; this is the shape Stage
5B1C2 must satisfy.

**Concurrency interaction with Form Version publication.** Because this
operation locks the identical `form_definitions` row that
`publish_form_version` already locks to retire-and-publish
(`docs/FORM_VERSIONING_MODEL.md` §9), a new Request's Form Version
selection (step 3) can never interleave with an in-flight publish: the
Request creation deterministically pins either the version published
before this call acquired the lock, or the version published after it
released the lock, never a race-dependent half-state where, for example,
a Request appears pinned to a version that was simultaneously being
retired.

## 10. Copy-forward semantics

When Finance sends a Request back, Nexus creates Revision N+1 as a new
Draft (§8), seeded from submitted Revision N:

- **`raw_data`** copies forward verbatim as the new Draft's starting raw
  evidence. The user edits from there; nothing is pre-cleared.
- **`effective_data` does not copy forward at all; it starts `null`**
  (§6), because a Draft never has `effective_data` under any
  circumstance, regardless of how it was created.
- On resubmission (§7's `submit_revision`): applicability is
  re-evaluated, master references are revalidated, master snapshots are
  refreshed for that Revision specifically, system defaults are
  re-evaluated where applicable, material calculations are recomputed,
  and a brand-new `effective_data` snapshot is built from scratch.
  Revision N's own `effective_data` remains immutable historical evidence,
  untouched.

This is simpler and safer than carrying old authoritative results into a
new editable Revision: there is exactly one rule ("Draft `effective_data`
is always `null`, regardless of origin"), not a special case for
copy-forward-seeded Drafts versus freshly-created ones.

## 11. Constraints (conceptual, not SQL)

- `unique (request_id, revision_number)`.
- Partial unique index scoped to `where status = 'draft'` - at most one
  Draft Revision per Request (decision 12).
- Check: `status = 'draft'` implies `submitted_at is null and
  submitted_by is null and effective_data is null`; `status = 'submitted'`
  implies all three are not null.
- `revision_number >= 1`, `row_version >= 1`.

## 12. Submission Contract versioning

Unchanged from the prior revision: `submission_revisions
.submission_contract_version` is a plain integer, starting at `1`, set
once at creation, frozen at submission, independent of the Form Version
number, because the two evolve for entirely uncorrelated reasons (the
business form's own content, versus Nexus's own storage shape for
`effective_data`, §5). This document's own two simplification passes so
far, folding `calculated_summary` into `values` and removing operation-id
columns, are themselves concrete illustrations of the kind of shape change
`submission_contract_version` exists to eventually version, had either
happened after real submitted rows existed. No migration/conversion
infrastructure is designed or built here.

## 13. Future boundaries (explicitly not this stage)

Unchanged from the prior revision: the Form Data Source Resolver, actual
master lookups, and master validation/snapshot policy (5B1C2); Decision
Engine rule evaluation; Flowable process state, Send Back orchestration,
and approval routing; approval records/plans/decisions; attachments;
Commercial Master; Entitlement Ledger and Earned/Unbilled. This document
requires only that each future capability's eventual attachment point
already exists and stays stable: `master_ref.canonical_id`/`snapshot` for
5B1C2, `values`/`applicability` for the Decision Engine's result,
`is_active` staying coarse for Flowable, and an immutable
`submission_revisions.id` for approvals to reference.

## 14. Audit strategy (redesigned for proportionality)

**`requests`**: standard, unmodified generic full-row `audit_log` trigger
(`fn_audit_row('id')`). Rows carry only `pinned_form_version_id`,
`is_active`, and the standard metadata columns (`created_at`/`created_by`,
`updated_at`/`updated_by`); writes are infrequent (creation, and the
single `is_active` transition to `false`); there is no payload-size
concern at all for this table. No
targeted scoping needed.

**`submission_revisions`: does not use the generic `fn_audit_row`
mechanism at all.** Re-evaluating the prior revision's `WHEN`-scoped
generic trigger: it still captured the **complete** `raw_data`/
`effective_data` payload in `audit_log.after_value` at every Revision
creation and at every submission, because `fn_audit_row` always captures
the full row via `to_jsonb(row)`, with no column-level selection. For a
table whose two JSONB columns can grow large (`raw_data` from a long
multi-page form; `effective_data` from a form with many fields), this
duplicates a potentially large business payload into `audit_log` for
*every single Revision*, materially different from every other audited
table in this schema so far, where full-row capture is always small.
CFO-control proportionality (`docs/guide/NEXUS_PRINCIPLES.md` Principle
7) requires evidence proportionate to actual risk, not maximized log
volume for its own sake; the immutable `submission_revisions` row is
already the durable, authoritative payload evidence, so duplicating it a
second time in full serves no evidentiary purpose the immutable row does
not already serve.

**Design: a dedicated, narrow audit trigger function specific to this
table, not `fn_audit_row`.** Same attachment shape as before (`after
insert or update`, `when (tg_op = 'insert' or old.status is distinct from
new.status)`), same underlying mechanism for everything except the
payload: it still reads the standard actor/request/context GUCs
(`docs/DATA_ARCHITECTURE.md` §9), still writes to the single `audit_log`
table, still gets an `audit_sequence` and `db_role` the same way every
other audit row does. It differs only in what `before_value`/
`after_value` contain: a small, explicitly named object, never
`to_jsonb(row)`:

```
before_value / after_value (submission_revisions audit rows only):
{
  "id": "...",
  "request_id": "...",
  "revision_number": 2,
  "status": "submitted",
  "row_version": 4,
  "submission_contract_version": 1,
  "submitted_at": "...",
  "submitted_by": "..."
}
```

`raw_data` and `effective_data` are never included in this object, on
either creation or the submit transition, under any circumstance; this is
a deliberate, explicit, and permanent exception to the generic audit
mechanism, not a silent gap, and it is the one and only table in the
schema where the generic mechanism is not used, precisely because it is
the one table whose payload columns are exceptional in size. The
immutable `submission_revisions` row remains the authoritative,
queryable evidence of the actual submitted content; `audit_log` proves
*that* the transition happened, who did it, and when, without duplicating
*what* was submitted a second time.

**Send Back** remains a process/workflow event, not a Revision-table
mutation, exactly as before: creating Revision N+1 is a normal audited
`INSERT` (small, metadata-only, per the design above); the *reason*
Finance sent the Request back belongs to a future domain event and,
eventually, Flowable's own process history, never hidden inside a
Revision row mutation.

## 15. Human UX implications (no screens designed)

Unchanged in substance from the prior revision, restated against the
simplified model:

- A user sees **"Request #123, Revision 2"** as one continuous identity.
  "Revision 2" is obtained by the UI's own query for the highest
  `revision_number` (§3), not a stored pointer.
- **"What changed since Revision 1"** is answerable by diffing two
  immutable `effective_data.values` documents, already containing only
  authoritative fields, no hidden-field filtering needed first.
- **"Draft saved"** is a Draft-Revision-level fact (`updated_at`/
  `row_version`), independent of process-level messaging.
- The pinned Form Version is not surfaced prominently; it exists for
  correctness (item A/B), not display.
- A reviewer can determine current Revision, previous submitted Revision,
  what changed, who submitted, when, where the Request is in process, and
  whether they need to act, from data this model provides or explicitly
  defers to a named future capability.
- This preserves the permanent Nexus rule
  (`docs/guide/NEXUS_PRINCIPLES.md` Principle 6).

## 16. CEO / CFO signal readiness

Unchanged in substance: how many Requests were sent back, how many
revisions are usually required, where value materially changes after
send-back, which forms generate the most corrections, approval cycle time
by revision, how often calculated values change on resubmission, and what
is stuck, are all answerable by structured queries over
`requests`/`submission_revisions` (using `is_active` and
`max(revision_number)` in place of the removed `status`/
`current_revision_id`) plus future domain-event/workflow history, with no
UI-text parsing or SurveyJS-internals knowledge required.

## 17. Library evaluation

**Verdict: BUILD.** Unchanged: this is Nexus's own Finance-control
contract, built on the Resource Registry and Form Versioning, both
already Nexus-owned for the same reason (`docs/guide/NEXUS_PRINCIPLES.md`
Principle 1). No mature library understands Nexus's specific audit,
provenance, and approval-binding requirements without distorting its own
object model into a de facto Nexus contract, the anti-pattern Principle 3
forbids.

## 18. Proposed future database shape (not SQL, not a migration)

**MUST HAVE NOW** (final, minimal, every column justified above):

```
requests                                            -- id = resource_id
  id                      uuid   references resources(resource_id)
  pinned_form_version_id  uuid   references form_versions(resource_id)
                                 -- never changes (item B); must reference
                                 -- a row with status = 'published' at
                                 -- insert time (item A)
  is_active               boolean not null default true
                                 -- true -> false only, never reverses
  created_at, created_by, updated_at, updated_by     -- standard columns

submission_revisions
  id                          uuid   primary key
  request_id                  uuid   references requests(id) on delete restrict
                                     -- never changes
  revision_number              integer, never changes, unique per request_id
  status                      text   check (status in ('draft','submitted'))
  row_version                  integer, default 1, database-maintained,
                                     -- increments by exactly 1 on every UPDATE
  submission_contract_version integer, not null, default 1, never changes
  raw_data                    jsonb, not null          -- evidence only, §5
  effective_data               jsonb, null while draft, not null once submitted
  created_at, created_by, updated_at, updated_by       -- standard columns
  submitted_at, submitted_by   -- null until submitted, populated exactly once

  unique (request_id, revision_number)
  partial unique index on (request_id) where status = 'draft'
  check: draft <=> (submitted_at is null and effective_data is null)
```

No table for revision diffs, individual answers, process state,
approvals, attachments, or an idempotency-key ledger is proposed; each was
evaluated and found unnecessary (§7-9, §13) or belonging to a distinct,
later-owned capability.

**DEFER:**

- Any table or column for Request-level or Revision-level *process*
  state (Flowable's own tables, §13).
- Any table for approval evidence (§13).
- A `revision_number` sequence table or counter column; recomputing the
  maximum under lock is the same deliberate choice already made for Form
  Version.
- A persisted lineage column (`seeded_from_revision_id`); §8 shows it is
  fully derivable and unnecessary even for idempotency.
- Any operation-id column; §7-8 show none is required.
- A `form_field_identities`-style cross-Form-Version field mapping
  (decision 55).

## 19. Final database invariants

**Request:**

- `resources.resource_type = 'request'` for this row's `resource_id`
  (item, mirroring `fn_assert_resource_type`).
- `pinned_form_version_id` immutable after insert (item B).
- `pinned_form_version_id` must reference a Form Version that was
  `status = 'published'` at the moment this Request was created (item A).
- `is_active`: `true -> false` only, never reversed.
- No `DELETE`, ever, under any application role.

**Submission Revision:**

- Belongs to exactly one Request (`request_id`, never changes).
- `unique (request_id, revision_number)`.
- `revision_number >= 1`.
- At most one `status = 'draft'` row per `request_id`.
- `row_version` starts at 1, increments by exactly 1 on every `UPDATE`,
  never settable to an arbitrary caller-supplied value.
- `draft` rows may be edited (content columns only, under the
  `expected_row_version` precondition).
- The only permitted status transition is `draft -> submitted`, exactly
  once; no transition exists out of `submitted`.
- `effective_data` must be `null` while `draft`, and non-null exactly
  once `submitted`.
- `submitted_at` and `submitted_by` are populated together, exactly once,
  in the same transaction that sets `status = 'submitted'`.
- No `DELETE`, ever, under any application role, in any status.

No Flowable process state is encoded in either table.

## 20. Open questions

None. Every question the prior two revisions raised is now resolved by
simplification rather than left open: `requested_by` was removed
entirely (prior pass); the closed-without-submitting case needs no
dedicated marker (`is_active = false` plus the absence of any `submitted`
Revision already answers it, unchanged from the prior pass); and this
pass resolves both remaining idempotency questions by showing the
persisted columns they seemed to require are not actually necessary. The
exact SQLSTATE/error-code conventions for the controlled conditions named
above (`FORM_DEFINITION_NOT_FOUND`, `SOURCE_REVISION_NOT_CURRENT`, the
request-creation ID-collision conflict, `DRAFT_CHANGED`,
`REVISION_NOT_DRAFT`-equivalent) belong to the future Stage 5B1C1 database
implementation (Request/Submission persistence itself), not to Stage
5B1C2 (the Form Data Source / Master Data Resolver stage). This is the
same category `docs/FORM_VERSIONING_MODEL.md` §22 already left to its
own implementation stage, not a design gap.

## 21. What this document is not

Not a migration. Not an implementation. Not a decision on the Form Data
Source Resolver, Commercial Master, Decision Engine, Flowable, approval
evidence, or attachments. Every schema shape above is a proposal for
Stage 5B1C2 to translate into SQL.
