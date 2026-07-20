import test from "node:test";
import assert from "node:assert/strict";

import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { createMissionBoardModel } from "../phaser/src/campaign/MissionBoard.js";
import { CLEAN_THE_SCENE_ID } from "../phaser/src/campaign/missions/cleanTheScene.js";
import { SILENCE_THE_JOURNALIST_ID } from "../phaser/src/campaign/missions/silenceTheJournalist.js";

function campaign() {
  return new CampaignSystem({
    autoLoad: false,
    autoSave: false,
    now: () => 1_000
  });
}

test("the refuge board unlocks after the opening contract and exposes Clean the Scene", () => {
  const system = campaign();
  system.startMission(SILENCE_THE_JOURNALIST_ID, { metadata: { integration: "test" } });
  system.missions.completeMission();

  const board = createMissionBoardModel(system.snapshot());
  assert.equal(board.available, true);
  assert.equal(board.activeMissionId, null);
  assert.equal(board.cards.length, 1);
  assert.deepEqual(board.cards[0], {
    id: CLEAN_THE_SCENE_ID,
    title: "Clean the Scene",
    description: "Recover compromised evidence, remove an exposed body, lose the police search and report back to the refuge.",
    contactId: "directorate_cleaner",
    contactLabel: "Directorate cleaner",
    replayable: true,
    status: "inactive",
    completionCount: 0,
    available: true,
    actionLabel: "Accept contract",
    rewards: {
      cash: 275,
      reputation: { blackglass_directorate: 2 },
      contacts: { directorate_cleaner: 3 },
      flags: { cleaner_contact_unlocked: true },
      items: []
    }
  });
});

test("an active or failed contract keeps the board from starting a second mission", () => {
  const system = campaign();
  system.startMission(SILENCE_THE_JOURNALIST_ID, { metadata: { integration: "test" } });
  system.missions.completeMission();
  system.startMission(CLEAN_THE_SCENE_ID, { metadata: { integration: "refuge_mission_board" } });

  assert.equal(createMissionBoardModel(system.snapshot()).available, false);
  system.failActiveMission("The patrol secured the evidence.");
  const failed = createMissionBoardModel(system.snapshot());
  assert.equal(failed.available, false);
  assert.equal(failed.unresolvedFailure, true);
});

test("a replayable completed contract returns to the board with a run-again action", () => {
  const system = campaign();
  system.startMission(SILENCE_THE_JOURNALIST_ID, { metadata: { integration: "test" } });
  system.missions.completeMission();
  system.startMission(CLEAN_THE_SCENE_ID, { metadata: { integration: "refuge_mission_board" } });
  system.missions.completeMission();

  const board = createMissionBoardModel(system.snapshot());
  assert.equal(board.available, true);
  assert.equal(board.cards[0].completionCount, 1);
  assert.equal(board.cards[0].actionLabel, "Run contract again");
  assert.equal(board.cards[0].available, true);
  assert.equal(system.wallet.balance(), 775);
});
