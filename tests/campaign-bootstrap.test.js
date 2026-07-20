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
  assert.ok(localIndex >= 0, "the npm-pinned Phaser build must be addressable from both playable routes");
  assert.ok(jsdelivrIndex > localIndex, "CDNs must remain fallbacks after the pinned local runtime");
  assert.equal(content.includes('src: "./vendor/phaser-3.90.0.min.js"'), false);
  assert.equal(content.includes('window.NBD_PHASER_SOURCE = kind === "local-node-modules" ? "local" : kind'), true);
  assert.equal(content.includes("window.NBD_PHASER_SOURCE_DETAIL = detail"), true);
});

test("app bootstrap enables deterministic RC timing before scene composition", async () => {
  const content = await source("phaser/src/app-bootstrap.js");
  const modeIndex = content.indexOf('window.NBD_RC_TEST_MODE = BOOT_QUERY.has("rcTest")');
  const mainIndex = content.indexOf('import("./main.js")');
  assert.ok(modeIndex >= 0, "RC mode must be derived from the URL");
  assert.ok(mainIndex > modeIndex, "RC timing must exist before gameplay systems are constructed");
  assert.equal(content.includes('if (window.NBD_RC_TEST_MODE) await import("./testing/bootstrap.js")'), true);
});

test("app bootstrap preloads campaign authority before scenes and attaches entry after tutorial", async () => {
  const content = await source("phaser/src/app-bootstrap.js");
  const preloadIndex = content.indexOf('import("./campaign/preload.js")');
  const mainIndex = content.indexOf('import("./main.js")');
  const campaignIndex = content.indexOf('import("./campaign/bootstrap.js")');
  const tutorialIndex = content.indexOf('import("./tutorial/bootstrap.js")');
  const entryIndex = content.indexOf('import("./campaign/entry-bootstrap.js")');
  assert.ok(preloadIndex >= 0, "campaign preload is required");
  assert.ok(mainIndex > preloadIndex, "campaign state must exist before GameScene creates MissionSystem");
  assert.ok(campaignIndex > mainIndex, "checkpoint runtime attaches after core systems");
  assert.ok(tutorialIndex > campaignIndex, "checkpoint restoration must happen before tutorial attachment");
  assert.ok(entryIndex > tutorialIndex, "campaign entry must attach after tutorial restoration");
  assert.equal(content.includes("campaign: true"), true);
});

test("campaign preload classifies the entry state before scene composition", async () => {
  const content = await source("phaser/src/campaign/preload.js");
  assert.equal(content.includes("createCampaignEntry"), true);
  assert.equal(content.includes("CAMPAIGN_ENTRY_SESSION_KEY"), true);
  assert.equal(content.includes("preserveNativeIntro: true"), true);
  assert.equal(content.includes("globalThis.NBD_CAMPAIGN_ENTRY = campaignEntry"), true);
});

test("campaign bootstrap attaches checkpoints without the removed mirroring bridge", async () => {
  const content = await source("phaser/src/campaign/bootstrap.js");
  assert.equal(content.includes("CampaignCheckpointSystem"), true);
  assert.equal(content.includes("CampaignRuntimeBridge"), false);
  assert.equal(content.includes("POST_UPDATE"), true);
  assert.equal(content.includes("installCampaignBrowserApi"), true);
  assert.equal(content.includes("deferCheckpointRestore"), true);
  assert.equal(content.includes("campaign.state.checkpoints.latest = null"), true);
  assert.equal(content.includes("campaignEntry"), true);
});

test("campaign entry bootstrap waits for checkpoint and tutorial ownership", async () => {
  const content = await source("phaser/src/campaign/entry-bootstrap.js");
  assert.equal(content.includes("campaignCheckpointSystem"), true);
  assert.equal(content.includes("tutorialDirector"), true);
  assert.equal(content.includes("CampaignEntrySystem"), true);
  assert.equal(content.includes("NBD_CAMPAIGN_ENTRY_READY = true"), true);
});

test("campaign entry presentation owns actions, focus and the only accessible modal", async () => {
  const content = await source("phaser/src/campaign/CampaignEntrySystem.js");
  for (const action of ["CONTINUE", "NEW_GAME", "RETRY_CHECKPOINT", "RETRY_MISSION"]) {
    assert.equal(content.includes(`CAMPAIGN_ENTRY_ACTIONS.${action}`), true, action);
  }
  assert.equal(content.includes("data-campaign-entry-action"), true);
  assert.equal(content.includes("button.dataset.campaignEntryAction"), true);
  assert.equal(content.includes("window.location.reload()"), true);
  assert.equal(content.includes("resultDismissed = this.entry.mode === CAMPAIGN_ENTRY_MODES.FREE_ROAM"), true);
  assert.equal(content.includes('event.code === "Tab"'), true);
  assert.equal(content.includes("if (!entry.preserveNativeIntro) this.dismissNativeModal()"), true);
  assert.equal(content.includes('modal.setAttribute("aria-hidden", "true")'), true);
  assert.equal(content.includes("modal.inert = true"), true);
  assert.equal(content.includes("restoreUnderlyingModal"), true);
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