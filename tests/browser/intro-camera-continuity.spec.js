import { expect, test } from "@playwright/test";

async function dispatchDialogueAdvance(page) {
  await page.waitForTimeout(320);
  await page.evaluate(() => {
    const target = document.querySelector("#game-root canvas") || document.querySelector(".game-frame");
    if (!target) throw new Error("Playable game surface is unavailable");
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: rect.left + Math.min(112, Math.max(1, rect.width / 2)),
      clientY: rect.top + Math.min(112, Math.max(1, rect.height / 2))
    }));
  });
}

async function advanceToNextBubble(page) {
  const text = page.locator(".tutorial-dialogue__text");
  const previous = await text.textContent();
  await dispatchDialogueAdvance(page);
  await page.waitForFunction(previousText => {
    const dialogue = document.getElementById("tutorial-dialogue");
    const current = document.querySelector(".tutorial-dialogue__text")?.textContent || "";
    return Boolean(dialogue?.classList.contains("open") && current && current !== previousText);
  }, previous || "", { timeout: 8_000 });
}

test("intro zoom-out never leaves the player to show and then recenter the city", async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.tutorialDirector
  ));

  await page.locator("#ui-modal-action").click();
  await expect(page.locator("#tutorial-dialogue")).toHaveClass(/open/, { timeout: 10_000 });

  for (let index = 0; index < 5; index++) await advanceToNextBubble(page);
  await expect(page.locator(".tutorial-dialogue__text")).toContainText("silence the journalist");

  const closeZoom = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    window.__NBD_CAMERA_MONITOR = new Promise(resolve => {
      const samples = [];
      const started = performance.now();
      const sample = () => {
        const camera = scene.cameras.main;
        const view = camera.worldView;
        const centerX = view.x + view.width / 2;
        const centerY = view.y + view.height / 2;
        samples.push({
          zoom: camera.zoom,
          centerX,
          centerY,
          offset: Math.hypot(scene.player.x - centerX, scene.player.y - centerY)
        });
        const complete = scene.tutorialDirector?.state === "rooftop-movement"
          && !scene.registry.get("taskRevealActive");
        if (complete) {
          let maxJump = 0;
          for (let index = 1; index < samples.length; index++) {
            maxJump = Math.max(maxJump, Math.hypot(
              samples[index].centerX - samples[index - 1].centerX,
              samples[index].centerY - samples[index - 1].centerY
            ));
          }
          resolve({
            samples: samples.length,
            maxOffset: Math.max(...samples.map(item => item.offset)),
            maxJump,
            firstZoom: samples[0]?.zoom || 0,
            finalZoom: samples.at(-1)?.zoom || 0,
            duration: performance.now() - started
          });
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return scene.cameras.main.zoom;
  });

  await dispatchDialogueAdvance(page);
  const continuity = await page.evaluate(() => window.__NBD_CAMERA_MONITOR);

  expect(continuity.samples).toBeGreaterThan(10);
  expect(continuity.duration).toBeGreaterThan(1_500);
  expect(continuity.firstZoom).toBeGreaterThan(3);
  expect(continuity.finalZoom).toBeLessThan(closeZoom * 0.7);
  expect(continuity.maxOffset).toBeLessThan(3);
  expect(continuity.maxJump).toBeLessThan(3);
  expect(pageErrors).toEqual([]);
});
