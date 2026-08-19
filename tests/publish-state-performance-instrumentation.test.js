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
      interactionPrompt: this.interactionSystem.isOpen ? "" : movementPrompt || interactionPrompt,
      menu: this.interactionSystem.snapshot()
    });
  };
  return scene;
}

test("publishState profiler measures low-overhead phases only inside publishState and restores boundaries", () => {
  const scene = createScene();
  const originalPublishState = scene.publishState;
  const originalVisibilityText = scene.visibilityText;
  const originalNpcSummary = scene.npcSystem.summary;
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

  // Fine-grained summary methods are deliberately left untouched so the profiler
  // does not add seventeen wrapper/Map operations to every published frame.
  assert.equal(scene.npcSystem.summary, originalNpcSummary);
  scene.npcSystem.summary();
  scene.visibilityText();
  scene.interactionSystem.snapshot();
  scene.statePublisher.setMany({ outside: true });
  assert.deepEqual(begin, []);

  scene.publishState();
  const expected = [
    "PublishState.Prepare",
    "PublishState.Summaries",
    "PublishState.InteractionMenu",
    "PublishState.PayloadTail",
    "PublishState.RegistryCommit"
  ];
  assert.deepEqual(begin, expected);
  assert.deepEqual(end.map(([name]) => name), expected);
  assert.deepEqual(end.map(([, mark]) => mark), expected);

  cleanup();
  assert.equal(scene.publishState, originalPublishState);
  assert.equal(scene.visibilityText, originalVisibilityText);
  assert.equal(scene.npcSystem.summary, originalNpcSummary);
  assert.equal(scene.interactionSystem.snapshot, originalInteractionSnapshot);
  assert.equal(scene.statePublisher.setMany, originalSetMany);
});

test("browser performance capture keeps publishState as a parallel ranking", () => {
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
  assert.match(capture, /PUBLISH_STATE_SYSTEM_PREFIX\s*=\s*"PublishState\."/);
  assert.match(capture, /publishStateSystems/);
  assert.match(capture, /publishState:\s*summarizeRanking/);
  assert.match(capture, /capture\.publishState\.systems\.length/);
});
