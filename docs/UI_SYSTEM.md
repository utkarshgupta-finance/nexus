# Nexus — UI System

This document defines Nexus's visual and interaction language. It is a
public, generic design-system reference — it contains no business logic,
no workflow specifics, and no confidential detail. Anything about *what*
Nexus does lives outside this repository; this file is only about *how it
looks and behaves*.

All frontend work must comply with this document. If a screen seems to need
something not covered here, extend this document deliberately rather than
inventing a one-off pattern.

## 1. Product feel

Nexus should feel like a **quiet, precise, premium operating instrument** —
built for a professional who opens it dozens of times a day and needs to
make accurate decisions quickly, without mental fatigue.

Target: exceptionally polished, classy, minimal, restrained, trustworthy,
calm, precise, information-dense, easy to scan, predictable, fast,
professional, sophisticated without being decorative.

Explicitly avoid: a generic AI-generated dashboard, an admin template, an
old-style ERP, a marketing site, a flashy startup demo, a banking-app
pastiche, or a "design system showcase."

**High information density with low cognitive load** is the standing goal —
minimalism means restraint and clarity, not emptiness.

## 2. Human-psychology principles behind every decision

- **Reduce cognitive load.** Once a pattern (a status, a table, a filter, an
  approval control) is established, reuse it everywhere. Never make a user
  re-learn the same concept in a different shape.
- **Recognition over recall.** Show what a colour, icon, or state means in
  context. Never require the user to remember it from elsewhere.
- **Protect attention.** Hierarchy should answer, in order: *Where am I? What
  am I looking at? What is its state? Is something wrong? Does it need my
  action? What should I do next?* Achieve this with placement, alignment,
  typography, proximity, and whitespace — before reaching for colour or size.
- **Progressive disclosure.** Show what's important now; make deeper detail
  easy to reach (tabs, drawers, expandable sections) without hiding anything
  the user needs to decide correctly right now.
- **Error prevention over error messaging.** Prefer constraints, sensible
  defaults, disabled-when-impossible actions, inline validation, and
  confirmation for high-impact actions over letting mistakes happen and
  reporting them afterward.
- **Decision confidence.** Consequential actions should make the user certain
  what they're doing, what supports it, and what happens next. Prefer
  specific action labels ("Submit for Review") over ambiguous ones
  ("Continue").
- **Familiarity over novelty.** Repeated-use software rewards consistency.
  Don't invent a new interaction pattern when an existing one already fits.

## 3. Colour philosophy

Nexus is **primarily monochrome**. Colour exists to communicate meaning, not
to look interesting.

- Graphite / near-black — primary text and primary actions.
- Neutral grayscale — structure, secondary surfaces, borders.
- Semantic **green** — positive / successful / approved.
- Semantic **amber** — attention / pending-risk / warning.
- Semantic **red** — blocked / error / high-risk.
- Muted **blue** — links or genuinely informational states.

No decorative brand accent color. Status is never communicated by colouring
an entire card or row — use small, controlled indicators, and always pair
colour with text and, where helpful, an icon or shape. **Status must never
depend on colour alone.**

Define all colour usage as semantic design tokens (e.g. `--color-success`,
`--color-warning`, `--color-danger`, `--color-info`, `--surface`,
`--surface-muted`, `--border`, `--text-primary`, `--text-secondary`) rather
than hardcoded values, so a dark theme can be introduced later without
restructuring components.

## 4. Light mode first

Nexus is designed and validated in **light mode first**:

- Near-white neutral canvas (avoid pure white where it creates glare).
- Very subtle neutral secondary surfaces — small shifts in neutral value
  create hierarchy, not boxes/cards.
- Dark graphite primary text, restrained secondary text.
- Thin, low-contrast separators. Almost no shadows.
- Strong typography, controlled density.

Dark mode is deferred — no implementation effort goes toward it yet — but
because colours are semantic tokens from day one, adding a dark theme later
should not require restructuring the component system.

## 5. Foundation

- **shadcn/ui**, style baseline **Mira** (compact, crisp, denser than
  default — chosen over softer/rounder styles because Nexus needs to read
  as data-dense and precise, not consumer-friendly).
- **Base UI** as the underlying primitive layer. Do not migrate to Radix or
  React Aria unless explicitly instructed later.
- **Tailwind CSS** for styling, **Lucide** for icons.
- Do not add a second complete component library. `21st.dev` may later be
  used as a pattern/implementation *reference* — if something useful is
  found there, inspect it, adapt it to Nexus's tokens, ensure accessibility,
  and own the resulting code rather than installing it as a dependency.
  `Untitled UI` is reference-only, never installed. Avoid animation/effects
  libraries unless a specific functional interaction genuinely needs one.

## 6. Spacing and density

Tight, predictable spacing. Whitespace clarifies relationships between
elements — it is not used to make the product look expensive.

Prefer: compact rows, aligned grids, consistent gutters, predictable
vertical rhythm, substantial information visible without excessive
scrolling.

Avoid: oversized padding, large gaps between sections, hero-sized page
headers, big cards holding a small amount of content.

Density should never become cramped — text stays comfortably readable and
interactive targets stay accessible.

## 7. Typography

One primary typeface. No decorative display font. Hierarchy comes mostly
from typography, not colour or size alone.

Restrained scale, roughly:

```
Page title → Section heading → Primary value → Body → Metadata → Caption
```

Use weight deliberately — if everything is semibold, nothing reads as
important.

Tabular numerals for financial figures, counts, and any column where
alignment matters. Monetary/numeric columns are right-aligned; text columns
are left-aligned. Avoid unnecessary centre alignment.

## 8. Surfaces

Avoid excessive "cardification." The primary surface should feel
continuous — build hierarchy with dividers, spacing, subtle background
shifts, and typography before reaching for a boxed container.

Never nest a card inside a card. Use a contained surface only when the
content genuinely behaves as one unit. Shadows are reserved for true
overlays — menus, dropdowns, modals, popovers — never used to make a static
component "float."

## 9. Tables

Tables are a **first-class** Nexus interface, not a fallback — they are the
primary surface for repeated daily work.

Where appropriate, support: search, filters, sorting, column visibility,
row selection, clear status, quick actions, drill-down, and (later)
persistent/saved views.

Primary cell content is visually stronger than secondary metadata beneath
it (muted, smaller). Numbers: right-aligned, tabular numerals, consistent
decimal/currency formatting. Text: left-aligned. Don't turn tabular,
comparative data into card grids — reserve card/grid layouts for content
that's genuinely visual rather than comparative.

## 10. Forms

Forms minimize mental effort: clear logical sections, label above field,
contextual help only when genuinely necessary, validation near the
relevant field, sensible defaults, a visible required-field convention, and
consistent input widths.

Use multi-column layouts only where fields form a natural semantic pair —
never purely to shorten a page. Multi-step or long-running workflows must
always show current state, completion, what's missing, ownership, and next
action — the user should never have to reconstruct workflow state from the
form fields themselves.

## 11. Buttons and actions

One clear primary action per screen; secondary and tertiary/overflow actions
are visually subordinate. Avoid multiple equally prominent primary buttons
side by side.

Use action-specific labels — "Submit for Review" rather than "Submit,"
"Approve Commercial Terms" rather than "Approve" where ambiguity is
otherwise possible. Destructive/high-impact actions should look intentional
without being visually theatrical (no oversized warning styling for
routine actions).

## 12. Status design

Status is compact, immediately readable, and rendered identically wherever
it appears. Use a restrained badge/dot treatment — never large, colourful
pills, and never a colour-only signal (always pair with text, and an icon
where it genuinely helps). A user should be able to scan a table and
distinguish normal / attention / blocked / complete without the page
becoming visually noisy.

## 13. Record / detail page architecture

Record-centric screens follow an Attio-like model:

- **Header** — identity, current state, primary action(s).
- **Properties** — structured key/value information.
- **Body** — relevant domain sections, grouped logically without wrapping
  every attribute in its own card.
- **Tabs** where useful — e.g. Overview, Activity, History, related items.
- **Secondary context** — drawer/side panel where appropriate, rather than
  a full navigation away from the record.

The record should read as one coherent object, not a stack of independent
widgets.

## 14. Activity, history, and audit

History is a first-class concept. Use a chronological activity-timeline
pattern that makes clear, per entry: what happened, who did it, when, and
what changed — with detailed before/after values available via progressive
disclosure rather than a giant raw log on the primary screen.

## 15. Interaction states and motion

Every interactive component needs default, hover, focus, active, selected,
and disabled states, as relevant — quiet but clearly perceivable. No
bouncing, scaling, unnecessary translation, glow, or dramatic transitions;
the user should feel *response*, not *animation*.

Motion is functional only — disclosure, open/close, state transition,
preserving spatial continuity — generally under ~150ms. No decorative or
background motion, and none purely for delight.

## 16. Empty and loading states

Empty states are small and useful: a short explanation plus one obvious
next action. No illustrations, no mascots, no inspirational copy.

Loading states use skeletons that resemble the final layout rather than a
generic spinner, and must not cause a dramatic layout shift once content
arrives — preserve spatial stability.

## 17. Responsive behaviour

Desktop is the primary working environment and is optimized first. Layouts
degrade gracefully: drawers can replace side panels, tables can use
controlled horizontal scroll, and important actions must always remain
reachable. Data density on desktop is never sacrificed to force a
mobile-first layout.

## 18. Accessibility

Accessibility is part of quality, not an afterthought: sufficient contrast,
full keyboard navigation, a clear focus state, correct semantic markup,
usable target sizes, labels on icon-only controls, status that never
relies on colour alone, and disabled controls whose state is obvious.

## 19. Shared product components (purpose and behaviour only)

These are shared UI building blocks used across features. Their purpose and
behavioural contract are defined here so they are built consistently
whenever a feature needs them — they are **not implemented as part of this
step**.

| Component | Purpose |
|---|---|
| `PageHeader` | Compact (not hero-sized) — communicates location, identity, important context, and the primary action for the page. |
| `DataTable` | The primary high-density record-browsing surface, optimized for scanning and comparison. |
| `FilterBar` | Visually integrated with the data it controls — never a separate decorative card. |
| `StatusBadge` | Small, semantic, and rendered identically everywhere — never colour-only. |
| `DetailSection` | Groups logically related record information without wrapping it in an unnecessary card. |
| `KeyValueGrid` | Compact structured metadata display with strong label/value alignment. |
| `ActivityTimeline` | Chronological, human-readable record history. |
| `WorkflowTimeline` | Communicates progression and current position — answers "where am I, what happened, what's next" without explanation. |
| `AuditDrawer` | Secondary, deep inspection of change history — kept out of the primary screen. |
| `ExceptionBanner` | High-salience but restrained; used only when the user genuinely needs to notice or act, so it never becomes ambient noise the user learns to ignore. |
| `EmptyState` | Minimal contextual guidance plus one action, where relevant. |

## 20. Anti-patterns

Nexus must never drift toward: giant KPI cards by default, four-card
dashboard templates, arbitrary coloured icons, huge headings, gradients,
glassmorphism, neon accents, unnecessary shadows, excessive rounded
corners, nested cards, gratuitous charts, decorative imagery, animated
backgrounds, cute empty-state illustrations, excessive badges, unexplained
icon-only actions, low-density pages padded with whitespace, inconsistent
component variants, a different interaction pattern per feature, modal
dialogs where an inline interaction would be clearer, important actions
hidden in overflow menus, treating every screen as a dashboard, or adding
visual complexity in the name of feeling "premium."

**Premium means precision, consistency, clarity, restraint, responsiveness,
and quality of detail — not decoration.**
