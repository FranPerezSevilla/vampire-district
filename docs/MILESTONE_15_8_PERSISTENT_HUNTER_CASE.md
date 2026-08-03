# Milestone 15.8 — Persistent hunter investigation

_Last updated: 2026-07-29_

**Status: 🔵 Active design and implementation in PR #47.**

## Goal

Replace the current Exposure-threshold hunter spawn with one persistent, evidence-limited investigation that learns from the player's actual behaviour.

Viceblood should create the feeling that an intelligent adversary is building a case:

```text
proof recovered
→ lead created
→ hypothesis strengthened
→ operation prepared
→ player adapts or is cornered
```

The hunter must never know a fact merely because the runtime knows it. Every conclusion must be traceable to testimony, physical evidence, a recognised vehicle, a repeated location, a tracked route or an explicitly compromised source.

## One hunter, not combat waves

The first implementation owns one canonical case and one persistent hunter identity.

The exact authored display name remains data-owned and may change without migrating the stable ID:

```text
hunterId: first_hunter
caseId: viceblood_case_01
```

There is no generic population of endlessly respawning hunters. Neutralising the hunter changes the campaign state and produces a durable outcome.

Possible long-term outcomes:

- `active` — the case is being pursued;
- `misdirected` — confidence remains, but the current suspect or pattern is wrong;
- `compromised` — the hunter's institution, source or evidence chain has been damaged;
- `discredited` — the case has lost institutional credibility;
- `politically_neutralized` — a faction or contact has forced the investigation to stop;
- `dead` — the hunter was killed, leaving consequences and potentially retained evidence;
- `resolved` — the case no longer identifies the player as the supernatural subject.

Killing the hunter is not automatically the cleanest solution. Institutional evidence may survive the person who assembled it.

## Campaign authority

Campaign schema v6 adds one migration-safe `hunterInvestigation` domain.

Suggested shape:

```js
{
  version: 1,
  caseId: "viceblood_case_01",
  hunterId: "first_hunter",
  status: "dormant",
  confidence: 0,
  identityConfidence: 0,
  refugeConfidence: 0,
  sequence: 0,
  evidenceIds: [],
  testimonyIds: [],
  leads: {},
  hypotheses: {},
  patterns: {
    districts: {},
    feedingSites: {},
    vehicles: {},
    routes: {},
    contacts: {},
    refuges: {}
  },
  operations: [],
  activeOperationId: null,
  lastUpdatedAt: 0,
  outcome: null
}
```

All values are serializable. Runtime objects, Phaser containers and direct NPC references are forbidden in campaign state.

## Knowledge boundary

The investigation consumes only facts that have crossed an explicit knowledge boundary.

Eligible inputs:

- evidence in `reported` or `institutional` state;
- completed witness reports;
- bodies, blood patterns or bite evidence formally recovered by an institution;
- vehicle sightings where a witness, police unit, tracker or camera has a concrete vehicle ID or plate;
- an examined location linked to an existing evidence record;
- a compromised contact or faction service that explicitly transfers information;
- direct hunter observation while the hunter is physically present and capable of seeing the event.

Ineligible inputs:

- latent evidence nobody has recovered;
- hidden bodies or blood traces with no surviving report;
- the player's current coordinates merely because they exist in memory;
- a refuge, route, vehicle or contact the hunter has never observed or inferred;
- faction-protection facts unavailable to the hunter;
- arbitrary access to campaign flags or the complete event log.

Resolving physical evidence before it becomes known prevents it from entering the case. Resolving evidence after institutional recovery can weaken credibility or remove a supporting chain, but does not retroactively erase a testimony already recorded.

## Leads and hypotheses

A **lead** is one concrete investigated fact. Examples:

- drained body recovered in Civic Centre;
- witness reports impossible movement near Canal East;
- the same stolen sedan appears at two supernatural incidents;
- blood evidence repeatedly ends near a sewer access;
- a protected First Estate donor disappears after contact with the player.

A **hypothesis** combines leads into a conclusion with explicit support.

Initial hypotheses:

- `supernatural_actor_exists`;
- `same_actor_repeats`;
- `suspect_identity`;
- `preferred_hunting_ground`;
- `recognised_vehicle`;
- `preferred_escape_route`;
- `faction_protection`;
- `suspected_refuge`.

Each hypothesis stores:

```text
id
confidence
supportingLeadIds
contradictingLeadIds
createdAt
updatedAt
status
```

Confidence is deterministic and bounded. No hidden random roll decides what the hunter knows.

## Pattern learning

Repeated habits matter only after multiple eligible observations.

### Districts and feeding sites

- first known incident: isolated lead;
- second related incident: possible preference;
- third related incident: actionable pattern;
- changing district or method reduces recency weight but does not delete old history.

### Vehicles

A vehicle becomes recognisable through a plate, distinctive damage, repeated sightings or a tracker. Switching vehicles is useful only if the replacement has not already entered the case.

### Routes

The hunter may learn:

- repeated sewer entrances;
- recurring roof transitions;
- roads used after incidents;
- a route repeatedly connecting scenes to one district or refuge.

A route is not known from one traversal unless the hunter, police or a concrete device observed it.

### Contacts and factions

The hunter may suspect protection when incidents repeatedly resolve through one institution, contact or faction service. Suspicion is not proof and must not reveal a secret faction relationship without supporting leads.

## Escalation and operations

Operations are authored responses selected from case state. Every operation records the lead/hypothesis that caused it.

Initial ladder:

1. **Scene examination** — the hunter visits a known incident after police activity.
2. **Focused surveillance** — watches one repeated district or feeding site.
3. **Vehicle watch** — tracks or waits for a recognised vehicle.
4. **Route trap** — places one obstacle, light or observer on a learned escape route.
5. **Contact pressure** — follows, questions or compromises one supported contact.
6. **Refuge probe** — tests a suspected refuge without instantly revealing it as certain.
7. **Direct interception** — attempts to confront or contain the player when identity confidence is high.

Operations use cooldowns and exclusivity. The system must not stack endless roadblocks, hunters or unavoidable combat waves.

Suggested confidence gates:

```text
0–19    dormant / noise
20–39   observing
40–59   investigating
60–79   operational
80–100  identity-focused
```

Thresholds enable operation classes; they do not automatically reveal the player or spawn an attacker at the player's position.

## Counterplay

The player can change the case rather than merely wait for a meter to decay.

Initial counterplay contracts:

- destroy or clean latent evidence before recovery;
- discredit a known evidence item;
- create a mundane explanation through crime-as-an-alibi;
- abandon or alter a recognised vehicle;
- change hunting district, feeding depth or escape route;
- plant a false lead pointing to another actor or location;
- compromise a witness or information source before formal transfer;
- use faction influence to remove access, evidence or institutional support;
- expose the hunter inside hostile territory;
- kill, discredit or politically neutralise the hunter.

A false lead is itself a concrete record with provenance and credibility. It cannot be an unrestricted “lower case meter” button.

## Runtime ownership

Proposed modules:

- `phaser/src/hunters/HunterInvestigationModel.js` — state creation, sanitisation, scoring and pure selectors;
- `phaser/src/hunters/HunterInvestigationSystem.js` — campaign service, evidence ingestion, leads, hypotheses and operations;
- `phaser/src/hunters/HunterOperationDirector.js` — runtime materialisation of one selected operation;
- existing `HunterSystem` — physical hunter movement/combat adapter only;
- `CampaignState` — persistence and migration;
- `ExposureSystem` / `WitnessSystem` — knowledge sources, never bypassed;
- `NightLedgerModel/View` — player-facing case pressure and known counterplay.

The current `HunterSystem.maybeReveal()` threshold logic will be retired. Hunter activation will be driven by the persistent case and an explicit operation.

## Player-facing feedback

The Night Ledger gains a **Hunter Case** section without revealing hidden deductions the player could not know.

It may show:

- current public pressure: dormant, observing, investigating, operational;
- evidence the player already knows was recovered;
- recognised vehicle warnings;
- districts or routes visibly under surveillance;
- active operation clues;
- case changes caused by player counterplay;
- final hunter outcome.

It must not display the hunter's exact internal suspect identity, secret lead list or planned ambush location unless the player has learned those facts.

World feedback should explain operations through observable signs:

```text
A known scene has been examined.
Your stolen sedan has been recognised.
Someone is watching the Canal East entrance.
The route to the refuge no longer feels clean.
```

## Events and diagnostics

Planned campaign events:

```text
hunter:case-opened
hunter:lead-added
hunter:lead-invalidated
hunter:hypothesis-changed
hunter:pattern-recognised
hunter:operation-planned
hunter:operation-started
hunter:operation-resolved
hunter:identity-confidence-changed
hunter:outcome-changed
```

Planned diagnostic surface:

```js
window.NBD_HUNTER_CASE.snapshot()
window.NBD_HUNTER_CASE.publicSnapshot()
window.NBD_HUNTER_CASE.leads()
window.NBD_HUNTER_CASE.hypotheses()
window.NBD_HUNTER_CASE.activeOperation()
```

Diagnostics may expose full internal state in test/development mode; player UI consumes only `publicSnapshot()`.

## Migration

- campaign schema increments from v5 to v6;
- existing saves receive a dormant empty case;
- old scalar Exposure is already migrated into concrete evidence and may enter the case only through normal knowledge-state rules;
- the old transient `HunterSystem.revealed`, random spawn count and route-block timers are not treated as campaign truth;
- loading a checkpoint must not duplicate leads or operations;
- repeated ingestion of the same evidence ID is idempotent.

## Acceptance

- one persistent case survives save/load and checkpoint restoration;
- only known evidence creates leads;
- the same evidence cannot be counted twice;
- repeated districts, vehicles and routes create deterministic patterns;
- changing habits measurably slows or redirects the case;
- every operation names its supporting lead/hypothesis in diagnostics;
- the hunter never spawns at the player's location from a global Exposure threshold;
- only one major hunter operation is active at once;
- Night Ledger exposes useful public pressure without leaking secret deductions;
- killing, discrediting and political neutralisation are distinct durable outcomes;
- unit, city compiler, boot, campaign and systems suites remain green.

## Deliberate limits

- no second hunter or generic hunter population;
- no procedural dialogue generation;
- no full camera network until a separate recording/camera slice exists;
- no automatic faction-war simulation;
- no unavoidable refuge raid in the first implementation;
- no resurrection or replacement hunter after a durable final outcome;
- no emotion, mood or blood-resonance mechanics.
