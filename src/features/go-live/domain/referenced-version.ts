import type { ComponentSummary, VersionSummary } from "@/features/commercial"

/**
 * PG-057 (Product Decision, 2026-09-29): a Go Live request stays
 * permanently bound to the Commercial Version referenced when it was
 * created ("Commercial Context (Locked)"), never silently tracking
 * whatever version is current at view/approval time. This is the pure
 * resolution of that locked snapshot from an already-loaded Commercial
 * Configuration overview: which Component the referenced version
 * actually created for this stable component, and whether a later
 * version has since closed it out (`status === "superseded"`, the same
 * derivation `toVersionSummaries` already uses).
 */
type ReferencedCommercialVersionSnapshot = {
  versionNumber: number
  componentLabel: string
  pricingModelLabel: string
  billingCadenceLabel: string
  mugSummary: string | null
  isSuperseded: boolean
  /** Only set when isSuperseded: the version number the customer's terms have since moved to, for the warning message. Null if it could not be resolved (should not normally happen once isSuperseded is true). */
  currentVersionNumber: number | null
}

function resolveReferencedVersionSnapshot(
  versions: VersionSummary[],
  components: ComponentSummary[],
  referencedChangeId: string,
  stableComponentKey: string,
  mugSummaryForComponent: (component: ComponentSummary) => string | null
): ReferencedCommercialVersionSnapshot | null {
  const referencedVersion = versions.find((version) => version.changeId === referencedChangeId)
  if (!referencedVersion) return null

  const referencedComponent = components.find(
    (component) => component.stableComponentKey === stableComponentKey && referencedVersion.componentIds.includes(component.id)
  )
  if (!referencedComponent) return null

  const isSuperseded = referencedVersion.status === "superseded"
  let currentVersionNumber: number | null = null
  if (isSuperseded) {
    const currentComponent = components.find((component) => component.stableComponentKey === stableComponentKey && component.effectiveTo === null)
    const currentVersion = currentComponent ? versions.find((version) => version.componentIds.includes(currentComponent.id)) : undefined
    currentVersionNumber = currentVersion?.versionNumber ?? null
  }

  return {
    versionNumber: referencedVersion.versionNumber,
    componentLabel: referencedComponent.label,
    pricingModelLabel: referencedComponent.pricingRuleKindLabel,
    billingCadenceLabel: referencedComponent.billingCadenceLabel,
    mugSummary: mugSummaryForComponent(referencedComponent),
    isSuperseded,
    currentVersionNumber,
  }
}

export { resolveReferencedVersionSnapshot }
export type { ReferencedCommercialVersionSnapshot }
