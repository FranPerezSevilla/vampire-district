import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advanceBallisticProjectile,
  commitBallisticAdvance,
  createBallisticProjectile
} from "../phaser/src/combat/BallisticProjectile.js";
import { findVehicleHitscanImpact } from "../phaser/src/combat/HitscanWorldCollision.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("ballistic projectile advances visibly over time instead of resolving at trigger pull", () => {
  const projectile = createBallisticProjectile({
    id: "shot",
    attackId: 7,
    origin: { x: 10, y: 20 },
    direction: { x: 1, y: 0 },
    range: 100,
    speed: 200
  });
  const first = advanceBallisticProjectile(projectile, 0.1);
  assert.equal(first.distance, 20);
  assert.deepEqual(first.to, { x: 30, y: 20 });
  assert.equal(first.expiresAtEnd, false);
  commitBallisticAdvance(projectile, first);
  assert.equal(projectile.x, 30);
  assert.equal(projectile.remainingRange, 80);
  assert.equal(projectile.alive, true);
});

test("swept vehicle collision accepts a moving traffic proxy at the first segment", () => {
  const traffic = {
    id: "traffic:edge#0",
    trafficTokenId: "edge#0",
    projectileProxy: "traffic",
    x: 34,
    y: 0,
    angle: 0,
    layer: 0,
    archetype: { width: 20, height: 10 }
  };
  const hit = findVehicleHitscanImpact({
    origin: { x: 20, y: 0 },
    direction: { x: 1, y: 0 },
    range: 30,
    layer: 0,
    vehicles: [traffic],
    minimumVehicleDistance: 0
  });
  assert.equal(hit.vehicle.id, traffic.id);
  assert.equal(hit.distance, 4);
});

test("runtime owns short projectile visuals and stable traffic collider snapshots", () => {
  const combat = source("phaser/src/combat/CombatSystem.js");
  const traffic = source("phaser/src/streaming/TrafficLocalBehaviorSystem.js");
  assert.match(combat, /this\.projectiles = \[\]/);
  assert.match(combat, /advanceBallisticProjectile\(projectile, dt\)/);
  assert.match(combat, /trafficLocalBehaviorSystem\?\.projectileColliders/);
  assert.match(combat, /motorizedPoliceSystem\?\.projectileColliders/);
  assert.match(combat, /minimumVehicleDistance: 0/);
  assert.match(combat, /"traffic:bullet-hit"/);
  assert.match(combat, /projectileProxy === "motorized-police"/);
  assert.match(combat, /motorizedPoliceSystem\?\.damageUnit/);
  assert.doesNotMatch(combat, /this\.attack\.tracer = endpoint/);
  assert.doesNotMatch(combat, /lineTo\(endpoint\.x, endpoint\.y\)/);
  assert.match(traffic, /projectileColliders\(\)/);
  assert.match(traffic, /projectileProxy: "traffic"/);
});


test("motorized police exposes visible cruiser snapshots to projectile collision", () => {
  const police = source("phaser/src/police/MotorizedPoliceSystem.js");
  assert.match(police, /projectileColliders\(\)/);
  assert.match(police, /projectileProxy: "motorized-police"/);
  assert.match(police, /policeUnitId: unit\.id/);
  assert.match(police, /slot\?\.unitId === unit\.id/);
});
