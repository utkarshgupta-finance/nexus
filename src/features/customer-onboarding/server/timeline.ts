import "server-only"

import { resolveActorLabels } from "@/platform/audit/server"
import { getOnboardingCase, listOnboardingSendBacks, listOnboardingRevisionSummaries } from "../services/case.service"
import { buildOnboardingTimeline, collectOnboardingTimelineActorIds } from "../domain/timeline"
import type { OnboardingTimelineEvent } from "../domain/timeline"

/**
 * One onboarding request's own Timeline (task spec): gathers the case,
 * every revision's submit/resubmit facts, and the full send-back history,
 * resolves every actor id to an email in one batched lookup, and hands off
 * to the pure builder. Mirrors ../../customers/server/activity.ts's own
 * shape exactly.
 */
async function loadOnboardingRequestTimeline(requestId: string): Promise<OnboardingTimelineEvent[]> {
  const onboardingCase = await getOnboardingCase(requestId)
  if (!onboardingCase) return []

  const [revisions, sendBacks] = await Promise.all([listOnboardingRevisionSummaries(requestId), listOnboardingSendBacks(requestId)])

  const input = {
    createdAt: onboardingCase.createdAt,
    createdBy: onboardingCase.createdBy,
    approvedAt: onboardingCase.approvedAt,
    approvedBy: onboardingCase.approvedBy,
    revisions,
    sendBacks,
  }

  const actorLabels = await resolveActorLabels(collectOnboardingTimelineActorIds(input))
  return buildOnboardingTimeline({ ...input, actorLabels })
}

/** Requester-facing Send Back count (task spec): the number of times this request has ever been sent back, derived from history, never a manually incremented counter. */
async function getOnboardingSendBackCount(requestId: string): Promise<number> {
  return (await listOnboardingSendBacks(requestId)).length
}

export { loadOnboardingRequestTimeline, getOnboardingSendBackCount }
