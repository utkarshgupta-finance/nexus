import type { SupabaseClient } from "@supabase/supabase-js"

import { CommercialOperationError, parseCommercialError } from "../domain/errors"

/**
 * Calls a Postgres RPC that RETURNS a single composite row (not
 * SETOF/TABLE): the shape of every M9/M10 Commercial RPC
 * (record_usage_fact, record_earned_result, record_billing_calculation,
 * create_reconciliation_adjustment, and so on). PostgREST returns this
 * shape as a single JSON object, not an array, so `data` is used as-is.
 */
async function callSingleRowRpc<TRow>(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>
): Promise<TRow> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    throw new CommercialOperationError(parseCommercialError(error))
  }
  if (!data) {
    throw new CommercialOperationError(parseCommercialError({ message: `${fn} returned no row` }))
  }
  return data as TRow
}

/**
 * Calls a Postgres RPC declared RETURNS TABLE(...): PostgREST's own
 * documented contract for a table/SETOF-returning function is a JSON
 * array, one element per row, always, regardless of how many rows the
 * function body actually produces (create_commercial_configuration_with_change
 * is the one Commercial RPC with this RETURNS shape; its body always
 * does exactly one `return query select v_change, v_config`, so exactly
 * one row is the only shape that should ever legitimately occur). This
 * function checks cardinality explicitly rather than trusting `data[0]`:
 * an empty array is treated as failure (matching callSingleRowRpc's own
 * "no row" handling), exactly one element is success, and more than one
 * element is treated as an adapter-contract violation (the RPC's own
 * body has never been able to produce that shape; if it ever did, that
 * is a signal this adapter's assumption about the RPC has gone stale,
 * not something to silently paper over by taking the first row).
 */
async function callTableRpc<TRow>(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>
): Promise<TRow> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    throw new CommercialOperationError(parseCommercialError(error))
  }
  if (!Array.isArray(data)) {
    throw new CommercialOperationError({
      kind: "unexpected_result_shape",
      message: `${fn} returned a non-array result; a RETURNS TABLE(...) function is expected to return an array.`,
      sqlState: null,
      cause: JSON.stringify(data),
    })
  }
  if (data.length === 0) {
    throw new CommercialOperationError(parseCommercialError({ message: `${fn} returned no row` }))
  }
  if (data.length > 1) {
    throw new CommercialOperationError({
      kind: "unexpected_result_shape",
      message: `${fn} returned ${data.length} rows; exactly one was expected.`,
      sqlState: null,
      cause: `row_count=${data.length}`,
    })
  }
  return data[0] as TRow
}

export { callSingleRowRpc, callTableRpc }
