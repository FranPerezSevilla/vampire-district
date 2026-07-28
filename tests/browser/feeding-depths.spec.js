import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

async function waitForFeedingRuntime(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_HUNTING_LAW_READY
    && window.NBD_CAMPAIGN_SYSTEM
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.feedingSystem
  ));
}

test("held feeding resolves Quick Bite, Full Feed and Drain without farming Hunger", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await waitForFeedingRuntime(page);

  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.registry.set("uiPaused", false);
    const victim = scene.npcSystem.npcs.find(npc => npc.id === "civ_cross_1");
    const earlyReleaseVictim = scene.npcSystem.npcs.find(npc => npc.id === "civ_east_1");
    if (!victim || !earlyReleaseVictim) throw new Error("Feeding-depth browser fixtures are unavailable.");

    for (const npc of scene.npcSystem.npcs) npc.inactive = true;

    const resetVictim = (npc, x, y) => {
      npc.inactive = false;
      npc.dead = false;
      npc.deathKind = null;
      npc.hiddenBody = false;
      npc.dragged = false;
      npc.intercepted = false;
      npc.corpseDiscovered = false;
      npc.hasReported = false;
      npc.feedingDepth = "none";
      npc.feedingMemoryState = "none";
      npc.feedingUnconscious = false;
      npc.feedingBiteEvidence = false;
      npc.feedingEvidenceDiscovered = false;
      npc.huntingAssessmentId = null;
      npc.huntingAssessmentIds = [];
      npc.stunnedTimer = 0;
      npc.alarmed = false;
      npc.chasingPlayer = false;
      npc.enemyAttack = null;
      npc.layer = 0;
      npc.x = x;
      npc.y = y;
      if (npc.combat) {
        npc.combat.state = "active";
        npc.combat.resilience = npc.combat.maxResilience || 3;
      }
      npc.container.setPosition(x, y).setScale(1).setAlpha(1).setVisible(true);
    };

    scene.currentLayer = 0;
    scene.feedingSystem.hunger = 100;
    scene.evidenceSystem.bloodStains = [];
    scene.evidenceSystem.nextBloodId = 1;
    resetVictim(earlyReleaseVictim, 1498, 492);
    scene.player.setPosition(1490, 492);
    scene.npcSystem.rebuildSpatialIndex();

    const assessmentsBeforeEarlyRelease = window.NBD_HUNTING_LAW.snapshot().counters.total;
    const hungerBeforeEarlyRelease = scene.feedingSystem.hunger;
    const earlyStarted = scene.feedingSystem.startDrain(earlyReleaseVictim, {
      source: "browser-feeding-depth",
      eligibility: "right-click"
    });
    scene.feedingSystem.update(0.3, false);
    const earlyReleased = scene.feedingSystem.release("input-release");
    const earlyRelease = {
      earlyStarted,
      earlyReleased,
      hungerBefore: hungerBeforeEarlyRelease,
      hungerAfter: scene.feedingSystem.hunger,
      depth: earlyReleaseVictim.feedingDepth,
      assessmentDelta: window.NBD_HUNTING_LAW.snapshot().counters.total - assessmentsBeforeEarlyRelease
    };

    earlyReleaseVictim.inactive = true;
    earlyReleaseVictim.container.setVisible(false);
    resetVictim(victim, 1500, 500);
    scene.player.setPosition(1492, 500);
    scene.npcSystem.rebuildSpatialIndex();

    const resolved = [];
    const onResolved = payload => resolved.push({ ...payload });
    scene.events.on("feeding:resolved", onResolved);

    const quickStarted = scene.feedingSystem.startDrain(victim, {
      source: "browser-feeding-depth",
      eligibility: "right-click"
    });
    scene.feedingSystem.update(0.7, false);
    const quickResult = scene.feedingSystem.release("input-release");
    const quickState = {
      hunger: scene.feedingSystem.hunger,
      depth: victim.feedingDepth,
      dead: victim.dead,
      unconscious: victim.feedingUnconscious,
      combatState: victim.combat?.state,
      bloodStains: scene.evidenceSystem.bloodStains.length,
      dragActions: scene.evidenceSystem.collectInteractions().map(action => action.label)
    };

    const fullStarted = scene.feedingSystem.startDrain(victim, {
      source: "browser-feeding-depth",
      eligibility: "downed"
    });
    scene.feedingSystem.update(1.05, false);
    const fullResult = scene.feedingSystem.release("input-release");
    const fullState = {
      hunger: scene.feedingSystem.hunger,
      depth: victim.feedingDepth,
      dead: victim.dead,
      unconscious: victim.feedingUnconscious,
      combatState: victim.combat?.state,
      bloodStains: scene.evidenceSystem.bloodStains.length,
      dragActions: scene.evidenceSystem.collectInteractions().map(action => action.label)
    };

    const drainStarted = scene.feedingSystem.startDrain(victim, {
      source: "browser-feeding-depth",
      eligibility: "downed"
    });
    scene.feedingSystem.update(1.4, false);
    const drainState = {
      hunger: scene.feedingSystem.hunger,
      depth: victim.feedingDepth,
      dead: victim.dead,
      deathKind: victim.deathKind,
      unconscious: victim.feedingUnconscious,
      bloodStains: scene.evidenceSystem.bloodStains.length,
      active: Boolean(scene.feedingSystem.active)
    };

    scene.events.off("feeding:resolved", onResolved);
    const hunting = window.NBD_HUNTING_LAW.snapshot();
    const assessments = hunting.assessments.slice(-3);

    return {
      earlyRelease,
      quickStarted,
      fullStarted,
      drainStarted,
      quickResult,
      fullResult,
      quickState,
      fullState,
      drainState,
      resolved,
      assessments,
      assessmentIds: victim.huntingAssessmentIds,
      feedingStats: { ...scene.feedingSystem.stats },
      lastActionText: scene.lastActionText
    };
  });

  expect(result.earlyRelease).toEqual({
    earlyStarted: true,
    earlyReleased: false,
    hungerBefore: 100,
    hungerAfter: 100,
    depth: "none",
    assessmentDelta: 0
  });

  expect(result.quickStarted).toBe(true);
  expect(result.quickResult).toMatchObject({
    feedingDepth: "quick_bite",
    hungerRelief: 14,
    victimOutcome: "disoriented",
    victimAlive: true,
    victimConscious: true,
    bodyEvidence: false,
    biteEvidence: true
  });
  expect(result.quickState).toMatchObject({
    hunger: 86,
    depth: "quick_bite",
    dead: false,
    unconscious: false,
    combatState: "active",
    bloodStains: 0,
    dragActions: []
  });

  expect(result.fullStarted).toBe(true);
  expect(result.fullResult).toMatchObject({
    feedingDepth: "full_feed",
    hungerRelief: 20,
    victimOutcome: "unconscious",
    victimAlive: true,
    victimConscious: false,
    bodyEvidence: false,
    biteEvidence: true
  });
  expect(result.fullState.hunger).toBe(66);
  expect(result.fullState.depth).toBe("full_feed");
  expect(result.fullState.dead).toBe(false);
  expect(result.fullState.unconscious).toBe(true);
  expect(result.fullState.combatState).toBe("downed");
  expect(result.fullState.bloodStains).toBe(1);
  expect(result.fullState.dragActions.some(label => label.includes("unconscious victim"))).toBe(true);

  expect(result.drainStarted).toBe(true);
  expect(result.drainState).toEqual({
    hunger: 42,
    depth: "drain",
    dead: true,
    deathKind: "drained",
    unconscious: false,
    bloodStains: 4,
    active: false
  });

  expect(result.resolved.map(item => item.feedingDepth)).toEqual(["quick_bite", "full_feed", "drain"]);
  expect(result.resolved.map(item => item.hungerRelief)).toEqual([14, 20, 24]);
  expect(result.assessments.map(item => item.feedingDepth)).toEqual(["quick_bite", "full_feed", "drain"]);
  expect(result.assessments.map(item => item.victimOutcome)).toEqual(["disoriented", "unconscious", "dead"]);
  expect(result.assessments.map(item => item.bodyEvidence)).toEqual([false, false, true]);
  expect(result.assessmentIds).toHaveLength(3);
  expect(result.feedingStats).toMatchObject({ feeds: 3, quickBites: 1, fullFeeds: 1, drains: 1 });
  expect(result.lastActionText).toContain("DRAIN");

  await page.click("#hud-ledger-button");
  await expect(page.locator("#night-ledger")).toHaveClass(/open/);
  const ledgerText = await page.locator("#night-ledger-content").innerText();
  expect(ledgerText).toContain("QUICK BITE");
  expect(ledgerText).toContain("FULL FEED");
  expect(ledgerText).toContain("DRAIN");
  expect(pageErrors).toEqual([]);
});
