import "server-only"

/**
 * TRUSTED, UNAUTHENTICATED, SERVER-ONLY Commercial entry point.
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
 * access. As of this commit, Nexus has no authentication, session, or
 * permission primitive anywhere in src/ to check that against:
 * docs/AUTHORIZATION_MODEL.md and docs/PLATFORM_ARCHITECTURE.md are
 * both explicitly locked design, "not implemented yet," and a direct
 * search of this repository found zero session helpers, zero auth
 * guards, zero permission checks, and zero middleware.ts. This is a
 * confirmed, known gap, not an oversight this comment is papering over.
 *
 * Concretely, this means:
 *   - Fine to call from a script, a trusted internal tool, or a Server
 *     Component/Server Action that has ALREADY independently established
 *     (by whatever means, even manually reviewed for now) that the
 *     current caller may see this data.
 *   - NOT fine to wire directly to a route/Server Action that trusts a
 *     browser-supplied id (a URL param, a form field) as the scope of
 *     what to return or mutate, for an arbitrary logged-in user, without
 *     an authorization check in between. No such check exists to insert
 *     yet; building the UI shell against fixture/mock data does not
 *     require one, but connecting it to live Commercial data for
 *     multiple real users does, and should not happen until Nexus's
 *     permission platform capability exists. Add that check at the
 *     Server Component/Server Action call site once it does, or promote
 *     it into a thin wrapper here; do not invent a parallel one.
 *
 * Actor identity for writes (createCommercialConfiguration, etc.) has
 * the same caveat: `actorUserId` is taken as given, not derived from a
 * session, because there is no session to derive it from yet. See each
 * service file's own write functions for the parameter shape this
 * implies.
 */

export * as commercialConfigurationService from "./services/configuration.service"
export * as usageEarnedService from "./services/usage-earned.service"
export * as billingService from "./services/billing.service"
export * as invoiceService from "./services/invoice.service"
export * as reconciliationService from "./services/reconciliation.service"

export { getCommercialConfigurationOverview } from "./read-models/configuration-overview"
export { getCommercialComponentDetail } from "./read-models/component-detail"
export { getFinanceActivity } from "./read-models/finance-activity"
