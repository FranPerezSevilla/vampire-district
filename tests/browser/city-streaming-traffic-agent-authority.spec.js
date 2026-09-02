import { expect, test } from "@playwright/test";

async function waitForTrafficAgentAuthority(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC_PHYSICS_READY
    && window.NBD_TRAFFIC_AGENT_AUTHORITY_READY
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT
    && window.NBD_TRAFFIC_AGENT_AUTHORITY
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT.snapshot().enabled
  ));
}

test.describe.configure({ timeout: 90_000 });

test("a materialized car cannot advance or rotate while a residual physical offset is recovering", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTrafficAgentAuthority(page);

  const result = await page.evaluate(async () => {
    function sameRoutePose(left, right) {
      return left?.stage === right?.stage
        && left?.currentLaneId === right?.currentLaneId
        && left?.connectorId === right?.connectorId
        && left?.nextLaneId === right?.nextLaneId
        && left?.routeHop === right?.routeHop
        && Math.abs(Number(left?.stageProgress || 0) - Number(right?.stageProgress || 0)) <= 0.000001;
    }

    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 1140, y: 960 }, "Traffic agent physical authority regression.");
    await window.NBD_CITY_STREAM.forceFocus(1140, 960);
    window.NBD_TRAFFIC.resync();

    const materializer = scene.trafficMaterializationSystem;
    const routePolicy = scene.trafficLocalAssignmentPolicy.multiAgentRoutePolicy;
    const physical = scene.trafficPhysicalConsequencesSystem;
    const authority = window.NBD_TRAFFIC_AGENT_AUTHORITY;
    const runtime = routePolicy.runtime();
    const runtimeAgents = runtime.agents();
    const selected = [...materializer.assignments.values()]
      .find(slot => slot.routeActive && runtimeAgents.some(agent => agent.tokenId === slot.tokenId));
    if (!selected) return { missing: true };

    const beforeAgent = runtimeAgents.find(agent => agent.tokenId === selected.tokenId);
    const beforeAngle = selected.angle;
    const physicalState = physical.stateFor(selected);
    physicalState.baseX = Number(selected.routeBaseX ?? selected.x);
    physicalState.baseY = Number(selected.routeBaseY ?? selected.y);
    physicalState.offsetX = 10;
    physicalState.offsetY = 0;
    physicalState.holdSeconds = 0;
    physicalState.lastReason = "traffic-collision";
    physical.applyStateOffset(selected, physicalState);

    routePolicy.update(0.05);
    materializer.update(0.05);
    physical.update(0, { force: true });

    const lockedAgent = routePolicy.runtime().agents()
      .find(agent => agent.tokenId === selected.tokenId);
    const lockedAuthority = authority.snapshot();
    const lockedVehicle = lockedAuthority.vehicles
      .find(vehicle => vehicle.tokenId === selected.tokenId);
    const lockedAngle = selected.angle;
    const lockedOffset = Math.hypot(
      Number(selected.physicalOffsetX || 0),
      Number(selected.physicalOffsetY || 0)
    );

    physicalState.offsetX = 0;
    physicalState.offsetY = 0;
    physicalState.holdSeconds = 0;
    physicalState.lastReason = "recovered";
    selected.physicalOffsetX = 0;
    selected.physicalOffsetY = 0;
    selected.physicalHoldSeconds = 0;
    physical.applyStateOffset(selected, physicalState);

    routePolicy.update(0.05);
    materializer.update(0.05);
    physical.update(0, { force: true });

    const resumedAgent = routePolicy.runtime().agents()
      .find(agent => agent.tokenId === selected.tokenId);

    return {
      missing: false,
      tokenId: selected.tokenId,
      beforeAgent,
      lockedAgent,
      resumedAgent,
      routeStayedFixed: sameRoutePose(beforeAgent, lockedAgent),
      routeResumed: !sameRoutePose(lockedAgent, resumedAgent),
      beforeAngle,
      lockedAngle,
      lockedOffset,
      lockedVehicle,
      lockedAuthority,
      slotAuthorityLocked: Boolean(selected.agentMotionAuthorityLocked)
    };
  });

  expect(result.missing).toBe(false);
  expect(result.routeStayedFixed).toBe(true);
  expect(result.lockedOffset).toBeGreaterThan(0.35);
  expect(Math.abs(result.lockedAngle - result.beforeAngle)).toBeLessThanOrEqual(0.000001);
  expect(result.lockedVehicle.locked).toBe(true);
  expect(result.lockedVehicle.reason).toBe("physical-offset-recovery");
  expect(result.lockedAuthority.architecture).toBe("per-agent-physical-pose-authority");
  expect(result.lockedAuthority.junctionAuthority).toBe("permission-only");
  expect(result.lockedAuthority.lockedVehicles).toBeGreaterThan(0);
  expect(result.routeResumed).toBe(true);
  expect(pageErrors).toEqual([]);
});
