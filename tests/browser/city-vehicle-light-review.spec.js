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

  // Use real preallocated runtime slots but keep them inside the already-current
  // camera worldView. Phaser refreshes worldView during camera pre-render; moving
  // the camera and sampling it synchronously made the earlier review fixture look
  // offscreen to the culling policy even though the screenshot would later show it.
  const trafficState = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const camera = scene.cameras.main;
    const view = camera.worldView;
    const center = {
      x: Number(view.x) + Number(view.width) * 0.5,
      y: Number(view.y) + Number(view.height) * 0.5
    };
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
    scene.scene.pause();
    return {
      center,
      tokenId: slot.tokenId,
      descriptors,
      families: [...new Set(descriptors.map(item => item.family))]
    };
  });

  expect(trafficState, "expected the real traffic presentation pool to exist").toBeTruthy();
  expect(trafficState.families).toContain("vehicle-headlight");
  expect(trafficState.families).toContain("vehicle-tail");
  await captureCanvas(page, "vehicle-lights");

  const policeRed = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
    const view = scene.cameras.main.worldView;
    const center = {
      x: Number(view.x) + Number(view.width) * 0.5,
      y: Number(view.y) + Number(view.height) * 0.5
    };

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
