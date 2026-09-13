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
}

async function listAuditLogForRow(tableName: string, rowId: string): Promise<AuditLogRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("table_name", tableName)
    .eq("row_id", rowId)
    .order("occurred_at", { ascending: true })
  if (error) throw new Error(`Failed to read audit_log for ${tableName}/${rowId}: ${error.message}`)
  return data ?? []
}

export { listAuditLogForRow }
export type { AuditLogRow }
