# Campaign foundation

_Status: Milestone 11 foundation implementation in progress._

## Purpose

The campaign layer turns the current vertical slice into reusable, persistent game structure without coupling missions to Phaser objects or scene-specific branches.

It provides:

- one versioned JSON-only campaign state;
- save, load, import, export and reset services;
- a cash wallet with an auditable transaction ledger;
- separate faction and contact reputation;
- serializable mission definitions;
- a generic mission runner;
- a compatibility bridge for the existing journalist mission;
- a second authored mission proving that the runner does not require mission-specific code.

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
- `phaser/src/campaign/CampaignRuntimeBridge.js`
- `phaser/src/campaign/missions/silenceTheJournalist.js`
- `phaser/src/campaign/missions/cleanTheScene.js`
- `phaser/src/campaign/bootstrap.js`

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
  ledger,
  eventLog
}
```

The stored state contains only JSON values. Phaser containers, functions, DOM nodes, event emitters and circular references are prohibited.

### Migration

Version `0` represents the earlier unschematized prototype shape. Loading it supplies all version-one defaults while retaining recognized money, mission, reputation, inventory and world fields.

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

The current journalist contract pays `$500` on its first campaign completion. Ammunition vendors and safehouse armouries are deliberately deferred to Milestone 15.

## Reputation

Faction and contact reputation are separate collections.

```js
reputation.modifyFaction("blackglass_directorate", 5);
reputation.modifyContact("police_roof_informant", 1);
```

The range is `-100` to `100`, with these presentation tiers:

```text
Hostile
Watched
Distrusted
Neutral
Useful
Favoured
Trusted
```

Unaligned Houses do not share a global standing. Each House, supplier or named operator uses contact reputation unless a future authored House receives its own faction record.

## Mission definitions

Definitions are validated and frozen plain data.

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

Vehicle objective contracts exist before vehicles so Milestone 12 can integrate without modifying the mission runner.

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
```

Events only advance the current objective when:

- event type matches objective type;
- target id matches;
- a neutralization outcome is accepted;
- count/progress reaches the requirement;
- wanted level satisfies the authored threshold.

Rewards are idempotent. Replaying or calling completion twice cannot duplicate cash or reputation.

## Opening mission migration

`silenceTheJournalistMission` is the campaign definition for the existing playable contract:

1. Reach the police roof.
2. Speak to the informant.
3. Reach the nightclub district.
4. Neutralize the journalist through `killed` or `drained`.
5. Return to the rooftop refuge.

Rewards:

```text
Cash: $500
Blackglass Directorate: +5
Your sire: +1
Flag: journalist_silenced
```

`CampaignRuntimeBridge` listens to the current vertical-slice systems and mirrors their public events into the runner. Presentation remains owned by `TutorialDirector`, `TaskRevealSystem` and the existing mission finale during this migration stage.

Important ordering remains unchanged:

```text
journalist handled
→ return objective
→ sire approval dialogue
→ dialogue dismissed
→ REPORT ACCEPTED
→ campaign return event
→ rewards
```

A previously completed stored campaign record does not block replaying the standalone vertical slice, and its rewards are not granted twice.

## Second authored mission

`Clean the Scene` demonstrates reuse without changes to `MissionRunner`:

1. Reach the club service alley.
2. Recover a compromised camera roll.
3. Remove the exposed body.
4. Reduce wanted level to zero.
5. Return to the refuge.

It currently exists as campaign data and automated coverage. World placement, dialogue and selection UI will be added after the journalist migration is fully accepted.

## Browser API

The playable build exposes:

```js
window.NBD_CAMPAIGN.snapshot()
window.NBD_CAMPAIGN.export()
window.NBD_CAMPAIGN.import(serialized)
window.NBD_CAMPAIGN.reset()
```

`import` and `reset` reload the page after writing storage so every system attaches to one consistent state.

## Current limitations

- The current Phaser world does not yet restore player position, NPC state or an in-progress mission scene after reload. Campaign mission progress is serializable, but a complete world-resume checkpoint belongs to the next save/load integration pass.
- The old visible mission panel still renders the vertical-slice mission text while the campaign bridge mirrors it.
- `Clean the Scene` is not yet selectable in the playable UI.
- Cash has no vendor spend path yet.
- Inventory fields are persistence contracts; hard weapon slots and refuge armoury arrive in Milestone 15.
- Vehicle fields are persistence contracts; vehicle ownership begins in Milestone 12.
