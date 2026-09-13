"use client"

import { useState } from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs"
import { filterByBucket, labelForItemType } from "@/platform/approvals/domain/inbox"
import type { ApprovalInboxBucket, ApprovalInboxItem } from "@/platform/approvals/domain/types"

/**
 * Unified Approvals inbox table (task Phase E): one operational list
 * across Customer Onboarding, Customer Change Requests, and Commercial
 * Configuration Versions. Filtering is plain client-side state over an
 * already-fetched, already-small list (an operational inbox, not a
 * report), matching this component's own restrained scope.
 */

const BUCKET_TABS: { value: ApprovalInboxBucket | "all"; label: string }[] = [
  { value: "needs_action", label: "Needs My Action" },
  { value: "sent_back", label: "Sent Back" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
]

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")
}

function ApprovalInboxTable({ items }: { items: ApprovalInboxItem[] }) {
  const [bucket, setBucket] = useState<ApprovalInboxBucket | "all">("needs_action")
  const visible = filterByBucket(items, bucket)

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={bucket} onValueChange={(value) => setBucket(value as ApprovalInboxBucket | "all")}>
        <TabsList>
          {BUCKET_TABS.map((tab) => (
            <TabsTab key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <div className="flex flex-col items-start gap-1 rounded-md border border-dashed px-4 py-6">
          <p className="text-xs font-medium text-foreground">Nothing here</p>
          <p className="text-xs text-muted-foreground">No requests currently match this filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item) => (
                <TableRow key={`${item.type}-${item.requestId}`} className="hover:bg-transparent">
                  <TableCell className="text-foreground">{labelForItemType(item.type)}</TableCell>
                  <TableCell className="font-medium text-foreground">{item.customerName}</TableCell>
                  <TableCell className="text-muted-foreground">{item.requestedByEmail ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="ghost" className="bg-muted text-muted-foreground">
                      {statusLabel(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(item.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" render={<Link href={item.href} />}>
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export { ApprovalInboxTable }
