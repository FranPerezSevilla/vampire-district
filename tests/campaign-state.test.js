import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignStateIsSerializable,
  createCampaignState,
  deserializeCampaignState,
  migrateCampaignState,
  sanitizeCampaignState,
  serializeCampaignState
} from "../phaser/src/campaign/CampaignState.js";
import { CAMPAIGN_REFUGES, CAMPAIGN_SCHEMA_VERSION } from "../phaser/src/campaign/constants.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test("fresh campaign state is JSON-only and contains the starting refuge", () => {
  const state = createCampaignState({ now: 1234 });
  assert.equal(state.version, CAMPAIGN_SCHEMA_VERSION);
  assert.equal(state.version, 2);
  assert.equal(state.player.cash, 0);
  assert.equal(state.player.currentRefugeId, CAMPAIGN_REFUGES.ROOFTOP_REFUGE);
  assert.deepEqual(state.world.unlockedRefuges, [CAMPAIGN_REFUGES.ROOFTOP_REFUGE]);
  assert.ok(state.inventory.refuges[CAMPAIGN_REFUGES.ROOFTOP_REFUGE]);
  assert.deepEqual(state.checkpoints, { latest: null });
  assert.equal(state.sequences.checkpoint, 0);
  assert.equal(campaignStateIsSerializable(state), true);
});

test("campaign state serializes and restores deterministic mission, inventory and reputation data", () => {
  const state = createCampaignState({ now: 10 });
  state.player.cash = 725;
  state.reputation.factions.blackglass_directorate = 12;
  state.reputation.contacts.police_roof_informant = 3;
  state.inventory.carried.sidearmWeaponId = "pistol";
  state.inventory.carried.ammoByType.pistol = 24;
  state.world.flags.journalist_silenced = true;
  state.missions.completed.push("silence_the_journalist");

  const restored = deserializeCampaignState(serializeCampaignState(state), { now: 99 });
  assert.equal(restored.player.cash, 725);
  assert.equal(restored.reputation.factions.blackglass_directorate, 12);
  assert.equal(restored.reputation.contacts.police_roof_informant, 3);
  assert.equal(restored.inventory.carried.sidearmWeaponId, "pistol");
  assert.equal(restored.inventory.carried.ammoByType.pistol, 24);
  assert.equal(restored.world.flags.journalist_silenced, true);
  assert.deepEqual(restored.missions.completed, ["silence_the_journalist"]);
  assert.deepEqual(restored.checkpoints, { latest: null });
});

test("pre-schema and partial saves migrate to current defaults", () => {
  const migrated = migrateCampaignState({
    player: { cash: 90 },
    reputation: { contacts: { fixer_anna: 8 } },
    world: { unlockedRefuges: [] }
  }, { now: 200 });

  assert.equal(migrated.version, CAMPAIGN_SCHEMA_VERSION);
  assert.equal(migrated.player.cash, 90);
  assert.equal(migrated.reputation.contacts.fixer_anna, 8);
  assert.deepEqual(migrated.checkpoints, { latest: null });
  assert.ok(migrated.world.unlockedRefuges.includes(CAMPAIGN_REFUGES.ROOFTOP_REFUGE));
});

test("sanitisation strips functions, invalid arrays and non-finite values", () => {
  const state = sanitizeCampaignState({
    player: { cash: Number.POSITIVE_INFINITY },
    reputation: { factions: { blackglass_directorate: Number.NaN } },
    world: {
      flags: { okay: true, bad: () => false },
      ownedVehicles: ["sedan_1", "sedan_1", ""]
    },
    inventory: { refuges: [] },
    checkpoints: { latest: { invalid: true } }
  });

  assert.equal(state.player.cash, 0);
  assert.equal(state.reputation.factions.blackglass_directorate, 0);
  assert.deepEqual(state.world.flags, { okay: true });
  assert.deepEqual(state.world.ownedVehicles, ["sedan_1"]);
  assert.deepEqual(state.checkpoints, { latest: null });
  assert.equal(campaignStateIsSerializable(state), true);
});

test("invalid JSON and future save versions fail explicitly", () => {
  assert.throws(() => deserializeCampaignState("{nope"), /not valid JSON/);
  assert.throws(() => migrateCampaignState({ version: 99 }), /newer than supported/);
});
