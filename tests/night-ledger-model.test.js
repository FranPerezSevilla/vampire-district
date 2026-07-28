import test from "node:test";
import assert from "node:assert/strict";
import { buildNightLedgerModel, wantedLabel } from "../phaser/src/ui/NightLedgerModel.js";

function campaignSnapshot() {
  return {
    reputation: {
      factions: {
        first_estate: { value: 42, tier: { id: "favoured", label: "Favoured" } },
        gutter_crown: { value: -14, tier: { id: "distrusted", label: "Distrusted" } }
      },
      contacts: {
        house_morrow: { value: 7, tier: { id: "neutral", label: "Neutral" } }
      }
    },
    territory: {
      districts: {
        "civic-center": { id: "civic-center", name: "Civic Centre", ownerId: "first_estate", status: "controlled" },
        hospital: { id: "hospital", name: "St. Orison Hospital", ownerId: "first_estate", status: "controlled" },
        blackwater: { id: "blackwater", name: "Blackwater Industrial", ownerId: "gutter_crown", status: "controlled" },
        "old-quarter": { id: "old-quarter", name: "Old Quarter", ownerId: null, status: "contested" }
      }
    },
    huntingLaw: {
      rights: {
        "right-1": {
          id: "right-1",
          districtId: "civic-center",
          factionId: "first_estate",
          source: "donor-program",
          revokedAt: 0,
          expiresAt: 0
        }
      },
      protectedVictims: {
        "protected-1": {
          id: "protect-1",
          victimId: "protected-1",
          factionId: "gutter_crown",
          revokedAt: 0
        }
      },
      assessments: [
        {
          id: "hunt-1",
          timestamp: 9000,
          districtId: "civic-center",
          districtName: "Civic Centre",
          ownerId: "first_estate",
          ownerLabel: "The First Estate",
          feedingDepth: "quick_bite",
          classification: "poaching",
          politicalViolation: true,
          discoveryState: "latent",
          currentDiscoveryState: "latent"
        },
        {
          id: "hunt-2",
          timestamp: 9500,
          districtId: "blackwater",
          districtName: "Blackwater Industrial",
          ownerId: "gutter_crown",
          ownerLabel: "The Gutter Crown",
          protectedByFactionId: "gutter_crown",
          feedingDepth: "drain",
          classification: "protected",
          politicalViolation: true,
          discoveryState: "known",
          currentDiscoveryState: "known"
        }
      ]
    },
    state: {
      eventLog: [{
        id: "evt-1",
        type: "reputation:changed",
        timestamp: 8000,
        payload: { id: "first_estate", delta: 5 }
      }]
    }
  };
}

test("Night Ledger aggregates factions, hunting rights and political violations", () => {
  const model = buildNightLedgerModel({
    campaignSnapshot: campaignSnapshot(),
    currentDistrict: {
      id: "civic-center",
      name: "Civic Centre",
      ownerId: "first_estate",
      ownerLabel: "The First Estate",
      status: "controlled",
      relationship: "welcome"
    },
    policeState: { level: 0, exposureValue: 0 },
    now: 10_000
  });

  assert.equal(model.ready, true);
  assert.equal(model.severity, "danger");
  assert.equal(model.latentViolationCount, 1);
  assert.equal(model.knownViolationCount, 1);
  assert.equal(model.alertCount, 2);
  assert.equal(model.independentHouses.contactCount, 1);

  const estate = model.factions.find(faction => faction.id === "first_estate");
  assert.equal(estate.reputation.value, 42);
  assert.equal(estate.reputation.tierLabel, "Favoured");
  assert.equal(estate.controlledDistrictCount, 2);
  assert.equal(estate.activeRightsCount, 1);
  assert.equal(estate.latentViolationCount, 1);
  assert.equal(estate.knownViolationCount, 0);

  const crown = model.factions.find(faction => faction.id === "gutter_crown");
  assert.equal(crown.protectedVictimCount, 1);
  assert.equal(crown.knownViolationCount, 1);
  assert.equal(model.incidents[0].title, "PROTECTED PREY");
  assert.equal(model.incidents[0].status, "DISCOVERED");
  assert.match(model.incidents[0].detail, /^DRAIN ·/);
  assert.match(model.incidents[1].detail, /^QUICK BITE ·/);
});

test("Night Ledger promotes active police pursuit into the alert badge and incident stream", () => {
  const model = buildNightLedgerModel({
    campaignSnapshot: {
      ...campaignSnapshot(),
      huntingLaw: { rights: {}, protectedVictims: {}, assessments: [] },
      state: { eventLog: [] }
    },
    policeState: {
      level: 2,
      exposureValue: 64,
      exposureMax: 125,
      lastReason: "A witness reports a stolen vehicle.",
      footOfficers: 6,
      chasingOfficers: 2,
      motorizedUnits: 1,
      desiredMotorizedUnits: 1,
      fleeingWitnesses: 1,
      witnessReports: 2,
      bodiesDiscovered: 1,
      hottestZoneName: "Civic Centre",
      hottestZoneHeat: 43
    },
    now: 10_000
  });

  assert.equal(wantedLabel(2), "PURSUIT");
  assert.equal(model.severity, "danger");
  assert.equal(model.alertCount, 1);
  assert.equal(model.police.stateLabel, "PURSUIT");
  assert.equal(Math.round(model.police.exposurePercent), 51);
  assert.equal(model.incidents[0].title, "POLICE PURSUIT");
  assert.equal(model.incidents[0].status, "ACTIVE");
});
