import test from "node:test";
import assert from "node:assert/strict";

import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { createMissionBoardModel } from "../phaser/src/campaign/MissionBoard.js";
import {
  CLEAN_THE_SCENE_ID,
  cleanTheSceneMission
} from "../phaser/src/campaign/missions/cleanTheScene.js";
import {
  SILENCE_THE_JOURNALIST_ID,
  silenceTheJournalistMission
} from "../phaser/src/campaign/missions/silenceTheJournalist.js";

function campaign({ authored = true } = {}) {
  return new CampaignSystem({
    definitions: authored ? [silenceTheJournalistMission, cleanTheSceneMission] : [],
    autoLoad: false,
    autoSave: false,
    now: () => 1_000
  });
}

test("the production campaign exposes no mission-board contracts", () => {
  const system = campaign({ authored: false });
  const board = createMissionBoardModel(system.snapshot());
  assert.equal(board.cards.length, 0);
  assert.equal(board.activeMissionId, null);
});

test("an explicitly supplied board unlocks Clean the Scene after its opening prerequisite", () => {
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

test("an active or failed explicitly supplied contract blocks a second board mission", () => {
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

test("a replayable explicit contract returns to the board with a run-again action", () => {
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
