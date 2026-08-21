import assert from "node:assert/strict";
import test from "node:test";

import { buildings, CITY_WORLD, lights } from "../phaser/src/data/district.js";
import {
  COOL_CIVIC_LIGHT_PRESENTATION,
  INDUSTRIAL_DIRTY_LIGHT_PRESENTATION,
  NIGHTLIFE_LIGHT_PRESENTATION,
  PRACTICAL_LIGHT_FAMILIES,
  PRACTICAL_LIGHT_PRESENTATIONS,
  WARM_FRONTAGE_LIGHT_PRESENTATION,
  WARM_STREET_LIGHT_PRESENTATION,
  buildContextualBuildingLightDescriptors,
  buildCoolCivicLightDescriptors,
  buildIndustrialDirtyLightDescriptors,
  buildNightlifeLightDescriptors,
  buildWarmFrontageLightDescriptors,
  buildWarmStreetLightDescriptors
} from "../phaser/src/policies/CityPracticalLightPresentationPolicy.js";

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildingFixture(id, profileId, overrides = {}) {
  return {
    id,
    x: 100,
    y: 100,
    w: 150,
    h: 96,
    presentation: { profileId },
    ...overrides
  };
}

function worldBounds() {
  return { x: 0, y: 0, w: CITY_WORLD.width, h: CITY_WORLD.height };
}

test("warm practical light descriptors are deterministic and do not mutate authored light semantics", () => {
  assert.ok(lights.length > 0, "generated city must expose practical-light anchors");
  const sourceBefore = snapshot(lights.slice(0, 12));
  const bounds = worldBounds();

  const first = buildWarmStreetLightDescriptors(lights, bounds);
  const second = buildWarmStreetLightDescriptors(lights, bounds);

  assert.deepEqual(first, second);
  assert.deepEqual(snapshot(lights.slice(0, 12)), sourceBefore);
  assert.equal(first.length, lights.length);
  assert.ok(first.every(descriptor => descriptor.family === PRACTICAL_LIGHT_FAMILIES.WARM_STREET));
  assert.ok(first.every(descriptor => Object.isFrozen(descriptor)));
});

test("presentation radius stays bounded below authored gameplay-era light radius and preserves source identity", () => {
  const descriptors = buildWarmStreetLightDescriptors(lights, worldBounds());
  const sourceById = new Map(lights.map(light => [String(light.id), light]));

  assert.ok(descriptors.every(descriptor => sourceById.has(descriptor.sourceId)));
  assert.ok(descriptors.every(descriptor => (
    descriptor.radius >= WARM_STREET_LIGHT_PRESENTATION.minimumRadius
      && descriptor.radius <= WARM_STREET_LIGHT_PRESENTATION.maximumRadius
  )));
  assert.ok(descriptors.every(descriptor => descriptor.radius <= Number(sourceById.get(descriptor.sourceId).radius)));
  assert.ok(descriptors.every(descriptor => descriptor.width > descriptor.radius));
  assert.ok(descriptors.every(descriptor => descriptor.height > descriptor.radius));
});

test("render-window culling keeps only nearby street sources plus a small bounded margin", () => {
  const anchor = lights[Math.floor(lights.length / 2)];
  const bounds = { x: anchor.x - 48, y: anchor.y - 48, w: 96, h: 96 };
  const descriptors = buildWarmStreetLightDescriptors(lights, bounds, { cullMargin: 24 });

  assert.ok(descriptors.length >= 1);
  assert.ok(descriptors.length < lights.length);
  assert.ok(descriptors.some(descriptor => descriptor.sourceId === String(anchor.id)));
  assert.ok(descriptors.every(descriptor => (
    descriptor.x >= bounds.x - 24
      && descriptor.x <= bounds.x + bounds.w + 24
      && descriptor.y >= bounds.y - 24
      && descriptor.y <= bounds.y + bounds.h + 24
  )));
});

test("broken-light compatibility input can suppress a source without mutating the authored collection", () => {
  const source = lights[0];
  const before = snapshot(source);
  const descriptors = buildWarmStreetLightDescriptors([source], null, {
    brokenLightIds: new Set([String(source.id)])
  });

  assert.deepEqual(descriptors, []);
  assert.deepEqual(snapshot(source), before);
});

test("all practical-light families retain soft low-alpha falloff instead of hard spotlight rings", () => {
  for (const style of Object.values(PRACTICAL_LIGHT_PRESENTATIONS)) {
    assert.ok(style.layers.length >= 12, style.family);
    assert.equal(style.layers[0].radiusScale, 1, style.family);
    assert.ok(style.layers.every(layer => layer.alpha > 0 && layer.alpha <= 0.02), style.family);
    assert.ok(style.layers.every((layer, index) => index === 0 || layer.radiusScale < style.layers[index - 1].radiusScale), style.family);
    assert.ok(style.layers.every((layer, index) => index === 0 || layer.alpha >= style.layers[index - 1].alpha), style.family);
  }
});

test("warm frontage spill is deterministic, sparse and restricted to ordinary building families", () => {
  assert.ok(buildings.length > 0);
  const sourceBefore = snapshot(buildings.slice(0, 12));
  const bounds = worldBounds();

  const first = buildWarmFrontageLightDescriptors(buildings, bounds);
  const second = buildWarmFrontageLightDescriptors(buildings, bounds);

  assert.deepEqual(first, second);
  assert.deepEqual(snapshot(buildings.slice(0, 12)), sourceBefore);
  assert.ok(first.length > 0, "city should contain at least one selected warm frontage");
  assert.ok(first.length < buildings.length, "frontage lighting must remain sparse rather than light every building");
  assert.ok(first.every(descriptor => descriptor.family === PRACTICAL_LIGHT_FAMILIES.WARM_FRONTAGE));
  assert.ok(first.every(descriptor => ["default", "residential", "commercial"].includes(descriptor.profileId)));
  assert.ok(first.every(descriptor => descriptor.frontage !== "none"));
  assert.ok(first.every(descriptor => Object.isFrozen(descriptor)));
});

test("generic warm frontage never overlaps explicit civic landmark identity", () => {
  const cityHall = buildingFixture("cityHall", "default");
  const warm = buildWarmFrontageLightDescriptors([cityHall], null);
  const civic = buildCoolCivicLightDescriptors([cityHall], null);

  assert.deepEqual(warm, []);
  assert.equal(civic.length, 1);
  assert.equal(civic[0].family, PRACTICAL_LIGHT_FAMILIES.COOL_CIVIC);
  assert.equal(civic[0].buildingId, "cityHall");
});

test("cool civic family is deterministic and limited to police, medical and explicit city hall identity", () => {
  const candidates = [
    buildingFixture("police-test", "police"),
    buildingFixture("hospital-test", "medical", { x: 320 }),
    buildingFixture("cityHall", "default", { x: 540 }),
    buildingFixture("club-test", "club", { x: 760 }),
    buildingFixture("church-test", "church", { x: 980 })
  ];
  const before = snapshot(candidates);
  const first = buildCoolCivicLightDescriptors(candidates, null);
  const second = buildCoolCivicLightDescriptors(candidates, null);

  assert.deepEqual(first, second);
  assert.deepEqual(snapshot(candidates), before);
  assert.equal(first.length, 3);
  assert.deepEqual(new Set(first.map(item => item.buildingId)), new Set(["police-test", "hospital-test", "cityHall"]));
  assert.ok(first.every(item => item.family === PRACTICAL_LIGHT_FAMILIES.COOL_CIVIC));
  assert.equal(first.some(item => item.profileId === "church"), false, "church is intentionally not guessed as civic");
});

test("nightlife family is restricted to club semantics and stays compact", () => {
  const candidates = [
    buildingFixture("club-test", "club"),
    buildingFixture("shop-test", "commercial", { x: 320 }),
    buildingFixture("police-test", "police", { x: 540 })
  ];
  const descriptors = buildNightlifeLightDescriptors(candidates, null);

  assert.equal(descriptors.length, 1);
  assert.equal(descriptors[0].buildingId, "club-test");
  assert.equal(descriptors[0].family, PRACTICAL_LIGHT_FAMILIES.NIGHTLIFE_ACCENT);
  assert.ok(Math.max(descriptors[0].width, descriptors[0].height) <= NIGHTLIFE_LIGHT_PRESENTATION.maximumSpan + NIGHTLIFE_LIGHT_PRESENTATION.outwardDepth + 4);
});

test("industrial dirty family uses service-strip semantics, remains deterministic and does not light every candidate", () => {
  const candidates = Array.from({ length: 24 }, (_, index) => buildingFixture(
    `service-${String(index).padStart(2, "0")}`,
    index % 2 === 0 ? "industrial" : "warehouse",
    { x: 80 + index * 170, y: 460 }
  ));
  const before = snapshot(candidates);
  const first = buildIndustrialDirtyLightDescriptors(candidates, null);
  const second = buildIndustrialDirtyLightDescriptors(candidates, null);

  assert.deepEqual(first, second);
  assert.deepEqual(snapshot(candidates), before);
  assert.ok(first.length > 0);
  assert.ok(first.length < candidates.length, "industrial service lighting must remain sparse");
  assert.ok(first.every(item => ["industrial", "warehouse"].includes(item.profileId)));
  assert.ok(first.every(item => item.sourceKind === "service-strip"));
  assert.ok(first.every(item => Boolean(item.serviceStrip)));
  assert.ok(first.every(item => item.family === PRACTICAL_LIGHT_FAMILIES.INDUSTRIAL_DIRTY));
});

test("building-family culling is local and incompatible semantic families do not overlap", () => {
  const candidates = [
    buildingFixture("police-near", "police", { x: 100, y: 100 }),
    buildingFixture("club-far", "club", { x: 1800, y: 1800 }),
    buildingFixture("ordinary-near", "residential", { x: 180, y: 130 })
  ];
  const bounds = { x: 40, y: 40, w: 360, h: 260 };
  const descriptors = buildContextualBuildingLightDescriptors(candidates, bounds);

  assert.equal(descriptors.some(item => item.buildingId === "club-far"), false);
  const familiesByBuilding = new Map();
  for (const descriptor of descriptors) {
    const families = familiesByBuilding.get(descriptor.buildingId) || new Set();
    families.add(descriptor.family);
    familiesByBuilding.set(descriptor.buildingId, families);
  }
  assert.ok([...familiesByBuilding.values()].every(families => families.size === 1));
});

test("frontage and contextual spill stay bounded and project outside their source building", () => {
  const candidates = [
    buildingFixture("cityHall", "default", { x: 400, y: 400 }),
    buildingFixture("club-test", "club", { x: 700, y: 400 })
  ];
  const descriptors = [
    ...buildCoolCivicLightDescriptors(candidates, null),
    ...buildNightlifeLightDescriptors(candidates, null)
  ];
  const buildingById = new Map(candidates.map(building => [String(building.id), building]));

  for (const descriptor of descriptors) {
    const building = buildingById.get(descriptor.buildingId);
    const style = descriptor.family === PRACTICAL_LIGHT_FAMILIES.COOL_CIVIC
      ? COOL_CIVIC_LIGHT_PRESENTATION
      : NIGHTLIFE_LIGHT_PRESENTATION;
    assert.ok(building, descriptor.buildingId);
    assert.ok(Math.max(descriptor.width, descriptor.height) <= style.maximumSpan + style.outwardDepth + 4);
    assert.ok(Math.min(descriptor.width, descriptor.height) > 0);
    if (descriptor.edge === "south") assert.ok(descriptor.y > building.y + building.h);
    if (descriptor.edge === "north") assert.ok(descriptor.y < building.y);
    if (descriptor.edge === "east") assert.ok(descriptor.x > building.x + building.w);
    if (descriptor.edge === "west") assert.ok(descriptor.x < building.x);
  }
});

test("contextual colour families remain restrained and visually distinct", () => {
  assert.notEqual(COOL_CIVIC_LIGHT_PRESENTATION.color, NIGHTLIFE_LIGHT_PRESENTATION.color);
  assert.notEqual(NIGHTLIFE_LIGHT_PRESENTATION.color, INDUSTRIAL_DIRTY_LIGHT_PRESENTATION.color);
  assert.ok(COOL_CIVIC_LIGHT_PRESENTATION.layers.at(-1).alpha <= 0.011);
  assert.ok(NIGHTLIFE_LIGHT_PRESENTATION.layers.at(-1).alpha <= 0.011);
  assert.ok(INDUSTRIAL_DIRTY_LIGHT_PRESENTATION.layers.at(-1).alpha <= 0.009);
  assert.ok(INDUSTRIAL_DIRTY_LIGHT_PRESENTATION.maximumSpan < COOL_CIVIC_LIGHT_PRESENTATION.maximumSpan);
});
