# Nexus — Claude Code instructions

Nexus is an internal finance process platform. This file is engineering
guidance only — no business rules or confidential context live here. Full
structural rationale is in `docs/ARCHITECTURE.md`.

## Public repository — hard rules

This repository is **public**.

- Never commit secrets, API keys, tokens, passwords, or connection strings.
- Never commit real customer data, real financial figures, or confidential
  internal business policy/process detail.
- Environment-specific values go through env vars; only `.env.example`
  (placeholder names, no real values) is committed.
- All example/fixture/seed data must be fictional.
- If something looks even possibly confidential, don't commit it — ask
  first.

## Stack

Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui +
Lucide icons. `src/` layout, `@/*` import alias, npm.

## Folder structure

```
src/
  app/                  routes — thin, composition only
  components/ui/         generic design-system primitives (shadcn)
  components/product/    Nexus-branded components shared across features
  features/              one folder per business feature, self-contained
  platform/               shared capabilities: workflow, approvals, audit,
                          permissions, policy, attachments
  lib/                   small generic helpers
```

Full rules on what goes where, and dependency direction, are in
`docs/ARCHITECTURE.md` — read it before adding a new module.

## Coding principles

- Keep `page.tsx` thin — routing/composition only, no business logic.
- Separate presentation, domain logic, data access, and validation; don't
  mix them in one file or component.
- Prefer feature-local code. Only move something into `platform/` or
  `components/product/` once it's actually needed by more than one feature.
- Reuse existing components/utilities before creating new ones — check
  `components/ui/`, `components/product/`, and `lib/` first.
- Avoid premature abstraction — don't build for hypothetical future
  requirements.
- Avoid giant components and giant utility files — split by responsibility.
- Avoid duplicate logic — if you're about to copy-paste business logic,
  it belongs in `platform/` or a shared feature module instead.
- Avoid unnecessary dependencies. Do not add UI/component libraries beyond
  shadcn/ui + Lucide without asking.
- Do not refactor unrelated areas while implementing a feature — stay in
  scope.
- Strict TypeScript. Avoid `any`; prefer precise types or `unknown` with
  narrowing.
- Predictable naming: match the vocabulary already used in the codebase and
  in `docs/ARCHITECTURE.md`, don't invent parallel terms for the same thing.
- Optimize for readability over cleverness.

## Shared platform capabilities — build once, reuse everywhere

`workflow`, `approvals`, `audit`, `permissions`, `policy`, `attachments` are
platform-level capabilities. Never reimplement one of these inside a feature
— attach to the shared implementation in `platform/` instead. See
`docs/ARCHITECTURE.md` §2–3 for the dependency rules that enforce this.

## Working efficiently in this repo

- Read only what's relevant to the current task. Don't scan the whole repo
  by default.
- Use targeted search (grep/glob) before opening files; use an Explore-style
  subagent for genuinely broad investigation, not for a single lookup.
- Don't reread a file you've already read and understood in this session.
- Don't paste large unchanged file contents back into responses — reference
  the file path instead.
- Don't explain obvious implementation details; keep responses concise.
- Prefer starting a fresh session (`/clear`) when switching to an unrelated
  feature rather than carrying over irrelevant context.
- Architecture and structural decisions belong in `docs/` files, not only in
  chat history — update the docs when a decision changes, so future sessions
  don't have to rediscover it.

## Frontend / UI

All frontend implementation must comply with `docs/UI_SYSTEM.md`.

## Build order

Do not build ahead of the current step. Features are added one at a time,
each proven end-to-end (data → domain → UI) before the next one starts.
