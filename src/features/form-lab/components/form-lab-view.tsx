"use client"

import { useEffect, useState } from "react"
import { Survey } from "survey-react-ui"

import "@/platform/forms/survey-theme"
import { useSurveyModel } from "@/platform/forms/use-survey-model"
import type { SurveyFormMode } from "@/platform/forms/types"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ProcessJourney } from "@/components/product/process-journey"
import { ProcessContextStrip } from "@/components/product/process-context-strip"
import { FINANCE_EXCEPTION_REQUEST_FORM } from "@/features/form-lab/data/finance-exception-request-form"
import {
  PROCESS_JOURNEY_ROUTE_A,
  PROCESS_JOURNEY_ROUTE_B,
  PROCESS_CONTEXT_NO_ACTION,
  PROCESS_CONTEXT_ACTION_NEEDED,
} from "@/features/form-lab/data/process-journey-demo"
import { ResponseDebugPanel } from "@/features/form-lab/components/response-debug-panel"

type ProcessJourneyDemoRoute = "a" | "b"
type ProcessContextDemoState = "no-action" | "action-needed"

function FormLabView() {
  const [mode, setMode] = useState<SurveyFormMode>("edit")
  const [journeyRoute, setJourneyRoute] = useState<ProcessJourneyDemoRoute>("a")
  const [contextState, setContextState] = useState<ProcessContextDemoState>("no-action")
  const survey = useSurveyModel(FINANCE_EXCEPTION_REQUEST_FORM.json, mode)
  const [responseData, setResponseData] = useState<Record<string, unknown>>(() => ({
    ...survey.data,
  }))

  useEffect(() => {
    const handleValueChanged = () => setResponseData({ ...survey.data })
    survey.onValueChanged.add(handleValueChanged)
    survey.onComplete.add(handleValueChanged)
    return () => {
      survey.onValueChanged.remove(handleValueChanged)
      survey.onComplete.remove(handleValueChanged)
    }
  }, [survey])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">Form Lab</h1>
          <span className="text-sm text-muted-foreground">REQ-2026-00842 (fictional)</span>
          <Badge variant="outline">Development only</Badge>
        </div>
        <ToggleGroup
          value={[mode]}
          onValueChange={(value) => {
            if (value[0]) setMode(value[0] as SurveyFormMode)
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="edit">Edit mode</ToggleGroupItem>
          <ToggleGroupItem value="readonly">Read-only mode</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <p className="text-sm text-muted-foreground">
        Internal capability check for the SurveyJS form runtime. Not linked from
        navigation. All data on this page is fictional.
      </p>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Process journey
          </span>
          <span className="text-xs text-muted-foreground">
            Where this request is in the company. Static demo data, not real workflow state.
          </span>
        </div>
        <ProcessJourney stages={journeyRoute === "a" ? PROCESS_JOURNEY_ROUTE_A : PROCESS_JOURNEY_ROUTE_B} />
        <ProcessContextStrip
          context={contextState === "no-action" ? PROCESS_CONTEXT_NO_ACTION : PROCESS_CONTEXT_ACTION_NEEDED}
        />
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/20 px-3 py-2">
          <span className="text-xs text-muted-foreground">Development only: Process Journey demo controls</span>
          <ToggleGroup
            value={[journeyRoute]}
            onValueChange={(value) => {
              if (value[0]) setJourneyRoute(value[0] as ProcessJourneyDemoRoute)
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="a">Route A (5 stages)</ToggleGroupItem>
            <ToggleGroupItem value="b">Route B (6 stages)</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            value={[contextState]}
            onValueChange={(value) => {
              if (value[0]) setContextState(value[0] as ProcessContextDemoState)
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="no-action">No action needed</ToggleGroupItem>
            <ToggleGroupItem value="action-needed">Action needed</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Form progress
        </span>
        <Survey model={survey} />
      </div>

      <ResponseDebugPanel
        formDefinitionVersion={FINANCE_EXCEPTION_REQUEST_FORM.formDefinitionVersion}
        data={responseData}
      />
    </div>
  )
}

export { FormLabView }
