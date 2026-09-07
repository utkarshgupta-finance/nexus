# Nexus Engineering Principles

This is the technical translation of `docs/guide/NEXUS_PRINCIPLES.md`,
for engineers, architects, technical reviewers, coding agents, and any
future application consuming Nexus's own architecture documentation. It
does not repeat the plain-English document; read that first for the
reasoning, this document for the engineering implications.

These eight principles are permanent. Individual technology choices,
services, and schemas built under them are not; they are expected to
change as Nexus grows.

## 1. Library-first

**Engineering interpretation.** Before implementing a substantial
horizontal capability, perform a technology/library evaluation of mature
reusable or open-source solutions before writing bespoke infrastructure
for it (`docs/PLATFORM_ARCHITECTURE.md` §1). Nexus's own engineering
effort goes toward Bizom-specific business logic, Finance processes,
controls, canonical data models, integrations, and audit/provenance, not
toward rebuilding commodity infrastructure.

**Required architectural behavior.**
- A recorded evaluation (functional fit, architecture fit, licensing,
  security, auditability, self-hosting/deployment, maintainability,
  extensibility, vendor lock-in, data ownership, integration complexity)
  before adopting or building a horizontal capability.
- The adopted technology sits behind a Nexus-owned adapter (Principle
  3), never wired directly into feature code.
- The outcome is one of: adopt, adopt with a Nexus wrapper, use only as
  a UI/engine component, or build. All four are legitimate outcomes.

**Anti-patterns.**
- Building a custom BPMN editor or workflow engine before evaluating
  mature workflow tooling.
- Adopting a library because it's popular, without checking licensing,
  security posture, or whether it fits Nexus's audit requirements.
- Scattering direct calls to a third-party SDK across multiple feature
  modules instead of behind one adapter.

**Review questions.**
- Has a real evaluation happened, or is this the first library anyone
  searched for?
- Where is the adapter boundary, and does feature code depend on it or
  on the vendor SDK directly?
- Is the licensing and hosting model actually compatible with a
  Finance-audited, public-repository project?

## 2. API-capable by default

**Engineering interpretation.** Every capability is built through the
layered architecture already defined in `docs/PLATFORM_ARCHITECTURE.md`
§2: `UI -> application services -> domain logic -> repositories ->
database`. A future API, webhook, scheduled job, integration, or AI
agent reaches the same application/domain capability the UI already
calls, through the same external-adapter pattern already described
there, never a second, parallel implementation of the same business
rule.

**Required architectural behavior.**
- Business rules and authorization checks live in the application
  service layer, never in a UI component, and never duplicated in a
  second entry point.
- A new caller (API, job, integration) is a thin adapter translating its
  own protocol into the same command an application service already
  accepts from the UI (`docs/PLATFORM_ARCHITECTURE.md` §2).
- Idempotency-key handling, where a caller needs it, is a capability of
  the application-service boundary, not something each integration
  invents for itself.

**Anti-patterns.**
- Business rules embedded inside a React component or a route handler.
- A second, slightly-different implementation of a use case built
  specifically for an API, diverging from what the UI does.
- An integration reading from or writing to Nexus tables directly,
  bypassing the application-service layer entirely.

**Review questions.**
- If a second caller needed this capability tomorrow, would it call the
  same application service, or would someone have to duplicate logic?
- Is authorization enforced in the application service, or only assumed
  because "the UI already checked it"?

## 3. Nexus-owned contracts

**Engineering interpretation.** External engines and libraries (SurveyJS,
Flowable, Temporal, a future entitlement engine) do real work, but the
concepts other code, other systems, and other people interact with are
Nexus's own: Form, Request, Workflow, Approval, Entitlement
(`docs/PLATFORM_ARCHITECTURE.md` §13, `docs/FORM_VERSIONING_MODEL.md`
§1). This is the ports-and-adapters pattern applied consistently: Nexus
defines the port (its own interface/contract); each external technology
is one adapter implementation behind it.

**Required architectural behavior.**
- No external engine's internal object model, ID scheme, or API shape
  leaks into a public Nexus contract.
- Where Nexus needs to own the canonical persistence model for
  something an external engine also has an opinion about (for example, a
  Form Version's identity and lifecycle, versus SurveyJS's own JSON
  schema, `docs/FORM_VERSIONING_MODEL.md` §1, §4), Nexus's own model is
  authoritative; the external engine's artifact is configuration or
  execution detail underneath it.
- A migration path off any one external technology must remain
  realistically possible without a rewrite of the business domain.

**Anti-patterns.**
- A client (internal or external) depending directly on a workflow
  engine's process-instance internals instead of a Nexus `Workflow`
  concept.
- Exposing a third-party engine's native error codes or object shapes
  as if they were Nexus's own API contract.

**Review questions.**
- If this external technology were replaced next year, what would break
  outside its own adapter?
- Does anything outside the adapter know this technology exists at all?

## 4. Documentation as code

**Engineering interpretation.** Git is the source of truth. Markdown/MDX,
architecture-as-code, Mermaid diagrams, ADRs, OpenAPI specs, SQL
migrations, and source code are all first-class, machine-readable
documentation artifacts; a documentation portal, if one exists later, is
a rendering of them, never itself the canonical source
(`docs/DOCUMENTATION_STRATEGY.md`).

**Required architectural behavior.**
- Documentation changes land in the same lifecycle as the capability
  change they describe, not as a separate, deferred effort.
- A meaningful architectural decision gets an ADR at the time it's
  accepted (`docs/DOCUMENTATION_STRATEGY.md`), not reconstructed later
  from memory or chat history.
- API documentation is generated from or kept alongside an OpenAPI
  contract once an API exists, not written free-hand and left to drift.

**Anti-patterns.**
- A decision explained only in a chat thread or a meeting, never
  written down in the repository.
- A documentation site treated as editable independent of the Markdown
  source that supposedly generates it.
- Rewriting all existing documentation to a new standard before writing
  any new capability, instead of letting documentation catch up
  progressively.

**Review questions.**
- If this PR merged with no documentation changes, could the next
  engineer (or agent) reconstruct why it was built this way?
- Is there a decision here material enough to deserve its own ADR?

## 5. Scale-ready, not scale-heavy

**Engineering interpretation.** Build for today's actual load; protect
only the things that are genuinely expensive to retrofit later
(`docs/PLATFORM_ARCHITECTURE.md` §1, §12). Avoid premature distributed-
systems complexity that today's workload does not justify.

**Required architectural behavior.**
- Durable, stable identifiers minted once and never reused (the
  Resource Registry pattern, `docs/DATA_ARCHITECTURE.md` §2).
- Clean module/domain boundaries (`docs/ARCHITECTURE.md`,
  `docs/PLATFORM_ARCHITECTURE.md` §2).
- Transactional correctness for business-critical writes, using the
  simplest mechanism that is genuinely atomic
  (`docs/FORM_VERSIONING_MODEL.md` §9 is a concrete example: a single
  database function, not a distributed transaction, because that is
  what the actual current architecture can support and the actual
  current load requires).
- Idempotency where a caller genuinely needs it, not speculatively
  everywhere.
- Pagination and indexing decided by real query patterns
  (`docs/DATA_ARCHITECTURE.md` §5), not guessed in advance.
- Versioned configuration and effective dating where history must be
  reconstructable (`docs/DATA_ARCHITECTURE.md` §7).
- An adapter seam around every external engine (Principle 3), so scaling
  or replacing it later doesn't ripple through the domain model.

**Anti-patterns.**
- Introducing a message queue, a second microservice, or a distributed
  cache for a workload one well-indexed table already serves fine.
- Skipping a durable identifier or a clean module boundary "to move
  faster," when those are exactly the two things hardest to retrofit.
- Designing an elaborate horizontal-scaling story for a capability with
  no real traffic yet.

**Review questions.**
- Does this decision protect something expensive to fix later, or add
  complexity nothing currently needs?
- If load grew 100x, would this need a redesign, or an addition (cache,
  queue, partition, replica) on top of what already exists?

## 6. Human simplicity over system complexity

**Engineering interpretation.** The system, not the user, absorbs
complexity. This has direct data and API implications, not just visual
design ones: the backend must expose enough structured information for
the UI to do progressive disclosure, pre-population, and clear
status/ownership without the UI having to reconstruct that meaning
itself (`docs/PLATFORM_ARCHITECTURE.md` §11).

**Required architectural behavior.**
- APIs and data models carry enough structure for a UI to show "where is
  this, what's next, who owns it, do I need to act" without ad hoc
  client-side inference (the Process Journey / Current-Next-Waiting-
  With-Your-Action pattern proven in Stage 5B1A,
  `docs/FORM_CAPABILITY_REGISTER.md`).
- No workflow requires a user to remember an out-of-band policy; the
  policy itself is data the system can present and check
  (`docs/PLATFORM_ARCHITECTURE.md` §5).
- Bulk/high-volume entry paths are supported where a persona genuinely
  needs them, not bolted on as an afterthought.
- Accessibility and keyboard behavior are functional requirements of the
  UI layer, not optional polish.

**Anti-patterns.**
- A status field that only makes sense if you already know the process
  by heart, with no structured "what's next" the UI can render.
- Forcing a high-volume user through the same multi-click flow designed
  for someone who does this once a year.
- Business-meaningful state stored only as unstructured free text a UI
  cannot summarize.

**Review questions.**
- Could a UI built against this data show "where/what's next/who/do I
  need to act" without guessing?
- Have we designed for the occasional user and the high-volume user
  separately, or assumed one persona for both?

## 7. CFO-control mindset

**Engineering interpretation.** Audit, provenance, and controlled
mutability are database-enforced defaults, not conventions hoping to be
followed (`docs/DATA_ARCHITECTURE.md` §9, §12, §13). This is already
Nexus's most concretely implemented principle: the generic audit
trigger, the historical-grant-record pattern, and the Form Version
lifecycle/immutability design are all direct expressions of it.

**Required architectural behavior.**
- Every business/configuration table gets database-enforced audit
  regardless of which code path wrote to it
  (`docs/DATA_ARCHITECTURE.md` §9).
- A record where "what was approved" must be exactly reconstructable
  later is append-only, not edited in place: revoke is an `UPDATE`, not
  a `DELETE` (`docs/DATA_ARCHITECTURE.md` §13); a published artifact is
  immutable at the database level (`docs/FORM_VERSIONING_MODEL.md` §10).
- Effective dating and configuration versioning exist where "what was
  true on a past date" is a real question (`docs/DATA_ARCHITECTURE.md`
  §7).
- Segregation-of-duties, approval-evidence, and exception patterns are
  designed in from the start, even where not yet built
  (`docs/PLATFORM_ARCHITECTURE.md` §6).
- Reasons and change summaries are captured as structured, queryable
  columns where a reviewer needs them (`docs/FORM_VERSIONING_MODEL.md`
  §15), not left to be inferred from a diff.
- A calculated value a client can compute is never treated as
  authoritative merely because the client computed it
  (`docs/FORM_CAPABILITY_REGISTER.md`, item I).

**Anti-patterns.**
- A status column that can be silently overwritten with no history of
  what it used to be.
- Relying on application-code discipline alone for audit coverage,
  instead of a database trigger that fires regardless of which code
  path performed the write.
- An override/exception path with no recorded reason or approver.

**Review questions.**
- If this row were edited outside the application (a script, a
  migration, a bug), would the audit trail still exist?
- Could an auditor reconstruct this two years later without asking
  anyone to remember?

## 8. CEO-glance mindset

**Engineering interpretation.** Materiality, risk, and exceptions must be
representable as structured, queryable data, not buried only in free
text or attachments, so that aggregation and summarization are possible
later without redesigning the underlying model.

**Required architectural behavior.**
- Domain events capture business-meaningful occurrences separately from
  row-level audit (`docs/PLATFORM_ARCHITECTURE.md` §7), so "what
  happened, in business terms" can be aggregated without replaying raw
  mutation history.
- Exceptions, overrides, and policy deviations are structured facts
  (who, why, what policy, effective when), not prose in a comment field.
- Fields a future leadership summary would need (materiality, risk
  category, ageing, cycle time) are modeled as real columns or derivable
  from real columns, decided when the first real consumer needs them,
  not spread ad hoc across free-text fields.

**Anti-patterns.**
- A "reason for exception" field that is the only record of an
  exception ever having happened, with no structured flag a query can
  find.
- Building a leadership dashboard as a one-off reporting hack that reads
  free text, instead of first making the underlying data structured.

**Review questions.**
- Could this exception, override, or unusual event be found by a query,
  or only by reading every record by hand?
- If leadership asked for a summary of this next quarter, does the data
  already support it, or would someone have to go back and restructure
  it first?

## The Nexus Design Review

The same eight-question framework from
`docs/guide/NEXUS_PRINCIPLES.md`, applied before implementing a
substantial Nexus capability. Not a sign-off process; a thinking
framework, applied by whoever is doing the design, including a coding
agent working autonomously.

1. **Library:** Does mature technology already solve the commodity
   portion?
2. **API:** Can the capability eventually be safely invoked without
   the Nexus UI, through the same application/domain layer?
3. **Contract:** Is Nexus exposing its own business contract, not a
   vendor's or engine's internal one?
4. **Scale:** Does today's simple implementation leave a credible path
   to 100x scale without a domain redesign?
5. **Human:** Is this the simplest possible experience for each user
   persona, and does the data model support that?
6. **CFO:** Are ownership, control, evidence, audit, and financial
   consequence all correctly handled, and database-enforced where it
   matters?
7. **CEO:** Can material risks, changes, or exceptions eventually be
   queried and summarized, not just read one record at a time?
8. **Documentation:** Will another developer or AI understand what
   this is, why it exists, and how it works, from the repository alone?

## Where this fits

This document is the technical companion to
`docs/guide/NEXUS_PRINCIPLES.md`. `docs/DOCUMENTATION_STRATEGY.md`
defines where documentation of every kind lives as Nexus grows.
`docs/PLATFORM_ARCHITECTURE.md`, `docs/DATA_ARCHITECTURE.md`,
`docs/AUTHORIZATION_MODEL.md`, and `docs/FORM_VERSIONING_MODEL.md`
remain the detailed, subject-specific architecture documents; this
document does not replace or duplicate them, it states the permanent
principles they already embody.
