import * as configurationService from "../services/configuration.service"
import { billingCadenceLabel, billingQuantityBasisLabel, billingTimingLabel, commercialComponentLabel, pricingRuleKindLabel } from "../domain/labels"
import type { CommercialChange, CommercialComponent } from "../domain/types"
import { groupCommitmentSummaries, toCommitmentSummary } from "./configuration-overview-helpers"
import type { CommitmentSummary } from "./configuration-overview-helpers"

/**
 * Read model for the first Commercial screen: one Configuration, its
 * Components (with human-readable labels ready to render), ALL of its
 * Commitments (quantity and spend, each represented once, never
 * flattened per Component), and its Change history. Composed entirely
 * from application-service calls; batches by id set rather than looping
 * per Component, so this is a fixed small number of queries regardless
 * of how many Components a Configuration has.
 */

type ComponentSummary = {
  id: string
  label: string
  pricingRuleKindLabel: string
  /** Null for a flat (non-usage) Component. */
  measurementLabel: string | null
  billingCadenceLabel: string
  billingTimingLabel: string
  billingQuantityBasisLabel: string
  reconciliationCadenceLabel: string
  transactionCurrency: string
  effectiveFrom: string
  effectiveTo: string | null
  /** Points at the Component this one's terms replaced, when this is a renewal/amendment. */
  supersedesComponentId: string | null
  /**
   * Commitments that apply to this Component: its own quantity
   * commitment (if any) plus every spend commitment it is a member of.
   * A spend commitment shared by several Components appears, by the
   * same `id`, in each of their `commitments` lists and once in the
   * Configuration-level `commitments` list below: this is the one
   * business object referenced from multiple places, not duplicated
   * into separate fake commitments.
   */
  commitments: CommitmentSummary[]
}

type ChangeSummary = {
  id: string
  category: CommercialChange["category"]
  effectiveDate: string
  reason: string | null
}

type CommercialConfigurationOverview = {
  configuration: {
    id: string
    key: string
    name: string
    isActive: boolean
    relationshipNote: string | null
    customerId: string
  }
  components: ComponentSummary[]
  /** Every Commitment relevant to this Configuration's Components, deduplicated by id: the "all commitments" view. */
  commitments: CommitmentSummary[]
  changes: ChangeSummary[]
}

function toComponentSummary(
  component: CommercialComponent,
  measurementLabelByComponent: Map<string, string>,
  commitmentSummariesByComponentId: Map<string, CommitmentSummary[]>
): ComponentSummary {
  return {
    id: component.id,
    label: measurementLabelByComponent.get(component.id) ?? pricingRuleKindLabel(component.pricingRuleKind),
    pricingRuleKindLabel: pricingRuleKindLabel(component.pricingRuleKind),
    measurementLabel: component.measurementDefinitionId ? measurementLabelByComponent.get(component.id) ?? null : null,
    billingCadenceLabel: billingCadenceLabel(component.billingCadence),
    billingTimingLabel: billingTimingLabel(component.billingTiming),
    billingQuantityBasisLabel: billingQuantityBasisLabel(component.billingQuantityBasis),
    reconciliationCadenceLabel: billingCadenceLabel(component.reconciliationCadence),
    transactionCurrency: component.transactionCurrency,
    effectiveFrom: component.effectiveFrom,
    effectiveTo: component.effectiveTo,
    supersedesComponentId: component.supersedesComponentId,
    commitments: commitmentSummariesByComponentId.get(component.id) ?? [],
  }
}

async function getCommercialConfigurationOverview(
  commercialConfigurationId: string
): Promise<CommercialConfigurationOverview | null> {
  const configuration = await configurationService.getCommercialConfiguration(commercialConfigurationId)
  if (!configuration) return null

  const [components, changes] = await Promise.all([
    configurationService.listCommercialComponents(commercialConfigurationId),
    configurationService.listCommercialChanges(commercialConfigurationId),
  ])

  const componentIds = components.map((component) => component.id)
  const measurementDefinitionIds = [
    ...new Set(components.map((component) => component.measurementDefinitionId).filter((id): id is string => id !== null)),
  ]

  const [measurementDefinitions, commitments] = await Promise.all([
    configurationService.listMeasurementDefinitions(measurementDefinitionIds),
    configurationService.listCommitmentsForComponents(componentIds),
  ])

  const measurementNameById = new Map(measurementDefinitions.map((def) => [def.id, def.name]))
  const measurementLabelByComponent = new Map(
    components
      .filter((component) => component.measurementDefinitionId)
      .map((component) => [
        component.id,
        commercialComponentLabel(component, {
          name: measurementNameById.get(component.measurementDefinitionId as string) ?? "Unknown measurement",
        }),
      ])
  )

  const { summaries: commitmentSummaries, byComponentId: commitmentSummariesByComponentId } =
    groupCommitmentSummaries(commitments)

  return {
    configuration: {
      id: configuration.id,
      key: configuration.key,
      name: configuration.name,
      isActive: configuration.isActive,
      relationshipNote: configuration.relationshipNote,
      customerId: configuration.customerId,
    },
    components: components.map((component) =>
      toComponentSummary(component, measurementLabelByComponent, commitmentSummariesByComponentId)
    ),
    commitments: commitmentSummaries,
    changes: changes.map((change) => ({
      id: change.id,
      category: change.category,
      effectiveDate: change.effectiveDate,
      reason: change.reason,
    })),
  }
}

export { getCommercialConfigurationOverview, toCommitmentSummary }
export type { CommercialConfigurationOverview, ComponentSummary, CommitmentSummary, ChangeSummary }
