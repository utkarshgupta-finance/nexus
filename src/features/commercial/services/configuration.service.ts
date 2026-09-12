import * as configurationData from "../data/configuration.data"
import {
  toCommercialChange,
  toCommercialCommitment,
  toCommercialComponent,
  toCommercialConfiguration,
  toMeasurementDefinition,
} from "../data/mappers"
import type {
  BillingQuantityBasis,
  BillingTiming,
  CommercialChange,
  CommercialCommitment,
  CommercialComponent,
  CommercialConfiguration,
  ComponentBillingCadence,
  MeasurementDefinition,
  PricingRuleKind,
} from "../domain/types"
import type {
  AddCommercialCommitmentInput,
  CreateCommercialChangeInput,
  CreateCommercialConfigurationInput,
  RequestRow,
} from "../data/configuration.data"

/**
 * Application service for Commercial Configuration setup. Thin
 * orchestration over the data/ repository today: this app has no
 * permissions/authorization platform capability yet
 * (docs/PLATFORM_ARCHITECTURE.md is locked design, not implemented), so
 * authorization checks are not wired in here. Add them at this layer,
 * not inside data/, once that capability exists; do not invent a
 * parallel check in the meantime.
 *
 * Every write function below takes `actorUserId` as its own explicit
 * parameter, never as a field inside the business-payload object. This
 * is deliberate: it stops a future call site from doing something like
 * `createCommercialConfiguration({ ...formValues })` and having whatever
 * a browser happened to submit as `actorUserId` flow straight into
 * `created_by` on a permanent Finance record. It does not, by itself,
 * prove the value is genuine; Nexus has no session to derive it from
 * yet. The caller (eventually a Server Action reading real session
 * state) remains responsible for supplying a trustworthy value.
 */

type CreateCommercialConfigurationResult = {
  commercialChange: CommercialChange
  commercialConfiguration: CommercialConfiguration
}

async function createCommercialConfiguration(
  input: Omit<CreateCommercialConfigurationInput, "actorUserId">,
  actorUserId: string
): Promise<CreateCommercialConfigurationResult> {
  const result = await configurationData.createCommercialConfigurationWithChange({ ...input, actorUserId })
  return {
    commercialChange: toCommercialChange(result.commercialChange),
    commercialConfiguration: toCommercialConfiguration(result.commercialConfiguration),
  }
}

async function getCommercialConfiguration(id: string): Promise<CommercialConfiguration | null> {
  const row = await configurationData.getCommercialConfigurationById(id)
  return row ? toCommercialConfiguration(row) : null
}

/** One Commercial Configuration per customer is the common case; a customer may have more than one (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §3). */
async function listCommercialConfigurationsByCustomer(customerId: string): Promise<CommercialConfiguration[]> {
  const rows = await configurationData.listCommercialConfigurationsByCustomerId(customerId)
  return rows.map(toCommercialConfiguration)
}

/** Mints a real requests row for a Commercial Change to extend. See create_system_commercial_request's own migration comment. */
async function createSystemCommercialRequest(input: { newRequestId: string; actorUserId: string }): Promise<RequestRow> {
  return configurationData.createSystemCommercialRequest(input)
}

/** The renewal/amendment/correction/other sibling of createCommercialConfiguration: a new Commercial Change against an EXISTING configuration. */
async function createCommercialChangeForConfiguration(input: CreateCommercialChangeInput): Promise<CommercialChange> {
  const row = await configurationData.createCommercialChangeForConfiguration(input)
  return toCommercialChange(row)
}

type AddCommercialComponentServiceInput = {
  newCommercialComponentId: string
  commercialConfigurationId: string
  commercialChangeId: string
  isRecurring: boolean
  pricingRuleKind: PricingRuleKind
  pricingRuleParameters: Record<string, unknown>
  billingCadence: ComponentBillingCadence
  billingTiming: BillingTiming
  billingQuantityBasis: BillingQuantityBasis | null
  reconciliationCadence: ComponentBillingCadence
  transactionCurrency: string
  fxSnapshotRate: number | null
  effectiveFrom: string
  actorUserId: string
  measurementDefinitionId?: string | null
  supersedesComponentId?: string | null
}

/** The first and only INSERT path into commercial_components. */
async function addCommercialComponent(input: AddCommercialComponentServiceInput): Promise<CommercialComponent> {
  const row = await configurationData.addCommercialComponent(input)
  return toCommercialComponent(row)
}

/** Quantity (MUG) commitments only; see add_commercial_commitment's own migration comment. */
async function addCommercialCommitment(input: AddCommercialCommitmentInput): Promise<CommercialCommitment> {
  const row = await configurationData.addCommercialCommitment(input)
  return toCommercialCommitment(row)
}

async function getCommercialComponent(id: string): Promise<CommercialComponent | null> {
  const row = await configurationData.getCommercialComponentById(id)
  return row ? toCommercialComponent(row) : null
}

async function listCommercialChanges(commercialConfigurationId: string): Promise<CommercialChange[]> {
  const rows = await configurationData.listCommercialChangesByConfigurationId(commercialConfigurationId)
  return rows.map(toCommercialChange)
}

async function listCommercialComponents(commercialConfigurationId: string): Promise<CommercialComponent[]> {
  const rows = await configurationData.listCommercialComponentsByConfigurationId(commercialConfigurationId)
  return rows.map(toCommercialComponent)
}

/**
 * Resolves every Commitment relevant to a set of Components: kind =
 * 'quantity' commitments (direct FK) and kind = 'spend' commitments
 * (resolved through commercial_commitment_components), each mapped to
 * exactly one CommercialCommitment value with its own true, complete
 * membership. A spend commitment covering more than one requested
 * Component is returned once, not once per Component; the caller is
 * responsible for associating it with each Component it covers if
 * needed (via memberComponentIds on the returned value), never for
 * fabricating a separate commitment per Component.
 */
async function listCommitmentsForComponents(commercialComponentIds: string[]): Promise<CommercialCommitment[]> {
  if (commercialComponentIds.length === 0) return []

  const [quantityRows, candidateMemberships] = await Promise.all([
    configurationData.listCommercialCommitmentsByComponentIds(commercialComponentIds),
    configurationData.listCommitmentComponentMembershipsByComponentIds(commercialComponentIds),
  ])

  const spendCommitmentIds = [...new Set(candidateMemberships.map((membership) => membership.commitment_id))]

  const [spendRows, fullMemberships] = await Promise.all([
    configurationData.listCommercialCommitmentsByIds(spendCommitmentIds),
    configurationData.listCommitmentComponentMembershipsByCommitmentIds(spendCommitmentIds),
  ])

  const memberIdsByCommitmentId = new Map<string, string[]>()
  for (const membership of fullMemberships) {
    const existing = memberIdsByCommitmentId.get(membership.commitment_id) ?? []
    existing.push(membership.component_id)
    memberIdsByCommitmentId.set(membership.commitment_id, existing)
  }

  return [
    ...quantityRows.map((row) => toCommercialCommitment(row)),
    ...spendRows.map((row) => toCommercialCommitment(row, memberIdsByCommitmentId.get(row.id) ?? [])),
  ]
}

/** Single-Component convenience over listCommitmentsForComponents; same "no fake per-Component splitting" guarantee. */
async function listCommitmentsForComponent(commercialComponentId: string): Promise<CommercialCommitment[]> {
  return listCommitmentsForComponents([commercialComponentId])
}

async function listMeasurementDefinitions(ids: string[]): Promise<MeasurementDefinition[]> {
  const rows = await configurationData.listMeasurementDefinitionsByIds(ids)
  return rows.map(toMeasurementDefinition)
}

export {
  createCommercialConfiguration,
  listCommercialConfigurationsByCustomer,
  createSystemCommercialRequest,
  createCommercialChangeForConfiguration,
  addCommercialComponent,
  addCommercialCommitment,
  getCommercialConfiguration,
  getCommercialComponent,
  listCommercialChanges,
  listCommercialComponents,
  listCommitmentsForComponent,
  listCommitmentsForComponents,
  listMeasurementDefinitions,
}
export type { CreateCommercialConfigurationResult, AddCommercialComponentServiceInput }
