# Milestone 15.6 — Heat, Exposure and concrete evidence

_Last updated: 2026-07-29_

**Status: complete in PR #45.**

## Goal

Viceblood now separates ordinary criminal pursuit from proof of the supernatural.

```text
Heat      -> police believe the player committed a human crime
Exposure  -> people or institutions possess evidence that something impossible occurred
```

The two pressures may rise, fall or diverge independently. Police response no longer reads supernatural Exposure as its wanted authority, and every active Exposure point is backed by a serializable evidence record.

## Delivered authority split

### `HeatSystem`

`HeatSystem` is the sole wanted-level authority. It owns:

- district-local Heat values;
- mundane incident history;
- wanted thresholds and level-change events;
- Heat decay and the hottest active district;
- campaign/checkpoint persistence;
- the diagnostic surface `window.NBD_HEAT`.

Default thresholds:

```text
0–17    CLEAR
18–44   SEARCH
45–74   PURSUIT
75–100  AIR SUPPORT
```

Heat is produced by concrete ordinary-crime facts such as assault, gunfire, vehicle theft, dangerous collisions, visible body transport, police violence and completed witness reports. Foot police and motorized police consume `HeatSystem.level()` and do not read `ExposureSystem.level()`.

### `ExposureSystem`

`ExposureSystem` is an evidence registry rather than a free-floating punishment scalar. It owns:

- concrete evidence records;
- knowledge/discovery state;
- weighted Exposure total and level;
- evidence discovery and resolution;
- campaign/checkpoint persistence;
- migration from the old scalar value;
- the diagnostic surface `window.NBD_EXPOSURE`.

The initial evidence kinds are:

```text
witness_memory
bite_marks
drained_body
unconscious_feeding_victim
blood_pattern
visible_power_use
legacy_exposure
```

The value shown as Exposure is the sum of unresolved records that are `reported` or `institutional`. Latent physical clues are still inspectable, but do not imply that an authority already knows about them.

## Knowledge boundary

```text
latent          exists in the world but no authority has recovered it
reported        a witness or police/reporting channel knows about it
institutional   a faction, institution or investigator has retained it
resolved        removed, hidden, discredited or reframed
```

Knowledge never downgrades merely because the same physical clue is refreshed. A later event creates a new record rather than silently reviving resolved knowledge.

A body, blood trace or unconscious feeding victim is initially latent. A civilian finding it creates a witness memory and a pending report; the related evidence becomes reported only when that witness reaches a reporting point. Intercepting the witness can resolve the latent memory, and another witness may later rediscover an evidence source that remains visible.

## Feeding and physical evidence

Quick Bite, Full Feed and Drain retain distinct evidence profiles:

- **Quick Bite:** bite marks and a possible witness memory;
- **Full Feed:** bite marks, an unconscious victim and a blood-pattern record;
- **Drain:** bite marks, drained-body evidence and the strongest blood pattern.

Physical blood stains carry links to their evidence records. Cleaning, expiry or bounded removal resolves the linked record only while it remains latent. Removing a scene cannot erase knowledge already reported or retained institutionally.

Hiding a body or unconscious victim follows the same rule: it removes latent physical proof, but not a report that has already left the scene.

## Crime as an alibi

The evidence API can resolve or reframe a supernatural clue while deliberately creating mundane Heat:

```text
less proof of a vampire
more certainty that a human crime occurred
```

This establishes the reusable contract for future actions such as staging an assault, crash or gang killing, destroying a recording, or using an institution to file a mundane explanation. The first slice provides the authority and API; authored missions and specialist services remain later work.

## Persistence and migration

- campaign schema: `5`;
- checkpoint schema: `3`;
- district Heat, Heat incidents and concrete evidence survive save/load/import/export;
- checkpoint snapshots include Heat, Exposure records, NPC evidence links and blood-stain evidence links;
- mission-complete threat reset clears Heat while retaining unresolved Exposure evidence;
- old numeric Exposure becomes one explicit institutional `legacy_exposure` record, so migration never silently deletes pressure;
- serializing and restoring an evidence snapshot does not create duplicate legacy evidence.

## Night Ledger

The paused Night Ledger now separates:

### Police / Heat

- wanted state;
- hottest district and current Heat;
- searching/chasing officers and motorized units;
- recent mundane incidents and reasons.

### Veil / Evidence

- Exposure level and weighted total;
- active evidence grouped by kind;
- latent, reported or institutional knowledge state;
- district, subject and explanation for each clue;
- recent discovery and resolution changes.

The player can therefore answer:

```text
Why are police chasing me?
What proof of vampirism still exists?
Who knows about each item?
Did cleanup remove the clue or only the physical scene?
```

## Events and diagnostics

```text
heat:added
heat:cooled
heat:wanted-changed
evidence:registered
evidence:discovered
evidence:resolved
exposure:changed
```

```js
window.NBD_HEAT.snapshot()
window.NBD_HEAT.level()
window.NBD_EXPOSURE.snapshot()
window.NBD_EXPOSURE.activeEvidence()
window.NBD_EXPOSURE.discover(id, options)
window.NBD_EXPOSURE.resolve(id, options)
```

## Deliberate limits

- no camera/recording network yet;
- no persistent named-hunter case yet;
- no full forensic transport or morgue pipeline;
- no Cleaner or faction evidence-removal service;
- no authored crime-as-an-alibi mission;
- no emotion, mood, resonance or blood-quality system;
- no second permanent player resource bar.

## Validation contract

- ordinary crime can create high Heat with zero Exposure;
- latent supernatural evidence can exist with zero Heat and zero current Exposure;
- discovering evidence raises Exposure without creating police pursuit;
- resolving the final supporting record lowers Exposure;
- reframing evidence may lower Exposure while raising Heat;
- police, cruisers, checkpoints and maintenance use Heat as wanted authority;
- hunter activation continues to use supernatural Exposure;
- campaign/checkpoint round-trips preserve both domains;
- Night Ledger explains both independently;
- unit, city compiler, boot, campaign and systems domains remain green.
