import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

/**
 * Generic, reusable read over `audit_log`
 * (20260906084244_platform_core_foundation.sql): database-enforced,
 * append-only row mutation history. Shared platform capability
 * (CLAUDE.md "Shared platform capabilities: build once, reuse
 * everywhere"), not reimplemented per feature.
 */
type AuditLogRow = {
  id: string
  resource_id: string | null
  table_name: string
  row_id: string
  action: "INSERT" | "UPDATE" | "DELETE"
  before_value: Record<string, unknown> | null
  after_value: Record<string, unknown> | null
  occurred_at: string
  actor_user_id: string | null
  request_id: string | null
  actor_context: Record<string, unknown> | null
  /** Program 4 Hardening: app_users.display_name AS IT WAS at this event, captured by fn_audit_row(). Null for rows written before this column existed. */
  actor_display_name_snapshot: string | null
  /** Program 4 Hardening: auth.users.email AS IT WAS at this event, captured by fn_audit_row(). Null for rows written before this column existed. */
  actor_email_snapshot: string | null
}

/** Most recent 500 audit_log rows for one table row, oldest first (unbounded until Platform Scale Closure, Phase O: a row with a long enough audit history would otherwise be an unbounded read). Fetched newest-first so the cap keeps the most recent history, then reversed back to the ascending order every caller expects. 500 is a generous ceiling for what is normally a handful of lifecycle events per row; revisit only if a real row is found approaching it. */
async function listAuditLogForRow(tableName: string, rowId: string): Promise<AuditLogRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("table_name", tableName)
    .eq("row_id", rowId)
    .order("occurred_at", { ascending: false })
    .limit(500)
  if (error) throw new Error(`Failed to read audit_log for ${tableName}/${rowId}: ${error.message}`)
  return (data ?? []).reverse()
}

export { listAuditLogForRow }
export type { AuditLogRow }
