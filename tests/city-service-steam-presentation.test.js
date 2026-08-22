import test from "node:test";
import assert from "node:assert/strict";

import {
  SERVICE_STEAM_PRESENTATION,
  buildServiceSteamPuffFrame,
  buildServiceSteamSourceDescriptors,
  drawServiceSteamPuffFrame,
  installCityServiceSteamPresentationPolicy
} from "../phaser/src/policies/CityServiceSteamPresentationPolicy.js";

class FakeGraphics {
  constructor() {
    this.operations = [];
    this.depth = 0;
  }

  setDepth(value) {
    this.depth = value;
    return this;
  }

  clear() {
    this.operations.push(["clear"]);
    return this;
  }

  fillStyle(color, alpha) {
    this.operations.push(["fillStyle", color, alpha]);
    return this;
  }

  fillCircle(x, y, radius) {
    this.operations.push(["fillCircle", x, y, radius]);
    return this;
  }

  destroy() {
    this.operations.push(["destroy"]);
  }
}

function grime(sourceId, buildingId, profileId, edge, sourceX, sourceY, extra = {}) {
  return {
    sourceId,
    buildingId,
    sourceKind: "service-strip",
    profileId,
    edge,
    sourceX,
    sourceY,
    x: sourceX,
    y: sourceY,
    ...extra
  };
}

const SERVICE_DESCRIPTORS = Object.freeze([
  grime("forge-grime", "forge", "industrial", "north", 120, 220),
  grime("warehouse-grime", "warehouse", "warehouse", "east", 420, 240),
  grime("garage-grime", "garage", "industrial", "south", 720, 430),
  grime("factory-grime", "factory", "industrial", "west", 1040, 260),
  grime("frontage-only", "store", "commercial", "north", 260, 520, { sourceKind: "frontage" })
]);

test("M7.2 selects deterministic service-only steam sources with a hard cap and local culling", () => {
  const before = structuredClone(SERVICE_DESCRIPTORS);
  const bounds = { x: 0, y: 0, w: 900, h: 650 };
  const first = buildServiceSteamSourceDescriptors(SERVICE_DESCRIPTORS, bounds);
  const second = buildServiceSteamSourceDescriptors(SERVICE_DESCRIPTORS, bounds);

  assert.deepEqual(SERVICE_DESCRIPTORS, before);
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(first.length > 0);
  assert.ok(first.length <= SERVICE_STEAM_PRESENTATION.maximumSources);
  assert.ok(first.every(item => ["industrial", "warehouse"].includes(item.profileId)));
  assert.ok(first.every(item => item.family === "service-steam-smoke"));
  assert.ok(first.every(item => item.maxAlpha <= 0.18));
  assert.equal(first.some(item => item.buildingId === "store"), false);
  assert.equal(first.some(item => item.buildingId === "factory"), false);
});

test("M7.2 puff frames stay below the source×puff cap, remain translucent, and animate deterministically", () => {
  const sources = buildServiceSteamSourceDescriptors(SERVICE_DESCRIPTORS, null);
  const frameA = buildServiceSteamPuffFrame(sources, 800);
  const frameB = buildServiceSteamPuffFrame(sources, 1500);
  const frameARepeat = buildServiceSteamPuffFrame(sources, 800);

  assert.deepEqual(frameA, frameARepeat);
  assert.notDeepEqual(frameA, frameB);
  assert.ok(frameA.length <= SERVICE_STEAM_PRESENTATION.maximumSources * SERVICE_STEAM_PRESENTATION.maximumPuffsPerSource);
  assert.ok(frameA.every(puff => puff.alpha > 0 && puff.alpha <= 0.18));
  assert.ok(frameA.every(puff => puff.radius >= SERVICE_STEAM_PRESENTATION.minimumRadius));
  assert.ok(frameA.every(puff => puff.radius <= SERVICE_STEAM_PRESENTATION.maximumRadius));
  assert.ok(frameA.every(puff => {
    const source = sources.find(item => item.sourceId === puff.sourceId);
    return Math.hypot(puff.x - source.x, puff.y - source.y)
      <= SERVICE_STEAM_PRESENTATION.plumeDistance + SERVICE_STEAM_PRESENTATION.driftDistance + 3;
  }));
});

test("M7.2 rendering uses only small translucent circles, not a particle emitter or opaque cloud primitive", () => {
  const sources = buildServiceSteamSourceDescriptors(SERVICE_DESCRIPTORS, null);
  const puffs = buildServiceSteamPuffFrame(sources, 1200);
  const graphics = new FakeGraphics();

  drawServiceSteamPuffFrame(graphics, puffs);

  assert.equal(graphics.operations.filter(([name]) => name === "fillCircle").length, puffs.length);
  assert.ok(graphics.operations.filter(([name]) => name === "fillStyle").every(([, , alpha]) => alpha <= 0.18));
  assert.equal(graphics.operations.some(([name]) => ["fillRect", "fillEllipse", "particleEmitter"].includes(name)), false);
});

test("M7.2 installer owns one graphics layer and composes after M5 grime without changing its return value", () => {
  class FakeScene {
    create() {
      this.created = true;
      this.add = { graphics: () => new FakeGraphics() };
    }

    update() {
      this.baseUpdates = (this.baseUpdates || 0) + 1;
    }

    drawCityServiceFrontageGrime() {
      this.cityServiceFrontageGrimeDescriptors = SERVICE_DESCRIPTORS;
      return SERVICE_DESCRIPTORS;
    }
  }

  installCityServiceSteamPresentationPolicy(FakeScene);
  installCityServiceSteamPresentationPolicy(FakeScene);

  const scene = new FakeScene();
  scene.currentLayer = 0;
  scene.urbanRenderBounds = { x: 0, y: 0, w: 900, h: 650 };
  scene.create();
  const grimeResult = scene.drawCityServiceFrontageGrime(scene.urbanRenderBounds);
  scene.update(1200, 16);

  assert.equal(grimeResult, SERVICE_DESCRIPTORS);
  assert.equal(scene.cityServiceSteamGraphics.depth, 18);
  assert.ok(scene.cityServiceSteamSourceDescriptors.length <= SERVICE_STEAM_PRESENTATION.maximumSources);
  assert.ok(scene.cityServiceSteamPuffFrame.length <= SERVICE_STEAM_PRESENTATION.maximumSources * SERVICE_STEAM_PRESENTATION.maximumPuffsPerSource);
  assert.equal(scene.baseUpdates, 1);
});
