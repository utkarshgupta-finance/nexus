import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Generic stage state for the Process Journey. Deliberately has no notion of
 * Flowable, tasks, or approvals: a caller (eventually Flowable-backed data)
 * supplies stages already classified into these three states.
 */
type ProcessStageState = "completed" | "current" | "upcoming"

type ProcessStage = {
  id: string
  label: string
  state: ProcessStageState
  helperText?: string
}

type ProcessJourneyProps = {
  stages: ProcessStage[]
}

/**
 * Answers "where is this request in the company" (the business process),
 * not "where am I while filling out this form" (SurveyJS's own page
 * progress). Renders whatever stage array it is given; it has no fixed
 * number of stages and no fixed sequence, so a future route with a
 * different stage count renders without a code change.
 */
function ProcessJourney({ stages }: ProcessJourneyProps) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
      {stages.map((stage, index) => (
        <li key={stage.id} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-muted-foreground/60">→</span>}
          <span
            className={cn(
              "flex items-center gap-1.5",
              stage.state === "completed" && "text-foreground",
              stage.state === "current" && "font-medium text-foreground",
              stage.state === "upcoming" && "text-muted-foreground"
            )}
            title={stage.helperText}
          >
            {stage.state === "completed" ? (
              <CheckIcon className="size-3.5 text-success" />
            ) : stage.state === "current" ? (
              <span className="inline-block size-1.5 rounded-full bg-foreground" />
            ) : (
              <span className="inline-block size-1.5 rounded-full border border-muted-foreground/50" />
            )}
            {stage.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

export { ProcessJourney }
export type { ProcessStage, ProcessStageState }
