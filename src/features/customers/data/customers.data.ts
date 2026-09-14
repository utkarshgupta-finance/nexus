import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { CustomerOperationError, parseCustomerError } from "../domain/errors"
import type { CustomerRow } from "./row-types"

/**
 * Repository for `customers` (Migration 7,
 * supabase/migrations/20260908013210_master_data_foundation.sql). Plain
 * table access, no RPC: this table has no write RPC, only ordinary
 * INSERT/SELECT through PostgREST, both gated by RLS to service_role
 * only (docs/MASTER_DATA_FOUNDATION_DESIGN.md §11).
 */

async function getCustomerByKey(key: string): Promise<CustomerRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("customers").select("*").eq("key", key).maybeSingle()
  if (error) throw new CustomerOperationError(parseCustomerError(error))
  return data
}

/** By stable Customer Master id, the only identifier a Commercial Configuration is allowed to link through (never legal name/brand name/GST/PAN). */
async function getCustomerById(id: string): Promise<CustomerRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle()
  if (error) throw new CustomerOperationError(parseCustomerError(error))
  return data
}

/** Every customer matching a batch of ids, in one query, instead of one round trip per id: the pattern every list-with-customer-name page (Approvals, My Requests, Reviews) otherwise falls into. Order is not guaranteed to match `ids`; callers key results by `.id` themselves. */
async function getCustomersByIds(ids: string[]): Promise<CustomerRow[]> {
  if (ids.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("customers").select("*").in("id", ids)
  if (error) throw new CustomerOperationError(parseCustomerError(error))
  return data ?? []
}

async function listCustomers(): Promise<CustomerRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: true })
  if (error) throw new CustomerOperationError(parseCustomerError(error))
  return data ?? []
}

type InsertCustomerInput = {
  key: string
  name: string
  createdBy?: string | null
}

/**
 * Inserts one `customers` row. Used only by the seed script
 * (scripts/seed-demo-customer.ts): nothing in the live app calls this
 * from a route or Server Action, since Customer creation is not yet a
 * real, authorized user-facing flow (that is the future Customer
 * Onboarding -> Customer Master persistence stage this task explicitly
 * does not build).
 */
async function insertCustomer(input: InsertCustomerInput): Promise<CustomerRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customers")
    .insert({ key: input.key, name: input.name, created_by: input.createdBy ?? null })
    .select("*")
    .single()
  if (error) throw new CustomerOperationError(parseCustomerError(error))
  return data
}

/**
 * Sets `is_active` (the one column fn_protect_customer_lifecycle
 * already permits to change in either direction) through the real,
 * governed `set_customer_active` RPC (task Phase I), not a plain
 * PostgREST `.update()`: a plain update never calls `set_config
 * ('app.current_user_id', ...)`, so `fn_audit_row`'s trigger recorded
 * every prior deactivate/reactivate with a NULL actor in audit_log,
 * even though `updated_by` on the row itself was correct. Requires a
 * reason, persisted into that same audit_log row's `actor_context`.
 */
async function setCustomerActive(customerId: string, isActive: boolean, reason: string, actorUserId: string): Promise<CustomerRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("set_customer_active", {
    p_customer_id: customerId,
    p_is_active: isActive,
    p_reason: reason,
    p_actor_user_id: actorUserId,
  })
  if (error) throw new CustomerOperationError(parseCustomerError(error))
  return data
}

export { getCustomerByKey, getCustomerById, getCustomersByIds, listCustomers, insertCustomer, setCustomerActive }
export type { InsertCustomerInput }
