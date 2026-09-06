import type { ProcessStage } from "@/components/product/process-journey"
import type { ProcessContext } from "@/components/product/process-context-strip"

/**
 * Static, fictional data for the Form Lab only. Proves the Process Journey
 * component can render two differently-shaped routes without a code change;
 * it does not decide which route applies, and it is not wired to Flowable,
 * a task engine, or any persisted workflow state.
 */
const PROCESS_JOURNEY_ROUTE_A: ProcessStage[] = [
  { id: "draft", label: "Draft", state: "completed" },
  { id: "submitted", label: "Submitted", state: "completed" },
  { id: "finance_review", label: "Finance Review", state: "current" },
  { id: "approval", label: "Approval", state: "upcoming" },
  { id: "complete", label: "Complete", state: "upcoming" },
]

const PROCESS_JOURNEY_ROUTE_B: ProcessStage[] = [
  { id: "draft", label: "Draft", state: "completed" },
  { id: "submitted", label: "Submitted", state: "completed" },
  { id: "finance_review", label: "Finance", state: "completed" },
  { id: "cfo_review", label: "CFO", state: "current" },
  { id: "ceo_review", label: "CEO", state: "upcoming" },
  { id: "complete", label: "Complete", state: "upcoming" },
]

const PROCESS_CONTEXT_NO_ACTION: ProcessContext = {
  current: "Finance Review",
  next: "Approval",
  waitingWith: "Finance Team",
  yourAction: "No action required",
}

const PROCESS_CONTEXT_ACTION_NEEDED: ProcessContext = {
  current: "Finance Review",
  next: "Approval",
  waitingWith: "You",
  yourAction: "Complete requested information",
}

export {
  PROCESS_JOURNEY_ROUTE_A,
  PROCESS_JOURNEY_ROUTE_B,
  PROCESS_CONTEXT_NO_ACTION,
  PROCESS_CONTEXT_ACTION_NEEDED,
}
