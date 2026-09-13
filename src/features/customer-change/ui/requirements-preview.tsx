import { Badge } from "@/components/ui/badge"
import type { CustomerChangeRequirement } from "../domain/types"

/** Shown before Submit (requester) and on the review screen (reviewer): task spec §17, "show Required Approvals / Required Evidence / Blocking Requirements before submission". */
function RequirementsPreview({ requirements }: { requirements: CustomerChangeRequirement[] }) {
  if (requirements.length === 0) {
    return <p className="text-xs text-muted-foreground">No additional approvals or evidence are required for the fields currently proposed.</p>
  }

  const approvals = requirements.filter((requirement) => requirement.kind === "approval")
  const evidence = requirements.filter((requirement) => requirement.kind === "evidence")

  return (
    <div className="flex flex-col gap-3">
      {approvals.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">Required Approvals</span>
          <ul className="flex flex-col gap-1.5">
            {approvals.map((requirement, index) => (
              <li key={`${requirement.roleCode}-${requirement.scopeLabel}-${index}`} className="flex items-start gap-2 text-xs">
                <Badge variant="ghost" className="bg-warning/10 text-warning">
                  {requirement.roleCode}
                  {requirement.scopeLabel ? ` (${requirement.scopeLabel})` : ""}
                </Badge>
                <span className="text-muted-foreground">{requirement.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {evidence.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-foreground">Required Evidence</span>
          <ul className="flex flex-col gap-1.5">
            {evidence.map((requirement, index) => (
              <li key={`${requirement.evidenceType}-${index}`} className="flex items-start gap-2 text-xs">
                <Badge variant="ghost" className="bg-info/10 text-info">
                  {requirement.evidenceType}
                </Badge>
                <span className="text-muted-foreground">{requirement.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export { RequirementsPreview }
