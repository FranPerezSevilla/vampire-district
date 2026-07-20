# Campaign foundation

_Status: Milestone 11.2 implementation complete; final CI and browser acceptance pending._

## Purpose

The campaign layer turns the current vertical slice into reusable, persistent game structure without storing Phaser objects or maintaining two mission state machines.

It provides:

- one versioned JSON-only campaign state;
- save, load, import, export and reset services;
- cash with an auditable transaction ledger;
- separate faction and contact reputation;
- serializable mission definitions;
- one generic `MissionRunner` as the authoritative mission state;
- a Phaser-facing `MissionSystem` that presents and triggers the current runner objective;
- safe objective checkpoints with world restoration;
- a second authored mission proving that the runner is reusable.

## Authoritative files

- `phaser/src/campaign/constants.js`
- `phaser/src/campaign/CampaignState.js`
- `phaser/src/campaign/CampaignStorage.js`
- `phaser/src/campaign/CampaignEventBus.js`
- `phaser/src/campaign/WalletSystem.js`
- `phaser/src/campaign/ReputationSystem.js`
- `phaser/src/campaign/MissionDefinition.js`
- `phaser/src/campaign/MissionRunner.js`
- `phaser/src/campaign/CampaignSystem.js`
- `phaser/src/campaign/CampaignCheckpoint.js`
- `phaser/src/campaign/CampaignCheckpointSystem.js`
- `phaser/src/campaign/CampaignBrowserApi.js`
- `phaser/src/campaign/preload.js`
- `phaser/src/campaign/bootstrap.js`
- `phaser/src/campaign/missions/silenceTheJournalist.js`
- `phaser/src/campaign/missions/cleanTheScene.js`
- `phaser/src/systems/MissionSystem.js`

`CampaignRuntimeBridge` has been deleted. The runtime no longer mirrors one mission implementation into another.

## Boot and ownership order

Campaign data is loaded before Phaser scene composition:

```text
app-bootstrap
→ campaign/preload
→ Phaser scenes
→ campaign checkpoint runtime
→ tutorial director
```

`MissionSystem` therefore receives the same persisted `CampaignSystem` instance during construction.

Current mission ownership:

```text
MissionDefinition
      ↓
MissionRunner     ← objective, status, progress, rewards and failure authority
      ↓ events and snapshots
MissionSystem     ← world triggers, markers, copy and sire-first finale
      ↓
TaskRevealSystem / TutorialDirector / HUD
```

The compatibility `step` exposed by `MissionSystem` is now derived from the current objective metadata. It is not a second mutable progression value.

## Campaign state version 2

Storage key remains:

```text
vampire-district-campaign-v1
```

Keeping the key allows version-one saves to migrate in place. The stored schema version is now `2`.

Top-level structure:

```js
{
  version,
  revision,
  createdAt,
  updatedAt,
  sequences,
  player,
  missions,
  checkpoints: {
    latest
  },
  reputation,
  inventory,
  world,
  ledger,
  eventLog
}
```

The state contains only JSON values. Phaser containers, functions, DOM nodes, event emitters and circular references are prohibited.

### Migration

- Version `0` is treated as the earlier unschematized prototype shape.
- Version `1` retains cash, mission, reputation, inventory and world state, then receives the checkpoint collection and sequence.
- A newer unsupported version fails explicitly.
- Corrupt JSON can fail strictly during import or fall back to a fresh state during normal boot.
- An old opening-mission record without a checkpoint can synthesize a conservative safe checkpoint at the next authored objective boundary.

## Direct MissionRunner authority

The opening mission is a data definition with these objectives:

1. `reach_police_roof`
2. `speak_to_informant`
3. `reach_nightclub`
4. `neutralize_journalist`
5. `return_to_refuge`

`MissionSystem` sends typed events to the runner:

```text
world:reached
conversation:completed
entity:neutralized
refuge:returned
```

The runner advances only when event type, target, accepted outcome and authored conditions match the active objective.

The journalist accepts:

```text
killed
drained
```

The sire-first finale remains presentation logic, but completion authority belongs to the runner:

```text
journalist handled
→ return objective active
→ player reaches refuge
→ sire dialogue
→ final bubble dismissed
→ refuge:returned event
→ MissionRunner completes mission and grants rewards
→ completion checkpoint captured
→ REPORT ACCEPTED opens
```

## Rewards

First completion of `Silence the Journalist` grants:

```text
Cash                         $500
Blackglass Directorate       +5
Your sire                    +1
World flag                   journalist_silenced
```

Rewards are idempotent. Reloading, replaying events or restoring the completion checkpoint cannot grant them twice.

## Safe checkpoint policy

The game does not save arbitrary combat frames as resumable world state. Checkpoints are requested at authored objective boundaries and written only when the world is safe.

A normal objective checkpoint waits while any of these conditions is active:

```text
world/dialogue/task lock
layer transition
interaction menu
feeding channel
player attack commitment
hit stun
wanted level
alarmed witness
active pursuer or enemy attack
```

The final mission-complete checkpoint may clear transient wanted, witness and pursuit pressure after the sire accepts the report, but it still refuses to capture during dialogue, transition, feeding or combat commitment.

When progress has autosaved beyond the latest safe checkpoint, reloading rolls mission and world state back atomically to that checkpoint. Examples:

- closing the browser after neutralizing the journalist while police are chasing restores the last safe `neutralize_journalist` checkpoint;
- failing a mission preserves its latest active safe checkpoint for a retry;
- beginning a different mission clears the previous mission's checkpoint;
- a completed campaign refuses an older active checkpoint, protecting rewards from rollback duplication.

## Checkpoint payload

Each checkpoint contains:

```js
{
  id,
  missionId,
  objectiveId,
  kind,
  createdAt,
  resumable,
  mission,
  player,
  loadout,
  world,
  tutorial,
  metadata
}
```

### Mission snapshot

The complete mission record is embedded in the checkpoint:

- status;
- objective index;
- every objective state;
- progress and outcome;
- timestamps;
- completion count;
- reward-granted flag;
- plain metadata.

This makes rollback atomic rather than depending on whichever mission autosave happened last.

### Restored player state

- position;
- world layer;
- Hunger;
- owned prototype weapons;
- selected weapon;
- remaining ammunition.

### Restored world state

- exposure value at the safe checkpoint;
- broken streetlights and prop durability;
- persistent static NPC positions and states;
- journalist and rooftop-thug outcomes;
- police informant departure;
- corpse visibility and discovery state;
- blood stains;
- feeding and evidence counters.

Dynamically spawned police and hunters are removed during restore. Local heat, helicopter lock, route blocks, chases, reports and enemy attack windups are transient and reset.

### Restored tutorial state

Checkpoints after the informant mark the opening tutorial complete. Reloading:

- does not reopen the long intro;
- does not replay the sire or informant conversation;
- restores full controls;
- keeps the informant gone;
- prevents a task-reveal or dialogue click from leaking into combat.

The intro modal is closed only after `TutorialDirector` has been created and accepted ownership of the restored state.

## Objective-authored checkpoint metadata

Checkpoint placement belongs to mission data rather than hard-coded objective IDs.

Example:

```js
{
  id: "neutralize_journalist",
  type: "neutralize",
  targetId: "journalist",
  metadata: {
    marker: { x: 588, y: 360, layer: 0, radius: 34 },
    checkpoint: {
      id: "at_nightclub",
      spawn: { x: 560, y: 350, layer: 0 },
      tutorialState: "complete",
      actorPreset: "post_informant"
    }
  }
}
```

The authored spawn is used for migrated or synthesized saves. A newly captured checkpoint uses the player's current position only when that position is valid for the current layer.

## Wallet and reputation

The campaign wallet remains the only cash mutation path. Every credit or debit records:

```text
transaction id
credit/debit
amount
balance before/after
timestamp
source
reason
reference id
plain metadata
```

Faction and contact reputation remain separate. Unaligned contacts do not receive one shared reputation value.

## Second authored mission

`Clean the Scene` still proves MissionRunner reuse:

1. Reach the club service alley.
2. Recover a compromised camera roll.
3. Remove the exposed body.
4. Reduce wanted level to zero.
5. Return to the refuge.

It exists as data and automated logic coverage. Mission selection, world placement and narrative presentation are the next campaign-content slice.

## Browser API

The build exposes:

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

Import, reset and checkpoint reload use a page reload so all Phaser systems bind to the same restored state.

## Automated coverage

Unit coverage includes:

- schema v1 → v2 migration;
- checkpoint sanitization and JSON serialization;
- safety reasons;
- atomic mission rollback data;
- completed-checkpoint compatibility;
- rejection of stale active checkpoints after completion;
- preservation of a failed run's safe checkpoint;
- clearing a checkpoint when another mission starts;
- direct MissionSystem/Runner authority;
- journalist killed and drained outcomes;
- sire dialogue before report;
- idempotent rewards;
- boot-order and source-ownership guards.

Chromium coverage includes:

- both playable routes using one authoritative campaign;
- absence of `CampaignRuntimeBridge`;
- v2 export/import;
- completion reward persistence after reload;
- completion checkpoint restoration without reopening the intro;
- objective checkpoint restoration of mission, position, Hunger, loadout, ammunition, broken lights, actors and tutorial state;
- the existing release-candidate tutorial, mission, police and post-report free-roam suite.

## Known limitations

- Only the opening mission is connected to world presentation.
- `Clean the Scene` is not yet selectable in the playable UI.
- Checkpoints are objective-boundary saves, not arbitrary manual saves.
- Dynamic patrol positions and in-progress pursuits intentionally reset.
- Some migrated v1 saves use authored conservative spawn/actor presets because the older schema did not contain world state.
- The current prototype loadout still owns all three weapons; campaign slot and stash rules arrive later.
- Safehouse mission selection and explicit Continue/New Game UI remain pending.
