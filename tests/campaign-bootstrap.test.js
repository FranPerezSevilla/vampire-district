import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("app bootstrap loads pinned Phaser relative to its module before CDN fallback", async () => {
  const content = await source("phaser/src/app-bootstrap.js");
  const localIndex = content.indexOf('new URL("../../node_modules/phaser/dist/phaser.min.js", import.meta.url).href');
  const jsdelivrIndex = content.indexOf('kind: "jsdelivr"');
  assert.ok(localIndex >= 0);
  assert.ok(jsdelivrIndex > localIndex);
  assert.equal(content.includes('window.NBD_PHASER_SOURCE = kind === "local-node-modules" ? "local" : kind'), true);
  assert.equal(content.includes("window.NBD_PHASER_SOURCE_DETAIL = detail"), true);
});

test("boot profile exists before campaign and scene composition", async () => {
  const content = await source("phaser/src/app-bootstrap.js");
  const profileIndex = content.indexOf('from "./boot/BootProfile.js"');
  const preloadIndex = content.indexOf('import("./campaign/preload.js")');
  const mainIndex = content.indexOf('import("./main.js")');
  assert.ok(profileIndex >= 0);
  assert.ok(preloadIndex > profileIndex);
  assert.ok(mainIndex > preloadIndex);
  assert.equal(content.includes("window.NBD_RC_TEST_MODE = bootProfile.enableHarness"), true);
  assert.equal(content.includes("BOOT_MODES.SCENARIO"), true);
});

test("production bootstrap attaches campaign and free roam without entry or mission board", async () => {
  const content = await source("phaser/src/app-bootstrap.js");
  const campaignIndex = content.indexOf('import("./campaign/bootstrap.js")');
  const tutorialIndex = content.indexOf('import("./tutorial/bootstrap.js")');
  const maintenanceIndex = content.indexOf('import("./vehicles/maintenance-bootstrap.js")');
  const harnessIndex = content.indexOf('import("./testing/bootstrap.js")');
  const scenarioIndex = content.indexOf('import("./testing/scenario-bootstrap.js")');
  assert.ok(campaignIndex >= 0);
  assert.ok(tutorialIndex > campaignIndex);
  assert.ok(maintenanceIndex > tutorialIndex);
  assert.ok(harnessIndex > maintenanceIndex);
  assert.ok(scenarioIndex > harnessIndex);
  assert.equal(content.includes('import("./campaign/entry-bootstrap.js")'), false);
  assert.equal(content.includes('import("./campaign/board-bootstrap.js")'), false);
  assert.equal(content.includes("registeredMissions: 0"), true);
  assert.equal(content.includes("campaign: true"), true);
});

test("campaign preload isolates explore and scenario storage", async () => {
  const content = await source("phaser/src/campaign/preload.js");
  assert.equal(content.includes("memoryStorage"), true);
  assert.equal(content.includes("bootProfile.persistentCampaign"), true);
  assert.equal(content.includes("blocksAutomaticOpeningStart: true"), true);
  assert.equal(content.includes("globalThis.NBD_CAMPAIGN_ENTRY = campaignEntry"), true);
  assert.equal(content.includes("SILENCE_THE_JOURNALIST_ID"), false);
});

test("campaign bootstrap attaches checkpoints without the removed mirroring bridge", async () => {
  const content = await source("phaser/src/campaign/bootstrap.js");
  assert.equal(content.includes("CampaignCheckpointSystem"), true);
  assert.equal(content.includes("CampaignRuntimeBridge"), false);
  assert.equal(content.includes("POST_UPDATE"), true);
  assert.equal(content.includes("installCampaignBrowserApi"), true);
  assert.equal(content.includes("deferCheckpointRestore"), true);
});

test("campaign entry bootstrap remains available for future registered content", async () => {
  const content = await source("phaser/src/campaign/entry-bootstrap.js");
  assert.equal(content.includes("campaignCheckpointSystem"), true);
  assert.equal(content.includes("tutorialDirector"), true);
  assert.equal(content.includes("CampaignEntrySystem"), true);
  assert.equal(content.includes("NBD_CAMPAIGN_ENTRY_READY = true"), true);
});

test("mission board bootstrap remains available but is no longer production-booted", async () => {
  const content = await source("phaser/src/campaign/board-bootstrap.js");
  assert.equal(content.includes("campaignEntrySystem"), true);
  assert.equal(content.includes("campaignCheckpointSystem"), true);
  assert.equal(content.includes("MissionBoardSystem"), true);
  assert.equal(content.includes("window.NBD_MISSION_BOARD"), true);
});

test("campaign entry presentation retains accessible generic and exploration facades", async () => {
  const facade = await source("phaser/src/campaign/CampaignEntrySystem.js");
  const core = await source("phaser/src/campaign/CampaignEntrySystemCore.js");
  assert.equal(facade.includes("CampaignEntrySystemCore"), true);
  assert.equal(facade.includes("CAMPAIGN_ENTRY_ACTIONS.EXPLORE"), true);
  assert.equal(facade.includes('url.searchParams.set("mode", "explore")'), true);
  assert.equal(facade.includes("this.campaign.definitions?.[0]?.id"), true);
  for (const action of ["CONTINUE", "RETRY_CHECKPOINT", "RETRY_MISSION"]) {
    assert.equal(core.includes(`CAMPAIGN_ENTRY_ACTIONS.${action}`), true, action);
  }
  assert.equal(core.includes("data-campaign-entry-action"), true);
  assert.equal(core.includes("window.location.reload()"), true);
  assert.equal(core.includes('event.code === "Tab"'), true);
  assert.equal(core.includes("modal.inert = true"), true);
});

test("tutorial bootstrap completes immediately for all missionless free-roam profiles", async () => {
  const content = await source("phaser/src/tutorial/bootstrap.js");
  assert.equal(content.includes("bootProfile.skipTutorial"), true);
  assert.equal(content.includes("moveToFreeRoamSpawn"), true);
  assert.equal(content.includes("NBD_EXPLORE_READY"), true);
  assert.equal(content.includes("NBD_FREE_ROAM_READY"), true);
});

test("scenario bootstrap exposes deterministic loop preparation", async () => {
  const bootstrap = await source("phaser/src/testing/scenario-bootstrap.js");
  const registry = await source("phaser/src/testing/ScenarioRegistry.js");
  assert.equal(bootstrap.includes("NBD_SCENARIO_READY"), true);
  assert.equal(bootstrap.includes("NBD_SCENARIOS"), true);
  for (const id of ["vehicle-core", "street-damage", "police-escalation", "input-locks", "urban-explore"]) {
    assert.equal(registry.includes(`"${id}"`), true, id);
  }
  assert.equal(registry.includes("activeMissionId"), true);
});

test("keyboard accessibility owns focused modal actions without duplicate clicks", async () => {
  const content = await source("phaser/src/ui/AccessibilityKeyboardBridge.js");
  assert.equal(content.includes("#ui-modal-action"), true);
  assert.equal(content.includes("activateModalAction"), true);
  assert.equal(content.includes("event.stopImmediatePropagation()"), true);
});

test("campaign browser API exposes persistence and checkpoint entry points", async () => {
  const content = await source("phaser/src/campaign/CampaignBrowserApi.js");
  for (const action of ["snapshot", "export", "checkpoint", "startMission", "save", "reloadCheckpoint", "discardCheckpoint", "reset", "import", "safety"]) {
    assert.equal(content.includes(`${action}:`), true, action);
  }
  assert.equal(content.includes("window.NBD_CAMPAIGN_READY = true"), true);
});
