import { expect, test } from "@playwright/test";

const STORAGE_KEY = "viceblood-campaign-v1";

test.describe.configure({ timeout: 90_000 });

async function waitForAttentionSystems(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_CAMPAIGN_SYSTEM
    && window.NBD_HEAT
    && window.NBD_EXPOSURE
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.heatSystem
    && window.NBD_PHASER_GAME?.scene?.getScene?.("UIScene")?.dom?.ledgerButton
  ));
}

test("Heat and evidence-backed Exposure diverge, persist and remain explainable in the Night Ledger", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await waitForAttentionSystems(page);

  const seeded = await page.evaluate(storageKey => {
    const game = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
    ui.closeIntro();
    game.registry.set("uiPaused", false);
    game.heatSystem.clear("Attention regression baseline.");
    game.exposureSystem.clear("Attention regression baseline.");

    const attentionSnapshot = () => ({
      heat: {
        ...window.NBD_HEAT.snapshot(),
        level: window.NBD_HEAT.level(),
        value: Math.max(0, ...Object.values(window.NBD_HEAT.snapshot().districts || {})
          .map(district => Number(district?.value) || 0))
      },
      exposure: {
        ...window.NBD_EXPOSURE.snapshot(),
        level: window.NBD_EXPOSURE.level(),
        value: window.NBD_EXPOSURE.value()
      }
    });

    const highHeatOnly = (() => {
      game.heatSystem.forceLevel(2, "Witnesses identify an ordinary vehicle theft.", {
        source: "browser-attention-test"
      });
      return attentionSnapshot();
    })();

    game.heatSystem.clear("Police lose the ordinary-crime trail.");
    const clue = game.exposureSystem.registerEvidence({
      kind: "drained_body",
      x: game.player.x,
      y: game.player.y,
      layer: game.currentLayer,
      sourceEvent: "browser-attention-test",
      subjectId: "attention-test-body",
      exposureWeight: 48,
      knowledgeState: "latent",
      reason: "An abnormal drained body remains hidden in the city."
    });
    const latentClue = attentionSnapshot();

    game.exposureSystem.discoverEvidence(clue.id, {
      knowledgeState: "institutional",
      reason: "Forensics recognises impossible exsanguination.",
      source: "browser-attention-test"
    });
    game.publishState();
    ui.ledgerRefreshAt = 0;
    game.campaignSystem.save();

    return {
      clueId: clue.id,
      highHeatOnly,
      latentClue,
      knownClue: attentionSnapshot(),
      stored: JSON.parse(localStorage.getItem(storageKey))
    };
  }, STORAGE_KEY);

  expect(seeded.highHeatOnly.heat.level).toBe(2);
  expect(seeded.highHeatOnly.heat.value).toBeGreaterThanOrEqual(45);
  expect(seeded.highHeatOnly.exposure.value).toBe(0);

  expect(seeded.latentClue.heat.level).toBe(0);
  expect(seeded.latentClue.exposure.value).toBe(0);
  expect(seeded.latentClue.exposure.records[seeded.clueId]).toMatchObject({
    kind: "drained_body",
    knowledgeState: "latent",
    exposureWeight: 48
  });

  expect(seeded.knownClue.heat.level).toBe(0);
  expect(seeded.knownClue.exposure.value).toBe(48);
  expect(seeded.knownClue.exposure.records[seeded.clueId].knowledgeState).toBe("institutional");
  expect(seeded.stored.version).toBe(5);
  expect(seeded.stored.exposure.records[seeded.clueId].knowledgeState).toBe("institutional");

  await page.locator("#hud-ledger-button").click();
  await expect(page.locator("#night-ledger-content")).toContainText("POLICE / HEAT");
  await expect(page.locator("#night-ledger-content")).toContainText("VEIL / EVIDENCE");
  await expect(page.locator('[data-ledger-police-state="CLEAR"]')).toBeVisible();
  const knownEvidence = page.locator('[data-ledger-evidence="drained_body"]');
  await expect(knownEvidence).toContainText("Drained Body");
  await expect(knownEvidence).toContainText("INSTITUTIONAL");
  await page.keyboard.press("Escape");

  const reframed = await page.evaluate(clueId => {
    const game = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
    game.exposureSystem.resolveEvidence(clueId, {
      reason: "The scene is reframed as an ordinary gang assault.",
      source: "crime_as_alibi",
      mundaneHeat: 52,
      x: game.player.x,
      y: game.player.y
    });
    game.publishState();
    ui.ledgerRefreshAt = 0;
    game.campaignSystem.save();
    const heat = window.NBD_HEAT.snapshot();
    const exposure = window.NBD_EXPOSURE.snapshot();
    return {
      heat: {
        ...heat,
        level: window.NBD_HEAT.level(),
        value: Math.max(0, ...Object.values(heat.districts || {})
          .map(district => Number(district?.value) || 0))
      },
      exposure: {
        ...exposure,
        level: window.NBD_EXPOSURE.level(),
        value: window.NBD_EXPOSURE.value()
      },
      stored: JSON.parse(localStorage.getItem("viceblood-campaign-v1"))
    };
  }, seeded.clueId);

  expect(reframed.exposure.value).toBe(0);
  expect(reframed.exposure.records[seeded.clueId]).toMatchObject({
    knowledgeState: "resolved"
  });
  expect(reframed.heat.level).toBe(2);
  expect(reframed.heat.value).toBeGreaterThanOrEqual(45);
  expect(Math.max(0, ...Object.values(reframed.stored.heat.districts || {})
    .map(district => Number(district?.value) || 0))).toBeGreaterThanOrEqual(45);
  expect(reframed.stored.exposure.records[seeded.clueId].knowledgeState).toBe("resolved");

  await page.locator("#hud-ledger-button").click();
  await expect(page.locator('[data-ledger-police-state="PURSUIT"]')).toBeVisible();
  await expect(page.locator("#night-ledger-content")).toContainText("No active supernatural evidence");
  await expect(page.locator("#night-ledger-content")).toContainText("ordinary gang assault");
  await page.keyboard.press("Escape");

  expect(pageErrors).toEqual([]);
});
