/**
 * The locked completion rule for Customer Onboarding (task spec §25):
 * Draft and Submit never require the Agreement & Approval stage's
 * evidence, but a case cannot reach final Complete until a Signed
 * Agreement has been attached AND Legal Approval has happened. This is
 * a pure, testable predicate; nothing here performs the transition
 * itself (see ./case.ts's `approveCase` for that), and nothing here
 * fabricates a Legal Approval action, since no authenticated approval
 * identity exists yet (see ../ui/customer-onboarding-page.tsx's header).
 */
function isEligibleForCompletion(input: { hasSignedAgreement: boolean; legalApprovalComplete: boolean }): boolean {
  return input.hasSignedAgreement && input.legalApprovalComplete
}

export { isEligibleForCompletion }
