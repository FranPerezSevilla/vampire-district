import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("app bootstrap loads campaign foundation after the core runtime", async () => {
  const content = await source("phaser/src/app-bootstrap.js");
  const mainIndex = content.indexOf('import("./main.js")');
  const campaignIndex = content.indexOf('import("./campaign/bootstrap.js")');
  assert.ok(mainIndex >= 0, "main runtime import is required");
  assert.ok(campaignIndex > mainIndex, "campaign bootstrap must load after the game runtime");
  assert.equal(content.includes("campaign: true"), true);
});

test("campaign bootstrap attaches direct authority and checkpoint APIs", async () => {
  const content = await source("phaser/src/campaign/bootstrap.js");
  assert.equal(content.includes("new CampaignSystem"), true);
  assert.equal(content.includes("new CampaignMissionAuthority"), true);
  assert.equal(content.includes("CampaignRuntimeBridge"), false);
  assert.equal(content.includes("window.NBD_CAMPAIGN"), true);
  for (const action of ["snapshot", "checkpoint", "export", "save", "reset", "import"]) {
    assert.equal(content.includes(`${action}:`), true, action);
  }
});
