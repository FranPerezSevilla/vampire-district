import { expect, test } from "@playwright/test";

async function waitForDefaultCompilerTraffic(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_MACRO_CITY_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT.snapshot().enabled
    && window.NBD_TRAFFIC.snapshot().laneAuthority === "compiler-route-lanes"
  ));
}

test.describe.configure({ timeout: 120_000 });

test("M8.3 compiler routes are the default production civilian authority with conservative macro accounting", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForDefaultCompilerTraffic(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const materializer = scene.trafficMaterializationSystem;
    const macro = scene.macroTrafficPoliceSystem;
    const multi = window.NBD_TRAFFIC_ROUTE_MULTI_AGENT;
    const topology = materializer.lanes?.localTopology;
    const runtime = multi.__policy.runtime();

    function flowSnapshot() {
      return [...macro.trafficFlows.entries()]
        .map(([edgeId, flow]) => [edgeId, {
          edgeId: flow.edgeId,
          tokenCount: flow.tokenCount,
          phases: [...flow.phases],
          completedTrips: flow.completedTrips
        }])
        .sort((left, right) => left[0].localeCompare(right[0]));
    }

    function pointSegmentDistance(point, from, to) {
      const dx = Number(to?.x || 0) - Number(from?.x || 0);
      const dy = Number(to?.y || 0) - Number(from?.y || 0);
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared <= 0.000001) {
        return Math.hypot(Number(point?.x || 0) - Number(from?.x || 0), Number(point?.y || 0) - Number(from?.y || 0));
      }
      const t = Math.max(0, Math.min(1, (
        (Number(point?.x || 0) - Number(from?.x || 0)) * dx
        + (Number(point?.y || 0) - Number(from?.y || 0)) * dy
      ) / lengthSquared));
      const x = Number(from?.x || 0) + dx * t;
      const y = Number(from?.y || 0) + dy * t;
      return Math.hypot(Number(point?.x || 0) - x, Number(point?.y || 0) - y);
    }

    function distanceToPolyline(point, points) {
      const list = Array.isArray(points) ? points : [];
      if (!list.length) return Number.POSITIVE_INFINITY;
      if (list.length === 1) return Math.hypot(
        Number(point?.x || 0) - Number(list[0]?.x || 0),
        Number(point?.y || 0) - Number(list[0]?.y || 0)
      );
      let minimum = Number.POSITIVE_INFINITY;
      for (let index = 0; index < list.length - 1; index++) {
        minimum = Math.min(minimum, pointSegmentDistance(point, list[index], list[index + 1]));
      }
      return minimum;
    }

    function validateRouteToken(token) {
      if (token?.routeActive !== true) return { valid: false, reason: "not-route-active", distance: null };
      if (token.routeStage === "lane") {
        const lane = topology?.lanes?.[token.routeLaneId];
        if (!lane?.points?.length) return { valid: false, reason: "missing-compiler-lane", distance: null };
        const distance = distanceToPolyline(token, lane.points);
        return {
          valid: token.routeGeometryId === lane.id && distance <= 0.05,
          reason: token.routeGeometryId === lane.id ? "lane-geometry" : "lane-geometry-id-mismatch",
          distance
        };
      }
      if (token.routeStage === "connector") {
        const connector = topology?.junctionConnectors?.connectors?.[token.routeConnectorId];
        if (!connector?.points?.length) return { valid: false, reason: "missing-compiler-connector", distance: null };
        const distance = distanceToPolyline(token, connector.points);
        const activationSafe = connector.activationSafe === true
          && (!Array.isArray(connector.rejectionReasons) || connector.rejectionReasons.length === 0);
        return {
          valid: activationSafe && token.routeGeometryId === connector.id && distance <= 0.05,
          reason: activationSafe ? "connector-geometry" : "unsafe-compiler-connector",
          distance
        };
      }
      return { valid: false, reason: `unsupported-route-stage:${String(token?.routeStage)}`, distance: null };
    }

    function nextFrame() {
      return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    async function focusAt(x, y, label) {
      scene.switchLayer(0, { x, y }, label);
      await window.NBD_CITY_STREAM.forceFocus(x, y);
      window.NBD_TRAFFIC.resync();
    }

    await focusAt(1140, 960, "M8.3 default compiler-route production soak baseline.");

    const initialMulti = multi.snapshot();
    const initialTraffic = window.NBD_TRAFFIC.snapshot();
    const initialMacro = window.NBD_MACRO_CITY.snapshot();
    const initialRouteTokens = runtime.materializationTokens();
    const stableTokenIds = runtime.agents().map(agent => agent.tokenId).sort();
    const stableTokenIdKey = JSON.stringify(stableTokenIds);
    const poolRef = materializer.pool;
    const poolSlotRefs = [...materializer.pool];
    const initialPoolSize = materializer.pool.length;
    const macroMapRef = macro.trafficFlows;
    const flowRefs = new Map([...macro.trafficFlows.entries()].map(([edgeId, flow]) => [edgeId, flow]));
    const phaseRefs = new Map([...macro.trafficFlows.entries()].map(([edgeId, flow]) => [edgeId, flow.phases]));
    const beforeMacroFlows = flowSnapshot();

    let trackedTokenId = initialTraffic.materialized
      .map(item => item.tokenId)
      .find(tokenId => stableTokenIds.includes(tokenId) && materializer.assignments.has(tokenId)) || null;
    if (!trackedTokenId) {
      trackedTokenId = [...materializer.assignments.keys()]
        .find(tokenId => stableTokenIds.includes(tokenId)) || null;
    }
    const trackedInitialPose = initialRouteTokens.find(token => token.tokenId === trackedTokenId) || null;
    if (trackedInitialPose) {
      await focusAt(trackedInitialPose.x, trackedInitialPose.y, "Follow default M8.3 route token at soak start.");
    }
    const trackedInitialSlot = trackedTokenId ? materializer.assignments.get(trackedTokenId) : null;
    const trackedSlotIndex = trackedInitialSlot?.slotIndex ?? null;
    const trackedSlotRef = trackedInitialSlot || null;

    const previousPositions = new Map(initialRouteTokens.map(token => [token.tokenId, { x: token.x, y: token.y }]));
    let previousClock = Number(initialMulti.clockSeconds || 0);
    let maxObservedStep = 0;
    let maxAllowedStep = 0;
    let maximumGeometryDistance = 0;
    let geometryViolationCount = 0;
    let identityViolationCount = 0;
    let trackedSlotViolationCount = 0;
    let maxReservationCount = Number(initialMulti.routeReservationCount || 0);
    let sawConnector = initialRouteTokens.some(token => token.routeStage === "connector");
    let sawOutgoingHop = runtime.agents().some(agent => Number(agent.routeHop || 0) > 0);
    let guardPoseProtected = true;
    const invalidReservations = [];
    let lastSnapshot = initialMulti;

    for (let index = 0; index < 240; index++) {
      await nextFrame();
      lastSnapshot = multi.snapshot();
      const runtimeTokens = runtime.materializationTokens();
      const currentTokenIds = runtime.agents().map(agent => agent.tokenId).sort();
      if (JSON.stringify(currentTokenIds) !== stableTokenIdKey) identityViolationCount++;

      const currentClock = Number(lastSnapshot.clockSeconds || 0);
      const elapsedRouteSeconds = Math.max(0, currentClock - previousClock);
      const allowedStep = Number(lastSnapshot.speed || 0) * elapsedRouteSeconds + 0.75;
      maxAllowedStep = Math.max(maxAllowedStep, allowedStep);
      previousClock = currentClock;

      for (const token of runtimeTokens) {
        const geometry = validateRouteToken(token);
        if (!geometry.valid) geometryViolationCount++;
        if (Number.isFinite(geometry.distance)) maximumGeometryDistance = Math.max(maximumGeometryDistance, geometry.distance);

        const previous = previousPositions.get(token.tokenId);
        if (previous) {
          const observed = Math.hypot(token.x - previous.x, token.y - previous.y);
          maxObservedStep = Math.max(maxObservedStep, observed);
          if (observed > allowedStep + 0.001) geometryViolationCount++;
        }
        previousPositions.set(token.tokenId, { x: token.x, y: token.y });
        if (token.routeStage === "connector") sawConnector = true;
      }
      if (runtime.agents().some(agent => Number(agent.routeHop || 0) > 0)) sawOutgoingHop = true;

      maxReservationCount = Math.max(maxReservationCount, Number(lastSnapshot.routeReservationCount || 0));
      for (const reservation of lastSnapshot.routeReservations || []) {
        const connector = topology?.junctionConnectors?.connectors?.[reservation.connectorId];
        if (!stableTokenIds.includes(reservation.tokenId) || !connector || connector.nodeId !== reservation.junctionId) {
          invalidReservations.push({ ...reservation });
        }
      }

      if (trackedTokenId) {
        const trackedSlot = materializer.assignments.get(trackedTokenId);
        if (!trackedSlot || trackedSlot !== trackedSlotRef || trackedSlot.slotIndex !== trackedSlotIndex || trackedSlot.tokenId !== trackedTokenId) {
          trackedSlotViolationCount++;
        } else if (index === 40) {
          const x = trackedSlot.x;
          const y = trackedSlot.y;
          scene.trafficLocalBehaviorSystem?.applyDecision?.(trackedSlot, {}, {}, {}, 0.05);
          scene.trafficSteeringPresentationSystem?.applyPresentation?.(trackedSlot, {}, 0.05);
          if (Math.hypot(trackedSlot.x - x, trackedSlot.y - y) > 0.001) guardPoseProtected = false;
        }
      }

      if (trackedTokenId && index > 0 && index % 30 === 0) {
        const trackedPose = runtime.materializationTokens().find(token => token.tokenId === trackedTokenId);
        if (trackedPose) {
          await focusAt(trackedPose.x, trackedPose.y, `Follow default M8.3 route token during soak ${index}.`);
        }
      }
    }

    const duringTraffic = window.NBD_TRAFFIC.snapshot();
    const duringMulti = multi.snapshot();
    const duringMacro = window.NBD_MACRO_CITY.snapshot();
    const afterMacroFlows = flowSnapshot();
    const macroRefsPreserved = macro.trafficFlows === macroMapRef
      && [...macro.trafficFlows.entries()].every(([edgeId, flow]) => (
        flowRefs.get(edgeId) === flow
        && phaseRefs.get(edgeId) === flow.phases
      ));
    const poolPreservedDuring = materializer.pool === poolRef
      && materializer.pool.length === initialPoolSize
      && materializer.pool.every((slot, index) => slot === poolSlotRefs[index]);
    const trackedFinalSlot = trackedTokenId ? materializer.assignments.get(trackedTokenId) : null;
    const reservationRegistry = runtime.reservationRegistry;

    const stopped = multi.stop();
    const afterMulti = multi.snapshot();
    const afterTraffic = window.NBD_TRAFFIC.snapshot();
    const reservationAfterStop = reservationRegistry.snapshot();
    const legacyRouteMetadataCleared = materializer.pool.every(slot => slot.routeActive !== true);

    return {
      topologyOwnershipMode: topology?.ownershipMode || null,
      initialMulti,
      initialTraffic,
      initialMacro,
      duringTraffic,
      duringMulti,
      duringMacro,
      stopped,
      afterMulti,
      afterTraffic,
      initialPoolSize,
      finalPoolSize: materializer.pool.length,
      poolPreservedDuring,
      stableTokenCount: stableTokenIds.length,
      trackedTokenId,
      trackedSlotIndex,
      trackedFinalSlotIndex: trackedFinalSlot?.slotIndex ?? null,
      trackedSlotViolationCount,
      identityViolationCount,
      geometryViolationCount,
      maximumGeometryDistance,
      maxObservedStep,
      maxAllowedStep,
      sawConnector,
      sawOutgoingHop,
      maxReservationCount,
      invalidReservationCount: invalidReservations.length,
      reservationCountAfterStop: reservationAfterStop.activeReservationCount,
      guardPoseProtected,
      macroRefsPreserved,
      macroFlowsFrozenDuringRouteAuthority: JSON.stringify(beforeMacroFlows) === JSON.stringify(afterMacroFlows),
      legacyRouteMetadataCleared
    };
  });

  expect(result.topologyOwnershipMode).toBe("compiler-node-id");

  expect(result.initialMulti.defaultEnabled).toBe(true);
  expect(result.initialMulti.enabled).toBe(true);
  expect(result.initialMulti.defaultTrafficAuthority).toBe("multi-agent-compiler-route");
  expect(result.initialMulti.activationBlockedReason).toBe(null);
  expect(result.initialMulti.populationConserved).toBe(true);
  expect(result.initialMulti.unseededAgentCount).toBe(0);
  expect(result.initialMulti.seededAgentCount).toBe(result.initialMulti.totalMacroTokens);
  expect(result.initialMulti.projectionValid).toBe(true);
  expect(result.initialMulti.districtPopulationConserved).toBe(true);
  expect(result.initialMulti.macroAccountingInstalled).toBe(true);
  expect(result.initialMulti.macroMutationAuthority).toBe(false);
  expect(result.initialMulti.macroCoordinateAuthority).toBe(false);
  expect(result.stableTokenCount).toBe(result.initialMulti.totalMacroTokens);

  expect(result.initialTraffic.routeMovementActive).toBe(true);
  expect(result.initialTraffic.laneAuthority).toBe("compiler-route-lanes");
  expect(result.initialTraffic.compilerLocalTopology.movementActive).toBe(true);
  expect(result.trackedTokenId).not.toBe(null);
  expect(result.trackedSlotIndex).not.toBe(null);

  expect(result.initialMacro.civilianAccountingMode).toBe("compiler-route-projection");
  expect(result.initialMacro.legacyCivilianPhaseAdvancementActive).toBe(false);
  expect(result.initialMacro.civilianRouteAccounting.populationConserved).toBe(true);
  expect(result.initialMacro.civilianRouteAccounting.unseededAgentCount).toBe(0);
  expect(result.initialMacro.civilianRouteAccounting.districtPopulationConserved).toBe(true);

  expect(result.identityViolationCount).toBe(0);
  expect(result.trackedSlotViolationCount).toBe(0);
  expect(result.trackedFinalSlotIndex).toBe(result.trackedSlotIndex);
  expect(result.poolPreservedDuring).toBe(true);
  expect(result.initialPoolSize).toBe(result.finalPoolSize);

  expect(result.geometryViolationCount).toBe(0);
  expect(result.maximumGeometryDistance).toBeLessThanOrEqual(0.05);
  expect(result.maxObservedStep).toBeLessThanOrEqual(result.maxAllowedStep + 0.001);
  expect(result.sawConnector).toBe(true);
  expect(result.sawOutgoingHop).toBe(true);

  expect(result.maxReservationCount).toBeGreaterThan(0);
  expect(result.invalidReservationCount).toBe(0);
  expect(result.reservationCountAfterStop).toBe(0);

  expect(result.duringMulti.behaviorGuardInstalled).toBe(true);
  expect(result.duringMulti.steeringGuardInstalled).toBe(true);
  expect(result.guardPoseProtected).toBe(true);
  expect(result.duringTraffic.routeMovementActive).toBe(true);
  expect(result.duringTraffic.laneAuthority).toBe("compiler-route-lanes");

  expect(result.macroRefsPreserved).toBe(true);
  expect(result.macroFlowsFrozenDuringRouteAuthority).toBe(true);
  expect(result.duringMacro.civilianAccountingMode).toBe("compiler-route-projection");
  expect(result.duringMacro.legacyCivilianPhaseAdvancementActive).toBe(false);
  expect(result.duringMacro.civilianRouteAccounting.populationConserved).toBe(true);
  expect(result.duringMacro.civilianRouteAccounting.districtPopulationConserved).toBe(true);
  expect(result.duringMacro.tick).toBeGreaterThan(result.initialMacro.tick);

  expect(result.stopped.enabled).toBe(false);
  expect(result.stopped.fixedPoolPreserved).toBe(true);
  expect(result.afterMulti.enabled).toBe(false);
  expect(result.afterMulti.manualPause).toBe(true);
  expect(result.afterMulti.behaviorGuardInstalled).toBe(false);
  expect(result.afterMulti.steeringGuardInstalled).toBe(false);
  expect(result.afterMulti.routeReservationCount).toBe(0);
  expect(result.afterTraffic.routeMovementActive).toBe(false);
  expect(result.afterTraffic.laneAuthority).toBe("authored-local-lanes");
  expect(result.legacyRouteMetadataCleared).toBe(true);
  expect(pageErrors).toEqual([]);
});
