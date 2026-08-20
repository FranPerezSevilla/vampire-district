import { expect, test } from "@playwright/test";

const STORAGE_KEY = "viceblood-campaign-v1";

test.describe.configure({ timeout: 90_000 });

async function waitForLedger(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_HUNTING_LAW_READY
    && window.NBD_TERRITORY_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.campaignSystem
    && window.NBD_PHASER_GAME?.scene?.getScene?.("UIScene")?.dom?.ledgerButton
  ));
}

test("Night Ledger model stays connected while the playtest surface remains hidden", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await waitForLedger(page);

  const seeded = await page.evaluate(storageKey => {
    const game = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
    ui.closeIntro();
    game.campaignSystem.reputation.setFaction("first_estate", 42, {
      source: "night-ledger-browser",
      reason: "seed relation"
    });
    const assessment = game.campaignSystem.huntingLaw.assessFeed({
      districtId: "civic-center",
      victim: { id: "ledger-test-victim", type: "civilian" },
      witnessCount: 0,
      bodyEvidence: true,
      biteEvidence: true,
      wantedLevel: 0,
      source: "night-ledger-browser"
    });
    game.heatSystem.clear("Night Ledger baseline.");
    game.exposureSystem.clear("Night Ledger baseline.");
    game.heatSystem.forceLevel(2, "A witness reports a stolen vehicle.");
    game.exposureSystem.registerEvidence({
      kind: "visible_power_use",
      x: game.player.x,
      y: game.player.y,
      layer: game.currentLayer,
      sourceEvent: "night-ledger-browser",
      subjectId: "player",
      exposureWeight: 50,
      knowledgeState: "institutional",
      reason: "Police possess a clear account of visible power use."
    });
    game.publishState();
    ui.ledgerRefreshAt = 0;
    return {
      assessmentId: assessment.id,
      storedVersion: JSON.parse(localStorage.getItem(storageKey)).version
    };
  }, STORAGE_KEY);

  expect(seeded.storedVersion).toBe(5);
  await expect(page.locator("#hud-ledger-button")).toHaveClass(/danger/);
  await expect(page.locator("#hud-ledger-badge")).toHaveText("3");

  const initial = await page.evaluate(() => {
    const game = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
    const model = ui.readNightLedgerState(true);
    const firstEstate = model.factions.find(faction => faction.id === "first_estate") || null;
    return {
      surface: {
        buttonHidden: Boolean(ui.dom?.ledgerButton?.hidden),
        buttonAriaHidden: ui.dom?.ledgerButton?.getAttribute?.("aria-hidden"),
        buttonDisplay: ui.dom?.ledgerButton?.style?.display || "",
        openResult: ui.toggleNightLedger(),
        ledgerOpen: Boolean(ui.ledgerOpen),
        gamePaused: game.sys.isPaused(),
        registryPaused: Boolean(ui.registry.get("uiPaused"))
      },
      model: {
        ready: model.ready,
        severity: model.severity,
        alertCount: model.alertCount,
        latentViolationCount: model.latentViolationCount,
        knownViolationCount: model.knownViolationCount,
        policeState: model.police.stateLabel,
        exposureKnownCount: model.exposure.knownCount,
        firstEstate,
        incidents: model.incidents.map(incident => ({
          kind: incident.kind,
          title: incident.title,
          detail: incident.detail,
          status: incident.status
        }))
      }
    };
  });

  expect(initial.surface).toEqual({
    buttonHidden: true,
    buttonAriaHidden: "true",
    buttonDisplay: "none",
    openResult: false,
    ledgerOpen: false,
    gamePaused: false,
    registryPaused: false
  });
  expect(initial.model.ready).toBe(true);
  expect(initial.model.severity).toBe("danger");
  expect(initial.model.alertCount).toBe(3);
  expect(initial.model.latentViolationCount).toBe(1);
  expect(initial.model.knownViolationCount).toBe(0);
  expect(initial.model.policeState).toBe("PURSUIT");
  expect(initial.model.exposureKnownCount).toBe(1);
  expect(initial.model.firstEstate).toMatchObject({
    id: "first_estate",
    reputation: { value: 42, tierLabel: "Favoured" },
    latentViolationCount: 1,
    knownViolationCount: 0
  });
  expect(initial.model.incidents.some(incident => incident.title === "VISIBLE POWER USE" && incident.status === "INSTITUTIONAL")).toBe(true);
  expect(initial.model.incidents.some(incident => incident.title === "POACHING" && incident.status === "HIDDEN")).toBe(true);

  await page.keyboard.press("l");
  const keyboardState = await page.evaluate(() => {
    const game = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
    return {
      ledgerOpen: Boolean(ui.ledgerOpen),
      gamePaused: game.sys.isPaused(),
      registryPaused: Boolean(ui.registry.get("uiPaused"))
    };
  });
  expect(keyboardState).toEqual({ ledgerOpen: false, gamePaused: false, registryPaused: false });

  await page.evaluate(assessmentId => {
    const game = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
    game.campaignSystem.huntingLaw.discover(assessmentId, {
      source: "recovered_body",
      witnessId: "ledger-test-witness",
      referenceId: "ledger-test-victim"
    });
    game.heatSystem.clear("Police pressure cools after the search.");
    game.exposureSystem.clear("The visible-power account is discredited.");
    game.publishState();
    ui.ledgerRefreshAt = 0;
  }, seeded.assessmentId);

  const discovered = await page.evaluate(() => {
    const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
    const model = ui.readNightLedgerState(true);
    const firstEstate = model.factions.find(faction => faction.id === "first_estate") || null;
    return {
      ledgerOpen: Boolean(ui.ledgerOpen),
      knownViolationCount: model.knownViolationCount,
      latentViolationCount: model.latentViolationCount,
      policeState: model.police.stateLabel,
      firstEstate,
      incidents: model.incidents.map(incident => ({ title: incident.title, status: incident.status }))
    };
  });
  expect(discovered.ledgerOpen).toBe(false);
  expect(discovered.knownViolationCount).toBe(1);
  expect(discovered.latentViolationCount).toBe(0);
  expect(discovered.policeState).toBe("CLEAR");
  expect(discovered.firstEstate).toMatchObject({ knownViolationCount: 1, latentViolationCount: 0 });
  expect(discovered.incidents.some(incident => incident.title === "POACHING" && incident.status === "DISCOVERED")).toBe(true);
  expect(pageErrors).toEqual([]);
});
