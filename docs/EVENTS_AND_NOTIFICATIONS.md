# Nexus: Events and Notifications

This document defines the event-driven model Nexus uses for notifications.
It contains no real Nexus workflow names, thresholds, or notification
content. All examples below are generic and illustrative.

**Status: locked design.** See `docs/PLATFORM_ARCHITECTURE.md` §7 for how
domain events differ from the database-enforced audit log, and §6 for how
events relate to tasks and workflow. Nothing in this document has been
implemented. No event table, rule table, or delivery channel exists
because of this document.

## 1. Principle

Features emit domain events; they never directly send a notification. A
domain event is a record of business meaning ("a record was submitted for
review"), distinct from the database's row-level audit trail, which
records mutation regardless of meaning
(`docs/DATA_ARCHITECTURE.md` §9). This separation is what lets Nexus add
delivery channels, recipients, and rules later without touching feature
code, and lets one event support more than one notification rule, or
none, without the feature that raised it knowing or caring.

## 2. Pipeline

```
domain event -> notification rule -> recipient resolution -> delivery
```

- **Domain event**: emitted by an application service as part of handling
  a use case, recorded in `domain_events`
  (`docs/DATA_ARCHITECTURE.md` §11), linked to a resource. Conceptual
  examples: record submitted, approval requested, item sent back, deadline
  approaching, threshold crossed, document expiring, exception triggered.
  None of these are real Nexus events.
- **Notification rule**: configuration (`platform/policy/`) stating "when
  an event of this type occurs, matching this condition, produce a
  notification of this kind." A rule's outcome can also be a task
  (`docs/PLATFORM_ARCHITECTURE.md` §6), through the same rule pipeline,
  rather than a second, parallel rule engine.
- **Recipient resolution**: turns a rule match into concrete recipients,
  computed from data the platform already has: a task's current assignee,
  a role within a scope (`docs/AUTHORIZATION_MODEL.md`), or an explicitly
  named user for a specific rule.
- **Delivery**: sends the resolved notification through a channel. No
  channel is built at this design step; delivery is the last, swappable
  step, never called directly by a feature.

## 3. Event log

Every domain event is recorded regardless of whether any notification rule
currently matches it. This keeps the event log a useful factual history
independent of today's notification configuration, so a rule added later
can, if genuinely needed, be evaluated against events already recorded.

## 4. Delivery, later

No delivery channel is built now. The model is designed so adding one is
additive: in-app first (the only channel required for an initial
workflow), then email, then future chat platforms. A single notification
can fan out to more than one channel per recipient once preferences exist
(`docs/PLATFORM_ARCHITECTURE.md` §5); preferences are configuration, never
a code branch per channel per feature.

## 5. Capabilities the model must not block later

None of the following are implemented now; the shapes above are chosen so
each is additive rather than a redesign (see also
`docs/PLATFORM_ARCHITECTURE.md` §12):

- **Reminders**: a scheduled re-check of an open task or approaching
  deadline, itself a domain event emitted by a scheduled job, not a
  special case outside the pipeline.
- **Digests**: batching resolved notifications on a schedule, a delivery
  concern, not a change to events or rules.
- **Escalation**: a rule whose condition is "task still open past its due
  date," resolving to a different recipient than the original. An
  ordinary rule and an ordinary resolution, not a separate mechanism.
- **Deduplication**: a delivery-layer responsibility (not re-notifying the
  same recipient for the same event/rule pair within a window), not a
  constraint on event emission.
- **Severity**: an attribute a rule produces, used for channel choice or
  visual treatment, not a separate system.
- **Acknowledgement**: tracked on the resolved, delivered notification, so
  an escalation rule can eventually ask whether it was seen.

## 6. Notification fatigue as a design constraint

A notification exists because it relates to an expected user action or a
genuinely important awareness, never merely because an event exists and it
was easy to notify on. Most domain events will not have a matching rule.
Digesting, deduplication, and severity (§5) exist specifically so routine,
non-urgent events never compete for attention with the few that need it.
This mirrors `docs/UI_SYSTEM.md`'s `ExceptionBanner` principle: high
salience without becoming ambient noise the user learns to ignore.

## 7. What this document does not cover

No real Nexus event type, notification rule, or recipient is named here.
No event table, rule table, or delivery channel is implemented. Those are
built when the first feature that needs notifications is implemented,
following this model, against that feature's approved product
requirements.
