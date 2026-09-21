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

export { userHasCustomerScopedPermission }
