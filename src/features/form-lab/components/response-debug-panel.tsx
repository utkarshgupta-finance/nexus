"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { ChevronsUpDownIcon } from "lucide-react"

type ResponseDebugPanelProps = {
  formDefinitionVersion: string
  data: Record<string, unknown>
}

/**
 * Development-only inspection of the live SurveyJS response, so the runtime
 * contract (what shape of JSON a form produces) is visible while building
 * against it. Nothing here is persisted.
 */
function ResponseDebugPanel({ formDefinitionVersion, data }: ResponseDebugPanelProps) {
  return (
    <Collapsible className="rounded-md border">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Development only: response inspector
          </span>
          <Badge variant="secondary">{formDefinitionVersion}</Badge>
        </div>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground">
          <ChevronsUpDownIcon className="size-4" />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="border-t px-3 py-2">
        <pre className="max-h-80 overflow-auto text-xs text-muted-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { ResponseDebugPanel }
