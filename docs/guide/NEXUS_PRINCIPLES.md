# The Principles Behind Nexus

Nexus is being built as a Finance operating platform. It starts small,
covering a handful of processes for a small number of users, but it is
intended to support substantially greater scale over time: more
processes, more users, more integrations, more of the company's Finance
work running through it.

Building something that starts small but is meant to last and grow means
making a set of decisions early, on purpose, so that growth later does
not require tearing up what came before. This document sets out eight
permanent principles that guide every decision made while building
Nexus. They are written in plain English for anyone with a stake in
Nexus, technical or not: Finance, Product, Operations, management,
auditors, and anyone joining the team.

These principles are permanent. Individual technology choices, screens,
and processes will change over time; these eight principles are what
stay constant while that happens.

## Principle 1: Library-first

Before building something substantial ourselves, we first check whether
a mature, reusable, or open-source technology already solves it well.

Nexus should mostly be spending its effort on the things that make Nexus
actually Nexus: our specific business logic, our Finance processes, our
controls and approvals, our canonical business data, our integrations,
our audit trail. We should not be spending that same effort rebuilding
things that are already solved, generic problems: things like rendering
forms, running workflows, evaluating decision tables, sending
notifications, handling file uploads, displaying data grids, or tracking
entitlements.

Just because a library or product exists does not mean we automatically
use it. Every candidate is still evaluated: does it actually fit what we
need, is its licensing acceptable, is it secure, will it scale, can it be
audited, can we maintain it, how much work is it to integrate, who owns
the data it touches, and does it lock us into a vendor we cannot leave.
The outcome of that evaluation might be to adopt it as-is, adopt it but
wrap it in our own layer, use only a small piece of it as a UI component,
or decide to build the piece ourselves after all. Which specific
technology we picked for which specific need is recorded separately, in
its own documentation, not repeated here.

## Principle 2: API-capable by default

Anything meaningful Nexus can do through its own screens should be
designed so that another trusted system could eventually do the same
thing through an authenticated API, without Nexus having to duplicate its
own business rules to make that possible.

For example: today, a user submits a request by filling out a screen in
Nexus. Later, an approved integration might submit that same kind of
request automatically, through an API, without a human touching a
screen. Both paths must run through the exact same underlying Nexus
rules; a screen and an API and a scheduled job and a future AI agent are
all just different ways of reaching the same Nexus capability, not
separate copies of it.

This does not mean every capability needs a public API today. It means
we do not build anything in a way that would make adding one later
require rewriting the business logic. The screen is a way of using
Nexus, not the business system itself.

## Principle 3: Nexus-owned contracts

Nexus is allowed to use external engines and libraries to do real work,
but those external technologies must never become Nexus's own identity.

For example: a forms library may be what actually renders a form on
screen. A workflow engine may be what actually moves a request from one
step to the next. A separate technical engine may be what reliably
retries a failed integration call in the background. A future
entitlement engine may be what calculates what a customer currently has
access to. But the people, APIs, and other systems that interact with
Nexus should always be interacting with Nexus's own concepts, a Form, a
Request, a Workflow, an Approval, an Entitlement, never directly with
the internal concepts of whichever third-party product happens to be
doing the work underneath. That is what makes it possible to swap one of
those technologies out later without the rest of Nexus, or anyone
depending on it, needing to change.

## Principle 4: Documentation as code

Nexus's documentation grows with the platform and lives alongside the
code, in the same version control, not off in a separate tool that can
drift out of sync.

The documentation website, if and when one exists, is not where the
truth lives; it is only a way of reading it. The actual source of truth
is machine-readable material that sits in the repository: Markdown
files, diagrams written as text, records of important decisions, API
contract files, database migrations, and the source code itself.
Documentation exists to serve two audiences at once: people, and the
future developers and AI tools that will need to understand Nexus well
enough to extend it safely. As Nexus grows, every substantial capability
should eventually leave behind a plain-English explanation of what it
is, a technical explanation of how it works, a record of why an
important architectural choice was made if one was, and API
documentation if it exposes an API. This is not retroactive: existing
work does not all need to be rewritten to this standard immediately.
Documentation is expected to catch up progressively, not all at once.

## Principle 5: Scale-ready, not scale-heavy

Think of Nexus like a building. We are constructing something like two
floors today. The foundation needs to be capable of holding one hundred
floors eventually, but that does not mean we pour a hundred floors' worth
of concrete on day one.

We deliberately do not introduce complexity Nexus does not need yet:
unnecessary microservices, message queues for workloads too small to
need them, distributed systems for problems a single well-built service
already handles fine, infrastructure with no current, real reason to
exist. What we do protect, from the start, are the things that are
genuinely expensive to retrofit later if we get them wrong early: stable
identifiers for the things Nexus tracks, clean boundaries between
different areas of the business, data integrity, configuration that can
change over time without losing its history, clear boundaries around who
is allowed to do what, services built so they can eventually be called
from more than one place, a record of meaningful things that happen,
protection against the same action accidentally happening twice, business
changes that either fully happen or don't happen at all, a trustworthy
audit trail, a clean seam around every external technology we use, and
disciplined, reviewable database changes.

Build for today's load. Architect for tomorrow's scale. If Nexus later
needs to handle millions of transactions, we should be able to add
caching, background processing, data partitioning, additional database
capacity, dedicated services, and larger-scale event handling on top of
what already exists, without redesigning the Finance concepts underneath
it from scratch.

## Principle 6: Human simplicity over system complexity

Nexus should absorb complexity so the person using it does not have to.
Every screen and every flow should be designed as carefully as if a
specialist in human psychology and enterprise user experience were
reviewing it, because at scale, that difference in design quality is the
difference between a platform people fight against every day and one
they barely notice using.

Nexus will be used by very different people: someone doing the same kind
of data entry many times a day, a Finance team processing a high volume
of activity, a Customer Success or business user who only touches Nexus
occasionally, a reviewer, a manager, senior leadership, and the
administrators who configure Nexus itself. These people do not need the
same experience. Good design here means: recognizing something rather
than having to remember it, showing only what's needed right now and
revealing more only when it's actually wanted, sensible defaults,
information that's already known being filled in automatically rather
than retyped, a clear next action, immediate feedback when something is
wrong, catching mistakes before they happen rather than only after, being
able to see progress, clear ownership of what happens next, and letting
someone who handles high volume work efficiently rather than clicking
through the same motions repeatedly.

Simple does not mean hiding useful information. Simple means minimizing
how much mental effort it takes to do the job correctly. One permanent
requirement follows directly from this: every material Finance request
in Nexus should make it obvious where it is, what happens next, who
currently needs to act, and whether the person looking at it needs to do
anything themselves.

## Principle 7: CFO-control mindset

Nexus exists primarily because of a Finance-led need for process
discipline. For every process that matters, we think the way a CFO
responsible for financial control and audit would think about it.

That means asking, for anything material: who owns this, who checked it,
who approved it, what evidence backs it up, what policy applied, was
there an exception, who approved that exception and why, what changed,
when did it take effect, what is the financial impact, can this be
reconciled later, and could an auditor understand exactly what happened
without having to ask someone to remember it. Controls should match the
actual risk involved; Nexus should not create bureaucracy just because it
technically can. The preference is always structured facts, evidence,
controls, approvals, documented reasons, effective dates, and a full
history of prior versions, rather than a record that just says a status
changed with no explanation of why.

## Principle 8: CEO-glance mindset

A CEO should never need to understand every field in every workflow to
understand what matters. Nexus should be structured so that leadership
can quickly see what changed, what is material, what is unusual, what is
stuck, what carries risk, what needs their attention, what keeps getting
approved on an exception basis, where exceptions are increasing, and what
the impact is on revenue or customers.

Every process in Nexus that matters should produce enough structured
information that its significance can eventually be summarized without
someone having to reopen and re-read the entire transaction. Over time,
that could mean visibility into things like large commercial changes,
revenue added or at risk, customers approaching suspension, unusual
approval patterns, repeated overrides, ageing backlogs, how long
approvals are taking, and where exceptions are concentrated. We are not
building a CEO dashboard today; this is a principle about how Nexus
structures its data so that a dashboard, or any other summary, is
possible later without redesigning anything.

## The Nexus Design Review

Before building anything substantial in Nexus, we think it through
against these eight questions. This is a thinking framework, not a form
to fill in or a sign-off to collect.

1. **Library:** Does mature technology already solve the generic part
   of this well?
2. **API:** Could this eventually be safely used without going through
   the Nexus screen?
3. **Contract:** Are people interacting with a Nexus concept, not a
   vendor's or engine's internal concept?
4. **Scale:** Does today's simple version leave a credible path to
   much larger scale later?
5. **Human:** Is this the simplest possible experience for each type
   of person who will use it?
6. **CFO:** Are ownership, control, evidence, audit, and financial
   consequence all accounted for?
7. **CEO:** Could a material risk, change, or exception eventually be
   understood quickly, without digging?
8. **Documentation:** Will another person, or an AI working on this
   repository later, understand what this is, why it exists, and how it
   works, just from what's in the repository?

## Where to go next

This document explains the *why* in plain language. The technical
translation of these same eight principles, for engineers, architects,
and coding agents, is in
`docs/engineering/NEXUS_ENGINEERING_PRINCIPLES.md`. How Nexus organizes
all of its documentation, today and as it grows, is in
`docs/DOCUMENTATION_STRATEGY.md`.
