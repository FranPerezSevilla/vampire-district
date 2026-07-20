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

test("fresh campaign state is JSON-only and contains the starting refuge checkpoint", () => {
  const state = createCampaignState({ now: 1234 });
  assert.equal(state.version, CAMPAIGN_SCHEMA_VERSION);
  assert.equal(state.player.cash, 0);
  assert.equal(state.player.currentRefugeId, CAMPAIGN_REFUGES.ROOFTOP_REFUGE);
  assert.deepEqual(state.world.unlockedRefuges, [CAMPAIGN_REFUGES.ROOFTOP_REFUGE]);
  assert.ok(state.inventory.refuges[CAMPAIGN_REFUGES.ROOFTOP_REFUGE]);
  assert.equal(state.checkpoint.id, "campaign_start");
  assert.equal(state.checkpoint.locationId, CAMPAIGN_REFUGES.ROOFTOP_REFUGE);
  assert.equal(campaignStateIsSerializable(state), true);
});

test("campaign state serializes and restores deterministic mission, checkpoint, inventory and reputation data", () => {
  const state = createCampaignState({ now: 10 });
  state.player.cash = 725;
  state.reputation.factions.blackglass_directorate = 12;
  state.reputation.contacts.police_roof_informant = 3;
  state.inventory.carried.sidearmWeaponId = "pistol";
  state.inventory.carried.ammoByType.pistol = 24;
  state.world.flags.journalist_silenced = true;
  state.missions.completed.push("silence_the_journalist");
  state.checkpoint = {
    id: "journalist_handled",
    kind: "objective",
    missionId: "silence_the_journalist",
    objectiveId: "return_to_refuge",
    locationId: "nightclub_district",
    capturedAt: 88,
    payload: { previousOutcome: "drained" }
  };

  const restored = deserializeCampaignState(serializeCampaignState(state), { now: 99 });
  assert.equal(restored.player.cash, 725);
  assert.equal(restored.reputation.factions.blackglass_directorate, 12);
  assert.equal(restored.reputation.contacts.police_roof_informant, 3);
  assert.equal(restored.inventory.carried.sidearmWeaponId, "pistol");
  assert.equal(restored.inventory.carried.ammoByType.pistol, 24);
  assert.equal(restored.world.flags.journalist_silenced, true);
  assert.deepEqual(restored.missions.completed, ["silence_the_journalist"]);
  assert.equal(restored.checkpoint.id, "journalist_handled");
  assert.equal(restored.checkpoint.objectiveId, "return_to_refuge");
  assert.equal(restored.checkpoint.payload.previousOutcome, "drained");
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
  assert.ok(migrated.world.unlockedRefuges.includes(CAMPAIGN_REFUGES.ROOFTOP_REFUGE));
  assert.equal(migrated.checkpoint.id, "campaign_start");
});

test("sanitisation strips functions, invalid arrays and non-finite values", () => {
  const state = sanitizeCampaignState({
    player: { cash: Number.POSITIVE_INFINITY },
    reputation: { factions: { blackglass_directorate: Number.NaN } },
    world: {
      flags: { okay: true, bad: () => false },
      ownedVehicles: ["sedan_1", "sedan_1", ""]
    },
    checkpoint: {
      id: "safe",
      locationId: "police_roof",
      payload: { okay: true, bad: () => false }
    },
    inventory: { refuges: [] }
  });

  assert.equal(state.player.cash, 0);
  assert.equal(state.reputation.factions.blackglass_directorate, 0);
  assert.deepEqual(state.world.flags, { okay: true });
  assert.deepEqual(state.world.ownedVehicles, ["sedan_1"]);
  assert.equal(state.checkpoint.id, "safe");
  assert.deepEqual(state.checkpoint.payload, { okay: true });
  assert.equal(campaignStateIsSerializable(state), true);
});

test("invalid JSON and future save versions fail explicitly", () => {
  assert.throws(() => deserializeCampaignState("{nope"), /not valid JSON/);
  assert.throws(() => migrateCampaignState({ version: 99 }), /newer than supported/);
});
