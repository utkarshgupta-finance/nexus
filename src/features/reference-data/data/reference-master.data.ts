import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { parseReferenceMasterError, ReferenceMasterOperationError } from "../domain/errors"
import type { ReferenceOptionRow } from "./row-types"

/**
 * Repository for `reference_options`
 * (supabase/migrations/20260912080000_reference_master_foundation.sql).
 * Reads are plain PostgREST table access; every write goes through an
 * RPC function instead
 * (supabase/migrations/20260912150000_auth_authorization_foundation.sql),
 * because that is the only way a real actor identity reaches
 * `audit_log.actor_user_id`: the audit trigger reads a transaction-local
 * Postgres setting (`app.current_user_id`), and PostgREST gives each
 * plain `.insert()`/`.update()` call its own transaction, so there is no
 * way to `set_config` before a separate mutation call across two
 * supabase-js requests. Every Commercial RPC already uses this same
 * set_config-then-mutate-in-one-transaction shape.
 */

async function listAllReferenceOptions(): Promise<ReferenceOptionRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reference_options")
    .select("*")
    .order("list_key", { ascending: true })
    .order("sort_order", { ascending: true })
  if (error) throw new ReferenceMasterOperationError(parseReferenceMasterError(error))
  return data ?? []
}

type InsertReferenceOptionInput = {
  listKey: string
  code: string
  label: string
  sortOrder?: number
  inrConversionRate?: number | null
  cadenceMonths?: number | null
  createdBy?: string | null
}

async function insertReferenceOption(input: InsertReferenceOptionInput): Promise<ReferenceOptionRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .rpc("add_reference_option", {
      p_list_key: input.listKey,
      p_code: input.code,
      p_label: input.label,
      p_sort_order: input.sortOrder ?? 0,
      p_inr_conversion_rate: input.inrConversionRate ?? null,
      p_cadence_months: input.cadenceMonths ?? null,
      p_actor_user_id: input.createdBy ?? null,
    })
    .single()
  if (error) throw new ReferenceMasterOperationError(parseReferenceMasterError(error))
  return data as ReferenceOptionRow
}

type UpdateReferenceOptionInput = {
  listKey: string
  code: string
  isActive?: boolean
  inrConversionRate?: number | null
  cadenceMonths?: number | null
  updatedBy?: string | null
}

/**
 * Updates the mutable fields of one option, addressed by its stable
 * `(list_key, code)` identity rather than its internal `id`. Dispatches
 * to one of three narrow RPC functions depending on which field this
 * call actually changes, matching the three distinct governed operations
 * Settings performs (Activate/Deactivate, Currency FX edit, Invoice
 * Frequency cadence edit); a caller that provides more than one of
 * `isActive`/`inrConversionRate`/`cadenceMonths` at once is a
 * programming error, not a supported combined update.
 */
async function updateReferenceOption(input: UpdateReferenceOptionInput): Promise<ReferenceOptionRow> {
  const supabase = getSupabaseServiceRoleClient()

  if (input.isActive !== undefined) {
    const { data, error } = await supabase
      .rpc("set_reference_option_active", {
        p_list_key: input.listKey,
        p_code: input.code,
        p_is_active: input.isActive,
        p_actor_user_id: input.updatedBy ?? null,
      })
      .single()
    if (error) throw new ReferenceMasterOperationError(parseReferenceMasterError(error))
    return data as ReferenceOptionRow
  }

  if (input.inrConversionRate !== undefined) {
    const { data, error } = await supabase
      .rpc("update_currency_inr_conversion_rate", {
        p_code: input.code,
        p_inr_conversion_rate: input.inrConversionRate,
        p_actor_user_id: input.updatedBy ?? null,
      })
      .single()
    if (error) throw new ReferenceMasterOperationError(parseReferenceMasterError(error))
    return data as ReferenceOptionRow
  }

  if (input.cadenceMonths !== undefined) {
    const { data, error } = await supabase
      .rpc("update_invoice_frequency_cadence", {
        p_code: input.code,
        p_cadence_months: input.cadenceMonths,
        p_actor_user_id: input.updatedBy ?? null,
      })
      .single()
    if (error) throw new ReferenceMasterOperationError(parseReferenceMasterError(error))
    return data as ReferenceOptionRow
  }

  throw new ReferenceMasterOperationError({ kind: "invalid_input", message: "updateReferenceOption requires at least one field to update." })
}

export { listAllReferenceOptions, insertReferenceOption, updateReferenceOption }
export type { InsertReferenceOptionInput, UpdateReferenceOptionInput }
