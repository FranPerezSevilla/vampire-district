import test from "node:test";
import assert from "node:assert/strict";
import { CampaignEventBus } from "../phaser/src/campaign/CampaignEventBus.js";
import { createCampaignState, migrateCampaignState } from "../phaser/src/campaign/CampaignState.js";
import { CAMPAIGN_FACTIONS, CAMPAIGN_SCHEMA_VERSION } from "../phaser/src/campaign/constants.js";
import { ReputationSystem } from "../phaser/src/campaign/ReputationSystem.js";
import {
  classifyHuntingFacts,
  HUNTING_CLASSIFICATION,
  HUNTING_DISCOVERY
} from "../phaser/src/factions/HuntingLawModel.js";
import { HuntingLawSystem } from "../phaser/src/factions/HuntingLawSystem.js";
import { TerritorySystem } from "../phaser/src/factions/TerritorySystem.js";

function harness(now = 1000) {
  let clock = now;
  const state = createCampaignState({ now: clock });
  const events = new CampaignEventBus(state, { now: () => clock });
  const reputation = new ReputationSystem(state, { events });
  const territory = new TerritorySystem(state, { events, reputation, now: () => clock });
  const huntingLaw = new HuntingLawSystem(state, { events, territory, now: () => clock });
  return {
    state,
    events,
    reputation,
    territory,
    huntingLaw,
    setNow(value) { clock = value; }
  };
}

const ESTATE_DISTRICT = Object.freeze({
  id: "civic-center",
  name: "Civic Centre",
  ownerId: CAMPAIGN_FACTIONS.FIRST_ESTATE,
  ownerLabel: "The First Estate",
  status: "controlled",
  relationship: "tolerated"
});

const CROWN_DISTRICT = Object.freeze({
  id: "blackwater",
  name: "Blackwater Industrial",
  ownerId: CAMPAIGN_FACTIONS.GUTTER_CROWN,
  ownerLabel: "The Gutter Crown",
  status: "controlled",
  relationship: "tolerated"
});

test("hunting classification distinguishes Estate poaching from quiet Crown tolerance", () => {
  const estate = classifyHuntingFacts({
    district: ESTATE_DISTRICT,
    victim: { id: "victim-estate", type: "civilian" },
    bodyEvidence: true,
    biteEvidence: true
  });
  assert.equal(estate.classification, HUNTING_CLASSIFICATION.POACHING);
  assert.equal(estate.politicalViolation, true);
  assert.equal(estate.discoveryState, HUNTING_DISCOVERY.LATENT);
  assert.deepEqual(estate.evidenceSources, ["body_evidence", "bite_evidence"]);

  const crown = classifyHuntingFacts({
    district: CROWN_DISTRICT,
    victim: { id: "victim-crown", type: "civilian" },
    bodyEvidence: true,
    biteEvidence: true
  });
  assert.equal(crown.classification, HUNTING_CLASSIFICATION.TOLERATED);
  assert.equal(crown.politicalViolation, false);
  assert.equal(crown.discoveryState, HUNTING_DISCOVERY.LATENT);
});

test("explicit rights are legal while contested ground remains unclaimed", () => {
  const legal = classifyHuntingFacts({
    district: ESTATE_DISTRICT,
    victim: { id: "registered-donor", type: "civilian" },
    right: { id: "right-1" },
    bodyEvidence: false,
    biteEvidence: true
  });
  assert.equal(legal.classification, HUNTING_CLASSIFICATION.LEGAL);
  assert.equal(legal.politicalViolation, false);

  const unclaimed = classifyHuntingFacts({
    district: { ...ESTATE_DISTRICT, ownerId: null, ownerLabel: null, status: "contested", relationship: "neutral" },
    victim: { id: "old-quarter-prey", type: "civilian" },
    bodyEvidence: true
  });
  assert.equal(unclaimed.classification, HUNTING_CLASSIFICATION.UNCLAIMED);
  assert.equal(unclaimed.politicalViolation, false);
});

test("protected prey overrides a general hunting right and is immediately discoverable", () => {
  const result = classifyHuntingFacts({
    district: ESTATE_DISTRICT,
    victim: { id: "estate-cleaner", type: "civilian" },
    right: { id: "general-right" },
    protection: { id: "protected-1", factionId: CAMPAIGN_FACTIONS.FIRST_ESTATE },
    witnessCount: 0,
    bodyEvidence: false,
    biteEvidence: false
  });
  assert.equal(result.classification, HUNTING_CLASSIFICATION.PROTECTED);
  assert.equal(result.politicalViolation, true);
  assert.equal(result.discoveryState, HUNTING_DISCOVERY.KNOWN);
  assert.deepEqual(result.evidenceSources, ["protected_marker"]);
});

test("rats remain exempt from faction hunting law", () => {
  const result = classifyHuntingFacts({
    district: ESTATE_DISTRICT,
    victim: { id: "rat-cross", type: "rat", huntingProtected: true },
    protection: { id: "ignored-protection" },
    witnessCount: 3,
    bodyEvidence: true
  });
  assert.equal(result.classification, HUNTING_CLASSIFICATION.EXEMPT);
  assert.equal(result.politicalViolation, false);
});

test("hunting rights, assessments and protected prey use stable campaign events", () => {
  const { events, huntingLaw } = harness(2000);
  const emitted = [];
  events.on("*", event => emitted.push(event));

  const right = huntingLaw.grantRight({
    districtId: "civic-center",
    victimTypes: ["civilian"],
    source: "estate-donor-program",
    referenceId: "favour-1"
  });
  const legal = huntingLaw.assessFeed({
    districtId: "civic-center",
    victim: { id: "donor-1", type: "civilian" },
    biteEvidence: true,
    source: "unit-test"
  });

  assert.equal(right.id, "right-000001");
  assert.equal(legal.id, "hunt-000001");
  assert.equal(legal.classification, HUNTING_CLASSIFICATION.LEGAL);
  assert.equal(legal.permissionId, right.id);
  assert.equal(legal.permissionSource, "estate-donor-program");

  huntingLaw.protectVictim({
    victimId: "protected-1",
    factionId: CAMPAIGN_FACTIONS.FIRST_ESTATE,
    source: "estate-registry"
  });
  const protectedFeed = huntingLaw.assessFeed({
    districtId: "civic-center",
    victim: { id: "protected-1", type: "civilian" },
    source: "unit-test"
  });

  assert.equal(protectedFeed.classification, HUNTING_CLASSIFICATION.PROTECTED);
  assert.equal(protectedFeed.currentDiscoveryState, HUNTING_DISCOVERY.KNOWN);
  assert.match(protectedFeed.notice, /PROTECTED PREY/);
  assert.equal(emitted.filter(event => event.type === "hunting:right-granted").length, 1);
  assert.equal(emitted.filter(event => event.type === "hunting:victim-protected").length, 1);
  assert.equal(emitted.filter(event => event.type === "hunting:assessed").length, 2);
  assert.equal(emitted.filter(event => event.type === "hunting:violation-discovered").length, 1);
  assert.equal(emitted.filter(event => event.type === "hunting:protected-victim-harmed").length, 1);
});

test("latent poaching becomes known exactly once when the body is recovered", () => {
  const { events, huntingLaw, state, setNow } = harness(3000);
  const discoveries = [];
  events.on("hunting:violation-discovered", event => discoveries.push(event));

  const assessment = huntingLaw.assessFeed({
    districtId: "civic-center",
    victim: { id: "poached-victim", type: "civilian" },
    feedingDepth: "full_feed",
    victimOutcome: "unconscious",
    victimAlive: true,
    victimConscious: false,
    memoryState: "fragmented",
    bodyEvidence: false,
    biteEvidence: true,
    source: "unit-test"
  });
  assert.equal(assessment.classification, HUNTING_CLASSIFICATION.POACHING);
  assert.equal(assessment.currentDiscoveryState, HUNTING_DISCOVERY.LATENT);
  assert.equal(assessment.feedingDepth, "full_feed");
  assert.equal(assessment.victimOutcome, "unconscious");
  assert.equal(assessment.victimAlive, true);
  assert.equal(assessment.victimConscious, false);
  assert.equal(assessment.bodyEvidence, false);
  assert.equal(assessment.biteEvidence, true);
  assert.equal(discoveries.length, 0);

  setNow(4500);
  const first = huntingLaw.discover(assessment.id, {
    source: "recovered_body",
    witnessId: "witness-1",
    referenceId: "poached-victim"
  });
  const repeated = huntingLaw.discover(assessment.id, {
    source: "matching_bite_pattern",
    witnessId: "witness-2"
  });

  assert.equal(first.assessmentId, assessment.id);
  assert.deepEqual(repeated.sources.sort(), ["matching_bite_pattern", "recovered_body"]);
  assert.equal(repeated.witnessId, "witness-1");
  assert.equal(discoveries.length, 1);
  assert.equal(state.huntingLaw.counters.knownViolations, 1);
  assert.equal(huntingLaw.lastAssessment().currentDiscoveryState, HUNTING_DISCOVERY.KNOWN);
});

test("version-three saves gain hunting-law state without losing territory or campaign data", () => {
  const migrated = migrateCampaignState({
    version: 3,
    player: { cash: 725 },
    reputation: { factions: { first_estate: 19, gutter_crown: -8 }, contacts: {} },
    territory: {
      version: 1,
      districts: {
        "old-quarter": {
          id: "old-quarter",
          influence: { first_estate: 70, gutter_crown: 30 },
          changedAt: 444,
          changeCount: 2
        }
      }
    },
    world: { ownedVehicles: ["refuge_compact"], flags: { retained: true } }
  }, { now: 9000 });

  assert.equal(CAMPAIGN_SCHEMA_VERSION, 4);
  assert.equal(migrated.version, 4);
  assert.equal(migrated.player.cash, 725);
  assert.equal(migrated.reputation.factions.first_estate, 19);
  assert.equal(migrated.territory.districts["old-quarter"].ownerId, CAMPAIGN_FACTIONS.FIRST_ESTATE);
  assert.equal(migrated.territory.districts["old-quarter"].changeCount, 2);
  assert.deepEqual(migrated.world.ownedVehicles, ["refuge_compact"]);
  assert.equal(migrated.world.flags.retained, true);
  assert.equal(migrated.huntingLaw.version, 2);
  assert.deepEqual(migrated.huntingLaw.assessments, []);
  assert.deepEqual(migrated.huntingLaw.rights, {});
  assert.deepEqual(migrated.huntingLaw.protectedVictims, {});
});
