import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

import { parseReferenceMasterError, ReferenceMasterOperationError } from "../domain/errors"
import type { ReferenceOptionRow } from "./row-types"

/**
 * Repository for `reference_options`
 * (supabase/migrations/20260912080000_reference_master_foundation.sql).
 * Plain table access through PostgREST, no RPC: the same shape already
 * proven by `src/features/customers/data/customers.data.ts`, gated by
 * RLS to service_role only.
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
    .from("reference_options")
    .insert({
      list_key: input.listKey,
      code: input.code,
      label: input.label,
      sort_order: input.sortOrder ?? 0,
      inr_conversion_rate: input.inrConversionRate ?? null,
      cadence_months: input.cadenceMonths ?? null,
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null,
    })
    .select("*")
    .single()
  if (error) throw new ReferenceMasterOperationError(parseReferenceMasterError(error))
  return data
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
 * `(list_key, code)` identity rather than its internal `id`: every
 * caller (Settings Add/Activate/Deactivate/governed-parameter-update)
 * already thinks in terms of the stable code, never the surrogate uuid,
 * so this repository matches that vocabulary instead of forcing every
 * call site to look up an id first.
 */
async function updateReferenceOption(input: UpdateReferenceOptionInput): Promise<ReferenceOptionRow> {
  const supabase = getSupabaseServiceRoleClient()
  const patch: Record<string, unknown> = { updated_by: input.updatedBy ?? null }
  if (input.isActive !== undefined) patch.is_active = input.isActive
  if (input.inrConversionRate !== undefined) patch.inr_conversion_rate = input.inrConversionRate
  if (input.cadenceMonths !== undefined) patch.cadence_months = input.cadenceMonths

  const { data, error } = await supabase
    .from("reference_options")
    .update(patch)
    .eq("list_key", input.listKey)
    .eq("code", input.code)
    .select("*")
    .single()
  if (error) throw new ReferenceMasterOperationError(parseReferenceMasterError(error))
  return data
}

export { listAllReferenceOptions, insertReferenceOption, updateReferenceOption }
export type { InsertReferenceOptionInput, UpdateReferenceOptionInput }
