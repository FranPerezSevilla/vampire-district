import test from "node:test";
import assert from "node:assert/strict";

import {
  districtZoneAt,
  LAYERS,
  pedestrianRoutes,
  pointOnPedestrianSurface
} from "../phaser/src/data/district.js";
import {
  AMBIENT_PEDESTRIANS_PER_ROUTE,
  NPC_TYPES,
  npcDefinitions
} from "../phaser/src/data/npcs.js";
import { sidewalkPatrolRoutesForZone } from "../phaser/src/systems/PoliceSystem.js";
import {
  TrafficOccupantWitnessSystem,
  trafficWitnessCandidates,
  trafficWitnessCanSee
} from "../phaser/src/systems/TrafficOccupantWitnessSystem.js";
import {
  buildWitnessReportPlan,
  WitnessReactionPolicy
} from "../phaser/src/systems/WitnessReactionPolicy.js";

class TestEvents {
  constructor() {
    this.listeners = new Map();
  }

  on(name, listener) {
    const list = this.listeners.get(name) || [];
    list.push(listener);
    this.listeners.set(name, list);
  }

  off(name, listener) {
    const list = this.listeners.get(name) || [];
    this.listeners.set(name, list.filter(candidate => candidate !== listener));
  }

  emit(name, payload) {
    for (const listener of this.listeners.get(name) || []) listener(payload);
  }
}

function trafficMaterializer() {
  return {
    ready: true,
    pool: [{
      tokenId: "edge-1#0",
      slotIndex: 0,
      x: 100,
      y: 120,
      angle: 0,
      archetypeId: "sedan",
      container: { active: true }
    }],
    occupantCount: () => 2
  };
}

test("the city distributes ambient civilians across every pedestrian route", () => {
  const activeCivilians = npcDefinitions.filter(definition => (
    definition.type === NPC_TYPES.CIVILIAN
    && definition.layer === LAYERS.STREET
    && !definition.inactive
  ));
  assert.ok(activeCivilians.length >= pedestrianRoutes.length * AMBIENT_PEDESTRIANS_PER_ROUTE);

  for (const route of pedestrianRoutes) {
    const expected = Math.min(AMBIENT_PEDESTRIANS_PER_ROUTE, route.points.length);
    const ambient = activeCivilians.filter(definition => (
      definition.ambientPopulation
      && definition.pedestrianRouteId === route.id
    ));
    assert.equal(ambient.length, expected, `${route.id} should receive its ambient population`);
    assert.equal(
      new Set(ambient.map(definition => `${definition.x}:${definition.y}`)).size,
      expected,
      `${route.id} pedestrians should not stack at one route origin`
    );
    assert.ok(
      ambient.every(definition => pointOnPedestrianSurface(definition.x, definition.y)),
      `${route.id} pedestrians must start on pedestrian geometry`
    );
  }
});

test("foot-police patrol routes are sourced from continuous sidewalk loops", () => {
  const zoneIds = new Set(
    pedestrianRoutes.flatMap(route => route.points.map(point => districtZoneAt(point.x, point.y).id))
  );
  assert.ok(zoneIds.size > 0);

  for (const zoneId of zoneIds) {
    const routes = sidewalkPatrolRoutesForZone(zoneId);
    assert.ok(routes.length > 0, `${zoneId} should expose a sidewalk patrol route`);
    for (const route of routes) {
      assert.equal(route.surface, "sidewalk");
      assert.ok(route.points.length >= 2);
      assert.ok(route.points.every(point => pointOnPedestrianSurface(point.x, point.y)));
    }
  }
});

test("witness report routing chooses one stable sidewalk direction away from danger", () => {
  const routes = [{
    id: "test-loop",
    points: [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 40, y: 40 },
      { x: 0, y: 40 }
    ]
  }];
  const witness = {
    x: 0,
    y: 0,
    pedestrianRouteId: "test-loop"
  };
  const source = { x: -24, y: 0 };
  const reportTarget = { x: 90, y: 40 };

  const first = buildWitnessReportPlan(witness, source, reportTarget, routes);
  const second = buildWitnessReportPlan(witness, source, reportTarget, routes);

  assert.ok(first);
  assert.deepEqual(first.waypoints, second.waypoints);
  assert.ok(first.waypoints.length > 0);
  assert.ok(
    Math.hypot(first.waypoints[0].x - source.x, first.waypoints[0].y - source.y)
      > Math.hypot(witness.x - source.x, witness.y - source.y),
    "the first committed step should increase distance from the witnessed danger"
  );
  assert.deepEqual(first.destination, first.waypoints[first.waypoints.length - 1]);
});

test("an alarmed pedestrian finishes shock once, then runs monotonically to report", () => {
  const events = new TestEvents();
  let reports = 0;
  const witness = {
    id: "civilian-reporting",
    type: NPC_TYPES.CIVILIAN,
    x: 0,
    y: 0,
    layer: LAYERS.STREET,
    speed: 14,
    dead: false,
    inactive: false,
    intercepted: false,
    hasReported: false,
    drainVictim: false,
    stunnedTimer: 0,
    masqueradeRisk: false,
    reactionTimer: 0,
    ai: { state: "fleeing", role: "none", intent: "idle" },
    combat: { state: "active" },
    container: { setPosition: () => {} }
  };
  const witnessSystem = {
    reports: 0,
    masqueradeReports: 0,
    alarmWitness(target, reason, severity, options = {}) {
      target.alarmed = true;
      target.witnessReason = reason;
      target.reportSeverity = severity;
      target.reportTarget = { id: "police", name: "police station", x: 100, y: 0, severityBonus: 10 };
      target.witnessSource = options.source;
      target.reactionTimer = options.reactionSeconds || 0;
      return true;
    },
    updateAlarmedWitnesses: () => assert.fail("the unstable legacy update should be replaced"),
    drawMarkers: () => {},
    summary: () => "Witnesses fleeing 1",
    alarmedWitnesses: () => witness.alarmed && !witness.hasReported ? [witness] : [],
    reportWitness(target) {
      target.hasReported = true;
      target.alarmed = false;
      reports++;
    },
    cancelReportIntent(target) {
      target.alarmed = false;
    }
  };
  const scene = {
    currentLayer: LAYERS.STREET,
    player: { id: "player", x: -20, y: 0, layer: LAYERS.STREET },
    witnessSystem,
    npcSystem: {
      bestVisibleNavNode: () => ({ x: 72, y: 0 }),
      canNpcStandAt: (_npc, x, y) => y === 0 && x >= 0 && x <= 100
    },
    events,
    lastActionText: ""
  };
  const policy = new WitnessReactionPolicy(scene);

  assert.equal(scene.witnessSystem.alarmWitness(witness, "a violent act", 18, {
    source: scene.player,
    reactionSeconds: 1.5
  }), true);
  assert.ok(witness.reactionTimer <= 0.65);

  const positions = [witness.x];
  for (let frame = 0; frame < 80 && !witness.hasReported; frame++) {
    scene.witnessSystem.updateAlarmedWitnesses(0.05);
    positions.push(witness.x);
  }

  assert.equal(reports, 1);
  assert.equal(witness.hasReported, true);
  assert.ok(positions.some(position => position > 0));
  assert.ok(
    positions.every((position, index) => index === 0 || position >= positions[index - 1]),
    "the witness should not flip direction while escaping"
  );
  assert.match(scene.lastActionText, /bolts along the pavement/i);

  policy.destroy();
});

test("one moving vehicle exposes one witness group with its occupant count", () => {
  const candidates = trafficWitnessCandidates(trafficMaterializer());
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].occupantCount, 2);
  assert.equal(candidates[0].trafficTokenId, "edge-1#0");
  assert.equal(trafficWitnessCanSee(candidates[0], {
    x: 150,
    y: 120,
    layer: LAYERS.STREET
  }, 100), true);
  assert.equal(trafficWitnessCanSee(candidates[0], {
    x: -20,
    y: 120,
    layer: LAYERS.STREET
  }, 200), false);
  assert.equal(trafficWitnessCanSee(candidates[0], {
    x: 400,
    y: 120,
    layer: LAYERS.STREET
  }, 100), false);
});

test("traffic witnesses enter the ordinary perception path and report concrete evidence", () => {
  const events = new TestEvents();
  const heatCalls = [];
  const discoveredEvidence = [];
  const linkedEvidence = [];
  const huntingDiscoveries = [];
  const originalWitnessesSeeing = () => [];
  const originalAlarmWitness = () => false;
  const originalDrawMarkers = () => {};
  const originalSummary = () => "Witnesses fleeing 0";
  const witnessSystem = {
    reports: 0,
    masqueradeReports: 0,
    witnessesSeeing: originalWitnessesSeeing,
    alarmWitness: originalAlarmWitness,
    drawMarkers: originalDrawMarkers,
    summary: originalSummary
  };
  const scene = {
    currentLayer: LAYERS.STREET,
    player: { id: "player", x: 600, y: 600, layer: LAYERS.STREET },
    witnessSystem,
    trafficMaterializationSystem: trafficMaterializer(),
    currentShadowAt: () => false,
    events,
    registry: { get: () => false },
    exposureSystem: {
      registerWitnessMemory: () => ({ id: "memory-driver" }),
      linkEvidence: (id, related) => linkedEvidence.push({ id, related: [...related] }),
      discoverLinked: (ids, options) => discoveredEvidence.push({ ids: [...ids], options }),
      level: () => 1
    },
    evidenceSystem: { stats: { bodiesDiscovered: 0 } },
    policeSystem: {
      addHeat: (...args) => heatCalls.push(args),
      rememberPlayerPosition: () => {}
    },
    campaignSystem: {
      huntingLaw: {
        discover: (...args) => huntingDiscoveries.push(args)
      }
    },
    missionSystem: { failMasquerade: () => assert.fail("low Exposure should not fail the Veil") },
    statePublisher: { setMany: () => {} },
    lastActionText: ""
  };

  const system = new TrafficOccupantWitnessSystem(scene);
  const subject = { id: "victim-1", x: 145, y: 120, layer: LAYERS.STREET };
  const witnesses = scene.witnessSystem.witnessesSeeing(subject, 100);
  const trafficWitness = witnesses.find(witness => witness.trafficWitness);
  assert.ok(trafficWitness);
  assert.equal(scene.witnessSystem.alarmWitness(trafficWitness, "a full feed", 24, {
    masqueradeRisk: true,
    reactionSeconds: 0,
    source: subject
  }), true);

  events.emit("feeding:resolved", {
    targetId: subject.id,
    evidenceIds: ["bite-mark-1"],
    huntingAssessmentId: "poaching-1"
  });
  system.update(2);

  assert.equal(witnessSystem.reports, 1);
  assert.equal(witnessSystem.masqueradeReports, 1);
  assert.equal(heatCalls.length, 1);
  assert.equal(discoveredEvidence.length, 1);
  assert.ok(discoveredEvidence[0].ids.includes("memory-driver"));
  assert.ok(discoveredEvidence[0].ids.includes("bite-mark-1"));
  assert.ok(linkedEvidence.some(entry => entry.id === "memory-driver" && entry.related.includes("bite-mark-1")));
  assert.equal(huntingDiscoveries.length, 1);
  assert.equal(system.snapshot().pendingCount, 0);
  assert.equal(system.snapshot().reportCount, 1);

  system.destroy();
  assert.equal(witnessSystem.witnessesSeeing, originalWitnessesSeeing);
  assert.equal(witnessSystem.alarmWitness, originalAlarmWitness);
});
