import type { CustomerRow } from "../data/row-types"
import type { CustomerMasterRecord } from "./types"

/** Pure row-to-domain mapper: no I/O, safe to unit test directly. */
function toCustomerMasterRecord(row: CustomerRow): CustomerMasterRecord {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    segment: row.segment,
    businessUnit: row.business_unit,
    country: row.country,
    industry: row.industry,
    brandName: row.brand_name,
    address: row.address,
    state: row.state,
    city: row.city,
    postalCode: row.postal_code,
    website: row.website,
    primaryContactName: row.primary_contact_name,
    primaryContactEmail: row.primary_contact_email,
    primaryContactPhoneCountryCode: row.primary_contact_phone_country_code,
    primaryContactPhoneNumber: row.primary_contact_phone_number,
    primaryContactDesignation: row.primary_contact_designation,
    gstNumber: row.gst_number,
    pan: row.pan,
    tan: row.tan,
    taxIdentifierType: row.tax_identifier_type,
    taxIdentifierName: row.tax_identifier_name,
    taxRegistrationNumber: row.tax_registration_number,
    companyDocumentType: row.company_document_type,
    companyDocumentTypeOther: row.company_document_type_other,
    billingCurrency: row.billing_currency,
    isActive: row.is_active,
    rowVersion: row.row_version,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

export { toCustomerMasterRecord }
