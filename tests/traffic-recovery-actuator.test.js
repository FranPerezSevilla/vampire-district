import test from "node:test";
import assert from "node:assert/strict";

import { executeStaticRecovery } from "../phaser/src/streaming/TrafficRecoveryActuator.js";

function fixture({ parked = true, speed = 0 } = {}) {
  const requester = {
    tokenId: "traffic-a",
    x: 0,
    y: 0,
    angle: 0,
    radius: 14
  };
  const vehicle = {
    id: "persistent-a",
    x: 34,
    y: 0,
    angle: 0,
    parked,
    speed,
    velocityX: speed,
    velocityY: 0,
    archetype: { width: 28, height: 14 },
    container: { setPosition() {} }
  };
  const vehicleSystem = {
    currentVehicleId: null,
    vehicles: [vehicle],
    vehicle(id) { return id === vehicle.id ? vehicle : null; },
    canOccupy() { return true; },
    persistVehicle() {}
  };
  const materializer = {
    pool: [requester],
    assignments: new Map([[requester.tokenId, requester]])
  };
  const scene = { vehicleSystem };
  return { scene, materializer, requester, vehicle, vehicleSystem };
}

test("static recovery has a hard cumulative displacement limit", () => {
  const { scene, materializer, requester, vehicle } = fixture();
  const origin = { x: vehicle.x, y: vehicle.y };
  let result = null;

  for (let index = 0; index < 30; index++) {
    result = executeStaticRecovery(scene, materializer, {
      requesterTokenId: requester.tokenId,
      vehicleId: vehicle.id,
      step: 5,
      maximumTotalDisplacement: 24
    });
    if (!result.success) break;
  }

  assert.equal(result.success, false);
  assert.equal(result.reason, "static-recovery-offset-limit");
  assert.ok(Math.hypot(vehicle.x - origin.x, vehicle.y - origin.y) <= 24);
});

test("static recovery never moves the currently driven vehicle", () => {
  const { scene, materializer, requester, vehicle, vehicleSystem } = fixture();
  vehicleSystem.currentVehicleId = vehicle.id;
  const before = { x: vehicle.x, y: vehicle.y };

  const result = executeStaticRecovery(scene, materializer, {
    requesterTokenId: requester.tokenId,
    vehicleId: vehicle.id
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, "static-recovery-target-driven");
  assert.deepEqual({ x: vehicle.x, y: vehicle.y }, before);
});

test("static recovery rejects a moving non-parked persistent vehicle", () => {
  const { scene, materializer, requester, vehicle } = fixture({ parked: false, speed: 12 });
  const before = { x: vehicle.x, y: vehicle.y };

  const result = executeStaticRecovery(scene, materializer, {
    requesterTokenId: requester.tokenId,
    vehicleId: vehicle.id
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, "static-recovery-target-moving");
  assert.deepEqual({ x: vehicle.x, y: vehicle.y }, before);
});