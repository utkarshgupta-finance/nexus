import "server-only"

/**
 * TRUSTED, SERVER-ONLY Commercial entry point.
 *
 * The `server-only` import above makes it a build error for any of this
 * to be pulled into a Client Component bundle, in addition to (not
 * instead of) src/lib/supabase/server-client.ts's own identical guard;
 * both must hold for this file to ever reach the browser.
 *
 * ============================================================================
 * WHAT THIS MODULE DOES AND DOES NOT GUARANTEE
 * ============================================================================
 *
 * Every function reachable from here eventually calls
 * src/lib/supabase/server-client.ts, which authenticates as
 * service_role. service_role is a trusted backend credential: it
 * bypasses Postgres RLS and the Commercial RPCs' own EXECUTE grants
 * entirely (those grants exist to keep anon/authenticated out; they say
 * nothing about which service_role caller, or which end user a
 * service_role caller is acting on behalf of, is allowed to see or
 * change a given row).
 *
 * That means this module enforces WHERE code may run (server-only,
 * verified above) but NOT WHO may call it or WHICH records they may
 * access. Nexus now has a real authentication/authorization platform
 * capability (`src/platform/auth/`, `src/platform/permissions/`,
 * `commercial_configuration`/read+write permissions, see
 * docs/AUTHORIZATION_MODEL.md): every call site that reaches a write
 * function here (createCommercialConfiguration, addCommercialComponent,
 * addCommercialCommitment, createSystemCommercialRequest,
 * createCommercialChangeForConfiguration) must call
 * `requirePermission("commercial_configuration", "write")`
 * (`src/platform/permissions/server.ts`) first, and pass the resolved
 * session's real `appUserId` as `actorUserId`, never a client-supplied
 * value (see `src/features/customer-onboarding/actions.ts` for the
 * concrete pattern). This module itself does not call requirePermission:
 * that check belongs at the Server Action/route call site, matching the
 * same layering already established for Reference Master
 * (`src/features/reference-data/actions.ts`), so this module stays
 * reusable from any future authorized call site without a parallel
 * check baked in here.
 *
 * `actorUserId` on every write function is taken as given: this module
 * trusts its caller to have already derived it from a real session. Do
 * not add a second, parallel authorization check inside this module; add
 * it at the call site, or promote it into platform/ if more than one
 * call site needs the identical check.
 */

export * as commercialConfigurationService from "./services/configuration.service"
export * as usageEarnedService from "./services/usage-earned.service"
export * as billingService from "./services/billing.service"
export * as invoiceService from "./services/invoice.service"
export * as reconciliationService from "./services/reconciliation.service"

export { getCommercialConfigurationOverview } from "./read-models/configuration-overview"
export { getCommercialComponentDetail } from "./read-models/component-detail"
export { getFinanceActivity } from "./read-models/finance-activity"
