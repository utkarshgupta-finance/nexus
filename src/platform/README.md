# platform/

Shared capabilities used by more than one feature. Each capability is
implemented once here and consumed by features, never reimplemented
per-feature.

Planned capabilities (added incrementally, only when first needed):

- `auth/` **[IMPLEMENTED]**: Supabase Auth session resolution and the
  Nexus-owned `NexusSession` identity contract (`getCurrentNexusSession`).
  See `docs/AUTHORIZATION_MODEL.md` §10-12.
- `workflow/` **[DESIGN DRAFT]**: pure domain types and a rule evaluator
  only (`evaluateWorkflowRules`); no running engine, no database table,
  not called by any feature yet. See `docs/WORKFLOW_ENGINE_ARCHITECTURE.md`.
  Deliberately not generalized further: the three governed lifecycles
  (Onboarding, Customer Change, Commercial Version) each have genuinely
  different request/revision/requirement shapes today (`docs/CUSTOMER_LIFECYCLE.md`
  §19), so building a shared running engine now would mean designing for
  the union of three requirements sets with no second real consumer yet.
- `approvals/` **[IMPLEMENTED]**: the unified Approvals inbox and My Work
  composer (`loadApprovalInbox`/`loadMyWork`), aggregating across
  Onboarding, Customer Change, and Commercial Version. The one documented
  exception to "platform never imports features" (`docs/ARCHITECTURE.md`
  §3): it is a cross-feature composer, not a generic capability.
- `audit/` **[IMPLEMENTED]**: `resolveActorEmails` and a generic
  `audit_log` reader, backing every feature's own Activity/Timeline.
- `permissions/` **[IMPLEMENTED]**: `hasPermission`/`requirePermission`
  deny-by-default authorization guards, resolved from `roles`/
  `permissions`/`role_permissions`/`user_roles`. See
  `docs/AUTHORIZATION_MODEL.md` §13-14.
- `errors/` **[IMPLEMENTED]**: the shared `NexusErrorCode` vocabulary and
  `ApplicationError`, the one typed error a cross-feature boundary (an
  API route, a structured log call) can rely on regardless of which
  feature raised it. Never replaces a feature's own richer error parsing.
- `observability/` **[IMPLEMENTED]**: structured JSON log lines
  (`logOperation`/`withLoggedOperation`) and correlation ids
  (`newCorrelationId`). See `docs/PLATFORM_ARCHITECTURE.md` §7's
  diagnosable-operational-failures rule.
- `api/` **[IMPLEMENTED]**: shared support for `/api/v1/*` route
  handlers (same-session authorization, consistent error responses). See
  `docs/API_INTEGRATION_ARCHITECTURE.md`.
- `policy/`: runtime-configurable thresholds and settings. Not built;
  see `docs/DATA_ARCHITECTURE.md` §8.
- `attachments/`: not a separate platform capability today. Document
  upload/storage lives feature-locally
  (`src/features/customer-onboarding/services/documents.service.ts`);
  promote it here only once a second feature genuinely needs the same
  upload/validation/signed-URL mechanics.

Rules:

- Code in `platform/` must never import from `features/`.
- Platform modules expose typed contracts (types + functions); features
  depend on those contracts, not on each other's internals.

See `docs/ARCHITECTURE.md` for the full rationale.
