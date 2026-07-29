import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

async function waitForPredatorPowers(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_PREDATOR_POWERS
    && window.NBD_EXPOSURE
    && window.NBD_HEAT
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.powersSystem
  ));
}

test("Blood Sense, contextual Whisper and Give In form one evidence-limited predator toolkit", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await waitForPredatorPowers(page);

  const setup = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
    ui.closeIntro();
    scene.registry.set("uiPaused", false);
    scene.interactionSystem.close("Predator-power regression setup.");
    scene.heatSystem.clear("Predator-power regression baseline.");
    scene.exposureSystem.clear("Predator-power regression baseline.");
    scene.currentLayer = 0;
    const origin = { x: scene.player.x, y: scene.player.y };
    scene.feedingSystem.hunger = 10;

    const ids = ["civ_cross_1", "civ_east_1", "civ_church", "police_anchor"];
    const [prey, memoryTarget, watcher, officer] = ids.map(id => scene.npcSystem.npcs.find(npc => npc.id === id));
    if (!prey || !memoryTarget || !watcher || !officer) throw new Error("Predator-power fixtures unavailable.");

    const resetNpc = (npc, x, y) => {
      npc.inactive = false;
      npc.dead = false;
      npc.hiddenBody = false;
      npc.intercepted = false;
      npc.alarmed = false;
      npc.hasReported = false;
      npc.reportTarget = null;
      npc.reportSeverity = 0;
      npc.witnessReason = "";
      npc.witnessSource = null;
      npc.masqueradeRisk = false;
      npc.reactionTimer = 0;
      npc.soundReactionTimer = 0;
      npc.luredTimer = 0;
      npc.whisperCommand = null;
      npc.whisperCommandTimer = 0;
      npc.whisperPassengerVehicleId = null;
      npc.whisperPassengerBoarded = false;
      npc.exposureEvidenceIds = [];
      npc.pendingHuntingAssessmentIds = [];
      npc.noHeartbeat = false;
      npc.protectionKnown = false;
      npc.huntingProtectionKnown = false;
      npc.compromised = false;
      npc.whisperAuthority = false;
      npc.layer = 0;
      npc.x = x;
      npc.y = y;
      npc.dirX = -1;
      npc.dirY = 0;
      npc.stunnedTimer = 0;
      npc.container.setPosition(x, y).setVisible(true).setAlpha(1);
      if (npc.combat) {
        npc.combat.state = "active";
        npc.combat.resilience = npc.combat.maxResilience || 3;
      }
      scene.aiStateSystem?.ensureNpc?.(npc);
      scene.aiStateSystem?.resolveNpc?.(npc);
    };

    for (const npc of scene.npcSystem.npcs) {
      npc.inactive = true;
      npc.container?.setVisible?.(false);
    }
    resetNpc(prey, origin.x + 30, origin.y);
    resetNpc(memoryTarget, origin.x + 70, origin.y);
    resetNpc(watcher, origin.x + 310, origin.y);
    resetNpc(officer, origin.x + 110, origin.y);
    memoryTarget.combat.resilience = 1;
    officer.noHeartbeat = true;

    scene.campaignSystem.huntingLaw.protectVictim({
      victimId: prey.id,
      factionId: "first_estate",
      reason: "Known donor",
      source: "browser-predator-powers"
    });
    scene.evidenceSystem.createBloodStain(origin.x + 50, origin.y + 20, 0, "browser-predator-powers");
    scene.npcSystem.rebuildSpatialIndex();

    const unknownProtection = window.NBD_PREDATOR_POWERS.bloodSenseReadings();
    prey.protectionKnown = true;
    const learnedProtection = window.NBD_PREDATOR_POWERS.bloodSenseReadings();

    const vehicle = scene.vehicleSystem.vehicles.find(candidate => candidate.ownership !== "police");
    if (!vehicle) throw new Error("No non-police vehicle is available for contextual Whisper.");
    vehicle.x = prey.x + 26;
    vehicle.y = prey.y + 8;
    vehicle.speed = 0;
    vehicle.disabled = false;
    vehicle.layer = 0;
    vehicle.container.setPosition(vehicle.x, vehicle.y).setVisible(true);
    scene.whisperContexts = [{
      id: "browser-service-door",
      whisperOpen: true,
      x: prey.x + 8,
      y: prey.y,
      radius: 44,
      run: () => {
        scene.__browserWhisperDoorOpened = true;
        return true;
      }
    }];

    return {
      preyId: prey.id,
      memoryTargetId: memoryTarget.id,
      watcherId: watcher.id,
      officerId: officer.id,
      vehicleId: vehicle.id,
      unknownProtection,
      learnedProtection,
      calmOptions: window.NBD_PREDATOR_POWERS.whisperOptions(prey.id)
    };
  });

  const byId = (readings, id) => readings.find(reading => reading.id === id);
  expect(byId(setup.unknownProtection, setup.preyId)).toMatchObject({ kind: "heartbeat", protectionKnown: false });
  expect(byId(setup.learnedProtection, setup.preyId)).toMatchObject({ kind: "heartbeat", protectionKnown: true });
  expect(byId(setup.learnedProtection, setup.memoryTargetId).kind).toBe("wounded");
  expect(byId(setup.learnedProtection, setup.officerId)).toMatchObject({ kind: "silent", heartbeat: false });
  expect(setup.learnedProtection.some(reading => reading.kind === "blood")).toBe(true);
  expect(setup.calmOptions.map(option => option.command)).toEqual(expect.arrayContaining([
    "come_here",
    "walk_away",
    "open_it",
    "get_in"
  ]));

  const whisper = await page.evaluate(({ preyId, memoryTargetId, officerId }) => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const powers = scene.powersSystem;
    const prey = scene.npcSystem.npcs.find(npc => npc.id === preyId);
    const memoryTarget = scene.npcSystem.npcs.find(npc => npc.id === memoryTargetId);
    const officer = scene.npcSystem.npcs.find(npc => npc.id === officerId);

    const comeHere = window.NBD_PREDATOR_POWERS.command(preyId, "come_here");
    const comeState = {
      command: prey.whisperCommand,
      luredTimer: prey.luredTimer,
      hunger: scene.feedingSystem.hunger
    };

    powers.cooldowns.whisper = 0;
    const institutional = scene.exposureSystem.registerVisiblePowerUse({
      label: "an already filed institutional account",
      x: memoryTarget.x,
      y: memoryTarget.y,
      layer: 0,
      subjectId: memoryTarget.id,
      exposureWeight: 20,
      knowledgeState: "institutional",
      witnessIds: [memoryTarget.id]
    });
    const memory = scene.exposureSystem.registerWitnessMemory(memoryTarget, {
      reason: "Witness remembers a supernatural command.",
      sourceEvent: "browser-whisper-memory",
      subjectId: "player",
      exposureWeight: 12
    });
    memoryTarget.alarmed = true;
    memoryTarget.reportTarget = { id: "police", name: "police station", x: 1700, y: 500 };
    memoryTarget.witnessReason = "a supernatural command";
    memoryTarget.masqueradeRisk = true;
    memoryTarget.reactionTimer = 1;
    scene.aiStateSystem.resolveNpc(memoryTarget);

    const alarmedOptions = window.NBD_PREDATOR_POWERS.whisperOptions(memoryTargetId);
    const stayCalm = window.NBD_PREDATOR_POWERS.command(memoryTargetId, "stay_calm");
    const calmState = {
      alarmed: memoryTarget.alarmed,
      reportTarget: memoryTarget.reportTarget,
      hasReported: memoryTarget.hasReported,
      memoryState: scene.exposureSystem.snapshot().records[memory.id].knowledgeState
    };

    powers.cooldowns.whisper = 0;
    const forget = window.NBD_PREDATOR_POWERS.command(memoryTargetId, "forget_this");
    const exposureAfterForget = scene.exposureSystem.snapshot();

    powers.cooldowns.whisper = 0;
    scene.heatSystem.forceLevel(2, "Browser pursuit for Call Them Off.", {
      districtId: scene.heatSystem.districtAt(officer.x, officer.y).id,
      source: "browser-predator-powers"
    });
    officer.compromised = true;
    officer.whisperAuthority = true;
    officer.alarmed = false;
    officer.hasReported = false;
    officer.reportTarget = null;
    officer.reactionTimer = 0;
    officer.soundReactionTimer = 0;
    officer.whisperResistance = 3;
    officer.chasingPlayer = false;
    officer.enemyAttack = null;
    scene.aiStateSystem.resolveNpc(officer);
    const officerOptions = window.NBD_PREDATOR_POWERS.whisperOptions(officerId);
    const heatBefore = scene.heatSystem.maximum();
    const callOff = window.NBD_PREDATOR_POWERS.command(officerId, "call_them_off");
    const heatAfter = scene.heatSystem.maximum();

    return {
      comeHere,
      comeState,
      alarmedOptions,
      stayCalm,
      calmState,
      forget,
      memoryStateAfterForget: exposureAfterForget.records[memory.id].knowledgeState,
      institutionalStateAfterForget: exposureAfterForget.records[institutional.id].knowledgeState,
      officerOptions,
      callOff,
      heatBefore,
      heatAfter
    };
  }, setup);

  expect(whisper.comeHere).toBe(true);
  expect(whisper.comeState.command).toBe("come_here");
  expect(whisper.comeState.luredTimer).toBeGreaterThan(0);
  expect(whisper.alarmedOptions.map(option => option.command)).toEqual(expect.arrayContaining(["stay_calm", "forget_this"]));
  expect(whisper.stayCalm).toBe(true);
  expect(whisper.calmState).toMatchObject({
    alarmed: false,
    reportTarget: null,
    hasReported: false,
    memoryState: "latent"
  });
  expect(whisper.forget).toBe(true);
  expect(whisper.memoryStateAfterForget).toBe("resolved");
  expect(whisper.institutionalStateAfterForget).toBe("institutional");
  expect(whisper.officerOptions.map(option => option.command)).toContain("call_them_off");
  expect(whisper.callOff).toBe(true);
  expect(whisper.heatBefore).toBeGreaterThanOrEqual(45);
  expect(whisper.heatAfter).toBeLessThan(whisper.heatBefore);

  const criticalPressure = await page.evaluate(({ watcherId, officerId }) => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const watcher = scene.npcSystem.npcs.find(npc => npc.id === watcherId);
    const officer = scene.npcSystem.npcs.find(npc => npc.id === officerId);
    for (const npc of scene.npcSystem.npcs) {
      if (npc !== watcher && npc !== officer) {
        npc.inactive = true;
        npc.container?.setVisible?.(false);
      }
    }
    watcher.inactive = false;
    watcher.dead = false;
    watcher.intercepted = false;
    watcher.alarmed = false;
    watcher.hasReported = false;
    watcher.reportTarget = null;
    watcher.exposureEvidenceIds = [];
    watcher.x = scene.player.x + 20;
    watcher.y = scene.player.y;
    watcher.layer = 0;
    watcher.container.setPosition(watcher.x, watcher.y).setVisible(true);
    officer.inactive = false;
    officer.dead = false;
    officer.x = scene.player.x + 16;
    officer.y = scene.player.y + 16;
    officer.layer = 0;
    officer.container.setPosition(officer.x, officer.y).setVisible(true);
    scene.npcSystem.rebuildSpatialIndex();

    scene.feedingSystem.hunger = 99;
    scene.playerDamageSystem.state.invulnerableUntil = 0;
    scene.playerDamageSystem.state.hitStunUntil = 0;
    const failedBefore = Boolean(scene.missionSystem.failed);
    const damaged = scene.playerDamageSystem.damagePlayer(officer, {
      id: "browser-critical-pressure",
      label: "controlled test strike",
      hungerDamage: 5
    });
    return {
      damaged,
      hunger: scene.feedingSystem.hunger,
      failedBefore,
      failedAfter: Boolean(scene.missionSystem.failed),
      text: scene.lastActionText,
      hitStunned: scene.playerDamageSystem.isHitStunned()
    };
  }, setup);

  expect(criticalPressure).toMatchObject({
    damaged: true,
    hunger: 100,
    failedBefore: false,
    failedAfter: false,
    hitStunned: true
  });
  expect(criticalPressure.text).toContain("control remains yours");

  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.feedingSystem.hunger = 86;
    scene.powersSystem.cooldowns.beast = 0;
    document.querySelector("canvas")?.focus?.();
  });
  await page.keyboard.press("b");
  await page.waitForFunction(() => window.NBD_PREDATOR_POWERS.snapshot().beast.activeSeconds > 0);

  const beast = await page.evaluate(({ watcherId }) => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const watcher = scene.npcSystem.npcs.find(npc => npc.id === watcherId);
    const snapshot = window.NBD_PREDATOR_POWERS.snapshot();
    const evidence = window.NBD_EXPOSURE.activeEvidence().filter(record => (
      record.kind === "visible_power_use"
      && String(record.metadata?.label || "").includes("giving in")
    ));
    const attack = scene.powersSystem.attackModifiers({
      attackType: "melee",
      damage: 2,
      windupMs: 100,
      activeMs: 100,
      recoveryMs: 100
    });
    return {
      snapshot,
      watcherAlarmed: watcher.alarmed,
      evidence,
      attack,
      hitStunned: scene.playerDamageSystem.isHitStunned(),
      missionFailed: Boolean(scene.missionSystem.failed)
    };
  }, setup);

  expect(beast.snapshot.beast.givenIn).toBe(true);
  expect(beast.snapshot.beast.state).toBe("critical");
  expect(beast.snapshot.beast.movementMultiplier).toBeGreaterThan(1);
  expect(beast.snapshot.beast.feedingMultiplier).toBeGreaterThan(1);
  expect(beast.attack.damage).toBe(3);
  expect(beast.attack.windupMs).toBeLessThan(100);
  expect(beast.hitStunned).toBe(false);
  expect(beast.missionFailed).toBe(false);
  expect(beast.watcherAlarmed).toBe(true);
  expect(beast.evidence.some(record => record.knowledgeState === "institutional")).toBe(true);

  await expect(page.locator('[data-power="beast"]')).toHaveClass(/active/);
  await expect(page.locator('[data-power="beast"] .power-state')).toContainText("ACTIVE");
  expect(pageErrors).toEqual([]);
});
