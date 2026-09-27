import { RequestUnavailable } from "@/components/product/request-unavailable"

/**
 * 404 boundary for a single Go Live request detail page. S-014 Product
 * Decision (2026-09-27): this must render identically whether the id
 * is malformed/nonexistent or the viewer simply lacks permission for a
 * real record, so no case discloses more than another. Scoped to this
 * one segment only, not the whole customer/go-live tree.
 */
export default function GoLiveRequestNotFound() {
  return <RequestUnavailable />
}
