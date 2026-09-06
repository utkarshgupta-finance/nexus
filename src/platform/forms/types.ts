/**
 * `platform/forms` is the Nexus form wrapper layer: it decides how SurveyJS
 * fits Nexus UX and conventions (presentation modes, response inspection),
 * not what the business process does with a submitted form. See
 * `docs/FORM_CAPABILITY_REGISTER.md` for the full layering (SurveyJS,
 * Nexus form wrapper, Decision Engine, Approval Matrix, Flowable, Task
 * Engine, Notification Engine) and which capabilities belong where.
 */

/**
 * Presentation state for a rendered form. "edit" allows entering or changing
 * values; "readonly" renders every field non-editable so a submitted form can
 * be reviewed. Neither mode implies any authorization decision; that is a
 * platform/permissions concern, not a forms-runtime concern.
 */
type SurveyFormMode = "edit" | "readonly"

/**
 * A SurveyJS form definition as authored today: a raw JSON survey schema plus
 * a version label. There is no form-definition database yet (Stage 5B1B);
 * `formDefinitionVersion` only identifies which JSON shape a response was
 * collected against, for local/dev inspection.
 */
type SurveyFormDefinition = {
  formDefinitionVersion: string
  json: Record<string, unknown>
}

export type { SurveyFormMode, SurveyFormDefinition }
