# Nexus Documentation Strategy

This document defines how Nexus organizes its documentation, today and
as it grows. It exists so documentation stays discoverable and
consistent as more of it accumulates, not so every future tool gets
adopted immediately. Most of the locations and tools named below are
accepted future direction, not something installed or configured by this
document; each is explicitly marked.

## Two audiences, two tracks

Nexus maintains two primary, parallel documentation tracks. Neither
replaces the other; a reader typically starts in one and, if they need
more depth, moves to the other.

### The Nexus Guide

- **Location:** `docs/guide/`
- **Audience:** business users, Finance, management, auditors, Product,
  new team members, anyone without a reason to read SQL or TypeScript.
- **Language:** plain English.
- **Focus:** what Nexus does and why, business processes, terminology,
  lifecycle concepts, and user-facing concepts. `docs/guide/NEXUS_PRINCIPLES.md`
  is the first document in this track.

### The Nexus Engineering Handbook

- **Location:** `docs/engineering/`
- **Audience:** developers, architects, technical reviewers, AI coding
  agents, and future applications that need to consume Nexus's own
  architecture information.
- **Language:** technical.
- **Focus:** architecture, database design, APIs, services, adapters,
  security, audit, workflows, data models, integration contracts,
  migrations, and operational behavior.
  `docs/engineering/NEXUS_ENGINEERING_PRINCIPLES.md` is the first
  document in this track.

## Canonical, subject-specific architecture documents

`docs/PLATFORM_ARCHITECTURE.md`, `docs/DATA_ARCHITECTURE.md`,
`docs/AUTHORIZATION_MODEL.md`, `docs/EVENTS_AND_NOTIFICATIONS.md`,
`docs/FORM_CAPABILITY_REGISTER.md`, and `docs/FORM_VERSIONING_MODEL.md`
remain at the repository's `docs/` root. They are not moved or renamed
by this document. They belong, conceptually, to the Engineering
Handbook's subject matter; migrating them into `docs/engineering/` is a
future, progressive step (§ "Migrating existing documents" below), not
done now.

## Architecture decisions (future)

- **Location:** `docs/decisions/` (does not exist yet).
- **Format:** Architecture Decision Records, one Markdown file per
  decision, using MADR or an equivalent lightweight ADR structure.
- **When:** created going forward whenever a meaningful architectural or
  technology decision is accepted, not retroactively for past decisions
  unless one is revisited.
- **Not installed now:** no ADR tooling is set up by this document; an
  ADR is a plain Markdown file in that future directory once the first
  one is written.

## Architecture as code (future)

- **Location:** `architecture/` (does not exist yet).
- **Intended technology:** Structurizr DSL / the C4 model, as a future
  technology checkpoint, subject to the same library-first evaluation as
  any other substantial capability (`docs/guide/NEXUS_PRINCIPLES.md`
  Principle 1).
- **Not installed now:** no diagramming tooling is set up by this
  document.

## Lightweight diagrams

Mermaid diagrams embedded directly in Markdown are the accepted
lightweight diagramming approach and may be used in any document today;
most Markdown renderers used in this project's toolchain already
support them, so no installation is required to start using them.

## API contracts (future)

- **Location:** `openapi/` (does not exist yet).
- **When APIs begin:** OpenAPI is the canonical, machine-readable
  contract for any Nexus API (consistent with Principle 2, API-capable
  by default, and Principle 4, documentation as code).
- **Documentation/UI candidate:** Scalar is the current accepted
  candidate for rendering OpenAPI contracts as browsable documentation.
- **Not installed now:** no OpenAPI tooling or Scalar instance is set up
  by this document; this is direction for when the first real API
  contract exists.

## Documentation portal (future)

Docusaurus is the accepted first candidate for eventually rendering all
of the above into a browsable documentation portal. **Not installed or
configured now.** When it is adopted, it remains strictly a
**generated/consumption view**: it renders the Markdown, Mermaid, ADRs,
and OpenAPI files already in Git. It must never become a second place
documentation is authored; the canonical source is always the files in
this repository, never a portal's own database or editor.

## Documentation lifecycle

Documentation grows with Nexus. It is not written all at once before
Nexus is "done," and platform development does not stop to fully
document every future concept in advance; a Finance operating platform
that grows for years cannot be documented that way, and waiting until
"complete" would mean never documenting it at all.

For each meaningful capability, the following progressively accumulate,
in whatever order makes sense for that capability, over its lifetime,
not necessarily all at once:

- **Code / migration:** the capability itself.
- **Plain-English guide:** what it is and why, in `docs/guide/`.
- **Technical documentation:** how it works, in `docs/engineering/` or
  the relevant subject-specific architecture document.
- **ADR:** when a material architectural or technology choice was made
  in building it, in `docs/decisions/` once that directory exists.
- **OpenAPI:** when the capability exposes an API contract, in
  `openapi/` once that directory exists.

Not every change earns all five. A small bug fix needs none of them
beyond the code change itself. A new Platform Core capability, a new
external-technology adoption, or a new business process earns most or
all of them. Judgment based on materiality decides which apply, the same
judgment the Nexus Design Review already asks for
(`docs/guide/NEXUS_PRINCIPLES.md`, `docs/engineering/NEXUS_ENGINEERING_PRINCIPLES.md`).

## Future AI and application readability

Nexus documentation is written to be understandable by machines as well
as people. Structured, text-based formats are preferred throughout:
Markdown, YAML, JSON, OpenAPI, Structurizr DSL, Mermaid, SQL migrations,
and source code itself. Screenshots, slide decks, Word documents, and a
documentation website are never the only source of architectural truth;
a website can render what's in Git, but nothing important is allowed to
exist only as a picture of an idea or a file format a future tool cannot
parse.

The intent is concrete: a future AI agent, or a new engineer, should be
able to open this repository with no other context and reconstruct what
Nexus does, why its architecture choices were made, what its contracts
are, what invariants must never be violated, and how to extend it
safely, all from files already in Git.

## Migrating existing documents

This document does not move or rename any existing file. Root-level
architecture documents stay exactly where they are. As Nexus's
documentation grows, some of that material may eventually be
reorganized into `docs/guide/` and `docs/engineering/` more formally;
that migration happens progressively, document by document, when doing
so is itself useful, not as a one-time restructuring project.
