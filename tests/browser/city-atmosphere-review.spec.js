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

async function discoverReviewTargets(page) {
  return page.evaluate(async () => {
    const district = await import("/phaser/src/data/district.js");
    const presentation = await import("/phaser/src/rendering/BuildingPresentation.js");
    const balance = await import("/phaser/src/data/balance.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const camera = scene.cameras.main;
    const normalZoom = Number(camera.zoom) || 1;
    const visibleWidth = Math.max(640, Number(camera.worldView?.width) || 960);
    const visibleHeight = Math.max(420, Number(camera.worldView?.height) || 640);

    const buildingRows = district.buildings.map(building => {
      const archetype = presentation.classifyBuildingPresentation(building);
      const profile = presentation.classifyBuildingVisualProfile(building, archetype);
      return {
        id: building.id || null,
        x: Number(building.x) || 0,
        y: Number(building.y) || 0,
        w: Number(building.w) || 0,
        h: Number(building.h) || 0,
        archetype,
        profile,
        area: Math.max(0, Number(building.w) || 0) * Math.max(0, Number(building.h) || 0)
      };
    });

    const familyFor = item => {
      if (["police", "medical", "church", "club", "industrial", "warehouse"].includes(item.profile)) {
        return item.profile;
      }
      if (["residential", "commercial"].includes(item.profile)) return item.profile;
      return "generic";
    };

    let mixedStreet = null;
    for (const anchor of buildingRows) {
      const cx = anchor.x + anchor.w / 2;
      const cy = anchor.y + anchor.h / 2;
      const nearby = buildingRows.filter(item => {
        const ix = item.x + item.w / 2;
        const iy = item.y + item.h / 2;
        return Math.abs(ix - cx) <= visibleWidth * 0.46
          && Math.abs(iy - cy) <= visibleHeight * 0.46;
      });
      const families = [...new Set(nearby.map(familyFor))];
      const score = families.length * 100 + Math.min(nearby.length, 30);
      if (!mixedStreet || score > mixedStreet.score) {
        mixedStreet = {
          x: cx,
          y: cy,
          score,
          families,
          buildingIds: nearby.map(item => item.id).filter(Boolean).slice(0, 24)
        };
      }
    }

    const crosswalkCenters = district.crosswalks.map((crossing, index) => ({
      id: crossing.id || `crosswalk-${index}`,
      x: Number(crossing.x) + Number(crossing.w) / 2,
      y: Number(crossing.y) + Number(crossing.h) / 2
    }));
    let intersection = null;
    for (const anchor of crosswalkCenters) {
      const nearby = crosswalkCenters.filter(item => (
        Math.abs(item.x - anchor.x) <= visibleWidth * 0.36
        && Math.abs(item.y - anchor.y) <= visibleHeight * 0.36
      ));
      const score = nearby.length;
      if (!intersection || score > intersection.score) {
        intersection = {
          x: anchor.x,
          y: anchor.y,
          score,
          crosswalkIds: nearby.map(item => item.id)
        };
      }
    }

    const neutralProfiles = new Set(["default", "residential", "commercial"]);
    const darkCandidate = buildingRows
      .filter(item => neutralProfiles.has(item.profile))
      .sort((a, b) => b.area - a.area || String(a.id).localeCompare(String(b.id)))[0];
    const darkBlock = darkCandidate
      ? {
          x: darkCandidate.x + darkCandidate.w / 2,
          y: darkCandidate.y + darkCandidate.h / 2,
          buildingId: darkCandidate.id,
          profile: darkCandidate.profile,
          area: darkCandidate.area
        }
      : null;

    return {
      normalZoom,
      viewport: {
        width: Number(camera.width) || 0,
        height: Number(camera.height) || 0,
        worldViewWidth: visibleWidth,
        worldViewHeight: visibleHeight
      },
      palette: balance.COLORS,
      targets: { intersection, mixedStreet, darkBlock }
    };
  });
}

async function prepareCapture(page, target, normalZoom, label) {
  return page.evaluate(async ({ target, normalZoom, label }) => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const center = { x: Number(target.x) || 0, y: Number(target.y) || 0 };
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);

    const offsets = [
      [0, 0], [0, 44], [0, -44], [-44, 0], [44, 0],
      [0, 76], [0, -76], [-76, 0], [76, 0]
    ];
    const stand = offsets
      .map(([dx, dy]) => ({ x: center.x + dx, y: center.y + dy }))
      .find(point => scene.canStandAt(point.x, point.y)) || center;

    scene.switchLayer(0, stand, `City atmosphere review: ${label}`);
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);
    scene.redrawLayer(`City atmosphere review: ${label}`);
    scene.cameras.main.setZoom(normalZoom);
    scene.cameras.main.centerOn(center.x, center.y);
    scene.updateCharacterPresentation?.(performance.now());

    const camera = scene.cameras.main;
    const zoom = Number(camera.zoom) || 1;
    const player = { x: Number(scene.player?.x) || 0, y: Number(scene.player?.y) || 0 };
    const halfWorldWidth = Math.max(1, Number(camera.width) || 0) / zoom / 2;
    const halfWorldHeight = Math.max(1, Number(camera.height) || 0) / zoom / 2;
    const playerOffset = {
      x: player.x - center.x,
      y: player.y - center.y
    };
    const playerVisible = Math.abs(playerOffset.x) <= halfWorldWidth
      && Math.abs(playerOffset.y) <= halfWorldHeight;

    scene.scene.pause();
    return {
      center,
      stand,
      player,
      playerOffset,
      playerVisible,
      visibleHalfExtents: { x: halfWorldWidth, y: halfWorldHeight },
      zoom,
      layer: scene.currentLayer,
      renderSectorKey: scene.urbanRenderSectorKey || null
    };
  }, { target, normalZoom, label });
}

async function finishCapture(page) {
  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();
  });
}

async function captureCanvas(page, target, normalZoom, name) {
  const state = await prepareCapture(page, target, normalZoom, name);
  await page.waitForTimeout(160);
  const canvas = page.locator("#game-root canvas");
  await expect(canvas).toBeVisible();
  await canvas.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`) });
  await finishCapture(page);
  return state;
}

test.describe.configure({ timeout: 120_000 });

test("captures M2 gameplay-scale night hierarchy evidence", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await mkdir(OUTPUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForCity(page);

  const discovery = await discoverReviewTargets(page);
  expect(discovery.targets.intersection, "missing representative intersection").toBeTruthy();
  expect(discovery.targets.mixedStreet, "missing mixed street").toBeTruthy();
  expect(discovery.targets.darkBlock, "missing neutral dark block").toBeTruthy();
  expect(discovery.targets.intersection.score).toBeGreaterThanOrEqual(2);
  expect(discovery.targets.mixedStreet.families.length).toBeGreaterThanOrEqual(3);

  const captures = {};
  for (const name of ["intersection", "mixed-street", "dark-block"]) {
    const target = name === "mixed-street"
      ? discovery.targets.mixedStreet
      : name === "dark-block"
        ? discovery.targets.darkBlock
        : discovery.targets.intersection;
    captures[name] = await captureCanvas(page, target, discovery.normalZoom, name);
    expect(captures[name].zoom).toBe(discovery.normalZoom);
    expect(captures[name].layer).toBe(0);
    expect(captures[name].playerVisible).toBe(true);
  }

  const manifest = {
    schemaVersion: 1,
    initiative: "city-noir-atmosphere",
    milestone: "M2.3",
    purpose: "gameplay-scale evidence for global night value hierarchy and readability",
    gameplayZoom: discovery.normalZoom,
    viewport: discovery.viewport,
    palette: discovery.palette,
    targets: discovery.targets,
    captures: {
      intersection: { filename: "intersection.png", state: captures.intersection },
      mixedStreet: { filename: "mixed-street.png", state: captures["mixed-street"] },
      darkBlock: { filename: "dark-block.png", state: captures["dark-block"] }
    }
  };
  await writeFile(
    path.join(OUTPUT_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  expect(pageErrors).toEqual([]);
});
