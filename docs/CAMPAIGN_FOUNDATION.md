# Campaign foundation

_Status: Milestone 11 complete and merged into `main`._

## Purpose

The campaign layer turns the validated vertical slice into reusable, persistent game structure without storing Phaser objects or maintaining two mission state machines.

It provides:

- one versioned JSON-only campaign state;
- save, load, import, export and reset services;
- cash with an auditable transaction ledger;
- separate faction and contact reputation;
- serializable mission definitions;
- one generic `MissionRunner` as the authoritative mission state;
- a Phaser-facing `MissionSystem` that presents and triggers the active runner objective;
- safe objective and completion checkpoints with world restoration;
- explicit New Game, Continue and Retry decisions;
- a refuge mission board driven from campaign definitions;
- two playable authored contracts proving that the runner is reusable.

## Authoritative files

Core campaign:

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

Boot and player-facing campaign flow:

- `phaser/src/campaign/preload.js`
- `phaser/src/campaign/bootstrap.js`
- `phaser/src/campaign/CampaignEntry.js`
- `phaser/src/campaign/CampaignEntrySystem.js`
- `phaser/src/campaign/entry-bootstrap.js`
- `phaser/src/campaign/MissionBoard.js`
- `phaser/src/campaign/MissionBoardSystem.js`
- `phaser/src/campaign/board-bootstrap.js`

Missions and world adapters:

- `phaser/src/campaign/missions/silenceTheJournalist.js`
- `phaser/src/campaign/missions/cleanTheScene.js`
- `phaser/src/campaign/CleanTheSceneSystem.js`
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
→ campaign entry
→ refuge mission board
→ release-candidate harness when requested
```

`MissionSystem` therefore receives the same persisted `CampaignSystem` instance during construction. Checkpoint restoration happens before tutorial and campaign-entry presentation, and the board attaches only after the entry decision owner exists.

Current mission ownership:

```text
MissionDefinition
      ↓
MissionRunner     ← objective, status, progress, rewards and failure authority
      ↓ events and snapshots
MissionSystem     ← stable scene-facing facade and opening narrative presentation
      ↓
mission-specific world adapter / TaskRevealSystem / HUD / TutorialDirector
```

The compatibility `step` exposed by `MissionSystem` is derived from current objective metadata. It is not a second mutable progression value.

## Campaign state version 2

Storage key remains:

```text
vampire-district-campaign-v1
```

Keeping the key allows version-one saves to migrate in place. The stored schema version is `2`.

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

## Campaign entry

At boot, plain campaign state is classified before the player receives world control:

```text
fresh state                 → New Game
active mission              → Continue / New Game
failed + safe checkpoint    → Retry from checkpoint / New Game
failed without checkpoint   → Retry mission / New Game
completed opening contract  → Continue free roam / New Game
```

New Game and Retry use a session-only handoff token plus a page reload so every Phaser system binds to the same coherent state. Continue never reconstructs campaign state or grants rewards.

A failed run keeps its serialized safe checkpoint but does not apply it before the player chooses Retry.

## Refuge mission board

The board is available at the rooftop refuge only when:

- the opening contract is complete;
- no mission is currently active;
- no failed mission still requires a Retry decision;
- the campaign-entry overlay does not own focus.

Cards are derived from mission definitions, rewards and mission records. The board is not a second mission registry.

The first board contract is `Clean the Scene`:

1. Reach the club service alley.
2. Recover the compromised camera roll.
3. Remove the exposed body.
4. Reduce wanted level to zero.
5. Return to the refuge.

World placement belongs to mission metadata. `CleanTheSceneSystem` reads the current runner objective and translates player/world actions into typed campaign events; it does not store a parallel objective index.

## Rewards

First completion of `Silence the Journalist` grants:

```text
Cash                         $500
Blackglass Directorate       +5
Your sire                    +1
World flag                   journalist_silenced
```

Completion of each `Clean the Scene` run grants:

```text
Cash                         $275
Blackglass Directorate       +2
Directorate cleaner          +3
World flag                   cleaner_contact_unlocked
```

Reward transactions are idempotent for a mission record. Reloading, replaying events or restoring a completion checkpoint cannot grant the same completion twice.

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

A mission-complete checkpoint may clear transient wanted, witness and pursuit pressure after the report is accepted, but it still refuses to capture during dialogue, transition, feeding or combat commitment.

When progress has autosaved beyond the latest safe checkpoint, reloading rolls mission and world state back atomically to that checkpoint. Examples:

- closing after neutralizing the journalist while police are chasing restores the latest safe nightclub checkpoint;
- failing a mission preserves its latest active safe checkpoint for an explicit retry;
- beginning a different mission clears the previous mission's checkpoint;
- a completed campaign refuses an older active checkpoint, protecting rewards from rollback duplication;
- accepting a board contract replaces the previous completion checkpoint with the new mission's first safe boundary.

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
- journalist, rooftop-thug and exposed-body outcomes;
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

## Objective-authored checkpoint metadata

Checkpoint placement belongs to mission data rather than hard-coded objective ids.

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

The campaign wallet is the only cash mutation path. Every credit or debit records:

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

## Accessibility and UI ownership

Campaign entry and the mission board each own one modal dialog while open.

- The underlying native modal is hidden and inert.
- Tab and Shift+Tab remain inside available actions.
- Escape cannot dismiss a required entry decision.
- Escape closes the optional board without mutating state.
- Enter and Space activate focused campaign, board and successful-report actions before Phaser can consume them.
- Narrow layouts stack actions vertically and retain viewport access.

## Browser APIs

Campaign state and persistence:

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

Mission board:

```js
window.NBD_MISSION_BOARD.snapshot()
window.NBD_MISSION_BOARD.open()
window.NBD_MISSION_BOARD.close()
window.NBD_MISSION_BOARD.accept("clean_the_scene")
```

Import, reset, New Game and checkpoint Retry use a page reload so all Phaser systems bind to the same restored state.

## Automated coverage

Unit coverage includes:

- schema v1 → v2 migration;
- checkpoint sanitization and JSON serialization;
- safety reasons and atomic mission rollback data;
- completed-checkpoint compatibility;
- rejection of stale active checkpoints after completion;
- preservation of a failed run's safe checkpoint;
- clearing a checkpoint when another mission starts;
- direct `MissionSystem`/runner authority;
- journalist killed and drained outcomes;
- sire dialogue before report;
- campaign-entry classification and action ownership;
- board availability, replay labels and active/failure exclusion;
- complete `Clean the Scene` typed-event progression;
- idempotent wallet and reputation rewards;
- boot-order and source-ownership guards.

Chromium coverage includes:

- both playable routes using one authoritative campaign;
- absence of `CampaignRuntimeBridge`;
- v2 export/import;
- New Game, Continue and Retry flows;
- completion reward persistence after reload;
- completion checkpoint restoration without reopening the intro;
- objective checkpoint restoration of mission, position, Hunger, loadout, ammunition, broken lights, actors and tutorial state;
- accessible refuge board on wide and narrow viewports;
- complete camera-roll, body-removal, wanted-loss and refuge-return flow;
- `Clean the Scene` completion reload without duplicate rewards;
- existing release-candidate tutorial, mission, police and post-report free-roam coverage.

## Known limitations

- Checkpoints are objective-boundary saves, not arbitrary manual saves.
- Dynamic patrol positions and in-progress pursuits intentionally reset.
- Some migrated v1 saves use conservative authored spawn/actor presets because the older schema did not contain world state.
- The current prototype loadout still owns all three weapons; campaign slot and stash rules arrive in Milestone 15.
- The current playable campaign has one refuge board and one secondary replayable contract.
- Vehicles, traffic, broader faction territory and supplier/retainer systems are not part of Milestone 11.
