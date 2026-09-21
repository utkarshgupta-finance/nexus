import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

/**
 * PD-005 (D-022, Batches 1-13 Ledger Audit product decision closure):
 * thin wrapper over `fn_user_has_customer_scoped_permission`
 * (supabase/migrations/20260930110000_scoped_authorization_foundation.sql),
 * the one place that actually resolves whether a user's non-global
 * `user_roles` grants (Business Unit, Territory, or specific Customer
 * scope) cover a given customer record. Only called when the caller
 * already lacks a global grant for this resource/action; see
 * ../server.ts's `hasPermissionForCustomer`/`requirePermissionForCustomer`.
 */
async function userHasCustomerScopedPermission(userId: string, resource: string, action: string, customerId: string): Promise<boolean> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("fn_user_has_customer_scoped_permission", {
    p_user_id: userId,
    p_resource: resource,
    p_action: action,
    p_customer_id: customerId,
  })
  if (error) throw error
  return data === true
}

/**
 * PD-005 follow-up (Product Decision Closure): the business-unit-only
 * sibling, for a Customer Onboarding case before approval has resolved
 * a real customer id (`supabase/migrations/20260930130000_...sql`).
 */
async function userHasBusinessUnitScopedPermission(userId: string, resource: string, action: string, businessUnit: string | null): Promise<boolean> {
  if (!businessUnit) return false
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("fn_user_has_business_unit_scoped_permission", {
    p_user_id: userId,
    p_resource: resource,
    p_action: action,
    p_business_unit: businessUnit,
  })
  if (error) throw error
  return data === true
}

/** Bulk resolution for list/search surfaces: every customer id this user can act on for (resource, action). Only called when the caller lacks a global grant. */
async function getScopedCustomerIds(userId: string, resource: string, action: string): Promise<Set<string>> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("fn_user_scoped_customer_ids", { p_user_id: userId, p_resource: resource, p_action: action })
  if (error) throw error
  return new Set((data ?? []).map((row: { customer_id: string }) => row.customer_id))
}

/** Bulk resolution sibling of getScopedCustomerIds, for filtering the Onboarding portion of a cross-customer list where no customer id exists yet. */
async function getScopedBusinessUnits(userId: string, resource: string, action: string): Promise<Set<string>> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("fn_user_scoped_business_units", { p_user_id: userId, p_resource: resource, p_action: action })
  if (error) throw error
  return new Set((data ?? []).map((row: { business_unit_key: string }) => row.business_unit_key))
}

/** Page-level existence check: does this user hold ANY grant at all (global or scoped) for (resource, action)? See fn_user_has_any_scoped_permission's own comment for why this is distinct from the row-filtering functions above. */
async function userHasAnyScopedPermission(userId: string, resource: string, action: string): Promise<boolean> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("fn_user_has_any_scoped_permission", { p_user_id: userId, p_resource: resource, p_action: action })
  if (error) throw error
  return data === true
}

export {
  userHasCustomerScopedPermission,
  userHasBusinessUnitScopedPermission,
  getScopedCustomerIds,
  getScopedBusinessUnits,
  userHasAnyScopedPermission,
}
