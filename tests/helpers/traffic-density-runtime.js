import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { WORLD, CAMERA } from "../../phaser/src/data/balance.js";
import { LAYERS } from "../../phaser/src/data/district.js";
import { ChunkFileStore } from "../../phaser/src/streaming/ChunkFileStore.js";
import { ChunkStreamSystem } from "../../phaser/src/streaming/ChunkStreamSystem.js";
import { MacroTrafficPoliceSystem } from "../../phaser/src/streaming/MacroTrafficPoliceSystem.js";
import { TrafficMaterializationSystem, cameraWorldBounds, pointInsideCamera } from "../../phaser/src/streaming/TrafficMaterializationSystem.js";
import { installTrafficLocalAssignmentPolicy } from "../../phaser/src/streaming/TrafficLocalAssignmentPolicy.js";
import { TrafficPhysicalConsequencesSystem, orientedVehicleContact } from "../../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";
import { installTrafficMassCollisionPolicy } from "../../phaser/src/streaming/TrafficMassCollisionPolicy.js";

function renderObject(extra = {}) {
  return { active: true, visible: true, x: 0, y: 0, rotation: 0,
    setStrokeStyle() { return this; }, setOrigin() { return this; },
    setRotation(v) { this.rotation = v; return this; }, setResolution() { return this; }, setStroke() { return this; },
    setVisible(v) { this.visible = v; return this; }, setActive(v) { this.active = v; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; }, setDepth() { return this; },
    setAlpha() { return this; }, add() { return this; }, destroy() {}, ...extra };
}

// Rendering and file transport only are substituted. Population bootstrap,
// physical driving, camera guards, chunk residency, pool assignment/retention,
// macro accounting and traffic contacts execute the production pipeline.
export async function createTrafficDensityRuntime({ center, historicalPopulation = false } = {}) {
  const fetchImpl = async url => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL(url))) });
  const scene = {
    currentLayer: LAYERS.STREET, player: { ...center }, renderFocus: () => center,
    events: new EventEmitter(), registry: { get: () => false }, statePublisher: { setMany() {} },
    cameras: { main: { worldView: {
      x: center.x - WORLD.viewportWidth / CAMERA.streetZoom / 2,
      y: center.y - WORLD.viewportHeight / CAMERA.streetZoom / 2,
      width: WORLD.viewportWidth / CAMERA.streetZoom, height: WORLD.viewportHeight / CAMERA.streetZoom
    } } },
    entityStreamSystem: { npcRecords: new Map() }, npcSystem: { npcs: [] },
    vehicleSystem: { vehicles: [], currentVehicleId: null, canOccupy: () => true, isDriving: () => false, currentVehicle: () => null, updateDriving() {} },
    trafficLocalBehaviorSystem: { initialization: Promise.resolve(), applyDecision: slot => slot, decisionFor: () => ({ desiredSpeedFactor: 1 }) },
    trafficSteeringPresentationSystem: { applyPresentation: slot => slot },
    add: { container: (x, y) => renderObject({ x, y }), rectangle: () => renderObject(), triangle: () => renderObject(), text: () => renderObject() }
  };
  const city = scene.cityStreamSystem = new ChunkStreamSystem(scene, { fileStore: new ChunkFileStore({ fetchImpl }) });
  await city.initialization;
  await Promise.all(city.loadPromises.values());
  while (city.activationQueue.size) city.update();
  const macro = scene.macroTrafficPoliceSystem = new MacroTrafficPoliceSystem(scene, { fetchImpl });
  await macro.initialization;
  if (historicalPopulation) {
    // Exact previous 58-token bootstrap, retained only as the comparison fixture.
    for (const flow of macro.trafficFlows.values()) {
      const edge = macro.graph.edges[flow.edgeId];
      flow.tokenCount = Math.max(1, Math.round((macro.graph.nodes[edge.a].trafficDensity + macro.graph.nodes[edge.b].trafficDensity) * 2));
      flow.phases.length = flow.tokenCount;
      delete flow.populationPolicy;
    }
  }
  const materializer = scene.trafficMaterializationSystem = new TrafficMaterializationSystem(scene, { fetchImpl });
  const policy = scene.trafficLocalAssignmentPolicy = installTrafficLocalAssignmentPolicy(scene);
  let visibleSpawns = 0, spawns = 0;
  const assign = materializer.assign;
  materializer.assign = function(slot, token) {
    spawns++;
    if (pointInsideCamera(token, cameraWorldBounds(scene), 54)) visibleSpawns++;
    return assign.call(this, slot, token);
  };
  await materializer.initialization;
  const physical = scene.trafficPhysicalConsequencesSystem = new TrafficPhysicalConsequencesSystem(scene);
  await physical.initialization;
  const mass = installTrafficMassCollisionPolicy(physical);
  const route = policy.multiAgentRoutePolicy;
  let frames = 0, visibleSum = 0, nearbySum = 0, maxNearby = 0, overlaps = 0, emptyFrames = 0;
  const frameTimes = [], seen = new Set(), records = new Map();
  function step(count = 1) {
    for (let i = 0; i < count; i++) {
      const start = performance.now();
      city.update();
      physical.prepareRouteFrame(0.05);
      route.update(0.05);
      macro.update(0.05);
      materializer.update(0.05);
      physical.update(0.05);
      frameTimes.push(performance.now() - start);
      frames++;
      const slots = [...materializer.assignments.values()];
      let visible = 0;
      for (const slot of slots) {
        const shown = pointInsideCamera(slot, cameraWorldBounds(scene));
        if (shown) { visible++; seen.add(slot.tokenId); }
        const previous = records.get(slot.tokenId);
        const stopped = previous && Math.hypot(slot.x - previous.x, slot.y - previous.y) < 0.01 ? previous.stopped + 0.05 : 0;
        records.set(slot.tokenId, { x: slot.x, y: slot.y, stopped, maxStop: Math.max(previous?.maxStop || 0, stopped) });
      }
      for (let a = 0; a < slots.length; a++) for (let b = a + 1; b < slots.length; b++) if (orientedVehicleContact(slots[a], slots[b])) overlaps++;
      // Ignore the first ten seconds while cars enter from outside the camera.
      if (frames > 200) { visibleSum += visible; nearbySum += slots.length; if (!visible) emptyFrames++; }
      maxNearby = Math.max(maxNearby, slots.length);
    }
  }
  return { scene, city, macro, materializer, route, step,
    metrics() {
      const times = [...frameTimes].sort((a, b) => a - b), samples = Math.max(1, frames - 200);
      return { population: materializer.trafficTokens().length, seconds: frames * 0.05,
        visibleAverage: visibleSum / samples, nearbyAverage: nearbySum / samples, emptyFraction: emptyFrames / samples,
        seen: seen.size, maxNearby, spawns, visibleSpawns, overlaps, contacts: physical.totalTrafficContacts,
        maxStop: Math.max(0, ...[...records.values()].map(record => record.maxStop)),
        frameP95Ms: times[Math.floor(times.length * 0.95)], frameMeanMs: times.reduce((sum, t) => sum + t, 0) / times.length };
    },
    destroy() { mass.destroy(); physical.destroy(); policy.destroy(); materializer.destroy(); macro.destroy(); city.destroy(); }
  };
}
