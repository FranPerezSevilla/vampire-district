import test from "node:test";
import assert from "node:assert/strict";

import {
  installTrafficAgentPhysicalAuthorityPolicy,
  trafficAgentPhysicalLock
} from "../phaser/src/streaming/TrafficAgentPhysicalAuthorityPolicy.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function topologyFixture() {
  return {
    lanes: {
      "lane-a": {
        id: "lane-a",
        length: 200,
        roadWidth: 52,
        laneOffset: 10.4,
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }]
      }
    }
  };
}

function slotFixture(tokenId, x, {
  routeStage = "lane",
  routeLaneId = "lane-a",
  angle = 0
} = {}) {
  return {
    tokenId,
    routeActive: true,
    routeStage,
    routeLaneId,
    routeStageProgress: x / 200,
    routeBaseX: x,
    routeBaseY: 0,
    routeBaseAngle: angle,
    x,
    y: 0,
    angle,
    physicalOffsetX: 0,
    physicalOffsetY: 0,
    physicalHoldSeconds: 0,
    speedFactor: 1,
    desiredSpeedFactor: 1,
    archetype: { width: 28, height: 14 },
    container: {
      active: true,
      x,
      y: 0,
      rotation: angle,
      setPosition(nextX, nextY) {
        this.x = nextX;
        this.y = nextY;
        return this;
      },
      setRotation(nextAngle) {
        this.rotation = nextAngle;
        return this;
      }
    },
    visual: {
      label: {
        rotation: -angle,
        setRotation(nextAngle) {
          this.rotation = nextAngle;
          return this;
        }
      }
    }
  };
}

function physicalFixture(materializer) {
  return {
    materializer,
    states: new Map(),
    applyStateOffset(slot, state) {
      slot.physicalOffsetX = Number(state?.offsetX || 0);
      slot.physicalOffsetY = Number(state?.offsetY || 0);
      slot.physicalHoldSeconds = Number(state?.holdSeconds || 0);
      slot.x = Number(state?.baseX ?? slot.routeBaseX ?? slot.x) + slot.physicalOffsetX;
      slot.y = Number(state?.baseY ?? slot.routeBaseY ?? slot.y) + slot.physicalOffsetY;
      slot.container.setPosition(slot.x, slot.y);
      return slot;
    }
  };
}

function routePolicyFixture(materializer, agents, {
  speed = 100,
  rotateOnUpdate = null,
  physicalSystem = null
} = {}) {
  function advance(seconds) {
    for (const agent of agents) {
      const slot = materializer.assignments.get(agent.tokenId);
      if (Number(slot?.physicalHoldSeconds || 0) <= 0) {
        agent.stageProgress += speed * seconds / 200;
      }
      if (rotateOnUpdate != null && slot) {
        slot.angle = rotateOnUpdate;
        slot.container.setRotation(rotateOnUpdate);
        physicalSystem?.applyStateOffset?.(slot, physicalSystem.states.get(slot.tokenId));
      }
    }
    return { speed, agents: agents.map(clone) };
  }

  return {
    update(seconds = 0.05) {
      return advance(seconds);
    },
    step(seconds = 0.05) {
      return advance(seconds);
    },
    snapshot() {
      return { speed };
    },
    runtime() {
      return {
        agents() {
          return agents.map(clone);
        }
      };
    }
  };
}

function installFixture({ slots, agents, rotateOnUpdate = null } = {}) {
  const assignments = new Map(slots.map(slot => [slot.tokenId, slot]));
  const materializer = {
    pool: slots,
    assignments,
    lanes: { localTopology: topologyFixture() },
    scene: {
      statePublisher: { setMany() {} },
      trafficLocalAssignmentPolicy: null
    }
  };
  const physical = physicalFixture(materializer);
  const routePolicy = routePolicyFixture(materializer, agents, {
    rotateOnUpdate,
    physicalSystem: physical
  });
  materializer.scene.trafficLocalAssignmentPolicy = {
    multiAgentRoutePolicy: routePolicy
  };
  const authority = installTrafficAgentPhysicalAuthorityPolicy(physical);
  return { materializer, physical, routePolicy, authority, agents };
}

test("residual displacement remains a route lock after the short contact timer expires", () => {
  const lock = trafficAgentPhysicalLock(
    {
      tokenId: "traffic-a",
      physicalOffsetX: 11,
      physicalOffsetY: -3,
      physicalHoldSeconds: 0,
      trafficDisabled: false
    },
    { offsetX: 11, offsetY: -3, holdSeconds: 0 }
  );

  assert.equal(lock.locked, true);
  assert.equal(lock.reason, "physical-offset-recovery");
  assert.ok(lock.offsetDistance > 11);
});

test("a route agent cannot advance while its materialized body is still displaced", () => {
  const slot = slotFixture("traffic-a", 50);
  const agents = [{
    tokenId: slot.tokenId,
    stage: "lane",
    currentLaneId: "lane-a",
    connectorId: null,
    nextLaneId: null,
    routeHop: 0,
    stageProgress: 0.25
  }];
  const fixture = installFixture({ slots: [slot], agents });
  fixture.physical.states.set(slot.tokenId, {
    offsetX: 12,
    offsetY: 0,
    holdSeconds: 0,
    baseX: 50,
    baseY: 0,
    lastReason: "traffic-collision"
  });
  slot.physicalOffsetX = 12;
  slot.x = 62;

  fixture.routePolicy.update(0.05);

  assert.equal(agents[0].stageProgress, 0.25);
  assert.equal(slot.agentMotionAuthorityLocked, true);
  assert.equal(slot.behaviorReason, "physical-offset-recovery");
  assert.equal(fixture.authority.snapshot().lockedVehicles, 1);

  fixture.physical.states.set(slot.tokenId, {
    offsetX: 0,
    offsetY: 0,
    holdSeconds: 0,
    baseX: 50,
    baseY: 0,
    lastReason: "recovered"
  });
  slot.physicalOffsetX = 0;
  slot.physicalOffsetY = 0;
  slot.x = 50;
  fixture.routePolicy.update(0.05);

  assert.ok(agents[0].stageProgress > 0.25);
  assert.equal(slot.agentMotionAuthorityLocked, false);
  fixture.authority.destroy();
});

test("a connector-stage car physically occupying the approach still blocks the following agent", () => {
  const follower = slotFixture("traffic-follower", 50);
  const crossing = slotFixture("traffic-crossing", 80, {
    routeStage: "connector",
    routeLaneId: "lane-a"
  });
  const agents = [
    {
      tokenId: follower.tokenId,
      stage: "lane",
      currentLaneId: "lane-a",
      connectorId: null,
      nextLaneId: null,
      routeHop: 0,
      stageProgress: 0.25
    },
    {
      tokenId: crossing.tokenId,
      stage: "connector",
      currentLaneId: "lane-a",
      connectorId: "connector-a",
      nextLaneId: "lane-b",
      routeHop: 1,
      stageProgress: 0.1
    }
  ];
  const fixture = installFixture({ slots: [follower, crossing], agents });
  const before = agents[0].stageProgress;

  fixture.routePolicy.update(0.05);

  const state = fixture.authority.snapshot().vehicles
    .find(vehicle => vehicle.tokenId === follower.tokenId);
  assert.equal(agents[0].stageProgress, before);
  assert.equal(state.locked, true);
  assert.equal(state.reason, "physical-lead-occupied");
  assert.equal(state.blockerId, crossing.tokenId);
  assert.equal(state.blockerKind, "physical-cross-route");
  fixture.authority.destroy();
});

test("the visible angle stays at the pre-route pose while physical recovery owns the car", () => {
  const slot = slotFixture("traffic-a", 50, { angle: 0.2 });
  const agents = [{
    tokenId: slot.tokenId,
    stage: "lane",
    currentLaneId: "lane-a",
    connectorId: null,
    nextLaneId: null,
    routeHop: 0,
    stageProgress: 0.25
  }];
  const fixture = installFixture({
    slots: [slot],
    agents,
    rotateOnUpdate: Math.PI / 2
  });
  fixture.physical.states.set(slot.tokenId, {
    offsetX: 8,
    offsetY: 0,
    holdSeconds: 0,
    baseX: 50,
    baseY: 0,
    lastReason: "traffic-collision"
  });
  slot.physicalOffsetX = 8;
  const expectedAngle = slot.angle;

  fixture.routePolicy.update(0.05);

  assert.ok(Math.abs(slot.angle - expectedAngle) < 0.000001);
  assert.ok(Math.abs(slot.container.rotation - expectedAngle) < 0.000001);
  assert.ok(fixture.authority.snapshot().angleLocks > 0);
  fixture.authority.destroy();
});
