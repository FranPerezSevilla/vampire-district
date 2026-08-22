import { expect, test } from "@playwright/test";

async function waitForMultiAgentTraffic(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_MACRO_CITY_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT
  ));
}

test.describe.configure({ timeout: 120_000 });

test("M8 multi-agent compiler routes survive an opt-in production browser soak without changing default traffic authority", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForMultiAgentTraffic(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const materializer = scene.trafficMaterializationSystem;
    const macro = scene.macroTrafficPoliceSystem;
    const multi = window.NBD_TRAFFIC_ROUTE_MULTI_AGENT;
    const topology = materializer.lanes?.localTopology;

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

    async function focusAt(x, y, label) {
      scene.switchLayer(0, { x, y }, label);
      await window.NBD_CITY_STREAM.forceFocus(x, y);
      window.NBD_TRAFFIC.resync();
    }

    // Use the same production traffic area exercised by the existing browser suite.
    await focusAt(1140, 960, "M8.2 production multi-agent soak baseline.");
    const legacyBaseline = window.NBD_TRAFFIC.snapshot();
    const beforeMulti = multi.snapshot();
    const beforeTraffic = window.NBD_TRAFFIC.snapshot();
    const poolRef = materializer.pool;
    const poolSlotRefs = [...materializer.pool];
    const initialPoolSize = materializer.pool.length;

    // Macro traffic normally advances from the Phaser game loop. Pause only that
    // ambient tick inside this browser harness so any flow mutation observed below
    // can only come from the explicitly exercised M8 runtime.
    const originalMacroUpdate = macro.update;
    macro.update = () => false;
    const macroMapRef = macro.trafficFlows;
    const flowRefs = new Map([...macro.trafficFlows.entries()].map(([edgeId, flow]) => [edgeId, flow]));
    const phaseRefs = new Map([...macro.trafficFlows.entries()].map(([edgeId, flow]) => [edgeId, flow.phases]));
    const beforeMacro = flowSnapshot();

    let reservationRegistry = null;
    let stopped = null;
    try {
      const started = multi.start();
      const runtime = multi.__policy.runtime();
      reservationRegistry = runtime.reservationRegistry;
      const initialAgents = runtime.agents();
      const stableTokenIds = initialAgents.map(agent => agent.tokenId).sort();
      const stableTokenIdKey = JSON.stringify(stableTokenIds);
      const initialRouteTokens = runtime.materializationTokens();
      const legacyIds = legacyBaseline.materialized.map(item => item.tokenId);
      let trackedTokenId = legacyIds.find(tokenId => materializer.assignments.has(tokenId)) || null;
      if (!trackedTokenId) {
        trackedTokenId = [...materializer.assignments.keys()]
          .find(tokenId => stableTokenIds.includes(tokenId)) || null;
      }

      const trackedInitialToken = initialRouteTokens.find(token => token.tokenId === trackedTokenId) || null;
      if (trackedInitialToken) {
        await focusAt(trackedInitialToken.x, trackedInitialToken.y, "Follow M8 route token at soak start.");
      }
      const trackedInitialSlot = trackedTokenId ? materializer.assignments.get(trackedTokenId) : null;
      const trackedSlotIndex = trackedInitialSlot?.slotIndex ?? null;
      const trackedSlotRef = trackedInitialSlot || null;

      const previousPositions = new Map(initialRouteTokens.map(token => [token.tokenId, { x: token.x, y: token.y }]));
      let maxObservedStep = 0;
      let maximumGeometryDistance = 0;
      let geometryViolationCount = 0;
      let identityViolationCount = 0;
      let trackedSlotViolationCount = 0;
      let maxReservationCount = 0;
      let maxBlockedAgentCount = 0;
      let sawConnector = initialRouteTokens.some(token => token.routeStage === "connector");
      let sawOutgoingHop = initialAgents.some(agent => Number(agent.routeHop || 0) > 0);
      let guardPoseProtected = true;
      const reservationOwners = new Set();
      const invalidReservationCount = [];
      let lastSnapshot = started;

      for (let index = 0; index < 180; index++) {
        lastSnapshot = multi.step(0.05);
        const runtimeTokens = runtime.materializationTokens();
        const currentTokenIds = runtime.agents().map(agent => agent.tokenId).sort();
        if (JSON.stringify(currentTokenIds) !== stableTokenIdKey) identityViolationCount++;

        for (const token of runtimeTokens) {
          const geometry = validateRouteToken(token);
          if (!geometry.valid) geometryViolationCount++;
          if (Number.isFinite(geometry.distance)) maximumGeometryDistance = Math.max(maximumGeometryDistance, geometry.distance);

          const previous = previousPositions.get(token.tokenId);
          if (previous) {
            maxObservedStep = Math.max(maxObservedStep, Math.hypot(token.x - previous.x, token.y - previous.y));
          }
          previousPositions.set(token.tokenId, { x: token.x, y: token.y });
          if (token.routeStage === "connector") sawConnector = true;
        }
        if (runtime.agents().some(agent => Number(agent.routeHop || 0) > 0)) sawOutgoingHop = true;

        maxReservationCount = Math.max(maxReservationCount, Number(lastSnapshot.routeReservationCount || 0));
        maxBlockedAgentCount = Math.max(maxBlockedAgentCount, Number(lastSnapshot.blockedAgentCount || 0));
        for (const reservation of lastSnapshot.routeReservations || []) {
          reservationOwners.add(reservation.tokenId);
          const connector = topology?.junctionConnectors?.connectors?.[reservation.connectorId];
          if (!stableTokenIds.includes(reservation.tokenId) || !connector || connector.nodeId !== reservation.junctionId) {
            invalidReservationCount.push({ ...reservation });
          }
        }

        if (trackedTokenId) {
          const trackedSlot = materializer.assignments.get(trackedTokenId);
          if (!trackedSlot || trackedSlot !== trackedSlotRef || trackedSlot.slotIndex !== trackedSlotIndex || trackedSlot.tokenId !== trackedTokenId) {
            trackedSlotViolationCount++;
          } else {
            const x = trackedSlot.x;
            const y = trackedSlot.y;
            scene.trafficLocalBehaviorSystem?.applyDecision?.(trackedSlot, {}, {}, {}, 0.05);
            scene.trafficSteeringPresentationSystem?.applyPresentation?.(trackedSlot, {}, 0.05);
            if (Math.hypot(trackedSlot.x - x, trackedSlot.y - y) > 0.001) guardPoseProtected = false;
          }
        }

        // Follow the same production token while forcing real chunk/camera movement.
        // The macro tick remains paused, but all streaming/materialization paths are live.
        if (trackedTokenId && index > 0 && index % 24 === 0) {
          const trackedPose = runtime.materializationTokens().find(token => token.tokenId === trackedTokenId);
          if (trackedPose) {
            await focusAt(trackedPose.x, trackedPose.y, `Follow M8 route token during soak ${index}.`);
          }
        }
      }

      const duringTraffic = window.NBD_TRAFFIC.snapshot();
      const duringMulti = multi.snapshot();
      const afterMacroBeforeStop = flowSnapshot();
      const macroRefsPreserved = macro.trafficFlows === macroMapRef
        && [...macro.trafficFlows.entries()].every(([edgeId, flow]) => (
          flowRefs.get(edgeId) === flow
          && phaseRefs.get(edgeId) === flow.phases
        ));
      const poolPreservedDuring = materializer.pool === poolRef
        && materializer.pool.length === initialPoolSize
        && materializer.pool.every((slot, index) => slot === poolSlotRefs[index]);
      const trackedFinalSlot = trackedTokenId ? materializer.assignments.get(trackedTokenId) : null;

      stopped = multi.stop();
      const afterMulti = multi.snapshot();
      const afterTraffic = window.NBD_TRAFFIC.snapshot();
      const reservationAfterStop = reservationRegistry.snapshot();
      const afterMacro = flowSnapshot();
      const poolPreservedAfter = materializer.pool === poolRef
        && materializer.pool.length === initialPoolSize
        && materializer.pool.every((slot, index) => slot === poolSlotRefs[index]);
      const legacyRouteMetadataCleared = materializer.pool.every(slot => slot.routeActive !== true);

      return {
        missingLegacyTraffic: legacyBaseline.materializedCount === 0,
        topologyOwnershipMode: topology?.ownershipMode || null,
        beforeMulti,
        beforeTraffic,
        started,
        duringTraffic,
        duringMulti,
        stopped,
        afterMulti,
        afterTraffic,
        initialPoolSize,
        finalPoolSize: materializer.pool.length,
        poolPreservedDuring,
        poolPreservedAfter,
        stableTokenCount: stableTokenIds.length,
        trackedTokenId,
        trackedSlotIndex,
        trackedFinalSlotIndex: trackedFinalSlot?.slotIndex ?? null,
        trackedSlotViolationCount,
        identityViolationCount,
        geometryViolationCount,
        maximumGeometryDistance,
        maxObservedStep,
        expectedMaximumStep: Number(started.speed || 0) * 0.05 + 0.75,
        sawConnector,
        sawOutgoingHop,
        maxReservationCount,
        maxBlockedAgentCount,
        totalYieldCount: Number(lastSnapshot.totalYieldCount || 0),
        reservationOwners: [...reservationOwners].sort(),
        invalidReservationCount: invalidReservationCount.length,
        reservationCountAfterStop: reservationAfterStop.activeReservationCount,
        guardPoseProtected,
        macroRefsPreserved,
        macroUnchangedDuring: JSON.stringify(beforeMacro) === JSON.stringify(afterMacroBeforeStop),
        macroUnchangedAfterStop: JSON.stringify(beforeMacro) === JSON.stringify(afterMacro),
        legacyRouteMetadataCleared
      };
    } finally {
      if (multi.snapshot().enabled) multi.stop();
      macro.update = originalMacroUpdate;
    }
  });

  expect(result.missingLegacyTraffic).toBe(false);
  expect(result.topologyOwnershipMode).toBe("compiler-node-id");

  expect(result.beforeMulti.defaultEnabled).toBe(false);
  expect(result.beforeMulti.enabled).toBe(false);
  expect(result.beforeMulti.defaultTrafficAuthority).toBe("authored-local-lanes");
  expect(result.beforeTraffic.routeMovementActive).toBe(false);
  expect(result.beforeTraffic.laneAuthority).toBe("authored-local-lanes");

  expect(result.started.enabled).toBe(true);
  expect(result.started.populationConserved).toBe(true);
  expect(result.started.seededAgentCount + result.started.unseededAgentCount).toBe(result.started.totalMacroTokens);
  expect(result.started.macroMutationAuthority).toBe(false);
  expect(result.started.macroCoordinateAuthority).toBe(false);
  expect(result.stableTokenCount).toBe(result.started.seededAgentCount);
  expect(result.trackedTokenId).not.toBe(null);
  expect(result.trackedSlotIndex).not.toBe(null);

  expect(result.identityViolationCount).toBe(0);
  expect(result.trackedSlotViolationCount).toBe(0);
  expect(result.trackedFinalSlotIndex).toBe(result.trackedSlotIndex);
  expect(result.poolPreservedDuring).toBe(true);
  expect(result.poolPreservedAfter).toBe(true);
  expect(result.initialPoolSize).toBe(result.finalPoolSize);

  expect(result.geometryViolationCount).toBe(0);
  expect(result.maximumGeometryDistance).toBeLessThanOrEqual(0.05);
  expect(result.maxObservedStep).toBeLessThanOrEqual(result.expectedMaximumStep);
  expect(result.sawConnector).toBe(true);
  expect(result.sawOutgoingHop).toBe(true);

  expect(result.maxReservationCount).toBeGreaterThan(0);
  expect(result.invalidReservationCount).toBe(0);
  expect(result.reservationCountAfterStop).toBe(0);
  expect(result.totalYieldCount).toBeGreaterThanOrEqual(0);

  expect(result.duringMulti.behaviorGuardInstalled).toBe(true);
  expect(result.duringMulti.steeringGuardInstalled).toBe(true);
  expect(result.guardPoseProtected).toBe(true);
  expect(result.duringTraffic.routeMovementActive).toBe(true);
  expect(result.duringTraffic.laneAuthority).toBe("authored-local-lanes");

  expect(result.macroRefsPreserved).toBe(true);
  expect(result.macroUnchangedDuring).toBe(true);
  expect(result.macroUnchangedAfterStop).toBe(true);

  expect(result.stopped.enabled).toBe(false);
  expect(result.stopped.fixedPoolPreserved).toBe(true);
  expect(result.afterMulti.enabled).toBe(false);
  expect(result.afterMulti.behaviorGuardInstalled).toBe(false);
  expect(result.afterMulti.steeringGuardInstalled).toBe(false);
  expect(result.afterMulti.routeReservationCount).toBe(0);
  expect(result.afterTraffic.routeMovementActive).toBe(false);
  expect(result.afterTraffic.laneAuthority).toBe("authored-local-lanes");
  expect(result.legacyRouteMetadataCleared).toBe(true);
  expect(pageErrors).toEqual([]);
});
