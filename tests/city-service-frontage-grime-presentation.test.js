import assert from "node:assert/strict";
import test from "node:test";

import { buildings, crosswalks, roads } from "../phaser/src/data/district.js";
import {
  CITY_GRIME_FAMILIES,
  SERVICE_FRONTAGE_GRIME_PRESENTATION,
  buildServiceFrontageGrimeDescriptors,
  pointInsideSurface
} from "../phaser/src/policies/CityGrimePresentationPolicy.js";

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function building(id, x, y, profileId, extra = {}) {
  return {
    id,
    x,
    y,
    w: 120,
    h: 84,
    presentation: { profileId, ...(extra.presentation || {}) },
    ...extra
  };
}

function testPresentation(overrides = {}) {
  return {
    ...SERVICE_FRONTAGE_GRIME_PRESENTATION,
    profileChance: { industrial: 100, warehouse: 100, commercial: 100 },
    ...overrides
  };
}

test("service-frontage grime is deterministic and does not mutate building inputs", () => {
  const source = [
    building("factory-a", 100, 100, "industrial"),
    building("warehouse-a", 420, 100, "warehouse"),
    building("shop-a", 740, 100, "commercial", { presentation: { profileId: "commercial", frontageEdge: "south" } })
  ];
  const before = snapshot(source);
  const options = { sourceRoads: [], sourceCrosswalks: [], presentation: testPresentation() };
  const first = buildServiceFrontageGrimeDescriptors(source, null, options);
  const second = buildServiceFrontageGrimeDescriptors([...source].reverse(), null, options);

  assert.deepEqual(first, second, "input ordering must not affect deterministic grime placement");
  assert.deepEqual(snapshot(source), before);
  assert.equal(first.length, 3);
  assert.ok(first.every(Object.isFrozen));
  assert.ok(first.every(item => item.family === CITY_GRIME_FAMILIES.SERVICE_FRONTAGE));
  assert.ok(first.every(item => item.fragments.length >= 1 && item.fragments.length <= 3));
  assert.ok(first.every(item => item.fragments.every(Object.isFrozen)));
});

test("only the audited service/frontage profile allow-list is eligible", () => {
  const source = [
    building("factory", 100, 100, "industrial"),
    building("warehouse", 400, 100, "warehouse"),
    building("shop", 700, 100, "commercial"),
    building("home", 1000, 100, "residential"),
    building("clinic", 1300, 100, "medical"),
    building("club", 1600, 100, "club")
  ];
  const descriptors = buildServiceFrontageGrimeDescriptors(source, null, {
    sourceRoads: [],
    sourceCrosswalks: [],
    presentation: testPresentation()
  });

  assert.deepEqual(new Set(descriptors.map(item => item.profileId)), new Set(["industrial", "warehouse", "commercial"]));
  assert.ok(descriptors.find(item => item.profileId === "industrial")?.serviceStrip);
  assert.ok(descriptors.find(item => item.profileId === "warehouse")?.serviceStrip);
  assert.equal(descriptors.find(item => item.profileId === "commercial")?.sourceKind, "frontage");
});

test("road and crosswalk receiving points are rejected rather than painted over", () => {
  const source = [building("factory-blocked", 100, 100, "industrial")];
  const blockingSurface = { id: "blocking", x: 50, y: 50, w: 220, h: 190 };
  const roadBlocked = buildServiceFrontageGrimeDescriptors(source, null, {
    sourceRoads: [blockingSurface],
    sourceCrosswalks: [],
    presentation: testPresentation()
  });
  const crosswalkBlocked = buildServiceFrontageGrimeDescriptors(source, null, {
    sourceRoads: [],
    sourceCrosswalks: [blockingSurface],
    presentation: testPresentation()
  });

  assert.deepEqual(roadBlocked, []);
  assert.deepEqual(crosswalkBlocked, []);
});

test("descriptor and fragment caps keep the family low-frequency", () => {
  const source = Array.from({ length: 10 }, (_, index) => (
    building(`factory-${index}`, index * 260, 100, "industrial")
  ));
  const presentation = testPresentation({ maximumDescriptors: 2, maximumFragmentsPerDescriptor: 2 });
  const descriptors = buildServiceFrontageGrimeDescriptors(source, null, {
    sourceRoads: [],
    sourceCrosswalks: [],
    presentation
  });

  assert.equal(descriptors.length, 2);
  assert.ok(descriptors.every(item => item.fragments.length <= 2));
  assert.ok(descriptors.every(item => item.fragments.every(fragment => fragment.alpha <= 0.25)));
});

test("render-window culling skips buildings outside the active presentation window", () => {
  const source = [
    building("near", 100, 100, "industrial"),
    building("far", 1200, 1200, "industrial")
  ];
  const descriptors = buildServiceFrontageGrimeDescriptors(source, { x: 0, y: 0, w: 420, h: 320 }, {
    sourceRoads: [],
    sourceCrosswalks: [],
    presentation: testPresentation()
  });
  assert.deepEqual(descriptors.map(item => item.buildingId), ["near"]);
});

test("production grime fragments stay outside roads and crosswalks and remain compact", () => {
  const descriptors = buildServiceFrontageGrimeDescriptors(buildings, null);
  assert.ok(descriptors.length > 0, "production city should expose at least one audited service-frontage grime anchor");
  assert.ok(descriptors.length <= SERVICE_FRONTAGE_GRIME_PRESENTATION.maximumDescriptors);

  for (const descriptor of descriptors) {
    assert.ok(["industrial", "warehouse", "commercial"].includes(descriptor.profileId));
    assert.ok(descriptor.fragments.length <= SERVICE_FRONTAGE_GRIME_PRESENTATION.maximumFragmentsPerDescriptor);
    for (const fragment of descriptor.fragments) {
      assert.equal(roads.some(surface => pointInsideSurface(fragment, surface)), false, descriptor.sourceId);
      assert.equal(crosswalks.some(surface => pointInsideSurface(fragment, surface)), false, descriptor.sourceId);
      const xs = fragment.points.map(point => point.x);
      const ys = fragment.points.map(point => point.y);
      assert.ok(Math.max(...xs) - Math.min(...xs) <= 30);
      assert.ok(Math.max(...ys) - Math.min(...ys) <= 30);
      assert.ok(fragment.alpha >= 0.18 && fragment.alpha <= 0.25);
    }
  }
});
