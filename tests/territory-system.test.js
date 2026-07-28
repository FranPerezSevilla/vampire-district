import test from "node:test";
import assert from "node:assert/strict";
import { CampaignEventBus } from "../phaser/src/campaign/CampaignEventBus.js";
import { createCampaignState, migrateCampaignState } from "../phaser/src/campaign/CampaignState.js";
import { CAMPAIGN_FACTIONS, CAMPAIGN_SCHEMA_VERSION } from "../phaser/src/campaign/constants.js";
import { ReputationSystem } from "../phaser/src/campaign/ReputationSystem.js";
import { districtZones } from "../phaser/src/data/district.js";
import {
  createTerritoryState,
  deriveTerritoryControl,
  relationshipFromReputation,
  TERRITORY_DISTRICTS
} from "../phaser/src/factions/TerritoryModel.js";
import { TerritorySystem } from "../phaser/src/factions/TerritorySystem.js";

function territoryHarness(now = 1000) {
  const state = createCampaignState({ now });
  const events = new CampaignEventBus(state, { now: () => now });
  const reputation = new ReputationSystem(state, { events });
  const territory = new TerritorySystem(state, { events, reputation, now: () => now });
  return { state, events, reputation, territory };
}

test("territory defaults cover exactly the fourteen semantic City Topology V2 districts", () => {
  const expected = districtZones.map(district => ({ id: district.id, name: district.name }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const actual = TERRITORY_DISTRICTS.map(district => ({ id: district.id, name: district.name }))
    .sort((left, right) => left.id.localeCompare(right.id));
  assert.deepEqual(actual, expected);

  const state = createTerritoryState({ now: 25 });
  assert.deepEqual(Object.keys(state.districts).sort(), expected.map(item => item.id));
  assert.equal(state.districts["civic-center"].ownerId, CAMPAIGN_FACTIONS.FIRST_ESTATE);
  assert.equal(state.districts.blackwater.ownerId, CAMPAIGN_FACTIONS.GUTTER_CROWN);
  assert.equal(state.districts["old-quarter"].status, "contested");
  assert.equal(state.districts["canal-east"].status, "contested");
});

test("territory ownership is derived from bounded influence rather than trusted save labels", () => {
  assert.deepEqual(deriveTerritoryControl({ first_estate: 0, gutter_crown: 0 }), {
    status: "independent",
    ownerId: null,
    leaderId: "first_estate",
    lead: 0,
    influence: { first_estate: 0, gutter_crown: 0 }
  });
  assert.equal(deriveTerritoryControl({ first_estate: 70, gutter_crown: 48 }).ownerId, "first_estate");
  assert.equal(deriveTerritoryControl({ first_estate: 57, gutter_crown: 43 }).status, "contested");
  assert.equal(deriveTerritoryControl({ first_estate: 900, gutter_crown: -10 }).influence.first_estate, 100);
});

test("influence changes emit once and transfer control deterministically", () => {
  const { state, events, territory } = territoryHarness(4000);
  const influenceEvents = [];
  const ownerEvents = [];
  events.on("territory:influence-changed", event => influenceEvents.push(event));
  events.on("territory:owner-changed", event => ownerEvents.push(event));

  const result = territory.setInfluence("old-quarter", CAMPAIGN_FACTIONS.FIRST_ESTATE, 70, {
    reason: "contract completed",
    source: "unit-test",
    referenceId: "job-1"
  });

  assert.equal(result.changed, true);
  assert.equal(result.ownerBefore, null);
  assert.equal(result.ownerAfter, CAMPAIGN_FACTIONS.FIRST_ESTATE);
  assert.equal(result.statusAfter, "controlled");
  assert.equal(state.territory.districts["old-quarter"].changedAt, 4000);
  assert.equal(state.territory.districts["old-quarter"].changeCount, 1);
  assert.equal(influenceEvents.length, 1);
  assert.equal(ownerEvents.length, 1);
  assert.equal(influenceEvents[0].payload.referenceId, "job-1");

  const repeated = territory.setInfluence("old-quarter", CAMPAIGN_FACTIONS.FIRST_ESTATE, 70);
  assert.equal(repeated.changed, false);
  assert.equal(influenceEvents.length, 1);
  assert.equal(ownerEvents.length, 1);
});

test("territory relationship follows reputation with the current owner", () => {
  const { reputation, territory } = territoryHarness();
  assert.equal(territory.relationship("civic-center").relationship, "tolerated");
  reputation.setFaction(CAMPAIGN_FACTIONS.FIRST_ESTATE, -80);
  assert.equal(territory.relationship("civic-center").relationship, "hostile");
  assert.equal(territory.relationship("civic-center").restricted, true);
  reputation.setFaction(CAMPAIGN_FACTIONS.FIRST_ESTATE, 50);
  assert.equal(territory.relationship("civic-center").relationship, "welcome");
  assert.equal(territory.relationship("old-quarter").relationship, "neutral");

  assert.equal(relationshipFromReputation(-61), "hostile");
  assert.equal(relationshipFromReputation(-31), "restricted");
  assert.equal(relationshipFromReputation(-11), "watched");
  assert.equal(relationshipFromReputation(35), "tolerated");
  assert.equal(relationshipFromReputation(36), "welcome");
});

test("version-two campaign saves gain territory without losing existing campaign state", () => {
  const migrated = migrateCampaignState({
    version: 2,
    player: { cash: 480 },
    reputation: { factions: { first_estate: 17 }, contacts: { estate_cleaner: 4 } },
    world: { ownedVehicles: ["estate_van"], flags: { retained: true } }
  }, { now: 9000 });

  assert.equal(migrated.version, CAMPAIGN_SCHEMA_VERSION);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.player.cash, 480);
  assert.equal(migrated.reputation.factions.first_estate, 17);
  assert.equal(migrated.reputation.contacts.estate_cleaner, 4);
  assert.deepEqual(migrated.world.ownedVehicles, ["estate_van"]);
  assert.equal(migrated.world.flags.retained, true);
  assert.equal(Object.keys(migrated.territory.districts).length, 14);
});
