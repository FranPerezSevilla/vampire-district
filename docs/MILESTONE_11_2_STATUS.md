# Milestone 11.2 — Direct mission authority and safe checkpoints

_Last updated: 2026-07-20_

## Status

**✅ Automated acceptance complete and merged into `main`.**

Pull request:

```text
#9 Make campaign missions authoritative and add safe checkpoints
```

Validated final PR head:

```text
88d90a0188753530893ad9ac7f2cb260d125ed51
```

Merged squash commit:

```text
b14520fe81780e78c62c405a8d0bd2f40bd2a692
```

Validation recorded on the final head:

```text
unit-tests    ✅
browser-smoke ✅
```

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

## Next campaign slice

Milestone 11.3 will expose campaign content to the player:

- refuge mission board;
- Continue, New Game and Retry-from-checkpoint presentation;
- selectable `Clean the Scene` contract;
- data-driven world placement for mission items and bodies;
- mission completion/return to board flow.

Vehicle work remains Milestone 12 and begins after that mission-selection slice is accepted.
