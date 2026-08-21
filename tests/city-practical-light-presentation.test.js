import assert from "node:assert/strict";
import test from "node:test";

import { buildings, CITY_WORLD, lights } from "../phaser/src/data/district.js";
import {
  PRACTICAL_LIGHT_FAMILIES,
  WARM_FRONTAGE_LIGHT_PRESENTATION,
  WARM_STREET_LIGHT_PRESENTATION,
  buildWarmFrontageLightDescriptors,
  buildWarmStreetLightDescriptors
} from "../phaser/src/policies/CityPracticalLightPresentationPolicy.js";

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

test("warm practical light descriptors are deterministic and do not mutate authored light semantics", () => {
  assert.ok(lights.length > 0, "generated city must expose practical-light anchors");
  const sourceBefore = snapshot(lights.slice(0, 12));
  const bounds = { x: 0, y: 0, w: CITY_WORLD.width, h: CITY_WORLD.height };

  const first = buildWarmStreetLightDescriptors(lights, bounds);
  const second = buildWarmStreetLightDescriptors(lights, bounds);

  assert.deepEqual(first, second);
  assert.deepEqual(snapshot(lights.slice(0, 12)), sourceBefore);
  assert.equal(first.length, lights.length);
  assert.ok(first.every(descriptor => descriptor.family === PRACTICAL_LIGHT_FAMILIES.WARM_STREET));
  assert.ok(first.every(descriptor => Object.isFrozen(descriptor)));
});

test("presentation radius stays bounded below authored gameplay-era light radius and preserves source identity", () => {
  const descriptors = buildWarmStreetLightDescriptors(lights, {
    x: 0,
    y: 0,
    w: CITY_WORLD.width,
    h: CITY_WORLD.height
  });
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

test("render-window culling keeps only nearby sources plus a small bounded margin", () => {
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

test("warm street falloff uses many low-alpha fills instead of visible spotlight bands", () => {
  const layers = WARM_STREET_LIGHT_PRESENTATION.layers;
  assert.ok(layers.length >= 12);
  assert.equal(layers[0].radiusScale, 1);
  assert.ok(layers.every(layer => layer.alpha > 0 && layer.alpha <= 0.02));
  assert.ok(layers.every((layer, index) => index === 0 || layer.radiusScale < layers[index - 1].radiusScale));
  assert.ok(layers.every((layer, index) => index === 0 || layer.alpha >= layers[index - 1].alpha));
});

test("warm frontage spill is deterministic, sparse and restricted to ordinary building families", () => {
  assert.ok(buildings.length > 0);
  const sourceBefore = snapshot(buildings.slice(0, 12));
  const bounds = { x: 0, y: 0, w: CITY_WORLD.width, h: CITY_WORLD.height };

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

test("frontage spill stays compact and projects outside the selected authored frontage edge", () => {
  const descriptors = buildWarmFrontageLightDescriptors(buildings, {
    x: 0,
    y: 0,
    w: CITY_WORLD.width,
    h: CITY_WORLD.height
  });
  const buildingById = new Map(buildings.map(building => [String(building.id), building]));

  for (const descriptor of descriptors) {
    const building = buildingById.get(descriptor.buildingId);
    assert.ok(building, descriptor.buildingId);
    assert.ok(Math.max(descriptor.width, descriptor.height) <= WARM_FRONTAGE_LIGHT_PRESENTATION.maximumSpan + WARM_FRONTAGE_LIGHT_PRESENTATION.outwardDepth);
    assert.ok(Math.min(descriptor.width, descriptor.height) > 0);
    if (descriptor.edge === "south") assert.ok(descriptor.y > building.y + building.h);
    if (descriptor.edge === "north") assert.ok(descriptor.y < building.y);
    if (descriptor.edge === "east") assert.ok(descriptor.x > building.x + building.w);
    if (descriptor.edge === "west") assert.ok(descriptor.x < building.x);
  }
});
