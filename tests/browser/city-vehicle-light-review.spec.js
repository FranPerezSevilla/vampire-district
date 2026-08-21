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

function wetSnapshot(scene) {
  return (scene.cityWetDynamicReflectionDescriptors || []).map(item => ({
    sourceId: item.sourceId,
    sourceFamily: item.sourceFamily,
    receiverRoadId: item.receiverRoadId,
    receiverDistance: item.receiverDistance,
    fragments: (item.fragments || []).map(fragment => ({
      x: fragment.x,
      y: fragment.y,
      alpha: fragment.alpha
    }))
  }));
}

test.describe.configure({ timeout: 120_000 });

test("captures bounded traffic/police light and wet-road contribution", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await mkdir(OUTPUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForCity(page);

  const trafficState = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const view = scene.cameras.main.worldView;
    const center = { x: Number(view.x) + Number(view.width) * 0.5, y: Number(view.y) + Number(view.height) * 0.5 };
    const slot = scene.trafficMaterializationSystem.pool[0];
    if (!slot) return null;
    slot.tokenId = "atmosphere-review-traffic";
    slot.edgeId = "atmosphere-review";
    slot.tokenIndex = 0;
    slot.direction = "forward";
    slot.x = center.x + 34;
    slot.y = center.y;
    slot.angle = 0;
    slot.speedFactor = 1;
    slot.desiredSpeedFactor = 1;
    slot.container.setPosition(slot.x, slot.y).setRotation(0).setActive(true).setVisible(true);
    scene.updateVehicleLightPresentation?.(360);
    const descriptors = (scene.cityVehicleLightDescriptors || []).map(item => ({
      sourceId: item.sourceId,
      family: item.family,
      x: item.x,
      y: item.y,
      intensity: item.intensity
    }));
    const wet = (scene.cityWetDynamicReflectionDescriptors || []).map(item => ({
      sourceId: item.sourceId,
      sourceFamily: item.sourceFamily,
      receiverRoadId: item.receiverRoadId,
      receiverDistance: item.receiverDistance,
      fragments: (item.fragments || []).map(fragment => ({ x: fragment.x, y: fragment.y, alpha: fragment.alpha }))
    }));
    scene.scene.pause();
    return {
      center,
      tokenId: slot.tokenId,
      descriptors,
      wet,
      families: [...new Set(descriptors.map(item => item.family))],
      wetFamilies: [...new Set(wet.map(item => item.sourceFamily))]
    };
  });

  expect(trafficState, "expected the real traffic presentation pool to exist").toBeTruthy();
  expect(trafficState.families).toContain("vehicle-headlight");
  expect(trafficState.families).toContain("vehicle-tail");
  expect(trafficState.wetFamilies).toContain("vehicle-headlight");
  expect(trafficState.wetFamilies).toContain("vehicle-tail");
  expect(trafficState.wet.every(item => item.receiverRoadId && item.fragments.length > 0)).toBe(true);
  await captureCanvas(page, "vehicle-lights");
  await captureCanvas(page, "wet-vehicle");

  const policeRed = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
    const view = scene.cameras.main.worldView;
    const center = { x: Number(view.x) + Number(view.width) * 0.5, y: Number(view.y) + Number(view.height) * 0.5 };
    const trafficSlot = scene.trafficMaterializationSystem.pool[0];
    if (trafficSlot) {
      trafficSlot.tokenId = null;
      trafficSlot.container.setActive(false).setVisible(false);
    }
    const slot = scene.motorizedPoliceSystem.slots[0];
    slot.unitId = "atmosphere-review-police";
    slot.x = center.x + 34;
    slot.y = center.y;
    slot.angle = 0;
    slot.container.setPosition(slot.x, slot.y).setRotation(0).setActive(true).setVisible(true);
    scene.updateVehicleLightPresentation?.(0);
    const descriptors = (scene.cityVehicleLightDescriptors || []).map(item => ({ sourceId: item.sourceId, family: item.family, intensity: item.intensity }));
    const wet = (scene.cityWetDynamicReflectionDescriptors || []).map(item => ({
      sourceId: item.sourceId,
      sourceFamily: item.sourceFamily,
      receiverRoadId: item.receiverRoadId,
      averageAlpha: item.fragments.reduce((sum, fragment) => sum + fragment.alpha, 0) / Math.max(1, item.fragments.length)
    }));
    scene.scene.pause();
    return {
      center,
      descriptors,
      wet,
      red: descriptors.find(item => item.family === "police-red") || null,
      blue: descriptors.find(item => item.family === "police-blue") || null,
      wetRed: wet.find(item => item.sourceFamily === "police-red") || null,
      wetBlue: wet.find(item => item.sourceFamily === "police-blue") || null
    };
  });

  expect(policeRed.red).toBeTruthy();
  expect(policeRed.blue).toBeTruthy();
  expect(policeRed.red.intensity).toBeGreaterThan(policeRed.blue.intensity);
  expect(policeRed.wetRed).toBeTruthy();
  expect(policeRed.wetBlue).toBeTruthy();
  expect(policeRed.wetRed.averageAlpha).toBeGreaterThan(policeRed.wetBlue.averageAlpha);
  await captureCanvas(page, "police-lights-red");
  await captureCanvas(page, "wet-police-red");

  const policeBlue = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
    scene.updateVehicleLightPresentation?.(180);
    const descriptors = (scene.cityVehicleLightDescriptors || []).map(item => ({ sourceId: item.sourceId, family: item.family, intensity: item.intensity }));
    const wet = (scene.cityWetDynamicReflectionDescriptors || []).map(item => ({
      sourceId: item.sourceId,
      sourceFamily: item.sourceFamily,
      receiverRoadId: item.receiverRoadId,
      averageAlpha: item.fragments.reduce((sum, fragment) => sum + fragment.alpha, 0) / Math.max(1, item.fragments.length)
    }));
    scene.scene.pause();
    return {
      red: descriptors.find(item => item.family === "police-red") || null,
      blue: descriptors.find(item => item.family === "police-blue") || null,
      wetRed: wet.find(item => item.sourceFamily === "police-red") || null,
      wetBlue: wet.find(item => item.sourceFamily === "police-blue") || null
    };
  });

  expect(policeBlue.red).toBeTruthy();
  expect(policeBlue.blue).toBeTruthy();
  expect(policeBlue.blue.intensity).toBeGreaterThan(policeBlue.red.intensity);
  expect(policeBlue.wetBlue.averageAlpha).toBeGreaterThan(policeBlue.wetRed.averageAlpha);
  await captureCanvas(page, "police-lights-blue");
  await captureCanvas(page, "wet-police-blue");

  await writeFile(path.join(OUTPUT_DIR, "vehicle-light-manifest.json"), `${JSON.stringify({
    schemaVersion: 2,
    initiative: "city-noir-atmosphere",
    milestones: ["M3.5", "M4.4"],
    purpose: "gameplay-scale evidence for vehicle emitters plus road-bound wet receiving response, including alternating police emergency reflections",
    traffic: trafficState,
    policeRed,
    policeBlue,
    captures: [
      "vehicle-lights.png",
      "wet-vehicle.png",
      "police-lights-red.png",
      "wet-police-red.png",
      "police-lights-blue.png",
      "wet-police-blue.png"
    ]
  }, null, 2)}\n`, "utf8");

  expect(pageErrors).toEqual([]);
});
