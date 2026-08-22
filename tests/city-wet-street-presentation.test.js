import assert from "node:assert/strict";
import test from "node:test";

import { roads } from "../phaser/src/data/district.js";
import { PRACTICAL_LIGHT_FAMILIES } from "../phaser/src/policies/CityPracticalLightPresentationPolicy.js";
import { VEHICLE_LIGHT_FAMILIES } from "../phaser/src/policies/CityVehicleLightPresentationPolicy.js";
import {
  WET_REFLECTION_PRESENTATION,
  buildWetRoadReflectionDescriptors,
  findNearestRoadReceiver,
  pointInsideRoadSurface
} from "../phaser/src/policies/CityWetStreetPresentationPolicy.js";

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

const rectRoad = Object.freeze({ id: "road-a", x: 100, y: 100, w: 180, h: 80, geometry: "rect" });
const polygonRoad = Object.freeze({
  id: "road-poly",
  geometry: "polygon",
  points: Object.freeze([
    Object.freeze({ x: 360, y: 100 }),
    Object.freeze({ x: 500, y: 120 }),
    Object.freeze({ x: 490, y: 190 }),
    Object.freeze({ x: 350, y: 170 })
  ])
});

test("road receiver selects the deterministic nearest eligible asphalt surface", () => {
  const source = { sourceId: "lamp", family: PRACTICAL_LIGHT_FAMILIES.WARM_STREET, x: 140, y: 86 };
  const first = findNearestRoadReceiver(source, [polygonRoad, rectRoad], { maximumDistance: 40 });
  const second = findNearestRoadReceiver(source, [rectRoad, polygonRoad], { maximumDistance: 40 });

  assert.ok(first);
  assert.equal(first.roadId, "road-a");
  assert.equal(second.roadId, "road-a");
  assert.ok(first.distance <= 14.01);
  assert.equal(pointInsideRoadSurface(first.receivingPoint, rectRoad), true);
});

test("polygon receiver projection moves the reflection centre inside the polygon", () => {
  const source = { sourceId: "cool", family: PRACTICAL_LIGHT_FAMILIES.COOL_CIVIC, x: 420, y: 92 };
  const receiver = findNearestRoadReceiver(source, [polygonRoad], { maximumDistance: 80 });
  assert.ok(receiver);
  assert.equal(receiver.roadId, "road-poly");
  assert.equal(pointInsideRoadSurface(receiver.receivingPoint, polygonRoad), true);
});

test("wet descriptors are deterministic, source-preserving and attach every fragment to a real road receiver", () => {
  assert.ok(roads.length > 0);
  const road = roads.find(candidate => candidate.geometry !== "polygon") || roads[0];
  const x = Number(road.x) + Number(road.w) / 2;
  const y = Number(road.y) + Number(road.h) / 2;
  const sources = [
    { sourceId: "warm", family: PRACTICAL_LIGHT_FAMILIES.WARM_STREET, x, y, intensity: 1 },
    { sourceId: "night", family: PRACTICAL_LIGHT_FAMILIES.NIGHTLIFE_ACCENT, x: x + 8, y: y + 4, intensity: 1 }
  ];
  const before = snapshot(sources);
  const first = buildWetRoadReflectionDescriptors(sources, roads);
  const second = buildWetRoadReflectionDescriptors(sources, roads);
  const roadById = new Map(roads.map(item => [String(item.id), item]));

  assert.deepEqual(first, second);
  assert.deepEqual(snapshot(sources), before);
  assert.equal(first.length, 2);
  for (const reflection of first) {
    const receiver = roadById.get(reflection.receiverRoadId);
    assert.ok(receiver, reflection.receiverRoadId);
    assert.ok(reflection.fragments.length >= 3);
    assert.ok(reflection.fragments.every(fragment => pointInsideRoadSurface(fragment, receiver)));
    assert.ok(reflection.fragments.every(fragment => fragment.alpha >= WET_REFLECTION_PRESENTATION.minimumFragmentAlpha));
    assert.ok(reflection.fragments.every(fragment => fragment.alpha <= WET_REFLECTION_PRESENTATION.maximumFragmentAlpha));
  }
});

test("far sources do not invent a receiving road", () => {
  const source = { sourceId: "far", family: PRACTICAL_LIGHT_FAMILIES.WARM_FRONTAGE, x: -1000, y: -1000 };
  assert.equal(findNearestRoadReceiver(source, [rectRoad], { maximumDistance: 90 }), null);
  assert.deepEqual(buildWetRoadReflectionDescriptors([source], [rectRoad]), []);
});

test("unknown light families are ignored rather than creating arbitrary reflection colour", () => {
  const source = { sourceId: "unknown", family: "future-light", x: 150, y: 130 };
  assert.deepEqual(buildWetRoadReflectionDescriptors([source], [rectRoad]), []);
});

test("vehicle head/tail and police families reuse source intensity for bounded dynamic wet response", () => {
  const lowPolice = { sourceId: "police:red:low", family: VEHICLE_LIGHT_FAMILIES.POLICE_RED, x: 150, y: 140, dirX: 1, dirY: 0, intensity: 0.22 };
  const highPolice = { sourceId: "police:red:high", family: VEHICLE_LIGHT_FAMILIES.POLICE_RED, x: 150, y: 140, dirX: 1, dirY: 0, intensity: 1 };
  const head = { sourceId: "car:head", family: VEHICLE_LIGHT_FAMILIES.HEADLIGHT, x: 150, y: 140, dirX: 1, dirY: 0, intensity: 1 };
  const tail = { sourceId: "car:tail", family: VEHICLE_LIGHT_FAMILIES.TAIL, x: 150, y: 140, dirX: 1, dirY: 0, intensity: 0.72 };
  const reflections = buildWetRoadReflectionDescriptors([lowPolice, highPolice, head, tail], [rectRoad]);

  assert.equal(reflections.length, 4);
  const [low, high, headWet, tailWet] = reflections;
  const average = item => item.fragments.reduce((sum, fragment) => sum + fragment.alpha, 0) / item.fragments.length;
  assert.ok(average(high) > average(low));
  assert.equal(headWet.dynamic, true);
  assert.equal(tailWet.dynamic, true);
  assert.ok(headWet.fragments[0].axisX > 0, "headlight reflection should follow forward direction");
  assert.ok(tailWet.fragments[0].axisX < 0, "tail reflection should reverse the vehicle forward direction");
});

test("render-window culling keeps wet receiver work local", () => {
  const sources = [
    { sourceId: "near", family: PRACTICAL_LIGHT_FAMILIES.WARM_STREET, x: 140, y: 130 },
    { sourceId: "far", family: PRACTICAL_LIGHT_FAMILIES.WARM_STREET, x: 900, y: 900 }
  ];
  const reflections = buildWetRoadReflectionDescriptors(sources, [rectRoad], {
    renderBounds: { x: 80, y: 80, w: 260, h: 180 }
  });
  assert.deepEqual(reflections.map(item => item.sourceId), ["near"]);
});
