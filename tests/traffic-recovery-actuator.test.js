import test from "node:test";
import assert from "node:assert/strict";

import {
  executeDrivenVehiclePressure,
  executeStaticRecovery
} from "../phaser/src/streaming/TrafficRecoveryActuator.js";

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
    container: {
      setPosition(x, y) {
        this.x = x;
        this.y = y;
      }
    }
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
    assignments: new Map([[requester.tokenId, requester]]),
    originalVehicleCanOccupy() { return true; },
    blocksVehicle(_x, _y, _radius, { ignoreTokenId } = {}) {
      return this.pool.some(slot => slot.tokenId && slot.tokenId !== ignoreTokenId);
    }
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

test("stationary player vehicle can be nudged by an aggressive blocked traffic car", () => {
  const { scene, materializer, requester, vehicle, vehicleSystem } = fixture({ parked: false, speed: 0 });
  vehicleSystem.currentVehicleId = vehicle.id;
  const beforeX = vehicle.x;

  const result = executeDrivenVehiclePressure(scene, materializer, {
    requesterTokenId: requester.tokenId,
    vehicleId: vehicle.id,
    step: 4
  });

  assert.equal(result.success, true);
  assert.equal(result.reason, "player-pressure-nudge");
  assert.ok(vehicle.x > beforeX);
  assert.equal(vehicle.container.x, vehicle.x);
});

test("aggressive pressure backs off when the player is already moving", () => {
  const { scene, materializer, requester, vehicle, vehicleSystem } = fixture({ parked: false, speed: 24 });
  vehicleSystem.currentVehicleId = vehicle.id;
  const before = { x: vehicle.x, y: vehicle.y };

  const result = executeDrivenVehiclePressure(scene, materializer, {
    requesterTokenId: requester.tokenId,
    vehicleId: vehicle.id
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, "player-pressure-target-moving");
  assert.deepEqual({ x: vehicle.x, y: vehicle.y }, before);
});
