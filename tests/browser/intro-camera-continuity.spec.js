import { expect, test } from "@playwright/test";

test("intro zoom-out never leaves the player to show and then recenter the city", async ({ page }) => {
  test.setTimeout(45_000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.tutorialDirector
  ));

  const closeZoom = await page.evaluate(async () => {
    const game = window.NBD_PHASER_GAME;
    const scene = game.scene.getScene("GameScene");
    const uiScene = game.scene.getScene("UIScene");
    const director = scene.tutorialDirector;

    // Exercise the exact camera methods without making the browser test click
    // through six independently timed dialogue promises.
    director.started = true;
    director.introPromise ||= Promise.resolve();
    if (uiScene.introOpen) uiScene.closeIntro();
    director.busy = true;
    director.state = "intro";
    director.setControlMode("locked");
    director.freezeWorld(true);
    scene.tweens.killTweensOf(scene.cameras.main);
    await director.zoomToPlayer();
    return scene.cameras.main.zoom;
  });
  expect(closeZoom).toBeGreaterThan(3);

  const continuity = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const director = scene.tutorialDirector;
    const camera = scene.cameras.main;
    const samples = [];
    const sample = () => {
      const view = camera.worldView;
      const centerX = view.x + view.width / 2;
      const centerY = view.y + view.height / 2;
      samples.push({
        zoom: camera.zoom,
        centerX,
        centerY,
        offset: Math.hypot(scene.player.x - centerX, scene.player.y - centerY)
      });
    };

    sample();
    const timer = window.setInterval(sample, 40);
    const started = performance.now();
    await director.zoomBackToWorld();
    sample();
    window.clearInterval(timer);

    director.freezeWorld(false);
    director.busy = false;
    director.state = "rooftop-movement";
    director.setControlMode("movement");

    let maxJump = 0;
    for (let index = 1; index < samples.length; index++) {
      maxJump = Math.max(maxJump, Math.hypot(
        samples[index].centerX - samples[index - 1].centerX,
        samples[index].centerY - samples[index - 1].centerY
      ));
    }

    return {
      samples: samples.length,
      duration: performance.now() - started,
      maxOffset: Math.max(...samples.map(item => item.offset)),
      maxJump,
      firstZoom: samples[0]?.zoom || 0,
      finalZoom: samples.at(-1)?.zoom || 0,
      finalState: director.state,
      locked: Boolean(scene.registry.get("taskRevealActive"))
    };
  });

  expect(continuity.samples).toBeGreaterThan(10);
  expect(continuity.duration).toBeGreaterThan(1_500);
  expect(continuity.firstZoom).toBeGreaterThan(3);
  expect(continuity.finalZoom).toBeLessThan(closeZoom * 0.7);
  expect(continuity.maxOffset).toBeLessThan(8);
  expect(continuity.maxJump).toBeLessThan(8);
  expect(continuity.finalState).toBe("rooftop-movement");
  expect(continuity.locked).toBe(false);
  expect(pageErrors).toEqual([]);
});
