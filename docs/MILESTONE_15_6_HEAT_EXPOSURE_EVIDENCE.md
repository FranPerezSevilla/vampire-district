# Milestone 15.6 — Heat, Exposure and concrete evidence

_Last updated: 2026-07-28_

## Goal

Separate ordinary criminal pursuit from proof of the supernatural.

```text
Heat      -> police believe the player committed a human crime
Exposure  -> people or institutions possess evidence that something impossible occurred
```

Neither value may rise because of an unexplained generic penalty. Both must be derived from concrete world events or evidence records that the player can inspect and, where appropriate, remove or redirect.

## Current problem

The current `ExposureSystem` owns one scalar that also drives police wanted level, police spawning and Heat. Calling `ExposureSystem.add(...)` automatically raises local police Heat, and police response reads `exposureSystem.level()` as its wanted authority.

This creates three design problems:

1. ordinary crime and supernatural discovery cannot diverge;
2. hiding in a shadow cools the global value even when a witness, corpse or recording still exists;
3. the UI cannot explain which surviving proof supports the current Exposure value.

## First implementation slice

### Heat authority

Heat becomes the sole authority for ordinary police response.

Heat records mundane reasons such as:

- assault, gunfire, theft or dangerous driving;
- visible body transport;
- witness reports of an ordinary crime;
- collisions, property damage or resisting police;
- a deliberately staged mundane explanation for a supernatural scene.

The police wanted state remains:

```text
0 CLEAR
1 SEARCH
2 PURSUIT
3 AIR SUPPORT
```

Wanted level is derived from active police Heat, reports, direct pursuit and last-known-player state. It is no longer derived from supernatural Exposure.

### Exposure authority

Exposure is derived from an evidence registry. Each record is serializable and contains, at minimum:

```text
id
kind
districtId
layer
sourceEvent
subjectId
createdAt
discoveredAt
resolvedAt
heatWeight
exposureWeight
knowledgeState
metadata
```

Initial evidence kinds:

- `witness_memory`;
- `bite_marks`;
- `drained_body`;
- `unconscious_feeding_victim`;
- `blood_pattern`;
- `visible_power_use` when the existing action already supplies enough facts.

The first slice does not add cameras merely to populate the registry. Recordings remain a later extension.

### Knowledge boundary

Evidence exists separately from who knows about it.

```text
latent      exists in the world but nobody authoritative has recovered it
reported    a mundane witness or police channel knows about it
institutional an institution/faction/hunter has incorporated it into a case
resolved    removed, hidden, discredited or converted into a mundane explanation
```

A body or blood stain is not automatically known to police. A witness is not automatically a perfect supernatural analyst. Factions and hunters do not receive unexplained global knowledge.

## Crime as an alibi

The player may accept additional Heat while reducing Exposure.

The first implementation must support the underlying contract even if only one or two cleanup actions use it immediately:

```text
resolve supernatural evidence
+ optionally create mundane Heat
+ record the explanation used
```

Examples for later authored/systemic actions:

- make a drained body look like an assault or gang killing;
- create a crash around an impossible death;
- destroy a recording and accept vandalism/obstruction Heat;
- move evidence in a stolen ambulance or hearse;
- redirect an institution toward an ordinary crime explanation.

## Runtime ownership

### `HeatSystem`

Owns:

- local district Heat;
- wanted-level thresholds;
- direct pursuit/search state;
- mundane crime reasons;
- decay rules when police lose the player.

Police systems consume Heat facts and must not read Exposure as their spawn/pursuit authority.

### `ExposureSystem`

Owns:

- concrete evidence records;
- active Exposure total and tier;
- evidence discovery/resolution;
- explanation of the current total;
- migration from the previous scalar exposure value.

The name may remain `ExposureSystem` during migration, but its internal authority changes from a free-floating scalar to evidence-backed state.

### `EvidenceSystem`

Owns physical scene interactions and submits evidence facts. It does not directly set the global Exposure tier.

### Campaign persistence

Evidence state must survive save/load/checkpoint/import/export without storing Phaser, DOM or function references. Existing saves migrate safely. A legacy scalar may become one explicit `legacy_exposure` record so no pressure disappears silently during migration.

## Night Ledger

The paused Night Ledger becomes the primary explanation surface.

### Police / Heat section

- wanted state;
- current hottest district and Heat value;
- direct pursuit/search status;
- active mundane reports and last known location;
- recent ordinary crimes driving police action.

### Exposure / evidence section

- Exposure tier and weighted total;
- active concrete evidence grouped by kind;
- whether each item is latent, reported, institutional or resolved;
- district, source and subject;
- cleanup opportunities when the current systems expose one;
- recent changes when evidence is discovered or removed.

The player must be able to answer:

```text
Why are police chasing me?
What proof of vampirism still exists?
Who currently knows about each item?
What can I remove, hide or reframe?
```

## Events and diagnostics

Expected events:

```text
heat:added
heat:cooled
heat:wanted-changed
evidence:registered
evidence:discovered
evidence:resolved
exposure:changed
```

Expected diagnostics:

```text
window.NBD_HEAT.snapshot()
window.NBD_EXPOSURE.snapshot()
window.NBD_EXPOSURE.activeEvidence()
```

## Compatibility rules

- existing crime actions remain playable while callers migrate;
- `ExposureSystem.add(...)` may temporarily adapt legacy callers, but each call must create an explicit evidence or Heat fact rather than mutate an unexplained scalar;
- police response cannot regress below the current gameplay baseline;
- hunting-law discovery remains evidence-based and may reference the same recovered body/witness facts without duplicating authority;
- Quick Bite, Full Feed and Drain retain distinct evidence profiles;
- Night Ledger faction information remains intact.

## Deliberate limits

- no camera network in this first slice;
- no persistent named hunter case yet;
- no full forensic pipeline or morgue transport chain;
- no automatic faction Cleaner service;
- no broad new mission content;
- no emotion, mood or blood-resonance mechanics;
- no second permanent player resource bar.

## Acceptance

- police wanted level no longer reads Exposure as its authority;
- ordinary crime can create high Heat with little or no Exposure;
- an undiscovered supernatural clue can exist with low Heat;
- discovering concrete supernatural evidence raises Exposure without magically creating police pursuit;
- resolving the final supporting evidence lowers the corresponding Exposure pressure;
- Heat and Exposure may rise, fall or diverge independently;
- every active Exposure point can be explained by one or more concrete records;
- evidence and Heat survive save/load where required;
- Night Ledger displays separate Heat and Exposure explanations;
- unit, boot, campaign and systems suites remain green.
