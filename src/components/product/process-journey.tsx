import { CheckIcon, CircleAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Generic stage state for the Process Journey. Deliberately has no notion of
 * Flowable, tasks, or approvals: a caller (eventually Flowable-backed data)
 * supplies stages already classified into these states.
 *
 * "completed" / "current" / "upcoming" are the original sequential-workflow
 * states (a gate you pass through once, in order; see Form Lab's demo
 * usage). "complete" / "attention" / "not_started" are a second, later
 * vocabulary for a freely-navigable draft form whose stages are evaluated
 * from actual field/document data rather than from step order (Customer
 * Onboarding; see ../../features/customer-onboarding/domain/stage-status.ts).
 * Both live on the same union so this one shared component keeps serving
 * both callers rather than a second stage indicator being built; the near-
 * duplicate spelling ("completed" vs "complete") is deliberate so neither
 * caller's existing values collide with the other's.
 */
type ProcessStageState = "completed" | "current" | "upcoming" | "complete" | "attention" | "not_started"

type ProcessStage = {
  id: string
  label: string
  state: ProcessStageState
  /**
   * Which stage the user is actively viewing right now, independent of
   * `state`: a stage can be the current one AND still be incomplete. Only
   * meaningful for the complete/attention/not_started vocabulary; the
   * older completed/current/upcoming vocabulary already encodes "current"
   * as a state value and does not need this.
   */
  isCurrent?: boolean
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
      {stages.map((stage, index) => {
        const isEmphasized = stage.state === "current" || stage.isCurrent === true
        return (
          <li key={stage.id} className="flex items-center gap-1.5">
            {index > 0 && <span className="text-muted-foreground/60">→</span>}
            <span
              className={cn(
                "flex items-center gap-1.5",
                (stage.state === "completed" || stage.state === "complete") && "text-foreground",
                stage.state === "attention" && "text-foreground",
                stage.state === "upcoming" && "text-muted-foreground",
                stage.state === "not_started" && "text-muted-foreground",
                isEmphasized && "font-medium text-foreground"
              )}
              title={stage.helperText}
            >
              {stage.state === "completed" || stage.state === "complete" ? (
                <CheckIcon className="size-3.5 text-success" />
              ) : stage.state === "attention" ? (
                <CircleAlertIcon className="size-3.5 text-destructive" />
              ) : stage.state === "current" ? (
                <span className="inline-block size-1.5 rounded-full bg-foreground" />
              ) : (
                <span className="inline-block size-1.5 rounded-full border border-muted-foreground/50" />
              )}
              {stage.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export { ProcessJourney }
export type { ProcessStage, ProcessStageState }
