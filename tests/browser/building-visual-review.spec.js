import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const OUTPUT_DIR = path.resolve(".artifacts/building-review");
const REVIEW_FAMILIES = Object.freeze({
  warehouse: "warehouse",
  industrial: "industrial",
  police: "police",
  medical: "medical",
  church: "church",
  nightlife: "club",
  generic: "default"
});

async function waitForCity(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
      && window.NBD_SCENARIO_READY
      && window.NBD_CITY_STREAM_READY
      && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.cityStreamSystem
  ));
  await page.evaluate(() => window.NBD_CITY_STREAM.waitUntilReady());
}

async function discoverReviewTargets(page) {
  return page.evaluate(async familyProfiles => {
    const district = await import("/phaser/src/data/district.js");
    const presentation = await import("/phaser/src/rendering/BuildingPresentation.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const camera = scene.cameras.main;
    const normalZoom = Number(camera.zoom) || 1;

    const classified = district.buildings.map(building => {
      const archetype = presentation.classifyBuildingPresentation(building);
      const profile = presentation.classifyBuildingVisualProfile(building, archetype);
      return {
        id: building.id || null,
        sign: building.sign || null,
        name: building.name || building.label || null,
        districtId: building.districtId || null,
        x: Number(building.x) || 0,
        y: Number(building.y) || 0,
        w: Number(building.w) || 0,
        h: Number(building.h) || 0,
        archetype,
        profile,
        area: Math.max(0, Number(building.w) || 0) * Math.max(0, Number(building.h) || 0)
      };
    });

    const targets = {};
    for (const [family, profile] of Object.entries(familyProfiles)) {
      const candidates = classified
        .filter(item => item.profile === profile)
        .sort((a, b) => b.area - a.area || String(a.id).localeCompare(String(b.id)));
      targets[family] = candidates[0] || null;
    }

    const familyFor = item => {
      for (const [family, profile] of Object.entries(familyProfiles)) {
        if (item.profile === profile) return family;
      }
      if (["residential", "commercial"].includes(item.profile)) return item.profile;
      return "other";
    };
    const worldWidth = Number(district.CITY_WORLD?.width ?? district.CITY_WORLD?.w) || 4800;
    const worldHeight = Number(district.CITY_WORLD?.height ?? district.CITY_WORLD?.h) || 3600;
    const visibleWidth = Math.max(640, Number(camera.worldView?.width) || 960);
    const visibleHeight = Math.max(420, Number(camera.worldView?.height) || 640);

    let mixed = null;
    for (const anchor of classified) {
      const cx = anchor.x + anchor.w / 2;
      const cy = anchor.y + anchor.h / 2;
      const nearby = classified.filter(item => {
        const ix = item.x + item.w / 2;
        const iy = item.y + item.h / 2;
        return Math.abs(ix - cx) <= visibleWidth * 0.46
          && Math.abs(iy - cy) <= visibleHeight * 0.46;
      });
      const families = [...new Set(nearby.map(familyFor))];
      const score = families.length * 100 + Math.min(nearby.length, 20);
      if (!mixed || score > mixed.score) {
        mixed = {
          x: Math.max(0, Math.min(worldWidth, cx)),
          y: Math.max(0, Math.min(worldHeight, cy)),
          score,
          families,
          buildingIds: nearby.map(item => item.id).filter(Boolean).slice(0, 20)
        };
      }
    }

    return {
      normalZoom,
      viewport: {
        width: Number(camera.width) || 0,
        height: Number(camera.height) || 0,
        worldViewWidth: visibleWidth,
        worldViewHeight: visibleHeight
      },
      world: { width: worldWidth, height: worldHeight },
      targets,
      mixed
    };
  }, REVIEW_FAMILIES);
}

async function prepareCapture(page, target, normalZoom, label) {
  return page.evaluate(async ({ target, normalZoom, label }) => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const center = target.w !== undefined
      ? { x: target.x + target.w / 2, y: target.y + target.h / 2 }
      : { x: target.x, y: target.y };

    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);

    const margin = 28;
    const candidates = target.w !== undefined
      ? [
        { x: center.x, y: target.y + target.h + margin },
        { x: center.x, y: target.y - margin },
        { x: target.x - margin, y: center.y },
        { x: target.x + target.w + margin, y: center.y }
      ]
      : [center];
    const stand = candidates.find(point => scene.canStandAt(point.x, point.y)) || center;

    scene.switchLayer(0, stand, `Building visual review: ${label}`);
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);
    scene.redrawLayer(`Building visual review: ${label}`);
    scene.cameras.main.setZoom(normalZoom);
    scene.cameras.main.centerOn(center.x, center.y);
    scene.scene.pause();

    return {
      center,
      stand,
      zoom: Number(scene.cameras.main.zoom) || 1,
      layer: scene.currentLayer
    };
  }, { target, normalZoom, label });
}

async function finishCapture(page) {
  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
  });
}

test.describe.configure({ timeout: 150_000 });

test("captures the final representative building set at normal gameplay zoom", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await mkdir(OUTPUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForCity(page);

  const discovery = await discoverReviewTargets(page);
  for (const family of Object.keys(REVIEW_FAMILIES)) {
    expect(discovery.targets[family], `missing real-city ${family} representative`).toBeTruthy();
  }
  expect(discovery.mixed, "missing mixed-street review focus").toBeTruthy();
  expect(discovery.mixed.families.length).toBeGreaterThanOrEqual(3);

  const captures = [];
  for (const family of Object.keys(REVIEW_FAMILIES)) {
    const target = discovery.targets[family];
    const state = await prepareCapture(page, target, discovery.normalZoom, family);
    await page.waitForTimeout(120);
    const filename = `${family}.png`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: false });
    await finishCapture(page);
    captures.push({ family, filename, target, state });
  }

  const mixedState = await prepareCapture(
    page,
    discovery.mixed,
    discovery.normalZoom,
    "mixed-street"
  );
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "mixed-street.png"), fullPage: false });
  await finishCapture(page);

  const manifest = {
    schemaVersion: 1,
    purpose: "ViceBlood M6 final building visual review",
    gameplayZoom: discovery.normalZoom,
    viewport: discovery.viewport,
    world: discovery.world,
    captures,
    mixedStreet: {
      filename: "mixed-street.png",
      target: discovery.mixed,
      state: mixedState
    }
  };
  await writeFile(
    path.join(OUTPUT_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  expect(captures).toHaveLength(7);
  expect(captures.every(capture => capture.state.zoom === discovery.normalZoom)).toBe(true);
  expect(pageErrors).toEqual([]);
});
