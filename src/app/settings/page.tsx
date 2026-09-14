import { redirect } from "next/navigation"

/**
 * Settings 404 fix (manual testing, repeated user report): the sidebar's
 * Settings entry has always pointed to `/settings`
 * (src/components/product/app-shell.tsx), but no page ever existed at
 * that exact path, only `/settings/customer-onboarding`. This was never
 * a permissions bug (`reference_master.read` already correctly gates
 * the real page); it was a plain missing route. Redirects to the one
 * real Settings page rather than duplicating its content here, so
 * there is exactly one Settings implementation.
 */
export default function SettingsRoute() {
  redirect("/settings/customer-onboarding")
}
