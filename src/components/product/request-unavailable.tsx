import { PageHeader } from "./page-header"

/**
 * S-014 Product Decision (2026-09-27): a nonexistent request id and a real
 * request id the viewer lacks permission for must be observably
 * indistinguishable, so this renders identically to Next's own 404 for
 * these governed request-detail route segments (see each segment's own
 * `not-found.tsx`), never a different message revealing which case
 * occurred. No record/customer/workflow detail is ever passed in.
 */
function RequestUnavailable() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Request unavailable" description="This request is unavailable or you do not have access to it." />
    </div>
  )
}

export { RequestUnavailable }
