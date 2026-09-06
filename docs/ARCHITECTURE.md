# Nexus — Engineering Architecture

This document explains *how the code is organized and why*. It contains no
business rules — for what Nexus does, that context lives outside this public
repository. This file is about structure, boundaries, and conventions only.

## 1. Top-level shape

```
src/
  app/                  Next.js App Router routes. Thin.
  components/
    ui/                 Generic design-system primitives (shadcn/ui).
    product/             Nexus-branded components shared across features.
  features/              One folder per business feature. Self-contained.
  platform/               Shared capabilities used by multiple features.
  lib/                   Small, generic, framework-level helpers.
```

## 2. Platform vs. feature separation

**Platform** (`src/platform/`) holds capabilities that more than one feature
needs: the maker-checker workflow engine, the approval log, audit trail,
permissions, policy/config, attachments. These are built **once** and
consumed everywhere. A feature must never reimplement its own version of a
platform capability — if two features need similar behaviour, that behaviour
belongs in `platform/`, not duplicated.

**Features** (`src/features/`) hold business logic specific to one part of
the product (e.g. registration, commercial terms, go-live). A feature may
depend on `platform/`, `components/`, and `lib/`. A feature must not import
another feature's internals directly — if two features need to share
something, promote that thing to `platform/` or `components/product/`
instead of cross-importing.

## 3. Dependency direction

Dependencies only flow one way:

```
app  →  features  →  platform  →  lib
              ↘︎ components ↙︎
```

- `platform/` never imports from `features/` or `app/`.
- `features/` may import from `platform/`, `components/`, `lib/`.
- `features/` must not import from another feature.
- `components/ui/` has no dependency on `platform/` or `features/` — it
  knows nothing about Nexus's domain.
- `components/product/` may depend on `components/ui/` and on `platform/`
  types (e.g. a status badge that renders a workflow state), but not on any
  single feature.
- `app/` may import from anything above it, never the reverse.

If you find yourself importing "up" this chain, that's a signal the code is
in the wrong place.

## 4. Where things live

| Kind of code | Location |
|---|---|
| Route/page composition | `src/app/**/page.tsx` |
| Domain logic, validation, calculations | `src/features/<feature>/domain/` |
| Data access for a feature | `src/features/<feature>/data/` |
| Feature-specific UI | `src/features/<feature>/components/` |
| Shared cross-feature capability (workflow, audit, approvals, permissions, policy, attachments) | `src/platform/<capability>/` |
| Shared branded UI used by 2+ features | `src/components/product/` |
| Generic design-system primitives | `src/components/ui/` |
| Small generic helpers (formatting, `cn`, etc.) | `src/lib/` |

## 5. Keeping `page.tsx` thin

Pages are composition points, not logic containers. A `page.tsx` should:

- fetch/assemble what a feature's data layer already exposes,
- render feature components,
- handle route-level concerns (params, metadata, redirects).

A `page.tsx` should **not** contain business rules, validation, or
calculations. If a page is growing large, extract the logic into the
feature's `domain/` or `components/`, not into the page itself.

## 6. Avoiding feature coupling

- Two features needing the same behaviour → build it once in `platform/`.
- Two features needing the same non-branded UI → `components/ui/` (if
  generic) or `components/product/` (if Nexus-branded but domain-agnostic).
- A feature should be deletable without breaking another feature. If
  deleting `features/x` would break `features/y`, there's a hidden coupling
  that should have gone through `platform/` instead.

## 7. Adding a new feature module

1. Create `src/features/<feature-name>/` with `domain/`, `data/`,
   `components/`, `types.ts` as needed — only create the subfolders the
   feature actually uses.
2. If the feature needs maker-checker approval, attach it to the shared
   workflow engine in `platform/workflow/` once that exists — do not build a
   parallel state machine.
3. If the feature introduces a new configurable threshold, add it to
   `platform/policy/` as data, not as a hardcoded constant.
4. Add the route(s) under `src/app/`, keeping the page thin per §5.
5. Reuse existing `components/ui/` and `components/product/` components
   before creating new ones.

## 8. Non-goals for this document

This file does not cover: visual design system, database schema, specific
business rules, or authentication. Those are addressed in separate,
later-stage documents/steps.
