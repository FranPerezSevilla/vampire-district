import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("app bootstrap preloads campaign authority before scenes and restores before tutorial", async () => {
  const content = await source("phaser/src/app-bootstrap.js");
  const preloadIndex = content.indexOf('import("./campaign/preload.js")');
  const mainIndex = content.indexOf('import("./main.js")');
  const campaignIndex = content.indexOf('import("./campaign/bootstrap.js")');
  const tutorialIndex = content.indexOf('import("./tutorial/bootstrap.js")');
  assert.ok(preloadIndex >= 0, "campaign preload is required");
  assert.ok(mainIndex > preloadIndex, "campaign state must exist before GameScene creates MissionSystem");
  assert.ok(campaignIndex > mainIndex, "checkpoint runtime attaches after core systems");
  assert.ok(tutorialIndex > campaignIndex, "checkpoint restoration must happen before tutorial attachment");
  assert.equal(content.includes("campaign: true"), true);
});

test("campaign bootstrap attaches checkpoints without the removed mirroring bridge", async () => {
  const content = await source("phaser/src/campaign/bootstrap.js");
  assert.equal(content.includes("CampaignCheckpointSystem"), true);
  assert.equal(content.includes("CampaignRuntimeBridge"), false);
  assert.equal(content.includes("POST_UPDATE"), true);
  assert.equal(content.includes("installCampaignBrowserApi"), true);
});

test("campaign browser API exposes persistence and checkpoint entry points", async () => {
  const content = await source("phaser/src/campaign/CampaignBrowserApi.js");
  for (const action of [
    "snapshot",
    "export",
    "checkpoint",
    "startMission",
    "save",
    "reloadCheckpoint",
    "discardCheckpoint",
    "reset",
    "import",
    "safety"
  ]) assert.equal(content.includes(`${action}:`), true, action);
  assert.equal(content.includes("window.NBD_CAMPAIGN_READY = true"), true);
});
