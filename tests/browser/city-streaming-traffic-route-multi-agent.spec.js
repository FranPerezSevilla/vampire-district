import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

test("normal boot uses destination drivers, a fixed pool and output-only macro accounting", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.NBD_TRAFFIC_ROUTE_MULTI_AGENT?.snapshot().driverActive
    && window.NBD_TRAFFIC_PHYSICS_READY && window.NBD_CITY_STREAM_READY);
  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const materializer = scene.trafficMaterializationSystem;
    const policy = scene.trafficLocalAssignmentPolicy.multiAgentRoutePolicy;
    const runtime = policy.runtime();
    const pool = [...materializer.pool];
    const initial = policy.snapshot();
    const ids = runtime.agents().map(agent => agent.tokenId).sort().join("|");
    const flows = JSON.stringify([...materializer.macro.trafficFlows]);
    let previous = new Map(runtime.agents().map(agent => [agent.tokenId, agent]));
    let previousClock = initial.clockSeconds;
    let discontinuities = 0, duplicateLanes = 0, identityChanges = 0, sawTurn = false;
    for (let index = 0; index < 180; index++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const snapshot = policy.snapshot();
      const elapsed = snapshot.clockSeconds - previousClock;
      const agents = runtime.agents();
      if (agents.map(agent => agent.tokenId).sort().join("|") !== ids) identityChanges++;
      for (const agent of agents) {
        const old = previous.get(agent.tokenId);
        if (new Set(agent.journeyLaneIds).size !== agent.journeyLaneIds.length - (agent.circularRoute ? 1 : 0)) duplicateLanes++;
        if (old && Math.hypot(agent.pose.x - old.pose.x, agent.pose.y - old.pose.y) > 160 * elapsed + 1) discontinuities++;
        if (agent.stage === "connector") sawTurn = true;
      }
      previous = new Map(agents.map(agent => [agent.tokenId, agent]));
      previousClock = snapshot.clockSeconds;
    }
    const selected = [...materializer.assignments.values()].find(slot => slot.driverActive);
    const position = selected && { x: selected.x, y: selected.y, angle: selected.angle };
    if (selected) {
      scene.trafficLocalBehaviorSystem.applyDecision(selected, {}, {}, {}, 0.05);
      scene.trafficSteeringPresentationSystem.applyPresentation(selected, {}, 0.05);
    }
    const final = policy.snapshot();
    const traffic = materializer.snapshot();
    const macro = scene.macroTrafficPoliceSystem.snapshot();
    const guarded = selected && selected.x === position.x && selected.y === position.y && selected.angle === position.angle;
    const poolPreserved = pool.every((slot, index) => slot === materializer.pool[index]);
    const flowsFrozen = flows === JSON.stringify([...materializer.macro.trafficFlows]);
    policy.stop();
    return { initial, final, traffic, macro, discontinuities, duplicateLanes, identityChanges, sawTurn,
      guarded, poolPreserved, flowsFrozen, stopped: policy.snapshot(),
      metadataCleared: materializer.pool.every(slot => !slot.routeActive && !slot.driverActive) };
  });
  expect(result.initial.defaultEnabled).toBe(true);
  expect(result.initial.movementAuthority).toBe("shared-vehicle-kinematics");
  expect(result.initial.speedAuthority).toBe("throttle-brake-reverse");
  expect(result.final.populationConserved).toBe(true);
  expect(result.final.unseededAgentCount).toBe(0);
  expect(result.final.projectionValid).toBe(true);
  expect(result.final.districtPopulationConserved).toBe(true);
  expect(result.final.macroAccountingInstalled).toBe(true);
  expect(result.final.macroCoordinateAuthority).toBe(false);
  expect(result.final.ticks).toBeGreaterThan(result.initial.ticks);
  expect(result.traffic.poolSize).toBe(32);
  expect(result.poolPreserved).toBe(true);
  expect(result.identityChanges).toBe(0);
  expect(result.duplicateLanes).toBe(0);
  expect(result.discontinuities).toBe(0);
  expect(result.traffic.routePoseContinuityCorrections).toBe(0);
  expect(result.sawTurn).toBe(true);
  expect(result.guarded).toBe(true);
  expect(result.flowsFrozen).toBe(true);
  expect(result.macro.legacyCivilianPhaseAdvancementActive).toBe(false);
  expect(result.stopped.enabled).toBe(false);
  expect(result.metadataCleared).toBe(true);
  expect(errors).toEqual([]);
});
