import test from "node:test";
import assert from "node:assert/strict";

import {
  installTrafficBypassManeuverPolicy,
  planTrafficBypass,
  trafficBypassRoadCapacity
} from "../phaser/src/streaming/TrafficBypassManeuverPolicy.js";

function slot(tokenId = "traffic-a") {
  return {
    tokenId,
    routeActive: true,
    x: 40,
    y: 0,
    angle: 0,
    radius: 14,
    archetype: { width: 28, height: 14 },
    container: { active: true }
  };
}

function topology() {
  return {
    lanes: {
      "lane-a": {
        id: "lane-a",
        length: 240,
        roadWidth: 52,
        laneOffset: 10.4,
        points: [{ x: 0, y: 0 }, { x: 240, y: 0 }]
      }
    }
  };
}

test("traffic bypass capacity stays inside compiler road width", () => {
  const lane = topology().lanes["lane-a"];
  const traffic = slot();
  const inward = trafficBypassRoadCapacity(lane, traffic, -1);
  const outward = trafficBypassRoadCapacity(lane, traffic, 1);

  assert.ok(inward > outward);
  assert.ok(inward > 14);
  assert.ok(outward < 14);
});

test("traffic bypass planner chooses a legal committed corridor around a stopped lead vehicle", () => {
  const actor = slot("traffic-a");
  const blocker = slot("traffic-b");
  blocker.x = 72;
  const materializer = {
    pool: [actor, blocker],
    assignments: new Map([[actor.tokenId, actor], [blocker.tokenId, blocker]]),
    scene: {
      vehicleSystem: { vehicles: [] },
      trafficPhysicalConsequencesSystem: { proxyWorldSafe() { return true; } }
    }
  };
  const agent = { tokenId: actor.tokenId, stage: "lane", currentLaneId: "lane-a", stageProgress: 40 / 240 };
  const plan = planTrafficBypass(materializer, topology(), agent, {
    blockerId: blocker.tokenId,
    blockerKind: "route-traffic",
    gap: 4
  });

  assert.ok(plan);
  assert.equal(plan.side, -1);
  assert.ok(plan.targetOffset < -14);
  assert.ok(Math.abs(plan.targetOffset) <= plan.capacity);
});

test("maneuver token composes lateral displacement and steering angle into one authoritative pose", () => {
  const actor = slot("traffic-a");
  actor.routeManeuverOffset = -12;
  actor.routeManeuverAngleDelta = -0.2;
  actor.routeManeuverPhase = "bypass-left";
  const materializer = {
    pool: [actor],
    assignments: new Map([[actor.tokenId, actor]]),
    trafficTokens() {
      return [{
        tokenId: actor.tokenId,
        routeActive: true,
        x: 40,
        y: 0,
        angle: 0,
        routeStage: "lane",
        routeLaneId: "lane-a"
      }];
    }
  };

  const policy = installTrafficBypassManeuverPolicy(materializer);
  const [token] = materializer.trafficTokens();

  assert.equal(token.x, 40);
  assert.equal(token.y, -12);
  assert.equal(token.angle, -0.2);
  assert.equal(token.routeManeuverActive, true);
  assert.equal(token.routeManeuverSide, -1);
  assert.equal(token.routeManeuverPhase, "bypass-left");
  assert.equal(policy.snapshot().geometryAuthority, "compiler-route-plus-bounded-bypass");
  assert.equal(policy.snapshot().freeFormSteering, false);
});
