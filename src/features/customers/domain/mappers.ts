import type { CustomerRow } from "../data/row-types"
import type { CustomerMasterRecord } from "./types"

/** Pure row-to-domain mapper: no I/O, safe to unit test directly. */
function toCustomerMasterRecord(row: CustomerRow): CustomerMasterRecord {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isActive: row.is_active,
    rowVersion: row.row_version,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

export { toCustomerMasterRecord }
