import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { DeletionOperationError, parseDeletionError } from "../domain/deletion-errors"
import type { CustomerDeletionAuditRow } from "./deletion-row-types"

/**
 * Repository for Permanent Customer Deletion eligibility reads and the
 * `delete_customer_permanently` RPC
 * (supabase/migrations/20260913080000_permanent_customer_deletion.sql,
 * 20260913081000_fix_delete_customer_permanently_eligibility.sql).
 * Eligibility itself is computed from plain reads (no RPC needed for a
 * read), exactly matching the real facts the RPC re-checks server-side.
 */

async function countCommercialConfigurations(customerId: string): Promise<number> {
  const supabase = getSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("commercial_configurations")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
  if (error) throw new DeletionOperationError(parseDeletionError(error))
  return count ?? 0
}

async function countApprovedChangeRequests(customerId: string): Promise<number> {
  const supabase = getSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("customer_change_requests")
    .select("request_id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("status", "approved")
  if (error) throw new DeletionOperationError(parseDeletionError(error))
  return count ?? 0
}

async function deleteCustomerPermanently(customerId: string, reason: string, actorUserId: string): Promise<CustomerDeletionAuditRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("delete_customer_permanently", {
    p_customer_id: customerId,
    p_reason: reason,
    p_actor_user_id: actorUserId,
  })
  if (error) throw new DeletionOperationError(parseDeletionError(error))
  if (!data) throw new DeletionOperationError(parseDeletionError({ message: "delete_customer_permanently returned no row" }))
  return data as CustomerDeletionAuditRow
}

export { countCommercialConfigurations, countApprovedChangeRequests, deleteCustomerPermanently }
