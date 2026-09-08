import { TrafficMaterializationSystem } from "../phaser/src/streaming/TrafficMaterializationSystem.js";
import { TrafficLocalBehaviorSystem } from "../phaser/src/streaming/TrafficLocalBehaviorSystem.js";
import { npcCriticalReason } from "../phaser/src/streaming/EntityStreamPolicy.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { TransitSystem } from "../phaser/src/systems/TransitSystem.js";
import { NpcSystem } from "../phaser/src/systems/NpcSystemCore.js";
import { InteractionSystem } from "../phaser/src/systems/InteractionSystem.js";
import { createTrafficDriverRuntime } from "../phaser/src/streaming/TrafficDriverRuntime.js";
import { buildTransitRoutes } from "../phaser/src/streaming/TransitRoutes.js";
import { vehicleFootprintPoints } from "../phaser/src/vehicles/VehicleModel.js";
import { createTrafficDriverWorld } from "../phaser/src/streaming/TrafficDriverWorld.js";

const pack = name => JSON.parse(readFileSync(new URL(`../phaser/assets/city/packs/${name}.json`, import.meta.url)));
const topology = pack("traffic-lanes").localTopology;
function view() {
  return { x: -1000, y: -1000, visible: true, active: true,
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setVisible(v) { this.visible = v; return this; }, setActive(v) { this.active = v; return this; },
    setDepth() { return this; }, add() { return this; }, destroy() {} };
}
function fixture() {
  const scene = { events: new EventEmitter(), player: view(), currentLayer: 0, canStandAt: () => true,
    registry: { set() {} }, vehicleSystem: { currentVehicleId: null, vehicles: [],
      isDriving() { return Boolean(this.currentVehicleId); },
      addTransientVehicle(definition) { this.vehicles.push(definition); return definition; },
      enterVehicle(id) { this.currentVehicleId = id; return true; }, pruneTransientVehicles() {} },
    add: { container: view, rectangle: view, text: view }, npcSystem: { npcs: [],
      createNpc: definition => ({ ...definition, container: view(), inactive: false, dead: false }) } };
  scene.player.body = { enable: true, setVelocity() {} };
  scene.transitSystem = new TransitSystem(scene);
  scene.interactionSystem = new InteractionSystem(scene);
  const materializer = scene.trafficMaterializationSystem = { scene, assignments: new Map(), pool: [], spawnedOccupants: [], hijackSequence: 0,
    updateSlot(slot, token) { Object.assign(slot, token); }, blocksVehicle: () => false,
    publish() {} };
  Object.setPrototypeOf(materializer, TrafficMaterializationSystem.prototype);
  const runtime = createTrafficDriverRuntime({ trafficFlows: [], macroGraph: pack("macro-graph"), topology, materializer });
  for (const bus of scene.transitSystem.buses.values()) {
    const slot = { ...bus.driver.pose, tokenId: bus.driver.tokenId, transitLineId: bus.line.id,
      archetype: bus.driver.archetype, radius: bus.driver.archetype.width * 0.43, driverActive: true, container: view() };
    materializer.assignments.set(bus.driver.tokenId, slot); materializer.pool.push(slot);
  }
  const owner = { stopNpc: NpcSystem.prototype.stopNpc, moveTowardAtSpeed: NpcSystem.prototype.moveTowardAtSpeed,
    navigationTarget: (_npc, x, y) => ({ x, y }), canNpcStandAt: () => true };
  function step(count = 1) {
    for (let i = 0; i < count; i++) {
      runtime.step(0.05);
      scene.transitSystem.update();
      for (const npc of scene.npcSystem.npcs) scene.transitSystem.updateNpc(npc, 0.05, owner);
    }
  }
  return { scene, runtime, materializer, step, destroy() { runtime.destroy(); scene.transitSystem.destroy(); } };
}

test("three broad bus lines use legal curb lanes and serve both halves of their return corridors", () => {
  const lines = buildTransitRoutes(topology);
  assert.deepEqual(lines.map(line => line.id), ["C", "N", "E"]);
  for (const line of lines) {
    assert.ok(line.journey.circular && line.journey.circuitLength > 6000);
    assert.ok(line.stops.length >= 6);
    for (const stop of line.stops) {
      const lane = topology.lanes[stop.laneId];
      assert.equal(lane.laneIndex, 1);
      assert.ok(lane.roadWidth >= 100);
      const dx = stop.x - stop.point.x, dy = stop.y - stop.point.y;
      assert.ok(-lane.tangent.y * dx + lane.tangent.x * dy > 20, "passengers wait on the curb side");
    }
    const points = line.journey.segments.flatMap(segment => [segment.a, segment.b]);
    if (line.id === "N") assert.ok(Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) > 2800);
    if (line.id === "E") assert.ok(Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)) > 4300);
  }
});

test("bus service brakes, dwells, boards real walkers and alights them at later stops through the shared driver", t => {
  const f = fixture();
  try {
    const world = createTrafficDriverWorld(topology, f.materializer);
    let roadViolations = 0;
    for (let chunk = 0; chunk < 60; chunk++) {
      f.step(100);
      for (const bus of f.scene.transitSystem.buses.values()) {
        const driver = bus.driver;
        if (!vehicleFootprintPoints(driver.pose, { width: driver.archetype.width * 0.86, height: driver.archetype.height * 0.82 }).every(world.onRoad)) roadViolations++;
      }
    }
    const state = f.scene.transitSystem.snapshot();
    t.diagnostic(JSON.stringify(state.buses));
    assert.equal(roadViolations, 0);
    assert.ok(state.buses.every(bus => bus.visits >= 4), "every line must continue through multiple stops");
    assert.ok(state.boarded >= 12);
    assert.ok(state.alighted >= 6);
    const onboard = [...f.scene.transitSystem.buses.values()].flatMap(bus => bus.passengers);
    assert.equal(new Set(onboard.map(npc => npc.id)).size, onboard.length);
    assert.ok(onboard.every(npc => npc.inactive && npc.transitBoarded && npcCriticalReason(npc) === "bus-passenger"));
    assert.equal(state.boarded - state.alighted, onboard.length);
  } finally { f.destroy(); }
});

test("Enter chooser boards a passenger without driving, locks actions, follows the bus and exits safely; theft retires service", () => {
  const f = fixture();
  try {
    f.step();
    const service = f.scene.transitSystem, bus = service.buses.get("bus:N:1");
    f.scene.player.setPosition(bus.driver.pose.x, bus.driver.pose.y + 27);
    service.openMenu(bus.driver.tokenId);
    assert.deepEqual(f.scene.interactionSystem.snapshot().options.map(o => o.label), ["Subir como pasajero", "Robar autobús"]);
    f.scene.interactionSystem.runSelected();
    assert.equal(service.riding, bus.driver.tokenId);
    assert.equal(f.scene.vehicleSystem.isDriving(), false);
    assert.equal(f.scene.player.body.enable, false);
    f.scene.playerDamageSystem = { damagePlayer() { assert.fail("a rider cannot be run over by their own bus"); } };
    assert.equal(TrafficLocalBehaviorSystem.prototype.processPlayerImpact.call({ scene: f.scene, vehicleSystem: f.scene.vehicleSystem },
      { ...bus.driver.pose, archetype: bus.driver.archetype }, { engineSpeed: 80 }), false);
    const input = service.filterInput({ move: { x: 1, y: -1 }, primaryPressed: true, whisperPressed: true, vehicleActionPressed: true });
    assert.deepEqual(input.move, { x: 0, y: 0 });
    assert.equal(input.primaryPressed, false); assert.equal(input.whisperPressed, false); assert.equal(input.traversePressed, true);
    f.step(180);
    assert.equal(f.scene.player.x, bus.driver.pose.x);
    assert.equal(f.scene.player.y, bus.driver.pose.y);
    service.collectInteractions()[0].run();
    for (let i = 0; i < 2000 && service.isRiding(); i++) f.step();
    assert.equal(service.isRiding(), false);
    assert.equal(f.scene.player.visible, true); assert.equal(f.scene.player.body.enable, true);
    const passengers = [...bus.passengers];
    service.openMenu(bus.driver.tokenId);
    f.scene.interactionSystem.menu.index = 1;
    f.scene.interactionSystem.runSelected();
    assert.equal(service.buses.has(bus.driver.tokenId), false);
    assert.equal(f.scene.vehicleSystem.vehicles.length, 1);
    assert.equal(f.scene.vehicleSystem.vehicles[0].archetypeId, "bus");
    assert.equal(f.scene.vehicleSystem.currentVehicleId, f.scene.vehicleSystem.vehicles[0].id);
    assert.ok(passengers.length > 0 && passengers.every(npc => !npc.transitBoarded && !npc.inactive && !npc.transit));
    assert.equal(service.evacuatedCount, passengers.length);
    assert.equal(f.runtime.materializationTokens().some(token => token.tokenId === bus.driver.tokenId), false);
  } finally { f.destroy(); }
});

test("visible stop queues do not board dormant invisible buses, and bypassing one stop keeps subsequent stops scheduled", () => {
  const f = fixture();
  try {
    const service = f.scene.transitSystem, bus = service.buses.get("bus:N:1"), stop = bus.line.stops[0];
    f.materializer.assignments.delete(bus.driver.tokenId);
    f.scene.cameras = { main: { worldView: { x: stop.x - 200, y: stop.y - 200, width: 400, height: 400 } } };
    service.arrive(bus, stop);
    assert.ok(f.scene.npcSystem.npcs.filter(npc => npc.transit.stopId === stop.id).every(npc => npc.transit.state === "waiting"));
    f.scene.cameras.main.worldView.x += 2000;
    service.arrive(bus, stop);
    assert.ok(f.scene.npcSystem.npcs.filter(npc => npc.transit.stopId === stop.id).every(npc => npc.transit.state === "boarding"));
    // Navigation progress here represents an already executed emergency bypass.
    bus.driver.progress = stop.progress + 20;
    service.speedLimit(bus.driver, 0.05);
    assert.equal(bus.nextStop, 1);
    assert.equal(bus.nextStopLap, 0);
    assert.equal(bus.skippedStops, 1);
    const blockedStop = bus.line.stops[bus.nextStop];
    bus.driver.progress = blockedStop.progress;
    bus.driver.pose.x = blockedStop.point.x + 25;
    bus.driver.pose.y = blockedStop.point.y + 25;
    bus.driver.pose.speed = 0;
    assert.ok(service.speedLimit(bus.driver, 0.05) > 0,
      "being displaced beside an unreachable stop cannot impose a permanent zero-speed limit");
    assert.equal(bus.nextStop, 2);
    assert.equal(bus.skippedStops, 2);
  } finally { f.destroy(); }
});
