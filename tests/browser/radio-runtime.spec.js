import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 75_000 });

async function waitForRadioRuntime(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_VEHICLES_READY
    && window.NBD_RADIO_READY
    && window.NBD_RADIO?.snapshot
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.radioSystem
  ));
}

async function forceEnterRefugeCompact(page) {
  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.vehicleSystem.exitVehicle({ force: true });
    const vehicle = scene.vehicleSystem.vehicle("refuge_compact");
    vehicle.x = 760;
    vehicle.y = 760;
    vehicle.angle = 0;
    vehicle.travelAngle = 0;
    vehicle.speed = 0;
    vehicle.disabled = false;
    vehicle.container?.setPosition?.(vehicle.x, vehicle.y).setRotation?.(0);
    scene.switchLayer(0, { x: vehicle.x - 18, y: vehicle.y }, "Radio runtime browser test.");
    scene.vehicleSystem.enterVehicle(vehicle.id, { force: true });
  });
  await page.waitForFunction(() => window.NBD_RADIO.snapshot().driving === true);
}

test("in-car radio cycles from the existing wheel, stops on foot and remembers the session station", async ({ page }) => {
  await page.goto("/?testScenario=vehicle-core", { waitUntil: "domcontentloaded" });
  await waitForRadioRuntime(page);
  await forceEnterRefugeCompact(page);

  const initial = await page.evaluate(() => ({
    radio: window.NBD_RADIO.snapshot(),
    hud: window.NBD_PHASER_GAME.scene.getScene("GameScene").vehicleSystem.hud.text
  }));
  expect(initial.radio.selectedStationId).toBe("vice-fm");
  expect(initial.radio.stationLabel).toBe("Vice FM");
  expect(initial.radio.track?.id).toBe("daisuke-teiko-real-deal-90s-hip-hop");
  expect(initial.hud).toContain("RADIO Vice FM");

  const canvas = page.locator("#game-root canvas");
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(() => window.NBD_RADIO.snapshot().selectedStationId !== "vice-fm");

  const afterWheel = await page.evaluate(() => window.NBD_RADIO.snapshot());
  expect(["off", "blood-city-beats"]).toContain(afterWheel.selectedStationId);

  await page.evaluate(() => window.NBD_RADIO.select("night-shift"));
  await page.waitForFunction(() => window.NBD_RADIO.snapshot().selectedStationId === "night-shift");
  const selected = await page.evaluate(() => ({
    radio: window.NBD_RADIO.snapshot(),
    hud: window.NBD_PHASER_GAME.scene.getScene("GameScene").vehicleSystem.hud.text
  }));
  expect(selected.radio.trackCount).toBe(3);
  expect(selected.hud).toContain("RADIO Night Shift");

  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.vehicleSystem.exitVehicle({ force: true });
  });
  await page.waitForFunction(() => window.NBD_RADIO.snapshot().driving === false);
  const onFoot = await page.evaluate(() => window.NBD_RADIO.snapshot());
  expect(onFoot.selectedStationId).toBe("night-shift");
  expect(onFoot.playbackStatus).toBe("idle");

  await forceEnterRefugeCompact(page);
  const reentered = await page.evaluate(() => window.NBD_RADIO.snapshot());
  expect(reentered.selectedStationId).toBe("night-shift");
  expect(reentered.track?.id).toBe("ejah-big-beat-industrial-breakbeat-1");

  await page.evaluate(() => window.NBD_RADIO.select("off"));
  const off = await page.evaluate(() => window.NBD_RADIO.snapshot());
  expect(off.selectedStationId).toBe("off");
  expect(off.track).toBeNull();
  expect(off.trackCount).toBe(0);
});
