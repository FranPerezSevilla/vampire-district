import { expect, test } from "@playwright/test";

async function waitForCity(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.buildingSidewalkClearancePolicy
  ));
}

test.describe.configure({ timeout: 90_000 });

test("the nightclub footprint never covers its streamed sidewalk", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForCity(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const clubFocus = { x: 1990, y: 1375 };
    await window.NBD_CITY_STREAM.forceFocus(clubFocus.x, clubFocus.y);
    scene.cameras.main.centerOn(clubFocus.x, clubFocus.y);
    scene.redrawLayer("Nightclub sidewalk clearance test.");

    const area = { x: 1780, y: 1210, w: 440, h: 340 };
    const club = scene.cityStreamSystem.query("buildings", area, { includePrefetched: true, margin: 24 })
      .find(building => String(building.id || "").trim().toLowerCase() === "club");
    if (!club) return { missing: true };

    const nearby = {
      x: club.x - 12,
      y: club.y - 12,
      w: club.w + 24,
      h: club.h + 24
    };
    const sidewalks = scene.cityStreamSystem.query("sidewalks", nearby, { includePrefetched: true, margin: 12 });
    const boundsFor = surface => {
      const points = Array.isArray(surface?.points) ? surface.points : [];
      if (points.length >= 3) {
        const xs = points.map(point => Number(point.x) || 0);
        const ys = points.map(point => Number(point.y) || 0);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
      }
      return { x: surface.x, y: surface.y, w: surface.w, h: surface.h };
    };
    const overlaps = (a, b, margin = 0) => a.x < b.x + b.w + margin
      && a.x + a.w > b.x - margin
      && a.y < b.y + b.h + margin
      && a.y + a.h > b.y - margin;

    return {
      missing: false,
      club: {
        id: club.id,
        sign: club.sign,
        x: club.x,
        y: club.y,
        w: club.w,
        h: club.h,
        clearancePolicy: club.clearancePolicy || null
      },
      touchingSidewalks: sidewalks.filter(surface => overlaps(club, boundsFor(surface), 3)).map(surface => surface.id),
      policy: scene.buildingSidewalkClearancePolicy.snapshot()
    };
  });

  expect(result.missing).toBe(false);
  expect(result.club).toMatchObject({ id: "club", sign: "CLUB", clearancePolicy: "neon-sidewalk-clearance-v1" });
  expect(result.touchingSidewalks).toEqual([]);
  expect(result.policy.adjustedQueries).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});
