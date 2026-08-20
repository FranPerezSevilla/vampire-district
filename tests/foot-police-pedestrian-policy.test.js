import test from "node:test";
import assert from "node:assert/strict";

import {
  districtZoneAt,
  LAYERS,
  pointOnPedestrianSurface,
  streetNavigationPoints
} from "../phaser/src/data/district.js";
import {
  installFootPolicePedestrianPolicy,
  nearestPedestrianPolicePoint,
  pedestrianPoliceRoutesForZone
} from "../phaser/src/policies/FootPolicePedestrianPolicy.js";
import { PoliceSystem } from "../phaser/src/systems/PoliceSystem.js";

globalThis.Phaser ||= {};
globalThis.Phaser.Math ||= {};
globalThis.Phaser.Math.Distance ||= {
  Between: (ax, ay, bx, by) => Math.hypot((Number(bx) || 0) - (Number(ax) || 0), (Number(by) || 0) - (Number(ay) || 0))
};

installFootPolicePedestrianPolicy();

function roadNavigationPoint() {
  return streetNavigationPoints.find(point => !pointOnPedestrianSurface(point.x, point.y));
}

function mockScene(player) {
  let canSeePlayer = false;
  const scene = {
    player,
    currentLayer: LAYERS.STREET,
    add: {
      graphics: () => ({ setDepth() { return this; } })
    },
    registry: {
      get: () => 0,
      set: () => {}
    },
    time: { now: 0 },
    npcSystem: {
      npcs: [],
      canNpcStandAt: () => true,
      rebuildSpatialIndex: () => {}
    },
    currentShadow: () => false,
    witnessSystem: {
      canWitnessSee: () => canSeePlayer
    },
    events: { emit: () => {} },
    lastActionText: ""
  };
  scene.setCanSeePlayer = value => { canSeePlayer = Boolean(value); };
  return scene;
}

function testCop(point) {
  return {
    id: "police-test",
    x: point.x,
    y: point.y,
    layer: LAYERS.STREET,
    active: true,
    retiringFromResponse: false,
    retirementTarget: null,
    soundReactionTimer: 0,
    chasingPlayer: false,
    searchIndex: 0,
    patrolIndex: 0,
    patrolOffsetIndex: 0,
    patrolPause: 0,
    investigateTarget: null
  };
}

test("foot-police route authority contains pedestrian-valid points only", () => {
  const zoneIds = new Set(streetNavigationPoints.map(point => districtZoneAt(point.x, point.y).id));
  assert.ok(zoneIds.size > 0);
  for (const zoneId of zoneIds) {
    const routes = pedestrianPoliceRoutesForZone(zoneId);
    assert.ok(routes.length > 0, `${zoneId} should have a pedestrian police route`);
    for (const route of routes) {
      assert.equal(route.surface, "pedestrian");
      assert.ok(route.points.length >= 2);
      assert.ok(
        route.points.every(point => pointOnPedestrianSurface(point.x, point.y)),
        `${route.id} must stay on pedestrian geometry`
      );
    }
  }
});

test("normal foot-response spawn resolves onto pedestrian geometry", () => {
  const road = roadNavigationPoint();
  assert.ok(road, "city topology should expose at least one road navigation point");
  const scene = mockScene({ id: "player", x: road.x, y: road.y, layer: LAYERS.STREET });
  const system = new PoliceSystem(scene);
  const point = system.responseSpawnPoint(1);
  assert.ok(point);
  assert.equal(pointOnPedestrianSurface(point.x, point.y), true);
});

test("an officer that loses pursuit on the roadway returns to pedestrian navigation before searching", () => {
  const road = roadNavigationPoint();
  assert.ok(road);
  const scene = mockScene({ id: "player", x: road.x + 500, y: road.y + 500, layer: LAYERS.STREET });
  scene.setCanSeePlayer(false);
  const system = new PoliceSystem(scene);
  const cop = testCop(road);
  cop.chasingPlayer = true;
  system.lastKnownPlayer = { x: road.x + 80, y: road.y + 40 };

  const returnTarget = system.targetForCop(cop, 1, { sight: 120, shadowSight: 0 });
  assert.equal(returnTarget.kind, "pedestrian-return");
  assert.equal(returnTarget.pedestrianReturn, true);
  assert.equal(pointOnPedestrianSurface(returnTarget.x, returnTarget.y), true);
  assert.equal(cop.pedestrianRecoveryActive, true);

  cop.x = returnTarget.x;
  cop.y = returnTarget.y;
  cop.chasingPlayer = false;
  const searchTarget = system.targetForCop(cop, 1, { sight: 120, shadowSight: 0 });
  assert.equal(searchTarget.kind, "search");
  assert.equal(searchTarget.pedestrianProjected, true);
  assert.equal(pointOnPedestrianSurface(searchTarget.x, searchTarget.y), true);
  assert.equal(cop.pedestrianRecoveryActive, false);
});

test("active visual pursuit remains free to target a player on the roadway", () => {
  const road = roadNavigationPoint();
  assert.ok(road);
  const pedestrian = nearestPedestrianPolicePoint(road.x, road.y, districtZoneAt(road.x, road.y).id);
  assert.ok(pedestrian);
  const scene = mockScene({ id: "player", x: road.x, y: road.y, layer: LAYERS.STREET });
  scene.setCanSeePlayer(true);
  const system = new PoliceSystem(scene);
  const cop = testCop(pedestrian);

  const target = system.targetForCop(cop, 2, { sight: 2000, shadowSight: 2000 });
  assert.equal(target.kind, "player");
  assert.equal(target.x, road.x);
  assert.equal(target.y, road.y);
  assert.equal(cop.pedestrianRecoveryActive, false);
});
