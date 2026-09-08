import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { TrafficMaterializationSystem } from "../../phaser/src/streaming/TrafficMaterializationSystem.js";
import { installTrafficMultiAgentRouteRuntimePolicy } from "../../phaser/src/streaming/TrafficMultiAgentRouteRuntimePolicy.js";
import { TrafficPhysicalConsequencesSystem, orientedVehicleContact } from "../../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";
import { installTrafficMassCollisionPolicy } from "../../phaser/src/streaming/TrafficMassCollisionPolicy.js";
import { applyTrafficRouteSlotMetadata } from "../../phaser/src/streaming/TrafficRouteMaterializationPolicy.js";
import { trafficVehicleArchetype } from "../../phaser/src/data/vehicles.js";

const pack = name => JSON.parse(readFileSync(new URL(`../../phaser/assets/city/packs/${name}.json`, import.meta.url)));

// No replacement routing, driver, reservation, or collision logic. Rendering
// and camera residency are stubbed so the same cohort stays observable across
// the entire generated city instead of disappearing when it leaves the view.
export async function createTrafficNetworkRuntime({ center = { x: 1754, y: 1574 }, roadCount = 16 } = {}) {
  const lanes = pack("traffic-lanes");
  const graph = pack("macro-graph");
  const roads = new Map();
  for (const lane of Object.values(lanes.localTopology.lanes)) {
    const distance = Math.min(...lane.points.map(p => Math.hypot(p.x - center.x, p.y - center.y)));
    roads.set(lane.sourceRoadEdgeId, Math.min(roads.get(lane.sourceRoadEdgeId) ?? Infinity, distance));
  }
  const edges = Object.values(graph.edges);
  const available = new Set(edges.flatMap(edge => edge.sourceRoadEdgeIds));
  const selected = [...roads].filter(([id]) => available.has(id))
    .sort((a, b) => a[1] - b[1]).slice(0, roadCount);
  const trafficFlows = new Map();
  for (const [id] of selected) {
    const edge = edges.find(candidate => candidate.sourceRoadEdgeIds.includes(id));
    if (!trafficFlows.has(edge.id)) trafficFlows.set(edge.id, { edgeId: edge.id, phases: [], tokenCount: 0 });
    const flow = trafficFlows.get(edge.id);
    const index = edge.sourceRoadEdgeIds.indexOf(id);
    flow.phases.push((index + 0.18) / edge.sourceRoadEdgeIds.length, (index + 0.58) / edge.sourceRoadEdgeIds.length);
    flow.tokenCount += 2;
  }
  const scene = {
    events: new EventEmitter(), registry: { get: () => false }, statePublisher: { setMany() {} },
    player: { x: center.x - 214, y: center.y - 59 }, currentLayer: "street",
    vehicleSystem: { vehicles: [], isDriving: () => false, currentVehicle: () => null, updateDriving() {} },
    trafficLocalBehaviorSystem: {
      initialization: Promise.resolve(), applyDecision: slot => slot, decisionFor: () => ({ desiredSpeedFactor: 1 })
    },
    trafficSteeringPresentationSystem: { applyPresentation: slot => slot }
  };
  const materializer = {
    ready: true, lanes, scene, macro: { graph, trafficFlows }, pool: [], assignments: new Map(),
    trafficTokens() { return []; }, originalVehicleCanOccupy: () => true,
    updateSlot(slot, token) {
      Object.assign(slot, {
        tokenId: token.tokenId, x: token.x, y: token.y, angle: token.angle,
        routeBaseX: token.x, routeBaseY: token.y, routeBaseAngle: token.angle
      });
      applyTrafficRouteSlotMetadata(slot, token);
      slot.container.setPosition(slot.x, slot.y).setRotation(slot.angle);
      this.assignments.set(token.tokenId, slot);
      return slot;
    },
    reconcile() {
      this.trafficTokens().forEach((token, index) => {
        const slot = this.pool[index];
        // Use production spawn separation, including deferred appearances.
        if (!slot.tokenId && !TrafficMaterializationSystem.prototype.safeFromTraffic.call(this, token, 16, token.tokenId)) return;
        const archetype = trafficVehicleArchetype(token.tokenId);
        Object.assign(slot, { archetype, archetypeId: archetype.id, radius: archetype.width * 0.43 });
        slot.container.active = true;
        this.updateSlot(slot, token);
      });
      return true;
    }
  };
  for (let i = 0; i < selected.length * 2; i++) {
    materializer.pool.push({
      slotIndex: i, tokenId: null, x: 0, y: 0, angle: 0,
      container: {
        active: false,
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        setRotation(angle) { this.rotation = angle; return this; }
      },
      visual: { label: { setRotation() {} } }
    });
  }
  scene.trafficMaterializationSystem = materializer;
  const route = installTrafficMultiAgentRouteRuntimePolicy(materializer, { speed: 112, defaultEnabled: false });
  scene.trafficLocalAssignmentPolicy = { multiAgentRoutePolicy: route };
  route.start();
  const physical = new TrafficPhysicalConsequencesSystem(scene);
  scene.trafficPhysicalConsequencesSystem = physical;
  await physical.initialization;
  const massPolicy = installTrafficMassCollisionPolicy(physical);
  const records = new Map();
  let elapsed = 0;
  let overlaps = 0;
  let maxOverlap = 0;

  function step(frames = 1) {
    for (let frame = 0; frame < frames; frame++) {
      physical.prepareRouteFrame(0.05);
      route.step(0.05);
      physical.update(0.05);
      elapsed += 0.05;
      for (const agent of route.runtime().agents()) {
        const slot = materializer.assignments.get(agent.tokenId);
        if (!slot) continue;
        let record = records.get(agent.tokenId);
        if (!record) {
          record = { slot, x: slot.x, y: slot.y, distance: 0, stopped: 0, maxStop: 0, lanes: new Set(), hops: 0, identityChanges: 0 };
          records.set(agent.tokenId, record);
        }
        if (record.slot !== slot) record.identityChanges++;
        const travelled = Math.hypot(slot.x - record.x, slot.y - record.y);
        record.distance += travelled;
        record.stopped = travelled < 0.01 ? record.stopped + 0.05 : 0;
        record.maxStop = Math.max(record.maxStop, record.stopped);
        record.x = slot.x;
        record.y = slot.y;
        record.lanes.add(agent.currentLaneId);
        record.hops = agent.routeHop;
      }
      const slots = [...materializer.assignments.values()];
      for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
        const contact = orientedVehicleContact(slots[i], slots[j]);
        if (contact) { overlaps++; maxOverlap = Math.max(maxOverlap, contact.overlap); }
      }
    }
  }

  return {
    scene, materializer, route, physical, records, step,
    metrics: () => ({ elapsed, overlaps, maxOverlap, contacts: physical.totalTrafficContacts }),
    destroy() { massPolicy.destroy(); physical.destroy(); route.destroy(); }
  };
}
