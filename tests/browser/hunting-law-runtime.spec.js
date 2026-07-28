import { expect, test } from "@playwright/test";

const STORAGE_KEY = "viceblood-campaign-v1";

test.describe.configure({ timeout: 90_000 });

async function waitForHuntingLaw(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_HUNTING_LAW_READY
    && window.NBD_TERRITORY_READY
    && window.NBD_CAMPAIGN_SYSTEM
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.feedingSystem
  ));
}

test("a real drain is assessed as poaching and a recovered body discovers the violation", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await waitForHuntingLaw(page);

  const result = await page.evaluate(storageKey => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.registry.set("uiPaused", false);
    const victim = scene.npcSystem.npcs.find(npc => npc.id === "civ_cross_1");
    const watcher = scene.npcSystem.npcs.find(npc => npc.id === "civ_east_1");
    if (!victim || !watcher) throw new Error("Hunting-law browser fixtures are unavailable.");

    for (const npc of scene.npcSystem.npcs) {
      if (npc !== victim) npc.inactive = true;
    }
    victim.inactive = false;
    victim.dead = false;
    victim.hiddenBody = false;
    victim.dragged = false;
    victim.corpseDiscovered = false;
    victim.layer = 0;
    victim.x = 1500;
    victim.y = 500;
    victim.container.setPosition(victim.x, victim.y).setVisible(true);
    scene.player.setPosition(1492, 500);
    scene.currentLayer = 0;
    scene.npcSystem.rebuildSpatialIndex();

    const started = scene.feedingSystem.startDrain(victim, {
      source: "browser-hunting-law",
      eligibility: "right-click"
    });
    scene.feedingSystem.completeDrain();

    const latent = window.NBD_HUNTING_LAW.lastAssessment();
    const completionText = scene.lastActionText;
    const assessmentIdOnBody = victim.huntingAssessmentId;
    const storedAfterFeed = JSON.parse(localStorage.getItem(storageKey));

    watcher.inactive = false;
    watcher.dead = false;
    watcher.intercepted = false;
    watcher.stunnedTimer = 0;
    watcher.layer = 0;
    watcher.x = victim.x + 12;
    watcher.y = victim.y + 8;
    watcher.container.setPosition(watcher.x, watcher.y).setVisible(true);
    scene.npcSystem.rebuildSpatialIndex();
    scene.evidenceSystem.updateCorpseDiscovery();

    const known = window.NBD_HUNTING_LAW.lastAssessment();
    const storedAfterDiscovery = JSON.parse(localStorage.getItem(storageKey));
    const discoveryEvents = scene.campaignSystem.state.eventLog
      .filter(event => event.type === "hunting:violation-discovered");

    const crownAssessment = window.NBD_HUNTING_LAW.assessFeed({
      districtId: "blackwater",
      victim: { id: "synthetic-crown-prey", type: "civilian" },
      witnessCount: 0,
      bodyEvidence: true,
      biteEvidence: true,
      wantedLevel: 0,
      source: "browser-policy-check"
    });

    return {
      started,
      latent,
      completionText,
      assessmentIdOnBody,
      storedAfterFeed: storedAfterFeed.huntingLaw,
      known,
      corpseDiscovered: victim.corpseDiscovered,
      storedAfterDiscovery: storedAfterDiscovery.huntingLaw,
      discoveryEvents,
      crownAssessment,
      apiSnapshot: window.NBD_HUNTING_LAW.snapshot()
    };
  }, STORAGE_KEY);

  expect(result.started).toBe(true);
  expect(result.latent).toMatchObject({
    districtId: "civic-center",
    ownerId: "first_estate",
    classification: "poaching",
    politicalViolation: true,
    currentDiscoveryState: "latent",
    witnessCount: 0,
    bodyEvidence: true,
    biteEvidence: true
  });
  expect(result.completionText).toContain("POACHING · THE FIRST ESTATE TERRITORY");
  expect(result.assessmentIdOnBody).toBe(result.latent.id);
  expect(result.storedAfterFeed.assessments.at(-1)).toMatchObject({
    id: result.latent.id,
    classification: "poaching",
    discoveryState: "latent"
  });

  expect(result.corpseDiscovered).toBe(true);
  expect(result.known).toMatchObject({
    id: result.latent.id,
    currentDiscoveryState: "known"
  });
  expect(result.known.discovery).toMatchObject({
    assessmentId: result.latent.id,
    witnessId: "civ_east_1",
    referenceId: "civ_cross_1"
  });
  expect(result.known.discovery.sources).toContain("recovered_body");
  expect(result.storedAfterDiscovery.discoveries[result.latent.id]).toMatchObject({
    assessmentId: result.latent.id,
    witnessId: "civ_east_1"
  });
  expect(result.discoveryEvents).toHaveLength(1);
  expect(result.discoveryEvents[0].payload).toMatchObject({
    assessmentId: result.latent.id,
    classification: "poaching",
    ownerId: "first_estate"
  });

  expect(result.crownAssessment).toMatchObject({
    districtId: "blackwater",
    ownerId: "gutter_crown",
    classification: "tolerated",
    politicalViolation: false
  });
  expect(result.apiSnapshot.counters.total).toBeGreaterThanOrEqual(2);
  expect(pageErrors).toEqual([]);
});
