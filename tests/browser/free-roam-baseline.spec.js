import { expect, test } from "@playwright/test";

const STORAGE_KEY = "vampire-district-campaign-v1";

function legacyMissionState() {
  return {
    version: 2,
    revision: 4,
    createdAt: 100,
    updatedAt: 200,
    sequences: { transaction: 0, event: 0, save: 0, checkpoint: 0 },
    player: { cash: 321, currentRefugeId: "rooftop_refuge" },
    missions: {
      activeMissionId: "silence_the_journalist",
      records: {
        silence_the_journalist: {
          id: "silence_the_journalist",
          definitionVersion: 2,
          status: "active",
          objectiveIndex: 0,
          objectives: {
            reach_police_roof: {
              id: "reach_police_roof",
              status: "active",
              progress: 0,
              required: 1,
              completedAt: 0,
              outcome: null
            }
          },
          startedAt: 100,
          updatedAt: 200,
          completedAt: 0,
          failedAt: 0,
          failureReason: "",
          completionCount: 0,
          rewardsGranted: false,
          metadata: {}
        },
        clean_the_scene: {
          id: "clean_the_scene",
          definitionVersion: 2,
          status: "completed",
          objectiveIndex: 4,
          objectives: {},
          startedAt: 100,
          updatedAt: 200,
          completedAt: 200,
          failedAt: 0,
          failureReason: "",
          completionCount: 1,
          rewardsGranted: true,
          metadata: {}
        }
      },
      completed: ["clean_the_scene"],
      failed: []
    },
    checkpoints: { latest: null },
    reputation: {
      factions: { blackglass_directorate: 5, red_assembly: 0 },
      contacts: { your_sire: 1 }
    },
    inventory: {
      carried: { meleeWeaponId: null, sidearmWeaponId: null, longWeaponId: null, ammoByType: {} },
      refuges: {
        rooftop_refuge: {
          weaponIds: [],
          ammoByType: {},
          bloodBags: 0,
          missionItems: [],
          retainerEquipment: []
        }
      }
    },
    world: { ownedVehicles: [], unlockedRefuges: ["rooftop_refuge"], flags: {} },
    ledger: [],
    eventLog: []
  };
}

async function waitForFreeRoam(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_FREE_ROAM_READY
    && window.NBD_CAMPAIGN_SYSTEM
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.missionSystem
  ));
}

test.describe.configure({ timeout: 75_000 });

test("normal boot retires legacy missions and opens persistent street free roam", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, state: legacyMissionState() });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForFreeRoam(page);

  const result = await page.evaluate(storageKey => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const campaign = window.NBD_CAMPAIGN_SYSTEM.snapshot();
    const stored = JSON.parse(localStorage.getItem(storageKey));
    const journalist = scene.npcSystem.npcs.find(npc => npc.id === "journalist");
    const rooftopThug = scene.npcSystem.npcs.find(npc => npc.id === "rooftop_thug");
    const informant = scene.tutorialDirector?.informant;

    return {
      boot: window.NBD_BOOT_PROFILE,
      definitions: campaign.definitions,
      activeMissionId: campaign.state.missions.activeMissionId,
      missionRecords: campaign.state.missions.records,
      completed: campaign.state.missions.completed,
      failed: campaign.state.missions.failed,
      cash: campaign.wallet.balance,
      storedMissions: stored.missions,
      currentLayer: scene.currentLayer,
      player: { x: scene.player.x, y: scene.player.y },
      taskText: scene.missionSystem.activeTaskText(),
      objectiveText: scene.missionSystem.objectiveText(),
      marker: scene.missionSystem.marker(),
      missionBoardSystem: Boolean(scene.missionBoardSystem),
      missionBoardApi: Boolean(window.NBD_MISSION_BOARD),
      campaignEntry: Boolean(document.querySelector(".campaign-entry")),
      tutorialState: scene.tutorialDirector?.state,
      journalistInactive: journalist?.inactive,
      rooftopThugInactive: rooftopThug?.inactive,
      informantInactive: informant?.inactive
    };
  }, STORAGE_KEY);

  expect(result.boot.mode).toBe("normal");
  expect(result.boot.persistentCampaign).toBe(true);
  expect(result.boot.showCampaignEntry).toBe(false);
  expect(result.boot.skipTutorial).toBe(true);
  expect(result.definitions).toEqual([]);
  expect(result.activeMissionId).toBeNull();
  expect(result.missionRecords).toEqual({});
  expect(result.completed).toEqual([]);
  expect(result.failed).toEqual([]);
  expect(result.cash).toBe(321);
  expect(result.storedMissions.activeMissionId).toBeNull();
  expect(result.storedMissions.records).toEqual({});
  expect(result.currentLayer).toBe(0);
  expect(result.player).toEqual({ x: 1540, y: 1515 });
  expect(result.taskText).toContain("No active contract");
  expect(result.objectiveText).toContain("explore the city freely");
  expect(result.marker).toBeNull();
  expect(result.missionBoardSystem).toBe(false);
  expect(result.missionBoardApi).toBe(false);
  expect(result.campaignEntry).toBe(false);
  expect(result.tutorialState).toBe("complete");
  expect(result.journalistInactive).toBe(true);
  expect(result.rooftopThugInactive).toBe(true);
  expect(result.informantInactive).toBe(true);
  expect(pageErrors).toEqual([]);
});
