type GoLiveRequestRow = {
  id: string
  request_number: number
  customer_id: string
  commercial_configuration_id: string
  commercial_version_id: string | null
  stable_component_key: string
  go_live_date: string
  prorate_first_month: boolean
  customer_confirmation_status: string
  status: string
  workflow_version_id: string | null
  current_workflow_node_key: string | null
  workflow_cycle_number: number
  row_version: number
  comment: string | null
  sent_back_reason: string | null
  sent_back_by: string | null
  sent_back_at: string | null
  submitted_by: string | null
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancelled_reason: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

type GoLiveSendBackRow = {
  id: string
  go_live_request_id: string
  reason: string
  sent_back_by: string | null
  sent_back_at: string
}

type GoLiveDocumentRow = {
  document_id: string
  go_live_request_id: string
  document_type: string
  original_file_name: string
  mime_type: string
  size_bytes: number
  storage_bucket: string
  storage_path: string
  uploaded_by: string | null
  uploaded_at: string
  is_current: boolean
}

export type { GoLiveRequestRow, GoLiveSendBackRow, GoLiveDocumentRow }
