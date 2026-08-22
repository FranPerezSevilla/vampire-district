import assert from "node:assert/strict";
import test from "node:test";

import {
  VEHICLE_LIGHT_FAMILIES,
  VEHICLE_LIGHT_PRESENTATION,
  buildPlayerVehicleLightDescriptors,
  buildPoliceVehicleLightDescriptors,
  buildTrafficVehicleLightDescriptors,
  buildVehicleLightDescriptors
} from "../phaser/src/policies/CityVehicleLightPresentationPolicy.js";

function source(overrides = {}) {
  return {
    id: "vehicle-a",
    tokenId: "edge#1",
    unitId: "unit-a",
    slotIndex: 0,
    x: 100,
    y: 120,
    angle: 0,
    speed: 30,
    parked: false,
    handbrake: false,
    speedFactor: 1,
    desiredSpeedFactor: 1,
    archetype: { width: 32, height: 16 },
    container: { visible: true, active: true, x: 100, y: 120, rotation: 0 },
    ...overrides
  };
}

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

test("traffic light descriptors are deterministic, bounded and source-state preserving", () => {
  const slot = source();
  const before = snapshot(slot);
  const bounds = { x: 0, y: 0, width: 400, height: 300 };
  const first = buildTrafficVehicleLightDescriptors([slot], bounds);
  const second = buildTrafficVehicleLightDescriptors([slot], bounds);

  assert.deepEqual(first, second);
  assert.deepEqual(snapshot(slot), before);
  assert.equal(first.length, 2);
  assert.deepEqual(first.map(item => item.family), [
    VEHICLE_LIGHT_FAMILIES.HEADLIGHT,
    VEHICLE_LIGHT_FAMILIES.TAIL
  ]);
  assert.ok(first.every(Object.isFrozen));
  assert.ok(first[0].x > slot.x, "headlight contribution must project ahead of +X vehicle pose");
  assert.ok(first[1].x < slot.x, "tail contribution must remain behind the vehicle");
});

test("traffic braking only strengthens the tail contribution", () => {
  const cruising = buildTrafficVehicleLightDescriptors([source()], null);
  const braking = buildTrafficVehicleLightDescriptors([source({ desiredSpeedFactor: 0.25, speedFactor: 1 })], null);

  assert.equal(cruising[0].intensity, braking[0].intensity);
  assert.ok(braking[1].intensity > cruising[1].intensity);
  assert.equal(braking[1].braking, true);
});

test("current player vehicle contributes only while active/moving", () => {
  assert.deepEqual(buildPlayerVehicleLightDescriptors(source({ tokenId: undefined, unitId: undefined, parked: true, speed: 0 }), null), []);
  const moving = buildPlayerVehicleLightDescriptors(source({ tokenId: undefined, unitId: undefined, id: "player-car", speed: 24 }), null);
  assert.equal(moving.length, 2);
  assert.ok(moving.every(item => item.sourceId.startsWith("vehicle:player-car:")));
});

test("police pulse alternates red and blue intensity without moving source state", () => {
  const slot = source({ tokenId: undefined, unitId: "response-1", slotIndex: 1 });
  const before = snapshot(slot);
  const early = buildPoliceVehicleLightDescriptors([slot], null, 0);
  const later = buildPoliceVehicleLightDescriptors([slot], null, 180);

  assert.deepEqual(snapshot(slot), before);
  assert.equal(early.length, 4);
  const earlyRed = early.find(item => item.family === VEHICLE_LIGHT_FAMILIES.POLICE_RED);
  const earlyBlue = early.find(item => item.family === VEHICLE_LIGHT_FAMILIES.POLICE_BLUE);
  const laterRed = later.find(item => item.family === VEHICLE_LIGHT_FAMILIES.POLICE_RED);
  const laterBlue = later.find(item => item.family === VEHICLE_LIGHT_FAMILIES.POLICE_BLUE);
  assert.ok(earlyRed.intensity < earlyBlue.intensity);
  assert.ok(laterRed.intensity > laterBlue.intensity);
  assert.ok(Math.hypot(earlyRed.x - slot.x, earlyRed.y - slot.y) < slot.archetype.height);
  assert.ok(Math.hypot(earlyBlue.x - slot.x, earlyBlue.y - slot.y) < slot.archetype.height);
});

test("dynamic descriptor culling rejects offscreen traffic and police sources", () => {
  const bounds = { x: 0, y: 0, width: 200, height: 200 };
  const far = source({ x: 1000, y: 1000, container: { visible: true, active: true, x: 1000, y: 1000, rotation: 0 } });
  assert.deepEqual(buildTrafficVehicleLightDescriptors([far], bounds), []);
  assert.deepEqual(buildPoliceVehicleLightDescriptors([far], bounds, 0), []);
});

test("inactive or disabled dynamic sources do not emit", () => {
  assert.deepEqual(buildTrafficVehicleLightDescriptors([source({ container: { visible: false, active: true } })], null), []);
  assert.deepEqual(buildPoliceVehicleLightDescriptors([source({ disabled: true })], null, 0), []);
});

test("combined descriptor model remains small and uses only intended dynamic families", () => {
  const combined = buildVehicleLightDescriptors({
    trafficSlots: [source({ tokenId: "traffic#1", unitId: undefined })],
    currentVehicle: source({ tokenId: undefined, unitId: undefined, id: "current-car" }),
    policeSlots: [source({ tokenId: undefined, unitId: "police-1" })]
  }, { x: 0, y: 0, width: 500, height: 400 }, 360);
  const families = new Set(combined.map(item => item.family));

  assert.equal(combined.length, 8);
  assert.deepEqual(families, new Set(Object.values(VEHICLE_LIGHT_FAMILIES)));
  assert.ok(VEHICLE_LIGHT_PRESENTATION.headlightAlpha <= 0.03);
  assert.ok(VEHICLE_LIGHT_PRESENTATION.policeAlpha <= 0.06);
});
