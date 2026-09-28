import type { ResponsibleTeamStatus } from "@/platform/workflow-builder/server"

/**
 * Review-page warning (Product Gap Closure, PG-040): the request stays
 * fully actionable by any currently eligible member (deactivating a team
 * never revokes an existing member's own eligibility, only blocks NEW
 * assignments), this banner only makes an otherwise-silent fact visible
 * on the one page a reviewer is actually deciding this request from.
 * Shared across all four review surfaces so the wording and styling
 * never drift between domains.
 */
function ResponsibleTeamInactiveBanner({ responsibleTeamStatus }: { responsibleTeamStatus: ResponsibleTeamStatus | null }) {
  if (!responsibleTeamStatus || responsibleTeamStatus.isActive) return null

  return (
    <div className="flex flex-col gap-1 rounded-md border border-warning/40 bg-warning/10 px-4 py-3">
      <p className="text-xs font-medium text-foreground">The responsible team for this step, {responsibleTeamStatus.teamName}, has been deactivated.</p>
      <p className="text-xs text-muted-foreground">
        Existing eligible members of this team can still act on this request. No new work will be routed to this team going forward.
      </p>
    </div>
  )
}

export { ResponsibleTeamInactiveBanner }
