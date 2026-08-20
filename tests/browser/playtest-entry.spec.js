import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

function normalizedText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

test("playtest mode presents one stable intro from the first visible frame", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.addInitScript(() => {
    window.__NBD_GENERIC_INTRO_OPENED = false;
    const observeGenericIntro = () => {
      const modal = document.getElementById("ui-modal");
      if (!modal) return;
      const record = () => {
        if (modal.classList.contains("open")) window.__NBD_GENERIC_INTRO_OPENED = true;
      };
      record();
      new MutationObserver(record).observe(modal, {
        attributes: true,
        attributeFilter: ["class"]
      });
    };
    document.addEventListener("DOMContentLoaded", observeGenericIntro, { once: true });
  });

  await page.goto("/?mode=playtest&rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    document.getElementById("playtest-boot-cover")
    || document.getElementById("playtest-intro")
  ));

  const firstSurface = await page.evaluate(() => {
    const node = document.getElementById("playtest-boot-cover")
      || document.getElementById("playtest-intro");
    return {
      id: node?.id || null,
      title: node?.querySelector("h2")?.innerText || "",
      visible: Boolean(node && getComputedStyle(node).display !== "none")
    };
  });
  expect(["playtest-boot-cover", "playtest-intro"]).toContain(firstSurface.id);
  expect(normalizedText(firstSurface.title)).toBe("Immortality was never the luxury you imagined.");
  expect(firstSurface.visible).toBe(true);

  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_PLAYTEST_READY));
  await expect(page.locator("#playtest-boot-cover")).toHaveCount(0);
  await expect(page.locator("#playtest-intro")).toHaveClass(/open/);
  const readyTitle = await page.locator("#playtest-intro-title").evaluate(node => node.innerText);
  expect(normalizedText(readyTitle)).toBe("Immortality was never the luxury you imagined.");
  await expect(page.locator("#ui-modal")).not.toHaveClass(/open/);

  const readyState = await page.evaluate(() => {
    const game = window.NBD_PHASER_GAME;
    const scene = game.scene.getScene("GameScene");
    const uiScene = game.scene.getScene("UIScene");
    return {
      genericIntroOpened: Boolean(window.__NBD_GENERIC_INTRO_OPENED),
      genericIntroActive: Boolean(uiScene.introOpen),
      playtestOpen: document.getElementById("playtest-intro")?.classList.contains("open") || false,
      cameraZoom: scene.cameras.main.zoom,
      gamePaused: game.scene.isPaused("GameScene")
    };
  });
  expect(readyState.genericIntroOpened).toBe(false);
  expect(readyState.genericIntroActive).toBe(false);
  expect(readyState.playtestOpen).toBe(true);
  expect(readyState.cameraZoom).toBeGreaterThan(0);
  expect(readyState.gamePaused).toBe(true);

  const firstZoom = readyState.cameraZoom;
  await page.waitForTimeout(150);
  const secondZoom = await page.evaluate(() => (
    window.NBD_PHASER_GAME.scene.getScene("GameScene").cameras.main.zoom
  ));
  expect(Math.abs(secondZoom - firstZoom)).toBeLessThan(0.0001);
  expect(pageErrors).toEqual([]);
});
