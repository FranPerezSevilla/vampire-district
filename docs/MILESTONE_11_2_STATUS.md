# Milestone 11.2 — Direct mission authority and safe checkpoints

_Last updated: 2026-07-20_

## Status

**✅ Functional and automated acceptance complete; implementation and CI hardening are merged into `main`.**

Implementation pull request:

```text
#9 Make campaign missions authoritative and add safe checkpoints
```

Final implementation head and squash merge:

```text
head   88d90ef5467526d43f8cc11ae6e7f76632383930
merge  b14520b37b525cb10796f5b448cfb9ec434e27f7
```

Automated-validation follow-up:

```text
#11 Harden browser CI timing and correct Milestone 11.2 record
```

Final validation head and squash merge:

```text
head   1f0bedc02514efbf57c96a200fe4d7bc5b9caa40
merge  dc4210eba60eb752202e5b323e10f91ab2c32713
```

Acceptance evidence on 2026-07-20:

```text
manual browser acceptance   ✅
unit-tests                  ✅
browser-smoke               ✅
Netlify deploy preview      ✅
```

PR #11 made the automated result observable and deterministic without changing player-facing rules. It raised the browser budget, retained logs/reports/traces on failure, loaded the pinned local Phaser build, enabled RC timings before scene construction, protected synchronous mission startup, corrected persistence coverage and removed timing-sensitive test assumptions.

## Accepted ownership model

```text
MissionDefinition
      ↓
MissionRunner     ← objective, status, progress, failure and reward authority
      ↓
MissionSystem     ← world triggers, markers, copy and sire-first presentation
```

`CampaignRuntimeBridge` has been physically removed. The compatibility `MissionSystem.step` value is derived from the active objective metadata and is not a second mutable mission state.

## Accepted save policy

Campaign schema version `2` stores one atomic latest-safe checkpoint. Normal checkpoints are written only at authored objective boundaries and only after dialogue/task locks, transitions, menus, feeding, attacks, hit stun, wanted pressure, witnesses and pursuers have cleared.

A reload restores or rolls back atomically:

- mission record and active objective;
- player position and world layer;
- Hunger;
- owned prototype weapons, selected weapon and ammunition;
- broken streetlights;
- persistent static NPC outcomes and corpses;
- informant departure;
- blood evidence and counters;
- completed tutorial state.

Dynamic police/hunter reinforcements, chase intent, local heat, route blocks, helicopter lock and attack windups are intentionally reset.

## Accepted edge cases

- Unsafe autosaved progress rolls back to the latest safe objective checkpoint.
- A failed same-mission retry preserves its safe checkpoint.
- Starting a different mission clears the previous checkpoint.
- Completed campaign state rejects a stale active checkpoint.
- The completion checkpoint is captured before `REPORT ACCEPTED` opens.
- Killed and drained journalist outcomes grant rewards once.
- Reloading a completed checkpoint does not replay the intro, tutorial or rewards.
- Browser restoration accepts the first simulation-frame drift in Hunger without weakening the stored checkpoint assertion.

## Browser API

```js
window.NBD_CAMPAIGN.snapshot()
window.NBD_CAMPAIGN.export()
window.NBD_CAMPAIGN.checkpoint()
window.NBD_CAMPAIGN.startMission(id, options)
window.NBD_CAMPAIGN.save()
window.NBD_CAMPAIGN.reloadCheckpoint()
window.NBD_CAMPAIGN.discardCheckpoint()
window.NBD_CAMPAIGN.reset()
window.NBD_CAMPAIGN.import(serialized)
window.NBD_CAMPAIGN.safety()
```

## Continuation delivered

Milestone 11.3 now exposes this accepted foundation to the player through:

- New Game, Continue and explicit Retry decisions;
- the rooftop-refuge contract board;
- selectable and replayable `Clean the Scene`;
- data-driven mission item and body placement;
- completion and return-to-board flow.

Vehicle work begins in Milestone 12.
