import { PageHeader } from "@/components/product/page-header"
import type { MyWorkItem } from "@/platform/approvals/domain/my-work"
import { MyWorkTable } from "./my-work-table"

/**
 * My Work (task spec): a personal, actionable summary, distinct from
 * Approvals (a workflow-focused list of everything awaiting a decision).
 * Sections only ever appear when they have something in them; an empty
 * My Work is a genuinely good state, not a broken one.
 */
function MyWorkPage({ items }: { items: MyWorkItem[] }) {
  const sentBackToMe = items.filter((item) => item.reason === "sent_back_to_me")
  const pendingMyApproval = items.filter((item) => item.reason === "pending_my_approval")
  const draftsToContinue = items.filter((item) => item.reason === "draft_to_continue")
  const waitingOnOthers = items.filter((item) => item.reason === "waiting_on_others")

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="My Work" description="Requests sent back to you, requests waiting on your approval, and your own drafts still in progress." />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        {items.length === 0 ? (
          <div className="flex flex-col items-start gap-1 rounded-md border border-dashed px-4 py-8">
            <p className="text-xs font-medium text-foreground">Nothing needs your attention right now.</p>
            <p className="text-xs text-muted-foreground">Sent-back requests, pending approvals, and your own drafts will show up here.</p>
          </div>
        ) : (
          <>
            <MyWorkTable title="Sent Back to Me" items={sentBackToMe} />
            <MyWorkTable title="Pending My Approval" items={pendingMyApproval} />
            <MyWorkTable title="Drafts to Continue" items={draftsToContinue} />
            <MyWorkTable title="Waiting on Others" items={waitingOnOthers} />
          </>
        )}
      </div>
    </div>
  )
}

export { MyWorkPage }
