# Nexus Journey Change Index

Lightweight, append-only index of journey evolution since Baseline V1.
Companion to `docs/NEXUS_CHANGE_GOVERNANCE.md` section 3 (journey
lifecycle states) and `docs/NEXUS_JOURNEY_UNIVERSE.md` (canonical current
journey definitions, which this index never rewrites).

**Default rule: a journey not listed below is ACTIVE, unchanged since
Baseline V1.** This index does not restate all 796 journeys; it only
grows an entry the moment a Change Set actually moves a journey off
ACTIVE. A 796-row table that says "ACTIVE, Baseline V1, N/A" 796 times
would be exactly the unreadable history log this index exists to avoid.

Next available Change Set ID: **CHG-001** (none issued yet as of this
writing; the baseline programme that produced the 796 journeys predates
the Change Set system and is not retroactively assigned CHG numbers).

---

## Baseline log

| Baseline | Date | Commit | Journey Universe total | Test count | Active PGs | Open PDs | Known defects | Deferred | Future capability | PARTIAL / BLOCKED |
|---|---|---|---|---|---|---|---|---|---|---|
| V1 | 2026-10-02 | `546d470` (f447b21 adds documentation only, not a product change) | 796 | 1117 | 0 | 0 | 0 | 14 | 9 | 31 / 2 |

A new row is appended here at every baseline increment (`docs/
NEXUS_CHANGE_GOVERNANCE.md` section 12), never edited in place.

---

## Journey state changes

| Journey | Current State | Last Change Set | Previous Behaviour Reference |
|---|---|---|---|
| *(none yet; this table grows as Change Sets close)* | | | |

### Schema

- **Journey**: the ID (e.g. `H-027`), or a new ID if this row is a
  CREATE/SPLIT/MERGE result.
- **Current State**: one of ACTIVE, UPDATED, SUPERSEDED, RETIRED, FUTURE,
  MERGED, SPLIT (`docs/NEXUS_CHANGE_GOVERNANCE.md` section 3).
- **Last Change Set**: the `CHG-XXX` that most recently touched this
  journey's state.
- **Previous Behaviour Reference**: for UPDATED/SUPERSEDED/RETIRED/MERGED/
  SPLIT only, in the exact format `docs/NEXUS_CHANGE_GOVERNANCE.md`
  section 3 specifies:
  ```
  Valid through: <date or Change Set>
  Superseded by Change Set: <CHG-XXX>
  New canonical behaviour: <one line>
  Replacement journey(s): <ID(s), or "none, functionality retired">
  ```

### Illustrative example (not a real entry; remove or replace once the
first genuine Change Set closes)

| Journey | Current State | Last Change Set | Previous Behaviour Reference |
|---|---|---|---|
| H-027 *(example only)* | UPDATED | CHG-000 *(example only)* | Valid through: Baseline V1. Superseded by Change Set: CHG-000. New canonical behaviour: creator-only enforcement now also checks a secondary approver role. Replacement journey(s): none, same journey updated in place. |

---

## Maintenance rule

Every Change Set that reconciles (`docs/NEXUS_CHANGE_GOVERNANCE.md`
section 8) with any journey state change adds exactly the rows needed
here, and nowhere else. `docs/NEXUS_JOURNEY_UNIVERSE.md`'s own journey
text is updated only for ACTIVE/UPDATED journeys (to keep it describing
current behaviour); a SUPERSEDED or RETIRED journey's entry in that
document is annotated with a pointer to this index, not deleted, so a
reader lands on the full history rather than a dead end.
