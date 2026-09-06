/**
 * Side-effect import: SurveyJS base structural CSS, then the official
 * shadcn/ui "base-mira" theme adapter, matching this project's shadcn style
 * (see components.json). The adapter maps standard shadcn CSS variables
 * (--background, --primary, --radius, ...) onto SurveyJS design tokens, so a
 * rendered survey inherits Nexus's existing look instead of SurveyJS's
 * default look. Import this module once, before rendering any <Survey />.
 */
import "survey-core/survey-core.css"
import "survey-core/themes/adapters/shadcn-base-mira.css"
