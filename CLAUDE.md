# Nexus: Claude Code instructions

Nexus is an internal finance process platform. This file is engineering
guidance only. No business rules or confidential context live here. Full
structural rationale is in `docs/ARCHITECTURE.md`.

## Public repository: hard rules

This repository is **public**.

- Never commit secrets, API keys, tokens, passwords, or connection strings.
- Never commit real customer data, real financial figures, or confidential
  internal business policy/process detail.
- Environment-specific values go through env vars; only `.env.example`
  (placeholder names, no real values) is committed.
- All example/fixture/seed data must be fictional.
- If something looks even possibly confidential, don't commit it. Ask
  first.

## The Nexus Design Review

Before substantial Nexus design or implementation work, apply the Nexus
Design Review: Library, API, Nexus-owned contract, Scale, Human, CFO,
CEO, Documentation. Full framework in `docs/guide/NEXUS_PRINCIPLES.md`
(plain English) and `docs/engineering/NEXUS_ENGINEERING_PRINCIPLES.md`
(technical); documentation organization in
`docs/DOCUMENTATION_STRATEGY.md`. In short:

- Library-first: evaluate mature reusable/OSS solutions before building
  horizontal infrastructure ourselves.
- API-capable: business logic sits in application services, so a future
  API/job/integration reaches it without duplicating it.
- Nexus-owned contracts: external engines (SurveyJS, Flowable, Temporal)
  stay behind Nexus's own adapters, never exposed as Nexus's own API.
- Scale-ready, not scale-heavy: build for today's load, protect what's
  expensive to retrofit (stable IDs, boundaries, audit), skip complexity
  nothing currently needs.
- Human simplicity: the system absorbs complexity, not the user.
- Finance control (CFO mindset): ownership, evidence, approval, audit,
  and effective dating are database-enforced defaults, not conventions.
- Leadership visibility (CEO mindset): materiality, risk, and exceptions
  are structured data, not buried in free text.
- Docs as code: documentation lives in Git alongside the code it
  describes, and grows with the platform.

This is a thinking framework applied while working, not a separate
approval step.

## Never fake auth, approval, or persistence

Never invent a working login, a clickable "Approve" action, a saved
record, or an uploaded file where the real authorization, workflow, or
storage layer does not exist yet. Show the honest state instead (a
"Pending" badge, a documented future shape, a local-only save) rather
than a control that looks real but does nothing real behind it. This
applies to workflow/approval identity specifically: a role reference
(e.g. `FINANCE_HEAD`, `BU_HEAD`) is never resolved to a hardcoded person
or a fake "logged in as" user.

## Structural changes must be documented in the same task

A change is structural if it introduces or alters an architectural
principle, a dependency-direction rule, a library-selection decision, a
new platform primitive, an auth/authz shape, a workflow shape, a
role/scope model, a Reference Master or forms-platform behavior, a
submission/versioning model, an audit/history principle, a document-
storage architecture, a layering convention, or a cross-feature service
boundary. When a task makes a structural change, update the authoritative
doc (`docs/ARCHITECTURE.md`, `docs/PLATFORM_ARCHITECTURE.md`,
`docs/DATA_ARCHITECTURE.md`, `docs/UI_SYSTEM.md`, or a new file if none
covers it) in the same task, not only in chat. Mark new/changed sections
honestly as `DESIGN DRAFT`, `LOCKED`, `IMPLEMENTED`, or `CLOSED`, and
never describe an unbuilt capability as if it already existed. A small,
local UI copy change is not structural and does not need this.

## Reporting progress on substantial tasks

For a substantial multi-step task, start by choosing a total point count
that reflects the actual scope (a small task might total 10, a large one
40+; there is no fixed number), broken into phases. Report percentage
only as completed points divided by that chosen total, never a separate
guess. Give remaining-time estimates as a range ("~15-25 minutes"), not
an exact figure. Progress can move backwards if testing surfaces a real
defect. End a substantial task with a short plain-English summary (what
changed, what was removed, what was fixed, what is still pending, what
the user should look at first) before any technical delivery detail, and
apply one focused review/test pass rather than repeatedly re-reviewing
already-finished work without a real reason to.

## Stack

Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui +
Lucide icons. `src/` layout, `@/*` import alias, npm.

## Folder structure

```
src/
  app/                  routes: thin, composition only
  components/ui/         generic design-system primitives (shadcn)
  components/product/    Nexus-branded components shared across features
  features/              one folder per business feature, self-contained
  platform/               shared capabilities: workflow, approvals, audit,
                          permissions, policy, attachments
  lib/                   small generic helpers
```

Full rules on what goes where, and dependency direction, are in
`docs/ARCHITECTURE.md`. Read it before adding a new module.

## Coding principles

- Keep `page.tsx` thin: routing/composition only, no business logic.
- Separate presentation, domain logic, data access, and validation; don't
  mix them in one file or component.
- Prefer feature-local code. Only move something into `platform/` or
  `components/product/` once it's actually needed by more than one feature.
- Reuse existing components/utilities before creating new ones. Check
  `components/ui/`, `components/product/`, and `lib/` first.
- Avoid premature abstraction. Don't build for hypothetical future
  requirements.
- Avoid giant components and giant utility files. Split by responsibility.
- Avoid duplicate logic. If you're about to copy-paste business logic,
  it belongs in `platform/` or a shared feature module instead.
- Avoid unnecessary dependencies. Do not add UI/component libraries beyond
  shadcn/ui + Lucide without asking.
- Do not refactor unrelated areas while implementing a feature. Stay in
  scope.
- Strict TypeScript. Avoid `any`; prefer precise types or `unknown` with
  narrowing.
- Predictable naming: match the vocabulary already used in the codebase and
  in `docs/ARCHITECTURE.md`, don't invent parallel terms for the same thing.
- Optimize for readability over cleverness.

## Shared platform capabilities: build once, reuse everywhere

`workflow`, `approvals`, `audit`, `permissions`, `policy`, `attachments` are
platform-level capabilities. Never reimplement one of these inside a feature.
Attach to the shared implementation in `platform/` instead. See
`docs/ARCHITECTURE.md` §2–3 for the dependency rules that enforce this.

## Working efficiently in this repo

- Read only what's relevant to the current task. Don't scan the whole repo
  by default.
- Use targeted search (grep/glob) before opening files; use an Explore-style
  subagent for genuinely broad investigation, not for a single lookup.
- Don't reread a file you've already read and understood in this session.
- Don't paste large unchanged file contents back into responses. Reference
  the file path instead.
- Don't explain obvious implementation details; keep responses concise.
- Prefer starting a fresh session (`/clear`) when switching to an unrelated
  feature rather than carrying over irrelevant context.
- Architecture and structural decisions belong in `docs/` files, not only in
  chat history. Update the docs when a decision changes, so future sessions
  don't have to rediscover it.

## Supabase migrations

Migrations live in `supabase/migrations/<timestamp>_<name>.sql`. The local
filename timestamp must match the version Supabase records remotely.

- Author migrations locally as a new timestamped file (`supabase migration
  new <name>`, or a hand-written file following the same naming pattern).
- Apply with the Supabase CLI (`supabase link` once per machine, then
  `supabase db push`). The CLI reads the filename's timestamp and records
  that exact value as the migration version remotely.
- Do not use the Supabase MCP `apply_migration` tool to apply migrations.
  It records an apply-time timestamp instead of the filename's timestamp,
  which desyncs local and remote migration history. Reserve MCP Supabase
  tools for read-only inspection (`list_migrations`, `list_tables`,
  `execute_sql` for read queries).
- `supabase link` and `supabase db push` need CLI authentication
  (`supabase login`, or a `SUPABASE_ACCESS_TOKEN` environment variable set
  in your own shell) and the project's database password. Never put these
  in Git, in `CLAUDE.md`, or in any committed file.

## Deployment

`team-preview` is the default code delivery branch for team review; Vercel
Preview (triggered automatically by a push to `team-preview` through the
existing GitHub integration) is the default team-review deployment target.

- The Vercel MCP may be used to inspect deployment status, inspect whether
  an environment variable is present (never its value), redeploy Preview,
  retrieve the Preview URL, inspect build/runtime logs, and manage Preview
  configuration where the connected tooling safely supports it.
- Production always requires explicit user approval: never deploy to
  Production, promote a Preview to Production, or change a production
  domain/alias without being explicitly asked to.
- Secret values (Supabase service role key, Vercel tokens, and similar)
  must never be printed into chat, logs, or any committed file. If a
  required Preview environment variable is missing and no securely
  connected tool can set it, stop and tell the user exactly which
  variable is missing and what manual action is required, rather than
  inventing a value or working around the gap.
- A page/route that reads live backend data must never be allowed to
  statically prerender: without an explicit opt-out (for example
  `export const dynamic = "force-dynamic"`), Next.js may cache a
  build-time read forever, so a later data or config change silently
  never appears without a fresh deployment.
- Linking Vercel's native Supabase integration does not by itself make
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` available: the integration
  is known to create Supabase environment variables under its own
  names (for example a `POSTGRES_*` or `NEXT_PUBLIC_SUPABASE_*` set),
  which do not automatically satisfy code written against this app's
  own variable names. Verify empirically (a real request against the
  deployed function, checked through Vercel runtime logs) rather than
  assuming the integration's presence means the app can connect.
  Linking the integration also does not rebuild anything already
  deployed; a fresh Preview build is required after any environment
  variable change before it can take effect.

## Frontend / UI

All frontend implementation must comply with `docs/UI_SYSTEM.md`.

## Build order

Do not build ahead of the current step. Features are added one at a time,
each proven end-to-end (data → domain → UI) before the next one starts.

## Writing style

Never use em dashes anywhere in the project.

This applies to:
- UI copy
- labels
- helper text
- error messages
- empty states
- tooltips
- documentation
- README files
- code comments
- test/example text
- commit messages generated by Claude

Do not use the character "—".

Instead, rewrite the sentence using whichever is clearest: comma, colon,
semicolon, parentheses, full stop, or a simple hyphen where grammatically
appropriate. Prefer short, simple sentences over replacing every em dash
mechanically.

When editing existing text, remove em dashes if you encounter them.

Do not change code operators, syntax, or data formats merely to enforce this
writing rule.

## Prototype UI fields

Fields, columns, labels, filters, statuses, and example records used in
visual prototypes are illustrative unless explicitly defined by the product
brief. Do not treat prototype UI choices as permanent schema or business
requirements.

When implementing a real feature:
1. Derive the fields from the approved product requirements.
2. Decide which information the user actually needs on the primary screen.
3. Use progressive disclosure for secondary information.
4. Do not preserve prototype columns merely because they already exist.
