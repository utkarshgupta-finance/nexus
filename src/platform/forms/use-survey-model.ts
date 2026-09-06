import { useEffect, useMemo } from "react"
import { Model } from "survey-core"

import type { SurveyFormMode } from "./types"

/**
 * Builds a SurveyJS Model from a form definition and keeps it in sync with
 * the requested presentation mode. The Model instance is stable across mode
 * changes (only `survey.mode` is reassigned), so toggling edit/read-only
 * never discards values already entered.
 *
 * The mode assignment must happen in an effect, not during render: SurveyJS's
 * `mode` setter synchronously notifies the Model's own subscribers (including
 * survey-react-ui's internal re-render hook), and doing that mid-render
 * triggers React's "Cannot update during an existing state transition" error.
 *
 * SurveyJS's Model is an imperative class instance that is documented to be
 * mutated in place (`survey.mode = ...`); this is the sanctioned SurveyJS API,
 * not incidental mutation, so the React Compiler immutability lint rule is
 * disabled for this one assignment.
 */
function useSurveyModel(json: Record<string, unknown>, mode: SurveyFormMode) {
  const survey = useMemo(() => new Model(json), [json])

  useEffect(() => {
    const surveyMode = mode === "readonly" ? "display" : "edit"
    // eslint-disable-next-line react-hooks/immutability -- SurveyJS Model is an imperative instance; this is its documented API for changing presentation mode.
    survey.mode = surveyMode
  }, [survey, mode])

  return survey
}

export { useSurveyModel }
