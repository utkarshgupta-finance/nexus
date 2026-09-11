import { Serializer, QuestionDropdownModel } from "survey-core"

/**
 * A "dropdown" subtype used only for Country / State / City (task spec
 * "geography controls must be selection-only"): the field itself must
 * never behave like a free-text input, so these three questions render
 * through Nexus's own Combobox (search box inside an opened popup, the
 * visible field only ever shows the current selection) instead of
 * SurveyJS's built-in dropdown popup. See
 * ../ui/geography-combobox-question.tsx for the React renderer.
 *
 * Subclassing QuestionDropdownModel (rather than the base Question class)
 * means every dropdown property already used in
 * ./customer-onboarding-form-definition.ts (choices, choicesLazyLoadEnabled,
 * requiredIf, enableIf, visibleIf, placeholder, width, startWithNewLine,
 * defaultValue) keeps working unchanged. Only the rendered widget differs
 * for this type; validation, survey.data, and survey.validate() behave
 * exactly as they do for a plain dropdown.
 *
 * This module has no "use client" boundary and imports nothing from
 * survey-react-ui, so form-definition tests that only construct
 * `new Model(json)` (never render React) can register this type without
 * pulling in any React rendering dependency.
 */
const GEOGRAPHY_COMBOBOX_QUESTION_TYPE = "geographycombobox"

class QuestionGeographyComboboxModel extends QuestionDropdownModel {
  getType(): string {
    return GEOGRAPHY_COMBOBOX_QUESTION_TYPE
  }
}

Serializer.addClass(GEOGRAPHY_COMBOBOX_QUESTION_TYPE, [], () => new QuestionGeographyComboboxModel(""), "dropdown")

export { GEOGRAPHY_COMBOBOX_QUESTION_TYPE, QuestionGeographyComboboxModel }
