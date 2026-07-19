import test from "node:test";
import assert from "node:assert/strict";
import { GameplayRuntime } from "../phaser/src/runtime/GameplayRuntime.js";

function runtimeFixture({ cinematicActive = false, registryActive = false } = {}) {
  let cameraUpdates = 0;
  const scene = {
    taskRevealCinematic: { active: cinematicActive },
    registry: { get: key => key === "taskRevealActive" && registryActive },
    updateCameraForLayer() { cameraUpdates++; },
    outskirtsSystem: { updatePresentation() {} },
    objectiveMarkerSystem: { update() {} },
    drawPromptMarker() {},
    statePublisher: { setMany() {} },
    npcSystem: { spatial: { size: () => 0 } },
    time: { now: 0 },
    publishState() {}
  };
  const runtime = Object.create(GameplayRuntime.prototype);
  runtime.scene = scene;
  runtime.diagnostics = {
    endFrame: () => 0,
    summary: () => "runtime",
    snapshot: () => ({ conflicts: [] })
  };
  return {
    runtime,
    cameraUpdates: () => cameraUpdates
  };
}

test("normal layer zoom does not overwrite an active tutorial cinematic", () => {
  const fixture = runtimeFixture({ cinematicActive: true });
  fixture.runtime.finishFrame();
  assert.equal(fixture.cameraUpdates(), 0);
});

test("registry-owned task cinematics also retain camera ownership", () => {
  const fixture = runtimeFixture({ registryActive: true });
  fixture.runtime.finishFrame();
  assert.equal(fixture.cameraUpdates(), 0);
});

test("layer zoom resumes after the cinematic releases the camera", () => {
  const fixture = runtimeFixture();
  fixture.runtime.finishFrame();
  assert.equal(fixture.cameraUpdates(), 1);
});
