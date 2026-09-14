import { toGovernedFieldDto } from "@/features/reference-data"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"
import type { CustomerMasterRecord } from "./types"

/**
 * The Customer Master API DTO (Platform Scale Program, Phase B,
 * `docs/API_INTEGRATION_ARCHITECTURE.md` §3): a stable application shape
 * a future API caller depends on, independent of `customers`' own column
 * names. `customerNumber` is deliberately absent: Customer Master has no
 * Human-Friendly ID yet (unlike onboarding/change-request/commercial-
 * version, docs/TECH_DEBT.md's "Soon" section), and this DTO does not
 * fabricate one merely to match an illustrative shape.
 */
type CustomerDto = {
  id: string
  key: string
  legalName: string
  brand: string | null
  country: ReturnType<typeof toGovernedFieldDto>
  segment: ReturnType<typeof toGovernedFieldDto>
  businessUnit: ReturnType<typeof toGovernedFieldDto>
  status: "active" | "inactive"
  createdAt: string
  updatedAt: string
}

function toCustomerDto(record: CustomerMasterRecord, snapshot: ReferenceMasterSnapshot): CustomerDto {
  return {
    id: record.id,
    key: record.key,
    legalName: record.name,
    brand: record.brandName,
    country: toGovernedFieldDto(snapshot, "country", record.country),
    segment: toGovernedFieldDto(snapshot, "segment", record.segment),
    businessUnit: toGovernedFieldDto(snapshot, "business_unit", record.businessUnit),
    status: record.isActive ? "active" : "inactive",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export { toCustomerDto }
export type { CustomerDto }
