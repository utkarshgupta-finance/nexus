import type { SurveyFormDefinition } from "@/platform/forms/types"

/**
 * Fictional, illustrative-only Finance form used to stress-test the SurveyJS
 * runtime: field-type variety, conditional visibility/requiredness/enablement,
 * cross-field validation, one calculated field, a repeating section, and a
 * branching page journey driven by request type. No real Nexus product rule,
 * threshold, or field list is represented here.
 *
 * Page-level `visibleIf` (native SurveyJS) is what makes the journey branch:
 * "risk_exception" only exists for Exception requests, "adjustment_details"
 * only exists for Adjustment requests, and Standard requests see neither.
 * `navigationTitle` gives each page a short label for the progress bar,
 * separate from its full in-page `title`.
 */
const FINANCE_EXCEPTION_REQUEST_FORM: SurveyFormDefinition = {
  formDefinitionVersion: "demo-v2",
  json: {
    title: "Fictional Finance Exception Request (Illustrative Only)",
    description:
      "All fields, choices, and thresholds on this form are fictional and for demonstration purposes only.",
    showProgressBar: "aboveheader",
    progressBarType: "pages",
    showQuestionNumbers: "off",
    widthMode: "responsive",
    showCompletedPage: false,
    pages: [
      {
        name: "request",
        title: "Request",
        navigationTitle: "Request",
        elements: [
          {
            type: "dropdown",
            name: "request_type",
            title: "Request type",
            isRequired: true,
            description: "Drives which pages appear later in this form.",
            choices: [
              { value: "standard", text: "Standard" },
              { value: "exception", text: "Exception" },
              { value: "adjustment", text: "Adjustment" },
            ],
          },
          {
            type: "text",
            name: "exception_reason",
            title: "Reason for exception",
            visibleIf: "{request_type} = 'exception'",
            isRequired: true,
            description: "Field-level condition: shown only when request type is Exception.",
          },
          {
            type: "text",
            name: "request_date",
            title: "Request date",
            inputType: "date",
            isRequired: true,
          },
          {
            type: "text",
            name: "requested_by",
            title: "Requested by",
            isRequired: true,
            placeholder: "e.g. J. Alvarez",
          },
          {
            type: "dropdown",
            name: "department",
            title: "Department",
            isRequired: true,
            choices: ["Sales Finance", "Treasury", "Procurement", "Credit Control", "FP&A"],
          },
          {
            type: "radiogroup",
            name: "priority",
            title: "Priority",
            isRequired: true,
            colCount: 3,
            choices: [
              { value: "low", text: "Low" },
              { value: "medium", text: "Medium" },
              { value: "high", text: "High" },
            ],
          },
          {
            type: "text",
            name: "entity_name",
            title: "Entity name",
            isRequired: true,
            placeholder: "e.g. Northwind Distribution Ltd",
          },
          {
            type: "dropdown",
            name: "entity_type",
            title: "Entity type",
            isRequired: true,
            choices: ["Customer", "Vendor", "Internal"],
          },
          {
            type: "text",
            name: "entity_id",
            title: "Entity reference code",
            placeholder: "e.g. ENT-10234",
          },
          {
            type: "dropdown",
            name: "region",
            title: "Region",
            choices: ["North America", "EMEA", "APAC", "LATAM"],
          },
          {
            type: "tagbox",
            name: "stakeholder_teams",
            title: "Stakeholder teams to notify",
            description: "Multi-select.",
            choices: ["Sales", "Legal", "Credit Control", "Tax", "Operations", "Executive Sponsor"],
          },
        ],
      },
      {
        name: "financials",
        title: "Financials",
        navigationTitle: "Financials",
        elements: [
          {
            type: "dropdown",
            name: "currency",
            title: "Currency",
            isRequired: true,
            choices: ["USD", "EUR", "GBP", "INR", "SGD"],
          },
          {
            type: "text",
            name: "amount",
            title: "Amount",
            inputType: "number",
            isRequired: true,
            validators: [
              {
                type: "numeric",
                minValue: 0.01,
                maxValue: 100000000,
                text: "Enter an amount between 0.01 and 100,000,000.",
              },
            ],
          },
          {
            type: "text",
            name: "tax_percentage",
            title: "Tax rate (%)",
            inputType: "number",
            defaultValue: 0,
            validators: [
              {
                type: "numeric",
                minValue: 0,
                maxValue: 100,
                text: "Enter a percentage between 0 and 100.",
              },
            ],
          },
          {
            type: "expression",
            name: "amount_including_tax",
            title: "Amount including tax (calculated)",
            expression: "{amount} * (1 + {tax_percentage} / 100)",
            displayStyle: "decimal",
            maximumFractionDigits: 2,
          },
          {
            type: "text",
            name: "cost_center",
            title: "Cost center",
            placeholder: "e.g. CC-4410",
          },
          {
            type: "text",
            name: "gl_account",
            title: "GL account",
            placeholder: "e.g. 6000-100",
          },
          {
            type: "text",
            name: "contract_reference",
            title: "Contract reference",
            placeholder: "e.g. CTR-2026-0091",
          },
          {
            type: "text",
            name: "payment_terms_days",
            title: "Payment terms (days)",
            inputType: "number",
            validators: [
              {
                type: "numeric",
                minValue: 0,
                maxValue: 180,
                text: "Enter a number of days between 0 and 180.",
              },
            ],
          },
          {
            type: "text",
            name: "start_date",
            title: "Start date",
            inputType: "date",
          },
          {
            type: "text",
            name: "end_date",
            title: "End date",
            inputType: "date",
            validators: [
              {
                type: "expression",
                expression: "{end_date} >= {start_date}",
                text: "End date cannot be before start date.",
              },
            ],
          },
          {
            type: "boolean",
            name: "renewal_flag",
            title: "Is this a renewal?",
            defaultValue: false,
          },
        ],
      },
      {
        name: "risk_exception",
        title: "Risk / Exception",
        navigationTitle: "Risk",
        description: "Page-level condition: this whole page exists only for Exception requests.",
        visibleIf: "{request_type} = 'exception'",
        elements: [
          {
            type: "text",
            name: "ageing_days",
            title: "Ageing (days)",
            inputType: "number",
            validators: [
              {
                type: "numeric",
                minValue: 0,
                maxValue: 3650,
                text: "Enter a number of days between 0 and 3650.",
              },
            ],
          },
          {
            type: "dropdown",
            name: "risk_rating",
            title: "Risk rating",
            choices: ["Low", "Medium", "High"],
          },
          {
            type: "panel",
            name: "elevated_review_panel",
            title: "Additional review information required",
            description:
              "Multi-field condition: appears only when amount exceeds a fictional threshold and ageing exceeds 90 days.",
            visibleIf: "{amount} > 500000 and {ageing_days} > 90",
            elements: [
              {
                type: "comment",
                name: "additional_review_notes",
                title: "Additional review notes",
                isRequired: true,
                rows: 3,
              },
            ],
          },
        ],
      },
      {
        name: "adjustment_details",
        title: "Adjustment Details",
        navigationTitle: "Adjustment",
        description: "Page-level condition: this whole page exists only for Adjustment requests.",
        visibleIf: "{request_type} = 'adjustment'",
        elements: [
          {
            type: "text",
            name: "original_transaction_reference",
            title: "Original transaction reference",
            isRequired: true,
            placeholder: "e.g. TXN-88213",
          },
          {
            type: "comment",
            name: "adjustment_reason",
            title: "Reason for adjustment",
            isRequired: true,
            rows: 3,
          },
        ],
      },
      {
        name: "supporting_information",
        title: "Supporting Information",
        navigationTitle: "Evidence",
        elements: [
          {
            type: "comment",
            name: "supporting_reason",
            title: "Supporting reason",
            requiredIf: "{amount} > 500000",
            description: "Becomes required when amount exceeds a fictional threshold.",
            rows: 3,
          },
          {
            type: "boolean",
            name: "supporting_documents_provided",
            title: "Supporting documents provided?",
            defaultValue: false,
          },
          {
            type: "text",
            name: "attachments_reference",
            title: "Attachments reference",
            enableIf: "{supporting_documents_provided} = true",
            description: "Editable only once supporting documents are marked as provided.",
            placeholder: "e.g. DOC-55210",
          },
          {
            type: "checkbox",
            name: "impacted_modules",
            title: "Impacted modules",
            choices: ["Billing", "Collections", "Reporting", "Reconciliation"],
          },
          {
            type: "paneldynamic",
            name: "supporting_items",
            title: "Supporting items",
            description: "Repeatable line items. Add or remove as many as apply.",
            templateTitle: "Item {panelIndex}",
            addPanelText: "+ Add another item",
            removePanelText: "Remove item",
            panelCount: 1,
            minPanelCount: 0,
            maxPanelCount: 8,
            templateElements: [
              {
                type: "text",
                name: "reference",
                title: "Reference",
                isRequired: true,
                placeholder: "e.g. ITM-001",
              },
              {
                type: "text",
                name: "date",
                title: "Date",
                inputType: "date",
              },
              {
                type: "text",
                name: "amount",
                title: "Amount",
                inputType: "number",
              },
              {
                type: "comment",
                name: "description",
                title: "Description",
                rows: 2,
              },
            ],
          },
          {
            type: "comment",
            name: "additional_notes",
            title: "Additional notes",
            rows: 2,
          },
        ],
      },
      {
        name: "review",
        title: "Review",
        navigationTitle: "Review",
        elements: [
          {
            type: "text",
            name: "reviewer_name",
            title: "Reviewer name",
          },
          {
            type: "comment",
            name: "reviewer_comments",
            title: "Reviewer comments",
            rows: 3,
          },
          {
            type: "dropdown",
            name: "final_decision",
            title: "Decision",
            choices: ["Pending", "Approved", "Rejected"],
          },
          {
            type: "boolean",
            name: "acknowledgement",
            title: "I confirm the information above is accurate to the best of my knowledge.",
            isRequired: true,
          },
        ],
      },
    ],
  },
}

export { FINANCE_EXCEPTION_REQUEST_FORM }
