# Campaign foundation

_Status: persistent foundation accepted; opening mission now runs through direct CampaignRunner authority._

## Purpose

The campaign layer turns the current vertical slice into reusable, persistent game structure without storing Phaser objects or hard-coding every future contract into one scene class.

It provides:

- one versioned JSON-only campaign state;
- save, load, import, export and reset services;
- a cash wallet with an auditable transaction ledger;
- separate faction and contact reputation;
- serializable mission definitions;
- a generic mission runner;
- stable authored checkpoints;
- direct authority over the opening journalist contract;
- a second authored mission proving that the runner does not require mission-specific code.

## Authoritative files

- `phaser/src/campaign/constants.js`
- `phaser/src/campaign/CampaignState.js`
- `phaser/src/campaign/CampaignStorage.js`
- `phaser/src/campaign/CampaignEventBus.js`
- `phaser/src/campaign/CampaignCheckpointSystem.js`
- `phaser/src/campaign/WalletSystem.js`
- `phaser/src/campaign/ReputationSystem.js`
- `phaser/src/campaign/MissionDefinition.js`
- `phaser/src/campaign/MissionRunner.js`
- `phaser/src/campaign/CampaignSystem.js`
- `phaser/src/campaign/CampaignMissionAuthority.js`
- `phaser/src/campaign/missions/silenceTheJournalist.js`
- `phaser/src/campaign/missions/cleanTheScene.js`
- `phaser/src/campaign/bootstrap.js`

`CampaignRuntimeBridge` has been removed. The opening mission no longer has two independent progression authorities.

## Campaign state

Storage key:

```text
vampire-district-campaign-v1
```

Top-level schema:

```js
{
  version,
  revision,
  createdAt,
  updatedAt,
  sequences,

  player: {
    cash,
    currentRefugeId
  },

  missions: {
    activeMissionId,
    records,
    completed,
    failed
  },

  reputation: {
    factions,
    contacts
  },

  inventory: {
    carried,
    refuges
  },

  world: {
    ownedVehicles,
    unlockedRefuges,
    flags
  },

  checkpoint: {
    id,
    kind,
    missionId,
    objectiveId,
    locationId,
    capturedAt,
    payload
  },

  ledger,
  eventLog
}
```

The stored state contains only JSON values. Phaser containers, functions, DOM nodes, event emitters and circular references are prohibited.

### Migration

Version `0` represents the earlier unschematized prototype shape. Loading it supplies all current defaults while retaining recognized money, mission, reputation, inventory and world fields.

The checkpoint field is an additive version-one extension. Saves created before checkpoints existed receive the `campaign_start` default and use objective-specific restoration fallbacks.

A save from a newer unsupported version fails explicitly rather than silently discarding data.

Corrupt JSON can either fail strictly during import or fall back to a fresh state during normal boot.

## Wallet and ledger

The wallet owns all cash changes:

```js
wallet.credit(500, {
  source: "mission",
  reason: "Completed Silence the Journalist",
  referenceId: "silence_the_journalist"
});

wallet.debit(90, {
  source: "supplier",
  reason: "12 pistol rounds",
  referenceId: "pistol_rounds_12"
});
```

Each transaction records:

```text
id
credit/debit
amount
balance before
balance after
timestamp
source
reason
reference id
plain metadata
```

A debit that exceeds the available balance throws `INSUFFICIENT_CASH` and does not mutate the ledger.

The current journalist contract pays `$500` on its first campaign completion. Ammunition vendors and safehouse armouries remain deferred to Milestone 15.

## Reputation

Faction and contact reputation are separate collections:

```js
reputation.modifyFaction("blackglass_directorate", 5);
reputation.modifyContact("your_sire", 1);
```

The range is `-100` to `100`, with presentation tiers:

```text
Hostile
Watched
Distrusted
Neutral
Useful
Favoured
Trusted
```

Unaligned Houses do not share a global standing. Each House, supplier or named operator uses contact reputation unless an authored House receives its own faction record.

## Mission definitions

Definitions are validated and frozen plain data:

```js
{
  id,
  version,
  title,
  factionId,
  contactId,
  replayable,
  objectives,
  rewards,
  failureRules,
  metadata
}
```

Supported objective types:

- `reach`
- `talk`
- `collect`
- `neutralize`
- `destroy`
- `escape`
- `return`
- `stealVehicle`
- `deliverVehicle`
- `loseWantedLevel`

Vehicle objective contracts exist before vehicles so Milestone 12 can integrate without modifying the runner.

Objectives may include authored checkpoint metadata:

```js
{
  id: "neutralize_journalist",
  type: "neutralize",
  targetId: "journalist",
  acceptedOutcomes: ["killed", "drained"],
  metadata: {
    checkpoint: {
      id: "journalist_target_reached",
      locationId: "nightclub_district"
    }
  }
}
```

## Mission runner

The runner is linear, deterministic and event-driven:

```text
mission start
→ objective active
→ matching typed event
→ objective complete
→ next objective active
→ mission complete or failed
→ rewards granted once
→ stable checkpoint captured where authored
```

Events only advance the current objective when:

- event type matches objective type;
- target id matches;
- a neutralization outcome is accepted;
- count/progress reaches the requirement;
- wanted level satisfies the authored threshold.

The runner owns the mission record and rewards. It also supports plain metadata such as tutorial jump count without storing scene objects.

Rewards are idempotent. Replaying or calling completion twice cannot duplicate cash or reputation.

## Direct opening-mission authority

The current integration path is:

```text
player/world action
→ MissionSystem identifies the authored world trigger
→ MissionSystem sends a typed CampaignRunner event
→ CampaignRunner advances the objective
→ campaign event updates MissionSystem presentation
→ existing marker, task reveal and tutorial UI update
```

The opening contract therefore has one progression source: `CampaignRunner`.

`MissionSystem` is retained because it contains the current Phaser presentation contract:

- district coordinates and radii;
- four-step HUD wording;
- objective marker mapping;
- task-reveal event compatibility;
- sire dialogue and final report presentation.

While a campaign is attached, its old `setStep` path cannot independently advance the mission.

### Opening contract event mapping

| World action | Campaign event | Objective |
|---|---|---|
| Rooftop route reaches police roof | `world:reached` | `reach_police_roof` |
| Informant sequence completes | `conversation:completed` | `speak_to_informant` |
| Player reaches club district | `world:reached` | `reach_nightclub` |
| Journalist killed or drained | `entity:neutralized` | `neutralize_journalist` |
| Sire report dialogue dismissed | `refuge:returned` | `return_to_refuge` |

The RETURN event is deliberately delayed until after the sire dialogue promise resolves. This preserves:

```text
journalist handled
→ return objective
→ player reaches refuge
→ two sire thoughts
→ dialogue dismissed
→ CampaignRunner completes
→ rewards
→ REPORT ACCEPTED
```

## Checkpoint system

Checkpoints are authored reconstruction boundaries, not snapshots of every simulation object.

`CampaignCheckpointSystem` captures:

```js
checkpoint.capture({
  id: "journalist_handled",
  kind: "objective",
  missionId: "silence_the_journalist",
  objectiveId: "return_to_refuge",
  locationId: "nightclub_district",
  payload: {
    previousOutcome: "drained"
  }
});
```

Equivalent checkpoint writes are ignored. Checkpoints are serialized with campaign state and exposed through:

```js
window.NBD_CAMPAIGN.checkpoint()
```

### Opening mission checkpoints

```text
journalist_mission_start
journalist_tip_acquired
journalist_target_reached
journalist_handled
journalist_report_accepted
```

### Restoration contract

For the current opening mission, a reload may reconstruct:

- safe player layer and position;
- active objective;
- completed tutorial state after the informant boundary;
- drained rooftop blocker;
- departed police informant;
- journalist body and killed/drained outcome for the return objective;
- persistent cash, reputation, flags and mission metadata.

The following transient state is intentionally discarded:

- current attack animation;
- partial drain progress;
- temporary NPC `WTF` timers;
- witness path positions;
- police containment slots and chase paths;
- spotlight phase;
- camera tweens;
- task-reveal animation progress.

This policy avoids brittle serialization of Phaser internals while preserving player-facing mission progress.

## Opening mission rewards and replay

`Silence the Journalist` rewards:

```text
Cash: $500
Blackglass Directorate: +5
Your sire: +1
Flag: journalist_silenced
```

The browser build remains a standalone vertical slice. After a completed campaign record is reloaded, the opening contract may start again for free play. The new record inherits the existing `rewardsGranted` flag.

```text
first completion → rewards granted
later standalone completion → no duplicate wallet or reputation entry
```

## Second authored mission

`Clean the Scene` demonstrates reuse without changes to `MissionRunner`:

1. Reach the club service alley.
2. Recover a compromised camera roll.
3. Remove the exposed body.
4. Reduce wanted level to zero.
5. Return to the refuge.

It has its own checkpoints and rewards:

```text
$275
Blackglass Directorate +2
Cleaner contact +3
```

It currently exists as campaign data and automated coverage. World placement, contact dialogue and selection UI are the next content-integration slice.

## Browser API

The playable build exposes:

```js
window.NBD_CAMPAIGN.snapshot()
window.NBD_CAMPAIGN.checkpoint()
window.NBD_CAMPAIGN.save()
window.NBD_CAMPAIGN.export()
window.NBD_CAMPAIGN.import(serialized)
window.NBD_CAMPAIGN.reset()
```

`import()` and `reset()` persist the result and reload the page so all scene systems attach to the same reconstructed state.

## Automated coverage

Pure tests cover:

- schema defaults and migration;
- checkpoint serialization and sanitization;
- cash and insufficient-funds behavior;
- faction/contact reputation;
- typed event matching;
- authored checkpoint capture;
- killed and drained outcomes;
- reward idempotency through standalone replay;
- direct opening-mission authority;
- checkpoint world reconstruction;
- generic `Clean the Scene` progression.

Chromium tests cover:

- both playable routes;
- absence of `CampaignRuntimeBridge`;
- direct authority boot;
- campaign reward persistence;
- stable objective reload;
- tutorial/blocker/informant restoration;
- checkpoint export;
- existing mission golden paths and post-report free roam.

## Remaining work

- Mission/contact selection after the opening report.
- Playable world entities for `Clean the Scene`.
- Generic bindings for collect, destroy and wanted-level objectives.
- Player-facing save/continue UI.
- Retry-from-checkpoint failure policy.
- Manual normal-timing restoration checks.
