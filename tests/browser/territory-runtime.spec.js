import { expect, test } from "@playwright/test";

const CURRENT_STORAGE_KEY = "viceblood-campaign-v1";

test.describe.configure({ timeout: 90_000 });

async function waitForTerritory(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_TERRITORY_READY
    && window.NBD_CAMPAIGN_SYSTEM
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.territoryRuntimeSystem
  ));
}

test("district entry, reputation policy and influence changes share one persistent territory authority", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await waitForTerritory(page);

  const result = await page.evaluate(storageKey => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.registry.set("uiPaused", false);

    scene.player.setPosition(1500, 500);
    window.NBD_TERRITORY.step();
    const civic = window.NBD_TERRITORY.current();
    const civicToast = scene.registry.get("lastActionText");

    scene.player.setPosition(1500, 1300);
    window.NBD_TERRITORY.step();
    const oldQuarterBefore = window.NBD_TERRITORY.current();
    const contestedToast = scene.registry.get("lastActionText");

    scene.campaignSystem.reputation.setFaction("first_estate", -80, {
      source: "browser-test",
      reason: "hostility policy"
    });
    const influence = window.NBD_TERRITORY.setInfluence("old-quarter", "first_estate", 70, {
      source: "browser-test",
      referenceId: "territory-test"
    });
    window.NBD_TERRITORY.announce();
    const oldQuarterAfter = window.NBD_TERRITORY.current();
    const hostileToast = scene.registry.get("lastActionText");
    const stored = JSON.parse(localStorage.getItem(storageKey));
    const enteredEvents = scene.campaignSystem.state.eventLog.filter(event => event.type === "territory:district-entered");

    return {
      civic,
      civicToast,
      oldQuarterBefore,
      contestedToast,
      influence: {
        changed: influence.changed,
        ownerBefore: influence.ownerBefore,
        ownerAfter: influence.ownerAfter,
        statusAfter: influence.statusAfter
      },
      oldQuarterAfter,
      hostileToast,
      storedTerritory: stored.territory.districts["old-quarter"],
      enteredEvents,
      snapshot: window.NBD_TERRITORY.snapshot()
    };
  }, CURRENT_STORAGE_KEY);

  expect(result.civic).toMatchObject({
    id: "civic-center",
    name: "Civic Centre",
    ownerId: "first_estate",
    status: "controlled",
    relationship: "tolerated"
  });
  expect(result.civicToast).toBe("CIVIC CENTRE · THE FIRST ESTATE · TOLERATED");
  expect(result.oldQuarterBefore).toMatchObject({ id: "old-quarter", status: "contested", ownerId: null });
  expect(result.contestedToast).toBe("OLD QUARTER · CONTESTED");
  expect(result.influence).toEqual({
    changed: true,
    ownerBefore: null,
    ownerAfter: "first_estate",
    statusAfter: "controlled"
  });
  expect(result.oldQuarterAfter).toMatchObject({
    ownerId: "first_estate",
    status: "controlled",
    relationship: "hostile",
    restricted: true
  });
  expect(result.hostileToast).toBe("OLD QUARTER · THE FIRST ESTATE · HOSTILE");
  expect(result.storedTerritory).toMatchObject({ ownerId: "first_estate", status: "controlled" });
  expect(result.enteredEvents).toEqual([]);
  expect(result.snapshot.territory.counts.total).toBe(14);
  expect(pageErrors).toEqual([]);
});
