import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const OUTPUT_DIR = path.resolve(".artifacts/city-atmosphere-review");

async function waitForCity(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
      && window.NBD_SCENARIO_READY
      && window.NBD_CITY_STREAM_READY
      && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.cityStreamSystem
  ));
  await page.evaluate(() => window.NBD_CITY_STREAM.waitUntilReady());
}

async function discoverTargets(page) {
  return page.evaluate(async () => {
    const district = await import("/phaser/src/data/district.js");
    const grime = await import("/phaser/src/policies/CityGrimePresentationPolicy.js");
    const corners = await import("/phaser/src/policies/CityServiceCornerDressingPolicy.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const camera = scene.cameras.main;
    const normalZoom = Number(camera.zoom) || 1;
    const visibleWidth = Math.max(640, Number(camera.worldView?.width) || 960);
    const visibleHeight = Math.max(420, Number(camera.worldView?.height) || 640);
    const descriptors = grime.buildServiceFrontageGrimeDescriptors(district.buildings, null);
    const cornerDescriptors = corners.buildServiceCornerDressingDescriptors(district.buildings, descriptors, null);

    const edgeSafe = item => (
      item.x > visibleWidth * 0.5
        && item.x < Number(district.CITY_WORLD.width) - visibleWidth * 0.5
        && item.y > visibleHeight * 0.5
        && item.y < Number(district.CITY_WORLD.height) - visibleHeight * 0.5
    );

    const service = descriptors
      .filter(item => ["industrial", "warehouse"].includes(item.profileId))
      .sort((left, right) => Number(edgeSafe(right)) - Number(edgeSafe(left))
        || String(left.sourceId).localeCompare(String(right.sourceId)))[0]
      || descriptors[0]
      || null;

    const corner = cornerDescriptors
      .sort((left, right) => Number(edgeSafe(right)) - Number(edgeSafe(left))
        || String(left.sourceId).localeCompare(String(right.sourceId)))[0]
      || null;

    let mixed = null;
    for (const anchor of descriptors) {
      const nearby = descriptors.filter(other => (
        Math.abs(other.x - anchor.x) <= visibleWidth * 0.46
          && Math.abs(other.y - anchor.y) <= visibleHeight * 0.46
      ));
      const profiles = [...new Set(nearby.map(item => item.profileId))];
      const score = nearby.length * 20 + profiles.length * 50 + (edgeSafe(anchor) ? 80 : 0);
      if (!mixed || score > mixed.score) {
        mixed = {
          x: anchor.x,
          y: anchor.y,
          sourceId: anchor.sourceId,
          score,
          profiles,
          nearbySourceIds: nearby.map(item => item.sourceId)
        };
      }
    }

    const atmospheric = [...descriptors, ...cornerDescriptors];
    const candidates = district.buildings.map(building => ({
      x: Number(building.x) + Number(building.w) / 2,
      y: Number(building.y) + Number(building.h) / 2,
      buildingId: building.id || null
    }));
    const darkControl = candidates
      .map(candidate => {
        const nearest = atmospheric.length
          ? Math.min(...atmospheric.map(item => Math.hypot(item.x - candidate.x, item.y - candidate.y)))
          : Number.MAX_SAFE_INTEGER;
        return { ...candidate, nearest };
      })
      .sort((left, right) => right.nearest - left.nearest || String(left.buildingId).localeCompare(String(right.buildingId)))[0]
      || null;

    return {
      normalZoom,
      descriptorCount: descriptors.length,
      cornerDescriptorCount: cornerDescriptors.length,
      targets: {
        service: service ? {
          x: service.x,
          y: service.y,
          sourceId: service.sourceId,
          profileId: service.profileId,
          buildingId: service.buildingId
        } : null,
        corner: corner ? {
          x: corner.x,
          y: corner.y,
          sourceId: corner.sourceId,
          profileId: corner.profileId,
          buildingId: corner.buildingId,
          corner: corner.corner
        } : null,
        mixed,
        darkControl
      }
    };
  });
}

async function prepare(page, target, zoom, label) {
  return page.evaluate(async ({ target, zoom, label }) => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const center = { x: Number(target.x), y: Number(target.y) };
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);
    const offsets = [
      [0, 180], [0, -180], [180, 0], [-180, 0],
      [0, 140], [140, 0], [-140, 0], [0, 90], [90, 0], [-90, 0], [0, 0]
    ];
    const stand = offsets
      .map(([dx, dy]) => ({ x: center.x + dx, y: center.y + dy }))
      .find(point => scene.canStandAt(point.x, point.y)) || center;

    scene.switchLayer(0, stand, `City grime review: ${label}`);
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);
    scene.redrawLayer(`City grime review: ${label}`);
    scene.cameras.main.setZoom(zoom);
    scene.cameras.main.centerOn(center.x, center.y);
    scene.updateCharacterPresentation?.(performance.now());

    const descriptors = (scene.cityServiceFrontageGrimeDescriptors || []).map(item => ({
      sourceId: item.sourceId,
      buildingId: item.buildingId,
      family: item.family,
      profileId: item.profileId,
      sourceKind: item.sourceKind,
      x: item.x,
      y: item.y,
      fragments: item.fragments.length
    }));
    const cornerDescriptors = (scene.cityServiceCornerDressingDescriptors || []).map(item => ({
      sourceId: item.sourceId,
      buildingId: item.buildingId,
      family: item.family,
      profileId: item.profileId,
      sourceKind: item.sourceKind,
      corner: item.corner,
      x: item.x,
      y: item.y,
      fragments: item.fragments.length
    }));
    const camera = scene.cameras.main;
    const player = { x: Number(scene.player?.x) || 0, y: Number(scene.player?.y) || 0 };
    const halfWorldWidth = Math.max(1, Number(camera.width) || 0) / (Number(camera.zoom) || 1) / 2;
    const halfWorldHeight = Math.max(1, Number(camera.height) || 0) / (Number(camera.zoom) || 1) / 2;
    const playerVisible = Math.abs(player.x - center.x) <= halfWorldWidth
      && Math.abs(player.y - center.y) <= halfWorldHeight;

    scene.scene.pause();
    return {
      center,
      stand,
      player,
      playerVisible,
      descriptors,
      cornerDescriptors,
      profileIds: [...new Set(descriptors.map(item => item.profileId))],
      cornerProfileIds: [...new Set(cornerDescriptors.map(item => item.profileId))],
      layer: scene.currentLayer,
      zoom: Number(camera.zoom) || 1
    };
  }, { target, zoom, label });
}

async function capture(page, target, zoom, name) {
  const state = await prepare(page, target, zoom, name);
  const canvas = page.locator("#game-root canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(150);
  await canvas.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`) });
  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
  });
  return state;
}

test.describe.configure({ timeout: 120_000 });

test("captures sparse service grime and service-corner dressing with a clean control area", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await mkdir(OUTPUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForCity(page);

  const discovery = await discoverTargets(page);
  expect(discovery.descriptorCount).toBeGreaterThan(0);
  expect(discovery.cornerDescriptorCount).toBeGreaterThan(0);
  expect(discovery.targets.service, "missing service-frontage grime target").toBeTruthy();
  expect(discovery.targets.corner, "missing service-corner dressing target").toBeTruthy();
  expect(discovery.targets.mixed, "missing mixed grime context").toBeTruthy();
  expect(discovery.targets.darkControl, "missing grime-dark control target").toBeTruthy();

  const service = await capture(page, discovery.targets.service, discovery.normalZoom, "service-frontage-grime");
  expect(service.layer).toBe(0);
  expect(service.zoom).toBe(discovery.normalZoom);
  expect(service.playerVisible).toBe(true);
  expect(service.descriptors.some(item => item.sourceId === discovery.targets.service.sourceId)).toBe(true);
  expect(service.descriptors.length).toBeLessThanOrEqual(12);
  expect(Math.hypot(service.player.x - service.center.x, service.player.y - service.center.y)).toBeGreaterThanOrEqual(85);

  const corner = await capture(page, discovery.targets.corner, discovery.normalZoom, "service-corner-dressing");
  expect(corner.layer).toBe(0);
  expect(corner.playerVisible).toBe(true);
  expect(corner.cornerDescriptors.some(item => item.sourceId === discovery.targets.corner.sourceId)).toBe(true);
  expect(corner.cornerDescriptors.length).toBeLessThanOrEqual(6);
  expect(corner.cornerProfileIds.every(profile => ["industrial", "warehouse"].includes(profile))).toBe(true);

  const mixed = await capture(page, discovery.targets.mixed, discovery.normalZoom, "mixed-grime-context");
  expect(mixed.layer).toBe(0);
  expect(mixed.playerVisible).toBe(true);
  expect(mixed.descriptors.length).toBeGreaterThan(0);
  expect(mixed.descriptors.length).toBeLessThanOrEqual(12);
  expect(mixed.cornerDescriptors.length).toBeLessThanOrEqual(6);

  const darkControl = await capture(page, discovery.targets.darkControl, discovery.normalZoom, "grime-dark-control");
  expect(darkControl.layer).toBe(0);
  expect(darkControl.playerVisible).toBe(true);
  expect(darkControl.descriptors.length).toBeLessThanOrEqual(12);
  expect(darkControl.cornerDescriptors.length).toBeLessThanOrEqual(6);

  await writeFile(path.join(OUTPUT_DIR, "grime-manifest.json"), `${JSON.stringify({
    schemaVersion: 4,
    initiative: "city-noir-atmosphere",
    milestone: "M5.3",
    purpose: "gameplay-scale evidence for deterministic low-frequency service-frontage grime, contextual service-corner dressing and a sparse control area",
    discovery,
    captures: {
      service: { filename: "service-frontage-grime.png", state: service },
      corner: { filename: "service-corner-dressing.png", state: corner },
      mixed: { filename: "mixed-grime-context.png", state: mixed },
      darkControl: { filename: "grime-dark-control.png", state: darkControl }
    }
  }, null, 2)}\n`, "utf8");

  expect(pageErrors).toEqual([]);
});
