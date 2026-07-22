import test from "node:test";
import assert from "node:assert/strict";

import { RawAudio } from "../phaser/src/systems/RawAudioSystem.js";
import {
  trafficImpactDamage,
  trafficImpactExposure,
  trafficImpactTier,
  TrafficImpactConsequencesSystem
} from "../phaser/src/streaming/TrafficImpactConsequencesSystem.js";

function vehicle() {
  return {
    id: "player-car",
    name: "Player car",
    x: 200,
    y: 100,
    angle: 0,
    travelAngle: 0,
    driftAngle: 0.2,
    speed: 150,
    velocityX: 150,
    velocityY: 0,
    health: 88,
    disabled: false,
    archetype: { maxHealth: 88 }
  };
}

function fakeScene(impactSpeed = 160) {
  const driven = vehicle();
  const physicalState = {
    tokenId: "edge#0",
    holdSeconds: 0,
    lastReason: "pushed",
    lastImpactSpeed: impactSpeed,
    lastVehicleId: driven.id
  };
  const physical = {
    initialization: Promise.resolve(),
    totalContacts: 0,
    lastContact: null,
    states: new Map([["edge#0", physicalState]]),
    materializer: {
      lanes: {
        impacts: {
          hardThreshold: 125,
          severeThreshold: 210,
          damageThreshold: 105,
          damageScale: 0.018,
          hardMinimumDamage: 4,
          severeMinimumDamage: 16,
          severeDamageMultiplier: 1.35,
          hardExposure: 2,
          severeExposure: 5,
          maximumExposure: 7,
          hardHeatMinimum: 7,
          severeHeatMinimum: 15,
          maximumHeat: 24,
          impactCooldownSeconds: 0.9,
          hardHoldSeconds: 0.42,
          severeStallSeconds: 2.2,
          hardSpeedRetention: 0.68,
          severeSpeedRetention: 0.35
        }
      }
    },
    behaviorConstraintFor() { return null; },
    activeSlots() { return [{ tokenId: "edge#0" }]; }
  };
  const exposure = { value: 0, add(amount) { this.value += amount; } };
  const police = { heat: 0, addHeat(x, y, amount) { this.heat += amount; } };
  const vehicleSystem = {
    currentVehicleId: driven.id,
    currentVehicle() { return driven; },
    updateDriving() {
      physical.totalContacts++;
      physical.lastContact = {
        tokenId: "edge#0",
        vehicleId: driven.id,
        impactSpeed,
        pushed: true,
        blocked: false
      };
      return true;
    },
    damageVehicle(id, amount) {
      assert.equal(id, driven.id);
      driven.health = Math.max(0, driven.health - amount);
      driven.disabled = driven.health <= 0;
      return true;
    },
    persistVehicle(target) { target.persisted = true; return true; }
  };
  return {
    currentLayer: 0,
    registry: { get() { return false; } },
    events: { once() {} },
    statePublisher: { setMany() {} },
    exposureSystem: exposure,
    policeSystem: police,
    trafficPhysicalConsequencesSystem: physical,
    vehicleSystem,
    lastActionText: "",
    driven,
    physical,
    exposure,
    police,
    setImpactSpeed(value) { impactSpeed = value; }
  };
}

async function withMutedAudio(callback) {
  const original = RawAudio.play;
  RawAudio.play = () => true;
  try {
    return await callback();
  } finally {
    RawAudio.play = original;
  }
}

test("impact helpers preserve the soft, hard and severe boundaries", () => {
  assert.equal(trafficImpactTier(124), "soft");
  assert.equal(trafficImpactTier(125), "hard");
  assert.equal(trafficImpactTier(209), "hard");
  assert.equal(trafficImpactTier(210), "severe");
  assert.equal(trafficImpactDamage(100), 0);
  assert.ok(trafficImpactDamage(160) >= 4);
  assert.ok(trafficImpactDamage(230) > trafficImpactDamage(160));
  assert.equal(trafficImpactExposure(100), 0);
  assert.ok(trafficImpactExposure(230) > trafficImpactExposure(160));
});

test("soft traffic contact stays inside 4E without damage, exposure or heat", async () => withMutedAudio(async () => {
  const scene = fakeScene(100);
  const originalDriving = scene.vehicleSystem.updateDriving;
  const impacts = new TrafficImpactConsequencesSystem(scene);
  await impacts.initialization;
  scene.vehicleSystem.updateDriving(0.05, {});
  const snapshot = impacts.snapshot();

  assert.equal(snapshot.totalSoftContacts, 1);
  assert.equal(snapshot.totalHardImpacts, 0);
  assert.equal(snapshot.totalSevereImpacts, 0);
  assert.equal(scene.driven.health, 88);
  assert.equal(scene.exposure.value, 0);
  assert.equal(scene.police.heat, 0);
  impacts.destroy();
  assert.equal(scene.vehicleSystem.updateDriving, originalDriving);
}));

test("hard impact damages once and suppresses repeated frame contact during cooldown", async () => withMutedAudio(async () => {
  const scene = fakeScene(160);
  const originalDriving = scene.vehicleSystem.updateDriving;
  const originalConstraint = scene.physical.behaviorConstraintFor;
  const impacts = new TrafficImpactConsequencesSystem(scene);
  await impacts.initialization;

  scene.vehicleSystem.updateDriving(0.05, {});
  const afterFirst = impacts.snapshot();
  const healthAfterFirst = scene.driven.health;
  const exposureAfterFirst = scene.exposure.value;
  const heatAfterFirst = scene.police.heat;

  assert.equal(afterFirst.totalHardImpacts, 1);
  assert.equal(afterFirst.totalSevereImpacts, 0);
  assert.ok(healthAfterFirst < 88);
  assert.ok(exposureAfterFirst > 0);
  assert.ok(heatAfterFirst > 0);
  assert.ok(Math.abs(scene.driven.speed) < 150);
  assert.equal(scene.driven.persisted, true);

  scene.vehicleSystem.updateDriving(0.05, {});
  const afterSecond = impacts.snapshot();
  assert.equal(afterSecond.totalHardImpacts, 1);
  assert.equal(afterSecond.totalSuppressedImpacts, 1);
  assert.equal(scene.driven.health, healthAfterFirst);
  assert.equal(scene.exposure.value, exposureAfterFirst);
  assert.equal(scene.police.heat, heatAfterFirst);

  impacts.destroy();
  assert.equal(scene.vehicleSystem.updateDriving, originalDriving);
  assert.equal(scene.physical.behaviorConstraintFor, originalConstraint);
}));

test("severe impact stalls the proxy and exposes an impact-stalled behavior reason", async () => withMutedAudio(async () => {
  const scene = fakeScene(230);
  const impacts = new TrafficImpactConsequencesSystem(scene);
  await impacts.initialization;
  scene.vehicleSystem.updateDriving(0.05, {});

  const snapshot = impacts.snapshot();
  const state = snapshot.impacts[0];
  const constraint = scene.physical.behaviorConstraintFor({ tokenId: "edge#0" });

  assert.equal(snapshot.totalHardImpacts, 0);
  assert.equal(snapshot.totalSevereImpacts, 1);
  assert.equal(snapshot.activeStalls, 1);
  assert.ok(state.stallSeconds > 2);
  assert.equal(constraint.reason, "impact-stalled");
  assert.ok(scene.physical.states.get("edge#0").holdSeconds > 2);
  assert.match(scene.lastActionText, /Severe traffic impact/i);

  impacts.update(2.3, { force: true });
  assert.equal(impacts.snapshot().activeStalls, 0);
  impacts.destroy();
}));
