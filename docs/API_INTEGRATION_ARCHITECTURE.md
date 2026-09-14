# Nexus: API and Integration Readiness

This document records what already makes a future API/integration layer
possible without rewriting business logic, and what is deliberately not
built yet. It contains no real Nexus business rule and commits to no
concrete API surface; `docs/PLATFORM_ARCHITECTURE.md` §9 and §12 already
state the governing principles this document elaborates.

Every section below is marked **IMPLEMENTED FOUNDATION** (real code today
already satisfies the property) or **FUTURE** (design intent only,
nothing built). Never read a FUTURE section as if it already existed.

## 1. Interface-independent business logic: IMPLEMENTED FOUNDATION

Every governed mutation in Nexus already follows the shape a future
API/job/integration adapter would call unchanged:

```
UI / Server Action  ->  services/<x>.service.ts  ->  data/<x>.data.ts  ->  Postgres RPC
```

`actions.ts` files are thin: derive the actor server-side
(`requirePermission`), call one service function, map the result to a
UI-friendly `{ok, ...}` shape. The service function itself contains no UI
concerns and is already reachable from anywhere in the Node process, not
only from a Server Action. Verified this round for: onboarding
create/save/submit/send-back/approve, customer change
create/submit/approve/apply, commercial version
create/submit/approve/activate, deactivate/reactivate, permanent delete,
and every Settings mutation. A future `/api/v1` route handler would call
the exact same service functions these actions already call; it would not
duplicate a single business rule.

**One gap found and not yet closed**: `case.service.ts`'s
`checkForDuplicateCustomersAction` and `customer-change/actions.ts`'s
`createChangeRequestAction` each do a small amount of business branching
inline in the Server Action rather than in a service function (see
`docs/TECH_DEBT.md`). Low risk today (both are single call sites), but a
future second caller of either capability would either duplicate that
branch or have to notice it lives in the wrong layer.

## 2. Versioned routes: FUTURE

No `/api/*` route exists yet beyond `/api/geography/*` (a same-origin,
server-only proxy over a local dataset, not a public/integration API) and
`/api/demo/customer-documents/*` (synthetic demo PDFs, not real data).
When a real public or internal API is built, it starts at `/api/v1/...`
from its very first version, per `docs/PLATFORM_ARCHITECTURE.md` §9. There
is no `/api/v2` to plan for yet because there is no `/api/v1` yet.

## 3. Stable application DTOs, never raw database rows: FUTURE (principle recorded now)

No API response shape is designed yet. The principle that must govern it
when one is: an API response is an application-owned DTO, never a
`SELECT *` row serialized directly. A database column name is an
implementation detail; it must never become a permanent external contract
by accident. Illustrative target shape for a future Customer read (not
implemented, not a real field list):

```json
{
  "customerId": "…",
  "customerNumber": "CO-000123",
  "legalName": "…",
  "brand": "…",
  "segment": { "code": "enterprise", "label": "Enterprise" },
  "businessUnit": { "code": "india_enterprise", "label": "India Enterprise" },
  "status": "active"
}
```

Nexus already has the resolver this shape depends on:
`resolveOption(snapshot, listKey, code)`
(`src/features/reference-data`) is the one canonical way a governed code
becomes `{code, label}`; a future DTO layer reuses it rather than
re-deriving labels. The Human-Friendly ID formatters
(`formatOnboardingCaseId`, `formatChangeRequestId`,
`formatCommercialVersionId`) are the same pattern already applied to
request identity: a stable, presentable identity distinct from the
internal UUID primary key. **Customer Master itself has no equivalent
Human-Friendly ID yet** (`customers.id` is a raw UUID with no display
formatter); this would need to exist before a `customerNumber`-shaped DTO
field like the example above could be real (see `docs/TECH_DEBT.md`).

## 4. External system identity model: FUTURE (design only)

Nexus's own id (`customers.id`, a UUID minted once, never reused for a
different business identity) is the only authoritative identity a future
DTO exposes. An external system's own id for the same business entity
(a SAP Customer ID, a Salesforce Account ID, a Zoho Customer ID) is a
**mapping**, never a Nexus primary key: two systems disagreeing about
identity must never require renumbering Nexus's own records.

**Whether a dedicated `external_resource_references` table is needed now:
no.** No real integration exists yet to validate a schema against
(`docs/PLATFORM_ARCHITECTURE.md` §3's "data lineage" reasoning applies
identically here: designing the general shape before a real consumer
exists risks guessing wrong). The Resource Registry
(`docs/DATA_ARCHITECTURE.md` §2) already provides the one thing such a
table would need to anchor to: a stable `resource_id` per business record.
When the first real external mapping is needed, the shape to build is a
thin table keyed by `resource_id`:

```
external_resource_references
  resource_id     uuid, references resources(resource_id)
  source_system   text        -- 'sap' | 'salesforce' | 'zoho' | ...
  external_id     text
  external_type   text        -- the external system's own record type, if it matters
  metadata        jsonb        -- narrow, source-specific detail only
  is_active       boolean
  created_at      timestamptz
  UNIQUE (resource_id, source_system)
```

Recording this shape now (not building it) is what lets the first real
integration adopt it directly rather than inventing a competing one.

## 5. Idempotency: IMPLEMENTED FOUNDATION at the database layer, no key-based layer yet

Every approve/submit RPC already guards against being invoked twice with
the same effect:

| RPC | Guard |
|---|---|
| `approve_customer_onboarding_case` | `if status = 'approved' then return v_case` (idempotent replay, no second Customer Master) |
| `approve_customer_change_request` | Same shape, `20260913062000_fix_approve_customer_change_request_single_update.sql` |
| `approve_commercial_configuration_version` | Same shape, `20260913070000_commercial_configuration_version_lifecycle.sql` |
| `send_back_*` / `submit_*` | Reject (raise exception) on an invalid current status rather than silently double-applying |

This protects against a duplicate click or a naive retry today. It is not
the same as **idempotency-key infrastructure** (a caller-supplied key that
lets an adapter safely retry an ambiguous network failure without knowing
whether the first attempt actually landed): that is an application-service
boundary concern (`docs/PLATFORM_ARCHITECTURE.md` §2, §12), and is
explicitly deferred until the first external integration that needs it
exists. Building it speculatively now would guess at a shape with no real
caller to validate it against.

**Gap found, not yet closed**: none of the guards above have a
corresponding TypeScript test (unit or otherwise) that calls approve/submit
twice and asserts a single effect; the guard is proven only by reading the
SQL. See `docs/TECH_DEBT.md`.

## 6. Domain events: FUTURE (design only, no code)

No event table, emission call, or event type exists in Nexus today.
`docs/PLATFORM_ARCHITECTURE.md` §7 already distinguishes `audit_log`
(mutation-level, database-enforced) from a domain event (business-meaning,
application-emitted); nothing here changes that. Illustrative future event
types, not implemented:

```
customer.created / customer.updated / customer.deactivated / customer.reactivated
onboarding.submitted / onboarding.sent_back / onboarding.approved
customer_change.submitted / customer_change.approved
commercial.version_created / commercial.version_submitted / commercial.version_approved / commercial.version_effective
```

Illustrative future event envelope, not implemented:

```json
{
  "eventId": "…",
  "eventType": "onboarding.approved",
  "occurredAt": "2026-09-14T12:00:00Z",
  "resourceType": "customer_onboarding_case",
  "resourceId": "…",
  "actor": "…",
  "version": 1,
  "payload": { "requestId": "…" }
}
```

Nothing about today's schema makes this impossible to add later: every
governed mutation already runs inside a service function that could emit
an event at the same point it currently returns, and every business
record already has a `resources.resource_id` to anchor the event to.

## 7. Machine / service identity: FUTURE (design only, no code)

Human Supabase Auth sessions (`docs/AUTHORIZATION_MODEL.md` §10-12) are
the only identity model that exists today; nothing in Nexus currently
authenticates a machine caller. When a real integration needs one, the
model to build is a **service principal**: its own `app_users`-equivalent
identity (never a shared "integration user" password, never a bespoke
DIY API key scheme bolted on casually), scoped permissions through the
exact same `roles`/`permissions`/`role_permissions` tables a human uses
(never a parallel authorization system), a credential that can be
individually revoked without affecting any other caller, and every action
it takes attributed to it (never to `NULL`, never to a human it is acting
on behalf of) in `audit_log.actor_user_id`. No product/library evaluation
for how the credential itself is issued and verified (an API key, mTLS, a
signed JWT) has been done; that evaluation is required before building
this, matching `docs/PLATFORM_ARCHITECTURE.md` §1's library-first
principle.

## 8. Webhooks, imports, documents: FUTURE / partially real

- **Webhooks**: no inbound or outbound webhook exists. When built, an
  outbound webhook is a delivery channel for a domain event (§6), no
  different in kind from an email notification channel
  (`docs/PLATFORM_ARCHITECTURE.md` §13); it does not get its own
  competing "what happened" model.
- **Imports**: no bulk import exists. A future import adapter would call
  the same `services/*.service.ts` functions a human action calls today,
  looped over rows, gated by the same `requirePermission` check, with the
  acting identity being whichever service principal (§7) or human
  triggered the import, never a fabricated system actor with no real
  identity behind it.
- **Documents**: real today (`src/features/customer-onboarding/services/documents.service.ts`,
  private Supabase Storage, metadata table, short-lived signed URLs, MIME/
  size revalidated server-side as of this audit round, see
  `docs/TECH_DEBT.md`'s "Now" section for what was just closed). A future
  API/import upload path reuses this exact service, not a second upload
  mechanism: the service takes a `File`-shaped input and an actor id, both
  of which a future adapter can construct without a browser.

## 9. Authorization for API callers: principle only, not yet exercised

`docs/AUTHORIZATION_MODEL.md` §13 already states the guard
(`requirePermission(resource, action)`) is feature-agnostic. A future API
caller, human or machine, is authorized through the exact same
resource+action(+scope) model the UI uses today, never a parallel
permission system invented for "API keys." This is not a new design
decision, only a statement that nothing about today's authorization model
needs to change to support it.

## 10. What this document does not cover

No real Nexus API endpoint, DTO field list, event type, or external
system name is committed to by this document. Every "FUTURE" section
above is a foundation-readiness note, not a build plan; each becomes a
real implementation only when a real API/integration requirement exists
to build it against, matching `docs/PLATFORM_ARCHITECTURE.md` §12's own
list of deliberately-deferred capabilities.
