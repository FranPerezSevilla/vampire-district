import { trafficVehicleArchetype } from "../data/vehicles.js";
import { createVehicleState, stepVehicleKinematics } from "../vehicles/VehicleModel.js";
import { seedTrafficRouteAgentsFromMacroPopulation } from "./TrafficRoutePopulationSeed.js";
import { createIncrementalTrafficProjection, validateTrafficRouteMacroProjection } from "./TrafficRouteCompatibilityProjection.js";
import { createTrafficJourneyPlanner, journeyPoint, projectJourney, trafficJourneyHash, pathLength } from "./TrafficJourneyPlanner.js";
import { driverControls, journeyDrivingTarget, planDriverManeuver, planDriverReverse } from "./TrafficDriverController.js";
import { createTrafficDriverWorld } from "./TrafficDriverWorld.js";
import { createTrafficDriverJunctions } from "./TrafficDriverJunctions.js";
import { createTrafficCircuitAllocation, TRAFFIC_POPULATION_POLICY } from "./TrafficPopulationPolicy.js";

export function createTrafficDriverRuntime({ trafficFlows, macroGraph, topology, materializer, speed = 112, distantSimulation = true }) {
  const scene = materializer.scene;
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
  if (populationAllocation) {
    // A crowded circuit can retain its supplied one-time entry phase. Count
    // that placement separately from phases allocated on the recurring loop.
    populationAllocation.initialEntryLegCount = drivers.filter(driver => driver.journey.circular && driver.progress < driver.journey.loopStartProgress).length;
  }
  const civilianDrivers = [...drivers];
  drivers.push(...(scene.transitSystem?.createDrivers?.(topology) || []));
  const byId = new Map(drivers.map(driver => [driver.tokenId, driver]));
  const hijacked = new Set();
  let clock = 0, ticks = 0, destroyed = false;
  let planningBudget = 0;
  let planningTokenId = null;
  const projection = createIncrementalTrafficProjection(topology, macroGraph);
  const tokenRecords = new Map(), externalReads = new Set();
  let liveTokens = [], totalHops = 0;
  const stats = { physicalSteps: 0, distantSteps: 0, predictionBuilds: 0, predictionReuses: 0 };
  function gunshot(event) {
    const x = Number(event?.x ?? event?.origin?.x ?? scene.player?.x);
    const y = Number(event?.y ?? event?.origin?.y ?? scene.player?.y);
    for (const driver of drivers) if (Math.hypot(driver.pose.x - x, driver.pose.y - y) < 260) driver.panicUntil = clock + 4.2;
  }
  scene.events?.on?.("weapon:fired", gunshot);
  const onHijack = event => {
    if (byId.has(event?.tokenId)) { hijacked.add(event.tokenId); liveTokens = liveTokens.filter(token => token.tokenId !== event.tokenId); }
  };
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
    return { ...routeAgent(driver), trafficMetadata: structuredClone(driver.trafficMetadata),
      destinationLaneId: driver.journey.destination, journeyLaneIds: [...driver.journey.laneIds],
      journeyProgress: driver.progress, completedJourneys: driver.completedJourneys,
      circularRoute: driver.journey.circular, circuitLength: driver.journey.circuitLength,
      pose: { ...driver.pose }, controls: structuredClone(driver.controls), reason: driver.reason,
      distanceTravelled: driver.distanceTravelled, adoptedImpacts: driver.adoptedImpacts, rejectedSteps: driver.rejectedSteps };
  }
  function token(driver, index = 0) {
    let cached = tokenRecords.get(driver.tokenId);
    const provenance = driver.trafficMetadata?.macroCompatibility?.edgeId || null;
    if (cached?.pose === driver.pose && cached.progress === driver.progress && cached.journey === driver.journey
      && cached.provenance === provenance && cached.hop === driver.routeHop) return cached.value;
    const stage = journeyPoint(driver.journey, driver.progress).segment.stage;
    const lane = topology.lanes[stage.laneId], laneIndex = stage.laneIndex;
    const spawnMargin = driver.archetype.width * 0.5 + 35;
    if (!cached) {
      cached = { value: { tokenId: driver.tokenId,
        tokenIndex: driver.trafficMetadata?.macroCompatibility?.tokenIndex ?? index,
        archetypeId: driver.archetype.id, transitLineId: driver.transitLineId || null, routeActive: true, driverActive: true }, hops: 0 };
      tokenRecords.set(driver.tokenId, cached);
    }
    const value = cached.value;
    if (cached.stage !== stage || cached.provenance !== provenance || cached.journey !== driver.journey) {
      Object.assign(value, { edgeId: provenance, direction: lane.direction, routeStage: stage.kind,
        routeLaneId: stage.laneId, routeConnectorId: stage.connectorId || null,
        routeNextLaneId: stage.nextLaneId || null, routePreviousLaneId: driver.journey.laneIds[laneIndex - 1] || null,
        routeRecentLaneIds: driver.journey.laneIds.slice(Math.max(0, laneIndex - 16), laneIndex),
        routeGeometryId: stage.connectorId || stage.laneId, routeSourceRoadEdgeId: lane.sourceRoadEdgeId,
        driverDestination: driver.journey.destination });
      if (!driver.transitLineId) projection.update({ tokenId: driver.tokenId, currentLaneId: stage.laneId,
        stage: stage.kind, trafficMetadata: driver.trafficMetadata });
    }
    Object.assign(value, { x: driver.pose.x, y: driver.pose.y, angle: driver.pose.angle, speed: driver.pose.speed,
      velocityX: driver.pose.velocityX, velocityY: driver.pose.velocityY,
      driverSpawnAllowed: driver.simulationTier !== "distant" && stage.kind === "lane" && driver.progress - stage.start > spawnMargin
        && stage.end - driver.progress > spawnMargin && junctions.stopDistance(driver) > 35,
      routeHop: driver.routeHop + laneIndex,
      routeStageProgress: Math.max(0, Math.min(1, (driver.progress - stage.start) / Math.max(0.001, stage.end - stage.start))),
      driverReason: driver.reason, driverControls: driver.controls });
    if (!driver.transitLineId) { totalHops += value.routeHop - cached.hops; cached.hops = value.routeHop; }
    Object.assign(cached, { stage, pose: driver.pose, progress: driver.progress, journey: driver.journey, provenance, hop: driver.routeHop });
    return value;
  }
  function flushExternalReads() {
    for (const driver of externalReads) { const cached = tokenRecords.get(driver.tokenId); if (cached) cached.pose = null; token(driver); }
    externalReads.clear();
  }
  liveTokens = drivers.map(token);
  function adoptContact(driver, slot) {
    const physical = scene.trafficPhysicalConsequencesSystem;
    const state = physical?.states?.get(driver.tokenId);
    if (!slot?.driverActive) return;
    const displaced = Math.hypot(slot.x - driver.pose.x, slot.y - driver.pose.y) > 0.001
      || Math.abs(slot.angle - driver.pose.angle) > 0.001;
    if (displaced) {
      driver.pose = { ...driver.pose, x: slot.x, y: slot.y, angle: slot.angle, travelAngle: slot.angle,
        speed: 0, velocityX: 0, velocityY: 0 };
      driver.maneuver = null; driver.clearPrediction = null; junctions.releaseManeuver(driver); driver.adoptedImpacts++;
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
    stats.physicalSteps++;
    const slot = materializer.assignments.get(driver.tokenId);
    const start = driver.pose;
    const desired = journeyDrivingTarget(driver, driver.panicUntil > clock ? speed : driver.cruiseSpeed);
    const serviceLimit = scene.transitSystem?.speedLimit?.(driver, dt) ?? Infinity;
    driver.serviceLimit = serviceLimit;
    let targetSpeed = Math.min(desired.speed, serviceLimit);
    if (!driver.journey.circular) targetSpeed = Math.min(targetSpeed, Math.max(0, driver.journey.destinationProgress - driver.progress - 2));
    let reason = serviceLimit === 0 ? "bus-stop" : driver.panicUntil > clock ? "panic" : "cruise";
    const objects = active ? world.obstacles(driver) : [];
    const stopDistance = active ? junctions.stopDistance(driver) : Infinity;
    if (stopDistance < 110) {
      targetSpeed = Math.min(targetSpeed, Math.sqrt(2 * driver.archetype.brake * Math.max(0, stopDistance - 2)));
      if (stopDistance < 3) targetSpeed = 0;
      reason = "junction-yield";
    }
    let blocker = null;
    const prediction = driver.clearPrediction;
    const reusePrediction = active && !driver.maneuver && prediction && clock < prediction.until
      && stopDistance > 110 && driver.wait < 1 && driver.panicUntil <= clock
      && prediction.journey === driver.journey && prediction.adoptedImpacts === driver.adoptedImpacts
      && Math.hypot(start.x - prediction.x, start.y - prediction.y) < 8
      && Math.abs(start.angle - prediction.angle) < 0.03
      && objects.length === prediction.objects.length && objects.every((object, i) => {
        const before = prediction.objects[i];
        return (object.tokenId || object.id) === before.id && object.x === before.x && object.y === before.y
          && object.angle === before.angle && object.archetype?.width === before.width && object.archetype?.height === before.height;
      });
    if (reusePrediction) stats.predictionReuses++;
    if (active && !driver.maneuver && !reusePrediction) {
      stats.predictionBuilds++;
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
    if (active && !driver.maneuver && !reusePrediction) {
      driver.clearPrediction = blocker ? null : { until: clock + 0.1, x: start.x, y: start.y, angle: start.angle,
        journey: driver.journey, adoptedImpacts: driver.adoptedImpacts,
        objects: objects.map(object => ({ id: object.tokenId || object.id, x: object.x, y: object.y, angle: object.angle,
          width: object.archetype?.width, height: object.archetype?.height })) };
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
    if (active && serviceLimit > 0 && blocker && !slot?.trafficDisabled && !ordinaryQueue && driver.wait > (queueLeader ? 4 : 0.75)
      && !driver.maneuver && clock >= driver.retryAt && planningBudget > 0 && planningTokenId === driver.tokenId) {
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
    const currentToken = token(driver);
    if (slot) { materializer.updateSlot(slot, currentToken); world.update(slot); }
  }
  function step(seconds = 0.05) {
    if (destroyed) throw new Error("Traffic driver runtime is destroyed.");
    let remaining = Math.max(0, seconds);
    planningBudget = 1;
    while (remaining > 0.000001) {
      const dt = Math.min(0.05, remaining); remaining -= dt; clock += dt;
      const active = drivers.filter(driver => materializer.assignments.has(driver.tokenId));
      for (const driver of active) adoptContact(driver, materializer.assignments.get(driver.tokenId));
      world.prepare();
      junctions.prepare(active, [...materializer.assignments.values()], clock);
      // A fixed CPU budget must not permanently favour early population IDs.
      // Give the next search to the eligible driver that has waited longest
      // since its previous attempt, rather than the first one in the loop.
      planningTokenId = active.filter(driver => {
        const leader = byId.get(driver.blockerId);
        return driver.blockerId && !driver.maneuver && driver.serviceLimit !== 0
          && !materializer.assignments.get(driver.tokenId)?.trafficDisabled
          && driver.wait > (leader ? 4 : 0.75) && clock >= driver.retryAt
          && (!leader || blockedQueue(leader));
      }).sort((a, b) => a.retryAt - b.retryAt || b.wait - a.wait || a.tokenId.localeCompare(b.tokenId))[0]?.tokenId || null;
      const focus = materializer.focus?.();
      const wakeRadius = Number(materializer.materializeRadius) + 160;
      const canSleep = distantSimulation && focus && Number.isFinite(wakeRadius);
      for (const driver of drivers) {
        if (hijacked.has(driver.tokenId)) continue;
        const assigned = materializer.assignments.has(driver.tokenId);
        const radius = driver.simulationTier === "physical" ? wakeRadius + 160 : wakeRadius;
        const near = !canSleep || assigned || driver.transitLineId || driver.maneuver || driver.panicUntil > clock
          || !driver.journey.circular || Math.hypot(driver.pose.x - focus.x, driver.pose.y - focus.y) <= radius;
        if (near) {
          if (driver.simulationTier === "distant" && driver.distantElapsed > 0 && !assigned) advanceDistant(driver, driver.distantElapsed);
          driver.distantElapsed = 0; driver.simulationTier = "physical";
          drive(driver, dt, assigned);
        } else {
          if (driver.simulationTier !== "distant") {
            driver.simulationTier = "distant";
            driver.distantElapsed = 0;
            driver.distantDue = clock + (trafficJourneyHash(driver.tokenId) % 500) / 1000;
            tokenRecords.get(driver.tokenId).pose = null;
            token(driver);
          }
          driver.distantElapsed += dt;
          if (clock + 1e-8 >= driver.distantDue) {
            advanceDistant(driver, driver.distantElapsed);
            driver.distantElapsed = 0; driver.distantDue = clock + 0.5;
          }
        }
      }
      ticks++;
    }
  }
  function advanceDistant(driver, seconds) {
    // Only unmaterialized civilian identities enter this tier. Their compiler
    // journey and clock advance coarsely; no rendered body is moved this way.
    // Promotion happens beyond the materialization radius. Buses always retain
    // full kinematics so service dwell and passenger exchange keep one clock.
    if (materializer.assignments.has(driver.tokenId)) throw new Error("A materialized driver cannot use distant progression.");
    const desired = journeyDrivingTarget(driver, driver.cruiseSpeed);
    const distance = desired.speed * seconds;
    driver.progress += distance; driver.distanceTravelled += distance;
    while (driver.progress >= driver.journey.destinationProgress) {
      driver.progress -= driver.journey.circuitLength;
      driver.routeHop += driver.journey.circuitLaneCount; driver.completedJourneys++;
    }
    const point = journeyPoint(driver.journey, driver.progress);
    driver.pose = { ...driver.pose, x: point.x, y: point.y, angle: point.angle, travelAngle: point.angle,
      speed: desired.speed, velocityX: Math.cos(point.angle) * desired.speed, velocityY: Math.sin(point.angle) * desired.speed,
      parked: false };
    driver.wait = 0; driver.blockerId = null; driver.reason = "distant-cruise"; driver.clearPrediction = null;
    stats.distantSteps++;
    token(driver);
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
  function accountingSnapshot() {
    flushExternalReads();
    const state = projection.counts(), validation = validateTrafficRouteMacroProjection(state, macroGraph);
    return { seededAgentCount: civilianDrivers.length, serviceVehicleCount: drivers.length - civilianDrivers.length,
      totalMacroTokens: seeded.totalMacroTokens, unseededAgentCount: seeded.unseeded.length,
      populationConserved: civilianDrivers.length + seeded.unseeded.length === seeded.totalMacroTokens,
      materializationTokenCount: liveTokens.length, hijackedAgentCount: hijacked.size,
      projectionValid: validation.valid, projectionErrors: validation.errors,
      projectedAgentCount: state.projectedAgentCount, ambiguousAgentCount: state.ambiguousAgentCount,
      unmatchedAgentCount: state.unmatchedAgentCount, districtCounts: state.districtCounts, edgeCounts: state.edgeCounts,
      districtPopulationCount: civilianDrivers.length, districtPopulationConserved: true };
  }
  function snapshot() {
    const flow = junctions.snapshot();
    return { ...accountingSnapshot(), driverActive: true, clockSeconds: clock, ticks,
      populationAllocation: structuredClone(populationAllocation),
      totalJunctionDecisions: totalHops, totalStageTransitions: totalHops * 2,
      blockedAgentCount: drivers.filter(driver => driver.wait > 1).length,
      performance: { ...stats, physicalDrivers: drivers.filter(driver => !hijacked.has(driver.tokenId) && driver.simulationTier !== "distant").length,
        distantDrivers: drivers.filter(driver => !hijacked.has(driver.tokenId) && driver.simulationTier === "distant").length },
      junctionFlowActive: true, junctionFlow: flow, junctionFlowState: structuredClone(flow),
      junctionActivePermitCount: flow.activePermitCount,
      routeBehavior: behaviorSnapshot(), movementAuthority: "shared-vehicle-kinematics",
      speedAuthority: "throttle-brake-reverse", routeProgressAuthority: "measured-physical-pose" };
  }
  return { step, snapshot, accountingSnapshot, agents: () => drivers.map(measuredAgent),
    materializationTokens() { flushExternalReads(); return liveTokens; },
    tokenCount: () => liveTokens.length,
    tokenFor(id) { flushExternalReads(); return hijacked.has(id) ? null : tokenRecords.get(id)?.value; },
    behaviorSnapshot, driver(id) { const driver = byId.get(id); if (driver) externalReads.add(driver); return driver; },
    destroy() {
      destroyed = true; scene.events?.off?.("weapon:fired", gunshot);
      scene.events?.off?.("traffic:vehicle-hijacked", onHijack); junctions.clear();
    } };
}
