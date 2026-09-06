# Nexus: Platform Architecture

This document defines the Nexus Platform Core: the shared foundation every
feature module builds on. It extends `docs/ARCHITECTURE.md` (folder
structure and dependency direction) with the platform capabilities
themselves. It contains no business rules and no real company data.

**Status: locked design.** The architecture in this document, together
with `docs/DATA_ARCHITECTURE.md`, `docs/AUTHORIZATION_MODEL.md`, and
`docs/EVENTS_AND_NOTIFICATIONS.md`, is the agreed foundation for
implementation. It has not been implemented yet. No table, migration, or
package referenced here exists in the codebase.

## 1. Why a platform core

Nexus will grow from a handful of modules into a large, long-lived internal
system. Every module that needs approvals, configuration, audit history,
or notifications attaches to one shared implementation rather than
reinventing it. That shared implementation is the platform core, and it
exists to answer one question consistently everywhere in Nexus: who can do
what, to which record, and what happens as a result.

## 2. Layered architecture

Business logic does not live directly inside React components, pages, or
raw database calls. Every feature is structured in layers:

```
UI (components, pages)
  -> application services (use cases, orchestration)
    -> domain logic (business rules, validation, state transitions)
      -> repositories / data access
        -> database
```

- **UI** renders state and captures intent. It calls application services;
  it never contains business rules and never calls the database directly.
- **Application services** orchestrate one use case (for example, "submit a
  record for review"). They own authorization checks, transaction
  boundaries, and coordination of domain logic, repositories, workflow, and
  event emission for that use case.
- **Domain logic** is the business rules and validation for a feature:
  pure, testable, and free of transaction or infrastructure concerns, so it
  behaves identically regardless of caller.
- **Repositories** are the only code that talks to the database for a
  given entity, translating between domain shapes and storage shapes.

The same application/domain layer is callable from more than one entry
point over time: the web UI, a future API, scheduled jobs, and inbound or
outbound integrations. External callers sit behind a thin **adapter
layer** that owns protocol-specific concerns (request parsing, payload
mapping, retries) and translates into the same command an application
service already accepts from the UI:

| Layer | Owns |
|---|---|
| External adapter (API, webhook, job, import) | Protocol/format concerns, payload mapping, retry and backoff scheduling |
| Application service | Authorization checks, transaction boundaries, idempotency (where a caller supplies a key), orchestration of domain + repository + workflow + event emission |
| Domain logic | Business invariants and validation, independent of caller |
| Repository | Persistence mechanics only |

Idempotency-key handling is a named capability of the application-service
boundary, not something each integration invents. It is not built until
the first external caller that needs it exists; see §12.

This layering is a target discipline for new code, introduced when the
first non-trivial workflow needs it, not a scaffold built empty ahead of
need.

## 3. Resource Registry

Workflow, tasks, audit, events, attachments, comments, and notifications
all need to attach to "any business record" without depending on every
feature's tables. Nexus solves this once, with a central Resource
Registry, instead of an ad hoc `entity_type + entity_id` pair repeated in
every capability.

A business record that needs any platform capability is minted a
`resource_id` and reuses that same value as its own primary key. The
registry itself stays deliberately thin: `resource_id`, `resource_type`,
`created_at`, `created_by`. It never gains a status, a title, or any
feature-specific metadata; the moment it does, it has become the
ungoverned dumping ground this design avoids. Full schema in
`docs/DATA_ARCHITECTURE.md` §2.

Reference and master data tables that carry no workflow, audit, task, or
event relationship do not register in the Resource Registry.

**Evidence anchor.** A future attachments or evidence table needs exactly
one thing to attach cleanly to a resource, approval, task, workflow
instance, or exception: a stable identity to reference. The Resource
Registry already provides that. No schema change is needed now to support
future evidence; the anchor already exists and is deferred to
implementation, not design.

**Data lineage (future pattern, not implemented).** A record in Nexus may
eventually be manually entered, imported by file, received through an
API, synchronized from an external system, or derived by Nexus itself.
Source columns are not added to every table now, speculatively; where a
record came from is not yet a question any real feature needs answered.
When the first integration or import feature is built, provenance is
recorded then, either as columns on that specific feature table or as a
thin companion table keyed by `resource_id` if more than one feature ends
up needing the same shape. Deciding the general provenance pattern now,
before a real integration exists to validate it against, would be
designing for a feature that does not exist yet.

## 4. Platform capabilities

| Capability | Responsibility | Detailed in |
|---|---|---|
| Resource Registry | Stable, type-tagged identity for anything platform capabilities attach to | `docs/DATA_ARCHITECTURE.md` §2 |
| `permissions` | Users, roles, permissions, scoped access | `docs/AUTHORIZATION_MODEL.md` |
| `policy` | Configuration, reference data, business rules that change without a deploy | §5 below, `docs/DATA_ARCHITECTURE.md` §8 |
| `workflow` | Maker-checker state machine, transitions | §6 below |
| `tasks` | Persistent, assignable units of expected work | §6 below |
| `audit` | Database-enforced change history | §7 below, `docs/DATA_ARCHITECTURE.md` §9 |
| `events` | Domain event emission and storage | §7 below, `docs/EVENTS_AND_NOTIFICATIONS.md` |
| `notifications` | Rules, recipient resolution, delivery | `docs/EVENTS_AND_NOTIFICATIONS.md` |
| `attachments` | File upload and storage handling | (unchanged from `docs/ARCHITECTURE.md`) |

A feature depends on these capabilities and never reimplements one. They
must not contain feature-specific business rules: `workflow` knows how to
move a generic instance between states; it does not know what any specific
business process means.

## 5. Settings and configuration

Nexus distinguishes structural system behaviour, which belongs in code,
from business configuration, which belongs in data. The risk runs both
ways: a value with no real owner and no stated reason to change is a code
constant, not a configuration row.

**Configurable does not mean schemaless.** Generic storage is used only
where the underlying shape is genuinely generic (reference/master data) or
where a mandatory typed catalog governs what can exist (policy). Every
other category of configuration is a properly typed relational structure.

| Category | Shape | Governance |
|---|---|---|
| Reference / master data | Generic (code, label, active, sort order) | Uniform across many lists; the one legitimate generic case |
| Policy configuration | Generic scalar value, gated by a required definition | A key cannot hold a value until a catalog row declares its type, owner, default, validation, and whether it needs approval |
| Workflow configuration | Relational (definitions, states, transitions) | Real structure and relationships; never key-value |
| Notification configuration | Relational (event type, template, recipient strategy), condition may be JSON where it genuinely varies by event type | Rules have structure worth typing |
| Authorization configuration | Relational, never generic | Security-critical; needs real FK integrity |
| Integration configuration | Narrow, per-integration generic settings; the set of integrations itself is relational; credentials live in a separate secret store, out of scope here | Same registration discipline as policy if integrations multiply |
| System / environment configuration | Deploy-time values are environment configuration, not database rows; runtime admin-changeable toggles are a subtype of policy | Governed like policy, never a second ungoverned table |
| User preferences | Its own small table, lightweight key registry | Lighter governance than policy; blast radius is one user's own experience |

Full table shapes in `docs/DATA_ARCHITECTURE.md` §8.

## 6. Workflow, tasks, and their relationship to events

Multiple features need maker-checker approval, and multiple features need
a work queue. Nexus has one workflow engine and one task concept, not one
per feature.

- A **workflow definition** describes a named set of states and permitted
  transitions, independent of any specific feature.
- A **workflow instance** is one running occurrence of a definition,
  attached to exactly one resource.
- **Transitions** move an instance between states and are where
  maker/checker responsibility, comments, send-back, and resubmission are
  recorded.
- A **task** is a persistent, assignable unit of expected work, attached to
  a resource, optionally linked to the workflow instance that produced it.
  A task is not the same thing as a notification: see §8.

Relationships between the four moving parts:

```
domain event      -> may create a task (via a rule, same pipeline as notifications)
workflow transition -> may create or close a task
task completion    -> may trigger a workflow transition
task              -> may generate notifications
```

Completing a task's action and executing the workflow transition it
represents happen inside one application-service call; they are not two
independently coordinated things that happen to line up.

**My Work** is tasks whose assignee resolves to the current user (directly,
or via a role and scope they hold), filtered by what that user is
authorized to actually do with each, and enriched with resource and
workflow state for display. This is why My Work is not hand-assembled per
feature: once `tasks` exists as a platform concept, every feature that
uses workflow produces My Work entries for free.

Escalation, branching, and parallel-approval workflow shapes are
explicitly deferred; see §12. `tasks` is deliberately not a general task
management product: no subtasks, no arbitrary personal to-do items, no
kanban boards, no dependency graphs.

### Segregation of duties (future pattern, not implemented)

Nexus is a Finance platform subject to internal and statutory audit.
When the workflow engine is built, it must be able to enforce, not merely
suggest through UI, patterns such as:

- a maker cannot approve their own submission,
- approval authority depends on the approver's permission and scope
  (`docs/AUTHORIZATION_MODEL.md`), not on who happens to be looking at the
  screen,
- certain transitions require a reason before they can proceed,
- certain transitions require evidence to be attached before they can
  proceed, and
- an override of a normal rule requires a separate authority from the
  authority that made the original decision.

These are workflow-engine requirements to design for when the workflow
engine is built (§6 above), not a reason to build workflow now. A disabled
button is a UX convenience; the actual control is the transition being
rejected by the engine regardless of what the UI allowed someone to click,
the same principle already established for authorization in
`docs/AUTHORIZATION_MODEL.md` §6.

### Approval evidence (future pattern, not implemented)

When a workflow transition represents an approval, the record it produces
must eventually preserve, without ambiguity, even after the underlying
business record is later amended: the approver's identity, the approval
time, which workflow instance and task it belongs to, the exact resource
and version approved (the amendment model in
`docs/DATA_ARCHITECTURE.md` §7 is what makes "exact version" answerable
later), the action taken, any comment or reason, any evidence reference,
and the authority/scope context the approver acted under. This shape is
recorded here so the first workflow implementation does not invent its
own, not because approval tables are being built now.

### Exceptions and overrides (future pattern, not implemented)

The same reasoning applies to rule exceptions. When a business rule can be
overridden, the future record of that override must preserve: which rule
was violated, who requested the override, who approved it, the reason,
any evidence, the date and time, which version of the rule or
configuration was in effect, and the result. No exception-management
system is built now; this is the shape a future one must follow.

## 7. Audit and domain events are not the same thing

**Audit-readiness principle.** Every material business action must leave
enough durable evidence for a reviewer who was not present at the time to
understand: what happened, who performed it, who authorized it where
applicable, when it happened, what changed, what rule or configuration
applied, what evidence supported it where applicable, and why an
exception or override occurred where applicable. Controls are enforced by
the platform wherever practical, rather than relying on a person
remembering the process. This principle governs every section below and
every future feature.

These are two different mechanisms and must not be confused:

- **Audit** is a database-enforced record of *mutation*: who changed which
  row, when, and what the before/after values were. It must not depend on
  every application-service author remembering to write an entry. Nexus
  uses reusable PostgreSQL trigger functions, attached through migrations
  to every table holding business or configuration state, so a write is
  captured regardless of whether it originated from the UI, an API, a
  scheduled job, an integration, a bulk import, or any other trusted path.
  Application code supplies acting-user context into the transaction where
  the database cannot infer it. Full mechanism in
  `docs/DATA_ARCHITECTURE.md` §9.
- A **domain event** is an application-layer record of *business meaning*:
  "a record was submitted for review," not "a row was updated." Domain
  events are emitted deliberately by application services as part of
  handling a use case, and are what the notification pipeline reacts to.
  Full model in `docs/EVENTS_AND_NOTIFICATIONS.md`.

A single business action typically produces both: the database trigger
captures the row mutation, and the application service separately emits
the domain event that carries business meaning. Neither replaces the
other.

Approved records are not silently overwritten. Once a record has passed
approval, a further change is an amendment, a new linked entry that
preserves the original rather than replacing it in place; see
`docs/DATA_ARCHITECTURE.md` §7 and §9.

**Ordering.** `audit_log` carries a monotonically increasing sequence
number in addition to its UUID primary key, because multiple changes
inside one transaction can share an identical `occurred_at` timestamp and
neither a UUID nor a timestamp alone can tell a reviewer which of two
audit rows happened first. See `docs/DATA_ARCHITECTURE.md` §9.

**Actor and context trust contract.** The audit mechanism accepts
`app.current_user_id`, `app.request_id`, and `app.actor_context` from
transaction-local settings, and this is only safe because of who is
allowed to set them. Only the application-service layer sets
`app.current_user_id`, and only after it has independently verified the
caller's identity from a trusted, authenticated session (never from a
value a client claims in a request body or header). A client cannot claim
to be another user and have that accepted as audit identity; the
authenticated session is the sole source of truth for "who." The
application-service layer likewise generates `app.request_id` per
request, job run, or integration call, and sets a small, structured
`app.actor_context` (for example, role or workflow context relevant to the
action), never an arbitrary dump of request data. Where actor identity
cannot be validly established (a system-originated write with no
authenticated user behind it), `app.current_user_id` is left unset and
`actor_user_id` is `NULL`, which is a valid, meaningful audit state, not
an error. `audit_log` also captures the database session role that
performed the write, a small piece of technical origin metadata that
costs nothing and helps a reviewer distinguish the trusted application
path from any other origin.

**Audit data sensitivity.** `audit_log` stores full before/after row
values as JSON, which means anything that ends up in an audited table's
row ends up in the audit trail too, permanently and without redaction.
The rule this creates is not something to fix in the audit layer: secrets,
credentials, and similarly sensitive values must never be stored in an
ordinary audited application table in the first place. Integration
credentials belong in a dedicated secret mechanism (out of scope for now,
see `docs/DATA_ARCHITECTURE.md` §8), referenced by configuration, never
embedded in it or in any table the generic audit trigger is attached to.

## 8. Eight platform concepts

These concepts interact constantly and must never collapse into one
role/access system:

| Concept | Answers | Owned by |
|---|---|---|
| Identity | Who is the user? | Supabase Auth, mirrored 1:1 into `app_users` (`docs/DATA_ARCHITECTURE.md` §2) |
| Authorization | What is the user permitted to do, in general? | `docs/AUTHORIZATION_MODEL.md` |
| Assignment | Which specific piece of work belongs to this user right now? | `tasks` |
| Workflow | What state is a process in, and what transitions are legal? | `workflow` |
| Task / Work Item | What persistent action is someone expected to complete? | `tasks` |
| Domain event | What immutable business fact occurred? | `events`, `docs/EVENTS_AND_NOTIFICATIONS.md` |
| Notification | What should someone be made aware of? | `notifications`, `docs/EVENTS_AND_NOTIFICATIONS.md` |
| User preference | How does this user want their experience configured? | Configuration (§5) |

Permission to approve a resource does not automatically mean that resource
is assigned to that person, and does not automatically mean it appears in
their My Work queue. Authorization is a general capability check; task
assignment is a specific, concrete fact about one resource right now; a
notification is independent of both (an interested observer can be
notified without being assigned or specially authorized); a preference
only changes how something is delivered or presented, never what anyone is
allowed or assigned to do. My Work is built by joining task assignment
with authorization at query time, never by storing one inside the other.

## 9. Integration and API architecture

No API is built at this step. The layering in §2 exists specifically so
that adding a public or internal API later, or consuming an external API,
means adding a new adapter that calls existing application services, not
rewriting business logic out of the UI. When an API is eventually built,
it is versioned from its first version, and inbound/outbound webhooks are
a delivery channel for domain events, conceptually no different from an
email notification channel. API callers are authorized through the same
resource + action + scope model as the UI, never a parallel permission
system.

## 10. Modularity

The dependency direction from `docs/ARCHITECTURE.md` continues to apply:
features depend on platform capabilities and never reimplement one;
features never import another feature's internals; platform capabilities
stay feature-agnostic; a feature should be deletable without breaking
another feature. This is what allows dozens or hundreds of future modules
without the codebase becoming tangled: every module is shaped the same
way, depends on the same small set of platform capabilities, and never
depends on another module directly.

## 11. UX architecture

Access control, workflow state, and UX are designed together. A record's
screen is not required to look identical to every role: available
actions, defaults, and information priority can differ between a maker, a
checker, and an observer, driven by the same permission and workflow-state
data that governs what they are allowed to do, not encoded per screen.
`docs/UI_SYSTEM.md` defines the visual language this runs on; this section
is about what is shown, not how it is styled.

## 12. What we are explicitly not building yet

The platform core is designed so each of these can be added later without
a redesign. None of them are built now:

- Organization/scope hierarchy beyond global scope
  (`docs/AUTHORIZATION_MODEL.md` §5), and any closure table over it.
- Branching or parallel-approval workflow shapes; the first workflow
  definition is linear (submit, review, approve or send back), and is
  seeded through a migration rather than authored through a workflow
  designer UI, which is not being built.
- Expressing the complete authorization model as PostgreSQL RLS policies;
  RLS stays a defense-in-depth boundary while primary enforcement remains
  in the application-service layer (`docs/AUTHORIZATION_MODEL.md` §6,
  `docs/DATA_ARCHITECTURE.md` §12).
- Notification digests, escalation, deduplication, severity, and
  acknowledgement, and any delivery channel beyond in-app.
- A public or internal API, and any webhook product built on top of it.
- Idempotency-key infrastructure, built only when the first external
  integration needs it.
- A generic task-management product: subtasks, kanban, dependency graphs,
  arbitrary personal to-do items.
- A generic search platform.
- A configuration UI for values that have no real business owner yet.
- The append-only amendment pattern and effective dating, applied only
  when a real feature needs them.
- Approval, exception/override, and evidence/attachment tables (§6
  patterns defined, nothing implemented).
- Any source/provenance columns or table, decided at the first
  integration or import feature, not before (§3).
- A dedicated secret-management mechanism for integration credentials
  (§7); credentials simply do not exist as configuration yet.

Preserving the extension path for each of these is a design decision made
now. Building any of them is a decision deferred until a real feature
requires it.

## 13. Stage 5B technology boundaries (accepted, not implemented)

Nexus has accepted the following external-technology boundaries for the
next stage. None of them are installed, configured, or implemented as of
this document; recording the boundary now is what lets each be adopted
later without renegotiating what it is responsible for.

**SurveyJS** owns configurable form definitions: field rendering,
validation, conditional visibility and requiredness, sections, and form
versions. SurveyJS is not the authoritative Finance data model; material
Finance facts remain modeled relationally, per
`docs/DATA_ARCHITECTURE.md`, regardless of how a form collected them.

**Flowable** is the primary engine for human and business-process
workflow: routing, send-back, reject, resubmit, request-information,
reassignment, escalation, multi-level approvals, approval routing, and
configurable business routing rules (decision tables). Flowable is the
concrete technology that will eventually implement the workflow concept
already defined in §6; it does not change that concept, and the
segregation-of-duties, approval-evidence, and exception patterns already
defined there apply to whatever Flowable orchestrates.

**Temporal** owns durable technical and system orchestration: external
API calls, retries, long-running system jobs, scheduled and bulk
processing, reliable integration execution, and future AI orchestration.
Temporal must not duplicate Flowable's human-approval or business-process
state. The permanent boundary: Flowable is human/business process
orchestration; Temporal is technical/system orchestration. Nexus itself
remains the system of record for Nexus business data and audit/control
evidence regardless of which engine is driving a given action; both
ultimately act through the same application-service layer (§2), not
around it.

**Notification Engine** remains a Nexus platform capability, not
delegated to either external engine. Flowable, Temporal, and Nexus domain
actions may all emit events; the Notification Engine (§7,
`docs/EVENTS_AND_NOTIFICATIONS.md`) is what resolves recipients,
relevance, channel, template, and timing, regardless of which of the
three raised the underlying event. Channels will eventually include
in-app, email, and Google Chat, with more added later. Temporal may
eventually execute the reliable delivery/retry mechanics for a
notification, but notification policy, what fires, to whom, and through
which channel, belongs to Nexus, never to the delivery engine.

**AI** will eventually be reached through a provider-independent service
boundary. Business features must not directly depend on a specific
provider's SDK (OpenAI, Anthropic, or otherwise); the boundary exists so
the provider can change without every feature that uses AI changing with
it. Whatever that boundary looks like, any AI-initiated action must still
respect the same controls as a human-initiated one: authorization
(`docs/AUTHORIZATION_MODEL.md`), audit (§7), data classification, human
approval where required, model/provider provenance, secret management,
and rate/cost controls. No AI capability is implemented now.

## 14. Non-goals for this document

This document does not define database schemas
(`docs/DATA_ARCHITECTURE.md`), the authorization data model in detail
(`docs/AUTHORIZATION_MODEL.md`), or the event and notification data model
in detail (`docs/EVENTS_AND_NOTIFICATIONS.md`). It contains no real Nexus
business rule, workflow, or role name; every example in these four
documents is illustrative.
