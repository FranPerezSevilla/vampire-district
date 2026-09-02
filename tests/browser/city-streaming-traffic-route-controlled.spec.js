import { expect, test } from "@playwright/test";

async function waitForControlledTraffic(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_MACRO_CITY_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC
    && window.NBD_TRAFFIC_ROUTE_CONTROL
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT?.snapshot?.().enabled
  ));
}

test.describe.configure({ timeout: 90_000 });

test("controlled compiler routes still cross straight/right/left when default M8 traffic is explicitly paused", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForControlledTraffic(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const control = window.NBD_TRAFFIC_ROUTE_CONTROL;
    const multi = window.NBD_TRAFFIC_ROUTE_MULTI_AGENT;
    const defaultBefore = multi.snapshot();
    const defaultStopped = multi.stop();
    const beforeTraffic = window.NBD_TRAFFIC.snapshot();
    const beforeControl = control.snapshot();
    const initialPoolSize = scene.trafficMaterializationSystem.pool.length;
    const turnResults = [];

    async function focusAt(x, y, label) {
      scene.switchLayer(0, { x, y }, label);
      await window.NBD_CITY_STREAM.forceFocus(x, y);
      window.NBD_TRAFFIC.resync();
    }

    async function runTurn(turnType, exerciseCameraRetention = false) {
      let snapshot = control.start({
        turnType,
        startProgress: 0.9,
        routeSpeed: 90
      });
      const tokenId = snapshot.tokenId;
      const slotIndex = snapshot.slotIndex;
      const initialLaneId = snapshot.currentLaneId;
      await focusAt(snapshot.x, snapshot.y, `Controlled ${turnType} route focus.`);
      snapshot = control.snapshot();

      let sawConnector = snapshot.stage === "connector";
      let sawOutgoingLane = false;
      let sawRouteReservation = snapshot.routeReservationCount > 0;
      let sameSlotThroughout = true;
      let poseMismatch = false;
      let cameraRetention = null;
      let maxObservedStep = 0;
      let previous = { x: snapshot.x, y: snapshot.y };

      for (let index = 0; index < 180; index++) {
        snapshot = control.step(0.05);
        scene.trafficLocalBehaviorSystem?.update?.(0.05, { force: true });
        scene.trafficSteeringPresentationSystem?.update?.(0.05, { force: true });

        const slot = scene.trafficMaterializationSystem.pool[slotIndex];
        sameSlotThroughout = sameSlotThroughout
          && Boolean(slot?.tokenId === tokenId)
          && scene.trafficMaterializationSystem.assignments.get(tokenId) === slot;
        poseMismatch = poseMismatch || !slot
          || Math.hypot(slot.x - snapshot.x, slot.y - snapshot.y) > 0.02;
        const observedStep = Math.hypot(snapshot.x - previous.x, snapshot.y - previous.y);
        maxObservedStep = Math.max(maxObservedStep, observedStep);
        previous = { x: snapshot.x, y: snapshot.y };
        sawRouteReservation = sawRouteReservation || snapshot.routeReservationCount > 0;

        if (snapshot.stage === "connector") {
          sawConnector = true;
          if (exerciseCameraRetention && !cameraRetention) {
            const away = {
              x: snapshot.x < 2400 ? 4500 : 220,
              y: snapshot.y < 1800 ? 3300 : 220
            };
            await focusAt(away.x, away.y, "Move camera away during controlled connector crossing.");
            const awaySnapshot = control.snapshot();
            const retainedSlot = scene.trafficMaterializationSystem.pool[slotIndex];
            cameraRetention = {
              enabled: awaySnapshot.enabled,
              sameToken: retainedSlot?.tokenId === tokenId,
              sameSlot: scene.trafficMaterializationSystem.assignments.get(tokenId) === retainedSlot,
              lifecycle: retainedSlot?.lifecycleState || null,
              routeStage: retainedSlot?.routeStage || null,
              reservationCount: awaySnapshot.routeReservationCount
            };
            await focusAt(snapshot.x, snapshot.y, "Return camera to controlled connector crossing.");
          }
        }

        if (snapshot.routeHop >= 1
          && snapshot.stage === "lane"
          && snapshot.currentLaneId !== initialLaneId) {
          sawOutgoingLane = true;
          break;
        }
        if ((snapshot.lastBlockedReason && snapshot.lastBlockedReason !== "junction-yield") || snapshot.slotLost) break;
      }

      const duringTraffic = window.NBD_TRAFFIC.snapshot();
      const finalSlotTokenId = scene.trafficMaterializationSystem.pool[slotIndex]?.tokenId || null;
      const stopped = control.stop();
      const afterStop = control.snapshot();
      return {
        turnType,
        tokenId,
        slotIndex,
        sawConnector,
        sawOutgoingLane,
        sawRouteReservation,
        sameSlotThroughout,
        poseMismatch,
        cameraRetention,
        routeHop: snapshot.routeHop,
        teleportCount: snapshot.teleportCount,
        maximumStepDistance: snapshot.maximumStepDistance,
        maxObservedStep,
        blockedReason: snapshot.lastBlockedReason,
        slotLost: snapshot.slotLost,
        fixedPoolDuring: snapshot.fixedPoolPreserved,
        routeMovementActiveDuring: duringTraffic.routeMovementActive,
        laneAuthorityDuring: duringTraffic.laneAuthority,
        finalSlotTokenId,
        stopped,
        enabledAfterStop: afterStop.enabled,
        routeReservationCountAfterStop: afterStop.routeReservationCount,
        poolSizeAfterStop: scene.trafficMaterializationSystem.pool.length
      };
    }

    for (const turnType of ["straight", "right", "left"]) {
      turnResults.push(await runTurn(turnType, turnType === "right"));
    }

    const afterTraffic = window.NBD_TRAFFIC.snapshot();
    return {
      defaultBefore,
      defaultStopped,
      beforeTraffic,
      beforeControl,
      afterTraffic,
      initialPoolSize,
      finalPoolSize: scene.trafficMaterializationSystem.pool.length,
      turnResults
    };
  });

  expect(result.defaultBefore.defaultEnabled).toBe(true);
  expect(result.defaultBefore.enabled).toBe(true);
  expect(result.defaultBefore.defaultTrafficAuthority).toBe("multi-agent-compiler-route");
  expect(result.defaultStopped.enabled).toBe(false);
  expect(result.defaultStopped.fixedPoolPreserved).toBe(true);
  expect(result.defaultStopped.manualPause).toBe(true);

  expect(result.beforeControl.defaultEnabled).toBe(false);
  expect(result.beforeControl.enabled).toBe(false);
  expect(result.beforeControl.routeReservationCount).toBe(0);
  expect(result.beforeTraffic.routeMovementActive).toBe(false);
  expect(result.beforeTraffic.laneAuthority).toBe("authored-local-lanes");
  expect(result.initialPoolSize).toBe(result.finalPoolSize);

  for (const turn of result.turnResults) {
    expect(turn.sawConnector).toBe(true);
    expect(turn.sawOutgoingLane).toBe(true);
    expect(turn.sawRouteReservation).toBe(true);
    expect(turn.sameSlotThroughout).toBe(true);
    expect(turn.poseMismatch).toBe(false);
    expect(turn.routeHop).toBeGreaterThanOrEqual(1);
    expect(turn.teleportCount).toBe(0);
    expect(turn.maximumStepDistance).toBeLessThanOrEqual(4.51);
    expect(turn.maxObservedStep).toBeLessThanOrEqual(4.51);
    expect(turn.blockedReason).toBe(null);
    expect(turn.slotLost).toBe(false);
    expect(turn.fixedPoolDuring).toBe(true);
    expect(turn.routeMovementActiveDuring).toBe(true);
    expect(turn.laneAuthorityDuring).toBe("authored-local-lanes");
    expect(turn.stopped.fixedPoolPreserved).toBe(true);
    expect(turn.enabledAfterStop).toBe(false);
    expect(turn.routeReservationCountAfterStop).toBe(0);
    expect(turn.poolSizeAfterStop).toBe(result.initialPoolSize);
  }

  const right = result.turnResults.find(item => item.turnType === "right");
  expect(right.cameraRetention).not.toBe(null);
  expect(right.cameraRetention.enabled).toBe(true);
  expect(right.cameraRetention.sameToken).toBe(true);
  expect(right.cameraRetention.sameSlot).toBe(true);
  expect(right.cameraRetention.lifecycle).toBe("crossing-junction");
  expect(right.cameraRetention.routeStage).toBe("connector");
  expect(right.cameraRetention.reservationCount).toBeGreaterThanOrEqual(1);

  expect(result.afterTraffic.routeMovementActive).toBe(false);
  expect(result.afterTraffic.laneAuthority).toBe("authored-local-lanes");
  expect(result.finalPoolSize).toBe(result.initialPoolSize);
  expect(pageErrors).toEqual([]);
});

test("the first junction east of spawn keeps one visible slot through west-to-east crossing", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForControlledTraffic(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const materializer = scene.trafficMaterializationSystem;
    const control = window.NBD_TRAFFIC_ROUTE_CONTROL;
    const multi = window.NBD_TRAFFIC_ROUTE_MULTI_AGENT;
    const topology = materializer.lanes?.localTopology;
    const junctionId = "stream-node:1754:1574";
    const incomingLaneId = "traffic-lane-segment:stream-edge:road-edge:h:1320:1574:1754:1574:0:forward";
    const outgoingLaneId = "traffic-lane-segment:stream-edge:road-edge:h:1754:1574:2340:1574:0:forward";
    const transition = Object.values(topology?.transitions || {}).find(candidate => (
      candidate?.nodeId === junctionId
      && candidate?.incomingLaneId === incomingLaneId
      && candidate?.outgoingLaneId === outgoingLaneId
      && candidate?.preferred
      && candidate?.turnType === "straight"
    ));
    if (!transition) return { missingTransition: true };

    const defaultBefore = multi.snapshot();
    multi.stop();
    scene.switchLayer(0, { x: 1754, y: 1574 }, "First-spawn-junction continuity regression.");
    await window.NBD_CITY_STREAM.forceFocus(1754, 1574);
    window.NBD_TRAFFIC.resync();

    let snapshot = control.start({
      transitionId: transition.id,
      startProgress: 0.82,
      routeSpeed: 72
    });
    const tokenId = snapshot.tokenId;
    const slotIndex = snapshot.slotIndex;
    let sameSlotThroughout = true;
    let visibleThroughout = true;
    let activeThroughout = true;
    let sawConnector = snapshot.stage === "connector";
    let sawOutgoingLane = false;
    let sawCrossingLifecycle = false;
    let maxObservedStep = 0;
    let previous = { x: snapshot.x, y: snapshot.y };
    const samples = [];

    for (let index = 0; index < 220; index++) {
      snapshot = control.step(0.05);
      scene.trafficLocalBehaviorSystem?.update?.(0.05, { force: true });
      scene.trafficSteeringPresentationSystem?.update?.(0.05, { force: true });

      const slot = materializer.pool[slotIndex];
      sameSlotThroughout = sameSlotThroughout
        && Boolean(slot?.tokenId === tokenId)
        && materializer.assignments.get(tokenId) === slot;
      visibleThroughout = visibleThroughout && slot?.container?.visible !== false;
      activeThroughout = activeThroughout && slot?.container?.active !== false;
      sawConnector = sawConnector || snapshot.stage === "connector";
      sawCrossingLifecycle = sawCrossingLifecycle || slot?.lifecycleState === "crossing-junction";
      const observedStep = Math.hypot(snapshot.x - previous.x, snapshot.y - previous.y);
      maxObservedStep = Math.max(maxObservedStep, observedStep);
      previous = { x: snapshot.x, y: snapshot.y };

      if (index % 8 === 0 || snapshot.stage === "connector") {
        samples.push({
          stage: snapshot.stage,
          laneId: snapshot.currentLaneId,
          connectorId: snapshot.connectorId || null,
          x: snapshot.x,
          y: snapshot.y,
          slotTokenId: slot?.tokenId || null,
          visible: slot?.container?.visible !== false,
          active: slot?.container?.active !== false,
          lifecycleState: slot?.lifecycleState || null
        });
      }

      if (snapshot.routeHop >= 1 && snapshot.stage === "lane" && snapshot.currentLaneId === outgoingLaneId) {
        sawOutgoingLane = true;
        break;
      }
      if ((snapshot.lastBlockedReason && snapshot.lastBlockedReason !== "junction-yield") || snapshot.slotLost) break;
    }

    const finalSlotTokenId = materializer.pool[slotIndex]?.tokenId || null;
    const stopped = control.stop();
    return {
      missingTransition: false,
      junctionId,
      transitionId: transition.id,
      defaultBefore,
      tokenId,
      slotIndex,
      sameSlotThroughout,
      visibleThroughout,
      activeThroughout,
      sawConnector,
      sawOutgoingLane,
      sawCrossingLifecycle,
      routeHop: snapshot.routeHop,
      currentLaneId: snapshot.currentLaneId,
      lastBlockedReason: snapshot.lastBlockedReason,
      slotLost: snapshot.slotLost,
      teleportCount: snapshot.teleportCount,
      maximumStepDistance: snapshot.maximumStepDistance,
      maxObservedStep,
      finalSlotTokenId,
      fixedPoolPreserved: snapshot.fixedPoolPreserved,
      stopped,
      samples
    };
  });

  expect(result.missingTransition).toBe(false);
  expect(result.defaultBefore.enabled).toBe(true);
  expect(result.defaultBefore.defaultTrafficAuthority).toBe("multi-agent-compiler-route");
  expect(result.junctionId).toBe("stream-node:1754:1574");
  expect(result.sameSlotThroughout).toBe(true);
  expect(result.visibleThroughout).toBe(true);
  expect(result.activeThroughout).toBe(true);
  expect(result.sawConnector).toBe(true);
  expect(result.sawOutgoingLane).toBe(true);
  expect(result.sawCrossingLifecycle).toBe(true);
  expect(result.routeHop).toBeGreaterThanOrEqual(1);
  expect(result.currentLaneId).toBe("traffic-lane-segment:stream-edge:road-edge:h:1754:1574:2340:1574:0:forward");
  expect(result.lastBlockedReason).toBe(null);
  expect(result.slotLost).toBe(false);
  expect(result.teleportCount).toBe(0);
  expect(result.maximumStepDistance).toBeLessThanOrEqual(3.61);
  expect(result.maxObservedStep).toBeLessThanOrEqual(3.61);
  expect(result.finalSlotTokenId).toBe(result.tokenId);
  expect(result.fixedPoolPreserved).toBe(true);
  expect(result.stopped.fixedPoolPreserved).toBe(true);
  expect(pageErrors).toEqual([]);
});