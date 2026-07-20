import { expect, test } from "@playwright/test";

const STORAGE_KEY = "vampire-district-campaign-v1";
const RESET_SENTINEL = "vampire-district-checkpoint-test-reset";

test.describe.configure({ timeout: 90_000 });

async function clearCampaignOnce(page) {
  await page.addInitScript(({ storageKey, sentinel }) => {
    if (window.sessionStorage.getItem(sentinel) === "done") return;
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.setItem(sentinel, "done");
  }, { storageKey: STORAGE_KEY, sentinel: RESET_SENTINEL });
}

test("safe objective checkpoint restores mission, world, loadout and completed tutorial", async ({ page }) => {
  await clearCampaignOnce(page);
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_CAMPAIGN_READY
    && window.NBD_RC_HARNESS_READY
  ));

  await page.evaluate(() => window.NBD_RC_HARNESS.prepareJournalistObjective());
  await page.waitForFunction(() => (
    window.NBD_CAMPAIGN.checkpoint()?.objectiveId === "neutralize_journalist"
  ));

  const saved = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 560, y: 350 }, "Checkpoint test: safe club-side shadow.");
    scene.feedingSystem.hunger = 57;
    scene.weaponSystem.restoreState({
      selectedWeaponId: "pistol",
      inventory: ["unarmed", "pipe", "pistol"],
      ammo: { pistol: 3 }
    });

    const thug = scene.npcSystem.npcs.find(npc => npc.id === "rooftop_thug");
    if (thug && !thug.dead) scene.npcSystem.markDead(thug, "drained");
    const informant = scene.tutorialDirector?.informant;
    if (informant) {
      informant.inactive = true;
      informant.container?.setAlpha?.(0).setVisible?.(false);
    }

    scene.brokenLights.add("lampClub");
    const lamp = scene.propDamageSystem.props.find(prop => prop.id === "lampClub");
    if (lamp) {
      lamp.broken = true;
      lamp.durability = 0;
    }

    scene.campaignCheckpointSystem.requestObjective(
      "silence_the_journalist",
      "neutralize_journalist"
    );
    scene.campaignCheckpointSystem.update();
    scene.campaignSystem.save();
    return {
      checkpoint: window.NBD_CAMPAIGN.checkpoint(),
      missionStep: scene.missionSystem.step,
      hunger: scene.feedingSystem.hunger,
      weapon: scene.weaponSystem.state()
    };
  });

  expect(saved.checkpoint.objectiveId).toBe("neutralize_journalist");
  expect(saved.checkpoint.player).toMatchObject({ x: 560, y: 350, layer: 0, hunger: 57 });
  expect(saved.checkpoint.loadout).toMatchObject({
    selectedWeaponId: "pistol",
    ammo: { pistol: 3 }
  });
  expect(saved.checkpoint.world.brokenLights).toContain("lampClub");
  expect(saved.missionStep).toBe(2);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_CAMPAIGN_READY
    && window.NBD_RC_HARNESS_READY
    && window.NBD_PHASER_GAME.scene.getScene("GameScene").registry.get("campaignResumeApplied")
  ));

  const restored = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
    const npc = id => scene.npcSystem.npcs.find(candidate => candidate.id === id);
    return {
      missionStep: scene.missionSystem.step,
      objectiveId: scene.missionSystem.currentObjective()?.id,
      player: { x: scene.player.x, y: scene.player.y, layer: scene.currentLayer },
      hunger: scene.feedingSystem.hunger,
      weapon: scene.weaponSystem.state(),
      broken: scene.brokenLights.has("lampClub"),
      propBroken: scene.propDamageSystem.props.find(prop => prop.id === "lampClub")?.broken,
      thug: { dead: npc("rooftop_thug")?.dead, deathKind: npc("rooftop_thug")?.deathKind },
      journalist: { dead: npc("journalist")?.dead, inactive: npc("journalist")?.inactive },
      informant: { inactive: scene.tutorialDirector?.informant?.inactive },
      introOpen: ui.introOpen,
      directorState: scene.tutorialDirector?.state,
      taskRevealActive: scene.registry.get("taskRevealActive"),
      checkpoint: window.NBD_CAMPAIGN.checkpoint()
    };
  });

  expect(restored.missionStep).toBe(2);
  expect(restored.objectiveId).toBe("neutralize_journalist");
  expect(restored.player).toMatchObject({ x: 560, y: 350, layer: 0 });
  expect(restored.hunger).toBe(57);
  expect(restored.weapon.id).toBe("pistol");
  expect(restored.weapon.ammo).toBe(3);
  expect(restored.broken).toBe(true);
  expect(restored.propBroken).toBe(true);
  expect(restored.thug).toEqual({ dead: true, deathKind: "drained" });
  expect(restored.journalist).toEqual({ dead: false, inactive: false });
  expect(restored.informant.inactive).toBe(true);
  expect(restored.introOpen).toBe(false);
  expect(restored.directorState).toBe("complete");
  expect(restored.taskRevealActive).toBe(false);
  expect(restored.checkpoint.objectiveId).toBe("neutralize_journalist");
});
