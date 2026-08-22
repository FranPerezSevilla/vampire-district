import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const OUTPUT_DIR = path.resolve(".artifacts/city-atmosphere-review");
const MAX_FAMILY_CAPTURES = 4;

async function waitForCity(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
      && window.NBD_SCENARIO_READY
      && window.NBD_CITY_STREAM_READY
      && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")
  ));
  await page.evaluate(async () => {
    await window.NBD_CITY_STREAM.waitUntilReady();
  });
}

async function captureCanvas(page, name) {
  const canvas = page.locator("#game-root canvas");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(120);
  await canvas.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`) });
}

async function discoverTargets(page) {
  return page.evaluate(async () => {
    const district = await import("/phaser/src/data/district.js");
    const policy = await import("/phaser/src/policies/BuildingDecorativeSignPresentationPolicy.js");
    const candidates = [];
    const controls = [];

    for (const building of district.buildings || []) {
      const descriptor = policy.buildBuildingDecorativeSignDescriptor(building);
      const snapshot = {
        id: String(building.id || ""),
        sign: String(building.sign || building.label || building.name || ""),
        x: Number(building.x),
        y: Number(building.y),
        w: Number(building.w),
        h: Number(building.h)
      };
      if (descriptor) {
        candidates.push({
          ...snapshot,
          family: descriptor.family,
          paletteFamily: descriptor.paletteFamily,
          labelText: descriptor.labelText,
          accentColor: descriptor.accentColor,
          coreColor: descriptor.coreColor,
          panel: { ...descriptor.panel }
        });
      } else if (snapshot.w >= 80 && snapshot.h >= 58) {
        controls.push(snapshot);
      }
    }

    const seen = new Set();
    const targets = [];
    for (const candidate of candidates) {
      if (seen.has(candidate.family)) continue;
      seen.add(candidate.family);
      targets.push(candidate);
      if (targets.length >= 4) break;
    }

    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    return {
      installed: Boolean(scene?.__viceBuildingDecorativeSignPresentationPolicy),
      candidates,
      targets,
      control: controls[0] || null
    };
  });
}

async function focusBuilding(page, target, status) {
  return page.evaluate(async ({ target, status }) => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    if (scene.scene.isPaused()) scene.scene.resume();

    const center = {
      x: target.x + target.w / 2,
      y: target.y + target.h / 2
    };
    const margin = 56;
    const candidates = [
      { x: center.x, y: target.y + target.h + margin },
      { x: center.x, y: target.y - margin },
      { x: target.x + target.w + margin, y: center.y },
      { x: target.x - margin, y: center.y }
    ];
    const stand = candidates.find(point => scene.canStandAt(point.x, point.y));
    if (!stand) return { focused: false, labels: [] };

    scene.switchLayer(0, stand, status);
    await window.NBD_CITY_STREAM.forceFocus(center.x, center.y);
    scene.redrawLayer(status);
    scene.cameras.main.centerOn(center.x, center.y);
    scene.scene.pause();

    return {
      focused: true,
      center,
      stand,
      labels: (scene.mapLabels || [])
        .filter(label => label?.visible !== false)
        .map(label => String(label?.text || ""))
    };
  }, { target, status });
}

test.describe.configure({ timeout: 180_000 });

test("captures M7.1 semantic sign/neon grammar at gameplay scale", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await mkdir(OUTPUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForCity(page);

  const discovery = await discoverTargets(page);
  expect(discovery.installed).toBe(true);
  expect(discovery.candidates.length).toBeGreaterThan(0);
  expect(discovery.targets.length).toBeGreaterThan(0);
  expect(discovery.targets.length).toBeLessThanOrEqual(MAX_FAMILY_CAPTURES);

  const captures = [];
  const focusedTargets = [];
  for (const [index, target] of discovery.targets.entries()) {
    const state = await focusBuilding(page, target, `M7.1 sign review: ${target.family}`);
    expect(state.focused, `expected a legal street review point for ${target.id}`).toBe(true);
    expect(state.labels, `expected runtime label for ${target.id}`).toContain(target.labelText);
    const name = `m7-sign-${String(index + 1).padStart(2, "0")}-${target.family}`;
    await captureCanvas(page, name);
    captures.push(`${name}.png`);
    focusedTargets.push({ ...target, state });
  }

  let control = null;
  if (discovery.control) {
    const state = await focusBuilding(page, discovery.control, "M7.1 unsigned control");
    if (state.focused) {
      const name = "m7-sign-control-dark";
      await captureCanvas(page, name);
      captures.push(`${name}.png`);
      control = { ...discovery.control, state };
    }
  }

  await writeFile(path.join(OUTPUT_DIR, "m7-sign-neon-manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    initiative: "city-noir-atmosphere",
    milestone: "M7.1",
    purpose: "gameplay-scale evidence for sparse semantic sign/neon grammar without introducing a second light system",
    availableFamilies: [...new Set(discovery.candidates.map(item => item.family))],
    candidateCount: discovery.candidates.length,
    targets: focusedTargets,
    control,
    captures
  }, null, 2)}\n`, "utf8");

  expect(pageErrors).toEqual([]);
});
