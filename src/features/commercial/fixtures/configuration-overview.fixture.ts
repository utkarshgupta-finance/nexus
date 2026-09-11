import type { CommercialConfigurationOverview } from "@/features/commercial"

/**
 * Fixture data for the first Commercial UI screen, shaped exactly like
 * the production Configuration Overview read model
 * (read-models/configuration-overview.ts#getCommercialConfigurationOverview).
 * Live per-user authorization does not exist in Nexus yet, so this
 * screen is deliberately not wired to features/commercial/server.ts;
 * this fixture is the only data source until that boundary exists.
 *
 * Entirely fictional: no real Bizom customer, no real commercial terms.
 * Chosen to exercise every UI state the design brief called for: several
 * pricing models, monthly and quarterly cadence, advance and arrears
 * timing, a quantity Commitment, a spend Commitment shared by two
 * Components, a supersession pair, and multiple Commercial Changes.
 */

const FIXTURE_COMMERCIAL_CONFIGURATION_OVERVIEW: CommercialConfigurationOverview = {
  configuration: {
    id: "cfg-fixture-001",
    key: "northwind-2026",
    name: "Northwind Fictional Retail Group",
    isActive: true,
    relationshipNote: "Reviewed annually alongside the renewal cycle.",
    customerId: "cust-fixture-001",
  },
  components: [
    {
      id: "comp-platform-v1",
      label: "Platform Access",
      pricingRuleKindLabel: "Flat fee",
      measurementLabel: null,
      billingCadenceLabel: "Monthly",
      billingTimingLabel: "Billed in arrears",
      billingQuantityBasisLabel: "Not applicable (arrears)",
      reconciliationCadenceLabel: "Monthly",
      transactionCurrency: "USD",
      effectiveFrom: "2025-01-01",
      effectiveTo: "2025-12-31",
      supersedesComponentId: null,
      commitments: [],
    },
    {
      id: "comp-platform-v2",
      label: "Platform Access",
      pricingRuleKindLabel: "Flat fee",
      measurementLabel: null,
      billingCadenceLabel: "Monthly",
      billingTimingLabel: "Billed in arrears",
      billingQuantityBasisLabel: "Not applicable (arrears)",
      reconciliationCadenceLabel: "Monthly",
      transactionCurrency: "USD",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      supersedesComponentId: "comp-platform-v1",
      commitments: [],
    },
    {
      id: "comp-api",
      label: "API Calls (Linear)",
      pricingRuleKindLabel: "Linear",
      measurementLabel: "API Calls",
      billingCadenceLabel: "Monthly",
      billingTimingLabel: "Billed in arrears",
      billingQuantityBasisLabel: "Not applicable (arrears)",
      reconciliationCadenceLabel: "Monthly",
      transactionCurrency: "USD",
      effectiveFrom: "2025-01-01",
      effectiveTo: null,
      supersedesComponentId: null,
      commitments: [
        {
          kind: "quantity",
          id: "commit-api-quantity",
          commercialComponentId: "comp-api",
          thresholdValue: 10000,
          currency: null,
          period: "monthly",
          periodLabel: "Monthly",
          effectiveFrom: "2025-01-01",
          effectiveTo: null,
        },
      ],
    },
    {
      id: "comp-storage",
      label: "Data Storage (GB)",
      pricingRuleKindLabel: "Volume-based",
      measurementLabel: "Storage (GB)",
      billingCadenceLabel: "Quarterly",
      billingTimingLabel: "Billed in advance",
      billingQuantityBasisLabel: "Previous period actual",
      reconciliationCadenceLabel: "Quarterly",
      transactionCurrency: "USD",
      effectiveFrom: "2025-04-01",
      effectiveTo: null,
      supersedesComponentId: null,
      commitments: [],
    },
    {
      id: "comp-support",
      label: "Premium Support",
      pricingRuleKindLabel: "Graduated / tiered",
      measurementLabel: null,
      billingCadenceLabel: "Quarterly",
      billingTimingLabel: "Billed in advance",
      billingQuantityBasisLabel: "Fixed amount",
      reconciliationCadenceLabel: "Quarterly",
      transactionCurrency: "USD",
      effectiveFrom: "2025-07-01",
      effectiveTo: null,
      supersedesComponentId: null,
      commitments: [
        {
          kind: "spend",
          id: "commit-support-onboarding-spend",
          memberComponentIds: ["comp-support", "comp-onboarding"],
          thresholdValue: 5000,
          currency: "USD",
          period: "quarterly",
          periodLabel: "Quarterly",
          effectiveFrom: "2025-07-01",
          effectiveTo: null,
        },
      ],
    },
    {
      id: "comp-onboarding",
      label: "Onboarding Services",
      pricingRuleKindLabel: "Flat fee",
      measurementLabel: null,
      billingCadenceLabel: "Monthly",
      billingTimingLabel: "Billed in arrears",
      billingQuantityBasisLabel: "Not applicable (arrears)",
      reconciliationCadenceLabel: "Monthly",
      transactionCurrency: "USD",
      effectiveFrom: "2025-07-01",
      effectiveTo: null,
      supersedesComponentId: null,
      commitments: [
        {
          kind: "spend",
          id: "commit-support-onboarding-spend",
          memberComponentIds: ["comp-support", "comp-onboarding"],
          thresholdValue: 5000,
          currency: "USD",
          period: "quarterly",
          periodLabel: "Quarterly",
          effectiveFrom: "2025-07-01",
          effectiveTo: null,
        },
      ],
    },
  ],
  commitments: [
    {
      kind: "quantity",
      id: "commit-api-quantity",
      commercialComponentId: "comp-api",
      thresholdValue: 10000,
      currency: null,
      period: "monthly",
      periodLabel: "Monthly",
      effectiveFrom: "2025-01-01",
      effectiveTo: null,
    },
    {
      kind: "spend",
      id: "commit-support-onboarding-spend",
      memberComponentIds: ["comp-support", "comp-onboarding"],
      thresholdValue: 5000,
      currency: "USD",
      period: "quarterly",
      periodLabel: "Quarterly",
      effectiveFrom: "2025-07-01",
      effectiveTo: null,
    },
  ],
  changes: [
    {
      id: "chg-001",
      category: "initial_setup",
      effectiveDate: "2025-01-01",
      reason: null,
    },
    {
      id: "chg-002",
      category: "amendment",
      effectiveDate: "2025-07-01",
      reason: "Added Premium Support and Onboarding Services with a shared spend commitment.",
    },
    {
      id: "chg-003",
      category: "renewal",
      effectiveDate: "2026-01-01",
      reason: "Annual renewal; Platform Access terms refreshed for the new period.",
    },
  ],
}

export { FIXTURE_COMMERCIAL_CONFIGURATION_OVERVIEW }
