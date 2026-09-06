import type { NexusStatus } from "@/components/product/status-badge"

export type WorkModule =
  | "Customers"
  | "Commercials"
  | "Go-Live"
  | "Ledger"
  | "Suspensions"

export type ActivityEvent = {
  label: string
  actor: string
  when: string
}

export type WorkItem = {
  id: string
  customer: string
  item: string
  module: WorkModule
  status: NexusStatus
  owner: { name: string; initials: string }
  ageDays: number
  value: number | null
  nextAction: string
  createdAt: string
  submittedAt: string
  exceptionNote?: string
  activity: ActivityEvent[]
}
