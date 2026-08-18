import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

function normalizedText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

test("playtest mode delivers a start, objective loop, result and feedback path", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?mode=playtest&rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_PLAYTEST_READY));

  await expect(page.locator("#playtest-boot-cover")).toHaveCount(0);
  await expect(page.locator("#playtest-intro")).toHaveClass(/open/);
  const introTitle = await page.locator("#playtest-intro-title").evaluate(node => node.innerText);
  expect(normalizedText(introTitle)).toBe("Immortality was never the luxury you imagined.");
  await expect(page.locator("#playtest-start")).toBeVisible();

  await page.keyboard.press("h");
  await page.keyboard.press("m");
  await page.keyboard.press("l");
  await expect(page.locator("#ui-modal")).not.toHaveClass(/open/);
  await expect(page.locator("#mission-drawer")).not.toHaveClass(/open/);
  await expect(page.locator("#night-ledger")).not.toHaveClass(/open/);

  await page.locator("#playtest-start").click();
  await page.waitForFunction(() => window.NBD_PLAYTEST_SESSION?.snapshot?.().status === "active");
  await expect(page.locator("#playtest-objective")).toHaveClass(/open/);
  await expect(page.locator("#playtest-objective-hint")).toContainText("prey pulse");
  await expect(page.locator("#hud-hunger-value")).toContainText("72%");
  await expect(page.locator("#hud-mission-step")).toHaveText("1/3");
  await expect(page.locator("#mission-current")).toContainText("1/3 HUNT");
  await expect(page.locator("#mission-checklist")).toContainText("Find prey and feed");
  await expect(page.locator("#mission-checklist")).not.toContainText("rooftop blocker");

  const guidance = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const session = scene.playtestSessionSystem;
    session.update(0.1);
    return {
      preyId: session.nearestPrey()?.id || null,
      markerVisible: Boolean(session.marker?.visible)
    };
  });
  expect(guidance.preyId).toBeTruthy();
  expect(guidance.markerVisible).toBe(true);

  await page.waitForFunction(() => Boolean(
    window.NBD_PEDESTRIANS_READY
    && window.NBD_TRAFFIC_WITNESSES_READY
  ));
  await page.waitForFunction(() => (window.NBD_TRAFFIC?.snapshot?.().materializedCount || 0) > 0, null, {
    timeout: 20_000
  });
  const cityConsequences = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    await scene.trafficMaterializationSystem.initialization;
    scene.trafficMaterializationSystem.reconcile(true);
    const activeCops = scene.policeSystem.allPolice().filter(cop => !cop.inactive && !cop.dead);
    const patrolRoutes = activeCops.flatMap(cop => {
      const zone = scene.policeSystem.zoneAt(cop.x, cop.y);
      return scene.policeSystem.districtPatrolRoutes(zone.id);
    });
    return {
      pedestrianCount: window.NBD_PEDESTRIANS.snapshot().count,
      ambientCount: scene.npcSystem.npcs.filter(npc => npc.ambientPopulation && !npc.inactive).length,
      trafficWitnessCount: window.NBD_TRAFFIC_WITNESSES.snapshot().candidateCount,
      sidewalkPatrols: patrolRoutes.filter(route => route.surface === "sidewalk").length,
      roadFallbacks: patrolRoutes.filter(route => route.surface === "road-fallback").length
    };
  });
  expect(cityConsequences.pedestrianCount).toBeGreaterThanOrEqual(30);
  expect(cityConsequences.ambientCount).toBeGreaterThanOrEqual(30);
  expect(cityConsequences.trafficWitnessCount).toBeGreaterThan(0);
  expect(cityConsequences.sidewalkPatrols).toBeGreaterThan(0);
  expect(cityConsequences.roadFallbacks).toBe(0);

  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const session = scene.playtestSessionSystem;
    const refuge = session.snapshot().refuge;

    scene.player.setPosition(refuge.x + 220, refuge.y);
    session.update(0.2);
    scene.events.emit("feeding:resolved", { depth: "drain", feedingDepth: "drain" });
    scene.feedingSystem.hunger = 20;
    session.update(0.2);
    scene.currentLayer = refuge.layer;
    scene.player.setPosition(refuge.x, refuge.y);
    session.update(0.2);
  });

  await expect(page.locator("#playtest-result")).toHaveClass(/open/);
  await expect(page.locator("#playtest-result-title")).toHaveText("NIGHT SURVIVED");
  await expect(page.locator("#playtest-result-stats")).toContainText("Victims fed upon");
  await expect(page.locator("#playtest-result-feedback")).toBeVisible();
  await expect(page.locator("#ui-modal")).not.toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => window.NBD_PLAYTEST_SESSION.snapshot().objectiveText))
    .toContain("NIGHT SURVIVED");

  await page.locator("#playtest-result-feedback").click();
  await expect(page.locator("#playtest-feedback-overlay")).toHaveClass(/open/);
  await expect(page.locator("#playtest-feedback-title")).toContainText("how the loop felt");
  await page.keyboard.press("h");
  await expect(page.locator("#ui-modal")).not.toHaveClass(/open/);
  await page.locator("[data-feedback-close]").first().click();
  await expect(page.locator("#playtest-feedback-overlay")).not.toHaveClass(/open/);

  expect(pageErrors).toEqual([]);
});

test("an alarmed pedestrian reacts briefly, then commits to one report run", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?mode=playtest&rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_PLAYTEST_READY
    && window.NBD_PEDESTRIANS_READY
  ));
  await page.locator("#playtest-start").click();
  await page.waitForFunction(() => window.NBD_PLAYTEST_SESSION?.snapshot?.().status === "active");

  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const witness = (scene.pedestrianSystem?.pedestrians || []).find(npc => Boolean(
      npc
      && npc.pedestrian?.routeId
      && !npc.dead
      && !npc.inactive
      && (scene.entityStreamSystem?.shouldSimulateNpc?.(npc) ?? true)
    ));
    if (!witness) return { missing: true };

    const zone = scene.policeSystem.zoneAt(witness.x, witness.y);
    const route = scene.policeSystem
      .districtPatrolRoutes(zone.id)
      .find(candidate => candidate.id === witness.pedestrian.routeId);
    if (!route?.points?.length) {
      return { missing: false, missingRoute: true, routeId: witness.pedestrian.routeId };
    }

    let startIndex = 0;
    let bestDistance = Infinity;
    route.points.forEach((point, index) => {
      const candidate = Math.hypot(point.x - witness.x, point.y - witness.y);
      if (candidate < bestDistance) {
        startIndex = index;
        bestDistance = candidate;
      }
    });
    const start = route.points[startIndex];
    const nextIndex = (startIndex + 1) % route.points.length;
    const next = route.points[nextIndex];
    const forwardX = next.x - start.x;
    const forwardY = next.y - start.y;
    const forwardLength = Math.hypot(forwardX, forwardY) || 1;

    witness.x = start.x;
    witness.y = start.y;
    witness.container?.setPosition?.(witness.x, witness.y);
    witness.pedestrian.pointIndex = nextIndex;
    witness.alarmed = false;
    witness.hasReported = false;
    witness.intercepted = false;
    witness.inactive = false;
    witness.dead = false;
    witness.drainVictim = false;
    witness.stunnedTimer = 0;
    witness.reactionTimer = 0;
    witness.soundReactionTimer = 0;
    witness.reportTarget = null;
    witness.reportNavigation = null;
    witness.witnessSource = null;
    witness.masqueradeRisk = false;
    if (witness.ai) {
      witness.ai.role = "none";
      witness.ai.intent = "idle";
    }

    const source = {
      id: "browser-danger",
      x: start.x - (forwardX / forwardLength) * 24,
      y: start.y - (forwardY / forwardLength) * 24,
      layer: witness.layer
    };
    witness.reportTarget = {
      id: "browser-report-point",
      name: "a nearby reporting corner",
      x: next.x,
      y: next.y,
      severityBonus: 0
    };

    const reportsBefore = scene.witnessSystem.reports;
    const alarmed = scene.witnessSystem.alarmWitness(
      witness,
      "a violent supernatural act",
      18,
      {
        reactionSeconds: 1.8,
        masqueradeRisk: false,
        source
      }
    );
    const reactionAtAlarm = witness.reactionTimer;
    const plannedRouteId = witness.reportNavigation?.routeId || null;
    const startPosition = { x: witness.x, y: witness.y };
    let previous = { ...startPosition };
    let previousDirection = null;
    let firstMoveFrame = null;
    let directionReversals = 0;
    let stationaryFramesAfterShock = 0;
    let movedDistance = 0;

    for (let frame = 0; frame < 320 && !witness.hasReported; frame++) {
      scene.npcSystem.update(0.05);
      scene.witnessSystem.update(0.05);

      const moveX = witness.x - previous.x;
      const moveY = witness.y - previous.y;
      const step = Math.hypot(moveX, moveY);
      if (step > 0.001) {
        if (firstMoveFrame === null) firstMoveFrame = frame;
        const direction = { x: moveX / step, y: moveY / step };
        if (previousDirection) {
          const dot = previousDirection.x * direction.x + previousDirection.y * direction.y;
          if (dot < -0.35) directionReversals++;
        }
        previousDirection = direction;
        movedDistance += step;
      } else if (witness.reactionTimer <= 0 && !witness.hasReported) {
        stationaryFramesAfterShock++;
      }
      previous = { x: witness.x, y: witness.y };
    }

    return {
      missing: false,
      missingRoute: false,
      alarmed,
      reactionAtAlarm,
      plannedRouteId,
      pedestrianRouteId: witness.pedestrian.routeId,
      firstMoveFrame,
      directionReversals,
      stationaryFramesAfterShock,
      movedDistance,
      displacement: Math.hypot(
        witness.x - startPosition.x,
        witness.y - startPosition.y
      ),
      reported: witness.hasReported,
      reportDelta: scene.witnessSystem.reports - reportsBefore,
      navigationComplete: Boolean(witness.reportNavigation?.complete)
    };
  });

  expect(result.missing).toBe(false);
  expect(result.missingRoute).toBe(false);
  expect(result.alarmed).toBe(true);
  expect(result.reactionAtAlarm).toBeGreaterThan(0);
  expect(result.reactionAtAlarm).toBeLessThanOrEqual(0.65);
  expect(result.plannedRouteId).toBe(result.pedestrianRouteId);
  expect(result.firstMoveFrame).not.toBeNull();
  expect(result.firstMoveFrame).toBeLessThanOrEqual(15);
  expect(result.directionReversals).toBe(0);
  expect(result.stationaryFramesAfterShock).toBeLessThanOrEqual(4);
  expect(result.movedDistance).toBeGreaterThan(24);
  expect(result.displacement).toBeGreaterThan(20);
  expect(result.reported).toBe(true);
  expect(result.reportDelta).toBe(1);
  expect(result.navigationComplete).toBe(true);
  expect(pageErrors).toEqual([]);
});
