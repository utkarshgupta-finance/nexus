# platform/

Shared capabilities used by more than one feature. Each capability is
implemented once here and consumed by features, never reimplemented
per-feature.

Planned capabilities (added incrementally, only when first needed):

- `auth/` **[IMPLEMENTED]**: Supabase Auth session resolution and the
  Nexus-owned `NexusSession` identity contract (`getCurrentNexusSession`).
  See `docs/AUTHORIZATION_MODEL.md` §10-12.
- `workflow/`: generic maker-checker state machine
- `approvals/`: cross-cutting approval log
- `audit/`: automatic before/after change tracking
- `permissions/` **[IMPLEMENTED]**: `hasPermission`/`requirePermission`
  deny-by-default authorization guards, resolved from `roles`/
  `permissions`/`role_permissions`/`user_roles`. See
  `docs/AUTHORIZATION_MODEL.md` §13-14.
- `policy/`: runtime-configurable thresholds and settings
- `attachments/`: file upload/storage handling

Rules:

- Code in `platform/` must never import from `features/`.
- Platform modules expose typed contracts (types + functions); features
  depend on those contracts, not on each other's internals.

See `docs/ARCHITECTURE.md` for the full rationale.
