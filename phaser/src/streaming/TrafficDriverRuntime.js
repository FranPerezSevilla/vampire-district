import { trafficVehicleArchetype } from "../data/vehicles.js";
import { createVehicleState, stepVehicleKinematics } from "../vehicles/VehicleModel.js";
import { seedTrafficRouteAgentsFromMacroPopulation } from "./TrafficRoutePopulationSeed.js";
import { projectTrafficRouteAgentsToMacroCompatibility, validateTrafficRouteMacroProjection } from "./TrafficRouteCompatibilityProjection.js";
import { createTrafficJourneyPlanner, journeyPoint, projectJourney, trafficJourneyHash, pathLength } from "./TrafficJourneyPlanner.js";
import { driverControls, journeyDrivingTarget, planDriverManeuver, planDriverReverse } from "./TrafficDriverController.js";
import { createTrafficDriverWorld } from "./TrafficDriverWorld.js";
import { createTrafficDriverJunctions } from "./TrafficDriverJunctions.js";
import { createTrafficCircuitAllocation, TRAFFIC_POPULATION_POLICY } from "./TrafficPopulationPolicy.js";

export function createTrafficDriverRuntime({ trafficFlows, macroGraph, topology, materializer, speed = 112 }) {
  const seeded = seedTrafficRouteAgentsFromMacroPopulation(trafficFlows, macroGraph, topology);
  const planner = createTrafficJourneyPlanner(topology);
  const world = createTrafficDriverWorld(topology, materializer);
  const junctions = createTrafficDriverJunctions(topology);
  const capacityPopulation = [...(trafficFlows instanceof Map ? trafficFlows.values() : trafficFlows || [])]
    .some(flow => flow.populationPolicy === TRAFFIC_POPULATION_POLICY);
  const allocation = capacityPopulation ? createTrafficCircuitAllocation({ topology, graph: macroGraph, planner, population: seeded.agents.length }) : null;
  const drivers = seeded.agents.map(agent => {
    const archetype = trafficVehicleArchetype(agent.tokenId);
    let journey = planner.plan(agent.currentLaneId, agent.tokenId);
    // Bootstrap only: a complete body must fit before the first stop line.
    // Six-pixel connector links cannot be spawn locations for a limousine.
    if (pathLength(topology.lanes[agent.currentLaneId].points) < archetype.width + 16) {
      const laneId = journey.laneIds.find(id => pathLength(topology.lanes[id].points) >= archetype.width + 16);
      if (laneId) journey = planner.plan(laneId, agent.tokenId);
    }
    if (allocation) journey = allocation.choose(journey, agent.tokenId);
    const firstLength = pathLength(topology.lanes[journey.laneIds[0]].points);
    let progress = Math.min(agent.stageProgress * firstLength, Math.max(0, firstLength - archetype.width * 0.43 - 8));
    if (allocation) progress = allocation.initialProgress(journey, agent.tokenId, archetype, progress);
    const initial = journeyPoint(journey, progress);
    return { ...agent, archetype, journey, progress, pose: createVehicleState({ id: agent.tokenId, ...initial }, archetype),
      cruiseSpeed: speed * (0.87 + trafficJourneyHash(agent.tokenId) % 14 / 100), wait: 0, retryAt: 0,
      maneuver: null, maneuverSeconds: 0, recovery: null, panicUntil: 0, reason: "cruise", controls: { move: { x: 0, y: 0 } },
      distanceTravelled: 0, completedJourneys: 0, adoptedImpacts: 0, rejectedSteps: 0, routeHop: 0 };
  });
  const populationAllocation = allocation?.snapshot() || null;
  const byId = new Map(drivers.map(driver => [driver.tokenId, driver]));
  const hijacked = new Set();
  let clock = 0, ticks = 0, destroyed = false;
  let planningBudget = 0;
  const scene = materializer.scene;
  function gunshot(event) {
    const x = Number(event?.x ?? event?.origin?.x ?? scene.player?.x);
    const y = Number(event?.y ?? event?.origin?.y ?? scene.player?.y);
    for (const driver of drivers) if (Math.hypot(driver.pose.x - x, driver.pose.y - y) < 260) driver.panicUntil = clock + 4.2;
  }
  scene.events?.on?.("weapon:fired", gunshot);
  const onHijack = event => { if (byId.has(event?.tokenId)) hijacked.add(event.tokenId); };
  scene.events?.on?.("traffic:vehicle-hijacked", onHijack);

  function routeAgent(driver) {
    const stage = journeyPoint(driver.journey, driver.progress).segment.stage;
    const laneIndex = stage.laneIndex;
    return { tokenId: driver.tokenId, currentLaneId: stage.laneId, stage: stage.kind,
      stageProgress: Math.max(0, Math.min(1, (driver.progress - stage.start) / Math.max(0.001, stage.end - stage.start))),
      connectorId: stage.connectorId || null, nextLaneId: stage.nextLaneId || null,
      previousLaneId: driver.journey.laneIds[laneIndex - 1] || null,
      recentLaneIds: driver.journey.laneIds.slice(Math.max(0, laneIndex - 16), laneIndex),
      routeHop: driver.routeHop + laneIndex, trafficMetadata: driver.trafficMetadata };
  }
  function measuredAgent(driver) {
    return { ...routeAgent(driver),
      destinationLaneId: driver.journey.destination, journeyLaneIds: [...driver.journey.laneIds],
      journeyProgress: driver.progress, completedJourneys: driver.completedJourneys,
      circularRoute: driver.journey.circular, circuitLength: driver.journey.circuitLength,
      pose: { ...driver.pose }, controls: structuredClone(driver.controls), reason: driver.reason,
      distanceTravelled: driver.distanceTravelled, adoptedImpacts: driver.adoptedImpacts, rejectedSteps: driver.rejectedSteps };
  }
  function token(driver, index) {
    const agent = routeAgent(driver);
    const lane = topology.lanes[agent.currentLaneId];
    const stage = journeyPoint(driver.journey, driver.progress).segment.stage;
    const spawnMargin = driver.archetype.width * 0.5 + 35;
    return { tokenId: agent.tokenId, tokenIndex: driver.trafficMetadata?.macroCompatibility?.tokenIndex ?? index,
      edgeId: driver.trafficMetadata?.macroCompatibility?.edgeId || null, direction: lane.direction,
      ...driver.pose, tokenId: agent.tokenId, routeActive: true, driverActive: true,
      driverSpawnAllowed: stage.kind === "lane" && driver.progress - stage.start > spawnMargin
        && stage.end - driver.progress > spawnMargin && junctions.stopDistance(driver) > 35,
      routeStage: agent.stage, routeLaneId: agent.currentLaneId, routeConnectorId: agent.connectorId,
      routeNextLaneId: agent.nextLaneId, routePreviousLaneId: agent.previousLaneId,
      routeRecentLaneIds: agent.recentLaneIds, routeHop: agent.routeHop, routeStageProgress: agent.stageProgress,
      routeGeometryId: agent.connectorId || agent.currentLaneId, routeSourceRoadEdgeId: lane.sourceRoadEdgeId,
      driverDestination: driver.journey.destination, driverReason: driver.reason, driverControls: driver.controls };
  }
  function adoptContact(driver, slot) {
    const physical = scene.trafficPhysicalConsequencesSystem;
    const state = physical?.states?.get(driver.tokenId);
    if (!slot?.driverActive) return;
    const displaced = Math.hypot(slot.x - driver.pose.x, slot.y - driver.pose.y) > 0.001
      || Math.abs(slot.angle - driver.pose.angle) > 0.001;
    if (displaced) {
      driver.pose = { ...driver.pose, x: slot.x, y: slot.y, angle: slot.angle, travelAngle: slot.angle,
        speed: 0, velocityX: 0, velocityY: 0 };
      driver.maneuver = null; junctions.releaseManeuver(driver); driver.adoptedImpacts++;
    }
    // Consume the impact into actual state once. There is no ideal base to decay
    // back toward; subsequent rejoining must be performed with steering.
    if (state) {
      state.baseX = driver.pose.x; state.baseY = driver.pose.y;
      state.offsetX = 0; state.offsetY = 0;
    }
    slot.physicalOffsetX = 0; slot.physicalOffsetY = 0;
    slot.routeBaseX = driver.pose.x; slot.routeBaseY = driver.pose.y;
  }
  function publish(driver, slot) {
    if (!slot) return;
    slot.speed = driver.pose.speed;
    slot.behaviorReason = driver.reason;
    slot.behaviorSpeedFactor = Math.abs(driver.pose.speed) / speed;
    slot.behaviorBlockerId = driver.blockerId || null;
    slot.driverActive = true;
    slot.driverControls = driver.controls;
    slot.driverDestination = driver.journey.destination;
    slot.driverReason = driver.reason;
  }
  function blockedQueue(driver, visited = new Set()) {
    if (Math.abs(driver.pose.speed) > 4 || driver.wait < 4) return false;
    if (visited.has(driver.tokenId)) return true;
    visited.add(driver.tokenId);
    const leader = byId.get(driver.blockerId || junctions.blockingDriver(driver));
    if (leader) return blockedQueue(leader, visited);
    return Boolean(driver.blockerId) || ["physical-disabled", "physical-contact", "obstacle"].includes(driver.reason);
  }
  function drive(driver, dt, active) {
    const slot = materializer.assignments.get(driver.tokenId);
    const start = driver.pose;
    const desired = journeyDrivingTarget(driver, driver.panicUntil > clock ? speed : driver.cruiseSpeed);
    let targetSpeed = desired.speed;
    if (!driver.journey.circular) targetSpeed = Math.min(targetSpeed, Math.max(0, driver.journey.destinationProgress - driver.progress - 2));
    let reason = driver.panicUntil > clock ? "panic" : "cruise";
    const objects = active ? world.obstacles(driver) : [];
    const stopDistance = active ? junctions.stopDistance(driver) : Infinity;
    if (stopDistance < 110) {
      targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * driver.archetype.brake * Math.max(0, stopDistance - 2)));
      if (stopDistance < 3) targetSpeed = 0;
      reason = "junction-yield";
    }
    let blocker = null;
    if (active && !driver.maneuver) {
      let predicted = start, progress = driver.progress, travelled = 0;
      // Predict using the very same steering and braking model as the committed
      // step. The road path may bend; a straight ray would miss a queued car.
      const horizon = Math.max(driver.wait > 4 ? 150 : 30, start.speed ** 2 / (2 * driver.archetype.brake) + Math.abs(start.speed) * 0.55 + 16);
      for (let i = 0; i < 40 && travelled < horizon; i++) {
        const aim = journeyDrivingTarget({ ...driver, pose: predicted, progress }, driver.cruiseSpeed);
        const frame = driverControls(predicted, aim.target, aim.speed, driver.archetype, 0.1);
        const next = stepVehicleKinematics(predicted, frame, 0.1, driver.archetype);
        blocker = world.blocker(driver, next, objects, 3);
        if (blocker) {
          const room = Math.max(0, travelled - 5);
          targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * driver.archetype.brake * room), room * 1.5);
          reason = blocker.tokenId ? "follow" : blocker.id === "player" ? "blocked-player" : "obstacle";
          break;
        }
        travelled += Math.hypot(next.x - predicted.x, next.y - predicted.y);
        predicted = next; progress = projectJourney(driver.journey, predicted, progress).progress;
      }
    }
    driver.blockerId = blocker?.tokenId || blocker?.id || null;
    const physical = scene.trafficPhysicalConsequencesSystem?.states?.get(driver.tokenId);
    const held = slot?.trafficDisabled || (physical?.holdSeconds || 0) > 0;
    if (held) {
      targetSpeed = 0; reason = slot.trafficDisabled ? "physical-disabled" : "physical-contact";
      if (slot.trafficDisabled) { driver.maneuver = null; junctions.releaseManeuver(driver); }
    }
    const queueLeader = blocker?.tokenId ? byId.get(blocker.tokenId) : null;
    const ordinaryQueue = queueLeader && !blockedQueue(queueLeader);
    if (blocker && driver.recovery?.blockerId !== driver.blockerId) driver.recovery = null;
    if (driver.recovery && !driver.maneuver) {
      if (!blocker || ordinaryQueue) driver.recovery = null;
      else targetSpeed = 0;
    }
    if (active && blocker && !slot?.trafficDisabled && !ordinaryQueue && driver.wait > (queueLeader ? 4 : 0.75)
      && !driver.maneuver && clock >= driver.retryAt && planningBudget > 0) {
      driver.retryAt = clock + 2; planningBudget--;
      const goal = journeyPoint(driver.journey, Math.min(driver.journey.length - 5, driver.progress + 115));
      const request = { pose: driver.pose, archetype: driver.archetype, goal, dt: Math.max(1 / 120, dt),
        // A car stopped close to a bumper may initially lack the preferred
        // comfort margin. Let it reverse out using actual body clearance, then
        // grow the margin as it creates room; never shrink the physical body.
        safe: (candidate, previous) => !world.blocker(driver, candidate, objects,
          Math.min(2, Math.hypot(candidate.x - start.x, candidate.y - start.y) * 0.15), previous) };
      let maneuver = held ? null : planDriverManeuver(request);
      if (maneuver && !junctions.reserveManeuver(driver, maneuver)) maneuver = null;
      if (!maneuver) {
        maneuver = planDriverReverse({ ...request, distance: Math.min(18, 48 - (driver.recovery?.reversed || 0)) });
        if (maneuver && !junctions.reserveManeuver(driver, maneuver)) maneuver = null;
      }
      if (maneuver?.kind === "reverse-reassess") {
        driver.recovery ||= { blockerId: driver.blockerId, reversed: 0 };
        driver.recovery.reversed += Math.hypot(maneuver.goal.x - start.x, maneuver.goal.y - start.y);
      }
      driver.maneuver = maneuver;
      driver.maneuverSeconds = 0;
    }
    let frame = driverControls(start, desired.target, targetSpeed, driver.archetype, dt);
    if (driver.maneuver && !slot?.trafficDisabled) {
      const index = Math.floor((driver.maneuverSeconds + 0.000001) / driver.maneuver.frameSeconds);
      if (index >= driver.maneuver.frames.length) {
        const partial = driver.maneuver.kind === "reverse-reassess";
        driver.maneuver = null; junctions.releaseManeuver(driver);
        if (!partial) driver.recovery = null;
        driver.wait = partial ? Math.max(driver.wait, 5) : 0; driver.retryAt = clock;
        frame = driverControls(start, desired.target, 0, driver.archetype, dt);
      } else { frame = driver.maneuver.frames[index]; reason = start.speed < -0.1 ? "reverse-maneuver" : "bypass"; }
    }
    let next = stepVehicleKinematics(start, frame, dt, driver.archetype);
    // Native contact may already overlap. Never invent an x-only/y-only slide,
    // snap to a waypoint or rotate a stopped body to make the candidate fit.
    if (active && world.blocker(driver, next, objects, 0, start)) {
      next = { ...start, speed: 0, velocityX: 0, velocityY: 0, parked: true };
      driver.rejectedSteps++;
      if (driver.maneuver) { driver.maneuver = null; junctions.releaseManeuver(driver); driver.retryAt = clock + 0.5; }
      reason = held ? reason : "obstacle";
    } else if (driver.maneuver) driver.maneuverSeconds += dt;
    const moved = Math.hypot(next.x - start.x, next.y - start.y);
    // An emergency belongs to the current stop, not waiting credit retained
    // from a previous crossing after the car has already driven away.
    driver.wait = moved < dt * 2 ? driver.wait + dt : 0;
    driver.distanceTravelled += moved;
    driver.pose = next; driver.controls = frame; driver.reason = reason;
    driver.progress = projectJourney(driver.journey, next, driver.progress).progress;
    const destination = journeyPoint(driver.journey, driver.journey.destinationProgress);
    // The same broad circuit repeats at a mid-block seam. Only navigation
    // progress wraps; the physical pose and the predefined itinerary persist.
    if (driver.journey.circular && driver.progress >= driver.journey.destinationProgress && Math.hypot(next.x - destination.x, next.y - destination.y) < 30) {
      driver.routeHop += driver.journey.circuitLaneCount;
      driver.completedJourneys++;
      driver.progress -= driver.journey.circuitLength;
    }
    publish(driver, slot);
    // Commit before the next driver checks clearance. Materialization renders
    // this exact state later; there is no independent presentation catch-up.
    if (slot) materializer.updateSlot(slot, token(driver, 0));
  }
  function step(seconds = 0.05) {
    if (destroyed) throw new Error("Traffic driver runtime is destroyed.");
    let remaining = Math.max(0, seconds);
    planningBudget = 1;
    while (remaining > 0.000001) {
      const dt = Math.min(0.05, remaining); remaining -= dt; clock += dt;
      const active = drivers.filter(driver => materializer.assignments.has(driver.tokenId));
      for (const driver of active) adoptContact(driver, materializer.assignments.get(driver.tokenId));
      junctions.prepare(active, [...materializer.assignments.values()], clock);
      for (const driver of drivers) if (!hijacked.has(driver.tokenId)) drive(driver, dt, materializer.assignments.has(driver.tokenId));
      ticks++;
    }
  }
  function behaviorSnapshot() {
    const vehicles = drivers.filter(driver => materializer.assignments.has(driver.tokenId)).map(driver => ({
      tokenId: driver.tokenId, reason: driver.reason, fsmState: driver.reason, speed: driver.pose.speed,
      speedFactor: Math.abs(driver.pose.speed) / speed, blockerId: driver.blockerId || null,
      destination: driver.journey.destination, controls: structuredClone(driver.controls),
      reversing: driver.pose.speed < -0.1, maneuverActive: Boolean(driver.maneuver), waitSeconds: driver.wait,
      panicSeconds: Math.max(0, driver.panicUntil - clock)
    }));
    return { active: true, architecture: "destination-vehicle-driver", movementAuthority: "shared-vehicle-kinematics",
      geometryAuthority: "compiler-local-topology", lateralSteeringAuthority: false, speedAuthority: "throttle-brake-reverse",
      activeVehicles: vehicles.length, vehicles };
  }
  function snapshot() {
    // Accounting and materialization need route identifiers, not deep copies
    // of every itinerary, pose and input frame in the larger city population.
    const agents = drivers.map(routeAgent);
    const projection = projectTrafficRouteAgentsToMacroCompatibility(agents, topology, macroGraph);
    const validation = validateTrafficRouteMacroProjection(projection, macroGraph);
    return { driverActive: true, clockSeconds: clock, ticks, seededAgentCount: drivers.length, populationAllocation,
      totalMacroTokens: seeded.totalMacroTokens, unseededAgentCount: seeded.unseeded.length,
      populationConserved: drivers.length + seeded.unseeded.length === seeded.totalMacroTokens,
      materializationTokenCount: drivers.length - hijacked.size, hijackedAgentCount: hijacked.size,
      projectionValid: validation.valid, projectionErrors: validation.errors,
      projectedAgentCount: projection.projectedAgentCount, ambiguousAgentCount: projection.ambiguousAgentCount,
      unmatchedAgentCount: projection.unmatchedAgentCount, districtCounts: projection.districtCounts, edgeCounts: projection.edgeCounts,
      districtPopulationCount: agents.length, districtPopulationConserved: true,
      totalJunctionDecisions: agents.reduce((sum, agent) => sum + agent.routeHop, 0),
      totalStageTransitions: agents.reduce((sum, agent) => sum + agent.routeHop * 2, 0),
      blockedAgentCount: drivers.filter(driver => driver.wait > 1).length,
      junctionFlowActive: true, junctionFlow: junctions.snapshot(), junctionFlowState: junctions.snapshot(),
      junctionActivePermitCount: junctions.snapshot().activePermitCount,
      routeBehavior: behaviorSnapshot(), movementAuthority: "shared-vehicle-kinematics",
      speedAuthority: "throttle-brake-reverse", routeProgressAuthority: "measured-physical-pose" };
  }
  return { step, snapshot, agents: () => drivers.map(measuredAgent), materializationTokens: () => drivers.filter(driver => !hijacked.has(driver.tokenId)).map(token),
    behaviorSnapshot, driver: id => byId.get(id),
    destroy() {
      destroyed = true; scene.events?.off?.("weapon:fired", gunshot);
      scene.events?.off?.("traffic:vehicle-hijacked", onHijack); junctions.clear();
    } };
}
