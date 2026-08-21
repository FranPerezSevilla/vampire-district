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
    const practical = await import("/phaser/src/policies/CityPracticalLightPresentationPolicy.js");
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
    const buildingById = new Map(buildingRows.map(item => [String(item.id), item]));

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

    const lightRows = district.lights.map((light, index) => ({
      id: light.id || `light-${index}`,
      x: Number(light.x) || 0,
      y: Number(light.y) || 0,
      radius: Number(light.radius) || 0
    }));
    let warmLight = null;
    for (const anchor of lightRows) {
      const nearby = lightRows.filter(item => (
        Math.abs(item.x - anchor.x) <= visibleWidth * 0.46
        && Math.abs(item.y - anchor.y) <= visibleHeight * 0.46
      ));
      const densityPenalty = Math.abs(nearby.length - 3);
      const edgeSafe = anchor.x > visibleWidth * 0.5
        && anchor.x < Number(district.CITY_WORLD.width) - visibleWidth * 0.5
        && anchor.y > visibleHeight * 0.5
        && anchor.y < Number(district.CITY_WORLD.height) - visibleHeight * 0.5;
      const score = (edgeSafe ? 100 : 0) - densityPenalty * 10 + Math.min(nearby.length, 6);
      if (!warmLight || score > warmLight.score) {
        warmLight = {
          x: anchor.x,
          y: anchor.y,
          score,
          sourceId: anchor.id,
          radius: anchor.radius,
          visibleLightIds: nearby.map(item => item.id).slice(0, 12)
        };
      }
    }

    const fullWorld = { x: 0, y: 0, w: district.CITY_WORLD.width, h: district.CITY_WORLD.height };
    const buildingLights = practical.buildContextualBuildingLightDescriptors(district.buildings, fullWorld);
    const streetLights = practical.buildWarmStreetLightDescriptors(district.lights, fullWorld);
    const allPractical = [...streetLights, ...buildingLights];

    const contextualTarget = family => {
      const candidates = buildingLights.filter(item => item.family === family);
      if (!candidates.length) return null;
      return candidates
        .map(item => {
          const building = buildingById.get(String(item.buildingId));
          const x = building ? building.x + building.w / 2 : item.x;
          const y = building ? building.y + building.h / 2 : item.y;
          const edgeSafe = x > visibleWidth * 0.5
            && x < Number(district.CITY_WORLD.width) - visibleWidth * 0.5
            && y > visibleHeight * 0.5
            && y < Number(district.CITY_WORLD.height) - visibleHeight * 0.5;
          const nearby = allPractical.filter(other => (
            Math.abs(other.x - x) <= visibleWidth * 0.44
              && Math.abs(other.y - y) <= visibleHeight * 0.44
          ));
          return {
            x,
            y,
            family,
            buildingId: item.buildingId,
            sourceId: item.sourceId,
            profileId: item.profileId,
            score: (edgeSafe ? 100 : 0) + Math.min(nearby.length, 12),
            nearbyFamilies: [...new Set(nearby.map(other => other.family))]
          };
        })
        .sort((a, b) => b.score - a.score || String(a.sourceId).localeCompare(String(b.sourceId)))[0];
    };

    let mixedFamilies = null;
    for (const anchor of allPractical) {
      const nearby = allPractical.filter(other => (
        Math.abs(other.x - anchor.x) <= visibleWidth * 0.44
          && Math.abs(other.y - anchor.y) <= visibleHeight * 0.44
      ));
      const families = [...new Set(nearby.map(item => item.family))];
      const edgeSafe = anchor.x > visibleWidth * 0.5
        && anchor.x < Number(district.CITY_WORLD.width) - visibleWidth * 0.5
        && anchor.y > visibleHeight * 0.5
        && anchor.y < Number(district.CITY_WORLD.height) - visibleHeight * 0.5;
      const score = families.length * 100 + (edgeSafe ? 40 : 0) + Math.min(nearby.length, 20);
      if (!mixedFamilies || score > mixedFamilies.score) {
        mixedFamilies = {
          x: anchor.x,
          y: anchor.y,
          score,
          families,
          sourceIds: nearby.map(item => item.sourceId).slice(0, 20)
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
      palette: balance.COLORS,
      targets: {
        intersection,
        mixedStreet,
        darkBlock,
        warmLight,
        civicCool: contextualTarget(practical.PRACTICAL_LIGHT_FAMILIES.COOL_CIVIC),
        nightlife: contextualTarget(practical.PRACTICAL_LIGHT_FAMILIES.NIGHTLIFE_ACCENT),
        industrial: contextualTarget(practical.PRACTICAL_LIGHT_FAMILIES.INDUSTRIAL_DIRTY),
        mixedFamilies
      }
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
    const practicalLights = Array.isArray(scene.cityPracticalLightDescriptors)
      ? scene.cityPracticalLightDescriptors.map(descriptor => ({
          sourceId: descriptor.sourceId,
          family: descriptor.family,
          buildingId: descriptor.buildingId || null,
          profileId: descriptor.profileId || null,
          sourceKind: descriptor.sourceKind || null,
          x: descriptor.x,
          y: descriptor.y,
          width: descriptor.width,
          height: descriptor.height,
          radius: descriptor.radius
        }))
      : [];

    scene.scene.pause();
    return {
      center,
      stand,
      player,
      playerOffset,
      playerVisible,
      visibleHalfExtents: { x: halfWorldWidth, y: halfWorldHeight },
      practicalLights,
      practicalFamilies: [...new Set(practicalLights.map(item => item.family))],
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

test.describe.configure({ timeout: 150_000 });

test("captures gameplay-scale night hierarchy and contextual practical-light evidence", async ({ page }) => {
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
  expect(discovery.targets.warmLight, "missing warm practical-light review target").toBeTruthy();
  expect(discovery.targets.civicCool, "missing cool civic review target").toBeTruthy();
  expect(discovery.targets.nightlife, "missing nightlife review target").toBeTruthy();
  expect(discovery.targets.industrial, "missing industrial review target").toBeTruthy();
  expect(discovery.targets.mixedFamilies, "missing mixed-family review target").toBeTruthy();
  expect(discovery.targets.intersection.score).toBeGreaterThanOrEqual(2);
  expect(discovery.targets.mixedStreet.families.length).toBeGreaterThanOrEqual(3);
  expect(discovery.targets.mixedFamilies.families.length).toBeGreaterThanOrEqual(2);

  const targetsByName = {
    intersection: discovery.targets.intersection,
    "mixed-street": discovery.targets.mixedStreet,
    "dark-block": discovery.targets.darkBlock,
    "warm-light": discovery.targets.warmLight,
    "civic-cool": discovery.targets.civicCool,
    nightlife: discovery.targets.nightlife,
    industrial: discovery.targets.industrial,
    "mixed-families": discovery.targets.mixedFamilies
  };
  const captures = {};
  for (const [name, target] of Object.entries(targetsByName)) {
    captures[name] = await captureCanvas(page, target, discovery.normalZoom, name);
    expect(captures[name].zoom).toBe(discovery.normalZoom);
    expect(captures[name].layer).toBe(0);
    expect(captures[name].playerVisible).toBe(true);
  }

  expect(captures["warm-light"].practicalLights.some(light => (
    light.sourceId === discovery.targets.warmLight.sourceId
  ))).toBe(true);
  expect(captures["civic-cool"].practicalFamilies).toContain("cool-civic");
  expect(captures.nightlife.practicalFamilies).toContain("nightlife-accent");
  expect(captures.industrial.practicalFamilies).toContain("industrial-dirty");
  expect(captures["mixed-families"].practicalFamilies.length).toBeGreaterThanOrEqual(2);

  const manifest = {
    schemaVersion: 3,
    initiative: "city-noir-atmosphere",
    milestone: "M3.4",
    purpose: "gameplay-scale evidence for night hierarchy, warm base light and sparse contextual civic/nightlife/industrial accents",
    gameplayZoom: discovery.normalZoom,
    viewport: discovery.viewport,
    palette: discovery.palette,
    targets: discovery.targets,
    captures: {
      intersection: { filename: "intersection.png", state: captures.intersection },
      mixedStreet: { filename: "mixed-street.png", state: captures["mixed-street"] },
      darkBlock: { filename: "dark-block.png", state: captures["dark-block"] },
      warmLight: { filename: "warm-light.png", state: captures["warm-light"] },
      civicCool: { filename: "civic-cool.png", state: captures["civic-cool"] },
      nightlife: { filename: "nightlife.png", state: captures.nightlife },
      industrial: { filename: "industrial.png", state: captures.industrial },
      mixedFamilies: { filename: "mixed-families.png", state: captures["mixed-families"] }
    }
  };
  await writeFile(
    path.join(OUTPUT_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  expect(pageErrors).toEqual([]);
});
