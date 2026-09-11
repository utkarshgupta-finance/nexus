"use client"

import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { Model, QuestionDropdownModel } from "survey-core"
import { ReactQuestionFactory, SurveyQuestionElementBase } from "survey-react-ui"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxIcon,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox"
import type { ComboboxOption } from "@/components/ui/combobox"
import { fetchCitiesForCountry } from "../domain/geography-client"
import { CUSTOMER_ONBOARDING_FIELD_KEYS } from "../forms/customer-onboarding-form-definition"
import { GEOGRAPHY_COMBOBOX_QUESTION_TYPE } from "../forms/geography-question-model"

const CITY_SEARCH_DEBOUNCE_MS = 250
const CITY_PAGE_SIZE = 50
const CITY_SCROLL_LOAD_MORE_THRESHOLD_PX = 48

function choiceToOption(choice: { value: unknown; text?: string }): ComboboxOption {
  const value = String(choice.value)
  return { value, label: choice.text || value }
}

const isSameOption = (item: ComboboxOption | null, value: ComboboxOption | null) => item?.value === value?.value

/**
 * Country and State: a synchronous, client-filtered Combobox over the
 * question's own `choices`. Both are already fully loaded elsewhere
 * (Country from Reference Master at construction; State fetched once per
 * Country by ../ui/customer-onboarding-page.tsx), so this component only
 * ever reads `question.choices`, never fetches anything itself.
 */
function ChoiceGeographyCombobox({
  question,
  isDisplayMode,
}: {
  question: QuestionDropdownModel
  isDisplayMode: boolean
}) {
  // Not memoized on purpose: SurveyJS's `choices` array is mutated in
  // place when reassigned (the array reference itself never changes), so
  // a `useMemo([question.choices])` would silently cache the very first
  // (often still-empty) computation forever. Recomputing on every render
  // is cheap at this scale (Country tops out around 250 options) and is
  // always correct.
  const options = question.choices.map(choiceToOption)

  // Derived, not synced: `question.value` is the single source of truth,
  // so the selected option is computed fresh every render instead of
  // mirrored into its own state (which would need an effect to stay
  // correct when the value changes externally, e.g. a Country reset).
  const raw = question.value
  const selectedOption =
    raw == null || raw === ""
      ? null
      : (options.find((option) => option.value === String(raw)) ?? { value: String(raw), label: String(raw) })

  // Base UI's Combobox requires `open` to be controlled whenever `value`
  // is controlled: controlling one without the other leaves the trigger
  // unable to open at all. This state has no other purpose here.
  const [isOpen, setIsOpen] = useState(false)

  function handleValueChange(next: ComboboxOption | null) {
    // SurveyJS's Question.value setter is its own documented imperative
    // API (the same pattern already used in platform/forms/use-survey-model.ts
    // and ui/customer-onboarding-page.tsx for `survey.mode`/`survey.currentPageNo`).
    // eslint-disable-next-line react-hooks/immutability
    question.value = next ? next.value : undefined
  }

  const disabled = isDisplayMode || question.isReadOnly
  const emptyMessage = options.length === 0 ? question.placeholder || "No options available." : "No results found."

  return (
    <Combobox
      items={options}
      value={selectedOption}
      onValueChange={handleValueChange}
      isItemEqualToValue={isSameOption}
      disabled={disabled}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <ComboboxTrigger id={question.inputId} aria-required={question.isRequired}>
        <ComboboxValue placeholder={question.placeholder || "Select..."}>
          {(item: ComboboxOption | null) => item?.label}
        </ComboboxValue>
        <ComboboxIcon />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInputGroup>
          <ComboboxInput placeholder="Search..." />
        </ComboboxInputGroup>
        <ComboboxList>
          {(item: ComboboxOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}

/**
 * City: an async, server-searched Combobox (task spec: never render a
 * whole country's cities at once). Calls ../domain/geography-client
 * directly, reading the sibling Country/State values straight off
 * `question.survey`, rather than going through SurveyJS's own
 * choicesLazyLoad pipeline, since this component fully owns City's popup,
 * debouncing, and scroll-to-load-more pagination.
 */
function CityGeographyCombobox({
  question,
  isDisplayMode,
}: {
  question: QuestionDropdownModel
  isDisplayMode: boolean
}) {
  // `question.survey` is typed as the narrower `ISurvey` interface, which
  // does not declare `getValue`; the running survey is always a `Model`
  // instance (see platform/forms/use-survey-model.ts), which does.
  const surveyModel = question.survey as Model | undefined
  const countryValue = surveyModel?.getValue(CUSTOMER_ONBOARDING_FIELD_KEYS.country) as string | undefined
  const stateValue = surveyModel?.getValue(CUSTOMER_ONBOARDING_FIELD_KEYS.state) as string | undefined

  const [selectedOption, setSelectedOption] = useState<ComboboxOption | null>(null)
  const [items, setItems] = useState<ComboboxOption[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const requestSequence = useRef(0)

  // Adjusting state during render, not in an effect (react.dev: "Adjusting
  // state when a prop changes"): City's selected option cannot be purely
  // derived like Country/State's, since its label may not be in the
  // currently loaded page of async results, so it is cached in state and
  // only reset here when `question.value` itself changes underneath this
  // component (an external Save Draft reload or a Country/State reset),
  // never on a render caused by something else.
  const [lastSyncedValue, setLastSyncedValue] = useState(question.value)
  if (lastSyncedValue !== question.value) {
    setLastSyncedValue(question.value)
    if (question.value == null || question.value === "") {
      setSelectedOption(null)
    }
  }

  // Same pattern: Country/State changing underneath City means its
  // previously loaded results no longer apply, so this resets them
  // immediately rather than showing stale results from the previous scope
  // for one extra render.
  const scopeKey = `${countryValue ?? ""}|${stateValue ?? ""}`
  const [lastScopeKey, setLastScopeKey] = useState(scopeKey)
  if (lastScopeKey !== scopeKey) {
    setLastScopeKey(scopeKey)
    setItems([])
    setTotalCount(0)
    setInputValue("")
  }

  const runSearch = useCallback(
    async (search: string, skip: number, append: boolean) => {
      if (!countryValue) return
      const thisRequest = ++requestSequence.current
      setIsLoading(true)
      const result = await fetchCitiesForCountry({
        countryIso2: countryValue,
        stateCode: stateValue ?? null,
        search,
        skip,
        take: CITY_PAGE_SIZE,
      })
      if (thisRequest !== requestSequence.current) return
      setItems((current) => (append ? [...current, ...result.items] : result.items))
      setTotalCount(result.totalCount)
      setIsLoading(false)
    },
    [countryValue, stateValue]
  )

  // Only searches while the popup is actually open: City must not fetch
  // anything on mount merely because Country defaults to India (task
  // spec: India cities become searchable immediately once the popup is
  // opened, not eagerly on page load).
  useEffect(() => {
    if (!isOpen || !countryValue) return undefined
    const handle = setTimeout(() => {
      void runSearch(inputValue, 0, false)
    }, CITY_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [inputValue, isOpen, countryValue, runSearch])

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
  }

  function handleListScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < CITY_SCROLL_LOAD_MORE_THRESHOLD_PX
    if (nearBottom && !isLoading && items.length < totalCount) {
      void runSearch(inputValue, items.length, true)
    }
  }

  function handleValueChange(next: ComboboxOption | null) {
    setSelectedOption(next)
    // eslint-disable-next-line react-hooks/immutability -- see ChoiceGeographyCombobox above.
    question.value = next ? next.value : undefined
  }

  const disabled = isDisplayMode || question.isReadOnly || !countryValue
  const placeholder = !countryValue ? "Select country first" : question.placeholder || "Type to search"

  return (
    <Combobox
      items={items}
      value={selectedOption}
      onValueChange={handleValueChange}
      onInputValueChange={setInputValue}
      filter={null}
      isItemEqualToValue={isSameOption}
      disabled={disabled}
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <ComboboxTrigger id={question.inputId} aria-required={question.isRequired}>
        <ComboboxValue placeholder={placeholder}>{(item: ComboboxOption | null) => item?.label}</ComboboxValue>
        <ComboboxIcon />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInputGroup>
          <ComboboxInput placeholder="Search cities..." />
        </ComboboxInputGroup>
        <ComboboxList onScroll={handleListScroll}>
          {(item: ComboboxOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{isLoading ? "Searching..." : "No cities found."}</ComboboxEmpty>
        {isLoading ? <ComboboxStatus>Searching for cities...</ComboboxStatus> : null}
      </ComboboxContent>
    </Combobox>
  )
}

function GeographyComboboxField({
  question,
  isDisplayMode,
}: {
  question: QuestionDropdownModel
  isDisplayMode: boolean
}) {
  if (question.name === CUSTOMER_ONBOARDING_FIELD_KEYS.city) {
    return <CityGeographyCombobox question={question} isDisplayMode={isDisplayMode} />
  }
  return <ChoiceGeographyCombobox question={question} isDisplayMode={isDisplayMode} />
}

/**
 * The SurveyJS-facing wrapper: extends SurveyQuestionElementBase exactly
 * as every built-in question renderer does, so this question keeps
 * re-rendering whenever the underlying question's reactive properties
 * change (value, choices, placeholder, isRequired, ...), the same
 * mechanism that already drives every other question type in this
 * survey. All interactive behavior lives in GeographyComboboxField above.
 */
class SurveyGeographyComboboxQuestion extends SurveyQuestionElementBase {
  protected getStateElement() {
    return this.questionBase
  }

  protected get question(): QuestionDropdownModel {
    return this.questionBase as QuestionDropdownModel
  }

  protected renderElement(): React.JSX.Element {
    return <GeographyComboboxField question={this.question} isDisplayMode={this.isDisplayMode} />
  }
}

// ReactQuestionFactory's own typing declares this creator as `(name:
// string) => JSX.Element`, but survey-react-ui actually invokes every
// registered creator with the question's full render props object (see
// every other built-in registerQuestion call in survey-react-ui itself,
// e.g. registerQuestion("text", (props) => createElement(SurveyQuestionText, props))).
// `unknown` here is the correct, honest type for "whatever the real
// runtime prop object shape is, this factory's own declaration does not
// say."
ReactQuestionFactory.Instance.registerQuestion(GEOGRAPHY_COMBOBOX_QUESTION_TYPE, (props: unknown) => (
  <SurveyGeographyComboboxQuestion {...(props as Record<string, unknown>)} />
))

export { GeographyComboboxField }
