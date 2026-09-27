import { RequestUnavailable } from "@/components/product/request-unavailable"

/**
 * Shared 404 boundary for every /reviews/* request-detail route
 * (onboarding, change requests, commercial versions). S-014 Product
 * Decision (2026-09-27): this must render identically whether the id
 * is malformed/nonexistent or the viewer simply lacks permission for a
 * real record, so no case discloses more than another.
 */
export default function ReviewsNotFound() {
  return <RequestUnavailable />
}
