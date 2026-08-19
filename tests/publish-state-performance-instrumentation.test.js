import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installPublishStateInstrumentation } from "../phaser/src/runtime/PublishStateInstrumentation.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function createScene() {
  const scene = {
    describeCurrentZone: () => "zone",
    visibilityText: () => "visible",
    missionSystem: { objectiveText: () => "mission" },
    npcSystem: { summary: () => "npc" },
    feedingSystem: { summary: () => "hunger" },
    powersSystem: { summary: () => "powers" },
    exposureSystem: { summary: () => "exposure" },
    heatSystem: { summary: () => "heat", level: () => 2 },
    witnessSystem: { summary: () => "witness" },
    evidenceSystem: { summary: () => "evidence" },
    policeSystem: { summary: () => "police" },
    hunterSystem: { summary: () => "hunter" },
    propDamageSystem: { summary: () => "props" },
    aiStateSystem: { summary: () => "ai" },
    interactionSystem: { isOpen: false, snapshot: () => ({ open: false }) },
    statePublisher: { setMany: payload => payload }
  };
  scene.publishState = function publishState() {
    const layerName = "Street";
    const zone = this.describeCurrentZone();
    const movementPrompt = "";
    const interactionPrompt = "";
    return this.statePublisher.setMany({
      statusText: `${layerName} · ${zone}`,
      visibility: this.visibilityText(),
      mission: this.missionSystem.objectiveText(),
      npc: this.npcSystem.summary(),
      hunger: this.feedingSystem.summary(),
      powers: this.powersSystem.summary(),
      exposure: this.exposureSystem.summary(),
      heat: this.heatSystem.summary(),
      wanted: this.heatSystem.level(),
      witness: this.witnessSystem.summary(),
      evidence: this.evidenceSystem.summary(),
      police: this.policeSystem.summary(),
      hunter: this.hunterSystem.summary(),
      props: this.propDamageSystem.summary(),
      ai: this.aiStateSystem.summary(),
      playerXY: "100, 100",
      interactionPrompt: this.interactionSystem.isOpen ? "" : movementPrompt || interactionPrompt,
      lastActionText: "status",
      menu: this.interactionSystem.snapshot()
    });
  };
  return scene;
}

test("publishState profiler measures coarse phases and summary groups only inside publishState", () => {
  const scene = createScene();
  const originalPublishState = scene.publishState;
  const originalVisibilityText = scene.visibilityText;
  const originalNpcSummary = scene.npcSystem.summary;
  const originalExposureSummary = scene.exposureSystem.summary;
  const originalPoliceSummary = scene.policeSystem.summary;
  const originalPropSummary = scene.propDamageSystem.summary;
  const originalAiSummary = scene.aiStateSystem.summary;
  const originalInteractionSnapshot = scene.interactionSystem.snapshot;
  const originalSetMany = scene.statePublisher.setMany;
  const begin = [];
  const end = [];
  const diagnostics = {
    beginSystem(name) {
      begin.push(name);
      return name;
    },
    endSystem(name, mark) {
      end.push([name, mark]);
    }
  };

  const cleanup = installPublishStateInstrumentation(scene, diagnostics);

  // Individual leaf summaries remain untouched. The selected ResponseAI group is
  // split with exactly one extra existing boundary at propDamageSystem.summary().
  assert.equal(scene.npcSystem.summary, originalNpcSummary);
  assert.notEqual(scene.exposureSystem.summary, originalExposureSummary);
  assert.notEqual(scene.policeSystem.summary, originalPoliceSummary);
  assert.notEqual(scene.propDamageSystem.summary, originalPropSummary);
  assert.notEqual(scene.aiStateSystem.summary, originalAiSummary);

  scene.npcSystem.summary();
  scene.exposureSystem.summary();
  scene.policeSystem.summary();
  scene.propDamageSystem.summary();
  scene.aiStateSystem.summary();
  scene.visibilityText();
  scene.interactionSystem.snapshot();
  scene.statePublisher.setMany({ outside: true });
  assert.deepEqual(begin, []);

  scene.publishState();
  const expectedBegin = [
    "PublishState.Prepare",
    "PublishState.Summaries",
    "PublishState.Summary.MissionActors",
    "PublishState.Summary.PressureEvidence",
    "PublishState.Summary.ResponseAI.Security",
    "PublishState.Summary.ResponseAI.WorldAI",
    "PublishState.Summary.Tail",
    "PublishState.InteractionMenu",
    "PublishState.PayloadTail",
    "PublishState.RegistryCommit"
  ];
  const expectedEnd = [
    "PublishState.Prepare",
    "PublishState.Summary.MissionActors",
    "PublishState.Summary.PressureEvidence",
    "PublishState.Summary.ResponseAI.Security",
    "PublishState.Summary.ResponseAI.WorldAI",
    "PublishState.Summary.Tail",
    "PublishState.Summaries",
    "PublishState.InteractionMenu",
    "PublishState.PayloadTail",
    "PublishState.RegistryCommit"
  ];
  assert.deepEqual(begin, expectedBegin);
  assert.deepEqual(end.map(([name]) => name), expectedEnd);
  assert.deepEqual(new Set(end.map(([, mark]) => mark)), new Set(expectedBegin));

  cleanup();
  assert.equal(scene.publishState, originalPublishState);
  assert.equal(scene.visibilityText, originalVisibilityText);
  assert.equal(scene.npcSystem.summary, originalNpcSummary);
  assert.equal(scene.exposureSystem.summary, originalExposureSummary);
  assert.equal(scene.policeSystem.summary, originalPoliceSummary);
  assert.equal(scene.propDamageSystem.summary, originalPropSummary);
  assert.equal(scene.aiStateSystem.summary, originalAiSummary);
  assert.equal(scene.interactionSystem.snapshot, originalInteractionSnapshot);
  assert.equal(scene.statePublisher.setMany, originalSetMany);
});

test("browser performance capture keeps grouped publishState and summary drill-down as parallel rankings", () => {
  const runtime = source("phaser/src/runtime/GameplayRuntime.js");
  const capture = source("tests/browser/runtime-performance-capture.spec.js");
  const instrumentation = source("phaser/src/runtime/PublishStateInstrumentation.js");

  assert.match(runtime, /installPublishStateInstrumentation/);
  assert.match(runtime, /removePublishStateInstrumentation/);
  assert.match(instrumentation, /PublishState\.Prepare/);
  assert.match(instrumentation, /PublishState\.Summaries/);
  assert.match(instrumentation, /PublishState\.InteractionMenu/);
  assert.match(instrumentation, /PublishState\.PayloadTail/);
  assert.match(instrumentation, /PublishState\.RegistryCommit/);
  assert.match(instrumentation, /PublishState\.Summary\.MissionActors/);
  assert.match(instrumentation, /PublishState\.Summary\.PressureEvidence/);
  assert.match(instrumentation, /PublishState\.Summary\.ResponseAI\.Security/);
  assert.match(instrumentation, /PublishState\.Summary\.ResponseAI\.WorldAI/);
  assert.match(instrumentation, /PublishState\.Summary\.Tail/);
  assert.match(capture, /PUBLISH_STATE_PHASE_NAMES/);
  assert.match(capture, /PUBLISH_STATE_SUMMARY_PREFIX\s*=\s*"PublishState\.Summary\."/);
  assert.match(capture, /publishStateSystems/);
  assert.match(capture, /publishStateSummarySystems/);
  assert.match(capture, /publishState:\s*summarizeRanking/);
  assert.match(capture, /publishStateSummaries:\s*summarizeRanking/);
});
