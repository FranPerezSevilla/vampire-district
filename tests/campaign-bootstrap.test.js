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

test("campaign bootstrap exposes snapshot, export, reset and import entry points", async () => {
  const content = await source("phaser/src/campaign/bootstrap.js");
  assert.equal(content.includes("new CampaignSystem"), true);
  assert.equal(content.includes("new CampaignRuntimeBridge"), true);
  assert.equal(content.includes("window.NBD_CAMPAIGN"), true);
  for (const action of ["snapshot", "export", "reset", "import"]) {
    assert.equal(content.includes(`${action}:`), true, action);
  }
});
