import assert from "node:assert/strict";
import test from "node:test";

import { buildings, crosswalks, roads } from "../phaser/src/data/district.js";
import { buildServiceFrontageGrimeDescriptors, pointInsideSurface } from "../phaser/src/policies/CityGrimePresentationPolicy.js";
import {
  CITY_SERVICE_CORNER_FAMILIES,
  SERVICE_CORNER_DRESSING_PRESENTATION,
  buildServiceCornerDressingDescriptors
} from "../phaser/src/policies/CityServiceCornerDressingPolicy.js";

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function building(id, x, y, profileId) {
  return {
    id,
    x,
    y,
    w: 120,
    h: 84,
    presentation: { profileId }
  };
}

function grimeDescriptor(buildingId, profileId, edge = "south", sourceKind = "service-strip") {
  return {
    sourceId: `building:${buildingId}:service-frontage-grime`,
    buildingId,
    family: "service-frontage-grime",
    profileId,
    sourceKind,
    edge,
    x: 0,
    y: 0,
    fragments: []
  };
}

function presentation(overrides = {}) {
  return {
    ...SERVICE_CORNER_DRESSING_PRESENTATION,
    profileChance: { industrial: 100, warehouse: 100 },
    ...overrides
  };
}

test("service-corner dressing is deterministic and does not mutate source data", () => {
  const sourceBuildings = [
    building("factory-a", 100, 100, "industrial"),
    building("warehouse-a", 420, 100, "warehouse")
  ];
  const grime = [
    grimeDescriptor("factory-a", "industrial"),
    grimeDescriptor("warehouse-a", "warehouse", "north")
  ];
  const beforeBuildings = snapshot(sourceBuildings);
  const beforeGrime = snapshot(grime);
  const options = { sourceRoads: [], sourceCrosswalks: [], presentation: presentation() };
  const first = buildServiceCornerDressingDescriptors(sourceBuildings, grime, null, options);
  const second = buildServiceCornerDressingDescriptors([...sourceBuildings].reverse(), [...grime].reverse(), null, options);

  assert.deepEqual(first, second);
  assert.deepEqual(snapshot(sourceBuildings), beforeBuildings);
  assert.deepEqual(snapshot(grime), beforeGrime);
  assert.equal(first.length, 2);
  assert.ok(first.every(item => item.family === CITY_SERVICE_CORNER_FAMILIES.LITTER));
  assert.ok(first.every(item => item.sourceKind === "service-corner"));
  assert.ok(first.every(Object.isFrozen));
  assert.ok(first.every(item => item.fragments.every(Object.isFrozen)));
});

test("only existing service-strip grime anchors can seed service-corner dressing", () => {
  const sourceBuildings = [
    building("factory", 100, 100, "industrial"),
    building("warehouse", 400, 100, "warehouse"),
    building("shop", 700, 100, "commercial")
  ];
  const grime = [
    grimeDescriptor("factory", "industrial"),
    grimeDescriptor("warehouse", "warehouse"),
    grimeDescriptor("shop", "commercial", "south", "frontage")
  ];
  const descriptors = buildServiceCornerDressingDescriptors(sourceBuildings, grime, null, {
    sourceRoads: [], sourceCrosswalks: [], presentation: presentation()
  });

  assert.deepEqual(new Set(descriptors.map(item => item.profileId)), new Set(["industrial", "warehouse"]));
  assert.equal(descriptors.some(item => item.buildingId === "shop"), false);
});

test("road and crosswalk receivers are rejected", () => {
  const sourceBuildings = [building("factory", 100, 100, "industrial")];
  const grime = [grimeDescriptor("factory", "industrial")];
  const blocker = { id: "blocker", x: 40, y: 40, w: 240, h: 220 };

  const roadBlocked = buildServiceCornerDressingDescriptors(sourceBuildings, grime, null, {
    sourceRoads: [blocker], sourceCrosswalks: [], presentation: presentation()
  });
  const crosswalkBlocked = buildServiceCornerDressingDescriptors(sourceBuildings, grime, null, {
    sourceRoads: [], sourceCrosswalks: [blocker], presentation: presentation()
  });

  assert.deepEqual(roadBlocked, []);
  assert.deepEqual(crosswalkBlocked, []);
});

test("descriptor, fragment and culling caps remain bounded", () => {
  const sourceBuildings = Array.from({ length: 8 }, (_, index) => building(`factory-${index}`, index * 260, 100, "industrial"));
  const grime = sourceBuildings.map(item => grimeDescriptor(item.id, "industrial"));
  const descriptors = buildServiceCornerDressingDescriptors(sourceBuildings, grime, { x: 0, y: 0, w: 950, h: 350 }, {
    sourceRoads: [],
    sourceCrosswalks: [],
    presentation: presentation({ maximumDescriptors: 2, maximumFragmentsPerDescriptor: 2 })
  });

  assert.equal(descriptors.length, 2);
  assert.ok(descriptors.every(item => item.fragments.length <= 2));
});

test("production service-corner litter stays compact, dull and off road/crosswalk surfaces", () => {
  const grime = buildServiceFrontageGrimeDescriptors(buildings, null);
  const descriptors = buildServiceCornerDressingDescriptors(buildings, grime, null);
  assert.ok(descriptors.length > 0, "production city should expose at least one service-corner dressing composition");
  assert.ok(descriptors.length <= SERVICE_CORNER_DRESSING_PRESENTATION.maximumDescriptors);

  for (const descriptor of descriptors) {
    assert.ok(["industrial", "warehouse"].includes(descriptor.profileId));
    assert.ok(descriptor.fragments.length <= SERVICE_CORNER_DRESSING_PRESENTATION.maximumFragmentsPerDescriptor);
    for (const fragment of descriptor.fragments) {
      assert.equal(roads.some(surface => pointInsideSurface(fragment, surface)), false, descriptor.sourceId);
      assert.equal(crosswalks.some(surface => pointInsideSurface(fragment, surface)), false, descriptor.sourceId);
      const xs = fragment.points.map(point => point.x);
      const ys = fragment.points.map(point => point.y);
      assert.ok(Math.max(...xs) - Math.min(...xs) <= 7);
      assert.ok(Math.max(...ys) - Math.min(...ys) <= 7);
      assert.ok(fragment.alpha >= 0.24 && fragment.alpha <= 0.32);
    }
  }
});
