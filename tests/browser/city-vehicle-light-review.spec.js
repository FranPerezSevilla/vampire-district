import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const OUTPUT_DIR = path.resolve(".artifacts/city-atmosphere-review");

async function waitForCity(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
      && window.NBD_SCENARIO_READY
      && window.NBD_CITY_STREAM_READY
      && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.trafficMaterializationSystem
      && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.motorizedPoliceSystem
  ));
  await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    await window.NBD_CITY_STREAM.waitUntilReady();
    await scene.trafficMaterializationSystem.initialization;
    await scene.motorizedPoliceSystem.initialization;
  });
}

async function captureCanvas(page, name) {
  const canvas = page.locator("#game-root canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(100);
  await canvas.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`) });
}

test.describe.configure({ timeout: 120_000 });

test("captures bounded traffic and police ground-light contribution", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await mkdir(OUTPUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForCity(page);

  const trafficState = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.trafficMaterializationSystem.reconcile?.(true);
    await new Promise(resolve => setTimeout(resolve, 260));
    const slot = scene.trafficMaterializationSystem.pool.find(candidate => candidate.tokenId && candidate.container?.visible);
    if (!slot) return null;
    const center = { x: Number(slot.x) || 0, y: Number(slot.y) || 0 };
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);
    scene.switchLayer(0, { x: center.x, y: center.y + 42 }, "Vehicle-light atmosphere review");
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);
    scene.redrawLayer("Vehicle-light atmosphere review");
    scene.cameras.main.centerOn(center.x, center.y);
    scene.updateVehicleLightPresentation?.(360);
    const descriptors = (scene.cityVehicleLightDescriptors || []).map(item => ({
      sourceId: item.sourceId,
      family: item.family,
      x: item.x,
      y: item.y,
      intensity: item.intensity
    }));
    scene.scene.pause();
    return {
      center,
      tokenId: slot.tokenId,
      descriptors,
      families: [...new Set(descriptors.map(item => item.family))]
    };
  });

  expect(trafficState, "expected at least one materialized traffic vehicle").toBeTruthy();
  expect(trafficState.families).toContain("vehicle-headlight");
  expect(trafficState.families).toContain("vehicle-tail");
  await captureCanvas(page, "vehicle-lights");

  const policeRed = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
    const district = await import("/phaser/src/data/district.js");
    const crossing = district.crosswalks[Math.floor(district.crosswalks.length / 2)] || district.crosswalks[0];
    const center = crossing
      ? { x: Number(crossing.x) + Number(crossing.w) / 2, y: Number(crossing.y) + Number(crossing.h) / 2 }
      : { x: 2340, y: 960 };
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);
    scene.switchLayer(0, { x: center.x, y: center.y + 46 }, "Police-light atmosphere review");
    scene.redrawLayer("Police-light atmosphere review");
    scene.cameras.main.centerOn(center.x, center.y);

    const slot = scene.motorizedPoliceSystem.slots[0];
    slot.unitId = "atmosphere-review-police";
    slot.x = center.x;
    slot.y = center.y;
    slot.angle = 0;
    slot.container.setPosition(center.x, center.y).setRotation(0).setActive(true).setVisible(true);
    scene.updateVehicleLightPresentation?.(0);
    const descriptors = (scene.cityVehicleLightDescriptors || []).map(item => ({
      sourceId: item.sourceId,
      family: item.family,
      intensity: item.intensity
    }));
    scene.scene.pause();
    return {
      center,
      descriptors,
      red: descriptors.find(item => item.family === "police-red") || null,
      blue: descriptors.find(item => item.family === "police-blue") || null
    };
  });

  expect(policeRed.red).toBeTruthy();
  expect(policeRed.blue).toBeTruthy();
  expect(policeRed.red.intensity).toBeGreaterThan(policeRed.blue.intensity);
  await captureCanvas(page, "police-lights-red");

  const policeBlue = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
    scene.updateVehicleLightPresentation?.(180);
    const descriptors = (scene.cityVehicleLightDescriptors || []).map(item => ({
      sourceId: item.sourceId,
      family: item.family,
      intensity: item.intensity
    }));
    scene.scene.pause();
    return {
      red: descriptors.find(item => item.family === "police-red") || null,
      blue: descriptors.find(item => item.family === "police-blue") || null
    };
  });

  expect(policeBlue.red).toBeTruthy();
  expect(policeBlue.blue).toBeTruthy();
  expect(policeBlue.blue.intensity).toBeGreaterThan(policeBlue.red.intensity);
  await captureCanvas(page, "police-lights-blue");

  await writeFile(path.join(OUTPUT_DIR, "vehicle-light-manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    initiative: "city-noir-atmosphere",
    milestone: "M3.5",
    purpose: "gameplay-scale evidence for culled vehicle head/tail lights and localized alternating police emergency contribution",
    traffic: trafficState,
    policeRed,
    policeBlue,
    captures: ["vehicle-lights.png", "police-lights-red.png", "police-lights-blue.png"]
  }, null, 2)}\n`, "utf8");

  expect(pageErrors).toEqual([]);
});
