import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  CAMPAIGN_ENTRY_ACTIONS,
  CAMPAIGN_ENTRY_MODES,
  createCampaignEntry
} from "../phaser/src/campaign/CampaignEntry.js";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { CHECKPOINT_KINDS } from "../phaser/src/campaign/constants.js";
import { SILENCE_THE_JOURNALIST_ID } from "../phaser/src/campaign/missions/silenceTheJournalist.js";

function campaign() {
  return new CampaignSystem({
    autoLoad: false,
    autoSave: false,
    now: () => 1_000
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeCheckpoint(system, objectiveId = "reach_police_roof") {
  return {
    version: 1,
    id: "cp-000001",
    missionId: SILENCE_THE_JOURNALIST_ID,
    objectiveId,
    kind: CHECKPOINT_KINDS.OBJECTIVE,
    createdAt: 1_000,
    resumable: true,
    mission: clone(system.state.missions.records[SILENCE_THE_JOURNALIST_ID]),
    player: { x: 128, y: 96, layer: 1, hunger: 24 },
    loadout: {
      selectedWeaponId: "unarmed",
      inventory: ["unarmed"],
      ammo: {}
    },
    world: {
      exposure: 0,
      brokenLights: [],
      npcs: {},
      bloodStains: [],
      feedingStats: {},
      evidenceStats: {}
    },
    tutorial: {
      completed: false,
      state: "waiting",
      finalAdviceShown: false,
      informantGone: false
    },
    metadata: {}
  };
}

afterEach(() => {
  delete globalThis.NBD_CAMPAIGN_ENTRY;
});

test("a fresh campaign requires an explicit new-game decision", () => {
  const system = campaign();
  const entry = createCampaignEntry(system.snapshot());

  assert.equal(entry.mode, CAMPAIGN_ENTRY_MODES.NEW_GAME);
  assert.equal(entry.primary.action, CAMPAIGN_ENTRY_ACTIONS.NEW_GAME);
  assert.equal(entry.blocksAutomaticOpeningStart, true);
  assert.equal(entry.deferCheckpointRestore, false);
  assert.equal(entry.show, true);
});

test("an active campaign offers Continue and may consume one automatic entry", () => {
  const system = campaign();
  system.startMission(SILENCE_THE_JOURNALIST_ID, {
    metadata: { integration: "campaign_entry" }
  });

  const normal = createCampaignEntry(system.snapshot());
  const automatic = createCampaignEntry(system.snapshot(), { autoEnter: true });

  assert.equal(normal.mode, CAMPAIGN_ENTRY_MODES.CONTINUE);
  assert.equal(normal.primary.action, CAMPAIGN_ENTRY_ACTIONS.CONTINUE);
  assert.equal(normal.blocksAutomaticOpeningStart, false);
  assert.equal(normal.show, true);
  assert.equal(automatic.mode, CAMPAIGN_ENTRY_MODES.CONTINUE);
  assert.equal(automatic.autoEnter, true);
  assert.equal(automatic.show, false);
});

test("a failed run preserves a safe checkpoint as an explicit retry choice", () => {
  const system = campaign();
  system.startMission(SILENCE_THE_JOURNALIST_ID, {
    metadata: { integration: "campaign_entry" }
  });
  system.setCheckpoint(safeCheckpoint(system), { emit: false });
  system.failActiveMission("The district closed around you.");

  const entry = createCampaignEntry(system.snapshot());

  assert.equal(entry.mode, CAMPAIGN_ENTRY_MODES.RETRY_CHECKPOINT);
  assert.equal(entry.primary.action, CAMPAIGN_ENTRY_ACTIONS.RETRY_CHECKPOINT);
  assert.equal(entry.deferCheckpointRestore, true);
  assert.equal(entry.checkpointId, "cp-000001");
  assert.equal(entry.missionId, SILENCE_THE_JOURNALIST_ID);
});

test("a failed run without a checkpoint restarts the mission", () => {
  const system = campaign();
  system.startMission(SILENCE_THE_JOURNALIST_ID, {
    metadata: { integration: "campaign_entry" }
  });
  system.failActiveMission("No safe route remained.");

  const entry = createCampaignEntry(system.snapshot());

  assert.equal(entry.mode, CAMPAIGN_ENTRY_MODES.RETRY_MISSION);
  assert.equal(entry.primary.action, CAMPAIGN_ENTRY_ACTIONS.RETRY_MISSION);
  assert.equal(entry.deferCheckpointRestore, false);
});

test("a completed opening contract enters free roam without replaying rewards", () => {
  const system = campaign();
  system.startMission(SILENCE_THE_JOURNALIST_ID, {
    metadata: { integration: "campaign_entry" }
  });
  system.missions.completeMission();

  const entry = createCampaignEntry(system.snapshot());

  assert.equal(entry.mode, CAMPAIGN_ENTRY_MODES.FREE_ROAM);
  assert.equal(entry.primary.action, CAMPAIGN_ENTRY_ACTIONS.CONTINUE);
  assert.equal(entry.blocksAutomaticOpeningStart, true);
  assert.equal(system.wallet.balance(), 500);
});

test("MissionSystem's automatic opening start waits for the entry decision", () => {
  const system = campaign();
  globalThis.NBD_CAMPAIGN_ENTRY = createCampaignEntry(system.snapshot());

  const deferred = system.startMission(SILENCE_THE_JOURNALIST_ID, {
    metadata: { integration: "direct_mission_authority" }
  });

  assert.equal(deferred, null);
  assert.equal(system.state.missions.activeMissionId, null);

  const started = system.startMission(SILENCE_THE_JOURNALIST_ID, {
    metadata: { integration: "campaign_entry" }
  });
  assert.equal(started.id, SILENCE_THE_JOURNALIST_ID);
  assert.equal(system.state.missions.activeMissionId, SILENCE_THE_JOURNALIST_ID);
});
