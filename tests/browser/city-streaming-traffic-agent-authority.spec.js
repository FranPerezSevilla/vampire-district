import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

test("an impact becomes the same driver's actual pose, with no lateral return to a rail", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.NBD_TRAFFIC_AGENT_AUTHORITY_READY
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT?.snapshot().driverActive);
  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const policy = scene.trafficLocalAssignmentPolicy.multiAgentRoutePolicy;
    const physical = scene.trafficPhysicalConsequencesSystem;
    const materializer = scene.trafficMaterializationSystem;
    const slot = [...materializer.assignments.values()].find(slot => slot.driverActive);
    if (!slot) return { missing: true };
    const before = policy.runtime().agents().find(agent => agent.tokenId === slot.tokenId);
    const state = physical.stateFor(slot);
    state.offsetX = -Math.sin(slot.angle) * 8;
    state.offsetY = Math.cos(slot.angle) * 8;
    state.holdSeconds = 0.4;
    state.lastReason = "traffic-collision";
    physical.applyStateOffset(slot, state);
    const impact = { x: slot.x, y: slot.y, angle: slot.angle };
    // Even with its timer expired, physics must not ease sideways toward an old base.
    state.holdSeconds = 0;
    physical.update(0.05, { force: true });
    const afterPhysics = { x: slot.x, y: slot.y };
    state.holdSeconds = 0.4;
    policy.update(0.05);
    materializer.update(0.05);
    const adopted = policy.runtime().agents().find(agent => agent.tokenId === slot.tokenId);
    return { missing: false, impact, afterPhysics, adopted, before,
      sameSlot: materializer.assignments.get(slot.tokenId) === slot,
      offset: Math.hypot(slot.physicalOffsetX, slot.physicalOffsetY),
      architecture: window.NBD_TRAFFIC_AGENT_AUTHORITY.snapshot().architecture };
  });
  expect(result.missing).toBe(false);
  expect(result.afterPhysics.x).toBeCloseTo(result.impact.x, 6);
  expect(result.afterPhysics.y).toBeCloseTo(result.impact.y, 6);
  expect(result.adopted.pose.x).toBeCloseTo(result.impact.x, 6);
  expect(result.adopted.pose.y).toBeCloseTo(result.impact.y, 6);
  expect(result.adopted.pose.angle).toBeCloseTo(result.impact.angle, 6);
  expect(result.adopted.adoptedImpacts).toBe(result.before.adoptedImpacts + 1);
  expect(result.adopted.destinationLaneId).toBe(result.before.destinationLaneId);
  expect(result.offset).toBe(0);
  expect(result.sameSlot).toBe(true);
  expect(result.architecture).toBe("destination-vehicle-driver");
  expect(errors).toEqual([]);
});
