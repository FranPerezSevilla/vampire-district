import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const OUTPUT_DIR = path.resolve(".artifacts/city-atmosphere-review");

async function waitForCity(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
      && window.NBD_SCENARIO_READY
      && window.NBD_CITY_STREAM_READY
      && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.vehicleSystem
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

test.describe.configure({ timeout: 180_000 });

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

test("captures M6 vehicle contact grounding across traffic, large, police-wet and dark contexts", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await mkdir(OUTPUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForCity(page);

  const shadowInfo = shadow => shadow ? {
    name: shadow.name || null,
    type: shadow.type || shadow.constructor?.name || null,
    alpha: Number(shadow.alpha),
    width: Number(shadow.width || shadow.displayWidth || 0),
    height: Number(shadow.height || shadow.displayHeight || 0),
    x: Number(shadow.x),
    y: Number(shadow.y)
  } : null;

  const traffic = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const view = scene.cameras.main.worldView;
    const center = { x: Number(view.x) + Number(view.width) * 0.5, y: Number(view.y) + Number(view.height) * 0.5 };
    const slot = scene.trafficMaterializationSystem.pool[0];
    if (!slot) return null;
    slot.tokenId = "m6-grounding-traffic";
    slot.x = center.x + 34;
    slot.y = center.y;
    slot.angle = 0;
    slot.speedFactor = 1;
    slot.desiredSpeedFactor = 1;
    slot.container.setPosition(slot.x, slot.y).setRotation(0).setActive(true).setVisible(true);
    scene.updateVehicleLightPresentation?.(360);
    scene.scene.pause();
    const shadow = slot.visual?.shadow;
    return {
      id: slot.id,
      archetypeId: slot.archetypeId,
      width: slot.archetype?.width,
      height: slot.archetype?.height,
      shadow: shadow ? {
        name: shadow.name || null,
        type: shadow.type || shadow.constructor?.name || null,
        alpha: Number(shadow.alpha),
        width: Number(shadow.width || shadow.displayWidth || 0),
        height: Number(shadow.height || shadow.displayHeight || 0),
        x: Number(shadow.x),
        y: Number(shadow.y)
      } : null
    };
  });

  expect(traffic?.shadow?.name).toBe("vehicle-contact-shadow");
  expect(traffic.shadow.alpha).toBeGreaterThan(0.1);
  expect(traffic.shadow.alpha).toBeLessThanOrEqual(0.2);
  await captureCanvas(page, "grounding-traffic");

  const large = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
    const vehicle = scene.vehicleSystem.vehicle("estate_van");
    if (!vehicle) return null;
    await window.NBD_CITY_STREAM.forceFocus(vehicle.x, vehicle.y);
    const stand = [
      { x: vehicle.x, y: vehicle.y + 70 },
      { x: vehicle.x, y: vehicle.y - 70 },
      { x: vehicle.x + 70, y: vehicle.y },
      { x: vehicle.x - 70, y: vehicle.y }
    ].find(point => scene.canStandAt(point.x, point.y)) || { x: vehicle.x, y: vehicle.y };
    scene.switchLayer(0, stand, "M6 large-vehicle grounding review");
    await window.NBD_CITY_STREAM.forceFocus(vehicle.x, vehicle.y);
    scene.redrawLayer("M6 large-vehicle grounding review");
    scene.cameras.main.centerOn(vehicle.x, vehicle.y);
    vehicle.container.setVisible(true);
    scene.scene.pause();
    const shadow = vehicle.visual?.shadow;
    return {
      id: vehicle.id,
      archetypeId: vehicle.archetypeId,
      width: vehicle.archetype?.width,
      height: vehicle.archetype?.height,
      shadow: shadow ? {
        name: shadow.name || null,
        type: shadow.type || shadow.constructor?.name || null,
        alpha: Number(shadow.alpha),
        width: Number(shadow.width || shadow.displayWidth || 0),
        height: Number(shadow.height || shadow.displayHeight || 0),
        x: Number(shadow.x),
        y: Number(shadow.y)
      } : null
    };
  });

  expect(large?.archetypeId).toBe("van");
  expect(large?.shadow?.name).toBe("vehicle-contact-shadow");
  expect(large.shadow.width).toBeGreaterThan(traffic.shadow.width);
  await captureCanvas(page, "grounding-large-vehicle");

  const policeWet = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
    const district = await import("/phaser/src/data/district.js");
    const wetPolicy = await import("/phaser/src/policies/CityWetStreetPresentationPolicy.js");
    const view = scene.cameras.main.worldView;
    const focus = {
      x: Number(view.x) + Number(view.width) * 0.5,
      y: Number(view.y) + Number(view.height) * 0.5
    };
    const receiver = wetPolicy.findNearestRoadReceiver(focus, district.roads, {
      maximumDistance: Number.MAX_SAFE_INTEGER,
      renderBounds: { x: Number(view.x), y: Number(view.y), width: Number(view.width), height: Number(view.height) }
    });
    if (!receiver) return null;
    const center = receiver.receivingPoint;
    const slot = scene.motorizedPoliceSystem.slots[0];
    slot.unitId = "m6-grounding-police";
    slot.x = center.x;
    slot.y = center.y;
    slot.angle = 0;
    slot.container.setPosition(center.x, center.y).setRotation(0).setActive(true).setVisible(true);
    scene.updateVehicleLightPresentation?.(0);
    const wet = (scene.cityWetDynamicReflectionDescriptors || []).filter(item => (
      item.sourceFamily === "police-red" || item.sourceFamily === "police-blue"
    ));
    scene.cameras.main.centerOn(center.x, center.y);
    scene.scene.pause();
    const shadow = slot.visual?.shadow;
    return {
      roadId: receiver.roadId,
      wetCount: wet.length,
      wetRoadIds: [...new Set(wet.map(item => item.receiverRoadId))],
      archetypeId: slot.archetypeId,
      shadow: shadow ? {
        name: shadow.name || null,
        type: shadow.type || shadow.constructor?.name || null,
        alpha: Number(shadow.alpha),
        width: Number(shadow.width || shadow.displayWidth || 0),
        height: Number(shadow.height || shadow.displayHeight || 0),
        x: Number(shadow.x),
        y: Number(shadow.y)
      } : null
    };
  });

  expect(policeWet?.shadow?.name).toBe("vehicle-contact-shadow");
  expect(policeWet.wetCount).toBeGreaterThan(0);
  expect(policeWet.wetRoadIds.every(Boolean)).toBe(true);
  await captureCanvas(page, "grounding-police-wet");

  const darkControl = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
    const district = await import("/phaser/src/data/district.js");
    const wetPolicy = await import("/phaser/src/policies/CityWetStreetPresentationPolicy.js");
    const darkBuilding = district.buildings.find(building => String(building.id || "").toLowerCase().includes("blackwater")) || district.buildings[0];
    const source = {
      x: Number(darkBuilding.x) + Number(darkBuilding.w) * 0.5,
      y: Number(darkBuilding.y) + Number(darkBuilding.h) * 0.5
    };
    const receiver = wetPolicy.findNearestRoadReceiver(source, district.roads, { maximumDistance: Number.MAX_SAFE_INTEGER });
    if (!receiver) return null;
    const center = receiver.receivingPoint;
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);
    const stand = [
      { x: center.x, y: center.y + 70 },
      { x: center.x, y: center.y - 70 },
      { x: center.x + 70, y: center.y },
      { x: center.x - 70, y: center.y }
    ].find(point => scene.canStandAt(point.x, point.y)) || center;
    scene.switchLayer(0, stand, "M6 dark grounding control");
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);
    scene.redrawLayer("M6 dark grounding control");
    const policeSlot = scene.motorizedPoliceSystem.slots[0];
    if (policeSlot) {
      policeSlot.unitId = null;
      policeSlot.container.setActive(false).setVisible(false);
    }
    const slot = scene.trafficMaterializationSystem.pool[0];
    slot.tokenId = null;
    slot.x = center.x;
    slot.y = center.y;
    slot.angle = 0;
    slot.container.setPosition(center.x, center.y).setRotation(0).setActive(true).setVisible(true);
    scene.cameras.main.centerOn(center.x, center.y);
    scene.updateVehicleLightPresentation?.(360);
    scene.scene.pause();
    const shadow = slot.visual?.shadow;
    return {
      buildingId: darkBuilding.id || null,
      roadId: receiver.roadId,
      dynamicWetCount: (scene.cityWetDynamicReflectionDescriptors || []).length,
      shadow: shadow ? {
        name: shadow.name || null,
        type: shadow.type || shadow.constructor?.name || null,
        alpha: Number(shadow.alpha),
        width: Number(shadow.width || shadow.displayWidth || 0),
        height: Number(shadow.height || shadow.displayHeight || 0),
        x: Number(shadow.x),
        y: Number(shadow.y)
      } : null
    };
  });

  expect(darkControl?.shadow?.name).toBe("vehicle-contact-shadow");
  expect(darkControl.dynamicWetCount).toBe(0);
  await captureCanvas(page, "grounding-dark-control");

  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
  });

  await writeFile(path.join(OUTPUT_DIR, "vehicle-grounding-manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    initiative: "city-noir-atmosphere",
    milestone: "M6.2",
    purpose: "gameplay-scale evidence that one shallow contact shadow grounds civilian traffic, a large van and police vehicles without swallowing the silhouette in a dark control",
    traffic,
    large,
    policeWet,
    darkControl,
    captures: [
      "grounding-traffic.png",
      "grounding-large-vehicle.png",
      "grounding-police-wet.png",
      "grounding-dark-control.png"
    ]
  }, null, 2)}\n`, "utf8");

  expect(pageErrors).toEqual([]);
});