import test from "node:test";
import assert from "node:assert/strict";

import {
  EVIDENCE_KINDS,
  HEAT_LEVEL_THRESHOLDS,
  KNOWLEDGE_STATES,
  createExposureState,
  createHeatState,
  exposureValueFromState,
  heatLevelFromValue,
  sanitizeExposureState,
  sanitizeHeatState
} from "../phaser/src/data/attention.js";
import { ExposureSystem } from "../phaser/src/systems/ExposureSystem.js";
import { HeatSystem } from "../phaser/src/systems/HeatSystem.js";

function scene() {
  const emitted = [];
  return {
    player: { x: 1500, y: 500 },
    currentLayer: 0,
    events: {
      once() {},
      emit(type, payload) { emitted.push({ type, payload }); }
    },
    campaignSystem: null,
    policeSystem: { police: () => [] },
    emitted
  };
}

test("Heat thresholds produce the four police response states", () => {
  assert.equal(heatLevelFromValue(0), 0);
  assert.equal(heatLevelFromValue(HEAT_LEVEL_THRESHOLDS[1] - 0.01), 0);
  assert.equal(heatLevelFromValue(HEAT_LEVEL_THRESHOLDS[1]), 1);
  assert.equal(heatLevelFromValue(HEAT_LEVEL_THRESHOLDS[2]), 2);
  assert.equal(heatLevelFromValue(HEAT_LEVEL_THRESHOLDS[3]), 3);
  assert.equal(heatLevelFromValue(999), 3);
});

test("new Heat escalation respects its grace and Wanted 2 stays sticky afterwards", () => {
  const targetScene = scene();
  const heat = new HeatSystem(targetScene, { state: createHeatState() });
  let now = 1_000;
  heat.now = () => now;

  heat.forceLevel(2, "A fresh report starts a pursuit.");
  const escalatedValue = heat.maximum();
  assert.equal(heat.level(), 2);
  assert.equal(escalatedValue, HEAT_LEVEL_THRESHOLDS[2]);

  assert.equal(heat.cool(1), 0);
  assert.equal(heat.maximum(), escalatedValue);
  assert.equal(heat.level(), 2);

  now += 2_001;
  assert.equal(heat.cool(0.1), 0);
  assert.equal(heat.maximum(), escalatedValue);
  assert.equal(heat.level(), 2);
});

test("Heat can be deliberately downgraded without touching Exposure", () => {
  const targetScene = scene();
  const heat = new HeatSystem(targetScene, { state: createHeatState() });
  heat.addInDistrict("old-quarter", 80, "Active pursuit.", { persist: false });
  const removed = heat.reduceInDistrict("old-quarter", 36, "A compromised officer calls units off.", { persist: false });
  assert.equal(removed, 36);
  assert.equal(Math.round(heat.valueFor("old-quarter")), 44);
  assert.equal(heat.level(), 1);
  assert.ok(targetScene.emitted.some(event => event.type === "heat:cooled"));
  assert.ok(targetScene.emitted.some(event => event.type === "heat:wanted-changed"));
});

test("Heat state is district-local, bounded and serializable", () => {
  const sanitized = sanitizeHeatState({
    sequence: 4,
    districts: {
      alpha: { value: 140, lastReason: "test", updatedAt: 10 },
      beta: -3
    },
    incidents: [{
      id: "heat-000004",
      districtId: "alpha",
      amount: 20,
      valueBefore: 80,
      valueAfter: 100,
      levelBefore: 3,
      levelAfter: 3,
      reason: "test",
      source: "unit",
      timestamp: 10
    }]
  });

  assert.equal(sanitized.districts.alpha.value, 100);
  assert.equal(sanitized.districts.beta, undefined);
  assert.equal(sanitized.sequence, 4);
  assert.doesNotThrow(() => JSON.stringify(sanitized));
});

test("latent evidence exists without raising Exposure until it becomes known", () => {
  const candidate = sanitizeExposureState({
    records: {
      clue: {
        id: "clue",
        kind: EVIDENCE_KINDS.DRAINED_BODY,
        districtId: "civic-center",
        layer: 0,
        sourceEvent: "feeding:drain",
        subjectId: "victim",
        createdAt: 100,
        exposureWeight: 24,
        heatWeight: 0,
        knowledgeState: KNOWLEDGE_STATES.LATENT
      }
    }
  });
  assert.equal(exposureValueFromState(candidate), 0);
  candidate.records.clue.knowledgeState = KNOWLEDGE_STATES.REPORTED;
  assert.equal(exposureValueFromState(candidate), 24);
  candidate.records.clue.knowledgeState = KNOWLEDGE_STATES.RESOLVED;
  candidate.records.clue.resolvedAt = 200;
  assert.equal(exposureValueFromState(candidate), 0);
});

test("Heat and Exposure can diverge in both directions", () => {
  const firstScene = scene();
  const heat = new HeatSystem(firstScene, { state: createHeatState() });
  const exposure = new ExposureSystem(firstScene, { state: createExposureState() });
  firstScene.heatSystem = heat;
  firstScene.exposureSystem = exposure;

  heat.forceLevel(3, "Vehicle pursuit test.");
  assert.equal(heat.level(), 3);
  assert.equal(exposure.value, 0);

  heat.clear("Trail lost.");
  const clue = exposure.registerEvidence({
    kind: EVIDENCE_KINDS.VISIBLE_POWER_USE,
    x: 1500,
    y: 500,
    layer: 0,
    sourceEvent: "unit",
    subjectId: "player",
    exposureWeight: 30,
    knowledgeState: KNOWLEDGE_STATES.LATENT,
    reason: "A supernatural trace remains."
  });
  assert.equal(exposure.value, 0);
  exposure.discoverEvidence(clue.id, { knowledgeState: KNOWLEDGE_STATES.INSTITUTIONAL });
  assert.equal(exposure.value, 30);
  assert.equal(heat.level(), 0);

  exposure.resolveEvidence(clue.id, { reason: "The last trace was destroyed." });
  assert.equal(exposure.value, 0);
});

test("crime as an alibi resolves Exposure while creating ordinary Heat", () => {
  const targetScene = scene();
  const heat = new HeatSystem(targetScene, { state: createHeatState() });
  const exposure = new ExposureSystem(targetScene, { state: createExposureState() });
  targetScene.heatSystem = heat;
  targetScene.exposureSystem = exposure;

  const clue = exposure.registerEvidence({
    kind: EVIDENCE_KINDS.DRAINED_BODY,
    x: 1500,
    y: 500,
    sourceEvent: "unit",
    subjectId: "victim",
    exposureWeight: 40,
    knowledgeState: KNOWLEDGE_STATES.INSTITUTIONAL,
    reason: "Forensics recognise an impossible body."
  });
  assert.equal(exposure.value, 40);

  exposure.resolveEvidence(clue.id, {
    reason: "The scene is reframed as a gang killing.",
    mundaneHeat: 30,
    x: 1500,
    y: 500
  });
  assert.equal(exposure.value, 0);
  assert.equal(heat.level(), 1);
  assert.ok(heat.maximum() >= 30);
});

test("physical cleanup removes latent clues but cannot erase evidence already reported", () => {
  const targetScene = scene();
  const exposure = new ExposureSystem(targetScene, { state: createExposureState() });
  targetScene.exposureSystem = exposure;

  const latent = exposure.registerEvidence({
    kind: EVIDENCE_KINDS.BLOOD_PATTERN,
    x: 1500,
    y: 500,
    sourceEvent: "unit",
    subjectId: "latent-scene",
    exposureWeight: 9,
    knowledgeState: KNOWLEDGE_STATES.LATENT
  });
  const reported = exposure.registerEvidence({
    kind: EVIDENCE_KINDS.DRAINED_BODY,
    x: 1500,
    y: 500,
    sourceEvent: "unit",
    subjectId: "reported-scene",
    exposureWeight: 24,
    knowledgeState: KNOWLEDGE_STATES.REPORTED
  });

  assert.ok(exposure.resolveEvidence(latent.id, { onlyLatent: true, source: "physical_cleanup" }));
  assert.equal(exposure.resolveEvidence(reported.id, { onlyLatent: true, source: "physical_cleanup" }), null);
  assert.equal(exposure.value, 24);
  assert.equal(exposure.snapshot().records[reported.id].knowledgeState, KNOWLEDGE_STATES.REPORTED);
});

test("legacy scalar Exposure migrates into one explicit institutional record", () => {
  const migrated = sanitizeExposureState(null, { legacyValue: 51, now: 500 });
  const records = Object.values(migrated.records);
  assert.equal(records.length, 1);
  assert.equal(records[0].kind, EVIDENCE_KINDS.LEGACY_EXPOSURE);
  assert.equal(records[0].knowledgeState, KNOWLEDGE_STATES.INSTITUTIONAL);
  assert.equal(exposureValueFromState(migrated), 51);
});
