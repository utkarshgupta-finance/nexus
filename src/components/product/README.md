# components/product/

Nexus-branded components shared across multiple features (e.g. an app shell,
page header, a status badge driven by the shared workflow states). Nothing
lives here yet.

Rules:

- May depend on `components/ui/` and on `platform/` types.
- Must not depend on any single feature in `features/`.
- If a component is only used by one feature, it belongs in that feature's
  own `components/` folder instead, not here.

See `docs/ARCHITECTURE.md` for the full rationale.
