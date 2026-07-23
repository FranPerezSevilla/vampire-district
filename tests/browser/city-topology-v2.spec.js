import { expect, test } from "@playwright/test";

async function waitForTopology(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_CITY_STREAM
  ));
  await page.evaluate(() => window.NBD_CITY_STREAM.waitUntilReady());
}

test.describe.configure({ timeout: 90_000 });

test("the five-times-area site-first city streams from the hospital to the far harbor", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTopology(page);

  const result = await page.evaluate(async () => {
    const district = await import("/phaser/src/data/district.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const hospital = district.buildings.find(item => item.id === "hospital");
    const site = district.landmarkSites.find(item => item.landmarkId === "hospital");

    scene.switchLayer(0, district.CITY_ANCHORS.hospitalEntrance, "Topology V2 hospital.");
    const hospitalStream = await window.NBD_CITY_STREAM.forceFocus(
      district.CITY_ANCHORS.hospitalEntrance.x,
      district.CITY_ANCHORS.hospitalEntrance.y
    );
    const hospitalInspect = window.NBD_CITY_STREAM.inspectBounds(site);
    const hospitalCenterStandable = scene.canStandAt(
      hospital.x + hospital.w / 2,
      hospital.y + hospital.h / 2
    );

    scene.switchLayer(0, { x: 4700, y: 3500 }, "Topology V2 far harbor.");
    const harborStream = await window.NBD_CITY_STREAM.forceFocus(4700, 3500, 900, 500);
    const harborInspect = window.NBD_CITY_STREAM.inspectBounds({ x: 4320, y: 2880, w: 480, h: 720 });

    return {
      world: {
        width: scene.physics.world.bounds.width,
        height: scene.physics.world.bounds.height
      },
      topologyVersion: district.CITY_TOPOLOGY_VERSION,
      topologyStats: district.CITY_TOPOLOGY_STATS,
      hospital,
      site,
      hospitalStream,
      harborStream,
      hospitalInspect,
      harborInspect,
      hospitalCenterStandable,
      roadCorridors: district.roadCorridors.map(item => ({
        id: item.id,
        pointCount: item.points.length,
        curveHint: item.curveHint
      }))
    };
  });

  expect(result.world).toEqual({ width: 4800, height: 3600 });
  expect(result.topologyVersion).toBe(2);
  expect(result.topologyStats.areaMultiplier).toBe(5);
  expect(result.hospital).toMatchObject({ id: "hospital", w: 400, h: 280 });
  expect(result.site).toMatchObject({ id: "hospital-site", landmarkId: "hospital" });
  expect(result.hospitalCenterStandable).toBe(false);
  expect(result.hospitalStream.grid).toEqual({ columns: 10, rows: 8, total: 80 });
  expect(result.hospitalInspect.buildings).toBeGreaterThanOrEqual(2);
  expect(result.harborStream.centerChunkId).toBe("9:6");
  expect(result.harborStream.ready).toBe(true);
  expect(result.harborInspect.roads).toBeGreaterThan(0);
  expect(result.roadCorridors.some(item => item.pointCount >= 4 && /rounded|spline/.test(item.curveHint))).toBe(true);
  expect(pageErrors).toEqual([]);
});
