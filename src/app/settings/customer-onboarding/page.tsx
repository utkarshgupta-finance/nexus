import { ReferenceMasterSettings } from "@/features/reference-data/ui/reference-master-settings"

/**
 * Reference Master management for Customer Onboarding. Local-development
 * backed only: Nexus has no per-user authorization boundary yet, so this
 * page must not perform any live, service_role-backed write. See
 * ReferenceMasterSettings's own header comment for the full reasoning.
 */

export default function CustomerOnboardingSettingsPage() {
  return <ReferenceMasterSettings />
}
